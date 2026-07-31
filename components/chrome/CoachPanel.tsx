"use client";

import {
  continueCoach,
  getCoachPanel,
  skipCoach,
} from "../../lib/sim/engine.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { SafeHtml } from "../ui/SafeHtml.tsx";

/** Non-blocking top-right tutorial panel — UI stays usable underneath. */
export function CoachPanel() {
  useGame();
  const panel = getCoachPanel();
  if (!panel) return null;

  return (
    <aside
      className="coach-panel hud-frame hud-surface"
      role="complementary"
      aria-label="Tutorial"
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[10px] font-bold tracking-widest text-ink-faint uppercase">
          Tutorial {panel.step}/{panel.total}
        </span>
        <button
          type="button"
          className="flex-none cursor-pointer rounded-sm border border-edge bg-g-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-g-3 hover:text-white"
          onClick={() => skipCoach()}
        >
          Skip
        </button>
      </div>
      <h3 className="m-0 font-display text-xl leading-[1.2] font-normal tracking-[-.02em]">
        {panel.title}
      </h3>
      {panel.body ? (
        <div className="text-[12.5px] leading-[1.4] text-ink-soft [&_p]:mb-2 [&_p:last-child]:mb-0">
          <SafeHtml html={panel.body} />
        </div>
      ) : null}
      {panel.subtasks && panel.subtasks.length ? (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-widest text-ink-faint uppercase">
            Your tasks
          </div>
          <ul
            className="m-0 flex list-none flex-col gap-1.5 p-0"
            aria-label="Your tasks"
          >
            {panel.subtasks.map((s: any) => (
              <li
                key={s.id}
                className={`m-0 flex items-start gap-2 text-[12.5px] leading-[1.35] font-[550] ${s.done ? "font-[650] text-ink" : "text-ink-soft"}`}
                aria-checked={s.done}
                role="checkbox"
              >
                <span
                  className={`mt-px inline-flex size-4 flex-none items-center justify-center rounded text-[11px] leading-none text-white ${s.done ? "border-green bg-green text-[#04140a]" : "border-edge bg-g-2"} border-[1.5px]`}
                  aria-hidden="true"
                >
                  {s.done ? "✓" : ""}
                </span>
                <span className="min-w-0">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : panel.task ? (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-widest text-ink-faint uppercase">
            Your tasks
          </div>
          <p className="m-0 text-[13px] leading-[1.35] font-[650] text-ink">
            {panel.task}
          </p>
        </div>
      ) : null}
      {panel.canContinue ? (
        <button
          type="button"
          className={`cursor-pointer self-stretch rounded-sm border-none bg-blue px-3 py-2.5 text-[13px] font-[650] text-white hover:brightness-[1.06] ${panel.subtasks?.length || panel.task ? "mt-3.5" : "mt-1.5"}`}
          onClick={() => continueCoach()}
        >
          {panel.continueLabel || "Continue"}
        </button>
      ) : null}
    </aside>
  );
}
