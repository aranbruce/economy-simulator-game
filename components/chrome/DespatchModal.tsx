"use client";

import { useEffect, useState } from "react";
import {
  blocByIdOrCustom,
  closeDespatch,
  getDespatch,
  setOnBlocModal,
  setOnDespatchChange,
  T,
} from "../../lib/sim/engine.ts";
import { SafeHtml } from "../ui/SafeHtml.tsx";
import { ImpactChips, ImpactFactions } from "../ui/ImpactChips.tsx";
import { BlocFoundModalBody, BlocInviteModalBody } from "./BlocModals.tsx";
import { BriefingBody } from "./BriefingBody.tsx";
import { VerdictBody } from "./VerdictBody.tsx";

type BlocModalState =
  { kind: "found" } | { kind: "invite"; bid: string } | null;

export function DespatchModal() {
  const [open, setOpen] = useState<any>(null);
  const [blocModal, setBlocModal] = useState<BlocModalState>(null);

  useEffect(() => {
    setOnDespatchChange(setOpen);
    setOnBlocModal(setBlocModal);
    return () => {
      setOnDespatchChange(null);
      setOnBlocModal(null);
    };
  }, []);

  useEffect(() => {
    const pending = getDespatch();
    if (pending) setOpen(pending);
  }, []);

  if (!open && !blocModal) return null;

  const title = open
    ? open.title
    : blocModal!.kind === "found"
      ? "Found a trade bloc"
      : "Invite a member";
  const stamp = open
    ? open.stamp
    : blocModal!.kind === "found"
      ? "Foreign & Commonwealth"
      : (blocByIdOrCustom(blocModal!.bid)?.name ?? "Trade bloc");

  return (
    <div className="scrim" id="scrim">
      <div
        className="despatch hud-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpTitle"
      >
        <header>
          <div
            className="text-[10px] font-bold tracking-[.14em] text-accent-lt uppercase"
            id="dpStamp"
          >
            {stamp}
          </div>
          <h3 id="dpTitle">{title}</h3>
        </header>
        {open ? (
          <>
            <div className="body" id="dpBody">
              {open.kind === "briefing" ? (
                <BriefingBody data={open.data} />
              ) : open.kind === "verdict" ? (
                <VerdictBody data={open.data} />
              ) : (
                <SafeHtml html={open.body} />
              )}
            </div>
            <div
              className="grid gap-1.75 px-5 pt-1.5 pb-5 max-[720px]:gap-1.5 max-[720px]:px-3.5 max-[720px]:pt-1 max-[720px]:pb-4"
              id="dpOpts"
            >
              {open.opts.map((o: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  className="cursor-pointer rounded-md border border-l-3 border-edge border-l-transparent bg-g-1 px-3.25 py-2.75 text-left font-sans text-sm text-white transition duration-160 hover:border-l-accent hover:bg-white/7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] max-[720px]:min-h-11 max-[720px]:p-3"
                  onClick={() => {
                    closeDespatch();
                    o.f();
                  }}
                >
                  <b className="block font-[650] tracking-[-.02em]">{T(o.b)}</b>
                  {o.e ? (
                    <em className="mt-0.75 block text-xs text-ink-soft not-italic">
                      {T(o.e)}
                    </em>
                  ) : null}
                  {o.hint ? <SafeHtml html={o.hint} /> : null}
                  {o.chips ? <ImpactChips chips={o.chips} /> : null}
                  {o.factions ? <ImpactFactions factions={o.factions} /> : null}
                </button>
              ))}
            </div>
          </>
        ) : blocModal!.kind === "found" ? (
          <BlocFoundModalBody />
        ) : (
          <BlocInviteModalBody bid={blocModal!.bid} />
        )}
      </div>
    </div>
  );
}
