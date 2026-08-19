/**
 * Pure helpers for the trade-route boat layer — reads already-simulated
 * state (G.worldTrade, G.rel) and turns it into rendering parameters.
 * Never mutates G or calls into engine.ts; see the map module's "no game
 * logic" rule in CLAUDE.md.
 */

import { wrapDelta } from "../../lib/map/projection.ts";

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

/** Shortest-path distance between two normalised board points, wrapping at
 *  the antimeridian the same way the map itself does (a route that crosses
 *  the date line shouldn't be timed as if it went the long way around).
 *  Safe to call with either raw or already wrap-adjusted points — wrapDelta
 *  is idempotent once a point is within half the plate width of home. */
export function routeDistance(
  home: readonly [number, number],
  partner: readonly [number, number],
): number {
  const dx = wrapDelta(home[0], partner[0]);
  const dy = partner[1] - home[1];
  return Math.hypot(dx, dy);
}

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

/** Bilateral trade volume for a route, summing both directions of the
 *  already-cleared flow. Falls back to the partner's static tradeShare
 *  only if worldTrade hasn't run yet (e.g. the very first tick). */
export function routeVolume(
  g: any,
  homeRole: string,
  partnerId: string,
  fallbackTradeShare: number,
): number {
  const flows = g?.worldTrade?.flows;
  const out = flows?.[homeRole]?.[partnerId] || 0;
  const inbound = flows?.[partnerId]?.[homeRole] || 0;
  const total = out + inbound;
  return total > 0 ? total : fallbackTradeShare;
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

/** Control point of the quadratic Bézier a trade route follows. `bulge`
 *  pushes the midpoint toward the north pole (world -z) so a route arcs
 *  rather than running dead straight — the same shape the flat map drew,
 *  now in the ground plane. `lift` raises it, which is what turns the arc
 *  into something you can see standing off the sea. Boats ride the same
 *  curve with lift 0, so they sail the arc's ground track. */
export function routeControl(
  h: Vec3,
  p: Vec3,
  bulge: number,
  lift: number,
): Vec3 {
  return {
    x: (h.x + p.x) / 2,
    y: (h.y + p.y) / 2 + lift,
    z: (h.z + p.z) / 2 - bulge,
  };
}

/** Point on a quadratic Bézier at t ∈ [0,1]. */
export function bezier3(h: Vec3, c: Vec3, p: Vec3, t: number): Vec3 {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const d = t * t;
  return {
    x: a * h.x + b * c.x + d * p.x,
    y: a * h.y + b * c.y + d * p.y,
    z: a * h.z + b * c.z + d * p.z,
  };
}

/** Heading (rotation about world +y) of the curve's tangent at t, for a
 *  model authored -z forward: the Kenney-style convention every asset in
 *  public/models uses, so no per-model axis correction is needed. */
export function bezierHeading(h: Vec3, c: Vec3, p: Vec3, t: number): number {
  const mt = 1 - t;
  // Tangent of a quadratic Bézier: dP/dt = 2(1-t)(C-H) + 2t(P-C)
  const dx = 2 * mt * (c.x - h.x) + 2 * t * (p.x - c.x);
  const dz = 2 * mt * (c.z - h.z) + 2 * t * (p.z - c.z);
  return Math.atan2(-dx, -dz);
}
