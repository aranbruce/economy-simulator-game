"use client";

import { useEffect, useState, useRef } from "react";
import {
  createMpRoom,
  getMpRoom,
  joinMpRoom,
  leaveMpRoom,
  MpApiError,
} from "../../lib/mp/client.ts";
import {
  realmByRole,
  homeIsoForRealm,
  DEFAULT_REALM_ID,
  realmById,
} from "../../lib/sim/realms.ts";
import { playerCountryId } from "../../lib/sim/engine.ts";
import { HudFrame } from "../ui/HudFrame.tsx";
import { SetupGoButton } from "../ui/SetupGoButton.tsx";
import { FlagAvatar } from "../ui/FlagAvatar.tsx";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface MultiplayerLobbyProps {
  selectedRole?: string | null;
  onBack?: () => void;
  onHostStart?: (opts: any) => Promise<void> | void;
  onGuestReady?: (opts: any) => void;
  initialSession?: any;
  onConsumedInitial?: () => void;
}

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
}: MultiplayerLobbyProps) {
  const realm = realmByRole(selectedRole || realmById(DEFAULT_REALM_ID).role);
  const [mode, setMode] = useState(() =>
    initialSession
      ? initialSession.room?.hostTokenMatch
        ? "host"
        : "join"
      : "menu",
  );
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState(""); // create | join | ""
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<any>(() => initialSession || null);
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
        setSession((s: any) => (s ? { ...s, room: data.room } : s));
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
        if (err instanceof MpApiError && err.status === 404) {
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
        hostName: realm.name,
        role: realm.role,
      });
      setSession({ code: data.room.code, token: data.token, room: data.room });
      setMode("host");
    } catch (err) {
      setError(errMessage(err, "Could not create room"));
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
        name: realm.name,
        role: realm.role,
      });
      setSession({ code: data.room.code, token: data.token, room: data.room });
      setMode("join");
    } catch (err) {
      setError(errMessage(err, "Could not join"));
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

  async function copyRoomCode(code: string) {
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
      <div
        className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between px-3.5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(14px,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
      >
        <HudFrame className="setup-banner hud-surface pointer-events-auto w-[min(520px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] self-center px-5 pt-4 pb-3.5">
          <div className="text-xs font-bold tracking-[.14em] text-accent-lt uppercase">
            Cabinet
          </div>
          <h1 className="my-1.5 font-display text-[clamp(24px,3.6vw,30px)] leading-[1.1] font-normal tracking-tight">
            Private room
          </h1>
          <p className="m-0 text-sm leading-[1.45] text-ink-soft">
            {mode === "host"
              ? "Share the code below. Friends pick a free country on the map, then join with that code."
              : "You’re in. The host starts when everyone is ready — quarters only advance when every human has Delivered."}
          </p>
        </HudFrame>
        <HudFrame className="setup-dock hud-surface pointer-events-auto flex w-[min(780px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] flex-col items-stretch gap-3 self-center px-4 py-3.5">
          <div className="flex w-full flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold tracking-widest text-accent-lt uppercase">
                Room code
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="font-display text-[clamp(28px,4vw,36px)] leading-none font-normal tracking-[.12em] text-ink tabular-nums"
                  aria-label={`Room code ${room.code}`}
                >
                  {room.code}
                </span>
                <SetupGoButton
                  secondary
                  customSize
                  className="px-3.5 py-2 text-sm"
                  onClick={() => copyRoomCode(room.code)}
                >
                  {copied ? "Copied" : "Copy"}
                </SetupGoButton>
              </div>
              <p className="mt-1 text-left text-xs leading-[1.35] text-ink-soft">
                Unclaimed seats stay AI once the game starts.
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold tracking-widest text-accent-lt uppercase">
                  Players
                </span>
                <strong>
                  {room.humanCount} human{room.humanCount === 1 ? "" : "s"}
                </strong>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {room.players.map((p: any) => {
                  const seat = realmByRole(p.role);
                  return (
                    <li
                      key={p.seatId + p.name}
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border border-white/6 bg-white/4 px-2.5 py-2 text-sm leading-[1.3] text-ink max-md:grid-cols-[1fr_auto] max-md:gap-x-2 max-md:gap-y-1"
                    >
                      <span className="min-w-0 font-semibold">
                        {p.name}
                        {p.isYou ? (
                          <em className="ml-1 font-medium text-accent-lt not-italic">
                            {" "}
                            you
                          </em>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-soft max-md:col-span-full">
                        <FlagAvatar
                          role={playerCountryId(p.role)}
                          size="size-4.5"
                        />
                        {seat.name}
                      </span>
                      {p.isHost ? (
                        <span className="justify-self-end rounded-full bg-blue/12 px-1.75 py-0.75 text-xs font-bold tracking-[.08em] text-accent-lt uppercase">
                          Host
                        </span>
                      ) : (
                        <span className="justify-self-end rounded-full bg-white/6 px-1.75 py-0.75 text-xs font-bold tracking-[.08em] text-ink-faint uppercase">
                          Guest
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-left text-xs leading-[1.35] text-ink-soft">
                {mode === "host"
                  ? ready
                    ? "Everyone in? Start when ready."
                    : "Waiting for at least one more player…"
                  : "Waiting for the host to start the game…"}
              </p>
            </div>
          </div>

          {error && <p className="m-0 text-xs text-red">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {mode === "host" && (
              <SetupGoButton
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
                    setError(errMessage(err, "Could not start"));
                    setStarting(false);
                  }
                }}
              >
                {starting ? "Starting…" : "Start game"}
              </SetupGoButton>
            )}
            <SetupGoButton secondary onClick={leaveLobby}>
              Leave
            </SetupGoButton>
          </div>
        </HudFrame>
      </div>
    );
  }

  const canJoin = joinCode.trim().length >= 4;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between px-3.5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(14px,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mpLobbyTitle"
    >
      <HudFrame className="setup-banner hud-surface pointer-events-auto w-[min(520px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] self-center px-5 pt-4 pb-3.5">
        <div className="text-xs font-bold tracking-[.14em] text-accent-lt uppercase">
          Cabinet
        </div>
        <h1
          id="mpLobbyTitle"
          className="my-1.5 font-display text-[clamp(24px,3.6vw,30px)] leading-[1.1] font-normal tracking-tight"
        >
          Multiplayer
        </h1>
        <p className="m-0 text-sm leading-[1.45] text-ink-soft">
          Private rooms over the same map. Pick your country first, then host a
          lobby or join with a friend’s code.
        </p>
      </HudFrame>
      <HudFrame className="setup-dock hud-surface pointer-events-auto flex w-[min(820px,100%)] animate-[panelIn_0.18s_cubic-bezier(.22,1,.3,1)] flex-col items-stretch gap-3 self-center px-4 py-3.5">
        <div className="flex w-full flex-col gap-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0 border-b border-white/8 pb-3">
            <span className="text-xs font-bold tracking-widest text-accent-lt uppercase">
              Your seat
            </span>
            <div className="flex items-center gap-2.5">
              <FlagAvatar role={playerCountryId(realm.role)} size="size-10" />
              <strong className="font-display text-xl leading-[1.15] font-normal tracking-[-.02em]">
                {realm.name}
              </strong>
            </div>
            <em className="text-xs leading-[1.4] text-ink-soft not-italic">
              Click another country on the map to change seat — it must be
              free when you enter.
            </em>
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
            <section
              className="flex min-h-full flex-col justify-between gap-3 rounded-md border border-white/7 bg-white/4 px-3.25 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
              aria-labelledby="mpHostPath"
            >
              <div className="flex flex-col gap-1">
                <span
                  className="text-xs font-bold tracking-widest text-accent-lt uppercase"
                  id="mpHostPath"
                >
                  Host
                </span>
                <strong className="font-display text-lg leading-[1.15] font-normal tracking-[-.02em] text-ink">
                  Create a room
                </strong>
                <p className="m-0 text-xs leading-[1.4] text-ink-soft">
                  Get a short code to share. Friends join when their seats are
                  free; everyone else stays AI.
                </p>
              </div>
              <SetupGoButton
                className="w-full"
                disabled={busy}
                onClick={hostCreate}
              >
                {busyAction === "create" ? "Creating…" : "Create room"}
              </SetupGoButton>
            </section>

            <section
              className="flex min-h-full flex-col justify-between gap-3 rounded-md border border-white/7 bg-white/4 px-3.25 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
              aria-labelledby="mpJoinPath"
            >
              <div className="flex flex-col gap-1">
                <span
                  className="text-xs font-bold tracking-widest text-accent-lt uppercase"
                  id="mpJoinPath"
                >
                  Join
                </span>
                <strong className="font-display text-lg leading-[1.15] font-normal tracking-[-.02em] text-ink">
                  Enter a room code
                </strong>
                <p className="m-0 text-xs leading-[1.4] text-ink-soft">
                  Use the six-character code from the host. Your seat must still
                  be open.
                </p>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-2 max-sm:grid-cols-1">
                <label className="flex w-auto min-w-0 flex-col gap-1.25">
                  <span className="text-xs font-bold tracking-widest text-ink-faint uppercase">
                    Room code
                  </span>
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
                    className="w-full min-w-0 rounded-sm border border-edge bg-g-3 px-2.75 py-2.25 text-base font-semibold tracking-[.14em] text-white uppercase tabular-nums placeholder:font-medium placeholder:text-ink-faint focus:outline-2 focus:outline-offset-1 focus:outline-accent"
                  />
                </label>
                <SetupGoButton
                  secondary
                  customSize
                  className="h-fit w-auto flex-none self-end px-4.5 py-2.75 text-sm whitespace-nowrap"
                  disabled={busy || !canJoin}
                  onClick={guestJoin}
                >
                  {busyAction === "join" ? "Joining…" : "Join"}
                </SetupGoButton>
              </div>
            </section>
          </div>
        </div>

        {error && (
          <p className="m-0 text-xs text-red" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent px-2.5 py-1.5 font-sans text-xs font-semibold text-ink-soft underline decoration-white/20 underline-offset-4 transition-[color,text-decoration-color] duration-160 hover:text-ink hover:decoration-white/45 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent-lt"
            onClick={onBack}
          >
            Solo instead
          </button>
        </div>
      </HudFrame>
    </div>
  );
}
