"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import { getG, PARTNERS, activePartners } from "../../lib/sim/engine.js";
import {
  HOME_ISO,
  PARTNER_ISO,
  partnerForIso,
  realmRoleForIso,
} from "../../lib/sim/partners.js";
import {
  boardMetricColour,
  boardMetricMapLabel,
  boardMetricValueLabel,
  REALM_FILL,
} from "../../lib/sim/boardMetrics.js";
import { realmByRole } from "../../lib/sim/realms.js";

const OCEAN = "#080e1c";
const SCENERY_FILL = "#1c2433";
const HOVER_LIFT = 1.18;
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 8;
/** Crop Antarctica and empty polar ocean so the playable world fills the frame. */
const LAT_MAX = 84;
const LAT_MIN = -56;
const SKIP_ISO = new Set(["010"]); // Antarctica — not on the board

const SETUP_SELECTED = "#D4AF69";

function hexToRgb(hex) {
  if (hex.startsWith("rgb")) {
    const m = hex.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [26, 42, 68];
  }
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function liftColour(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${
    Math.min(255, b * k) | 0
  })`;
}

function roleColour(role, mapMetric, selected) {
  const base = boardMetricColour(role, mapMetric || "countries");
  return selected === role ? liftColour(base, 1.12) : base;
}

/** Equirectangular → normalised board coords in [0,1]². */
function project(lng, lat) {
  const x = (lng + 180) / 360;
  const y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN);
  return [x, y];
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
function splitAntimeridianRing(ring) {
  if (!ring || ring.length < 3) return [];
  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];

  const chains = [];
  let cur = [];
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
  cur.push(ring[ring.length - 1].slice());

  if (!chains.length) {
    const out = ring.map((p) => p.slice());
    if (!isClosed) out.push(out[0].slice());
    return [out];
  }

  if (isClosed) {
    /* Last chain ends at ring[0]; first starts there — join into one side. */
    const first = chains.shift();
    cur.pop();
    cur.push(...first.slice(1));
    chains.push(cur);
  } else {
    chains.push(cur);
  }

  return chains
    .filter((c) => c.length >= 3)
    .map((c) => {
      const out = c.map((p) => p.slice());
      const a = out[0];
      const b = out[out.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(a.slice());
      return out;
    })
    .filter((c) =>
      c.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    );
}

function geomToPolys(geom) {
  if (!geom || !geom.coordinates) return [];
  const raw =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  const out = [];
  for (const rings of raw) {
    if (!rings[0]) continue;
    const outerParts = splitAntimeridianRing(rings[0]);
    /* Holes that don't cross stay with every outer part that contains them —
       for dateline countries holes are rare; keep holes only on the first part. */
    const holes = rings.slice(1).flatMap((h) => splitAntimeridianRing(h));
    outerParts.forEach((outer, i) => {
      const poly = [outer.map(([lng, lat]) => project(lng, lat))];
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

function pointInRing(x, y, ring) {
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

function pointInPolys(x, y, polys) {
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
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

/** Area centroid of a closed ring; falls back to vertex mean if degenerate. */
function ringCentroid(ring) {
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
function polysCentroid(polys) {
  let best = null,
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roleForFeature(iso, homeRole, homeIso) {
  return partnerForIso(iso, homeIso || HOME_ISO, homeRole || null);
}

/**
 * Real-world map: Natural Earth coastlines, home and partner realms lit,
 * everything else dim. Setup clicks a country to choose its realm.
 */
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
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const countriesRef = useRef([]);
  const viewRef = useRef({ scale: 1.15, tx: 0, ty: 0 });
  const dragRef = useRef(null);
  /** Active pointer positions for one-finger pan / two-finger pinch. */
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [ready, setReady] = useState(false);
  const hoverRoleRef = useRef(null);
  const hoverIsoRef = useRef(null);
  const failed = useRef(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const countries = countriesRef.current;
    if (!canvas || !countries.length) return;
    const wrap = wrapRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = wrap?.clientWidth || window.innerWidth;
    const cssH = wrap?.clientHeight || window.innerHeight;
    const W = Math.max(320, Math.floor(cssW));
    const H = Math.max(240, Math.floor(cssH));
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(
      W * 0.5,
      H * 0.48,
      W * 0.08,
      W * 0.5,
      H * 0.5,
      W * 0.7
    );
    glow.addColorStop(0, "rgba(15,28,51,.55)");
    glow.addColorStop(1, "rgba(4,6,12,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const { scale, tx, ty } = viewRef.current;
    /* Fit the equirectangular plate into the viewport, letterboxed. */
    const fit = Math.min(W, H * (360 / (LAT_MAX - LAT_MIN)));
    const plateW = fit;
    const plateH = fit * ((LAT_MAX - LAT_MIN) / 360);
    const ox = (W - plateW) / 2;
    const oy = (H - plateH) / 2;
    const toScreen = (nx, ny) => [
      ox + nx * plateW * scale + tx,
      oy + ny * plateH * scale + ty,
    ];

    const G = getG();
    const hRole = homeRole || G?.homeRole || "home";
    const hIso = homeIso || G?.homeIso || HOME_ISO;
    const hoverRole = hoverRoleRef.current;
    const hoverIso = hoverIsoRef.current;

    const isSelected = (role) => selectedRole === role;
    const isHovered = (role, iso) =>
      setupMode ? hoverIso === iso : hoverRole === role;

    const fillFor = (role, iso) => {
      if (!role) return SCENERY_FILL;
      if (setupMode) {
        if (isSelected(role)) return SETUP_SELECTED;
        return REALM_FILL[role] || "#6a7a94";
      }
      let fill = roleColour(role, mapMetric, selectedRole);
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

    for (const c of order) {
      const role = roleForFeature(c.iso, hRole, hIso);
      const fill = fillFor(role, c.iso);
      ctx.beginPath();
      for (const rings of c.polys) {
        for (const ring of rings) {
          ring.forEach(([nx, ny], i) => {
            const [x, y] = toScreen(nx, ny);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
      ctx.fillStyle = fill;
      ctx.fill("evenodd");
      /* Always stroke land so adjoining realms (Russia / China) stay distinct
         even when fills are close. */
      if (role) {
        const hot =
          isSelected(role) || isHovered(role, c.iso) || role === "home";
        ctx.strokeStyle = hot
          ? "rgba(255,255,255,.5)"
          : "rgba(8,14,28,.55)";
        ctx.lineWidth = hot ? 1.15 : 0.7;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(8,14,28,.35)";
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }

    /* Trade lines from home to partners (play only). */
    if (!setupMode && G) {
      const homePolys = countries
        .filter((c) => roleForFeature(c.iso, hRole, hIso) === "home")
        .flatMap((c) => c.polys);
      if (homePolys.length) {
        const [hx, hy] = polysCentroid(homePolys);
        const [hsx, hsy] = toScreen(hx, hy);
        for (const p of activePartners(hRole)) {
          const pPolys = countries
            .filter((c) => roleForFeature(c.iso, hRole, hIso) === p.id)
            .flatMap((c) => c.polys);
          if (!pPolys.length) continue;
          const [px, py] = polysCentroid(pPolys);
          const [psx, psy] = toScreen(px, py);
          const rel = G.rel[p.id] ?? 50;
          ctx.beginPath();
          ctx.moveTo(hsx, hsy);
          ctx.quadraticCurveTo(
            (hsx + psx) / 2,
            (hsy + psy) / 2 - H * 0.03 * scale,
            psx,
            psy
          );
          ctx.strokeStyle =
            rel > 62
              ? "rgba(48,209,88,.22)"
              : rel > 45
                ? "rgba(100,210,255,.18)"
                : "rgba(255,69,58,.16)";
          ctx.lineWidth = selectedRole === p.id ? 2 : 1;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    /* Labels: one per realm still on the board. */
    ctx.font = "600 12px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const labelRoles = setupMode
      ? ["home", ...PARTNERS.map((p) => p.id).filter((id) => id !== "kingdom")]
      : ["home", ...activePartners(hRole).map((p) => p.id)];

    for (const role of labelRoles) {
      const realm = realmByRole(role);
      const anchorIso = realm.iso
        ? String(realm.iso).padStart(3, "0")
        : null;
      let polys;
      if (anchorIso) {
        const anchor = countries.find((c) => c.iso === anchorIso);
        polys = anchor ? anchor.polys : null;
      }
      if (!polys || !polys.length) {
        polys = countries
          .filter((c) => {
            if (setupMode) return realmRoleForIso(c.iso) === role;
            return roleForFeature(c.iso, hRole, hIso) === role;
          })
          .flatMap((c) => c.polys);
      }
      if (!polys.length) continue;
      const [nx, ny] = polysCentroid(polys);
      const [x, y] = toScreen(nx, ny);
      let text;
      if (role === "home") {
        const homeName = setupMode
          ? realmByRole("home").name
          : (G && G.country) || realmByRole(hRole).name;
        text = setupMode
          ? homeName
          : boardMetricMapLabel("home", mapMetric, homeName, G);
      } else {
        const p = PARTNERS.find((x) => x.id === role);
        const name = p ? p.name : role;
        text = setupMode
          ? name
          : boardMetricMapLabel(role, mapMetric, name, G);
      }
      const tw = ctx.measureText(text).width;
      const hot = isSelected(role) || hoverRole === role;
      ctx.fillStyle = `rgba(8,14,28,${hot ? 0.9 : 0.72})`;
      roundRect(ctx, x - tw / 2 - 8, y - 10, tw + 16, 20, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, y);
    }

    ctx.font = "500 11px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.textAlign = "left";
    ctx.fillText(
      setupMode
        ? "Click a country · pinch or scroll to zoom · drag to pan"
        : "Pinch or scroll to zoom · drag to pan",
      14,
      H - 14
    );
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
          .map((f) => {
            const iso = String(f.id).padStart(3, "0");
            if (SKIP_ISO.has(iso)) return null;
            const polys = geomToPolys(f.geometry);
            if (!polys.length) return null;
            return {
              iso,
              polys,
              role: realmRoleForIso(iso),
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
    const W = wrap.clientWidth || window.innerWidth;
    const H = wrap.clientHeight || window.innerHeight;
    const fit = Math.min(W, H * (360 / (LAT_MAX - LAT_MIN)));
    const plateW = fit;
    const plateH = fit * ((LAT_MAX - LAT_MIN) / 360);
    return {
      W,
      H,
      plateW,
      plateH,
      ox: (W - plateW) / 2,
      oy: (H - plateH) / 2,
    };
  }, []);

  /** Zoom toward a canvas-local point (or the plate centre). */
  const zoomAt = useCallback(
    (factor, canvasX, canvasY) => {
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
    [paint, plateLayout]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ready) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      /* Pixel-mode trackpads need a continuous scale; line-mode keeps clicks. */
      let factor;
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
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      const layout = plateLayout();
      if (!canvas || !layout) return null;
      const { scale, tx, ty } = viewRef.current;
      const { plateW, plateH, ox, oy } = layout;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        nx: (sx - ox - tx) / (plateW * scale),
        ny: (sy - oy - ty) / (plateH * scale),
      };
    },
    [plateLayout]
  );

  const pickAt = useCallback(
    (clientX, clientY) => {
      const pt = screenToNorm(clientX, clientY);
      const countries = countriesRef.current;
      if (!pt || !countries.length) return null;
      /* Prefer smaller countries (islands) when rings nest / overlap. */
      const ordered = [...countries].sort(
        (a, b) => a.polys.length - b.polys.length
      );
      for (const c of ordered) {
        if (pointInPolys(pt.nx, pt.ny, c.polys)) {
          const pickRole = realmRoleForIso(c.iso);
          const playRole = roleForFeature(
            c.iso,
            homeRole || getG()?.homeRole || "home",
            homeIso || getG()?.homeIso || HOME_ISO
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
    [screenToNorm, homeRole, homeIso]
  );

  const onPointerDown = (e) => {
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

  const onPointerMove = (e) => {
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
    const nextRole = hit
      ? setupMode
        ? hit.pickRole
        : hit.role
      : null;
    const nextIso = hit && setupMode ? hit.iso : null;
    if (
      nextRole !== hoverRoleRef.current ||
      nextIso !== hoverIsoRef.current
    ) {
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

  const endPointer = (e) => {
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

  const onPointerUp = (e) => {
    const drag = dragRef.current;
    const wasPinching = pinchRef.current != null || pointersRef.current.size > 1;
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
    dragRef.current =
      pointersRef.current.size === 1 ? dragRef.current : null;
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

  const onPointerLeave = (e) => {
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background:
          "radial-gradient(ellipse at 50% 45%,#0f1c33 0%,#080e1c 58%,#04060c 100%)",
      }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,.4)",
            fontSize: 13,
          }}
        >
          Charting the realms…
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "grab",
          touchAction: "none",
        }}
        aria-label={
          setupMode ? "Choose your country on the world map" : "World map"
        }
      />
    </div>
  );
}
