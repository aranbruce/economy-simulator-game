"use client";

import type { ReactNode } from "react";

const TONE = {
  red: "border-red/20 bg-red/10 text-red",
  amber: "border-amber/20 bg-amber/10 text-amber",
  /** No forced text colour — children keep the page's default ink (and can
   *  still opt into text-ink-faint etc. themselves), unlike red/amber where
   *  every child is meant to read as the same warning colour. */
  neutral: "border-edge bg-g-1",
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
      className={`rounded-md border p-2 text-xs ${TONE[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
