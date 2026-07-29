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
import { HudFrame } from "../ui/HudFrame.jsx";

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
  const [copied, setCopied] = useState(false);
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

  async function copyRoomCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy — select the code manually.");
    }
  }

  if (session && (mode === "host" || mode === "join")) {
    const room = session.room;
    const ready = room.humanCount >= 2;
    return (
      <div className="setup-chrome" role="dialog" aria-modal="true">
        <HudFrame className="setup-banner hud-surface">
          <div className="stamp">Cabinet</div>
          <h1>Private room</h1>
          <p>
            {mode === "host"
              ? "Share the code below. Friends pick a free country on the map, then join with that code."
              : "You’re in. The host starts when everyone is ready — quarters only advance when every human has Delivered."}
          </p>
        </HudFrame>
        <HudFrame className="setup-dock hud-surface">
          <div className="mp-lobby-layout">
            <div className="mp-code-block">
              <span className="setup-pick-tag">Room code</span>
              <div className="mp-code-row">
                <span className="mp-code-value" aria-label={`Room code ${room.code}`}>
                  {room.code}
                </span>
                <button
                  type="button"
                  className="setup-go secondary mp-copy"
                  onClick={() => copyRoomCode(room.code)}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="setup-mode-hint mp-hint-left">
                Unclaimed seats stay AI once the game starts.
              </p>
            </div>

            <div className="setup-pick mp-roster">
              <div className="mp-roster-head">
                <span className="setup-pick-tag">Players</span>
                <strong>
                  {room.humanCount} human{room.humanCount === 1 ? "" : "s"}
                </strong>
              </div>
              <ul className="mp-player-list">
                {room.players.map((p) => {
                  const seat = realmByRole(p.role);
                  return (
                    <li key={p.seatId + p.name} className="mp-player-row">
                      <span className="mp-player-name">
                        {p.name}
                        {p.isYou ? <em> you</em> : null}
                      </span>
                      <span className="mp-player-seat">{seat.name}</span>
                      {p.isHost ? (
                        <span className="mp-player-badge">Host</span>
                      ) : (
                        <span className="mp-player-badge quiet">Guest</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="setup-mode-hint mp-hint-left">
                {mode === "host"
                  ? ready
                    ? "Everyone in? Start when ready."
                    : "Waiting for at least one more player…"
                  : "Waiting for the host to start the game…"}
              </p>
            </div>
          </div>

          {error && <p className="mp-error">{error}</p>}
          <div className="mp-actions">
            {mode === "host" && (
              <button
                type="button"
                className="setup-go"
                disabled={!ready || starting}
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
        </HudFrame>
      </div>
    );
  }

  const canJoin = joinCode.trim().length >= 4;

  return (
    <div className="setup-chrome" role="dialog" aria-modal="true" aria-labelledby="mpLobbyTitle">
      <HudFrame className="setup-banner hud-surface">
        <div className="stamp">Cabinet</div>
        <h1 id="mpLobbyTitle">Multiplayer</h1>
        <p>
          Private rooms over the same map. Pick your country first, then host a
          lobby or join with a friend’s code.
        </p>
      </HudFrame>
      <HudFrame className="setup-dock hud-surface mp-menu-dock">
        <div className="mp-lobby-layout">
          <div className="mp-menu-seat">
            <div className="setup-pick">
              <div className="setup-pick-head">
                <div className="setup-pick-title">
                  <span className="setup-pick-tag">Your seat</span>
                  <strong>{realm.name}</strong>
                  <em>Click another country on the map to change seat — it must be free when you enter.</em>
                </div>
              </div>
            </div>
            <label className="setup-name mp-menu-name">
              <span>Display name</span>
              <input
                type="text"
                maxLength={34}
                value={name}
                placeholder={realm.name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Display name in the lobby"
              />
            </label>
          </div>

          <div className="mp-menu-paths">
            <section className="mp-path-card" aria-labelledby="mpHostPath">
              <div className="mp-path-copy">
                <span className="setup-pick-tag" id="mpHostPath">Host</span>
                <strong>Create a room</strong>
                <p>Get a short code to share. Friends join when their seats are free; everyone else stays AI.</p>
              </div>
              <button
                type="button"
                className="setup-go"
                disabled={busy}
                onClick={hostCreate}
              >
                {busyAction === "create" ? "Creating…" : "Create room"}
              </button>
            </section>

            <section className="mp-path-card" aria-labelledby="mpJoinPath">
              <div className="mp-path-copy">
                <span className="setup-pick-tag" id="mpJoinPath">Join</span>
                <strong>Enter a room code</strong>
                <p>Use the six-character code from the host. Your seat must still be open.</p>
              </div>
              <div className="mp-join-row">
                <label className="setup-name mp-join-code">
                  <span>Room code</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    placeholder="ABC123"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canJoin && !busy) guestJoin();
                    }}
                    aria-label="Room code"
                  />
                </label>
                <button
                  type="button"
                  className="setup-go secondary mp-join-btn"
                  disabled={busy || !canJoin}
                  onClick={guestJoin}
                >
                  {busyAction === "join" ? "Joining…" : "Join"}
                </button>
              </div>
            </section>
          </div>
        </div>

        {error && <p className="mp-error" role="alert">{error}</p>}
        <div className="mp-menu-foot">
          <button type="button" className="mp-solo-link" onClick={onBack}>
            Solo instead
          </button>
        </div>
      </HudFrame>
    </div>
  );
}
