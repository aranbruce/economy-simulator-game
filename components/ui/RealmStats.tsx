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
  partnerTradeSharePct,
} from "../../lib/sim/engine.ts";
import { roleCountryId } from "../../lib/sim/boardMetrics.ts";
import type { GameState } from "../../lib/sim/types.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";
import { Button } from "./Button.tsx";
import { FlagAvatar } from "./FlagAvatar.tsx";

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

  /* Live share of home's actual export allocation, not the fixed gravity-
     model weight shareLabel()/p.tradeShare draws on — that weight is a
     structural input to the trade model, not an outcome of it, so it never
     moves when you change tariffs. bilateralX does, once a tariff change is
     enacted and a quarter has run. Denominator includes rest-of-world so
     the figure is "% of trade", matching Trade > Partners. */
  const bilat = e.bilateralX || {};

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
      tradeSharePct: null,
      vsHomeGrowth: 0,
      vsHomeOutput: 100,
      vsHomeGdp: 1,
      // Same ratio realmGdpBn() itself uses (opening GDP × index/100 × fx
      // ratio) applied to X/M instead of the output index, so these land in
      // the same currency-volume terms as GDP rather than raw index points.
      exportsBn: homeGdp * (e.X / Math.max(homeY, 1e-6)),
      importsBn: homeGdp * (e.M / Math.max(homeY, 1e-6)),
    };
  }

  const p = PARTNERS.find((x) => x.id === role);
  const n = nations[role];
  if (!p || !n) return null;
  const gdpBn = realmGdpBn(role, state);
  const cur = currencyForSeat(role);
  /* worldTrade is keyed by real country ids (role already is one for a
     partner — only "home" needs playerCountryId() resolution, done above
     via e.X/e.M instead), from the same bilateral clearing that feeds the
     3D trade-route layer. Not guaranteed to exist on the very first tick
     before refreshWorldTrade() has run once. */
  const wt = state.worldTrade?.totals?.[role];
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
    tradeSharePct: partnerTradeSharePct(bilat, role),
    vsHomeGrowth: n.growth - homeG,
    vsHomeOutput: (n.y / Math.max(homeY, 1e-6)) * 100,
    vsHomeGdp: gdpBn / Math.max(homeGdp, 1e-6),
    exportsBn: wt ? gdpBn * (wt.X / Math.max(n.y, 1e-6)) : null,
    importsBn: wt ? gdpBn * (wt.M / Math.max(n.y, 1e-6)) : null,
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
    tone === "pos"
      ? "text-paper-green"
      : tone === "neg"
        ? "text-paper-red"
        : "";
  return (
    <div className="min-w-[30%]">
      <div className="text-xs font-bold tracking-[.08em] text-paper-ink-faint uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-[650] tracking-[-.03em] text-paper-ink ${toneCls}`}
      >
        {value}
      </div>
      {note ? (
        <div className="mt-px text-xs text-paper-ink-soft">{note}</div>
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
  const flagRole = roleCountryId(role, G);

  return (
    <aside
      className="realm-card scroll-thin pointer-events-auto fixed top-[calc(var(--drawer-top,72px)+12px)] left-3 z-18 max-h-[calc(100vh-170px)] w-[min(360px,calc(100vw-24px))] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] overflow-auto rounded-sm border border-paper-border/28 bg-(image:--paper-gradient) px-4 pt-3.5 pb-4 shadow-[0_22px_56px_rgba(0,0,0,.55),0_1px_0_rgba(255,255,255,.55)_inset] max-lg:right-[calc(var(--rail-clear)+env(safe-area-inset-right))] max-lg:left-[max(6px,env(safe-area-inset-left))] max-lg:size-auto max-lg:max-h-[calc(100dvh-var(--drawer-top,160px)-12px-var(--drawer-bottom,128px))] max-lg:px-3.5 max-lg:py-3 max-sm:max-h-[calc(100dvh-var(--drawer-top,160px)-12px-var(--drawer-bottom,118px))]"
      role="dialog"
      aria-label={snap.name}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <FlagAvatar role={flagRole} size="size-11" paper />
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-widest text-paper-accent uppercase">
              {snap.us ? "Home" : "Partner realm"}
            </div>
            <h2 className="mt-0.5 mb-0 font-display text-xl font-normal tracking-[-.02em] text-paper-ink max-md:text-lg">
              {snap.name}
            </h2>
          </div>
        </div>
        <button
          type="button"
          className="grid size-7 flex-none cursor-pointer place-items-center rounded-full border border-paper-border/22 bg-paper-border/6 text-paper-ink-faint transition duration-160 hover:bg-paper-border/14 hover:text-paper-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-accent active:scale-[0.94]"
          aria-label="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <p className="mb-3.5 text-sm leading-[1.4] text-paper-ink-soft">
        {String(snap.blurb).replace(/\{C\}/g, homeName)}
      </p>

      <div className="mb-3 grid grid-cols-2 gap-x-4.5 gap-y-3.5 max-md:gap-x-3.5 max-md:gap-y-2.5">
        <Stat
          label="GDP"
          value={fmtGdpBn(snap.gdpBn, ccy, G)}
          note={
            snap.us
              ? `${displayCcy} at market rate`
              : vsHomeGdpNote(snap.vsHomeGdp, homeName)
          }
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
        {snap.exportsBn != null && (
          <Stat label="Exports" value={fmtGdpBn(snap.exportsBn, ccy, G)} />
        )}
        {snap.importsBn != null && (
          <Stat label="Imports" value={fmtGdpBn(snap.importsBn, ccy, G)} />
        )}
        {snap.tradeSharePct != null && (
          <Stat
            label="Share of your trade"
            value={snap.tradeSharePct.toFixed(0) + "%"}
            note={`Of ${homeName}'s exports`}
          />
        )}
      </div>

      {!snap.us && (onOpenTrade || onOpenDiplomacy) && (
        <div className="mt-0.5 flex flex-wrap gap-2">
          {onOpenDiplomacy && (
            <Button
              paper
              className="min-w-0 flex-1"
              onClick={() => onOpenDiplomacy(role)}
            >
              Open diplomacy
            </Button>
          )}
          {onOpenTrade && (
            <Button
              paper
              className="min-w-0 flex-1"
              onClick={() => onOpenTrade(role)}
            >
              Open trade talks
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
