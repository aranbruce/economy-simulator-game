"use client";

import type { ReactNode } from "react";
import {
  TAXES,
  VICE_BY_ID,
  type ViceId,
  BAND_NAMES,
  aggregate,
  revenue,
  incomeYield,
  incomeByBand,
  taxAvailable,
  dragRatio,
  dp,
  money,
  thresholdSliderMax,
  compositionBarData,
  effectiveBands,
  itemPartyStances,
  TAPER_RATE,
  isFlatIncome,
  isDualCapital,
  getDrawerCat,
  setTab,
  setDrawerCat,
  LAW_GROUP_BY_ID,
} from "../../lib/sim/engine.ts";
import { queueDrawerLawScroll } from "../../lib/scrollDrawerPartner.ts";
import {
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
  removeIncomeBand,
  setNiRate,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { Button } from "../ui/Button.tsx";
import { CardPrice } from "../ui/Card.tsx";
import { PartyStanceChips } from "../ui/PartyStance.tsx";
import type { Tax } from "../../lib/sim/types.ts";

export type TaxCat = "income" | "wealth" | "consumption" | "corporate" | "vice";
/** Read by DrawerShell.tsx, which now owns the pill row itself. Income tax
 *  leads — it's the single largest line, so it's what opening Taxes shows
 *  first rather than sitting after every other tax group. */
export const CATS: [TaxCat, string][] = [
  ["income", "Income tax"],
  ["wealth", "Capital, land and inheritance"],
  ["consumption", "Consumption and duties"],
  ["corporate", "Business"],
  ["vice", "Regulated goods and services"],
];

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
      <div className="mt-1.75 flex flex-wrap gap-x-3.25 gap-y-1.25 text-xs text-ink-soft">
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
    <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-sm last:border-b-0">
      <div className="flex w-full items-baseline gap-2">
        <span className="font-[550]">{name}</span>
        <span className="ml-auto tracking-[-.02em]">{disp}</span>
        <span className="w-10.5 text-right text-xs font-semibold text-ink-faint" />
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
        <div className="mt-0.5 text-xs text-ink-faint">{note}</div>
      ) : null}
    </div>
  );
}

/** A capital-income rate (dividend / savings / dual capital) with its own
 *  Abolish/Introduce toggle — unlike income tax and NI there's no separate
 *  on/off flag in the data model, so 0% *is* off; this just gives each rate
 *  the same affordance individually rather than only as one combined category. */
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
    <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-sm last:border-b-0">
      <div className="flex w-full items-baseline gap-2">
        <span className="font-[550]">{name}</span>
        {on ? (
          <span className="ml-auto text-sm font-[650] tracking-[-.02em]">
            {value}%
          </span>
        ) : null}
        <Button
          danger={on}
          tiny
          className={on ? "ml-2" : "ml-auto"}
          onClick={() => onSet(on ? 0 : defaultValue)}
        >
          {on ? "Abolish" : "Introduce"}
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
      {on ? <div className="mt-0.5 text-xs text-ink-faint">{note}</div> : null}
    </div>
  );
}

/** Where a gated tax's `req` lives in the Laws drawer — vice ladder or a
 *  law-group card. Polity-gated reqs have no single card to open. */
function reqLawTarget(req: string[] | undefined): {
  menu: string;
  cardId: string;
  name: string;
} | null {
  const key = req?.[0];
  if (!key || key === "polity") return null;
  const [kind, id] = key.includes(":") ? key.split(":") : ["vice", key];
  if (kind === "vice") {
    const v = VICE_BY_ID[id as ViceId];
    return v ? { menu: "vice", cardId: id, name: v.name } : null;
  }
  if (kind === "group") {
    const grp = LAW_GROUP_BY_ID[id];
    return grp ? { menu: grp.menu, cardId: id, name: grp.name } : null;
  }
  return null;
}

function openReqLaw(req: string[] | undefined) {
  const target = reqLawTarget(req);
  if (!target) return;
  setDrawerCat("laws", target.menu);
  setTab("laws");
  queueDrawerLawScroll(target.cardId);
}

function TaxLever({ t, G, E, rev }: { t: Tax; G: any; E: any; rev: any }) {
  const s = G.draft.taxes[t.id];
  const avail = taxAvailable(t, G.draft);

  if (!avail) {
    const target = reqLawTarget(t.req);
    return (
      <div className="border-b border-edge px-3 py-2 last:border-b-0">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="text-ink-soft">{t.name}</span>
          {target ? (
            <button
              type="button"
              className="ml-auto cursor-pointer border-none bg-transparent p-0 text-sm font-[650] tracking-[-.02em] text-ink-faint underline decoration-white/20 underline-offset-4 hover:text-ink-soft hover:decoration-white/45 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              title={`Open the law on ${target.name.toLowerCase()}`}
              onClick={() => openReqLaw(t.req)}
            >
              Unavailable
            </button>
          ) : (
            <span className="ml-auto text-sm font-[650] tracking-[-.02em] text-ink-faint">
              Unavailable
            </span>
          )}
        </div>
        {target ? (
          <div className="mt-0.5 text-xs text-ink-faint">
            Requires a change to the law on{" "}
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent p-0 text-inherit underline decoration-white/20 underline-offset-2 hover:text-ink-soft hover:decoration-white/45 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              onClick={() => openReqLaw(t.req)}
            >
              {target.name.toLowerCase()}
            </button>
            .
          </div>
        ) : null}
      </div>
    );
  }
  if (!s.on) {
    return (
      <div className="border-b border-edge px-3 py-2 last:border-b-0">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="text-ink-soft">{t.name}</span>
          <Button className="ml-auto" onClick={() => introduceTax(t.id)}>
            Introduce
          </Button>
        </div>
        <div className="mt-0.5 text-xs text-ink-faint">
          Introducing it costs {t.pc || 6} political capital.
        </div>
        <PartyStanceChips
          stances={itemPartyStances("tax", {
            id: t.id,
            delta: (s.rate || t.def) - (t.def || 0) || 1,
          })}
          sandbox={!!G.sandbox}
        />
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
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-[550]">{t.name}</span>
        <span className="ml-auto text-sm font-[650] tracking-[-.02em]">
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
      <div className="mt-0.5 text-xs text-ink-faint">
        raises {y.toFixed(2)}% of GDP
        {t.grp === "vice" ? ` · black market ${E.blackLevel.toFixed(0)}%` : ""}
      </div>
      <PartyStanceChips
        stances={itemPartyStances("tax", {
          id: t.id,
          delta:
            s.rate -
              ((G.law.taxes[t.id] && G.law.taxes[t.id].rate) || s.rate) || 0.01,
        })}
        sandbox={!!G.sandbox}
      />
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

function NiSide({
  name,
  on,
  yieldPct,
  rate,
  onToggle,
  onRate,
  note,
  step,
}: {
  name: string;
  on: boolean;
  yieldPct: number;
  rate: number;
  onToggle: () => void;
  onRate: (v: number) => void;
  note: ReactNode;
  step: number;
}) {
  return (
    <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-sm last:border-b-0">
      <div className="flex w-full items-baseline gap-2">
        <span className="font-[550]">{name}</span>
        {on ? (
          <span className="ml-auto text-sm font-[650] tracking-[-.02em]">
            {rate.toFixed(1)}%
          </span>
        ) : null}
        <Button
          danger={on}
          tiny
          className={on ? "ml-2" : "ml-auto"}
          onClick={onToggle}
        >
          {on ? "Abolish" : "Introduce"}
        </Button>
      </div>
      {on ? (
        <input
          type="range"
          min={0}
          max={30}
          step={step}
          value={rate}
          aria-label={name}
          onInput={(e) => onRate(parseFloat(e.currentTarget.value))}
          onPointerUp={(e) => onRate(parseFloat(e.currentTarget.value))}
          onKeyUp={(e) => onRate(parseFloat(e.currentTarget.value))}
        />
      ) : null}
      {on ? (
        <div className="mt-0.5 text-xs text-ink-faint">
          {note} · raises {yieldPct.toFixed(2)}% of GDP
        </div>
      ) : null}
    </div>
  );
}

function IncomeNiPanel({ G }: { G: any }) {
  const I = G.draft.income;
  const N = G.draft.ni;
  const E = aggregate(G.draft);
  const y = incomeYield(G.draft, E, G.econ);
  const bandRev = incomeByBand(G.draft, E, G.econ);
  const flat = isFlatIncome(G.draft);
  const dr = dragRatio(G.draft, G.econ);
  const incomeOn = I.on !== false;
  const dualCap = isDualCapital(G.draft);
  const { pref } = useCurrencyPref();
  const ccy = pref.display || undefined;
  const floorTxt = money(effectiveBands(G.draft)[0].from, ccy, G);

  return (
    <>
      <Eyebrow className="mt-5">
        Income tax {incomeOn ? <b>{y.income.toFixed(2)}% of GDP</b> : null}
        {incomeOn && y.capital != null ? (
          <span className="text-ink-faint">
            {" "}
            (labour {y.labour.toFixed(2)}, capital {y.capital.toFixed(2)})
          </span>
        ) : null}{" "}
        {!incomeOn ? (
          <Button tiny className="ml-2" onClick={() => setIncomeOn(true)}>
            Introduce
          </Button>
        ) : null}
      </Eyebrow>
      {incomeOn ? (
        <>
          <Hint>
            Labour rates apply only above their own threshold, and only to wages
            and salaries.
            {flat
              ? " Every labour band now shares one rate, so there is nothing left to graduate — capital income below keeps its own separate rates unless you align those too."
              : ""}
            {G.sandbox
              ? " Sandbox note: cutting the additional rate puts money where the MPC is low; with deficit finance the yield/FX channel can make the demand effect weakly negative — incidence is calibrated against relative demand from transfers and rate cuts."
              : ""}
          </Hint>
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
            {flat ? null : (
              <CtrlRow
                name="Allowance taper starts at"
                value={I.taperStart}
                min={50000}
                max={thresholdSliderMax(300000, I.taperStart, 1000)}
                step={1000}
                disp={money(I.taperStart, ccy, G)}
                note={`Withdrawn 50p in the pound above this — gone entirely by ${money(I.taperStart + I.allowance / TAPER_RATE, ccy, G)}.`}
                onInput={(v) => setIncomeField("taperStart", v)}
                onCommit={(v) => setIncomeField("taperStart", v)}
              />
            )}
            <div className="flex flex-col items-stretch gap-0.5 border-b border-edge px-3 py-1.75 text-sm last:border-b-0">
              <div className="flex w-full items-baseline gap-2">
                <span className="font-[550]">Threshold policy</span>
                <span className="flex w-full gap-0.5 rounded-sm bg-g-1 p-0.5">
                  <button
                    aria-pressed={!!I.uprate}
                    className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-xs font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                    onClick={() => setIncomeUprate(true)}
                  >
                    Uprate
                  </button>
                  <button
                    aria-pressed={!I.uprate}
                    className="flex-1 cursor-pointer rounded border-0 bg-transparent px-1 py-1.25 text-xs font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec"
                    onClick={() => setIncomeUprate(false)}
                  >
                    Freeze
                  </button>
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-faint">
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
              return (
                <div
                  key={i}
                  className="mb-1.75 rounded-md border border-edge bg-g-1 px-2.75 py-2.25"
                >
                  <div className="mb-1.25 flex items-baseline gap-2 text-sm font-[650]">
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
                    ) : null}
                  </div>
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
                  <div className="mt-0.5 text-xs text-ink-faint">
                    raises {(bandRev[i] || 0).toFixed(2)}% of GDP
                  </div>
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
            <div className="mt-1.5 flex flex-row items-center gap-2">
              <CardPrice>Restructuring the bands costs 12 capital</CardPrice>
              <div className="ml-auto flex gap-2">
                {I.bands.length > 1 ? (
                  <Button danger onClick={() => removeIncomeBand()}>
                    Remove a band
                  </Button>
                ) : null}
                {I.bands.length < 6 ? (
                  <Button onClick={() => addIncomeBand()}>Add a band</Button>
                ) : null}
              </div>
            </div>
          </div>
          <Eyebrow className="mt-5">
            Capital income <b>{y.capital.toFixed(2)}% of GDP</b>
          </Eyebrow>
          <Hint>
            Tax on investment returns — dividends and savings interest — not on
            wealth itself, and not through the labour bands above. Selling an
            asset is capital gains tax. Each can be abolished on its own.
            {dualCap
              ? " The two already agree — this is a dual system, one flat rate on capital income, separate from labour."
              : ""}
          </Hint>
          <div className="overflow-hidden rounded-md border border-edge bg-g-1">
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
          </div>
        </>
      ) : null}
      <Eyebrow className="mt-5">
        National insurance{" "}
        {N.empOn || N.erOn ? (
          <b>{(y.employee + y.employer).toFixed(2)}% of GDP</b>
        ) : null}
      </Eyebrow>
      <Hint>
        Two separate taxes wearing one name, and the difference is who really
        pays. Both start where income tax starts, so the personal allowance sets
        the floor for all three.
      </Hint>
      <div className="overflow-hidden rounded-md border border-edge bg-g-1">
        <NiSide
          name="Employee"
          on={!!N.empOn}
          yieldPct={y.employee}
          rate={N.empRate}
          onToggle={() => setNiOn("empOn", !N.empOn)}
          onRate={(v) => setNiRate("empRate", v)}
          step={0.5}
          note={<>on earnings above {floorTxt} · comes out of the pay packet</>}
        />
        <NiSide
          name="Employer"
          on={!!N.erOn}
          yieldPct={y.employer}
          rate={N.erRate}
          onToggle={() => setNiOn("erOn", !N.erOn)}
          onRate={(v) => setNiRate("erRate", v)}
          step={0.1}
          note="a tax on the job, not the pay · every point adds roughly 0.06 to structural unemployment"
        />
      </div>
    </>
  );
}

export function TaxesPanel() {
  const G = useGame();
  const E = aggregate(G.draft);
  const rev = revenue(G.draft, E);
  const cat = getDrawerCat("taxes", "income") as TaxCat;
  const catLabel = CATS.find(([id]) => id === cat)?.[1] || cat;

  return (
    <>
      <Eyebrow>Where the money comes from</Eyebrow>
      <CompositionBar />
      {cat === "income" ? (
        <IncomeNiPanel G={G} />
      ) : (
        <TaxGroupPanel group={cat} label={catLabel} G={G} E={E} rev={rev} />
      )}
    </>
  );
}
