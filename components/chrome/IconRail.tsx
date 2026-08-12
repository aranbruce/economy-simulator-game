"use client";

import {
  TABS,
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

/** Hover-only label popover, shared by every rail button so the treatment
 *  stays identical across News/Overview/Diplomacy/Charts. */
const POPOVER_CLS =
  "pointer-events-none absolute right-full mr-3 rounded-md border border-accent bg-panel px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-accent-lt opacity-0 shadow-spec transition-opacity duration-150 group-hover:opacity-100";

/* TABS (engine.ts) is the one place tab name/icon metadata is authored —
   Dock.tsx already filters it down to render its own half; the rail reads
   its two entries back out rather than re-declaring "Diplomacy"/"seal" and
   "Charts"/"chart" a second time. */
const diploTab = TABS.find((t) => t.id === "diplomacy")!;
const chartsTab = TABS.find((t) => t.id === "charts")!;

type RailIcon = Parameters<typeof TabIcon>[0]["name"];
/** The News/Overview badges show a live count; Diplomacy/Charts show a
 *  plain attention pip (colour only, no number). */
type RailBadge =
  | { kind: "count"; value: number }
  | { kind: "pip"; color: "red" | "amber" }
  | null;

interface RailBtnDef {
  id: string;
  name: string;
  icon: RailIcon;
  active: boolean;
  ariaLabel: string;
  badge: RailBadge;
  onClick: () => void;
}

export function IconRail() {
  const G = useGame();
  const tab = getTab();
  const newsOpen = getNewsOpen();
  const unread = newsUnreadCount();
  /* diploUlt short-circuits diploAttn past its own internal
     pendingUltimatumIds() check whenever there's already an ultimatum,
     instead of computing the same list twice. */
  const diploUlt = pendingUltimatumIds(G).length > 0;
  const diploAttn = diploUlt || hasDiploAttention(G);
  const situations = ongoingSituations(G);
  const overviewActive = tab === "overview";

  const btns: RailBtnDef[] = [
    {
      id: "news",
      name: "News",
      icon: "newspaper",
      active: newsOpen,
      ariaLabel: `News${unread ? `, ${unread} unread` : ""}`,
      badge: unread > 0 ? { kind: "count", value: unread } : null,
      onClick: () => toggleNewsOpen(),
    },
    {
      id: "overview",
      name: "Overview",
      icon: "institution",
      active: overviewActive,
      ariaLabel: `Overview${situations.length ? `, ${situations.length} ongoing` : ""}`,
      badge:
        situations.length > 0
          ? { kind: "count", value: situations.length }
          : null,
      onClick: () => setTab(overviewActive ? null : "overview"),
    },
    {
      id: "diplomacy",
      name: diploTab.name,
      icon: diploTab.icon as RailIcon,
      active: tab === "diplomacy",
      ariaLabel: diploTab.name,
      badge: diploAttn
        ? { kind: "pip", color: diploUlt ? "red" : "amber" }
        : null,
      onClick: () => setTab(tab === "diplomacy" ? null : "diplomacy"),
    },
    {
      id: "charts",
      name: chartsTab.name,
      icon: chartsTab.icon as RailIcon,
      active: tab === "charts",
      ariaLabel: chartsTab.name,
      /* No clause is ever tagged tab: "charts" (nothing in Charts is
         staged/enacted through the bill — it's read-only), so this button
         never has a pip to show. Avoids running billClauses()'s full
         draft-vs-law diff on every render just to confirm that. */
      badge: null,
      onClick: () => setTab(tab === "charts" ? null : "charts"),
    },
  ];

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

      {btns.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`rail-dome group relative grid size-11 flex-none cursor-pointer place-items-center rounded-full ${b.active ? "active" : ""}`}
          aria-label={b.ariaLabel}
          aria-expanded={b.active}
          onClick={b.onClick}
        >
          <span className={b.active ? "text-accent-lt" : "text-ink-faint"}>
            <TabIcon name={b.icon} />
          </span>
          {b.badge?.kind === "count" ? (
            <span className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-[#0c0805] bg-red px-0.75 text-[9px] leading-none font-bold text-white">
              {b.badge.value > 99 ? "99+" : b.badge.value}
            </span>
          ) : b.badge?.kind === "pip" ? (
            <span
              className={`absolute top-0.5 right-0.5 size-2 rounded-full border border-[#0c0805] ${
                b.badge.color === "red" ? "bg-red" : "bg-amber"
              }`}
            />
          ) : null}
          <span className={POPOVER_CLS}>{b.name}</span>
        </button>
      ))}
    </div>
  );
}
