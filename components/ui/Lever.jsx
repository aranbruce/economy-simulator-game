"use client";

import { useCallback, useState } from "react";
import { sgn } from "../../lib/sim/engine.js";

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
}) {
  const [local, setLocal] = useState(null);
  const display = local != null ? local : value;

  const paintDelta = useCallback(() => {
    if (base == null || !Number.isFinite(display)) return "";
    const d = display - base;
    if (Math.abs(d) < 0.049) return "";
    return sgn(d, decimals);
  }, [base, display, decimals]);

  const delta = paintDelta();
  let chgCls = "";
  if (delta) {
    const d = display - (base ?? 0);
    const up = d > 0;
    if (className.includes("spend")) chgCls = up ? "up" : "dn";
    else if (invertChange) chgCls = up ? "dn" : "up";
    else chgCls = up ? "up" : "dn";
  }

  return (
    <div className={`lever ${className}`.trim()} data-lever={id}>
      <div className="top">
        <span className="nm">{name}</span>
        <span className="val">
          {Number.isFinite(display) ? `${display.toFixed(decimals)}%` : "—"}
        </span>
        <span className={`chg ${chgCls}`}>{delta}</span>
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
          const v = parseFloat(e.target.value);
          setLocal(v);
          onInput?.(id, v);
        }}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setLocal(null);
          onCommit?.(id, v);
        }}
      />
      {note ? (
        <div className="yield" dangerouslySetInnerHTML={{ __html: note }} />
      ) : null}
    </div>
  );
}
