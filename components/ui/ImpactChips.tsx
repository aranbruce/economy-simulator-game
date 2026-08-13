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

/** The up/down/faint text-colour tokens, dark-HUD or paper-skin — the one
 *  place both ImpactChips and ImpactFactions read them from, so a palette
 *  change (a renamed paper-green, a new tone) only needs editing once. */
function toneTokens(paper: boolean) {
  return {
    up: paper ? "text-paper-green" : "text-green-lt",
    down: paper ? "text-paper-red" : "text-red-lt",
    faint: paper ? "text-paper-ink-faint" : "text-ink-faint",
  };
}

export function ImpactChips({
  chips,
  paper = false,
}: {
  chips: (ImpactChip | null)[] | null;
  paper?: boolean;
}) {
  if (!chips || !chips.length) return null;
  const { up, down } = toneTokens(paper);
  const upCls = `${paper ? "bg-paper-green/12" : "bg-green/16"} ${up}`;
  const downCls = `${paper ? "bg-paper-red/12" : "bg-red/16"} ${down}`;
  return (
    <div className="flex flex-wrap gap-1">
      {chips
        .filter((c): c is ImpactChip => c != null)
        .map((c, i) => (
          <span
            key={i}
            className={`rounded-sm px-1.75 py-0.75 text-xs font-[650] whitespace-nowrap ${c.up ? upCls : downCls}`}
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
  const { up, down, faint } = toneTokens(paper);
  if (!factions || factions.empty) {
    return (
      <div className={`mt-1.25 flex flex-wrap gap-2.25 text-xs ${faint}`}>
        No faction moves enough to notice.
      </div>
    );
  }
  return (
    <div className={`mt-1.25 flex flex-wrap gap-2.25 text-xs ${faint}`}>
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
