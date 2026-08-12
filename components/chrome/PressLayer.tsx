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
          Anchored beside the rail's News dome (top-[calc(50%-96px)] lines
          up with that button's vertical centre) rather than the bottom
          corner. Hidden outright while a clip is focused, rather than just
          relying on the focused view's backdrop, since the list sits
          outside the focused view's z-index stack and would otherwise show
          through beside it. */}
      {!focused && (
        <div
          id="pressLayer"
          className="pointer-events-none fixed top-[calc(50%-96px)] right-14 z-40 flex max-h-[70vh] w-[min(280px,46vw)] flex-col gap-3 overflow-y-auto p-4 max-[720px]:right-12 max-[720px]:max-w-[min(220px,44vw)]"
          aria-live="polite"
        >
          {ordered.length === 0 ? (
            <p className="m-0 text-[13px] text-ink-soft [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
              Nothing yet this term.
            </p>
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
                    marginLeft: 0,
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
                    className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#a4392b]"
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
              className="absolute top-2.5 right-2.5 grid size-7 cursor-pointer place-items-center rounded-full border border-[rgba(40,32,18,.22)] bg-[rgba(40,32,18,.06)] text-[#6b5c3e] transition duration-160 hover:bg-[rgba(40,32,18,.14)] hover:text-[#1a1814] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.94]"
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
