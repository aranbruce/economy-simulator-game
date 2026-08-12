"use client";

import {
  billClauses,
  clausesIn,
  electionQuartersLeft,
  electionThermometer,
  getNewsOpen,
  getTab,
  hasDiploAttention,
  newsUnreadCount,
  pendingUltimatumIds,
  polityOf,
  reviewNoun,
  setTab,
  toggleNewsOpen,
} from "../../lib/sim/engine.ts";
import { TabIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";

const RAIL_BTNS = [
  { id: "overview", name: "Overview", icon: "institution" as const },
  { id: "diplomacy", name: "Diplomacy", icon: "seal" as const },
  { id: "charts", name: "Charts", icon: "chart" as const },
];

export function IconRail() {
  const G = useGame();
  const tab = getTab();
  const newsOpen = getNewsOpen();
  const cl = billClauses();
  const unread = newsUnreadCount();
  const left = electionQuartersLeft();
  const therm = electionThermometer();
  const noun = reviewNoun();
  const electionAtRisk = left <= 4 && therm <= polityOf().loseAt;
  const diploAttn = hasDiploAttention(G);
  const diploUlt = pendingUltimatumIds(G).length > 0;

  return (
    <div
      id="iconRail"
      className="fixed top-1/2 right-0 z-20 flex -translate-y-1/2 flex-col items-end gap-1.5 py-5"
      aria-label="Overview, diplomacy, charts and news"
    >
      <div className="rail-panel absolute inset-y-0 right-0 -z-10 w-7" aria-hidden="true" />

      <button
        type="button"
        className={`rail-dome grid size-11 flex-none cursor-pointer place-items-center rounded-full ${newsOpen ? "active" : ""}`}
        aria-label={`News${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={newsOpen}
        onClick={() => toggleNewsOpen()}
      >
        <span className="flex flex-col items-center">
          <span className="font-display text-sm leading-none font-normal text-accent-lt">
            {unread}
          </span>
          <span
            className={`mt-0.5 text-[5.5px] font-bold tracking-[.07em] uppercase ${newsOpen ? "text-accent-lt" : "text-ink-faint"}`}
          >
            News
          </span>
        </span>
      </button>

      <div
        className="rail-dome relative grid size-11 flex-none place-items-center rounded-full"
        title={
          left <= 4
            ? `${noun} in ${left}Q · score ~${therm.toFixed(0)}${electionAtRisk ? " (at risk)" : ""}`
            : `${noun} in ${left} quarter${left === 1 ? "" : "s"}`
        }
      >
        <span className="flex flex-col items-center">
          <span className="font-display text-sm leading-none font-normal text-accent-lt">
            {left}
          </span>
          <span className="mt-0.5 text-[5.5px] font-bold tracking-[.07em] text-ink-faint uppercase">
            {noun}
          </span>
        </span>
        {electionAtRisk ? (
          <span className="absolute top-0.5 right-0.5 size-2 rounded-full border border-[#0c0805] bg-red" />
        ) : null}
      </div>

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
            <span className="pointer-events-none absolute right-full mr-3 rounded-md border border-accent bg-panel px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-accent-lt opacity-0 shadow-spec transition-opacity duration-150 group-hover:opacity-100">
              {b.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
