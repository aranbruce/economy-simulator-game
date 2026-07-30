"use client";

const ICONS = {
  coin: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6v6.8M6.2 6.2h3.1a1.4 1.4 0 010 2.8H6.6h3.2" />
    </svg>
  ),
  percent: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="5" cy="5" r="2" />
      <circle cx="11" cy="11" r="2" />
      <path d="M12.5 3.5l-9 9" />
    </svg>
  ),
  scroll: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M4 2.5h7.5v11H4z" />
      <path d="M6 5.5h3.5M6 8h3.5M6 10.5h2" />
    </svg>
  ),
  people: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2.4 13c.3-2.3 1.8-3.6 3.6-3.6S9.3 10.7 9.6 13" />
      <path d="M10.6 4.2a2.1 2.1 0 010 4M11 9.6c1.6.2 2.7 1.5 3 3.4" />
    </svg>
  ),
  globe: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2C6.2 4 6.2 12 8 14" />
    </svg>
  ),
  seal: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="7" r="4.2" />
      <path d="M5.2 10.8L4 14l4-1.4L12 14l-1.2-3.2" />
      <circle cx="8" cy="7" r="1.4" />
    </svg>
  ),
  chart: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2.5 13.5h11" />
      <path d="M4 11V7.5M7 11V4M10 11V8.5M13 11V6" />
    </svg>
  ),
  close: (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
};

export function TabIcon({ name }: { name: keyof typeof ICONS }) {
  return ICONS[name] || null;
}

export function CloseIcon() {
  return ICONS.close;
}
