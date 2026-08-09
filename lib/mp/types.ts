import type { GameState } from "../sim/types.ts";

export interface MpPlayer {
  token: string;
  name: string;
  role: string;
  seatId: string;
}

export interface Room {
  code: string;
  hostToken: string;
  status: "lobby" | "playing";
  version: number;
  /** The live sim state bag for this room once play starts — untyped until
   * Phase 4 of the TS migration models `GameState` for real. */
  snapshot: GameState | null;
  submitted: Record<string, any>;
  players: Record<string, MpPlayer>;
}
