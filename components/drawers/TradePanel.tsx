"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  T,
  theCountry,
  aggregate,
  activePartners,
  countryBlocId,
  blocById,
  blocByIdOrCustom,
  blocMembers,
  blocMemberApprovals,
  blocInviteMemberApprovals,
  isCustomsUnion,
  hasIndependentCommercialPolicy,
  blocJoinBlockers,
  blocInviteBlockers,
  unionCommercialDealBlockers,
  unionAssociationDeal,
  inviteClauseLabel,
  inviteCapitalCost,
  dealBlockers,
  dealsForPartner,
  sphereRiskHint,
  effectiveTariff,
  livePartnerTariffOnPlayer,
  partnerTradeSharePct,
  currencyForSeat,
  CURRENCY_META,
  ensureDiploStocks,
  syncTariffHeadline,
  ensureTariffSchedule,
  tariffLocked,
  tariffCetBlockers,
  tariffLeverValue,
  tariffScheduleAverage,
  importTariffLevel,
  tradeExposureTarget,
  COUNTRY_REGIONS,
  BLOC_TEMPLATES,
  CUSTOM_BLOC_TEMPLATES,
  flashBillPip,
  playerCountryId,
  playerJoiningBloc,
  memberAccessionTrack,
  blocInviteCandidates,
  showBlocFoundModal,
  showBlocInviteModal,
  nationTableData,
  getDrawerCat,
  COL,
  lineChartSpec,
  snapshotPartnerTrade,
  realmGdpBn,
  fmtGdpBn,
} from "../../lib/sim/engine.ts";
import {
  toggleDraftDeal,
  toggleBlocAccession,
  withdrawBlocAccessionDraft,
  toggleBlocLeave,
  unstageBlocCreate,
  setTariffLever,
  toggleBlocInviteDraft,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { CurrencyComparisonChart } from "../ui/CurrencyChart.tsx";
import { ChartBox, LineChartSvg } from "../ui/LineChart.tsx";
import { Lever } from "../ui/Lever.tsx";
import { Button } from "../ui/Button.tsx";
import { Card, CardCat, CardFoot, CardPrice } from "../ui/Card.tsx";
import { Callout } from "../ui/Callout.tsx";
import { FlagAvatar } from "../ui/FlagAvatar.tsx";
import type { Country, CountryDeal } from "../../lib/sim/countries.ts";

const REGION_ORDER = [
  "europe",
  "americas",
  "asia",
  "africa",
  "gulf",
  "oceania",
];

export type TradeCat =
  "tariffs" | "currency" | "blocs" | "compare" | "partners" | "balance";
/** Read by DrawerShell.tsx, which now owns the pill row itself. Tariffs
 *  leads as the default landing view; "partners" is also what setTab()
 *  in engine.ts selects when a map click scrolls to a specific partner,
 *  so that card is never hidden behind a different pill. */
export const CATS: [TradeCat, string][] = [
  ["tariffs", "Tariffs"],
  ["currency", "Currency"],
  ["blocs", "Trade blocs"],
  ["compare", "Comparison"],
  ["partners", "Partners"],
  ["balance", "Net trade"],
];

const CCY_CODES = Object.keys(CURRENCY_META).sort();

function CurrencyPanel({ G }: { G: any }) {
  const fxCode = currencyForSeat(G.homeRole);
  const { pref, setDisplay } = useCurrencyPref();
  const anchorCcy = pref.display || fxCode;

  return (
    <>
      <Eyebrow>Currency</Eyebrow>
      <CurrencyComparisonChart G={G} anchorCcy={anchorCcy} />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-edge bg-g-1 px-3.5 py-2.5">
        <label className="text-xs font-semibold tracking-[.06em] text-ink-faint uppercase">
          Show amounts in
        </label>
        <select
          className="rounded border border-edge bg-g-3 px-2 py-1 text-xs text-white"
          value={pref.display || fxCode}
          onChange={(e) =>
            setDisplay(e.target.value === fxCode ? null : e.target.value)
          }
        >
          {CCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c === fxCode ? `${c} (native)` : c}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function AccessionPipeline({
  cur,
  labels = ["Invite", "Accept", "Align", "Treaty", "Member"],
}: {
  cur: number;
  labels?: string[];
}) {
  return (
    <div className="mt-2.5 mb-1.5 flex flex-wrap items-start gap-0">
      {labels.map((label, i) => {
        const done = i < cur;
        const active = i === cur;
        const dotTone = done
          ? "border-green bg-green text-white"
          : active
            ? "border-blue bg-blue text-white"
            : "";
        return (
          <span key={label} className="contents">
            <div
              className={`flex min-w-12 flex-col items-center gap-0.75 ${done || active ? "opacity-100" : "opacity-42"}`}
            >
              <span
                className={`flex size-5.5 items-center justify-center rounded-full border-2 border-edge text-xs leading-none font-bold ${dotTone}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="max-w-14 text-center text-xs leading-[1.2] text-ink-soft">
                {label}
              </span>
            </div>
            {i < labels.length - 1 ? (
              <div
                className={`mx-0.5 mt-2.5 h-0.5 min-w-2.5 flex-[0_1_24px] self-start ${done ? "bg-green" : "bg-edge"}`}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function ApprovalTable({
  approvals,
  title = "Member approval",
}: {
  approvals: any[];
  title?: string;
}) {
  if (!approvals.length) return null;
  return (
    <>
      <div className="mt-1.5 mb-2.25 flex items-center gap-2.25 text-xs font-bold tracking-widest text-ink-faint uppercase after:h-px after:flex-1 after:bg-edge after:content-['']">
        {title}
      </div>
      {approvals.map((a) => (
        <div
          key={a.id}
          className="my-0.75 grid grid-cols-[90px_1fr_36px] items-center gap-2 text-xs"
        >
          <span className="text-xs">{a.name}</span>
          <span className="h-1.25 overflow-hidden rounded-xs border border-edge bg-g-1">
            <i
              className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${a.ok ? "bg-green" : "bg-red"}`}
              style={{ width: `${a.rel.toFixed(0)}%` }}
            />
          </span>
          <span
            className={`text-right text-xs font-[650] ${a.ok ? "text-green" : "text-red"}`}
          >
            {a.rel.toFixed(0)}
          </span>
        </div>
      ))}
    </>
  );
}

function AccessionCard({ blocId, G }: { blocId: string; G: any }) {
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return null;
  const player = playerCountryId();
  if ((bloc.members || []).includes(player)) return null;
  const acc = G.blocAccession;
  const autoAcc = G.blocAccessionByCountry && G.blocAccessionByCountry[player];
  if (acc && acc.blocId !== blocId) return null;
  if (autoAcc && autoAcc.blocId !== blocId) return null;
  if (autoAcc && autoAcc.blocId === blocId) return null;
  if (acc && acc.blocId === blocId) return null;
  const spec = bloc.accession;
  const steps =
    spec && spec.steps ? spec.steps : { apply: 8, align: 14, accede: 16 };
  const staged =
    G.draft.blocAccession && G.draft.blocAccession.blocId === blocId
      ? G.draft.blocAccession.phase
      : null;
  const blockers = blocJoinBlockers(blocId, "apply");
  const blocked = blockers.length > 0;
  const pc = steps.apply || 8;
  return (
    <Card className="mt-2">
      <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {bloc.name}
        <CardCat>
          {bloc.type === "customs_union" ? "Customs union" : "FTA"}
        </CardCat>
      </h4>
      <AccessionPipeline cur={0} labels={["Apply", "Align", "Accede"]} />
      <Hint>
        One application bill starts accession. Alignment and the treaty then
        advance automatically each quarter — no further capital.
      </Hint>
      <Hint>
        Member relations and policy alignment are checked as stages complete.
      </Hint>
      {blocked ? <Callout tone="red">{blockers[0]}</Callout> : null}
      <CardFoot>
        <CardPrice>{pc} capital</CardPrice>
        <Button
          className="ml-auto"
          danger={staged === "apply"}
          disabled={blocked && staged !== "apply"}
          title={
            blocked && staged !== "apply" ? blockers.join("; ") : undefined
          }
          onClick={() => toggleBlocAccession(blocId, blockers.length)}
        >
          {staged === "apply" ? "Cancel" : "Join"}
        </Button>
      </CardFoot>
    </Card>
  );
}

function BlocMemberView({ G, bid }: { G: any; bid: string }) {
  const bloc = blocById(bid) || G.customBlocs[bid];
  const cu = isCustomsUnion(bloc);
  const members = blocMembers(bid)
    .map((id: string) => {
      const p = activePartners().find((x: Country) => x.id === id);
      return p ? p.name : id;
    })
    .join(", ");
  const invites = Object.keys(G.draft.blocInvite || {}).filter(
    (cid) => G.draft.blocInvite[cid],
  );
  const candidates = blocInviteCandidates(bid);
  const eligibleCount = candidates.filter(
    (c: any) => !c.blockers.length,
  ).length;

  const prevInvitesRef = useRef<string[]>(invites);
  useEffect(() => {
    const added = invites.find((id) => !prevInvitesRef.current.includes(id));
    prevInvitesRef.current = invites;
    if (!added) return;
    document
      .getElementById(`bloc-staged-${added}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flashBillPip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invites.join(",")]);

  return (
    <>
      <Hint>
        Member of <b>{bloc ? bloc.name : bid}</b>
        {members ? ` with ${members}` : ""}.
      </Hint>
      {cu ? (
        <Hint>
          Country-level bilateral deals are suspended in a customs union. A
          state visit with an independent partner can table a union package;
          every other member must approve.
        </Hint>
      ) : (
        <Hint>
          Members keep their own commercial policy — you can still sign
          bilateral deals.
        </Hint>
      )}
      <Hint>
        Any member may propose a new member; every other member must approve.
        Proposals stage in your bill — use <b>Deliver</b> to send the
        invitation.
      </Hint>
      {invites.map((cid) => {
        const blockers = blocInviteBlockers(bid, cid);
        const approvals = blocInviteMemberApprovals(bid, cid);
        return (
          <Card
            key={cid}
            className="mt-2 border-accent shadow-[0_0_0_1px_rgba(10,132,255,.22)]"
            id={`bloc-staged-${cid}`}
          >
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              {inviteClauseLabel(bid, cid)}
              <CardCat>{inviteCapitalCost(bid, cid)} capital</CardCat>
            </h4>
            <Hint>
              Deliver this bill to send the invitation. After acceptance,
              accession runs automatically over several quarters.
            </Hint>
            <AccessionPipeline cur={0} />
            <ApprovalTable approvals={approvals} />
            {blockers.length ? (
              <Callout tone="red">{blockers[0]}</Callout>
            ) : (
              <div className="block text-xs text-green">
                Ready to deliver — every member approves.
              </div>
            )}
            <CardFoot>
              <Button
                danger
                tiny
                className="ml-auto"
                onClick={() => toggleBlocInviteDraft(cid)}
              >
                Cancel
              </Button>
            </CardFoot>
          </Card>
        );
      })}
      <BlocAccessionTracker G={G} bid={bid} />
      <div className="mt-3.5 mb-1">
        <Button danger={!!G.draft.blocLeave} onClick={() => toggleBlocLeave()}>
          {G.draft.blocLeave ? "Cancel leave" : "Leave"}
        </Button>
      </div>
      <div className="mt-3">
        <Button
          customSize
          className="w-full px-4 py-2.5 text-base font-semibold"
          disabled={!candidates.length}
          title={
            candidates.length
              ? undefined
              : "No eligible partners — all are members, invited, or mid-accession"
          }
          onClick={() => showBlocInviteModal(bid)}
        >
          {candidates.length
            ? `Invite a member (${eligibleCount} eligible)`
            : "Invite a member"}
        </Button>
      </div>
    </>
  );
}

function BlocAccessionTracker({ G, bid }: { G: any; bid: string }) {
  const cids = new Set<string>();
  for (const c of Object.keys(G.blocInvites || {}))
    if (G.blocInvites[c].blocId === bid) cids.add(c);
  for (const c of Object.keys(G.blocAccessionByCountry || {}))
    if (G.blocAccessionByCountry[c].blocId === bid) cids.add(c);
  if (!cids.size) return null;
  return (
    <>
      <div className="mt-2.5 mb-2.25 flex items-center gap-2.25 text-xs font-bold tracking-widest text-ink-faint uppercase after:h-px after:flex-1 after:bg-edge after:content-['']">
        Accession pipeline
      </div>
      {Array.from(cids).map((cid) => {
        const t = memberAccessionTrack(bid, cid);
        if (!t) return null;
        return (
          <Card key={cid} className="mt-2">
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              {t.name}
              <CardCat>{t.status}</CardCat>
            </h4>
            <AccessionPipeline cur={t.cur} />
            <Hint>{t.detail}</Hint>
            {!t.ok ? (
              <Callout tone="red">
                At risk — relations below the threshold
              </Callout>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

function BlocNonMemberView({ G }: { G: any }) {
  const player = playerCountryId();
  const autoAcc = G.blocAccessionByCountry && G.blocAccessionByCountry[player];
  const acc = G.blocAccession;
  const joining = playerJoiningBloc();

  let body: ReactNode;
  if (
    autoAcc ||
    (acc && G.blocAccessionByCountry && G.blocAccessionByCountry[player])
  ) {
    const track = autoAcc || G.blocAccessionByCountry[player];
    const b = blocByIdOrCustom(track.blocId);
    const t = memberAccessionTrack(track.blocId, player);
    body = (
      <>
        <Hint>
          Accession in progress: <b>{b ? b.name : track.blocId}</b> — advances
          automatically each quarter (no further capital).
        </Hint>
        <Button tiny onClick={() => withdrawBlocAccessionDraft()}>
          Cancel joining
        </Button>
        {t ? (
          <Card className="mt-2">
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              {b ? b.name : track.blocId}
              <CardCat>{t.status}</CardCat>
            </h4>
            <AccessionPipeline cur={t.cur} />
            {track.step >= 2 ? (
              <ApprovalTable approvals={blocMemberApprovals(track.blocId)} />
            ) : null}
            <Hint>{t.detail}</Hint>
          </Card>
        ) : null}
      </>
    );
  } else if (acc) {
    const b = blocByIdOrCustom(acc.blocId);
    body = (
      <>
        <Hint>
          Accession in progress: <b>{b ? b.name : acc.blocId}</b> — advances
          automatically each quarter.
        </Hint>
        <Button tiny onClick={() => withdrawBlocAccessionDraft()}>
          Cancel joining
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <Hint>
          Joining a bloc takes one application bill. Alignment and the accession
          treaty then advance automatically each quarter — no further capital.
          Members must still approve at the final step.
        </Hint>
        {Object.keys(BLOC_TEMPLATES).map((id) => (
          <AccessionCard key={id} blocId={id} G={G} />
        ))}
        {(Object.values(G.customBlocs || {}) as any[])
          .filter((cb) => cb && cb.founder === player)
          .map((cb) => (
            <AccessionCard key={cb.id} blocId={cb.id} G={G} />
          ))}
      </>
    );
  }

  return (
    <>
      {body}
      {!joining ? (
        G.draft.blocCreate ? (
          <Card className="mt-3">
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              Found{" "}
              <b>
                {G.draft.blocCreate.name ||
                  ((CUSTOM_BLOC_TEMPLATES as any)[G.draft.blocCreate.template]
                    ?.name ??
                    "bloc")}
              </b>
              <CardCat>
                {(CUSTOM_BLOC_TEMPLATES as any)[G.draft.blocCreate.template]
                  ?.pc ?? 28}{" "}
                capital
              </CardCat>
            </h4>
            <Hint>
              {G.draft.blocCreate.template === "deep_integration"
                ? "Customs union · zero internal tariffs · common external tariff locked at 5%"
                : "Free trade area · preferential internal rates · members keep independent tariff policy"}
            </Hint>
            <CardFoot>
              <Button
                danger
                tiny
                className="ml-auto"
                onClick={() => unstageBlocCreate()}
              >
                Cancel
              </Button>
            </CardFoot>
          </Card>
        ) : (
          <div className="mt-3">
            <Button
              customSize
              className="w-full px-4 py-2.5 text-base font-semibold"
              onClick={() => {
                if (playerJoiningBloc()) return;
                showBlocFoundModal();
              }}
            >
              Found a trade bloc
            </Button>
          </div>
        )
      ) : null}
    </>
  );
}

function BlocMembershipPanel({ G }: { G: any }) {
  const player = playerCountryId();
  const bid = countryBlocId(player);
  return (
    <>
      <Eyebrow>Trade blocs</Eyebrow>
      {bid ? <BlocMemberView G={G} bid={bid} /> : <BlocNonMemberView G={G} />}
    </>
  );
}

function TariffScheduleSection({ G }: { G: any }) {
  ensureTariffSchedule(G.draft);
  ensureTariffSchedule(G.law);
  const lock = tariffLocked(G.draft);
  const sched = G.draft.tariffSchedule;
  const locked = lock.mode !== "none";
  /* The chair's CET is only the shared baseline against outsiders — every
   * member (chair included) can still layer their own tariff on top of it
   * for a specific outside bloc or country, same as effectiveTariff(). */
  const baseline = locked
    ? sched.cet != null
      ? sched.cet
      : (lock.cet ?? 4)
    : sched.default;

  const playerBid = countryBlocId(playerCountryId());
  const usedBlocs: Record<string, number> = {};
  for (const p of activePartners()) {
    const bid = countryBlocId(p.id);
    /* Fellow bloc members trade duty-free — no lever to tariff yourself. */
    if (bid && bid !== playerBid) usedBlocs[bid] = (usedBlocs[bid] || 0) + 1;
  }
  const byRegion: Record<string, any[]> = {};
  for (const p of activePartners()) {
    const r = p.region || "other";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(p);
  }
  const playerBloc = playerBid ? blocByIdOrCustom(playerBid) : null;

  const cetBlockers =
    locked && sched.cet != null && sched.cet !== G.law.tariffSchedule.cet
      ? tariffCetBlockers(lock.blocId)
      : [];

  return (
    <>
      {locked ? (
        <>
          <Hint>
            You are in a customs union — every member trades under one shared
            external tariff. Any member may propose a new rate; it only takes
            effect once every other member&apos;s relations clear the bar.
          </Hint>
          <div className="overflow-hidden rounded-md border border-edge bg-g-1">
            <Lever
              id="tariffCet"
              name="Common external tariff"
              value={baseline}
              min={0}
              max={25}
              step={1}
              decimals={0}
              base={tariffLeverValue("tariffCet", G.law)}
              note="The shared baseline for all partners outside your customs union"
              onInput={(_id, v) => setTariffLever("tariffCet", v)}
              onCommit={(_id, v) => setTariffLever("tariffCet", v)}
            />
            {cetBlockers.length ? (
              <Callout tone="red">
                Needs every member&apos;s approval — {cetBlockers[0]}
              </Callout>
            ) : null}
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-md border border-edge bg-g-1">
          <Lever
            id="tariffDefault"
            name="Default external tariff"
            value={sched.default}
            min={0}
            max={25}
            step={1}
            decimals={0}
            base={tariffLeverValue("tariffDefault", G.law)}
            note={`Trade-weighted average ${tariffScheduleAverage(G.draft).toFixed(1)}%`}
            onInput={(_id, v) => setTariffLever("tariffDefault", v)}
            onCommit={(_id, v) => setTariffLever("tariffDefault", v)}
          />
        </div>
      )}
      {playerBloc ? (
        <Hint>Trade with fellow {playerBloc.name} members is duty-free.</Hint>
      ) : null}
      {Object.keys(usedBlocs).map((bid) => {
        const bloc = blocByIdOrCustom(bid);
        const key = `tariffBloc:${bid}`;
        const val = sched.bloc[bid] != null ? sched.bloc[bid] : baseline;
        return (
          <div
            key={bid}
            className="overflow-hidden rounded-md border border-edge bg-g-1"
          >
            <Lever
              id={key}
              name={`${bloc ? bloc.name : bid} (${usedBlocs[bid]} countries)`}
              value={val}
              min={0}
              max={25}
              step={1}
              decimals={0}
              base={tariffLeverValue(key, G.law)}
              note="One rate for all members"
              onInput={(_id, v) => setTariffLever(key, v)}
              onCommit={(_id, v) => setTariffLever(key, v)}
            />
          </div>
        );
      })}
      {Object.keys(byRegion).map((r) => {
        const lone = byRegion[r].filter((p: Country) => !countryBlocId(p.id));
        if (!lone.length) return null;
        return (
          <div key={r}>
            <Eyebrow className="mt-5">
              {(COUNTRY_REGIONS as any)[r] || r} (non-bloc)
            </Eyebrow>
            {lone.map((p: Country) => {
              const key = `tariffCountry:${p.id}`;
              const val =
                sched.country[p.id] != null ? sched.country[p.id] : baseline;
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-md border border-edge bg-g-1"
                >
                  <Lever
                    id={key}
                    name={p.name}
                    value={val}
                    min={0}
                    max={25}
                    step={1}
                    decimals={0}
                    base={tariffLeverValue(key, G.law)}
                    note={`Effective ${effectiveTariff(p.id, G.draft).toFixed(1)}%`}
                    onInput={(_id, v) => setTariffLever(key, v)}
                    onCommit={(_id, v) => setTariffLever(key, v)}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function TradeReadout({ G, Eagg }: { G: any; Eagg: any }) {
  const importT = importTariffLevel(
    G.draft,
    Eagg,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  const pae = G.econ.partnerAccessEff || {};
  const accessPhased = (Object.values(pae) as number[]).reduce(
    (s, v) => s + v,
    0,
  );
  const exposureTarget = tradeExposureTarget(
    G.draft,
    Eagg,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  return (
    <>
      <Hint>
        Treaty benefits phase in over about five years — openness, tariff cuts
        and market access crawl in; they do not jump on the day you ratify.
      </Hint>
      <Hint>
        Retaliation {(G.econ.retaliation || 0).toFixed(1)} · trade-weighted
        tariff {importT.toFixed(1)}% · partner access {accessPhased.toFixed(1)}{" "}
        of {(Eagg.access || 0).toFixed(1)} · trade depth{" "}
        {(G.econ.tradeDepth || 0).toFixed(1)} of {exposureTarget.toFixed(1)} ·
        openness phased {(G.econ.openEff || 0).toFixed(1)} of{" "}
        {(Eagg.dealOpen || 0).toFixed(1)}
      </Hint>
    </>
  );
}

const NATION_TH =
  "first:text-left border-b border-edge px-2.5 py-2 text-right text-xs font-bold whitespace-nowrap text-ink-faint uppercase tracking-[.06em]";
const NATION_TD =
  "first:text-left border-b border-white/5 px-2.5 py-1.5 text-right";

function SortTh({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: string;
  sort: { key: string; dir: "asc" | "desc" };
  onSort: (col: string) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={NATION_TH}>
      <button
        type="button"
        className={`cursor-pointer border-0 bg-transparent p-0 font-bold tracking-[.06em] uppercase ${active ? "text-white" : "text-ink-faint hover:text-white"}`}
        onClick={() => onSort(col)}
        aria-sort={
          active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function useColSort(defaultKey: string, defaultDir: "asc" | "desc" = "desc") {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: defaultKey,
    dir: defaultDir,
  });
  const onSort = (col: string) => {
    setSort((prev) =>
      prev.key === col
        ? { key: col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: col, dir: col === "name" ? "asc" : "desc" },
    );
  };
  return { sort, onSort };
}

function cmpSort(a: number | string, b: number | string, dir: "asc" | "desc") {
  const mul = dir === "asc" ? 1 : -1;
  if (typeof a === "string" || typeof b === "string")
    return mul * String(a).localeCompare(String(b));
  return mul * ((a as number) - (b as number));
}

function partnerLineColor(i: number, n: number): string {
  const hue = Math.round((360 * i) / Math.max(1, n));
  return `hsl(${hue}, 65%, 62%)`;
}

function partnerTradeNet(row: { X: number; M: number } | null | undefined) {
  if (!row) return 0;
  return row.X - row.M;
}

function NetTradePanel({ G }: { G: any }) {
  const { pref } = useCurrencyPref();
  const fxCode = currencyForSeat(G.homeRole);
  const ccy = pref.display || fxCode;
  const { sort, onSort } = useColSort("vol");
  const hasLog = G.log.length >= 2;
  if (!hasLog) {
    return (
      <div className="p-4 text-xs text-ink-faint">
        Deliver a bill or two. The chart needs at least two quarters of data.
      </div>
    );
  }
  const col = (k: string) => G.log.map((r: any) => r[k]);
  const snap = snapshotPartnerTrade(G);
  const y = G.econ.gdp != null ? G.econ.gdp : 100;
  const gdpBn = realmGdpBn("home", G);
  const toBn = (index: number) => gdpBn * (index / Math.max(y, 1e-6));
  const partners = activePartners();
  const named = partners.map((p) => {
    const row = snap[p.id] || { X: 0, M: 0 };
    return {
      id: p.id,
      name: p.name,
      X: row.X,
      M: row.M,
      net: row.X - row.M,
      vol: row.X + row.M,
    };
  });
  const rest = snap.rest || { X: 0, M: 0 };
  const byVol = [...named].sort((a, b) => b.vol - a.vol);
  const chartIds = [...byVol.slice(0, 8).map((p) => p.id), "rest"];
  const hasPartnerHist = G.log.every(
    (r: any) => r.partnerTrade && typeof r.partnerTrade === "object",
  );
  const partnerSeries = hasPartnerHist
    ? chartIds.map((id, i) => ({
        label:
          id === "rest"
            ? "Rest of world"
            : (named.find((p) => p.id === id) || { name: id }).name,
        color: partnerLineColor(i, chartIds.length),
        data: G.log.map((r: any) =>
          partnerTradeNet(r.partnerTrade && r.partnerTrade[id]),
        ),
        wide: i === 0,
        dash: id === "rest",
      }))
    : [];
  const tableRows = [
    ...named,
    {
      id: "rest",
      name: "Rest of world",
      X: rest.X,
      M: rest.M,
      net: rest.X - rest.M,
      vol: rest.X + rest.M,
    },
  ].sort((a, b) => {
    const key = sort.key;
    if (key === "name") return cmpSort(a.name, b.name, sort.dir);
    if (key === "X") return cmpSort(a.X, b.X, sort.dir);
    if (key === "M") return cmpSort(a.M, b.M, sort.dir);
    if (key === "net") return cmpSort(a.net, b.net, sort.dir);
    return cmpSort(a.vol, b.vol, sort.dir);
  });
  const maxAbsNet = Math.max(1e-9, ...tableRows.map((r) => Math.abs(r.net)));
  const totalX = named.reduce((s, r) => s + r.X, 0) + rest.X;
  const totalM = named.reduce((s, r) => s + r.M, 0) + rest.M;
  const signCls = (v: number) =>
    v > 0.05 ? "text-green-lt" : v < -0.05 ? "text-red-lt" : "";
  const money = (index: number) => {
    const bn = toBn(index);
    if (bn < 0) return "−" + fmtGdpBn(-bn, ccy, G);
    return fmtGdpBn(bn, ccy, G);
  };

  return (
    <>
      <ChartBox
        title="Exports, imports and the net"
        caption="Index points of the national accounts — the table below is the same split in current GDP. Competitiveness runs on underlying prices, so a VAT change does not move it on its own."
      >
        <LineChartSvg
          spec={lineChartSpec(
            [
              { label: "Exports", color: COL.green, data: col("X") },
              { label: "Imports", color: COL.ox, data: col("M") },
              {
                label: "Net trade",
                color: COL.ink,
                data: col("netTrade"),
                wide: true,
              },
            ],
            { zero: true },
          )}
        />
      </ChartBox>
      <ChartBox
        title="By partner"
        caption={`Largest partners on the chart; the table is everyone, in ${ccy}. Totals match headline exports and imports.`}
      >
        {partnerSeries.length ? (
          <LineChartSvg
            spec={lineChartSpec(partnerSeries, { zero: true })}
            hideValueLabels
          />
        ) : null}
        <div
          className={`table-scroll overflow-x-auto ${partnerSeries.length ? "mt-3" : ""}`}
        >
          <table className="w-full min-w-100 border-collapse text-xs tabular-nums">
            <thead>
              <tr>
                <SortTh
                  label="Partner"
                  col="name"
                  sort={sort}
                  onSort={onSort}
                />
                <SortTh label="Exports" col="X" sort={sort} onSort={onSort} />
                <SortTh label="Imports" col="M" sort={sort} onSort={onSort} />
                <SortTh label="Total" col="vol" sort={sort} onSort={onSort} />
                <SortTh label="Net" col="net" sort={sort} onSort={onSort} />
                <th className={`${NATION_TH} w-28`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const frac = Math.abs(r.net) / maxAbsNet;
                return (
                  <tr key={r.id}>
                    <td className={NATION_TD}>
                      <span className="inline-flex items-center gap-2">
                        {r.id === "rest" ? (
                          <span
                            className="size-5 flex-none rounded-full border border-edge bg-g-1"
                            aria-hidden="true"
                          />
                        ) : (
                          <FlagAvatar role={r.id} size="size-5" />
                        )}
                        {r.name}
                      </span>
                    </td>
                    <td className={NATION_TD}>{money(r.X)}</td>
                    <td className={NATION_TD}>{money(r.M)}</td>
                    <td className={NATION_TD}>{money(r.vol)}</td>
                    <td className={`${NATION_TD} ${signCls(r.net)}`}>
                      {money(r.net)}
                    </td>
                    <td className={NATION_TD}>
                      <span className="relative inline-block h-1.25 w-24 overflow-hidden rounded-xs border border-edge bg-g-1 align-middle">
                        <i
                          className={`absolute top-0 h-full rounded-none ${r.net >= 0 ? "bg-green" : "bg-red"}`}
                          style={{
                            left: r.net >= 0 ? "50%" : `${50 - 50 * frac}%`,
                            width: `${50 * frac}%`,
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className={`${NATION_TD} font-[650]`}>Total</td>
                <td className={`${NATION_TD} font-[650]`}>{money(totalX)}</td>
                <td className={`${NATION_TD} font-[650]`}>{money(totalM)}</td>
                <td className={`${NATION_TD} font-[650]`}>
                  {money(totalX + totalM)}
                </td>
                <td
                  className={`${NATION_TD} font-[650] ${signCls(totalX - totalM)}`}
                >
                  {money(totalX - totalM)}
                </td>
                <td className={NATION_TD} />
              </tr>
            </tbody>
          </table>
        </div>
      </ChartBox>
    </>
  );
}

function PartnerTariffPanel({ G }: { G: any }) {
  const { pref } = useCurrencyPref();
  const fxCode = currencyForSeat(G.homeRole);
  const ccy = pref.display || fxCode;
  const { sort, onSort } = useColSort("vol");
  const snap = snapshotPartnerTrade(G);
  const y = G.econ.gdp != null ? G.econ.gdp : 100;
  const gdpBn = realmGdpBn("home", G);
  const toBn = (index: number) => gdpBn * (index / Math.max(y, 1e-6));
  const money = (index: number) => {
    const bn = toBn(index);
    if (bn < 0) return "−" + fmtGdpBn(-bn, ccy, G);
    return fmtGdpBn(bn, ccy, G);
  };
  const partners = activePartners();
  const rows = partners.map((p) => {
    const our = effectiveTariff(p.id, G.draft);
    const their = livePartnerTariffOnPlayer(p.id, G);
    const trade = snap[p.id] || { X: 0, M: 0 };
    return {
      id: p.id,
      name: p.name,
      our,
      their,
      X: trade.X,
      M: trade.M,
      vol: trade.X + trade.M,
    };
  });
  const byVol = [...rows].sort((a, b) => b.vol - a.vol);
  const chartIds = byVol.slice(0, 8).map((r) => r.id);
  const logs = G.log || [];
  const loggedByPartner = new Map(
    chartIds.map((id) => [
      id,
      logs.map((r: any) => r.partnerTariffs && r.partnerTariffs[id]),
    ]),
  );
  /* Every series shares one x axis, so the live column is appended to all of
     them or none: a longer series would run off the plot and mislabel its end
     value against a shorter series[0]. */
  const showLive = chartIds.some((id) => {
    const logged = loggedByPartner.get(id) || [];
    const live = livePartnerTariffOnPlayer(id, G);
    return (
      live != null && logged.length > 0 && logged[logged.length - 1] !== live
    );
  });
  const series =
    logs.length >= 2
      ? chartIds.map((id, i) => {
          const logged = loggedByPartner.get(id) || [];
          const live = livePartnerTariffOnPlayer(id, G);
          const data = showLive
            ? [...logged, live != null ? live : logged[logged.length - 1]]
            : logged;
          return {
            label: (rows.find((r) => r.id === id) || { name: id }).name,
            color: partnerLineColor(i, chartIds.length),
            data,
            wide: i === 0,
          };
        })
      : [];
  const tableRows = [...rows].sort((a, b) => {
    const key = sort.key;
    if (key === "name") return cmpSort(a.name, b.name, sort.dir);
    if (key === "our") return cmpSort(a.our, b.our, sort.dir);
    if (key === "their")
      return cmpSort(
        a.their == null ? -1 : a.their,
        b.their == null ? -1 : b.their,
        sort.dir,
      );
    if (key === "X") return cmpSort(a.X, b.X, sort.dir);
    if (key === "M") return cmpSort(a.M, b.M, sort.dir);
    return cmpSort(a.vol, b.vol, sort.dir);
  });

  return (
    <ChartBox
      title="Duties over time"
      caption={`Largest partners on the chart; the table is everyone. Our duty is the live draft rate; theirs is the effective levy on our goods. Trade figures are in ${ccy}.`}
    >
      {series.some((s) => s.data.filter((v: any) => v != null).length >= 2) ? (
        <LineChartSvg
          spec={lineChartSpec(
            series.filter(
              (s) => s.data.filter((v: any) => v != null).length >= 2,
            ),
            { h: 160 },
          )}
          hideValueLabels
        />
      ) : (
        <div className="p-3 text-xs text-ink-faint">
          Deliver a bill or two. The chart needs at least two quarters of data.
        </div>
      )}
      <div className="table-scroll mt-3 overflow-x-auto">
        <table className="w-full min-w-100 border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              <SortTh label="Partner" col="name" sort={sort} onSort={onSort} />
              <SortTh label="Our duty" col="our" sort={sort} onSort={onSort} />
              <SortTh
                label="Their duty"
                col="their"
                sort={sort}
                onSort={onSort}
              />
              <SortTh label="Exports" col="X" sort={sort} onSort={onSort} />
              <SortTh label="Imports" col="M" sort={sort} onSort={onSort} />
              <SortTh label="Total" col="vol" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => (
              <tr key={r.id}>
                <td className={NATION_TD}>
                  <span className="inline-flex items-center gap-2">
                    <FlagAvatar role={r.id} size="size-5" />
                    {r.name}
                  </span>
                </td>
                <td className={NATION_TD}>{r.our.toFixed(1)}%</td>
                <td className={NATION_TD}>
                  {r.their != null ? r.their.toFixed(1) + "%" : "—"}
                </td>
                <td className={NATION_TD}>{money(r.X)}</td>
                <td className={NATION_TD}>{money(r.M)}</td>
                <td className={NATION_TD}>{money(r.vol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartBox>
  );
}

function NationTable() {
  const rows = nationTableData();
  const signCls = (v: number) =>
    v > 0 ? "text-green-lt" : v < 0 ? "text-red-lt" : "";
  return (
    <div className="table-scroll overflow-x-auto rounded-md border border-edge bg-g-1">
      <table className="w-full min-w-160 border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th className={NATION_TH}>Country</th>
            <th className={NATION_TH}>Growth</th>
            <th className={NATION_TH}>Inflation</th>
            <th className={NATION_TH}>Deficit</th>
            <th className={NATION_TH}>Debt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className={r.us ? "bg-accent/16" : undefined}>
              <td className={NATION_TD}>
                {r.name}
                {r.us ? " · you" : ""}
              </td>
              <td className={`${NATION_TD} ${signCls(r.growth)}`}>
                {r.growth.toFixed(1)}
              </td>
              <td className={NATION_TD}>{r.inflation.toFixed(1)}</td>
              <td className={`${NATION_TD} ${signCls(-r.deficit)}`}>
                {(-r.deficit).toFixed(1)}
              </td>
              <td className={NATION_TD}>{r.debt.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerDealRow({
  d,
  signed,
  staged,
  isBlocExternal,
}: {
  d: CountryDeal;
  signed: boolean;
  staged: boolean;
  isBlocExternal: boolean;
}) {
  return (
    <div className="mt-1 border-t border-edge pt-2">
      <div className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {d.name}
        {isBlocExternal ? <CardCat>bloc treaty</CardCat> : null}
      </div>
      <div className="my-1.25 block text-xs text-ink-soft">
        {d.terms.map((t: string, i: number) => (
          <span key={i}>
            · {t}
            <br />
          </span>
        ))}
      </div>
      <CardFoot>
        {signed ? (
          <>
            <CardPrice>ratified</CardPrice>
            <Button
              className="ml-auto"
              danger={staged}
              onClick={() => toggleDraftDeal(d.id)}
            >
              {staged ? "Withdraw" : "Cancel"}
            </Button>
          </>
        ) : (
          <>
            <CardPrice>summit only</CardPrice>
            <span className="ml-auto text-xs text-ink-faint">
              Sign at a summit visit
            </span>
          </>
        )}
      </CardFoot>
    </div>
  );
}

function PartnerTradeCard({ p, G, bilat }: { p: Country; G: any; bilat: any }) {
  const { pref } = useCurrencyPref();
  const fxCode = currencyForSeat(G.homeRole);
  const ccy = pref.display || fxCode;
  const rel = G.rel[p.id];
  const Xi = bilat[p.id] || 0;
  const sharePct = partnerTradeSharePct(bilat, p.id);
  const sharePctLabel =
    sharePct != null ? Math.round(sharePct) + "% of {C}'s trade" : null;
  const stress = G.econ.dealStress[p.id] || 0;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  const playerId = playerCountryId();
  const playerIndependent = hasIndependentCommercialPolicy(playerId);
  const partnerIndependent = hasIndependentCommercialPolicy(p.id);
  const playerInCu = !playerIndependent;
  const theirTar = livePartnerTariffOnPlayer(p.id, G);
  const y = G.econ.gdp != null ? G.econ.gdp : 100;
  const gdpBn = realmGdpBn("home", G);
  const snap = snapshotPartnerTrade(G);
  const row = snap[p.id] || { X: Xi, M: 0 };
  const money = (index: number) => {
    const bn = gdpBn * (index / Math.max(y, 1e-6));
    if (bn < 0) return "−" + fmtGdpBn(-bn, ccy, G);
    return fmtGdpBn(bn, ccy, G);
  };

  let dealsBody: ReactNode = null;
  if (playerInCu && partnerIndependent) {
    dealsBody = dealsForPartner(p, G.homeRole)
      .filter(
        (d: CountryDeal) =>
          !!G.law.deals[d.id] ||
          !unionCommercialDealBlockers(p.id, d.id).length,
      )
      .map((d: CountryDeal) => (
        <PartnerDealRow
          key={d.id}
          d={d}
          signed={!!G.law.deals[d.id]}
          staged={!!G.draft.deals[d.id]}
          isBlocExternal
        />
      ));
  } else if (playerIndependent && !partnerIndependent) {
    const assoc = unionAssociationDeal(bid);
    if (assoc) {
      const signed = !!G.law.deals[assoc.id];
      const tableable =
        signed || !unionCommercialDealBlockers(p.id, assoc.id).length;
      dealsBody = tableable ? (
        <PartnerDealRow
          d={assoc}
          signed={signed}
          staged={!!G.draft.deals[assoc.id]}
          isBlocExternal
        />
      ) : null;
    } else {
      dealsBody = (
        <div className="mt-1.5 block text-xs text-ink-faint">
          Partner trades through {bloc ? bloc.name : "their bloc"} — bilateral
          deals unavailable.
        </div>
      );
    }
  } else if (playerIndependent) {
    dealsBody = dealsForPartner(p, G.homeRole)
      .filter(
        (d: CountryDeal) => !!G.law.deals[d.id] || !dealBlockers(d).length,
      )
      .map((d: CountryDeal) => {
        const signed = !!G.law.deals[d.id];
        const hint = !signed ? sphereRiskHint(p.id) : "";
        return (
          <div key={d.id}>
            <PartnerDealRow
              d={d}
              signed={signed}
              staged={!!G.draft.deals[d.id]}
              isBlocExternal={false}
            />
            {hint ? (
              <div className="block text-xs text-amber">{hint}</div>
            ) : null}
          </div>
        );
      });
  } else {
    dealsBody = (
      <div className="mt-1.5 block text-xs text-ink-faint">
        Partner trades through {bloc ? bloc.name : "their bloc"} — bilateral
        deals unavailable.
      </div>
    );
  }

  return (
    <Card
      className="scroll-mt-12"
      id={`partner-trade-${p.id}`}
      data-partner-card={p.id}
    >
      <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {p.name}
        {sharePctLabel ? <CardCat>{T(sharePctLabel)}</CardCat> : null}
      </h4>
      {bloc ? <div className="text-xs text-ink-faint">{bloc.name}</div> : null}
      <p className="m-0 text-xs leading-[1.42] text-ink-soft">{p.blurb}</p>
      <div className="grid grid-cols-[70px_1fr_30px] items-center gap-2 text-xs">
        <span className="text-xs">Relations</span>
        <span className="h-1.25 overflow-hidden rounded-xs border border-edge bg-g-1">
          <i
            className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${rel > 60 ? "bg-green" : rel < 38 ? "bg-red" : "bg-ink-soft"}`}
            style={{ width: `${rel.toFixed(0)}%` }}
          />
        </span>
        <span className="text-right text-xs font-[650] text-ink-soft">
          {rel.toFixed(0)}
        </span>
      </div>
      <div className="my-1 block text-xs text-ink-soft">
        Exports {money(row.X)}
        {sharePct != null ? ` (${Math.round(sharePct)}%)` : ""} · imports{" "}
        {money(row.M)} · our tariff {effectiveTariff(p.id, G.draft).toFixed(1)}%
        · their tariff on us {theirTar != null ? theirTar.toFixed(1) : "—"}%
      </div>
      {stress >= 1 ? (
        <Callout tone="red">
          Deal access suspended (stress {stress.toFixed(0)})
        </Callout>
      ) : null}
      {dealsBody}
    </Card>
  );
}

function PartnerCardsByRegion({ G }: { G: any }) {
  const bilat = G.econ.bilateralX || {};
  const byRegion: Record<string, any[]> = {};
  for (const p of activePartners()) {
    const r = p.region || "other";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(p);
  }
  return (
    <>
      {REGION_ORDER.map((r) => {
        const list = byRegion[r];
        if (!list || !list.length) return null;
        return (
          <div key={r}>
            <Eyebrow className="mt-5">
              {(COUNTRY_REGIONS as any)[r] || r}
            </Eyebrow>
            <div className="flex flex-col gap-2">
              {list.map((p: Country) => (
                <PartnerTradeCard key={p.id} p={p} G={G} bilat={bilat} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function TradePanel() {
  const G = useGame();
  ensureDiploStocks(G.econ);
  const Eagg = aggregate(G.draft, G.homeRole, G.blocMember);
  syncTariffHeadline(G.draft);
  const cat = getDrawerCat("trade", "tariffs") as TradeCat;

  if (cat === "currency") return <CurrencyPanel G={G} />;
  if (cat === "blocs") return <BlocMembershipPanel G={G} />;
  if (cat === "compare")
    return (
      <>
        <Eyebrow>How {theCountry(G.country)} compares</Eyebrow>
        <NationTable />
      </>
    );
  if (cat === "partners")
    return (
      <>
        <Eyebrow>Partners and agreements</Eyebrow>
        <Hint>
          New bilateral treaties are signed at summit visits. Withdrawals still
          go through your bill.
        </Hint>
        <PartnerCardsByRegion G={G} />
      </>
    );
  if (cat === "balance")
    return (
      <>
        <Eyebrow>Net trade</Eyebrow>
        <NetTradePanel G={G} />
      </>
    );
  return (
    <>
      <Eyebrow>Tariffs</Eyebrow>
      <Hint>
        Set rates by bloc or country. Partners in the same bloc share one lever.
        Customs-union members trade at zero internally.
      </Hint>
      <TradeReadout G={G} Eagg={Eagg} />
      <PartnerTariffPanel G={G} />
      <TariffScheduleSection G={G} />
    </>
  );
}
