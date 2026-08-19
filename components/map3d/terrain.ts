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
 */

import {
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  type BufferGeometry,
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
const BORDER_INK = 0x1e1810;
/** Bump so WorldMap3D remounts the WebGL scene when outlines change. */
export const TERRAIN_REV = 21;

export interface CountryShapeSet {
  iso: string;
  polys: Polys;
}

export interface CountryPaint {
  fill: string;
  hot: boolean;
  /** World-space extra Y. Separate from `hot` so hovering an already-lit
   *  country (the home seat) can still raise the slab. */
  lift: number;
}

/** One country's meshes, one per wrap tile. Tiles share geometry and
 *  materials by reference (Object3D.clone() does not deep-copy either), so
 *  a colour change is written once and shows on every copy; only per-mesh
 *  transform state (the hover/home lift) has to be set per tile. */
interface CountryEntry {
  iso: string;
  meshes: Mesh[];
  /** Invisible sea-line slabs; they rise with `meshes` so a hover lift
   *  lengthens the drop on the water instead of leaving it stuck. */
  casters: Mesh[];
  cap: MeshStandardMaterial;
  side: MeshStandardMaterial;
  outlines: LineSegments2[];
  /** Last painted state, so a re-paint that changes nothing does no work —
   *  this runs on every hover move across ~180 countries. */
  fill: string | null;
  hot: boolean;
  lift: number;
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
 *  lifts keep the same grain instead of sliding a UV atlas. */
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

export function buildTerrain(countries: CountryShapeSet[]): Terrain {
  const group = new Group();
  const entries: CountryEntry[] = [];
  const geometries: BufferGeometry[] = [];
  const outlineGeoms: LineSegmentsGeometry[] = [];
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

  for (const { iso, polys } of countries) {
    const geom = countryGeometry(polys);
    if (!geom) continue;
    geometries.push(geom);
    const shadowGeom = countryShadowCaster(polys);
    if (shadowGeom) geometries.push(shadowGeom);
    const cap = new MeshStandardMaterial({
      color: 0xa48b62,
      roughness: 0.92,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    installPaperGrain(cap);
    const side = new MeshStandardMaterial({
      color: 0x1c1710,
      roughness: 0.98,
      metalness: 0,
      flatShading: true,
    });
    let outlineGeom: LineSegmentsGeometry | null = null;
    const outlinePts = outlinePositions(polys);
    if (outlinePts.length >= 6) {
      outlineGeom = new LineSegmentsGeometry();
      outlineGeom.setPositions(outlinePts);
      outlineGeoms.push(outlineGeom);
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
    entries.push({
      iso,
      meshes,
      casters,
      cap,
      side,
      outlines,
      fill: null,
      hot: false,
      lift: 0,
    });
  }

  const scratch = new Color();

  const paint = (colours: Map<string, CountryPaint>) => {
    for (const entry of entries) {
      const next = colours.get(entry.iso);
      if (!next) continue;
      if (
        next.fill === entry.fill &&
        next.hot === entry.hot &&
        next.lift === entry.lift
      ) {
        continue;
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
    }
  };

  const dispose = () => {
    for (const entry of entries) {
      entry.cap.dispose();
      entry.side.dispose();
    }
    inkMat.dispose();
    shadowMat.dispose();
    for (const geom of geometries) geom.dispose();
    for (const geom of outlineGeoms) geom.dispose();
    group.clear();
  };

  return { group, paint, dispose };
}
