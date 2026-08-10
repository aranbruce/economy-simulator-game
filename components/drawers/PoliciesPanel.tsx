"use client";

import { useState } from "react";
import {
  POLICIES,
  POLICY_BY_ID,
  type PolicyId,
  T,
  bump,
  fullEffectsData,
  qualEffectsData,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { SegControl } from "../ui/SegControl.tsx";
import { EffectsBlock } from "../ui/Effects.tsx";
import { Button } from "../ui/Button.tsx";
import { Card, CardGrid, CardFoot, CardPrice } from "../ui/Card.tsx";
import type { Policy } from "../../lib/sim/types.ts";

const POLICY_CAT_ORDER = [
  "Economy",
  "Social",
  "Environment",
  "Institutions",
  "Foreign",
];

export function PoliciesPanel() {
  const G = useGame();
  const [policyFilter, setPolicyFilter] = useState("all");

  const cats = POLICY_CAT_ORDER.filter((c) =>
    POLICIES.some((p: Policy) => p.cat === c),
  ).concat(
    [...new Set(POLICIES.map((p: Policy) => p.cat))].filter(
      (c) => !POLICY_CAT_ORDER.includes(c),
    ),
  );

  const matchFilter = (p: Policy) => {
    const isLaw = !!G.law.policies[p.id];
    const staged = !!G.draft.policies[p.id];
    if (policyFilter === "force") return isLaw;
    if (policyFilter === "staged") return staged !== isLaw;
    if (policyFilter === "available") return !isLaw && staged === isLaw;
    return true;
  };

  const killLine = (p: Policy) => {
    if (!p.kills || !p.kills.length) return null;
    const names = p.kills.map(
      (id) =>
        (POLICY_BY_ID[id as PolicyId] && POLICY_BY_ID[id as PolicyId].name) ||
        id,
    );
    return (
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.75 rounded-md border border-amber/20 bg-amber/10 p-2 text-[11px] text-amber">
        Cannot sit with {names.join(", ")}
      </div>
    );
  };

  const togglePolicy = (p: Policy) => {
    if (G.draft.policies[p.id]) delete G.draft.policies[p.id];
    else {
      G.draft.policies[p.id] = true;
      (p.kills || []).forEach((k: string) => delete G.draft.policies[k]);
    }
    bump();
  };

  return (
    <>
      <Eyebrow>The statute book</Eyebrow>
      <Hint>
        Enacted policy stays in force until repealed, and repeal costs capital
        too. Costs are annual, in points of GDP.
      </Hint>
      <SegControl
        mini
        className="mt-2 mb-3"
        value={policyFilter}
        options={[
          ["all", "All"],
          ["force", "In force"],
          ["staged", "Staged"],
          ["available", "Available"],
        ]}
        onChange={setPolicyFilter}
      />
      {cats.map((c) => {
        const list = POLICIES.filter(
          (p: Policy) => p.cat === c && matchFilter(p),
        );
        if (!list.length) return null;
        return (
          <div key={c}>
            <Eyebrow className="mt-5">{c}</Eyebrow>
            <CardGrid>
              {list.map((p: Policy) => {
                const isLaw = !!G.law.policies[p.id];
                const staged = !!G.draft.policies[p.id];
                const effectsData = G.sandbox
                  ? fullEffectsData(p.imp, p.fac, p.cost, p.ch)
                  : qualEffectsData(p.imp, p.fac, p.cost, p.ch);
                return (
                  <Card key={p.id} on={isLaw} staged={staged !== isLaw}>
                    <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
                      {p.name}
                    </h4>
                    <p className="m-0 text-xs leading-[1.42] text-ink-soft">
                      {T(p.blurb)}
                    </p>
                    <EffectsBlock data={effectsData} />
                    {killLine(p)}
                    <CardFoot>
                      <CardPrice>
                        {staged === isLaw
                          ? isLaw
                            ? "In force"
                            : `${p.pc} capital`
                          : "staged"}
                      </CardPrice>
                      <Button
                        className="ml-auto"
                        danger={staged}
                        onClick={() => togglePolicy(p)}
                      >
                        {staged ? "Repeal" : "Enact"}
                      </Button>
                    </CardFoot>
                  </Card>
                );
              })}
            </CardGrid>
          </div>
        );
      })}
    </>
  );
}
