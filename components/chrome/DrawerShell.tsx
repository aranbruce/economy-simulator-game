"use client";

import {
  TABS,
  billClauses,
  programmeCost,
  capitalShortfallHint,
  getTab,
  setTab,
  getDrawerCat,
  setDrawerCat,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { CatPills } from "../ui/CatPills.tsx";
import { MENUS as LAWS_MENUS } from "../drawers/LawsPanel.tsx";
import { CATS as CHARTS_CATS } from "../drawers/ChartsPanel.tsx";
import { CATS as TAXES_CATS } from "../drawers/TaxesPanel.tsx";
import { CATS as DIPLOMACY_CATS } from "../drawers/DiplomacyPanel.tsx";
import { CATS as TRADE_CATS } from "../drawers/TradePanel.tsx";

function programmeTotal() {
  return programmeCost(billClauses());
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
  const cost = programmeTotal();
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
      className={`hud-frame hud-surface-lg fixed inset-x-2.5 top-(--drawer-top,82px) bottom-(--drawer-bottom,88px) z-15 flex max-h-[min(64vh,640px)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] flex-col overflow-hidden max-lg:top-(--drawer-top,160px) max-lg:right-[calc(var(--rail-clear)+env(safe-area-inset-right))] max-lg:bottom-(--drawer-bottom,128px) max-lg:left-[max(6px,env(safe-area-inset-left))] max-lg:h-auto max-lg:max-h-none max-sm:bottom-(--drawer-bottom,118px) lg:right-(--rail-clear) lg:left-auto lg:max-h-none lg:w-[min(560px,46vw)] ${wide ? "lg:w-[min(900px,64vw)]" : ""}`}
      role="dialog"
      aria-label="Policy panel"
      title={overspent ? capitalShortfallHint(cost, G.capital) : undefined}
    >
      <div className="flex flex-none items-center gap-2.5 border-b border-edge bg-[linear-gradient(180deg,var(--panel-hi),transparent)] px-4 pt-3 pb-2.5 max-md:flex-wrap max-md:gap-2 max-md:px-3 max-md:pt-2.5 max-md:pb-2.25">
        <h2
          id="dwTitle"
          className="m-0 font-display text-2xl font-normal tracking-[-.02em] max-md:min-w-0 max-md:flex-[1_1_auto] max-md:text-lg"
        >
          {name}
        </h2>
        <span
          className={`text-xs font-semibold tracking-[.04em] uppercase max-md:order-3 max-md:flex-[1_1_100%] max-md:text-xs ${overspent ? "text-red" : "text-ink-soft"}`}
          id="dwSub"
        >
          {sub}
        </span>
        <button
          id="dwClose"
          type="button"
          aria-label="Close panel"
          className="ml-auto grid size-7 flex-none cursor-pointer place-items-center rounded-sm border border-edge bg-g-3 text-ink-soft shadow-spec hover:border-frame hover:bg-g-4 hover:text-white max-md:size-9"
          onClick={() => setTab(null)}
        >
          <CloseIcon />
        </button>
      </div>
      {pillConfig ? (
        <div className="flex-none border-b border-edge bg-panel py-2.25">
          <CatPills
            options={pillConfig.options}
            value={getDrawerCat(tab, pillConfig.def)}
            onChange={(v) => setDrawerCat(tab, v)}
          />
        </div>
      ) : null}
      <div
        className="dw-body overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4 [-webkit-overflow-scrolling:touch] max-md:px-3 max-md:pt-2.5 max-md:pb-3.5"
        id="drawerBody"
        key={tab}
      >
        <DrawerContent tab={tab} />
      </div>
    </div>
  );
}
