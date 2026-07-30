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
        <div className="stamp" id="dpStamp" />
        <h3 id="dpTitle" />
      </header>
      <div className="body" id="dpBody" />
      <div className="opts" id="dpOpts" />
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
              <div className="stamp" id="dpStamp">{open.stamp}</div>
              <h3 id="dpTitle">{open.title}</h3>
            </header>
            <div className="body" id="dpBody">
              <SafeHtml html={open.body} />
            </div>
            <div className="opts" id="dpOpts">
              {open.opts.map((o: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  className="opt"
                  onClick={() => {
                    closeDespatch();
                    o.f();
                  }}
                >
                  <b>{T(o.b)}</b>
                  {o.e ? <em>{T(o.e)}</em> : null}
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
