"use client";

import {
  balanceOf,
  billClauses,
  bump,
  capitalShortfallHint,
  fmt,
  impactPanelData,
  impactStripData,
  rateImpactData,
  requestSetup,
  sgn,
  RATE_FLOOR,
  MANUAL_RATE_MIN,
  clamp,
} from "../../lib/sim/engine.ts";
import { setManualRate, setRateManual } from "../../lib/ui/actions.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Lever } from "../ui/Lever.tsx";
import { SegControl } from "../ui/SegControl.tsx";

interface ImpactChip {
  name: string;
  value: number;
  dp: number;
  up: boolean;
}

interface ImpactFactionsData {
  empty: boolean;
  best: { name: string; value: number } | null;
  worst: { name: string; value: number } | null;
  gini: { value: number; up: boolean } | null;
}

function ImpactChips({ chips }: { chips: (ImpactChip | null)[] | null }) {
  if (!chips || !chips.length) return null;
  return (
    <div className="impchips">
      {chips.filter((c): c is ImpactChip => c != null).map((c, i) => (
        <span key={i} className={c.up ? "up" : "dn"}>
          {c.name} {sgn(c.value, c.dp)}
        </span>
      ))}
    </div>
  );
}

function ImpactFactions({ factions }: { factions: ImpactFactionsData | null }) {
  if (!factions || factions.empty) {
    return <div className="impfac">No faction moves enough to notice.</div>;
  }
  return (
    <div className="impfac">
      {factions.best && (
        <span className="up">
          {factions.best.name} {sgn(factions.best.value, 1)}
        </span>
      )}
      {factions.worst && (
        <span className="dn">
          {factions.worst.name} {sgn(factions.worst.value, 1)}
        </span>
      )}
      {factions.gini && (
        <span className={factions.gini.up ? "up" : "dn"}>
          Inequality {sgn(factions.gini.value, 2)}
        </span>
      )}
    </div>
  );
}

function ImpactStrip() {
  const data = impactStripData();
  if (!data) return null;
  const changeWord = `change${data.count === 1 ? "" : "s"}`;
  if (data.career) {
    return (
      <div className="impstrip">
        <div className="impstrip-h">
          Staged: {data.count} {changeWord} · {data.cost} capital
        </div>
        <div className="eff">{(data.bits as string[]).join(" · ")}</div>
        <Hint>
          Career mode shows the direction of travel. Turn on Sandbox for exact
          four-quarter forecasts.
        </Hint>
      </div>
    );
  }
  return (
    <div className="impstrip">
      <div className="impstrip-h">
        Staged: {data.count} {changeWord} · {data.cost} capital
      </div>
      <ImpactChips chips={data.chips} />
      <ImpactFactions factions={data.factions} />
      <Hint>
        Trend growth is annualised potential growth; four-quarter moves are
        small but compound. Growth is cumulative outturn GDP.
      </Hint>
    </div>
  );
}

function ImpactPanel({ cl }: { cl: any[] }) {
  const data = impactPanelData(cl);
  if (!data) return null;
  return (
    <>
      <Eyebrow className="mt">What each clause does on its own</Eyebrow>
      <Hint>
        Sandbox only. Each block is that clause alone over four quarters,
        measured against passing nothing at all. Growth is cumulative GDP over
        the path, not the final quarter's pace. Trend growth and Potential are
        the supply-side long-run score. They will not add up to the whole
        bill, because these things interact.
      </Hint>
      {data.items.map((it: any, i: number) => (
        <div className="impblock" key={i}>
          <div className="imphead">
            {it.label}
            <span className="cost">{it.cost} cap</span>
          </div>
          {it.revenue != null && (
            <div className="impfac">
              <span className={it.revenue > 0 ? "up" : "dn"}>
                Receipts on impact {sgn(it.revenue, 2)} pts
              </span>
            </div>
          )}
          <ImpactChips chips={it.chips} />
          <ImpactFactions factions={it.factions} />
        </div>
      ))}
      {data.whole && (
        <div className="impblock whole">
          <div className="imphead">
            The bill as a whole
            <span className="cost">{data.whole.cost} cap</span>
          </div>
          <ImpactChips chips={data.whole.chips} />
          <ImpactFactions factions={data.whole.factions} />
        </div>
      )}
    </>
  );
}

function RateImpact() {
  const data = rateImpactData();
  if (!data) return null;
  return (
    <div className="impblock rate-impact">
      <div className="imphead">Four quarters at {data.pin.toFixed(2)}% vs the Bank</div>
      <div
        className="text-[12.5px] text-ink-soft leading-[1.4]"
        style={{ margin: "0 0 6px" }}
      >
        Same law, pinned rate against the Taylor rule from today's starting
        point.
      </div>
      {data.empty ? (
        <div className="impfac">No measurable move over four quarters.</div>
      ) : (
        <>
          <ImpactChips chips={data.chips} />
          <ImpactFactions factions={data.factions} />
        </>
      )}
    </div>
  );
}

export function BillDrawer() {
  const G = useGame();
  const cl = billClauses();
  const cost = cl.reduce((a: number, c: any) => a + (c.sunk ? 0 : c.pc), 0);
  const overspent = cl.length > 0 && cost > G.capital;
  const dr = balanceOf(G.draft, G.econ);
  const cur = balanceOf(G.law, G.econ);
  const delta = dr.balance - cur.balance;

  return (
    <>
      <ImpactStrip />
      {cl.length ? (
        <div id="clauses">
          {cl.map((c: any, i: number) => (
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
      {overspent ? (
        <Hint className="mt-2.5 text-[color:var(--red)]">
          {capitalShortfallHint(cost, G.capital)}
        </Hint>
      ) : null}
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
      {G.sandbox ? <ImpactPanel cl={cl} /> : null}
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
            <RateImpact />
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
