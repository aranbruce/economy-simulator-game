/**
 * Mountain sites on the board, sampled from NASA NEO SRTM_RAMP2_TOPO
 * (public domain). `public/geo/elevation.bin` is a 360×140 plane of the
 * NEO grayscale (0 ≈ sea level, ~246 ≈ Everest, 255 = ocean / nodata),
 * cropped to the same latitude window as the forest raster.
 *
 * Planting reads this per cell so peaks sit on real ranges — the Alps,
 * Andes, Himalaya, Rockies — not as a scatter of toys across Belgium.
 */

import {
  BOARD_H,
  BOARD_W,
  LAT_MAX,
  LAT_MIN,
  boardToWorld,
  project,
  wrapDelta,
} from "./projection.ts";
import { pointInPolys, type Polys } from "./geo.ts";

export const ELEVATION_URL = "/geo/elevation.bin";
export const ELEVATION_W = 360;
export const ELEVATION_H = 140;
const PLANE = ELEVATION_W * ELEVATION_H;
const OCEAN = 255;

/** Appalachians sit around 119 after 1° max-pool; the Sahara plateau is ~93. */
const MIN_GRAY = 108;
/** Highest cells win local slots; this is a spacing cap, not a count target. */
const MAX_SITES = 1750;
/** Minimum peak-to-peak distance, world units (= degrees of longitude). */
const MIN_SEP = 0.58;
/** Andes / Himalaya interiors pack every cell at MIN_SEP; open them out. */
const DENSE_SEP = 1.22;
/** Neighbours closer than this join the same range for a shared skyline. */
const CHAIN_LINK = 2.35;

export type MountainKind = "hill" | "peak" | "range";

export interface MountainSite {
  iso: string;
  kind: MountainKind;
  x: number;
  z: number;
  scale: number;
  rot: number;
  leanX: number;
  leanZ: number;
}

export interface MountainCountry {
  iso: string;
  polys: Polys;
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: { n: number }): number {
  seed.n = (Math.imul(seed.n, 1664525) + 1013904223) >>> 0;
  return seed.n / 4294967296;
}

function countryBBox(polys: Polys) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const rings of polys) {
    const outer = rings[0];
    if (!outer) continue;
    for (const [x, y] of outer) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

/** How many plantable cells sit in a 7×7 window. A volcano is ~2–6;
 *  the Andes interior is 30+. */
function localCrowd(elev: Uint8Array, row: number, col: number): number {
  let n = 0;
  for (let dr = -3; dr <= 3; dr++) {
    const rr = row + dr;
    if (rr < 0 || rr >= ELEVATION_H) continue;
    for (let dc = -3; dc <= 3; dc++) {
      const cc = (col + dc + ELEVATION_W) % ELEVATION_W;
      const v = elev[rr * ELEVATION_W + cc]!;
      if (v !== OCEAN && v >= MIN_GRAY) n++;
    }
  }
  return n;
}

function sepForCrowd(crowd: number): number {
  const t = Math.min(1, Math.max(0, (crowd - 12) / 22));
  return MIN_SEP + (DENSE_SEP - MIN_SEP) * t * t;
}

function pickKind(gray: number, roll: number): MountainKind {
  if (gray >= 185) {
    if (roll < 0.14) return "range";
    if (roll < 0.28) return "hill";
    return "peak";
  }
  if (gray >= 145) {
    if (roll < 0.16) return "range";
    if (roll < 0.55) return "hill";
    return "peak";
  }
  if (roll < 0.1) return "peak";
  if (roll < 0.16) return "range";
  return "hill";
}

function find(parent: Int32Array, a: number): number {
  let i = a;
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]!]!;
    i = parent[i]!;
  }
  return i;
}

/** Group greedy-kept sites into cordilleras, then a 1-D height wave along
 *  each spine so neighbouring peaks are not a picket fence of one size. */
function ridgeTall(
  kept: { nx: number; ny: number; gray: number }[],
  seed: { n: number },
): Float32Array {
  const n = kept.length;
  const tall = new Float32Array(n);
  for (let i = 0; i < n; i++) tall[i] = 1;
  if (n < 2) return tall;

  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const link2 = CHAIN_LINK * CHAIN_LINK;
  for (let i = 0; i < n; i++) {
    const a = kept[i]!;
    for (let j = 0; j < i; j++) {
      const b = kept[j]!;
      const dx = wrapDelta(b.nx, a.nx) * BOARD_W;
      const dz = (a.ny - b.ny) * BOARD_H;
      if (dx * dx + dz * dz >= link2) continue;
      const pa = find(parent, i);
      const pb = find(parent, j);
      if (pa !== pb) parent[pa] = pb;
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(parent, i);
    const list = groups.get(r);
    if (list) list.push(i);
    else groups.set(r, [i]);
  }

  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    let ai = idxs[0]!,
      bi = idxs[1]!,
      best = -1;
    for (let p = 0; p < idxs.length; p++) {
      const a = kept[idxs[p]!]!;
      for (let q = 0; q < p; q++) {
        const b = kept[idxs[q]!]!;
        const dx = wrapDelta(b.nx, a.nx) * BOARD_W;
        const dz = (a.ny - b.ny) * BOARD_H;
        const d2 = dx * dx + dz * dz;
        if (d2 <= best) continue;
        best = d2;
        ai = idxs[q]!;
        bi = idxs[p]!;
      }
    }
    const origin = kept[ai]!;
    const far = kept[bi]!;
    const ax = wrapDelta(origin.nx, far.nx) * BOARD_W;
    const az = (far.ny - origin.ny) * BOARD_H;
    const len = Math.hypot(ax, az) || 1;
    const ux = ax / len;
    const uz = az / len;
    let tMin = Infinity,
      tMax = -Infinity;
    const along = new Float32Array(idxs.length);
    for (let k = 0; k < idxs.length; k++) {
      const c = kept[idxs[k]!]!;
      const px = wrapDelta(origin.nx, c.nx) * BOARD_W;
      const pz = (c.ny - origin.ny) * BOARD_H;
      const t = px * ux + pz * uz;
      along[k] = t;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
    const span = tMax - tMin || 1;
    const waves = idxs.length >= 10 ? 2.4 : idxs.length >= 5 ? 1.7 : 1.15;
    const phase = rng(seed) * Math.PI * 2;
    const phase2 = rng(seed) * Math.PI * 2;
    for (let k = 0; k < idxs.length; k++) {
      const u = (along[k]! - tMin) / span;
      const crest =
        0.62 * (0.5 + 0.5 * Math.sin(u * waves * Math.PI * 2 + phase)) +
        0.38 * (0.5 + 0.5 * Math.sin(u * waves * 1.73 * Math.PI * 2 + phase2));
      const grayT = (kept[idxs[k]!]!.gray - MIN_GRAY) / (246 - MIN_GRAY);
      /* Elevation still wins the local maximum; the wave is the
         saddle-to-summit rhythm along the same range. */
      tall[idxs[k]!] =
        0.58 + 0.82 * Math.pow(crest, 1.2) * (0.78 + grayT * 0.4);
    }
  }
  return tall;
}

/**
 * One mountain per high cell that survives greedy spacing, so a long
 * cordillera is a string of peaks rather than a solid pile, and a lone
 * volcano still gets a slot.
 */
export function plantMountainsFromCover(
  countries: MountainCountry[],
  raster: Uint8Array,
): MountainSite[] {
  if (raster.byteLength < PLANE) return [];
  const elev = raster.subarray(0, PLANE);

  const indexed = countries
    .map((c) => ({ ...c, bbox: countryBBox(c.polys) }))
    .filter((c) => c.bbox);

  type Cand = {
    nx: number;
    ny: number;
    gray: number;
    iso: string;
    crowd: number;
  };
  const cands: Cand[] = [];

  for (let row = 0; row < ELEVATION_H; row++) {
    const lat = LAT_MAX - ((row + 0.5) / ELEVATION_H) * (LAT_MAX - LAT_MIN);
    for (let col = 0; col < ELEVATION_W; col++) {
      const gray = elev[row * ELEVATION_W + col]!;
      if (gray === OCEAN || gray < MIN_GRAY) continue;
      const lng = -180 + ((col + 0.5) / ELEVATION_W) * 360;
      const [nx, ny] = project(lng, lat);
      let iso: string | null = null;
      for (const c of indexed) {
        const b = c.bbox!;
        if (nx < b.x0 || nx > b.x1 || ny < b.y0 || ny > b.y1) continue;
        if (pointInPolys(nx, ny, c.polys)) {
          iso = c.iso;
          break;
        }
      }
      if (!iso) continue;
      cands.push({
        nx,
        ny,
        gray,
        iso,
        crowd: localCrowd(elev, row, col),
      });
    }
  }

  cands.sort((a, b) => b.gray - a.gray);
  const kept: Cand[] = [];
  for (const c of cands) {
    const cSep = sepForCrowd(c.crowd);
    let ok = true;
    for (const s of kept) {
      const need = Math.max(cSep, sepForCrowd(s.crowd));
      const dx = wrapDelta(s.nx, c.nx) * BOARD_W;
      const dz = (s.ny - c.ny) * BOARD_H;
      if (dx * dx + dz * dz < need * need) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    kept.push(c);
    if (kept.length >= MAX_SITES) break;
  }

  const seed = { n: hash32("mountain-sites") };
  const cellW = BOARD_W / ELEVATION_W;
  const cellH = BOARD_H / ELEVATION_H;
  const ridge = ridgeTall(kept, seed);
  const sites: MountainSite[] = [];
  for (let i = 0; i < kept.length; i++) {
    const c = kept[i]!;
    const [x, z] = boardToWorld(c.nx, c.ny);
    const kind = pickKind(c.gray, rng(seed));
    const t = (c.gray - MIN_GRAY) / (246 - MIN_GRAY);
    const jitter = 0.72 + rng(seed) * 0.56;
    let size = ridge[i]! * jitter;
    if (kind === "hill") size = 0.7 + size * 0.42;
    if (kind === "range") size = 0.78 + size * 0.4;
    if (size < 0.52) size = 0.52;
    if (size > 1.62) size = 1.62;
    sites.push({
      iso: c.iso,
      kind,
      x: x + (rng(seed) - 0.5) * cellW * 0.85,
      z: z + (rng(seed) - 0.5) * cellH * 0.85,
      scale: (0.72 + t * 0.28) * size,
      rot: rng(seed) * Math.PI * 2,
      leanX: (rng(seed) - 0.5) * 0.16,
      leanZ: (rng(seed) - 0.5) * 0.16,
    });
  }
  return sites;
}
