"use client";

import {
  TABS,
  billClauses,
  capitalShortfallHint,
  currencyForSeat,
  fxDisplayIndex,
  getTab,
  setTab,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { DrawerContent } from "./DrawerContent.tsx";

function billCost() {
  return billClauses().reduce((a, c) => a + (c.sunk ? 0 : c.pc), 0);
}

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
    sub = `Currency strength (${currencyForSeat(G.homeRole)}) ${fxDisplayIndex("home").toFixed(1)}`;
  } else if (tab === "diplomacy") {
    name = "Diplomacy";
    sub = "Envoys · missions · relations";
  } else {
    name = (TABS.find((t) => t.id === tab) || {}).name || tab;
  }

  const wide = tab === "charts" || tab === "policies" || tab === "taxes";

  return (
    <div
      id="drawer"
      className={"hud-frame" + (wide ? " wide" : "")}
      role="dialog"
      aria-label="Policy panel"
      title={overspent ? capitalShortfallHint(cost, G.capital) : undefined}
    >
      <div className="dw-head">
        <h2 id="dwTitle">{name}</h2>
        <span className={"sub" + (overspent ? " alert" : "")} id="dwSub">
          {sub}
        </span>
        <button
          id="dwClose"
          type="button"
          aria-label="Close panel"
          onClick={() => setTab(null)}
        >
          &#10005;
        </button>
      </div>
      <div className="dw-body" id="drawerBody">
        <DrawerContent tab={tab} />
      </div>
    </div>
  );
}
