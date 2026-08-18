/**
 * Land geometry for the three.js world map: every Natural Earth country
 * extruded from the sea plane into a slab, with its own top-face and
 * side-wall materials.
 *
 * Borders are the extrusion itself, not a drawn line — two neighbouring
 * countries each raise their own wall, so the shared edge reads as a real
 * crease under the scene lighting. That is why there is no stroke pass
 * here at all, and why LAND_HEIGHT has to stay clearly nonzero.
 *
 * Pure of game logic (see CLAUDE.md's map rule): it is handed colours and
 * polygons and hands back meshes.
 */

import {
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  type BufferGeometry,
} from "three";
import {
  boardToShape,
  LAND_HEIGHT,
  LAND_LIFT_HOT,
  WRAP_OFFSETS,
  type Point,
} from "../../lib/map/projection.ts";
import type { Polys, Rings } from "../../lib/map/geo.ts";

/** How much darker a country's side wall is than its top face. The walls
 *  are what separate one country from the next, so this is the contrast
 *  that used to come from the 2D map's border stroke. */
const SIDE_DARKEN = 0.42;
/** Side wall of a lit country (home / hovered / selected) — barely darkened
 *  and slightly warm, so the whole slab reads as picked out rather than
 *  just recoloured on top. */
const SIDE_DARKEN_HOT = 0.85;
export interface CountryShapeSet {
  iso: string;
  polys: Polys;
}

export interface CountryPaint {
  fill: string;
  hot: boolean;
}

/** One country's meshes, one per wrap tile. Tiles share geometry and
 *  materials by reference (Object3D.clone() does not deep-copy either), so
 *  a colour change is written once and shows on every copy; only per-mesh
 *  transform state (the `hot` lift) has to be set per tile. */
interface CountryEntry {
  iso: string;
  meshes: Mesh[];
  cap: MeshStandardMaterial;
  side: MeshStandardMaterial;
  /** Last painted state, so a re-paint that changes nothing does no work —
   *  this runs on every hover move across ~180 countries. */
  fill: string | null;
  hot: boolean;
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
      depth: LAND_HEIGHT,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    /* Authored flat in the shape plane with the extrusion along +z; stand
       it up so the extrusion is world height and shape y is world -z (north
       up). See boardToShape's own note. */
    geom.rotateX(-Math.PI / 2);
    return geom;
  } catch (err) {
    console.warn("terrain: country geometry failed", err);
    return null;
  }
}

export function buildTerrain(countries: CountryShapeSet[]): Terrain {
  const group = new Group();
  const entries: CountryEntry[] = [];
  const geometries: BufferGeometry[] = [];

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
    const cap = new MeshStandardMaterial({
      color: 0x3a3226,
      roughness: 0.92,
      metalness: 0,
    });
    const side = new MeshStandardMaterial({
      color: 0x1c1710,
      roughness: 0.98,
      metalness: 0,
      flatShading: true,
    });
    const meshes = tiles.map((tile) => {
      const mesh = new Mesh(geom, [cap, side]);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      tile.add(mesh);
      return mesh;
    });
    entries.push({ iso, meshes, cap, side, fill: null, hot: false });
  }

  const scratch = new Color();

  const paint = (colours: Map<string, CountryPaint>) => {
    for (const entry of entries) {
      const next = colours.get(entry.iso);
      if (!next) continue;
      if (next.fill === entry.fill && next.hot === entry.hot) continue;
      entry.fill = next.fill;
      const hotChanged = next.hot !== entry.hot;
      entry.hot = next.hot;
      scratch.set(next.fill);
      entry.cap.color.copy(scratch);
      entry.side.color
        .copy(scratch)
        .multiplyScalar(next.hot ? SIDE_DARKEN_HOT : SIDE_DARKEN);
      if (hotChanged) {
        for (const mesh of entry.meshes) {
          mesh.position.y = next.hot ? LAND_LIFT_HOT : 0;
          mesh.updateMatrix();
        }
      }
    }
  };

  const dispose = () => {
    for (const entry of entries) {
      entry.cap.dispose();
      entry.side.dispose();
    }
    for (const geom of geometries) geom.dispose();
    group.clear();
  };

  return { group, paint, dispose };
}
