"use client";

import { useState } from "react";
import { setSandboxMode, setCountryName } from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { TopBarStats, TopBarTerm } from "./TopBarStats.tsx";

export function TopBar() {
  const G = useGame();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(G.country);

  const commitName = () => {
    setCountryName(draftName);
    setEditing(false);
  };

  return (
    <header
      id="topbar"
      className="hud-frame hud-surface fixed top-2.5 right-2.5 left-2.5 z-20 flex items-center gap-2.5 py-1.5 pr-2 pl-2.5 max-[720px]:top-[max(6px,env(safe-area-inset-top))] max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:flex-wrap max-[720px]:gap-1.5 max-[720px]:p-2"
    >
      <div className="flex flex-none items-center gap-2.25 max-[720px]:min-w-0 max-[720px]:flex-[1_1_auto]">
        <span className="grid size-8 flex-none place-items-center rounded-sm border border-frame bg-accent-dim text-[15px] text-accent-lt shadow-spec max-[720px]:size-7 max-[720px]:text-[13px] max-[380px]:hidden">
          &#9878;
        </span>
        <span className="text-[15.5px] leading-[1.1] font-semibold tracking-[-.02em] whitespace-nowrap max-[720px]:min-w-0 max-[720px]:text-sm max-[540px]:text-[13px]">
          {editing ? (
            <input
              type="text"
              id="nameInput"
              value={draftName}
              maxLength={34}
              aria-label="Name of your country"
              autoFocus
              className="w-[11ch] max-w-[44vw] min-w-0 rounded-md border border-edge bg-g-3 px-1.75 py-0.25 font-[inherit] tracking-[inherit] text-white focus:outline-2 focus:outline-offset-1 focus:outline-accent"
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
        <div
          id="tbMode"
          className="ml-2 flex gap-0.5 rounded-sm bg-g-1 p-0.5"
          aria-label="Game mode"
        >
          <button
            type="button"
            className="cursor-pointer appearance-none rounded border-0 bg-transparent px-2 py-1.25 text-[10px] font-[650] tracking-[.06em] text-ink-faint uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
            id="modeCareer"
            aria-pressed={!G.sandbox}
            onClick={() => setSandboxMode(false)}
          >
            Career
          </button>
          <button
            type="button"
            className="cursor-pointer appearance-none rounded border-0 bg-transparent px-2 py-1.25 text-[10px] font-[650] tracking-[.06em] text-ink-faint uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
            id="modeSandbox"
            aria-pressed={!!G.sandbox}
            title="Cannot be removed from office"
            onClick={() => setSandboxMode(true)}
          >
            Sandbox
          </button>
        </div>
      </div>
      <TopBarStats />
    </header>
  );
}
