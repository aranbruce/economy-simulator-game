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
      className="fixed inset-x-2.5 top-3.5 z-20 flex items-center gap-3.5 max-[720px]:top-[max(6px,env(safe-area-inset-top))] max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:flex-wrap max-[720px]:gap-1.5"
    >
      {/* Crest and name float directly over the map, no card behind them —
          only the stat card (TopBarStats, below) keeps a panel background. */}
      <div className="flex flex-none items-center gap-2.25 max-[720px]:min-w-0 max-[720px]:flex-[1_1_auto]">
        <span
          className="grid size-9 flex-none place-items-center overflow-hidden rounded-full border-2 border-accent shadow-[0_3px_10px_rgba(0,0,0,.55)] max-[720px]:size-7 max-[380px]:hidden"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagSrc(realmId)}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span className="text-[#241a0c] [text-shadow:0_1px_3px_rgba(255,251,238,.8),0_0_10px_rgba(255,251,238,.5)] text-[16px] leading-[1.1] font-semibold tracking-[-.02em] whitespace-nowrap max-[720px]:min-w-0 max-[720px]:text-sm max-[540px]:text-[13px]">
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
              className="cursor-text rounded border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-inherit transition-[background] duration-150 hover:bg-g-1 hover:shadow-[0_0_0_4px_var(--g-1)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent max-[720px]:max-w-[42vw] max-[720px]:overflow-hidden max-[720px]:text-ellipsis"
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
