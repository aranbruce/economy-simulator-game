import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Color, Material, Mesh, MeshStandardMaterial, Object3D } from "three";

export const MODEL_URLS = {
  boat: "/models/boats/boat.glb",
  treeDefault: "/models/trees/tree_default.glb",
  treeCone: "/models/trees/tree_cone.glb",
  treeOak: "/models/trees/tree_oak.glb",
  treePalm: "/models/trees/tree_palm.glb",
  buildingA: "/models/cities/building-a.glb",
  buildingC: "/models/cities/building-c.glb",
  buildingE: "/models/cities/building-e.glb",
  cloudA: "/models/clouds/cloud-a.glb",
  cloudE: "/models/clouds/cloud-e.glb",
  mountainHill: "/models/mountains/hill.glb",
  mountainPeak: "/models/mountains/peak.glb",
  mountainRange: "/models/mountains/range.glb",
  tent: "/models/diplo/tent.glb",
  envoy: "/models/diplo/envoy.glb",
  target: "/models/diplo/target.glb",
} as const;

export type ModelKey = keyof typeof MODEL_URLS;

/** One shared loader + a load-once cache of the parsed template scene per
 *  model, so every instance clones a single GLTF parse rather than
 *  re-fetching and re-parsing the same file per instance. Meshopt decoder
 *  registered up front for any future --compress meshopt asset (see
 *  public/models/NOTICE.md) — harmless no-op for models that don't use it. */
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<ModelKey, Promise<Object3D>>();

export function loadModelTemplate(key: ModelKey): Promise<Object3D> {
  let pending = cache.get(key);
  if (!pending) {
    pending = new Promise<Object3D>((resolve, reject) => {
      loader.load(
        MODEL_URLS[key],
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      );
    });
    cache.set(key, pending);
  }
  return pending;
}

/** Object3D.clone() shares geometry/material by *reference* across every
 *  clone of a template — fine for geometry (never mutated), but each
 *  instance needs its own material so per-instance tinting (relationTint in
 *  WorldMap3D) doesn't mutate every other instance sharing the same GLTF
 *  parse. Without this, tinting one boat compounds onto every other boat
 *  cloned from the same template each time it re-tints, since they'd all be
 *  reading and writing the same shared material.color. */
function cloneMaterials(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((m: Material) => m.clone())
      : child.material.clone();
  });
}

/** Drop a model from the scene and free its GPU resources. Geometry may be
 *  shared across clones of the same GLTF template — only dispose it when
 *  nothing else still references it (Three tracks that via `geometry.dispose`
 *  being safe to call once per unique buffer from our call sites, which each
 *  own their materials but share the template geometry; we therefore dispose
 *  materials always and leave geometry to the template cache lifetime). */
export function disposeObject(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const mat = child.material;
    (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
  });
}

/** Sync clone of an already-instantiated model, with its own materials — used
 *  to grow wrap-tile copies of a boat without re-fetching the GLTF.
 *
 *  Three's Object3D.clone JSON-serialises userData, so a stored `baseColor`
 *  Color becomes a plain `{r,g,b}` — and cloneMaterials snapshots whatever
 *  albedo is currently on the source (often already relation-tinted). Reset
 *  each mesh back to its untinted base so the caller can tint once; otherwise
 *  a later tintMesh treats the darkened colour as the base and compounds. */
export function cloneModelInstance(src: Object3D): Object3D {
  const copy = src.clone(true);
  cloneMaterials(copy);
  copy.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const raw = child.userData.baseColor as
      Color | { r: number; g: number; b: number } | undefined;
    if (!raw || typeof raw.r !== "number") {
      delete child.userData.baseColor;
      return;
    }
    const base = new Color(raw.r, raw.g, raw.b);
    child.userData.baseColor = base;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const m of mats) {
      if (m instanceof MeshStandardMaterial) m.color.copy(base);
    }
  });
  return copy;
}

/** Drop the load-once GLTF template cache. Call when tearing down WebGL so a
 *  later remount (Fast Refresh, leaving play and returning) re-fetches instead
 *  of cloning geometries that were disposed with the old scene. */
export function clearModelCache() {
  cache.clear();
}

/** A ready-to-place instance with its own materials.
 *
 *  No axis correction is applied or needed: the scene is a genuine 3D world
 *  with y up, and every asset in public/models is authored y-up with
 *  -z forward (Kenney boats, trees and buildings; Quaternius clouds).
 *  An asset authored to some other convention would need a per-key
 *  correction quaternion reintroduced here; see public/models/NOTICE.md. */
export async function instantiateModel(key: ModelKey): Promise<Object3D> {
  const template = await loadModelTemplate(key);
  const inner = template.clone(true);
  cloneMaterials(inner);
  return inner;
}
