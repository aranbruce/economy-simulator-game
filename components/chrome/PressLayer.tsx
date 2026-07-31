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
      <div className="clip-mast">{c.masthead}</div>
      <div className="clip-kick">{c.kicker}</div>
      <h4 className="clip-hed">{c.headline}</h4>
      <p className="clip-lede">{c.lede}</p>
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
      className={focused ? "is-focusing" : ""}
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
