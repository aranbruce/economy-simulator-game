"use client";

import {
  balanceOf,
  billClauses,
  bump,
  fmt,
  impactPanelHtml,
  impactStripHtml,
  rateImpactHtml,
  requestSetup,
  sgn,
  RATE_FLOOR,
  MANUAL_RATE_MIN,
  clamp,
} from "../../lib/sim/engine.js";
import { setManualRate, setRateManual } from "../../lib/ui/actions.js";
import { CloseIcon } from "../../lib/ui/icons.jsx";
import { useGame } from "../../lib/ui/useGame.js";
import { Eyebrow, Hint, Panel } from "../ui/Typography.jsx";
import { Lever } from "../ui/Lever.jsx";
import { SegControl } from "../ui/SegControl.jsx";

export function BillDrawer() {
  const G = useGame();
  const cl = billClauses();
  const dr = balanceOf(G.draft, G.econ);
  const cur = balanceOf(G.law, G.econ);
  const delta = dr.balance - cur.balance;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: impactStripHtml() }} />
      {cl.length ? (
        <div id="clauses">
          {cl.map((c, i) => (
            <div className="clause" key={i}>
              <button
                type="button"
                className="x"
                title="Remove clause"
                onClick={() => {
                  billClauses()[i].undo();
                  bump();
                }}
              >
                <CloseIcon />
              </button>
              <span>{c.label}</span>
              <span className="cost">{c.sunk ? "paid" : c.pc}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-bill">
          No clauses yet. Change anything in Budget, Taxes, Policies, Society,
          Trade or Diplomacy and it appears here to be costed before it becomes
          law.
        </div>
      )}
      <div className="arith">
        <div>
          <span>Receipts</span>
          <span>{dr.rev.total.toFixed(1)}</span>
        </div>
        <div>
          <span>Departmental</span>
          <span>{dr.sp.prog.toFixed(1)}</span>
        </div>
        <div>
          <span>Debt interest</span>
          <span>{dr.sp.interest.toFixed(1)}</span>
        </div>
        <div className="total">
          <span>{dr.balance >= 0 ? "Surplus" : "Deficit"}</span>
          <span className={dr.balance >= 0 ? "pos" : "neg"}>
            {fmt(dr.balance, 1)}% of GDP
          </span>
        </div>
        {Math.abs(delta) > 0.049 ? (
          <div className="note" style={{ paddingTop: 5 }}>
            {sgn(delta, 1)} points versus current law
          </div>
        ) : null}
      </div>
      {G.sandbox ? (
        <div dangerouslySetInnerHTML={{ __html: impactPanelHtml(cl) }} />
      ) : null}
      <Eyebrow className="mt">Rules</Eyebrow>
      <Panel padded className="mt-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-[140px] flex-1">
            <div className="text-[13.5px] font-semibold">Central Bank</div>
            <Hint className="mt-0.5">
              {G.rateManual
                ? "Base rate is pinned by you. No political capital. Forecasts use the same pin."
                : "The Bank follows a Taylor rule. Switch to Manual to pin the base rate for experimentation — free, no capital cost."}
            </Hint>
          </div>
          <SegControl
            mini
            value={G.rateManual ? "manual" : "bank"}
            options={[
              ["bank", "Bank"],
              ["manual", "Manual"],
            ]}
            onChange={(v) => setRateManual(v === "manual")}
          />
        </div>
        {G.rateManual ? (
          <>
            <div id="manualRateLever" className="mt-2.5">
              <Lever
                id="manualRate"
                name="Base rate"
                value={G.manualRate}
                min={MANUAL_RATE_MIN}
                max={20}
                step={0.25}
                decimals={2}
                note="Applied immediately. Held every quarter until you return the rate to the Bank. Down to −2%; the Bank itself floors at −1%."
                onInput={(_, v) => {
                  G.manualRate = clamp(v, MANUAL_RATE_MIN, 20);
                  G.econ.rate = G.manualRate;
                  G.econ.atBound = G.econ.rate <= RATE_FLOOR + 0.02;
                }}
                onCommit={(_, v) => setManualRate(v, MANUAL_RATE_MIN)}
              />
            </div>
            <div dangerouslySetInnerHTML={{ __html: rateImpactHtml() }} />
          </>
        ) : null}
      </Panel>
      <button
        type="button"
        className="reset mt-3.5"
        onClick={() => requestSetup()}
      >
        Start a new government
      </button>
    </>
  );
}
