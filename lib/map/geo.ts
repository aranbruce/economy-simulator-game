/**
 * Pure Natural Earth → board geometry. Renderer-free on purpose: the
 * three.js terrain builder (components/map3d/terrain.ts) and the analytic
 * hit test (components/map3d/WorldMap3D.tsx) both read the same polygons,
 * so a click can never land on a different country than the one drawn.
 *
 * Everything here works in normalised board coords (see lib/map/projection).
 */

import { BOARD_H, BOARD_W, project, type Point } from "./projection.ts";

export type Ring = Point[];
/** [outer, ...holes] */
export type Rings = Ring[];
export type Polys = Rings[];

function clonePoint(p: Point): Point {
  return [p[0], p[1]];
}

/**
 * Split a ring that crosses the antimeridian into pieces that each stay inside
 * [-180, 180]. Without this, Russia / Fiji stretch into full-width bars.
 *
 * Cuts alone are not enough: a closed ring that crosses twice (Russia's Far
 * East) yields two open chains on the *same* side of ±180. Closing each chain
 * to its own first vertex draws a diagonal across the Sea of Okhotsk. Merge
 * same-side fragments first, then close along the cut meridian.
 */
export function splitAntimeridianRing(ring: Ring): Ring[] {
  if (!ring || ring.length < 3) return [];
  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];

  const chains: Ring[] = [];
  let cur: Ring = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng0, lat0] = ring[i];
    const [lng1, lat1] = ring[i + 1];
    cur.push([lng0, lat0]);
    const dl = lng1 - lng0;
    if (Math.abs(dl) > 180) {
      /* Edge crosses ±180. Cut at the dateline and start a new chain. */
      const goingEast = dl < -180; // e.g. 170 → -170
      const cut0 = goingEast ? 180 : -180;
      const cut1 = goingEast ? -180 : 180;
      const denom = lng1 - lng0 + (goingEast ? 360 : -360);
      /* Fiji's topojson already stitches ±180 at constant lat (denom ≈ 0).
         Interpolating then yields NaN and a thin bar across the Pacific. */
      const latX =
        Math.abs(denom) < 1e-9
          ? lat0
          : lat0 +
            Math.max(0, Math.min(1, (cut0 - lng0) / denom)) * (lat1 - lat0);
      if (Math.abs(lng0 - cut0) > 1e-9) cur.push([cut0, latX]);
      chains.push(cur);
      cur = [[cut1, latX]];
    }
  }
  cur.push(clonePoint(ring[ring.length - 1]));

  if (!chains.length) {
    const out = ring.map(clonePoint);
    if (!isClosed) out.push(clonePoint(out[0]));
    return [out];
  }

  if (isClosed) {
    /* Last chain ends at ring[0]; first starts there — join into one side. */
    const first = chains.shift()!;
    cur.pop();
    cur.push(...first.slice(1));
    chains.push(cur);
  } else {
    chains.push(cur);
  }

  return chains
    .filter((c) => c.length >= 3)
    .map((c) => {
      const out = c.map(clonePoint);
      const a = out[0];
      const b = out[out.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(clonePoint(a));
      return out;
    })
    .filter((c) =>
      c.every(
        ([lng, lat]: Point) => Number.isFinite(lng) && Number.isFinite(lat),
      ),
    );
}

/** Fraction of the plate width by which a piece cut at the antimeridian is
 *  widened past the cut. Land is extruded, so the cut leaves a *vertical
 *  wall* down the seam; with the board tiled east/west, the two halves of a
 *  split country (Russia, Fiji) meet wall-to-wall and the pair reads as a
 *  dark crack through the middle of the country. Overlapping them by a
 *  fraction of a degree buries each wall inside the neighbouring tile's
 *  land instead. Far below one pixel at any playable zoom. */
const SEAM_OVERLAP_NX = 0.15 / 360;
const SEAM_EPS = 1e-9;

/** Push a vertex sitting exactly on a plate edge outward past it — see
 *  SEAM_OVERLAP_NX. Only the synthetic cut vertices land exactly on 0 or 1,
 *  so real coastline is untouched. */
function widenSeam(p: Point): Point {
  if (p[0] > 1 - SEAM_EPS) return [1 + SEAM_OVERLAP_NX, p[1]];
  if (p[0] < SEAM_EPS) return [-SEAM_OVERLAP_NX, p[1]];
  return p;
}

/** GeoJSON geometry → normalised board polygons, antimeridian-split. */
export function geomToPolys(geom: {
  type?: string;
  coordinates?: unknown;
}): Polys {
  if (!geom || !geom.coordinates) return [];
  const raw = (
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : []
  ) as Ring[][];
  const out: Polys = [];
  for (const rings of raw) {
    if (!rings[0]) continue;
    const outerParts = splitAntimeridianRing(rings[0]);
    /* Holes that don't cross stay with every outer part that contains them —
       for dateline countries holes are rare; keep holes only on the first part. */
    const holes: Ring[] = rings
      .slice(1)
      .flatMap((h: Ring) => splitAntimeridianRing(h));
    outerParts.forEach((outer, i) => {
      const poly: Rings = [
        outer.map(([lng, lat]) => widenSeam(project(lng, lat))),
      ];
      if (i === 0) {
        for (const h of holes) {
          poly.push(h.map(([lng, lat]) => widenSeam(project(lng, lat))));
        }
      }
      out.push(poly);
    });
  }
  return out;
}

export function pointInRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolys(x: number, y: number, polys: Polys) {
  for (const rings of polys) {
    if (!rings[0] || !pointInRing(x, y, rings[0])) continue;
    let hole = false;
    for (let r = 1; r < rings.length; r++) {
      if (pointInRing(x, y, rings[r])) {
        hole = true;
        break;
      }
    }
    if (!hole) return true;
  }
  return false;
}

/** Absolute shoelace area of a closed ring in normalised board coords. */
export function ringArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

/** Area centroid of a closed ring; falls back to vertex mean if degenerate. */
export function ringCentroid(ring: Ring): Point {
  let cx = 0,
    cy = 0,
    a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-18) {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
      n++;
    }
    return n ? [sx / n, sy / n] : [0.5, 0.5];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * Label / trade-route anchor for a realm. Uses the largest outer ring so
 * overseas scraps (French Guiana on Gaul, Alaska on the US, …) do not pull
 * the pin into the ocean.
 */
export function polysCentroid(polys: Polys): Point {
  let best: Ring | null = null,
    bestA = -1;
  for (const rings of polys) {
    const ring = rings[0];
    if (!ring || ring.length < 3) continue;
    const a = ringArea(ring);
    if (a > bestA) {
      bestA = a;
      best = ring;
    }
  }
  return best ? ringCentroid(best) : [0.5, 0.5];
}

function worldSep(a: Point, b: Point) {
  return Math.hypot((a[0] - b[0]) * BOARD_W, (a[1] - b[1]) * BOARD_H);
}

/** Outer ring that contains `p`, else the nearest landmass — so London
 *  walks onto Great Britain, not toward Northern Ireland. */
function homeRing(p: Point, polys: Polys): Ring | null {
  for (const rings of polys) {
    const outer = rings[0];
    if (!outer || outer.length < 3) continue;
    if (!pointInRing(p[0], p[1], outer)) continue;
    let hole = false;
    for (let r = 1; r < rings.length; r++) {
      if (pointInRing(p[0], p[1], rings[r]!)) {
        hole = true;
        break;
      }
    }
    if (!hole) return outer;
  }
  let best: Ring | null = null;
  let bestD = Infinity;
  for (const rings of polys) {
    const outer = rings[0];
    if (!outer || outer.length < 3) continue;
    const d = worldSep(p, ringCentroid(outer));
    if (d < bestD) {
      bestD = d;
      best = outer;
    }
  }
  return best;
}

/** Radius of the Kenney city cluster, world units. Used to tell "the pin
 *  is on land but the block hangs into the sea" from a true inland seat. */
const CAPITAL_FOOTPRINT = 0.85;
/** Furthest a pin may walk toward the interior. London's Thames bite on
 *  110m is under a degree; this is a ceiling, not a target. */
const CAPITAL_MAX_SHIFT = 2.6;

function wetFraction(nx: number, ny: number, polys: Polys, rWorld: number) {
  const dx = rWorld / BOARD_W;
  const dy = rWorld / BOARD_H;
  let wet = 0;
  let n = 0;
  const sample = (u: number, v: number) => {
    n++;
    if (!pointInPolys(nx + u * dx, ny + v * dy, polys)) wet++;
  };
  sample(0, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    sample(Math.cos(a), Math.sin(a));
  }
  return n ? wet / n : 1;
}

/**
 * Slide a capital that sits in the sea (or whose city footprint hangs off
 * a simplified 110m coast) toward the interior of its own landmass. No-op
 * when the pin already has land under the cluster.
 */
export function pullInland(p: Point, polys: Polys): Point {
  if (!polys.length) return p;
  const ring = homeRing(p, polys);
  if (!ring) return p;
  const c = ringCentroid(ring);
  let best: Point = p;
  let bestWet = wetFraction(p[0], p[1], polys, CAPITAL_FOOTPRINT);
  if (bestWet === 0) return p;
  let x = p[0];
  let y = p[1];
  for (let i = 0; i < 36; i++) {
    x += (c[0] - x) * 0.12;
    y += (c[1] - y) * 0.12;
    if (worldSep(p, [x, y]) > CAPITAL_MAX_SHIFT) break;
    const w = wetFraction(x, y, polys, CAPITAL_FOOTPRINT);
    if (w < bestWet - 1e-6) {
      bestWet = w;
      best = [x, y];
    }
    if (w === 0) break;
  }
  return best;
}
