"use client";

import { BillDrawer } from "../drawers/BillDrawer.tsx";
import { BudgetPanel } from "../drawers/BudgetPanel.tsx";
import { PoliciesPanel } from "../drawers/PoliciesPanel.tsx";
import { TaxesPanel } from "../drawers/TaxesPanel.tsx";
import { SocietyPanel } from "../drawers/SocietyPanel.tsx";
import { TradePanel } from "../drawers/TradePanel.tsx";
import { DiplomacyPanel } from "../drawers/DiplomacyPanel.tsx";
import { ChartsPanel } from "../drawers/ChartsPanel.tsx";

export function DrawerContent({ tab }: { tab: string | null }) {
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
