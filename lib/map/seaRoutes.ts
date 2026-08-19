/**
 * Maritime paths between two board points: walk the sea, not the land.
 *
 * Natural Earth at 110m seals Suez and Panama, so those canals are punched
 * open as forced-water cells. Gibraltar, the Bosporus and Hormuz get the
 * same treatment so 110m land-bridges cannot trap a lane. Everything else is
 * shortest-path on a 1° ocean grid, which is how real bulk lanes form
 * (Channel → Gibraltar → Suez → Malacca, Atlantic → Panama → Pacific).
 * Ten frozen shipping highways plus one short stub per capital, joining
 * the nearest highway cell. Pairs never get their own ocean A*.
 * A* also prefers deeper water so lanes sit off the coast.
 *
 * Pure of game logic: handed country polygons and two world anchors.
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
import {
  BOSPORUS,
  GIBRALTAR,
  HORMUZ,
  PANAMA_ROUTE,
  SUEZ_ROUTE,
  type LngLat,
} from "./canals.ts";

export interface SeaPt {
  x: number;
  z: number;
}

type Cell = { col: number; row: number };

interface TrunkHit {
  key: string;
  index: number;
}

interface HubNet {
  rev: number;
  ids: string[];
  cells: Cell[];
  /** Concatenated A* cells for each undirected hub pair `a>b` with a < b. */
  edgePath: Map<string, Cell[]>;
  /** Parent toward the nearest highway cell; -1 on the highway. */
  prev: Int32Array;
  /** Every cell that already sits on a hub edge. */
  trunkHits: Map<number, TrunkHit[]>;
  /** The ~10 named global strokes, already in world space. */
  strokes: { id: string; color: number; path: SeaPt[] }[];
}

export interface OceanGrid {
  cols: number;
  rows: number;
  /** 1 = water, row-major on the centre tile. */
  water: Uint8Array;
  /** Forced-water trenches (Suez, Panama, Gibraltar, Bosporus). */
  canal: Uint8Array;
  /** Cells from land. 0 = land, 1 = beach, higher = further offshore. */
  shore: Uint8Array;
  hubs?: HubNet;
}

const COLS = 360;
const ROWS = 140;
/** Three wrap copies so a Pacific crossing does not have to modulo mid-path. */
const TILES = 3;
const WIDE = COLS * TILES;

const ORTHO = 1;
const DIAG = Math.SQRT2;

function stampCanal(water: Uint8Array, canal: Uint8Array, line: LngLat[]) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!,
      b = line[i + 1]!;
    const [x0, y0] = project(a[0], a[1]);
    const [x1, y1] = project(b[0], b[1]);
    const n = Math.max(
      2,
      Math.ceil(Math.hypot((x1 - x0) * COLS, (y1 - y0) * ROWS) * 3),
    );
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const col = Math.max(
        0,
        Math.min(COLS - 1, Math.floor((x0 + (x1 - x0) * t) * COLS)),
      );
      const row = Math.max(
        0,
        Math.min(ROWS - 1, Math.floor((y0 + (y1 - y0) * t) * ROWS)),
      );
      const i2 = row * COLS + col;
      water[i2] = 1;
      canal[i2] = 1;
    }
  }
}

function canalWorldPts(line: LngLat[]): SeaPt[] {
  const out: SeaPt[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!,
      b = line[i + 1]!;
    const n = Math.max(
      1,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4),
    );
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const [nx, ny] = project(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      );
      const [x, z] = boardToWorld(nx, ny);
      out.push({ x, z });
    }
  }
  const last = line[line.length - 1]!;
  const [nx, ny] = project(last[0], last[1]);
  const [x, z] = boardToWorld(nx, ny);
  out.push({ x, z });
  return out;
}

const CANAL_WORLD: SeaPt[][] = [
  canalWorldPts(SUEZ_ROUTE),
  canalWorldPts(PANAMA_ROUTE),
  canalWorldPts(BOSPORUS),
  canalWorldPts(GIBRALTAR),
  canalWorldPts(HORMUZ),
];

function nearestOnCanal(pt: SeaPt): { pt: SeaPt; d: number } {
  let best = pt,
    bestD = Infinity;
  for (const line of CANAL_WORLD) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!,
        b = line[i + 1]!;
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1e-12;
      const t = Math.max(
        0,
        Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2),
      );
      const x = a.x + t * dx,
        z = a.z + t * dz;
      const d = Math.hypot(pt.x - x, pt.z - z);
      if (d < bestD) {
        bestD = d;
        best = { x, z };
      }
    }
  }
  return { pt: best, d: bestD };
}

function snapToCanal(pt: SeaPt): SeaPt {
  const hit = nearestOnCanal(pt);
  return hit.d < 2.4 ? hit.pt : pt;
}

function bakeShore(water: Uint8Array): Uint8Array {
  const shore = new Uint8Array(COLS * ROWS);
  const q: number[] = [];
  for (let i = 0; i < water.length; i++) {
    if (water[i] === 0) {
      shore[i] = 0;
      q.push(i);
    } else {
      shore[i] = 255;
    }
  }
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++]!;
    const d = shore[i]!;
    if (d >= 12) continue;
    const r = Math.floor(i / COLS);
    const c = i - r * COLS;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        if (nr < 0 || nr >= ROWS) continue;
        /* Columns wrap: this is a global grid, so column 0 borders
           COLS-1 across the antimeridian. localIndex() already wraps on
           the read side, and clamping here instead priced the water off
           Chukotka and the Aleutians as open ocean because the land on
           the far side of the dateline was invisible to the fill. */
        const nc = ((c + dc) % COLS + COLS) % COLS;
        const ni = nr * COLS + nc;
        const nd = d + 1;
        if (nd >= shore[ni]!) continue;
        shore[ni] = nd;
        q.push(ni);
      }
    }
  }
  return shore;
}

function heapPush(hk: number[], hv: number[], k: number, v: number) {
  hk.push(k);
  hv.push(v);
  let i = hk.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (hv[p]! <= hv[i]!) break;
    const tk = hk[p]!,
      tv = hv[p]!;
    hk[p] = hk[i]!;
    hv[p] = hv[i]!;
    hk[i] = tk;
    hv[i] = tv;
    i = p;
  }
}

function heapPop(hk: number[], hv: number[]): [number, number] | null {
  if (!hk.length) return null;
  const rk = hk[0]!,
    rv = hv[0]!;
  const lk = hk.pop()!,
    lv = hv.pop()!;
  if (!hk.length) return [rk, rv];
  hk[0] = lk;
  hv[0] = lv;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1,
      r = l + 1;
    let s = i;
    if (l < hk.length && hv[l]! < hv[s]!) s = l;
    if (r < hk.length && hv[r]! < hv[s]!) s = r;
    if (s === i) break;
    const tk = hk[s]!,
      tv = hv[s]!;
    hk[s] = hk[i]!;
    hv[s] = hv[i]!;
    hk[i] = tk;
    hv[i] = tv;
    i = s;
  }
  return [rk, rv];
}

function latPenalty(row: number): number {
  const lat = LAT_MAX - ((row + 0.5) / ROWS) * (LAT_MAX - LAT_MIN);
  if (lat > 72) return 4.2;
  if (lat > 64) return 1.7;
  if (lat < -52) return 1.5;
  return 1;
}

function localIndex(col: number, row: number): number {
  const lc = ((col % COLS) + COLS) % COLS;
  return row * COLS + lc;
}

function localWater(grid: OceanGrid, col: number, row: number): boolean {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0 || col >= WIDE) return false;
  return grid.water[localIndex(col, row)] === 1;
}

function localCanal(grid: OceanGrid, col: number, row: number): boolean {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0 || col >= WIDE) return false;
  return grid.canal[localIndex(col, row)] === 1;
}

function localShore(grid: OceanGrid, col: number, row: number): number {
  if (row < 0 || row >= ROWS) return 0;
  if (col < 0 || col >= WIDE) return 0;
  return grid.shore[localIndex(col, row)] ?? 0;
}

function stepCost(
  grid: OceanGrid,
  nr: number,
  nc: number,
  diag: boolean,
  plain = false,
): number {
  if (plain) return (diag ? DIAG : ORTHO) * latPenalty(nr);
  const canal = localCanal(grid, nc, nr);
  const shore = localShore(grid, nc, nr);
  const coast = canal ? 0.28 : 1 + 3.4 / Math.max(shore, 0.45);
  return (diag ? DIAG : ORTHO) * latPenalty(nr) * coast;
}

function worldToCell(x: number, z: number): { col: number; row: number } {
  const col = Math.floor((x / BOARD_W + 0.5) * COLS) + COLS;
  const row = Math.max(
    0,
    Math.min(ROWS - 1, Math.floor((z / BOARD_H + 0.5) * ROWS)),
  );
  return { col: Math.max(0, Math.min(WIDE - 1, col)), row };
}

function cellToWorld(grid: OceanGrid, col: number, row: number): SeaPt {
  const local = ((col % COLS) + COLS) % COLS;
  const tile = Math.floor(col / COLS) - 1;
  const z = ((row + 0.5) / ROWS - 0.5) * BOARD_H;
  const x0 = ((local + 0.5) / COLS - 0.5) * BOARD_W;
  if (!localCanal(grid, col, row)) {
    return { x: x0 + tile * BOARD_W, z };
  }
  const snapped = snapToCanal({ x: x0, z });
  return { x: snapped.x + tile * BOARD_W, z: snapped.z };
}

function bboxOf(polys: Polys) {
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

export function buildOceanGrid(
  countries: { polys: Polys }[],
): OceanGrid {
  const water = new Uint8Array(COLS * ROWS);
  const canal = new Uint8Array(COLS * ROWS);
  water.fill(1);
  const indexed = countries
    .map((c) => ({ polys: c.polys, bbox: bboxOf(c.polys) }))
    .filter((c) => c.bbox);

  for (let row = 0; row < ROWS; row++) {
    const ny = (row + 0.5) / ROWS;
    for (let col = 0; col < COLS; col++) {
      const nx = (col + 0.5) / COLS;
      for (const c of indexed) {
        const b = c.bbox!;
        if (nx < b.x0 || nx > b.x1 || ny < b.y0 || ny > b.y1) continue;
        if (pointInPolys(nx, ny, c.polys)) {
          water[row * COLS + col] = 0;
          break;
        }
      }
    }
  }

  stampCanal(water, canal, SUEZ_ROUTE);
  stampCanal(water, canal, PANAMA_ROUTE);
  stampCanal(water, canal, BOSPORUS);
  stampCanal(water, canal, GIBRALTAR);
  stampCanal(water, canal, HORMUZ);

  const shore = bakeShore(water);
  for (let i = 0; i < canal.length; i++) {
    if (canal[i]) shore[i] = 12;
  }
  return { cols: COLS, rows: ROWS, water, canal, shore };
}

function nearestWater(
  grid: OceanGrid,
  col: number,
  row: number,
): { col: number; row: number } | null {
  const seen = new Uint8Array(WIDE * ROWS);
  const q: number[] = [row * WIDE + col];
  seen[row * WIDE + col] = 1;
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++]!;
    const r = Math.floor(i / WIDE);
    const c = i - r * WIDE;
    if (localWater(grid, c, r)) {
      /* First water, not the nearest "deep" cell. Searching until
         shore≥2 walks out of a strait (Dover, Malacca) into the next
         basin, so two hubs collapse and the edge between them vanishes. */
      return { col: c, row: r };
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc,
          nr = r + dr;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= WIDE) continue;
        const ni = nr * WIDE + nc;
        if (seen[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
  }
  return null;
}

/** Water that actually meets land — the last dash sits on the beach,
 *  not one cell offshore. */
function nearestBeach(
  grid: OceanGrid,
  col: number,
  row: number,
): { col: number; row: number } | null {
  const seen = new Uint8Array(WIDE * ROWS);
  const q: number[] = [row * WIDE + col];
  seen[row * WIDE + col] = 1;
  let qi = 0;
  let found: { col: number; row: number } | null = null;
  while (qi < q.length) {
    const i = q[qi++]!;
    const r = Math.floor(i / WIDE);
    const c = i - r * WIDE;
    if (localWater(grid, c, r)) {
      if (!found) found = { col: c, row: r };
      const shore = localShore(grid, c, r);
      if (localCanal(grid, c, r) || shore === 1) {
        return { col: c, row: r };
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc,
          nr = r + dr;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= WIDE) continue;
        const ni = nr * WIDE + nc;
        if (seen[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
  }
  return found;
}

function astar(
  grid: OceanGrid,
  sc: number,
  sr: number,
  gc: number,
  gr: number,
  plain = false,
): { col: number; row: number }[] | null {
  const start = sr * WIDE + sc;
  const goal = gr * WIDE + gc;
  const dist = new Float64Array(WIDE * ROWS);
  dist.fill(Infinity);
  dist[start] = 0;
  const prev = new Int32Array(WIDE * ROWS);
  prev.fill(-1);
  const hk: number[] = [];
  const hv: number[] = [];
  heapPush(hk, hv, start, 0);
  const seen = new Uint8Array(WIDE * ROWS);

  while (hk.length) {
    const popped = heapPop(hk, hv);
    if (!popped) break;
    const [i] = popped;
    if (seen[i]) continue;
    seen[i] = 1;
    if (i === goal) break;
    const r = Math.floor(i / WIDE);
    const c = i - r * WIDE;
    const base = dist[i]!;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc,
          nr = r + dr;
        if (!localWater(grid, nc, nr)) continue;
        const ni = nr * WIDE + nc;
        const step = stepCost(grid, nr, nc, !!(dr && dc), plain);
        const nd = base + step;
        if (nd >= dist[ni]!) continue;
        dist[ni] = nd;
        prev[ni] = i;
        const heur =
          Math.hypot(nc - gc, nr - gr) * latPenalty(nr);
        heapPush(hk, hv, ni, nd + heur);
      }
    }
  }

  if (!Number.isFinite(dist[goal]!)) return null;
  const cells: { col: number; row: number }[] = [];
  for (let i = goal; i >= 0; i = prev[i]!) {
    const r = Math.floor(i / WIDE);
    cells.push({ col: i - r * WIDE, row: r });
    if (i === start) break;
  }
  cells.reverse();
  return cells;
}

/** Same sea cell on another wrap copy of the 360° plate. */
function centreCol(col: number): number {
  return ((col % COLS) + COLS) % COLS + COLS;
}

function samePlace(a: Cell, b: Cell): boolean {
  return a.row === b.row && centreCol(a.col) === centreCol(b.col);
}

function wrapGoalCols(col: number): number[] {
  const out = [col];
  if (col + COLS < WIDE) out.push(col + COLS);
  if (col - COLS >= 0) out.push(col - COLS);
  return out;
}

/** Hub A* that takes the short way round the date line (Japan ↔ California).
 *  Wrap copies more than half a plate away are the long way round and
 *  would paint a chord across the seam if the short Channel/coast path
 *  is even slightly blocked. */
function astarHubs(
  grid: OceanGrid,
  a: Cell,
  b: Cell,
): Cell[] | null {
  let best: Cell[] | null = null;
  for (const gc of wrapGoalCols(b.col)) {
    if (Math.abs(gc - a.col) > COLS / 2) continue;
    const path = astar(grid, a.col, a.row, gc, b.row);
    if (path && path.length >= 2 && (!best || path.length < best.length)) {
      best = path;
    }
  }
  return best;
}

function shiftCols(cells: Cell[], d: number): Cell[] {
  if (!d) return cells;
  return cells.map((c) => ({ col: c.col + d, row: c.row }));
}

function alignJoin(stub: Cell[], highway: Cell[]): Cell[] {
  if (!stub.length || !highway.length) return stub;
  const a = stub[stub.length - 1]!;
  const b = highway[0]!;
  return shiftCols(stub, Math.round((b.col - a.col) / COLS) * COLS);
}

function alignStart(cells: Cell[], join: Cell): Cell[] {
  if (!cells.length) return cells;
  return shiftCols(cells, Math.round((join.col - cells[0]!.col) / COLS) * COLS);
}

function cellIdx(c: Cell): number {
  return c.row * WIDE + c.col;
}

function dedupeCells(cells: Cell[]): Cell[] {
  const out: Cell[] = [];
  for (const c of cells) {
    const last = out[out.length - 1];
    if (last && last.col === c.col && last.row === c.row) continue;
    out.push(c);
  }
  return out;
}

export interface SeaLane {
  id: string;
  owners: string[];
  path: SeaPt[];
  /** Frozen hub-edge keys this pair actually walks. Hover on a
   *  painted highway uses these so a spine with no boat on that
   *  exact water still lists the pairs that transit the hop. */
  edges?: string[];
}

export interface HubEdgeLane {
  key: string;
  path: SeaPt[];
}

export interface DrawnLane {
  owners: string[];
  path: SeaPt[];
  kind: "highway" | "stub";
  /** Debug stroke colour (highways only). */
  color?: number;
  highwayId?: string;
  /** Hub-edge keys this named spine is made of. */
  edges?: string[];
}

export interface NetworkLeg {
  id: string;
  from: SeaPt;
  to: SeaPt;
  owners: string[];
}

/** Junctions and A* vias so a spine hugs the coast or a canal instead
 *  of cutting a chord. */
const HUB_DEFS: { id: string; lng: number; lat: number }[] = [
  { id: "baltic", lng: 18.5, lat: 55.5 },
  { id: "nsea", lng: 4.2, lat: 54.0 },
  { id: "channel", lng: 2.2, lat: 55.8 },
  { id: "gibraltar", lng: -5.7, lat: 35.84 },
  { id: "azores", lng: -31.0, lat: 39.2 },
  { id: "newyork", lng: -71.5, lat: 38.8 },
  { id: "panN", lng: -79.8, lat: 9.62 },
  { id: "panS", lng: -79.72, lat: 8.68 },
  { id: "ca_pac", lng: -86.2, lat: 9.0 },
  { id: "mexico", lng: -102.5, lat: 12.2 },
  { id: "baja", lng: -116.5, lat: 21.8 },
  { id: "sanfran", lng: -124.4, lat: 37.4 },
  { id: "midpac", lng: 179.0, lat: 32.0 },
  { id: "okinawa", lng: 125.6, lat: 28.2 },
  { id: "shanghai", lng: 123.8, lat: 26.4 },
  { id: "taiwan", lng: 119.6, lat: 22.6 },
  { id: "viet", lng: 108.8, lat: 10.2 },
  { id: "singapore", lng: 104.4, lat: 1.55 },
  { id: "java", lng: 107.8, lat: -5.6 },
  { id: "australia", lng: 153.2, lat: -27.5 },
  { id: "nz_north", lng: 176.0, lat: -31.0 },
  { id: "s_pac", lng: -155.0, lat: -18.0 },
  { id: "galap", lng: -91.0, lat: -1.0 },
  { id: "tyrr", lng: 11.8, lat: 38.8 },
  { id: "aegean", lng: 27.5, lat: 35.8 },
  { id: "suezN", lng: 32.33, lat: 31.75 },
  { id: "suezS", lng: 33.25, lat: 27.65 },
  { id: "aden", lng: 55.4, lat: 14.0 },
  { id: "lanka", lng: 80.5, lat: 5.5 },
  { id: "arabian", lng: 63.5, lat: 11.4 },
  { id: "hormuz", lng: 56.5, lat: 26.5 },
  { id: "kenya", lng: 41.2, lat: -3.0 },
  { id: "moz", lng: 36.4, lat: -25.4 },
  { id: "cape", lng: 17.9, lat: -34.7 },
  { id: "morocco", lng: -9.2, lat: 33.0 },
  { id: "guinea", lng: 3.5, lat: 4.8 },
  { id: "rio", lng: -42.8, lat: -23.15 },
  { id: "argentina", lng: -54.4, lat: -36.6 },
  { id: "recife", lng: -34.6, lat: -8.2 },
  { id: "guyana", lng: -56.8, lat: 7.4 },
];

/** Authored spines. Gibraltar–Aden is Suez (the Med cannot reach
 *  Aden via Panama). Cape–Rio is the South Atlantic. Singapore continues
 *  past Australia across the South Pacific into Panama's Pacific mouth. */
const HIGHWAYS: { id: string; color: number; hubs: string[] }[] = [
  {
    id: "baltic_gib",
    color: 0x5ac8ff,
    hubs: ["baltic", "nsea", "channel", "gibraltar"],
  },
  {
    id: "gib_okinawa",
    color: 0xff453a,
    hubs: [
      "gibraltar",
      "azores",
      "newyork",
      "panN",
      "panS",
      "ca_pac",
      "mexico",
      "baja",
      "sanfran",
      "midpac",
      "okinawa",
    ],
  },
  {
    id: "gib_aden",
    color: 0xffd60a,
    hubs: ["gibraltar", "tyrr", "aegean", "suezN", "suezS", "aden"],
  },
  {
    id: "okinawa_spore",
    color: 0xbf5af2,
    hubs: ["okinawa", "shanghai", "taiwan", "viet", "singapore"],
  },
  {
    id: "spore_aus",
    color: 0xff9f0a,
    hubs: [
      "singapore",
      "java",
      "australia",
      "nz_north",
      "s_pac",
      "galap",
      "panS",
    ],
  },
  {
    id: "spore_aden",
    color: 0xff2d55,
    hubs: ["singapore", "lanka", "arabian", "aden"],
  },
  {
    id: "gulf_hormuz",
    color: 0xff2d55,
    hubs: ["hormuz", "arabian"],
  },
  {
    id: "aden_cape",
    color: 0xe5e5ea,
    hubs: ["aden", "kenya", "moz", "cape"],
  },
  {
    id: "cape_gib",
    color: 0x32ade6,
    hubs: ["cape", "guinea", "morocco", "gibraltar"],
  },
  { id: "cape_rio", color: 0xaf52de, hubs: ["cape", "rio"] },
  {
    id: "arg_panama",
    color: 0x0a84ff,
    hubs: ["argentina", "rio", "recife", "guyana", "panN"],
  },
];

const HIGHWAY_REV = 33;

const HUB_LINKS: [string, string][] = (() => {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const hw of HIGHWAYS) {
    for (let i = 1; i < hw.hubs.length; i++) {
      const a = hw.hubs[i - 1]!,
        b = hw.hubs[i]!;
      const key = hubPairKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([a, b]);
    }
  }
  return out;
})();

const HUB_DEGREE: Record<string, number> = (() => {
  const d: Record<string, number> = {};
  for (const [a, b] of HUB_LINKS) {
    d[a] = (d[a] || 0) + 1;
    d[b] = (d[b] || 0) + 1;
  }
  return d;
})();

function hubPairKey(a: string, b: string) {
  return a < b ? a + ">" + b : b + ">" + a;
}

function lngLatBeach(
  grid: OceanGrid,
  lng: number,
  lat: number,
): Cell | null {
  const [nx, ny] = project(lng, lat);
  const { col, row } = worldToCell((nx - 0.5) * BOARD_W, (ny - 0.5) * BOARD_H);
  return nearestBeach(grid, col, row);
}

/** Second coasts. The capital beach is always a stub; these are extra
 *  on-ramps so a two-ocean seat is not only wired on one side. */
const EXTRA_PORTS: Record<string, { lng: number; lat: number }[]> = {
  canada: [{ lng: -63.0, lat: 44.3 }],
  saudi: [{ lng: 50.5, lat: 26.8 }],
};

/** These seats join the nearest named hub rather than the nearest highway
 *  cell, so a capital does not run a long coast-hugging feeder. */
const HUB_STUB_SEATS = new Set([
  "japan",
  "china",
  "korea",
  "united_states",
  "mexico",
  "vietnam",
  "uae",
]);

/** Pacific Tehuantepec — Mexico City's nearest water is the Gulf, which
 *  would send the stub the long way around to the Pacific hub.
 *  Cam Ranh — Hanoi’s nearest water is the Gulf of Tonkin, a long coast
 *  walk from the South China Sea hub. */
const STUB_BEACH: Record<string, { lng: number; lat: number }> = {
  mexico: { lng: -95.4, lat: 16.2 },
  vietnam: { lng: 109.2, lat: 11.9 },
  china: { lng: 122.0, lat: 30.2 },
  korea: { lng: 126.3, lat: 33.6 },
  uae: { lng: 54.2, lat: 25.1 },
};

/** Pin a seat onto a named hub instead of whichever is geographically nearest. */
const STUB_HUB: Record<string, string> = {
  mexico: "mexico",
  vietnam: "viet",
  china: "shanghai",
  korea: "okinawa",
  uae: "hormuz",
};

/** Same geographic hub, shifted onto the wrap tile `at` already lives on. */
function wrapShiftTo(hub: Cell, at: Cell): Cell {
  return {
    col: hub.col + Math.round((at.col - hub.col) / COLS) * COLS,
    row: hub.row,
  };
}

function pinHubEnds(path: Cell[], from: Cell, to: Cell): Cell[] {
  const out = path.slice();
  const start = wrapShiftTo(from, out[0]!);
  if (out[0]!.col !== start.col || out[0]!.row !== start.row) {
    out.unshift(start);
  } else {
    out[0] = start;
  }
  const end = wrapShiftTo(to, out[out.length - 1]!);
  const last = out.length - 1;
  if (out[last]!.col !== end.col || out[last]!.row !== end.row) {
    out.push(end);
  } else {
    out[last] = end;
  }
  return out;
}

/** Reverse and wrap-shift an edge so it starts on the same tile as `at`. */
function orientEdge(path: Cell[], at: Cell): Cell[] {
  let p = path;
  if (samePlace(p[p.length - 1]!, at) && !samePlace(p[0]!, at)) {
    p = p.slice().reverse();
  }
  return shiftCols(p, Math.round((at.col - p[0]!.col) / COLS) * COLS);
}

function lngLatCell(
  grid: OceanGrid,
  lng: number,
  lat: number,
): Cell | null {
  const [nx, ny] = project(lng, lat);
  const { col, row } = worldToCell((nx - 0.5) * BOARD_W, (ny - 0.5) * BOARD_H);
  return nearestWater(grid, col, row);
}

function seedStubForest(grid: OceanGrid, trunkHits: Map<number, TrunkHit[]>): Int32Array {
  const prev = new Int32Array(WIDE * ROWS);
  const dist = new Float64Array(WIDE * ROWS);
  prev.fill(-1);
  dist.fill(Infinity);
  const hk: number[] = [];
  const hv: number[] = [];
  for (const i of trunkHits.keys()) {
    dist[i] = 0;
    heapPush(hk, hv, i, 0);
  }
  const seen = new Uint8Array(WIDE * ROWS);
  while (hk.length) {
    const popped = heapPop(hk, hv);
    if (!popped) break;
    const [i] = popped;
    if (seen[i]) continue;
    seen[i] = 1;
    const r = Math.floor(i / WIDE);
    const c = i - r * WIDE;
    const base = dist[i]!;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc,
          nr = r + dr;
        if (!localWater(grid, nc, nr)) continue;
        const ni = nr * WIDE + nc;
        const nd = base + stepCost(grid, nr, nc, !!(dr && dc), true);
        if (nd >= dist[ni]!) continue;
        dist[ni] = nd;
        prev[ni] = i;
        heapPush(hk, hv, ni, nd);
      }
    }
  }
  return prev;
}

function nearestTrunkCell(net: HubNet, cell: Cell): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const i of net.trunkHits.keys()) {
    const r = Math.floor(i / WIDE);
    const c = i - r * WIDE;
    const d = (c - cell.col) * (c - cell.col) + (r - cell.row) * (r - cell.row);
    if (d < bestD) {
      bestD = d;
      best = { col: c, row: r };
    }
  }
  return best;
}

/** Shortest water hop onto the highway — stops at the first trunk cell
 *  so a stub never runs along the red spine. */
function stubToTrunk(grid: OceanGrid, net: HubNet, beach: Cell): Cell[] {
  const start = cellIdx(beach);
  if (net.trunkHits.has(start)) return [beach];
  if (net.prev[start]! < 0) {
    const on = nearestTrunkCell(net, beach);
    if (!on) return [];
    if (samePlace(on, beach)) return [beach];
    return astar(grid, beach.col, beach.row, on.col, on.row, true) || [beach, on];
  }
  const out: Cell[] = [];
  let i = start;
  for (let n = 0; n < WIDE && i >= 0; n++) {
    const r = Math.floor(i / WIDE);
    out.push({ col: i - r * WIDE, row: r });
    if (net.trunkHits.has(i)) break;
    const p = net.prev[i]!;
    if (p < 0) break;
    i = p;
  }
  return out;
}

function hubColDist(a: Cell, b: Cell): number {
  const d = Math.abs(centreCol(a.col) - centreCol(b.col));
  return Math.min(d, COLS - d);
}

function nearestHubCell(net: HubNet, beach: Cell): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const hub of net.cells) {
    const dcol = hubColDist(beach, hub);
    const drow = beach.row - hub.row;
    const d = dcol * dcol + drow * drow;
    if (d < bestD) {
      bestD = d;
      best = hub;
    }
  }
  return best;
}

function stubToNearestHub(
  grid: OceanGrid,
  net: HubNet,
  beach: Cell,
  seatId: string,
): Cell[] {
  const named = STUB_HUB[seatId];
  const hi = named ? net.ids.indexOf(named) : -1;
  const hub = hi >= 0 ? net.cells[hi]! : nearestHubCell(net, beach);
  if (!hub) return stubToTrunk(grid, net, beach);
  if (samePlace(beach, hub)) return [beach];
  let best: Cell[] | null = null;
  for (const gc of wrapGoalCols(hub.col)) {
    if (Math.abs(gc - beach.col) > COLS / 2) continue;
    const path = astar(grid, beach.col, beach.row, gc, hub.row, true);
    if (path && path.length >= 2 && (!best || path.length < best.length)) {
      best = path;
    }
  }
  if (!best) return stubToTrunk(grid, net, beach);
  return pinHubEnds(best, beach, hub);
}

function cellOnPath(path: Cell[], cell: Cell): number {
  for (let i = 0; i < path.length; i++) {
    if (samePlace(path[i]!, cell)) return i;
  }
  return -1;
}

function sliceOnEdge(net: HubNet, key: string, from: Cell, to: Cell): Cell[] {
  const path = net.edgePath.get(key);
  if (!path) return [];
  const i = cellOnPath(path, from);
  const j = cellOnPath(path, to);
  if (i < 0 || j < 0) return [];
  if (i === j) return [path[i]!];
  return i < j ? path.slice(i, j + 1) : path.slice(j, i + 1).reverse();
}

function edgeHubs(key: string): [string, string] {
  const i = key.indexOf(">");
  return [key.slice(0, i), key.slice(i + 1)];
}

function edgeHasHub(key: string, hubId: string): boolean {
  const [a, b] = edgeHubs(key);
  return a === hubId || b === hubId;
}

function hubsOfHits(hits: TrunkHit[]): string[] {
  const ids = new Set<string>();
  for (const h of hits) {
    const [a, b] = edgeHubs(h.key);
    ids.add(a);
    ids.add(b);
  }
  return [...ids];
}

function hitsAt(net: HubNet, cell: Cell): TrunkHit[] {
  const exact = net.trunkHits.get(cellIdx(cell));
  if (exact?.length) return exact;
  const folded = { col: centreCol(cell.col), row: cell.row };
  if (folded.col === cell.col) return [];
  return net.trunkHits.get(cellIdx(folded)) || [];
}

function alongToHub(
  net: HubNet,
  cell: Cell,
  hubId: string,
): { cells: Cell[]; key: string | null } {
  const hits = hitsAt(net, cell);
  if (!hits?.length) return { cells: [], key: null };
  const hi = net.ids.indexOf(hubId);
  if (hi < 0) return { cells: [], key: null };
  const hub = net.cells[hi]!;
  if (samePlace(cell, hub)) {
    return { cells: [cell], key: null };
  }
  for (const h of hits) {
    if (!edgeHasHub(h.key, hubId)) continue;
    const slice = sliceOnEdge(net, h.key, cell, hub);
    if (slice.length) return { cells: slice, key: h.key };
  }
  return { cells: [], key: null };
}

/** Degrees on the plate between two hubs. Open-ocean A* walks are
 *  one cell per degree, but a coast-hugging canal of the same span can
 *  be fewer cells; scoring hops by `path.length` therefore sent
 *  Australia–US via Suez and left the South Pacific spine empty. */
function hubStepCost(
  net: HubNet,
  ia: number,
  ib: number,
  path: Cell[],
): number {
  const a = net.cells[ia]!,
    b = net.cells[ib]!;
  const geo = Math.hypot(hubColDist(a, b), a.row - b.row);
  return geo > 0.5 ? geo : Math.max(1, path.length);
}

function keysCost(net: HubNet, keys: string[]): number {
  if (!keys.length) return 0;
  let n = 0;
  for (const key of keys) {
    const sep = key.indexOf(">");
    if (sep < 0) return Infinity;
    const ia = net.ids.indexOf(key.slice(0, sep));
    const ib = net.ids.indexOf(key.slice(sep + 1));
    const path = net.edgePath.get(key);
    if (ia < 0 || ib < 0 || !path) return Infinity;
    n += hubStepCost(net, ia, ib, path);
  }
  return n;
}

/** Frozen-highway walk between two on-ramps: cell slice for boats, plus
 *  the hub-edge keys to paint (always the full frozen edge). */
function trunkJourney(
  net: HubNet,
  on0: Cell,
  on1: Cell,
): { cells: Cell[]; keys: string[] } {
  if (samePlace(on0, on1)) {
    return { cells: [on0], keys: [] };
  }
  const hits0 = hitsAt(net, on0);
  const hits1 = hitsAt(net, on1);
  let bestSame: { cells: Cell[]; keys: string[] } | null = null;
  for (const a of hits0) {
    for (const b of hits1) {
      if (a.key !== b.key) continue;
      const slice = sliceOnEdge(net, a.key, on0, on1);
      if (
        slice.length &&
        (!bestSame || slice.length < bestSame.cells.length)
      ) {
        bestSame = { cells: slice, keys: [a.key] };
      }
    }
  }
  if (bestSame && bestSame.cells.length >= 2) return bestSame;

  let best: { cells: Cell[]; keys: string[]; cost: number } | null = null;
  for (const x of hubsOfHits(hits0)) {
    const ix = net.ids.indexOf(x);
    if (ix < 0) continue;
    const head = alongToHub(net, on0, x);
    if (!head.cells.length) continue;
    for (const y of hubsOfHits(hits1)) {
      const iy = net.ids.indexOf(y);
      if (iy < 0) continue;
      const tail = alongToHub(net, on1, y);
      if (!tail.cells.length) continue;
      const mid = hopCells(net, ix, iy);
      if (ix !== iy && mid.length < 2) continue;
      const keys = hopEdgeKeys(net, ix, iy);
      if (ix !== iy && keys.length < 1) continue;
      if (head.key) keys.unshift(head.key);
      if (tail.key) keys.push(tail.key);
      const at = head.cells[head.cells.length - 1]!;
      const midA = orientEdge(mid.length ? mid : [at], at);
      const tailRev = tail.cells.slice().reverse();
      const join = midA[midA.length - 1] || at;
      const tailA = orientEdge(
        tailRev.length ? tailRev : [join],
        join,
      );
      const cells = concatCells([head.cells, midA, tailA]);
      const uniq = [...new Set(keys)];
      const cost = keysCost(net, uniq);
      if (
        cells.length >= 2 &&
        (!best ||
          cost < best.cost ||
          (cost === best.cost && cells.length < best.cells.length))
      ) {
        best = { cells, keys: uniq, cost };
      }
    }
  }
  return best || bestSame || { cells: [], keys: [] };
}

function hopHubs(net: HubNet, ia: number, ib: number): number[] {
  if (ia === ib) return [ia];
  const n = net.ids.length;
  const dist = new Float64Array(n);
  dist.fill(Infinity);
  const prev = new Int32Array(n);
  prev.fill(-1);
  dist[ia] = 0;
  const used = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let u = -1,
      best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!used[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u < 0) break;
    used[u] = 1;
    if (u === ib) break;
    const idu = net.ids[u]!;
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      const path = net.edgePath.get(hubPairKey(idu, net.ids[v]!));
      if (!path) continue;
      const nd = dist[u]! + hubStepCost(net, u, v, path);
      if (nd < dist[v]!) {
        dist[v] = nd;
        prev[v] = u;
      }
    }
  }
  if (!Number.isFinite(dist[ib]!)) return [];
  const hops: number[] = [];
  for (let v = ib; v >= 0; v = prev[v]!) {
    hops.push(v);
    if (v === ia) break;
  }
  hops.reverse();
  if (hops[0] !== ia) return [];
  return hops;
}

function hopEdgeKeys(net: HubNet, ia: number, ib: number): string[] {
  const hops = hopHubs(net, ia, ib);
  const keys: string[] = [];
  for (let i = 1; i < hops.length; i++) {
    keys.push(hubPairKey(net.ids[hops[i - 1]!]!, net.ids[hops[i]!]!));
  }
  return keys;
}

function hopCells(net: HubNet, ia: number, ib: number): Cell[] {
  const hops = hopHubs(net, ia, ib);
  if (ia === ib) return [net.cells[ia]!];
  if (hops.length < 2) return [];
  const cells: Cell[] = [];
  for (let i = 1; i < hops.length; i++) {
    const a = net.ids[hops[i - 1]!]!;
    const b = net.ids[hops[i]!]!;
    let path = net.edgePath.get(hubPairKey(a, b));
    if (!path) return [];
    const start = cells.length
      ? cells[cells.length - 1]!
      : net.cells[hops[i - 1]!]!;
    path = orientEdge(path, start);
    for (const c of path) cells.push(c);
  }
  return dedupeCells(cells);
}

function cellsAlongLine(line: LngLat[]): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!,
      b = line[i + 1]!;
    const [x0, y0] = project(a[0], a[1]);
    const [x1, y1] = project(b[0], b[1]);
    const n = Math.max(
      2,
      Math.ceil(Math.hypot((x1 - x0) * COLS, (y1 - y0) * ROWS) * 3),
    );
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const col =
        Math.max(0, Math.min(COLS - 1, Math.floor((x0 + (x1 - x0) * t) * COLS))) +
        COLS;
      const row = Math.max(
        0,
        Math.min(ROWS - 1, Math.floor((y0 + (y1 - y0) * t) * ROWS)),
      );
      out.push({ col, row });
    }
  }
  return dedupeCells(out);
}

const CANAL_LINKS = new Map<string, LngLat[]>([
  [hubPairKey("suezN", "suezS"), SUEZ_ROUTE],
  [hubPairKey("panN", "panS"), PANAMA_ROUTE],
]);

function ensureHubNet(grid: OceanGrid): HubNet {
  if (grid.hubs?.rev === HIGHWAY_REV) return grid.hubs;
  const ids: string[] = [];
  const cells: Cell[] = [];
  for (const h of HUB_DEFS) {
    const c = lngLatCell(grid, h.lng, h.lat);
    if (!c) continue;
    ids.push(h.id);
    cells.push(c);
  }
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  const edgePath = new Map<string, Cell[]>();
  for (const [a, b] of HUB_LINKS) {
    const ia = idIndex.get(a);
    const ib = idIndex.get(b);
    if (ia == null || ib == null) continue;
    const ca = cells[ia]!,
      cb = cells[ib]!;
    const canned = CANAL_LINKS.get(hubPairKey(a, b));
    let path: Cell[] | null;
    if (canned) {
      path = concatCells([[ca], cellsAlongLine(canned), [cb]]);
    } else {
      const da = HUB_DEGREE[a] || 0;
      const db = HUB_DEGREE[b] || 0;
      /* High-degree hubs (Aden, Malacca) own the A* so every spoke
         leaves the same cell instead of meeting in a triangle. */
      path =
        db > da ? astarHubs(grid, cb, ca) : astarHubs(grid, ca, cb);
      if (path?.length) {
        const from = db > da ? cb : ca;
        const to = db > da ? ca : cb;
        path = pinHubEnds(path, from, to);
      }
    }
    if (!path || path.length < 2) continue;
    edgePath.set(hubPairKey(a, b), path);
  }
  const trunkHits = new Map<number, TrunkHit[]>();
  const addHit = (c: Cell, key: string, index: number) => {
    const stamp = (cell: Cell) => {
      const i = cellIdx(cell);
      let list = trunkHits.get(i);
      if (!list) {
        list = [];
        trunkHits.set(i, list);
      }
      list.push({ key, index });
    };
    stamp(c);
    const folded = { col: centreCol(c.col), row: c.row };
    if (folded.col !== c.col) stamp(folded);
  };
  for (const [key, path] of edgePath) {
    path.forEach((c, index) => addHit(c, key, index));
  }
  const strokes: { id: string; color: number; path: SeaPt[] }[] = [];
  for (const hw of HIGHWAYS) {
    let cellsAlong: Cell[] = [];
    let at: Cell | undefined;
    for (let i = 1; i < hw.hubs.length; i++) {
      const a = hw.hubs[i - 1]!,
        b = hw.hubs[i]!;
      let path = edgePath.get(hubPairKey(a, b));
      if (!path?.length) continue;
      if (at) {
        path = orientEdge(path, at);
      } else {
        const ia = idIndex.get(a);
        const start = ia != null ? cells[ia] : undefined;
        if (start) path = orientEdge(path, start);
      }
      cellsAlong = concatCells([cellsAlong, path]);
      at = cellsAlong[cellsAlong.length - 1];
    }
    if (cellsAlong.length < 2) continue;
    const path = cellsToWorld(grid, cellsAlong);
    if (path.length >= 2) {
      strokes.push({ id: hw.id, color: hw.color, path });
    }
  }
  const net: HubNet = {
    rev: HIGHWAY_REV,
    ids,
    cells,
    edgePath,
    prev: seedStubForest(grid, trunkHits),
    trunkHits,
    strokes,
  };
  grid.hubs = net;
  return net;
}

function concatCells(parts: Cell[][]): Cell[] {
  const out: Cell[] = [];
  for (const part of parts) {
    for (const c of part) {
      const last = out[out.length - 1];
      if (last && last.col === c.col && last.row === c.row) continue;
      out.push(c);
    }
  }
  return out;
}

function cellsToWorld(grid: OceanGrid, cells: Cell[]): SeaPt[] {
  const out: SeaPt[] = [];
  for (const c of cells) {
    let p = cellToWorld(grid, c.col, c.row);
    if (out.length) {
      const k = Math.round((out[out.length - 1]!.x - p.x) / BOARD_W) * BOARD_W;
      if (k) p = { x: p.x + k, z: p.z };
    }
    out.push(p);
  }
  return out;
}

/** Fold longitude onto the centre plate (−180..180). */
function foldX(x: number): number {
  let u = x / BOARD_W + 0.5;
  u -= Math.floor(u);
  return (u - 0.5) * BOARD_W;
}

/** Break a wrap-continuous polyline wherever it crosses the date line so
 *  dashes sit on the same plate as the land, not as a chord across it.
 *  Both pieces are extended to ±180 so wrap tiles meet instead of
 *  leaving a one-cell hole in the Pacific. */
function splitSeam(path: SeaPt[]): SeaPt[][] {
  if (path.length < 2) return [];
  const half = BOARD_W / 2;
  const parts: SeaPt[][] = [];
  let cur: SeaPt[] = [{ x: foldX(path[0]!.x), z: path[0]!.z }];
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const p = path[i]!;
    const a = foldX(prev.x);
    const b = foldX(p.x);
    if (Math.abs(b - a) > half) {
      const dx = p.x - prev.x;
      const seam =
        dx > 0
          ? (Math.floor(prev.x / half) + 1) * half
          : (Math.ceil(prev.x / half) - 1) * half;
      const t = dx ? (seam - prev.x) / dx : 0;
      const z = prev.z + t * (p.z - prev.z);
      cur.push({ x: a >= 0 ? half : -half, z });
      if (cur.length >= 2) parts.push(cur);
      cur = [
        { x: b >= 0 ? half : -half, z },
        { x: b, z: p.z },
      ];
    } else {
      cur.push({ x: b, z: p.z });
    }
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

function concatWorld(parts: SeaPt[][]): SeaPt[] {
  const out: SeaPt[] = [];
  for (const part of parts) {
    if (!part.length) continue;
    let pts = part;
    if (out.length) {
      const join = out[out.length - 1]!;
      const first = part[0]!;
      const k = Math.round((join.x - first.x) / BOARD_W) * BOARD_W;
      if (k) pts = part.map((p) => ({ x: p.x + k, z: p.z }));
    }
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.hypot(last.x - p.x, last.z - p.z) < 0.04) continue;
      out.push(p);
    }
  }
  return unwrapSeaPath(out);
}

/** Keep consecutive points on one wrap so interpolation cannot chord
 *  across the date line. */
export function unwrapSeaPath(path: SeaPt[]): SeaPt[] {
  if (path.length < 2) return path;
  const out: SeaPt[] = [{ x: path[0]!.x, z: path[0]!.z }];
  for (let i = 1; i < path.length; i++) {
    const p = path[i]!;
    const prev = out[out.length - 1]!;
    const k = Math.round((prev.x - p.x) / BOARD_W) * BOARD_W;
    out.push({ x: p.x + k, z: p.z });
  }
  return out;
}

function addOwners(map: Map<string, Set<string>>, key: string, ids: string[]) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  for (const id of ids) set.add(id);
}

function portCellKey(cell: Cell): string {
  return cell.col + "," + cell.row;
}

function beachesFor(
  grid: OceanGrid,
  pt: SeaPt,
  seatId: string,
): Cell[] {
  const pin = STUB_BEACH[seatId];
  if (pin) {
    const b = lngLatBeach(grid, pin.lng, pin.lat);
    return b ? [b] : [];
  }
  const { col, row } = worldToCell(pt.x, pt.z);
  const out: Cell[] = [];
  const cap = nearestBeach(grid, col, row);
  if (cap) out.push(cap);
  for (const p of EXTRA_PORTS[seatId] || []) {
    const b = lngLatBeach(grid, p.lng, p.lat);
    if (!b) continue;
    if (out.some((c) => c.col === b.col && c.row === b.row)) continue;
    out.push(b);
  }
  return out;
}

/** Red highways, always drawn; one blue stub per capital beach. */
export function planNetwork(
  grid: OceanGrid,
  legs: NetworkLeg[],
): { boats: SeaLane[]; draw: DrawnLane[]; edges: HubEdgeLane[] } {
  const net = ensureHubNet(grid);
  const stubByPort = new Map<string, Cell[]>();
  const stubOwners = new Map<string, Set<string>>();
  const boats: SeaLane[] = [];

  const stubOf = (cell: Cell, seatId: string): Cell[] => {
    const k = portCellKey(cell);
    let f = stubByPort.get(k);
    if (!f) {
      f = HUB_STUB_SEATS.has(seatId)
        ? stubToNearestHub(grid, net, cell, seatId)
        : stubToTrunk(grid, net, cell);
      stubByPort.set(k, f);
    }
    return f;
  };

  for (const leg of legs) {
    const origins = beachesFor(grid, leg.from, leg.owners[0] || "");
    const goals = beachesFor(grid, leg.to, leg.owners[1] || "");
    for (const b of origins) {
      stubOf(b, leg.owners[0] || "");
      addOwners(stubOwners, portCellKey(b), [leg.owners[0] || ""]);
    }
    for (const b of goals) {
      stubOf(b, leg.owners[1] || "");
      addOwners(stubOwners, portCellKey(b), [leg.owners[1] || ""]);
    }
    let best: {
      stub0: Cell[];
      stub1: Cell[];
      journey: { cells: Cell[]; keys: string[] };
    } | null = null;
    let bestScore = Infinity;
    for (const origin of origins) {
      for (const goal of goals) {
        const stub0 = stubOf(origin, leg.owners[0] || "");
        const stub1 = stubOf(goal, leg.owners[1] || "");
        const on0 = stub0[stub0.length - 1];
        const on1 = stub1[stub1.length - 1];
        if (!on0 || !on1) continue;
        const journey = trunkJourney(net, on0, on1);
        if (journey.cells.length < 1) continue;
        const score =
          stub0.length + stub1.length + keysCost(net, journey.keys);
        if (score < bestScore) {
          bestScore = score;
          best = { stub0, stub1, journey };
        }
      }
    }
    if (!best) continue;
    const j = best.journey.cells;
    const s0 = alignJoin(best.stub0, j);
    const s1 = alignStart(best.stub1.slice().reverse(), j[j.length - 1]!);
    const path = unwrapSeaPath(
      concatWorld([
        cellsToWorld(grid, s0),
        cellsToWorld(grid, j),
        cellsToWorld(grid, s1),
      ]),
    );
    if (path.length < 2) continue;
    boats.push({
      id: leg.id,
      owners: leg.owners,
      path,
      edges: best.journey.keys,
    });
  }

  const edges: HubEdgeLane[] = [];
  for (const [key, cells] of net.edgePath) {
    if (cells.length < 2) continue;
    const path = unwrapSeaPath(cellsToWorld(grid, cells));
    if (path.length >= 2) edges.push({ key, path });
  }

  const draw: DrawnLane[] = [];
  for (const s of net.strokes) {
    const hw = HIGHWAYS.find((h) => h.id === s.id);
    const hwKeys: string[] = [];
    if (hw) {
      for (let i = 1; i < hw.hubs.length; i++) {
        hwKeys.push(hubPairKey(hw.hubs[i - 1]!, hw.hubs[i]!));
      }
    }
    for (const part of splitSeam(s.path)) {
      draw.push({
        owners: [],
        path: part,
        kind: "highway",
        color: s.color,
        highwayId: s.id,
        edges: hwKeys,
      });
    }
  }
  for (const [pk, cells] of stubByPort) {
    if (cells.length < 2) continue;
    const owners = stubOwners.get(pk);
    if (!owners?.size) continue;
    const path = cellsToWorld(grid, cells);
    if (path.length < 2) continue;
    draw.push({ owners: [...owners].sort(), path, kind: "stub" });
  }
  return { boats, draw, edges };
}

export function pathLength(pts: SeaPt[]): number {
  const p = unwrapSeaPath(pts);
  let n = 0;
  for (let i = 1; i < p.length; i++) {
    n += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.z - p[i - 1]!.z);
  }
  return n;
}

/** A lane unwrapped once, with its cumulative arc length. Boats sample
 *  their lane every frame, so the unwrap and the length sum are hoisted
 *  out of the sampler: sampling used to allocate two whole copies of the
 *  polyline per boat per frame (one to unwrap, one inside pathLength()),
 *  neither of which changes between frames. */
export interface SeaPath {
  pts: SeaPt[];
  /** cum[i] is the distance from the start to pts[i]; cum[0] is 0. */
  cum: number[];
  length: number;
}

export function prepareSeaPath(pts: SeaPt[]): SeaPath {
  const path = unwrapSeaPath(pts);
  const cum = new Array<number>(path.length);
  let total = 0;
  cum[0] = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
    cum[i] = total;
  }
  return { pts: path, cum, length: total };
}

/** Position and heading a fraction `t` along a prepared lane. */
export function pathAtPrepared(
  path: SeaPath,
  t: number,
): { x: number; z: number; heading: number } {
  const pts = path.pts;
  if (pts.length === 0) return { x: 0, z: 0, heading: 0 };
  if (pts.length === 1) return { x: pts[0]!.x, z: pts[0]!.z, heading: 0 };
  const target = Math.max(0, Math.min(1, t)) * path.length;
  /* Binary search the cumulative table rather than walking it: a lane is
     resampled to hundreds of points and this runs per boat per frame. */
  let lo = 1,
    hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  const a = pts[lo - 1]!,
    b = pts[lo]!;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const seg = path.cum[lo]! - path.cum[lo - 1]!;
  const u = seg > 1e-6 ? (target - path.cum[lo - 1]!) / seg : 0;
  return {
    x: a.x + dx * u,
    z: a.z + dz * u,
    heading: Math.atan2(-dx, -dz),
  };
}

