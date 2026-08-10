"use client";

import type { ReactNode } from "react";

const TONE = {
  red: "border-red/20 bg-red/10 text-red",
  amber: "border-amber/20 bg-amber/10 text-amber",
} as const;

/** A bordered, tinted box for a blocker/warning line — e.g. "Blocked: …",
 *  "Cannot sit with …". Callers add their own margin via `className`, since
 *  the right spacing depends on the surrounding layout (a Card's flex gap
 *  already spaces it from siblings; a plain block container does not). */
export function Callout({
  tone,
  className = "",
  children,
}: {
  tone: keyof typeof TONE;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border p-2 text-[11px] ${TONE[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
