"use client";

import type { ReactNode } from "react";
import {
  REGIMES,
  REGIME_BY_ID,
  type RegimeId,
  TAXES,
  VICE_BY_ID,
  type ViceId,
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
  setNiRate,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Button } from "../ui/Button.tsx";
import { Card, CardGrid, CardCat, CardFoot, CardPrice } from "../ui/Card.tsx";
import type { Tax, Regime } from "../../lib/sim/types.ts";

const GROUPS: [string, string][] = [
  ["wealth", "Capital, land and inheritance"],
  ["consumption", "Consumption and duties"],
  ["corporate", "Business"],
  ["vice", "Regulated goods and services"],
];

function RegimeCards({ G }: { G: any }) {
  return (
    <CardGrid>
      {REGIMES.map((r: Regime) => {
        const on = G.draft.regime === r.id;
        const isLaw = G.law.regime === r.id;
        return (
          <Card key={r.id} on={isLaw} staged={on && !isLaw}>
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              {r.name}
              <CardCat>{isLaw ? "in force" : `${r.pc} capital`}</CardCat>
            </h4>
            <p className="m-0 text-xs leading-[1.42] text-ink-soft">
              {T(r.blurb)}
            </p>
            <CardFoot>
              {on ? (
                <CardPrice>
                  {isLaw ? "Current system" : "Staged in the bill"}
                </CardPrice>
              ) : (
                <Button
                  className="ml-auto"
                  onClick={() => setDraftRegime(r.id)}
                >
                  Adopt
                </Button>
              )}
            </CardFoot>
          </Card>
        );
      })}
    </CardGrid>
  );
}

function CompositionBar() {
  const { bars, legend } = compositionBarData();
  return (
    <>
      <svg
        viewBox="0 0 100 22"
        width="100%"
        height="22"
        preserveAspectRatio="none"
      >
        {bars.map((b) => (
          <rect
            key={b.key}
            x={`${b.x}%`}
            y="0"
            width={`${b.width}%`}
            height="22"
            fill={b.color}
          />
        ))}
      </svg>
      <div className="mt-1.75 flex flex-wrap gap-x-3.25 gap-y-1.25 text-[11px] text-ink-soft">
        {legend.map((l) => (
          <span key={l.key}>
            <i
              className="mr-1.25 inline-block h-0.5 w-3 rounded-none align-[3px]"
              style={{ background: l.color }}
            />
            {l.label} {l.value.toFixed(1)}
          </span>
        ))}
      </div>
    </>
  );
}

/** Mirrors ctrlRow() — a slider row inside the income/NI panel. `secondary`
 *  visually de-emphasises a threshold slider against the primary rate
 *  slider it sits below, so the two are distinguishable at a glance rather
 *  than looking like two equally-weighted controls. */
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
    <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-[13px] last:border-b-0">
      <div className="flex w-full items-baseline gap-2">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto tracking-[-.02em]">{disp}</span>
        <span className="w-10.5 text-right text-[11px] font-semibold text-ink-faint" />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={name}
        onInput={(e) => onInput(parseFloat(e.currentTarget.value))}
        onPointerUp={(e) => onCommit(parseFloat(e.currentTarget.value))}
        onKeyUp={(e) => onCommit(parseFloat(e.currentTarget.value))}
      />
      {note ? (
        <div className="mt-0.5 text-[11px] text-ink-faint">{note}</div>
      ) : null}
    </div>
  );
}

/** A capital-income rate (dividend / savings / dual capital) with its own
 *  Abolish/Reintroduce toggle — unlike income tax and NI there's no separate
 *  on/off flag in the data model, so 0% *is* "abolished"; this just gives
 *  each rate the same affordance individually rather than only as one
 *  combined category. */
function CapitalRateRow({
  name,
  value,
  defaultValue,
  note,
  onSet,
}: {
  name: string;
  value: number;
  defaultValue: number;
  note: string;
  onSet: (v: number) => void;
}) {
  const on = value > 0;
  return (
    <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-[13px] last:border-b-0">
      <div className="flex w-full items-baseline gap-2">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">
          {on ? `${value}%` : "abolished"}
        </span>
        <Button
          danger={on}
          tiny
          className="ml-2"
          onClick={() => onSet(on ? 0 : defaultValue)}
        >
          {on ? "Abolish" : "Reintroduce"}
        </Button>
      </div>
      {on ? (
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={value}
          aria-label={name}
          onInput={(e) => onSet(parseFloat(e.currentTarget.value))}
          onPointerUp={(e) => onSet(parseFloat(e.currentTarget.value))}
          onKeyUp={(e) => onSet(parseFloat(e.currentTarget.value))}
        />
      ) : null}
      <div className="mt-0.5 text-[11px] text-ink-faint">
        {on ? note : "Scrapped. Set a rate again to reintroduce it."}
      </div>
    </div>
  );
}

function TaxLever({ t, G, E, rev }: { t: Tax; G: any; E: any; rev: any }) {
  const s = G.draft.taxes[t.id];
  const avail = taxAvailable(t, G.draft);
  const killed = (
    REGIME_BY_ID[G.draft.regime as RegimeId].kills || []
  ).includes(t.id);

  if (!avail) {
    return (
      <div className="border-b border-edge px-3 py-2 opacity-50 last:border-b-0">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span>{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            unavailable
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Requires a change to the law on{" "}
          {VICE_BY_ID[t.req![0] as ViceId].name.toLowerCase()}.
        </div>
      </div>
    );
  }
  if (killed) {
    return (
      <div className="border-b border-edge px-3 py-2 opacity-50 last:border-b-0">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span>{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            abolished
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Removed by the flat tax structure.
        </div>
      </div>
    );
  }
  if (!s.on) {
    return (
      <div className="border-b border-edge px-3 py-2 last:border-b-0">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="text-ink-soft">{t.name}</span>
          <span className="ml-auto text-[13px] font-[650] tracking-[-.02em] text-ink-faint">
            not levied
          </span>
          <Button className="ml-2" onClick={() => introduceTax(t.id)}>
            Introduce
          </Button>
        </div>
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Introducing it costs {t.pc || 6} political capital.
        </div>
      </div>
    );
  }
  const y = (rev.by as any)[t.id] || 0;
  const decimals = dp(t);
  return (
    <div
      className="border-b border-edge px-3 py-2 last:border-b-0"
      data-lever={t.id}
    >
      <div className="flex items-baseline gap-2 text-[13px]">
        <span className="font-[550]">{t.name}</span>
        <span className="ml-auto text-[13px] font-[650] tracking-[-.02em]">
          {s.rate.toFixed(decimals)}%
        </span>
        <Button danger tiny className="ml-2" onClick={() => abolishTax(t.id)}>
          Abolish
        </Button>
      </div>
      <input
        type="range"
        min={0}
        max={t.max}
        step={t.step || 1}
        value={s.rate}
        aria-label={t.name}
        onInput={(e) =>
          setDraftTaxRate(t.id, parseFloat(e.currentTarget.value))
        }
      />
      <div className="mt-0.5 text-[11px] text-ink-faint">
        raises {y.toFixed(2)}% of GDP
        {t.grp === "vice" ? ` · black market ${E.blackLevel.toFixed(0)}%` : ""}
      </div>
    </div>
  );
}

function TaxGroupPanel({
  group,
  label,
  G,
  E,
  rev,
}: {
  group: string;
  label: string;
  G: any;
  E: any;
  rev: any;
}) {
  const list = TAXES.filter((t: Tax) => t.grp === group);
  return (
    <>
      <Eyebrow className="mt-5">{label}</Eyebrow>
      <div className="overflow-hidden rounded-md border border-edge bg-g-1">
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
  const flat = !!REGIME_BY_ID[G.draft.regime as RegimeId].flatIncome;
  const dr = dragRatio(G.draft, G.econ);
  const incomeOn = I.on !== false;
  const dualCap = !!REGIME_BY_ID[G.draft.regime as RegimeId].dualCapital;
  const { pref } = useCurrencyPref();
  const ccy = pref.display || undefined;
  const floorTxt = money(effectiveBands(G.draft)[0].from, ccy, G);

  return (
    <>
      <Eyebrow className="mt-5">
        Income tax{" "}
        <b>{incomeOn ? `${y.income.toFixed(2)}% of GDP` : "abolished"}</b>
        {incomeOn && y.capital != null ? (
          <span className="text-ink-faint">
            {" "}
            (labour {y.labour.toFixed(2)}, capital {y.capital.toFixed(2)})
          </span>
        ) : null}{" "}
        {!incomeOn ? (
          <Button tiny className="ml-2" onClick={() => setIncomeOn(true)}>
            Reintroduce
          </Button>
        ) : null}
      </Eyebrow>
      <Hint>
        {incomeOn ? (
          <>
            Labour rates apply only above their own threshold, and only to wages
            and salaries.
            {flat
              ? " The flat tax structure has collapsed every band into the first, and capital income is taxed at that same rate."
              : ""}
            {G.sandbox
              ? " Sandbox note: cutting the additional rate puts money where the MPC is low; with deficit finance the yield/FX channel can make the demand effect weakly negative — incidence is calibrated against relative demand from transfers and rate cuts."
              : ""}
          </>
        ) : (
          <>
            Scrapped. About{" "}
            {incomeYield(withIncomeOn(G.draft, true), E, G.econ).income.toFixed(
              2,
            )}
            % of GDP forgone. National insurance still starts at the personal
            allowance.
          </>
        )}
      </Hint>
      {!incomeOn ? (
        <Panel>
          <Hint className="p-2">
            The schedule is preserved so you can reintroduce it later.
            Abolishing costs 32 capital; bringing it back costs 28.
          </Hint>
        </Panel>
      ) : (
        <>
          <div className="mb-2 overflow-hidden rounded-md border border-edge bg-g-1">
            <CtrlRow
              name="Personal allowance"
              value={I.allowance}
              min={0}
              max={thresholdSliderMax(30000, I.allowance, 250)}
              step={250}
              disp={money(I.allowance, ccy, G)}
              note={
                <>
                  real value {Math.round(dr * 100)}% of where it started
                  {dr < 0.97 ? (
                    <>
                      {" "}
                      · <b>fiscal drag is raising taxes without a vote</b>
                    </>
                  ) : null}
                </>
              }
              onInput={(v) => setIncomeAllowance(v)}
              onCommit={(v) => setIncomeAllowance(v)}
            />
            <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-[13px] last:border-b-0">
              <div className="flex w-full items-baseline gap-2">
                <span className="font-[550]">Threshold policy</span>
                <span className="flex w-full gap-0.5 rounded-sm bg-g-1 p-0.5">
                  <button
                    aria-pressed={!!I.uprate}
                    className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-[10px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                    onClick={() => setIncomeUprate(true)}
                  >
                    Uprate
                  </button>
                  <button
                    aria-pressed={!I.uprate}
                    className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-[10px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                    onClick={() => setIncomeUprate(false)}
                  >
                    Freeze
                  </button>
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-ink-faint">
                Freezing thresholds raises real receipts every year without
                announcing anything. Voters work it out eventually.
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-edge bg-g-1 p-2">
            {I.bands.map((b: any, i: number) => {
              const nm = BAND_NAMES[i] || `Band ${i + 1}`;
              const isLast = i + 1 >= I.bands.length;
              const isBasic = i === 0;
              const dim = flat && i > 0;
              const bandOn = isBasic || b.rate > 0;
              const lawRate =
                G.law.income.bands[i] && G.law.income.bands[i].rate;
              const defaultRate =
                lawRate != null ? lawRate : i === 0 ? 20 : i === 1 ? 40 : 45;
              return (
                <div
                  key={i}
                  className={`mb-1.75 rounded-md border border-edge bg-g-1 px-2.75 py-2.25 ${dim ? "opacity-50" : ""}`}
                >
                  <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650]">
                    <b>{nm}</b>
                    <span className="font-normal text-ink-soft">
                      {isLast
                        ? "and up"
                        : `up to ${money(I.bands[i + 1].from, ccy, G)}`}
                    </span>
                    {isBasic ? (
                      <Button
                        danger
                        tiny
                        className="ml-auto"
                        title="Abolishing the basic rate scraps income tax as a whole — every band goes with it."
                        onClick={() => setIncomeOn(false)}
                      >
                        Abolish income tax
                      </Button>
                    ) : (
                      <Button
                        danger={bandOn}
                        tiny
                        className="ml-auto"
                        onClick={() =>
                          setIncomeBandField(
                            i,
                            "rate",
                            bandOn ? 0 : defaultRate,
                          )
                        }
                      >
                        {bandOn ? "Abolish" : "Reintroduce"}
                      </Button>
                    )}
                  </div>
                  {bandOn ? (
                    <CtrlRow
                      name={`${nm} rate`}
                      value={b.rate}
                      min={0}
                      max={90}
                      step={1}
                      disp={`${b.rate}%`}
                      note={
                        isBasic
                          ? "Abolishing the basic rate scraps income tax as a whole — every band goes with it."
                          : undefined
                      }
                      onInput={(v) => setIncomeBandField(i, "rate", v)}
                      onCommit={(v) => setIncomeBandField(i, "rate", v)}
                    />
                  ) : (
                    <div className="py-1 text-[11px] text-ink-faint">
                      Scrapped. Set a rate again to reintroduce it.
                    </div>
                  )}
                  {i > 0 ? (
                    <CtrlRow
                      name={`${nm} starts at`}
                      value={b.from}
                      min={15000}
                      max={thresholdSliderMax(300000, b.from, 1000)}
                      step={1000}
                      disp={money(b.from, ccy, G)}
                      onInput={(v) => setIncomeBandField(i, "from", v)}
                      onCommit={(v) => setIncomeBandField(i, "from", v)}
                    />
                  ) : null}
                </div>
              );
            })}
            {I.bands.length < 6 ? (
              <div className="mt-1.5 flex flex-row items-center gap-2">
                <CardPrice>Restructuring the bands costs 12 capital</CardPrice>
                <Button className="ml-auto" onClick={() => addIncomeBand()}>
                  Add a band
                </Button>
              </div>
            ) : null}
          </div>
          {!flat ? (
            <>
              <Eyebrow className="mt-5">
                Capital income <b>{y.capital.toFixed(2)}% of GDP</b>
              </Eyebrow>
              <Hint>
                {dualCap
                  ? "Tax on investment returns — dividends and savings interest — not on wealth itself. Both share one flat rate under this system. Selling an asset is capital gains tax."
                  : "Tax on investment returns — dividends and savings interest — not on wealth itself, and not through the labour bands above. Selling an asset is capital gains tax. Each can be abolished on its own."}
              </Hint>
              <div className="overflow-hidden rounded-md border border-edge bg-g-1">
                {dualCap ? (
                  <CapitalRateRow
                    name="Capital income rate"
                    value={I.capitalRate != null ? I.capitalRate : 25}
                    defaultValue={25}
                    note="one rate on dividends and savings interest alike"
                    onSet={(v) => setIncomeField("capitalRate", v)}
                  />
                ) : (
                  <>
                    <CapitalRateRow
                      name="Dividend rate"
                      value={I.divRate != null ? I.divRate : 33}
                      defaultValue={33}
                      note="on dividends paid to shareholders from company profits"
                      onSet={(v) => setIncomeField("divRate", v)}
                    />
                    <CapitalRateRow
                      name="Savings rate"
                      value={I.saveRate != null ? I.saveRate : 20}
                      defaultValue={20}
                      note="on interest from deposits, bonds and similar savings"
                      onSet={(v) => setIncomeField("saveRate", v)}
                    />
                  </>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
      <Eyebrow className="mt-5">
        National insurance <b>{(y.employee + y.employer).toFixed(2)}% of GDP</b>
      </Eyebrow>
      <Hint>
        Two separate taxes wearing one name, and the difference is who really
        pays. Both start where income tax starts, so the personal allowance sets
        the floor for all three.
      </Hint>
      <div className="overflow-hidden rounded-md border border-edge bg-g-1">
        <div
          className={`mb-1.75 rounded-md border border-edge bg-g-1 px-2.75 py-2.25 ${N.empOn ? "" : "opacity-50"}`}
        >
          <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650]">
            <b>Employee</b>
            <span>
              {N.empOn ? `${y.employee.toFixed(2)}% of GDP` : "abolished"}
            </span>
            <Button
              danger={N.empOn}
              tiny
              className="ml-auto"
              onClick={() => setNiOn("empOn", !N.empOn)}
            >
              {N.empOn ? "Abolish" : "Reintroduce"}
            </Button>
          </div>
          {N.empOn ? (
            <CtrlRow
              name="Employee rate"
              value={N.empRate}
              min={0}
              max={30}
              step={0.5}
              disp={`${N.empRate.toFixed(1)}%`}
              note={
                <>on earnings above {floorTxt} · comes out of the pay packet</>
              }
              onInput={(v) => setNiRate("empRate", v)}
              onCommit={(v) => setNiRate("empRate", v)}
            />
          ) : (
            <div className="mt-0.5 text-[12.5px] leading-[1.4] text-ink-soft">
              Scrapped. About{" "}
              {incomeYield(
                withNi(G.draft, "empOn", true),
                aggregate(G.draft),
                G.econ,
              ).employee.toFixed(2)}
              % of GDP forgone, and every earner above the allowance keeps it.
            </div>
          )}
        </div>
        <div
          className={`mb-1.75 rounded-md border border-edge bg-g-1 px-2.75 py-2.25 ${N.erOn ? "" : "opacity-50"}`}
        >
          <div className="mb-1.25 flex items-baseline gap-2 text-[13px] font-[650]">
            <b>Employer</b>
            <span>
              {N.erOn ? `${y.employer.toFixed(2)}% of GDP` : "abolished"}
            </span>
            <Button
              danger={N.erOn}
              tiny
              className="ml-auto"
              onClick={() => setNiOn("erOn", !N.erOn)}
            >
              {N.erOn ? "Abolish" : "Reintroduce"}
            </Button>
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
            <div className="mt-0.5 text-[12.5px] leading-[1.4] text-ink-soft">
              Scrapped. About{" "}
              {incomeYield(
                withNi(G.draft, "erOn", true),
                aggregate(G.draft),
                G.econ,
              ).employer.toFixed(2)}
              % of GDP forgone, but hiring gets cheaper and structural
              unemployment falls.
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
        Changing the architecture is the biggest thing you can do, and the most
        expensive. Rates within a system are cheap by comparison.
      </Hint>
      <RegimeCards G={G} />
      <Eyebrow className="mt-5">Where the money comes from</Eyebrow>
      <CompositionBar />
      {GROUPS.map(([group, label]) => (
        <TaxGroupPanel
          key={group}
          group={group}
          label={label}
          G={G}
          E={E}
          rev={rev}
        />
      ))}
      <IncomeNiPanel G={G} />
    </>
  );
}
