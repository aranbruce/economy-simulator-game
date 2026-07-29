"use client";

export function Eyebrow({ children, className = "" }) {
  return <div className={`eyebrow ${className}`.trim()}>{children}</div>;
}

export function Hint({ children, className = "" }) {
  return <div className={`hint ${className}`.trim()}>{children}</div>;
}

export function Panel({ children, className = "", id, padded = false }) {
  const pad = padded ? "px-[13px] py-[11px]" : "";
  return (
    <div className={`panel ${pad} ${className}`.trim()} id={id}>
      {children}
    </div>
  );
}
