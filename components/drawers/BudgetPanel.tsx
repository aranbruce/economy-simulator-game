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
import {
  setDraftSpend,
  setDraftSpendMode,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Lever } from "../ui/Lever.tsx";
import { SegControl } from "../ui/SegControl.tsx";
import type { Dept } from "../../lib/sim/types.ts";

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
  if (!rows.length) {
    return (
      <div className="ledger-wrap">
        <div className="empty">No quarters recorded. Set out a bill and deliver it.</div>
      </div>
    );
  }
  const signCls = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th>Quarter</th>
            <th>Growth</th>
            <th>Trend</th>
            <th>Inflation</th>
            <th>Unemp.</th>
            <th>Balance</th>
            <th>Debt</th>
            <th>Yield</th>
            <th>Approval</th>
            <th>Capital</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td className={signCls(r.growth)}>{fmt(r.growth, 1)}</td>
              <td>{r.trend != null ? r.trend.toFixed(1) : "—"}</td>
              <td>{r.inflation.toFixed(1)}</td>
              <td>{r.unemployment.toFixed(1)}</td>
              <td className={signCls(r.balance)}>{fmt(r.balance, 1)}</td>
              <td>{r.debt.toFixed(0)}</td>
              <td>{r.yield.toFixed(2)}</td>
              <td>{r.approval.toFixed(0)}</td>
              <td>{Math.round(r.capital)}</td>
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
        {DEPTS.map((d: Dept) => {
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
                      unemployment · per claimant {(adeq * 100).toFixed(0)}%
                      of the opening rate
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
          const score = held != null ? held : serviceScore(d.id, G.draft, G.econ);
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
                    service level <b>{score.toFixed(0)}</b> / 100 · holding
                    this level costs {holdCost.toFixed(2)}% of GDP
                  </>
                }
                onInput={(id, v) => {
                  setDraftSpend(id, v);
                }}
                onCommit={(id, v) => setDraftSpend(id, v)}
              />
              <div style={{ marginTop: 6, padding: "0 12px 8px" }}>
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
      <Eyebrow className="mt">The ledger</Eyebrow>
      <LedgerTable />
    </>
  );
}
