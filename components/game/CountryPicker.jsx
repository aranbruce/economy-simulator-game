"use client";

import { useState } from "react";
import {
  realmById,
  realmByRole,
  homeIsoForRealm,
  DEFAULT_REALM_ID,
  DEFAULT_HOME_ISO,
} from "../../lib/sim/realms.js";
import {
  pinsForRole,
  gdp0ForSeat,
  fmtGdpBn,
  NATION_PROFILE,
  polityOf,
} from "../../lib/sim/engine.js";
import { HudFrame } from "../ui/HudFrame.jsx";

/** Opening books for a seat — pinsForRole, with home deficit from the UK profile. */
function openingBooks(role) {
  const pins = pinsForRole(role);
  const deficit =
    pins.deficit0 != null
      ? pins.deficit0
      : (NATION_PROFILE.kingdom && NATION_PROFILE.kingdom.deficit0) || 4.5;
  return {
    debt: pins.debt,
    deficit,
    inflation: pins.inflation,
    trend: pins.trend,
    rate: pins.rate,
    unemployment: pins.unemployment,
    gdpBn: gdp0ForSeat(role),
  };
}

function modeHint(sandbox, meta) {
  if (sandbox) {
    if (meta.kind === "congress") {
      return "Practice run: congress pressure and crises still fire, but you keep the job.";
    }
    return "Practice run: elections and crises still fire, but you keep the job.";
  }
  if (meta.kind === "congress") {
    return "Survive the party congress, keep the apparatus loyal, and watch the bond market — capital recovers slowly.";
  }
  if (meta.kind === "managed") {
    return "Managed ballots still matter. Survive your party and the bond market — or lose the seals.";
  }
  return "Win elections, survive your party and the bond market — or lose the seals.";
}

function SetupStat({ label, value }) {
  return (
    <div className="setup-stat">
      <span className="setup-stat-k">{label}</span>
      <span className="setup-stat-v">{value}</span>
    </div>
  );
}

/** Floating chrome over the world map during country select. */
export default function CountryPicker({
  selectedRole,
  onStart,
  onMultiplayer,
  onResume,
  initialId,
  onTutorialChange,
}) {
  const initial = realmById(initialId || DEFAULT_REALM_ID);
  const mapRealm = realmByRole(selectedRole || initial.role);
  const [sandbox, setSandbox] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const realm = tutorial ? realmById("home") : mapRealm;
  const books = openingBooks(realm.role);
  const meta = polityOf(realm.role);
  const name = realm.name.slice(0, 34);
  const sandboxLocked = tutorial;

  function setTutorialOn(on) {
    setTutorial(on);
    if (on) setSandbox(true);
    if (typeof onTutorialChange === "function") onTutorialChange(on);
  }

  return (
    <div className="setup-chrome" role="dialog" aria-modal="true" aria-labelledby="setupTitle">
      <HudFrame className="setup-banner hud-surface">
          <div className="stamp">Commission</div>
          <h1 id="setupTitle">Choose your country</h1>
          <p>
            {tutorial
              ? "Tutorial locks you into the United Kingdom — click Get started when you’re ready."
              : "Ten realms on a real map. Click any country in a bloc to take that seat — the books open to that realm’s inheritance."}
          </p>
      </HudFrame>

      <HudFrame className="setup-dock hud-surface">
        <div className="setup-pick">
          <div className="setup-pick-head">
            <div className="setup-pick-title">
              <strong>{realm.name}</strong>
              <em>{realm.blurb}</em>
            </div>
            <div className="setup-mode" role="group" aria-label="Game mode">
              <span className="setup-mode-label">Mode</span>
              <div className="seg mini">
                <button
                  type="button"
                  aria-pressed={!sandbox}
                  disabled={sandboxLocked}
                  title={
                    sandboxLocked
                      ? "Tutorial runs in Sandbox"
                      : undefined
                  }
                  onClick={() => {
                    if (!sandboxLocked) setSandbox(false);
                  }}
                >
                  Career
                </button>
                <button
                  type="button"
                  aria-pressed={sandbox}
                  onClick={() => setSandbox(true)}
                  title="Cannot be removed from office"
                >
                  Sandbox
                </button>
              </div>
              <p className="setup-mode-hint">{modeHint(sandbox, meta)}</p>
              <label className="setup-check">
                <input
                  type="checkbox"
                  checked={tutorial}
                  onChange={(e) => setTutorialOn(e.target.checked)}
                />
                <span>
                  <strong>Tutorial</strong>
                  <em>Sandbox walkthrough as the United Kingdom.</em>
                </span>
              </label>
            </div>
          </div>
          <div className="setup-books" aria-label={`Opening books for ${realm.name}`}>
            <SetupStat label="Polity" value={meta.label} />
            <SetupStat label="GDP" value={fmtGdpBn(books.gdpBn)} />
            <SetupStat label="Debt" value={books.debt.toFixed(0) + "%"} />
            <SetupStat label="Deficit" value={books.deficit.toFixed(1) + "%"} />
            <SetupStat label="Inflation" value={books.inflation.toFixed(1) + "%"} />
            <SetupStat label="Trend" value={books.trend.toFixed(1) + "%"} />
            <SetupStat label="Bank rate" value={books.rate.toFixed(2) + "%"} />
          </div>
        </div>
        <div className="setup-actions">
          <button
            type="button"
            className="setup-go"
            onClick={() =>
              onStart(
                tutorial
                  ? {
                      country: "United Kingdom",
                      homeRole: "home",
                      homeIso: DEFAULT_HOME_ISO,
                      realmId: "home",
                      sandbox: true,
                      tutorial: true,
                    }
                  : {
                      country: name,
                      homeRole: realm.role,
                      homeIso: homeIsoForRealm(realm),
                      realmId: realm.id,
                      sandbox,
                      tutorial: false,
                    }
              )
            }
          >
            Get started
          </button>
          {typeof onMultiplayer === "function" && (
            <button
              type="button"
              className="setup-go secondary"
              onClick={() => onMultiplayer({ realm, name, sandbox })}
              disabled={tutorial}
              title={tutorial ? "Leave the tutorial to open multiplayer" : undefined}
            >
              Multiplayer lobby
            </button>
          )}
          {typeof onResume === "function" && (
            <button type="button" className="setup-go secondary" onClick={onResume}>
              Resume multiplayer
            </button>
          )}
        </div>
      </HudFrame>
    </div>
  );
}
