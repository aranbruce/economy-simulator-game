"use client";

import { useState } from "react";
import {
  realmById,
  realmByRole,
  homeIsoForRealm,
  DEFAULT_REALM_ID,
  DEFAULT_HOME_ISO,
} from "../../lib/sim/realms.ts";
import {
  pinsForRole,
  gdp0ForSeat,
  fmtGdpBn,
  NATION_PROFILE,
  playerCountryId,
  polityOf,
} from "../../lib/sim/engine.ts";
import { flagSrc } from "../../lib/ui/flags.ts";
import { HudFrame } from "../ui/HudFrame.tsx";
import { SetupGoButton } from "../ui/SetupGoButton.tsx";

/** Opening books for a seat — pinsForRole, with home deficit from the UK profile. */
function openingBooks(role: string) {
  const pins = pinsForRole(role);
  const deficit =
    pins.deficit0 != null
      ? pins.deficit0
      : (NATION_PROFILE.kingdom && NATION_PROFILE.kingdom.deficit0) || 4.5;
  return {
    debt: pins.debt,
    deficit,
    inflation: pins.inflation,
    trend: pins.trend,
    rate: pins.rate,
    unemployment: pins.unemployment,
    gdpBn: gdp0ForSeat(role),
  };
}

function modeHint(sandbox: boolean, meta: any) {
  if (sandbox) {
    if (meta.kind === "congress") {
      return "Practice run: congress pressure and crises still fire, but you keep the job.";
    }
    return "Practice run: elections and crises still fire, but you keep the job.";
  }
  if (meta.kind === "congress") {
    return "Survive the party congress, keep the apparatus loyal, and watch the bond market — capital recovers slowly.";
  }
  if (meta.kind === "managed") {
    return "Managed ballots still matter. Survive your party and the bond market — or lose the seals.";
  }
  return "Win elections, survive your party and the bond market — or lose the seals.";
}

function SetupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <span className="text-[9px] font-bold tracking-[.08em] text-ink-faint uppercase">
        {label}
      </span>
      <span className="text-[13px] font-semibold tracking-[-.02em] text-ink tabular-nums">
        {value}
      </span>
    </div>
  );
}

interface CountryPickerProps {
  selectedRole?: string | null;
  onStart: (opts: {
    country: string;
    homeRole: string;
    homeIso: string;
    realmId: string;
    sandbox: boolean;
    tutorial: boolean;
  }) => void;
  onMultiplayer?: (opts: {
    realm: any;
    name: string;
    sandbox: boolean;
  }) => void;
  onResume?: () => void;
  initialId?: string | null;
}

/** Floating chrome over the world map during country select. */
export default function CountryPicker({
  selectedRole,
  onStart,
  onMultiplayer,
  onResume,
  initialId,
}: CountryPickerProps) {
  const initial = realmById(initialId || DEFAULT_REALM_ID);
  const realm = realmByRole(selectedRole || initial.role);
  const [sandbox, setSandbox] = useState(false);
  const books = openingBooks(realm.role);
  const meta = polityOf(realm.role);
  const name = realm.name.slice(0, 34);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between px-3.5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(14px,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setupTitle"
    >
      <HudFrame className="setup-banner hud-surface pointer-events-auto w-[min(520px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] self-center px-5 pt-4 pb-3.5">
        <div className="text-[10px] font-bold tracking-[.14em] text-accent-lt uppercase">
          Commission
        </div>
        <h1
          id="setupTitle"
          className="my-1.5 font-display text-[clamp(24px,3.6vw,30px)] leading-[1.1] font-normal tracking-tight"
        >
          Choose your country
        </h1>
        <p className="m-0 text-[13px] leading-[1.45] text-ink-soft">
          Ten realms on a real map. Click any country in a bloc to take that
          seat — the books open to that realm’s inheritance.
        </p>
      </HudFrame>

      <HudFrame className="setup-dock hud-surface pointer-events-auto flex w-[min(780px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] flex-col items-stretch gap-3 self-center px-4 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <div className="mb-2.5 flex items-start justify-between gap-x-4.5 gap-y-3 max-[560px]:flex-col max-[560px]:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col gap-0.75">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-12 flex-none place-items-center overflow-hidden rounded-full border-2 border-accent shadow-[0_3px_10px_rgba(0,0,0,.5)]"
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagSrc(playerCountryId(realm.role))}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
                <strong className="text-[19px]">{realm.name}</strong>
              </div>
              <em>{realm.blurb}</em>
            </div>
            <div
              className="flex max-w-[min(240px,44%)] flex-none flex-col items-end gap-1.25 max-[560px]:max-w-none max-[560px]:items-start"
              role="group"
              aria-label="Game mode"
            >
              <span className="text-[10px] font-bold tracking-widest text-ink-faint uppercase">
                Mode
              </span>
              <div className="flex w-full gap-0.5 rounded-sm bg-g-1 p-0.5">
                <button
                  type="button"
                  aria-pressed={!sandbox}
                  className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-[10px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                  onClick={() => setSandbox(false)}
                >
                  Career
                </button>
                <button
                  type="button"
                  aria-pressed={sandbox}
                  onClick={() => setSandbox(true)}
                  title="Cannot be removed from office"
                  className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-[10px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                >
                  Sandbox
                </button>
              </div>
              <p className="m-0 text-right text-[11px] leading-[1.35] text-ink-soft max-[560px]:text-left">
                {modeHint(sandbox, meta)}
              </p>
            </div>
          </div>
          <div
            className="grid grid-cols-3 gap-x-2.5 gap-y-1.5 border-t border-white/8 pt-2.5 max-[560px]:grid-cols-2"
            aria-label={`Opening books for ${realm.name}`}
          >
            <SetupStat label="Polity" value={meta.label} />
            <SetupStat label="GDP" value={fmtGdpBn(books.gdpBn)} />
            <SetupStat label="Debt" value={books.debt.toFixed(0) + "%"} />
            <SetupStat label="Deficit" value={books.deficit.toFixed(1) + "%"} />
            <SetupStat
              label="Inflation"
              value={books.inflation.toFixed(1) + "%"}
            />
            <SetupStat label="Trend" value={books.trend.toFixed(1) + "%"} />
            <SetupStat label="Bank rate" value={books.rate.toFixed(2) + "%"} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max-[560px]:flex-col max-[560px]:items-stretch">
          <SetupGoButton
            onClick={() =>
              onStart({
                country: name,
                homeRole: realm.role,
                homeIso: homeIsoForRealm(realm),
                realmId: realm.id,
                sandbox,
                tutorial: false,
              })
            }
          >
            Get started
          </SetupGoButton>
          <SetupGoButton
            secondary
            onClick={() =>
              onStart({
                country: "United Kingdom",
                homeRole: "home",
                homeIso: DEFAULT_HOME_ISO,
                realmId: "home",
                sandbox: true,
                tutorial: true,
              })
            }
            title="Sandbox walkthrough as the United Kingdom"
          >
            Tutorial
          </SetupGoButton>
          {typeof onMultiplayer === "function" && (
            <SetupGoButton
              secondary
              onClick={() => onMultiplayer({ realm, name, sandbox })}
            >
              Multiplayer lobby
            </SetupGoButton>
          )}
          {typeof onResume === "function" && (
            <SetupGoButton secondary onClick={onResume}>
              Resume multiplayer
            </SetupGoButton>
          )}
        </div>
      </HudFrame>
    </div>
  );
}
