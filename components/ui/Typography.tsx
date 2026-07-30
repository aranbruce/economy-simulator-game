"use client";

import type { ReactNode } from "react";

interface TextProps {
  children: ReactNode;
  className?: string;
}

const EYEBROW_BASE =
  "flex items-center gap-[9px] mb-[9px] text-[10px] font-bold text-ink-faint tracking-[.1em] uppercase after:content-[''] after:flex-1 after:h-px after:bg-edge";

export function Eyebrow({ children, className = "" }: TextProps) {
  const mt = className === "mt" ? "mt-5" : className;
  return <div className={`${EYEBROW_BASE} ${mt}`.trim()}>{children}</div>;
}

const HINT_BASE = "text-[12.5px] text-ink-soft leading-[1.4]";
const HINT_MARGIN_DEFAULT = "-mt-[3px] mb-3";

export function Hint({ children, className = "" }: TextProps) {
  return (
    <div className={`${HINT_BASE} ${className || HINT_MARGIN_DEFAULT}`.trim()}>
      {children}
    </div>
  );
}

interface PanelProps extends TextProps {
  id?: string;
  padded?: boolean;
}

const PANEL_BASE = "bg-g-1 rounded-md border border-edge overflow-hidden [&+&]:mt-2";

export function Panel({ children, className = "", id, padded = false }: PanelProps) {
  const pad = padded ? "px-[13px] py-[11px]" : "";
  return (
    <div className={`${PANEL_BASE} ${pad} ${className}`.trim()} id={id}>
      {children}
    </div>
  );
}
