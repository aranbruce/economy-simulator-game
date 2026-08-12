"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { feature } from "topojson-client";
import {
  getG,
  PARTNERS,
  activePartners,
  diploMapMarkers,
} from "../../lib/sim/engine.ts";
import {
  HOME_ISO,
  partnerForIso,
  realmRoleForIso,
} from "../../lib/sim/partners.ts";
import {
  boardMetricColour,
  boardMetricMapLabel,
  REALM_FILL,
} from "../../lib/sim/boardMetrics.ts";
import { realmByRole } from "../../lib/sim/realms.ts";

type Point = [number, number];
type Ring = Point[];
/** [outer, ...holes] */
type Rings = Ring[];
type Polys = Rings[];

interface CountryFeature {
  iso: string;
  polys: Polys;
  role: string | null;
  /** Precomputed once at load — ringStrokeChains() per ring, broken at
   *  antimeridian-cut edges. Geometry never changes after load, so this is
   *  invariant to pan/zoom and must not be recomputed on every paint(). */
  strokeChains: Ring[][][];
}

const OCEAN = "#3c4a3f";
const SCENERY_FILL = "#3a3226";
const HOVER_LIFT = 1.18;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 8;
/** Crop Antarctica and empty polar ocean so the playable world fills the frame. */
const LAT_MAX = 84;
const LAT_MIN = -56;
const SKIP_ISO = new Set(["010"]); // Antarctica — not on the board

const SETUP_SELECTED = "#D4AF69";

const DIPLO_MARKER_ORDER = ["envoy", "summit", "summit_staged", "ultimatum"];
const DIPLO_MARKER_SIZE = 18;
const DIPLO_LEGEND_SIZE = 13;
const DIPLO_MARKER_PAD = 6;
const DIPLO_MARKER_OFFSET = 26;

const DIPLO_LEGEND_LABELS: Record<string, string> = {
  envoy: "Envoy",
  summit: "Summit",
  summit_staged: "Queued",
  ultimatum: "Ultimatum",
};

function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith("rgb")) {
    const m = hex.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [26, 42, 68];
  }
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function liftColour(hex: string, k: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${
    Math.min(255, b * k) | 0
  })`;
}

function roleColour(
  role: string,
  mapMetric: string | null,
  selected: string | null,
) {
  const base = boardMetricColour(role, mapMetric || "countries");
  return selected === role ? liftColour(base, 1.12) : base;
}

function clonePoint(p: Point): Point {
  return [p[0], p[1]];
}

/** Equirectangular → normalised board coords in [0,1]². */
function project(lng: number, lat: number): Point {
  const x = (lng + 180) / 360;
  const y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN);
  return [x, y];
}

/** Viewport size, floored so the plate never fits into a degenerate frame —
 *  paint() and plateLayout() (used by hit-testing/zoom-anchoring) must agree
 *  on this or a click/hover can target a different point than what's drawn. */
function clampViewport(cssW: number, cssH: number) {
  return {
    W: Math.max(320, Math.floor(cssW)),
    H: Math.max(240, Math.floor(cssH)),
  };
}

/** Fit the equirectangular plate into the viewport, letterboxed. */
function computePlateLayout(W: number, H: number) {
  const fit = Math.min(W, H * (360 / (LAT_MAX - LAT_MIN)));
  const plateW = fit;
  const plateH = fit * ((LAT_MAX - LAT_MIN) / 360);
  return { plateW, plateH, ox: (W - plateW) / 2, oy: (H - plateH) / 2 };
}

/** Horizontal pixel offsets at which the plate must be redrawn so a tiled
 *  copy covers every point of the viewport — the board wraps east/west, so
 *  panning past one edge should reveal the far side instead of bare ocean. */
function repeatOffsets(
  originX: number,
  period: number,
  viewportW: number,
  /* Safety bound, not a real budget: even an extreme W:H window ratio at
   * MIN_ZOOM needs well under this many tiled copies to fully cover the
   * viewport. It only exists to stop a runaway loop if `period` is ever
   * pathologically small; it must not silently truncate real coverage. */
  maxCopies = 64,
): number[] {
  if (!(period > 0)) return [0];
  const kMin = Math.floor(-originX / period) - 1;
  const kMax = Math.ceil((viewportW - originX) / period) + 1;
  const out: number[] = [];
  for (let k = kMin; k <= kMax && out.length < maxCopies; k++)
    out.push(k * period);
  return out.length ? out : [0];
}

/**
 * Split a ring that crosses the antimeridian into pieces that each stay inside
 * [-180, 180]. Without this, Russia / Fiji stretch into full-width bars.
 *
 * Cuts alone are not enough: a closed ring that crosses twice (Russia's Far
 * East) yields two open chains on the *same* side of ±180. Closing each chain
 * to its own first vertex draws a diagonal across the Sea of Okhotsk. Merge
 * same-side fragments first, then close along the cut meridian.
 */
function splitAntimeridianRing(ring: Ring): Ring[] {
  if (!ring || ring.length < 3) return [];
  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];

  const chains: Ring[] = [];
  let cur: Ring = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng0, lat0] = ring[i];
    const [lng1, lat1] = ring[i + 1];
    cur.push([lng0, lat0]);
    const dl = lng1 - lng0;
    if (Math.abs(dl) > 180) {
      /* Edge crosses ±180. Cut at the dateline and start a new chain. */
      const goingEast = dl < -180; // e.g. 170 → -170
      const cut0 = goingEast ? 180 : -180;
      const cut1 = goingEast ? -180 : 180;
      const denom = lng1 - lng0 + (goingEast ? 360 : -360);
      /* Fiji's topojson already stitches ±180 at constant lat (denom ≈ 0).
         Interpolating then yields NaN and a thin bar across the Pacific. */
      const latX =
        Math.abs(denom) < 1e-9
          ? lat0
          : lat0 +
            Math.max(0, Math.min(1, (cut0 - lng0) / denom)) * (lat1 - lat0);
      if (Math.abs(lng0 - cut0) > 1e-9) cur.push([cut0, latX]);
      chains.push(cur);
      cur = [[cut1, latX]];
    }
  }
  cur.push(clonePoint(ring[ring.length - 1]));

  if (!chains.length) {
    const out = ring.map(clonePoint);
    if (!isClosed) out.push(clonePoint(out[0]));
    return [out];
  }

  if (isClosed) {
    /* Last chain ends at ring[0]; first starts there — join into one side. */
    const first = chains.shift()!;
    cur.pop();
    cur.push(...first.slice(1));
    chains.push(cur);
  } else {
    chains.push(cur);
  }

  return chains
    .filter((c) => c.length >= 3)
    .map((c) => {
      const out = c.map(clonePoint);
      const a = out[0];
      const b = out[out.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(clonePoint(a));
      return out;
    })
    .filter((c) =>
      c.every(
        ([lng, lat]: Point) => Number.isFinite(lng) && Number.isFinite(lat),
      ),
    );
}

const SEAM_EPS = 1e-6;
/** True if a normalised-space edge runs along the antimeridian cut that
 *  `splitAntimeridianRing` adds (both endpoints pinned to nx≈0 or nx≈1, on
 *  the same side) — a synthetic edge, not real coastline. */
function isSeamEdge(a: Point, b: Point): boolean {
  const nearLeft = (n: number) => n < SEAM_EPS;
  const nearRight = (n: number) => n > 1 - SEAM_EPS;
  return (
    (nearLeft(a[0]) && nearLeft(b[0])) || (nearRight(a[0]) && nearRight(b[0]))
  );
}

/** Break a ring into polylines for stroking, omitting antimeridian-cut
 *  edges — otherwise a split country like Russia strokes a straight line
 *  through itself wherever its two pieces sit side by side (routine once
 *  the map wraps, and possible even unwrapped right at the plate edge). */
function ringStrokeChains(ring: Ring): Ring[] {
  const chains: Ring[] = [];
  let cur: Ring = [ring[0]];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (isSeamEdge(a, b)) {
      if (cur.length > 1) chains.push(cur);
      cur = [b];
    } else {
      cur.push(b);
    }
  }
  if (cur.length > 1) chains.push(cur);
  return chains;
}

function geomToPolys(geom: any): Polys {
  if (!geom || !geom.coordinates) return [];
  const raw =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  const out: Polys = [];
  for (const rings of raw) {
    if (!rings[0]) continue;
    const outerParts = splitAntimeridianRing(rings[0]);
    /* Holes that don't cross stay with every outer part that contains them —
       for dateline countries holes are rare; keep holes only on the first part. */
    const holes: Ring[] = rings
      .slice(1)
      .flatMap((h: Ring) => splitAntimeridianRing(h));
    outerParts.forEach((outer, i) => {
      const poly: Rings = [outer.map(([lng, lat]) => project(lng, lat))];
      if (i === 0) {
        for (const h of holes) {
          poly.push(h.map(([lng, lat]) => project(lng, lat)));
        }
      }
      out.push(poly);
    });
  }
  return out;
}

function pointInRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolys(x: number, y: number, polys: Polys) {
  for (const rings of polys) {
    if (!rings[0] || !pointInRing(x, y, rings[0])) continue;
    let hole = false;
    for (let r = 1; r < rings.length; r++) {
      if (pointInRing(x, y, rings[r])) {
        hole = true;
        break;
      }
    }
    if (!hole) return true;
  }
  return false;
}

/** Absolute shoelace area of a closed ring in normalised board coords. */
function ringArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

/** Area centroid of a closed ring; falls back to vertex mean if degenerate. */
function ringCentroid(ring: Ring): Point {
  let cx = 0,
    cy = 0,
    a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-18) {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
      n++;
    }
    return n ? [sx / n, sy / n] : [0.5, 0.5];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * Label / trade-line anchor for a realm. Uses the largest outer ring so
 * overseas scraps (French Guiana on Gaul, Alaska on the US, …) do not pull
 * the pin into the ocean.
 */
function polysCentroid(polys: Polys): Point {
  let best: Ring | null = null,
    bestA = -1;
  for (const rings of polys) {
    const ring = rings[0];
    if (!ring || ring.length < 3) continue;
    const a = ringArea(ring);
    if (a > bestA) {
      bestA = a;
      best = ring;
    }
  }
  return best ? ringCentroid(best) : [0.5, 0.5];
}

function roleForFeature(
  iso: string,
  homeRole?: string | null,
  homeIso?: string | null,
) {
  return partnerForIso(iso, homeIso || HOME_ISO, homeRole || null);
}

function polysForRole(
  role: string,
  countries: CountryFeature[],
  hRole: string | null,
  hIso: string | null,
  setupMode: boolean,
): Polys | null {
  /* "home" means the UK in setup (the fixed reference territory on the
     picker) but the actual player's country once a game is running —
     realmByRole("home") only knows the former, so resolve via hIso here
     instead, or a same-role UK label/marker ends up drawn over whichever
     country the player is actually playing. */
  let anchorIso: string | null;
  if (role === "home" && !setupMode) {
    anchorIso = hIso ? String(hIso).padStart(3, "0") : null;
  } else {
    const realm = realmByRole(role);
    anchorIso = realm.iso ? String(realm.iso).padStart(3, "0") : null;
  }
  if (anchorIso) {
    const anchor = countries.find((c) => c.iso === anchorIso);
    if (anchor && anchor.polys.length) return anchor.polys;
  }
  const polys = countries
    .filter((c) => {
      if (setupMode) return realmRoleForIso(c.iso) === role;
      return roleForFeature(c.iso, hRole, hIso) === role;
    })
    .flatMap((c) => c.polys);
  return polys.length ? polys : null;
}

/** Small vector glyph per marker kind, drawn in the badge's ring colour. */
function drawDiploMarkerGlyph(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  size: number,
) {
  const g = size * 0.21;
  ctx.strokeStyle = "#f2e6c8";
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "envoy") {
    /* Briefcase: body plus a handle arc. */
    ctx.rect(cx - g, cy - g * 0.5, g * 2, g * 1.3);
    ctx.moveTo(cx - g * 0.45, cy - g * 0.5);
    ctx.arc(cx, cy - g * 0.7, g * 0.45, Math.PI, 0);
  } else if (kind === "summit") {
    /* Two linked rings. */
    ctx.arc(cx - g * 0.5, cy, g * 0.55, 0, Math.PI * 2);
    ctx.moveTo(cx + g * 1.05, cy);
    ctx.arc(cx + g * 0.5, cy, g * 0.55, 0, Math.PI * 2);
  } else if (kind === "summit_staged") {
    /* Calendar: body plus a top rule. */
    ctx.rect(cx - g, cy - g * 0.8, g * 2, g * 1.7);
    ctx.moveTo(cx - g, cy - g * 0.2);
    ctx.lineTo(cx + g, cy - g * 0.2);
  } else if (kind === "ultimatum") {
    /* Warning triangle. */
    ctx.moveTo(cx, cy - g);
    ctx.lineTo(cx + g * 0.95, cy + g * 0.75);
    ctx.lineTo(cx - g * 0.95, cy + g * 0.75);
    ctx.closePath();
  }
  ctx.stroke();
  if (kind === "ultimatum") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - g * 0.15);
    ctx.lineTo(cx, cy + g * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + g * 0.58, size * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = "#f2e6c8";
    ctx.fill();
  }
}

/** Gold-ringed dark badge with a small vector glyph — matches the icon
 *  rail's language instead of raw platform emoji. */
function drawDiploMarker(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#17110a";
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeStyle = "#d4af69";
  ctx.stroke();
  ctx.shadowBlur = 0;
  drawDiploMarkerGlyph(ctx, kind, cx, cy, size);
  ctx.restore();
}

/** A small warm-tinted noise tile, generated once and reused across every
 *  paint() call (and every WorldMap instance) — cheap to composite as a
 *  repeating pattern, expensive to regenerate every frame. */
let _grainTile: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement | null {
  if (_grainTile) return _grainTile;
  if (typeof document === "undefined") return null;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const tctx = c.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 20 + Math.floor(Math.random() * 20);
    img.data[i] = v;
    img.data[i + 1] = Math.round(v * 0.85);
    img.data[i + 2] = Math.round(v * 0.6);
    img.data[i + 3] = Math.floor(Math.random() * 70);
  }
  tctx.putImageData(img, 0, 0);
  _grainTile = c;
  return _grainTile;
}
/** createPattern() only needs to run once — a CanvasPattern isn't bound to
 *  the context that created it, so the same object composites fine on any
 *  2D context. Recreating it every paint() (unthrottled on drag/pinch) was
 *  pure allocation churn for an unchanging texture. */
let _grainPattern: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (_grainPattern) return _grainPattern;
  const tile = grainTile();
  if (!tile) return null;
  _grainPattern = ctx.createPattern(tile, "repeat");
  return _grainPattern;
}

/**
 * Real-world map: Natural Earth coastlines, home and partner realms lit,
 * everything else dim. Setup clicks a country to choose its realm.
 */
interface WorldMapProps {
  tick?: number;
  mapMetric?: string | null;
  selectedRole?: string | null;
  onSelect?: (role: string | null) => void;
  onHover?: (
    hit: {
      iso: string;
      pickRole: string | null;
      role: string | null;
      label: string | null;
    } | null,
  ) => void;
  onFail?: () => void;
  homeIso?: string | null;
  homeRole?: string;
  setupMode?: boolean;
}

export default function WorldMap({
  tick,
  mapMetric,
  selectedRole,
  onSelect,
  onHover,
  onFail,
  homeIso,
  homeRole = "home",
  setupMode = false,
}: WorldMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Offscreen buffer the terrain (ocean + every country fill/stroke) is
   *  drawn to unfiltered, so the sepia/contrast color-grade below composites
   *  once via drawImage() instead of running the canvas filter pipeline on
   *  ~180 individual fill()/stroke() calls per paint(). */
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const countriesRef = useRef<CountryFeature[]>([]);
  const viewRef = useRef({ scale: 1.15, tx: 0, ty: 0 });
  const dragRef = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
    pointerId: number | null;
  } | null>(null);
  /** Active pointer positions for one-finger pan / two-finger pinch. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const hoverRoleRef = useRef<string | null>(null);
  const hoverIsoRef = useRef<string | null>(null);
  const failed = useRef(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const countries = countriesRef.current;
    if (!canvas || !countries.length) return;
    const wrap = wrapRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = wrap?.clientWidth || window.innerWidth;
    const cssH = wrap?.clientHeight || window.innerHeight;
    const { W, H } = clampViewport(cssW, cssH);
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Terrain (ocean + every country fill/stroke) draws unfiltered to this
       offscreen buffer; the sepia/contrast color-grade composites it onto
       the main canvas in one drawImage() below instead of running the
       canvas filter pipeline on every individual fill()/stroke() call. */
    let terrain = terrainCanvasRef.current;
    if (!terrain) {
      terrain = document.createElement("canvas");
      terrainCanvasRef.current = terrain;
    }
    if (terrain.width !== W * dpr || terrain.height !== H * dpr) {
      terrain.width = W * dpr;
      terrain.height = H * dpr;
    }
    const tctx = terrain.getContext("2d");
    if (!tctx) return;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, W, H);

    tctx.fillStyle = OCEAN;
    tctx.fillRect(0, 0, W, H);

    const glow = tctx.createRadialGradient(
      W * 0.5,
      H * 0.48,
      W * 0.08,
      W * 0.5,
      H * 0.5,
      W * 0.7,
    );
    glow.addColorStop(0, "rgba(70,51,27,.5)");
    glow.addColorStop(1, "rgba(8,5,3,0)");
    tctx.fillStyle = glow;
    tctx.fillRect(0, 0, W, H);

    const { scale, tx, ty } = viewRef.current;
    const { plateW, plateH, ox, oy } = computePlateLayout(W, H);
    /* The board wraps east/west: draw the plate at every horizontal offset
       needed to tile the current viewport instead of once. */
    const offsets = repeatOffsets(ox + tx, plateW * scale, W);
    const toScreen = (nx: number, ny: number, dx: number): Point => [
      ox + nx * plateW * scale + tx + dx,
      oy + ny * plateH * scale + ty,
    ];

    const G = getG();
    const hRole = homeRole || G?.homeRole || "home";
    const hIso = homeIso || G?.homeIso || HOME_ISO;
    const hoverRole = hoverRoleRef.current;
    const hoverIso = hoverIsoRef.current;

    const isSelected = (role: string | null) => selectedRole === role;
    const isHovered = (role: string | null, iso: string) =>
      setupMode ? hoverIso === iso : hoverRole === role;

    const fillFor = (role: string | null, iso: string) => {
      if (!role) return SCENERY_FILL;
      if (setupMode) {
        if (isSelected(role)) return SETUP_SELECTED;
        return (REALM_FILL as Record<string, string>)[role] || "#6a7a94";
      }
      let fill = roleColour(role, mapMetric ?? null, selectedRole ?? null);
      if (isHovered(role, iso) || isSelected(role))
        fill = liftColour(fill, HOVER_LIFT);
      return fill;
    };

    /* Scenery under partners under home. */
    const order = [
      ...countries.filter((c) => !c.role),
      ...countries.filter((c) => c.role && c.role !== "home"),
      ...countries.filter((c) => c.role === "home"),
    ];
    const renderList = order.map((c) => {
      const role = roleForFeature(c.iso, hRole, hIso);
      return {
        c,
        role,
        fill: fillFor(role, c.iso),
        strokeChains: c.strokeChains,
      };
    });

    /* Every visible tiled copy of a country is filled/stroked in one path
       per country (not one path per copy) — two separate fill() calls that
       happen to share an edge each anti-alias that edge independently, and
       compositing them leaves a visible hairline gap where the coverage
       doesn't sum to 100%. A single path spanning every offset avoids that,
       which matters once wrap makes two tiled copies of a country (e.g. the
       two antimeridian-split pieces of Russia) sit edge-to-edge. */
    for (const { c, role, fill, strokeChains } of renderList) {
      tctx.beginPath();
      for (const dx of offsets) {
        for (const rings of c.polys) {
          for (const ring of rings) {
            ring.forEach(([nx, ny], i) => {
              const [x, y] = toScreen(nx, ny, dx);
              if (i === 0) tctx.moveTo(x, y);
              else tctx.lineTo(x, y);
            });
            tctx.closePath();
          }
        }
      }
      tctx.fillStyle = fill;
      tctx.fill("evenodd");
      /* Always stroke land so adjoining realms (Russia / China) stay
         distinct even when fills are close. Stroked separately from the
         fill path, and broken at antimeridian-cut edges, so a split
         country's two pieces don't draw a seam line through themselves. */
      tctx.beginPath();
      for (const dx of offsets) {
        for (const group of strokeChains) {
          for (const ringChains of group) {
            for (const chain of ringChains) {
              chain.forEach(([nx, ny], i) => {
                const [x, y] = toScreen(nx, ny, dx);
                if (i === 0) tctx.moveTo(x, y);
                else tctx.lineTo(x, y);
              });
            }
          }
        }
      }
      if (role) {
        const hot =
          isSelected(role) || isHovered(role, c.iso) || role === "home";
        tctx.strokeStyle = hot
          ? "rgba(246,240,226,.55)"
          : "rgba(24,18,10,.55)";
        tctx.lineWidth = hot ? 1.15 : 0.7;
        tctx.stroke();
      } else {
        tctx.strokeStyle = "rgba(24,18,10,.35)";
        tctx.lineWidth = 0.4;
        tctx.stroke();
      }
    }

    /* Composite the unfiltered terrain buffer through the sepia/contrast
       color-grade in one drawImage() call, rather than running the canvas
       filter pipeline on every fill()/stroke() above. */
    ctx.save();
    ctx.filter = "sepia(0.14) saturate(0.82) contrast(1.07) brightness(1.02)";
    ctx.drawImage(terrain, 0, 0, W, H);
    ctx.restore();

    /* Trade lines from home to partners (play only). */
    if (!setupMode && G) {
      const homePolys = countries
        .filter((c) => roleForFeature(c.iso, hRole, hIso) === "home")
        .flatMap((c) => c.polys);
      if (homePolys.length) {
        const [hx, hy] = polysCentroid(homePolys);
        const partnerLines = activePartners(hRole)
          .map((p) => {
            const pPolys = countries
              .filter((c) => roleForFeature(c.iso, hRole, hIso) === p.id)
              .flatMap((c) => c.polys);
            if (!pPolys.length) return null;
            const [px, py] = polysCentroid(pPolys);
            const rel = G.rel[p.id] ?? 50;
            const stroke =
              rel > 62
                ? "rgba(48,209,88,.22)"
                : rel > 45
                  ? "rgba(100,210,255,.18)"
                  : "rgba(255,69,58,.16)";
            return { px, py, stroke, lineWidth: selectedRole === p.id ? 2 : 1 };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);

        for (const dx of offsets) {
          const [hsx, hsy] = toScreen(hx, hy, dx);
          for (const { px, py, stroke, lineWidth } of partnerLines) {
            const [psx, psy] = toScreen(px, py, dx);
            ctx.beginPath();
            ctx.moveTo(hsx, hsy);
            ctx.quadraticCurveTo(
              (hsx + psx) / 2,
              (hsy + psy) / 2 - H * 0.03 * scale,
              psx,
              psy,
            );
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }

    /* Diplomatic activity markers (play only). */
    if (!setupMode && G) {
      const markers = diploMapMarkers(G);
      const byPartner: Record<string, any[]> = {};
      for (const m of markers) {
        if (!byPartner[m.partnerId]) byPartner[m.partnerId] = [];
        byPartner[m.partnerId].push(m);
      }
      const partnerMarkerRows = Object.keys(byPartner)
        .map((partnerId) => {
          const polys = polysForRole(
            partnerId,
            countries,
            hRole,
            hIso,
            setupMode,
          );
          if (!polys) return null;
          const [nx, ny] = polysCentroid(polys);
          const kinds: string[] = byPartner[partnerId]
            .map((m) => m.kind)
            .sort(
              (a: string, b: string) =>
                DIPLO_MARKER_ORDER.indexOf(a) - DIPLO_MARKER_ORDER.indexOf(b),
            );
          /* Every diplomacy marker is the same size, so the row width is
             just kinds.length copies of it plus the gaps between them. */
          const rowW =
            kinds.length * DIPLO_MARKER_SIZE +
            DIPLO_MARKER_PAD * Math.max(0, kinds.length - 1);
          return { nx, ny, kinds, rowW };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      for (const dx of offsets) {
        for (const { nx, ny, kinds, rowW } of partnerMarkerRows) {
          const [x, y] = toScreen(nx, ny, dx);
          let cursor = x - rowW / 2;
          kinds.forEach((kind) => {
            const sx = cursor + DIPLO_MARKER_SIZE / 2;
            cursor += DIPLO_MARKER_SIZE + DIPLO_MARKER_PAD;
            const sy = y - DIPLO_MARKER_OFFSET;
            drawDiploMarker(
              ctx,
              kind,
              sx,
              sy,
              DIPLO_MARKER_SIZE,
              kind === "summit_staged" ? 0.82 : 1,
            );
          });
        }
      }

      if (markers.length) {
        const kindsPresent = new Set(markers.map((m) => m.kind));
        const legendY = H - 36;
        let lx = 14;
        ctx.font = "500 11px -apple-system, system-ui, sans-serif";
        ctx.fillStyle = "rgba(246,240,226,.6)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const kind of DIPLO_MARKER_ORDER) {
          if (!kindsPresent.has(kind)) continue;
          drawDiploMarker(
            ctx,
            kind,
            lx + 8,
            legendY,
            DIPLO_LEGEND_SIZE,
            kind === "summit_staged" ? 0.82 : 1,
          );
          const label = DIPLO_LEGEND_LABELS[kind];
          ctx.fillText(label, lx + 18, legendY);
          lx += 18 + ctx.measureText(label).width + 12;
        }
      }
    }

    /* Labels: one per realm still on the board. Set directly on the terrain
       in capitalised sans-serif, no pill background — legibility comes from
       a soft drop shadow rather than a solid box. */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const labelRoles = setupMode
      ? ["home", ...PARTNERS.map((p) => p.id).filter((id) => id !== "kingdom")]
      : ["home", ...activePartners(hRole).map((p) => p.id)];

    const labelRows = labelRoles
      .map((role) => {
        const polys = polysForRole(role, countries, hRole, hIso, setupMode);
        if (!polys) return null;
        const [nx, ny] = polysCentroid(polys);
        let rawText;
        if (role === "home") {
          const homeName = setupMode
            ? realmByRole("home").name
            : (G && G.country) || realmByRole(hRole).name;
          rawText = setupMode
            ? homeName
            : boardMetricMapLabel("home", mapMetric ?? null, homeName, G);
        } else {
          const p = PARTNERS.find((x) => x.id === role);
          const name = p ? p.name : role;
          rawText = setupMode
            ? name
            : boardMetricMapLabel(role, mapMetric ?? null, name, G);
        }
        const text = rawText.toUpperCase();
        const hot = isSelected(role) || hoverRole === role;
        /* Placement priority is separate from hot's bold/gold styling — the
           player's own realm should keep its label even when neither
           selected nor hovered. */
        const priority = hot || role === "home" ? 1 : 0;
        const font = hot
          ? '700 12px "Plus Jakarta Sans", -apple-system, system-ui, sans-serif'
          : '600 11px "Plus Jakarta Sans", -apple-system, system-ui, sans-serif';
        /* Font/width only depend on the label itself, not which wrapped
           copy of the world it's drawn at — compute once here rather than
           inside the offsets loop below, which redoes it 2-3x per label
           on every paint(). */
        ctx.font = font;
        const w = ctx.measureText(text).width;
        return { nx, ny, text, hot, priority, font, w };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      /* Stable sort: priority labels claim their space first, so a crowded
         cluster (real-world geography packs some realms tightly) drops the
         lower-priority overlaps instead of drawing them on top of each
         other illegibly. */
      .sort((a, b) => b.priority - a.priority);

    ctx.save();
    ctx.shadowColor = "rgba(15,11,6,.85)";
    ctx.shadowBlur = 4;
    for (const dx of offsets) {
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const { nx, ny, text, hot, font, w } of labelRows) {
        const [x, y] = toScreen(nx, ny, dx);
        const h = hot ? 15 : 14;
        const pad = 3;
        const box = {
          x0: x - w / 2 - pad,
          y0: y - h / 2 - pad,
          x1: x + w / 2 + pad,
          y1: y + h / 2 + pad,
        };
        const collides = placed.some(
          (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
        );
        if (collides) continue;
        placed.push(box);
        ctx.font = font;
        ctx.shadowOffsetY = hot ? 1 : 0.5;
        ctx.fillStyle = hot ? "#f2d9a0" : "rgba(246,240,226,.88)";
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();

    ctx.font = "500 11px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = "rgba(246,240,226,.3)";
    ctx.textAlign = "left";
    ctx.fillText(
      setupMode
        ? "Click a country · pinch or scroll to zoom · drag to pan"
        : "Pinch or scroll to zoom · drag to pan",
      14,
      H - 14,
    );

    /* Paper-grain texture, composited last so it sits over terrain, trade
       lines, markers and labels alike — an aged-atlas finish, not just a
       terrain effect. */
    const pattern = grainPattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }, [mapMetric, selectedRole, tick, setupMode, homeRole, homeIso]);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries-110m.json")
      .then((r) => {
        if (!r.ok) throw new Error("geo fetch failed");
        return r.json();
      })
      .then((topo) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries);
        countriesRef.current = fc.features
          .map((f: any) => {
            const iso = String(f.id).padStart(3, "0");
            if (SKIP_ISO.has(iso)) return null;
            const polys = geomToPolys(f.geometry);
            if (!polys.length) return null;
            return {
              iso,
              polys,
              role: realmRoleForIso(iso),
              strokeChains: polys.map((rings) =>
                rings.map((ring) => ringStrokeChains(ring)),
              ),
            };
          })
          .filter(Boolean);
        /* Centre the opening view on the Atlantic / Europe. */
        viewRef.current = { scale: 1.35, tx: 40, ty: 20 };
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!failed.current) {
          failed.current = true;
          onFail?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onFail]);

  useEffect(() => {
    if (!ready) return;
    paint();
  }, [ready, paint]);

  useEffect(() => {
    if (!ready) return;
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ready, paint]);

  const plateLayout = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const cssW = wrap.clientWidth || window.innerWidth;
    const cssH = wrap.clientHeight || window.innerHeight;
    const { W, H } = clampViewport(cssW, cssH);
    return { W, H, ...computePlateLayout(W, H) };
  }, []);

  /** Zoom toward a canvas-local point (or the plate centre). */
  const zoomAt = useCallback(
    (factor: number, canvasX?: number | null, canvasY?: number | null) => {
      const layout = plateLayout();
      if (!layout) return;
      const { ox, oy, W, H } = layout;
      const mx = canvasX == null ? W / 2 : canvasX;
      const my = canvasY == null ? H / 2 : canvasY;
      const v = viewRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor));
      if (next === v.scale) return;
      const k = next / v.scale;
      viewRef.current = {
        scale: next,
        tx: (1 - k) * (mx - ox) + k * v.tx,
        ty: (1 - k) * (my - oy) + k * v.ty,
      };
      paint();
    },
    [paint, plateLayout],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ready) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      /* Pixel-mode trackpads need a continuous scale; line-mode keeps clicks. */
      let factor: number;
      if (e.ctrlKey) {
        /* macOS pinch-to-zoom arrives as ctrl+wheel. */
        factor = Math.exp(-e.deltaY * 0.01);
      } else if (e.deltaMode === 0) {
        factor = Math.exp(-e.deltaY * 0.0018);
      } else {
        factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      }
      zoomAt(factor, mx, my);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [ready, zoomAt]);

  const screenToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const layout = plateLayout();
      if (!canvas || !layout) return null;
      const { scale, tx, ty } = viewRef.current;
      const { plateW, plateH, ox, oy } = layout;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      /* The board wraps east/west, so any horizontally-tiled copy of a
         country should hit-test the same as the canonical one. */
      const rawNx = (sx - ox - tx) / (plateW * scale);
      return {
        nx: ((rawNx % 1) + 1) % 1,
        ny: (sy - oy - ty) / (plateH * scale),
      };
    },
    [plateLayout],
  );

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const pt = screenToNorm(clientX, clientY);
      const countries = countriesRef.current;
      if (!pt || !countries.length) return null;
      /* Prefer smaller countries (islands) when rings nest / overlap. */
      const ordered = [...countries].sort(
        (a, b) => a.polys.length - b.polys.length,
      );
      for (const c of ordered) {
        if (pointInPolys(pt.nx, pt.ny, c.polys)) {
          const pickRole = realmRoleForIso(c.iso);
          const playRole = roleForFeature(
            c.iso,
            homeRole || getG()?.homeRole || "home",
            homeIso || getG()?.homeIso || HOME_ISO,
          );
          return {
            iso: c.iso,
            pickRole,
            role: playRole,
            label: pickRole ? realmByRole(pickRole).name : null,
          };
        }
      }
      return null;
    },
    [screenToNorm, homeRole, homeIso],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      /* Second finger: leave pan, start pinch. Drop capture so both track. */
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (dragRef.current?.pointerId != null) {
        try {
          canvas.releasePointerCapture?.(dragRef.current.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      dragRef.current = null;
      const pts = [...pointersRef.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy) || 1,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      return;
    }
    pinchRef.current = null;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: viewRef.current.tx,
      ty: viewRef.current.ty,
      moved: false,
      pointerId: e.pointerId,
    };
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()].slice(0, 2);
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const pinch = pinchRef.current;
      const factor = dist / pinch.dist;
      const wrap = wrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        zoomAt(factor, midX - rect.left, midY - rect.top);
        viewRef.current = {
          ...viewRef.current,
          tx: viewRef.current.tx + (midX - pinch.midX),
          ty: viewRef.current.ty + (midY - pinch.midY),
        };
        paint();
      }
      pinchRef.current = { dist, midX, midY };
      return;
    }

    const drag = dragRef.current;
    if (drag && (e.buttons & 1 || drag.pointerId != null)) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) {
        viewRef.current = {
          ...viewRef.current,
          tx: drag.tx + dx,
          ty: drag.ty + dy,
        };
        paint();
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        return;
      }
    }

    const hit = pickAt(e.clientX, e.clientY);
    const nextRole = hit ? (setupMode ? hit.pickRole : hit.role) : null;
    const nextIso = hit && setupMode ? hit.iso : null;
    if (nextRole !== hoverRoleRef.current || nextIso !== hoverIsoRef.current) {
      hoverRoleRef.current = nextRole;
      hoverIsoRef.current = nextIso;
      if (canvasRef.current) {
        const canPick = setupMode ? !!hit?.pickRole : !!hit?.role;
        canvasRef.current.style.cursor = canPick ? "pointer" : "grab";
      }
      paint();
      onHover?.(hit);
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      /* Resume one-finger pan from the remaining finger. */
      const [id, pt] = [...pointersRef.current.entries()][0];
      dragRef.current = {
        x: pt.x,
        y: pt.y,
        tx: viewRef.current.tx,
        ty: viewRef.current.ty,
        moved: true,
        pointerId: id,
      };
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const wasPinching =
      pinchRef.current != null || pointersRef.current.size > 1;
    endPointer(e);
    if (canvasRef.current) {
      const hit = pickAt(e.clientX, e.clientY);
      const canPick = setupMode ? !!hit?.pickRole : !!hit?.role;
      canvasRef.current.style.cursor = canPick ? "pointer" : "grab";
    }
    if (wasPinching) {
      if (pointersRef.current.size === 0) dragRef.current = null;
      return;
    }
    dragRef.current = pointersRef.current.size === 1 ? dragRef.current : null;
    if (drag && !drag.moved && pointersRef.current.size === 0) {
      const hit = pickAt(e.clientX, e.clientY);
      if (setupMode) {
        if (hit?.pickRole) onSelect?.(hit.pickRole);
      } else if (hit?.role) {
        onSelect?.(hit.role);
      } else {
        onSelect?.(null);
      }
    }
  };

  const onPointerLeave = (
    e: ReactPointerEvent<HTMLCanvasElement> | undefined,
  ) => {
    /* Only clear hover when the primary pointer leaves; keep multi-touch. */
    if (e && pointersRef.current.has(e.pointerId)) {
      endPointer(e);
    }
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      pinchRef.current = null;
    }
    if (hoverRoleRef.current || hoverIsoRef.current) {
      hoverRoleRef.current = null;
      hoverIsoRef.current = null;
      paint();
      onHover?.(null);
    }
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  return (
    <div
      id="worldMapLayer"
      ref={wrapRef}
      className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_45%,#57685a_0%,#3c4a3f_58%,#1b130c_100%)]"
    >
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-[13px] text-white/40">
          Loading…
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        className="absolute inset-0 block h-full w-full cursor-grab"
        aria-label={
          setupMode ? "Choose your country on the world map" : "World map"
        }
      />
    </div>
  );
}
