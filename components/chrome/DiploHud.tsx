"use client";

import { diploHudChips, getTab, setTab } from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";

export function DiploHud() {
  const G = useGame();
  const chips = diploHudChips(G);
  if (!chips.length) return null;

  const openDiplomacy = () => {
    if (getTab() !== "diplomacy") setTab("diplomacy");
  };

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
      onClick={openDiplomacy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiplomacy();
        }
      }}
    >
      {chips.map((c: any, i: number) => (
        <span key={i} className={`diplo-hud-chip ${c.kind}`} title={c.title}>
          {c.name}
          {c.kind === "ult" ? ` · ${c.label} ` : " · visit "}
          <b>{c.left}Q</b>
        </span>
      ))}
    </div>
  );
}
