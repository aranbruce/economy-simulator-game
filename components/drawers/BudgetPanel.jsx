"use client";

import {
  DEPTS,
  ledgerTable,
  serviceScore,
  spendForScore,
  syncServiceHolds,
  welfareAdequacy,
  welfareCost,
} from "../../lib/sim/engine.js";
import {
  setDraftSpend,
  setDraftSpendMode,
} from "../../lib/ui/actions.js";
import { useGame } from "../../lib/ui/useGame.js";
import { Eyebrow, Hint, Panel } from "../ui/Typography.jsx";
import { Lever } from "../ui/Lever.jsx";
import { SegControl } from "../ui/SegControl.jsx";

const TRANSFER_DEPTS = { welfare: true };

function budgetModeOptions() {
  return [
    ["share", "Share of GDP"],
    ["real", "With inflation"],
    ["service", "Hold service level"],
  ];
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
                  note={`costs <b>${bill.toFixed(2)}%</b> of GDP at today&rsquo;s unemployment &middot; per claimant ${(adeq * 100).toFixed(0)}% of the opening rate`}
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
                note={`service level <b>${score.toFixed(0)}</b> / 100 &middot; holding this level costs ${holdCost.toFixed(2)}% of GDP`}
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
      <div
        className="ledger-wrap"
        dangerouslySetInnerHTML={{ __html: ledgerTable() }}
      />
    </>
  );
}
