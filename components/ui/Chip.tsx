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
      className={`flex-none flex flex-col justify-center py-1 pr-2.5 pl-[9px] rounded-sm text-right min-w-[66px] border-l-2 ${bgCls}`}
      title={title || undefined}
    >
      <div className="text-[8.5px] font-semibold text-ink-faint whitespace-nowrap tracking-[.08em] uppercase">
        {label}
      </div>
      <div className={`text-[15px] font-[650] leading-[1.2] whitespace-nowrap tracking-[-.03em] ${valueCls}`}>
        {value}
        {unit ? (
          <small className="text-[9.5px] font-medium text-ink-faint ml-px">{unit}</small>
        ) : null}
      </div>
      {delta == null ? (
        <div
          className="text-[9px] font-semibold leading-[1.1] min-h-[1.1em] text-ink-faint"
          aria-hidden="true"
        >
          &nbsp;
        </div>
      ) : (
        <div className={`text-[9px] font-semibold leading-[1.1] min-h-[1.1em] ${deltaCls}`}>
          {sgn(delta, 2)}
        </div>
      )}
    </div>
  );
}
