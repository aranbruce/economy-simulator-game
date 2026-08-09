"use client";

import {
  FACTIONS,
  POLITY,
  POLITY_LADDER,
  TAXES,
  TAX_BY_ID,
  VICE,
  T,
  approvalOf,
  aggregate,
  bump,
  clamp,
  polityChangePc,
  polityCanReach,
  politySteps,
  taxAvailable,
  fullEffectsData,
  qualEffectsData,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { EffectsBlock } from "../ui/Effects.tsx";
import { Button } from "../ui/Button.tsx";
import { Card, CardGrid, CardCat, CardFoot, CardPrice } from "../ui/Card.tsx";
import type { ViceState } from "../../lib/sim/types.ts";

const FBAR_TONE: Record<string, string> = { good: "bg-green", bad: "bg-red" };

export function SocietyPanel() {
  const G = useGame();
  const E: any = aggregate(G.draft);
  const e = G.econ;
  const lawPolity = G.law.polity || "democracy";
  const draftPolity = G.draft.polity || "democracy";

  const bars = [
    ["liberty", "Civil liberty", e.liberty],
    ["crime", "Crime", e.crime],
    ["health", "Public health", e.health],
    ["env", "Environment", e.env],
    ["black", "Black market share", E.blackLevel],
    ["gini", "Inequality (Gini)", e.gini],
  ];

  const setPolity = (id: string) => {
    if (!polityCanReach(lawPolity, id)) return;
    G.draft.polity = id;
    bump();
  };

  const setVice = (id: string, state: string) => {
    G.draft.vice[id] = state;
    for (const t of TAXES) {
      if (!taxAvailable(t, G.draft)) G.draft.taxes[t.id].on = false;
    }
    bump();
  };

  return (
    <>
      <Eyebrow>Where you stand</Eyebrow>
      <div className="overflow-hidden rounded-md border border-edge bg-g-1 px-3.25 py-2.75">
        {FACTIONS.map((f) => {
          const v = G.fac[f.id];
          const cls = v > 55 ? "good" : v < 38 ? "bad" : "";
          return (
            <div
              key={f.id}
              className="mb-1 grid grid-cols-[110px_1fr_34px] items-center gap-2 text-[12.5px]"
            >
              <span>
                {f.name}{" "}
                <span className="text-[10px] text-ink-faint">
                  {Math.round(f.w * 100)}%
                </span>
              </span>
              <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
                <i
                  className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${cls ? FBAR_TONE[cls] : "bg-ink-soft"}`}
                  style={{ width: `${v.toFixed(0)}%` }}
                />
              </span>
              <span className="text-right text-[11.5px] font-[650] text-ink-soft">
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
        <div className="mt-0.75 grid grid-cols-[110px_1fr_34px] items-center gap-2 border-t border-(--rule) pt-1.25 text-[12.5px]">
          <span className="font-semibold">Approval</span>
          <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
            <i
              className="block h-full rounded-none bg-red transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)]"
              style={{ width: `${approvalOf(G.fac).toFixed(0)}%` }}
            />
          </span>
          <span className="text-right text-[11.5px] font-semibold text-ink-soft">
            {approvalOf(G.fac).toFixed(0)}
          </span>
        </div>
      </div>

      <Eyebrow className="mt-5">Social indicators</Eyebrow>
      <div className="overflow-hidden rounded-md border border-edge bg-g-1 px-3.25 py-2.75">
        {bars.map(([k, n, v]) => {
          const bad = k === "crime" || k === "black" || k === "gini";
          const tone = bad
            ? v > 50
              ? "bg-red"
              : "bg-ink-soft"
            : v > 55
              ? "bg-green"
              : "bg-ink-soft";
          return (
            <div
              key={k}
              className="mb-1 grid grid-cols-[150px_1fr_34px] items-center gap-2 text-[12.5px]"
            >
              <span>{n}</span>
              <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
                <i
                  className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${tone}`}
                  style={{ width: `${clamp(v, 0, 100).toFixed(0)}%` }}
                />
              </span>
              <span className="text-right text-[11.5px] font-[650] text-ink-soft">
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      <Eyebrow className="mt-5">Political system</Eyebrow>
      <Hint>
        Stage any system. A neighbour costs the listed capital; leaping
        democracy ↔ authoritarian costs much more. Factions move when you
        deliver.
      </Hint>
      <CardGrid>
        {POLITY_LADDER.map((id: string) => {
          const m = (POLITY as Record<string, any>)[id];
          const isLaw = id === lawPolity;
          const on = id === draftPolity;
          const pc = polityChangePc(lawPolity, id);
          const steps = politySteps(lawPolity, id);
          const leap = steps > 1;
          const cat = isLaw
            ? "in force"
            : leap
              ? `leap · ${pc} capital`
              : `${pc} capital`;
          return (
            <Card key={id} on={isLaw} staged={on && !isLaw}>
              <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
                {m.label}
                <CardCat>{cat}</CardCat>
              </h4>
              <p className="m-0 text-xs leading-[1.42] text-ink-soft">
                {m.blurb}
              </p>
              <CardFoot>
                {on ? (
                  <CardPrice>
                    {isLaw
                      ? "Current system"
                      : leap
                        ? `Staged leap — ${pc} capital`
                        : "Staged in the bill"}
                  </CardPrice>
                ) : (
                  <Button className="ml-auto" onClick={() => setPolity(id)}>
                    {isLaw ? "Revert" : leap ? "Stage leap" : "Stage"}
                  </Button>
                )}
              </CardFoot>
            </Card>
          );
        })}
      </CardGrid>

      <Eyebrow className="mt-5">What is legal, and on what terms</Eyebrow>
      <Hint>
        Prohibition pushes a market underground: no receipts, more crime.
        Legalising creates a tax base you can then set a duty on, over on the
        Taxes tab.
      </Hint>
      <CardGrid>
        {VICE.map((v) => {
          const cur = G.draft.vice[v.id];
          const inLaw = G.law.vice[v.id];
          const st = v.states.find((s: ViceState) => s.id === cur)!;
          const effectsData = G.sandbox
            ? fullEffectsData(st.imp, st.fac, 0)
            : qualEffectsData(st.imp, st.fac, 0);
          return (
            <Card key={v.id} on={cur === inLaw} staged={cur !== inLaw}>
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
      </CardGrid>
    </>
  );
}
