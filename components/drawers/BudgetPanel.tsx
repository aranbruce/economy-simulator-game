"use client";

import {
  DEPTS,
  ledgerRows,
  fmt,
  serviceScore,
  spendForScore,
  syncServiceHolds,
  welfareAdequacy,
  welfareCost,
} from "../../lib/sim/engine.ts";
import { setDraftSpend, setDraftSpendMode } from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Lever } from "../ui/Lever.tsx";
import { SegControl } from "../ui/SegControl.tsx";

const TRANSFER_DEPTS: Record<string, boolean> = { welfare: true };

function budgetModeOptions(): ["share" | "real" | "service", string][] {
  return [
    ["share", "Share of GDP"],
    ["real", "With inflation"],
    ["service", "Hold service level"],
  ];
}

function LedgerTable() {
  const rows: any[] = ledgerRows();
  const TH =
    "first:text-left border-b border-edge px-2.5 py-2 text-right text-[9.5px] font-bold whitespace-nowrap text-ink-faint uppercase tracking-[.06em]";
  const TD =
    "first:text-left first:text-ink-soft border-b border-white/5 px-2.5 py-1.5 text-right";
  if (!rows.length) {
    return (
      <div className="overflow-x-auto rounded-md border border-edge bg-g-1">
        <div className="p-4 text-[12.5px] text-ink-faint">
          No quarters recorded. Set out a bill and deliver it.
        </div>
      </div>
    );
  }
  const signCls = (v: number) =>
    v > 0 ? "text-green-lt" : v < 0 ? "text-red-lt" : "";
  return (
    <div className="overflow-x-auto rounded-md border border-edge bg-g-1">
      <table className="w-full min-w-160 border-collapse text-[12.5px] tabular-nums">
        <thead>
          <tr>
            <th className={TH}>Quarter</th>
            <th className={TH}>Growth</th>
            <th className={TH}>Trend</th>
            <th className={TH}>Inflation</th>
            <th className={TH}>Unemp.</th>
            <th className={TH}>Balance</th>
            <th className={TH}>Debt</th>
            <th className={TH}>Yield</th>
            <th className={TH}>Approval</th>
            <th className={TH}>Capital</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="last:bg-white/4">
              <td className={TD}>{r.label}</td>
              <td className={`${TD} ${signCls(r.growth)}`}>
                {fmt(r.growth, 1)}
              </td>
              <td className={TD}>
                {r.trend != null ? r.trend.toFixed(1) : "—"}
              </td>
              <td className={TD}>{r.inflation.toFixed(1)}</td>
              <td className={TD}>{r.unemployment.toFixed(1)}</td>
              <td className={`${TD} ${signCls(r.balance)}`}>
                {fmt(r.balance, 1)}
              </td>
              <td className={TD}>{r.debt.toFixed(0)}</td>
              <td className={TD}>{r.yield.toFixed(2)}</td>
              <td className={TD}>{r.approval.toFixed(0)}</td>
              <td className={TD}>{Math.round(r.capital)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BudgetPanel() {
  const G = useGame();
  syncServiceHolds(G.draft, G.econ);

  return (
    <>
      <Eyebrow>Departmental spending, % of GDP</Eyebrow>
      <Hint>
        Standing still is a cut: demand for services rises about one percent a
        year on its own.
      </Hint>
      <Panel id="deptLevers">
        {DEPTS.map((d) => {
          const held = G.draft.hold && G.draft.hold[d.id];
          const mode = (G.draft.mode || {})[d.id] || "share";
          if (TRANSFER_DEPTS[d.id]) {
            const bill = welfareCost(G.draft, G.econ);
            const adeq = welfareAdequacy(G.draft, G.econ);
            return (
              <div key={d.id}>
                <Lever
                  id={d.id}
                  name={d.name}
                  value={G.draft.spend[d.id]}
                  min={d.min}
                  max={d.max}
                  step={0.1}
                  decimals={1}
                  className="spend"
                  base={G.law.spend[d.id]}
                  note={
                    <>
                      costs <b>{bill.toFixed(2)}%</b> of GDP at today’s
                      unemployment · per claimant {(adeq * 100).toFixed(0)}% of
                      the opening rate
                    </>
                  }
                  onInput={(id, v) => {
                    setDraftSpend(id, v);
                  }}
                  onCommit={(id, v) => setDraftSpend(id, v)}
                />
              </div>
            );
          }
          const score =
            held != null ? held : serviceScore(d.id, G.draft, G.econ);
          const holdCost = spendForScore(d.id, score, G.econ);
          return (
            <div key={d.id}>
              <Lever
                id={d.id}
                name={d.name}
                value={G.draft.spend[d.id]}
                min={d.min}
                max={d.max}
                step={0.1}
                decimals={1}
                className="spend"
                base={G.law.spend[d.id]}
                note={
                  <>
                    service level <b>{score.toFixed(0)}</b> / 100 · holding this
                    level costs {holdCost.toFixed(2)}% of GDP
                  </>
                }
                onInput={(id, v) => {
                  setDraftSpend(id, v);
                }}
                onCommit={(id, v) => setDraftSpend(id, v)}
              />
              <div className="mt-1.5 px-3 pb-2">
                <SegControl
                  mini
                  value={mode}
                  options={budgetModeOptions()}
                  onChange={(m) => setDraftSpendMode(d.id, m)}
                />
              </div>
            </div>
          );
        })}
      </Panel>
      <Eyebrow className="mt-5">The ledger</Eyebrow>
      <LedgerTable />
    </>
  );
}
