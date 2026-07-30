"use client";

import type { ComponentPropsWithoutRef } from "react";

export function HudSurface({
  className = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`hud-surface ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
