"use client";

import { useEffect, useState } from "react";
import {
  closeDespatch,
  esc,
  getDespatch,
  setOnDespatchChange,
  T,
} from "../../lib/sim/engine.js";
import { HudFrame } from "../ui/HudFrame.jsx";

export function DespatchModal() {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setOnDespatchChange(setOpen);
    return () => setOnDespatchChange(null);
  }, []);

  useEffect(() => {
    setOpen(getDespatch());
  }, []);

  if (!open) return null;

  return (
    <div className="scrim" id="scrim">
      <div
        className="despatch hud-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpTitle"
      >
        <header>
          <div className="stamp" id="dpStamp">
            {open.stamp}
          </div>
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
      </div>
    </div>
  );
}
