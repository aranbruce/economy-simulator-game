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

export const STATE_VALUE_COLOR: Record<string, string> = {
  alert: "text-red-lt",
  good: "text-green-lt",
};

const KIND_VALUE_COLOR: Record<string, string> = {
  bank: "text-accent-lt",
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
  const valueCls = STATE_VALUE_COLOR[state] || KIND_VALUE_COLOR[kind] || "";

  return (
    <div
      className="flex min-w-16.5 flex-none flex-col justify-center border-r border-edge px-2.75 py-1 text-right last:border-r-0"
      title={title || undefined}
    >
      <div className="text-[8px] font-semibold tracking-[.07em] whitespace-nowrap text-ink-faint uppercase">
        {label}
      </div>
      <div
        className={`font-display text-[17px] leading-[1.15] font-normal tracking-[-.01em] whitespace-nowrap ${valueCls}`}
      >
        {value}
        {unit ? (
          <small className="ml-0.5 font-sans text-[9.5px] font-medium text-ink-faint">
            {unit}
          </small>
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
        <div
          className={`min-h-[1.1em] text-[9px] leading-[1.1] font-semibold ${deltaCls}`}
        >
          {sgn(delta, 2)}
        </div>
      )}
    </div>
  );
}
