"use client";

import { useLayoutEffect, useRef } from "react";
import { renderPanelInto } from "../../lib/sim/engine.js";
import { useGameTick } from "./GameTickContext.jsx";

/** Mount legacy engine panel HTML + wiring into a React-owned host. */
export function LegacyPanelHost({ tab }) {
  const ref = useRef(null);
  const tick = useGameTick();

  useLayoutEffect(() => {
    if (ref.current && tab) renderPanelInto(ref.current, tab);
  }, [tick, tab]);

  return <div ref={ref} className="legacy-panel-host" />;
}
