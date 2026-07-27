/**
 * Bilateral trade clearing for the symmetric multi-country macro.
 * Desired flows from gravity + import demand; RAS-style average so X≈M globally
 * with rest-of-world closing the residual.
 */
import { TRADE_MATRIX } from "./tradeMatrix.js";
import { NATION_PROFILE } from "./nationProfiles.js";

const GRAVITY_Y = 0.65;
const ELAST_X = 0.85;
const ELAST_M = 0.60;

/** Seat ids that have nation profiles (includes kingdom). */ export function worldSeatIds() {
  return Object.keys(NATION_PROFILE);
}

/** Trade-matrix row for a seat (kingdom uses home weights when absent). */ export function matrixRow(seatId) {
  if (TRADE_MATRIX[seatId]) return TRADE_MATRIX[seatId];
  if (seatId === "kingdom" && TRADE_MATRIX.home) return TRADE_MATRIX.home;
  return TRADE_MATRIX.home || {};
}

/**
 * @param {object} seats - { [id]: { y, shareX, shareM, gdp0, fx, fxPeer, tariff, access, relFac } }
 *   tariff[j] / access[j] optional per destination.
 * @returns {{ flows: { [i]: { [j]: number } }, totals: { [i]: { X: number, M: number } } }}
 */
export function clearBilateralTrade(seats) {
  const ids = Object.keys(seats);
  const desired = {};
  for (const i of ids) {
    desired[i] = {};
    const si = seats[i];
    const row = matrixRow(i);
    let named = 0;
    for (const j of ids) {
      if (j === i) continue;
      const w = row[j] != null ? row[j] : 0;
      named += w;
      const sj = seats[j];
      const yj = Math.max(0.4, (sj.y || 100) / 100);
      const tariff = si.tariff && si.tariff[j] != null ? si.tariff[j] : si.avgTariff != null ? si.avgTariff : 3;
      const access = si.access && si.access[j] != null ? si.access[j] : 0;
      const relFac = si.relFac && si.relFac[j] != null ? si.relFac[j] : 1;
      const fxRatio = (si.fx || 1) / Math.max(0.5, sj.fx || 1);
      const comp = (1 / fxRatio) * (1 + 3 / 100) / (1 + Math.max(0, tariff) / 100);
      const shareX = (si.shareX != null ? si.shareX : 30) / 100;
      const Xi = w * shareX * 100 * Math.pow(yj, GRAVITY_Y) * Math.pow(Math.max(0.4, comp), ELAST_X) * (1 + access / 200) * relFac;
      desired[i][j] = Xi;
    }
    const restW = Math.max(0, 1 - named);
    const shareX = (si.shareX != null ? si.shareX : 30) / 100;
    desired[i].rest = restW * shareX * 100 * Math.pow(0.9, ELAST_X);
  }

  /* Import demand scale per seat from domestic absorption proxy. */ const Mstar = {};
  for (const i of ids) {
    const si = seats[i];
    const shareM = (si.shareM != null ? si.shareM : 28) / 100;
    const y = si.y != null ? si.y : 100;
    Mstar[i] = shareM * y * Math.pow(1, -ELAST_M);
  }

  /* Average directed flows with reverse import claim so world roughly clears. */ const flows = {};
  for (const i of ids) {
    flows[i] = { rest: desired[i].rest || 0 };
    for (const j of ids) {
      if (j === i) continue;
      const xij = desired[i][j] || 0;
      const xji = desired[j] && desired[j][i] != null ? desired[j][i] : 0;
      /* Exporter i→j vs importer j's demand share of bilateral. */ const mjShare = Mstar[j] > 1e-9 ? Math.min(2, (Mstar[j] / 100) / Math.max(0.2, shareMOf(seats[j]))) : 1;
      const scaled = xij * (0.55 + 0.45 * Math.min(1.5, mjShare));
      flows[i][j] = 0.5 * scaled + 0.25 * xij + 0.25 * xji * 0.4;
    }
  }

  const totals = {};
  for (const i of ids) {
    let X = flows[i].rest || 0;
    let M = 0;
    for (const j of ids) {
      if (j === i) continue;
      X += flows[i][j] || 0;
      M += flows[j] && flows[j][i] != null ? flows[j][i] : 0;
    }
    totals[i] = { X, M };
  }
  return { flows, totals };
}

function shareMOf(s) {
  return (s && s.shareM != null ? s.shareM : 28) / 100;
}

/** Build seat snapshot map for clearing from world bags + player econ. */ export function seatsFromWorld(world, playerId, playerEcon, tariffFn, accessFn) {
  const seats = {};
  for (const id of worldSeatIds()) {
    let econ;
    if (id === playerId && playerEcon) econ = playerEcon;
    else if (world && world[id]) econ = world[id].econ;
    else continue;
    const p = NATION_PROFILE[id] || {};
    seats[id] = {
      y: econ.gdp != null ? econ.gdp : econ.y != null ? econ.y : 100,
      shareX: econ.shareX != null ? econ.shareX : p.shareX,
      shareM: econ.shareM != null ? econ.shareM : p.shareM,
      gdp0: p.gdp0,
      fx: econ.fx != null ? econ.fx : 1,
      avgTariff: 3,
      tariff: {},
      access: {},
      relFac: {},
    };
    for (const j of worldSeatIds()) {
      if (j === id) continue;
      if (typeof tariffFn === "function") seats[id].tariff[j] = tariffFn(id, j);
      if (typeof accessFn === "function") seats[id].access[j] = accessFn(id, j);
    }
  }
  return seats;
}
