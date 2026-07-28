"use client";

import { useEffect, useState, useRef } from "react";
import {
  createMpRoom,
  getMpRoom,
  joinMpRoom,
  leaveMpRoom,
} from "../../lib/mp/client.js";
import {
  realmByRole,
  homeIsoForRealm,
  DEFAULT_REALM_ID,
  realmById,
} from "../../lib/sim/realms.js";

/**
 * Lobby: create or join a private room. Host starts from GameApp once ≥2 players.
 */
export default function MultiplayerLobby({
  selectedRole,
  onBack,
  onHostStart,
  onGuestReady,
  initialSession,
  onConsumedInitial,
}) {
  const realm = realmByRole(selectedRole || realmById(DEFAULT_REALM_ID).role);
  const [mode, setMode] = useState(() =>
    initialSession ? (initialSession.room?.hostTokenMatch ? "host" : "join") : "menu"
  );
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState(""); // create | join | ""
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(() => initialSession || null);
  const guestStarted = useRef(false);

  useEffect(() => {
    if (!initialSession) return;
    setSession(initialSession);
    setMode(initialSession.room?.hostTokenMatch ? "host" : "join");
    setStarting(false);
    onConsumedInitial?.();
  }, [initialSession, onConsumedInitial]);

  useEffect(() => {
    if (!session || session.room.status !== "lobby") return undefined;
    const id = setInterval(async () => {
      try {
        const data = await getMpRoom(session.code, session.token);
        setSession((s) => (s ? { ...s, room: data.room } : s));
        /* Guests only — host enters play via Start, not this poll. */
        if (
          !data.room.hostTokenMatch &&
          !guestStarted.current &&
          data.room.status === "playing" &&
          data.room.snapshot
        ) {
          guestStarted.current = true;
          onGuestReady?.({
            code: session.code,
            token: session.token,
            room: data.room,
            role: data.room.you.role,
            name: data.room.you.name,
            homeIso: homeIsoForRealm(realmByRole(data.room.you.role)),
          });
        }
      } catch (err) {
        if (err && err.status === 404) {
          setError("Room ended — the host left.");
          setSession(null);
          setMode("menu");
        }
      }
    }, 1500);
    return () => clearInterval(id);
  }, [session, onGuestReady]);

  async function hostCreate() {
    setBusy(true);
    setBusyAction("create");
    setError("");
    try {
      const data = await createMpRoom({
        hostName: name.trim() || realm.name,
        role: realm.role,
      });
      setSession({ code: data.room.code, token: data.token, room: data.room });
      setMode("host");
    } catch (err) {
      setError(err.message || "Could not create room");
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }

  async function guestJoin() {
    setBusy(true);
    setBusyAction("join");
    setError("");
    try {
      const data = await joinMpRoom(joinCode.trim().toUpperCase(), {
        name: name.trim() || realm.name,
        role: realm.role,
      });
      setSession({ code: data.room.code, token: data.token, room: data.room });
      setMode("join");
    } catch (err) {
      setError(err.message || "Could not join");
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }

  async function leaveLobby() {
    if (session) {
      try {
        await leaveMpRoom(session.code, { token: session.token });
      } catch {
        /* ignore */
      }
    }
    onBack?.();
  }

  if (session && (mode === "host" || mode === "join")) {
    const room = session.room;
    return (
      <div className="setup-chrome" role="dialog" aria-modal="true">
        <header className="setup-banner hud-frame hud-surface">
          <div className="stamp">Cabinet</div>
          <h1>Room {room.code}</h1>
          <p>
            Share this code. Each player picks a different country on the map,
            then joins. The quarter advances only when everyone has Delivered.
          </p>
        </header>
        <div className="setup-dock hud-frame hud-surface">
          <div className="setup-pick">
            <span className="setup-pick-tag">Lobby</span>
            <strong>
              {room.humanCount} player{room.humanCount === 1 ? "" : "s"}
            </strong>
            <ul className="mp-player-list">
              {room.players.map((p) => (
                <li key={p.seatId + p.name}>
                  {p.name}
                  {p.isHost ? " (host)" : ""}
                  {p.isYou ? " — you" : ""} · {realmByRole(p.role).name}
                </li>
              ))}
            </ul>
            {mode === "host" ? (
              <p className="setup-mode-hint">
                {room.humanCount < 2
                  ? "Waiting for at least one more player…"
                  : "Everyone in? Start when ready."}
              </p>
            ) : (
              <p className="setup-mode-hint">
                Waiting for the host to start the game…
              </p>
            )}
          </div>
          {error && <p className="mp-error">{error}</p>}
          <div className="mp-actions">
            {mode === "host" && (
              <button
                type="button"
                className="setup-go"
                disabled={room.humanCount < 2 || starting}
                onClick={async () => {
                  setStarting(true);
                  setError("");
                  try {
                    await onHostStart?.({
                      code: session.code,
                      token: session.token,
                      room,
                      role: room.you.role,
                      name: room.you.name,
                      homeIso: homeIsoForRealm(realmByRole(room.you.role)),
                    });
                  } catch (err) {
                    setError(err.message || "Could not start");
                    setStarting(false);
                  }
                }}
              >
                {starting ? "Starting…" : "Start game"}
              </button>
            )}
            <button type="button" className="setup-go secondary" onClick={leaveLobby}>
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-chrome" role="dialog" aria-modal="true">
      <header className="setup-banner hud-frame hud-surface">
        <div className="stamp">Cabinet</div>
        <h1>Multiplayer</h1>
        <p>
          Private lobby. Unclaimed seats stay AI. Click your country on the map
          before you create or join.
        </p>
      </header>
      <div className="setup-dock hud-frame hud-surface">
        <div className="setup-pick">
          <strong>{realm.name}</strong>
          <em>Your seat if free</em>
        </div>
        <label className="setup-name">
          <span>Your name</span>
          <input
            type="text"
            maxLength={34}
            value={name}
            placeholder={realm.name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="setup-name">
          <span>Room code</span>
          <input
            type="text"
            maxLength={6}
            value={joinCode}
            placeholder="ABC123"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
        </label>
        {error && <p className="mp-error">{error}</p>}
        <div className="mp-actions">
          <button
            type="button"
            className="setup-go"
            disabled={busy}
            onClick={hostCreate}
          >
            {busyAction === "create" ? "Creating…" : "Create room"}
          </button>
          <button
            type="button"
            className="setup-go secondary"
            disabled={busy || joinCode.trim().length < 4}
            onClick={guestJoin}
          >
            {busyAction === "join" ? "Joining…" : "Join room"}
          </button>
          <button type="button" className="setup-go secondary" onClick={onBack}>
            Solo instead
          </button>
        </div>
      </div>
    </div>
  );
}
