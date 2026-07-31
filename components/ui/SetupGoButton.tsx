"use client";

import type { ButtonHTMLAttributes } from "react";

interface SetupGoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean;
  /** Skip the default padding/font-size/mobile-width so className can set a custom size. */
  customSize?: boolean;
}

const BASE =
  "flex-none cursor-pointer rounded-md border-none font-sans font-bold tracking-[-.01em] transition duration-160 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-accent-lt focus-visible:outline-offset-3";

const SIZE = "max-[560px]:w-full px-5.5 py-3 text-[14.5px]";

const PRIMARY =
  "bg-linear-to-b from-accent-lt to-accent text-[#1a1408] shadow-[var(--spec),0_8px_20px_rgba(0,0,0,.35)] hover:brightness-[1.06]";

const SECONDARY =
  "bg-white/8 text-ink shadow-[var(--spec),inset_0_0_0_1px_rgba(255,255,255,.12)] hover:brightness-110";

/** The `.setup-go` primitive — the onboarding call-to-action button, primary or secondary. */
export function SetupGoButton({
  secondary,
  customSize,
  className = "",
  ...rest
}: SetupGoButtonProps) {
  return (
    <button
      type="button"
      className={`${BASE} ${customSize ? "" : SIZE} ${secondary ? SECONDARY : PRIMARY} ${className}`.trim()}
      {...rest}
    />
  );
}
