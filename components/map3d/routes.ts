/**
 * Trade-route sea lanes as real scene geometry.
 *
 * Lanes follow the maritime path WorldMap3D computed (Suez, Panama, the
 * long way around land) so the dashed line and the boats agree.
 *
 * No game logic here: the caller hands over world-space polylines.
 */

import { Group, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { WRAP_OFFSETS } from "../../lib/map/projection.ts";
import { unwrapSeaPath } from "../../lib/map/seaRoutes.ts";
import { type Vec3 } from "./boats.ts";
import { seaHeight } from "./sea.ts";

/** World-unit width of a lane — thin on purpose, a plotted shipping line
 *  rather than a pipe. Selection reads through the brighter material, not
 *  a thicker stroke, so picking a partner never rebuilds geometry. */
const ROUTE_WIDTH = 0.12;
const ROUTE_DASH = 0.48;
const ROUTE_GAP = 0.32;
/** Hair above the local sea so the stroke sits on the water with the
 *  boats rather than on a flat plane they then parallax off. */
const ROUTE_LIFT = 0.05;
/** Bump so WorldMap3D remounts when lane look changes. */
export const ROUTES_REV = 69;
/** Shared ink for every dashed lane — highways and on-ramps. */
const ROUTE_COLOR = 0x945d35;
/** The same ink lifted, for the lanes of the seat the board is focused on.
 *  A second shared material rather than a per-route clone: the highlight is
 *  a two-state thing, so two materials cover every route and switching one
 *  is a pointer swap, not a geometry rebuild. */
const ROUTE_COLOR_HOT = 0xe8b86a;

/** Densify a sea-lane along its own segments. A Catmull-Rom used to cut
 *  corners through land; boats and dashes have to stay on the water. */
export function resampleLane(path: Vec3[]): Vec3[] {
  if (path.length < 2) return path;
  const unwrapped = unwrapSeaPath(path);
  const out: Vec3[] = [];
  const spacing = 1.15;
  for (let i = 0; i < unwrapped.length - 1; i++) {
    const a = unwrapped[i]!,
      b = unwrapped[i + 1]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: 0,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }
  const last = unwrapped[unwrapped.length - 1]!;
  out.push({ x: last.x, y: 0, z: last.z });
  return out;
}

function writeDrapedLane(
  geometry: LineGeometry,
  pts: Vector3[],
  dx: number,
  nowS: number,
) {
  const start = geometry.attributes.instanceStart;
  const end = geometry.attributes.instanceEnd;
  if (!start || !end) return;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!,
      b = pts[i + 1]!;
    start.setXYZ(i, a.x, seaHeight(a.x + dx, a.z, nowS) + ROUTE_LIFT, a.z);
    end.setXYZ(i, b.x, seaHeight(b.x + dx, b.z, nowS) + ROUTE_LIFT, b.z);
  }
  start.needsUpdate = true;
}

/** Deterministic block facing, ±~30°. Stops every capital reading as the
 *  same axis-aligned stamp. */
export function capitalYaw(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) / 4294967296 - 0.5) * 1.05;
}

export interface RouteSpec {
  /** Stable id for the stroke (owners joined). */
  key: string;
  /** Partners that use this segment — selected if any of them is picked. */
  owners: string[];
  /** World-space sea-lane polyline — already wrap-adjusted. */
  path: Vec3[];
  /** Debug paint: coloured spine vs blue on-ramp. */
  kind?: "highway" | "stub";
  color?: number;
}

function routeMaterial(color: number): LineMaterial {
  return new LineMaterial({
    color,
    linewidth: ROUTE_WIDTH,
    worldUnits: true,
    dashed: true,
    dashSize: ROUTE_DASH,
    gapSize: ROUTE_GAP,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

interface RouteEntry {
  key: string;
  owners: string[];
  kind: "highway" | "stub";
  material: LineMaterial;
  ownedMat: boolean;
  lines: Line2[];
  geometries: LineGeometry[];
  /** Centre-tile XZ of the drawn polyline. Y is sampled per wrap tile. */
  pts: Vector3[];
}

export interface RouteLayer {
  group: Group;
  /** Rebuild the dashed lanes. Cheap enough to call whenever the active
   *  partner set changes; not something to call per frame. */
  setRoutes: (specs: RouteSpec[]) => void;
  /** Brighten one route without rebuilding any geometry. */
  setSelectedRoute: (partnerId: string | null) => void;
  /** Drape every lane onto the live sea surface. */
  update: (nowS: number) => void;
  dispose: () => void;
}

export function buildRouteLayer(): RouteLayer {
  const group = new Group();
  const tiles = WRAP_OFFSETS.map((dx) => {
    const tile = new Group();
    tile.position.x = dx;
    group.add(tile);
    return tile;
  });

  const laneMat = routeMaterial(ROUTE_COLOR);
  const laneHotMat = routeMaterial(ROUTE_COLOR_HOT);
  laneHotMat.opacity = 0.85;

  let routes: RouteEntry[] = [];
  /** Signature of the routes currently built, so a re-sync that changes
   *  nothing about the partner set or its anchors rebuilds no geometry —
   *  this is called whenever `tick` bumps, which includes every UI edit. */
  let routeKey = "";
  let selected: string | null = null;

  /** A lane is lit when it belongs to the seat the board is focused on.
   *  `route.material` is the route's own ink only when it owns one;
   *  otherwise both states come from the two shared materials above. */
  const paintMaterials = () => {
    for (const route of routes) {
      const hot = selected != null && route.owners.includes(selected);
      const mat = route.ownedMat
        ? route.material
        : hot
          ? laneHotMat
          : laneMat;
      for (const line of route.lines) line.material = mat;
    }
  };

  const clearRoutes = () => {
    for (const route of routes) {
      for (const line of route.lines) line.removeFromParent();
      for (const geometry of route.geometries) geometry.dispose();
      if (route.ownedMat) route.material.dispose();
    }
    routes = [];
  };

  const setRoutes = (specs: RouteSpec[]) => {
    const key = specs
      .map(
        (s) =>
          `${s.key}:${(s.color ?? 0).toString(16)}:` +
          s.path.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(">"),
      )
      .join("|");
    if (key === routeKey) return;
    routeKey = key;
    clearRoutes();
    for (const spec of specs) {
      if (spec.path.length < 2) continue;
      const kind = spec.kind === "stub" ? "stub" : "highway";
      const pts = spec.path.map((p) => new Vector3(p.x, 0, p.z));
      const geometries: LineGeometry[] = [];
      const lines = tiles.map((tile) => {
        const geometry = new LineGeometry();
        geometry.setFromPoints(pts);
        writeDrapedLane(geometry, pts, tile.position.x, 0);
        const line = new Line2(geometry, laneMat);
        line.computeLineDistances();
        line.renderOrder = 2;
        line.frustumCulled = false;
        tile.add(line);
        geometries.push(geometry);
        return line;
      });
      routes.push({
        key: spec.key,
        owners: spec.owners,
        kind,
        material: laneMat,
        ownedMat: false,
        lines,
        geometries,
        pts,
      });
    }
    /* A rebuild drops whatever the last paint set, so re-apply the current
       selection/hover to the fresh lines rather than waiting for the next
       pointer move to light them. */
    paintMaterials();
  };

  const update = (nowS: number) => {
    for (const route of routes) {
      for (let t = 0; t < route.geometries.length; t++) {
        writeDrapedLane(
          route.geometries[t]!,
          route.pts,
          tiles[t]!.position.x,
          nowS,
        );
      }
    }
  };

  const setSelectedRoute = (partnerId: string | null) => {
    if (partnerId === selected) return;
    selected = partnerId;
    paintMaterials();
  };


  const dispose = () => {
    clearRoutes();
    routeKey = "";
    selected = null;
    laneMat.dispose();
    laneHotMat.dispose();
    group.clear();
  };

  return {
    group,
    setRoutes,
    setSelectedRoute,
    update,
    dispose,
  };
}
