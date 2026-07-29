"use client";

import { useMemo } from "react";
import {
  approvalOf,
  balanceOf,
  billClauses,
  electionQuartersLeft,
  electionThermometer,
  fmt,
  polityOf,
  qLabel,
  reviewNoun,
} from "../../lib/sim/engine.js";
import { useGame } from "../../lib/ui/useGame.js";
import { Chip } from "../ui/Chip.jsx";

export function TopBarStats() {
  const G = useGame();
  const data = useMemo(() => {
    const n = G.log.length;
    const last = n ? G.log[n - 1] : null;
    const prev = n > 1 ? G.log[n - 2] : null;
    const d = (k) => (last && prev ? last[k] - prev[k] : null);
    const e = G.econ;
    const appr = approvalOf(G.fac);
    const balShow = last ? last.balance : balanceOf(G.law, e).balance;
    const left = electionQuartersLeft();
    const therm = electionThermometer();
    const reviewLabel =
      polityOf().kind === "congress"
        ? "Congress"
        : polityOf().kind === "managed"
          ? "Ballot"
          : "Election";
    const gShow = last ? last.growth : e.trendGrowth;
    return {
      chips: [
        {
          label: "Growth",
          value: fmt(gShow, 1),
          unit: "%",
          delta: d("growth"),
          state: last && last.growth < 0 ? "alert" : "",
        },
        {
          label: "Trend",
          value: (e.trendGrowth != null ? e.trendGrowth : 0).toFixed(1),
          unit: "%",
          kind: "trend",
          title:
            "Annualised potential growth from TFP, capital and labour — not outturn GDP.",
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
          label: "Unemp.",
          value: e.unemployment.toFixed(1),
          unit: "%",
          delta: d("unemployment"),
          state: e.unemployment > 6 ? "alert" : "",
          invert: true,
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
          label: "Yield",
          value: e.yield.toFixed(2),
          unit: "%",
          delta: d("yield"),
          state: e.yield > 6.5 ? "alert" : "",
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
        {
          label: reviewLabel,
          value: String(left),
          unit: "Q",
          state:
            left <= 4 ? (therm <= polityOf().loseAt ? "alert" : "") : "",
        },
      ],
      termLabel: [
        "First",
        "Second",
        "Third",
        "Fourth",
        "Fifth",
        "Sixth",
      ][Math.min(G.term - 1, 5)],
      qLabel: qLabel(G, G.q),
      reviewNoun: reviewNoun(),
      left,
      therm,
      electHint:
        left <= 4
          ? ` · ${reviewNoun()} score ~${therm.toFixed(0)}${therm <= polityOf().loseAt ? " (at risk)" : ""}`
          : "",
    };
  }, [G]);

  return (
    <div className="tb-stats">
      {data.chips.map((c) => (
        <Chip key={c.label} {...c} />
      ))}
    </div>
  );
}

export function TopBarTerm() {
  const G = useGame();
  const left = electionQuartersLeft();
  const therm = electionThermometer();
  const noun = reviewNoun();
  const electHint =
    left <= 4
      ? ` · ${noun} score ~${therm.toFixed(0)}${therm <= polityOf().loseAt ? " (at risk)" : ""}`
      : "";
  const termLabel = [
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
  ][Math.min(G.term - 1, 5)];

  return (
    <small id="tbTerm">
      {termLabel} term · {qLabel(G, G.q)} · {noun} in {left}Q{electHint}
    </small>
  );
}
