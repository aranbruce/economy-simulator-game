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
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
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
} from "../../lib/sim/engine.ts";
import { COUNTRIES } from "../../lib/sim/countries.ts";
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
  boardToWorld,
  project,
  worldToBoard,
  wrapDelta,
} from "../../lib/map/projection.ts";
import {
  geomToPolys,
  pointInPolys,
  polysCentroid,
  type Polys,
} from "../../lib/map/geo.ts";
import { MapCamera } from "./camera.ts";
import { buildTerrain, type CountryPaint, type Terrain } from "./terrain.ts";
import { buildRouteLayer, type RouteLayer, type RouteSpec } from "./routes.ts";
import { createFleet, type Fleet, type FleetSpec } from "./fleet.ts";
import {
  createOverlay,
  DIPLO_MARKER_ORDER,
  type BadgeSpec,
  type LabelSpec,
  type MapOverlay,
} from "./overlay.ts";
import {
  bucketRoute,
  periodForDistance,
  relationTint,
  routeDistance,
  routePhaseSeed,
  routeVolume,
  vesselForVolume,
} from "./boats.ts";
import { clearModelCache } from "./models.ts";
import { buildLandMask } from "./landMask.ts";

/** Sea colour, and the darkness the fog fades the far board into. Both were
 *  flat canvas fills on the map this replaced. */
const OCEAN = 0x3c4a3f;
const HORIZON = 0x1b130c;
const SCENERY_FILL = "#3a3226";
const SETUP_SELECTED = "#D4AF69";
const HOVER_LIFT = 1.1;
/** Antarctica — not on the board. */
const SKIP_ISO = new Set(["010"]);

/** How far the sea extends past the board. Only ever seen edge-on through
 *  fog, so it just has to outrun the far plane of any allowed zoom. */
const SEA_SIZE = 5000;
/** The sea sits a hair below y=0 so it can't z-fight the underside of the
 *  land slabs standing on it. */
const SEA_Y = -0.15;

/** Fog distances as multiples of the camera's own distance to the board, so
 *  the depth cue reads the same at every zoom instead of swallowing the
 *  whole frame when you pull back. */
const FOG_NEAR_K = 0.9;
const FOG_FAR_K = 3.4;

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

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const camRef = useRef<MapCamera | null>(null);
  const terrainRef = useRef<Terrain | null>(null);
  const routeLayerRef = useRef<RouteLayer | null>(null);
  const fleetRef = useRef<Fleet | null>(null);
  const overlayRef = useRef<MapOverlay | null>(null);
  const sizeRef = useRef({ W: 1, H: 1 });

  const countriesRef = useRef<CountryFeature[]>([]);
  const hoverRoleRef = useRef<string | null>(null);
  const hoverIsoRef = useRef<string | null>(null);
  const failed = useRef(false);

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
      renderer = new WebGLRenderer({ canvas, antialias: true });
    } catch (err) {
      console.error("WorldMap3D: WebGL unavailable", err);
      fail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererRef.current = renderer;

    const scene = new Scene();
    scene.background = new Color(HORIZON);
    scene.fog = new Fog(HORIZON, 100, 400);
    sceneRef.current = scene;

    scene.add(new AmbientLight(0xfff2e0, 0.5));
    scene.add(new HemisphereLight(0x9fb8c9, 0x2a2114, 0.55));
    /* One low sun from the north-west. Land is extruded, so a raking key
       light is what turns each country's side wall into a visible border
       and gives the board its relief. */
    const sun = new DirectionalLight(0xfff3e0, 1.25);
    sun.position.set(-260, 320, -180);
    scene.add(sun);

    const seaGeom = new PlaneGeometry(SEA_SIZE, SEA_SIZE);
    const seaMat = new MeshStandardMaterial({
      color: OCEAN,
      roughness: 0.88,
      metalness: 0.04,
    });
    const sea = new Mesh(seaGeom, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = SEA_Y;
    scene.add(sea);

    let terrain: Terrain;
    try {
      terrain = buildTerrain(countriesRef.current);
    } catch (err) {
      console.error("WorldMap3D: terrain build failed", err);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      fail();
      return;
    }
    terrainRef.current = terrain;
    scene.add(terrain.group);

    const routeLayer = buildRouteLayer();
    routeLayerRef.current = routeLayer;
    scene.add(routeLayer.group);

    /* Rasterised from the polygons already parsed above, so the fleet can
       ask "is this point at sea?" in one array lookup per boat per frame. */
    const fleet = createFleet(scene, buildLandMask(countriesRef.current));
    fleetRef.current = fleet;

    const overlay = createOverlay(host);
    overlayRef.current = overlay;

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
    window.addEventListener("resize", resize);
    setGlReady(true);

    let raf: number | null = null;
    let cancelled = false;
    let last = 0;
    const frame = () => {
      if (cancelled) return;
      const { W, H } = sizeRef.current;
      const fog = scene.fog as Fog;
      fog.near = cam.dist * FOG_NEAR_K;
      fog.far = cam.dist * FOG_FAR_K;
      routeLayer.setPinScale(cam.dist);
      const nowS = performance.now() / 1000;
      /* dt is clamped: a backgrounded tab or a slow first frame would
         otherwise hand the coastline fade an enormous step. */
      const dtS = last === 0 ? 0 : Math.min(0.1, nowS - last);
      last = nowS;
      fleet.update(nowS, dtS);
      overlay.update(cam, W, H);
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
      overlay.dispose();
      seaGeom.dispose();
      seaMat.dispose();
      renderer.dispose();
      clearModelCache();
      rendererRef.current = null;
      sceneRef.current = null;
      camRef.current = null;
      terrainRef.current = null;
      routeLayerRef.current = null;
      fleetRef.current = null;
      overlayRef.current = null;
      setGlReady(false);
    };
  }, [geoReady, fail]);

  /* ── Painting: colours, labels, badges, capitals ──────────────────── */

  const syncPaint = useCallback(() => {
    const terrain = terrainRef.current;
    const overlay = overlayRef.current;
    const routeLayer = routeLayerRef.current;
    const countries = countriesRef.current;
    if (!terrain || !overlay || !routeLayer || !countries.length) return;

    const G = getG();
    const hRole = homeRole || G?.homeRole || "home";
    const hIso = homeIso || G?.homeIso || HOME_ISO;
    const hoverRole = hoverRoleRef.current;
    const hoverIso = hoverIsoRef.current;

    const isSelected = (role: string | null) => selectedRole === role;
    const isHovered = (role: string | null, iso: string) =>
      setupMode ? hoverIso === iso : hoverRole === role;
    const isHot = (role: string | null, iso: string) =>
      !!role && (isSelected(role) || isHovered(role, iso) || role === "home");

    const colours = new Map<string, CountryPaint>();
    for (const c of countries) {
      const role = roleForFeature(c.iso, hRole, hIso);
      let fill: string;
      if (!role) {
        fill = SCENERY_FILL;
      } else if (setupMode) {
        fill = isSelected(role)
          ? SETUP_SELECTED
          : (REALM_FILL as Record<string, string>)[role] || "#6a7a94";
      } else {
        fill = roleColour(role, mapMetric ?? null, selectedRole ?? null);
      }
      const hot = isHot(role, c.iso);
      if (hot && !setupMode) fill = liftColour(fill, HOVER_LIFT);
      colours.set(c.iso, { fill, hot });
    }
    terrain.paint(colours);

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
      const hot = isSelected(role) || hoverRole === role;
      labels.push({
        key: role,
        text: rawText.toUpperCase(),
        hot,
        /* Placement priority is separate from hot's bold/gold styling — the
           player's own realm should keep its label even when neither
           selected nor hovered. */
        priority: hot || role === "home" ? 1 : 0,
        anchor: new Vector3(wx, LAND_HEIGHT, wz),
      });
    }
    overlay.setLabels(labels);

    /* Diplomatic activity badges (play only). */
    const badges: BadgeSpec[] = [];
    if (!setupMode && G) {
      const byPartner = new Map<string, string[]>();
      for (const m of diploMapMarkers(G)) {
        const list = byPartner.get(m.partnerId);
        if (list) list.push(m.kind);
        else byPartner.set(m.partnerId, [m.kind]);
      }
      for (const [partnerId, kinds] of byPartner) {
        const polys = polysForRole(
          partnerId,
          countries,
          hRole,
          hIso,
          setupMode,
        );
        if (!polys) continue;
        const [nx, ny] = polysCentroid(polys);
        const [wx, wz] = boardToWorld(nx, ny);
        badges.push({
          key: partnerId,
          kinds: [...kinds].sort(
            (a, b) =>
              DIPLO_MARKER_ORDER.indexOf(a) - DIPLO_MARKER_ORDER.indexOf(b),
          ),
          anchor: new Vector3(wx, LAND_HEIGHT, wz),
        });
      }
    }
    overlay.setBadges(badges);

    /* Capital spires. Shown for every realm during country selection
       (there's no committed home yet to filter against), and for home plus
       the active partners once a game is running. */
    const capitalSources = setupMode
      ? PARTNERS.filter((c) => c.capital).map((c) => ({
          cap: c.capital,
          role: c.id,
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
    routeLayer.setCapitals(
      capitalSources.map(({ cap, role, iso }) => {
        const [nx, ny] = project(cap.lng, cap.lat);
        const [wx, wz] = boardToWorld(nx, ny);
        return { key: role, x: wx, z: wz, hot: isHot(role, iso) };
      }),
    );

    routeLayer.setSelectedRoute(setupMode ? null : (selectedRole ?? null));
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

  /** Home and partner capitals as world-space anchors, the partner end
   *  already taken the short way round the wrap. Shared by the route tubes
   *  and the fleet so the two can't disagree about where a route runs. */
  const routeAnchors = useCallback(() => {
    const G = getG();
    const hRole = homeRole || G?.homeRole || "home";
    const hIso = homeIso || G?.homeIso || HOME_ISO;
    const home = PARTNERS.find((c) => c.iso === (hIso || HOME_ISO));
    if (!home?.capital) return [];
    const [hnx, hny] = project(home.capital.lng, home.capital.lat);
    const [hx, hz] = boardToWorld(hnx, hny);
    return activePartners(hRole)
      .filter((p) => p.capital)
      .map((p) => {
        const [rawNx, ny] = project(p.capital.lng, p.capital.lat);
        /* Short way round the wrap, not straight across the whole board —
           see wrapDelta's own doc comment. */
        const nx = hnx + wrapDelta(hnx, rawNx);
        const [px, pz] = boardToWorld(nx, ny);
        return {
          partnerId: p.id,
          homeNorm: [hnx, hny] as [number, number],
          partnerNorm: [nx, ny] as [number, number],
          home: { x: hx, y: 0, z: hz },
          partner: { x: px, y: 0, z: pz },
        };
      });
  }, [homeRole, homeIso]);

  useEffect(() => {
    if (!ready) return;
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;
    if (setupMode) {
      routeLayer.setRoutes([]);
      return;
    }
    const specs: RouteSpec[] = routeAnchors().map((r) => ({
      partnerId: r.partnerId,
      home: r.home,
      partner: r.partner,
    }));
    routeLayer.setRoutes(specs);
  }, [ready, setupMode, routeAnchors]);

  useEffect(() => {
    if (!ready) return;
    const fleet = fleetRef.current;
    if (!fleet) return;
    if (setupMode) {
      fleet.set([]);
      return;
    }
    const anchors = routeAnchors();
    const g = getG();
    /* g.worldTrade is keyed by real country ids (from NATION_PROFILE /
       worldSeatIds), not raw role strings — the default "home" role's live
       data actually lives under "kingdom" (playerCountryId("home")), since
       NATION_PROFILE has both as distinct entries and only the id matching
       playerCountryId(g.homeRole) gets the live econ substituted in (see
       seatsFromWorld in worldTrade.ts). Indexing by the raw role would
       silently read "home"'s stale/static profile entry instead. */
    const playerId = playerCountryId(homeRole);
    const vols = anchors.map((r) =>
      routeVolume(
        g,
        playerId,
        r.partnerId,
        COUNTRIES.find((c) => c.id === r.partnerId)?.tradeShare || 0,
      ),
    );
    const maxVol = Math.max(0, ...vols);
    const rel = g?.rel || {};
    const specs: FleetSpec[] = anchors.map((r, i) => {
      /* One reading of trade volume drives both how many ships a route
         carries and how big they are. */
      const { count, rel: share } = bucketRoute(vols[i], maxVol);
      const vessel = vesselForVolume(share);
      return {
        partnerId: r.partnerId,
        home: r.home,
        partner: r.partner,
        model: vessel.key,
        hull: vessel.hull,
        count,
        periodS: periodForDistance(routeDistance(r.homeNorm, r.partnerNorm)),
        tint: relationTint(rel[r.partnerId] ?? 50),
        phase: routePhaseSeed(r.partnerId),
      };
    });
    fleet.set(specs);
  }, [ready, setupMode, tick, homeRole, routeAnchors]);

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
        return;
      }
    }

    const hit = pickAt(e.clientX, e.clientY);
    const nextRole = hit ? (setupMode ? hit.pickRole : hit.role) : null;
    const nextIso = hit && setupMode ? hit.iso : null;
    if (nextRole !== hoverRoleRef.current || nextIso !== hoverIsoRef.current) {
      hoverRoleRef.current = nextRole;
      hoverIsoRef.current = nextIso;
      const canPick = setupMode ? !!hit?.pickRole : !!hit?.role;
      setCursor(canPick ? "pointer" : "grab");
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
      className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_45%,#57685a_0%,#3c4a3f_58%,#1b130c_100%)]"
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
        className="absolute inset-0 block size-full cursor-grab [filter:sepia(0.14)_saturate(0.82)_contrast(1.07)_brightness(1.02)]"
        aria-label={
          setupMode ? "Choose your country on the world map" : "World map"
        }
      />
      {/* Screen-anchored warm glow — the radial lift the flat map painted
          into its ocean, kept in screen space so it stays centred as the
          camera moves rather than sliding around the board. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(70,51,27,.5)_0%,rgba(8,5,3,0)_72%)] mix-blend-soft-light"
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
    </div>
  );
}
