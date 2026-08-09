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
  shareLabel,
  T,
} from "../../lib/sim/engine.ts";
import type { GameState } from "../../lib/sim/types.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Button } from "./Button.tsx";

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
    tone === "pos" ? "text-green-lt" : tone === "neg" ? "text-red-lt" : "";
  return (
    <div className="min-w-[30%]">
      <div className="text-[9.5px] font-bold tracking-[.08em] text-ink-faint uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[17px] font-[650] tracking-[-.03em] text-white ${toneCls}`}
      >
        {value}
      </div>
      {note ? (
        <div className="mt-px text-[11px] text-ink-soft">{note}</div>
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
  if (!role) return null;
  const snap = realmSnapshot(role, G);
  if (!snap) return null;

  const homeName = G?.country || "United Kingdom";

  return (
    <aside
      className="realm-card hud-frame hud-surface-lg pointer-events-auto fixed top-18 left-3 z-18 max-h-[calc(100vh-170px)] w-[min(340px,calc(100vw-24px))] animate-[panelIn_0.34s_cubic-bezier(.22,1,.3,1)] overflow-auto px-4 pt-3.5 pb-4 max-[720px]:top-auto max-[720px]:right-[max(6px,env(safe-area-inset-right))] max-[720px]:bottom-[calc(118px+env(safe-area-inset-bottom,0px))] max-[720px]:left-[max(6px,env(safe-area-inset-left))] max-[720px]:max-h-[min(48dvh,calc(100dvh-200px))] max-[720px]:w-auto max-[720px]:px-3.5 max-[720px]:py-3 max-[540px]:bottom-[calc(108px+env(safe-area-inset-bottom,0px))] max-[540px]:max-h-[min(42dvh,calc(100dvh-190px))]"
      role="dialog"
      aria-label={snap.name}
    >
      <div className="mb-2.5 flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold tracking-widest text-accent-lt uppercase">
            {snap.us ? "Home" : "Partner realm"}
          </div>
          <h2 className="mt-1 mb-0 font-display text-[22px] font-normal tracking-[-.02em] max-[720px]:text-lg">
            {snap.name}
          </h2>
        </div>
        <button
          type="button"
          className="size-7 cursor-pointer rounded-sm border border-edge bg-g-3 text-xs leading-none text-ink-soft shadow-spec hover:border-frame hover:bg-g-4 hover:text-white"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <p className="mb-3.5 text-[13px] leading-[1.4] text-ink-soft">
        {String(snap.blurb).replace(/\{C\}/g, homeName)}
      </p>

      <div className="mb-3 flex flex-wrap gap-x-4.5 gap-y-3.5 max-[720px]:gap-x-3.5 max-[720px]:gap-y-2.5">
        <Stat
          label="GDP"
          value={fmtGdpBn(snap.gdpBn)}
          note={
            snap.us
              ? "USD at market rate (opening = 100)"
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
          label={"Currency strength (" + (snap.currency || "—") + ")"}
          value={snap.fx.toFixed(1)}
          note="vs USD · opening = 100"
          tone={toneOf(snap.fx - 100, false)}
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
        <div className="mb-3 text-xs text-ink-soft">{snap.tradeShare}</div>
      )}

      {!snap.us && (onOpenTrade || onOpenDiplomacy) && (
        <div className="mt-0.5 flex flex-wrap gap-2">
          {onOpenDiplomacy && (
            <Button
              className="min-w-0 flex-1"
              onClick={() => onOpenDiplomacy(role)}
            >
              Open diplomacy
            </Button>
          )}
          {onOpenTrade && (
            <Button
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
