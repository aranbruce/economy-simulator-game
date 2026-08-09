"use client";

import type { CSSProperties } from "react";
import {
  dismissPress,
  expandPress,
  getPressExpanded,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";

function ClipBody({ c }: { c: any }) {
  return (
    <>
      <div className="clip-mast mb-0.5 text-[9.5px] font-bold tracking-[.14em] text-[#6b5c3e] uppercase">
        {c.masthead}
      </div>
      <div className="clip-kick mb-1.75 border-b border-[rgba(40,32,18,.18)] pb-1.25 text-[10px] text-[#8a7a5a]">
        {c.kicker}
      </div>
      <h4 className="clip-hed mb-1.5 font-display text-base leading-[1.2] font-normal tracking-[-.01em] text-[#14120e]">
        {c.headline}
      </h4>
      <p className="clip-lede m-0 text-[11.5px] leading-[1.4] text-[#3a3428]">
        {c.lede}
      </p>
    </>
  );
}

export function PressLayer() {
  const G = useGame();
  const clips = G?.press || [];
  const expandedId = getPressExpanded();
  const focused = expandedId && clips.find((c: any) => c.id === expandedId);

  return (
    <div
      id="pressLayer"
      className={`pointer-events-none fixed bottom-25 left-3.5 flex max-w-[min(280px,46vw)] flex-col items-start gap-3 max-[720px]:bottom-[calc(128px+env(safe-area-inset-bottom,0px))] max-[720px]:left-[max(8px,env(safe-area-inset-left))] max-[720px]:max-w-[min(200px,42vw)] max-[720px]:gap-2 max-[540px]:bottom-[calc(116px+env(safe-area-inset-bottom,0px))] max-[540px]:max-w-[min(160px,38vw)] ${focused ? "is-focusing z-48" : "z-8"}`}
      aria-live="polite"
    >
      {clips.map((c: any, i: number) => {
        if (focused && c.id === focused.id) return null;
        const rot = (c.rot != null ? c.rot : 0).toFixed(2);
        const delay = (i * 0.05).toFixed(2);
        return (
          <article
            key={c.id}
            className="clipping"
            data-id={c.id}
            style={
              {
                "--clip-rot": `${rot}deg`,
                "--clip-delay": `${delay}s`,
              } as CSSProperties
            }
            role="button"
            tabIndex={0}
            aria-label="Open clipping"
            onClick={() => expandPress(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                expandPress(c.id);
              }
            }}
          >
            <ClipBody c={c} />
          </article>
        );
      })}
      {focused ? (
        <div
          className="press-focus"
          role="dialog"
          aria-modal="true"
          aria-label="Newspaper clipping"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissPress(focused.id);
          }}
        >
          <article
            className="clipping clipping-focus"
            style={
              {
                "--clip-rot": `${(focused.rot != null ? focused.rot : -1).toFixed(2)}deg`,
              } as CSSProperties
            }
          >
            <ClipBody c={focused} />
            <button
              type="button"
              className="mt-4.5 block w-full cursor-pointer rounded-sm border border-[rgba(40,32,18,.22)] bg-[rgba(40,32,18,.08)] px-3.5 py-2.5 font-sans text-[13px] font-semibold tracking-[.02em] text-[#1a1814] transition duration-160 hover:bg-[rgba(40,32,18,.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.985]"
              onClick={(e) => {
                e.stopPropagation();
                dismissPress(focused.id);
              }}
            >
              Dismiss
            </button>
          </article>
        </div>
      ) : null}
    </div>
  );
}
