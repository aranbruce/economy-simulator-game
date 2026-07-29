"use client";

import { sgn } from "../../lib/sim/engine.js";

export function Chip({
  label,
  value,
  unit = "",
  delta = null,
  state = "",
  invert = false,
  kind = "",
  title = "",
}) {
  let deltaCls = "";
  if (delta != null) {
    if (invert) deltaCls = delta < 0 ? "up" : "dn";
    else deltaCls = delta > 0 ? "up" : "dn";
  }
  const classes = ["chip", state, kind].filter(Boolean).join(" ");

  return (
    <div className={classes} title={title || undefined}>
      <div className="k">{label}</div>
      <div className="v">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {delta == null ? (
        <div className="d" aria-hidden="true">
          &nbsp;
        </div>
      ) : (
        <div className={`d ${deltaCls}`}>{sgn(delta, 2)}</div>
      )}
    </div>
  );
}
