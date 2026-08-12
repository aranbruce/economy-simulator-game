"use client";

import type { ReactNode } from "react";
import {
  getG,
  PARTNERS,
  NATION_PROFILE,
  balanceOf,
  fmt,
  sgn,
  realmGdpBn,
  fmtGdpBn,
  fxDisplayIndex,
  currencyForSeat,
  liveRateBetween,
  fmtFxRate,
  CURRENCY_META,
  shareLabel,
  playerCountryId,
  T,
} from "../../lib/sim/engine.ts";
import type { GameState } from "../../lib/sim/types.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { flagSrc } from "../../lib/ui/flags.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";

function ensureNations(e: GameState) {
  if (e.nations) {
    for (const id in e.nations) {
      const n = e.nations[id];
      if (n.fx == null) n.fx = 1;
      if (n.fx0 == null) n.fx0 = n.fx;
      if (n.riskPremium == null) n.riskPremium = 0;
    }
    return e.nations;
  }
  e.nations = {};
  const profiles: Record<string, GameState> = NATION_PROFILE;
  for (const id in profiles) {
    const n = profiles[id];
    e.nations[id] = {
      y: 100,
      growth: n.trend,
      debt: n.debt0,
      deficit: n.deficit0,
      inflation: n.inflation0 != null ? n.inflation0 : 2.2,
      fx: 1,
      fx0: 1,
      riskPremium: 0,
    };
  }
  return e.nations;
}

/** Same growth the top bar shows: last outturn, else trend. */
function homeGrowth(G: GameState) {
  if (G.log && G.log.length) return G.log[G.log.length - 1].growth;
  return G.econ.trendGrowth || 0;
}

/** Same fiscal gap the Balance chip uses (deficit = −balance). */
function homeDeficit(G: GameState) {
  if (G.log && G.log.length) return -G.log[G.log.length - 1].balance;
  return -balanceOf(G.law, G.econ).balance;
}

/** Build comparable stats for home or a partner realm. */
export function realmSnapshot(role: string, G?: GameState) {
  const state = G || getG();
  if (!state) return null;
  const e = state.econ;
  const nations = ensureNations(e);
  const homeY = e.gdp;
  const homeG = homeGrowth(state);
  const homeGdp = realmGdpBn("home", state);

  if (role === "home") {
    const cur = currencyForSeat(state.homeRole || "home");
    return {
      role: "home",
      name: state.country || "United Kingdom",
      blurb: "Your economy — the books you are judged on.",
      us: true,
      output: homeY,
      gdpBn: homeGdp,
      growth: homeG,
      inflation: e.inflation,
      deficit: homeDeficit(state),
      debt: e.debt,
      unemployment: e.unemployment,
      fx: fxDisplayIndex("home", state),
      currency: cur,
      relation: null,
      tradeShare: null,
      vsHomeGrowth: 0,
      vsHomeOutput: 100,
      vsHomeGdp: 1,
    };
  }

  const p = PARTNERS.find((x) => x.id === role);
  const n = nations[role];
  if (!p || !n) return null;
  const gdpBn = realmGdpBn(role, state);
  const cur = currencyForSeat(role);
  return {
    role,
    name: p.name,
    blurb: p.blurb,
    us: false,
    output: n.y,
    gdpBn,
    growth: n.growth,
    inflation: n.inflation,
    deficit: n.deficit,
    debt: n.debt,
    unemployment: null,
    fx: fxDisplayIndex(role, state),
    currency: cur,
    relation: state.rel[role] ?? 50,
    tradeShare: T(shareLabel(state.homeRole, p.id, p.tradeShare)),
    vsHomeGrowth: n.growth - homeG,
    vsHomeOutput: (n.y / Math.max(homeY, 1e-6)) * 100,
    vsHomeGdp: gdpBn / Math.max(homeGdp, 1e-6),
  };
}

interface StatProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: string | null;
}

function Stat({ label, value, note, tone }: StatProps) {
  const toneCls =
    tone === "pos" ? "text-[#2e6b2e]" : tone === "neg" ? "text-[#a4392b]" : "";
  return (
    <div className="min-w-[30%]">
      <div className="text-[9.5px] font-bold tracking-[.08em] text-[#6b5c3e] uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[17px] font-[650] tracking-[-.03em] text-[#1a1814] ${toneCls}`}
      >
        {value}
      </div>
      {note ? (
        <div className="mt-px text-[11px] text-[#3a3428]">{note}</div>
      ) : null}
    </div>
  );
}

function toneOf(v: number, invert: boolean) {
  const x = invert ? -v : v;
  if (x > 0.05) return "pos";
  if (x < -0.05) return "neg";
  return null;
}

function vsHomeGdpNote(ratio: number, homeName: string) {
  if (ratio >= 0.95 && ratio <= 1.05) return `About the size of ${homeName}`;
  return `${ratio.toFixed(1)}× ${homeName}`;
}

/**
 * Floating command card with GDP, growth and comparisons for a selected realm.
 */
interface RealmStatsProps {
  role: string | null;
  onClose?: () => void;
  onOpenTrade?: (role: string) => void;
  onOpenDiplomacy?: (role: string) => void;
}

export default function RealmStats({
  role,
  onClose,
  onOpenTrade,
  onOpenDiplomacy,
}: RealmStatsProps) {
  const G = useGame();
  const { pref } = useCurrencyPref();
  const ccy = pref.display || undefined;
  if (!role) return null;
  const snap = realmSnapshot(role, G);
  if (!snap) return null;
  /* "Show amounts in" always resolves against the player's own currency, not
     whichever realm's card happens to be open, so every card you click reads
     in the same unit. */
  const displayCcy = pref.display || currencyForSeat(G?.homeRole);
  /* Tone for the exchange-rate stat has to track the number actually shown
     (the live cross-rate vs whatever display currency is picked), not
     snap.fx — snap.fx is this seat's currency vs its OWN opening, which can
     point a different way than "how has 1 unit of it moved against the
     display currency specifically" once the display currency is a third
     currency that's also moving. Compare against the cross-rate implied by
     each currency's CURRENCY_META baseline (their relative value at
     opening) as a percentage, so the threshold in toneOf() stays meaningful
     across currencies whose face values differ by orders of magnitude. */
  const crossRateTone = (() => {
    if (snap.currency === displayCcy) return null;
    const openCross =
      (CURRENCY_META[snap.currency] || CURRENCY_META.USD).usdRate /
      (CURRENCY_META[displayCcy] || CURRENCY_META.USD).usdRate;
    if (!(openCross > 0)) return null;
    const nowCross = liveRateBetween(snap.currency, displayCcy, G);
    return toneOf((nowCross / openCross - 1) * 100, false);
  })();

  const homeName = G?.country || "United Kingdom";
  const flagRole = snap.us ? playerCountryId(G?.homeRole) : role;

  return (
    <aside
      className="realm-card pointer-events-auto fixed top-18 left-3 z-18 max-h-[calc(100vh-170px)] w-[min(340px,calc(100vw-24px))] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] overflow-auto rounded-sm border border-[rgba(40,32,18,.28)] bg-[linear-gradient(165deg,#f4efe4_0%,#ebe4d4_55%,#e4dcc8_100%)] px-4 pt-3.5 pb-4 shadow-[0_22px_56px_rgba(0,0,0,.55),0_1px_0_rgba(255,255,255,.55)_inset] max-[720px]:top-auto max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:bottom-[calc(118px+env(safe-area-inset-bottom,0px))] max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:max-h-[min(48dvh,calc(100dvh-200px))] max-[720px]:w-auto max-[720px]:px-3.5 max-[720px]:py-3 max-[540px]:bottom-[calc(108px+env(safe-area-inset-bottom,0px))] max-[540px]:max-h-[min(42dvh,calc(100dvh-190px))]"
      role="dialog"
      aria-label={snap.name}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="grid size-11 flex-none place-items-center overflow-hidden rounded-full border-2 border-[#8a6420] shadow-[0_3px_10px_rgba(0,0,0,.35)]"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flagSrc(flagRole)}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-widest text-[#8a6420] uppercase">
              {snap.us ? "Home" : "Partner realm"}
            </div>
            <h2 className="mt-0.5 mb-0 font-display text-[21px] font-normal tracking-[-.02em] text-[#1a1814] max-[720px]:text-lg">
              {snap.name}
            </h2>
          </div>
        </div>
        <button
          type="button"
          className="grid size-7 flex-none cursor-pointer place-items-center rounded-full border border-[rgba(40,32,18,.22)] bg-[rgba(40,32,18,.06)] text-[#6b5c3e] transition duration-160 hover:bg-[rgba(40,32,18,.14)] hover:text-[#1a1814] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6420] active:scale-[0.94]"
          aria-label="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <p className="mb-3.5 text-[13px] leading-[1.4] text-[#3a3428]">
        {String(snap.blurb).replace(/\{C\}/g, homeName)}
      </p>

      <div className="mb-3 flex flex-wrap gap-x-4.5 gap-y-3.5 max-[720px]:gap-x-3.5 max-[720px]:gap-y-2.5">
        <Stat
          label="GDP"
          value={fmtGdpBn(snap.gdpBn, ccy, G)}
          note={
            snap.us
              ? `${displayCcy} at market rate`
              : vsHomeGdpNote(snap.vsHomeGdp, homeName)
          }
          tone={snap.us ? null : toneOf(snap.vsHomeGdp - 1, false)}
        />
        <Stat
          label="GDP index"
          value={snap.output.toFixed(1)}
          note="Opening = 100"
        />
        <Stat
          label={"Exchange rate (" + (snap.currency || "—") + ")"}
          value={
            snap.currency === displayCcy
              ? "1.00"
              : fmtFxRate(liveRateBetween(snap.currency, displayCcy, G))
          }
          note={
            snap.currency === displayCcy
              ? displayCcy === "USD"
                ? "The USD numeraire itself"
                : "Your display currency"
              : `${displayCcy} per 1 ${snap.currency}`
          }
          tone={crossRateTone}
        />
        <Stat
          label="Growth"
          value={sgn(snap.growth, 1) + "%"}
          note={
            snap.us
              ? G?.log?.length
                ? "Last quarter, annualised"
                : "Trend (before first outturn)"
              : `${sgn(snap.vsHomeGrowth, 1)} pts vs ${homeName}`
          }
          tone={toneOf(snap.growth, false)}
        />
        <Stat label="Inflation" value={snap.inflation.toFixed(1) + "%"} />
        <Stat
          label="Deficit"
          value={fmt(snap.deficit, 1) + "%"}
          note="% of GDP"
          tone={toneOf(snap.deficit, true)}
        />
        <Stat label="Debt" value={snap.debt.toFixed(0) + "%"} note="% of GDP" />
        {snap.unemployment != null && (
          <Stat
            label="Unemployment"
            value={snap.unemployment.toFixed(1) + "%"}
          />
        )}
        {snap.relation != null && (
          <Stat
            label="Relations"
            value={Math.round(snap.relation)}
            note="/ 100"
            tone={
              snap.relation > 62 ? "pos" : snap.relation < 45 ? "neg" : null
            }
          />
        )}
      </div>

      {snap.tradeShare && (
        <div className="mb-3 text-xs text-[#3a3428]">{snap.tradeShare}</div>
      )}

      {!snap.us && (onOpenTrade || onOpenDiplomacy) && (
        <div className="mt-0.5 flex flex-wrap gap-2">
          {onOpenDiplomacy && (
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer rounded-sm border border-[rgba(40,32,18,.22)] bg-[rgba(40,32,18,.06)] px-3.25 py-1.5 text-[11.5px] font-[650] tracking-[.02em] text-[#1a1814] transition duration-160 hover:bg-[rgba(40,32,18,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6420] active:scale-[0.96]"
              onClick={() => onOpenDiplomacy(role)}
            >
              Open diplomacy
            </button>
          )}
          {onOpenTrade && (
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer rounded-sm border border-[rgba(40,32,18,.22)] bg-[rgba(40,32,18,.06)] px-3.25 py-1.5 text-[11.5px] font-[650] tracking-[.02em] text-[#1a1814] transition duration-160 hover:bg-[rgba(40,32,18,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6420] active:scale-[0.96]"
              onClick={() => onOpenTrade(role)}
            >
              Open trade talks
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
