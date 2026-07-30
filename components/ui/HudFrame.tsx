"use client";

import type { ComponentPropsWithoutRef } from "react";

export function HudFrame({
  className = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`hud-frame ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
