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
import { WRAP_OFFSETS } from "../../lib/map/projection.ts";
import { type Vec3 } from "./boats.ts";
import {
  pathAtPrepared,
  prepareSeaPath,
  type SeaPath,
} from "../../lib/map/seaRoutes.ts";
import { seaHeight } from "./sea.ts";
import {
  cloneModelInstance,
  disposeObject,
  instantiateModel,
} from "./models.ts";

/** Hull length in world units (= degrees of longitude). Map-scale rather
 *  than true-scale on purpose: a real ship at this zoom would be a
 *  sub-pixel speck. Applied by measuring the loaded model and normalising
 *  to this length — a raw scale factor would be meaningless, since it means
 *  whatever the artist happened to author the asset at (the current boat's
 *  own units make it about the size of Iberia at scale 1). */
const BOAT_LENGTH = 1.15;
/** How far the keel sits below the local sea surface. The Kenney cargo
 *  ship's origin is the keel and the deck is only ~0.12 after fitScale, so
 *  this is a laden waterline — in the water, not hovering over it, and not
 *  so deep the containers look awash. A flat BOAT_Y above the swell used
 *  to leave more air under the hull than the ship is tall. */
const BOAT_DRAFT = 0.08;

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

export interface FleetSpec {
  partnerId: string;
  /** World-space sea-lane polyline, partner end already wrap-adjusted. */
  path: Vec3[];
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
  /** Model-space keel as world Y at the origin, after fitScale. Kenney's
   *  hull is 0; a centred-origin asset would be negative. Subtracted so
   *  the keel, not the pivot, is what sits at seaHeight − draft. */
  keelY: number;
}

interface Route {
  partnerId: string;
  /** Unwrapped once per set(), not per frame — see prepareSeaPath. */
  path: SeaPath;
  tint: number;
  boats: Boat[];
}

export interface Fleet {
  /** Reconcile the fleet against a fresh set of route specs, keeping every
   *  boat that is still wanted. Model loading is async, so calls supersede
   *  each other by generation — a stale run drops whatever it has made. */
  set: (specs: FleetSpec[]) => void;
  /** Advance every boat. `nowS` is monotonic seconds. */
  update: (nowS: number) => void;
  dispose: () => void;
}

/** Uniform scale that makes `obj`'s longest axis BOAT_LENGTH world units. */
function fitScale(obj: Object3D): number {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  return longest > 1e-6 ? BOAT_LENGTH / longest : 1;
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

export function createFleet(scene: Scene): Fleet {
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
            path: prepareSeaPath(spec.path),
            tint: spec.tint,
            boats: [],
          };
          /* Registered before its boats exist, so a dispose() or a
             superseding set() during the awaits below still owns (and
             disposes) whatever has been added so far. */
          routes.set(spec.partnerId, route);
        } else {
          route.path = prepareSeaPath(spec.path);
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
            model = await instantiateModel("boat");
          } catch (err) {
            console.warn("WorldMap3D: boat model failed to load", err);
            return;
          }
          if (disposed || gen !== generation) {
            disposeObject(model);
            return;
          }
          tintMesh(model, spec.tint);
          const scale = fitScale(model);
          model.scale.setScalar(scale);
          const keelY = new Box3().setFromObject(model).min.y;
          model.visible = false;
          const tiles = WRAP_OFFSETS.map((dx, t) => {
            const inst = t === 0 ? model : cloneModelInstance(model);
            if (inst !== model) {
              tintMesh(inst, spec.tint);
              inst.scale.setScalar(scale);
              inst.visible = false;
            }
            inst.userData.tileOffset = dx;
            inst.traverse((child) => {
              if (child instanceof Mesh) child.castShadow = true;
            });
            scene.add(inst);
            return inst;
          });
          route.boats.push({
            tiles,
            periodS: spec.periodS,
            phaseOffset: (spec.phase + index / Math.max(1, spec.count)) % 1,
            keelY,
          });
        }
      }
    })();
  };

  const update = (nowS: number) => {
    for (const route of routes.values()) {
      for (const boat of route.boats) {
        const t = (((nowS / boat.periodS + boat.phaseOffset) % 1) + 1) % 1;
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
        const p = pathAtPrepared(route.path, t);
        for (const inst of boat.tiles) {
          const x = p.x + (inst.userData.tileOffset as number);
          inst.position.set(
            x,
            seaHeight(x, p.z, nowS) - BOAT_DRAFT - boat.keelY,
            p.z,
          );
          inst.rotation.y = p.heading;
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
