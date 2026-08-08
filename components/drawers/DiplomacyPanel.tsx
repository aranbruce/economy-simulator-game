"use client";

import {
  T,
  activePartners,
  partnerById,
  countryBlocId,
  blocById,
  ensureDiploStocks,
  emptyEnvoys,
  MISSIONS,
  ENVOY_TARGET,
  ENVOY_ASSIGN_PC,
  ULTIMATUM_PC,
  ICONS,
  relationTarget,
  canIssueUltimatum,
  concedeP,
  ultimatumDemandsFor,
  ultimatumQuartersLeft,
  ultimatumWaitingCopy,
  visitQuartersLeft,
  diploDeps,
  shareLabel,
  COUNTRY_REGIONS,
  pruneInvalidDraftMissions,
  relationModifiersData,
} from "../../lib/sim/engine.ts";
import { relationColour } from "../../lib/sim/partners.ts";
import {
  toggleMission,
  assignEnvoyAction,
  recallEnvoyAction,
  issueUltimatumAction,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow } from "../ui/Typography.tsx";
import { Button } from "../ui/Button.tsx";
import type { Country } from "../../lib/sim/countries.ts";
import type { Mission } from "../../lib/sim/types.ts";

const REGION_ORDER = [
  "europe",
  "americas",
  "asia",
  "africa",
  "gulf",
  "oceania",
];

function relationTone(rel: number) {
  if (rel >= 60) return "warm";
  if (rel <= 38) return "cold";
  return "neutral";
}

function missionShortLabel(m: Mission) {
  if (m.id === "summit") return "Summit";
  if (m.id === "demarche") return "Protest";
  if (m.id === "sanctionsPosture") return "Sanctions";
  return m.name.split(" / ")[0];
}

function interestTone(interest: number) {
  if (interest >= 0.25) return "for";
  if (interest <= -0.25) return "against";
  return "mixed";
}

const DIPLO_SLOT_BASE =
  "rounded-sm border border-edge bg-g-2 px-2.5 py-1.25 text-[11.5px] font-semibold";

function EnvoySummary({ G }: { G: any }) {
  if (!G.envoys) G.envoys = emptyEnvoys();
  return (
    <div className="mb-1 overflow-hidden rounded-md border border-edge bg-g-1 px-3.25 py-2.75">
      <div className="mb-2 text-[11px] font-bold tracking-[.06em] text-ink-faint uppercase">
        Your envoys
      </div>
      <div className="flex flex-wrap gap-1.5">
        {G.envoys.map((id: string | null, i: number) => {
          if (!id)
            return (
              <span
                key={i}
                className={`${DIPLO_SLOT_BASE} font-medium text-ink-faint`}
              >
                Slot {i + 1} · vacant
              </span>
            );
          const p = partnerById(id);
          return (
            <span
              key={i}
              className={`${DIPLO_SLOT_BASE} border-green/28 bg-green/8 text-green-lt`}
            >
              {p ? p.name : id}
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 text-[12.5px] leading-[1.4] text-ink-soft">
        Assign costs {ENVOY_ASSIGN_PC} capital · missions go into the bill ·
        ultimatums spend capital immediately
      </div>
    </div>
  );
}

const DIPLO_MOD_BASE =
  "max-w-full overflow-hidden rounded-pill border border-edge bg-g-2 px-1.75 py-0.75 text-[10px] font-semibold text-ink-soft text-ellipsis whitespace-nowrap";
const DIPLO_MOD_TONE: Record<string, string> = {
  up: "[&>b]:text-green-lt",
  dn: "[&>b]:text-red-lt",
  other: "[&>b]:text-ink-faint",
};
const DEMAND_TAG_TONE: Record<string, string> = {
  for: "text-green-lt bg-green/12",
  against: "text-red-lt bg-red/12",
  mixed: "text-ink-soft bg-g-3",
};
const REL_FILL_TONE: Record<string, string> = {
  warm: "bg-green",
  cold: "bg-red",
  neutral: "bg-ink-soft",
};
const REL_BADGE_SHADOW: Record<string, string> = {
  warm: "shadow-[var(--spec),0_0_0_1px_rgba(61,220,132,.25)]",
  cold: "shadow-[var(--spec),0_0_0_1px_rgba(255,90,78,.25)]",
  neutral: "shadow-[var(--spec)]",
};

function RelationModifiers({ partnerId }: { partnerId: string }) {
  const { shown, extra } = relationModifiersData(partnerId);
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap gap-1 px-3 pb-2.5">
      {shown.map((m: any, i: number) => (
        <span
          key={i}
          className={`${DIPLO_MOD_BASE} ${DIPLO_MOD_TONE[m.tone] ?? ""}`}
          title={m.label}
        >
          {m.label}{" "}
          <b className="ml-0.5 font-bold">
            {m.pts > 0 ? "+" : ""}
            {m.pts.toFixed(1)}
          </b>
        </span>
      ))}
      {extra ? (
        <span className={`${DIPLO_MOD_BASE} [&>b]:text-ink-faint`}>
          +{extra.count} more{" "}
          <b className="ml-0.5 font-bold">
            {extra.pts >= 0 ? "+" : ""}
            {extra.pts.toFixed(1)}
          </b>
        </span>
      ) : null}
    </div>
  );
}

function MissionButton({ m, p, G }: { m: Mission; p: Country; G: any }) {
  const cd = G.econ.missionCd[p.id] || 0;
  const stagedM = (G.draft.missions && G.draft.missions[p.id]) || null;
  const on = stagedM === m.id;
  const visitLeft = visitQuartersLeft(G, p.id);
  const visitActive = visitLeft > 0;
  const visitBlock =
    (m.id === "summit" || m.id === "sanctionsPosture") && visitActive && !on;
  const blocked = !on && (cd > 0 || visitBlock);
  let tip = `${m.name} · ${m.pc} capital · relations ${m.impulse > 0 ? "+" : ""}${m.impulse}`;
  if (cd > 0) tip += ` · cooldown ${cd}Q`;
  if (visitBlock) {
    tip =
      m.id === "sanctionsPosture"
        ? `Cannot start sanctions during a state visit · ${visitLeft}Q remaining`
        : `State visit underway · ${visitLeft}Q remaining`;
  }
  const verb = on ? "Cancel " : "Start ";
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-edge bg-g-2 px-2.25 py-1.75 text-[11px] font-[650] text-white shadow-spec transition duration-160 hover:border-frame hover:bg-g-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${on ? "border-blue/45 bg-accent-dim text-accent-lt" : ""}`}
      disabled={blocked}
      title={tip}
      onClick={() => toggleMission(p.id, m.id)}
    >
      <span className="min-w-0 text-left">
        {verb}
        {missionShortLabel(m)}
      </span>
      <span
        className={`flex-none text-[10px] font-bold ${on ? "text-accent-lt" : "text-ink-faint"}`}
      >
        {m.pc}
      </span>
    </button>
  );
}

function EnvoyRow({ p, G }: { p: Country; G: any }) {
  if (!G.envoys) G.envoys = emptyEnvoys();
  const envoyOn = G.envoys.includes(p.id);
  if (envoyOn) {
    return (
      <Button
        danger
        className="w-full text-center"
        onClick={() => recallEnvoyAction(p.id)}
      >
        Recall envoy
      </Button>
    );
  }
  const freeSlot = G.envoys.indexOf(null) >= 0;
  const canAssign = freeSlot && (G.capital || 0) >= ENVOY_ASSIGN_PC;
  let assignTip = `Spend ${ENVOY_ASSIGN_PC} capital · +${ENVOY_TARGET} relations per quarter`;
  if (!freeSlot) assignTip = "All envoy slots are filled";
  else if (!canAssign) assignTip = `Need ${ENVOY_ASSIGN_PC} capital`;
  return (
    <Button
      className="w-full text-center"
      disabled={!canAssign}
      title={assignTip}
      onClick={() => assignEnvoyAction(p.id)}
    >
      Assign envoy · {ENVOY_ASSIGN_PC} cap
    </Button>
  );
}

function UltimatumSection({ p, G }: { p: Country; G: any }) {
  const ultPending =
    G.ultimatums &&
    G.ultimatums[p.id] &&
    G.ultimatums[p.id].status === "pending";
  const ultCd = G.econ.ultimatumCd[p.id] || 0;
  const ultCheck = canIssueUltimatum(p.id, G);

  if (ultPending) {
    const u = G.ultimatums[p.id];
    const ultLeft = ultimatumQuartersLeft(G, p.id);
    const ultLabel = u.label || u.demand || "demand";
    const ultMeta = { policyKey: u.policyKey, label: u.label };
    const ultOdds = Math.round(
      concedeP(p.id, u.demand, G, diploDeps(), false, ultMeta) * 100,
    );
    return (
      <div className="flex flex-col gap-1 rounded-sm border border-red/24 bg-red/10 px-2.75 py-2.5 text-[11.5px] leading-[1.35]">
        <strong className="font-[650] text-white">Ultimatum issued</strong>
        <span className="text-[12px] font-[650] text-red-lt">{ultLabel}</span>
        <span className="text-[12px] leading-[1.4] text-ink-soft">
          {ultimatumWaitingCopy(ultLeft)}
        </span>
        <span className="text-[11px] text-ink-faint">
          Estimated ~{ultOdds}% chance they concede
        </span>
      </div>
    );
  }
  if (ultCd > 0) {
    return (
      <>
        <div className="flex items-center gap-2 rounded-sm bg-white/4 px-2.75 py-2.5 text-xs font-semibold text-ink-soft">
          <span
            className="flex flex-none text-ink-faint opacity-80"
            aria-hidden="true"
          >
            {ICONS.clock}
          </span>
          <span>Cooldown {ultCd}Q</span>
        </div>
        {ultCheck.reasons.length ? (
          <div className="text-[11px] leading-[1.4] text-ink-faint">
            {ultCheck.reasons.join(" · ")}
          </div>
        ) : null}
      </>
    );
  }
  if (ultCheck.ok) {
    const demands = ultimatumDemandsFor(p.id, G, diploDeps());
    return (
      <>
        {demands.map((d: any) => {
          const pct = Math.round(d.baseP * 100);
          return (
            <button
              key={d.id}
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-sm border border-edge bg-g-2 px-2.5 py-2 text-left text-[11.5px] text-white shadow-spec transition duration-160 hover:border-frame hover:bg-g-3"
              title={`Spend ${ULTIMATUM_PC} capital immediately`}
              onClick={() => issueUltimatumAction(p.id, d.id)}
            >
              <span className="min-w-0 flex-1 leading-[1.3] font-semibold">
                {d.label}
              </span>
              <span className="flex flex-none items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-amber tabular-nums">
                  ~{pct}%
                </span>
                {G.sandbox ? (
                  <span
                    className={`rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold tracking-[.03em] whitespace-nowrap uppercase ${DEMAND_TAG_TONE[interestTone(d.interest)]}`}
                  >
                    {d.interestLabel}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </>
    );
  }
  return (
    <div className="text-[11px] leading-[1.4] text-ink-faint">
      {ultCheck.reasons.join(" · ")}
    </div>
  );
}

function PartnerDiploCard({ p, G }: { p: Country; G: any }) {
  const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
  const target = relationTarget(p.id);
  const stagedM = (G.draft.missions && G.draft.missions[p.id]) || null;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  ensureDiploStocks(G.econ);
  const ultPending =
    G.ultimatums &&
    G.ultimatums[p.id] &&
    G.ultimatums[p.id].status === "pending";
  const visitLeft = visitQuartersLeft(G, p.id);
  const visitActive = visitLeft > 0;
  const relCol = relationColour(rel);
  const tone = relationTone(rel);

  const cardStateCls = stagedM
    ? "border-blue/45 shadow-[0_0_0_1px_rgba(10,132,255,.18)]"
    : visitActive
      ? "border-accent-lt/55 shadow-[0_0_0_1px_rgba(232,201,136,.22)]"
      : ultPending
        ? "border-red/55 shadow-[0_0_0_1px_rgba(255,90,78,.24),0_0_18px_rgba(255,90,78,.12)]"
        : "border-edge";
  return (
    <div
      className={`flex flex-col gap-0 overflow-hidden rounded-md border bg-g-1 p-0 transition-[background,border-color,transform] duration-180 hover:-translate-y-px hover:bg-white/6 ${cardStateCls}`}
      id={`partner-diplo-${p.id}`}
      data-partner-card={p.id}
    >
      {ultPending ? (
        <div className="flex items-center gap-2 border-b border-red/35 bg-linear-to-b from-[rgba(255,90,78,.92)] to-[rgba(220,55,45,.88)] px-3 py-2 text-[11px] font-[650] tracking-[.02em] text-white">
          <span className="diplo-ult-pulse" />
          Ultimatum live ·{" "}
          {G.ultimatums[p.id].label ||
            G.ultimatums[p.id].demand ||
            "demand"} ·{" "}
          {ultimatumQuartersLeft(G, p.id) <= 1
            ? "answer due next Deliver"
            : `${ultimatumQuartersLeft(G, p.id)}Q to respond`}
        </div>
      ) : null}
      {visitActive ? (
        <div className="flex items-center gap-2 border-b border-accent-lt/35 bg-linear-to-b from-[rgba(232,201,136,.95)] to-[rgba(201,160,90,.88)] px-3 py-2 text-[11px] font-[650] tracking-[.02em] text-[#1a1408]">
          <span className="diplo-visit-pulse" />
          State visit underway · {visitLeft} quarter{visitLeft === 1 ? "" : "s"}{" "}
          left
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2.5 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-[15px] leading-[1.2] font-[650] tracking-[-.02em]">
            {p.name}
          </h4>
          <span className="mt-0.75 block text-[9.5px] font-bold tracking-[.06em] text-ink-faint uppercase">
            {T(shareLabel(G.homeRole, p.id, p.tradeShare))}
          </span>
        </div>
        <div
          className={`min-w-10.5 flex-none rounded-sm bg-(--rel-col,var(--ink-soft)) px-2 py-1.5 text-center text-[15px] leading-none font-bold text-white ${REL_BADGE_SHADOW[tone]}`}
          style={{ ["--rel-col" as any]: relCol }}
          title={`Relations with ${p.name}`}
        >
          {rel.toFixed(0)}
        </div>
      </div>
      {bloc ? (
        <div className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[.03em] text-ink-faint uppercase">
          {bloc.name}
        </div>
      ) : null}
      <div className="grid gap-1 px-3 pb-2">
        <div className="grid grid-cols-[78px_1fr_30px] items-center gap-2 text-[11.5px]">
          <span>Relations</span>
          <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
            <i
              className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${REL_FILL_TONE[tone]}`}
              style={{ width: `${rel.toFixed(0)}%` }}
            />
          </span>
          <span className="text-right text-[11.5px] font-[650] text-ink-soft">
            {rel.toFixed(0)}
          </span>
        </div>
        <div className="text-[10.5px] text-ink-faint">
          Equilibrium{" "}
          <b className="font-[650] text-ink-soft">{target.toFixed(0)}</b>
        </div>
      </div>
      <RelationModifiers partnerId={p.id} />
      <div className="border-t border-edge bg-black/8 px-3 py-2.5">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-[10.5px] font-bold tracking-wider text-ink-soft uppercase">
          Missions
          <span className="text-[10px] font-medium tracking-normal text-ink-faint normal-case">
            Stage into bill
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.25">
          {MISSIONS.map((m: Mission) => (
            <MissionButton key={m.id} m={m} p={p} G={G} />
          ))}
        </div>
      </div>
      <div className="border-t border-edge bg-black/8 px-3 py-2.5">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-[10.5px] font-bold tracking-wider text-ink-soft uppercase">
          Envoy
          <span className="text-[10px] font-medium tracking-normal text-ink-faint normal-case">
            +{ENVOY_TARGET}/Q while posted
          </span>
        </div>
        <EnvoyRow p={p} G={G} />
      </div>
      <div
        className={
          ultPending
            ? "border-t border-red/28 bg-red/8 px-3 py-2.5"
            : "border-t border-edge bg-black/8 px-3 py-2.5"
        }
      >
        <div
          className={`mb-2 flex items-baseline justify-between gap-2 text-[10.5px] font-bold tracking-wider uppercase ${ultPending ? "text-red-lt" : "text-ink-soft"}`}
        >
          Ultimatum
          <span className="text-[10px] font-medium tracking-normal text-ink-faint normal-case">
            {ultPending
              ? "Response pending"
              : `${ULTIMATUM_PC} cap · immediate`}
          </span>
        </div>
        <div className="grid gap-1.25">
          <UltimatumSection p={p} G={G} />
        </div>
      </div>
    </div>
  );
}

export function DiplomacyPanel() {
  const G = useGame();
  ensureDiploStocks(G.econ);
  if (!G.draft.missions) G.draft.missions = {};
  pruneInvalidDraftMissions(G);

  const byRegion: Record<string, any[]> = {};
  for (const p of activePartners()) {
    const r = p.region || "other";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(p);
  }

  return (
    <>
      <EnvoySummary G={G} />
      <Eyebrow className="mt-5">Partners</Eyebrow>
      {REGION_ORDER.map((r) => {
        const list = byRegion[r];
        if (!list || !list.length) return null;
        return (
          <div key={r}>
            <Eyebrow className="mt-5">
              {(COUNTRY_REGIONS as any)[r] || r}
            </Eyebrow>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5 max-[720px]:grid-cols-1">
              {list.map((p: Country) => (
                <PartnerDiploCard key={p.id} p={p} G={G} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
