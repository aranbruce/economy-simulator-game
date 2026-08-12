"use client";

const ICONS = {
  coin: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <rect x="1.8" y="4.5" width="12.4" height="7" rx="1.3" />
      <circle cx="8" cy="8" r="1.6" />
      <path d="M3.6 5.8v4.4M12.4 5.8v4.4" />
    </svg>
  ),
  percent: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <circle cx="5" cy="5" r="2" />
      <circle cx="11" cy="11" r="2" />
      <path d="M12.5 3.5l-9 9" />
    </svg>
  ),
  scroll: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M4 2.5h7.5v11H4z" />
      <path d="M6 5.5h3.5M6 8h3.5M6 10.5h2" />
    </svg>
  ),
  globe: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2C6.2 4 6.2 12 8 14" />
    </svg>
  ),
  seal: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <circle cx="8" cy="7" r="4.2" />
      <path d="M5.2 10.8L4 14l4-1.4L12 14l-1.2-3.2" />
      <circle cx="8" cy="7" r="1.4" />
    </svg>
  ),
  chart: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M2.5 13.5h11" />
      <path d="M4 11V7.5M7 11V4M10 11V8.5M13 11V6" />
    </svg>
  ),
  institution: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M1.5 5.5L8 1.5l6.5 4" />
      <path d="M2.5 5.5h11" />
      <path d="M3.5 7v6M6.5 7v6M9.5 7v6M12.5 7v6" />
      <path d="M2 13h12" />
    </svg>
  ),
  gavel: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path d="M9.5 2.5l4 4-1.6 1.6-4-4z" />
      <path d="M7.8 4.2l4 4L4.7 15.3l-1.9-1.9z" />
      <path d="M2 14.5h6" />
    </svg>
  ),
  newspaper: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1" />
      <path d="M8 3.2v9.6" />
      <path d="M3.6 5.6h2.8M3.6 7.6h2.8M3.6 9.6h2.8M9.6 5.6h2.8M9.6 7.6h2.8M9.6 9.6h2.8" />
    </svg>
  ),
  close: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
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
