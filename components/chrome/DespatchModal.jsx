"use client";

import { memo, useEffect, useState } from "react";
import {
  closeDespatch,
  esc,
  getDespatch,
  setOnDespatchChange,
  setOnDespatchShell,
  T,
} from "../../lib/sim/engine.js";

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
  const [open, setOpen] = useState(null);
  const [shellOpen, setShellOpen] = useState(false);

  useEffect(() => {
    setOnDespatchChange((v) => {
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
            <div
              className="body"
              id="dpBody"
              dangerouslySetInnerHTML={{ __html: open.body }}
            />
            <div className="opts" id="dpOpts">
              {open.opts.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  className="opt"
                  dangerouslySetInnerHTML={{
                    __html:
                      "<b>" +
                      T(esc(o.b)) +
                      "</b>" +
                      (o.e ? "<em>" + T(esc(o.e)) + "</em>" : "") +
                      (o.hint || "") +
                      o.extra,
                  }}
                  onClick={() => {
                    closeDespatch();
                    o.f();
                  }}
                />
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
