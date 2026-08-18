/**
 * The boats. Owns every trade-route vessel in the scene: instantiating the
 * GLTF, cloning it to each wrap tile, tinting it by relation, and walking
 * it along its route's ground track every frame.
 *
 * Handed plain render specs by WorldMap3D — no game state is read here (see
 * the map module's "no game logic" rule in CLAUDE.md); boats.ts turns
 * G.worldTrade / G.rel into the numbers this consumes.
 */

import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Scene,
} from "three";
import { WRAP_OFFSETS, worldToBoard } from "../../lib/map/projection.ts";
import { bezier3, bezierHeading, type Vec3 } from "./boats.ts";
import type { ModelKey } from "./models.ts";
import { OPEN_SEA, type LandMask } from "./landMask.ts";
import { routeCurveControl } from "./routes.ts";
import {
  cloneModelInstance,
  disposeObject,
  instantiateModel,
} from "./models.ts";

/** Boats ride just clear of the sea plane so they never z-fight it. The
 *  models are authored with their keel at the origin, so this floats the
 *  hull rather than burying it. */
const BOAT_Y = 0.18;

/** Recurring per-lap fade near each capital. Short on purpose — a brief cue
 *  at the ends, not a fade spread over a big chunk of the crossing (see
 *  FADE_FRAC_MAX). There is deliberately no separate spawn fade:
 *  MeshStandardMaterial on the transparent path washes the relation tint
 *  and reads as a wrong colour for the first fraction of a second. */
const BOAT_FADE_MS = 350;
/** Upper bound on the fraction of a lap spent fading at *each* end — without
 *  this, a short route could spend a large chunk of its whole crossing
 *  fading rather than fully visible. */
const FADE_FRAC_MAX = 0.12;

/** Seconds a ship takes to fade out as it crosses a coastline inland, and
 *  back in when it reaches water. Routes are Béziers between capitals, so
 *  many of them cut over continents; a ship is hull-deep in the terrain
 *  there but its masts still stand above it. Fading rather than cutting
 *  keeps that from reading as ships blinking on and off at every coast. */
const LAND_FADE_S = 0.45;

export interface FleetSpec {
  partnerId: string;
  /** World ground anchors, partner end already wrap-adjusted to the short
   *  way round the board. */
  home: Vec3;
  partner: Vec3;
  /** Which vessel class this route carries, and the world-unit hull length
   *  its model is normalised to — see VESSEL_CLASSES in boats.ts. */
  model: ModelKey;
  hull: number;
  /** How many vessels this route carries, and how long one lap takes. */
  count: number;
  periodS: number;
  /** Relation colour-multiply, from boats.ts's relationTint(). */
  tint: number;
  /** Deterministic [0,1) lap phase for the route's first boat. */
  phase: number;
}

interface Boat {
  tiles: Object3D[];
  periodS: number;
  phaseOffset: number;
  /** 1 at sea, 0 fully inland — eased, see LAND_FADE_S. */
  seaFade: number;
}

interface Route {
  partnerId: string;
  home: Vec3;
  partner: Vec3;
  /** Curve control point, cached: it depends only on the anchors. */
  control: Vec3;
  tint: number;
  model: ModelKey;
  boats: Boat[];
}

export interface Fleet {
  /** Reconcile the fleet against a fresh set of route specs, keeping every
   *  boat that is still wanted. Model loading is async, so calls supersede
   *  each other by generation — a stale run drops whatever it has made. */
  set: (specs: FleetSpec[]) => void;
  /** Advance every boat. `nowS` is monotonic seconds. */
  update: (nowS: number, dtS: number) => void;
  dispose: () => void;
}

/** Uniform scale that makes `obj` `hull` world units from bow to stern.
 *  Measured along z, the assets' length axis, rather than off the largest
 *  dimension of the bounding box — these ships are taller (masts) than they
 *  are long, so normalising the longest axis would scale every class to the
 *  same rigging height and leave the hulls stubby and indistinguishable. */
function fitScale(obj: Object3D, hull: number): number {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  return size.z > 1e-6 ? hull / size.z : 1;
}

function tintMesh(obj: Object3D, factor: number) {
  obj.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    let base = child.userData.baseColor;
    /* Object3D.clone JSON-round-trips userData, turning a Color into a
     *  plain {r,g,b}. cloneModelInstance rehydrates it; anything that
     *  reaches here without one captures its own base once, from an
     *  untinted material. */
    for (const mat of mats) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (!base || typeof base.r !== "number") {
        base = mat.color.clone();
        child.userData.baseColor = base;
      }
      mat.color.setRGB(base.r, base.g, base.b).multiplyScalar(factor);
    }
  });
}

function setOpacity(obj: Object3D, opacity: number) {
  const o = opacity >= 0.999 ? 1 : Math.max(0, opacity);
  obj.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      /* Only mark transparent while fading — opacity 1 on a transparent
       *  material still takes the transparent render path and reads
       *  noticeably darker against the board. */
      mat.opacity = o;
      mat.transparent = o < 1;
      mat.depthWrite = o >= 1;
    }
  });
}

export function createFleet(scene: Scene, land: LandMask = OPEN_SEA): Fleet {
  const routes = new Map<string, Route>();
  let generation = 0;
  let disposed = false;

  const drop = (obj: Object3D) => {
    obj.removeFromParent();
    disposeObject(obj);
  };

  const clear = () => {
    for (const route of routes.values()) {
      for (const boat of route.boats) boat.tiles.forEach(drop);
    }
    routes.clear();
  };

  const set = (specs: FleetSpec[]) => {
    /* Diffed, not rebuilt. `tick` bumps on every UI edit as well as every
       quarter, and tearing the fleet down each time would restart every
       boat at its phase offset — routes would visibly stutter back to the
       start whenever the player touched a slider. */
    const gen = ++generation;
    const wanted = new Set(specs.map((s) => s.partnerId));
    for (const [partnerId, route] of routes) {
      if (wanted.has(partnerId)) continue;
      for (const boat of route.boats) boat.tiles.forEach(drop);
      routes.delete(partnerId);
    }

    void (async () => {
      for (const spec of specs) {
        let route = routes.get(spec.partnerId);
        if (!route) {
          route = {
            partnerId: spec.partnerId,
            home: spec.home,
            partner: spec.partner,
            control: routeCurveControl(spec.home, spec.partner, false),
            tint: spec.tint,
            model: spec.model,
            boats: [],
          };
          /* Registered before its boats exist, so a dispose() or a
             superseding set() during the awaits below still owns (and
             disposes) whatever has been added so far. */
          routes.set(spec.partnerId, route);
        } else {
          route.home = spec.home;
          route.partner = spec.partner;
          route.control = routeCurveControl(spec.home, spec.partner, false);
          if (route.model !== spec.model) {
            /* The route changed vessel class (its share of world trade moved
               across a bucket edge). Nothing about an existing hull can be
               re-used, so drop them and let the loop below re-spawn. */
            for (const boat of route.boats) boat.tiles.forEach(drop);
            route.boats = [];
            route.model = spec.model;
          }
        }

        while (route.boats.length > spec.count) {
          route.boats.pop()?.tiles.forEach(drop);
        }
        for (const boat of route.boats) {
          boat.periodS = spec.periodS;
          if (spec.tint !== route.tint) {
            for (const inst of boat.tiles) tintMesh(inst, spec.tint);
          }
        }
        route.tint = spec.tint;

        while (route.boats.length < spec.count) {
          const index = route.boats.length;
          let model: Object3D;
          try {
            model = await instantiateModel(spec.model);
          } catch (err) {
            console.warn("WorldMap3D: ship model failed to load", err);
            return;
          }
          if (disposed || gen !== generation) {
            disposeObject(model);
            return;
          }
          tintMesh(model, spec.tint);
          const scale = fitScale(model, spec.hull);
          model.scale.setScalar(scale);
          model.visible = false;
          const tiles = WRAP_OFFSETS.map((dx, t) => {
            const inst = t === 0 ? model : cloneModelInstance(model);
            if (inst !== model) {
              tintMesh(inst, spec.tint);
              inst.scale.setScalar(scale);
              inst.visible = false;
            }
            inst.userData.tileOffset = dx;
            scene.add(inst);
            return inst;
          });
          route.boats.push({
            tiles,
            periodS: spec.periodS,
            phaseOffset: (spec.phase + index / Math.max(1, spec.count)) % 1,
            seaFade: 1,
          });
        }
      }
    })();
  };

  const update = (nowS: number, dtS: number) => {
    const step = dtS > 0 ? Math.min(1, dtS / LAND_FADE_S) : 1;
    for (const route of routes.values()) {
      for (const boat of route.boats) {
        const t = (((nowS / boat.periodS + boat.phaseOffset) % 1) + 1) % 1;
        const fadeFrac = Math.min(
          FADE_FRAC_MAX,
          BOAT_FADE_MS / 1000 / boat.periodS,
        );
        const lapFade =
          t < fadeFrac
            ? t / fadeFrac
            : t > 1 - fadeFrac
              ? (1 - t) / fadeFrac
              : 1;
        const p = bezier3(route.home, route.control, route.partner, t);
        const [nx, ny] = worldToBoard(p.x, p.z);
        const target = land.at(nx, ny) ? 0 : 1;
        boat.seaFade += (target - boat.seaFade) * step;
        const opacity = lapFade * boat.seaFade;
        const heading = bezierHeading(
          route.home,
          route.control,
          route.partner,
          t,
        );
        for (const inst of boat.tiles) {
          if (opacity <= 0.01) {
            inst.visible = false;
            continue;
          }
          inst.position.set(
            p.x + (inst.userData.tileOffset as number),
            BOAT_Y,
            p.z,
          );
          inst.rotation.y = heading;
          setOpacity(inst, opacity);
          inst.visible = true;
        }
      }
    }
  };

  const dispose = () => {
    disposed = true;
    generation++;
    clear();
  };

  return { set, update, dispose };
}
