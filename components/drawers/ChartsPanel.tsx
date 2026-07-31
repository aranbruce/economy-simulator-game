"use client";

import type { ReactNode } from "react";
import {
  COL,
  FACTIONS,
  currencyForSeat,
  fmt,
  lineChartSpec,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Hint } from "../ui/Typography.tsx";

interface ChartBoxProps {
  title: ReactNode;
  caption: ReactNode;
  children: ReactNode;
  noMargin?: boolean;
}

function ChartBox({ title, caption, children, noMargin }: ChartBoxProps) {
  return (
    <div
      className={`${noMargin ? "mb-0" : "mb-2"} rounded-md border border-edge bg-g-1 px-3.5 pt-3 pb-2`}
    >
      <h3 className="m-0 mb-0.5 font-display text-[18px] font-normal tracking-[-.02em]">
        {title}
      </h3>
      <div className="mb-2 text-xs leading-[1.4] text-ink-soft">{caption}</div>
      {children}
    </div>
  );
}

interface ChartSpecSeries {
  label: string;
  color: string;
  wide: boolean;
  dash: boolean;
  points: [number, number][];
  lastPoint: [number, number];
  lastValue: string;
}

interface ChartSeriesInput {
  label: string;
  color: string;
  data: number[];
  wide?: boolean;
  dash?: boolean;
}

interface ChartSpec {
  w: number;
  h: number;
  padR: number;
  gridLines: { y: number; label: string }[];
  targetLine: { y: number } | null;
  xLabels: { x: number; label: string }[];
  series: ChartSpecSeries[];
  targetLabel: string | null;
}

/** Renders the lineChartSpec() data as real SVG — no chart library, per CLAUDE.md. */
function LineChartSvg({ spec }: { spec: ChartSpec | null }) {
  if (!spec)
    return (
      <div className="p-4 text-[12.5px] text-ink-faint">
        Not enough quarters recorded yet.
      </div>
    );
  const { w, h, padR, gridLines, targetLine, xLabels, series, targetLabel } = spec;
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={36}
              y1={g.y}
              x2={w - padR}
              y2={g.y}
              stroke="#d6cdb8"
              strokeWidth={1}
            />
            <text
              x={31}
              y={g.y + 3.5}
              textAnchor="end"
              fontSize={8.5}
              fontFamily="IBM Plex Mono, monospace"
              fill="#8d8474"
            >
              {g.label}
            </text>
          </g>
        ))}
        {targetLine && (
          <line
            x1={36}
            y1={targetLine.y}
            x2={w - padR}
            y2={targetLine.y}
            stroke="#c0392f"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={h - 6}
            textAnchor="middle"
            fontSize={8}
            fontFamily="IBM Plex Mono, monospace"
            fill="#8d8474"
          >
            {l.label}
          </text>
        ))}
        {series.map((s, i) => (
          <g key={i}>
            <polyline
              points={s.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.wide ? 2 : 1.4}
              strokeDasharray={s.dash ? "4 3" : undefined}
            />
            <circle cx={s.lastPoint[0]} cy={s.lastPoint[1]} r={2.2} fill={s.color} />
            <text
              x={w - padR + 6}
              y={s.lastPoint[1] + 3}
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              fill={s.color}
            >
              {s.lastValue}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1.75 flex flex-wrap gap-x-3.25 gap-y-1.25 text-[11px] text-ink-soft">
        {series.map((s, i) => (
          <span key={i}>
            <i
              className="mr-1.25 inline-block h-0.5 w-3 rounded-none align-[3px]"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
        {targetLabel && (
          <span>
            <i
              className="mr-1.25 inline-block h-0.5 w-3 rounded-none align-[3px]"
              style={{ background: "#c0392f" }}
            />
            {targetLabel}
          </span>
        )}
      </div>
    </>
  );
}

export function ChartsPanel() {
  const G = useGame();

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
              { target: 2, targetLabel: "Target" }
            )}
          />
        </ChartBox>
        <ChartBox
          noMargin
          title={`Currency strength (${fxCode})`}
          caption="Index versus the USD numeraire, 100 at term start. Stronger hurts exports and cheapens imports — watch net trade below."
        >
          <LineChartSvg
            spec={lineChartSpec(
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
            FACTIONS.map(
              (f: any, i: number): ChartSeriesInput => ({
                label: f.name,
                color: facColors[i],
                data: G.log.map((r: any) => r.fac[f.id]),
              })
            ).concat([
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
            { target: 100, targetLabel: "Where it started" }
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
            { zero: true }
          )}
        />
      </ChartBox>
      <ChartBox
        title="Receipts and spending"
        caption="Points of GDP. The distance between the lines is the deficit."
      >
        <LineChartSvg
          spec={lineChartSpec([
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
