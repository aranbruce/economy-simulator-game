"use client";

import { CURRENCY_META, lineChartSpec } from "../../lib/sim/engine.ts";
import { ChartBox, LineChartSvg } from "./LineChart.tsx";

const CCY_CODES = Object.keys(CURRENCY_META).sort();

/** Spread ~22 currencies around the hue wheel so adjacent lines are visually
 *  distinct without hand-picking a palette. */
function currencyLineColor(i: number, n: number): string {
  const hue = Math.round((360 * i) / Math.max(1, n));
  return `hsl(${hue}, 65%, 62%)`;
}

/** Every currency's real rate against `anchorCcy` — usually the player's
 *  chosen display currency, defaulting to their own — indexed to 100 at the
 *  start of the game. Raw rates span GBP's 1.27 to VND's 0.000039, so
 *  indexing is the only way to show them on one chart; the underlying data
 *  (row.ccyRates) is real USD-denominated values, not an abstract index —
 *  the indexing is purely a display necessity for putting wildly different
 *  face values on one axis. Every currency sits flat through the
 *  settle-phase run-up before your appointment (only the home nation is
 *  actually simulated pre-game, so there is no genuine relative movement to
 *  show yet — see settleOpeningEcon()); real movement begins at term start,
 *  same as the pre-existing single-currency strength index already did. */
export function CurrencyComparisonChart({
  G,
  anchorCcy,
}: {
  G: any;
  anchorCcy: string;
}) {
  const others = CCY_CODES.filter((c) => c !== anchorCcy);
  const log = G.log || [];
  const series = others.map((ccy, i) => {
    const data = log.map((r: any) =>
      r.ccyRates ? r.ccyRates[anchorCcy] / r.ccyRates[ccy] : 1,
    );
    const first = data[0] || 1;
    return {
      label: ccy,
      color: currencyLineColor(i, others.length),
      data: data.map((v: number) => (100 * v) / first),
    };
  });

  return (
    <ChartBox
      title={`${anchorCcy} against every currency`}
      caption={`Each currency's real rate against ${anchorCcy}, indexed to 100 at the start of your term — face values (GBP, JPY, VND…) differ by orders of magnitude, so this is the only way to show them on one chart. Above 100 means ${anchorCcy} buys more of that currency than it did at term start.`}
    >
      <LineChartSvg
        spec={lineChartSpec(series, { target: 100, targetLabel: "Term start" })}
        hideValueLabels
      />
    </ChartBox>
  );
}
