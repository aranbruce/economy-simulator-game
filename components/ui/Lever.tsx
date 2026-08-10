"use client";

import { useCallback, useState, type ReactNode } from "react";
import { sgn } from "../../lib/sim/engine.ts";

interface LeverProps {
  id: string;
  name: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  /** Suffix appended after the formatted number. Defaults to "%" to match
   *  every existing caller; ignored when `format` or `labels` is given. */
  unit?: string;
  /** Full control over the displayed value, e.g. `(v) => `${Math.round(v)} days`` —
   *  overrides `unit` entirely when given. Ignored when `labels` is given. */
  format?: (value: number, decimals: number) => string;
  /** Discrete/stepped mode: renders `labels.length` snap positions instead
   *  of a continuous range, showing the label text at the current index
   *  instead of a formatted number. `min`/`max`/`step`/`unit`/`format` and
   *  the base-value delta chip are all ignored when this is set — a
   *  "+1.0" delta doesn't mean anything between two option labels, and the
   *  card wrapping this already shows staged-vs-live via its own border
   *  color. `value`/`onCommit` are still plain option-array indices. */
  labels?: string[];
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
  unit,
  format,
  labels,
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
  const effMin = labels ? 0 : (min ?? 0);
  const effMax = labels ? Math.max(0, labels.length - 1) : (max ?? 100);
  const effStep = labels ? 1 : step;

  const paintDelta = useCallback(() => {
    if (labels) return "";
    if (base == null || !Number.isFinite(display)) return "";
    const d = display - base;
    if (Math.abs(d) < 0.049) return "";
    return sgn(d, decimals);
  }, [base, display, decimals, labels]);

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

  const displayText = labels
    ? (labels[Math.max(0, Math.min(labels.length - 1, Math.round(display)))] ?? "—")
    : Number.isFinite(display)
      ? format
        ? format(display, decimals)
        : `${display.toFixed(decimals)}${unit ?? "%"}`
      : "—";

  return (
    <div
      className={`border-b border-edge px-3 py-2 last:border-b-0 ${className.includes("no-border") ? "border-0 px-0" : ""}`.trim()}
      data-lever={id}
    >
      <div className="flex items-baseline gap-2 text-[13px]">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">
          {displayText}
        </span>
        {labels ? null : (
          <span
            className={`w-10.5 text-right text-[11px] font-semibold ${chgColor || "text-ink-faint"}`}
          >
            {delta}
          </span>
        )}
      </div>
      <input
        type="range"
        min={effMin}
        max={effMax}
        step={effStep}
        value={display}
        disabled={disabled}
        aria-label={name}
        onInput={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setLocal(v);
          onInput?.(id, v);
        }}
        onPointerUp={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setLocal(null);
          onCommit?.(id, v);
        }}
        onKeyUp={(e) => {
          const v = parseFloat(e.currentTarget.value);
          setLocal(null);
          onCommit?.(id, v);
        }}
        onBlur={(e) => {
          if (local == null) return;
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
