/**
 * Camera state for the three.js world map: where on the board the view is
 * centred, how far back it sits, and the ground-plane math the pointer
 * handlers need (drag-the-ground panning, cursor-anchored zoom, and the
 * world → screen projection the label overlay is positioned by).
 *
 * Yaw is deliberately fixed at north-up. The board is an atlas, its labels
 * are horizontal text, and a free-spinning camera would cost both for no
 * gameplay gain — so the only degrees of freedom are pan and zoom, exactly
 * as they were on the flat map this replaced.
 */

import { PerspectiveCamera, Vector3 } from "three";
import {
  BOARD_H,
  boardToWorld,
  wrapWorldX,
  project,
} from "../../lib/map/projection.ts";

export const FOV = 42;

/** Camera distance to the focus point, in world units (= degrees of
 *  longitude). MIN is a city-scale look at one country; MAX shows most of
 *  the board at once — bounded so the fixed three-copy wrap tiling in
 *  lib/map/projection can always cover the frame. */
const MIN_DIST = 26;
const MAX_DIST = 250;
const DEFAULT_DIST = 95;

/** Pitch (radians above the board) at MAX_DIST and at MIN_DIST. Zooming in
 *  drops the camera toward the horizon, so the relief and the boats get
 *  more oblique as you close in while the zoomed-out view stays close to a
 *  readable plan.
 *
 *  PITCH_NEAR must stay comfortably above half the vertical FOV (21°) —
 *  below that the top of the frustum points above the horizon and the
 *  frame fills with empty sky past the edge of the board. */
const PITCH_FAR = 1.31; // ~75°
const PITCH_NEAR = 0.62; // ~36°

/** Geographic focus of the opening view (mid-Atlantic / western Europe). */
const DEFAULT_VIEW_LNG = -5;
const DEFAULT_VIEW_LAT = 40;

/** How far past the north/south edge of the plate the focus may travel, as
 *  a fraction of board depth — enough to bring the polar edge into frame
 *  without letting the board leave it entirely. */
const FOCUS_Z_MARGIN = 0.28;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function pitchForDist(dist: number): number {
  const t = clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * t;
}

export class MapCamera {
  readonly camera: PerspectiveCamera;
  focusX: number;
  focusZ: number;
  dist: number;

  constructor() {
    this.camera = new PerspectiveCamera(FOV, 1, 1, 6000);
    const [nx, ny] = project(DEFAULT_VIEW_LNG, DEFAULT_VIEW_LAT);
    const [x, z] = boardToWorld(nx, ny);
    this.focusX = x;
    this.focusZ = z;
    this.dist = DEFAULT_DIST;
    this.apply(1);
  }

  /** Recompute the camera transform from the view state. `aspect` is the
   *  live viewport ratio; call on every resize as well as every view
   *  change. */
  apply(aspect: number) {
    this.focusX = wrapWorldX(this.focusX);
    const zLimit = BOARD_H * (0.5 + FOCUS_Z_MARGIN);
    this.focusZ = clamp(this.focusZ, -zLimit, zLimit);
    const pitch = pitchForDist(this.dist);
    this.camera.aspect = aspect;
    this.camera.position.set(
      this.focusX,
      this.dist * Math.sin(pitch),
      this.focusZ + this.dist * Math.cos(pitch),
    );
    this.camera.lookAt(this.focusX, 0, this.focusZ);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Centre the view on a normalised board point (capital, country
   *  centroid, …). Zoom is left as it is — callers that want a particular
   *  scale set `dist` first. */
  focusAt(nx: number, ny: number, aspect: number) {
    const [x, z] = boardToWorld(nx, ny);
    this.focusX = x;
    this.focusZ = z;
    this.apply(aspect);
  }

  /** 0 (fully zoomed in) → 1 (fully zoomed out). Feeds anything that should
   *  thin out as the board recedes. */
  get zoomOut(): number {
    return clamp((this.dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  }

  /** Where a screen point lands on a horizontal plane at height `planeY`.
   *  Null when the ray runs parallel to the plane or away from it — which
   *  can't happen while the horizon stays off-frame (see PITCH_NEAR), but
   *  callers must still not assume a hit. */
  groundAt(
    ndcX: number,
    ndcY: number,
    planeY = 0,
    out = new Vector3(),
  ): Vector3 | null {
    out.set(ndcX, ndcY, 0.5).unproject(this.camera);
    out.sub(this.camera.position).normalize();
    if (Math.abs(out.y) < 1e-6) return null;
    const t = (planeY - this.camera.position.y) / out.y;
    if (!(t > 0)) return null;
    return out.multiplyScalar(t).add(this.camera.position);
  }

  /** Multiply the camera distance, keeping whatever ground point is under
   *  (ndcX, ndcY) pinned there. Pitch changes with distance, so the
   *  correction isn't closed-form — two passes converge well inside a
   *  pixel. Returns false if nothing changed (already at a stop). */
  zoomAt(factor: number, ndcX: number, ndcY: number, aspect: number): boolean {
    const next = clamp(this.dist * factor, MIN_DIST, MAX_DIST);
    if (next === this.dist) return false;
    /* groundAt() allocates its own vector by default, so this snapshot of
       the anchor point survives the later calls below. */
    const before = this.groundAt(ndcX, ndcY);
    this.dist = next;
    this.apply(aspect);
    for (let pass = 0; before && pass < 2; pass++) {
      const after = this.groundAt(ndcX, ndcY);
      if (!after) break;
      this.focusX += before.x - after.x;
      this.focusZ += before.z - after.z;
      this.apply(aspect);
    }
    return true;
  }

  /** Screen-space position of a world point, in CSS pixels from the top
   *  left, plus whether it is in front of the camera at all. */
  toScreen(
    world: Vector3,
    W: number,
    H: number,
    out = new Vector3(),
  ): { x: number; y: number; visible: boolean } {
    out.copy(world).project(this.camera);
    return {
      x: (out.x * 0.5 + 0.5) * W,
      y: (-out.y * 0.5 + 0.5) * H,
      visible: out.z > -1 && out.z < 1,
    };
  }
}
