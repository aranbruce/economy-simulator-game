"use client";

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
} from "../../lib/sim/engine.js";
import { useGame } from "../../lib/ui/useGame.js";

function ensureNations(e) {
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
  for (const id in NATION_PROFILE) {
    const n = NATION_PROFILE[id];
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
function homeGrowth(G) {
  if (G.log && G.log.length) return G.log[G.log.length - 1].growth;
  return G.econ.trendGrowth || 0;
}

/** Same fiscal gap the Balance chip uses (deficit = −balance). */
function homeDeficit(G) {
  if (G.log && G.log.length) return -G.log[G.log.length - 1].balance;
  return -balanceOf(G.law, G.econ).balance;
}

/** Build comparable stats for home or a partner realm. */
export function realmSnapshot(role, G) {
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
    tradeShare: p.share,
    vsHomeGrowth: n.growth - homeG,
    vsHomeOutput: (n.y / Math.max(homeY, 1e-6)) * 100,
    vsHomeGdp: gdpBn / Math.max(homeGdp, 1e-6),
  };
}

function Stat({ label, value, note, tone }) {
  return (
    <div className="realm-stat">
      <div className="k">{label}</div>
      <div className={"v" + (tone ? " " + tone : "")}>{value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}

function toneOf(v, invert) {
  const x = invert ? -v : v;
  if (x > 0.05) return "pos";
  if (x < -0.05) return "neg";
  return null;
}

function vsHomeGdpNote(ratio, homeName) {
  if (ratio >= 0.95 && ratio <= 1.05) return `About the size of ${homeName}`;
  return `${ratio.toFixed(1)}× ${homeName}`;
}

/**
 * Floating command card with GDP, growth and comparisons for a selected realm.
 */
export default function RealmStats({ role, onClose, onOpenTrade, onOpenDiplomacy }) {
  const G = useGame();
  const snap = role ? realmSnapshot(role, G) : null;
  if (!snap) return null;

  const homeName = G?.country || "United Kingdom";

  return (
    <aside
      className="realm-card hud-frame"
      role="dialog"
      aria-label={snap.name}
    >
      <div className="realm-card-head">
        <div>
          <div className="stamp">{snap.us ? "Home" : "Partner realm"}</div>
          <h2>{snap.name}</h2>
        </div>
        <button
          type="button"
          className="close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <p className="realm-card-blurb">
        {String(snap.blurb).replace(/\{C\}/g, homeName)}
      </p>

      <div className="realm-stats">
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
        <div className="note trade-note">
          {String(snap.tradeShare).replace(/\{C\}/g, homeName)}
        </div>
      )}

      {!snap.us && (onOpenTrade || onOpenDiplomacy) && (
        <div className="realm-card-actions">
          {onOpenDiplomacy && (
            <button
              type="button"
              className="btn"
              onClick={() => onOpenDiplomacy(role)}
            >
              Open diplomacy
            </button>
          )}
          {onOpenTrade && (
            <button type="button" className="btn" onClick={() => onOpenTrade(role)}>
              Open trade talks
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
