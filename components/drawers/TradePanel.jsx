"use client";

import { paintTradePanel } from "../../lib/sim/engine.js";
import { EnginePaintHost } from "../../lib/ui/EnginePaintHost.jsx";

export function TradePanel() {
  return <EnginePaintHost paint={paintTradePanel} />;
}
