"use client";

export function HudFrame({ className = "", children, ...props }) {
  return (
    <div className={`hud-frame ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
