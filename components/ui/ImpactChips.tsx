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
}: {
  chips: (ImpactChip | null)[] | null;
}) {
  if (!chips || !chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips
        .filter((c): c is ImpactChip => c != null)
        .map((c, i) => (
          <span
            key={i}
            className={`rounded-sm px-1.75 py-0.75 text-[10.5px] font-[650] whitespace-nowrap ${c.up ? "bg-green/16 text-green-lt" : "bg-red/16 text-red-lt"}`}
          >
            {c.name} {sgn(c.value, c.dp)}
          </span>
        ))}
    </div>
  );
}

export function ImpactFactions({
  factions,
}: {
  factions: ImpactFactionsData | null;
}) {
  if (!factions || factions.empty) {
    return (
      <div className="mt-1.25 flex flex-wrap gap-2.25 text-[11px] text-ink-faint">
        No faction moves enough to notice.
      </div>
    );
  }
  return (
    <div className="mt-1.25 flex flex-wrap gap-2.25 text-[11px] text-ink-faint">
      {factions.best && (
        <span className="text-green-lt">
          {factions.best.name} {sgn(factions.best.value, 1)}
        </span>
      )}
      {factions.worst && (
        <span className="text-red-lt">
          {factions.worst.name} {sgn(factions.worst.value, 1)}
        </span>
      )}
      {factions.gini && (
        <span className={factions.gini.up ? "text-green-lt" : "text-red-lt"}>
          Inequality {sgn(factions.gini.value, 2)}
        </span>
      )}
    </div>
  );
}
