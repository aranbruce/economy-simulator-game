"use client";

import {
  TABS,
  billClauses,
  billCost,
  clausesIn,
  capitalShortfallHint,
  getTab,
  isDeliverLocked,
  setTab,
} from "../../lib/sim/engine.ts";
import { TabIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";

/* Diplomacy and Charts moved to the right icon rail — see IconRail.tsx,
   which owns their pip/attention-dot logic too. */
const DOCK_TABS = TABS.filter((t) => t.id !== "diplomacy" && t.id !== "charts");

interface DockProps {
  onDeliver: () => void;
  deliverLabel?: string | null;
  deliverDisabled?: boolean | null;
  deliverTitle?: string | null;
  waiting?: boolean;
}

export function Dock({
  onDeliver,
  deliverLabel = null,
  deliverDisabled = null,
  deliverTitle = null,
  waiting,
}: DockProps) {
  const G = useGame();
  const tab = getTab();
  const cl = billClauses();
  const cost = billCost(cl);
  const afford = cost <= G.capital;
  const shortBy = Math.max(0, cost - Math.round(G.capital));

  let resolvedLabel = deliverLabel;
  let resolvedDisabled = deliverDisabled;
  let resolvedTitle = deliverTitle;

  if (resolvedLabel == null) {
    if (G.mp?.bootstrapping) {
      resolvedLabel = "Starting…";
      resolvedTitle = "Connecting multiplayer room…";
      resolvedDisabled = true;
    } else if (G.mp && G.mp.waiting) {
      const n = G.mp.submittedCount;
      const h = G.mp.humanCount;
      resolvedLabel =
        h != null && n != null ? `Waiting ${n}/${h}` : "Waiting on others";
      resolvedTitle = "Edit anything to withdraw, or click here";
      resolvedDisabled = false;
    } else if (waiting) {
      resolvedLabel = deliverLabel ?? "Waiting on others";
    } else {
      resolvedDisabled =
        isDeliverLocked() || G.over || (cl.length > 0 && !afford);
      if (G.over) {
        resolvedLabel = "Term over";
      } else if (cl.length === 0) {
        resolvedLabel = "Next quarter";
      } else if (afford) {
        resolvedLabel = "Deliver";
      } else {
        resolvedLabel = shortBy ? `Need ${shortBy} more` : "Need capital";
        resolvedTitle = capitalShortfallHint(cost, G.capital);
      }
    }
  }

  const pipBase =
    "absolute top-1 right-1.75 size-1.5 rounded-full bg-amber shadow-[0_0_0_2px_rgba(0,0,0,.35)] max-sm:top-1.25 max-sm:right-1.25";

  return (
    <nav
      id="dock"
      aria-label="Government"
      className="hud-surface fixed bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 p-1.5 max-sm:right-[max(6px,env(safe-area-inset-right))] max-sm:bottom-[max(6px,env(safe-area-inset-bottom))] max-sm:left-[max(6px,env(safe-area-inset-left))] max-sm:w-auto max-sm:translate-x-0 max-sm:flex-wrap max-sm:gap-1.5"
    >
      <div
        className="flex min-w-0 flex-1 scrollbar-none gap-0.75 overflow-visible overflow-x-auto py-1.5 max-sm:order-1 max-sm:flex-[1_1_100%] max-sm:flex-nowrap max-sm:gap-1 max-sm:overflow-x-visible max-sm:pb-0"
        id="dockTabs"
      >
        {DOCK_TABS.map((t) => {
          const active = t.id === tab;
          const pip = clausesIn(t.id, cl) ? <span className={pipBase} /> : null;
          return (
            <button
              key={t.id}
              type="button"
              className={`dock-dome relative flex min-w-14.5 flex-none flex-col items-center gap-0.5 rounded-lg px-3 py-1.75 text-xs font-semibold tracking-[.02em] uppercase transition-colors duration-180 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:min-h-11 max-md:min-w-11 max-md:justify-center max-md:px-2.5 max-md:py-1.5 max-md:text-xs max-sm:min-w-0 max-sm:flex-1 max-sm:px-1.5 max-sm:py-2 ${active ? "active text-accent-lt" : "text-ink-soft hover:text-white"}`}
              data-tab={t.id}
              aria-label={t.name}
              aria-expanded={active}
              onClick={() => setTab(tab === t.id ? null : t.id)}
            >
              <TabIcon name={t.icon as any} />
              <span>{t.name}</span>
              {pip}
            </button>
          );
        })}
      </div>
      <div className="flex flex-none items-stretch gap-1.5 max-sm:order-2 max-sm:grid max-sm:flex-[1_1_100%] max-sm:grid-cols-[1fr_1.15fr] max-sm:gap-1.5">
        <button
          type="button"
          className={`dock-dome flex flex-col justify-center gap-px rounded-md px-3 py-1.5 text-right text-xs font-semibold tracking-[.04em] whitespace-nowrap uppercase transition-colors duration-180 max-md:px-2.5 max-md:py-2 max-sm:px-2 max-sm:py-1.75 max-sm:text-left max-sm:text-xs ${tab === "bill" ? "active text-accent-lt" : "text-ink-soft hover:text-white"}`}
          id="billBtn"
          aria-expanded={tab === "bill"}
          onClick={() => setTab(tab === "bill" ? null : "bill")}
        >
          <span id="billLabel">Programme</span>
          <b
            id="billCost"
            className={`text-xs font-[650] tracking-[-.02em] normal-case max-md:text-xs ${tab === "bill" ? "text-accent-lt" : "text-white"}`}
          >
            {cl.length ? `${cl.length} · ${cost} cap` : "Empty"}
          </b>
        </button>
        <button
          type="button"
          className="box-border w-42 min-w-42 flex-none cursor-pointer rounded-md border-0 bg-[linear-gradient(180deg,#e8c988,#c9a05a)] px-4.5 py-2.5 text-center text-sm font-bold tracking-[.02em] whitespace-nowrap text-[#1a1408] uppercase shadow-[var(--spec),0_4px_16px_rgba(212,175,105,.4)] transition-[filter,transform] duration-180 hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-lt active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-g-1 disabled:bg-none disabled:text-ink-faint disabled:shadow-none disabled:filter-none disabled:active:scale-100 max-md:min-h-11 max-md:px-3 max-md:py-2.5 max-md:text-xs max-sm:w-full max-sm:min-w-0 max-sm:p-2.5 max-sm:text-xs max-sm:tracking-normal"
          id="deliverBtn"
          disabled={resolvedDisabled ?? undefined}
          title={resolvedTitle || undefined}
          onClick={onDeliver}
        >
          {resolvedLabel}
        </button>
      </div>
    </nav>
  );
}
