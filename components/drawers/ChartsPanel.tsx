"use client";

import {
  COL,
  FACTIONS,
  aggregate,
  approvalOf,
  clamp,
  currencyForSeat,
  fmt,
  lineChartSpec,
  getDrawerCat,
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

const FBAR_TONE: Record<string, string> = { good: "bg-green", bad: "bg-red" };

export type ChartCat =
  "growth" | "prices" | "finances" | "politics" | "society";
/** Read by DrawerShell.tsx, which now owns the pill row itself. */
export const CATS: [ChartCat, string][] = [
  ["growth", "Growth"],
  ["prices", "Prices & rates"],
  ["finances", "Public finances"],
  ["politics", "Politics"],
  ["society", "Society"],
];

export function ChartsPanel() {
  const cat = getDrawerCat("charts", "growth") as ChartCat;
  const G = useGame();
  const { pref } = useCurrencyPref();
  const E: any = aggregate(G.draft);
  const e = G.econ;
  const socialBars: [string, string, number][] = [
    ["liberty", "Civil liberty", e.liberty],
    ["crime", "Crime", e.crime],
    ["health", "Public health", e.health],
    ["env", "Environment", e.env],
    ["black", "Black market share", E.blackLevel],
    ["gini", "Inequality (Gini)", e.gini],
  ];

  /* Current-state snapshot — not history, so it renders regardless of how
     much log data exists (unlike the trend charts below, which need at
     least two quarters). Moved here from the old Society tab: same bars,
     same computation, only the wrapper changed to fit Charts' ChartBox
     rhythm. */ const snapshot = (
    <>
      <ChartBox
        title="Where you stand"
        caption="Faction approval right now, weighted by population share."
      >
        {FACTIONS.map((f: any) => {
          const v = G.fac[f.id];
          const cls = v > 55 ? "good" : v < 38 ? "bad" : "";
          return (
            <div
              key={f.id}
              className="mb-1 grid grid-cols-[110px_1fr_34px] items-center gap-2 text-xs"
            >
              <span>
                {f.name}{" "}
                <span className="text-xs text-ink-faint">
                  {Math.round(f.w * 100)}%
                </span>
              </span>
              <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
                <i
                  className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${cls ? FBAR_TONE[cls] : "bg-ink-soft"}`}
                  style={{ width: `${v.toFixed(0)}%` }}
                />
              </span>
              <span className="text-right text-xs font-[650] text-ink-soft">
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
        <div className="mt-0.75 grid grid-cols-[110px_1fr_34px] items-center gap-2 border-t border-(--rule) pt-1.25 text-xs">
          <span className="font-semibold">Approval</span>
          <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
            <i
              className="block h-full rounded-none bg-red transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)]"
              style={{ width: `${approvalOf(G.fac).toFixed(0)}%` }}
            />
          </span>
          <span className="text-right text-xs font-semibold text-ink-soft">
            {approvalOf(G.fac).toFixed(0)}
          </span>
        </div>
      </ChartBox>
      <ChartBox
        title="Social indicators"
        caption="Liberty, crime, health, environment, the black-market share and inequality — current levels, not trend."
      >
        {socialBars.map(([k, n, v]) => {
          const bad = k === "crime" || k === "black" || k === "gini";
          const tone = bad
            ? v > 50
              ? "bg-red"
              : "bg-ink-soft"
            : v > 55
              ? "bg-green"
              : "bg-ink-soft";
          return (
            <div
              key={k}
              className="mb-1 grid grid-cols-[150px_1fr_34px] items-center gap-2 text-xs"
            >
              <span>{n}</span>
              <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
                <i
                  className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${tone}`}
                  style={{ width: `${clamp(v, 0, 100).toFixed(0)}%` }}
                />
              </span>
              <span className="text-right text-xs font-[650] text-ink-soft">
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
      </ChartBox>
    </>
  );

  const hasLog = G.log.length >= 2;
  const col = (k: string) => G.log.map((r: any) => r[k]);
  const preN = G.log.filter((r: any) => r.pre).length;
  const tr = G.econ.trendGrowth;
  const gapPts = G.econ.potential
    ? (G.econ.gdp / G.econ.potential - 1) * 100
    : 0;
  const fxCode = currencyForSeat(G.homeRole);
  const anchorCcy = pref.display || fxCode;
  const facColors = [COL.blue, COL.ox, COL.brass, COL.plum, COL.green, COL.ink];

  const noData = (
    <div className="p-4 text-xs text-ink-faint">
      Deliver a bill or two. The charts need at least two quarters of data.
    </div>
  );
  const preHint = preN ? (
    <Hint>Includes the {preN}-quarter run-up before your appointment.</Hint>
  ) : null;
  const withData = (el: React.ReactNode) =>
    !hasLog ? (
      noData
    ) : (
      <>
        {preHint}
        {el}
      </>
    );

  const growth = withData(
    <>
      <ChartBox
        title="Output against potential"
        caption={`Index, 100 at the start of your term. The gap is cyclical pressure on prices. Trend is how fast potential itself expands — currently ${tr != null ? tr.toFixed(2) : "—"}% a year; gap ${fmt(gapPts, 1)} pts.`}
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
      <ChartBox
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
    </>,
  );

  const prices = withData(
    <>
      <CurrencyComparisonChart G={G} anchorCcy={anchorCcy} />
      <ChartBox
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
    </>,
  );

  const finances = withData(
    <>
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
      <ChartBox
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
    </>,
  );

  const politics = withData(
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
    </ChartBox>,
  );

  const content =
    cat === "society"
      ? snapshot
      : cat === "growth"
        ? growth
        : cat === "prices"
          ? prices
          : cat === "finances"
            ? finances
            : politics;

  return <>{content}</>;
}
