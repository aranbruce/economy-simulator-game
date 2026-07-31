"use client";

import { memo, useEffect, useState } from "react";
import {
  closeDespatch,
  getDespatch,
  setOnDespatchChange,
  setOnDespatchShell,
  T,
} from "../../lib/sim/engine.ts";
import { SafeHtml } from "../ui/SafeHtml.tsx";

/** Empty shell for engine-driven modals (bloc founding / member invite). */
const ImperativeDespatchFrame = memo(function ImperativeDespatchFrame() {
  return (
    <>
      <header>
        <div className="text-[10px] font-bold tracking-[.14em] text-accent-lt uppercase" id="dpStamp" />
        <h3 id="dpTitle" />
      </header>
      <div className="body" id="dpBody" />
      <div className="grid gap-1.75 px-5 pt-1.5 pb-5 max-[720px]:gap-1.5 max-[720px]:px-3.5 max-[720px]:pt-1 max-[720px]:pb-4" id="dpOpts" />
    </>
  );
});

export function DespatchModal() {
  const [open, setOpen] = useState<any>(null);
  const [shellOpen, setShellOpen] = useState(false);

  useEffect(() => {
    setOnDespatchChange((v: any) => {
      setOpen(v);
      if (v) setShellOpen(true);
      else setShellOpen(false);
    });
    setOnDespatchShell(setShellOpen);
    return () => {
      setOnDespatchChange(null);
      setOnDespatchShell(null);
    };
  }, []);

  useEffect(() => {
    const pending = getDespatch();
    if (pending) {
      setOpen(pending);
      setShellOpen(true);
    }
  }, []);

  if (!open && !shellOpen) return null;

  return (
    <div className="scrim" id="scrim">
      <div
        className="despatch hud-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpTitle"
      >
        {open ? (
          <>
            <header>
              <div className="text-[10px] font-bold tracking-[.14em] text-accent-lt uppercase" id="dpStamp">
                {open.stamp}
              </div>
              <h3 id="dpTitle">{open.title}</h3>
            </header>
            <div className="body" id="dpBody">
              <SafeHtml html={open.body} />
            </div>
            <div className="grid gap-1.75 px-5 pt-1.5 pb-5 max-[720px]:gap-1.5 max-[720px]:px-3.5 max-[720px]:pt-1 max-[720px]:pb-4" id="dpOpts">
              {open.opts.map((o: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  className="cursor-pointer rounded-md border border-l-3 border-edge border-l-transparent bg-g-1 px-3.25 py-2.75 text-left font-sans text-sm text-white transition duration-160 hover:border-l-accent hover:bg-white/7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] max-[720px]:min-h-11 max-[720px]:p-3"
                  onClick={() => {
                    closeDespatch();
                    o.f();
                  }}
                >
                  <b className="block font-[650] tracking-[-.02em]">{T(o.b)}</b>
                  {o.e ? (
                    <em className="mt-0.75 block text-xs text-ink-soft not-italic">{T(o.e)}</em>
                  ) : null}
                  {o.hint ? <SafeHtml html={o.hint} /> : null}
                  {o.extra ? <SafeHtml html={o.extra} /> : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <ImperativeDespatchFrame />
        )}
      </div>
    </div>
  );
}
