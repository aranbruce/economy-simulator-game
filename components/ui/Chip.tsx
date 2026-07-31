"use client";

import type { ReactNode } from "react";
import { sgn } from "../../lib/sim/engine.ts";

interface ChipProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  delta?: number | null;
  state?: string;
  invert?: boolean;
  kind?: string;
  title?: string;
}

const STATE_BG: Record<string, string> = {
  alert: "bg-[rgba(255,90,78,.12)] border-l-red",
  good: "bg-[rgba(61,220,132,.10)] border-l-green",
};

const KIND_BG: Record<string, string> = {
  bank: "bg-[rgba(184,148,240,.10)] border-l-purple",
};

const STATE_VALUE_COLOR: Record<string, string> = {
  alert: "text-red-lt",
  good: "text-green-lt",
};

const KIND_VALUE_COLOR: Record<string, string> = {
  bank: "text-[#d4b8f8]",
};

export function Chip({
  label,
  value,
  unit = "",
  delta = null,
  state = "",
  invert = false,
  kind = "",
  title = "",
}: ChipProps) {
  let deltaCls = "";
  if (delta != null) {
    if (invert) deltaCls = delta < 0 ? "text-green-lt" : "text-red-lt";
    else deltaCls = delta > 0 ? "text-green-lt" : "text-red-lt";
  }
  const bgCls = STATE_BG[state] || KIND_BG[kind] || "bg-g-1 border-l-transparent";
  const valueCls = STATE_VALUE_COLOR[state] || KIND_VALUE_COLOR[kind] || "";

  return (
    <div
      className={`flex min-w-[66px] flex-none flex-col justify-center rounded-sm border-l-2 py-1 pr-2.5 pl-[9px] text-right ${bgCls}`}
      title={title || undefined}
    >
      <div className="text-[8.5px] font-semibold tracking-[.08em] whitespace-nowrap text-ink-faint uppercase">
        {label}
      </div>
      <div className={`text-[15px] leading-[1.2] font-[650] tracking-[-.03em] whitespace-nowrap ${valueCls}`}>
        {value}
        {unit ? (
          <small className="ml-px text-[9.5px] font-medium text-ink-faint">{unit}</small>
        ) : null}
      </div>
      {delta == null ? (
        <div
          className="min-h-[1.1em] text-[9px] leading-[1.1] font-semibold text-ink-faint"
          aria-hidden="true"
        >
          &nbsp;
        </div>
      ) : (
        <div className={`min-h-[1.1em] text-[9px] leading-[1.1] font-semibold ${deltaCls}`}>
          {sgn(delta, 2)}
        </div>
      )}
    </div>
  );
}
