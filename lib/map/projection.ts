/**
 * Pure projection/viewport math shared between the 2D canvas map
 * (components/map2d/WorldMap.tsx) and the 3D overlay
 * (components/map3d/Map3DOverlay.tsx). Extracted so both layers stay in
 * exact pixel-for-pixel sync without either duplicating the other's math —
 * the 3D layer must reproject through these same functions rather than
 * re-deriving lat/lng → screen position independently.
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
 *  are actually close via the wrap; a line or route between them should
 *  take that short way, not cross the entire plate the long way round. Used
 *  by anything that draws a connection between two board points (the 2D
 *  trade line, the 3D boat curve) — a single point on its own never needs
 *  this, since repeatOffsets() already tiles it at every visible copy. */
export function wrapDelta(a: number, b: number): number {
  let d = (b - a) % 1;
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return d;
}

/** Viewport size, floored so the plate never fits into a degenerate frame —
 *  paint() and plateLayout() (used by hit-testing/zoom-anchoring) must agree
 *  on this or a click/hover can target a different point than what's drawn. */
export function clampViewport(cssW: number, cssH: number) {
  return {
    W: Math.max(320, Math.floor(cssW)),
    H: Math.max(240, Math.floor(cssH)),
  };
}

/** Fit the equirectangular plate into the viewport, letterboxed. */
export function computePlateLayout(W: number, H: number) {
  const fit = Math.min(W, H * (360 / (LAT_MAX - LAT_MIN)));
  const plateW = fit;
  const plateH = fit * ((LAT_MAX - LAT_MIN) / 360);
  return { plateW, plateH, ox: (W - plateW) / 2, oy: (H - plateH) / 2 };
}

/** Horizontal pixel offsets at which the plate must be redrawn so a tiled
 *  copy covers every point of the viewport — the board wraps east/west, so
 *  panning past one edge should reveal the far side instead of bare ocean. */
export function repeatOffsets(
  originX: number,
  period: number,
  viewportW: number,
  /* Safety bound, not a real budget: even an extreme W:H window ratio at
   * MIN_ZOOM needs well under this many tiled copies to fully cover the
   * viewport. It only exists to stop a runaway loop if `period` is ever
   * pathologically small; it must not silently truncate real coverage. */
  maxCopies = 64,
): number[] {
  if (!(period > 0)) return [0];
  const kMin = Math.floor(-originX / period) - 1;
  const kMax = Math.ceil((viewportW - originX) / period) + 1;
  const out: number[] = [];
  for (let k = kMin; k <= kMax && out.length < maxCopies; k++)
    out.push(k * period);
  return out.length ? out : [0];
}

export interface ScreenLayout {
  ox: number;
  oy: number;
  plateW: number;
  plateH: number;
  scale: number;
  tx: number;
  ty: number;
}

/** Normalised board coords → screen pixels, given a plate layout + pan/zoom
 *  state and one of repeatOffsets()'s horizontal tile offsets. */
export function toScreen(
  nx: number,
  ny: number,
  dx: number,
  layout: ScreenLayout,
): Point {
  const { ox, oy, plateW, plateH, scale, tx, ty } = layout;
  return [ox + nx * plateW * scale + tx + dx, oy + ny * plateH * scale + ty];
}

/** Live pan/zoom viewport snapshot, as read by the 3D overlay every frame to
 *  stay glued to the 2D map without owning any pan/zoom state itself. */
export interface MapViewport extends ScreenLayout {
  W: number;
  H: number;
  offsets: number[];
}
