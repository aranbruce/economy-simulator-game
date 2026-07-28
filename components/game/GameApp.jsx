"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  newGame,
  getG,
  setOnState,
  setOnSetup,
  setTab,
  getTab,
  setOnTabChange,
  registerEl,
  render,
  renderChrome,
  projectionModal,
  dismissNewestPress,
  PARTNERS,
  exportGameSnapshot,
  hydrateGameSnapshot,
  clone,
  showMpBriefing,
  applyMpDiploPatch,
  lockMpSubmission,
  clearMpLockedSubmission,
  snapshotMpDiploUi,
  restoreMpDiploUi,
  applyLocalMpDiploAction,
  playerCountryId,
} from "../../lib/sim/engine.js";
import {
  BOARD_METRICS,
  boardMetricCaption,
  boardMetricBlocName,
  boardMetricValueLabel,
} from "../../lib/sim/boardMetrics.js";
import { DEFAULT_REALM_ID, realmById, realmByRole, homeIsoForRealm } from "../../lib/sim/realms.js";
import {
  getMpRoom,
  startMpRoom,
  submitMpBill,
  unsubmitMpBill,
  leaveMpRoom,
  chooseMpEvent,
  applyMpDiplo,
  openMpRoomStream,
} from "../../lib/mp/client.js";
import {
  saveMpSession,
  loadMpSession,
  clearMpSession,
} from "../../lib/mp/session.js";
import WorldMap from "../map2d/WorldMap";
import RealmStats from "../ui/RealmStats";
import CountryPicker from "./CountryPicker";
import MultiplayerLobby from "./MultiplayerLobby";

const SHELL_IDS = [
  "topbar",
  "diploHud",
  "nameBtn",
  "tbTerm",
  "tbMode",
  "tbStats",
  "dockTabs",
  "billBtn",
  "billLabel",
  "billCost",
  "deliverBtn",
  "drawer",
  "dwTitle",
  "dwSub",
  "dwClose",
  "drawerBody",
  "scrim",
  "dpStamp",
  "dpTitle",
  "dpBody",
  "dpOpts",
  "pressLayer",
  "mapLabel",
  "mapMetrics",
  "mapStage",
];

function wireRename() {
  const btn = document.getElementById("nameBtn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.onclick = () => {
    const G = getG();
    const input = document.createElement("input");
    input.type = "text";
    input.id = "nameInput";
    input.value = G.country;
    input.maxLength = 34;
    input.setAttribute("aria-label", "Name of your country");
    const commit = () => {
      const v = (input.value || "").trim();
      G.country = v || "United Kingdom";
      if (input.parentNode) input.parentNode.replaceChild(btn, input);
      btn.dataset.wired = "";
      wireRename();
      render();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (input.parentNode) input.parentNode.replaceChild(btn, input);
      }
    });
    input.addEventListener("blur", commit);
    btn.parentNode.replaceChild(input, btn);
    input.focus();
    input.select();
  };
}

function paintMetricBar(box, metrics, activeId, onPick) {
  if (!box) return;
  box.innerHTML =
    '<div class="seg mini">' +
    metrics
      .map(
        (m) =>
          `<button type="button" data-metric="${m.id}" aria-pressed="${
            m.id === activeId
          }">${m.name}</button>`
      )
      .join("") +
    "</div>";
  box.querySelectorAll("[data-metric]").forEach((btn) => {
    btn.onclick = () => onPick(btn.dataset.metric);
  });
}

function paintMapLabel(G, mapMetric, selectedRole) {
  const label = document.getElementById("mapLabel");
  if (!label || !G) return;
  if (selectedRole === "home") {
    const note = (G.brief && G.brief[0]) || "Your economy";
    const fig =
      mapMetric === "blocs"
        ? boardMetricBlocName("home", G)
        : boardMetricValueLabel("home", mapMetric, G);
    const metricNote = fig ? " · " + fig : "";
    label.innerHTML =
      "<b>" + G.country + "</b><span>" + note + metricNote + "</span>";
    return;
  }
  if (selectedRole) {
    const p = PARTNERS.find((x) => x.id === selectedRole);
    const fig =
      mapMetric === "blocs"
        ? boardMetricBlocName(selectedRole, G)
        : boardMetricValueLabel(selectedRole, mapMetric, G);
    const detail = fig
      ? fig + " · economy card open"
      : "Relations " +
        Math.round(G.rel[selectedRole] ?? 50) +
        " · economy card open";
    label.innerHTML =
      "<b>" + (p ? p.name : selectedRole) + "</b><span>" + detail + "</span>";
    return;
  }
  const caption = boardMetricCaption(mapMetric, G);
  label.innerHTML =
    "<b>" +
    (G.country || "United Kingdom") +
    "</b><span>" +
    (caption || "Click a realm for its books") +
    "</span>";
}

export default function GameApp() {
  const [phase, setPhase] = useState("setup"); // setup | lobby | play
  const [realmId, setRealmId] = useState(DEFAULT_REALM_ID);
  const [homeIso, setHomeIso] = useState(null);
  const [homeScale, setHomeScale] = useState(null);
  const [homeRole, setHomeRole] = useState("home");
  const [setupRole, setSetupRole] = useState(
    () => realmById(DEFAULT_REALM_ID).role
  );
  const [tick, setTick] = useState(0);
  const [worldOk, setWorldOk] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [mapMetric, setMapMetric] = useState("countries");
  const [mpSession, setMpSession] = useState(null);
  const [mpRoom, setMpRoom] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [lobbyBootstrap, setLobbyBootstrap] = useState(null);
  const metricsRef = useRef(null);
  const pendingStart = useRef(null);
  const mpSessionRef = useRef(null);
  const lastMpVersion = useRef(0);
  const hostStartGateRef = useRef(null);
  const lastBriefQ = useRef(-1);
  const lastMorningNoteQ = useRef(-1);
  const lastBriefingCompleteQ = useRef(-1);
  const lastPresentedPendingKey = useRef(null);
  const unsubmitInFlight = useRef(false);
  const diploQueueRef = useRef([]);
  const diploPumpingRef = useRef(false);
  const diploFlushWaitersRef = useRef([]);
  const needsUnsubmitBeforeDiploRef = useRef(false);
  const pendingUnsubmitRef = useRef(null);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const exitMpToSetup = useCallback(
    (notice) => {
      clearMpSession();
      setMpSession(null);
      mpSessionRef.current = null;
      setMpRoom(null);
      setWaiting(false);
      setPhase("setup");
      if (notice) {
        /* Defer so setup chrome is mounted; use alert for reliability outside play shell. */
        setTimeout(() => alert(notice), 0);
      }
    },
    []
  );

  const applyMpSnapshotRef = useRef(null);
  const unsubmitMpConfirmRef = useRef(null);
  const flushDiploQueueRef = useRef(null);

  const resolveDiploFlushWaiters = useCallback(() => {
    if (diploQueueRef.current.length || diploPumpingRef.current) return;
    const waiters = diploFlushWaitersRef.current.splice(0);
    waiters.forEach((fn) => fn());
  }, []);

  const flushDiploQueue = useCallback(() => {
    return new Promise((resolve) => {
      if (!diploQueueRef.current.length && !diploPumpingRef.current) {
        resolve();
        return;
      }
      diploFlushWaitersRef.current.push(resolve);
    });
  }, []);
  flushDiploQueueRef.current = flushDiploQueue;

  const pumpDiploQueue = useCallback(async () => {
    if (diploPumpingRef.current) return;
    diploPumpingRef.current = true;
    try {
      while (diploQueueRef.current.length) {
        const item = diploQueueRef.current.shift();
        const s = mpSessionRef.current;
        if (!s?.code || !s?.token) {
          diploQueueRef.current = [];
          break;
        }
        try {
          /* Withdraw Deliver on the server before diplo when the player was
           waiting — shrinks the window where a peer can resolve against the
           stale submission. applyDiplo also withdraws atomically as backup. */
          if (pendingUnsubmitRef.current) {
            await pendingUnsubmitRef.current;
          } else if (needsUnsubmitBeforeDiploRef.current && unsubmitMpConfirmRef.current) {
            await unsubmitMpConfirmRef.current({ silent: true });
            needsUnsubmitBeforeDiploRef.current = false;
          }
          const data = await applyMpDiplo(s.code, {
            token: s.token,
            action: item.action,
            partnerId: item.partnerId,
            demandId: item.demandId,
          });
          lastMpVersion.current = data.room.version;
          setMpRoom(data.room);
          setWaiting(!!data.room.you?.submitted);
          if (data.patch) applyMpDiploPatch(data.patch);
          bump();
          render();
        } catch (err) {
          /* Race / already-at-desired-state: keep optimistic UI, drop the rest of
           the queue for this failure path only after a hard reject. */
          const msg = String(err?.message || "");
          const conflict = /Room changed|try again/i.test(msg);
          if (conflict) {
            try {
              const data = await getMpRoom(s.code, s.token);
              lastMpVersion.current = data.room.version;
              setMpRoom(data.room);
              setWaiting(!!data.room.you?.submitted);
              if (data.room.snapshot && applyMpSnapshotRef.current) {
                applyMpSnapshotRef.current(data.room.snapshot, s, {
                  brief: false,
                  you: data.room.you,
                });
              }
              bump();
              render();
            } catch (refreshErr) {
              console.error(refreshErr);
            }
            diploQueueRef.current = [];
            needsUnsubmitBeforeDiploRef.current = false;
            break;
          }
          const soft =
            /already posted|already pending|No envoy|not posted/i.test(msg);
          if (soft) {
            bump();
            render();
            continue;
          }
          restoreMpDiploUi(item.snap);
          if (item.snap?.waiting) setWaiting(true);
          else setWaiting(false);
          diploQueueRef.current = [];
          needsUnsubmitBeforeDiploRef.current = false;
          bump();
          render();
          console.error(err);
          break;
        }
      }
    } finally {
      diploPumpingRef.current = false;
      resolveDiploFlushWaiters();
    }
  }, [bump, resolveDiploFlushWaiters]);

  const attachMpEventHandler = useCallback((mp) => {
    if (!mp) return mp;
    mp.onEventChoice = async (payload) => {
      const s = mpSessionRef.current || mp;
      if (!s?.code || !s?.token) return;
      try {
        const data = await chooseMpEvent(s.code, {
          token: s.token,
          ...payload,
        });
        lastMpVersion.current = data.room.version;
        setMpRoom(data.room);
        if (applyMpSnapshotRef.current) {
          applyMpSnapshotRef.current(data.room.snapshot, s, {
            brief: true,
            you: data.room.you,
          });
        }
        bump();
      } catch (err) {
        console.error(err);
        alert(err.message || "Could not resolve event");
      }
    };
    mp.onAutoUnsubmit = () => {
      if (unsubmitMpConfirmRef.current) unsubmitMpConfirmRef.current({ silent: true });
    };
    mp.onDiploAction = (payload) => {
      const s = mpSessionRef.current || mp;
      if (!s?.code || !s?.token) return { ok: false, error: "Not in a room" };
      const G0 = getG();
      if (!G0) return { ok: false, error: "No game" };

      const snap = snapshotMpDiploUi(G0);
      const wasWaiting = !!G0.mp?.waiting;
      /* Kick server withdraw in this turn before optimistic paint / queue work. */
      if (wasWaiting && unsubmitMpConfirmRef.current && !pendingUnsubmitRef.current) {
        needsUnsubmitBeforeDiploRef.current = true;
        pendingUnsubmitRef.current = Promise.resolve(
          unsubmitMpConfirmRef.current({ silent: true })
        ).finally(() => {
          pendingUnsubmitRef.current = null;
          needsUnsubmitBeforeDiploRef.current = false;
        });
      }
      const local = applyLocalMpDiploAction(payload.action, payload);
      if (!local.ok) return { ok: false, error: local.error || "Action failed" };
      if (wasWaiting && G0.mp) {
        G0.mp.waiting = false;
        clearMpLockedSubmission(G0);
        setWaiting(false);
      }
      bump();
      render();

      /* Coalesce superseded assign/recall/ultimatum for the same partner. */
      const act = payload.action;
      const pid = payload.partnerId;
      diploQueueRef.current = diploQueueRef.current.filter((q) => {
        if (q.partnerId !== pid) return true;
        if (
          (act === "assignEnvoy" || act === "recallEnvoy") &&
          (q.action === "assignEnvoy" || q.action === "recallEnvoy")
        ) {
          return false;
        }
        if (act === "issueUltimatum" && q.action === "issueUltimatum") return false;
        return true;
      });
      diploQueueRef.current.push({
        action: payload.action,
        partnerId: payload.partnerId,
        demandId: payload.demandId,
        snap,
      });
      pumpDiploQueue();
      return { ok: true, pending: true };
    };
    return mp;
  }, [bump, pumpDiploQueue]);

  const applyMpSnapshot = useCallback(
    (snapshot, sess, { brief, you } = {}) => {
      const role = you?.role || sess.role;
      const seatId = you?.seatId || null;
      const name = you?.name || sess.name;
      const mp = attachMpEventHandler({ ...sess, role, name });
      hydrateGameSnapshot(snapshot, {
        homeRole: role,
        seatId: seatId || undefined,
        homeIso: sess.homeIso || homeIsoForRealm(realmByRole(role)),
        country: name,
        mp,
      });
      /* Keep React seat identity aligned with the server — stops a stale
       sess.role remounting the host country on the next poll. */
      if (role && role !== sess.role) {
        const next = { ...sess, role, name };
        setMpSession(next);
        mpSessionRef.current = next;
        saveMpSession(next);
      }
      setHomeRole(role || "home");
      const G = getG();
      if (G) {
        G.coachDone = true;
        G.mp = attachMpEventHandler({ ...(G.mp || {}), ...mp });
      }
      if (brief && G) {
        const sid = seatId || you?.seatId || playerCountryId(G.homeRole);
        const pending =
          sid && G.politics && G.politics[sid] && G.politics[sid].pendingEvent;
        const pendingKey = pending ? JSON.stringify(pending) : null;
        if (G.q !== lastMorningNoteQ.current) {
          /* New quarter: flash once, then summit/event or morning note. */
          lastMorningNoteQ.current = G.q;
          lastBriefQ.current = G.q;
          lastPresentedPendingKey.current = pendingKey;
          if (!pending) lastBriefingCompleteQ.current = G.q;
          showMpBriefing();
        } else if (pending) {
          /* Same quarter, another queued event — skip duplicates from SSE+submit. */
          if (pendingKey === lastPresentedPendingKey.current) return;
          lastPresentedPendingKey.current = pendingKey;
          showMpBriefing({ skipAnnounce: true });
        } else if (lastBriefingCompleteQ.current !== G.q) {
          /* Same quarter after the last event choice — morning note, no flash. */
          lastBriefingCompleteQ.current = G.q;
          showMpBriefing({ skipAnnounce: true });
        }
      }
    },
    [attachMpEventHandler]
  );
  applyMpSnapshotRef.current = applyMpSnapshot;

  useEffect(() => {
    mpSessionRef.current = mpSession;
  }, [mpSession]);

  /* Keep engine Deliver label in sync with lockstep waiting state. */
  useEffect(() => {
    const G = getG();
    if (!G || !G.mp) return;
    G.mp.waiting = waiting;
    G.mp.submittedCount = mpRoom ? mpRoom.submittedCount : 0;
    G.mp.humanCount = mpRoom ? mpRoom.humanCount : 0;
    const db = document.getElementById("deliverBtn");
    if (db && waiting) {
      db.disabled = false;
      db.textContent =
        mpRoom != null
          ? "Waiting " + mpRoom.submittedCount + "/" + mpRoom.humanCount
          : "Waiting on others";
      db.title = "Edit anything to withdraw, or click here";
    } else if (db && !waiting && G.mp) {
      db.removeAttribute("title");
    }
    /* Refresh Deliver / Diplomacy chrome when waiting flips. */
    render();
  }, [waiting, mpRoom]);

  /* Mobile drawer: pin between the live topbar and dock so a wrapped stats
   row never covers the panel title. */
  useEffect(() => {
    if (phase !== "play") return undefined;
    const root = document.documentElement;
    const gap = 10;
    const sync = () => {
      const topbar = document.getElementById("topbar");
      const dock = document.getElementById("dock");
      const mpHud = document.querySelector(".mp-hud");
      let top = gap;
      if (topbar) {
        top = Math.ceil(topbar.getBoundingClientRect().bottom) + gap;
      }
      if (mpHud) {
        const r = mpHud.getBoundingClientRect();
        if (r.height > 0) top = Math.max(top, Math.ceil(r.bottom) + gap);
      }
      let bottom = 128;
      if (dock) {
        bottom =
          Math.ceil(window.innerHeight - dock.getBoundingClientRect().top) +
          gap;
      }
      root.style.setProperty("--drawer-top", `${top}px`);
      root.style.setProperty("--drawer-bottom", `${bottom}px`);
    };
    sync();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    const topbar = document.getElementById("topbar");
    const dock = document.getElementById("dock");
    const stats = document.getElementById("tbStats");
    if (ro) {
      if (topbar) ro.observe(topbar);
      if (dock) ro.observe(dock);
      if (stats) ro.observe(stats);
    }
    const mo =
      typeof MutationObserver === "function" && stats
        ? new MutationObserver(sync)
        : null;
    if (mo && stats) mo.observe(stats, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    const raf = window.requestAnimationFrame(() => {
      sync();
      window.requestAnimationFrame(sync);
    });
    return () => {
      window.removeEventListener("resize", sync);
      window.cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      root.style.removeProperty("--drawer-top");
      root.style.removeProperty("--drawer-bottom");
    };
  }, [phase, mpRoom]);

  const beginGame = useCallback((opts) => {
    pendingStart.current = opts;
    setRealmId(opts.realmId || DEFAULT_REALM_ID);
    setHomeIso(opts.homeIso);
    setHomeScale(opts.homeScale);
    setHomeRole(opts.homeRole || "home");
    setSelectedRole(null);
    setPhase("play");
  }, []);

  const enterMpPlay = useCallback(
    (opts) => {
      const role = opts.role || opts.room?.you?.role;
      const name = opts.name || opts.room?.you?.name;
      const mp = {
        code: opts.code,
        token: opts.token,
        role,
        name,
        homeIso: opts.homeIso,
        seatId: opts.room?.you?.seatId,
      };
      setMpSession(mp);
      mpSessionRef.current = mp;
      saveMpSession(mp);
      lastMpVersion.current = opts.room?.version || 0;
      setMpRoom(opts.room || null);
      setWaiting(!!opts.room?.you?.submitted);
      if (opts.room) {
        mp.waiting = !!opts.room.you?.submitted;
        mp.submittedCount = opts.room.submittedCount;
        mp.humanCount = opts.room.humanCount;
      }
      beginGame({
        country: name,
        homeRole: role,
        homeIso: opts.homeIso,
        realmId: realmByRole(role).id,
        silent: true,
        mp,
        hydrate: opts.hydrate || null,
        seatId: opts.room?.you?.seatId,
      });
    },
    [beginGame]
  );

  const handleHostStart = useCallback(async ({ code, token, role, name, homeIso: iso, room }) => {
    const mp = { code, token, role, name, homeIso: iso };
    const lobbySnap = {
      code,
      token,
      room: room || null,
    };
    setMpSession(mp);
    mpSessionRef.current = mp;
    saveMpSession(mp);
    setWaiting(false);
    setMpRoom(null);

    const gate = new Promise((resolve, reject) => {
      hostStartGateRef.current = { resolve, reject };
    });

    pendingStart.current = {
      country: name,
      homeRole: role,
      homeIso: iso,
      realmId: realmByRole(role).id,
      silent: true,
      mp,
      afterNewGame: async () => {
        try {
          const snap = exportGameSnapshot(getG());
          const data = await startMpRoom(code, { token, snapshot: snap });
          lastMpVersion.current = data.room.version;
          setMpRoom(data.room);
          const wired = attachMpEventHandler({
            ...mp,
            seatId: data.room.you?.seatId,
          });
          hydrateGameSnapshot(data.room.snapshot, {
            homeRole: role,
            seatId: data.room.you?.seatId,
            homeIso: iso,
            country: name,
            mp: wired,
          });
          const G = getG();
          G.mp = wired;
          G.coachDone = true;
          render();
          hostStartGateRef.current?.resolve();
          hostStartGateRef.current = null;
        } catch (err) {
          hostStartGateRef.current?.reject(err);
          hostStartGateRef.current = null;
          throw err;
        }
      },
    };
    setRealmId(realmByRole(role).id);
    setHomeIso(iso);
    setHomeRole(role);
    setSelectedRole(null);
    setPhase("play");

    try {
      await gate;
    } catch (err) {
      /* Start failed after leaving the lobby — put them back with the room intact. */
      clearMpSession();
      setMpSession(null);
      mpSessionRef.current = null;
      setMpRoom(null);
      setWaiting(false);
      setLobbyBootstrap(lobbySnap);
      setPhase("lobby");
      throw err;
    }
  }, [attachMpEventHandler]);

  const handleResume = useCallback(async () => {
    const saved = loadMpSession();
    if (!saved) return;
    try {
      const data = await getMpRoom(saved.code, saved.token);
      if (!data.room || data.room.status !== "playing" || !data.room.snapshot) {
        clearMpSession();
        alert(
          "That multiplayer room is no longer available (it may have ended or the server restarted)."
        );
        return;
      }
      enterMpPlay({
        code: saved.code,
        token: saved.token,
        role: saved.role || data.room.you?.role,
        name: saved.name || data.room.you?.name,
        homeIso: saved.homeIso,
        room: data.room,
        hydrate: data.room.snapshot,
      });
    } catch (err) {
      clearMpSession();
      alert(
        err.status === 404
          ? "That multiplayer room was lost (host left, or the server recycled without shared KV storage)."
          : err.message || "Could not resume multiplayer game"
      );
    }
  }, [enterMpPlay]);

  const handleGuestReady = useCallback(
    (opts) => {
      enterMpPlay({
        ...opts,
        hydrate: opts.room.snapshot,
      });
    },
    [enterMpPlay]
  );

  const submitMpConfirm = useCallback(async () => {
    const sess = mpSessionRef.current;
    const G = getG();
    if (!sess || !G) return;
    try {
      /* Flush optimistic diplo so Deliver never races ahead of the server. */
      if (flushDiploQueueRef.current) await flushDiploQueueRef.current();
      const data = await submitMpBill(sess.code, {
        token: sess.token,
        draft: clone(G.draft),
        rateManual: !!G.rateManual,
        manualRate: G.manualRate,
        sandbox: !!G.sandbox,
        envoys: clone(G.envoys || [null, null]),
        ultimatums: clone(G.ultimatums || {}),
      });
      setMpRoom(data.room);
      lastMpVersion.current = data.room.version;
      if (data.resolved && data.room.snapshot) {
        if (G.mp) G.mp.waiting = false;
        clearMpLockedSubmission(G);
        applyMpSnapshot(data.room.snapshot, sess, {
          brief: true,
          you: data.room.you,
        });
        setWaiting(false);
      } else {
        if (G.mp) G.mp.waiting = true;
        lockMpSubmission(G);
        setWaiting(true);
      }
      bump();
    } catch (err) {
      console.error(err);
      if (err.status === 404) {
        exitMpToSetup(
          "This multiplayer room was lost (host left, or the server instance recycled without shared KV storage)."
        );
        return;
      }
      alert(err.message || "Submit failed");
    }
  }, [bump, applyMpSnapshot, exitMpToSetup]);

  const unsubmitMpConfirm = useCallback(async (opts = {}) => {
    const sess = mpSessionRef.current;
    if (!sess) return false;
    if (unsubmitInFlight.current) return false;
    unsubmitInFlight.current = true;
    try {
      const data = await unsubmitMpBill(sess.code, { token: sess.token });
      setMpRoom(data.room);
      lastMpVersion.current = data.room.version;
      const stillWaiting = !!data.room.you?.submitted;
      const G = getG();
      if (G?.mp) {
        G.mp.waiting = stillWaiting;
        if (!stillWaiting) clearMpLockedSubmission(G);
      }
      setWaiting(stillWaiting);
      bump();
      render();
      return true;
    } catch (err) {
      console.error(err);
      if (err.status === 404) {
        exitMpToSetup(
          "This multiplayer room was lost (host left, or the server instance recycled without shared KV storage)."
        );
        return false;
      }
      if (!opts.silent) alert(err.message || "Could not withdraw");
      return false;
    } finally {
      unsubmitInFlight.current = false;
    }
  }, [bump, exitMpToSetup]);
  unsubmitMpConfirmRef.current = unsubmitMpConfirm;

  useEffect(() => {
    setOnState(() => {
      bump();
      wireRename();
    });
    setOnTabChange((t) => {
      if (t) setSelectedRole(null);
    });
    setOnSetup(() => {
      const scrim = document.getElementById("scrim");
      if (scrim) scrim.hidden = true;
      setTab(null);
      setSelectedRole(null);
      setSetupRole(realmById(realmId).role);
      const sess = mpSessionRef.current;
      if (sess) {
        leaveMpRoom(sess.code, { token: sess.token }).catch(() => {});
      }
      setMpSession(null);
      mpSessionRef.current = null;
      setMpRoom(null);
      setWaiting(false);
      clearMpSession();
      setPhase("setup");
    });

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (phase === "setup" || phase === "lobby") return;
      const scrim = document.getElementById("scrim");
      if (scrim && !scrim.hidden) {
        scrim.hidden = true;
        return;
      }
      if (dismissNewestPress()) return;
      if (getTab()) {
        setTab(null);
        return;
      }
      setSelectedRole(null);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      setOnState(null);
      setOnTabChange(null);
      setOnSetup(null);
      SHELL_IDS.forEach((id) => registerEl(id, null));
    };
  }, [bump, phase, realmId]);

  useEffect(() => {
    if (phase !== "play") return;
    SHELL_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) registerEl(id, el);
    });
    const dwc = document.getElementById("dwClose");
    if (dwc) dwc.onclick = () => setTab(null);
    const deliverBtn = document.getElementById("deliverBtn");
    if (deliverBtn) {
      deliverBtn.onclick = () => {
        if (mpSessionRef.current) {
          if (waiting) {
            unsubmitMpConfirm();
            return;
          }
          projectionModal(() => {
            submitMpConfirm();
          });
        } else {
          projectionModal();
        }
      };
    }
    const billBtn = document.getElementById("billBtn");
    if (billBtn) {
      billBtn.onclick = () => setTab(getTab() === "bill" ? null : "bill");
    }
    if (pendingStart.current) {
      const opts = pendingStart.current;
      pendingStart.current = null;
      if (opts.hydrate) {
        const mp = attachMpEventHandler(opts.mp || null);
        hydrateGameSnapshot(opts.hydrate, {
          homeRole: opts.homeRole,
          seatId: opts.seatId || opts.mp?.seatId,
          homeIso: opts.homeIso,
          country: opts.country,
          mp,
        });
        const G = getG();
        if (G) {
          G.coachDone = true;
          if (mp) G.mp = mp;
        }
      } else {
        newGame(opts);
        if (typeof opts.afterNewGame === "function") {
          Promise.resolve(opts.afterNewGame()).catch((err) => {
            console.error(err);
            /* Host start restores the lobby and surfaces the error there. */
            if (!opts.mp) {
              alert(err.message || "Could not start multiplayer");
            }
          });
        }
      }
    } else {
      render();
    }
    wireRename();
    bump();
  }, [phase, bump, waiting, submitMpConfirm, unsubmitMpConfirm, attachMpEventHandler]);

  useEffect(() => {
    if (phase !== "play" || !mpSession) return undefined;
    /* Gate on playing status only — do not resubscribe when mpRoom identity
     changes on every poll/version bump (that tore down EventSource). */
    if (!mpRoom || mpRoom.status !== "playing") return undefined;

    const handleRoomBump = async (hint) => {
      try {
        const data = await getMpRoom(mpSession.code, mpSession.token);
        setMpRoom((prev) => {
          if (
            prev &&
            prev.version === data.room.version &&
            prev.submittedCount === data.room.submittedCount &&
            !!prev.you?.submitted === !!data.room.you?.submitted
          ) {
            return prev;
          }
          return data.room;
        });
        setWaiting(!!data.room.you?.submitted);
        if (
          data.room.version !== lastMpVersion.current &&
          data.room.snapshot
        ) {
          const prevQ = getG()?.q;
          lastMpVersion.current = data.room.version;
          const advanced =
            data.room.snapshot.q != null && data.room.snapshot.q !== prevQ;
          /* Only remount when the quarter advances — peer submits / live diplo
           bump version but must not wipe an in-progress draft. */
          if (advanced) {
            applyMpSnapshot(data.room.snapshot, mpSession, {
              brief: true,
              you: data.room.you,
            });
          } else if (
            hint &&
            hint.q != null &&
            data.room.snapshot.q === prevQ
          ) {
            /* Peer live diplo: refresh waiting chrome only. */
            bump();
            renderChrome();
          } else {
            bump();
          }
          setWaiting(!!data.room.you?.submitted);
        }
      } catch (err) {
        if (err && err.status === 404) {
          exitMpToSetup(
            "This multiplayer room was lost (host left, or the server instance recycled without shared KV storage)."
          );
        }
      }
    };

    let closeStream = openMpRoomStream(
      mpSession.code,
      mpSession.token,
      (ev) => {
        if (!ev || ev.version == null) return;
        if (ev.version === lastMpVersion.current) return;
        handleRoomBump(ev);
      }
    );

    /* Slow poll as SSE fallback. */
    const id = setInterval(() => handleRoomBump(), 10000);
    return () => {
      clearInterval(id);
      if (closeStream) closeStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mpRoom.status only
  }, [phase, mpSession, mpRoom?.status, bump, applyMpSnapshot, exitMpToSetup]);

  /* React re-renders can clear engine-written HUD nodes (#tbStats etc).
   Repaint chrome only — full render() calls bump() and would loop with tick. */
  useEffect(() => {
    if (phase !== "play") return;
    if (!getG()) return;
    try {
      renderChrome();
    } catch (err) {
      console.error(err);
    }
  }, [tick, phase, waiting, mpRoom]);

  useEffect(() => {
    if (phase !== "play" || !worldOk) return;
    paintMetricBar(metricsRef.current, BOARD_METRICS, mapMetric, (id) => {
      setMapMetric(id);
    });
    paintMapLabel(getG(), mapMetric, selectedRole);
  }, [phase, mapMetric, selectedRole, tick, worldOk]);

  const onSelect = useCallback(
    (role) => {
      if (phase === "setup" || phase === "lobby") {
        if (role) setSetupRole(role);
        return;
      }
      if (role) setTab(null);
      setSelectedRole(role);
    },
    [phase]
  );

  const openPartnerPanel = useCallback((panel, role) => {
    setTab(panel, role);
  }, []);

  const onOpenTrade = useCallback(
    (role) => openPartnerPanel("trade", role),
    [openPartnerPanel]
  );

  const onOpenDiplomacy = useCallback(
    (role) => openPartnerPanel("diplomacy", role),
    [openPartnerPanel]
  );

  const onWorldFail = useCallback(() => setWorldOk(false), []);

  const setupRealm = realmByRole(setupRole);
  const setupLabel = setupRealm.name;
  const inSetup = phase === "setup" || phase === "lobby";

  return (
    <div
      className={
        (worldOk ? "world-map-active" : "") + (inSetup ? " setup-active" : "")
      }
    >
      {worldOk ? (
        <WorldMap
          tick={tick}
          mapMetric={mapMetric}
          selectedRole={inSetup ? setupRole : selectedRole}
          onSelect={onSelect}
          onFail={onWorldFail}
          homeIso={homeIso}
          homeScale={homeScale}
          homeRole={homeRole}
          setupMode={inSetup}
          setupLabel={inSetup ? setupLabel : null}
        />
      ) : (
        phase === "play" && (
          <div id="mapLayer" className="flat-fallback">
            <div
              className="globe-fallback"
              dangerouslySetInnerHTML={{
                __html:
                  "<p>The world map could not be loaded. Trade partners remain in the Trade drawer; everything else is unaffected.</p>",
              }}
            />
          </div>
        )
      )}

      {phase === "setup" && (
        <CountryPicker
          selectedRole={setupRole}
          initialId={realmId}
          onStart={beginGame}
          onMultiplayer={() => setPhase("lobby")}
          onResume={loadMpSession() ? handleResume : null}
        />
      )}

      {phase === "lobby" && (
        <MultiplayerLobby
          selectedRole={setupRole}
          initialSession={lobbyBootstrap}
          onConsumedInitial={() => setLobbyBootstrap(null)}
          onBack={() => {
            setLobbyBootstrap(null);
            setPhase("setup");
          }}
          onHostStart={handleHostStart}
          onGuestReady={handleGuestReady}
        />
      )}

      {phase === "play" && (
        <>
          <div id="vignette" />
          <div id="quarterFlash" hidden aria-live="polite">
            <div className="quarter-flash-inner">
              <span className="quarter-flash-kicker">New quarter</span>
              <span className="quarter-flash-label" />
            </div>
          </div>

          {mpRoom && (
            <div className="mp-hud hud-frame hud-surface" aria-live="polite">
              <span className="mp-hud-code">Room {mpRoom.code}</span>
              <span className="mp-hud-q">Q{mpRoom.q}</span>
              <span className="mp-hud-status">
                {waiting
                  ? `Waiting ${mpRoom.submittedCount}/${mpRoom.humanCount} · edit to withdraw`
                  : `${mpRoom.submittedCount}/${mpRoom.humanCount} delivered`}
              </span>
            </div>
          )}

          {worldOk && selectedRole && (
            <RealmStats
              role={selectedRole}
              onClose={() => setSelectedRole(null)}
              onOpenTrade={
                selectedRole !== "home" ? onOpenTrade : undefined
              }
              onOpenDiplomacy={
                selectedRole !== "home" ? onOpenDiplomacy : undefined
              }
            />
          )}

          {worldOk && (
            <div className="map-chrome">
              <div id="mapLabel" />
              <div id="mapMetrics" ref={metricsRef} />
            </div>
          )}

          <div id="pressLayer" aria-live="polite" />

          <header id="topbar" className="hud-frame">
            <div className="tb-id">
              <span className="tb-crest">&#9878;</span>
              <span className="tb-name">
                <button id="nameBtn" type="button">
                  United Kingdom
                </button>
                <small id="tbTerm">First term</small>
              </span>
              <div id="tbMode" className="tb-mode" aria-label="Game mode" />
            </div>
            <div className="tb-stats" id="tbStats" />
          </header>

          <div
            id="diploHud"
            className="diplo-hud hud-frame hud-surface"
            hidden
            role="button"
            tabIndex={0}
            aria-label="Active diplomacy"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
          />

          <div
            id="drawer"
            className="hud-frame"
            hidden
            role="dialog"
            aria-label="Policy panel"
          >
            <div className="dw-head">
              <h2 id="dwTitle" />
              <span className="sub" id="dwSub" />
              <button id="dwClose" aria-label="Close panel">
                &#10005;
              </button>
            </div>
            <div className="dw-body" id="drawerBody" />
          </div>

          <nav id="dock" aria-label="Government">
            <div className="dock-tabs" id="dockTabs" />
            <div className="dock-act">
              <button className="dock-bill" id="billBtn" aria-expanded="false">
                <span id="billLabel">Programme</span>
                <b id="billCost">empty</b>
              </button>
              <button className="dock-go" id="deliverBtn">
                {waiting
                  ? mpRoom
                    ? `Waiting ${mpRoom.submittedCount}/${mpRoom.humanCount}`
                    : "Waiting on others"
                  : "Next quarter"}
              </button>
            </div>
          </nav>

          <div className="scrim" id="scrim" hidden>
            <div
              className="despatch hud-frame"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dpTitle"
            >
              <header>
                <div className="stamp" id="dpStamp" />
                <h3 id="dpTitle" />
              </header>
              <div className="body" id="dpBody" />
              <div className="opts" id="dpOpts" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
