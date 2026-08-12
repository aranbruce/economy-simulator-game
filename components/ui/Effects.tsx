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
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.75 text-xs text-ink-soft">
        {data.bits.map((b, i) => (
          <Fragment key={i}>
            {i > 0 ? " · " : ""}
            {b.bold ? (
              <b className="font-[650] text-white">{b.text}</b>
            ) : (
              b.text
            )}
          </Fragment>
        ))}
      </div>
      {data.facText ? (
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.75 text-xs text-ink-faint">
          {data.facText}
        </div>
      ) : null}
    </>
  );
}
