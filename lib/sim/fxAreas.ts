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
const WORLD_RATE_USD = 2.6; // USD / numeraire short rate proxy

/** Group seat ids by ISO currency code. */
export function currencyAreas(seatIds: string[]) {
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

  for (const ccy of Object.keys(areas)) {
    const members = areas[ccy];
    let infl = 0,
      gap = 0,
      n = 0,
      risk = 0;
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
      risk += econ.riskPremium != null ? econ.riskPremium : 0;
      n++;
      if (id === o.playerId && econ.rate != null) leadRate = econ.rate;
    }
    if (!n) continue;
    infl /= n;
    gap /= n;
    risk /= n;
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

    const uip =
      members.reduce((s, id) => {
        const p = PROFILES[id];
        return s + (p && p.fxUip != null ? p.fxUip : FX_UIP);
      }, 0) / members.length;
    const worldR = ccy === "USD" ? rate : WORLD_RATE_USD;
    const fxTarget =
      ccy === "USD" ? 1 : 1 + uip * (rate - worldR) - FX_RISK * risk;
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
