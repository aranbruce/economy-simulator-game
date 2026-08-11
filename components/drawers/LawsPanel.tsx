"use client";

import {
  LAW_GROUPS,
  VICE,
  POLICIES,
  TAX_BY_ID,
  T,
  bump,
  qualEffectsData,
  fullEffectsData,
  resolveReqState,
  taxAvailable,
  getDrawerCat,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { setGroupOption, setLawField } from "../../lib/ui/actions.ts";
import { Eyebrow, Hint, Panel } from "../ui/Typography.tsx";
import { Card, CardCat } from "../ui/Card.tsx";
import { Lever } from "../ui/Lever.tsx";
import { SegControl } from "../ui/SegControl.tsx";
import { EffectsBlock } from "../ui/Effects.tsx";
import { PolicyCard } from "../ui/PolicyCard.tsx";
import type {
  LawGroup,
  LawGroupOption,
  Policy,
  ViceState,
} from "../../lib/sim/types.ts";

export type Menu =
  "state" | "labor" | "rights" | "economy" | "environment" | "justice" | "vice";

/** Read by DrawerShell.tsx, which now owns the pill row itself. */
export const MENUS: [Menu, string][] = [
  ["state", "State & Constitution"],
  ["labor", "Labor & Welfare"],
  ["rights", "Civil Rights"],
  ["economy", "Economy"],
  ["environment", "Environment"],
  ["justice", "Justice"],
  ["vice", "Vice & Narcotics"],
];

const STATE_CATS = [
  "Head of State",
  "Electoral System",
  "Political Parties",
  "Parliament",
  "Regional Sovereignty",
  "Borders & Immigration",
  "Defence",
];
const VICE_CATS = ["Vice & Narcotics"];
/* "Work" absorbs the old separate "Compensation"/"Work Hours" categories
   plus every ex-POLICIES item that read as pay/labor-market law (childcare,
   four-day week, deregulation, zero-hours ban); "Welfare" absorbs the old
   "Welfare Safety Net" plus the ex-POLICIES welfare items — one category
   per domain instead of two similarly-named ones split across drawers. */
const LABOR_CATS = [
  "Work",
  "Housing",
  "Welfare",
  "Retirement",
  "Workplace Association",
];
/* Personal/social rights, split out of State & Constitution (which stays
   about state structure) and Vice & Narcotics (which stays its own pill).
   "Civil Liberties" moved here wholesale — assembly/strike rights and
   digital ID read as rights content, not state-structure content. */
const RIGHTS_CATS = [
  "Civil Liberties",
  "Family & Bioethics",
  "Media & Speech",
  "Weapons",
  "Religious Affairs",
];
const ECONOMY_CATS = [
  "Industry & Enterprise",
  "Education",
  "Fiscal Framework",
  "Infrastructure",
];
const ENVIRONMENT_CATS = ["Energy & Climate"];
const JUSTICE_CATS = ["Policing & Prisons", "Penal Code", "Surveillance"];
const MENU_CATS: Record<Menu, string[]> = {
  state: STATE_CATS,
  labor: LABOR_CATS,
  rights: RIGHTS_CATS,
  economy: ECONOMY_CATS,
  environment: ENVIRONMENT_CATS,
  justice: JUSTICE_CATS,
  vice: VICE_CATS,
};

interface SliderField {
  key: string;
  name: string;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  unit?: string;
  format?: (value: number, decimals: number) => string;
}
interface ToggleField {
  key: string;
  name: string;
}
interface SliderSection {
  cat: string;
  title: string;
  groupKey: string;
  fields?: SliderField[];
  toggles?: ToggleField[];
}

const SLIDER_SECTIONS: SliderSection[] = [
  {
    cat: "Head of State",
    title: "Head of state rules",
    groupKey: "headOfState",
    fields: [
      {
        key: "mandateYears",
        name: "Mandate duration",
        min: 1,
        max: 7,
        step: 1,
        decimals: 0,
        unit: " yr",
      },
    ],
  },
  {
    cat: "Electoral System",
    title: "Electoral system law",
    groupKey: "electoral",
    fields: [
      {
        key: "votingAge",
        name: "Minimum voting age",
        min: 14,
        max: 21,
        step: 1,
        decimals: 0,
        unit: "",
      },
    ],
    toggles: [{ key: "mandatoryVoting", name: "Mandatory voting" }],
  },
  {
    cat: "Work",
    title: "Minimum wage",
    groupKey: "minWage",
    fields: [
      {
        key: "rate",
        name: "Statutory rate",
        min: 0,
        max: 20,
        step: 0.1,
        decimals: 2,
        unit: "/hr",
      },
    ],
    toggles: [{ key: "on", name: "Statutory minimum wage in force" }],
  },
  {
    cat: "Work",
    title: "Work hours legislation",
    groupKey: "workHours",
    fields: [
      {
        key: "weeklyHours",
        name: "Legal weekly hours",
        min: 28,
        max: 48,
        step: 1,
        decimals: 0,
        unit: " hrs",
      },
      {
        key: "leaveDays",
        name: "Paid annual leave",
        min: 10,
        max: 40,
        step: 1,
        decimals: 0,
        unit: " days",
      },
    ],
  },
  {
    cat: "Work",
    title: "Childcare",
    groupKey: "childcare",
    fields: [
      {
        key: "subsidyPct",
        name: "Childcare subsidy",
        min: 0,
        max: 100,
        step: 5,
        decimals: 0,
        format: (v) => (v >= 100 ? "Free" : `${Math.round(v)}%`),
      },
    ],
  },
  {
    cat: "Retirement",
    title: "Retirement",
    groupKey: "pension",
    fields: [
      {
        key: "retirementAge",
        name: "Legal retirement age",
        min: 55,
        max: 70,
        step: 1,
        decimals: 0,
        unit: " yrs",
      },
      {
        key: "statePensionAnnual",
        name: "State pension",
        min: 0,
        max: 25000,
        step: 500,
        decimals: 0,
        format: (v) => `£${Math.round(v).toLocaleString()}/yr`,
      },
    ],
  },
];

function optionAllowed(law: any, o: LawGroupOption) {
  return !o.req || resolveReqState(law, o.req);
}

function GroupCard({ grp }: { grp: LawGroup }) {
  const G = useGame();
  const draftId = (G.draft.groups || {})[grp.id];
  const lawId = (G.law.groups || {})[grp.id];
  const current = grp.options.find((o) => o.id === draftId) || grp.options[0];
  const effectsData = G.sandbox
    ? fullEffectsData(current.imp, current.fac, 0, current.ch)
    : qualEffectsData(current.imp, current.fac, 0, current.ch);
  return (
    <Card staged={draftId !== lawId}>
      <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {grp.name}
        <CardCat>{current.pc} capital</CardCat>
      </h4>
      <div className="flex w-full flex-wrap gap-0.5 rounded-sm bg-g-1 p-0.5">
        {grp.options.map((o) => {
          const allowed = o.id === draftId || optionAllowed(G.draft, o);
          const staged = o.id === draftId && o.id !== lawId;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={o.id === draftId}
              disabled={!allowed}
              title={
                allowed
                  ? undefined
                  : "Not available under the current political system"
              }
              className={`flex-1 cursor-pointer rounded border-0 bg-transparent px-1.25 py-1.5 text-[11px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec focus-visible:-outline-offset-2${staged ? "bg-accent! text-[#1a1408]!" : ""}`}
              onClick={() => allowed && setGroupOption(grp.id, o.id)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="m-0 text-xs leading-[1.42] text-ink-soft">
        {T(current.blurb)}
      </p>
      <EffectsBlock data={effectsData} />
    </Card>
  );
}

function SliderSectionCard({ section }: { section: SliderSection }) {
  const G = useGame();
  const draft = G.draft[section.groupKey] || {};
  const law = G.law[section.groupKey] || {};
  return (
    <Panel padded className="mb-2">
      <div className="mb-1 text-[11px] font-bold tracking-[.04em] text-ink-faint uppercase">
        {section.title}
      </div>
      {section.toggles?.map((t) => (
        <div
          key={t.key}
          className="mb-2 flex items-center justify-between gap-2 text-[12.5px]"
        >
          <span>{t.name}</span>
          <SegControl
            mini
            className="w-28"
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            value={draft[t.key] ? "on" : "off"}
            onChange={(v) => setLawField(section.groupKey, t.key, v === "on")}
          />
        </div>
      ))}
      {section.fields?.map((f) => (
        <Lever
          key={f.key}
          id={`${section.groupKey}.${f.key}`}
          name={f.name}
          value={draft[f.key] ?? 0}
          min={f.min}
          max={f.max}
          step={f.step ?? 1}
          decimals={f.decimals ?? 0}
          unit={f.unit}
          format={f.format}
          base={law[f.key] ?? null}
          onCommit={(_, v) => setLawField(section.groupKey, f.key, v)}
        />
      ))}
    </Panel>
  );
}

/** The vice legality ladder (cannabis, gambling, alcohol, …) — moved here
 *  verbatim from SocietyPanel.tsx (same setVice handler, same VICE/
 *  taxAvailable reads). VICE/law.vice/aggregate()'s VICE loop are
 *  untouched. */
function ViceCardGrid() {
  const G = useGame();

  const setVice = (id: string, state: string) => {
    G.draft.vice[id] = state;
    bump();
  };

  return (
    <div className="flex flex-col gap-2">
      {VICE.map((v) => {
        const cur = G.draft.vice[v.id];
        const inLaw = G.law.vice[v.id];
        const st = v.states.find((s: ViceState) => s.id === cur)!;
        const effectsData = G.sandbox
          ? fullEffectsData(st.imp, st.fac, 0)
          : qualEffectsData(st.imp, st.fac, 0);
        return (
          <Card key={v.id} staged={cur !== inLaw}>
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              {v.name}
              <CardCat>{v.pc} capital</CardCat>
            </h4>
            <div className="flex w-full gap-0.5 rounded-sm bg-g-1 p-0.5">
              {v.states.map((s: ViceState) => {
                const staged = s.id === cur && s.id !== inLaw;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === cur}
                    className={`flex-1 cursor-pointer rounded border-0 bg-transparent px-1.25 py-1.5 text-[11px] font-semibold tracking-[.01em] text-ink-soft transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-g-4 aria-pressed:text-white aria-pressed:shadow-spec focus-visible:-outline-offset-2${staged ? "bg-accent! text-[#1a1408]!" : ""}`}
                    onClick={() => setVice(v.id, s.id)}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-xs leading-[1.42] text-ink-soft">
              {T(st.blurb)}
            </p>
            <EffectsBlock data={effectsData} />
            {v.tax ? (
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.75 text-[11px] text-ink-faint">
                {taxAvailable(TAX_BY_ID[v.tax], G.draft)
                  ? "Duty available"
                  : "No duty can be levied in this state"}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/** Derives a human regime-type label from three independent choices
 *  (Polity, hereditary succession, parliamentary powers) instead of storing
 *  it as its own pickable field — there is nothing to store, so nothing can
 *  ever be staged in an invalid combination or show as greyed-out. */
function regimeLabel(law: any) {
  const polity = law.polity || "democracy";
  const hereditary = (law.groups && law.groups.hereditary) === "hereditary";
  const sovereign =
    (law.groups && law.groups.parliamentaryPowers) === "sovereign";
  if (polity === "authoritarian")
    return hereditary ? "Absolute monarchy" : "Dictatorship";
  if (hereditary) return "Constitutional monarchy";
  return sovereign ? "Parliamentary republic" : "Presidential republic";
}

/** Polity itself is no longer a pickable field — `syncPolityFromGroups`
 *  (lib/sim/engine.ts) derives Democracy/Authoritarian from whichever
 *  Political Parties / Parliament / Civil Liberties options are staged, the
 *  moment any of them is set via `setGroupOption`. This banner shows the
 *  result and explains where it comes from, rather than offering a ladder
 *  that could disagree with the choices below it. */
function RegimeTypeBanner() {
  const G = useGame();
  const authoritarian = (G.draft.polity || "democracy") === "authoritarian";
  return (
    <div className="mb-3 flex flex-col gap-1.5 rounded-md border border-edge bg-g-1 px-3.25 py-2.5 text-[12.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-soft">Regime type</span>
        <span className="font-[650] text-white">{regimeLabel(G.draft)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-soft">Political system</span>
        <span
          className={`font-[650] ${authoritarian ? "text-red-lt" : "text-green-lt"}`}
        >
          {authoritarian ? "Authoritarian" : "Democracy"}
        </span>
      </div>
      <p className="m-0 text-[11px] leading-[1.4] text-ink-faint">
        Derived automatically from Political Parties, Parliament and Civil
        Liberties below — single-party rule, banned opposition, a suppressed
        parliament or banned assembly all tip the system authoritarian. Nothing
        here is picked directly.
      </p>
    </div>
  );
}

function MenuSection({ menu }: { menu: Menu }) {
  const groups = LAW_GROUPS.filter((g) => g.menu === menu);
  const cats = MENU_CATS[menu];
  const sections = SLIDER_SECTIONS.filter((s) => cats.includes(s.cat));
  return (
    <>
      {cats.map((cat) => {
        const catGroups = groups.filter((g) => g.cat === cat);
        const catSections = sections.filter((s) => s.cat === cat);
        const catPolicies = POLICIES.filter((p: Policy) => p.lawsCat === cat);
        const isHeadOfState = cat === "Head of State";
        const isVice = cat === "Vice & Narcotics";
        return (
          <div key={cat}>
            <Eyebrow className="mt-5">{cat}</Eyebrow>
            {isHeadOfState ? <RegimeTypeBanner /> : null}
            {catSections.map((s) => (
              <SliderSectionCard key={s.groupKey} section={s} />
            ))}
            {isVice ? <ViceCardGrid /> : null}
            {catGroups.length ? (
              <div className="mb-2 flex flex-col gap-2">
                {catGroups.map((g) => (
                  <GroupCard key={g.id} grp={g} />
                ))}
              </div>
            ) : null}
            {catPolicies.length ? (
              <div className="flex flex-col gap-2">
                {catPolicies.map((p) => (
                  <PolicyCard key={p.id} p={p} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function LawsPanel() {
  useGame(); // subscribe to bump() so DrawerShell's pill change re-renders us
  const menu = getDrawerCat("laws", "state") as Menu;

  return (
    <>
      <Hint className="my-3">
        Every option here is a real, costed clause — staging one adds it to the
        Programme like any tax or policy.
      </Hint>
      <MenuSection menu={menu} />
    </>
  );
}
