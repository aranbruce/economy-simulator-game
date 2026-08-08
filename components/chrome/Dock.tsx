"use client";

import {
  TABS,
  billClauses,
  clausesIn,
  capitalShortfallHint,
  getTab,
  hasDiploAttention,
  isDeliverLocked,
  pendingUltimatumIds,
  setTab,
} from "../../lib/sim/engine.ts";
import { TabIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";

function billCost() {
  return billClauses().reduce((a, c) => a + (c.sunk ? 0 : c.pc), 0);
}

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
  const cost = billCost();
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
    "absolute top-1 right-1.75 size-1.5 rounded-full bg-amber shadow-[0_0_0_2px_rgba(0,0,0,.35)] max-[540px]:top-1.25 max-[540px]:right-1.25";
  const pipUlt =
    "absolute top-1 right-1.75 size-1.5 rounded-full bg-red shadow-[0_0_0_2px_rgba(0,0,0,.35),0_0_8px_rgba(255,90,78,.55)] max-[540px]:top-1.25 max-[540px]:right-1.25";

  return (
    <nav
      id="dock"
      aria-label="Government"
      className="hud-surface fixed right-2.5 bottom-2.5 left-2.5 z-20 flex items-center gap-2 p-1.5 max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:bottom-[max(6px,env(safe-area-inset-bottom))] max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:flex-wrap max-[720px]:gap-1.5"
    >
      <div
        className="flex min-w-0 flex-1 scrollbar-none gap-0.75 overflow-x-auto max-[720px]:order-1 max-[720px]:flex-[1_1_100%] max-[720px]:flex-wrap max-[720px]:justify-center max-[720px]:gap-1 max-[720px]:overflow-x-visible max-[720px]:pb-0 max-[540px]:justify-center max-[540px]:gap-0.5"
        id="dockTabs"
      >
        {TABS.map((t) => {
          let pip = null;
          if (clausesIn(t.id, cl)) pip = <span className={pipBase} />;
          else if (t.id === "diplomacy" && hasDiploAttention(G)) {
            pip = (
              <span
                className={pendingUltimatumIds(G).length ? pipUlt : pipBase}
              />
            );
          }
          return (
            <button
              key={t.id}
              type="button"
              className="relative flex min-w-[58px] flex-none flex-col items-center gap-0.5 rounded-md border-0 bg-transparent px-3 py-1.75 text-[10px] font-semibold tracking-[.02em] text-ink-soft uppercase transition-[background,color,transform,box-shadow] duration-180 ease-[cubic-bezier(.2,.9,.3,1)] hover:-translate-y-px hover:bg-g-1 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.94] aria-expanded:bg-[linear-gradient(180deg,rgba(232,201,136,.95),rgba(212,175,105,.88))] aria-expanded:text-[#1a1408] aria-expanded:shadow-[var(--spec),0_4px_16px_rgba(212,175,105,.35)] max-[720px]:min-h-11 max-[720px]:min-w-11 max-[720px]:justify-center max-[720px]:px-2.5 max-[720px]:py-1.5 max-[720px]:text-[9px] max-[540px]:relative max-[540px]:min-w-[42px] max-[540px]:px-2.25 max-[540px]:py-2"
              data-tab={t.id}
              aria-label={t.name}
              aria-expanded={t.id === tab}
              onClick={() => setTab(tab === t.id ? null : t.id)}
            >
              <TabIcon name={t.icon as any} />
              <span className="max-[540px]:sr-only">{t.name}</span>
              {pip}
            </button>
          );
        })}
      </div>
      <div className="flex flex-none items-stretch gap-1.5 max-[720px]:order-2 max-[720px]:grid max-[720px]:flex-[1_1_100%] max-[720px]:grid-cols-[1fr_1.15fr] max-[720px]:gap-1.5">
        <button
          type="button"
          className="flex flex-col justify-center gap-px rounded-md border border-edge bg-g-1 px-3 py-1.5 text-right text-[9.5px] font-semibold tracking-[.04em] whitespace-nowrap text-ink-soft uppercase shadow-spec transition-[background,color,border-color] duration-180 hover:border-frame hover:bg-g-3 aria-expanded:border-frame aria-expanded:bg-accent-dim aria-expanded:text-accent-lt max-[720px]:px-2.5 max-[720px]:py-2 max-[720px]:text-left max-[540px]:px-2 max-[540px]:py-1.75 max-[540px]:text-[8.5px]"
          id="billBtn"
          aria-expanded={tab === "bill"}
          onClick={() => setTab(tab === "bill" ? null : "bill")}
        >
          <span id="billLabel">Programme</span>
          <b
            id="billCost"
            className={`text-[12.5px] font-[650] tracking-[-.02em] normal-case max-[720px]:text-xs ${tab === "bill" ? "text-accent-lt" : "text-white"}`}
          >
            {cl.length ? `${cl.length} · ${cost} cap` : "Empty"}
          </b>
        </button>
        <button
          type="button"
          className="box-border w-42 min-w-42 flex-none cursor-pointer rounded-md border-0 bg-[linear-gradient(180deg,#e8c988,#c9a05a)] px-4.5 py-2.5 text-center text-[13px] font-bold tracking-[.02em] whitespace-nowrap text-[#1a1408] uppercase shadow-[var(--spec),0_4px_16px_rgba(212,175,105,.4)] transition-[filter,transform] duration-180 hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-lt active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-g-1 disabled:text-ink-faint disabled:shadow-none disabled:filter-none disabled:active:scale-100 max-[720px]:min-h-11 max-[720px]:w-full max-[720px]:min-w-0 max-[720px]:px-3 max-[720px]:py-2.5 max-[720px]:text-xs max-[540px]:w-full max-[540px]:min-w-0 max-[540px]:px-2.5 max-[540px]:py-2.5 max-[540px]:text-[11.5px] max-[380px]:tracking-normal"
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
