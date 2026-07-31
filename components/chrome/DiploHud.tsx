"use client";

import { diploHudChips, getTab, setTab } from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";

const CHIP_KIND_STYLES: Record<string, string> = {
  ult: "text-white bg-red/18 border-red/35",
  visit: "text-[#1a1408] bg-accent-lt/22 border-accent-lt/40",
  concede: "text-[#e8fff0] bg-[#30D158]/20 border-[#30D158]/38",
  defy: "text-white bg-[#FF453A]/20 border-[#FF453A]/40",
};

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
        <span
          key={i}
          className={`inline-flex items-center gap-1.25 rounded-pill border px-2.25 py-1 font-semibold whitespace-nowrap ${CHIP_KIND_STYLES[c.kind] ?? "border-transparent"}`}
          title={c.title}
        >
          {c.name}
          {c.kind === "ult" ? ` · ${c.label} ` : " · visit "}
          <b className="font-bold tabular-nums">{c.left}Q</b>
        </span>
      ))}
    </div>
  );
}
