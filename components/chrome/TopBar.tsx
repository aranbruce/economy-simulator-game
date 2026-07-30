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
    <header id="topbar" className="hud-frame">
      <div className="tb-id">
        <span className="tb-crest">&#9878;</span>
        <span className="tb-name">
          {editing ? (
            <input
              type="text"
              id="nameInput"
              value={draftName}
              maxLength={34}
              aria-label="Name of your country"
              autoFocus
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
        <div id="tbMode" className="tb-mode" aria-label="Game mode">
          <button
            type="button"
            className="mode-toggle"
            id="modeCareer"
            aria-pressed={!G.sandbox}
            onClick={() => setSandboxMode(false)}
          >
            Career
          </button>
          <button
            type="button"
            className="mode-toggle"
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
