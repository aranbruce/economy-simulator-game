"use client";

interface CatPillsProps<T extends string> {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}

/** Horizontally-scrollable pill row for switching between a single option at
 *  a time — the same idiom as the dock's own tab strip. Used by
 *  LawsPanel.tsx (State & Constitution / Labor & Welfare) and
 *  PoliciesPanel.tsx (policy category). */
export function CatPills<T extends string>({
  options,
  value,
  onChange,
}: CatPillsProps<T>) {
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className="flex-none cursor-pointer rounded-full border border-edge bg-g-1 px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap text-ink-soft transition-colors duration-150 hover:text-white aria-pressed:border-frame aria-pressed:bg-accent-dim aria-pressed:text-accent-lt focus-visible:outline-2 focus-visible:outline-accent"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
