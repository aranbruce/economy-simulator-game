"use client";

import type { ReactNode } from "react";
import {
  REGIMES,
  REGIME_BY_ID,
  TAXES,
  TAX_BY_ID,
  VICE_BY_ID,
  BAND_NAMES,
  T,
  aggregate,
  revenue,
  incomeYield,
  taxAvailable,
  dragRatio,
  dp,
  money,
  thresholdSliderMax,
  compositionBarData,
  effectiveBands,
  withIncomeOn,
  withNi,
} from "../../lib/sim/engine.ts";
import {
  setDraftRegime,
  introduceTax,
  abolishTax,
  setDraftTaxRate,
  setIncomeOn,
  setNiOn,
  setIncomeAllowance,
  setIncomeField,
  setIncomeUprate,
  setIncomeBandField,
  addIncomeBand,
  delIncomeBand,
  setNiRate,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import type { Tax, Regime } from "../../lib/sim/types.ts";

const GROUPS: [string, string][] = [
  ["wealth", "Capital, land and inheritance"],
  ["consumption", "Consumption and duties"],
  ["corporate", "Business"],
  ["vice", "Regulated goods and services"],
];

function RegimeCards({ G }: { G: any }) {
  return (
    <div className="cards">
      {REGIMES.map((r: Regime) => {
        const on = G.draft.regime === r.id;
        const isLaw = G.law.regime === r.id;
        return (
          <div key={r.id} className={`card ${isLaw ? "on" : ""} ${on && !isLaw ? "staged" : ""}`.trim()}>
            <h4>
              {r.name}
              <span className="cat">{isLaw ? "in force" : `${r.pc} capital`}</span>
            </h4>
            <p>{T(r.blurb)}</p>
            <div className="foot">
              {on ? (
                <span className="pc">{isLaw ? "Current system" : "Staged in the bill"}</span>
              ) : (
                <button className="btn" onClick={() => setDraftRegime(r.id)}>
                  Adopt
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompositionBar() {
  const { bars, legend } = compositionBarData();
  return (
    <>
      <svg viewBox="0 0 100 22" width="100%" height="22" preserveAspectRatio="none">
        {bars.map((b) => (
          <rect key={b.key} x={`${b.x}%`} y="0" width={`${b.width}%`} height="22" fill={b.color} />
        ))}
      </svg>
      <div className="legend">
        {legend.map((l) => (
          <span key={l.key}>
            <i style={{ background: l.color }} />
            {l.label} {l.value.toFixed(1)}
          </span>
        ))}
      </div>
    </>
  );
}

/** Mirrors ctrlRow() — a slider row inside the income/NI panel. */
function CtrlRow({
  name,
  value,
  min,
  max,
  step,
  disp,
  note,
  onInput,
  onCommit,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disp: ReactNode;
  note?: ReactNode;
  onInput: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-0.5 py-[7px] px-3 border-b border-edge last:border-b-0 text-[13px]">
      <div className="flex items-baseline gap-2 w-full">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">{disp}</span>
        <span className="text-[11px] w-[42px] text-right font-semibold text-ink-faint" />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={name}
        onInput={(e) => onInput(parseFloat(e.currentTarget.value))}
        onChange={(e) => onCommit(parseFloat(e.currentTarget.value))}
      />
      {note ? <div className="text-[11px] text-ink-faint mt-0.5">{note}</div> : null}
    </div>
  );
}

function TaxLever({ t, G, E, rev }: { t: Tax; G: any; E: any; rev: any }) {
  const s = G.draft.taxes[t.id];
  const avail = taxAvailable(t, G.draft);
  const killed = (REGIME_BY_ID[G.draft.regime].kills || []).includes(t.id);

  if (!avail) {
    return (
      <div className="py-2 px-3 border-b border-edge last:border-b-0" style={{ opacity: 0.5 }}>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span>{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            unavailable
          </span>
        </div>
        <div className="text-[11px] text-ink-faint mt-0.5">
          Requires a change to the law on {VICE_BY_ID[t.req![0]].name.toLowerCase()}.
        </div>
      </div>
    );
  }
  if (killed) {
    return (
      <div className="py-2 px-3 border-b border-edge last:border-b-0" style={{ opacity: 0.5 }}>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span>{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            abolished
          </span>
        </div>
        <div className="text-[11px] text-ink-faint mt-0.5">Removed by the flat tax structure.</div>
      </div>
    );
  }
  if (!s.on) {
    return (
      <div className="py-2 px-3 border-b border-edge last:border-b-0">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="text-ink-soft">{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            not levied
          </span>
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => introduceTax(t.id)}>
            Introduce
          </button>
        </div>
        <div className="text-[11px] text-ink-faint mt-0.5">Introducing it costs {t.pc || 6} political capital.</div>
      </div>
    );
  }
  const y = (rev.by as any)[t.id] || 0;
  const decimals = dp(t);
  return (
    <div className="py-2 px-3 border-b border-edge last:border-b-0" data-lever={t.id}>
      <div className="flex items-baseline gap-2 text-[13px]">
        <span className="font-[550]">{t.name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">{s.rate.toFixed(decimals)}%</span>
        <span className="text-[11px] w-[42px] text-right font-semibold text-ink-faint" />
      </div>
      <input
        type="range"
        min={0}
        max={t.max}
        step={t.step || 1}
        value={s.rate}
        aria-label={t.name}
        onInput={(e) => setDraftTaxRate(t.id, parseFloat(e.currentTarget.value))}
        onChange={(e) => setDraftTaxRate(t.id, parseFloat(e.currentTarget.value))}
      />
      <div className="text-[11px] text-ink-faint mt-0.5">
        raises {y.toFixed(2)}% of GDP
        {t.grp === "vice" ? ` · black market ${E.blackLevel.toFixed(0)}%` : ""}{" "}
        <button
          className="btn danger"
          style={{ marginLeft: 8, padding: "2px 7px" }}
          onClick={() => abolishTax(t.id)}
        >
          Abolish
        </button>
      </div>
    </div>
  );
}

function TaxGroupPanel({ group, label, G, E, rev }: { group: string; label: string; G: any; E: any; rev: any }) {
  const list = TAXES.filter((t: Tax) => t.grp === group);
  return (
    <>
      <Eyebrow className="mt">{label}</Eyebrow>
      <div className="bg-g-1 rounded-md border border-edge overflow-hidden">
        {list.map((t: Tax) => (
          <TaxLever key={t.id} t={t} G={G} E={E} rev={rev} />
        ))}
      </div>
    </>
  );
}

function IncomeNiPanel({ G }: { G: any }) {
  const I = G.draft.income;
  const N = G.draft.ni;
  const E = aggregate(G.draft);
  const y = incomeYield(G.draft, E, G.econ);
  const flat = !!REGIME_BY_ID[G.draft.regime].flatIncome;
  const dr = dragRatio(G.draft, G.econ);
  const incomeOn = I.on !== false;
  const dualCap = !!REGIME_BY_ID[G.draft.regime].dualCapital;
  const floorTxt = money(effectiveBands(G.draft)[0].from);

  return (
    <>
      <Eyebrow className="mt">
        Income tax <b>{incomeOn ? `${y.income.toFixed(2)}% of GDP` : "abolished"}</b>
        {incomeOn && y.capital != null ? (
          <span style={{ color: "var(--ink-faint)" }}>
            {" "}
            (labour {y.labour.toFixed(2)}, capital {y.capital.toFixed(2)})
          </span>
        ) : null}{" "}
        <button
          className={`btn ${incomeOn ? "danger " : ""}tiny`}
          style={{ marginLeft: 8 }}
          onClick={() => setIncomeOn(!incomeOn)}
        >
          {incomeOn ? "Abolish" : "Reintroduce"}
        </button>
      </Eyebrow>
      <Hint>
        {incomeOn ? (
          <>
            Labour rates apply only above their own threshold, and only to wages and salaries.
            {flat
              ? " The flat tax structure has collapsed every band into the first, and capital income is taxed at that same rate."
              : ""}
            {G.sandbox
              ? " Sandbox note: cutting the additional rate puts money where the MPC is low; with deficit finance the yield/FX channel can make the demand effect weakly negative — incidence is calibrated against relative demand from transfers and rate cuts."
              : ""}
          </>
        ) : (
          <>
            Scrapped. About {incomeYield(withIncomeOn(G.draft, true), E, G.econ).income.toFixed(2)}% of GDP
            forgone. National insurance still starts at the personal allowance.
          </>
        )}
      </Hint>
      {!incomeOn ? (
        <Panel>
          <Hint>
            The schedule is preserved so you can reintroduce it later. Abolishing costs 32 capital;
            bringing it back costs 28.
          </Hint>
        </Panel>
      ) : (
        <>
          <div className="bg-g-1 rounded-md border border-edge overflow-hidden">
            <CtrlRow
              name="Personal allowance"
              value={I.allowance}
              min={0}
              max={thresholdSliderMax(30000, I.allowance, 250)}
              step={250}
              disp={money(I.allowance)}
              note={
                <>
                  real value {Math.round(dr * 100)}% of where it started
                  {dr < 0.97 ? (
                    <>
                      {" "}
                      · <b className="warn-t">fiscal drag is raising taxes without a vote</b>
                    </>
                  ) : null}
                </>
              }
              onInput={(v) => setIncomeAllowance(v)}
              onCommit={(v) => setIncomeAllowance(v)}
            />
            <div className="flex flex-col items-stretch gap-0.5 py-[7px] px-3 border-b border-edge last:border-b-0 text-[13px]">
              <div className="flex items-baseline gap-2 w-full">
                <span className="font-[550]">Threshold policy</span>
                <span className="flex w-full bg-g-1 rounded-sm p-0.5 gap-0.5">
                  <button
                    aria-pressed={!!I.uprate}
                    className="flex-1 bg-transparent border-0 rounded py-1.25 px-1 cursor-pointer text-[10px] font-semibold text-ink-soft tracking-[.01em] transition-colors duration-150 hover:text-white aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
                    onClick={() => setIncomeUprate(true)}
                  >
                    Uprate
                  </button>
                  <button
                    aria-pressed={!I.uprate}
                    className="flex-1 bg-transparent border-0 rounded py-1.25 px-1 cursor-pointer text-[10px] font-semibold text-ink-soft tracking-[.01em] transition-colors duration-150 hover:text-white aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
                    onClick={() => setIncomeUprate(false)}
                  >
                    Freeze
                  </button>
                </span>
              </div>
              <div className="text-[11px] text-ink-faint mt-0.5">
                Freezing thresholds raises real receipts every year without announcing anything.
                Voters work it out eventually.
              </div>
            </div>
          </div>
          <div className="bg-g-1 rounded-md border border-edge overflow-hidden">
            {I.bands.map((b: any, i: number) => {
              const nm = BAND_NAMES[i] || `Band ${i + 1}`;
              const top = i + 1 < I.bands.length ? money(I.bands[i + 1].from) : "upwards";
              const dim = flat && i > 0;
              return (
                <div key={i} className={`bandblock${dim ? " dim" : ""}`}>
                  <div className="bandhead">
                    <b>{nm}</b>
                    <span>
                      {money(b.from)} to {top}
                    </span>
                    {I.bands.length > 1 && i === I.bands.length - 1 ? (
                      <button className="btn danger tiny" onClick={() => delIncomeBand(i)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <CtrlRow
                    name={`${nm} rate`}
                    value={b.rate}
                    min={0}
                    max={90}
                    step={1}
                    disp={`${b.rate}%`}
                    onInput={(v) => setIncomeBandField(i, "rate", v)}
                    onCommit={(v) => setIncomeBandField(i, "rate", v)}
                  />
                  {i > 0 ? (
                    <CtrlRow
                      name={`${nm} starts at`}
                      value={b.from}
                      min={15000}
                      max={thresholdSliderMax(300000, b.from, 1000)}
                      step={1000}
                      disp={money(b.from)}
                      onInput={(v) => setIncomeBandField(i, "from", v)}
                      onCommit={(v) => setIncomeBandField(i, "from", v)}
                    />
                  ) : null}
                </div>
              );
            })}
            {I.bands.length < 6 ? (
              <div className="bandadd">
                <button className="btn" onClick={() => addIncomeBand()}>
                  Add a band
                </button>
                <span className="pc">Restructuring the bands costs 12 capital</span>
              </div>
            ) : null}
          </div>
          {!flat ? (
            <>
              <Eyebrow className="mt">
                Capital income <b>{y.capital.toFixed(2)}% of GDP</b>
              </Eyebrow>
              <Hint>
                {dualCap
                  ? "Tax on investment returns — dividends and savings interest — not on wealth itself. Both share one flat rate under this system. Selling an asset is capital gains tax."
                  : "Tax on investment returns — dividends and savings interest — not on wealth itself, and not through the labour bands above. Selling an asset is capital gains tax."}
              </Hint>
              <div className="bg-g-1 rounded-md border border-edge overflow-hidden">
                {dualCap ? (
                  <CtrlRow
                    name="Capital income rate"
                    value={I.capitalRate != null ? I.capitalRate : 25}
                    min={0}
                    max={60}
                    step={1}
                    disp={`${I.capitalRate != null ? I.capitalRate : 25}%`}
                    note="one rate on dividends and savings interest alike"
                    onInput={(v) => setIncomeField("capitalRate", v)}
                    onCommit={(v) => setIncomeField("capitalRate", v)}
                  />
                ) : (
                  <>
                    <CtrlRow
                      name="Dividend rate"
                      value={I.divRate != null ? I.divRate : 33}
                      min={0}
                      max={60}
                      step={1}
                      disp={`${I.divRate != null ? I.divRate : 33}%`}
                      note="on dividends paid to shareholders from company profits"
                      onInput={(v) => setIncomeField("divRate", v)}
                      onCommit={(v) => setIncomeField("divRate", v)}
                    />
                    <CtrlRow
                      name="Savings rate"
                      value={I.saveRate != null ? I.saveRate : 20}
                      min={0}
                      max={60}
                      step={1}
                      disp={`${I.saveRate != null ? I.saveRate : 20}%`}
                      note="on interest from deposits, bonds and similar savings"
                      onInput={(v) => setIncomeField("saveRate", v)}
                      onCommit={(v) => setIncomeField("saveRate", v)}
                    />
                  </>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
      <Eyebrow className="mt">
        National insurance <b>{(y.employee + y.employer).toFixed(2)}% of GDP</b>
      </Eyebrow>
      <Hint>
        Two separate taxes wearing one name, and the difference is who really pays. Both start where
        income tax starts, so the personal allowance sets the floor for all three.
      </Hint>
      <div className="bg-g-1 rounded-md border border-edge overflow-hidden">
        <div className={`bandblock${N.empOn ? "" : " dim"}`}>
          <div className="bandhead">
            <b>Employee</b>
            <span>{N.empOn ? `${y.employee.toFixed(2)}% of GDP` : "abolished"}</span>
            <button
              className={`btn ${N.empOn ? "danger " : ""}tiny`}
              onClick={() => setNiOn("empOn", !N.empOn)}
            >
              {N.empOn ? "Abolish" : "Reintroduce"}
            </button>
          </div>
          {N.empOn ? (
            <CtrlRow
              name="Employee rate"
              value={N.empRate}
              min={0}
              max={30}
              step={0.5}
              disp={`${N.empRate.toFixed(1)}%`}
              note={<>on earnings above {floorTxt} · comes out of the pay packet</>}
              onInput={(v) => setNiRate("empRate", v)}
              onCommit={(v) => setNiRate("empRate", v)}
            />
          ) : (
            <div className="text-[12.5px] text-ink-soft leading-[1.4]" style={{ margin: "2px 0 0" }}>
              Scrapped. About{" "}
              {incomeYield(withNi(G.draft, "empOn", true), aggregate(G.draft), G.econ).employee.toFixed(2)}%
              of GDP forgone, and every earner above the allowance keeps it.
            </div>
          )}
        </div>
        <div className={`bandblock${N.erOn ? "" : " dim"}`}>
          <div className="bandhead">
            <b>Employer</b>
            <span>{N.erOn ? `${y.employer.toFixed(2)}% of GDP` : "abolished"}</span>
            <button
              className={`btn ${N.erOn ? "danger " : ""}tiny`}
              onClick={() => setNiOn("erOn", !N.erOn)}
            >
              {N.erOn ? "Abolish" : "Reintroduce"}
            </button>
          </div>
          {N.erOn ? (
            <CtrlRow
              name="Employer rate"
              value={N.erRate}
              min={0}
              max={30}
              step={0.1}
              disp={`${N.erRate.toFixed(1)}%`}
              note="a tax on the job, not the pay · every point adds roughly 0.06 to structural unemployment"
              onInput={(v) => setNiRate("erRate", v)}
              onCommit={(v) => setNiRate("erRate", v)}
            />
          ) : (
            <div className="text-[12.5px] text-ink-soft leading-[1.4]" style={{ margin: "2px 0 0" }}>
              Scrapped. About{" "}
              {incomeYield(withNi(G.draft, "erOn", true), aggregate(G.draft), G.econ).employer.toFixed(2)}%
              of GDP forgone, but hiring gets cheaper and structural unemployment falls.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function TaxesPanel() {
  const G = useGame();
  const E = aggregate(G.draft);
  const rev = revenue(G.draft, E);

  return (
    <>
      <Eyebrow>The structure of the system</Eyebrow>
      <Hint>
        Changing the architecture is the biggest thing you can do, and the most expensive. Rates
        within a system are cheap by comparison.
      </Hint>
      <RegimeCards G={G} />
      <Eyebrow className="mt">Where the money comes from</Eyebrow>
      <CompositionBar />
      {GROUPS.map(([group, label]) => (
        <TaxGroupPanel key={group} group={group} label={label} G={G} E={E} rev={rev} />
      ))}
      <IncomeNiPanel G={G} />
    </>
  );
}
