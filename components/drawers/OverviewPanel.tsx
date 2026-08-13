"use client";

import {
  FACTIONS,
  approvalOf,
  electionAtRisk,
  ongoingSituations,
  reviewNoun,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { STATE_VALUE_COLOR } from "../ui/Chip.tsx";
import { Callout } from "../ui/Callout.tsx";
import { Card } from "../ui/Card.tsx";

interface Flag {
  label: string;
  detail: string;
  state: "alert" | "good" | "";
}

export function OverviewPanel() {
  const G = useGame();
  const e = G.econ;
  const situations = ongoingSituations(G);
  const appr = approvalOf(G.fac);
  const risk = electionAtRisk();
  const noun = reviewNoun();
  const nounLabel = noun.charAt(0).toUpperCase() + noun.slice(1);

  const electionDetail =
    risk.left <= 4
      ? `Score ~${risk.therm.toFixed(0)} — ${risk.atRisk ? "below the threshold to hold on" : "above the threshold to hold on"}`
      : "Too early to score — the threshold only starts mattering in the final 4 quarters";

  const inflationOff = e.inflation > 4 || e.inflation < 0;
  const flags: Flag[] = [
    {
      label: "Inflation",
      detail: `${e.inflation.toFixed(1)}% — ${inflationOff ? "off target" : "within target"}`,
      state: inflationOff ? "alert" : "",
    },
    {
      label: "Debt",
      detail: `${e.debt.toFixed(0)}% of GDP`,
      state: e.debt > 120 ? "alert" : "",
    },
    {
      label: "Base rate",
      detail: e.atBound
        ? "At the effective lower bound — the monetary offset is gone"
        : `${e.rate.toFixed(2)}%`,
      state: e.atBound ? "alert" : "",
    },
    {
      label: "Approval",
      detail: `${appr.toFixed(0)}% overall`,
      state: appr < 30 ? "alert" : appr > 55 ? "good" : "",
    },
  ];

  /* The election-risk entry ongoingSituations() adds is what feeds the
     rail's Overview badge — shown here as its own richer section below
     instead of a second time in this list. */
  const otherSituations = situations.filter((s) => s.kind !== "election");

  return (
    <>
      {otherSituations.length > 0 ? (
        <>
          <Eyebrow>Ongoing situations</Eyebrow>
          <div className="mb-4 flex flex-col gap-1.5">
            {otherSituations.map((s) => (
              <Card key={s.id} hoverable={false}>
                <div className="text-xs font-[650]">{s.label}</div>
                <div className="text-xs text-ink-faint">{s.sub}</div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <Eyebrow>{nounLabel}</Eyebrow>
      <Callout tone={risk.atRisk ? "red" : "neutral"} className="mb-4">
        <div className="flex items-baseline gap-2 text-xs font-[650]">
          <span>
            {risk.left} quarter{risk.left === 1 ? "" : "s"} to go
          </span>
          {risk.atRisk ? (
            <span className="ml-auto text-xs font-bold tracking-[.04em] uppercase">
              At risk
            </span>
          ) : null}
        </div>
        <div
          className={`mt-0.5 text-xs ${risk.atRisk ? "" : "text-ink-faint"}`}
        >
          {electionDetail}
        </div>
      </Callout>

      <Eyebrow>Faction approval</Eyebrow>
      <div className="mb-4 flex flex-col gap-2">
        {FACTIONS.map((f: any) => {
          const v = Math.max(0, Math.min(100, G.fac[f.id] ?? 0));
          return (
            <div key={f.id}>
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-semibold">{f.name}</span>
                <span className="ml-auto font-[650] text-accent-lt tabular-nums">
                  {v.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-g-1">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-lt))]"
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Eyebrow>At a glance</Eyebrow>
      <Hint>Read-only — a snapshot of where things stand right now.</Hint>
      <div className="flex flex-col gap-1.5">
        {flags.map((f) => (
          <Card
            key={f.label}
            hoverable={false}
            className="flex-row! items-center gap-2.5!"
          >
            <span className="min-w-18.5 flex-none text-xs font-[650]">
              {f.label}
            </span>
            <span
              className={`text-xs ${STATE_VALUE_COLOR[f.state] || "text-ink-soft"}`}
            >
              {f.detail}
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}
