"use client";

import { useLayoutEffect, useRef } from "react";
import { useGameTick } from "./GameTickContext.jsx";

/** Mount an engine paint(host) function into a React-owned DOM node. */
export function EnginePaintHost({ paint }) {
  const ref = useRef(null);
  const tick = useGameTick();

  useLayoutEffect(() => {
    if (ref.current && paint) paint(ref.current);
  }, [tick, paint]);

  return <div ref={ref} className="engine-paint-host" />;
}
