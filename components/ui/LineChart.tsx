"use client";

import type { ReactNode } from "react";

export interface ChartBoxProps {
  title: ReactNode;
  caption: ReactNode;
  children: ReactNode;
  noMargin?: boolean;
}

export function ChartBox({ title, caption, children, noMargin }: ChartBoxProps) {
  return (
    <div
      className={`${noMargin ? "mb-0" : "mb-2"} rounded-md border border-edge bg-g-1 px-3.5 pt-3 pb-2`}
    >
      <h3 className="m-0 mb-0.5 font-display text-lg font-normal tracking-[-.02em]">
        {title}
      </h3>
      <div className="mb-2 text-xs leading-[1.4] text-ink-soft">{caption}</div>
      {children}
    </div>
  );
}

export interface ChartSpecSeries {
  label: string;
  color: string;
  wide: boolean;
  dash: boolean;
  points: [number, number][];
  lastPoint: [number, number];
  lastValue: string;
}

export interface ChartSeriesInput {
  label: string;
  color: string;
  data: number[];
  wide?: boolean;
  dash?: boolean;
}

export interface ChartSpec {
  w: number;
  h: number;
  padR: number;
  gridLines: { y: number; label: string }[];
  targetLine: { y: number } | null;
  xLabels: { x: number; label: string }[];
  series: ChartSpecSeries[];
  targetLabel: string | null;
}

/** Renders the lineChartSpec() data as real SVG — no chart library, per CLAUDE.md.
 *  `hideValueLabels` drops the per-series right-edge number: with many series
 *  (a dozen-plus currencies, say) those labels land close together and
 *  collide, so the legend below becomes the only per-series value reference. */
export function LineChartSvg({
  spec,
  hideValueLabels,
}: {
  spec: ChartSpec | null;
  hideValueLabels?: boolean;
}) {
  if (!spec)
    return (
      <div className="p-4 text-xs text-ink-faint">
        Not enough quarters recorded yet.
      </div>
    );
  const { w, h, padR, gridLines, targetLine, xLabels, series, targetLabel } =
    spec;
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
            <circle
              cx={s.lastPoint[0]}
              cy={s.lastPoint[1]}
              r={2.2}
              fill={s.color}
            />
            {!hideValueLabels && (
              <text
                x={w - padR + 6}
                y={s.lastPoint[1] + 3}
                fontSize={9}
                fontFamily="IBM Plex Mono, monospace"
                fill={s.color}
              >
                {s.lastValue}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-1.75 flex flex-wrap gap-x-3.25 gap-y-1.25 text-xs text-ink-soft">
        {series.map((s, i) => (
          <span key={i}>
            <i
              className="mr-1.25 inline-block h-0.5 w-3 rounded-none align-[3px]"
              style={{ background: s.color }}
            />
            {s.label}
            {hideValueLabels ? ` ${s.lastValue}` : ""}
          </span>
        ))}
        {targetLabel && (
          <span>
            <i className="mr-1.25 inline-block h-0.5 w-3 rounded-none bg-[#c0392f] align-[3px]" />
            {targetLabel}
          </span>
        )}
      </div>
    </>
  );
}
