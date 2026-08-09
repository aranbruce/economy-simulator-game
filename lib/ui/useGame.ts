"use client";

import { getG } from "../sim/engine.ts";
import type { GameState } from "../sim/types.ts";
import { useGameTick } from "./GameTickContext.tsx";

/** Re-read live sim state whenever the engine bumps the UI tick. */
export function useGame(): GameState {
  useGameTick();
  return getG();
}
