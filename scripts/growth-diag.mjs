/**
 * Long-horizon growth diagnostic.
 *
 * The calibrated suites run 20 quarters (test/sim.js trend bands) and 120
 * quarters (scripts/balance-30y.mjs). Live saves reach 600+. This walks a
 * fixed law far past that and decomposes trend growth into its four
 * accounting terms every quarter, so a runaway can be attributed to a
 * specific channel rather than guessed at:
 *
 *     g(Y*) = g(A) + alpha*g(K) + alpha_G*g(KG) + (1-alpha-alpha_G)*g(L)
 *
 * Steps `step()` directly with det = true, so the path is deterministic and
 * no events fire to overwrite the law under test.
 *
 * Usage: pnpm growth-diag [quarters]
 */
import {
  newGame,
  getG,
  aggregate,
  step,
  potentialGrowthParts,
} from "../lib/sim/engine.ts";

const QUARTERS = Number(process.argv[2]) || 700;
const EVERY = 20; // quarters between printed rows

/* Bands a plausible path stays inside. Trend sits near 1.3-1.5% and headline
   growth inside single digits, so these are loose enough that tripping one is
   a real divergence rather than an ordinary cycle. */
const SANE_TREND = 6;
const SANE_GROWTH = 12;

function fmt(n, d = 2, w = 7) {
  if (n == null || !Number.isFinite(n)) return "—".padStart(w);
  return n.toFixed(d).padStart(w);
}

function run() {
  newGame();
  const G = getG();
  const law = G.law;

  const rows = [];
  let firstTrendBreach = null;
  let firstGrowthBreach = null;
  let blewUp = null;

  /* Fields worth naming when one of them stops being a number: whichever goes
     first is the origin of the blow-up, and the rest are downstream. */
  const WATCH = [
    "gdp",
    "potential",
    "A",
    "K",
    "KG",
    "R",
    "I",
    "C",
    "L",
    "hCap",
    "inflation",
    "unemployment",
    "debt",
    "rate",
    "yield",
    "wageIndex",
    "quality0",
    "privateWealth",
    "housePrice",
    "popWork",
  ];

  for (let q = 1; q <= QUARTERS; q++) {
    const parts = potentialGrowthParts(law, aggregate(law), G.econ);
    const r = step(G, law, law, true);
    const e = G.econ;

    if (blewUp == null) {
      const bad = WATCH.filter((k) => e[k] != null && !Number.isFinite(e[k]));
      if (bad.length) blewUp = { q, fields: bad };
    }

    const row = {
      q,
      growth: r.growth,
      trend: parts ? parts.total : null,
      cA: parts ? parts.cA : null,
      cK: parts ? parts.cK : null,
      cKG: parts ? parts.cKG : null,
      cL: parts ? parts.cL : null,
      gdp: e.gdp,
      potential: e.potential,
      gap: (e.gdp / e.potential - 1) * 100,
      I: e.I,
      K: e.K,
      KG: e.KG,
      iOverK: (e.I / e.K) * 100,
      unemployment: e.unemployment,
      inflation: e.inflation,
      debt: e.debt,
    };
    rows.push(row);

    if (
      firstTrendBreach == null &&
      row.trend != null &&
      Math.abs(row.trend) > SANE_TREND
    )
      firstTrendBreach = row;
    if (
      firstGrowthBreach == null &&
      Number.isFinite(row.growth) &&
      Math.abs(row.growth) > SANE_GROWTH
    )
      firstGrowthBreach = row;
  }

  return { rows, firstTrendBreach, firstGrowthBreach, blewUp };
}

function report({ rows, firstTrendBreach, firstGrowthBreach, blewUp }) {
  console.log(
    `\n=== growth diagnostic: ${QUARTERS} quarters (${(QUARTERS / 4).toFixed(0)} years), default law ===\n`,
  );
  console.log(
    "Trend contributions are already weighted, so cA + cK + cKG + cL = trend.\n",
  );
  console.log(
    "     Q |  Growth |   Trend |      cA |      cK |     cKG |      cL |     gap |     I/K |       K |      KG |     GDP",
  );

  for (const r of rows) {
    if (r.q % EVERY !== 0 && r.q !== 1 && r.q !== rows.length) continue;
    console.log(
      `  ${String(r.q).padStart(4)} |${fmt(r.growth)} |${fmt(r.trend)} |${fmt(r.cA)} |${fmt(r.cK)} |${fmt(r.cKG)} |${fmt(r.cL)} |${fmt(r.gap)} |${fmt(r.iOverK)} |${fmt(r.K, 0)} |${fmt(r.KG, 0)} |${fmt(r.gdp, 0)}`,
    );
  }

  console.log("\n--- divergence ---");
  const say = (label, r) => {
    if (!r) {
      console.log(`  ${label}: none`);
      return;
    }
    console.log(
      `  ${label}: Q${r.q} (~Y${(r.q / 4).toFixed(1)})  growth ${fmt(r.growth).trim()}  trend ${fmt(r.trend).trim()}  [cA ${fmt(r.cA).trim()} cK ${fmt(r.cK).trim()} cKG ${fmt(r.cKG).trim()} cL ${fmt(r.cL).trim()}]`,
    );
  };
  say(`trend beyond ±${SANE_TREND}`, firstTrendBreach);
  say(`growth beyond ±${SANE_GROWTH}`, firstGrowthBreach);
  if (blewUp)
    console.log(
      `  left the reals at Q${blewUp.q} (~Y${(blewUp.q / 4).toFixed(1)}): ${blewUp.fields.join(", ")}`,
    );

  /* The quarters either side of the blow-up, where the cause is still legible. */
  if (blewUp) {
    console.log("\n--- run-up to the blow-up ---");
    const from = Math.max(0, blewUp.q - 8);
    for (const r of rows.slice(from, blewUp.q + 1)) {
      console.log(
        `  Q${String(r.q).padStart(4)} growth ${fmt(r.growth)} trend ${fmt(r.trend)} gap ${fmt(r.gap)} I ${fmt(r.I, 1)} K ${fmt(r.K, 0)} infl ${fmt(r.inflation)} unemp ${fmt(r.unemployment)}`,
      );
    }
  }

  const last =
    rows.filter((r) => Number.isFinite(r.gdp) && r.trend != null).pop() ||
    rows[rows.length - 1];
  console.log(`\n--- last finite quarter (Q${last.q}) ---`);
  console.log(
    `  growth ${fmt(last.growth).trim()}  trend ${fmt(last.trend).trim()}  gap ${fmt(last.gap).trim()}  unemployment ${fmt(last.unemployment).trim()}  inflation ${fmt(last.inflation).trim()}  debt ${fmt(last.debt, 0).trim()}`,
  );
  console.log(
    `  GDP ${fmt(last.gdp, 0).trim()}  potential ${fmt(last.potential, 0).trim()}  K ${fmt(last.K, 0).trim()}  KG ${fmt(last.KG, 0).trim()}  I ${fmt(last.I, 1).trim()}`,
  );

  /* Which term carries the trend at the end, as a share of the total. */
  const tot =
    Math.abs(last.cA) +
    Math.abs(last.cK) +
    Math.abs(last.cKG) +
    Math.abs(last.cL);
  if (tot > 0) {
    const pc = (v) => ((Math.abs(v) / tot) * 100).toFixed(0) + "%";
    console.log(
      `  trend carried by: A ${pc(last.cA)}  K ${pc(last.cK)}  KG ${pc(last.cKG)}  L ${pc(last.cL)}`,
    );
  }
  console.log("");
}

report(run());
