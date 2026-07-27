/**
 * Slim ready-reckoner calibration — levels, marginals, multiplier ordering,
 * and structural channels. Fails if the model drifts beyond roughly a third.
 */
import {
  newGame,
  getG,
  balanceOf,
  clone,
  revenue,
  aggregate,
  incomeYield,
  simulate,
  step,
  impactOf,
} from "../lib/sim/engine.js";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}
function inBand(v, lo, hi, msg) {
  assert(v >= lo && v <= hi, `${msg} (got ${v.toFixed(2)}, want ${lo}–${hi})`);
}

newGame();
let G = getG();
const E = aggregate(G.law);
const rev = revenue(G.law, E, G.econ);
const def = -balanceOf(G.law, G.econ).balance;

inBand(def, 4.0, 5.5, "opening deficit near UK outturn");
inBand(rev.total, 38, 44, "opening receipts near UK share of GDP");
inBand(rev.inc.income, 8, 13, "income tax (labour+capital) level");
inBand(rev.inc.employee + rev.inc.employer, 4.5, 8.5, "NI combined level");
inBand(rev.by.vat || 0, 4.5, 7.5, "VAT level");
inBand(rev.by.corpTax || 0, 2.0, 4.5, "corporation tax level");

/* Marginal revenue per point — order of magnitude vs OBR/HMRC ready reckoners. */
function marg(mut) {
  newGame();
  G = getG();
  const base = revenue(G.law, aggregate(G.law), G.econ).total;
  const law = clone(G.law);
  mut(law);
  const next = revenue(law, aggregate(law), G.econ).total;
  return next - base;
}
const mBasic = marg((l) => {
  l.income.bands[0].rate += 1;
});
const mVat = marg((l) => {
  l.taxes.vat.rate += 1;
});
const mCorp = marg((l) => {
  l.taxes.corpTax.rate += 1;
});
inBand(mBasic, 0.18, 0.9, "basic-rate +1pp marginal receipts");
inBand(mVat, 0.15, 0.55, "VAT +1pp marginal receipts");
inBand(mCorp, 0.05, 0.35, "corp tax +1pp marginal receipts");

/* Employer NI raises structural unemployment (NAIRU), not just headline U. */
newGame();
G = getG();
{
  const baseN = G.econ.nairu;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  const baseAfter = G.econ.nairu;
  newGame();
  G = getG();
  G.law.ni.erRate = 20;
  G.draft.ni.erRate = 20;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  assert(
    G.econ.nairu > baseAfter + 0.15,
    `employer NI lift raises NAIRU (${baseAfter.toFixed(2)} → ${G.econ.nairu.toFixed(2)}; open ${baseN.toFixed(2)})`
  );
}

/* Fiscal multiplier ordering: purchases > transfers > broad income-tax cut.
   Peak output gap over six quarters is the right measure. */
function peakGap(mut) {
  newGame();
  G = getG();
  const law = clone(G.law);
  mut(law);
  const rows = simulate(law, 6).rows;
  return Math.max(...rows.map((r) => r.gap));
}
const gapG = peakGap((l) => {
  l.spend.health += 1;
});
const gapTr = peakGap((l) => {
  l.spend.welfare += 1;
});
const gapTax = peakGap((l) => {
  l.income.bands[0].rate -= 2;
});
assert(
  gapG > gapTr && gapTr > gapTax - 0.15,
  `multiplier ordering purchases (${gapG.toFixed(2)}) ≥ transfers (${gapTr.toFixed(2)}) ≥ tax cut (${gapTax.toFixed(2)})`
);

/* Dual capital rate is a real lever. */
newGame();
G = getG();
{
  const dual = clone(G.law);
  dual.regime = "dual";
  dual.income.capitalRate = 15;
  const a = incomeYield(dual, aggregate(dual), G.econ).capital;
  dual.income.capitalRate = 35;
  const b = incomeYield(dual, aggregate(dual), G.econ).capital;
  assert(b > a * 1.4, `dual capitalRate scales capital yield (${a.toFixed(2)} → ${b.toFixed(2)})`);
}

/* Incidence: equal-receipt shocks — transfers / allowance beat basic-rate cut
   beat additional-rate cut on cumulative demand growth. */
function cumGrowth(mut) {
  newGame();
  G = getG();
  const law = clone(G.law);
  mut(law);
  return impactOf(law, simulate(G.law, 4), 4).head.growth;
}
{
  const gAllow = cumGrowth((l) => {
    l.income.allowance += 2000;
  });
  const gBasic = cumGrowth((l) => {
    l.income.bands[0].rate -= 2;
  });
  const gAdd = cumGrowth((l) => {
    const top = l.income.bands[l.income.bands.length - 1];
    top.rate = Math.max(0, top.rate - 5);
  });
  const gWel = cumGrowth((l) => {
    l.spend.welfare += 0.8;
  });
  assert(
    gWel > gAdd - 0.05,
    `welfare demand ≥ additional-rate cut (${gWel.toFixed(3)} vs ${gAdd.toFixed(3)})`
  );
  assert(
    gAllow > gAdd - 0.05,
    `allowance demand ≥ additional-rate cut (${gAllow.toFixed(3)} vs ${gAdd.toFixed(3)})`
  );
  assert(
    gBasic > gAdd - 0.08,
    `basic-rate cut demand ≥ additional-rate cut (${gBasic.toFixed(3)} vs ${gAdd.toFixed(3)})`
  );
  assert(gAdd < 0.15, `additional-rate cut stays weak on demand (${gAdd.toFixed(3)})`);
}

if (failed) {
  console.error(`\n${failed} calibration check(s) failed`);
  process.exit(1);
}
console.log("\nAll calibration checks passed.");
