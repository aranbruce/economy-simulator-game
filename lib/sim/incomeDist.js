/**
 * Taxpaying income distribution: a shared calibration anchor reshaped per seat.
 * Thresholds and LABOUR_SHARE stay in game-£ units on this scale; seats differ
 * by inequality (NATION_PROFILE.soc0.gini), not by absolute wage levels.
 */
import { NATION_PROFILE } from "./nationProfiles.js";
import { resolveHomeRole } from "./countries.js";

/** Society-pin Gini that maps to an unchanged base table. */
export const BASE_DIST_GINI = 35;

/**
 * Twenty-three slices of the taxpaying population, gross annual income in
 * game pounds. Fitted so UK-scale thresholds bite; not a country label.
 * Body weights 0.05; top 5% is a Pareto tail.
 */
export const BASE_INCOME_DIST = [
  { w: 0.05, inc: 5000 },
  { w: 0.05, inc: 9000 },
  { w: 0.05, inc: 12000 },
  { w: 0.05, inc: 14500 },
  { w: 0.05, inc: 17000 },
  { w: 0.05, inc: 19500 },
  { w: 0.05, inc: 22000 },
  { w: 0.05, inc: 24500 },
  { w: 0.05, inc: 27000 },
  { w: 0.05, inc: 29500 },
  { w: 0.05, inc: 32000 },
  { w: 0.05, inc: 34500 },
  { w: 0.05, inc: 37500 },
  { w: 0.05, inc: 41000 },
  { w: 0.05, inc: 45000 },
  { w: 0.05, inc: 50000 },
  { w: 0.05, inc: 56000 },
  { w: 0.05, inc: 65000 },
  { w: 0.05, inc: 80000 },
  /* Pareto top 5%: without this a new top band raises nothing. */
  { w: 0.035, inc: 110000 },
  { w: 0.010, inc: 190000 },
  { w: 0.004, inc: 350000 },
  { w: 0.001, inc: 1200000 },
];

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** Population-weighted mean income. */
export function distMean(dist) {
  let m = 0;
  for (const s of dist) m += s.inc * s.w;
  return m;
}

/** Population-weighted median income (first slice where cum weight ≥ 0.5). */
export function distMedian(dist) {
  let cum = 0;
  for (const s of dist) {
    cum += s.w;
    if (cum >= 0.5) return s.inc;
  }
  return dist[dist.length - 1].inc;
}

/**
 * Pre-tax Gini of a discrete weighted distribution, scaled 0–100
 * (same formula as the engine's post-tax giniFromSlices).
 */
export function preTaxGini(dist) {
  let mean = 0, wSum = 0;
  for (const s of dist) {
    mean += s.inc * s.w;
    wSum += s.w;
  }
  mean /= Math.max(1e-9, wSum);
  if (mean <= 0) return BASE_DIST_GINI;
  let absDiff = 0;
  for (let i = 0; i < dist.length; i++) {
    for (let j = 0; j < dist.length; j++) {
      absDiff += dist[i].w * dist[j].w * Math.abs(dist[i].inc - dist[j].inc);
    }
  }
  return clamp((absDiff / (2 * mean * wSum * wSum)) * 100, 14, 68);
}

const BASE_MEAN = distMean(BASE_INCOME_DIST);
const BASE_MEDIAN = distMedian(BASE_INCOME_DIST);
const BASE_PRETAX_GINI = preTaxGini(BASE_INCOME_DIST);

function copyDist(dist) {
  return dist.map((s) => ({ w: s.w, inc: s.inc }));
}

/**
 * Power-stretch incomes around the base median, then restore mean.
 * p = 1 leaves shape unchanged (before mean restore, which is a no-op).
 */
function reshapeWithPower(p) {
  const out = BASE_INCOME_DIST.map((s) => {
    const rel = Math.max(1e-6, s.inc / BASE_MEDIAN);
    return { w: s.w, inc: BASE_MEDIAN * Math.pow(rel, p) };
  });
  const m = distMean(out);
  const scale = BASE_MEAN / Math.max(1e-9, m);
  for (const s of out) s.inc *= scale;
  return out;
}

/**
 * Build a mean-preserving distribution whose pre-tax Gini tracks targetGini
 * relative to BASE_DIST_GINI. Target 35 returns a copy of BASE_INCOME_DIST.
 * Damp keeps extreme profile pins (e.g. 55) from exploding top incomes / NAIRU.
 */
const GINI_STRETCH_DAMP = 0.45;

export function buildIncomeDist(targetGini) {
  const t = targetGini != null && isFinite(targetGini) ? targetGini : BASE_DIST_GINI;
  if (Math.abs(t - BASE_DIST_GINI) < 0.05) return copyDist(BASE_INCOME_DIST);

  const aim = clamp(
    BASE_PRETAX_GINI + GINI_STRETCH_DAMP * (t - BASE_DIST_GINI),
    18,
    55
  );
  if (Math.abs(aim - BASE_PRETAX_GINI) < 0.05) return copyDist(BASE_INCOME_DIST);

  let lo = 0.45, hi = 2.2;
  let best = copyDist(BASE_INCOME_DIST);
  let bestErr = Infinity;
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2;
    const cand = reshapeWithPower(mid);
    const g = preTaxGini(cand);
    const err = Math.abs(g - aim);
    if (err < bestErr) {
      bestErr = err;
      best = cand;
    }
    if (g < aim) lo = mid;
    else hi = mid;
  }
  return best;
}

/** Opening society gini pin for a playable seat (home / kingdom → 35). */
export function distGiniForRole(role) {
  const id = resolveHomeRole(role || "home");
  if (id === "home" || id === "kingdom") {
    const k = NATION_PROFILE.kingdom;
    return k && k.soc0 && k.soc0.gini != null ? k.soc0.gini : BASE_DIST_GINI;
  }
  const p = NATION_PROFILE[id];
  if (p && p.soc0 && p.soc0.gini != null) return p.soc0.gini;
  return BASE_DIST_GINI;
}

let _distByRole = {};

/** Cached seat distribution; fixed for the run once settled onto econ. */
export function incomeDistForRole(role) {
  const key = resolveHomeRole(role || "home");
  if (!_distByRole[key]) {
    _distByRole[key] = buildIncomeDist(distGiniForRole(key));
  }
  return _distByRole[key];
}

/**
 * Active table for yield / profile loops.
 * Backfills econ.incomeDist from gini0 if the field is absent — handles
 * MP hydrate from pre-dist snapshots and any incomplete econ bags.
 */
export function activeIncomeDist(econ) {
  if (!econ) return BASE_INCOME_DIST;
  if (!econ.incomeDist) {
    const g = econ.gini0 != null ? econ.gini0 : BASE_DIST_GINI;
    econ.incomeDist = buildIncomeDist(g);
  }
  return econ.incomeDist;
}

export function clearIncomeDistCache() {
  _distByRole = {};
}

export { BASE_MEAN, BASE_MEDIAN, BASE_PRETAX_GINI };
