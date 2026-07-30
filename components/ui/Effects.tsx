"use client";

import { Fragment } from "react";

interface EffectsData {
  bits: { text: string; bold: boolean }[];
  facText: string | null;
}

/** Renders fullEffectsData()/qualEffectsData() output — policy/status effect lines. */
export function EffectsBlock({ data }: { data: EffectsData }) {
  return (
    <>
      <div className="eff">
        {data.bits.map((b, i) => (
          <Fragment key={i}>
            {i > 0 ? " · " : ""}
            {b.bold ? <b>{b.text}</b> : b.text}
          </Fragment>
        ))}
      </div>
      {data.facText ? (
        <div className="eff" style={{ color: "var(--ink-faint)" }}>
          {data.facText}
        </div>
      ) : null}
    </>
  );
}
