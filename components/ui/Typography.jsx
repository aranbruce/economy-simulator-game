"use client";

export function Eyebrow({ children, className = "" }) {
  return <div className={`eyebrow ${className}`.trim()}>{children}</div>;
}

export function Hint({ children, className = "" }) {
  return <div className={`hint ${className}`.trim()}>{children}</div>;
}

export function Panel({ children, className = "", id }) {
  return (
    <div className={`panel ${className}`.trim()} id={id}>
      {children}
    </div>
  );
}
