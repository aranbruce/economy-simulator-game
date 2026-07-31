/**
 * Thirty-year (120-quarter) balance report across classic playstyles.
 *
 * Runs the deterministic projector (`simulate`) from a fresh `newGame()` under
 * each fixed law. Crisis thresholds match `checkCrises` even though sandbox
 * keeps the sim running. Prints year markers and a final grade table.
 *
 * Usage: node scripts/balance-30y.mjs
 */
import {
  newGame,
  getG,
  clone,
  simulate,
  approvalOf,
} from "../lib/sim/engine.ts";

const YEARS = 30;
const QUARTERS = YEARS * 4;
const MARKERS = [5, 10, 15, 20, 25, 30]; // years

/** Crisis flags mirroring checkCrises / election failure bands. */
function crisisFlags(row, end) {
  const flags = [];
  if (row.yield > 10 && row.debt > 118) flags.push("debt-crisis");
  if (row.inflation > 22) flags.push("inflation-crisis");
  if (row.approval < 20) flags.push("coup-risk");
  if (row.services < 30) flags.push("services-collapse");
  if (row.debt >= 380) flags.push("debt-clamp");
  if (end && end.econ && end.econ.atBound) flags.push("elb");
  return flags;
}

function firstCrisis(rows, end) {
  for (let i = 0; i < rows.length; i++) {
    const f = crisisFlags(rows[i], end).filter((x) =>
      ["debt-crisis", "inflation-crisis"].includes(x),
    );
    if (f.length) return { q: i + 1, year: ((i + 1) / 4).toFixed(1), flags: f };
  }
  return null;
}

function avg(arr, key, from = 0) {
  const slice = arr.slice(from);
  if (!slice.length) return NaN;
  return slice.reduce((s, r) => s + r[key], 0) / slice.length;
}

function annualGrowth(rows) {
  /* Quarterly growth is already annualised % in the model log. */
  return avg(rows, "growth");
}

function scorePlaystyle(rows, end) {
  const last = rows[rows.length - 1];
  const mid = rows[Math.floor(rows.length / 2) - 1] || last;
  const crisis = firstCrisis(rows, end);
  let s = 0;
  /* Steady growth near UK trend (~1–2%). */
  const g = annualGrowth(rows.slice(-40));
  s += g > 0.4 && g < 3.5 ? 2 : g > 0 ? 1 : 0;
  /* Debt not exploding: end debt < 140 and not still rocketing vs mid. */
  if (last.debt < 110) s += 2;
  else if (last.debt < 140) s += 1;
  else if (last.debt < 180) s += 0;
  else s -= 1;
  if (last.debt < mid.debt + 25) s += 1;
  /* Inflation near target over last decade. */
  const inf = avg(rows, "inflation", rows.length - 40);
  if (inf > 1 && inf < 4) s += 2;
  else if (inf > 0 && inf < 6) s += 1;
  else if (inf > 10) s -= 1;
  /* Services and politics still playable. */
  if (last.services > 45) s += 2;
  else if (last.services > 35) s += 1;
  else if (last.services < 30) s -= 1;
  if (last.approval > 40) s += 1;
  else if (last.approval < 25) s -= 1;
  if (crisis) s -= 3;
  const letter =
    s >= 8 ? "A" : s >= 6 ? "B" : s >= 4 ? "C" : s >= 2 ? "D" : "F";
  return { score: s, letter, crisis };
}

function mutBaseline(law) {
  /* Leave opening UK statute alone. */
  return law;
}

function mutLandValue(law) {
  law.taxes.landTax = { on: true, rate: 2.5 };
  law.taxes.corpTax.rate = 19;
  law.income.bands[0].rate = 18;
  law.income.bands[1].rate = 38;
  law.taxes.vat.rate = 18;
  law.policies.planning = true;
  law.policies.fiscalRule = true;
  return law;
}

function mutAusterity(law) {
  law.spend.health = 6.5;
  law.spend.education = 3.2;
  law.spend.infra = 1.2;
  law.spend.research = 0.3;
  law.spend.welfare = 10.5;
  law.spend.defence = 2.0;
  law.spend.justice = 1.4;
  law.spend.environment = 0.4;
  law.policies.fiscalRule = true;
  law.policies.winterMeans = true;
  law.income.uprate = false; /* fiscal drag */
  return law;
}

function mutUnfundedCuts(law) {
  law.income.bands[0].rate = 15;
  law.income.bands[1].rate = 30;
  law.income.bands[2].rate = 35;
  law.income.allowance = 18000;
  law.ni.empRate = 5;
  law.ni.erRate = 10;
  law.taxes.vat.rate = 15;
  law.taxes.corpTax.rate = 15;
  law.taxes.capGains.rate = 10;
  return law;
}

function mutClosedEconomy(law) {
  law.tariffSchedule.default = 25;
  law.policies.closeBorders = true;
  law.taxes.digitalTax.rate = 8;
  law.taxes.carbon.rate = 15;
  law.spend.defence = 4.0;
  law.spend.infra = 3.5;
  return law;
}

function mutGrowth(law) {
  law.policies.planning = true;
  law.policies.skills = true;
  law.policies.rnd = true;
  law.policies.openVisas = true;
  law.policies.nuclear = true;
  law.spend.infra = 4.0;
  law.spend.research = 1.5;
  law.spend.education = 5.0;
  law.taxes.corpTax.rate = 22;
  law.income.bands[0].rate = 22; /* fund the investment */
  law.taxes.vat.rate = 22;
  law.policies.fiscalRule = true;
  return law;
}

function mutSocialDem(law) {
  law.policies.childcare = true;
  law.policies.socialCare = true;
  law.policies.skills = true;
  law.policies.minWage = true;
  law.policies.waitingList = true;
  law.spend.health = 10.5;
  law.spend.education = 5.2;
  law.spend.welfare = 14.5;
  law.taxes.wealthTax = { on: true, rate: 1.0 };
  law.taxes.corpTax.rate = 28;
  law.income.bands[2].rate = 50;
  law.ni.erRate = 16;
  return law;
}

/** Pay for care/skills with tax — viable left programme without also
 *  jacking every spending line. */ function mutFundedSocial(law) {
  law.policies.childcare = true;
  law.policies.socialCare = true;
  law.policies.skills = true;
  law.policies.minWage = true;
  law.spend.health = 9.2;
  law.spend.education = 4.6;
  law.taxes.wealthTax = { on: true, rate: 1.5 };
  law.taxes.landTax = { on: true, rate: 1.2 };
  law.taxes.corpTax.rate = 28;
  law.taxes.vat.rate = 22;
  law.income.bands[0].rate = 22;
  law.income.bands[1].rate = 42;
  law.income.bands[2].rate = 50;
  law.ni.erRate = 16;
  return law;
}

function mutMildConsol(law) {
  law.spend.welfare = 12.5;
  law.spend.health = 8.2;
  law.income.uprate = false;
  law.taxes.vat.rate = 21;
  law.policies.fiscalRule = true;
  law.policies.skills = true;
  return law;
}

function mutSoftGrowth(law) {
  law.policies.planning = true;
  law.policies.skills = true;
  law.policies.rnd = true;
  law.spend.research = 1.0;
  law.spend.infra = 3.0;
  return law;
}

const PLAYSTYLES = [
  { id: "baseline", name: "Baseline (status quo)", mut: mutBaseline },
  { id: "mildConsol", name: "Mild consolidation", mut: mutMildConsol },
  { id: "landValue", name: "Land-value shift", mut: mutLandValue },
  { id: "austerity", name: "Austerity + fiscal drag", mut: mutAusterity },
  { id: "unfunded", name: "Unfunded tax cuts", mut: mutUnfundedCuts },
  { id: "closed", name: "Closed economy", mut: mutClosedEconomy },
  { id: "softGrowth", name: "Soft growth (supply)", mut: mutSoftGrowth },
  { id: "growth", name: "Growth investment", mut: mutGrowth },
  { id: "socialDem", name: "Social democracy", mut: mutSocialDem },
  { id: "fundedSocial", name: "Funded social dem", mut: mutFundedSocial },
];

function fmt(n, d = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

function snapshot(rows, year) {
  const i = year * 4 - 1;
  return rows[Math.min(i, rows.length - 1)];
}

function runOne(style) {
  newGame();
  const G = getG();
  const law = style.mut(clone(G.law));
  const { rows, end } = simulate(law, QUARTERS);
  const graded = scorePlaystyle(rows, end);
  return {
    style,
    rows,
    end,
    graded,
    approval: approvalOf(end.fac),
  };
}

function printReport(results) {
  console.log(
    `\n=== ${YEARS}-year (${QUARTERS}q) economic balance report ===\n`,
  );
  console.log(
    "Crisis thresholds: gilt yield >10% with debt >118%  |  CPI >22%  |  services <30 flagged\n",
  );

  for (const r of results) {
    const { style, rows, end, graded } = r;
    const last = rows[rows.length - 1];
    console.log(
      `── ${style.name}  [${style.id}]  grade ${graded.letter} (score ${graded.score}/10)`,
    );
    if (graded.crisis) {
      console.log(
        `   CRISIS at Q${graded.crisis.q} (~Y${graded.crisis.year}): ${graded.crisis.flags.join(", ")}`,
      );
    }
    console.log(
      "   Year | Growth | Infl | Unemp | Deficit | Debt | Yield | Svcs | Appr | Trend | NetX",
    );
    for (const y of MARKERS) {
      const s = snapshot(rows, y);
      const def = -s.balance;
      console.log(
        `   Y${String(y).padStart(2)}  | ${fmt(s.growth, 2).padStart(6)} | ${fmt(s.inflation).padStart(4)} | ${fmt(s.unemployment).padStart(5)} | ${fmt(def).padStart(7)} | ${fmt(s.debt, 0).padStart(4)} | ${fmt(s.yield).padStart(5)} | ${fmt(s.services, 0).padStart(4)} | ${fmt(s.approval, 0).padStart(4)} | ${fmt(s.trend, 2).padStart(5)} | ${fmt(s.netTrade, 2).padStart(5)}`,
      );
    }
    const g10 = annualGrowth(rows.slice(0, 40));
    const g30 = annualGrowth(rows.slice(-40));
    const flags = [...new Set(rows.flatMap((row) => crisisFlags(row, end)))];
    console.log(
      `   avg growth Y1–10 ${fmt(g10, 2)}%  |  Y21–30 ${fmt(g30, 2)}%  |  end gap ${fmt(last.gap, 2)}%  |  flags: ${flags.length ? flags.join(", ") : "none"}`,
    );
    console.log(
      `   end: debt ${fmt(last.debt, 0)}%  deficit ${fmt(-last.balance)}%  services ${fmt(last.services, 0)}  liberty ${fmt(end.econ.liberty, 0)}  gini ${fmt(end.econ.gini, 0)}  R ${fmt(end.econ.R, 1)}  KG ${fmt(end.econ.KG, 1)}\n`,
    );
  }

  console.log("── Summary ─────────────────────────────────────────────");
  console.log(
    "Playstyle            Grade  End debt  End def  Growth30  Svcs  Crisis",
  );
  for (const r of results) {
    const last = r.rows[r.rows.length - 1];
    const g30 = annualGrowth(r.rows.slice(-40));
    const crisis = r.graded.crisis ? `Y${r.graded.crisis.year}` : "—";
    console.log(
      `${r.style.name.padEnd(22)} ${r.graded.letter.padEnd(5)} ${fmt(last.debt, 0).padStart(8)} ${fmt(-last.balance).padStart(8)} ${fmt(g30, 2).padStart(9)} ${fmt(last.services, 0).padStart(5)}  ${crisis}`,
    );
  }

  /* Balance verdict heuristics. */
  const base = results.find((r) => r.style.id === "baseline");
  const unfunded = results.find((r) => r.style.id === "unfunded");
  const closed = results.find((r) => r.style.id === "closed");
  const austerity = results.find((r) => r.style.id === "austerity");
  const growth = results.find((r) => r.style.id === "growth");

  console.log("\n── Balance verdict ──────────────────────────────────────");
  const notes = [];
  if (base) {
    const last = base.rows[base.rows.length - 1];
    const g = annualGrowth(base.rows.slice(-40));
    if (last.debt > 160)
      notes.push(
        "Baseline debt drifts badly over 30y — status quo is not sustainable.",
      );
    else if (last.debt > 120)
      notes.push(
        "Baseline debt creeps up over 30y (mild fiscal squeeze needed).",
      );
    else if (last.debt < 70 && -last.balance < 0)
      notes.push(
        "Baseline over-consolidates — opening deficit may be too easy to grow out of.",
      );
    else
      notes.push(
        `Baseline stays manageable (debt ${fmt(last.debt, 0)}%, trend growth ~${fmt(g, 2)}%).`,
      );
    if (last.services < 40)
      notes.push(
        `Baumol/demography bite: services fall to ${fmt(last.services, 0)} on a fixed share.`,
      );
  }
  if (unfunded && unfunded.graded.crisis)
    notes.push(
      "Unfunded tax cuts hit a debt crisis — good: free lunch is punished.",
    );
  else if (unfunded && unfunded.rows[unfunded.rows.length - 1].debt > 160)
    notes.push(
      "Unfunded tax cuts wreck the books without a hard crisis flag — still clearly worse.",
    );
  else if (unfunded)
    notes.push(
      "WARNING: unfunded tax cuts do not blow up — Laffer/growth may be too generous.",
    );
  if (closed && closed.graded.crisis)
    notes.push("Closed economy ends in crisis — protectionism is costly.");
  else if (
    closed &&
    closed.rows[closed.rows.length - 1].debt >
      base.rows[base.rows.length - 1].debt + 20
  )
    notes.push(
      "Closed economy underperforms baseline on debt/growth as expected.",
    );
  if (austerity) {
    const last = austerity.rows[austerity.rows.length - 1];
    if (last.debt < base.rows[base.rows.length - 1].debt && last.services < 40)
      notes.push(
        `Austerity repairs debt (→${fmt(last.debt, 0)}%) but services collapse to ${fmt(last.services, 0)}.`,
      );
    else if (last.debt >= base.rows[base.rows.length - 1].debt)
      notes.push(
        "WARNING: austerity fails to improve debt vs baseline — multipliers/hysteresis may be harsh.",
      );
  }
  if (growth) {
    const gG = annualGrowth(growth.rows.slice(-40));
    const gB = annualGrowth(base.rows.slice(-40));
    if (gG > gB + 0.15)
      notes.push(
        `Growth strategy lifts late-period trend (${fmt(gG, 2)}% vs baseline ${fmt(gB, 2)}%).`,
      );
    else
      notes.push(
        "Growth strategy does not clearly beat baseline trend — investment levers may be weak.",
      );
    if (gG > 2.5)
      notes.push(
        "NOTE: heavy growth stack sustains >2.5% trend — may be generous vs UK history.",
      );
  }
  const soft = results.find((r) => r.style.id === "softGrowth");
  if (soft) {
    const gS = annualGrowth(soft.rows.slice(-40));
    notes.push(
      `Soft supply-side (planning/skills/R&D) ends near ${fmt(soft.rows[soft.rows.length - 1].debt, 0)}% debt with ~${fmt(gS, 2)}% late growth.`,
    );
  }
  const funded = results.find((r) => r.style.id === "fundedSocial");
  if (funded) {
    if (funded.graded.crisis || funded.rows[funded.rows.length - 1].debt > 200)
      notes.push(
        "WARNING: even a tax-funded social democracy struggles over 30y — progressive spend may be under-financed relative to cost.",
      );
    else
      notes.push(
        "Funded social democracy remains solvent — left play is viable if taxed.",
      );
  }
  const mild = results.find((r) => r.style.id === "mildConsol");
  if (mild && mild.rows[mild.rows.length - 1].debt < 80)
    notes.push(
      `Mild consolidation is the workhorse path (end debt ${fmt(mild.rows[mild.rows.length - 1].debt, 0)}%).`,
    );
  const grades = results.map((r) => r.graded.letter);
  const hasGood = grades.some((g) => g === "A" || g === "B");
  const hasBad = grades.some((g) => g === "D" || g === "F");
  if (hasGood && hasBad)
    notes.push(
      "Spread of outcomes is healthy: competent play grades well, reckless play fails.",
    );
  else if (!hasBad)
    notes.push(
      "WARNING: no playstyle really fails — difficulty may be too soft over 30y.",
    );
  else if (!hasGood)
    notes.push(
      "WARNING: nothing grades well — model may be too punishing / structurally broken.",
    );

  for (const n of notes) console.log(" • " + n);
  console.log("");
}

const results = PLAYSTYLES.map(runOne);
printReport(results);
