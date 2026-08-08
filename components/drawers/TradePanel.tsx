"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  T,
  aggregate,
  activePartners,
  countryBlocId,
  blocById,
  blocByIdOrCustom,
  blocMembers,
  blocMemberApprovals,
  blocInviteMemberApprovals,
  isBlocFounder,
  blocJoinBlockers,
  blocInviteBlockers,
  blocExternalDealBlockers,
  dealBlockers,
  dealsForPartner,
  sphereRiskHint,
  effectiveTariff,
  shareLabel,
  fxDisplayIndex,
  currencyForSeat,
  ensureDiploStocks,
  syncTariffHeadline,
  ensureTariffSchedule,
  tariffLocked,
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
} from "../../lib/sim/engine.ts";
import {
  toggleDraftDeal,
  toggleBlocExternalDeal,
  toggleBlocAccession,
  withdrawBlocAccessionDraft,
  toggleBlocLeave,
  unstageBlocCreate,
  setTariffLever,
  toggleBlocInviteDraft,
} from "../../lib/ui/actions.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { Eyebrow, Hint } from "../ui/Typography.tsx";
import { Lever } from "../ui/Lever.tsx";
import { Button } from "../ui/Button.tsx";
import { Card, CardGrid, CardCat, CardFoot, CardPrice } from "../ui/Card.tsx";
import type { Country, CountryDeal } from "../../lib/sim/countries.ts";

const REGION_ORDER = [
  "europe",
  "americas",
  "asia",
  "africa",
  "gulf",
  "oceania",
];

function CurrencyPanel({ G }: { G: any }) {
  const fxIdx = fxDisplayIndex("home");
  const fxCode = currencyForSeat(G.homeRole);
  const fxColor =
    fxIdx > 100.5 ? "var(--green-lt)" : fxIdx < 99.5 ? "var(--red-lt)" : "#fff";
  return (
    <>
      <Eyebrow>Currency</Eyebrow>
      <div
        className="overflow-hidden rounded-md border border-edge bg-g-1"
        style={{ padding: "12px 14px", marginBottom: 12 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 650,
              letterSpacing: "-.03em",
              lineHeight: 1,
              color: fxColor,
            }}
          >
            {fxIdx.toFixed(1)}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 650, fontSize: 14 }}>
              Currency strength ({fxCode})
            </div>
            <Hint>
              Versus the USD numeraire. Opening = 100. A stronger currency hurts
              exports and cheapens imports. The Bank and fiscal risk move it —
              you do not set it directly.
            </Hint>
          </div>
        </div>
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
          <span key={label} style={{ display: "contents" }}>
            <div
              className={`flex min-w-12 flex-col items-center gap-0.75 ${done || active ? "opacity-100" : "opacity-42"}`}
            >
              <span
                className={`flex size-5.5 items-center justify-center rounded-full border-[1.5px] border-edge text-[10px] leading-none font-bold ${dotTone}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="max-w-14 text-center text-[10px] leading-[1.2] text-ink-soft">
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
      <div
        className="mb-2.25 flex items-center gap-2.25 text-[10px] font-bold tracking-widest text-ink-faint uppercase after:h-px after:flex-1 after:bg-edge after:content-['']"
        style={{ marginTop: 6 }}
      >
        {title}
      </div>
      {approvals.map((a) => (
        <div
          key={a.id}
          className="my-0.75 grid grid-cols-[90px_1fr_36px] items-center gap-2 text-[12.5px]"
        >
          <span style={{ fontSize: 11 }}>{a.name}</span>
          <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
            <i
              className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${a.ok ? "bg-green" : "bg-red"}`}
              style={{ width: `${a.rel.toFixed(0)}%` }}
            />
          </span>
          <span
            className="text-right text-[11.5px] font-[650] text-ink-soft"
            style={{ color: a.ok ? "var(--green)" : "var(--red)" }}
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
      {blocked ? (
        <div className="block text-[11px] text-red">{blockers[0]}</div>
      ) : null}
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
  const members = blocMembers(bid)
    .map((id: string) => {
      const p = activePartners().find((x: Country) => x.id === id);
      return p ? p.name : id;
    })
    .join(", ");
  const founder = isBlocFounder();
  const invites = Object.keys(G.draft.blocInvite || {}).filter(
    (cid) => G.draft.blocInvite[cid],
  );
  const candidates = blocInviteCandidates(bid);

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
      <Hint>
        Country-level bilateral deals are suspended while you are in a bloc.
      </Hint>
      <Hint>
        Any member may propose a new member; every other member must approve.
        Proposals stage in your bill — use <b>Deliver</b> to send the
        invitation.
      </Hint>
      {founder ? (
        <Hint>
          As bloc founder you may ratify external treaties with non-bloc
          partners from their trade cards.
        </Hint>
      ) : G.customBlocs[bid] ? (
        <Hint>External treaties are negotiated by the bloc founder.</Hint>
      ) : (
        <Hint>External treaties are negotiated by the bloc chair.</Hint>
      )}
      {invites.map((cid) => {
        const c = activePartners().find((x: Country) => x.id === cid);
        const blockers = blocInviteBlockers(bid, cid);
        const approvals = blocInviteMemberApprovals(bid, cid);
        return (
          <Card
            key={cid}
            className="mt-2 border-accent shadow-[0_0_0_1px_rgba(10,132,255,.22)]"
            id={`bloc-staged-${cid}`}
          >
            <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
              Propose {c ? c.name : cid} join {bloc ? bloc.name : bid}
              <CardCat>12 capital</CardCat>
            </h4>
            <Hint>
              Deliver this bill to send the invitation. After acceptance,
              accession runs automatically over several quarters.
            </Hint>
            <AccessionPipeline cur={0} />
            <ApprovalTable approvals={approvals} />
            {blockers.length ? (
              <div className="block text-[11px] text-red">{blockers[0]}</div>
            ) : (
              <div className="block text-[11px] text-green">
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
      <div style={{ marginTop: 12 }}>
        <Button
          customSize
          className="w-full px-4 py-2.5 text-[15px] font-semibold"
          disabled={!candidates.length}
          title={
            candidates.length
              ? undefined
              : "No eligible partners — all are in blocs or already invited"
          }
          onClick={() => showBlocInviteModal(bid)}
        >
          {candidates.length
            ? `Invite a member (${candidates.length} eligible)`
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
      <div
        className="mb-2.25 flex items-center gap-2.25 text-[10px] font-bold tracking-widest text-ink-faint uppercase after:h-px after:flex-1 after:bg-edge after:content-['']"
        style={{ marginTop: 10 }}
      >
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
              <div className="block text-[11px] text-red">
                At risk — relations below the threshold
              </div>
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
              className="w-full px-4 py-2.5 text-[15px] font-semibold"
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
      <Eyebrow className="mt-5">Trade blocs</Eyebrow>
      {bid ? <BlocMemberView G={G} bid={bid} /> : <BlocNonMemberView G={G} />}
    </>
  );
}

function TariffScheduleSection({ G }: { G: any }) {
  ensureTariffSchedule(G.draft);
  ensureTariffSchedule(G.law);
  const lock = tariffLocked(G.draft);
  const sched = G.draft.tariffSchedule;

  if (lock.mode !== "none") {
    return (
      <>
        <Hint>
          You are in a customs union. External tariff is{" "}
          {sched.cet != null ? sched.cet : lock.cet}%.
          {lock.mode === "full"
            ? " Set in the bloc capital — you cannot change it."
            : ""}
        </Hint>
        {lock.mode === "cet" ? (
          <div className="overflow-hidden rounded-md border border-edge bg-g-1">
            <Lever
              id="tariffCet"
              name="Common external tariff"
              value={
                sched.cet != null ? sched.cet : lock.cet != null ? lock.cet : 4
              }
              min={0}
              max={25}
              step={1}
              decimals={0}
              base={tariffLeverValue("tariffCet", G.law)}
              note="Applies to all partners outside your customs union"
              onInput={(_id, v) => setTariffLever("tariffCet", v)}
              onCommit={(_id, v) => setTariffLever("tariffCet", v)}
            />
          </div>
        ) : null}
      </>
    );
  }

  const usedBlocs: Record<string, number> = {};
  for (const p of activePartners()) {
    const bid = countryBlocId(p.id);
    if (bid) usedBlocs[bid] = (usedBlocs[bid] || 0) + 1;
  }
  const byRegion: Record<string, any[]> = {};
  for (const p of activePartners()) {
    const r = p.region || "other";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(p);
  }

  return (
    <>
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
      {Object.keys(usedBlocs).map((bid) => {
        const bloc = blocById(bid);
        const key = `tariffBloc:${bid}`;
        const val = sched.bloc[bid] != null ? sched.bloc[bid] : sched.default;
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
                sched.country[p.id] != null
                  ? sched.country[p.id]
                  : sched.default;
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
  "first:text-left border-b border-edge px-2.5 py-2 text-right text-[9.5px] font-bold whitespace-nowrap text-ink-faint uppercase tracking-[.06em]";
const NATION_TD =
  "first:text-left border-b border-white/5 px-2.5 py-1.5 text-right";

function NationTable() {
  const rows = nationTableData();
  const signCls = (v: number) =>
    v > 0 ? "text-green-lt" : v < 0 ? "text-red-lt" : "";
  return (
    <div className="overflow-x-auto rounded-md border border-edge bg-g-1">
      <table className="w-full min-w-160 border-collapse text-[12.5px] tabular-nums">
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
            <tr
              key={i}
              style={r.us ? { background: "rgba(212,175,105,.16)" } : undefined}
            >
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
  unmet,
  isBlocExternal,
  partnerId,
}: {
  d: CountryDeal;
  signed: boolean;
  staged: boolean;
  unmet: string[];
  isBlocExternal: boolean;
  partnerId: string;
}) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--doc-3)",
        paddingTop: 8,
        marginTop: 4,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {d.name}
        {isBlocExternal ? <CardCat>bloc treaty</CardCat> : null}
      </div>
      <div className="my-1.25 block text-[11px] text-ink-soft">
        {d.terms.map((t: string, i: number) => (
          <span key={i}>
            · {t}
            <br />
          </span>
        ))}
      </div>
      {unmet.length && !signed ? (
        <div className="block text-[11px] text-red">
          Blocked: {unmet.join("; ")}
        </div>
      ) : null}
      <CardFoot>
        <CardPrice>{signed ? "ratified" : `${d.pc} capital`}</CardPrice>
        <Button
          className="ml-auto"
          danger={staged}
          disabled={unmet.length > 0 && !staged && !signed}
          onClick={() =>
            isBlocExternal
              ? toggleBlocExternalDeal(d.id, partnerId)
              : toggleDraftDeal(d.id)
          }
        >
          {isBlocExternal
            ? staged
              ? "Cancel"
              : signed
                ? "Withdraw"
                : "Ratify as bloc"
            : staged
              ? signed
                ? "Withdraw"
                : "Cancel"
              : "Ratify"}
        </Button>
      </CardFoot>
    </div>
  );
}

function PartnerTradeCard({
  p,
  G,
  bilat,
  bilatTotal,
}: {
  p: Country;
  G: any;
  bilat: any;
  bilatTotal: number;
}) {
  const rel = G.rel[p.id];
  const Xi = bilat[p.id] || 0;
  const sharePct = ((100 * Xi) / bilatTotal).toFixed(0);
  const stress = G.econ.dealStress[p.id] || 0;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  const playerBid = countryBlocId(playerCountryId());
  const playerInBloc = !!playerBid;
  const partnerInBloc = !!bid;
  const founder = isBlocFounder();

  let dealsBody: ReactNode = null;
  if (playerInBloc && !founder) {
    dealsBody = (
      <div className="mt-1.5 block text-[11px] text-ink-faint">
        Bilateral deals unavailable while in a trade bloc.
      </div>
    );
  } else if (playerInBloc && founder && !partnerInBloc) {
    dealsBody = dealsForPartner(p, G.homeRole).map((d: CountryDeal) => {
      const signed = !!G.law.deals[d.id];
      const staged = !!(
        G.draft.blocExternalDeal &&
        G.draft.blocExternalDeal.dealId === d.id &&
        G.draft.blocExternalDeal.partnerId === p.id
      );
      const unmet = blocExternalDealBlockers(p.id, d.id);
      return (
        <PartnerDealRow
          key={d.id}
          d={d}
          signed={signed}
          staged={staged}
          unmet={unmet}
          isBlocExternal
          partnerId={p.id}
        />
      );
    });
  } else if (!playerInBloc) {
    dealsBody = dealsForPartner(p, G.homeRole).map((d: CountryDeal) => {
      const signed = !!G.law.deals[d.id];
      const staged = !!G.draft.deals[d.id];
      const unmet = dealBlockers(d);
      const hint = !signed && !unmet.length ? sphereRiskHint(p.id) : "";
      return (
        <div key={d.id}>
          <PartnerDealRow
            d={d}
            signed={signed}
            staged={staged}
            unmet={unmet}
            isBlocExternal={false}
            partnerId={p.id}
          />
          {hint ? (
            <div className="block text-[11px] text-amber">{hint}</div>
          ) : null}
        </div>
      );
    });
  } else if (partnerInBloc) {
    dealsBody = (
      <div className="mt-1.5 block text-[11px] text-ink-faint">
        Partner trades through {bloc ? bloc.name : "their bloc"} — bilateral
        deals unavailable.
      </div>
    );
  }

  return (
    <Card id={`partner-trade-${p.id}`} data-partner-card={p.id}>
      <h4 className="m-0 flex items-baseline gap-2 text-sm font-[650] tracking-[-.02em]">
        {p.name}
        <CardCat>{T(shareLabel(G.homeRole, p.id, p.tradeShare))}</CardCat>
      </h4>
      {bloc ? (
        <div className="text-[11px] text-ink-faint">{bloc.name}</div>
      ) : null}
      <p className="m-0 text-xs leading-[1.42] text-ink-soft">{p.blurb}</p>
      <div className="grid grid-cols-[70px_1fr_30px] items-center gap-2 text-[11.5px]">
        <span style={{ fontSize: 11 }}>Relations</span>
        <span className="h-1.25 overflow-hidden rounded-[1px] border border-edge bg-g-1">
          <i
            className={`block h-full rounded-none transition-[width] duration-400 ease-[cubic-bezier(.2,.9,.3,1)] ${rel > 60 ? "bg-green" : rel < 38 ? "bg-red" : "bg-ink-soft"}`}
            style={{ width: `${rel.toFixed(0)}%` }}
          />
        </span>
        <span className="text-right text-[11.5px] font-[650] text-ink-soft">
          {rel.toFixed(0)}
        </span>
      </div>
      <div className="my-1 block text-[11px] text-ink-soft">
        Exports {Xi.toFixed(1)} ({sharePct}%) · tariff{" "}
        {effectiveTariff(p.id, G.draft).toFixed(1)}%
      </div>
      {stress >= 1 ? (
        <div className="block text-[11px] text-red">
          Deal access suspended (stress {stress.toFixed(0)})
        </div>
      ) : null}
      {dealsBody}
    </Card>
  );
}

function PartnerCardsByRegion({ G }: { G: any }) {
  const bilat = G.econ.bilateralX || {};
  const bilatTotal =
    Object.keys(bilat).reduce(
      (s: number, k: string) => s + (bilat[k] || 0),
      0,
    ) || 1;
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
            <CardGrid>
              {list.map((p: Country) => (
                <PartnerTradeCard
                  key={p.id}
                  p={p}
                  G={G}
                  bilat={bilat}
                  bilatTotal={bilatTotal}
                />
              ))}
            </CardGrid>
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

  return (
    <>
      <CurrencyPanel G={G} />
      <BlocMembershipPanel G={G} />
      <Eyebrow className="mt-5">Tariffs</Eyebrow>
      <Hint>
        Set rates by bloc or country. Partners in the same bloc share one lever.
        Customs-union members trade at zero internally.
      </Hint>
      <TradeReadout G={G} Eagg={Eagg} />
      <TariffScheduleSection G={G} />
      <Eyebrow className="mt-5">How {G.country} compares</Eyebrow>
      <NationTable />
      <Eyebrow className="mt-5">Partners and agreements</Eyebrow>
      <PartnerCardsByRegion G={G} />
    </>
  );
}
