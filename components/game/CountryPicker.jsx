"use client";

import { useState, useEffect } from "react";
import {
  realmById,
  realmByRole,
  homeIsoForRealm,
  DEFAULT_REALM_ID,
} from "../../lib/sim/realms.js";
import {
  pinsForRole,
  gdp0ForSeat,
  fmtGdpBn,
  NATION_PROFILE,
} from "../../lib/sim/engine.js";

/** Opening books for a seat — pinsForRole, with home deficit from the Kingdom profile. */
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
}) {
  const initial = realmById(initialId || DEFAULT_REALM_ID);
  const realm = realmByRole(selectedRole || initial.role);
  const [customName, setCustomName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const books = openingBooks(realm.role);

  useEffect(() => {
    if (!nameTouched) setCustomName("");
  }, [realm.id, nameTouched]);

  const name = (customName.trim() || realm.name).slice(0, 34);

  return (
    <div className="setup-chrome" role="dialog" aria-modal="true" aria-labelledby="setupTitle">
      <header className="setup-banner hud-frame hud-surface">
        <div className="stamp">Commission</div>
        <h1 id="setupTitle">Choose your country</h1>
        <p>
          Ten realms on a real map. Click any country in a bloc to take that
          seat — the books open to that realm&apos;s inheritance.
        </p>
      </header>

      <div className="setup-dock hud-frame hud-surface">
        <div className="setup-pick">
          <span className="setup-pick-tag">{realm.tag}</span>
          <strong>{realm.name}</strong>
          <em>{realm.blurb}</em>
          <div className="setup-books" aria-label={`Opening books for ${realm.name}`}>
            <SetupStat label="GDP" value={fmtGdpBn(books.gdpBn)} />
            <SetupStat label="Debt" value={books.debt.toFixed(0) + "%"} />
            <SetupStat label="Deficit" value={books.deficit.toFixed(1) + "%"} />
            <SetupStat label="Inflation" value={books.inflation.toFixed(1) + "%"} />
            <SetupStat label="Trend" value={books.trend.toFixed(1) + "%"} />
            <SetupStat label="Bank rate" value={books.rate.toFixed(2) + "%"} />
          </div>
        </div>
        <label className="setup-name">
          <span>Style of address</span>
          <input
            type="text"
            maxLength={34}
            placeholder={realm.name}
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value);
              setNameTouched(true);
            }}
            aria-label="Country name"
          />
        </label>
        <div className="setup-mode" role="group" aria-label="Game mode">
          <span className="setup-mode-label">Mode</span>
          <div className="seg mini">
            <button
              type="button"
              aria-pressed={!sandbox}
              onClick={() => setSandbox(false)}
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
          <p className="setup-mode-hint">
            {sandbox
              ? "Practice run: elections and crises still fire, but you keep the job."
              : "Win elections, survive your party and the bond market — or lose the seals."}
          </p>
        </div>
        <button
          type="button"
          className="setup-go"
          onClick={() =>
            onStart({
              country: name,
              homeRole: realm.role,
              homeIso: homeIsoForRealm(realm),
              realmId: realm.id,
              sandbox,
            })
          }
        >
          Take the seals
        </button>
        {typeof onMultiplayer === "function" && (
          <button
            type="button"
            className="setup-go secondary"
            onClick={() => onMultiplayer({ realm, name, sandbox })}
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
    </div>
  );
}
