/**
 * Map dressing that is not terrain, routes or boats: a forest of Kenney
 * trees, Quaternius mountains on real ranges, a handful of capital
 * buildings, and a drift of clouds. All of it is scenery — it never
 * reads game state.
 *
 * Trees follow NASA IGBP forest cover (see lib/map/treeCover.ts), mountains
 * follow SRTM topography (lib/map/mountainCover.ts). Both are instanced
 * per submesh, one InstancedMesh per wrap tile so off-screen copies can
 * frustum-cull. A cloned Object3D per tree would collapse the frame rate
 * the way the old 1,295-node capital scene did. Capitals are a landmark
 * tower on a raised stone plinth, ringed by a dense crowd of low Kenney
 * buildings, few enough to clone. Clouds are Quaternius meshes instanced
 * the same way as the trees, drifting on a shared wind.
 */

import {
  Box3,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  BOARD_H,
  BOARD_W,
  LAND_HEIGHT,
  LAND_PLANT_SINK,
  WRAP_OFFSETS,
} from "../../lib/map/projection.ts";
import { type Polys } from "../../lib/map/geo.ts";
import {
  plantTreesFromCover,
  TREE_COVER_URL,
  type TreeKind,
  type TreeSite,
} from "../../lib/map/treeCover.ts";
import {
  plantMountainsFromCover,
  ELEVATION_URL,
  type MountainKind,
  type MountainSite,
} from "../../lib/map/mountainCover.ts";
import {
  instantiateModel,
  loadModelTemplate,
  disposeObject,
  type ModelKey,
} from "./models.ts";
import { capitalYaw } from "./routes.ts";
import { BORDER_INK } from "./terrain.ts";

export interface SceneryCountry {
  iso: string;
  polys: Polys;
}

export interface SceneryCapital {
  key: string;
  x: number;
  z: number;
  hot: boolean;
  lift: number;
}

export interface SceneryLabelClear {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

/** Bump when capital tokens or scenery look change so WorldMap3D remounts. */
export const SCENERY_REV = 8;

export interface Scenery {
  group: Group;
  setHot: (isoLift: Map<string, number>) => void;
  setCapitals: (specs: SceneryCapital[]) => void;
  setLabelClear: (boxes: SceneryLabelClear[]) => void;
  update: (nowS: number) => void;
  dispose: () => void;
}

const TREE_KEYS: Record<TreeKind, ModelKey> = {
  oak: "treeOak",
  default: "treeDefault",
  cone: "treeCone",
  palm: "treePalm",
};

const BUILDING_KEYS: ModelKey[] = [
  "buildingA",
  "buildingC",
  "buildingE",
  "buildingJ",
  "buildingN",
  "buildingWideA",
  "buildingWideB",
];

const MOUNTAIN_KEYS: Record<MountainKind, ModelKey> = {
  hill: "mountainHill",
  peak: "mountainPeak",
  range: "mountainRange",
};

type CloudKind = "a" | "e";
const CLOUD_KEYS: Record<CloudKind, ModelKey> = {
  a: "cloudA",
  e: "cloudE",
};

/** World-unit height the Kenney trees are normalised to. Map-scale, same
 *  idea as the boats: a real tree at this zoom is invisible. */
const TREE_HEIGHT = 0.7;

/** Quaternius mountains, world units. A little taller than a tree
 *  so a range reads as relief, not a country-sized toy. */
const MOUNTAIN_HEIGHT: Record<MountainKind, number> = {
  hill: 0.8,
  peak: 1.5,
  range: 1,
};

/** Ring of low blocks around the plaza — map glyphs, not a skyline. */
const CITY_FOOTPRINT = 0.7;
/** Uniform shrink on the whole cluster (plinth, buildings). */
const CITY_SCALE = 0.52;
/** Keep trees out of the cluster so trunks do not poke through the plinth. */
const CITY_CLEAR_R = 3.6 * CITY_SCALE;
/** Raised plaza radius, local units before CITY_SCALE — wide enough to hold
 *  a centred tower plus its rings of support blocks. */
const PLATFORM_R = 2.0;
/** Plaza height — tall enough to read as a plinth the buildings stand on,
 *  not a sticker flat on the ground. */
const PLATFORM_H = 0.42;
/** Extra world units around a country name so canopy and peaks sit
 *  clear of the lettering, not under it. Mountains need a wider pad
 *  because the mesh is a bulky footprint, not a trunk. */
const LABEL_CLEAR_PAD_TREE = 0.55;
const LABEL_CLEAR_PAD_MTN = 1.05;

interface CityPiece {
  dx: number;
  dz: number;
  height: number;
  footprint: number;
  tint: number;
  model: ModelKey;
  rot: number;
  /** The centre tower — gets a brighter, less-tinted material so it still
   *  reads as the landmark against a dense crowd. */
  landmark?: boolean;
}

/** Support-ring layout for the plaza, shared with `makePlazaTexture()`
 *  below so the plaza's paving grooves land under the rings of buildings
 *  they're actually paving, not at arbitrary radii. */
const HERO_RINGS = [
  { n: 7, r: 0.82, rSpread: 0.12, hMin: 0.75, hSpread: 0.35 },
  { n: 10, r: 1.18, rSpread: 0.14, hMin: 0.62, hSpread: 0.28 },
  { n: 8, r: 1.52, rSpread: 0.14, hMin: 0.55, hSpread: 0.25 },
];

/** Grayscale paving-and-shadow texture for the plaza top, multiplied by
 *  PLATFORM_TOP_COLOR rather than baking a colour in. Draws a faint groove
 *  under each HERO_RINGS radius (real paving seams, not a flat disc) plus
 *  a soft dark vignette at the centre standing in for the contact shadow a
 *  dense building cluster would actually cast. */
function makePlazaTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const pxPerUnit = (size / 2 / PLATFORM_R) * 0.98;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  for (const ring of HERO_RINGS) {
    const r = ring.r * pxPerUnit;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(40, 32, 20, 0.16)";
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    HERO_RINGS[2]!.r * pxPerUnit * 1.05,
  );
  vignette.addColorStop(0, "rgba(30, 24, 16, 0.4)");
  vignette.addColorStop(0.55, "rgba(30, 24, 16, 0.16)");
  vignette.addColorStop(1, "rgba(30, 24, 16, 0)");
  ctx.fillStyle = vignette;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A landmark tower dead-centre on the plaza, squat enough to read as a
 *  building rather than a spike, surrounded by three rings of low support
 *  blocks so the plaza reads as a small town, not a lone monument. */
function cityPieces(key: string): CityPiece[] {
  const seed = { n: hash32(key + ":cityHero3") };
  const pieces: CityPiece[] = [];
  pieces.push({
    dx: 0,
    dz: 0,
    height: 1.85 + rng(seed) * 0.45,
    footprint: CITY_FOOTPRINT * (1.05 + rng(seed) * 0.2),
    tint: rng(seed),
    model: BUILDING_KEYS[Math.floor(rng(seed) * BUILDING_KEYS.length)]!,
    rot: rng(seed) * Math.PI * 2,
    landmark: true,
  });
  for (const ring of HERO_RINGS) {
    const offset = rng(seed) * Math.PI * 2;
    for (let i = 0; i < ring.n; i++) {
      const a = offset + (i / ring.n) * Math.PI * 2 + (rng(seed) - 0.5) * 0.3;
      const r = ring.r + rng(seed) * ring.rSpread;
      pieces.push({
        dx: Math.cos(a) * r,
        dz: Math.sin(a) * r,
        height: ring.hMin + rng(seed) * ring.hSpread,
        footprint: CITY_FOOTPRINT * (0.36 + rng(seed) * 0.18),
        tint: rng(seed),
        model: BUILDING_KEYS[Math.floor(rng(seed) * BUILDING_KEYS.length)]!,
        rot: a + Math.PI + (rng(seed) - 0.5) * 0.12,
      });
    }
  }
  return pieces;
}

function nearCity(
  x: number,
  z: number,
  caps: SceneryCapital[],
  r2: number,
): boolean {
  for (const c of caps) {
    for (const dx of WRAP_OFFSETS) {
      const ddx = x - (c.x + dx);
      const ddz = z - c.z;
      if (ddx * ddx + ddz * ddz < r2) return true;
    }
  }
  return false;
}

function nearLabel(
  x: number,
  z: number,
  labels: SceneryLabelClear[],
  pad: number,
): boolean {
  for (const l of labels) {
    for (const dx of WRAP_OFFSETS) {
      if (
        Math.abs(x - (l.x + dx)) <= l.halfW + pad &&
        Math.abs(z - l.z) <= l.halfD + pad
      ) {
        return true;
      }
    }
  }
  return false;
}

const CLOUD_SYSTEMS = 11;
const CLOUD_SPAN = 42;
/** High enough that a close, oblique zoom looks under the layer; they
 *  only sit in frame once the camera has pulled back. */
const CLOUD_Y_MIN = 60;
const CLOUD_Y_SPAN = 14;
const CLOUD_DRIFT = 0.95;
/** Minimum gap between weather-system centres, world units. */
const CLOUD_SEP = 150;

interface CloudSite {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  phase: number;
  drift: number;
  tint: number;
  kind: CloudKind;
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: { n: number }): number {
  seed.n = (Math.imul(seed.n, 1664525) + 1013904223) >>> 0;
  return seed.n / 4294967296;
}

function plantClouds(): CloudSite[] {
  const seed = { n: hash32("clouds") };
  const sites: CloudSite[] = [];
  const centres: { x: number; z: number }[] = [];
  for (let s = 0; s < CLOUD_SYSTEMS; s++) {
    let cx = 0;
    let cz = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      cx = (rng(seed) - 0.5) * BOARD_W * 1.15;
      cz = (rng(seed) - 0.5) * BOARD_H * 1.1;
      let ok = true;
      for (const c of centres) {
        const dx = cx - c.x;
        const dz = cz - c.z;
        if (dx * dx + dz * dz < CLOUD_SEP * CLOUD_SEP) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }
    centres.push({ x: cx, z: cz });
    const cy = CLOUD_Y_MIN + rng(seed) * CLOUD_Y_SPAN;
    const heading = (rng(seed) < 0.5 ? 0 : Math.PI) + (rng(seed) - 0.5) * 0.4;
    const n = 4 + Math.floor(rng(seed) * 2);
    const half = Math.max((n - 1) / 2, 1);
    for (let k = 0; k < n; k++) {
      const along = (k - (n - 1) / 2) * (28 + rng(seed) * 12);
      const side = (rng(seed) - 0.5) * 18;
      const cs = Math.cos(heading);
      const sn = Math.sin(heading);
      const dist = Math.abs(k - (n - 1) / 2) / half;
      sites.push({
        x: cx + cs * along - sn * side,
        y: cy + (rng(seed) - 0.5) * 2.4,
        z: cz + sn * along + cs * side,
        scale: 1.18 - dist * 0.52 + rng(seed) * 0.12,
        rot: heading + (rng(seed) - 0.5) * 0.18,
        phase: rng(seed) * Math.PI * 2,
        drift: CLOUD_DRIFT * (0.72 + rng(seed) * 0.5),
        tint: rng(seed),
        kind: rng(seed) < 0.45 ? "a" : "e",
      });
    }
  }
  return sites;
}

function styleCloud(root: Object3D) {
  const size = new Box3().setFromObject(root).getSize(new Vector3());
  const extent = new Vector2(
    Math.max(size.x, 0.001) * 0.5,
    Math.max(size.z, 0.001) * 0.5,
  );
  const lift = Math.max(size.y, 0.001) * 0.5;
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const m = new MeshLambertMaterial({
      color: 0xecd4b4,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      emissive: 0xb08962,
      emissiveIntensity: 0.09,
      premultipliedAlpha: true,
      fog: true,
    });
    /* Faceted PBR lighting reads as rocks. Lambert plus a plan-view rim
       and a darker underside keep the Quaternius mesh, not the plastic. */
    m.customProgramCacheKey = () => "mapCloudLambertRim";
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCloudExtent = { value: extent };
      shader.uniforms.uCloudLift = { value: lift };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying float vCloudRim;
          varying float vCloudLift;
          uniform vec2 uCloudExtent;
          uniform float uCloudLift;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vCloudRim = length(vec2(
            position.x / uCloudExtent.x,
            position.z / uCloudExtent.y
          ));
          vCloudLift = position.y / uCloudLift;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying float vCloudRim;
          varying float vCloudLift;`,
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          float loft = clamp(vCloudLift * 0.5 + 0.58, 0.0, 1.0);
          float core = 1.0 - smoothstep(0.22, 1.08, vCloudRim);
          core *= core;
          gl_FragColor.rgb *= mix(vec3(0.72, 0.62, 0.5), vec3(1.04, 0.98, 0.9), loft);
          gl_FragColor.rgb *= mix(vec3(0.92, 0.91, 0.9), vec3(1.0), core);
          float cloudFacing = abs(dot(normalize(normal), normalize(-vViewPosition)));
          gl_FragColor.a *= smoothstep(0.04, 0.52, cloudFacing);
          gl_FragColor.a *= core;`,
        );
    };
    child.material = m;
  });
}

function muteKenneyTree(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const src = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    if (!src || !("color" in src)) return;
    const color = (src as MeshStandardMaterial).color;
    const isLeaf = color.g > color.r && color.g > color.b;
    child.material = new MeshLambertMaterial({
      color: isLeaf ? 0x6a6e52 : 0x4a3a2c,
    });
  });
}

function muteMountain(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const src = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    if (
      !(src instanceof MeshStandardMaterial) &&
      !(src instanceof MeshLambertMaterial)
    )
      return;
    const n = (src.name || "").toLowerCase();
    const mat = new MeshLambertMaterial();
    if (n.includes("snow")) {
      mat.color.set(0xe4d4bc);
      mat.emissive.setHex(0x3a3024);
      mat.emissiveIntensity = 0.14;
    } else if (n.includes("dirt")) {
      mat.color.set(0x5c4a38);
    } else {
      mat.color.set(0x6e675c);
    }
    child.material = mat;
  });
}

/** Kenney's colormap reads as a bright modern render next to the sepia
 *  board — multiply it toward the same warm parchment range the terrain
 *  caps use (terrain.ts' 0xa48b62), lighter than a full crush so window
 *  and facade detail still shows through. The landmark tower gets a
 *  near-white version of the same tint so it still reads as the hero
 *  piece against a dense, evenly-toned crowd.
 *
 *  Every shipped building glb uses plain pbrMetallicRoughness (no
 *  KHR_materials_unlit), so GLTFLoader always hands back a
 *  MeshStandardMaterial here — this intentionally does not style any
 *  other material type. */
function tintCapitalBuilding(material: Material, tint: number, landmark: boolean) {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.color.setHex(landmark ? 0xf1e6c4 : 0xe0cf9e);
  material.color.offsetHSL((tint - 0.5) * 0.05, 0, (tint - 0.5) * 0.14);
}

function fitHeight(obj: Object3D, height: number): number {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  return size.y > 1e-6 ? height / size.y : 1;
}

function fitSpan(obj: Object3D, span: number): number {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  const w = Math.max(size.x, size.z);
  return w > 1e-6 ? span / w : 1;
}

function plantY(lift: number): number {
  return LAND_HEIGHT + lift - LAND_PLANT_SINK;
}

/** Shadow-map depth material that fattens the foot of a thin mesh (a
 *  trunk, a flagpole) so it still occludes at the cap. Do not use this
 *  on bulky peaks — the extra width turns their drop into a blob under
 *  the base instead of a directional silhouette. */
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
  m.customProgramCacheKey = () => "map-scenery-foot-depth-v1";
  return m;
}

function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });
  return meshes;
}

export function createScenery(countries: SceneryCountry[]): Scenery {
  const group = new Group();
  const cloudSites = plantClouds();
  type LandBatch<S> = {
    mesh: InstancedMesh;
    sites: S[];
    baseScale: number;
    dx: number;
  };
  const treeBatches: LandBatch<TreeSite>[] = [];
  const cloudBatches: {
    mesh: InstancedMesh;
    sites: CloudSite[];
    baseScale: number;
    dx: number;
  }[] = [];
  const mountainBatches: LandBatch<MountainSite>[] = [];
  const dummy = new Object3D();

  let disposed = false;
  let treeGen = 0;
  let mountainGen = 0;
  let cloudGen = 0;
  let capitalGen = 0;
  let capitalNodes: Object3D[] = [];
  let capitalKey = "";
  const capitalLift = new Map<string, number>();
  let isoLift = new Map<string, number>();
  let liveCaps: SceneryCapital[] = [];
  let liveLabels: SceneryLabelClear[] = [];

  const rewriteLand = <S extends { iso: string }>(
    batches: LandBatch<S>[],
    write: (
      mesh: InstancedMesh,
      index: number,
      site: S,
      dx: number,
      lift: number,
      baseScale: number,
    ) => void,
    changed?: Set<string>,
  ) => {
    for (const batch of batches) {
      let dirty = changed == null;
      let i = 0;
      for (const site of batch.sites) {
        if (changed && !changed.has(site.iso)) {
          i++;
          continue;
        }
        dirty = true;
        write(
          batch.mesh,
          i,
          site,
          batch.dx,
          isoLift.get(site.iso) ?? 0,
          batch.baseScale,
        );
        i++;
      }
      if (dirty) batch.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  const spawnWraps = <S extends { iso: string }>(
    template: Object3D,
    sites: S[],
    baseScale: number,
    write: (
      mesh: InstancedMesh,
      index: number,
      site: S,
      dx: number,
      lift: number,
      baseScale: number,
    ) => void,
    batches: LandBatch<S>[],
    fattenFoot = true,
  ) => {
    template.updateMatrixWorld(true);
    let modelFootY = 0;
    for (const src of collectMeshes(template)) {
      src.geometry.computeBoundingBox();
      const y = src.geometry.boundingBox?.min.y ?? 0;
      if (y < modelFootY) modelFootY = y;
    }
    /* Only raise centred meshes (negative min Y). Never pull a canopy or
       snow cap down — those submeshes sit above the origin on purpose. */
    const footY = Math.min(0, modelFootY);
    for (const src of collectMeshes(template)) {
      for (const dx of WRAP_OFFSETS) {
        const material = Array.isArray(src.material)
          ? src.material[0]!.clone()
          : src.material.clone();
        material.shadowSide = DoubleSide;
        const bb = src.geometry.boundingBox;
        const spanY = bb ? bb.max.y - bb.min.y : 1;
        const inst = new InstancedMesh(src.geometry, material, sites.length);
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.frustumCulled = true;
        inst.userData.footY = footY;
        if (fattenFoot) {
          inst.customDepthMaterial = footDepthMaterial(footY, spanY);
        }
        let i = 0;
        for (const site of sites) {
          write(inst, i, site, dx, isoLift.get(site.iso) ?? 0, baseScale);
          i++;
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        group.add(inst);
        batches.push({ mesh: inst, sites, baseScale, dx });
      }
    }
  };

  const writeTreeMatrix = (
    mesh: InstancedMesh,
    index: number,
    site: TreeSite,
    dx: number,
    lift: number,
    baseScale: number,
  ) => {
    const hide =
      nearCity(site.x + dx, site.z, liveCaps, CITY_CLEAR_R * CITY_CLEAR_R) ||
      nearLabel(site.x + dx, site.z, liveLabels, LABEL_CLEAR_PAD_TREE);
    const s = hide ? 0 : baseScale * site.scale;
    const footY = (mesh.userData.footY as number) || 0;
    dummy.position.set(site.x + dx, plantY(lift) - footY * s, site.z);
    dummy.rotation.set(0, site.rot, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  };

  const rewriteTrees = (changed?: Set<string>) =>
    rewriteLand(treeBatches, writeTreeMatrix, changed);

  const writeMountainMatrix = (
    mesh: InstancedMesh,
    index: number,
    site: MountainSite,
    dx: number,
    lift: number,
    baseScale: number,
  ) => {
    const hide =
      nearCity(site.x + dx, site.z, liveCaps, CITY_CLEAR_R * CITY_CLEAR_R) ||
      nearLabel(site.x + dx, site.z, liveLabels, LABEL_CLEAR_PAD_MTN);
    const s = hide ? 0 : baseScale * site.scale;
    const footY = (mesh.userData.footY as number) || 0;
    dummy.position.set(site.x + dx, plantY(lift) - footY * s, site.z);
    dummy.rotation.set(site.leanX, site.rot, site.leanZ);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  };

  const rewriteMountains = (changed?: Set<string>) =>
    rewriteLand(mountainBatches, writeMountainMatrix, changed);

  const writeClouds = (nowS: number) => {
    for (const batch of cloudBatches) {
      let i = 0;
      for (const site of batch.sites) {
        const drift =
          ((site.x + nowS * site.drift + BOARD_W / 2) % BOARD_W) - BOARD_W / 2;
        const bob = Math.sin(nowS * 0.1 + site.phase) * 0.45;
        dummy.rotation.set(0, site.rot, 0);
        const s = batch.baseScale * site.scale;
        dummy.scale.set(s, s * 0.58, s);
        dummy.position.set(drift + batch.dx, site.y + bob, site.z);
        dummy.updateMatrix();
        batch.mesh.setMatrixAt(i++, dummy.matrix);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  /** Stone: reads as built material matching the buildings on it, and
   *  sits closer to the board's palette than the paper cream this
   *  replaced. */
  const PLATFORM_TOP_COLOR = 0xb0a288;
  const platformTopMat = new MeshLambertMaterial({
    color: PLATFORM_TOP_COLOR,
    map: makePlazaTexture(),
    emissive: 0x6a5c48,
    emissiveIntensity: 0.15,
    shadowSide: DoubleSide,
  });
  /* Match the country borders' own ink colour for the plinth's side wall
     and rim, so the edge reads as part of the same map, not a sticker
     stamped onto it. */
  const platformSideMat = new MeshLambertMaterial({
    color: BORDER_INK,
    shadowSide: DoubleSide,
  });
  const platformShared = new Set([platformTopMat, platformSideMat]);

  /* A raised cylinder plinth — ink side wall, stone top — the centred
     tower stands on. Buildings stand on its top face, so PLATFORM_BASE_Y
     (the plinth's own foot) and the block group's y at the call site
     below must move together. */
  const PLATFORM_BASE_Y = LAND_PLANT_SINK / CITY_SCALE + 0.02;
  const platformGeom = new CylinderGeometry(
    PLATFORM_R,
    PLATFORM_R,
    PLATFORM_H,
    44,
  );
  const platformRimGeom = new TorusGeometry(PLATFORM_R * 0.985, 0.05, 8, 48);
  platformRimGeom.rotateX(-Math.PI / 2);

  const makePlatform = (): Group => {
    const platform = new Group();
    platform.position.y = PLATFORM_BASE_Y;
    const disc = new Mesh(platformGeom, [
      platformSideMat,
      platformTopMat,
      platformSideMat,
    ]);
    disc.position.y = PLATFORM_H / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    platform.add(disc);
    const rim = new Mesh(platformRimGeom, platformSideMat);
    rim.position.y = PLATFORM_H + 0.02;
    rim.castShadow = true;
    rim.receiveShadow = true;
    platform.add(rim);
    return platform;
  };

  const dropCapitals = () => {
    const seen = new Set<object>();
    for (const node of capitalNodes) {
      node.removeFromParent();
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.customDepthMaterial?.dispose();
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const m of mats) {
          if (platformShared.has(m) || seen.has(m)) continue;
          seen.add(m);
          m.dispose();
        }
      });
    }
    capitalNodes = [];
  };

  const setHot = (next: Map<string, number>) => {
    const changed = new Set<string>();
    for (const [iso, lift] of next) {
      if ((isoLift.get(iso) ?? 0) !== lift) changed.add(iso);
    }
    for (const [iso, lift] of isoLift) {
      if ((next.get(iso) ?? 0) !== lift) changed.add(iso);
    }
    isoLift = next;
    if (changed.size) {
      rewriteTrees(changed);
      rewriteMountains(changed);
    }
    for (const node of capitalNodes) {
      const key = node.userData.capitalKey as string;
      node.position.y = plantY(capitalLift.get(key) ?? 0);
    }
  };

  void (async () => {
    const gen = treeGen;
    let treeSites: TreeSite[] = [];
    try {
      const res = await fetch(TREE_COVER_URL);
      if (res.ok) {
        treeSites = plantTreesFromCover(
          countries,
          new Uint8Array(await res.arrayBuffer()),
        );
      }
    } catch (err) {
      console.warn("WorldMap3D: forest cover failed to load", err);
    }
    if (disposed || gen !== treeGen) return;
    const byKind = new Map<TreeKind, TreeSite[]>();
    for (const site of treeSites) {
      const list = byKind.get(site.kind);
      if (list) list.push(site);
      else byKind.set(site.kind, [site]);
    }
    for (const [kind, sites] of byKind) {
      let template: Object3D;
      try {
        template = await loadModelTemplate(TREE_KEYS[kind]);
      } catch (err) {
        console.warn("WorldMap3D: tree model failed to load", err);
        return;
      }
      if (disposed || gen !== treeGen) return;
      muteKenneyTree(template);
      const baseScale = fitHeight(template, TREE_HEIGHT);
      spawnWraps(template, sites, baseScale, writeTreeMatrix, treeBatches);
    }
    if (!disposed && gen === treeGen) rewriteTrees();
  })();

  void (async () => {
    const gen = mountainGen;
    let mountainSites: MountainSite[] = [];
    try {
      const res = await fetch(ELEVATION_URL);
      if (res.ok) {
        mountainSites = plantMountainsFromCover(
          countries,
          new Uint8Array(await res.arrayBuffer()),
        );
      }
    } catch (err) {
      console.warn("WorldMap3D: elevation failed to load", err);
    }
    if (disposed || gen !== mountainGen) return;
    const byKind = new Map<MountainKind, MountainSite[]>();
    for (const site of mountainSites) {
      const list = byKind.get(site.kind);
      if (list) list.push(site);
      else byKind.set(site.kind, [site]);
    }
    for (const [kind, sites] of byKind) {
      let template: Object3D;
      try {
        template = await loadModelTemplate(MOUNTAIN_KEYS[kind]);
      } catch (err) {
        console.warn("WorldMap3D: mountain model failed to load", err);
        return;
      }
      if (disposed || gen !== mountainGen) return;
      muteMountain(template);
      const baseScale = fitHeight(template, MOUNTAIN_HEIGHT[kind]);
      spawnWraps(
        template,
        sites,
        baseScale,
        writeMountainMatrix,
        mountainBatches,
        false,
      );
    }
    if (!disposed && gen === mountainGen) rewriteMountains();
  })();

  void (async () => {
    const gen = cloudGen;
    const byKind = new Map<CloudKind, CloudSite[]>();
    for (const site of cloudSites) {
      const list = byKind.get(site.kind);
      if (list) list.push(site);
      else byKind.set(site.kind, [site]);
    }
    for (const [kind, sites] of byKind) {
      let template: Object3D;
      try {
        template = await loadModelTemplate(CLOUD_KEYS[kind]);
      } catch (err) {
        console.warn("WorldMap3D: cloud model failed to load", err);
        return;
      }
      if (disposed || gen !== cloudGen) return;
      styleCloud(template);
      const baseScale = fitSpan(template, CLOUD_SPAN);
      for (const src of collectMeshes(template)) {
        for (const dx of WRAP_OFFSETS) {
          const material = Array.isArray(src.material)
            ? src.material[0]!.clone()
            : src.material.clone();
          const inst = new InstancedMesh(src.geometry, material, sites.length);
          inst.castShadow = false;
          inst.receiveShadow = false;
          inst.frustumCulled = true;
          inst.renderOrder = 2;
          const tint = new Color();
          let ci = 0;
          for (const site of sites) {
            tint.setHSL(0.08, 0.22 + site.tint * 0.1, 0.76 + site.tint * 0.08);
            inst.setColorAt(ci++, tint);
          }
          if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
          cloudBatches.push({ mesh: inst, sites, baseScale, dx });
          group.add(inst);
        }
      }
    }
    if (!disposed && gen === cloudGen) {
      writeClouds(0);
      for (const batch of cloudBatches) batch.mesh.computeBoundingSphere();
    }
  })();

  /* Trees and mountains are only hidden by the *footprint* of a label or a
     capital — nearLabel() reads x/z/halfW/halfD and nearCity() reads x/z,
     and nothing else. syncPaint() re-sends both lists on every hover, where
     all that actually moved is a country's lift, so both setters gate their
     full instance rewrite on a signature of the fields the rewrite reads.
     Without this, hovering a country rewrites every tree and mountain
     matrix, each against a scan of every capital and label. */
  let labelSig = "";
  let capSig = "";

  const setLabelClear = (boxes: SceneryLabelClear[]) => {
    liveLabels = boxes;
    const sig = boxes
      .map((b) => b.x + "," + b.z + "," + b.halfW + "," + b.halfD)
      .join("|");
    if (sig === labelSig) return;
    labelSig = sig;
    rewriteTrees();
    rewriteMountains();
  };

  const setCapitals = (specs: SceneryCapital[]) => {
    const key = specs.map((s) => s.key).join("|");
    for (const spec of specs) capitalLift.set(spec.key, spec.lift);
    liveCaps = specs;
    const sig = specs.map((s) => s.key + "," + s.x + "," + s.z).join("|");
    if (sig !== capSig) {
      capSig = sig;
      rewriteTrees();
      rewriteMountains();
    }
    if (key === capitalKey) {
      for (const node of capitalNodes) {
        const k = node.userData.capitalKey as string;
        const lift = capitalLift.get(k) ?? 0;
        node.userData.hot = specs.find((s) => s.key === k)?.hot ?? false;
        node.position.y = plantY(lift);
      }
      return;
    }
    capitalKey = key;
    const gen = ++capitalGen;
    dropCapitals();
    void (async () => {
      const templates = new Map<
        ModelKey,
        { root: Object3D; sy: number; xz: number }
      >();
      try {
        const roots = await Promise.all(
          BUILDING_KEYS.map((k) => instantiateModel(k)),
        );
        if (disposed || gen !== capitalGen) {
          for (const root of roots) disposeObject(root);
          return;
        }
        for (let i = 0; i < BUILDING_KEYS.length; i++) {
          const root = roots[i]!;
          const size = new Box3().setFromObject(root).getSize(new Vector3());
          templates.set(BUILDING_KEYS[i]!, {
            root,
            sy: size.y > 1e-6 ? 1 / size.y : 1,
            xz: 1 / Math.max(size.x, size.z, 1e-6),
          });
        }
      } catch (err) {
        console.warn("WorldMap3D: capital building failed to load", err);
        return;
      }
      for (const spec of specs) {
        if (disposed || gen !== capitalGen) return;
        const city = new Group();
        city.add(makePlatform());
        const block = new Group();
        block.position.y = PLATFORM_BASE_Y + PLATFORM_H;
        block.rotation.y = capitalYaw(spec.key);
        const box = new Box3();
        const center = new Vector3();
        for (const piece of cityPieces(spec.key)) {
          const tmpl = templates.get(piece.model)!;
          const b = instantiateClone(tmpl.root);
          b.scale.set(
            tmpl.xz * piece.footprint,
            tmpl.sy * piece.height,
            tmpl.xz * piece.footprint,
          );
          b.rotation.y = piece.rot;
          b.position.set(0, 0, 0);
          b.updateMatrixWorld(true);
          box.setFromObject(b);
          box.getCenter(center);
          b.position.set(piece.dx - center.x, -box.min.y, piece.dz - center.z);
          b.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            child.castShadow = true;
            child.receiveShadow = true;
            child.geometry.computeBoundingBox();
            const geomBox = child.geometry.boundingBox;
            const spanY = geomBox ? geomBox.max.y - geomBox.min.y : 1;
            const footY = geomBox ? Math.min(0, geomBox.min.y) : 0;
            child.customDepthMaterial = footDepthMaterial(footY, spanY);
            const mats = Array.isArray(child.material)
              ? child.material
              : [child.material];
            for (const m of mats) {
              m.shadowSide = DoubleSide;
              tintCapitalBuilding(m, piece.tint, !!piece.landmark);
            }
          });
          block.add(b);
        }
        city.add(block);
        city.scale.setScalar(CITY_SCALE);
        for (let t = 0; t < WRAP_OFFSETS.length; t++) {
          const inst = t === 0 ? city : city.clone(true);
          inst.position.set(
            spec.x + WRAP_OFFSETS[t]!,
            plantY(spec.lift),
            spec.z,
          );
          inst.userData.capitalKey = spec.key;
          inst.userData.hot = spec.hot;
          group.add(inst);
          capitalNodes.push(inst);
        }
      }
      for (const tmpl of templates.values()) disposeObject(tmpl.root);
    })();
  };

  const update = (nowS: number) => {
    writeClouds(nowS);
  };

  const dispose = () => {
    disposed = true;
    treeGen++;
    mountainGen++;
    cloudGen++;
    capitalGen++;
    dropCapitals();
    for (const batch of treeBatches) {
      batch.mesh.removeFromParent();
      (batch.mesh.material as MeshLambertMaterial).dispose();
      batch.mesh.customDepthMaterial?.dispose();
    }
    treeBatches.length = 0;
    for (const batch of mountainBatches) {
      batch.mesh.removeFromParent();
      (batch.mesh.material as MeshLambertMaterial).dispose();
      batch.mesh.customDepthMaterial?.dispose();
    }
    mountainBatches.length = 0;
    for (const batch of cloudBatches) {
      batch.mesh.removeFromParent();
      (batch.mesh.material as MeshLambertMaterial).dispose();
    }
    cloudBatches.length = 0;
    platformGeom.dispose();
    platformRimGeom.dispose();
    platformTopMat.map?.dispose();
    platformTopMat.dispose();
    platformSideMat.dispose();
    group.clear();
  };

  return { group, setHot, setCapitals, setLabelClear, update, dispose };
}

/** Cheap second-and-later wrap copy: clone an already-fitted instance,
 *  sharing geometry, with its own materials. */
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
