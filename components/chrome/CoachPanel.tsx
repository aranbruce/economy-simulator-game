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
      <div className="coach-panel-head">
        <span className="coach-panel-kicker">
          Tutorial {panel.step}/{panel.total}
        </span>
        <button
          type="button"
          className="coach-panel-skip"
          onClick={() => skipCoach()}
        >
          Skip
        </button>
      </div>
      <h3 className="coach-panel-title">{panel.title}</h3>
      {panel.body ? (
        <div className="coach-panel-body">
          <SafeHtml html={panel.body} />
        </div>
      ) : null}
      {panel.subtasks && panel.subtasks.length ? (
        <div className="coach-panel-tasks">
          <div className="coach-panel-tasks-title">Your tasks</div>
          <ul className="coach-panel-checks" aria-label="Your tasks">
            {panel.subtasks.map((s: any) => (
              <li
                key={s.id}
                className={s.done ? "is-done" : undefined}
                aria-checked={s.done}
                role="checkbox"
              >
                <span className="coach-check" aria-hidden="true">
                  {s.done ? "✓" : ""}
                </span>
                <span className="coach-check-label">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : panel.task ? (
        <div className="coach-panel-tasks">
          <div className="coach-panel-tasks-title">Your tasks</div>
          <p className="coach-panel-task">{panel.task}</p>
        </div>
      ) : null}
      {panel.canContinue ? (
        <button
          type="button"
          className="coach-panel-go"
          onClick={() => continueCoach()}
        >
          {panel.continueLabel || "Continue"}
        </button>
      ) : null}
    </aside>
  );
}
