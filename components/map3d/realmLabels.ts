/**
 * Country names drawn on the land itself: a canvas texture on a plane
 * that lies flat on the slab, so the type pitches and scales with the
 * board the way printed atlas lettering does.
 *
 * Badges stay in the screen-space overlay — they are chrome, not ink.
 * Pure of game logic: handed a list of specs and a camera.
 */

import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { BOARD_W, WRAP_OFFSETS } from "../../lib/map/projection.ts";
import type { MapCamera } from "./camera.ts";
import type { LabelSpec } from "./overlay.ts";

/** Bump when the label look changes so WorldMap3D remounts the scene. */
export const REALM_LABELS_REV = 6;

const FONT_HOT =
  '700 64px "Plus Jakarta Sans", system-ui, "Segoe UI", sans-serif';
const FONT_COLD =
  '600 64px "Plus Jakarta Sans", system-ui, "Segoe UI", sans-serif';
const TRACK = 14;
const INK_HOT = "#3a2814";
const INK_COLD = "#1a1510";
/** Paper knockout so the ink reads on gold and rust fills. */
const HALO = "rgba(244, 234, 214, 0.88)";
const HALO_W = 10;
/** Letter height in world units (degrees of longitude). Same for hot and
 *  cold — hover/select only restyles the ink, it does not enlarge the type. */
const WORLD_H = 1.32;
const CANVAS_H = 96;
const PAD = 28;
const LABEL_PAD_PX = 4;
/** Half-extent of a capital cluster, world units. Token plus the ring
 *  of blocks around it — enough to nudge a name off the star. */
const CAPITAL_HALF = 1.7;
/** Air between a nudged plate and whatever it was sitting on. */
const NUDGE_PAD = 0.2;
/** Cap so a clash in the Low Countries does not send "BELGIUM" into
 *  the North Sea. About two letter-heights. */
const MAX_NUDGE = 2.8;

export interface LabelKeepOut {
  x: number;
  z: number;
}

export interface RealmLabels {
  group: Group;
  setLabels: (specs: LabelSpec[], keepOuts?: LabelKeepOut[]) => void;
  /** World-space boxes of the name plates, for scenery keep-out. */
  clearBoxes: () => { x: number; z: number; halfW: number; halfD: number }[];
  update: (cam: MapCamera, W: number, H: number) => void;
  dispose: () => void;
}

interface Box {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

interface Entry {
  spec: LabelSpec;
  meshes: Mesh[];
  texture: CanvasTexture;
  worldW: number;
  worldH: number;
  ox: number;
  oz: number;
}

function wrapWorldDx(a: number, b: number): number {
  let d = a - b;
  if (d > BOARD_W / 2) d -= BOARD_W;
  else if (d < -BOARD_W / 2) d += BOARD_W;
  return d;
}

/** Slide a plate just far enough to clear blockers, preferring the
 *  shorter axis (usually south/north — labels are wide) so the name
 *  stays on its own country. */
function nudgeBox(box: Box, blockers: Box[]): { ox: number; oz: number } {
  let ox = 0;
  let oz = 0;
  for (let pass = 0; pass < 10; pass++) {
    const cx = box.x + ox;
    const cz = box.z + oz;
    let hit: Box | null = null;
    let dx = 0;
    let dz = 0;
    let oxlap = 0;
    let ozlap = 0;
    for (const b of blockers) {
      dx = wrapWorldDx(cx, b.x);
      dz = cz - b.z;
      oxlap = box.halfW + b.halfW - Math.abs(dx);
      ozlap = box.halfD + b.halfD - Math.abs(dz);
      if (oxlap > 0 && ozlap > 0) {
        hit = b;
        break;
      }
    }
    if (!hit) break;
    if (oxlap <= ozlap) {
      ox += (oxlap + NUDGE_PAD) * (Math.abs(dx) < 1e-6 ? 1 : Math.sign(dx));
    } else {
      oz += (ozlap + NUDGE_PAD) * (Math.abs(dz) < 1e-6 ? 1 : Math.sign(dz));
    }
    const len = Math.hypot(ox, oz);
    if (len > MAX_NUDGE) {
      ox *= MAX_NUDGE / len;
      oz *= MAX_NUDGE / len;
      break;
    }
  }
  return { ox, oz };
}

function raster(
  text: string,
  hot: boolean,
): { texture: CanvasTexture; aspect: number } {
  const font = hot ? FONT_HOT : FONT_COLD;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texture = new CanvasTexture(canvas);
    return { texture, aspect: 4 };
  }
  ctx.font = font;
  ctx.letterSpacing = `${TRACK}px`;
  const metrics = ctx.measureText(text);
  const w = Math.max(32, Math.ceil(metrics.width + PAD * 2));
  const h = CANVAS_H;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.letterSpacing = `${TRACK}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = HALO;
  ctx.lineWidth = HALO_W;
  ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = hot ? INK_HOT : INK_COLD;
  ctx.fillText(text, w / 2, h / 2 + 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, aspect: w / h };
}

function specKey(specs: LabelSpec[]): string {
  return specs
    .map(
      (s) => `${s.key}\u0001${s.text}\u0001${s.hot ? 1 : 0}\u0001${s.priority}`,
    )
    .join("|");
}

export function createRealmLabels(): RealmLabels {
  const group = new Group();
  let entries: Entry[] = [];
  let key = "";
  const scratch = new Vector3();
  const out = new Vector3();

  const clear = () => {
    for (const entry of entries) {
      entry.meshes[0]?.geometry.dispose();
      (entry.meshes[0]?.material as MeshBasicMaterial | undefined)?.dispose();
      entry.texture.dispose();
    }
    group.clear();
    entries = [];
  };

  const setLabels = (specs: LabelSpec[], keepOuts: LabelKeepOut[] = []) => {
    const nextKey = specKey(specs);
    if (nextKey !== key) {
      key = nextKey;
      clear();
      const sorted = [...specs].sort((a, b) => b.priority - a.priority);
      for (const spec of sorted) {
        const { texture, aspect } = raster(spec.text, spec.hot);
        const worldH = WORLD_H;
        const worldW = worldH * aspect;
        const geom = new PlaneGeometry(worldW, worldH);
        const mat = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          fog: true,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const meshes: Mesh[] = [];
        for (const dx of WRAP_OFFSETS) {
          const mesh = new Mesh(geom, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.renderOrder = 2;
          mesh.frustumCulled = false;
          mesh.userData.dx = dx;
          group.add(mesh);
          meshes.push(mesh);
        }
        entries.push({
          spec,
          meshes,
          texture,
          worldW,
          worldH,
          ox: 0,
          oz: 0,
        });
      }
    } else {
      for (let i = 0; i < entries.length; i++) {
        const spec = specs.find((s) => s.key === entries[i]!.spec.key);
        if (spec) entries[i]!.spec = spec;
      }
    }

    const placed: Box[] = keepOuts.map((k) => ({
      x: k.x,
      z: k.z,
      halfW: CAPITAL_HALF,
      halfD: CAPITAL_HALF,
    }));
    for (const entry of entries) {
      const { x, z } = entry.spec.anchor;
      const box = {
        x,
        z,
        halfW: entry.worldW / 2,
        halfD: entry.worldH / 2,
      };
      const n = nudgeBox(box, placed);
      entry.ox = n.ox;
      entry.oz = n.oz;
      placed.push({
        x: x + n.ox,
        z: z + n.oz,
        halfW: box.halfW,
        halfD: box.halfD,
      });
    }

    for (const entry of entries) {
      const { x, y, z } = entry.spec.anchor;
      for (const mesh of entry.meshes) {
        const dx = mesh.userData.dx as number;
        mesh.position.set(x + dx + entry.ox, y + 0.06, z + entry.oz);
      }
    }
  };

  const update = (cam: MapCamera, W: number, H: number) => {
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const entry of entries) {
      let best: Mesh | null = null;
      let bestPos: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const mesh of entry.meshes) {
        mesh.visible = false;
        scratch.copy(mesh.position);
        const p = cam.toScreen(scratch, W, H, out);
        if (!p.visible) continue;
        const d = Math.abs(p.x - W / 2);
        if (d < bestD) {
          bestD = d;
          best = mesh;
          bestPos = { x: p.x, y: p.y };
        }
      }
      if (!best || !bestPos) continue;
      const sx = (entry.worldW / 2 / Math.max(cam.dist, 1)) * W * 0.55;
      const sy = (entry.worldH / 2 / Math.max(cam.dist, 1)) * H * 0.7;
      const box = {
        x0: bestPos.x - sx - LABEL_PAD_PX,
        y0: bestPos.y - sy - LABEL_PAD_PX,
        x1: bestPos.x + sx + LABEL_PAD_PX,
        y1: bestPos.y + sy + LABEL_PAD_PX,
      };
      const collides = placed.some(
        (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
      );
      if (collides) continue;
      placed.push(box);
      best.visible = true;
    }
  };

  const clearBoxes = () =>
    entries.map((entry) => ({
      x: entry.spec.anchor.x + entry.ox,
      z: entry.spec.anchor.z + entry.oz,
      halfW: entry.worldW / 2,
      halfD: entry.worldH / 2,
    }));

  const dispose = () => {
    clear();
  };

  return { group, setLabels, clearBoxes, update, dispose };
}
