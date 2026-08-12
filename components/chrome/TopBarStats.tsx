"use client";

import { approvalOf, balanceOf, fmt, qLabel } from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Chip } from "../ui/Chip.tsx";

export function TopBarStats() {
  const G = useGame();
  const n = G.log.length;
  const last = n ? G.log[n - 1] : null;
  const prev = n > 1 ? G.log[n - 2] : null;
  const d = (k: string) => (last && prev ? last[k] - prev[k] : null);
  const e = G.econ;
  const appr = approvalOf(G.fac);
  const balShow = last ? last.balance : balanceOf(G.law, e).balance;
  const gShow = last ? last.growth : e.trendGrowth;
  /* Trend, Unemployment, Yield and the election countdown are dropped here
     — the countdown already lives in the icon rail (IconRail.tsx), and the
     other three were cut to keep this a compact resource strip rather than
     a dense instrument panel. */
  const chips = [
    {
      label: "Growth",
      value: fmt(gShow, 1),
      unit: "%",
      delta: d("growth"),
      state: last && last.growth < 0 ? "alert" : "",
    },
    {
      label: "Inflation",
      value: e.inflation.toFixed(1),
      unit: "%",
      delta: d("inflation"),
      state: e.inflation > 4 || e.inflation < 0 ? "alert" : "",
      invert: true,
    },
    {
      label: "Base rate",
      value: e.rate.toFixed(2),
      unit: "%",
      delta: d("rate"),
      state: e.atBound ? "alert" : "",
      kind: "bank",
      title: G.rateManual
        ? "Pinned by you. Turn Bank mode back on in the Bill panel to return the rate to the Taylor rule."
        : "Set by the Bank, not by you. It follows a Taylor rule: it rises when inflation is above target or output is above potential, and it is smoothed, so it moves in steps. Pin it yourself in the Bill panel.",
    },
    {
      label: "Balance",
      value: fmt(balShow, 1),
      unit: "%",
      delta: d("balance"),
      state: balShow < -6 ? "alert" : balShow >= 0 ? "good" : "",
    },
    {
      label: "Debt",
      value: e.debt.toFixed(0),
      unit: "%",
      delta: d("debt"),
      state: e.debt > 120 ? "alert" : "",
      invert: true,
    },
    {
      label: "Approval",
      value: appr.toFixed(0),
      unit: "%",
      state: appr < 30 ? "alert" : appr > 55 ? "good" : "",
    },
    {
      label: "Capital",
      value: String(Math.round(G.capital)),
      state: G.capital < 12 ? "alert" : "",
    },
  ];

  return (
    <div
      className="hud-surface ml-auto flex scrollbar-none items-stretch overflow-x-auto p-1 max-[720px]:ml-0 max-[720px]:w-full max-[720px]:flex-[1_1_100%] max-[720px]:flex-wrap max-[720px]:justify-stretch max-[720px]:overflow-x-visible"
      id="tbStats"
    >
      {chips.map((c) => (
        <Chip key={c.label} {...c} />
      ))}
    </div>
  );
}

export function TopBarTerm() {
  const G = useGame();
  const termLabel = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"][
    Math.min(G.term - 1, 5)
  ];

  return (
    <small
      id="tbTerm"
      className="mt-0.5 block text-[10px] font-medium tracking-[.06em] text-ink-faint uppercase max-[720px]:text-[9px] max-[540px]:max-w-[38vw] max-[540px]:overflow-hidden max-[540px]:text-ellipsis max-[540px]:whitespace-nowrap"
    >
      {termLabel} term · {qLabel(G, G.q)}
    </small>
  );
}
