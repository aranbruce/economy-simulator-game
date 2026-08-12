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

/** Hover-only label popover, shared by every rail button so the treatment
 *  stays identical across News/Overview/Diplomacy/Charts. */
const POPOVER_CLS =
  "pointer-events-none absolute right-full mr-3 rounded-md border border-accent bg-panel px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-accent-lt opacity-0 shadow-spec transition-opacity duration-150 group-hover:opacity-100";

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
  const cl = billClauses();
  const unread = newsUnreadCount();
  const diploAttn = hasDiploAttention(G);
  const diploUlt = pendingUltimatumIds(G).length > 0;
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
      name: "Diplomacy",
      icon: "seal",
      active: tab === "diplomacy",
      ariaLabel: "Diplomacy",
      badge: diploAttn
        ? { kind: "pip", color: diploUlt ? "red" : "amber" }
        : null,
      onClick: () => setTab(tab === "diplomacy" ? null : "diplomacy"),
    },
    {
      id: "charts",
      name: "Charts",
      icon: "chart",
      active: tab === "charts",
      ariaLabel: "Charts",
      badge: clausesIn("charts", cl) ? { kind: "pip", color: "amber" } : null,
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
