/**
 * Suez, Panama, Bosporus and Gibraltar: Natural Earth 110m seals or
 * pinches these cuts. Land is authored (or notched) with a straight water
 * gap; the same polylines are stamped into the sea-grid so boats walk it.
 * The Channel is opened the same way: Britain and Ireland slide
 * north-west so a shipping lane fits between Dover and Calais. Hormuz is
 * notched like Gibraltar so Gulf stubs can leave through the strait. The
 * Skagerrak / Kattegat / Øresund get the same treatment: Zealand shrinks
 * and southern Norway and Sweden slide north, without dragging Lapland
 * off Finland.
 */

import { LAT_MAX, LAT_MIN, project, type Point } from "./projection.ts";
import { ringCentroid, type Polys, type Ring } from "./geo.ts";

export type LngLat = [number, number];

/** Port Said → Gulf of Suez, down the middle of the authored land gap. */
export const SUEZ: LngLat[] = [
  [32.33, 31.62],
  [32.3, 31.2],
  [32.32, 30.7],
  [32.34, 30.2],
  [32.4, 29.7],
  [32.55, 29.2],
  [32.85, 28.45],
  [33.25, 27.7],
];

/** Caribbean → Pacific, down the middle of the authored land gap. */
export const PANAMA: LngLat[] = [
  [-79.8, 9.5],
  [-79.78, 9.22],
  [-79.76, 9.02],
  [-79.74, 8.82],
];

/** Black Sea → Marmara, straight through the widened Bosporus. */
export const BOSPORUS: LngLat[] = [
  [29.03, 41.48],
  [29.03, 41.05],
];

/** Atlantic → Mediterranean, straight through the widened strait. */
export const GIBRALTAR: LngLat[] = [
  [-6.2, 35.84],
  [-5.25, 35.84],
];

/** Persian Gulf → Gulf of Oman, down the middle of the widened strait. */
export const HORMUZ: LngLat[] = [
  [54.6, 26.45],
  [56.45, 26.55],
  [57.7, 25.55],
];

export const SUEZ_ROUTE: LngLat[] = SUEZ;
export const PANAMA_ROUTE: LngLat[] = PANAMA;

function close(ring: LngLat[]): LngLat[] {
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (!a || !b) return ring;
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, [a[0], a[1]]];
}

function toPolys(rings: LngLat[][]): Polys {
  return rings.map((ring) => [
    close(ring).map(([lng, lat]) => project(lng, lat) as Point),
  ]);
}

/**
 * 110m Egypt, split on Suez. Gap ~0.9° so the water reads as a channel
 * under the land outline, not a hairline between two slabs.
 */
const EGYPT_WEST: LngLat[] = [
  [36.8662, 22.0005],
  [32.8989, 22.0005],
  [29.0217, 22.0005],
  [25.0005, 22.0005],
  [25.0005, 25.6818],
  [25.0005, 29.2378],
  [24.7016, 30.0435],
  [24.9572, 30.6613],
  [24.8024, 31.0895],
  [25.1661, 31.5685],
  [26.4945, 31.5854],
  [27.4593, 31.3214],
  [28.4493, 31.0252],
  [28.9137, 30.8695],
  [29.6841, 31.1877],
  [30.0945, 31.4737],
  [30.9765, 31.5566],
  [31.6893, 31.4297],
  [31.88, 31.48],
  [31.86, 30.85],
  [31.88, 30.25],
  [31.98, 29.7],
  [32.18, 29.1],
  [32.55, 28.1],
  [33.15, 27.3],
  [33.82, 27.22],
  [34.05, 26.65],
  [34.1049, 26.1421],
  [34.4721, 25.5988],
  [34.7961, 25.0335],
  [35.6926, 23.9266],
  [35.4946, 23.7523],
  [35.527, 23.1023],
  [36.6898, 22.2053],
];

const EGYPT_SINAI: LngLat[] = [
  [32.78, 31.42],
  [32.9925, 31.0235],
  [33.7737, 30.9676],
  [34.2669, 31.2198],
  [34.8249, 29.7608],
  [34.9221, 29.5019],
  [34.6413, 29.099],
  [34.4253, 28.3442],
  [34.1553, 27.8229],
  [33.9213, 27.6485],
  [33.5865, 27.9718],
  [33.2, 28.45],
  [33.02, 28.95],
  [32.88, 29.5],
  [32.8, 30.2],
  [32.76, 30.9],
];

/**
 * 110m Panama, split on the isthmus. Gap ~0.55°; Panama City stays on
 * the Pacific east bank.
 */
const PANAMA_EAST: LngLat[] = [
  [-77.3522, 8.6699],
  [-77.4746, 8.5243],
  [-77.2442, 7.9353],
  [-77.4314, 7.6374],
  [-77.7518, 7.7102],
  [-77.8814, 7.2244],
  [-78.2162, 7.5122],
  [-78.4286, 8.0521],
  [-78.1838, 8.3195],
  [-78.4358, 8.3872],
  [-78.623, 8.7189],
  [-79.1198, 8.9965],
  [-79.45, 8.9],
  [-79.58, 8.94],
  [-79.42, 9.22],
  [-79.36, 9.5],
  [-79.0226, 9.5534],
  [-79.0586, 9.4552],
  [-78.5006, 9.4197],
  [-78.0542, 9.247],
  [-77.7302, 8.9474],
];

const PANAMA_WEST: LngLat[] = [
  [-79.98, 8.52],
  [-80.1638, 8.333],
  [-80.3834, 8.2992],
  [-80.4806, 8.091],
  [-80.0054, 7.5477],
  [-80.2754, 7.4191],
  [-80.4194, 7.2718],
  [-80.8874, 7.221],
  [-81.0602, 7.8185],
  [-81.1898, 7.6476],
  [-81.521, 7.7068],
  [-81.7226, 8.1096],
  [-82.133, 8.1756],
  [-82.3922, 8.2924],
  [-82.8206, 8.2907],
  [-82.8494, 8.0741],
  [-82.9646, 8.2247],
  [-82.9142, 8.4227],
  [-82.8314, 8.6259],
  [-82.8674, 8.807],
  [-82.7198, 8.9254],
  [-82.9286, 9.0744],
  [-82.9322, 9.4772],
  [-82.547, 9.5669],
  [-82.187, 9.2081],
  [-82.2086, 8.9948],
  [-81.809, 8.9508],
  [-81.7154, 9.0321],
  [-81.4382, 8.7866],
  [-80.9486, 8.8577],
  [-80.5202, 9.1116],
  [-80.08, 9.32],
  [-80.05, 9.45],
  [-80.02, 9.15],
  [-79.95, 8.85],
];

const CANAL_LAND: { iso: string; rings: LngLat[][] }[] = [
  { iso: "818", rings: [EGYPT_WEST, EGYPT_SINAI] },
  { iso: "591", rings: [PANAMA_EAST, PANAMA_WEST] },
];

function nearestVert(ring: Ring, lng: number, lat: number): number {
  const [tx, ty] = project(lng, lat);
  let best = 0,
    bestD = Infinity;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(ring[i]![0] - tx, ring[i]![1] - ty);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function replaceVert(
  ring: Ring,
  around: LngLat,
  chain: LngLat[],
) {
  const i = nearestVert(ring, around[0], around[1]);
  const pts: Point[] = chain.map(([lng, lat]) => project(lng, lat));
  ring.splice(i, 1, ...pts);
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
}

/** Notch Spain / Morocco / Turkey so Gibraltar and the Bosporus read as
 *  straight water, not a 110m pinch. */
function notchStraits<T extends { iso: string; polys: Polys }>(countries: T[]) {
  const turkey = countries.find((c) => c.iso === "792");
  if (turkey?.polys[0]?.[0] && turkey.polys[1]?.[0]) {
    replaceVert(turkey.polys[0][0], [29.2413, 41.2195], [
      [29.4, 40.98],
      [29.42, 41.42],
    ]);
    replaceVert(turkey.polys[1][0], [28.9893, 41.3007], [[28.64, 41.42]]);
    replaceVert(turkey.polys[1][0], [28.8057, 41.0553], [[28.64, 41.08]]);
  }
  const spain = countries.find((c) => c.iso === "724");
  if (spain?.polys[0]?.[0]) {
    replaceVert(spain.polys[0][0], [-5.3767, 35.9471], [[-5.4, 36.2]]);
    replaceVert(spain.polys[0][0], [-5.8663, 36.0301], [[-5.85, 36.2]]);
  }
  const morocco = countries.find((c) => c.iso === "504");
  if (morocco?.polys[0]?.[0]) {
    replaceVert(morocco.polys[0][0], [-5.9311, 35.7593], [[-5.9, 35.48]]);
    replaceVert(morocco.polys[0][0], [-5.1931, 35.7559], [[-5.25, 35.48]]);
  }
  const iran = countries.find((c) => c.iso === "364");
  if (iran?.polys[0]?.[0]) {
    replaceVert(iran.polys[0][0], [56.97, 26.97], [[56.9, 27.65]]);
    replaceVert(iran.polys[0][0], [56.49, 27.14], [[56.45, 27.72]]);
    replaceVert(iran.polys[0][0], [55.72, 26.96], [[55.7, 27.45]]);
  }
  const oman = countries.find((c) => c.iso === "512");
  if (oman) {
    for (const rings of oman.polys) {
      const outer = rings[0];
      if (!outer) continue;
      const c = ringCentroid(outer);
      const lng = c[0] * 360 - 180;
      const lat = latOf(c);
      if (lng < 55.5 || lng > 57.2 || lat < 25.3 || lat > 27) continue;
      const dny = 0.55 / (LAT_MAX - LAT_MIN);
      for (const ring of rings) {
        for (const p of ring) p[1] += dny;
      }
    }
  }
  const uae = countries.find((c) => c.iso === "784");
  if (uae?.polys[0]?.[0]) {
    replaceVert(uae.polys[0][0], [56.07, 26.06], [[55.85, 25.45]]);
    replaceVert(uae.polys[0][0], [56.26, 25.71], [[56.15, 25.35]]);
  }
}

/** Slide Great Britain (and Ireland with it, so the Irish Sea does not
 *  tear) north-west. Opens a water gap the 1° shipping grid and the
 *  Channel dashes can actually occupy. */
const CHANNEL_SHIFT_LNG = -0.9;
const CHANNEL_SHIFT_LAT = 1.45;

/** Southern Norway / Sweden, full amount. Fades out by 64°N so the
 *  Finnish and Russian borders stay put. */
const SKAGERRAK_SHIFT_LAT = 0.9;
const SKAGERRAK_FULL_LAT = 58;
const SKAGERRAK_ZERO_LAT = 64;
/** 110m Zealand (Copenhagen's island) — scale toward its centroid so
 *  both the Great Belt and the Øresund open. */
const ZEALAND_SCALE = 0.7;

function latOf(p: Point): number {
  return LAT_MAX - p[1] * (LAT_MAX - LAT_MIN);
}

function shiftIso<T extends { iso: string; polys: Polys }>(
  countries: T[],
  iso: string,
  dLng: number,
  dLat: number,
) {
  const country = countries.find((c) => c.iso === iso);
  if (!country) return;
  const dnx = dLng / 360;
  const dny = -dLat / (LAT_MAX - LAT_MIN);
  for (const rings of country.polys) {
    for (const ring of rings) {
      for (const p of ring) {
        p[0] += dnx;
        p[1] += dny;
      }
    }
  }
}

function shiftIsoNorthTapered<T extends { iso: string; polys: Polys }>(
  countries: T[],
  iso: string,
  dLat: number,
  latFull: number,
  latZero: number,
) {
  const country = countries.find((c) => c.iso === iso);
  if (!country) return;
  const span = LAT_MAX - LAT_MIN;
  const fade = Math.max(1e-6, latZero - latFull);
  for (const rings of country.polys) {
    const outer = rings[0];
    if (!outer) continue;
    /* Svalbard is already far north of the strait. */
    if (latOf(ringCentroid(outer)) > 74) continue;
    for (const ring of rings) {
      for (const p of ring) {
        const t = Math.max(0, Math.min(1, (latZero - latOf(p)) / fade));
        p[1] += (-dLat * t) / span;
      }
    }
  }
}

function shrinkZealand<T extends { iso: string; polys: Polys }>(
  countries: T[],
) {
  const denmark = countries.find((c) => c.iso === "208");
  if (!denmark) return;
  for (const rings of denmark.polys) {
    const outer = rings[0];
    if (!outer) continue;
    const c = ringCentroid(outer);
    const lng = c[0] * 360 - 180;
    const lat = latOf(c);
    if (lng < 10.6 || lat > 57) continue;
    for (const ring of rings) {
      for (const p of ring) {
        p[0] = c[0] + (p[0] - c[0]) * ZEALAND_SCALE;
        p[1] = c[1] + (p[1] - c[1]) * ZEALAND_SCALE;
      }
    }
  }
}

/** Replace Egypt / Panama; notch Bosporus and Gibraltar; widen the
 *  Channel and the Danish straits. */
export function punchCanalHoles<T extends { iso: string; polys: Polys }>(
  countries: T[],
): T[] {
  for (const spec of CANAL_LAND) {
    const country = countries.find((c) => c.iso === spec.iso);
    if (!country) continue;
    country.polys = toPolys(spec.rings);
  }
  notchStraits(countries);
  shiftIso(countries, "826", CHANNEL_SHIFT_LNG, CHANNEL_SHIFT_LAT);
  shiftIso(countries, "372", CHANNEL_SHIFT_LNG, CHANNEL_SHIFT_LAT);
  shrinkZealand(countries);
  shiftIsoNorthTapered(
    countries,
    "578",
    SKAGERRAK_SHIFT_LAT,
    SKAGERRAK_FULL_LAT,
    SKAGERRAK_ZERO_LAT,
  );
  shiftIsoNorthTapered(
    countries,
    "752",
    SKAGERRAK_SHIFT_LAT,
    SKAGERRAK_FULL_LAT,
    SKAGERRAK_ZERO_LAT,
  );
  return countries;
}
