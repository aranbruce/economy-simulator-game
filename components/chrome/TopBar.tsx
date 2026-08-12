"use client";

import { useState } from "react";
import { setCountryName } from "../../lib/ui/actions.ts";
import { playerCountryId } from "../../lib/sim/engine.ts";
import { flagSrc } from "../../lib/ui/flags.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { TopBarStats, TopBarTerm } from "./TopBarStats.tsx";

export function TopBar() {
  const G = useGame();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(G.country);
  const realmId = playerCountryId(G.homeRole);

  const commitName = () => {
    setCountryName(draftName);
    setEditing(false);
  };

  return (
    <header
      id="topbar"
      className="fixed inset-x-2.5 top-3.5 z-20 flex items-center gap-4 max-md:top-[max(6px,env(safe-area-inset-top))] max-md:right-[max(6px,env(safe-area-inset-right))] max-md:left-[max(6px,env(safe-area-inset-left))] max-md:flex-wrap md:gap-3.5"
    >
      {/* Crest and name float directly over the map, no card behind them —
          only the stat card (TopBarStats, below) keeps a panel background. */}
      <div className="flex flex-none items-center gap-2.25 max-md:min-w-0 max-md:flex-[1_1_auto]">
        <span
          className="grid size-9 flex-none place-items-center overflow-hidden rounded-full border-2 border-accent shadow-[0_3px_10px_rgba(0,0,0,.55)] max-md:size-7 max-sm:hidden"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagSrc(realmId)}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span className="text-[16px] leading-[1.1] font-semibold tracking-[-.02em] whitespace-nowrap [text-shadow:0_1px_5px_rgba(0,0,0,.75)] max-md:min-w-0 max-md:text-sm max-sm:text-[13px]">
          {editing ? (
            <input
              type="text"
              id="nameInput"
              value={draftName}
              maxLength={34}
              aria-label="Name of your country"
              autoFocus
              className="w-[11ch] max-w-[44vw] min-w-0 rounded-md border border-edge bg-g-3 px-1.75 py-px font-[inherit] tracking-[inherit] text-white shadow-[0_2px_8px_rgba(0,0,0,.5)] focus:outline-2 focus:outline-offset-1 focus:outline-accent"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftName(G.country);
                  setEditing(false);
                }
              }}
              onBlur={commitName}
            />
          ) : (
            <button
              id="nameBtn"
              type="button"
              className="cursor-text rounded border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-inherit transition-[background] duration-150 hover:bg-g-1 hover:shadow-[0_0_0_4px_var(--g-1)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent max-md:max-w-[42vw] max-md:overflow-hidden max-md:text-ellipsis"
              onClick={() => {
                setDraftName(G.country);
                setEditing(true);
              }}
            >
              {G.country}
            </button>
          )}
          <TopBarTerm />
        </span>
      </div>
      <TopBarStats />
    </header>
  );
}
