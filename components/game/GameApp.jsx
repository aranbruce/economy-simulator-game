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
  projectionModal,
  dismissNewestPress,
  PARTNERS,
} from "../../lib/sim/engine.js";
import {
  BOARD_METRICS,
  boardMetricCaption,
  boardMetricBlocName,
} from "../../lib/sim/boardMetrics.js";
import { DEFAULT_REALM_ID, realmById, realmByRole } from "../../lib/sim/realms.js";
import WorldMap from "../map2d/WorldMap";
import RealmStats from "../ui/RealmStats";
import CountryPicker from "./CountryPicker";

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
  const [phase, setPhase] = useState("setup"); // setup | play
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
  const metricsRef = useRef(null);
  const pendingStart = useRef(null);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const beginGame = useCallback((opts) => {
    pendingStart.current = opts;
    setRealmId(opts.realmId || DEFAULT_REALM_ID);
    setHomeIso(opts.homeIso);
    setHomeScale(opts.homeScale);
    setHomeRole(opts.homeRole || "home");
    setSelectedRole(null);
    setPhase("play");
  }, []);

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
      setPhase("setup");
    });

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (phase === "setup") return;
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

  /* Mount shell DOM, then start (or re-render) once the nodes exist. */
  useEffect(() => {
    if (phase !== "play") return;
    SHELL_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) registerEl(id, el);
    });
    const dwc = document.getElementById("dwClose");
    if (dwc) dwc.onclick = () => setTab(null);
    const deliverBtn = document.getElementById("deliverBtn");
    if (deliverBtn) deliverBtn.onclick = () => projectionModal();
    const billBtn = document.getElementById("billBtn");
    if (billBtn) {
      billBtn.onclick = () => setTab(getTab() === "bill" ? null : "bill");
    }
    if (pendingStart.current) {
      const opts = pendingStart.current;
      pendingStart.current = null;
      newGame(opts);
    } else {
      render();
    }
    wireRename();
    bump();
  }, [phase, bump]);

  useEffect(() => {
    if (phase !== "play" || !worldOk) return;
    paintMetricBar(metricsRef.current, BOARD_METRICS, mapMetric, (id) => {
      setMapMetric(id);
    });
    paintMapLabel(getG(), mapMetric, selectedRole);
  }, [phase, mapMetric, selectedRole, tick, worldOk]);

  const onSelect = useCallback(
    (role) => {
      if (phase === "setup") {
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

  return (
    <div
      className={
        (worldOk ? "world-map-active" : "") +
        (phase === "setup" ? " setup-active" : "")
      }
    >
      {worldOk ? (
        <WorldMap
          tick={tick}
          mapMetric={mapMetric}
          selectedRole={phase === "setup" ? setupRole : selectedRole}
          onSelect={onSelect}
          onFail={onWorldFail}
          homeIso={homeIso}
          homeScale={homeScale}
          homeRole={homeRole}
          setupMode={phase === "setup"}
          setupLabel={phase === "setup" ? setupLabel : null}
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
        />
      )}

      {phase === "play" && (
        <>
          <div id="vignette" />

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
                Next quarter
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
