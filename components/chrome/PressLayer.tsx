"use client";

import type { CSSProperties } from "react";
import {
  closeFocusedPress,
  discardPress,
  expandPress,
  getNewsOpen,
  getPressExpanded,
  T,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";
import { ImpactChips, ImpactFactions } from "../ui/ImpactChips.tsx";
import { SafeHtml } from "../ui/SafeHtml.tsx";

const clipCloseBtnClass =
  "absolute top-2 right-2 z-1 grid size-7 cursor-pointer place-items-center rounded-full border border-paper-border/35 bg-paper-bg/80 text-paper-ink shadow-[0_1px_0_rgba(255,255,255,.45)_inset] transition duration-160 hover:bg-paper-border/14 hover:text-paper-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.94]";

const choiceBtnClass =
  "cursor-pointer rounded-md border border-l-3 border-paper-border/22 border-l-paper-border/35 bg-paper-border/4.5 px-3.25 py-2.75 text-left font-sans text-sm text-paper-ink transition duration-160 hover:border-l-paper-accent hover:bg-paper-border/9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-accent active:scale-[0.99] max-md:min-h-11 max-md:p-3";

type PressClipOpt = {
  b: string;
  e?: string;
  hint?: string;
  immediate?: any;
  chips?: any;
  factions?: any;
  f: () => void;
};

type PressClip = {
  id: string;
  masthead: string;
  kicker: string;
  headline: string;
  lede: string;
  rot?: number;
  seen?: boolean;
  pendingChoice?: boolean;
  opts?: PressClipOpt[] | null;
};

function ClipBody({ c }: { c: PressClip }) {
  return (
    <>
      <div className="clip-mast mb-0.5 pr-8 text-xs font-bold tracking-[.14em] text-paper-ink-faint uppercase">
        {c.masthead}
      </div>
      <div className="clip-kick mb-1.75 border-b border-paper-border/18 pb-1.25 text-xs text-paper-ink-faint">
        {c.kicker}
      </div>
      <h4 className="clip-hed mb-1.5 font-display text-base leading-[1.2] font-normal tracking-[-.01em] text-paper-ink">
        {c.headline}
      </h4>
      <p className="clip-lede m-0 text-xs leading-[1.4] text-paper-ink-soft">
        {c.lede}
      </p>
    </>
  );
}

function ClipChoices({ opts }: { opts: PressClipOpt[] }) {
  return (
    <div className="mt-3.5 grid gap-1.5">
      {opts.map((o, i) => (
        <button
          key={i}
          type="button"
          className={choiceBtnClass}
          onClick={(e) => {
            e.stopPropagation();
            o.f();
          }}
        >
          <b className="block font-[650] tracking-[-.02em]">{T(o.b)}</b>
          {o.e ? (
            <em className="mt-0.75 block text-xs text-paper-ink-soft not-italic">
              {T(o.e)}
            </em>
          ) : null}
          {o.hint ? <SafeHtml html={o.hint} /> : null}
          {o.immediate ? (
            <div className="mt-1.5">
              <ImpactChips chips={o.immediate} paper />
            </div>
          ) : null}
          {o.chips ? (
            <div className={o.immediate ? "mt-1" : "mt-1.5"}>
              <ImpactChips chips={o.chips} paper />
            </div>
          ) : null}
          {o.factions ? <ImpactFactions factions={o.factions} paper /> : null}
        </button>
      ))}
    </div>
  );
}

export function PressLayer() {
  const G = useGame();
  const open = getNewsOpen();
  if (!open) return null;

  const clips: PressClip[] = G?.press || [];
  const expandedId = getPressExpanded();
  const focused = expandedId && clips.find((c) => c.id === expandedId);
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
          className="pointer-events-none fixed top-1/2 right-14 z-40 flex max-h-[60vh] w-[min(280px,46vw)] -translate-y-1/2 scrollbar-none flex-col overflow-y-auto px-8 py-12 max-md:right-12 max-md:max-w-[min(220px,44vw)]"
          aria-live="polite"
        >
          {/* my-auto centres a short stack; when the list overflows, the
              margins collapse to 0 so scrollTop=0 reaches the first clip
              (justify-center on the scroll container itself would clip
              the top and make it unreachable). */}
          <div className="my-auto flex flex-col gap-3">
            {ordered.length === 0
              ? null
              : ordered.map((c, i) => (
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
                  >
                    {c.pendingChoice ? null : (
                    <button
                      type="button"
                      aria-label="Discard clipping"
                      className={clipCloseBtnClass}
                      onClick={(e) => {
                        e.stopPropagation();
                        discardPress(c.id);
                      }}
                    >
                      <CloseIcon />
                    </button>
                    )}
                    <div
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
                          className="absolute top-2.5 left-2.5 size-2 rounded-full bg-paper-red"
                          aria-hidden="true"
                        />
                      ) : null}
                      <ClipBody c={c} />
                    </div>
                  </article>
                ))}
          </div>
        </div>
      )}
      {focused ? (
        <div
          className="press-focus"
          role="dialog"
          aria-modal="true"
          aria-label="Newspaper clipping"
          style={focused.pendingChoice ? { zIndex: 50 } : undefined}
          onClick={(e) => {
            if (e.target === e.currentTarget && !focused.pendingChoice)
              closeFocusedPress();
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
            {focused.pendingChoice ? null : (
              <button
                type="button"
                aria-label="Discard clipping"
                className={clipCloseBtnClass}
                onClick={(e) => {
                  e.stopPropagation();
                  discardPress(focused.id);
                }}
              >
                <CloseIcon />
              </button>
            )}
            <ClipBody c={focused} />
            {focused.pendingChoice && focused.opts && focused.opts.length ? (
              <ClipChoices opts={focused.opts} />
            ) : null}
          </article>
        </div>
      ) : null}
    </>
  );
}
