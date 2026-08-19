/**
 * Forest cover on the board, sampled from NASA NEO MCD12C1 IGBP land cover
 * (2020, public domain). `public/geo/tree-cover.bin` is two 360×140 planes:
 * percent-forest, then the dominant forest class (1 needleleaf … 5 mixed).
 *
 * Planting reads this raster per cell, so a large country only gets trees
 * where that country is actually forested — the Amazon, not the sertão;
 * the taiga, not the steppe.
 */

import {
  BOARD_H,
  BOARD_W,
  LAT_MAX,
  LAT_MIN,
  boardToWorld,
  project,
} from "./projection.ts";
import { pointInPolys, type Polys } from "./geo.ts";

export const TREE_COVER_URL = "/geo/tree-cover.bin";
export const TREE_COVER_W = 360;
export const TREE_COVER_H = 140;
const PLANE = TREE_COVER_W * TREE_COVER_H;

/** Skip cells that are only a smear of woodland in cropland / savanna.
 *  Brazil's cerrado sits around 4; the Amazon and Atlantic forest are 40+. */
const MIN_COVER = 30;
/** Hard cap so a global forest raster cannot explode the instance budget.
 *  Thinned spatially (not "densest first") so temperate woodland is not
 *  starved by the Amazon and the taiga. */
const MAX_CELLS = 10000;

export type TreeKind = "oak" | "default" | "cone" | "palm";

export interface TreeSite {
  iso: string;
  kind: TreeKind;
  x: number;
  z: number;
  scale: number;
  rot: number;
}

export interface TreeCountry {
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

function kindFromIgbp(igbp: number, lat: number, roll: number): TreeKind {
  /* 1/3 needleleaf (boreal, PNW, etc.), 2 evergreen broadleaf rainforest
     — leafy canopy, not coconut palms — 4/5 temperate deciduous/mixed. */
  if (igbp === 1 || igbp === 3) return "cone";
  if (igbp === 2) {
    if (Math.abs(lat) < 18 && roll < 0.1) return "palm";
    return roll < 0.5 ? "oak" : "default";
  }
  if (igbp === 4 || igbp === 5) return roll < 0.55 ? "oak" : "default";
  if (lat > 52 || lat < -42) return roll < 0.7 ? "cone" : "oak";
  if (Math.abs(lat) < 23) return roll < 0.2 ? "palm" : "oak";
  return roll < 0.5 ? "oak" : "default";
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

/**
 * One copse per forested raster cell that lands inside a country polygon.
 * Cover is the fraction of MODIS pixels in that cell that are forest, so
 * Germany's woodland shows up without painting trees across the North
 * German Plain, and Brazil's trees stop at the Amazon / Atlantic forest.
 */
export function plantTreesFromCover(
  countries: TreeCountry[],
  raster: Uint8Array,
): TreeSite[] {
  if (raster.byteLength < PLANE) return [];
  const cover = raster.subarray(0, PLANE);
  const classes =
    raster.byteLength >= PLANE * 2 ? raster.subarray(PLANE, PLANE * 2) : null;

  const indexed = countries
    .map((c) => ({ ...c, bbox: countryBBox(c.polys) }))
    .filter((c) => c.bbox);

  type Cand = {
    nx: number;
    ny: number;
    cover: number;
    igbp: number;
    iso: string;
    lat: number;
  };
  const cands: Cand[] = [];

  for (let row = 0; row < TREE_COVER_H; row++) {
    const lat = LAT_MAX - ((row + 0.5) / TREE_COVER_H) * (LAT_MAX - LAT_MIN);
    for (let col = 0; col < TREE_COVER_W; col++) {
      const cv = cover[row * TREE_COVER_W + col]!;
      if (cv < MIN_COVER) continue;
      const lng = -180 + ((col + 0.5) / TREE_COVER_W) * 360;
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
        cover: cv,
        igbp: classes ? classes[row * TREE_COVER_W + col]! : 0,
        iso,
        lat,
      });
    }
  }

  if (cands.length > MAX_CELLS) {
    /* Keep geographic spread: a densest-first trim would paint only the
       rainforest and taiga and leave Germany, Japan, the Atlantic forest
       empty. Stride through the raster order instead. */
    const stride = cands.length / MAX_CELLS;
    const kept: Cand[] = [];
    for (let i = 0; i < MAX_CELLS; i++)
      kept.push(cands[Math.floor(i * stride)]!);
    cands.length = 0;
    cands.push(...kept);
  }

  const cellW = BOARD_W / TREE_COVER_W;
  const cellH = BOARD_H / TREE_COVER_H;
  const seed = { n: hash32("forest-sites") };
  const sites: TreeSite[] = [];
  for (const c of cands) {
    /* Woodland is a tight copse; rainforest / taiga pack the cell so
       neighbouring cells still read as a canopy rather than a grid of
       clumps. Spread is the fraction of the cell the stand may wander. */
    const n = c.cover >= 75 ? 4 : c.cover >= 55 ? 3 : c.cover >= 35 ? 2 : 1;
    const spread = n >= 4 ? 0.62 : 0.38;
    for (let k = 0; k < n; k++) {
      const [x, z] = boardToWorld(c.nx, c.ny);
      sites.push({
        iso: c.iso,
        kind: kindFromIgbp(c.igbp, c.lat, rng(seed)),
        x: x + (rng(seed) - 0.5) * cellW * spread,
        z: z + (rng(seed) - 0.5) * cellH * spread,
        scale: 0.8 + rng(seed) * 0.5,
        rot: rng(seed) * Math.PI * 2,
      });
    }
  }
  return sites;
}
