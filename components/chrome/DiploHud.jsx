"use client";

import { diploHudHtml, getTab, setTab } from "../../lib/sim/engine.js";
import { useGame } from "../../lib/ui/useGame.js";

export function DiploHud() {
  const G = useGame();
  const html = diploHudHtml(G);
  if (!html) return null;

  return (
    <div
      id="diploHud"
      className={
        "diplo-hud hud-frame hud-surface" +
        (G.mp && G.mp.humanCount ? " below-mp" : "")
      }
      role="button"
      tabIndex={0}
      aria-label="Active diplomacy"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={() => {
        if (getTab() !== "diplomacy") setTab("diplomacy");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (getTab() !== "diplomacy") setTab("diplomacy");
        }
      }}
    />
  );
}
