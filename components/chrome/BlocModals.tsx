"use client";

import { useEffect, useRef, useState } from "react";
import {
  CUSTOM_BLOC_TEMPLATES,
  COUNTRY_REGIONS,
  blocInviteBlockers,
  blocInviteCandidates,
  blocInviteMemberApprovals,
  hideDespatchShell,
} from "../../lib/sim/engine.ts";
import { confirmBlocFound, confirmBlocInvite } from "../../lib/ui/actions.ts";
import { AccessionPipeline, ApprovalTable } from "../drawers/TradePanel.tsx";
import { Eyebrow, Hint } from "../ui/Typography.tsx";

const REGION_ORDER = [
  "europe",
  "americas",
  "asia",
  "africa",
  "gulf",
  "oceania",
];

const OPTS_WRAP =
  "grid grid-cols-2 gap-2 px-5 pt-1.5 pb-5 max-[720px]:gap-1.5 max-[720px]:px-3.5 max-[720px]:pt-1 max-[720px]:pb-4";
const OPT_BASE =
  "cursor-pointer rounded-md border border-l-3 border-edge border-l-transparent bg-g-1 px-3.25 py-2.75 font-sans text-sm text-white transition duration-160 hover:border-l-accent hover:bg-white/7 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 max-[720px]:min-h-11 max-[720px]:p-3";
const OPT_SIMPLE = `${OPT_BASE} flex min-h-11 items-center justify-center text-center`;
const OPT_LEFT = `${OPT_BASE} text-left`;

export function BlocFoundModalBody() {
  const templates = Object.values(CUSTOM_BLOC_TEMPLATES) as any[];
  const [selected, setSelected] = useState<string>(templates[0]?.id);
  const [name, setName] = useState<string>(
    (CUSTOM_BLOC_TEMPLATES as any)[selected]?.name || "",
  );
  const [nameTouched, setNameTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function pick(id: string) {
    setSelected(id);
    if (!nameTouched) {
      const t = (CUSTOM_BLOC_TEMPLATES as any)[id];
      setName(t ? t.name : "");
    }
  }

  return (
    <>
      <div
        className="px-5 pt-3.5 pb-1.5 text-[14.5px] leading-[1.48] max-[720px]:px-3.5 max-[720px]:pt-3 max-[720px]:pb-1 max-[720px]:text-[14px] [&_p]:mt-0 [&_p]:mb-3"
        id="dpBody"
      >
        <div className="mb-3">
          <label className="mb-1 block text-xs text-ink-soft">Bloc name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            maxLength={34}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            aria-label="Name of your trade bloc"
            className="w-full rounded-md border border-ink-faint bg-white/6 px-3 py-2 font-sans text-[15px] text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          {templates.map((t) => {
            const sel = t.id === selected;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                className={`cursor-pointer rounded-[10px] border-2 px-3.5 py-2.5 text-left font-sans text-inherit ${sel ? "border-accent bg-blue/10" : "border-ink-faint bg-transparent"}`}
              >
                <div className="text-sm font-semibold">
                  {t.name}{" "}
                  <span className="font-normal text-ink-soft">
                    {t.pc} capital
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {t.type === "customs_union"
                    ? "Zero internal tariffs · common external tariff · stronger access bonus (+12%)"
                    : "Preferential rates · members keep independent tariffs · moderate access bonus (+5%)"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className={OPTS_WRAP} id="dpOpts">
        <button
          type="button"
          className={OPT_SIMPLE}
          onClick={() => confirmBlocFound(name, selected)}
        >
          <b className="font-[650] tracking-[-.02em]">Found this bloc</b>
        </button>
        <button
          type="button"
          className={OPT_SIMPLE}
          onClick={() => hideDespatchShell()}
        >
          <b className="font-[650] tracking-[-.02em]">Cancel</b>
        </button>
      </div>
    </>
  );
}

export function BlocInviteModalBody({ bid }: { bid: string }) {
  const candidates = blocInviteCandidates(bid);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const initial =
      candidates.find((c: any) => !c.staged && c.blockers.length === 0) ||
      candidates[0] ||
      null;
    return initial ? initial.partner.id : null;
  });
  const selected =
    candidates.find((c: any) => c.partner.id === selectedId) || null;

  const byRegion: Record<string, any[]> = {};
  for (const c of candidates) {
    const r = c.partner.region || "other";
    (byRegion[r] ||= []).push(c);
  }

  const canStage = !!selected && !selected.staged;
  const confirmContent = !selected
    ? { b: "No candidate selected", e: null as string | null }
    : selected.staged
      ? { b: "Already in the bill", e: "See the bill panel above" }
      : {
          b: `Propose ${selected.partner.name}`,
          e: "12 capital · added to your bill",
        };

  return (
    <>
      <div
        className="px-5 pt-3.5 pb-1.5 text-[14.5px] leading-[1.48] max-[720px]:px-3.5 max-[720px]:pt-3 max-[720px]:pb-1 max-[720px]:text-[14px] [&_p]:mt-0 [&_p]:mb-3"
        id="dpBody"
      >
        <Hint>
          Choose a partner to invite. Every other bloc member must approve. The
          invitation stages in your bill — use <b>Deliver</b> to send it (12
          capital).
        </Hint>
        <div className="-mx-1 my-0 max-h-[min(42vh,320px)] overflow-y-auto px-1">
          {REGION_ORDER.filter((r) => byRegion[r]?.length).map((r) => (
            <div key={r} className="mt-2.5 first:mt-0">
              <Eyebrow>{COUNTRY_REGIONS[r] || r}</Eyebrow>
              {byRegion[r].map((c) => {
                const p = c.partner;
                const sel = selectedId === p.id;
                const status = c.staged
                  ? "In the bill"
                  : c.blockers.length
                    ? c.blockers[0]
                    : "Eligible";
                const statusCls = c.staged
                  ? "text-blue"
                  : c.blockers.length
                    ? "text-red"
                    : "text-green";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`mt-1.5 block w-full cursor-pointer rounded-[10px] border-2 px-3 py-2.25 text-left font-sans text-inherit ${sel ? "border-blue bg-blue/8" : "border-edge bg-transparent hover:border-ink-soft"}`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="flex flex-none items-center gap-1.5">
                        <span className="h-1.25 w-14 overflow-hidden rounded-[1px] border border-edge bg-g-1">
                          <i
                            className={`block h-full rounded-none ${c.rel > 60 ? "bg-green" : c.rel < 38 ? "bg-red" : "bg-ink-soft"}`}
                            style={{ width: `${c.rel.toFixed(0)}%` }}
                          />
                        </span>
                        <span className="min-w-5.5 text-right text-[11.5px] text-ink-soft">
                          {c.rel.toFixed(0)}
                        </span>
                      </span>
                    </div>
                    <div
                      className={`mt-0.75 text-[11.5px] leading-[1.35] ${statusCls}`}
                    >
                      {status}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {selected ? (
          <div className="mt-3 border-t border-edge pt-3">
            <Eyebrow>Preview: {selected.partner.name}</Eyebrow>
            <AccessionPipeline cur={0} />
            <ApprovalTable
              approvals={blocInviteMemberApprovals(bid, selected.partner.id)}
            />
            {blocInviteBlockers(bid, selected.partner.id).length ? (
              <div className="mt-1.5 block text-[11px] text-red">
                {blocInviteBlockers(bid, selected.partner.id).join(" · ")}
              </div>
            ) : (
              <div className="mt-1.5 block text-[11px] text-green">
                Ready to propose — every member approves.
              </div>
            )}
          </div>
        ) : !candidates.length ? (
          <Hint className="mt-2.5">
            No eligible partners right now. Countries already in a bloc, with a
            pending invite, or mid-accession cannot be invited.
          </Hint>
        ) : null}
      </div>
      <div className={OPTS_WRAP} id="dpOpts">
        <button
          type="button"
          disabled={!canStage}
          onClick={() => selected && confirmBlocInvite(selected.partner.id)}
          className={OPT_LEFT}
        >
          <b className="block font-[650] tracking-[-.02em]">
            {confirmContent.b}
          </b>
          {confirmContent.e ? (
            <em className="mt-0.75 block text-xs text-ink-soft not-italic">
              {confirmContent.e}
            </em>
          ) : null}
        </button>
        <button
          type="button"
          className={OPT_SIMPLE}
          onClick={() => hideDespatchShell()}
        >
          <b className="font-[650] tracking-[-.02em]">Cancel</b>
        </button>
      </div>
    </>
  );
}
