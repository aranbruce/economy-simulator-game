"use client";

import type { CSSProperties } from "react";
import {
  closeFocusedPress,
  expandPress,
  getNewsOpen,
  getPressExpanded,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";

function ClipBody({ c }: { c: any }) {
  return (
    <>
      <div className="clip-mast mb-0.5 text-xs font-bold tracking-[.14em] text-paper-ink-faint uppercase">
        {c.masthead}
      </div>
      <div className="clip-kick mb-1.75 border-b border-paper-border/18 pb-1.25 text-xs text-[#8a7a5a]">
        {c.kicker}
      </div>
      <h4 className="clip-hed mb-1.5 font-display text-base leading-[1.2] font-normal tracking-[-.01em] text-[#14120e]">
        {c.headline}
      </h4>
      <p className="clip-lede m-0 text-xs leading-[1.4] text-paper-ink-soft">
        {c.lede}
      </p>
    </>
  );
}

export function PressLayer() {
  const G = useGame();
  const open = getNewsOpen();
  if (!open) return null;

  const clips = G?.press || [];
  const expandedId = getPressExpanded();
  const focused = expandedId && clips.find((c: any) => c.id === expandedId);
  const ordered = clips.slice().reverse();

  return (
    <>
      {/* No backdrop, no card — clippings float directly over the map, same
          as before they were gated behind News, just shown on demand now.
          Vertically centred on the screen, beside the icon rail. Hidden
          outright while a clip is focused, rather than just relying on the
          focused view's backdrop, since the list sits outside the focused
          view's z-index stack and would otherwise show through beside it. */}
      {!focused && (
        <div
          id="pressLayer"
          className="pointer-events-none fixed top-1/2 right-14 z-40 max-h-[60vh] w-[min(280px,46vw)] -translate-y-1/2 flex-col justify-center gap-3 space-y-2 overflow-scroll px-8 py-12 max-md:right-12 max-md:max-w-[min(220px,44vw)]"
          aria-live="polite"
        >
          {ordered.length === 0 ? (
            <div className="m-0 rounded-sm border border-paper-border/28 bg-(image:--paper-gradient) px-3.5 py-3 text-sm text-paper-ink shadow-[0_12px_32px_rgba(0,0,0,.48),0_1px_0_rgba(255,255,255,.5)_inset]">
              Nothing yet this term.
            </div>
          ) : (
            ordered.map((c: any, i: number) => (
              <article
                key={c.id}
                className="clipping relative"
                data-id={c.id}
                style={
                  {
                    "--clip-rot": `${(c.rot != null ? c.rot : 0).toFixed(2)}deg`,
                    "--clip-delay": `${(i * 0.04).toFixed(2)}s`,
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
                {!c.seen ? (
                  <span
                    className="absolute top-2.5 right-2.5 size-2 rounded-full bg-paper-red"
                    aria-hidden="true"
                  />
                ) : null}
                <ClipBody c={c} />
              </article>
            ))
          )}
        </div>
      )}
      {focused ? (
        <div
          className="press-focus"
          role="dialog"
          aria-modal="true"
          aria-label="Newspaper clipping"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFocusedPress();
          }}
        >
          <article
            className="clipping clipping-focus relative"
            style={
              {
                "--clip-rot": `${(focused.rot != null ? focused.rot : -1).toFixed(2)}deg`,
              } as CSSProperties
            }
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute top-2.5 right-2.5 grid size-7 cursor-pointer place-items-center rounded-full border border-paper-border/22 bg-paper-border/6 text-paper-ink-faint transition duration-160 hover:bg-paper-border/14 hover:text-paper-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.94]"
              onClick={(e) => {
                e.stopPropagation();
                closeFocusedPress();
              }}
            >
              <CloseIcon />
            </button>
            <ClipBody c={focused} />
          </article>
        </div>
      ) : null}
    </>
  );
}
