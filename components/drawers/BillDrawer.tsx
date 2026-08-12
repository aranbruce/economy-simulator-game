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
import {
  setManualRate,
  setRateManual,
  setSandboxMode,
} from "../../lib/ui/actions.ts";
import { CloseIcon } from "../../lib/ui/icons.tsx";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Lever } from "../ui/Lever.tsx";
import { SegControl } from "../ui/SegControl.tsx";
import { ImpactChips, ImpactFactions } from "../ui/ImpactChips.tsx";

function ImpactStrip() {
  const data = impactStripData();
  if (!data) return null;
  const changeWord = `change${data.count === 1 ? "" : "s"}`;
  const stripHead = (
    <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-bold tracking-[.06em] text-ink-soft uppercase">
      Staged: {data.count} {changeWord} · {data.cost} capital
    </div>
  );
  if (data.career) {
    return (
      <div className="mb-3 rounded-md border border-frame bg-accent-dim px-2.75 py-2.25">
        {stripHead}
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.75 text-[11px] text-ink-soft">
          {(data.bits as string[]).join(" · ")}
        </div>
        <Hint>
          Career mode shows the direction of travel. Turn on Sandbox for exact
          four-quarter forecasts.
        </Hint>
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-md border border-frame bg-accent-dim px-2.75 py-2.25">
      {stripHead}
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
      <Eyebrow className="mt-5">What each clause does on its own</Eyebrow>
      <Hint>
        Sandbox only. Each block is that clause alone over four quarters,
        measured against passing nothing at all. Growth is cumulative GDP over
        the path, not the final quarter&rsquo;s pace. Trend growth and Potential
        are the supply-side long-run score. They will not add up to the whole
        bill, because these things interact.
      </Hint>
      {data.items.map((it: any, i: number) => (
        <div
          className="mb-1.75 rounded-md border border-edge bg-g-1 px-2.75 py-2.25"
          key={i}
        >
          <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650] tracking-[-.01em]">
            {it.label}
            <span className="ml-auto text-[11px] font-[650] whitespace-nowrap text-accent-lt">
              {it.cost} cap
            </span>
          </div>
          {it.revenue != null && (
            <div className="mt-1.25 flex flex-wrap gap-2.25 text-[11px] text-ink-faint">
              <span
                className={it.revenue > 0 ? "text-green-lt" : "text-red-lt"}
              >
                Receipts on impact {sgn(it.revenue, 2)} pts
              </span>
            </div>
          )}
          <ImpactChips chips={it.chips} />
          <ImpactFactions factions={it.factions} />
        </div>
      ))}
      {data.whole && (
        <div className="mb-1.75 rounded-md border border-frame bg-accent-dim px-2.75 py-2.25">
          <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650] tracking-[-.01em]">
            The bill as a whole
            <span className="ml-auto text-[11px] font-[650] whitespace-nowrap text-accent-lt">
              {data.whole.cost} cap
            </span>
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
    <div className="mt-2.5 mb-1.75 rounded-md border border-edge bg-g-1 p-3">
      <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650] tracking-[-.01em]">
        Four quarters at {data.pin.toFixed(2)}% vs the Bank
      </div>
      <div className="mb-1.5 text-[12.5px] leading-[1.4] text-ink-soft">
        Same law, pinned rate against the Taylor rule from today&rsquo;s
        starting point.
      </div>
      {data.empty ? (
        <div className="mt-1.25 flex flex-wrap gap-2.25 text-[11px] text-ink-faint">
          No measurable move over four quarters.
        </div>
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
            <div
              className="flex items-start gap-2.25 border-b border-edge py-1.75 text-[13px] last-of-type:border-b-0"
              key={i}
            >
              <button
                type="button"
                className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm border border-edge bg-g-1 p-0 text-ink-soft hover:border-transparent hover:bg-red/30 hover:text-white"
                title="Remove clause"
                onClick={() => {
                  billClauses()[i].undo();
                  bump();
                }}
              >
                <CloseIcon />
              </button>
              <span>{c.label}</span>
              <span className="ml-auto text-[11.5px] font-[650] whitespace-nowrap text-accent-lt">
                {c.sunk ? "paid" : c.pc}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-2 pb-2.5 text-[12.5px] leading-normal text-ink-faint">
          No clauses yet. Change anything in Budget, Taxes, Policies, Society,
          Trade or Diplomacy and it appears here to be costed before it becomes
          law.
        </div>
      )}
      {overspent ? (
        <Hint className="mt-2.5 text-red">
          {capitalShortfallHint(cost, G.capital)}
        </Hint>
      ) : null}
      <div className="mt-3 border-t border-edge pt-2.5 text-[13px]">
        <div className="flex py-0.75 text-ink-soft">
          <span>Receipts</span>
          <span className="ml-auto font-[650] text-white">
            {dr.rev.total.toFixed(1)}
          </span>
        </div>
        <div className="flex py-0.75 text-ink-soft">
          <span>Departmental</span>
          <span className="ml-auto font-[650] text-white">
            {dr.sp.prog.toFixed(1)}
          </span>
        </div>
        <div className="flex py-0.75 text-ink-soft">
          <span>Debt interest</span>
          <span className="ml-auto font-[650] text-white">
            {dr.sp.interest.toFixed(1)}
          </span>
        </div>
        <div className="mt-1.5 flex border-t border-edge py-0.75 pt-2 text-[14.5px] font-bold text-white">
          <span>{dr.balance >= 0 ? "Surplus" : "Deficit"}</span>
          <span
            className={`ml-auto ${dr.balance >= 0 ? "text-green-lt" : "text-red-lt"}`}
          >
            {fmt(dr.balance, 1)}% of GDP
          </span>
        </div>
        {Math.abs(delta) > 0.049 ? (
          <div className="pt-1.25 text-[11px] text-ink-faint">
            {sgn(delta, 1)} points versus current law
          </div>
        ) : null}
        {cl.length > 0 ? (
          <>
            <div className="mt-1.5 flex border-t border-edge py-0.75 pt-2 text-[14.5px] font-bold text-white">
              <span>Political capital</span>
              <span
                className={`ml-auto ${G.capital - cost >= 0 ? "text-white" : "text-red-lt"}`}
              >
                {Math.round(G.capital - cost)}
              </span>
            </div>
            <div className="pt-1.25 text-[11px] text-ink-faint">
              {cost > 0 ? `−${cost}` : "No change"} for this bill ·{" "}
              {Math.round(G.capital)} today
            </div>
          </>
        ) : null}
      </div>
      {G.sandbox ? <ImpactPanel cl={cl} /> : null}
      <Eyebrow className="mt-5">Rules</Eyebrow>
      <Panel padded className="mt-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-35 flex-1">
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
      <Panel padded className="mt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-35 flex-1">
            <div className="text-[13.5px] font-semibold">Game mode</div>
            <Hint className="mt-0.5">
              {G.sandbox
                ? "Sandbox — every removal-from-office path is suppressed. You keep the job regardless."
                : "Career — lose an election, a coup, or the bond market and it's over."}
            </Hint>
          </div>
          <SegControl
            mini
            value={G.sandbox ? "sandbox" : "career"}
            options={[
              ["career", "Career"],
              ["sandbox", "Sandbox"],
            ]}
            onChange={(v) => setSandboxMode(v === "sandbox")}
          />
        </div>
      </Panel>
      <button
        type="button"
        className="mx-auto mt-2.5 block cursor-pointer border-none bg-transparent text-xs font-medium text-ink-faint underline hover:text-ink"
        onClick={() => requestSetup()}
      >
        Start a new government
      </button>
    </>
  );
}
