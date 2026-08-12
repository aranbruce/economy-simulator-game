"use client";

import {
  FACTIONS,
  approvalOf,
  electionQuartersLeft,
  electionThermometer,
  ongoingSituations,
  polityOf,
  reviewNoun,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";

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
  const left = electionQuartersLeft();
  const therm = electionThermometer();
  const noun = reviewNoun();
  const nounLabel = noun.charAt(0).toUpperCase() + noun.slice(1);

  const flags: Flag[] = [
    {
      label: "Inflation",
      detail: `${e.inflation.toFixed(1)}% — ${e.inflation > 4 || e.inflation < 0 ? "off target" : "within target"}`,
      state: e.inflation > 4 || e.inflation < 0 ? "alert" : "",
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
    {
      label: nounLabel,
      detail:
        left <= 4
          ? `In ${left}Q — score ~${therm.toFixed(0)}${therm <= polityOf().loseAt ? " (at risk)" : ""}`
          : `In ${left} quarters`,
      state: left <= 4 && therm <= polityOf().loseAt ? "alert" : "",
    },
  ];

  return (
    <>
      {situations.length > 0 ? (
        <>
          <Eyebrow>Ongoing situations</Eyebrow>
          <div className="mb-4 flex flex-col gap-1.5">
            {situations.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-edge bg-g-1 px-3 py-2.25"
              >
                <div className="text-[12.5px] font-[650]">{s.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <Eyebrow>Faction approval</Eyebrow>
      <div className="mb-4 flex flex-col gap-2">
        {FACTIONS.map((f: any) => {
          const v = Math.max(0, Math.min(100, G.fac[f.id] ?? 0));
          return (
            <div key={f.id}>
              <div className="flex items-baseline gap-2 text-[12.5px]">
                <span className="font-[600]">{f.name}</span>
                <span className="ml-auto font-[650] tabular-nums text-accent-lt">
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
          <div
            key={f.label}
            className="flex items-center gap-2.5 rounded-md border border-edge bg-g-1 px-3 py-2.25"
          >
            <span className="min-w-18.5 flex-none text-[12.5px] font-[650]">
              {f.label}
            </span>
            <span
              className={`text-[12px] ${
                f.state === "alert"
                  ? "text-red-lt"
                  : f.state === "good"
                    ? "text-green-lt"
                    : "text-ink-soft"
              }`}
            >
              {f.detail}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
