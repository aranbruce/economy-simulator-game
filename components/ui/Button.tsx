"use client";

import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  tiny?: boolean;
  /** Skip the default padding/font-size so className can set a custom size without a Tailwind cascade-order conflict. */
  customSize?: boolean;
}

const BTN_BASE =
  "cursor-pointer rounded-sm border border-edge bg-g-3 font-[650] tracking-[.02em] text-white shadow-spec transition duration-160 hover:border-frame hover:bg-g-4 active:scale-[0.96] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-g-1 disabled:text-ink-faint disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const BTN_DANGER = "border-red/35 bg-red/20 text-red-lt hover:bg-red/35 hover:text-white";

/** The `.btn` primitive, with `.danger` and `.tiny` modifiers. */
export function Button({ danger, tiny, customSize, className = "", ...rest }: ButtonProps) {
  const size = customSize ? "" : tiny ? "px-2.25 py-0.75 text-[10.5px]" : "px-3.25 py-1.5 text-[11.5px]";
  return (
    <button
      type="button"
      className={`${BTN_BASE} ${size} ${danger ? BTN_DANGER : ""} ${className}`.trim()}
      {...rest}
    />
  );
}
