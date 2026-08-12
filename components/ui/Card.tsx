"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  staged?: boolean;
  /** Set false to drop the lift/border hover — used by Laws, whose cards
   *  already show hover state on their own buttons. */
  hoverable?: boolean;
  children: ReactNode;
}

const CARD_BASE =
  "flex flex-col gap-1.25 rounded-md border border-edge bg-g-1 px-3 py-2.75 transition duration-180";
const CARD_HOVER =
  "hover:-translate-y-px hover:border-[rgba(180,200,230,.22)] hover:bg-white/6";

/** The `.card` primitive — content tiles for policies, taxes, trade deals, diplomacy, etc. */
export function Card({
  staged,
  hoverable = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  const state = staged ? "border-frame bg-accent-dim" : "";
  return (
    <div
      className={`${CARD_BASE} ${hoverable ? CARD_HOVER : ""} ${state} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

/** The `.cards` responsive grid that wraps `Card` tiles. */
export function CardGrid({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2 max-[720px]:grid-cols-1 max-[720px]:gap-1.75 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** `.card h4` — title row with an optional right-aligned `.cat` category tag. */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
      {children}
    </h4>
  );
}

export function CardCat({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto text-[9.5px] font-bold tracking-[.06em] text-ink-faint uppercase">
      {children}
    </span>
  );
}

/** `.card .foot` — the bottom row (price + action button). */
export function CardFoot({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex items-center gap-2 pt-0.5">{children}</div>
  );
}

export function CardPrice({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-ink-faint">{children}</span>
  );
}
