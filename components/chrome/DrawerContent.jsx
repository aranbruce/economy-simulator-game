"use client";

import { LegacyPanelHost } from "../../lib/ui/LegacyPanelHost.jsx";
import { BillDrawer } from "../drawers/BillDrawer.jsx";
import { BudgetPanel } from "../drawers/BudgetPanel.jsx";
import { PoliciesPanel } from "../drawers/PoliciesPanel.jsx";

export function DrawerContent({ tab }) {
  if (tab === "bill") return <BillDrawer />;
  if (tab === "budget") return <BudgetPanel />;
  if (tab === "policies") return <PoliciesPanel />;
  if (tab === "society") return <LegacyPanelHost tab="society" />;
  if (tab === "taxes") return <LegacyPanelHost tab="taxes" />;
  if (tab === "trade") return <LegacyPanelHost tab="trade" />;
  if (tab === "diplomacy") return <LegacyPanelHost tab="diplomacy" />;
  if (tab === "charts") return <LegacyPanelHost tab="charts" />;
  return null;
}
