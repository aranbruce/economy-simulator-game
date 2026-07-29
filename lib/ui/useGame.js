"use client";

import { getG } from "../sim/engine.js";
import { useGameTick } from "./GameTickContext.jsx";

/** Re-read live sim state whenever the engine bumps the UI tick. */
export function useGame() {
  useGameTick();
  return getG();
}
