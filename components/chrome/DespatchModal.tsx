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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,4,10,.72)] p-4 backdrop-blur-[10px] max-[720px]:px-2.5 max-[720px]:pt-[max(12px,env(safe-area-inset-top))] max-[720px]:pb-[max(12px,env(safe-area-inset-bottom))]"
      id="scrim"
    >
      <div
        className="despatch hud-frame relative max-h-[88vh] w-full max-w-[600px] animate-[dp_0.36s_cubic-bezier(.22,1,.3,1)] overflow-auto rounded-lg border border-edge bg-panel shadow-[var(--spec),var(--shadow-glass-lg)] backdrop-blur-[18px] backdrop-saturate-[1.4] max-[720px]:max-h-[min(90dvh,calc(100dvh-24px))] max-[720px]:rounded-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpTitle"
      >
        <header className="border-b border-edge bg-[linear-gradient(180deg,var(--panel-hi),transparent)] px-5 pt-4 pb-3 max-[720px]:px-3.5 max-[720px]:pt-3.5 max-[720px]:pb-2.5">
          <div
            className="text-[10px] font-bold tracking-[.14em] text-accent-lt uppercase"
            id="dpStamp"
          >
            {stamp}
          </div>
          <h3
            id="dpTitle"
            className="mt-1.5 mb-0 font-display text-[26px] leading-[1.12] font-normal tracking-[-.025em] max-[720px]:text-[22px]"
          >
            {title}
          </h3>
        </header>
        {open ? (
          <>
            <div
              className="px-5 pt-3.5 pb-1.5 text-[14.5px] leading-[1.48] max-[720px]:px-3.5 max-[720px]:pt-3 max-[720px]:pb-1 max-[720px]:text-[14px] [&_p]:mt-0 [&_p]:mb-3"
              id="dpBody"
            >
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
