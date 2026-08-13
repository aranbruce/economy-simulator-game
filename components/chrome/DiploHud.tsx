"use client";

import { diploHudChips, getTab, setTab } from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";

const CHIP_KIND_STYLES: Record<string, string> = {
  ult: "text-white bg-red/18 border-red/35",
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

  const belowMp = !!(G.mp && G.mp.humanCount);

  return (
    <div
      id="diploHud"
      className={`diplo-hud hud-frame hud-surface fixed left-1/2 z-15 flex max-w-[min(96vw,720px)] -translate-x-1/2 cursor-pointer flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 text-xs leading-[1.35] tabular-nums transition-[filter,transform] duration-160 hover:brightness-[1.08] active:scale-[0.98] max-md:max-w-[calc(100vw-12px)] ${
        belowMp
          ? "below-mp top-[calc(10px+env(safe-area-inset-top,0px)+88px+38px)] max-md:top-[calc(max(6px,env(safe-area-inset-top,0px))+140px+38px)]"
          : "top-[calc(10px+env(safe-area-inset-top,0px)+88px)] max-md:top-[calc(max(6px,env(safe-area-inset-top,0px))+140px)]"
      }`}
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
          {c.name} · {c.label}{" "}
          <b className="font-bold tabular-nums">{c.left}Q</b>
        </span>
      ))}
    </div>
  );
}
