"use client";

import { paintTaxesPanel } from "../../lib/sim/engine.js";
import { EnginePaintHost } from "../../lib/ui/EnginePaintHost.jsx";

export function TaxesPanel() {
  return <EnginePaintHost paint={paintTaxesPanel} />;
}
