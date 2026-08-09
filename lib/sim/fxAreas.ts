/**
 * Currency-area Taylor rules and FX vs USD numeraire.
 * Seats sharing NATION_PROFILE.currency share one policy rate and FX path.
 */
import { NATION_PROFILE } from "./nationProfiles.ts";

const PROFILES: Record<string, any> = NATION_PROFILE;

const PI_TARGET = 2.0;
const R_NEUTRAL_REAL = 1.0;
const TAYLOR_PI = 0.6;
const TAYLOR_Y = 0.3;
const TAYLOR_SMOOTH = 0.26;
const RATE_FLOOR = 0.1;
const FX_UIP = 0.03;
const FX_RISK = 0.055;
const FX_ADJ = 0.38;
const FX_CA = 0.15; // fractional appreciation per point of net-exports/potential
/* The current account is a multi-year phenomenon in practice — it's a small
   share of daily FX turnover next to capital flows — so it acts on a slow
   accumulator rather than the raw quarterly trade balance, the same
   partial-adjustment idiom FX_ADJ/T_ADJ already use elsewhere. Half-life
   ~11 quarters. */ const CA_ADJ = 0.06;
const WORLD_RATE_USD = 2.6; // fallback proxy only if no USD-area seat is present

/** Group seat ids by ISO currency code. */
function currencyAreas(seatIds: string[]) {
  const areas: Record<string, string[]> = {};
  for (const id of seatIds) {
    const p = PROFILES[id];
    const ccy = (p && p.currency) || "USD";
    if (!areas[ccy]) areas[ccy] = [];
    areas[ccy].push(id);
  }
  return areas;
}

interface StepCurrencyAreasOpts {
  playerId?: string;
  playerEcon?: any;
}

/**
 * Update area policy rates and per-seat FX vs USD.
 * @param bags - { [id]: { econ } } including player mirrored bag
 * @param opts - so player rate can lead their area
 */
export function stepCurrencyAreas(
  bags: Record<string, any>,
  seatIds: string[],
  opts?: StepCurrencyAreasOpts,
) {
  const o = opts || {};
  const areas = currencyAreas(seatIds);
  const areaRate: Record<string, number> = {};
  const areaFx: Record<string, number> = {};

  /* Pass 1: every area's own policy rate. Split out from the FX pass below
     so a non-USD area can react to *this quarter's* live US rate rather
     than a fixed proxy — which needs every area's rate already known,
     including USD's, before any area's FX target is computed. Object key
     order isn't something to lean on for that. */
  for (const ccy of Object.keys(areas)) {
    const members = areas[ccy];
    let infl = 0,
      gap = 0,
      n = 0;
    let leadRate = null;
    for (const id of members) {
      const econ =
        id === o.playerId && o.playerEcon
          ? o.playerEcon
          : bags[id] && bags[id].econ;
      if (!econ) continue;
      infl += econ.inflation != null ? econ.inflation : PI_TARGET;
      const pot = econ.potential || 100;
      const gdp = econ.gdp != null ? econ.gdp : 100;
      gap += (gdp / pot - 1) * 100;
      n++;
      if (id === o.playerId && econ.rate != null) leadRate = econ.rate;
    }
    if (!n) continue;
    infl /= n;
    gap /= n;
    const underlying = infl;
    const target =
      R_NEUTRAL_REAL +
      underlying +
      TAYLOR_PI * (underlying - PI_TARGET) +
      TAYLOR_Y * gap;
    let rate = leadRate != null ? leadRate : target;
    if (leadRate == null) {
      /* Pure area Taylor when player is not in this currency. */ rate =
        Math.max(RATE_FLOOR, Math.min(20, target));
    }
    areaRate[ccy] = rate;
  }

  const worldRateNow =
    areaRate.USD != null ? areaRate.USD : WORLD_RATE_USD;

  /* Pass 2: each area's FX target, now that worldRateNow is the actual
     dollar-area rate this quarter (falling back to the fixed proxy only if
     no USD-area seat exists in this run at all). */
  for (const ccy of Object.keys(areas)) {
    const rate = areaRate[ccy];
    if (rate == null) continue;
    const members = areas[ccy];
    let risk = 0,
      ca = 0,
      n = 0;
    for (const id of members) {
      const econ =
        id === o.playerId && o.playerEcon
          ? o.playerEcon
          : bags[id] && bags[id].econ;
      if (!econ) continue;
      risk += econ.riskPremium != null ? econ.riskPremium : 0;
      const pot = econ.potential || 100;
      const caNow = pot > 0 ? ((econ.X || 0) - (econ.M || 0)) / pot : 0;
      if (econ.caSmooth == null) econ.caSmooth = caNow;
      econ.caSmooth += (caNow - econ.caSmooth) * CA_ADJ;
      ca += econ.caSmooth;
      n++;
    }
    if (!n) continue;
    risk /= n;
    ca /= n;

    const uip =
      members.reduce((s, id) => {
        const p = PROFILES[id];
        return s + (p && p.fxUip != null ? p.fxUip : FX_UIP);
      }, 0) / members.length;
    const worldR = ccy === "USD" ? rate : worldRateNow;
    const fxTarget =
      ccy === "USD"
        ? 1
        : 1 + uip * (rate - worldR) - FX_RISK * risk + FX_CA * ca;
    areaFx[ccy] = fxTarget;
  }

  for (const id of seatIds) {
    const p = PROFILES[id];
    const ccy = (p && p.currency) || "USD";
    const econ =
      id === o.playerId && o.playerEcon
        ? o.playerEcon
        : bags[id] && bags[id].econ;
    if (!econ) continue;
    if (id !== o.playerId && areaRate[ccy] != null) {
      const cur = econ.rate != null ? econ.rate : areaRate[ccy];
      econ.rate = cur + (areaRate[ccy] - cur) * TAYLOR_SMOOTH;
    }
    const fxT = areaFx[ccy] != null ? areaFx[ccy] : 1;
    if (econ.fx == null) econ.fx = 1;
    if (econ.fx0 == null) econ.fx0 = econ.fx;
    /* Player keeps their own UIP in step(); mirror area FX onto AI seats only. */ if (
      id !== o.playerId
    ) {
      econ.fx += (fxT - econ.fx) * FX_ADJ;
    }
  }

  return { areaRate, areaFx };
}
