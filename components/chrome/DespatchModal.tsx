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

/** Despatches render in one of two skins depending on the underlying
 *  content: the cream newspaper-clipping look for briefings (matching the
 *  press clippings they're pulled from), the dark HUD glass for everything
 *  else (events, verdicts, bloc modals). Keyed once here instead of an
 *  isBriefing ternary repeated at every styled node below. */
const PAPER_SKIN = {
  shell:
    "despatch scroll-thin relative max-h-[88vh] w-full max-w-150 animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] overflow-auto rounded-sm border border-paper-border/28 bg-(image:--paper-gradient) shadow-[0_22px_56px_rgba(0,0,0,.55),0_1px_0_rgba(255,255,255,.55)_inset] max-md:max-h-[min(90dvh,calc(100dvh-24px))] max-md:rounded-md",
  header:
    "border-b border-paper-border/22 px-5 pt-4 pb-3 max-md:px-3.5 max-md:pt-3.5 max-md:pb-2.5",
  stamp: "text-xs font-bold tracking-[.14em] text-paper-accent uppercase",
  rule: "mt-2 h-px w-16 bg-[linear-gradient(90deg,var(--paper-accent),transparent)]",
  title:
    "mt-2.5 mb-0 font-display text-3xl leading-[1.1] font-normal tracking-tight text-paper-ink max-md:text-2xl",
  body: "px-5 pt-3.5 pb-1.5 text-sm leading-[1.48] text-paper-ink max-md:px-3.5 max-md:pt-3 max-md:pb-1 max-md:text-sm [&_p]:mt-0 [&_p]:mb-3",
  option:
    "cursor-pointer rounded-md border border-l-3 border-paper-border/22 border-l-paper-border/35 bg-paper-border/4.5 px-3.25 py-2.75 text-left font-sans text-sm text-paper-ink transition duration-160 hover:border-l-paper-accent hover:bg-paper-border/9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-accent active:scale-[0.99] max-md:min-h-11 max-md:p-3",
  optionSub: "mt-0.75 block text-xs text-paper-ink-soft not-italic",
};

const HUD_SKIN = {
  shell:
    "despatch scroll-thin hud-frame hud-surface-lg relative max-h-[88vh] w-full max-w-150 animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] overflow-auto max-md:max-h-[min(90dvh,calc(100dvh-24px))] max-md:rounded-md",
  header:
    "border-b border-edge bg-[linear-gradient(180deg,var(--panel-hi),transparent)] px-5 pt-4 pb-3 max-md:px-3.5 max-md:pt-3.5 max-md:pb-2.5",
  stamp: "text-xs font-bold tracking-[.14em] text-accent-lt uppercase",
  rule: "mt-2 h-px w-16 bg-[linear-gradient(90deg,var(--accent),transparent)]",
  title:
    "mt-2.5 mb-0 font-display text-3xl leading-[1.1] font-normal tracking-tight max-md:text-2xl",
  body: "px-5 pt-3.5 pb-1.5 text-sm leading-[1.48] max-md:px-3.5 max-md:pt-3 max-md:pb-1 max-md:text-sm [&_p]:mt-0 [&_p]:mb-3",
  option:
    "cursor-pointer rounded-md border border-l-3 border-edge border-l-transparent bg-g-1 px-3.25 py-2.75 text-left font-sans text-sm text-white transition duration-160 hover:border-l-accent hover:bg-white/7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] max-md:min-h-11 max-md:p-3",
  optionSub: "mt-0.75 block text-xs text-ink-soft not-italic",
};

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
  const isBriefing = open?.kind === "briefing";
  const skin = isBriefing ? PAPER_SKIN : HUD_SKIN;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,4,10,.72)] p-4 backdrop-blur-md max-md:px-2.5 max-md:pt-[max(12px,env(safe-area-inset-top))] max-md:pb-[max(12px,env(safe-area-inset-bottom))]"
      id="scrim"
    >
      <div
        className={skin.shell}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpTitle"
      >
        <header className={skin.header}>
          <div className={skin.stamp} id="dpStamp">
            {stamp}
          </div>
          <div className={skin.rule} aria-hidden="true" />
          <h3 id="dpTitle" className={skin.title}>
            {title}
          </h3>
        </header>
        {open ? (
          <>
            <div className={skin.body} id="dpBody">
              {open.kind === "briefing" ? (
                <BriefingBody data={open.data} paper />
              ) : open.kind === "verdict" ? (
                <VerdictBody data={open.data} />
              ) : (
                <SafeHtml html={open.body} />
              )}
            </div>
            <div
              className="grid gap-1.75 px-5 pt-1.5 pb-5 max-md:gap-1.5 max-md:px-3.5 max-md:pt-1 max-md:pb-4"
              id="dpOpts"
            >
              {open.opts.map((o: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  className={skin.option}
                  onClick={() => {
                    closeDespatch();
                    o.f();
                  }}
                >
                  <b className="block font-[650] tracking-[-.02em]">{T(o.b)}</b>
                  {o.e ? (
                    <em className={skin.optionSub}>{T(o.e)}</em>
                  ) : null}
                  {o.hint ? <SafeHtml html={o.hint} /> : null}
                  {o.chips ? (
                    <ImpactChips chips={o.chips} paper={isBriefing} />
                  ) : null}
                  {o.factions ? (
                    <ImpactFactions factions={o.factions} paper={isBriefing} />
                  ) : null}
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
