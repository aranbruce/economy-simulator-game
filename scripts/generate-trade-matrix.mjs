#!/usr/bin/env node
/**
 * Generate TRADE_MATRIX rows from regional trade baskets.
 * Run: node scripts/generate-trade-matrix.mjs
 *
 * Home row pins come from COUNTRIES[].tradeShare (single source of truth).
 * Other seats: REGION_WEIGHTS give inter-region shares; REGION_MEMBERS split
 * each region across its countries; INTRA_REGION_SHARE injects within-region
 * trade for multi-member regions.
 */
import { writeFileSync } from "fs";
import { format, resolveConfig } from "prettier";
import { COUNTRIES as COUNTRY_DEFS } from "../lib/sim/countries.js";

const OUT = "lib/sim/tradeMatrix.ts";

/** Country fractions inside each trade region (must sum to 1). */
const REGION_MEMBERS = {
  europe: {
    germany: 0.36,
    france: 0.18,
    netherlands: 0.16,
    italy: 0.12,
    spain: 0.1,
    poland: 0.08,
  },
  north_america: { united_states: 0.8, canada: 0.2 },
  china: { china: 1.0 },
  russia: { russia: 1.0 },
  india: { india: 1.0 },
  africa: { nigeria: 0.4, south_africa: 0.25, egypt: 0.2, kenya: 0.15 },
  latam: { brazil: 0.45, mexico: 0.3, argentina: 0.25 },
  pacific: { japan: 0.32, australia: 0.28, korea: 0.4 },
  asean: { indonesia: 0.55, vietnam: 0.45 },
  gulf: { saudi: 0.67, uae: 0.33 },
  anatolia: { turkey: 1.0 },
  kingdom: { kingdom: 1.0 },
};

/**
 * Inter-region export baskets by the seat's home region.
 * Values are relative weights before expansion into countries.
 */
const REGION_WEIGHTS = {
  home: {
    europe: 0.35,
    north_america: 0.21,
    china: 0.05,
    russia: 0.03,
    india: 0.035,
    africa: 0.04,
    latam: 0.035,
    pacific: 0.06,
    asean: 0.025,
    gulf: 0.045,
    anatolia: 0.015,
  },
  europe: {
    north_america: 0.18,
    china: 0.12,
    kingdom: 0.16,
    russia: 0.08,
    india: 0.055,
    africa: 0.035,
    latam: 0.045,
    pacific: 0.07,
    asean: 0.03,
    gulf: 0.12,
    anatolia: 0.04,
  },
  north_america: {
    europe: 0.16,
    china: 0.17,
    kingdom: 0.12,
    russia: 0.025,
    india: 0.07,
    africa: 0.035,
    latam: 0.18,
    pacific: 0.08,
    asean: 0.04,
    gulf: 0.11,
    anatolia: 0.02,
  },
  china: {
    europe: 0.12,
    north_america: 0.18,
    kingdom: 0.08,
    russia: 0.07,
    india: 0.11,
    africa: 0.05,
    latam: 0.07,
    pacific: 0.08,
    asean: 0.1,
    gulf: 0.08,
    anatolia: 0.03,
  },
  russia: {
    europe: 0.26,
    north_america: 0.07,
    china: 0.2,
    kingdom: 0.055,
    india: 0.055,
    africa: 0.04,
    latam: 0.035,
    pacific: 0.04,
    asean: 0.03,
    gulf: 0.12,
    anatolia: 0.06,
  },
  india: {
    europe: 0.12,
    north_america: 0.16,
    china: 0.14,
    kingdom: 0.07,
    russia: 0.025,
    africa: 0.09,
    latam: 0.035,
    pacific: 0.09,
    asean: 0.08,
    gulf: 0.13,
    anatolia: 0.03,
  },
  africa: {
    europe: 0.2,
    north_america: 0.11,
    china: 0.14,
    kingdom: 0.07,
    russia: 0.035,
    india: 0.09,
    latam: 0.035,
    pacific: 0.055,
    asean: 0.04,
    gulf: 0.12,
    anatolia: 0.03,
  },
  latam: {
    europe: 0.12,
    north_america: 0.3,
    china: 0.16,
    kingdom: 0.045,
    russia: 0.025,
    india: 0.045,
    africa: 0.045,
    pacific: 0.05,
    asean: 0.03,
    gulf: 0.09,
    anatolia: 0.02,
  },
  pacific: {
    europe: 0.09,
    north_america: 0.16,
    china: 0.26,
    kingdom: 0.1,
    russia: 0.02,
    india: 0.07,
    africa: 0.035,
    latam: 0.035,
    asean: 0.1,
    gulf: 0.09,
    anatolia: 0.02,
  },
  asean: {
    europe: 0.1,
    north_america: 0.14,
    china: 0.28,
    kingdom: 0.06,
    russia: 0.02,
    india: 0.1,
    africa: 0.04,
    latam: 0.04,
    pacific: 0.12,
    gulf: 0.08,
    anatolia: 0.02,
  },
  gulf: {
    europe: 0.16,
    north_america: 0.12,
    china: 0.18,
    kingdom: 0.07,
    russia: 0.035,
    india: 0.12,
    africa: 0.07,
    latam: 0.035,
    pacific: 0.055,
    asean: 0.04,
    anatolia: 0.04,
  },
  anatolia: {
    europe: 0.28,
    north_america: 0.1,
    china: 0.12,
    kingdom: 0.08,
    russia: 0.08,
    india: 0.06,
    africa: 0.05,
    latam: 0.03,
    pacific: 0.04,
    asean: 0.03,
    gulf: 0.13,
  },
};

/** Seat → trade region used for inter-region baskets and intra-region shares. */
const SEAT_REGION = {
  home: "home",
  germany: "europe",
  france: "europe",
  italy: "europe",
  spain: "europe",
  netherlands: "europe",
  poland: "europe",
  united_states: "north_america",
  canada: "north_america",
  china: "china",
  russia: "russia",
  india: "india",
  brazil: "latam",
  mexico: "latam",
  argentina: "latam",
  japan: "pacific",
  australia: "pacific",
  korea: "pacific",
  indonesia: "asean",
  vietnam: "asean",
  turkey: "anatolia",
  saudi: "gulf",
  uae: "gulf",
  nigeria: "africa",
  south_africa: "africa",
  egypt: "africa",
  kenya: "africa",
  kingdom: "home",
};

const SEATS = [
  "germany",
  "france",
  "italy",
  "spain",
  "netherlands",
  "poland",
  "united_states",
  "canada",
  "china",
  "russia",
  "india",
  "brazil",
  "mexico",
  "argentina",
  "japan",
  "korea",
  "australia",
  "indonesia",
  "vietnam",
  "turkey",
  "saudi",
  "uae",
  "nigeria",
  "south_africa",
  "egypt",
  "kenya",
  "kingdom",
];

/** Within-region share of named trade for multi-member regions. */
const INTRA_REGION_SHARE = {
  europe: 0.4,
  north_america: 0.28,
  latam: 0.22,
  pacific: 0.18,
  asean: 0.28,
  africa: 0.18,
  gulf: 0.22,
};

function expandRow(regionWeights) {
  const out = {};
  for (const [region, w] of Object.entries(regionWeights)) {
    const members = REGION_MEMBERS[region];
    if (!members) continue;
    for (const [cid, frac] of Object.entries(members)) {
      out[cid] = (out[cid] || 0) + w * frac;
    }
  }
  return out;
}

function regionOfSeat(seat) {
  return SEAT_REGION[seat] || null;
}

function injectIntraRegion(row, seat) {
  const region = regionOfSeat(seat);
  const membersMap = region && REGION_MEMBERS[region];
  const intraShare = region && INTRA_REGION_SHARE[region];
  if (!membersMap || !intraShare) return row;
  const members = Object.keys(membersMap).filter((id) => id !== seat);
  if (members.length === 0) return row;

  const external = { ...row };
  delete external[seat];
  for (const id of members) delete external[id];
  const extSum = Object.values(external).reduce((a, b) => a + b, 0);
  const extTarget = 0.96 - intraShare;

  const out = {};
  let memWeight = 0;
  for (const id of members) memWeight += membersMap[id];
  for (const id of members) {
    out[id] = memWeight > 0 ? (membersMap[id] / memWeight) * intraShare : 0;
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
for (const seat of ["home", ...SEATS]) {
  const regionKey = SEAT_REGION[seat] || "home";
  const regionRow = { ...(REGION_WEIGHTS[regionKey] || REGION_WEIGHTS.home) };
  if (
    seat !== "home" &&
    seat !== "kingdom" &&
    regionOfSeat(seat) === "europe"
  ) {
    regionRow.kingdom = (regionRow.kingdom || 0) + 0.02;
  }
  let row = expandRow(regionRow);
  if (seat === "home" || seat === "kingdom") {
    row = {};
    for (const c of COUNTRY_DEFS) {
      if (c.id === "kingdom") continue;
      if (c.tradeShare != null) row[c.id] = c.tradeShare;
    }
  } else if (INTRA_REGION_SHARE[regionOfSeat(seat)]) {
    row = injectIntraRegion(row, seat);
    row = normalizeRow(row, seat);
  } else {
    row = normalizeRow(row, seat);
  }
  TRADE_MATRIX[seat] = row;
}

let ts = `/**
 * Bilateral export weights by playable seat. Each row lists partners active when
 * you occupy that seat (excludes self; kingdom hidden when home). Named shares
 * sum to ~0.96; residual ~0.04 is rest-of-world.
 * Generated by scripts/generate-trade-matrix.mjs — re-run after matrix edits.
 */

export const TRADE_MATRIX: Record<string, Record<string, number>> = ${JSON.stringify(
  TRADE_MATRIX,
  null,
  2,
)
  .replace(/"([^"]+)":/g, "$1:")
  .replace(/"/g, '"')};

/** Resolve bilateral export weight for (home seat → partner). */
export function shareFor(
  homeRole: string | null | undefined,
  partnerId: string,
  fallback?: number | null,
) {
  const role = homeRole || "home";
  const row = TRADE_MATRIX[role] || TRADE_MATRIX.home;
  if (row && row[partnerId] != null) return row[partnerId];
  if (fallback != null) return fallback;
  return 0;
}

/** Percent label for UI, e.g. "18% of {C}'s trade". */
export function shareLabel(
  homeRole: string | null | undefined,
  partnerId: string,
  fallback?: number | null,
) {
  const s = shareFor(homeRole, partnerId, fallback);
  return Math.round(s * 100) + "% of {C}'s trade";
}

/**
 * Live share of home's export allocation going to \`partnerId\`, from
 * \`econ.bilateralX\`. Denominator is the full allocation (named partners +
 * rest-of-world), so the figure is "% of trade" — the same framing as
 * \`shareLabel\`, but driven by the simulated outcome rather than the
 * structural gravity weight.
 */
export function partnerTradeSharePct(
  bilat: Record<string, number> | null | undefined,
  partnerId: string,
): number | null {
  if (!bilat) return null;
  let total = 0;
  for (const k of Object.keys(bilat)) total += bilat[k] || 0;
  if (!(total > 1e-9)) return null;
  return (100 * (bilat[partnerId] || 0)) / total;
}
`;

/* Format on the way out, so re-running the generator never shows up as a
   formatting-only diff against the checked-in file. */
writeFileSync(
  OUT,
  await format(ts, { ...(await resolveConfig(OUT)), filepath: OUT }),
);
console.log("Wrote", OUT, "with", Object.keys(TRADE_MATRIX).length, "rows");
