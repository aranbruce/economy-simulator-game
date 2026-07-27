#!/usr/bin/env node
/**
 * Audit opening macros and trade weights for every playable seat.
 * Run: node scripts/calibrate-nations.mjs
 */
import { COUNTRIES } from "../lib/sim/countries.js";
import { NATION_PROFILE } from "../lib/sim/nationProfiles.js";
import {
  newGame,
  getG,
  balanceOf,
  potentialGrowth,
  aggregate,
  tradeRestShare,
  activePartners,
  clearOpeningCache,
} from "../lib/sim/engine.js";

clearOpeningCache();

const seats = [
  { role: "home", iso: "826", name: "The Kingdom" },
  ...COUNTRIES.filter((c) => c.id !== "kingdom").map((c) => ({
    role: c.id,
    iso: c.iso,
    name: c.name,
  })),
];

console.log("Seat calibration report\n");
let issues = 0;
for (const seat of seats) {
  newGame({ homeRole: seat.role, homeIso: seat.iso, country: seat.name });
  const G = getG();
  const prof = NATION_PROFILE[seat.role === "home" ? "kingdom" : seat.role];
  const def = -balanceOf(G.law, G.econ).balance;
  const pot = potentialGrowth(G.law, aggregate(G.law), G.econ);
  const rest = tradeRestShare(seat.role);
  const partners = activePartners(seat.role).length;
  const row = [
    seat.role.padEnd(14),
    `debt ${G.econ.debt.toFixed(0)} (pin ${prof.debt0})`,
    `def ${def.toFixed(1)} (pin ${prof.deficit0})`,
    `trend ${pot.toFixed(2)} (pin ${prof.trend})`,
    `rest ${(rest * 100).toFixed(1)}%`,
    `partners ${partners}`,
  ].join(" | ");
  console.log(row);
  if (Math.abs(def - prof.deficit0) > 1.5) issues++;
  if (Math.abs(pot - prof.trend) > 1.5) issues++;
  if (rest < 0.02 || rest > 0.08) issues++;
}

console.log(`\n${issues} seat(s) outside loose bands (def ±1.5pp, trend ±1.5pp, rest 2–8%).`);
process.exit(issues > 0 ? 1 : 0);
