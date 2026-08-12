"use client";

import { flagSrc } from "../../lib/ui/flags.ts";

interface FlagAvatarProps {
  role: string;
  /** A Tailwind size utility, e.g. "size-9" — callers need different sizes
   *  (topbar crest, setup picker, realm card), so it isn't fixed here. */
  size: string;
  /** The cream "paper" border/shadow instead of the dark-HUD gold one. */
  paper?: boolean;
  className?: string;
}

/** The circular flag crest used in the topbar, the setup picker and realm
 *  cards — same border-ring-and-shadow treatment everywhere it appears. */
export function FlagAvatar({
  role,
  size,
  paper = false,
  className = "",
}: FlagAvatarProps) {
  const skin = paper
    ? "border-paper-accent shadow-[0_3px_10px_rgba(0,0,0,.35)]"
    : "border-accent shadow-[0_3px_10px_rgba(0,0,0,.5)]";
  return (
    <span
      className={`grid ${size} flex-none place-items-center overflow-hidden rounded-full border-2 ${skin} ${className}`.trim()}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagSrc(role)} alt="" className="h-full w-full object-cover" />
    </span>
  );
}
