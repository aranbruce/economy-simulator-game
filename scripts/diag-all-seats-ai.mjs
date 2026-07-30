/* 30-year AI fiscal rule run for every seat with a REALM_LAW overlay (+ UK home).
   Mirrors world-modes "all-ai" for the home seat. */
import { clearOpeningCache, newGame, getG, clone, step, applyAiFiscalRule } from "../lib/sim/engine.ts";
import { COUNTRIES } from "../lib/sim/countries.js";
import { REALM_LAW } from "../lib/sim/realmLaws.js";

const SEATS = [
  ["home", "826", "United Kingdom"],
  ...Object.keys(REALM_LAW).map((id) => {
    const c = COUNTRIES.find((x) => x.id === id);
    return [id, c?.iso || "000", c?.name || id];
  }),
];

console.log(`AI mode — ${SEATS.length} seats, 120 quarters\n`);
console.log("seat            | CAGR  trnd30 | u30  u*30 | dep30  dW% | inf30 rate | debt0->30 anch |  def30 | flags");

for (const [role, iso, name] of SEATS) {
  clearOpeningCache();
  newGame({ homeRole: role, homeIso: iso, country: name });
  const G = getG();
  const open = {
    u: G.econ.unemployment,
    dep: G.econ.dependency,
    popWork: G.econ.popWork,
    debt: G.econ.debt,
    gdp: G.econ.gdp,
  };
  for (let q = 0; q < 120; q++) {
    applyAiFiscalRule(G.law, G.econ);
    G.draft = clone(G.law);
    G.prevLaw = clone(G.law);
    step(G, G.law, G.prevLaw || G.law, true);
  }
  const e = G.econ;
  const cagr = (Math.pow(e.gdp / open.gdp, 1 / 30) - 1) * 100;
  const flags = [];
  if (e.debt >= 380) flags.push("debt-clamp");
  if (e.inflation < -1) flags.push("deflation");
  if (e.inflation > 10) flags.push("high-infl");
  if (Math.abs(e.unemployment - e.nairu) > 1.2) flags.push("u-drift");
  if (e.popWork / open.popWork < 0.82) flags.push("popWork");
  const def = e._lastDeficit != null ? e._lastDeficit : NaN;
  console.log(
    `${name.padEnd(15)} | ${cagr.toFixed(2).padStart(5)} ${e.trendGrowth.toFixed(2).padStart(6)} | ${e.unemployment.toFixed(1).padStart(4)} ${e.nairu.toFixed(1).padStart(4)} | ${e.dependency.toFixed(2).padStart(5)} ${((e.popWork / open.popWork - 1) * 100).toFixed(0).padStart(4)} | ${e.inflation.toFixed(1).padStart(5)} ${e.rate.toFixed(1).padStart(4)} | ${open.debt.toFixed(0).padStart(4)}->${e.debt.toFixed(0).padStart(4)} ${(e.debtAnchor ?? 80).toFixed(0).padStart(4)} | ${Number.isFinite(def) ? def.toFixed(1).padStart(6) : "     ?"} | ${flags.join(",") || "-"}`
  );
}
