"use client";

import {
  FACTIONS,
  POLITY,
  POLITY_LADDER,
  TAXES,
  TAX_BY_ID,
  VICE,
  T,
  approvalOf,
  aggregate,
  bump,
  clamp,
  polityChangePc,
  polityCanReach,
  politySteps,
  taxAvailable,
  fullEffects,
  qualEffects,
} from "../../lib/sim/engine.js";
import { useGame } from "../../lib/ui/useGame.js";
import { Eyebrow, Hint } from "../ui/Typography.jsx";

export function SocietyPanel() {
  const G = useGame();
  const E = aggregate(G.draft);
  const e = G.econ;
  const lawPolity = G.law.polity || "democracy";
  const draftPolity = G.draft.polity || "democracy";

  const bars = [
    ["liberty", "Civil liberty", e.liberty],
    ["crime", "Crime", e.crime],
    ["health", "Public health", e.health],
    ["env", "Environment", e.env],
    ["black", "Black market share", E.blackLevel],
    ["gini", "Inequality (Gini)", e.gini],
  ];

  const setPolity = (id) => {
    if (!polityCanReach(lawPolity, id)) return;
    G.draft.polity = id;
    bump();
  };

  const setVice = (id, state) => {
    G.draft.vice[id] = state;
    for (const t of TAXES) {
      if (!taxAvailable(t, G.draft)) G.draft.taxes[t.id].on = false;
    }
    bump();
  };

  return (
    <>
      <Eyebrow>Where you stand</Eyebrow>
      <div className="panel" style={{ padding: "11px 13px" }}>
        {FACTIONS.map((f) => {
          const v = G.fac[f.id];
          const cls = v > 55 ? "good" : v < 38 ? "bad" : "";
          return (
            <div
              key={f.id}
              className="frow"
              style={{
                gridTemplateColumns: "110px 1fr 34px",
                marginBottom: 4,
              }}
            >
              <span>
                {f.name}{" "}
                <span style={{ color: "var(--ink-faint)", fontSize: 10 }}>
                  {Math.round(f.w * 100)}%
                </span>
              </span>
              <span className="fb">
                <i className={cls} style={{ width: `${v.toFixed(0)}%` }} />
              </span>
              <span className="fv">{v.toFixed(0)}</span>
            </div>
          );
        })}
        <div
          className="frow"
          style={{
            gridTemplateColumns: "110px 1fr 34px",
            borderTop: "1px solid var(--rule)",
            paddingTop: 5,
            marginTop: 3,
          }}
        >
          <span style={{ fontWeight: 600 }}>Approval</span>
          <span className="fb">
            <i
              style={{
                width: `${approvalOf(G.fac).toFixed(0)}%`,
                background: "var(--red)",
              }}
            />
          </span>
          <span className="fv" style={{ fontWeight: 600 }}>
            {approvalOf(G.fac).toFixed(0)}
          </span>
        </div>
      </div>

      <Eyebrow className="mt">Social indicators</Eyebrow>
      <div className="panel" style={{ padding: "11px 13px" }}>
        {bars.map(([k, n, v]) => (
          <div
            key={k}
            className="frow"
            style={{
              gridTemplateColumns: "150px 1fr 34px",
              marginBottom: 4,
            }}
          >
            <span>{n}</span>
            <span className="fb">
              <i
                style={{
                  width: `${clamp(v, 0, 100).toFixed(0)}%`,
                  background:
                    k === "crime" || k === "black" || k === "gini"
                      ? v > 50
                        ? "var(--red)"
                        : "var(--ink-soft)"
                      : v > 55
                        ? "var(--green)"
                        : "var(--ink-soft)",
                }}
              />
            </span>
            <span className="fv">{v.toFixed(0)}</span>
          </div>
        ))}
      </div>

      <Eyebrow className="mt">Political system</Eyebrow>
      <Hint>
        Stage any system. A neighbour costs the listed capital; leaping democracy
        ↔ authoritarian costs much more. Factions move when you deliver.
      </Hint>
      <div className="cards">
        {POLITY_LADDER.map((id) => {
          const m = POLITY[id];
          const isLaw = id === lawPolity;
          const on = id === draftPolity;
          const pc = polityChangePc(lawPolity, id);
          const steps = politySteps(lawPolity, id);
          const leap = steps > 1;
          const cat = isLaw
            ? "in force"
            : leap
              ? `leap · ${pc} capital`
              : `${pc} capital`;
          return (
            <div
              key={id}
              className={
                "card" + (isLaw ? " on" : "") + (on && !isLaw ? " staged" : "")
              }
            >
              <h4>
                {m.label}
                <span className="cat">{cat}</span>
              </h4>
              <p>{m.blurb}</p>
              <div className="foot">
                {on ? (
                  <span className="pc">
                    {isLaw
                      ? "Current system"
                      : leap
                        ? `Staged leap — ${pc} capital`
                        : "Staged in the bill"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPolity(id)}
                  >
                    {isLaw ? "Revert" : leap ? "Stage leap" : "Stage"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Eyebrow className="mt">What is legal, and on what terms</Eyebrow>
      <Hint>
        Prohibition pushes a market underground: no receipts, more crime.
        Legalising creates a tax base you can then set a duty on, over on the
        Taxes tab.
      </Hint>
      <div className="cards">
        {VICE.map((v) => {
          const cur = G.draft.vice[v.id];
          const inLaw = G.law.vice[v.id];
          const st = v.states.find((s) => s.id === cur);
          const effects = G.sandbox
            ? fullEffects(st.imp, st.fac, 0)
            : qualEffects(st.imp, st.fac, 0);
          return (
            <div
              key={v.id}
              className={"card" + (cur !== inLaw ? " staged" : " on")}
            >
              <h4>
                {v.name}
                <span className="cat">{v.pc} capital</span>
              </h4>
              <div className="seg">
                {v.states.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === cur}
                    className={
                      s.id === cur && s.id !== inLaw ? "staged" : ""
                    }
                    onClick={() => setVice(v.id, s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p>{T(st.blurb)}</p>
              <div dangerouslySetInnerHTML={{ __html: effects }} />
              {v.tax ? (
                <div className="eff" style={{ color: "var(--ink-faint)" }}>
                  {taxAvailable(TAX_BY_ID[v.tax], G.draft)
                    ? "Duty available"
                    : "No duty can be levied in this state"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
