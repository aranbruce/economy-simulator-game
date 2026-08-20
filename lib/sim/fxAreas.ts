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
      n = 0,
      wsum = 0;
    let leadRate = null;
    for (const id of members) {
      const econ =
        id === o.playerId && o.playerEcon
          ? o.playerEcon
          : bags[id] && bags[id].econ;
      if (!econ) continue;
      /* Weight the area aggregate by economy size, not by seat count. A union's
         central bank reads area-wide inflation and slack, in which the largest
         member dominates; a headcount average gave the Netherlands the same say
         as Germany and set a rate no large member's economy called for. Opening
         GDP is the weight — a live one would let a member that is spiralling
         progressively lose the vote that would correct it. */
      const p = PROFILES[id];
      const w = p && p.gdp0 > 0 ? p.gdp0 : 1;
      infl += (econ.inflation != null ? econ.inflation : PI_TARGET) * w;
      const pot = econ.potential || 100;
      const gdp = econ.gdp != null ? econ.gdp : 100;
      gap += (gdp / pot - 1) * 100 * w;
      wsum += w;
      n++;
      if (id === o.playerId && econ.rate != null) leadRate = econ.rate;
    }
    if (!n || wsum <= 0) continue;
    infl /= wsum;
    gap /= wsum;
    const underlying = infl;
    const target =
      R_NEUTRAL_REAL +
      underlying +
      TAYLOR_PI * (underlying - PI_TARGET) +
      TAYLOR_Y * gap;
    /* Smooth the *area's* rate, carried on its members as ccyAreaRate, rather
       than smoothing each member toward an unsmoothed target below. Each seat's
       own step() has already run a private Taylor rule on its own inflation and
       gap by the time we get here; crawling only TAYLOR_SMOOTH of the way to
       the area rate from there let the private rule out-pull the shared one, so
       a currency union drifted apart instead of converging — the five euro
       seats opened 0.96 points apart and were 2.66 apart by Q12. One smoothing
       pass, on one rate, which every member then takes verbatim. */
    let prevArea: number | null = null;
    for (const id of members) {
      const econ =
        id === o.playerId && o.playerEcon
          ? o.playerEcon
          : bags[id] && bags[id].econ;
      if (econ && econ.ccyAreaRate != null) {
        prevArea = econ.ccyAreaRate;
        break;
      }
    }
    if (prevArea == null) prevArea = target;
    const rate =
      leadRate != null
        ? leadRate
        : Math.max(
            RATE_FLOOR,
            Math.min(20, prevArea + (target - prevArea) * TAYLOR_SMOOTH),
          );
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
      /* Every seat's own step() (expenditureStep() in engine.ts) already
         smooths its own econ.caSmooth once per quarter via this same
         CA_ADJ blend — that runs for AI seats too, since stepCountry calls
         the full step(), not a stripped-down AI path. Re-blending it again
         here would apply the partial adjustment twice per quarter (roughly
         doubling the effective speed CA_ADJ's own "half-life ~11 quarters"
         comment promises), so just read the value each member's own step
         already produced; only fall back to this quarter's raw ratio if
         a seat has genuinely never been stepped yet. */
      const pot = econ.potential || 100;
      if (econ.caSmooth == null) {
        econ.caSmooth = pot > 0 ? ((econ.X || 0) - (econ.M || 0)) / pot : 0;
      }
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
    if (areaRate[ccy] != null) {
      /* Carried by every member (the player included, so the area keeps its
         history when the player is the one leading it) — see the smoothing
         note in pass 1. */
      econ.ccyAreaRate = areaRate[ccy];
      /* One rate per currency, taken verbatim: members of a union do not each
         hold their own policy rate. The player still sets their own in step(),
         and leads the area through leadRate. */
      if (id !== o.playerId) econ.rate = areaRate[ccy];
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
