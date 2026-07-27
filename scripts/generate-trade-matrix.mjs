#!/usr/bin/env node
/**
 * Generate TRADE_MATRIX rows from legacy bloc-level weights.
 * Run: node scripts/generate-trade-matrix.mjs
 * Home row pins come from COUNTRIES[].tradeShare (single source of truth).
 */
import { writeFileSync } from "fs";
import { COUNTRIES as COUNTRY_DEFS } from "../lib/sim/countries.js";

const SPLIT = {
  continental: {
    germany: 0.28, france: 0.17, netherlands: 0.14, italy: 0.12, spain: 0.12, poland: 0.17,
  },
  federated: { united_states: 0.80, canada: 0.20 },
  eastern: { china: 1.0 },
  northern: { russia: 1.0 },
  southern: { india: 1.0 },
  equatorial: { nigeria: 0.40, south_africa: 0.25, egypt: 0.20, kenya: 0.15 },
  andes: { brazil: 0.45, mexico: 0.30, argentina: 0.25 },
  commonwealth: { japan: 0.32, australia: 0.28, korea: 0.40 },
  asean: { indonesia: 0.55, vietnam: 0.45 },
  gulf: { saudi: 0.67, uae: 0.33 },
  anatolia: { turkey: 1.0 },
  kingdom: { kingdom: 1.0 },
};

const LEGACY = {
  home: {
    continental: 0.35, federated: 0.21, eastern: 0.11, northern: 0.03, southern: 0.035,
    equatorial: 0.04, andes: 0.035, commonwealth: 0.06, asean: 0.025, gulf: 0.045, anatolia: 0.015,
  },
  continental: {
    federated: 0.18, eastern: 0.12, kingdom: 0.16, northern: 0.08, southern: 0.055,
    equatorial: 0.035, andes: 0.045, commonwealth: 0.07, asean: 0.03, gulf: 0.12, anatolia: 0.04,
  },
  federated: {
    continental: 0.16, eastern: 0.18, kingdom: 0.07, northern: 0.025, southern: 0.07,
    equatorial: 0.035, andes: 0.18, commonwealth: 0.08, asean: 0.04, gulf: 0.11, anatolia: 0.02,
  },
  eastern: {
    continental: 0.14, federated: 0.20, kingdom: 0.05, northern: 0.07, southern: 0.14,
    equatorial: 0.05, andes: 0.07, commonwealth: 0.08, asean: 0.10, gulf: 0.08, anatolia: 0.03,
  },
  northern: {
    continental: 0.26, federated: 0.07, eastern: 0.20, kingdom: 0.055, southern: 0.055,
    equatorial: 0.04, andes: 0.035, commonwealth: 0.04, asean: 0.03, gulf: 0.12, anatolia: 0.06,
  },
  southern: {
    continental: 0.12, federated: 0.16, eastern: 0.14, kingdom: 0.07, northern: 0.025,
    equatorial: 0.09, andes: 0.035, commonwealth: 0.09, asean: 0.08, gulf: 0.13, anatolia: 0.03,
  },
  equatorial: {
    continental: 0.20, federated: 0.11, eastern: 0.14, kingdom: 0.07, northern: 0.035,
    southern: 0.09, andes: 0.035, commonwealth: 0.055, asean: 0.04, gulf: 0.12, anatolia: 0.03,
  },
  andes: {
    continental: 0.12, federated: 0.30, eastern: 0.16, kingdom: 0.045, northern: 0.025,
    southern: 0.045, equatorial: 0.045, commonwealth: 0.05, asean: 0.03, gulf: 0.09, anatolia: 0.02,
  },
  commonwealth: {
    continental: 0.09, federated: 0.16, eastern: 0.26, kingdom: 0.10, northern: 0.02,
    southern: 0.07, equatorial: 0.035, andes: 0.035, asean: 0.10, gulf: 0.09, anatolia: 0.02,
  },
  asean: {
    continental: 0.10, federated: 0.14, eastern: 0.28, kingdom: 0.06, northern: 0.02,
    southern: 0.10, equatorial: 0.04, andes: 0.04, commonwealth: 0.12, gulf: 0.08, anatolia: 0.02,
  },
  gulf: {
    continental: 0.16, federated: 0.12, eastern: 0.18, kingdom: 0.07, northern: 0.035,
    southern: 0.12, equatorial: 0.07, andes: 0.035, commonwealth: 0.055, asean: 0.04, anatolia: 0.04,
  },
  anatolia: {
    continental: 0.28, federated: 0.10, eastern: 0.12, kingdom: 0.08, northern: 0.08,
    southern: 0.06, equatorial: 0.05, andes: 0.03, commonwealth: 0.04, asean: 0.03, gulf: 0.13,
  },
};

const SEAT_FROM_LEGACY = {
  home: "home",
  germany: "continental",
  france: "continental",
  italy: "continental",
  spain: "continental",
  netherlands: "continental",
  poland: "continental",
  united_states: "federated",
  canada: "federated",
  china: "eastern",
  russia: "northern",
  india: "southern",
  brazil: "andes",
  mexico: "andes",
  argentina: "andes",
  japan: "commonwealth",
  australia: "commonwealth",
  korea: "commonwealth",
  indonesia: "asean",
  vietnam: "asean",
  turkey: "anatolia",
  saudi: "gulf",
  uae: "gulf",
  nigeria: "equatorial",
  south_africa: "equatorial",
  egypt: "equatorial",
  kenya: "equatorial",
  kingdom: "home",
};

const COUNTRIES = [
  "germany", "france", "italy", "spain", "netherlands", "poland",
  "united_states", "canada", "china", "russia", "india",
  "brazil", "mexico", "argentina", "japan", "korea", "australia",
  "indonesia", "vietnam", "turkey",
  "saudi", "uae", "nigeria", "south_africa", "egypt", "kenya", "kingdom",
];

function expandRow(legacyRow) {
  const out = {};
  for (const [bloc, w] of Object.entries(legacyRow)) {
    const split = SPLIT[bloc];
    if (!split) continue;
    for (const [cid, frac] of Object.entries(split)) {
      out[cid] = (out[cid] || 0) + w * frac;
    }
  }
  return out;
}

/** Intra-bloc share of named trade when occupying a seat in a multi-member split. */
const INTRA_BLOC_SHARE = {
  continental: 0.40,
  federated: 0.28,
  andes: 0.22,
  commonwealth: 0.18,
  asean: 0.28,
  equatorial: 0.18,
  gulf: 0.22,
};

function blocOfSeat(seat) {
  return SEAT_FROM_LEGACY[seat] || null;
}

function injectIntraBloc(row, seat) {
  const bloc = blocOfSeat(seat);
  const split = bloc && SPLIT[bloc];
  const intraShare = bloc && INTRA_BLOC_SHARE[bloc];
  if (!split || !intraShare) return row;
  const members = Object.keys(split).filter((id) => id !== seat);
  if (members.length === 0) return row;

  const external = { ...row };
  delete external[seat];
  for (const id of members) delete external[id];
  const extSum = Object.values(external).reduce((a, b) => a + b, 0);
  const extTarget = 0.96 - intraShare;

  const out = {};
  let memWeight = 0;
  for (const id of members) memWeight += split[id];
  for (const id of members) {
    out[id] = memWeight > 0 ? (split[id] / memWeight) * intraShare : 0;
  }
  for (const [k, v] of Object.entries(external)) {
    out[k] = extSum > 0 ? (v / extSum) * extTarget : 0;
  }
  return out;
}

function normalizeRow(row, excludeId) {
  const out = { ...row };
  delete out[excludeId];
  if (excludeId === "home") delete out.kingdom;
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum <= 0) return out;
  const target = 0.96;
  for (const k of Object.keys(out)) out[k] = (out[k] / sum) * target;
  return out;
}

const TRADE_MATRIX = {};
for (const seat of ["home", ...COUNTRIES]) {
  const legacyKey = SEAT_FROM_LEGACY[seat] || "home";
  const legacyRow = { ...(LEGACY[legacyKey] || LEGACY.home) };
  if (seat !== "home" && seat !== "kingdom" && blocOfSeat(seat) === "continental") {
    legacyRow.kingdom = (legacyRow.kingdom || 0) + 0.02;
  }
  let row = expandRow(legacyRow);
  if (seat === "home") {
    row = {};
    for (const c of COUNTRY_DEFS) {
      if (c.id === "kingdom") continue;
      if (c.tradeShare != null) row[c.id] = c.tradeShare;
    }
  } else if (seat === "kingdom") {
    row = normalizeRow(row, "kingdom");
  } else if (INTRA_BLOC_SHARE[blocOfSeat(seat)]) {
    row = injectIntraBloc(row, seat);
    row = normalizeRow(row, seat);
  } else {
    row = normalizeRow(row, seat);
  }
  TRADE_MATRIX[seat] = row;
}

let js = `/**
 * Bilateral export weights by playable seat. Each row lists partners active when
 * you occupy that seat (excludes self; kingdom hidden when home). Named shares
 * sum to ~0.96; residual ~0.04 is rest-of-world.
 * Generated by scripts/generate-trade-matrix.mjs — re-run after matrix edits.
 */

export const TRADE_MATRIX = ${JSON.stringify(TRADE_MATRIX, null, 2)
  .replace(/"([^"]+)":/g, "$1:")
  .replace(/"/g, '"')};

/** Resolve bilateral export weight for (home seat → partner). */
export function shareFor(homeRole, partnerId, fallback) {
  const role = homeRole || "home";
  const row = TRADE_MATRIX[role] || TRADE_MATRIX.home;
  if (row && row[partnerId] != null) return row[partnerId];
  if (fallback != null) return fallback;
  return 0;
}

/** Percent label for UI, e.g. "18% of {C}'s trade". */
export function shareLabel(homeRole, partnerId, fallback) {
  const s = shareFor(homeRole, partnerId, fallback);
  return Math.round(s * 100) + "% of {C}'s trade";
}
`;

writeFileSync("lib/sim/tradeMatrix.js", js);
console.log("Wrote lib/sim/tradeMatrix.js with", Object.keys(TRADE_MATRIX).length, "rows");
