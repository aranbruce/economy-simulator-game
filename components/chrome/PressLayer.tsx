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
              className="clip-dismiss"
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
