/**
 * Kenney tokens planted next to a capital: envoy (mini businessman),
 * summit tent, protest bang, sanctions target; ultimatums get a saltire
 * of swords.
 * Scenery only — handed a list of specs, never reads game state.
 */

import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from "three";
import {
  LAND_HEIGHT,
  LAND_PLANT_SINK,
  WRAP_OFFSETS,
} from "../../lib/map/projection.ts";
import {
  instantiateModel,
  disposeObject,
  type ModelKey,
} from "./models.ts";

export const DIPLO_PROPS_REV = 12;

export type DiploKind =
  | "envoy"
  | "summit"
  | "protest"
  | "sanctions"
  | "ultimatum";

export interface DiploPropSpec {
  key: string;
  kind: DiploKind;
  x: number;
  z: number;
  lift: number;
}

export interface DiploProps {
  group: Group;
  setProps: (specs: DiploPropSpec[]) => void;
  dispose: () => void;
}

const MODEL_FOR: Record<Exclude<DiploKind, "ultimatum" | "protest">, ModelKey> = {
  envoy: "envoy",
  summit: "tent",
  sanctions: "target",
};

/** World-unit height. The envoy is a person, a little taller than the
 *  capital cluster so he reads at atlas zoom; tent stays camp-scale; the
 *  bang and target are readable slabs; swords match. */
const HEIGHT: Record<DiploKind, number> = {
  envoy: 1.12,
  summit: 0.72,
  protest: 1.05,
  sanctions: 0.95,
  ultimatum: 0.95,
};

const WOOD = 0x5c4030;
const RED = 0xff453a;
const RUST = 0x8a3c28;
const STEEL = 0xd8cbb8;

/** Yaw so the readable face points at the atlas camera (looking from +Z).
 *  The OBJ-baked envoy already faces +Z. The blaster target's printed
 *  face is −X. */
const YAW: Partial<Record<DiploKind, number>> = {
  sanctions: Math.PI / 2,
};

const SWORD_GEOM = {
  blade: new BoxGeometry(0.055, 0.7, 0.014),
  tip: new ConeGeometry(0.038, 0.11, 4),
  guard: new BoxGeometry(0.22, 0.032, 0.038),
  grip: new BoxGeometry(0.042, 0.15, 0.042),
  pommel: new BoxGeometry(0.07, 0.045, 0.07),
};

function plantY(lift: number): number {
  return LAND_HEIGHT + lift - LAND_PLANT_SINK;
}

function footDepthMaterial(footY: number, spanY: number): MeshDepthMaterial {
  const m = new MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFootY = { value: footY };
    shader.uniforms.uSpanY = { value: Math.max(spanY, 1e-4) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uFootY;
         uniform float uSpanY;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float above = clamp((transformed.y - uFootY) / uSpanY, 0.0, 1.0);
         float fat = mix(3.4, 1.0, smoothstep(0.0, 0.42, above));
         transformed.x *= fat;
         transformed.z *= fat;`,
      );
  };
  m.customProgramCacheKey = () => "map-diplo-foot-depth-v1";
  return m;
}

function sourceMaterial(child: Mesh): MeshStandardMaterial | MeshLambertMaterial | null {
  const src = Array.isArray(child.material) ? child.material[0] : child.material;
  if (src instanceof MeshStandardMaterial || src instanceof MeshLambertMaterial) {
    return src;
  }
  return null;
}

function attachFootDepth(child: Mesh) {
  child.geometry.computeBoundingBox();
  const box = child.geometry.boundingBox;
  const spanY = box ? box.max.y - box.min.y : 1;
  const footY = box ? Math.min(0, box.min.y) : 0;
  child.customDepthMaterial = footDepthMaterial(footY, spanY);
}

/** Keep the Kenney atlas. Flattening by vertex albedo paints a whole
 *  textured mesh one colour (the old flag went brown; the board and
 *  barrier lost their signs and stripes). */
function styleTextured(root: Object3D, kind: DiploKind) {
  const twoSided = kind === "summit" || kind === "sanctions";
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const src = sourceMaterial(child);
    child.material = new MeshLambertMaterial({
      map: src && "map" in src ? src.map : null,
      color: 0xffffff,
      ...(twoSided ? { side: DoubleSide } : {}),
      shadowSide: DoubleSide,
    });
    child.castShadow = true;
    child.receiveShadow = true;
    if (!(child instanceof SkinnedMesh)) attachFootDepth(child);
  });
}

function styleDiplo(root: Object3D, kind: DiploKind) {
  const yaw = YAW[kind];
  if (yaw) {
    root.rotation.y = yaw;
    root.updateMatrixWorld(true);
  }
  styleTextured(root, kind);
}

function fitHeight(obj: Object3D, height: number): number {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  return size.y > 1e-6 ? height / size.y : 1;
}

function lambert(hex: number): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: hex, shadowSide: DoubleSide });
}

function mesh(
  geom: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry,
  mat: MeshLambertMaterial,
  y: number,
): Mesh {
  const m = new Mesh(geom, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  geom.computeBoundingBox();
  const box = geom.boundingBox;
  const spanY = box ? box.max.y - box.min.y : 1;
  const footY = box ? Math.min(0, box.min.y) : 0;
  m.customDepthMaterial = footDepthMaterial(footY, spanY);
  return m;
}

/** Standing bang — volumetric so it still reads at atlas zoom. */
function makeExclamation(): Object3D {
  const ink = lambert(RED);
  const stemH = 0.56;
  const gap = 0.16;
  const dotR = 0.09;
  const dot = mesh(new SphereGeometry(dotR, 8, 6), ink, dotR);
  const stem = mesh(
    new CylinderGeometry(0.07, 0.085, stemH, 8),
    ink,
    dotR * 2 + gap + stemH / 2,
  );
  const root = new Group();
  root.rotation.y = 0.18;
  root.add(stem, dot);
  return root;
}

/** Heraldic saltire of two short swords — atlas-scale, not a Kenney prop. */
function makeCrossedSwords(): Object3D {
  const steel = lambert(STEEL);
  const wood = lambert(WOOD);
  const wrap = lambert(RUST);
  const one = () => {
    const g = new Group();
    g.add(
      mesh(SWORD_GEOM.blade, steel, 0.4),
      mesh(SWORD_GEOM.tip, steel, 0.805),
      mesh(SWORD_GEOM.guard, wood, 0.07),
      mesh(SWORD_GEOM.grip, wrap, -0.025),
      mesh(SWORD_GEOM.pommel, wood, -0.12),
    );
    return g;
  };
  const a = one();
  const b = one();
  a.rotation.z = 0.48;
  b.rotation.z = -0.48;
  const root = new Group();
  root.rotation.y = 0.35;
  root.add(a, b);
  return root;
}

function instantiateClone(src: Object3D): Object3D {
  const copy = src.clone(true);
  copy.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((m) => m.clone())
      : child.material.clone();
  });
  return copy;
}

export function createDiploProps(): DiploProps {
  const group = new Group();
  let disposed = false;
  let gen = 0;
  let propKey = "";
  let nodes: Object3D[] = [];
  const lifts = new Map<string, number>();

  const drop = () => {
    const seen = new Set<object>();
    for (const node of nodes) {
      node.removeFromParent();
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.customDepthMaterial?.dispose();
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const m of mats) {
          if (seen.has(m)) continue;
          seen.add(m);
          m.dispose();
        }
      });
    }
    nodes = [];
  };

  const setProps = (specs: DiploPropSpec[]) => {
    const key = specs.map((s) => s.key).join("|");
    for (const spec of specs) lifts.set(spec.key, spec.lift);
    if (key === propKey) {
      for (const node of nodes) {
        const k = node.userData.diploKey as string;
        node.position.y = plantY(lifts.get(k) ?? 0);
      }
      return;
    }
    propKey = key;
    const thisGen = ++gen;
    drop();
    if (!specs.length) return;
    void (async () => {
      const templates = new Map<DiploKind, { root: Object3D; scale: number }>();
      try {
        const kinds = [...new Set(specs.map((s) => s.kind))];
        for (const kind of kinds) {
          const root =
            kind === "ultimatum"
              ? makeCrossedSwords()
              : kind === "protest"
                ? makeExclamation()
                : await instantiateModel(MODEL_FOR[kind]);
          if (disposed || thisGen !== gen) {
            disposeObject(root);
            return;
          }
          if (kind !== "ultimatum" && kind !== "protest") styleDiplo(root, kind);
          templates.set(kind, {
            root,
            scale: fitHeight(root, HEIGHT[kind]),
          });
        }
      } catch (err) {
        console.warn("WorldMap3D: diplo prop failed to load", err);
        return;
      }
      const box = new Box3();
      for (const spec of specs) {
        if (disposed || thisGen !== gen) return;
        const tmpl = templates.get(spec.kind);
        if (!tmpl) continue;
        const piece = instantiateClone(tmpl.root);
        piece.scale.setScalar(tmpl.scale);
        piece.position.set(0, 0, 0);
        piece.updateMatrixWorld(true);
        box.setFromObject(piece);
        piece.position.y = -box.min.y;
        const token = new Group();
        token.add(piece);
        for (let t = 0; t < WRAP_OFFSETS.length; t++) {
          const inst = t === 0 ? token : token.clone(true);
          inst.position.set(
            spec.x + WRAP_OFFSETS[t]!,
            plantY(spec.lift),
            spec.z,
          );
          inst.userData.diploKey = spec.key;
          group.add(inst);
          nodes.push(inst);
        }
      }
      for (const tmpl of templates.values()) disposeObject(tmpl.root);
    })();
  };

  const dispose = () => {
    disposed = true;
    gen++;
    drop();
    group.clear();
  };

  return { group, setProps, dispose };
}
