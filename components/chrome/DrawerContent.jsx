"use client";

import { BillDrawer } from "../drawers/BillDrawer.jsx";
import { BudgetPanel } from "../drawers/BudgetPanel.jsx";
import { PoliciesPanel } from "../drawers/PoliciesPanel.jsx";
import { TaxesPanel } from "../drawers/TaxesPanel.jsx";
import { SocietyPanel } from "../drawers/SocietyPanel.jsx";
import { TradePanel } from "../drawers/TradePanel.jsx";
import { DiplomacyPanel } from "../drawers/DiplomacyPanel.jsx";
import { ChartsPanel } from "../drawers/ChartsPanel.jsx";

export function DrawerContent({ tab }) {
  if (tab === "bill") return <BillDrawer />;
  if (tab === "budget") return <BudgetPanel />;
  if (tab === "policies") return <PoliciesPanel />;
  if (tab === "taxes") return <TaxesPanel />;
  if (tab === "society") return <SocietyPanel />;
  if (tab === "trade") return <TradePanel />;
  if (tab === "diplomacy") return <DiplomacyPanel />;
  if (tab === "charts") return <ChartsPanel />;
  return null;
}
