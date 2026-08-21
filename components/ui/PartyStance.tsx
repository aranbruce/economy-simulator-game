"use client";

import type { PartyStanceKind } from "../../lib/sim/types.ts";

export interface PartyStanceRow {
  id: string;
  name: string;
  short: string;
  color: string;
  stance: PartyStanceKind;
  alignment?: number;
  ruling?: boolean;
}

function stanceLabel(stance: PartyStanceKind) {
  if (stance === "for") return "For";
  if (stance === "against") return "Against";
  return "Split";
}

function stanceClass(stance: PartyStanceKind) {
  if (stance === "for") return "text-green-lt bg-green/16";
  if (stance === "against") return "text-red-lt bg-red/16";
  return "text-ink-faint bg-g-1";
}

/** Compact For / Against / Split chips derived from faction taste. */
export function PartyStanceChips({
  stances,
  sandbox = false,
  className = "",
}: {
  stances: PartyStanceRow[] | null | undefined;
  sandbox?: boolean;
  className?: string;
}) {
  if (!stances || !stances.length) return null;
  return (
    <div
      className={`flex flex-wrap gap-1 ${className || "mt-1.25"}`.trim()}
    >
      {stances.map((s) => (
        <span
          key={s.id}
          className={`rounded-sm px-1.75 py-0.5 text-xs font-[650] whitespace-nowrap ${stanceClass(s.stance)}`}
          title={s.name}
        >
          {s.short} {stanceLabel(s.stance)}
          {sandbox && s.alignment != null
            ? ` ${s.alignment > 0 ? "+" : ""}${s.alignment.toFixed(2)}`
            : ""}
        </span>
      ))}
    </div>
  );
}
