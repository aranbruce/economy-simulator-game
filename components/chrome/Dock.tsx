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

  return (
    <nav id="dock" aria-label="Government">
      <div className="dock-tabs" id="dockTabs">
        {TABS.map((t) => {
          let pip = null;
          if (clausesIn(t.id, cl)) pip = <span className="pip" />;
          else if (t.id === "diplomacy" && hasDiploAttention(G)) {
            pip = (
              <span
                className={pendingUltimatumIds(G).length ? "pip ult" : "pip"}
              />
            );
          }
          return (
            <button
              key={t.id}
              type="button"
              className="dock-btn"
              data-tab={t.id}
              aria-label={t.name}
              aria-expanded={t.id === tab}
              onClick={() => setTab(tab === t.id ? null : t.id)}
            >
              <TabIcon name={t.icon as any} />
              <span>{t.name}</span>
              {pip}
            </button>
          );
        })}
      </div>
      <div className="dock-act">
        <button
          type="button"
          className="dock-bill"
          id="billBtn"
          aria-expanded={tab === "bill"}
          onClick={() => setTab(tab === "bill" ? null : "bill")}
        >
          <span id="billLabel">Programme</span>
          <b id="billCost">
            {cl.length ? `${cl.length} · ${cost} cap` : "Empty"}
          </b>
        </button>
        <button
          type="button"
          className="dock-go"
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
