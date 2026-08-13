"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { activePartners, getG, playerCountryId } from "../../lib/sim/engine.ts";
import { COUNTRIES, type Country } from "../../lib/sim/countries.ts";
import { HOME_ISO } from "../../lib/sim/partners.ts";
import { project, toScreen, wrapDelta } from "../../lib/map/projection.ts";
import type { WorldMapHandle } from "../map2d/WorldMap.tsx";
import {
  clearModelCache,
  cloneModelInstance,
  disposeObject,
  instantiateModel,
} from "./models.ts";
import {
  bucketRoute,
  periodForDistance,
  relationTint,
  routeDistance,
  routePhaseSeed,
  routeVolume,
  tradeCurvePoint,
} from "./boats.ts";

interface Map3DOverlayProps {
  /** Read-only handle onto the 2D map's live pan/zoom — this overlay owns no
   *  view state of its own and reprojects through the same math every frame
   *  so it can never drift out of sync with the 2D canvas underneath. */
  worldMapRef: RefObject<WorldMapHandle | null>;
  homeIso?: string | null;
  homeRole?: string;
  /** Re-samples boat counts/tints when the shell bumps (quarter advance,
   *  MP poll, UI edit). Spawn work is cancel-safe — see the boat effect. */
  tick?: number;
}

/** Boats start with one mesh and grow wrap-tile clones in the RAF loop to
 *  match whatever `repeatOffsets` the 2D map currently returns — no fixed
 *  MAX_TILES cap that can undershoot a wide zoomed-out viewport. Capital
 *  markers are a 2D vector glyph drawn by WorldMap.tsx; this overlay only
 *  handles boats. */
const BOAT_SCALE = 0.5;
/** Fixed lean applied to every boat instance so the 3D layer doesn't read as
 *  completely flat/top-down, without touching the camera itself — the 2D
 *  canvas underneath stays genuinely flat, so tilting the *camera* would
 *  misalign 3D objects against it. Rotating each instance around its own
 *  local X axis instead keeps its anchor point (local origin, what
 *  toScreen() positions every frame) exactly pinned to the correct screen
 *  pixel; only the geometry around that anchor leans. Applied once at
 *  creation — composes cleanly with the per-frame heading rotation.z set on
 *  the same object, since Object3D's Euler recomputes the quaternion from
 *  all three components together. */
const MODEL_TILT_X = 0.85; // ~49°

interface BoatInstance {
  tiles: THREE.Object3D[];
  periodS: number;
  phaseOffset: number;
  /** Relation multiply currently applied — re-used when syncBoatTiles grows
   *  wrap copies from the untinted base so they match the prototype. */
  tint: number;
}

/** Recurring per-lap fade near each capital. Short on purpose — a brief cue
 *  at the ends, not a fade spread over a big chunk of the crossing (see
 *  FADE_FRAC_MAX). Spawn no longer opacity-fades: MeshStandardMaterial on
 *  the transparent path washes the relation tint and reads as a wrong
 *  colour for the first fraction of a second. */
const BOAT_FADE_MS = 350;
/** Upper bound on the fraction of a lap spent fading at *each* end — without
 *  this, a short route (BOAT_MIN_PERIOD_S) could spend a large chunk of its
 *  whole crossing fading rather than fully visible. */
const FADE_FRAC_MAX = 0.12;

function setOpacity(obj: THREE.Object3D, opacity: number) {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const o = opacity >= 0.999 ? 1 : Math.max(0, opacity);
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      /* Only mark transparent while fading — opacity 1 on a transparent
       *  material still takes the transparent render path and reads
       *  noticeably darker against the map. */
      mat.opacity = o;
      mat.transparent = o < 1;
      mat.depthWrite = o >= 1;
    }
  });
}

function removeAndDispose(scene: THREE.Scene, obj: THREE.Object3D) {
  scene.remove(obj);
  disposeObject(obj);
}

interface BoatRoute {
  partnerId: string;
  /** Same capital-derived anchor points the 2D trade lines and capital
   *  markers use — a boat departs and arrives where the dashed line ends,
   *  so the layers read as one consistent scene. */
  homeNx: number;
  homeNy: number;
  nx: number;
  ny: number;
  boats: BoatInstance[];
}

function homeCountry(homeIso?: string | null): Country | undefined {
  return COUNTRIES.find((c) => c.iso === (homeIso || HOME_ISO));
}

function tintMesh(obj: THREE.Object3D, factor: number) {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    let base = child.userData.baseColor as THREE.Color | undefined;
    /* Object3D.clone JSON-round-trips userData, turning Color into a plain
     *  {r,g,b}. Rehydrate so copy() always sees a real Color, and so a
     *  missing/corrupt base can't be re-captured from an already-tinted
     *  albedo (which is what made wrap-tile clones compound darker). */
    if (base && !(base instanceof THREE.Color)) {
      const raw = base as unknown as { r: number; g: number; b: number };
      base =
        typeof raw.r === "number"
          ? new THREE.Color(raw.r, raw.g, raw.b)
          : undefined;
      child.userData.baseColor = base;
    }
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (!base) {
        base = mat.color.clone();
        child.userData.baseColor = base;
      }
      mat.color.copy(base).multiplyScalar(factor);
    }
  });
}

/** Grow/shrink a boat's wrap-tile copies so every current map offset has a
 *  mesh. Clones the first tile synchronously (no GLTF re-fetch), resets to
 *  the untinted base, then applies this boat's tint once. */
function syncBoatTiles(
  scene: THREE.Scene,
  boat: BoatInstance,
  offsetCount: number,
) {
  const proto = boat.tiles[0];
  if (!proto) return;
  while (boat.tiles.length < offsetCount) {
    const copy = cloneModelInstance(proto);
    tintMesh(copy, boat.tint);
    copy.visible = false;
    scene.add(copy);
    boat.tiles.push(copy);
  }
  while (boat.tiles.length > Math.max(1, offsetCount)) {
    const extra = boat.tiles.pop();
    if (extra) removeAndDispose(scene, extra);
  }
}

export default function Map3DOverlay({
  worldMapRef,
  homeIso,
  homeRole = "home",
  tick,
}: Map3DOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const routesRef = useRef<BoatRoute[]>([]);
  const rafRef = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  /* WebGL init + its own RAF loop, independent of the 2D canvas's on-demand
   *  paint() — that one only repaints on interaction, but marker/boat
   *  positions here must track pan/zoom and elapsed time continuously. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch (err) {
      console.warn("Map3DOverlay: WebGL unavailable, 3D layer disabled", err);
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    /* Mostly front-on (world +Z, toward the camera) since the top-down
     *  camera sees each object's camera-facing surface almost head-on — a
     *  light angled off to the side under-lights that face instead of
     *  giving it definition. A small XY offset keeps a bit of shading. */
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(0.25, 0.35, 1);
    scene.add(sun);

    /* near/far and camera distance are generous on purpose: models map their
     *  "height" axis onto world Z (see AXIS_CORRECTIONS in models.ts) so it
     *  foreshortens under this top-down view, but that still puts real
     *  geometry tens to hundreds of units deep once scaled up (BOAT_SCALE
     *  etc). A tight near plane silently clips that geometry — the ship
     *  hull's deck and its cargo containers disappeared entirely at
     *  camera.z=10/near=0.1 once BOAT_SCALE made the hull's own height
     *  exceed ~10 units, leaving only the thin unclipped sliver near its own
     *  local z=0 visible. Orthographic projection size is independent of
     *  camera distance (unlike perspective), so pushing the camera back and
     *  widening near/far costs nothing visually and gives headroom for any
     *  future model/scale. */
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 1, 4000);
    camera.position.set(0, 0, 2000);
    cameraRef.current = camera;

    let cancelled = false;
    const tickFrame = () => {
      if (cancelled) return;
      const canvasEl = canvasRef.current;
      const viewport = worldMapRef.current?.getViewport();
      if (canvasEl && viewport && rendererRef.current && cameraRef.current) {
        const { W, H, offsets, scale } = viewport;
        canvasEl.style.width = W + "px";
        canvasEl.style.height = H + "px";
        rendererRef.current.setSize(W, H, false);
        const cam = cameraRef.current;
        cam.left = 0;
        cam.right = W;
        cam.top = 0; // screen-pixel Y: top of frustum = y=0 = top of screen
        cam.bottom = H;
        cam.updateProjectionMatrix();

        const bulge = H * 0.03 * scale;
        const now = performance.now() / 1000;
        for (const route of routesRef.current) {
          for (const boat of route.boats) {
            syncBoatTiles(scene, boat, offsets.length);
            const t = (((now / boat.periodS + boat.phaseOffset) % 1) + 1) % 1;
            /* Opacity fade only at the capitals — a mid-route spawn fade
             *  put MeshStandardMaterial on the transparent path and washed
             *  the relation tint for the first ~BOAT_FADE_MS. */
            const fadeFrac = Math.min(
              FADE_FRAC_MAX,
              BOAT_FADE_MS / 1000 / boat.periodS,
            );
            const opacity =
              t < fadeFrac
                ? t / fadeFrac
                : t > 1 - fadeFrac
                  ? (1 - t) / fadeFrac
                  : 1;
            for (let i = 0; i < boat.tiles.length; i++) {
              const inst = boat.tiles[i];
              const dx = offsets[i];
              if (dx == null) {
                inst.visible = false;
                continue;
              }
              const h = toScreen(route.homeNx, route.homeNy, dx, viewport);
              const p = toScreen(route.nx, route.ny, dx, viewport);
              const pt = tradeCurvePoint(
                { x: h[0], y: h[1] },
                { x: p[0], y: p[1] },
                bulge,
                t,
              );
              inst.position.set(pt.x, pt.y, 0);
              inst.scale.setScalar(BOAT_SCALE * scale);
              inst.rotation.z = pt.angle;
              setOpacity(inst, opacity);
              inst.visible = true;
            }
          }
        }

        rendererRef.current.render(scene, cam);
      }
      rafRef.current = requestAnimationFrame(tickFrame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tickFrame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    rafRef.current = requestAnimationFrame(tickFrame);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          /* Materials are cloned per instance — safe to dispose. Geometry is
           *  shared with the GLTF template cache; disposing it here blackens
           *  every boat after a remount (Fast Refresh / re-enter play). */
          const mat = obj.material;
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      clearModelCache();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [worldMapRef]);

  /* Boat-route skeletons: rebuilt only when the active partner set or home
   *  identity changes, kept separate from the render loop above so a
   *  homeRole/homeIso change doesn't tear down WebGL. */
  useEffect(() => {
    if (failed) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const home = homeCountry(homeIso);

    const routes: BoatRoute[] = home?.capital
      ? activePartners(homeRole)
          .filter((p) => p.capital)
          .map((p) => {
            const [hnx, hny] = project(home.capital.lng, home.capital.lat);
            const [rawNx, ny] = project(p.capital.lng, p.capital.lat);
            // Short way round the wrap, not straight across the whole
            // plate — see wrapDelta's own doc comment.
            const nx = hnx + wrapDelta(hnx, rawNx);
            return {
              partnerId: p.id,
              homeNx: hnx,
              homeNy: hny,
              nx,
              ny,
              boats: [],
            };
          })
      : [];
    routesRef.current = routes;

    return () => {
      for (const route of routesRef.current) {
        for (const boat of route.boats) {
          for (const inst of boat.tiles) removeAndDispose(scene, inst);
        }
      }
      routesRef.current = [];
    };
  }, [homeIso, homeRole, failed]);

  /* Boat instance counts/speeds: re-sampled when tick bumps (quarter or MP
   *  poll). Cancel must dispose any in-flight meshes that were already
   *  scene.add'd — otherwise a mid-spawn bump (common under MP polling)
   *  leaks orphan boats until the overlay unmounts. */
  useEffect(() => {
    if (failed) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const routes = routesRef.current;
    if (!routes.length) return;
    let cancelled = false;
    /** Meshes added this run but not yet owned by a BoatInstance — cleaned
     *  on cancel / load failure so they never become scene orphans. */
    const pending: THREE.Object3D[] = [];

    const discardPending = () => {
      for (const obj of pending) removeAndDispose(scene, obj);
      pending.length = 0;
    };

    const g = getG();
    /* g.worldTrade is keyed by real country ids (from NATION_PROFILE/
     *  worldSeatIds), not raw role strings — the default "home" role's
     *  live data actually lives under "kingdom" (playerCountryId("home")),
     *  since NATION_PROFILE has both as distinct entries and only the id
     *  matching playerCountryId(g.homeRole) gets the live econ substituted
     *  in (see seatsFromWorld in worldTrade.ts). Indexing by the raw role
     *  would silently read "home"'s stale/static profile entry instead. */
    const playerId = playerCountryId(homeRole);
    const vols = routes.map((r) =>
      routeVolume(
        g,
        playerId,
        r.partnerId,
        COUNTRIES.find((c) => c.id === r.partnerId)?.tradeShare || 0,
      ),
    );
    const maxVol = Math.max(0, ...vols);
    const rel = g?.rel || {};

    (async () => {
      for (let ri = 0; ri < routes.length; ri++) {
        if (cancelled) {
          discardPending();
          return;
        }
        const route = routes[ri];
        const { count } = bucketRoute(vols[ri], maxVol);
        const tint = relationTint(rel[route.partnerId] ?? 50);
        const periodS = periodForDistance(
          routeDistance([route.homeNx, route.homeNy], [route.nx, route.ny]),
        );

        while (route.boats.length > count) {
          const extra = route.boats.pop();
          extra?.tiles.forEach((inst) => removeAndDispose(scene, inst));
        }
        for (const boat of route.boats) {
          boat.periodS = periodS;
          boat.tint = tint;
          boat.tiles.forEach((inst) => tintMesh(inst, tint));
        }
        while (route.boats.length < count) {
          let model: THREE.Object3D;
          try {
            model = await instantiateModel("boat");
          } catch (err) {
            console.warn("Map3DOverlay: boat model failed to load", err);
            discardPending();
            setFailed(true);
            return;
          }
          if (cancelled) {
            disposeObject(model);
            discardPending();
            return;
          }
          model.rotation.x = MODEL_TILT_X;
          model.visible = false;
          tintMesh(model, tint);
          scene.add(model);
          pending.push(model);
          /* Ownership transfers from pending → route.boats. RAF grows
           *  wrap-tile clones from this prototype as offsets demand. */
          const owned = pending.pop();
          if (!owned) return;
          route.boats.push({
            tiles: [owned],
            periodS,
            tint,
            phaseOffset:
              (routePhaseSeed(route.partnerId) +
                route.boats.length / Math.max(1, count)) %
              1,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      discardPending();
    };
  }, [tick, homeIso, homeRole, failed]);

  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
