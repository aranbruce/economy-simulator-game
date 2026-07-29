"use client";

export function SegControl({ options, value, onChange, mini = false, className = "" }) {
  return (
    <span className={`seg ${mini ? "mini" : ""} ${className}`.trim()}>
      {options.map(([val, label]) => (
        <button
          key={String(val)}
          type="button"
          aria-pressed={value === val}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onChange(val)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
