"use client";

export function HudSurface({ className = "", children, ...props }) {
  return (
    <div className={`hud-surface ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
