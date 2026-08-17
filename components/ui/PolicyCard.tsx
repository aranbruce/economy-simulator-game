"use client";

import {
  POLICY_BY_ID,
  type PolicyId,
  T,
  bump,
  fullEffectsData,
  itemPartyStances,
  qualEffectsData,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { EffectsBlock } from "./Effects.tsx";
import { PartyStanceChips } from "./PartyStance.tsx";
import { Button } from "./Button.tsx";
import { Card, CardFoot, CardPrice } from "./Card.tsx";
import { Callout } from "./Callout.tsx";
import type { Policy } from "../../lib/sim/types.ts";

/** A single POLICIES card — enact/repeal toggle, effects, `kills` blocker.
 *  Mounted only from LawsPanel.tsx, grouped by `Policy.lawsCat`. */
export function PolicyCard({ p }: { p: Policy }) {
  const G = useGame();
  const isLaw = !!G.law.policies[p.id];
  const staged = !!G.draft.policies[p.id];
  const pending = staged !== isLaw;
  const effectsData = G.sandbox
    ? fullEffectsData(p.imp, p.fac, p.cost, p.ch)
    : qualEffectsData(p.imp, p.fac, p.cost, p.ch);

  const toggle = () => {
    if (G.draft.policies[p.id]) delete G.draft.policies[p.id];
    else {
      G.draft.policies[p.id] = true;
      (p.kills || []).forEach((k: string) => delete G.draft.policies[k]);
    }
    bump();
  };

  const killLine = p.kills?.length ? (
    <Callout tone="amber" className="flex flex-wrap gap-x-2.5 gap-y-0.75">
      Cannot sit with{" "}
      {p.kills
        .map(
          (id) =>
            (POLICY_BY_ID[id as PolicyId] &&
              POLICY_BY_ID[id as PolicyId].name) ||
            id,
        )
        .join(", ")}
    </Callout>
  ) : null;

  return (
    <Card staged={pending} hoverable={false}>
      <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {p.name}
      </h4>
      <p className="m-0 text-xs leading-[1.42] text-ink-soft">{T(p.blurb)}</p>
      <EffectsBlock data={effectsData} />
      <PartyStanceChips
        stances={itemPartyStances("policy", {
          id: p.id,
          enacting: !isLaw,
        })}
        sandbox={!!G.sandbox}
      />
      {killLine}
      <CardFoot>
        <CardPrice>
          {pending ? "staged" : isLaw ? "In force" : `${p.pc} capital`}
        </CardPrice>
        <Button className="ml-auto" danger={staged} onClick={toggle}>
          {staged ? "Repeal" : "Enact"}
        </Button>
      </CardFoot>
    </Card>
  );
}
