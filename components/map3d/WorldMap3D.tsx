"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { feature } from "topojson-client";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFShadowMap,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  getG,
  PARTNERS,
  activePartners,
  diploMapMarkers,
  playerCountryId,
  realmGdpBn,
  fmtGdpBn,
  currencyForSeat,
} from "../../lib/sim/engine.ts";
import { COUNTRIES } from "../../lib/sim/countries.ts";
import { majorTradePairs, bilateralWeight } from "../../lib/sim/tradeMatrix.ts";
import {
  HOME_ISO,
  partnerForIso,
  realmRoleForIso,
} from "../../lib/sim/partners.ts";
import {
  boardMetricColour,
  boardMetricMapLabel,
  REALM_FILL,
} from "../../lib/sim/boardMetrics.ts";
import { realmByRole } from "../../lib/sim/realms.ts";
import {
  LAND_HEIGHT,
  BOARD_W,
  boardToWorld,
  landLift,
  project,
  worldToBoard,
  wrapDelta,
} from "../../lib/map/projection.ts";
import {
  geomToPolys,
  pointInPolys,
  polysCentroid,
  pullInland,
  type Polys,
} from "../../lib/map/geo.ts";
import { punchCanalHoles } from "../../lib/map/canals.ts";
import { MapCamera } from "./camera.ts";
import {
  buildTerrain,
  TERRAIN_REV,
  type CountryPaint,
  type Terrain,
} from "./terrain.ts";
import {
  buildRouteLayer,
  resampleLane,
  ROUTES_REV,
  type RouteLayer,
  type RouteSpec,
} from "./routes.ts";
import { createFleet, type Fleet, type FleetSpec } from "./fleet.ts";
import { createSea, SEA_SHADER_REV, SEA_Y, type Sea } from "./sea.ts";
import { createBoardGrid, BOARD_GRID_REV } from "./boardGrid.ts";
import { createSky, type Sky } from "./sky.ts";
import { createScenery, SCENERY_REV, type Scenery } from "./scenery.ts";
import {
  createDiploProps,
  DIPLO_PROPS_REV,
  type DiploKind,
  type DiploProps,
  type DiploPropSpec,
} from "./diploProps.ts";
import {
  buildOceanGrid,
  pathLength,
  planNetwork,
  type OceanGrid,
} from "../../lib/map/seaRoutes.ts";
import {
  createOverlay,
  DIPLO_MARKER_ORDER,
  diploLegendKind,
  type BadgeSpec,
  type LabelSpec,
  type MapOverlay,
} from "./overlay.ts";
import {
  createRealmLabels,
  REALM_LABELS_REV,
  type RealmLabels,
} from "./realmLabels.ts";
import {
  bucketRoute,
  periodForDistance,
  relationTint,
  routePhaseSeed,
} from "./boats.ts";
import { clearModelCache } from "./models.ts";
import { queryPointTraffic, type PairLane } from "./laneHover.ts";
import RouteHoverTip, { type HoverPairRow } from "./RouteHoverTip.tsx";
import { useCurrencyPref } from "../../lib/ui/useCurrencyPref.ts";

/** Darkness the fog fades the far board into — a parchment dusk, not
 *  a black void, so the plate reads as a document on a desk. */
const HORIZON = 0x3a3228;
/** Muted atlas inks for countries that are not a playable seat — hashed
 *  per ISO so neighbours don't melt into one tan, the way Suzerain's
 *  yellows and ochres sit apart. Kept duller than REALM_FILL. */
const SCENERY_FILLS = [
  "#A48B62",
  "#B49A70",
  "#8C7354",
  "#9A8868",
  "#B8A47C",
  "#8A7A58",
  "#A08058",
  "#94866A",
];
const HOVER_LIFT = 1.1;

function sceneryFill(iso: string): string {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h = Math.imul(h ^ iso.charCodeAt(i), 16777619);
  }
  return SCENERY_FILLS[(h >>> 0) % SCENERY_FILLS.length]!;
}

function seatLabel(id: string) {
  if (id === "kingdom" || id === "home") return "United Kingdom";
  return COUNTRIES.find((c) => c.id === id)?.name || id;
}

function isPlayerSeat(id: string, g: any) {
  const playerId = playerCountryId(g?.homeRole);
  return id === playerId || id === "home" || id === "kingdom";
}

/** Directed flow index → display currency, same scaling as TradePanel. */
function flowAmountLabel(fromId: string, index: number, g: any, ccy: string) {
  if (!(index > 0) || !g?.econ) return "—";
  const gdpBn = realmGdpBn(isPlayerSeat(fromId, g) ? "home" : fromId, g);
  const y = isPlayerSeat(fromId, g)
    ? g.econ.gdp != null
      ? g.econ.gdp
      : 100
    : (g.world?.[fromId]?.econ?.gdp ??
      g.econ.nations?.[fromId]?.y ??
      100);
  const bn = gdpBn * (index / Math.max(y, 1e-6));
  return fmtGdpBn(bn, ccy, g);
}

/** Bump when key/fill lights or the shadow recipe change so the WebGL
 *  scene remounts. */
const MAP_LIGHT_REV = 5;
/** Key-light offset from the focus. High enough to keep country walls
 *  from reading as cliffs, low enough that trees and peaks throw a
 *  drop you can actually see (the old 520-up lamp sat almost vertical). */
const SUN_OFF_X = -280;
const SUN_OFF_Y = 300;
const SUN_OFF_Z = -210;
/** Kenney tokens sit just off the capital star so they do not cover it. */
const DIPLO_OFFSET: Record<DiploKind, [number, number]> = {
  envoy: [1.45, 0.2],
  summit: [0.2, 1.5],
  protest: [-0.2, -1.5],
  sanctions: [1.35, 1.25],
  ultimatum: [-1.45, 0.2],
};

function visualDiploKind(kind: string): DiploKind | null {
  const visual = diploLegendKind(kind);
  if (
    visual === "envoy" ||
    visual === "summit" ||
    visual === "protest" ||
    visual === "sanctions" ||
    visual === "ultimatum"
  ) {
    return visual;
  }
  return null;
}

/** Antarctica — not on the board. */
const SKIP_ISO = new Set(["010"]);

/** Fog distances as multiples of the camera's own distance to the board, so
 *  the depth cue reads the same at every zoom instead of swallowing the
 *  whole frame when you pull back. */
const FOG_NEAR_K = 1.2;
const FOG_FAR_K = 3.8;

/** Screen-pixel drag before a press stops counting as a click. */
const CLICK_SLOP = 4;

interface CountryFeature {
  iso: string;
  polys: Polys;
}

function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith("rgb")) {
    const m = hex.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [26, 42, 68];
  }
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function liftColour(hex: string, k: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${
    Math.min(255, b * k) | 0
  })`;
}

function roleColour(
  role: string,
  mapMetric: string | null,
  selected: string | null,
) {
  const base = boardMetricColour(role, mapMetric || "countries");
  return selected === role ? liftColour(base, 1.12) : base;
}

function roleForFeature(
  iso: string,
  homeRole?: string | null,
  homeIso?: string | null,
) {
  return partnerForIso(iso, homeIso || HOME_ISO, homeRole || null);
}

function polysForRole(
  role: string,
  countries: CountryFeature[],
  hRole: string | null,
  hIso: string | null,
  setupMode: boolean,
): Polys | null {
  /* "home" means the UK in setup (the fixed reference territory on the
     picker) but the actual player's country once a game is running —
     realmByRole("home") only knows the former, so resolve via hIso here
     instead, or a same-role UK label/marker ends up drawn over whichever
     country the player is actually playing. */
  const rawIso = role === "home" && !setupMode ? hIso : realmByRole(role).iso;
  const anchorIso = rawIso ? String(rawIso).padStart(3, "0") : null;
  if (anchorIso) {
    const anchor = countries.find((c) => c.iso === anchorIso);
    if (anchor && anchor.polys.length) return anchor.polys;
  }
  const polys = countries
    .filter((c) => {
      if (setupMode) return realmRoleForIso(c.iso) === role;
      return roleForFeature(c.iso, hRole, hIso) === role;
    })
    .flatMap((c) => c.polys);
  return polys.length ? polys : null;
}

/** Real capital lat/lng, pulled onto the 110m landmass when the pin (or
 *  the city cluster around it) would otherwise sit in the sea. */
function capitalOnBoard(
  cap: { lat: number; lng: number },
  iso: string,
  countries: CountryFeature[],
): [number, number] {
  const [nx, ny] = project(cap.lng, cap.lat);
  const feat = countries.find((c) => c.iso === String(iso).padStart(3, "0"));
  return feat?.polys.length ? pullInland([nx, ny], feat.polys) : [nx, ny];
}

function capitalOfRole(role: string | null | undefined) {
  if (!role) return null;
  const iso = String(realmByRole(role).iso || "").padStart(3, "0");
  const country = COUNTRIES.find((c) => c.iso === iso);
  return country?.capital ? { cap: country.capital, iso: country.iso } : null;
}

/** A small warm-tinted noise tile, generated once, used as the repeating
 *  paper grain over the whole scene — the aged-atlas finish the flat map
 *  composited in canvas, now a CSS layer above the WebGL canvas. */
let _grainUrl: string | null = null;
function grainUrl(): string | null {
  if (_grainUrl) return _grainUrl;
  if (typeof document === "undefined") return null;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 20 + Math.floor(Math.random() * 20);
    img.data[i] = v;
    img.data[i + 1] = Math.round(v * 0.85);
    img.data[i + 2] = Math.round(v * 0.6);
    img.data[i + 3] = Math.floor(Math.random() * 70);
  }
  ctx.putImageData(img, 0, 0);
  _grainUrl = c.toDataURL();
  return _grainUrl;
}

/**
 * The world map: Natural Earth coastlines extruded into a lit 3D board,
 * home and partner realms picked out, everything else dim. Setup clicks a
 * country to choose its realm.
 *
 * The whole map is this one three.js scene — there is no second renderer to
 * fall back to, so a WebGL or geometry failure calls `onFail` and the shell
 * shows a plain "could not load" message instead (see CLAUDE.md's "the map
 * must never be load-bearing").
 */
interface WorldMap3DProps {
  tick?: number;
  mapMetric?: string | null;
  selectedRole?: string | null;
  onSelect?: (role: string | null) => void;
  onHover?: (
    hit: {
      iso: string;
      pickRole: string | null;
      role: string | null;
      label: string | null;
    } | null,
  ) => void;
  onFail?: () => void;
  homeIso?: string | null;
  homeRole?: string;
  setupMode?: boolean;
}

export default function WorldMap3D({
  tick,
  mapMetric,
  selectedRole,
  onSelect,
  onHover,
  onFail,
  homeIso,
  homeRole = "home",
  setupMode = false,
}: WorldMap3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayHostRef = useRef<HTMLDivElement>(null);
  const routeTipRef = useRef<HTMLDivElement>(null);
  const hoverLaneKeyRef = useRef<string | null>(null);
  const pairLanesRef = useRef<PairLane[]>([]);
  const paintGuidesRef = useRef<
    { path: { x: number; y: number; z: number }[]; edges?: string[] }[]
  >([]);
  const hubEdgesRef = useRef<
    { key: string; path: { x: number; y: number; z: number }[] }[]
  >([]);

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const camRef = useRef<MapCamera | null>(null);
  const terrainRef = useRef<Terrain | null>(null);
  const routeLayerRef = useRef<RouteLayer | null>(null);
  const fleetRef = useRef<Fleet | null>(null);
  const overlayRef = useRef<MapOverlay | null>(null);
  const labelsRef = useRef<RealmLabels | null>(null);
  const seaRef = useRef<Sea | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const sceneryRef = useRef<Scenery | null>(null);
  const diploPropsRef = useRef<DiploProps | null>(null);
  const oceanRef = useRef<OceanGrid | null>(null);
  const sizeRef = useRef({ W: 1, H: 1 });

  const countriesRef = useRef<CountryFeature[]>([]);
  const hoverRoleRef = useRef<string | null>(null);
  const hoverIsoRef = useRef<string | null>(null);
  const failed = useRef(false);
  const selectedRoleRef = useRef(selectedRole);
  selectedRoleRef.current = selectedRole;
  const setupModeRef = useRef(setupMode);
  setupModeRef.current = setupMode;
  const { pref } = useCurrencyPref();
  const displayCcyRef = useRef("USD");
  displayCcyRef.current =
    pref.display || currencyForSeat(getG()?.homeRole) || "USD";
  const didFocusSetupRef = useRef(false);

  const focusSetupCapital = useCallback((role: string | null | undefined) => {
    const cam = camRef.current;
    const cap = capitalOfRole(role);
    if (!cam || !cap) return false;
    const [nx, ny] = capitalOnBoard(cap.cap, cap.iso, countriesRef.current);
    const { W, H } = sizeRef.current;
    cam.focusAt(nx, ny, W / H);
    return true;
  }, []);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{
    anchor: Vector3;
    downX: number;
    downY: number;
  } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const movedRef = useRef(false);

  const [geoReady, setGeoReady] = useState(false);
  const [glReady, setGlReady] = useState(false);
  const [hoverPairs, setHoverPairs] = useState<HoverPairRow[] | null>(null);
  const ready = geoReady && glReady;

  const fail = useCallback(() => {
    if (failed.current) return;
    failed.current = true;
    onFail?.();
  }, [onFail]);

  /* ── Geometry ─────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries-110m.json")
      .then((r) => {
        if (!r.ok) throw new Error("geo fetch failed");
        return r.json();
      })
      .then((topo) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as {
          features: {
            id: string | number;
            geometry: { type?: string; coordinates?: unknown };
          }[];
        };
        countriesRef.current = fc.features
          .map((f) => {
            const iso = String(f.id).padStart(3, "0");
            if (SKIP_ISO.has(iso)) return null;
            const polys = geomToPolys(f.geometry);
            if (!polys.length) return null;
            return { iso, polys };
          })
          .filter((c): c is CountryFeature => c != null);
        punchCanalHoles(countriesRef.current);
        setGeoReady(true);
      })
      .catch((err) => {
        console.error(err);
        fail();
      });
    return () => {
      cancelled = true;
    };
  }, [fail]);

  /* ── WebGL scene ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!geoReady) return;
    const canvas = canvasRef.current;
    const host = overlayHostRef.current;
    if (!canvas || !host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (err) {
      console.error("WorldMap3D: WebGL unavailable", err);
      fail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    rendererRef.current = renderer;

    const scene = new Scene();
    scene.background = new Color(HORIZON);
    scene.fog = new Fog(HORIZON, 100, 400);
    sceneRef.current = scene;

    scene.add(new AmbientLight(0xfff4e8, 0.5));
    scene.add(new HemisphereLight(0xe8dcc8, 0x3a3228, 0.42));
    /* Desk lamp from the north-west: relief is a short drop on the
       paper, not a wall of black cliffs. */
    const sun = new DirectionalLight(0xfff6ea, 1.15);
    sun.position.set(SUN_OFF_X, SUN_OFF_Y, SUN_OFF_Z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    /* No normalBias — it shrinks trunks and mountain feet in the shadow
       map and leaves a gap at the base. A hair of constant bias is enough
       to keep self-shadow acne off the slabs. */
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0;
    sun.shadow.radius = 1;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 900;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new DirectionalLight(0xe8d8c0, 0.32);
    fill.position.set(180, 220, 200);
    scene.add(fill);

    const sky = createSky();
    skyRef.current = sky;
    scene.add(sky.mesh);

    const sea = createSea(countriesRef.current);
    seaRef.current = sea;
    scene.add(sea.mesh);

    const grid = createBoardGrid();
    scene.add(grid.group);

    let terrain: Terrain;
    try {
      terrain = buildTerrain(countriesRef.current);
    } catch (err) {
      console.error("WorldMap3D: terrain build failed", err);
      grid.dispose();
      sea.dispose();
      sky.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      seaRef.current = null;
      skyRef.current = null;
      fail();
      return;
    }
    terrainRef.current = terrain;
    scene.add(terrain.group);

    oceanRef.current = buildOceanGrid(countriesRef.current);

    const scenery = createScenery(countriesRef.current);
    sceneryRef.current = scenery;
    scene.add(scenery.group);

    const diploProps = createDiploProps();
    diploPropsRef.current = diploProps;
    scene.add(diploProps.group);

    const routeLayer = buildRouteLayer();
    routeLayerRef.current = routeLayer;
    scene.add(routeLayer.group);

    const fleet = createFleet(scene);
    fleetRef.current = fleet;

    const overlay = createOverlay(host);
    overlayRef.current = overlay;

    const labels = createRealmLabels();
    labelsRef.current = labels;
    scene.add(labels.group);

    const cam = new MapCamera();
    camRef.current = cam;

    const resize = () => {
      const wrap = wrapRef.current;
      const W = Math.max(
        320,
        Math.floor(wrap?.clientWidth || window.innerWidth),
      );
      const H = Math.max(
        240,
        Math.floor(wrap?.clientHeight || window.innerHeight),
      );
      sizeRef.current = { W, H };
      renderer.setSize(W, H, false);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      cam.apply(W / H);
    };
    resize();
    if (setupModeRef.current && focusSetupCapital(selectedRoleRef.current)) {
      didFocusSetupRef.current = true;
    }
    window.addEventListener("resize", resize);
    setGlReady(true);

    let raf: number | null = null;
    let cancelled = false;
    const frame = () => {
      if (cancelled) return;
      const { W, H } = sizeRef.current;
      const fog = scene.fog as Fog;
      fog.near = cam.dist * FOG_NEAR_K;
      fog.far = cam.dist * FOG_FAR_K;
      const nowS = performance.now() / 1000;
      sea.update(nowS);
      sky.update(cam.camera.position);
      scenery.update(nowS);
      routeLayer.update(nowS);
      fleet.update(nowS);
      /* Keep the shadow frustum around whatever is in frame, otherwise a
         single map for the whole 360° board is a few texels per country. */
      sun.target.position.set(cam.focusX, 0, cam.focusZ);
      sun.position.set(
        cam.focusX + SUN_OFF_X,
        SUN_OFF_Y,
        cam.focusZ + SUN_OFF_Z,
      );
      const shadowSpan = Math.max(36, cam.dist * 0.72);
      const shadowCam = sun.shadow.camera;
      shadowCam.left = -shadowSpan;
      shadowCam.right = shadowSpan;
      shadowCam.top = shadowSpan;
      shadowCam.bottom = -shadowSpan;
      shadowCam.updateProjectionMatrix();
      sun.target.updateMatrixWorld();
      overlay.update(cam, W, H);
      labels.update(cam, W, H);
      renderer.render(scene, cam.camera);
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
      } else if (raf == null) {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    /* A lost context can't be recovered into a half-built scene, and the
       map is allowed to disappear (the shell shows a plain message) — far
       better than leaving a frozen board on screen. */
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.error("WorldMap3D: WebGL context lost");
      fail();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelled = true;
      if (raf != null) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      fleet.dispose();
      routeLayer.dispose();
      terrain.dispose();
      scenery.dispose();
      diploProps.dispose();
      sea.dispose();
      grid.dispose();
      sky.dispose();
      overlay.dispose();
      labels.dispose();
      renderer.dispose();
      clearModelCache();
      rendererRef.current = null;
      sceneRef.current = null;
      camRef.current = null;
      terrainRef.current = null;
      routeLayerRef.current = null;
      fleetRef.current = null;
      overlayRef.current = null;
      labelsRef.current = null;
      seaRef.current = null;
      skyRef.current = null;
      sceneryRef.current = null;
      diploPropsRef.current = null;
      oceanRef.current = null;
      setGlReady(false);
    };
  }, [
    geoReady,
    fail,
    focusSetupCapital,
    SEA_SHADER_REV,
    REALM_LABELS_REV,
    TERRAIN_REV,
    BOARD_GRID_REV,
    MAP_LIGHT_REV,
    ROUTES_REV,
    SCENERY_REV,
    DIPLO_PROPS_REV,
  ]);

  /* Setup: centre on the opening random pick once the board is up. Later
     clicks only change the highlighted seat — the player keeps the view.
     Zoom is left alone so a player who has already pinched in stays there. */
  useEffect(() => {
    if (!setupMode) {
      didFocusSetupRef.current = false;
      return;
    }
    if (!ready || didFocusSetupRef.current) return;
    if (focusSetupCapital(selectedRole)) didFocusSetupRef.current = true;
  }, [setupMode, selectedRole, ready, focusSetupCapital]);

  /* ── Painting: colours, labels, badges, capitals ──────────────────── */

  const syncPaint = useCallback(() => {
    const terrain = terrainRef.current;
    const overlay = overlayRef.current;
    const realmLabels = labelsRef.current;
    const routeLayer = routeLayerRef.current;
    const scenery = sceneryRef.current;
    const countries = countriesRef.current;
    if (
      !terrain ||
      !overlay ||
      !realmLabels ||
      !routeLayer ||
      !countries.length
    )
      return;

    const G = getG();
    const hRole = homeRole || G?.homeRole || "home";
    const hIso = homeIso || G?.homeIso || HOME_ISO;
    const hoverRole = hoverRoleRef.current;
    const hoverIso = hoverIsoRef.current;

    const isSelected = (role: string | null) => !!role && selectedRole === role;
    /* Setup hovers by ISO so only the pointed-at country lifts, not a
       whole bloc. Require hoverRole too — that is pickRole, so scenery
       land (no seat) never raises. Both-null used to match every
       unassigned country and leave the rest of the board stuck up. */
    const isHovered = (role: string | null, iso: string) =>
      setupMode
        ? hoverRole != null && hoverIso != null && hoverIso === iso
        : role != null && hoverRole === role;
    /* Home is permanently lit in play so your seat stays popped out of the
       board. In setup there is no committed home yet — ISO 826 still maps
       to the "home" role as the picker default, and treating that as rest-
       hot left the UK stuck at the raised height, so hovering it could
       never lift or drop the slab. */
    const isRestHot = (role: string | null) =>
      !!role && (isSelected(role) || (!setupMode && role === "home"));

    const colours = new Map<string, CountryPaint>();
    const isoLift = new Map<string, number>();
    for (const c of countries) {
      const role = roleForFeature(c.iso, hRole, hIso);
      let fill: string;
      if (!role) {
        fill = sceneryFill(c.iso);
      } else if (setupMode) {
        fill = isSelected(role)
          ? liftColour(
              (REALM_FILL as Record<string, string>)[role] || "#D4896E",
              1.12,
            )
          : (REALM_FILL as Record<string, string>)[role] || "#D4896E";
      } else {
        fill = roleColour(role, mapMetric ?? null, selectedRole ?? null);
      }
      const restHot = isRestHot(role);
      const hovered = isHovered(role, c.iso);
      const hot = restHot || hovered;
      const lift = landLift(restHot, hovered);
      if (lift) isoLift.set(c.iso, lift);
      if (hot && !setupMode) fill = liftColour(fill, HOVER_LIFT);
      colours.set(c.iso, { fill, hot, lift });
    }
    terrain.paint(colours);
    scenery?.setHot(isoLift);

    /* Capital spires. Shown for every realm during country selection
       (there's no committed home yet to filter against), and for home plus
       the active partners once a game is running. Built before labels so
       a name sitting on a capital (or on a neighbour) can be nudged off. */
    const capitalSources = setupMode
      ? PARTNERS.filter((c) => c.capital).map((c) => ({
          cap: c.capital,
          /* ISO 826 is the "home" picker seat, not the "kingdom" partner —
             using c.id here left the UK capital out of the selected-role
             rest-hot set while the land itself was in it. */
          role: realmRoleForIso(c.iso) || c.id,
          iso: c.iso,
        }))
      : (() => {
          const home = PARTNERS.find((c) => c.iso === (hIso || HOME_ISO));
          return [
            ...(home?.capital
              ? [{ cap: home.capital, role: "home", iso: home.iso }]
              : []),
            ...activePartners(hRole)
              .filter((p) => p.capital)
              .map((p) => ({ cap: p.capital, role: p.id, iso: p.iso })),
          ];
        })();
    const capitalSpecs = capitalSources.map(({ cap, role, iso }) => {
      const [nx, ny] = capitalOnBoard(cap, iso, countries);
      const [wx, wz] = boardToWorld(nx, ny);
      const restHot = isRestHot(role);
      const hovered = isHovered(role, iso);
      return {
        key: role,
        x: wx,
        z: wz,
        hot: restHot || hovered,
        lift: landLift(restHot, hovered),
      };
    });

    /* Labels: one per realm still on the board. */
    const labelRoles = setupMode
      ? ["home", ...PARTNERS.map((p) => p.id).filter((id) => id !== "kingdom")]
      : ["home", ...activePartners(hRole).map((p) => p.id)];
    const labels: LabelSpec[] = [];
    for (const role of labelRoles) {
      const polys = polysForRole(role, countries, hRole, hIso, setupMode);
      if (!polys) continue;
      const [nx, ny] = polysCentroid(polys);
      const [wx, wz] = boardToWorld(nx, ny);
      let rawText: string;
      if (role === "home") {
        const homeName = setupMode
          ? realmByRole("home").name
          : (G && G.country) || realmByRole(hRole).name;
        rawText = setupMode
          ? homeName
          : boardMetricMapLabel("home", mapMetric ?? null, homeName, G);
      } else {
        const p = PARTNERS.find((x) => x.id === role);
        const name = p ? p.name : role;
        rawText = setupMode
          ? name
          : boardMetricMapLabel(role, mapMetric ?? null, name, G);
      }
      const iso =
        role === "home" && !setupMode
          ? String(hIso || HOME_ISO).padStart(3, "0")
          : String(realmByRole(role).iso).padStart(3, "0");
      const restHot = isRestHot(role);
      const hovered = isHovered(role, iso);
      const hot = restHot || hovered;
      labels.push({
        key: role,
        text: rawText.toUpperCase(),
        hot,
        /* Placement priority is separate from hot's bold/gold styling — the
           player's own realm should keep its label even when neither
           selected nor hovered. */
        priority: hot || role === "home" ? 1 : 0,
        anchor: new Vector3(wx, LAND_HEIGHT + landLift(restHot, hovered), wz),
      });
    }
    realmLabels.setLabels(
      labels,
      capitalSpecs.map((c) => ({ x: c.x, z: c.z })),
    );
    scenery?.setLabelClear(realmLabels.clearBoxes());
    scenery?.setCapitals(capitalSpecs);

    /* Diplomatic activity: Kenney tokens at the capital, legend only
       as chrome. Every live kind on a partner is planted — envoy, summit,
       protest, sanctions, ultimatum. */
    const badges: BadgeSpec[] = [];
    const diploSpecs: DiploPropSpec[] = [];
    if (!setupMode && G) {
      const byPartner = new Map<string, string[]>();
      for (const m of diploMapMarkers(G)) {
        const list = byPartner.get(m.partnerId);
        if (list) list.push(m.kind);
        else byPartner.set(m.partnerId, [m.kind]);
      }
      const capByRole = new Map(capitalSpecs.map((c) => [c.key, c]));
      for (const [partnerId, kinds] of byPartner) {
        const sorted = [...kinds].sort(
          (a, b) =>
            DIPLO_MARKER_ORDER.indexOf(diploLegendKind(a)) -
            DIPLO_MARKER_ORDER.indexOf(diploLegendKind(b)),
        );
        badges.push({
          key: partnerId,
          kinds: sorted,
          anchor: new Vector3(0, 0, 0),
        });
        const cap = capByRole.get(partnerId);
        if (!cap) continue;
        const planted = new Set<DiploKind>();
        for (const kind of sorted) {
          const visual = visualDiploKind(kind);
          if (!visual || planted.has(visual)) continue;
          planted.add(visual);
          const [ox, oz] = DIPLO_OFFSET[visual];
          diploSpecs.push({
            key: `${partnerId}:${visual}`,
            kind: visual,
            x: cap.x + ox,
            z: cap.z + oz,
            lift: cap.lift,
          });
        }
      }
    }
    overlay.setBadges(badges);
    diploPropsRef.current?.setProps(diploSpecs);

    const focusSeat = setupMode
      ? selectedRole
        ? selectedRole === "home"
          ? "kingdom"
          : selectedRole
        : null
      : selectedRole
        ? selectedRole === "home"
          ? "kingdom"
          : selectedRole
        : playerCountryId(hRole);
    routeLayer.setSelectedRoute(focusSeat);

    // tick isn't read directly above; it's the cache-busting signal that
    // makes this callback's identity change on every game tick, which
    // re-fires the [ready, syncPaint] effect below and re-reads getG().
    // Removing it would leave the board's colours and labels stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMetric, selectedRole, setupMode, homeRole, homeIso, tick]);

  useEffect(() => {
    if (!ready) return;
    syncPaint();
  }, [ready, syncPaint]);

  /* ── Trade routes and their boats ─────────────────────────────────── */

  /** Capitals of every mapped realm, in world space. Shared by the dashed
   *  world network and the fleet. */
  const routeSeats = useCallback(() => {
    const countries = countriesRef.current;
    const out: { id: string; x: number; z: number; nx: number; ny: number }[] =
      [];
    for (const c of PARTNERS) {
      if (!c.capital) continue;
      const [nx, ny] = capitalOnBoard(c.capital, c.iso, countries);
      const [x, z] = boardToWorld(nx, ny);
      out.push({ id: c.id, x, z, nx, ny });
    }
    return out;
  }, []);

  const plannedLanes = useCallback(() => {
    const ocean = oceanRef.current;
    const seats = routeSeats();
    if (!seats.length) return { boats: [], draw: [], edges: [] };
    const byId = new Map(seats.map((s) => [s.id, s]));
    const pairs = majorTradePairs(seats.map((s) => s.id));
    const legs = pairs
      .map((pair) => {
        const a = byId.get(pair.a);
        const b = byId.get(pair.b);
        if (!a || !b) return null;
        /* Keep both seats on the centre plate. wrapDelta used to slide
           the far capital onto a wrap tile; that stub missed the highway
           index and Australia–US never got boats. */
        const to = ocean
          ? { x: b.x, y: 0, z: b.z }
          : (() => {
              const nx = a.nx + wrapDelta(a.nx, b.nx);
              const [px, pz] = boardToWorld(nx, b.ny);
              return { x: px, y: 0, z: pz };
            })();
        return {
          id: pair.a + "+" + pair.b,
          from: { x: a.x, y: 0, z: a.z },
          to,
          owners: [pair.a, pair.b],
        };
      })
      .filter((leg): leg is NonNullable<typeof leg> => !!leg);
    if (!ocean) {
      return {
        boats: legs.map((l) => ({
          id: l.id,
          owners: l.owners,
          path: [l.from, l.to],
          edges: [] as string[],
        })),
        draw: legs.map((l) => ({
          owners: l.owners,
          path: [l.from, l.to],
          kind: "highway" as const,
          highwayId: l.id,
          color: 0xff453a,
          edges: [] as string[],
        })),
        edges: [] as { key: string; path: typeof legs[0]["from"][] }[],
      };
    }
    return planNetwork(ocean, legs);
  }, [routeSeats]);

  useEffect(() => {
    if (!ready) return;
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;
    const planned = plannedLanes();
    const specs: RouteSpec[] = planned.draw.map((lane, i) => ({
      key: (lane.highwayId || lane.kind || "highway") + "#" + i,
      owners: lane.owners,
      kind: lane.kind,
      color: lane.color,
      path: resampleLane(lane.path.map((p) => ({ x: p.x, y: 0, z: p.z }))),
    }));
    routeLayer.setRoutes(specs);
  }, [ready, plannedLanes, setupMode]);

  useEffect(() => {
    if (!ready) return;
    const fleet = fleetRef.current;
    if (!fleet) return;
    const planned = plannedLanes();
    const g = getG();
    const flows = g?.worldTrade?.flows;
    const rel = g?.rel || {};
    const shown = planned.boats.filter((r) => r.path.length >= 2);
    const lanes: PairLane[] = shown.map((r) => {
      const a = r.owners[0] || "";
      const b = r.owners[1] || "";
      const ab = flows?.[a]?.[b] || 0;
      const ba = flows?.[b]?.[a] || 0;
      const live = ab + ba;
      return {
        id: r.id,
        owners: r.owners,
        path: resampleLane(r.path.map((p) => ({ x: p.x, y: 0, z: p.z }))),
        vol: live > 0 ? live : bilateralWeight(a, b),
        ab,
        ba,
        directed: live > 0,
        edges: r.edges,
      };
    });
    pairLanesRef.current = lanes;
    paintGuidesRef.current = planned.draw.map((lane) => ({
      path: resampleLane(lane.path.map((p) => ({ x: p.x, y: 0, z: p.z }))),
      edges: lane.edges,
    }));
    hubEdgesRef.current = (planned.edges || []).map((e) => ({
      key: e.key,
      path: resampleLane(e.path.map((p) => ({ x: p.x, y: 0, z: p.z }))),
    }));
    const maxVol = Math.max(0, ...lanes.map((l) => l.vol));
    const homeId = g ? playerCountryId(g.homeRole) : "";
    const specs: FleetSpec[] = lanes.map((l) => {
      const other =
        l.owners.find((o) => o !== homeId) || l.owners[0] || l.id;
      return {
        partnerId: l.id,
        path: l.path,
        count: bucketRoute(
          l.vol,
          maxVol,
          pathLength(l.path) / BOARD_W,
        ).count,
        periodS: periodForDistance(pathLength(l.path) / BOARD_W),
        tint: relationTint(rel[other] ?? 50),
        phase: routePhaseSeed(l.id),
      };
    });
    fleet.set(specs);
  }, [ready, setupMode, tick, homeRole, plannedLanes]);

  /* ── Pointer input ────────────────────────────────────────────────── */

  const ndcAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }, []);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const cam = camRef.current;
      const countries = countriesRef.current;
      const ndc = ndcAt(clientX, clientY);
      if (!cam || !ndc || !countries.length) return null;
      /* Test against a plane through the middle of the land slab rather
         than the sea: the board has real thickness now, so an oblique ray
         entering a country's side wall and one grazing its top face should
         both resolve to that country. */
      const hit = cam.groundAt(ndc.x, ndc.y, LAND_HEIGHT / 2);
      if (!hit) return null;
      const [nx, ny] = worldToBoard(hit.x, hit.z);
      if (ny < 0 || ny > 1) return null;
      /* Prefer smaller countries (islands) when rings nest / overlap. */
      const ordered = [...countries].sort(
        (a, b) => a.polys.length - b.polys.length,
      );
      for (const c of ordered) {
        if (!pointInPolys(nx, ny, c.polys)) continue;
        const pickRole = realmRoleForIso(c.iso);
        const playRole = roleForFeature(
          c.iso,
          homeRole || getG()?.homeRole || "home",
          homeIso || getG()?.homeIso || HOME_ISO,
        );
        return {
          iso: c.iso,
          pickRole,
          role: playRole,
          label: pickRole ? realmByRole(pickRole).name : null,
        };
      }
      return null;
    },
    [ndcAt, homeRole, homeIso],
  );

  /** Drag the ground: keep whatever world point was grabbed under the
   *  pointer. Re-derived from the live camera each move, so it self-corrects
   *  as the pitch changes under a simultaneous pinch-zoom. */
  const panTo = useCallback(
    (clientX: number, clientY: number) => {
      const cam = camRef.current;
      const pan = panRef.current;
      const ndc = ndcAt(clientX, clientY);
      if (!cam || !pan || !ndc) return;
      const now = cam.groundAt(ndc.x, ndc.y);
      if (!now) return;
      cam.focusX += pan.anchor.x - now.x;
      cam.focusZ += pan.anchor.z - now.z;
      cam.apply(sizeRef.current.W / sizeRef.current.H);
    },
    [ndcAt],
  );

  const grabAt = useCallback(
    (clientX: number, clientY: number) => {
      const cam = camRef.current;
      const ndc = ndcAt(clientX, clientY);
      if (!cam || !ndc) return;
      const anchor = cam.groundAt(ndc.x, ndc.y);
      panRef.current = anchor
        ? { anchor, downX: clientX, downY: clientY }
        : null;
    },
    [ndcAt],
  );

  const setCursor = useCallback((cursor: string) => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = cursor;
  }, []);

  const hideRouteHover = useCallback(() => {
    const had = hoverLaneKeyRef.current != null;
    hoverLaneKeyRef.current = null;
    if (had) setHoverPairs(null);
  }, []);

  const placeRouteTip = useCallback((clientX: number, clientY: number) => {
    const tip = routeTipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top + 16;
    const flip = x > rect.width - 340;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    tip.style.transform = flip ? "translateX(-108%)" : "translateX(14px)";
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ready) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      const ndc = ndcAt(e.clientX, e.clientY);
      if (!cam || !ndc) return;
      /* Pixel-mode trackpads need a continuous scale; line-mode keeps clicks. */
      let factor: number;
      if (e.ctrlKey) {
        /* macOS pinch-to-zoom arrives as ctrl+wheel. */
        factor = Math.exp(e.deltaY * 0.01);
      } else if (e.deltaMode === 0) {
        factor = Math.exp(e.deltaY * 0.0018);
      } else {
        factor = e.deltaY < 0 ? 1 / 1.12 : 1.12;
      }
      cam.zoomAt(factor, ndc.x, ndc.y, sizeRef.current.W / sizeRef.current.H);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [ready, ndcAt]);

  const midpoint = () => {
    const pts = [...pointersRef.current.values()].slice(0, 2);
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      /* Second finger: leave pan, start pinch. Drop capture so both track. */
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      const mid = midpoint();
      pinchRef.current = { dist: mid.dist };
      grabAt(mid.x, mid.y);
      movedRef.current = true;
      return;
    }
    pinchRef.current = null;
    movedRef.current = false;
    grabAt(e.clientX, e.clientY);
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const cam = camRef.current;
    if (pointersRef.current.size >= 2 && pinchRef.current && cam) {
      const mid = midpoint();
      const ndc = ndcAt(mid.x, mid.y);
      if (ndc) {
        cam.zoomAt(
          pinchRef.current.dist / mid.dist,
          ndc.x,
          ndc.y,
          sizeRef.current.W / sizeRef.current.H,
        );
      }
      pinchRef.current.dist = mid.dist;
      panTo(mid.x, mid.y);
      hideRouteHover();
      return;
    }

    const pan = panRef.current;
    if (pan && (e.buttons & 1 || pointersRef.current.has(e.pointerId))) {
      if (
        Math.hypot(e.clientX - pan.downX, e.clientY - pan.downY) > CLICK_SLOP
      ) {
        movedRef.current = true;
      }
      if (movedRef.current) {
        panTo(e.clientX, e.clientY);
        setCursor("grabbing");
        hideRouteHover();
        return;
      }
    }

    let traffic = null as ReturnType<typeof queryPointTraffic>;
    if (!setupMode && cam) {
      const ndc = ndcAt(e.clientX, e.clientY);
      const sea = ndc ? cam.groundAt(ndc.x, ndc.y, SEA_Y) : null;
      if (sea) {
        /* World units = degrees. The dashed stroke is 0.12° wide on a
           1° ocean grid; a sub-degree pick radius misses the South
           Pacific spine the boats do not always sit on. */
        const maxD = Math.max(2.4, Math.min(7, cam.dist * 0.028));
        traffic = queryPointTraffic(
          pairLanesRef.current,
          paintGuidesRef.current,
          hubEdgesRef.current,
          sea.x,
          sea.z,
          maxD,
          2.2,
        );
      }
    }
    if (traffic) {
      setCursor("pointer");
      const key = traffic.lanes
        .map((l) => l.id + ":" + l.ab.toFixed(2) + ":" + l.ba.toFixed(2))
        .join("|");
      if (hoverLaneKeyRef.current !== key) {
        hoverLaneKeyRef.current = key;
        const g = getG();
        const ccy = displayCcyRef.current;
        const total = traffic.lanes.reduce((s, l) => {
          if (l.directed) return s + l.ab + l.ba;
          return s + l.vol;
        }, 0);
        const rows: HoverPairRow[] = [];
        for (const l of traffic.lanes) {
          const a = l.owners[0] || "";
          const b = l.owners[1] || "";
          if (l.directed) {
            if (l.ab > 0) {
              rows.push({
                id: l.id + ">ab",
                fromRole: a,
                fromLabel: seatLabel(a),
                toRole: b,
                toLabel: seatLabel(b),
                amount: flowAmountLabel(a, l.ab, g, ccy),
                share: total > 0 ? l.ab / total : 0,
              });
            }
            if (l.ba > 0) {
              rows.push({
                id: l.id + ">ba",
                fromRole: b,
                fromLabel: seatLabel(b),
                toRole: a,
                toLabel: seatLabel(a),
                amount: flowAmountLabel(b, l.ba, g, ccy),
                share: total > 0 ? l.ba / total : 0,
              });
            }
          } else {
            rows.push({
              id: l.id,
              fromRole: a,
              fromLabel: seatLabel(a),
              toRole: b,
              toLabel: seatLabel(b),
              amount: "—",
              share: total > 0 ? l.vol / total : 0,
            });
          }
        }
        rows.sort((x, y) => y.share - x.share);
        setHoverPairs(rows);
      }
      placeRouteTip(e.clientX, e.clientY);
      if (hoverRoleRef.current || hoverIsoRef.current) {
        hoverRoleRef.current = null;
        hoverIsoRef.current = null;
        syncPaint();
        onHover?.(null);
      }
      return;
    }
    if (hoverLaneKeyRef.current) hideRouteHover();

    const hit = pickAt(e.clientX, e.clientY);
    const nextRole = hit ? (setupMode ? hit.pickRole : hit.role) : null;
    /* Setup: only a pickable seat counts as hovered. Scenery land still
       ray-hits, but must not lift or change the cursor. */
    const nextIso = hit && setupMode && hit.pickRole ? hit.iso : null;
    const canPick = setupMode ? !!hit?.pickRole : !!hit?.role;
    setCursor(canPick ? "pointer" : "grab");
    if (nextRole !== hoverRoleRef.current || nextIso !== hoverIsoRef.current) {
      hoverRoleRef.current = nextRole;
      hoverIsoRef.current = nextIso;
      syncPaint();
      onHover?.(hit);
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      /* Resume one-finger pan from the remaining finger. */
      const pt = [...pointersRef.current.values()][0];
      grabAt(pt.x, pt.y);
      movedRef.current = true;
    } else if (pointersRef.current.size === 0) {
      panRef.current = null;
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const wasClick = !movedRef.current && pointersRef.current.size === 1;
    endPointer(e);
    const hit = pickAt(e.clientX, e.clientY);
    const canPick = setupMode ? !!hit?.pickRole : !!hit?.role;
    setCursor(canPick ? "pointer" : "grab");
    if (!wasClick) return;
    if (setupMode) {
      if (hit?.pickRole) onSelect?.(hit.pickRole);
    } else if (hit?.role) {
      onSelect?.(hit.role);
    } else {
      onSelect?.(null);
    }
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    /* Only clear hover when the primary pointer leaves; keep multi-touch. */
    if (pointersRef.current.has(e.pointerId)) endPointer(e);
    if (pointersRef.current.size === 0) {
      panRef.current = null;
      pinchRef.current = null;
    }
    hideRouteHover();
    if (hoverRoleRef.current || hoverIsoRef.current) {
      hoverRoleRef.current = null;
      hoverIsoRef.current = null;
      syncPaint();
      onHover?.(null);
    }
    setCursor("grab");
  };

  const grain = grainUrl();

  return (
    <div
      id="worldMapLayer"
      ref={wrapRef}
      className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_45%,#7a6a52_0%,#4a4034_55%,#3a3228_100%)]"
    >
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/40">
          Loading…
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        className="absolute inset-0 block size-full cursor-grab [filter:sepia(0.08)_saturate(0.86)_contrast(1.05)_brightness(1.04)]"
        aria-label={
          setupMode ? "Choose your country on the world map" : "World map"
        }
      />
      {/* Screen-anchored warm glow — the radial lift the flat map painted
          into its ocean, kept in screen space so it stays centred as the
          camera moves rather than sliding around the board. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_44%,rgba(255,236,200,.16)_0%,rgba(20,16,12,0)_50%,rgba(22,16,10,.28)_100%)]"
      />
      <div
        ref={overlayHostRef}
        className="pointer-events-none absolute inset-0"
      />
      {grain && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply"
          style={{ backgroundImage: `url(${grain})` }}
        />
      )}
      <div
        ref={routeTipRef}
        className="pointer-events-none absolute z-10"
        hidden={!hoverPairs}
      >
        <RouteHoverTip pairs={hoverPairs} />
      </div>
    </div>
  );
}
