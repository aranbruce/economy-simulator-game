/**
 * Two 30-year world realism checks:
 *   all-ai    — every seat (including the home player) runs applyAiFiscalRule
 *   all-human — every seat keeps its opening statute frozen (no AI fiscal rule)
 *
 * Usage: node scripts/world-modes-30y.mjs
 */
import {
  clearOpeningCache,
  newGame,
  getG,
  step,
  clone,
  applyAiFiscalRule,
  NATION_PROFILE,
  playerCountryId,
} from "../lib/sim/engine.ts";

const YEARS = 30;
const QUARTERS = YEARS * 4;

const SEATS = [
  "kingdom",
  "germany",
  "france",
  "italy",
  "spain",
  "netherlands",
  "united_states",
  "china",
  "japan",
  "india",
  "brazil",
  "australia",
  "russia",
  "saudi",
];

function bag(G, id) {
  const playerId = playerCountryId(G.homeRole);
  if (
    id === playerId ||
    (id === "kingdom" && (G.homeRole === "home" || G.homeRole === "kingdom"))
  ) {
    return { econ: G.econ, law: G.law, isPlayer: true };
  }
  const w = G.world[id];
  if (!w) return null;
  return { econ: w.econ, law: w.law, isPlayer: false };
}

function rowFor(G, id) {
  const b = bag(G, id);
  if (!b) return null;
  const e = b.econ;
  const spend = Object.values(b.law.spend || {}).reduce((a, v) => a + v, 0);
  const anchor =
    e.debtAnchor != null ? e.debtAnchor : NATION_PROFILE[id]?.debt0;
  return {
    id,
    gdp: +e.gdp.toFixed(1),
    cagr: +((Math.pow(e.gdp / 100, 1 / YEARS) - 1) * 100).toFixed(2),
    debt: +e.debt.toFixed(1),
    anchor: anchor != null ? +anchor.toFixed(0) : null,
    def: +(e._lastDeficit != null ? e._lastDeficit : NaN).toFixed(2),
    spend: +spend.toFixed(1),
    vat: b.law.taxes?.vat?.on ? +b.law.taxes.vat.rate.toFixed(1) : 0,
    u: +e.unemployment.toFixed(1),
    infl: +e.inflation.toFixed(1),
    trend: +(e.trendGrowth || 0).toFixed(2),
    services: +(e.services || 0).toFixed(0),
    liberty: +(e.liberty || 0).toFixed(0),
    crime: +(e.crime || 0).toFixed(0),
    health: +(e.health || 0).toFixed(0),
    env: +(e.env || 0).toFixed(0),
    open: +(e.openness || 0).toFixed(0),
    gini: +(e.gini || 0).toFixed(0),
    services0: e.services0,
    liberty0: e.liberty0,
    crime0: e.crime0,
  };
}

function runMode(mode) {
  clearOpeningCache();
  newGame();
  const G = getG();
  G.disableAiFiscal = mode === "all-human";

  for (let q = 0; q < QUARTERS; q++) {
    if (mode === "all-ai") {
      /* Home seat is normally the human chancellor; drive it with the same
         automatic fiscal rule the AI partners use. */ applyAiFiscalRule(
        G.law,
        G.econ,
      );
      G.draft = clone(G.law);
      G.prevLaw = clone(G.law);
    } else {
      G.draft = clone(G.law);
    }
    step(G, G.law, G.prevLaw || G.law, true);
  }

  return SEATS.map((id) => rowFor(G, id)).filter(Boolean);
}

function printTable(title, rows) {
  console.log(`\n══ ${title} ══════════════════════════════════════════`);
  console.log(
    "Seat".padEnd(14),
    "CAGR".padStart(6),
    "Debt".padStart(7),
    "Anchor".padStart(7),
    "Def".padStart(7),
    "Spend".padStart(7),
    "VAT".padStart(5),
    "U".padStart(5),
    "Infl".padStart(5),
    "Trend".padStart(6),
  );
  for (const r of rows) {
    console.log(
      r.id.padEnd(14),
      r.cagr.toFixed(2).padStart(6),
      (r.debt.toFixed(0) + "%").padStart(7),
      (r.anchor != null ? r.anchor + "%" : "—").padStart(7),
      (r.def.toFixed(1) + "%").padStart(7),
      r.spend.toFixed(1).padStart(7),
      r.vat.toFixed(0).padStart(5),
      r.u.toFixed(1).padStart(5),
      r.infl.toFixed(1).padStart(5),
      r.trend.toFixed(2).padStart(6),
    );
  }
  console.log(
    "Seat".padEnd(14),
    "Svc".padStart(5),
    "Lib".padStart(5),
    "Cri".padStart(5),
    "Hlt".padStart(5),
    "Env".padStart(5),
    "Open".padStart(5),
    "Gini".padStart(5),
    "  (vs soc0 svc/lib/cri)",
  );
  for (const r of rows) {
    const pin =
      r.services0 != null ? `  (${r.services0}/${r.liberty0}/${r.crime0})` : "";
    console.log(
      r.id.padEnd(14),
      String(r.services).padStart(5),
      String(r.liberty).padStart(5),
      String(r.crime).padStart(5),
      String(r.health).padStart(5),
      String(r.env).padStart(5),
      String(r.open).padStart(5),
      String(r.gini).padStart(5),
      pin,
    );
  }
}

function realismNotes(allAi, allHuman) {
  console.log("\n── Realism notes ─────────────────────────────────────");
  const by = (rows, id) => rows.find((r) => r.id === id);

  const deAi = by(allAi, "germany");
  const deHu = by(allHuman, "germany");
  console.log(
    ` • Germany: all-AI debt ${deAi.debt.toFixed(0)}% / def ${deAi.def.toFixed(1)}% vs all-human ${deHu.debt.toFixed(0)}% / ${deHu.def.toFixed(1)}% — human freeze lets the surplus compound.`,
  );

  const jpAi = by(allAi, "japan");
  const jpHu = by(allHuman, "japan");
  console.log(
    ` • Japan: all-AI debt ${jpAi.debt.toFixed(0)}% (anchor ${jpAi.anchor}%) CAGR ${jpAi.cagr}%; all-human ${jpHu.debt.toFixed(0)}% CAGR ${jpHu.cagr}%.`,
  );

  const hotAi = allAi
    .filter((r) => r.cagr > 3.5)
    .map((r) => `${r.id} ${r.cagr}%`);
  const hotHu = allHuman
    .filter((r) => r.cagr > 3.5)
    .map((r) => `${r.id} ${r.cagr}%`);
  if (hotAi.length)
    console.log(
      ` • All-AI CAGR >3.5%: ${hotAi.join(", ") || "none"} (catch-up seats OK).`,
    );
  if (hotHu.length)
    console.log(` • All-human CAGR >3.5%: ${hotHu.join(", ")}.`);

  const creditorHu = allHuman.filter((r) => r.debt < -30);
  const creditorAi = allAi.filter((r) => r.debt < -30);
  console.log(
    ` • Deep creditors (debt < −30%): all-AI ${creditorAi.map((r) => r.id).join(", ") || "none"}; all-human ${creditorHu.map((r) => r.id).join(", ") || "none"}.`,
  );

  /* Debt far above anchor means different things in the two modes, so report
     them differently. In all-AI the debt rule is running and failing to hold
     the seat, which is an alarm. In all-human nothing is steering at all —
     the mode freezes every statute for thirty years — so a seat running to the
     clamp has only shown it cannot carry its inheritance passively. That is
     worth knowing (a small open economy inside a currency union, with no rate
     and no devaluation of its own, is exactly the profile that cannot), but it
     is information rather than a fault: reported plainly, and named as such,
     so it is not read as the same signal as the all-AI list. */
  const blowAi = allAi.filter((r) => r.debt > (r.anchor || 80) + 60);
  const blowHu = allHuman.filter((r) => r.debt > (r.anchor || 80) + 60);
  console.log(
    ` • Debt > anchor+60 with the fiscal rule running: ${blowAi.map((r) => r.id).join(", ") || "none"}.`,
  );
  console.log(
    ` • Cannot survive passivity (frozen 30y, no fiscal response): ${blowHu.map((r) => r.id).join(", ") || "none"}.`,
  );
}

const allAi = runMode("all-ai");
const allHuman = runMode("all-human");
printTable("ALL AI — every seat runs the debt-band fiscal rule (30y)", allAi);
printTable("ALL HUMAN — every seat frozen at opening statute (30y)", allHuman);
realismNotes(allAi, allHuman);
console.log("");
