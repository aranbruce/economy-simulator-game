"use client";

interface CatPillsProps<T extends string> {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}

/** Horizontally-scrollable pill row for switching between a single option at
 *  a time — the same idiom as the dock's own tab strip. Rendered by
 *  DrawerShell.tsx as part of the drawer's persistent header (not by the
 *  individual panels), so spacing is the wrapper's responsibility, not
 *  this component's. */
export function CatPills<T extends string>({
  options,
  value,
  onChange,
}: CatPillsProps<T>) {
  return (
    <div className="flex scrollbar-none gap-1.5 overflow-x-auto px-3.5 max-md:px-3">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className="flex-none cursor-pointer rounded-full border border-edge bg-g-1 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-frame aria-pressed:bg-accent-dim aria-pressed:text-accent-lt"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
