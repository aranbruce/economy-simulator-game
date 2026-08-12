"use client";

import {
  TABS,
  billClauses,
  capitalShortfallHint,
  getTab,
  setTab,
  getDrawerCat,
  setDrawerCat,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { DrawerContent } from "./DrawerContent.tsx";
import { CatPills } from "../ui/CatPills.tsx";
import { MENUS as LAWS_MENUS } from "../drawers/LawsPanel.tsx";
import { CATS as CHARTS_CATS } from "../drawers/ChartsPanel.tsx";
import { CATS as TAXES_CATS } from "../drawers/TaxesPanel.tsx";
import { CATS as DIPLOMACY_CATS } from "../drawers/DiplomacyPanel.tsx";
import { CATS as TRADE_CATS } from "../drawers/TradePanel.tsx";

function billCost() {
  return billClauses().reduce((a, c) => a + (c.sunk ? 0 : c.pc), 0);
}

/** Category pills for a drawer live here, as real persistent chrome, rather
 *  than each panel faking stickiness with `position: fixed` at a
 *  hand-tuned pixel offset against this shell's own header height. Add an
 *  entry here (and export the panel's own `CATS`/`MENUS` + default id) to
 *  give any other drawer the same pill row. */
const PILL_CONFIG: Record<
  string,
  { options: [string, string][]; def: string }
> = {
  laws: { options: LAWS_MENUS, def: "state" },
  charts: { options: CHARTS_CATS, def: "growth" },
  taxes: { options: TAXES_CATS, def: "income" },
  diplomacy: { options: DIPLOMACY_CATS, def: DIPLOMACY_CATS[0][0] },
  trade: { options: TRADE_CATS, def: "tariffs" },
};

export function DrawerShell() {
  const G = useGame();
  const tab = getTab();
  if (!tab) return null;

  const cl = billClauses();
  const cost = billCost();
  const overspent = tab === "bill" && cl.length > 0 && cost > G.capital;
  let name;
  let sub = "";

  if (tab === "bill") {
    name = "The Programme";
    sub = cl.length
      ? `${cost} of ${Math.round(G.capital)} capital`
      : "no clauses";
  } else if (tab === "trade") {
    name = "Trade";
    sub = "Blocs · deals · currency";
  } else if (tab === "diplomacy") {
    name = "Diplomacy";
    sub = "Envoys · missions · relations";
  } else if (tab === "overview") {
    name = "Overview";
    sub = "Faction approval · situations";
  } else {
    name = (TABS.find((t) => t.id === tab) || {}).name || tab;
  }

  const wide = !!(TABS.find((t) => t.id === tab) as any)?.wide;
  const pillConfig = PILL_CONFIG[tab];

  return (
    <div
      id="drawer"
      className={`hud-frame hud-surface-lg fixed right-2.5 bottom-22 left-2.5 z-15 flex max-h-[min(64vh,640px)] animate-[panelIn_0.34s_cubic-bezier(.22,1,.3,1)] flex-col overflow-hidden max-[720px]:top-(--drawer-top,160px) max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:bottom-(--drawer-bottom,128px) max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:h-auto max-[720px]:max-h-none max-[540px]:bottom-(--drawer-bottom,118px) min-[920px]:top-20.5 min-[920px]:right-15 min-[920px]:bottom-22 min-[920px]:left-auto min-[920px]:max-h-none min-[920px]:w-[min(560px,46vw)] ${wide ? "min-[920px]:w-[min(900px,64vw)]" : ""}`}
      role="dialog"
      aria-label="Policy panel"
      title={overspent ? capitalShortfallHint(cost, G.capital) : undefined}
    >
      <div className="flex flex-none items-center gap-2.5 border-b border-edge bg-[linear-gradient(180deg,var(--panel-hi),transparent)] px-4 pt-3 pb-2.5 max-[720px]:flex-wrap max-[720px]:gap-2 max-[720px]:px-3 max-[720px]:pt-2.5 max-[720px]:pb-2.25">
        <h2
          id="dwTitle"
          className="m-0 font-display text-[22px] font-normal tracking-[-.02em] max-[720px]:min-w-0 max-[720px]:flex-[1_1_auto] max-[720px]:text-lg"
        >
          {name}
        </h2>
        <span
          className={`text-[11px] font-semibold tracking-[.04em] uppercase max-[720px]:order-3 max-[720px]:flex-[1_1_100%] max-[720px]:text-[10px] ${overspent ? "text-red" : "text-ink-soft"}`}
          id="dwSub"
        >
          {sub}
        </span>
        <button
          id="dwClose"
          type="button"
          aria-label="Close panel"
          className="ml-auto size-7 flex-none cursor-pointer rounded-sm border border-edge bg-g-3 text-xs leading-none text-ink-soft shadow-spec hover:border-frame hover:bg-g-4 hover:text-white max-[720px]:size-9"
          onClick={() => setTab(null)}
        >
          &#10005;
        </button>
      </div>
      {pillConfig ? (
        <div className="flex-none border-b border-edge bg-panel px-3.5 py-2.25 max-[720px]:px-3">
          <CatPills
            options={pillConfig.options}
            value={getDrawerCat(tab, pillConfig.def)}
            onChange={(v) => setDrawerCat(tab, v)}
          />
        </div>
      ) : null}
      <div
        className="dw-body overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4 [-webkit-overflow-scrolling:touch] max-[720px]:px-3 max-[720px]:pt-2.5 max-[720px]:pb-3.5"
        id="drawerBody"
        key={tab}
      >
        <DrawerContent tab={tab} />
      </div>
    </div>
  );
}
