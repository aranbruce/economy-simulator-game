"use client";

import { createContext, useContext } from "react";

export const GameTickContext = createContext(0);

export function useGameTick() {
  return useContext(GameTickContext);
}
