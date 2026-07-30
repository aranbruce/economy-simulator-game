"use client";

import type { ReactNode } from "react";
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
import type { Country } from "../../lib/sim/countries.ts";
import type { Mission } from "../../lib/sim/types.ts";

const REGION_ORDER = ["europe", "americas", "asia", "africa", "gulf", "oceania"];

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

function EnvoySummary({ G }: { G: any }) {
  if (!G.envoys) G.envoys = emptyEnvoys();
  return (
    <div className="diplo-summary bg-g-1 rounded-md border border-edge overflow-hidden">
      <div className="diplo-summary-h">Your envoys</div>
      <div className="diplo-slots">
        {G.envoys.map((id: string | null, i: number) => {
          if (!id) return <span key={i} className="diplo-slot empty">Slot {i + 1} · vacant</span>;
          const p = partnerById(id);
          return (
            <span key={i} className="diplo-slot filled">
              {p ? p.name : id}
            </span>
          );
        })}
      </div>
      <div className="text-[12.5px] text-ink-soft leading-[1.4]" style={{ margin: "6px 0 0" }}>
        Assign costs {ENVOY_ASSIGN_PC} capital · missions go into the bill · ultimatums spend
        capital immediately
      </div>
    </div>
  );
}

function RelationModifiers({ partnerId }: { partnerId: string }) {
  const { shown, extra } = relationModifiersData(partnerId);
  if (!shown.length) return null;
  return (
    <div className="diplo-mods">
      {shown.map((m: any, i: number) => (
        <span key={i} className={`diplo-mod ${m.tone}`} title={m.label}>
          {m.label} <b>{m.pts > 0 ? "+" : ""}{m.pts.toFixed(1)}</b>
        </span>
      ))}
      {extra ? (
        <span className="diplo-mod other">
          +{extra.count} more <b>{extra.pts >= 0 ? "+" : ""}{extra.pts.toFixed(1)}</b>
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
  const visitBlock = (m.id === "summit" || m.id === "sanctionsPosture") && visitActive && !on;
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
      className={`diplo-mission${on ? " on" : ""}`}
      disabled={blocked}
      title={tip}
      onClick={() => toggleMission(p.id, m.id)}
    >
      <span className="diplo-mission-name">
        {verb}
        {missionShortLabel(m)}
      </span>
      <span className="diplo-mission-pc">{m.pc}</span>
    </button>
  );
}

function EnvoyRow({ p, G }: { p: Country; G: any }) {
  if (!G.envoys) G.envoys = emptyEnvoys();
  const envoyOn = G.envoys.includes(p.id);
  if (envoyOn) {
    return (
      <button type="button" className="btn diplo-envoy danger" onClick={() => recallEnvoyAction(p.id)}>
        Recall envoy
      </button>
    );
  }
  const freeSlot = G.envoys.indexOf(null) >= 0;
  const canAssign = freeSlot && (G.capital || 0) >= ENVOY_ASSIGN_PC;
  let assignTip = `Spend ${ENVOY_ASSIGN_PC} capital · +${ENVOY_TARGET} relations per quarter`;
  if (!freeSlot) assignTip = "All envoy slots are filled";
  else if (!canAssign) assignTip = `Need ${ENVOY_ASSIGN_PC} capital`;
  return (
    <button
      type="button"
      className="btn diplo-envoy"
      disabled={!canAssign}
      title={assignTip}
      onClick={() => assignEnvoyAction(p.id)}
    >
      Assign envoy · {ENVOY_ASSIGN_PC} cap
    </button>
  );
}

function UltimatumSection({ p, G }: { p: Country; G: any }) {
  const ultPending = G.ultimatums && G.ultimatums[p.id] && G.ultimatums[p.id].status === "pending";
  const ultCd = G.econ.ultimatumCd[p.id] || 0;
  const ultCheck = canIssueUltimatum(p.id, G);

  if (ultPending) {
    const u = G.ultimatums[p.id];
    const ultLeft = ultimatumQuartersLeft(G, p.id);
    const ultLabel = u.label || u.demand || "demand";
    const ultMeta = { policyKey: u.policyKey, label: u.label };
    const ultOdds = Math.round(concedeP(p.id, u.demand, G, diploDeps(), false, ultMeta) * 100);
    return (
      <div className="diplo-ult-waiting">
        <strong>Ultimatum issued</strong>
        <span className="diplo-ult-demand">{ultLabel}</span>
        <span className="diplo-ult-countdown">{ultimatumWaitingCopy(ultLeft)}</span>
        <span className="diplo-ult-odds">Estimated ~{ultOdds}% chance they concede</span>
      </div>
    );
  }
  if (ultCd > 0) {
    return (
      <>
        <div className="diplo-ult-cooldown">
          <span className="diplo-ult-clock" aria-hidden="true">
            {ICONS.clock}
          </span>
          <span>Cooldown {ultCd}Q</span>
        </div>
        {ultCheck.reasons.length ? <div className="diplo-muted">{ultCheck.reasons.join(" · ")}</div> : null}
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
              className="diplo-demand"
              title={`Spend ${ULTIMATUM_PC} capital immediately`}
              onClick={() => issueUltimatumAction(p.id, d.id)}
            >
              <span className="diplo-demand-main">{d.label}</span>
              <span className="diplo-demand-meta">
                <span className="diplo-demand-odds">~{pct}%</span>
                {G.sandbox ? (
                  <span className={`diplo-demand-tag ${interestTone(d.interest)}`}>{d.interestLabel}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </>
    );
  }
  return <div className="diplo-muted">{ultCheck.reasons.join(" · ")}</div>;
}

function PartnerDiploCard({ p, G }: { p: Country; G: any }) {
  const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
  const target = relationTarget(p.id);
  const stagedM = (G.draft.missions && G.draft.missions[p.id]) || null;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  ensureDiploStocks(G.econ);
  const ultPending = G.ultimatums && G.ultimatums[p.id] && G.ultimatums[p.id].status === "pending";
  const visitLeft = visitQuartersLeft(G, p.id);
  const visitActive = visitLeft > 0;
  const relCol = relationColour(rel);
  const tone = relationTone(rel);

  return (
    <div
      className={`card diplo-card${stagedM ? " staged" : ""}${visitActive ? " visit-active" : ""}${ultPending ? " ult-active" : ""}`}
      id={`partner-diplo-${p.id}`}
    >
      {ultPending ? (
        <div className="diplo-ult-banner">
          <span className="diplo-ult-pulse" />
          Ultimatum live · {G.ultimatums[p.id].label || G.ultimatums[p.id].demand || "demand"} ·{" "}
          {ultimatumQuartersLeft(G, p.id) <= 1
            ? "answer due next Deliver"
            : `${ultimatumQuartersLeft(G, p.id)}Q to respond`}
        </div>
      ) : null}
      {visitActive ? (
        <div className="diplo-visit-banner">
          <span className="diplo-visit-pulse" />
          State visit underway · {visitLeft} quarter{visitLeft === 1 ? "" : "s"} left
        </div>
      ) : null}
      <div className="diplo-head">
        <div className="diplo-title">
          <h4>{p.name}</h4>
          <span className="cat">{T(shareLabel(G.homeRole, p.id, p.tradeShare))}</span>
        </div>
        <div
          className={`diplo-rel-badge ${tone}`}
          style={{ ["--rel-col" as any]: relCol }}
          title={`Relations with ${p.name}`}
        >
          {rel.toFixed(0)}
        </div>
      </div>
      {bloc ? <div className="diplo-meta">{bloc.name}</div> : null}
      <div className="diplo-rel-row">
        <div className="frow diplo-frow">
          <span>Relations</span>
          <span className="fb">
            <i className={tone} style={{ width: `${rel.toFixed(0)}%` }} />
          </span>
          <span className="fv">{rel.toFixed(0)}</span>
        </div>
        <div className="diplo-drift">
          Equilibrium <b>{target.toFixed(0)}</b>
        </div>
      </div>
      <RelationModifiers partnerId={p.id} />
      <div className="diplo-section">
        <div className="diplo-section-h">
          Missions<span>Stage into bill</span>
        </div>
        <div className="diplo-missions">
          {MISSIONS.map((m: Mission) => (
            <MissionButton key={m.id} m={m} p={p} G={G} />
          ))}
        </div>
      </div>
      <div className="diplo-section">
        <div className="diplo-section-h">
          Envoy<span>+{ENVOY_TARGET}/Q while posted</span>
        </div>
        <EnvoyRow p={p} G={G} />
      </div>
      <div className={`diplo-section${ultPending ? " ult-live" : ""}`}>
        <div className="diplo-section-h">
          Ultimatum<span>{ultPending ? "Response pending" : `${ULTIMATUM_PC} cap · immediate`}</span>
        </div>
        <div className="diplo-ultimatums">
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
      <Eyebrow className="mt">Partners</Eyebrow>
      {REGION_ORDER.map((r) => {
        const list = byRegion[r];
        if (!list || !list.length) return null;
        return (
          <div key={r}>
            <Eyebrow className="mt">{(COUNTRY_REGIONS as any)[r] || r}</Eyebrow>
            <div className="cards diplo-cards">
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
