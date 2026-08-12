"use client";

import {
  billClauses,
  clausesIn,
  getNewsOpen,
  getTab,
  hasDiploAttention,
  newsUnreadCount,
  ongoingSituations,
  pendingUltimatumIds,
  setTab,
  toggleNewsOpen,
} from "../../lib/sim/engine.ts";
import { TabIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";

const RAIL_BTNS = [
  { id: "diplomacy", name: "Diplomacy", icon: "seal" as const },
  { id: "charts", name: "Charts", icon: "chart" as const },
];

/** Hover-only label popover, shared by every rail button so the treatment
 *  stays identical across News/Overview/Diplomacy/Charts. */
const POPOVER_CLS =
  "pointer-events-none absolute right-full mr-3 rounded-md border border-accent bg-panel px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-accent-lt opacity-0 shadow-spec transition-opacity duration-150 group-hover:opacity-100";

export function IconRail() {
  const G = useGame();
  const tab = getTab();
  const newsOpen = getNewsOpen();
  const cl = billClauses();
  const unread = newsUnreadCount();
  const diploAttn = hasDiploAttention(G);
  const diploUlt = pendingUltimatumIds(G).length > 0;
  const situations = ongoingSituations(G);
  const overviewActive = tab === "overview";

  return (
    <div
      id="iconRail"
      className="fixed top-1/2 right-0 z-20 flex -translate-y-1/2 flex-col items-end gap-1.5 py-5"
      aria-label="Overview, diplomacy, charts and news"
    >
      <div
        className="rail-panel absolute inset-y-0 right-0 -z-10 w-7"
        aria-hidden="true"
      />

      <button
        type="button"
        className={`rail-dome group relative grid size-11 flex-none cursor-pointer place-items-center rounded-full ${newsOpen ? "active" : ""}`}
        aria-label={`News${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={newsOpen}
        onClick={() => toggleNewsOpen()}
      >
        <span className={newsOpen ? "text-accent-lt" : "text-ink-faint"}>
          <TabIcon name="newspaper" />
        </span>
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-[#0c0805] bg-red px-0.75 text-[9px] leading-none font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        <span className={POPOVER_CLS}>News</span>
      </button>

      <button
        type="button"
        className={`rail-dome group relative grid size-11 flex-none cursor-pointer place-items-center rounded-full ${overviewActive ? "active" : ""}`}
        aria-label={`Overview${situations.length ? `, ${situations.length} ongoing` : ""}`}
        aria-expanded={overviewActive}
        onClick={() => setTab(overviewActive ? null : "overview")}
      >
        <span className={overviewActive ? "text-accent-lt" : "text-ink-faint"}>
          <TabIcon name="institution" />
        </span>
        {situations.length > 0 ? (
          <span className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-[#0c0805] bg-red px-0.75 text-[9px] leading-none font-bold text-white">
            {situations.length > 99 ? "99+" : situations.length}
          </span>
        ) : null}
        <span className={POPOVER_CLS}>Overview</span>
      </button>

      {RAIL_BTNS.map((b) => {
        const active = tab === b.id;
        const pip = b.id === "diplomacy" ? diploAttn : clausesIn(b.id, cl);
        return (
          <button
            key={b.id}
            type="button"
            className={`rail-dome group relative grid size-11 flex-none cursor-pointer place-items-center rounded-full ${active ? "active" : ""}`}
            aria-label={b.name}
            aria-expanded={active}
            onClick={() => setTab(tab === b.id ? null : b.id)}
          >
            <span className={active ? "text-accent-lt" : "text-ink-faint"}>
              <TabIcon name={b.icon} />
            </span>
            {pip ? (
              <span
                className={`absolute top-0.5 right-0.5 size-2 rounded-full border border-[#0c0805] ${
                  b.id === "diplomacy" && diploUlt ? "bg-red" : "bg-amber"
                }`}
              />
            ) : null}
            <span className={POPOVER_CLS}>{b.name}</span>
          </button>
        );
      })}
    </div>
  );
}
