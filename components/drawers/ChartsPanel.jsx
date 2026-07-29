"use client";

import {
  COL,
  FACTIONS,
  currencyForSeat,
  fmt,
  lineChart,
} from "../../lib/sim/engine.js";
import { useGame } from "../../lib/ui/useGame.js";
import { Hint } from "../ui/Typography.jsx";

function ChartBox({ title, caption, children }) {
  return (
    <div className="chartbox">
      <h3>{title}</h3>
      <div className="cap">{caption}</div>
      {children}
    </div>
  );
}

function ChartSvg({ html }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ChartsPanel() {
  const G = useGame();

  if (G.log.length < 2) {
    return (
      <div className="empty">
        Deliver a bill or two. The charts need at least two quarters of data.
      </div>
    );
  }

  const col = (k) => G.log.map((r) => r[k]);
  const preN = G.log.filter((r) => r.pre).length;
  const tr = G.econ.trendGrowth;
  const gapPts = G.econ.potential
    ? (G.econ.gdp / G.econ.potential - 1) * 100
    : 0;
  const fxCode = currencyForSeat(G.homeRole);
  const facColors = [
    COL.blue,
    COL.ox,
    COL.brass,
    COL.plum,
    COL.green,
    COL.ink,
  ];

  return (
    <>
      {preN ? (
        <Hint>Includes the {preN}-quarter run-up before your appointment.</Hint>
      ) : null}
      <ChartBox
        title="Output against potential"
        caption={`Index, 100 at the start of your term. The gap is cyclical pressure on prices. Trend (top bar) is how fast potential itself expands — currently ${tr != null ? tr.toFixed(2) : "—"}% a year; gap ${fmt(gapPts, 1)} pts.`}
      >
        <ChartSvg
          html={lineChart([
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
      <div className="chartgrid">
        <ChartBox
          title="Inflation and Bank rate"
          caption={
            G.rateManual
              ? "Base rate is pinned by you. Inflation still answers to the gap and expectations."
              : "You set fiscal policy. The Bank answers with the rate."
          }
        >
          <ChartSvg
            html={lineChart(
              [
                {
                  label: "Inflation",
                  color: COL.ox,
                  data: col("inflation"),
                  wide: true,
                },
                { label: "Bank rate", color: COL.blue, data: col("rate") },
              ],
              { target: 2, targetLabel: "Target" }
            )}
          />
        </ChartBox>
        <ChartBox
          title={`Currency strength (${fxCode})`}
          caption="Index versus the USD numeraire, 100 at term start. Stronger hurts exports and cheapens imports — watch net trade below."
        >
          <ChartSvg
            html={lineChart(
              [
                {
                  label: "Currency strength",
                  color: COL.brass,
                  data: col("fx"),
                  wide: true,
                },
              ],
              { target: 100, targetLabel: "Opening" }
            )}
          />
        </ChartBox>
        <ChartBox
          title="Unemployment"
          caption="Okun's relationship: output above trend pulls people into work."
        >
          <ChartSvg
            html={lineChart([
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
          title="Debt"
          caption="Per cent of GDP. Interest compounds whether you are looking or not."
        >
          <ChartSvg
            html={lineChart([
              {
                label: "Debt",
                color: COL.ink,
                data: col("debt"),
                wide: true,
              },
            ])}
          />
        </ChartBox>
        <ChartBox title="Gilt yield" caption={`What the market charges ${G.country} to borrow.`}>
          <ChartSvg
            html={lineChart([
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
        <ChartSvg
          html={lineChart(
            FACTIONS.map((f, i) => ({
              label: f.name,
              color: facColors[i],
              data: G.log.map((r) => r.fac[f.id]),
            })).concat([
              {
                label: "Overall",
                color: COL.soft,
                data: col("approval"),
                wide: true,
                dash: true,
              },
            ])
          )}
        />
      </ChartBox>
      <ChartBox
        title="The personal allowance in real terms"
        caption="Deflated by CPI and indexed to this seat's opening allowance. Uprate holds the line; Freeze lets inflation raise taxes without a vote."
      >
        <ChartSvg
          html={lineChart(
            [
              {
                label: "Real value of the allowance",
                color: COL.brass,
                data: G.log.map((r) => r.drag * 100),
                wide: true,
              },
            ],
            { target: 100, targetLabel: "Where it started" }
          )}
        />
      </ChartBox>
      <ChartBox
        title="Capital stock and the cost of capital"
        caption="Investment accumulates into the capital stock, which is an argument of potential output. Corporation tax and the policy rate move the user cost, and the user cost moves desired capital."
      >
        <ChartSvg
          html={lineChart([
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
        <ChartSvg
          html={lineChart([
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
        <ChartSvg
          html={lineChart([
            { label: "Consumption", color: COL.blue, data: col("C"), wide: true },
            { label: "Government", color: COL.green, data: col("Gov"), wide: true },
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
        <ChartSvg
          html={lineChart(
            [
              {
                label: "Net trade",
                color: COL.ox,
                data: col("netTrade"),
                wide: true,
              },
            ],
            { zero: true }
          )}
        />
      </ChartBox>
      <ChartBox
        title="Receipts and spending"
        caption="Points of GDP. The distance between the lines is the deficit."
      >
        <ChartSvg
          html={lineChart([
            { label: "Receipts", color: COL.green, data: col("rev"), wide: true },
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
