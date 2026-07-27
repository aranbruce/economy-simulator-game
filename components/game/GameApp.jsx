"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  newGame,
  getG,
  setOnState,
  setOnSetup,
  setTab,
  getTab,
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
} from "../../lib/sim/engine.js";
import {
  BOARD_METRICS,
  boardMetricCaption,
  boardMetricBlocName,
} from "../../lib/sim/boardMetrics.js";
import { DEFAULT_REALM_ID, realmById, realmByRole, homeIsoForRealm } from "../../lib/sim/realms.js";
import {
  getMpRoom,
  startMpRoom,
  submitMpBill,
  unsubmitMpBill,
  leaveMpRoom,
  chooseMpEvent,
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
      G.country = v || "The Kingdom";
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
    const blocNote =
      mapMetric === "blocs"
        ? " · " + boardMetricBlocName("home", G)
        : "";
    label.innerHTML =
      "<b>" +
      G.country +
      "</b><span>" +
      note +
      blocNote +
      "</span>";
    return;
  }
  if (selectedRole) {
    const p = PARTNERS.find((x) => x.id === selectedRole);
    const blocNote =
      mapMetric === "blocs"
        ? " · " + boardMetricBlocName(selectedRole, G)
        : "";
    label.innerHTML =
      "<b>" +
      (p ? p.name : selectedRole) +
      "</b><span>Relations " +
      Math.round(G.rel[selectedRole] ?? 50) +
      blocNote +
      " · economy card open</span>";
    return;
  }
  const caption = boardMetricCaption(mapMetric, G);
  label.innerHTML =
    "<b>" +
    (G.country || "The Kingdom") +
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
  const metricsRef = useRef(null);
  const pendingStart = useRef(null);
  const mpSessionRef = useRef(null);
  const lastMpVersion = useRef(0);
  const lastBriefQ = useRef(-1);

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
    return mp;
  }, [bump]);

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
        if (G.q !== lastBriefQ.current) lastBriefQ.current = G.q;
        showMpBriefing();
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
      db.title = "Click to withdraw and edit your bill";
    } else if (db && !waiting && G.mp) {
      db.removeAttribute("title");
      render();
    }
  }, [waiting, mpRoom]);

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

  const handleHostStart = useCallback(async ({ code, token, role, name, homeIso: iso }) => {
    const mp = { code, token, role, name, homeIso: iso };
    setMpSession(mp);
    mpSessionRef.current = mp;
    saveMpSession(mp);
    setWaiting(false);
    pendingStart.current = {
      country: name,
      homeRole: role,
      homeIso: iso,
      realmId: realmByRole(role).id,
      silent: true,
      mp,
      afterNewGame: async () => {
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
      },
    };
    setRealmId(realmByRole(role).id);
    setHomeIso(iso);
    setHomeRole(role);
    setSelectedRole(null);
    setPhase("play");
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
          ? "That multiplayer room has ended (the host left or the server restarted)."
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
      const data = await submitMpBill(sess.code, {
        token: sess.token,
        draft: clone(G.draft),
        rateManual: !!G.rateManual,
        manualRate: G.manualRate,
        sandbox: !!G.sandbox,
      });
      setMpRoom(data.room);
      lastMpVersion.current = data.room.version;
      if (data.resolved && data.room.snapshot) {
        applyMpSnapshot(data.room.snapshot, sess, {
          brief: true,
          you: data.room.you,
        });
        setWaiting(false);
      } else {
        setWaiting(true);
      }
      bump();
    } catch (err) {
      console.error(err);
      if (err.status === 404) {
        exitMpToSetup(
          "This multiplayer room has ended (the host left or the server restarted)."
        );
        return;
      }
      alert(err.message || "Submit failed");
    }
  }, [bump, applyMpSnapshot, exitMpToSetup]);

  const unsubmitMpConfirm = useCallback(async () => {
    const sess = mpSessionRef.current;
    if (!sess) return;
    try {
      const data = await unsubmitMpBill(sess.code, { token: sess.token });
      setMpRoom(data.room);
      lastMpVersion.current = data.room.version;
      setWaiting(!!data.room.you?.submitted);
      bump();
      render();
    } catch (err) {
      console.error(err);
      if (err.status === 404) {
        exitMpToSetup(
          "This multiplayer room has ended (the host left or the server restarted)."
        );
        return;
      }
      alert(err.message || "Could not withdraw");
    }
  }, [bump, exitMpToSetup]);

  useEffect(() => {
    setOnState(() => {
      bump();
      wireRename();
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
            alert(err.message || "Could not start multiplayer");
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
    const tickPoll = async () => {
      try {
        const data = await getMpRoom(mpSession.code, mpSession.token);
        setMpRoom(data.room);
        setWaiting(!!data.room.you?.submitted);
        if (
          data.room.version !== lastMpVersion.current &&
          data.room.snapshot
        ) {
          const prevQ = getG()?.q;
          lastMpVersion.current = data.room.version;
          const advanced =
            data.room.snapshot.q != null && data.room.snapshot.q !== prevQ;
          /* Only remount when the quarter advances — peer submits bump version
           but must not wipe an in-progress draft. */
          if (advanced) {
            applyMpSnapshot(data.room.snapshot, mpSession, {
              brief: true,
              you: data.room.you,
            });
          }
          setWaiting(!!data.room.you?.submitted);
          bump();
        }
      } catch (err) {
        if (err && err.status === 404) {
          exitMpToSetup(
            "This multiplayer room has ended (the host left or the server restarted)."
          );
        }
      }
    };
    const id = setInterval(tickPoll, 2000);
    return () => clearInterval(id);
  }, [phase, mpSession, bump, applyMpSnapshot, exitMpToSetup]);

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
      setSelectedRole(role);
    },
    [phase]
  );

  const onOpenTrade = useCallback((role) => {
    setSelectedRole(role);
    setTab("trade");
  }, []);

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
          onBack={() => setPhase("setup")}
          onHostStart={handleHostStart}
          onGuestReady={handleGuestReady}
        />
      )}

      {phase === "play" && (
        <>
          <div id="vignette" />

          {mpRoom && (
            <div className="mp-hud hud-frame hud-surface" aria-live="polite">
              <span className="mp-hud-code">Room {mpRoom.code}</span>
              <span className="mp-hud-q">Q{mpRoom.q}</span>
              <span className="mp-hud-status">
                {waiting
                  ? `Waiting ${mpRoom.submittedCount}/${mpRoom.humanCount}`
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
                  The Kingdom
                </button>
                <small id="tbTerm">First term</small>
              </span>
              <div id="tbMode" className="tb-mode" aria-label="Game mode" />
            </div>
            <div className="tb-stats" id="tbStats" />
          </header>

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
                <span id="billLabel">Bill</span>
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
