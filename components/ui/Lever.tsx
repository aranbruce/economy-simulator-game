"use client";

import { useCallback, useState, type ReactNode } from "react";
import { sgn } from "../../lib/sim/engine.ts";

interface LeverProps {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  note?: ReactNode;
  className?: string;
  disabled?: boolean;
  base?: number | null;
  invertChange?: boolean;
  onInput?: (id: string, value: number) => void;
  onCommit?: (id: string, value: number) => void;
}

export function Lever({
  id,
  name,
  value,
  min,
  max,
  step = 0.1,
  decimals = 1,
  note,
  className = "",
  disabled = false,
  base = null,
  invertChange = false,
  onInput,
  onCommit,
}: LeverProps) {
  const [local, setLocal] = useState<number | null>(null);
  const display = local != null ? local : value;

  const paintDelta = useCallback(() => {
    if (base == null || !Number.isFinite(display)) return "";
    const d = display - base;
    if (Math.abs(d) < 0.049) return "";
    return sgn(d, decimals);
  }, [base, display, decimals]);

  const delta = paintDelta();
  let chgColor = "";
  if (delta) {
    const d = display - (base ?? 0);
    const up = d > 0;
    // Default: up costs more (red), down saves (green). "spend" and
    // invertChange both flip that (a spending rise is the good direction).
    const upIsGood = className.includes("spend") || invertChange;
    chgColor = up === upIsGood ? "text-green-lt" : "text-red-lt";
  }

  return (
    <div
      className="border-b border-edge px-3 py-2 last:border-b-0"
      data-lever={id}
    >
      <div className="flex items-baseline gap-2 text-[13px]">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">
          {Number.isFinite(display) ? `${display.toFixed(decimals)}%` : "—"}
        </span>
        <span
          className={`w-10.5 text-right text-[11px] font-semibold ${chgColor || "text-ink-faint"}`}
        >
          {delta}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={display}
        disabled={disabled}
        aria-label={name}
        onInput={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setLocal(v);
          onInput?.(id, v);
        }}
        onChange={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setLocal(null);
          onCommit?.(id, v);
        }}
      />
      {note ? (
        <div className="mt-0.5 text-[11px] text-ink-faint">{note}</div>
      ) : null}
    </div>
  );
}
