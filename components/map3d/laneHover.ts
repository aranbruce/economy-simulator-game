/**
 * Pure hit-test for point-local trade. Picks the painted dashes first
 * (the line the pointer is on), then names every pair that shares that
 * water — by polyline proximity, or by the frozen hub-edges under the
 * cursor when boats take a different ocean.
 */

import { BOARD_W } from "../../lib/map/projection.ts";
import { type Vec3 } from "./boats.ts";

export interface PairLane {
  id: string;
  owners: string[];
  path: Vec3[];
  vol: number;
  /** Directed A→B when live flows exist; otherwise 0. */
  ab: number;
  ba: number;
  directed: boolean;
  /** Hub-edge keys from the pair's trunk walk. */
  edges?: string[];
}

export interface GuidePath {
  path: Vec3[];
  /** Hub-edge keys of the named spine this dash belongs to. */
  edges?: string[];
}

export interface HubEdgePath {
  key: string;
  path: Vec3[];
}

export interface PointTraffic {
  hitX: number;
  hitZ: number;
  lanes: PairLane[];
}

function segNearest(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  x: number,
  z: number,
) {
  const vx = bx - ax,
    vz = bz - az;
  const len2 = vx * vx + vz * vz || 1e-9;
  let t = ((x - ax) * vx + (z - az) * vz) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const hx = ax + t * vx,
    hz = az + t * vz;
  return { d: Math.hypot(x - hx, z - hz), hx, hz };
}

/** Wrap each segment onto the query's plate. Three fixed tile offsets
 *  miss an unwrapped South Pacific walk that sits past ±180 while the
 *  pointer is on the folded dash (or the other wrap copy). */
function nearestOnPath(
  path: Vec3[],
  x: number,
  z: number,
): { d: number; hx: number; hz: number } {
  let best = { d: Infinity, hx: 0, hz: 0 };
  if (path.length < 2) return best;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!,
      b = path[i]!;
    const mid = (a.x + b.x) / 2;
    const k0 = Math.round((x - mid) / BOARD_W) * BOARD_W;
    for (let k = k0 - BOARD_W; k <= k0 + BOARD_W; k += BOARD_W) {
      const hit = segNearest(a.x + k, a.z, b.x + k, b.z, x, z);
      if (hit.d < best.d) best = hit;
    }
  }
  return best;
}

function nearestAmong(
  paths: Vec3[][],
  x: number,
  z: number,
): { d: number; hx: number; hz: number } {
  let best = { d: Infinity, hx: 0, hz: 0 };
  for (const path of paths) {
    if (path.length < 2) continue;
    const hit = nearestOnPath(path, x, z);
    if (hit.d < best.d) best = hit;
  }
  return best;
}

function laneUsesEdge(lane: PairLane, key: string) {
  return !!lane.edges?.includes(key);
}

/** Nearest maritime point under `(x, z)`, plus every pair whose path
 *  shares that water (within `shareEps`) or whose trunk uses a hub
 *  edge under the pointer. */
export function queryPointTraffic(
  lanes: PairLane[],
  guides: GuidePath[],
  hubEdges: HubEdgePath[],
  x: number,
  z: number,
  maxDist: number,
  shareEps: number,
): PointTraffic | null {
  const paintHit = nearestAmong(
    guides.map((g) => g.path),
    x,
    z,
  );
  const boatHit = nearestAmong(
    lanes.map((l) => l.path),
    x,
    z,
  );
  const bestHit = paintHit.d <= boatHit.d ? paintHit : boatHit;
  if (bestHit.d > maxDist) return null;

  const nearby: PairLane[] = [];
  const seen = new Set<string>();
  const take = (lane: PairLane) => {
    if (seen.has(lane.id)) return;
    seen.add(lane.id);
    nearby.push(lane);
  };

  for (const lane of lanes) {
    if (lane.path.length < 2) continue;
    if (nearestOnPath(lane.path, bestHit.hx, bestHit.hz).d <= shareEps) {
      take(lane);
    }
  }

  const edgeReach = Math.max(maxDist, shareEps);
  const localKeys: string[] = [];
  for (const edge of hubEdges) {
    if (nearestOnPath(edge.path, bestHit.hx, bestHit.hz).d <= edgeReach) {
      localKeys.push(edge.key);
      for (const lane of lanes) {
        if (laneUsesEdge(lane, edge.key)) take(lane);
      }
    }
  }

  if (!nearby.length) {
    for (const g of guides) {
      if (!g.edges?.length) continue;
      if (nearestOnPath(g.path, x, z).d > maxDist) continue;
      for (const lane of lanes) {
        if (lane.edges?.some((k) => g.edges!.includes(k))) take(lane);
      }
    }
  }

  if (!nearby.length && localKeys.length) {
    for (const lane of lanes) {
      if (lane.edges?.some((k) => localKeys.includes(k))) take(lane);
    }
  }

  if (!nearby.length) return null;
  nearby.sort((a, b) => b.vol - a.vol);
  return {
    hitX: bestHit.hx,
    hitZ: bestHit.hz,
    lanes: nearby,
  };
}
