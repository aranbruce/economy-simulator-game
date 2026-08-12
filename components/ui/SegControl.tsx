"use client";

import type { ReactNode } from "react";

interface SegControlProps<T extends string> {
  options: [T, ReactNode][];
  value: T;
  onChange: (value: T) => void;
  mini?: boolean;
  className?: string;
}

const BTN_BASE =
  "flex-1 bg-transparent border-0 rounded py-1.5 px-1.25 cursor-pointer text-[11px] font-semibold text-ink-soft tracking-[.01em] transition-colors duration-150 hover:text-white aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2";
const BTN_MINI =
  "py-1.25 px-1 text-[10px] max-md:py-2 max-md:px-1.5 max-md:text-[11px]";

export function SegControl<T extends string>({
  options,
  value,
  onChange,
  mini = false,
  className = "",
}: SegControlProps<T>) {
  return (
    <span
      className={`flex w-full gap-0.5 rounded-sm p-0.5 ${className || "bg-g-1"}`.trim()}
    >
      {options.map(([val, label]) => (
        <button
          key={String(val)}
          type="button"
          aria-pressed={value === val}
          className={`${BTN_BASE} ${mini ? BTN_MINI : ""}`.trim()}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onChange(val)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
