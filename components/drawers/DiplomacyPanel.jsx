"use client";

import { paintDiplomacyPanel } from "../../lib/sim/engine.js";
import { EnginePaintHost } from "../../lib/ui/EnginePaintHost.jsx";

export function DiplomacyPanel() {
  return <EnginePaintHost paint={paintDiplomacyPanel} />;
}
