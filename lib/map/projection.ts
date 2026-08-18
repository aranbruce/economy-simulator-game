/**
 * Pure board math shared by the three.js world map
 * (components/map3d/WorldMap3D.tsx) and its pure helper modules
 * (terrain/routes/labels/boats). Kept renderer-free so the geometry
 * builders, the camera controller and the hit test all agree on one
 * definition of where a lat/lng sits, rather than each re-deriving it.
 *
 * Two coordinate spaces:
 *
 *   normalised board  nx,ny ∈ [0,1]²  — equirectangular, ny=0 at LAT_MAX
 *   world             x,y,z world units — the three.js scene, y up,
 *                                         north at -z, 1 unit = 1° of lng
 */

export type Point = [number, number];

/** Crop Antarctica and empty polar ocean so the playable world fills the frame. */
export const LAT_MAX = 84;
export const LAT_MIN = -56;

/** Equirectangular → normalised board coords in [0,1]². */
export function project(lng: number, lat: number): Point {
  const x = (lng + 180) / 360;
  const y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN);
  return [x, y];
}

/** Shortest signed delta from a to b on the horizontally-wrapping board
 *  (normalised x is periodic in [0,1)) — result is in (-0.5, 0.5]. Two
 *  points near opposite edges of the plate (e.g. the western US and Japan)
 *  are actually close via the wrap; a route between them should take that
 *  short way, not cross the entire plate the long way round. Used by
 *  anything that draws a connection between two board points (a trade
 *  route, a boat curve) — a single point on its own never needs this,
 *  since the land is tiled at every wrap offset anyway. */
export function wrapDelta(a: number, b: number): number {
  let d = (b - a) % 1;
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return d;
}

/* ── World space ─────────────────────────────────────────────────────── */

/** Board width in world units. One unit is one degree of longitude, which
 *  makes every other world-space constant in the scene (land height, pin
 *  size, camera distance) readable as "degrees across". */
export const BOARD_W = 360;
/** Board depth in world units — the cropped latitude span, at the same
 *  degrees-per-unit scale, so the plate is never distorted. */
export const BOARD_H = LAT_MAX - LAT_MIN;

/** How far the land is raised above the sea plane. Small next to BOARD_W
 *  (land reads as relief, not as towers) but large enough that a country's
 *  extruded side wall is a visible border against its neighbour. */
export const LAND_HEIGHT = 1.9;

/** Extra height a lit country (home / hovered / selected) is raised by, so
 *  picking one reads as the land lifting off the board rather than only as
 *  a colour change. Shared, not private to the terrain: anything planted on
 *  a country's surface — a capital spire, a label anchor — has to rise with
 *  it or it sinks into the slab. */
export const LAND_LIFT_HOT = 0.55;

/** Normalised board → world ground position (the y=0 sea plane). The board
 *  is centred on the origin so the wrap tiling below is symmetric, and
 *  north is -z so a camera set back along +z sees north up the screen. */
export function boardToWorld(nx: number, ny: number): Point {
  return [(nx - 0.5) * BOARD_W, (ny - 0.5) * BOARD_H];
}

/** World ground position → normalised board coords. x wraps (the board
 *  repeats east/west); y does not — an out-of-range ny means the ray landed
 *  off the plate, which callers test for. */
export function worldToBoard(x: number, z: number): Point {
  const raw = x / BOARD_W + 0.5;
  return [((raw % 1) + 1) % 1, z / BOARD_H + 0.5];
}

/** Normalised board → the 2D shape plane an extruded land mesh is authored
 *  in, before `rotateX(-π/2)` stands it up. That rotation maps a shape
 *  point (sx, sy) and extrusion depth d to world (sx, d, -sy), so shape y
 *  is world -z: north is +y here, i.e. the plate the right way up. */
export function boardToShape(nx: number, ny: number): Point {
  return [(nx - 0.5) * BOARD_W, (0.5 - ny) * BOARD_H];
}

/** Horizontal offsets (world units) at which the land group is repeated so
 *  panning past one edge reveals the far side instead of bare ocean. Three
 *  copies is a deliberate fixed budget rather than a computed one: the
 *  camera's own MAX_DIST already bounds the visible ground width to well
 *  under 3 × BOARD_W, and each extra copy is ~180 more draw calls. */
export const WRAP_OFFSETS: readonly number[] = [-BOARD_W, 0, BOARD_W];

/** Wrap a world x back into the centre tile, so the camera focus never
 *  drifts far enough east/west to run off the end of WRAP_OFFSETS. */
export function wrapWorldX(x: number): number {
  return ((((x + BOARD_W / 2) % BOARD_W) + BOARD_W) % BOARD_W) - BOARD_W / 2;
}
