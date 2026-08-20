/**
 * Land geometry for the three.js world map: every Natural Earth country
 * extruded from the sea plane into a slab, with its own top-face and
 * side-wall materials, plus a hairline ink outline on the cap. The drop
 * on the water is cast by an invisible slab that sits on the still-water
 * line, not the raised cap — otherwise the raking lamp projects a
 * coastline-shaped gap of lit water between the wall and the shadow.
 *
 * Close-up, neighbouring side walls still crease under the raking sun.
 * Zoomed out the camera is nearly plan-view, so those walls vanish and
 * the outline is what keeps one country readable from the next.
 *
 * Pure of game logic (see CLAUDE.md's map rule): it is handed colours and
 * polygons and hands back meshes.
 *
 * Resting ("cold") countries — the vast majority at any instant — are
 * drawn from one merged mesh per layer (cap/side/shadow-caster/outline),
 * baked with per-vertex colour, instead of one mesh set per country: this
 * is what keeps land to a handful of draw calls instead of ~2000. A
 * country currently hovered, selected or home ("hot" — always a tiny set)
 * needs a genuine per-country lift (it visibly rises), which a single
 * merged mesh can't express without a custom vertex shader this codebase
 * has never used — so a hot country is pulled out of the merged layer
 * (its triangles collapsed to zero area, its outline segments moved to an
 * off-board sentinel) and drawn instead by its own small mesh set, built
 * by the same per-country code this file always used. See buildTerrain().
 */

import {
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  Uint32BufferAttribute,
  type BufferAttribute,
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  boardToShape,
  boardToWorld,
  LAND_DRAFT,
  LAND_HEIGHT,
  WRAP_OFFSETS,
  type Point,
} from "../../lib/map/projection.ts";
import type { Polys, Rings } from "../../lib/map/geo.ts";
import { SEA_Y } from "./sea.ts";

/** How much darker a country's side wall is than its top face. Close-up
 *  this still creases neighbours; the cap outline carries the far view. */
const SIDE_DARKEN = 0.82;
/** Side wall of a lit country (home / hovered / selected) — barely darkened
 *  and slightly warm, so the whole slab reads as picked out rather than
 *  just recoloured on top. */
const SIDE_DARKEN_HOT = 0.92;
/** Hair above the cap so the stroke does not z-fight the top face. */
const BORDER_LIFT = 0.04;
/** Screen-space so the outline stays a hairline at every zoom — world-unit
 *  width would vanish from the far, near-plan view where it is most needed. */
const BORDER_WIDTH = 2.15;
/** Country-border ink colour — exported so other layers (the capital
 *  plinth's rim in scenery.ts) can match it exactly instead of copying
 *  the literal, which would silently drift if this is ever retuned. */
export const BORDER_INK = 0x1e1810;
/** Default cap / side fill until the first paint() call. */
const DEFAULT_CAP_FILL = 0xa48b62;
const DEFAULT_SIDE_FILL = 0x1c1710;
/** Off-board park for a hot country's collapsed outline segments — moving
 *  a fat line's endpoints here (rather than collapsing to one point) means
 *  ordinary clip-space rejection hides it, not a same-point-segment edge
 *  case in LineMaterial's screen-space width shader. */
const OUTLINE_SENTINEL_Y = -9999;
/** Bump so WorldMap3D remounts the WebGL scene when outlines change. */
export const TERRAIN_REV = 22;

export interface CountryShapeSet {
  iso: string;
  polys: Polys;
}

export interface CountryPaint {
  fill: string;
  hot: boolean;
  /** World-space extra Y. Separate from `hot` so hovering an already-lit
   *  country (the home seat) can still raise the slab. Always 0 iff `hot`
   *  is false (landLift()'s own contract) — paint() relies on this. */
  lift: number;
}

/** A hot country's own mesh set — one per wrap tile, built and torn down
 *  on demand. Structurally the same per-country rig this file always used,
 *  just scoped to the (typically 1-3) countries currently hot instead of
 *  all ~180. */
interface HotEntry {
  iso: string;
  meshes: Mesh[];
  /** Invisible sea-line slabs; they rise with `meshes` so a hover lift
   *  lengthens the drop on the water instead of leaving it stuck. */
  casters: Mesh[];
  cap: MeshStandardMaterial;
  side: MeshStandardMaterial;
  outlines: LineSegments2[];
  geom: BufferGeometry;
  shadowGeom: BufferGeometry | null;
  outlineGeom: LineSegmentsGeometry | null;
  /** Last painted state, so a re-paint that changes nothing does no work. */
  fill: string | null;
  hot: boolean;
  lift: number;
}

/** Where one country's vertices/segments live inside the merged cold-layer
 *  buffers, so a colour write or a collapse/restore only ever touches that
 *  country's own range. */
interface CountryRange {
  iso: string;
  capStart: number;
  capCount: number;
  sideStart: number;
  sideCount: number;
  casterStart: number;
  casterCount: number;
  /** Segment (not float) units — one outline segment is 6 floats. */
  outlineStart: number;
  outlineCount: number;
}

export interface Terrain {
  /** Add this to the scene; holds every wrap tile. */
  group: Group;
  /** Repaint from an iso → colour map. Any country not in the map keeps
   *  what it had. */
  paint: (colours: Map<string, CountryPaint>) => void;
  dispose: () => void;
}

/** Normalised-board rings → a three.js Shape with holes, in the extrusion
 *  authoring plane. */
function ringsToShape(rings: Rings): Shape | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const shape = new Shape();
  outer.forEach((p: Point, i: number) => {
    const [x, y] = boardToShape(p[0], p[1]);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  for (let r = 1; r < rings.length; r++) {
    const hole = rings[r];
    if (!hole || hole.length < 3) continue;
    const path = new Shape();
    hole.forEach((p: Point, i: number) => {
      const [x, y] = boardToShape(p[0], p[1]);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    shape.holes.push(path);
  }
  return shape;
}

/** Synthetic antimeridian-cut edges sit just outside the plate (see
 *  `widenSeam` in geo.ts). Stroking them would draw a north–south line
 *  through Russia / Fiji at the wrap seam. */
function isSeamEdge(a: Point, b: Point): boolean {
  return (a[0] < 0 && b[0] < 0) || (a[0] > 1 && b[0] > 1);
}

/** Disconnected cap-edge segments for LineSegmentsGeometry. Holes (lakes)
 *  are included so a shoreline reads the same as a coast. */
function outlinePositions(polys: Polys): number[] {
  const pos: number[] = [];
  const y = LAND_HEIGHT + BORDER_LIFT;
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        if (!a || !b || isSeamEdge(a, b)) continue;
        const [ax, az] = boardToWorld(a[0], a[1]);
        const [bx, bz] = boardToWorld(b[0], b[1]);
        pos.push(ax, y, az, bx, y, bz);
      }
    }
  }
  return pos;
}

function borderMaterial(color: number, opacity: number): LineMaterial {
  return new LineMaterial({
    color,
    linewidth: BORDER_WIDTH,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  });
}

/** Printed-paper fibre on the cap, in world XZ so wrap tiles and hover
 *  lifts keep the same grain instead of sliding a UV atlas. Runs after the
 *  standard vertex-colour multiply (`#include <color_fragment>`'s own
 *  `diffuseColor *= vColor`), so it composes correctly whether the cap's
 *  colour comes from a unique per-material colour (a hot country) or a
 *  baked vertex colour (the merged cold layer). */
function installPaperGrain(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
       varying vec2 vPaperPos;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vPaperPos = (modelMatrix * vec4(transformed, 1.0)).xz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       varying vec2 vPaperPos;
       float paperHash(vec2 p) {
         vec2 n = fract(p * vec2(123.34, 456.21));
         n += dot(n, n + 45.32);
         return fract(n.x * n.y);
       }`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       {
         vec2 p = vPaperPos * 0.62;
         float n0 = paperHash(p);
         float n1 = paperHash(p * 2.6 + 1.7);
         float fibre = 0.5 + 0.5 * sin(p.x * 3.8 + n1 * 2.2);
         float grain = mix(n0, fibre, 0.46);
         diffuseColor.rgb *= 0.86 + 0.20 * grain;
       }`,
    );
  };
  mat.customProgramCacheKey = () => "map-land-paper-v2";
}

/** Extrude one country's polygons into a single slab geometry standing on
 *  the sea plane. Returns null if the polygons can't be triangulated — a
 *  malformed ring must lose one country, never the whole map. */
function countryGeometry(polys: Polys): BufferGeometry | null {
  const shapes: Shape[] = [];
  for (const rings of polys) {
    const shape = ringsToShape(rings);
    if (shape) shapes.push(shape);
  }
  if (!shapes.length) return null;
  try {
    const geom = new ExtrudeGeometry(shapes, {
      depth: LAND_HEIGHT + LAND_DRAFT,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    /* Authored flat in the shape plane with the extrusion along +z; stand
       it up so the extrusion is world height and shape y is world -z (north
       up). See boardToShape's own note. Sink by LAND_DRAFT so the still-
       water line hits the side wall rather than the underside. */
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, -LAND_DRAFT, 0);
    return geom;
  } catch (err) {
    console.warn("terrain: country geometry failed", err);
    return null;
  }
}

/** Invisible slab that sits on the still-water line and reaches the cap.
 *  Same XZ as the country, so the drop on the sea starts at the wall —
 *  a flat footprint has no height and throws nothing the lamp can draw. */
function countryShadowCaster(polys: Polys): BufferGeometry | null {
  const shapes: Shape[] = [];
  for (const rings of polys) {
    const shape = ringsToShape(rings);
    if (shape) shapes.push(shape);
  }
  if (!shapes.length) return null;
  const depth = LAND_HEIGHT - SEA_Y;
  if (depth <= 0.02) return null;
  try {
    const geom = new ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, SEA_Y, 0);
    return geom;
  } catch (err) {
    console.warn("terrain: country shadow caster failed", err);
    return null;
  }
}

/** Concatenate every group in `geom` whose materialIndex matches (a
 *  multipolygon country's ExtrudeGeometry has one cap+side group pair per
 *  shape, not one pair total) into one contiguous run, in vertex-array
 *  units. Used to split a per-country ExtrudeGeometry into its cap-only
 *  and side-only vertex data before copying into the merged buffers. */
function collectGroupVerts(
  attr: BufferAttribute,
  groups: { start: number; count: number; materialIndex?: number }[],
  materialIndex: number,
  itemSize: number,
): Float32Array {
  let total = 0;
  for (const g of groups) {
    if ((g.materialIndex ?? 0) === materialIndex) total += g.count;
  }
  const out = new Float32Array(total * itemSize);
  const src = attr.array as Float32Array;
  let offset = 0;
  for (const g of groups) {
    if ((g.materialIndex ?? 0) !== materialIndex) continue;
    const from = g.start * itemSize;
    const len = g.count * itemSize;
    out.set(src.subarray(from, from + len), offset);
    offset += len;
  }
  return out;
}

function identityIndex(count: number): Uint32BufferAttribute {
  const arr = new Uint32Array(count);
  for (let i = 0; i < count; i++) arr[i] = i;
  return new Uint32BufferAttribute(arr, 1);
}

/** Collapse a country's triangles to zero area by pointing every index in
 *  its range at the range's own first vertex — invisible from any angle,
 *  a standard degenerate-triangle hide. Index units double as vertex units
 *  here (an identity mapping to start with), so restoring needs no cache:
 *  the original value at slot `start+i` was always `start+i`. */
function collapseIndexRange(index: BufferAttribute, start: number, count: number) {
  if (count === 0) return;
  const arr = index.array as Uint32Array;
  arr.fill(start, start, start + count);
  index.addUpdateRange(start, count);
  index.needsUpdate = true;
}

function restoreIndexRange(index: BufferAttribute, start: number, count: number) {
  if (count === 0) return;
  const arr = index.array as Uint32Array;
  for (let i = 0; i < count; i++) arr[start + i] = start + i;
  index.addUpdateRange(start, count);
  index.needsUpdate = true;
}

/** Move a country's outline segments off-board rather than collapsing them
 *  to a single point — a fat line's screen-space width shader isn't
 *  guaranteed to render a zero-length segment as zero pixels, so this
 *  relies on ordinary clip-space rejection instead. */
function collapseOutlineRange(live: Float32Array, segStart: number, segCount: number) {
  if (segCount === 0) return;
  const base = segStart * 6;
  for (let i = 0; i < segCount; i++) {
    const o = base + i * 6;
    live[o] = 0;
    live[o + 1] = OUTLINE_SENTINEL_Y;
    live[o + 2] = 0;
    live[o + 3] = 0;
    live[o + 4] = OUTLINE_SENTINEL_Y;
    live[o + 5] = 0;
  }
}

function restoreOutlineRange(
  live: Float32Array,
  original: Float32Array,
  segStart: number,
  segCount: number,
) {
  if (segCount === 0) return;
  const base = segStart * 6;
  const len = segCount * 6;
  live.set(original.subarray(base, base + len), base);
}

interface MergedLayer {
  capGeom: BufferGeometry;
  sideGeom: BufferGeometry;
  casterGeom: BufferGeometry;
  outlineGeom: LineSegmentsGeometry;
  /** The live Float32Array backing outlineGeom's instanceStart/instanceEnd
   *  (passed to setPositions() by reference, so mutating this mutates the
   *  geometry directly — collapse/restore write here). */
  outlineLive: Float32Array;
  /** Pristine copy of outlineLive at build time, for restore. */
  outlineOriginal: Float32Array;
  ranges: Map<string, CountryRange>;
}

/** One-time build of every country's cap/side/caster/outline data into a
 *  handful of merged buffers, baking a default fill colour so the layer
 *  looks right even before the first paint() call. */
function buildMergedLayer(countries: CountryShapeSet[]): MergedLayer {
  interface Piece {
    iso: string;
    capPos: Float32Array;
    capNormal: Float32Array;
    capUv: Float32Array;
    sidePos: Float32Array;
    sideNormal: Float32Array;
    sideUv: Float32Array;
    casterPos: Float32Array;
    casterNormal: Float32Array;
    outline: number[];
  }

  const pieces: Piece[] = [];
  let capVerts = 0;
  let sideVerts = 0;
  let casterVerts = 0;
  let outlineFloats = 0;

  for (const { iso, polys } of countries) {
    const geom = countryGeometry(polys);
    if (!geom) continue;
    const pos = geom.attributes.position as BufferAttribute;
    const nrm = geom.attributes.normal as BufferAttribute;
    const uv = geom.attributes.uv as BufferAttribute;
    const groups = geom.groups;
    const capPos = collectGroupVerts(pos, groups, 0, 3);
    const capNormal = collectGroupVerts(nrm, groups, 0, 3);
    const capUv = collectGroupVerts(uv, groups, 0, 2);
    const sidePos = collectGroupVerts(pos, groups, 1, 3);
    const sideNormal = collectGroupVerts(nrm, groups, 1, 3);
    const sideUv = collectGroupVerts(uv, groups, 1, 2);
    geom.dispose();

    let casterPos = new Float32Array(0);
    let casterNormal = new Float32Array(0);
    const shadowGeom = countryShadowCaster(polys);
    if (shadowGeom) {
      casterPos = (shadowGeom.attributes.position.array as Float32Array).slice();
      casterNormal = (shadowGeom.attributes.normal.array as Float32Array).slice();
      shadowGeom.dispose();
    }

    const outline = outlinePositions(polys);

    pieces.push({
      iso,
      capPos,
      capNormal,
      capUv,
      sidePos,
      sideNormal,
      sideUv,
      casterPos,
      casterNormal,
      outline,
    });
    capVerts += capPos.length / 3;
    sideVerts += sidePos.length / 3;
    casterVerts += casterPos.length / 3;
    outlineFloats += outline.length;
  }

  const capPosArr = new Float32Array(capVerts * 3);
  const capNormalArr = new Float32Array(capVerts * 3);
  const capUvArr = new Float32Array(capVerts * 2);
  const capColorArr = new Float32Array(capVerts * 3);
  const sidePosArr = new Float32Array(sideVerts * 3);
  const sideNormalArr = new Float32Array(sideVerts * 3);
  const sideUvArr = new Float32Array(sideVerts * 2);
  const sideColorArr = new Float32Array(sideVerts * 3);
  const casterPosArr = new Float32Array(casterVerts * 3);
  const casterNormalArr = new Float32Array(casterVerts * 3);
  const outlineArr = new Float32Array(outlineFloats);

  const ranges = new Map<string, CountryRange>();
  const scratch = new Color();
  let capOff = 0;
  let sideOff = 0;
  let casterOff = 0;
  let outlineOff = 0;

  for (const p of pieces) {
    const capCount = p.capPos.length / 3;
    const sideCount = p.sidePos.length / 3;
    const casterCount = p.casterPos.length / 3;
    const outlineSegCount = p.outline.length / 6;

    capPosArr.set(p.capPos, capOff * 3);
    capNormalArr.set(p.capNormal, capOff * 3);
    capUvArr.set(p.capUv, capOff * 2);
    scratch.set(DEFAULT_CAP_FILL);
    for (let i = 0; i < capCount; i++) scratch.toArray(capColorArr, (capOff + i) * 3);

    sidePosArr.set(p.sidePos, sideOff * 3);
    sideNormalArr.set(p.sideNormal, sideOff * 3);
    sideUvArr.set(p.sideUv, sideOff * 2);
    scratch.set(DEFAULT_SIDE_FILL);
    for (let i = 0; i < sideCount; i++) scratch.toArray(sideColorArr, (sideOff + i) * 3);

    casterPosArr.set(p.casterPos, casterOff * 3);
    casterNormalArr.set(p.casterNormal, casterOff * 3);

    outlineArr.set(p.outline, outlineOff);

    ranges.set(p.iso, {
      iso: p.iso,
      capStart: capOff,
      capCount,
      sideStart: sideOff,
      sideCount,
      casterStart: casterOff,
      casterCount,
      outlineStart: outlineOff / 6,
      outlineCount: outlineSegCount,
    });

    capOff += capCount;
    sideOff += sideCount;
    casterOff += casterCount;
    outlineOff += p.outline.length;
  }

  const capGeom = new BufferGeometry();
  capGeom.setAttribute("position", new Float32BufferAttribute(capPosArr, 3));
  capGeom.setAttribute("normal", new Float32BufferAttribute(capNormalArr, 3));
  capGeom.setAttribute("uv", new Float32BufferAttribute(capUvArr, 2));
  capGeom.setAttribute("color", new Float32BufferAttribute(capColorArr, 3));
  capGeom.setIndex(identityIndex(capVerts));
  capGeom.computeBoundingSphere();

  const sideGeom = new BufferGeometry();
  sideGeom.setAttribute("position", new Float32BufferAttribute(sidePosArr, 3));
  sideGeom.setAttribute("normal", new Float32BufferAttribute(sideNormalArr, 3));
  sideGeom.setAttribute("uv", new Float32BufferAttribute(sideUvArr, 2));
  sideGeom.setAttribute("color", new Float32BufferAttribute(sideColorArr, 3));
  sideGeom.setIndex(identityIndex(sideVerts));
  sideGeom.computeBoundingSphere();

  const casterGeom = new BufferGeometry();
  casterGeom.setAttribute("position", new Float32BufferAttribute(casterPosArr, 3));
  casterGeom.setAttribute("normal", new Float32BufferAttribute(casterNormalArr, 3));
  casterGeom.setIndex(identityIndex(casterVerts));
  casterGeom.computeBoundingSphere();

  const outlineGeom = new LineSegmentsGeometry();
  outlineGeom.setPositions(outlineArr);

  return {
    capGeom,
    sideGeom,
    casterGeom,
    outlineGeom,
    outlineLive: outlineArr,
    outlineOriginal: outlineArr.slice(),
    ranges,
  };
}

/** Build one hot country's own mesh set — the same per-country rig this
 *  file always used, now called on demand for just the hot set instead of
 *  every country up front. */
function buildHotEntry(
  iso: string,
  polys: Polys,
  tiles: Group[],
  inkMat: LineMaterial,
  shadowMat: MeshBasicMaterial,
): HotEntry | null {
  const geom = countryGeometry(polys);
  if (!geom) return null;
  const shadowGeom = countryShadowCaster(polys);
  const cap = new MeshStandardMaterial({
    color: DEFAULT_CAP_FILL,
    roughness: 0.92,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  installPaperGrain(cap);
  const side = new MeshStandardMaterial({
    color: DEFAULT_SIDE_FILL,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
  });
  let outlineGeom: LineSegmentsGeometry | null = null;
  const outlinePts = outlinePositions(polys);
  if (outlinePts.length >= 6) {
    outlineGeom = new LineSegmentsGeometry();
    outlineGeom.setPositions(outlinePts);
  }
  const meshes: Mesh[] = [];
  const casters: Mesh[] = [];
  const outlines: LineSegments2[] = [];
  for (const tile of tiles) {
    const mesh = new Mesh(geom, [cap, side]);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.receiveShadow = true;
    /* The cap would throw the water drop from LAND_HEIGHT; the
       footprint below casts it at the still-water line instead. */
    mesh.castShadow = false;
    tile.add(mesh);
    if (shadowGeom) {
      const caster = new Mesh(shadowGeom, shadowMat);
      caster.matrixAutoUpdate = false;
      caster.updateMatrix();
      caster.castShadow = true;
      caster.receiveShadow = false;
      caster.frustumCulled = false;
      tile.add(caster);
      casters.push(caster);
    }
    meshes.push(mesh);
    if (!outlineGeom) continue;
    const line = new LineSegments2(outlineGeom, inkMat);
    line.renderOrder = 1;
    mesh.add(line);
    outlines.push(line);
  }
  return {
    iso,
    meshes,
    casters,
    cap,
    side,
    outlines,
    geom,
    shadowGeom,
    outlineGeom,
    fill: null,
    hot: false,
    lift: 0,
  };
}

function disposeHotEntry(entry: HotEntry) {
  for (const mesh of entry.meshes) mesh.removeFromParent();
  for (const caster of entry.casters) caster.removeFromParent();
  entry.cap.dispose();
  entry.side.dispose();
  entry.geom.dispose();
  entry.shadowGeom?.dispose();
  entry.outlineGeom?.dispose();
}

export function buildTerrain(countries: CountryShapeSet[]): Terrain {
  const group = new Group();
  const inkMat = borderMaterial(BORDER_INK, 0.92);
  const shadowMat = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: DoubleSide,
    shadowSide: DoubleSide,
  });

  const tiles = WRAP_OFFSETS.map((dx) => {
    const tile = new Group();
    tile.position.x = dx;
    group.add(tile);
    return tile;
  });

  const polysByIso = new Map<string, Polys>();
  for (const { iso, polys } of countries) polysByIso.set(iso, polys);

  const {
    capGeom,
    sideGeom,
    casterGeom,
    outlineGeom,
    outlineLive,
    outlineOriginal,
    ranges,
  } = buildMergedLayer(countries);

  const capMat = new MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  installPaperGrain(capMat);
  const sideMat = new MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
  });

  for (const tile of tiles) {
    const capMesh = new Mesh(capGeom, capMat);
    capMesh.matrixAutoUpdate = false;
    capMesh.updateMatrix();
    capMesh.receiveShadow = true;
    capMesh.castShadow = false;
    tile.add(capMesh);

    const sideMesh = new Mesh(sideGeom, sideMat);
    sideMesh.matrixAutoUpdate = false;
    sideMesh.updateMatrix();
    sideMesh.receiveShadow = true;
    sideMesh.castShadow = false;
    tile.add(sideMesh);

    const casterMesh = new Mesh(casterGeom, shadowMat);
    casterMesh.matrixAutoUpdate = false;
    casterMesh.updateMatrix();
    casterMesh.castShadow = true;
    casterMesh.receiveShadow = false;
    casterMesh.frustumCulled = false;
    tile.add(casterMesh);

    const outlineLine = new LineSegments2(outlineGeom, inkMat);
    outlineLine.renderOrder = 1;
    tile.add(outlineLine);
  }

  const scratch = new Color();
  /** iso → last-painted fill while cold; absent means "not yet painted". */
  const coldFill = new Map<string, string>();
  /** iso → live hot mesh set, only for the currently-hot countries. */
  const hotEntries = new Map<string, HotEntry>();

  const collapseCountry = (range: CountryRange) => {
    collapseIndexRange(capGeom.index!, range.capStart, range.capCount);
    collapseIndexRange(sideGeom.index!, range.sideStart, range.sideCount);
    collapseIndexRange(casterGeom.index!, range.casterStart, range.casterCount);
    collapseOutlineRange(outlineLive, range.outlineStart, range.outlineCount);
    outlineGeom.attributes.instanceStart!.needsUpdate = true;
  };

  const restoreCountry = (range: CountryRange) => {
    restoreIndexRange(capGeom.index!, range.capStart, range.capCount);
    restoreIndexRange(sideGeom.index!, range.sideStart, range.sideCount);
    restoreIndexRange(casterGeom.index!, range.casterStart, range.casterCount);
    restoreOutlineRange(outlineLive, outlineOriginal, range.outlineStart, range.outlineCount);
    outlineGeom.attributes.instanceStart!.needsUpdate = true;
  };

  const writeColdColor = (range: CountryRange, fill: string) => {
    scratch.set(fill);
    const capArr = (capGeom.attributes.color as BufferAttribute).array as Float32Array;
    for (let i = 0; i < range.capCount; i++) scratch.toArray(capArr, (range.capStart + i) * 3);
    (capGeom.attributes.color as BufferAttribute).addUpdateRange(
      range.capStart * 3,
      range.capCount * 3,
    );
    (capGeom.attributes.color as BufferAttribute).needsUpdate = true;

    scratch.multiplyScalar(SIDE_DARKEN);
    const sideArr = (sideGeom.attributes.color as BufferAttribute).array as Float32Array;
    for (let i = 0; i < range.sideCount; i++) scratch.toArray(sideArr, (range.sideStart + i) * 3);
    (sideGeom.attributes.color as BufferAttribute).addUpdateRange(
      range.sideStart * 3,
      range.sideCount * 3,
    );
    (sideGeom.attributes.color as BufferAttribute).needsUpdate = true;
  };

  const applyHotPaint = (entry: HotEntry, next: CountryPaint) => {
    if (
      next.fill === entry.fill &&
      next.hot === entry.hot &&
      next.lift === entry.lift
    ) {
      return;
    }
    const liftChanged = next.lift !== entry.lift;
    entry.fill = next.fill;
    entry.hot = next.hot;
    entry.lift = next.lift;
    scratch.set(next.fill);
    entry.cap.color.copy(scratch);
    entry.side.color
      .copy(scratch)
      .multiplyScalar(next.hot ? SIDE_DARKEN_HOT : SIDE_DARKEN);
    if (liftChanged) {
      for (const mesh of entry.meshes) {
        mesh.position.y = next.lift;
        mesh.updateMatrix();
      }
      for (const caster of entry.casters) {
        caster.position.y = next.lift;
        caster.updateMatrix();
      }
    }
  };

  const paint = (colours: Map<string, CountryPaint>) => {
    for (const range of ranges.values()) {
      const next = colours.get(range.iso);
      if (!next) continue;
      const hotEntry = hotEntries.get(range.iso);
      if (next.hot) {
        if (!hotEntry) {
          const polys = polysByIso.get(range.iso);
          if (!polys) continue;
          const entry = buildHotEntry(range.iso, polys, tiles, inkMat, shadowMat);
          if (!entry) continue;
          collapseCountry(range);
          coldFill.delete(range.iso);
          hotEntries.set(range.iso, entry);
          applyHotPaint(entry, next);
          continue;
        }
        applyHotPaint(hotEntry, next);
      } else {
        if (hotEntry) {
          disposeHotEntry(hotEntry);
          hotEntries.delete(range.iso);
          restoreCountry(range);
          coldFill.delete(range.iso);
        }
        if (coldFill.get(range.iso) !== next.fill) {
          writeColdColor(range, next.fill);
          coldFill.set(range.iso, next.fill);
        }
      }
    }
  };

  const dispose = () => {
    for (const entry of hotEntries.values()) disposeHotEntry(entry);
    hotEntries.clear();
    capMat.dispose();
    sideMat.dispose();
    capGeom.dispose();
    sideGeom.dispose();
    casterGeom.dispose();
    outlineGeom.dispose();
    inkMat.dispose();
    shadowMat.dispose();
    group.clear();
  };

  return { group, paint, dispose };
}
