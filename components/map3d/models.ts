import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  Color,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

export const MODEL_URLS = {
  boat: "/models/boats/boat.glb",
} as const;

export type ModelKey = keyof typeof MODEL_URLS;

/** Map3DOverlay's camera looks straight down world -Z with no tilt, so a
 *  model needs its "forward/length" axis along local X (the per-route
 *  heading rotation in Map3DOverlay rotates around Z assuming that) and its
 *  "up/height" axis along local Z, toward the camera — invisible/
 *  foreshortened there, which is correct for a true top-down view of a
 *  hull or a container's roof. Kenney-style assets are typically authored
 *  Y-up with -Z forward, so remap length(Z)->X, width(X)->Y, height(Y)->Z.
 *  Add an entry here per model key only if that asset needs it — a model
 *  authored directly for this camera would need none. */
const AXIS_CORRECTIONS: Partial<Record<ModelKey, Quaternion>> = {
  boat: new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(1, 0, 0),
    ),
  ),
};

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
 *  Map3DOverlay) doesn't mutate every other instance sharing the same GLTF
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
      | Color
      | { r: number; g: number; b: number }
      | undefined;
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

/** Returns an instance ready to have position/rotation/scale driven
 *  externally with no orientation knowledge required of the caller — any
 *  fixed axis correction is baked into a child, wrapped in an identity
 *  group, so callers can freely rotate the returned object for heading. */
export async function instantiateModel(key: ModelKey): Promise<Object3D> {
  const template = await loadModelTemplate(key);
  const inner = template.clone(true);
  cloneMaterials(inner);
  const correction = AXIS_CORRECTIONS[key];
  if (!correction) return inner;
  inner.quaternion.copy(correction);
  const wrapper = new Group();
  wrapper.add(inner);
  return wrapper;
}
