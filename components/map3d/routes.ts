/**
 * Trade-route arcs and capital markers as real scene geometry.
 *
 * Both were flat canvas drawings on the map this replaced — a dashed
 * quadratic Bézier and a star-in-a-circle SVG. In the three.js scene they
 * are a tube standing off the sea and a small spire planted on the land,
 * sharing the exact curve and anchor points the boat layer animates along
 * so line, boat and marker still agree on where a route runs.
 *
 * No game logic here: the caller resolves which partners are active and
 * hands over world-space anchors.
 */

import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import {
  LAND_HEIGHT,
  LAND_LIFT_HOT,
  WRAP_OFFSETS,
} from "../../lib/map/projection.ts";
import { routeControl, type Vec3 } from "./boats.ts";

/** Tube radius, world units (= degrees of longitude). One radius for every
 *  route: selection reads through the brighter, more opaque material below
 *  rather than through geometry, so picking a partner never has to rebuild
 *  a single tube. */
const ROUTE_RADIUS = 0.2;
/** Lengthwise segments of a route tube. Enough that a long arc stays
 *  smooth; the tube is thin, so radial segments can stay low. */
const ROUTE_STEPS = 48;
const ROUTE_RADIAL = 5;

/** Arc shape, as fractions of the route's own straight-line length: how far
 *  the midpoint is pushed north in the ground plane, and how high it is
 *  lifted. Proportional rather than fixed so a short hop and an ocean
 *  crossing both read as the same kind of curve. */
export const ROUTE_BULGE_FRAC = 0.12;
export const ROUTE_LIFT_FRAC = 0.17;
const ROUTE_LIFT_MAX = 26;

/** Capital spire dimensions, world units. */
const PIN_HEIGHT = 3.1;
const PIN_RADIUS = 0.85;
const PIN_BASE_R = 1.45;
const PIN_BASE_H = 0.32;

export interface RouteSpec {
  partnerId: string;
  /** World ground anchors — the partner end is already wrap-adjusted to the
   *  short way round the board. */
  home: Vec3;
  partner: Vec3;
}

export interface CapitalSpec {
  key: string;
  x: number;
  z: number;
  hot: boolean;
}

/** Curve control point for a route, in world space. Exported so the boat
 *  layer rides the identical curve rather than a re-derived lookalike. */
export function routeCurveControl(home: Vec3, partner: Vec3, lift: boolean) {
  const len = Math.hypot(partner.x - home.x, partner.z - home.z);
  return routeControl(
    home,
    partner,
    len * ROUTE_BULGE_FRAC,
    lift ? Math.min(ROUTE_LIFT_MAX, len * ROUTE_LIFT_FRAC) : 0,
  );
}

function toVector3(v: Vec3) {
  return new Vector3(v.x, v.y, v.z);
}

/** Pins are planted on the land surface, not the sea plane — the board has
 *  real thickness, so a pin at y=0 is buried inside its own country's slab
 *  with only its tip poking out — and they rise with a lit country. */
function pinY(hot: boolean) {
  return LAND_HEIGHT + (hot ? LAND_LIFT_HOT : 0);
}

interface RouteEntry {
  partnerId: string;
  meshes: Mesh[];
  geometry: BufferGeometry;
}

interface CapitalEntry {
  key: string;
  nodes: Object3D[];
  hot: boolean;
}

export interface RouteLayer {
  group: Group;
  /** Rebuild the route tubes. Cheap enough to call whenever the active
   *  partner set changes; not something to call per frame. */
  setRoutes: (specs: RouteSpec[]) => void;
  /** Thicken/brighten one route without rebuilding any geometry. */
  setSelectedRoute: (partnerId: string | null) => void;
  setCapitals: (specs: CapitalSpec[]) => void;
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

  /* depthWrite off so a route arcing over land doesn't punch a hole in the
     terrain behind it; the tube is translucent and reads as a plotted line
     on an atlas rather than a solid pipe. */
  const routeMat = new MeshBasicMaterial({
    color: 0x64d2ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const routeMatSelected = new MeshBasicMaterial({
    color: 0x9ee3ff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const pinGeom = new ConeGeometry(PIN_RADIUS, PIN_HEIGHT, 5);
  pinGeom.translate(0, PIN_BASE_H + PIN_HEIGHT / 2, 0);
  const baseGeom = new CylinderGeometry(PIN_BASE_R, PIN_BASE_R, PIN_BASE_H, 12);
  baseGeom.translate(0, PIN_BASE_H / 2, 0);

  /* Even a "cold" capital is a marker, not scenery: unlit dark geometry on
     dark land just reads as a rendering fault. Warm bronze with a trace of
     emissive keeps it legible against every board-metric colour. */
  const pinCold = new MeshStandardMaterial({
    color: 0xd9bd85,
    emissive: 0x6a4a14,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.4,
  });
  const pinHot = new MeshStandardMaterial({
    color: 0xf2d9a0,
    emissive: 0x8a5f18,
    emissiveIntensity: 0.7,
    roughness: 0.3,
    metalness: 0.55,
  });

  let routes: RouteEntry[] = [];
  /** Signature of the routes currently built, so a re-sync that changes
   *  nothing about the partner set or its anchors rebuilds no geometry —
   *  this is called whenever `tick` bumps, which includes every UI edit. */
  let routeKey = "";
  let capitals: CapitalEntry[] = [];
  let capitalKey = "";
  let selected: string | null = null;

  const clearRoutes = () => {
    for (const route of routes) {
      for (const mesh of route.meshes) mesh.removeFromParent();
      route.geometry.dispose();
    }
    routes = [];
  };

  const setRoutes = (specs: RouteSpec[]) => {
    const key = specs
      .map(
        (s) =>
          `${s.partnerId}:${s.home.x.toFixed(2)},${s.home.z.toFixed(2)}>` +
          `${s.partner.x.toFixed(2)},${s.partner.z.toFixed(2)}`,
      )
      .join("|");
    if (key === routeKey) return;
    routeKey = key;
    clearRoutes();
    for (const spec of specs) {
      const control = routeCurveControl(spec.home, spec.partner, true);
      const curve = new QuadraticBezierCurve3(
        toVector3(spec.home),
        toVector3(control),
        toVector3(spec.partner),
      );
      const geometry = new TubeGeometry(
        curve,
        ROUTE_STEPS,
        ROUTE_RADIUS,
        ROUTE_RADIAL,
        false,
      );
      const material: Material =
        spec.partnerId === selected ? routeMatSelected : routeMat;
      const meshes = tiles.map((tile) => {
        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = 2;
        tile.add(mesh);
        return mesh;
      });
      routes.push({ partnerId: spec.partnerId, meshes, geometry });
    }
  };

  const setSelectedRoute = (partnerId: string | null) => {
    if (partnerId === selected) return;
    selected = partnerId;
    for (const route of routes) {
      const material =
        route.partnerId === selected ? routeMatSelected : routeMat;
      for (const mesh of route.meshes) mesh.material = material;
    }
  };

  const clearCapitals = () => {
    for (const cap of capitals) {
      for (const node of cap.nodes) node.removeFromParent();
    }
    capitals = [];
  };

  const setCapitals = (specs: CapitalSpec[]) => {
    const key = specs.map((s) => s.key).join("|");
    if (key === capitalKey) {
      /* Same set of capitals, only their lit state may have moved — swap
         materials rather than rebuilding meshes, since this runs on every
         hover change. */
      for (let i = 0; i < capitals.length; i++) {
        const next = specs[i];
        if (!next || next.hot === capitals[i].hot) continue;
        capitals[i].hot = next.hot;
        const material = next.hot ? pinHot : pinCold;
        for (const node of capitals[i].nodes) {
          node.position.y = pinY(next.hot);
          node.traverse((child) => {
            if (child instanceof Mesh) child.material = material;
          });
        }
      }
      return;
    }
    clearCapitals();
    capitalKey = key;
    for (const spec of specs) {
      const material = spec.hot ? pinHot : pinCold;
      const nodes = tiles.map((tile) => {
        const pin = new Group();
        pin.add(new Mesh(baseGeom, material));
        pin.add(new Mesh(pinGeom, material));
        pin.position.set(spec.x, pinY(spec.hot), spec.z);
        tile.add(pin);
        return pin as Object3D;
      });
      capitals.push({ key: spec.key, nodes, hot: spec.hot });
    }
  };

  const dispose = () => {
    clearRoutes();
    routeKey = "";
    clearCapitals();
    pinGeom.dispose();
    baseGeom.dispose();
    routeMat.dispose();
    routeMatSelected.dispose();
    pinCold.dispose();
    pinHot.dispose();
    group.clear();
  };

  return { group, setRoutes, setSelectedRoute, setCapitals, dispose };
}
