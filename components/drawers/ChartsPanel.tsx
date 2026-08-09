"use client";

import {
  COL,
  FACTIONS,
  currencyForSeat,
  fmt,
  lineChartSpec,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { Hint } from "../ui/Typography.tsx";
import {
  ChartBox,
  LineChartSvg,
  type ChartSeriesInput,
} from "../ui/LineChart.tsx";
import { CurrencyComparisonChart } from "../ui/CurrencyChart.tsx";

export function ChartsPanel() {
  const G = useGame();
  const { pref } = useCurrencyPref();

  if (G.log.length < 2) {
    return (
      <div className="p-4 text-[12.5px] text-ink-faint">
        Deliver a bill or two. The charts need at least two quarters of data.
      </div>
    );
  }

  const col = (k: string) => G.log.map((r: any) => r[k]);
  const preN = G.log.filter((r: any) => r.pre).length;
  const tr = G.econ.trendGrowth;
  const gapPts = G.econ.potential
    ? (G.econ.gdp / G.econ.potential - 1) * 100
    : 0;
  const fxCode = currencyForSeat(G.homeRole);
  const anchorCcy = pref.display || fxCode;
  const facColors = [COL.blue, COL.ox, COL.brass, COL.plum, COL.green, COL.ink];

  return (
    <>
      {preN ? (
        <Hint>Includes the {preN}-quarter run-up before your appointment.</Hint>
      ) : null}
      <ChartBox
        title="Output against potential"
        caption={`Index, 100 at the start of your term. The gap is cyclical pressure on prices. Trend (top bar) is how fast potential itself expands — currently ${tr != null ? tr.toFixed(2) : "—"}% a year; gap ${fmt(gapPts, 1)} pts.`}
      >
        <LineChartSvg
          spec={lineChartSpec([
            {
              label: "Actual output",
              color: COL.ink,
              data: col("gdp"),
              wide: true,
            },
            {
              label: "Potential",
              color: COL.soft,
              data: col("potential"),
              dash: true,
            },
          ])}
        />
      </ChartBox>
      <CurrencyComparisonChart G={G} anchorCcy={anchorCcy} />
      <div className="grid grid-cols-2 gap-2 max-[800px]:grid-cols-1">
        <ChartBox
          noMargin
          title="Inflation and Bank rate"
          caption={
            G.rateManual
              ? "Base rate is pinned by you. Inflation still answers to the gap and expectations."
              : "You set fiscal policy. The Bank answers with the rate."
          }
        >
          <LineChartSvg
            spec={lineChartSpec(
              [
                {
                  label: "Inflation",
                  color: COL.ox,
                  data: col("inflation"),
                  wide: true,
                },
                { label: "Bank rate", color: COL.blue, data: col("rate") },
              ],
              { target: 2, targetLabel: "Target" },
            )}
          />
        </ChartBox>
        <ChartBox
          noMargin
          title="Unemployment"
          caption="Okun's relationship: output above trend pulls people into work."
        >
          <LineChartSvg
            spec={lineChartSpec([
              {
                label: "Unemployment",
                color: COL.plum,
                data: col("unemployment"),
                wide: true,
              },
            ])}
          />
        </ChartBox>
        <ChartBox
          noMargin
          title="Debt"
          caption="Per cent of GDP. Interest compounds whether you are looking or not."
        >
          <LineChartSvg
            spec={lineChartSpec([
              {
                label: "Debt",
                color: COL.ink,
                data: col("debt"),
                wide: true,
              },
            ])}
          />
        </ChartBox>
        <ChartBox
          noMargin
          title="Gilt yield"
          caption={`What the market charges ${G.country} to borrow.`}
        >
          <LineChartSvg
            spec={lineChartSpec([
              {
                label: "Yield",
                color: COL.ox,
                data: col("yield"),
                wide: true,
              },
            ])}
          />
        </ChartBox>
      </div>
      <ChartBox
        title="Approval by faction"
        caption="The overall number hides everything interesting."
      >
        <LineChartSvg
          spec={lineChartSpec(
            FACTIONS.map((f: any, i: number): ChartSeriesInput => ({
              label: f.name,
              color: facColors[i],
              data: G.log.map((r: any) => r.fac[f.id]),
            })).concat([
              {
                label: "Overall",
                color: COL.soft,
                data: col("approval"),
                wide: true,
                dash: true,
              },
            ]),
          )}
        />
      </ChartBox>
      <ChartBox
        title="The personal allowance in real terms"
        caption="Deflated by CPI and indexed to this seat's opening allowance. Uprate holds the line; Freeze lets inflation raise taxes without a vote."
      >
        <LineChartSvg
          spec={lineChartSpec(
            [
              {
                label: "Real value of the allowance",
                color: COL.brass,
                data: G.log.map((r: any) => r.drag * 100),
                wide: true,
              },
            ],
            { target: 100, targetLabel: "Where it started" },
          )}
        />
      </ChartBox>
      <ChartBox
        title="Capital stock and the cost of capital"
        caption="Investment accumulates into the capital stock, which is an argument of potential output. Corporation tax and the policy rate move the user cost, and the user cost moves desired capital."
      >
        <LineChartSvg
          spec={lineChartSpec([
            {
              label: "Capital stock",
              color: COL.blue,
              data: col("K"),
              wide: true,
            },
          ])}
        />
      </ChartBox>
      <ChartBox
        title="Trend growth"
        caption={`Annualised potential growth — the long-run score from TFP, capital and labour. Not outturn GDP. Latest ${tr != null ? tr.toFixed(2) : "—"}% a year.`}
      >
        <LineChartSvg
          spec={lineChartSpec([
            {
              label: "Trend growth %",
              color: COL.green,
              data: col("trend"),
              wide: true,
            },
            {
              label: "User cost of capital",
              color: COL.brass,
              data: col("userCost"),
            },
          ])}
        />
      </ChartBox>
      <ChartBox
        title="Where output comes from"
        caption="The national accounts identity. Output is not a growth rate the model invents: it is the sum of these, less imports."
      >
        <LineChartSvg
          spec={lineChartSpec([
            {
              label: "Consumption",
              color: COL.blue,
              data: col("C"),
              wide: true,
            },
            {
              label: "Government",
              color: COL.green,
              data: col("Gov"),
              wide: true,
            },
            { label: "Investment", color: COL.plum, data: col("I") },
            { label: "Exports", color: COL.brass, data: col("X") },
            { label: "Imports", color: COL.ox, data: col("M") },
          ])}
        />
      </ChartBox>
      <ChartBox
        title="Net trade"
        caption="Exports less imports, in index points. Competitiveness runs on underlying prices, so a VAT change does not move it."
      >
        <LineChartSvg
          spec={lineChartSpec(
            [
              {
                label: "Net trade",
                color: COL.ox,
                data: col("netTrade"),
                wide: true,
              },
            ],
            { zero: true },
          )}
        />
      </ChartBox>
      <ChartBox
        title="Receipts and spending"
        caption="Points of GDP. The distance between the lines is the deficit."
      >
        <LineChartSvg
          spec={lineChartSpec([
            {
              label: "Receipts",
              color: COL.green,
              data: col("rev"),
              wide: true,
            },
            {
              label: "Departmental spending",
              color: COL.ox,
              data: col("spend"),
              wide: true,
            },
            { label: "Debt interest", color: COL.brass, data: col("interest") },
          ])}
        />
      </ChartBox>
    </>
  );
}
