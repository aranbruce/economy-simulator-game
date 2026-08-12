"use client";

import { sgn } from "../../lib/sim/engine.ts";

export interface ImpactChip {
  name: string;
  value: number;
  dp: number;
  up: boolean;
}

export interface ImpactFactionsData {
  empty: boolean;
  best: { name: string; value: number } | null;
  worst: { name: string; value: number } | null;
  gini: { value: number; up: boolean } | null;
}

export function ImpactChips({
  chips,
  paper = false,
}: {
  chips: (ImpactChip | null)[] | null;
  paper?: boolean;
}) {
  if (!chips || !chips.length) return null;
  const upCls = paper
    ? "bg-[rgba(46,125,50,.12)] text-[#2e6b2e]"
    : "bg-green/16 text-green-lt";
  const downCls = paper
    ? "bg-[rgba(164,57,43,.12)] text-[#a4392b]"
    : "bg-red/16 text-red-lt";
  return (
    <div className="flex flex-wrap gap-1">
      {chips
        .filter((c): c is ImpactChip => c != null)
        .map((c, i) => (
          <span
            key={i}
            className={`rounded-sm px-1.75 py-0.75 text-[10.5px] font-[650] whitespace-nowrap ${c.up ? upCls : downCls}`}
          >
            {c.name} {sgn(c.value, c.dp)}
          </span>
        ))}
    </div>
  );
}

export function ImpactFactions({
  factions,
  paper = false,
}: {
  factions: ImpactFactionsData | null;
  paper?: boolean;
}) {
  const faint = paper ? "text-[#6b5c3e]" : "text-ink-faint";
  const up = paper ? "text-[#2e6b2e]" : "text-green-lt";
  const down = paper ? "text-[#a4392b]" : "text-red-lt";
  if (!factions || factions.empty) {
    return (
      <div className={`mt-1.25 flex flex-wrap gap-2.25 text-[11px] ${faint}`}>
        No faction moves enough to notice.
      </div>
    );
  }
  return (
    <div className={`mt-1.25 flex flex-wrap gap-2.25 text-[11px] ${faint}`}>
      {factions.best && (
        <span className={up}>
          {factions.best.name} {sgn(factions.best.value, 1)}
        </span>
      )}
      {factions.worst && (
        <span className={down}>
          {factions.worst.name} {sgn(factions.worst.value, 1)}
        </span>
      )}
      {factions.gini && (
        <span className={factions.gini.up ? up : down}>
          Inequality {sgn(factions.gini.value, 2)}
        </span>
      )}
    </div>
  );
}
