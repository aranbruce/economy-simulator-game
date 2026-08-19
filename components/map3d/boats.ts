/**
 * Pure helpers for the trade-route boat layer — reads already-simulated
 * state (G.worldTrade, G.rel) and turns it into rendering parameters.
 * Never mutates G or calls into engine.ts; see the map module's "no game
 * logic" rule in CLAUDE.md.
 */

/** Every boat moves at the same normalised-board-units/sec SPEED — count
 *  varies with trade volume *and* path length, so a busy Channel hop stays
 *  a couple of hulls while a trans-Pacific lane can carry more without
 *  those hulls racing to finish the lap. periodForDistance() turns that
 *  shared speed into a per-route lap time. */
export const BOAT_SPEED = 0.007; // normalised board units / second
export const BOAT_MIN_PERIOD_S = 10;
/** Hard cap so a busy trans-Pacific lane does not grow a fleet. */
export const BOAT_MAX_COUNT = 8;
/** Extra hulls available per normalised board-unit of path (a ~0.5 Pacific
 *  crossing adds about two slots before volume scales them). */
const BOAT_LEN_SPAN = 0.22;

/** Lap time for a route of this distance at the shared BOAT_SPEED.
 *  Only a floor — long ocean legs keep the same hull speed rather than
 *  being squeezed into a short lap. */
export function periodForDistance(dist: number): number {
  return Math.max(BOAT_MIN_PERIOD_S, dist / BOAT_SPEED);
}

/** Deterministic [0,1) seed per partner id, so every route's boats start at
 *  a different point along the curve instead of all launching from the home
 *  anchor in lockstep — with every boat now sharing one BOAT_PERIOD_S, a
 *  shared phase (e.g. every route's first boat at phaseOffset 0) would keep
 *  them permanently synchronised, reading as a single wave of boats
 *  departing/arriving across every route at once. Stable across renders
 *  (not Math.random()) so a route's boats don't jump on re-render. */
export function routePhaseSeed(partnerId: string): number {
  let h = 0;
  for (let i = 0; i < partnerId.length; i++) {
    h = (h * 31 + partnerId.charCodeAt(i)) | 0;
  }
  return (((h % 1000) + 1000) % 1000) / 1000;
}

/** Volume relative to the busiest current route (0..1), then a length
 *  budget, → boat count. Short hops stay at 1–2 hulls even when busy;
 *  a long Pacific lane can fill out toward BOAT_MAX_COUNT. Arrival
 *  frequency is still BOAT_SPEED / periodForDistance. */
export function bucketRoute(
  vol: number,
  maxVol: number,
  pathLenNorm = 0,
) {
  const rel = maxVol > 0 ? Math.max(0, Math.min(1, vol / maxVol)) : 0;
  const span = 2 + Math.max(0, pathLenNorm) / BOAT_LEN_SPAN;
  const count = Math.max(
    pathLenNorm > 0.25 ? 3 : 1,
    Math.min(BOAT_MAX_COUNT, Math.round(rel * span)),
  );
  return { rel, count };
}

/** Relation score (0-100, same scale as G.rel) → a colour-multiply factor,
 *  reusing the same tiers the 2D trade line already colours by. */
export function relationTint(rel: number): number {
  if (rel > 62) return 1.05;
  if (rel > 45) return 0.9;
  return 0.7;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
