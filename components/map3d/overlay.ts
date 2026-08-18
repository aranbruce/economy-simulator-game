/**
 * The screen-space half of the map: realm labels, diplomatic-activity
 * badges and their legend, as DOM nodes pinned to world anchors.
 *
 * These are chrome, not terrain — they have to stay a constant size and
 * stay horizontal however the camera is pitched, which is exactly what
 * three.js's own CSS2D layer exists for. This is that idea, hand-rolled
 * small: the WebGL scene owns everything with a physical position on the
 * board, and this owns everything that reads as writing on top of it. Text
 * stays real text that way — legible at any DPI, and not a texture that has
 * to be re-rasterised every time a metric label changes.
 *
 * Positions update from the render loop via update(); nothing here reads
 * game state.
 */

import { Vector3 } from "three";
import { BOARD_W } from "../../lib/map/projection.ts";
import type { MapCamera } from "./camera.ts";

export interface LabelSpec {
  key: string;
  text: string;
  /** Lit — the player's own realm, the hovered one, or the selected one. */
  hot: boolean;
  /** Higher wins a collision. The home realm keeps its label even when
   *  cold, so this is separate from `hot`. */
  priority: number;
  anchor: Vector3;
}

export interface BadgeSpec {
  key: string;
  kinds: string[];
  anchor: Vector3;
}

/** Screen-pixel gap between a badge row and the realm centroid below it. */
const BADGE_OFFSET_Y = 30;
const BADGE_SIZE = 18;
const BADGE_GAP = 6;
const LEGEND_BADGE_SIZE = 13;
const LABEL_PAD = 3;

/** Small vector glyph per marker kind, in a 24-unit box. */
const GLYPHS: Record<string, string> = {
  envoy:
    '<rect x="5" y="10" width="14" height="9" rx="1.5"/><path d="M9.5 10V8.6a2.5 2.5 0 0 1 5 0V10"/>',
  summit: '<circle cx="9.6" cy="12" r="4"/><circle cx="14.4" cy="12" r="4"/>',
  summit_staged:
    '<rect x="5" y="6.5" width="14" height="12" rx="1.5"/><path d="M5 10.5h14"/>',
  ultimatum:
    '<path d="M12 5.4 20 18.6H4Z"/><path d="M12 10.4v3.6"/><circle cx="12" cy="16.6" r="1.05" fill="#f2e6c8" stroke="none"/>',
};

export const DIPLO_MARKER_ORDER = [
  "envoy",
  "summit",
  "summit_staged",
  "ultimatum",
];

const DIPLO_LEGEND_LABELS: Record<string, string> = {
  envoy: "Envoy",
  summit: "Summit",
  summit_staged: "Queued",
  ultimatum: "Ultimatum",
};

const BADGE_CLASS =
  "grid place-items-center rounded-full border border-[#d4af69] bg-[#17110a] shadow-[0_1px_4px_rgba(0,0,0,.55)]";

function badgeEl(kind: string, size: number): HTMLElement {
  const el = document.createElement("div");
  el.className = BADGE_CLASS;
  el.style.width = size + "px";
  el.style.height = size + "px";
  if (kind === "summit_staged") el.style.opacity = "0.82";
  const glyphPx = Math.round(size * 0.78);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="' +
    glyphPx +
    '" height="' +
    glyphPx +
    '" fill="none" stroke="#f2e6c8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    (GLYPHS[kind] || "") +
    "</svg>";
  return el;
}

const LABEL_FONT_HOT =
  '700 12px "Plus Jakarta Sans", -apple-system, system-ui, sans-serif';
const LABEL_FONT =
  '600 11px "Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

/** Text width measured in the same font the label renders in, so the
 *  collision boxes below match what the browser actually paints. Cached:
 *  this runs across every realm on every frame. */
const widthCache = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  const key = font + " " + text;
  const hit = widthCache.get(key);
  if (hit != null) return hit;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.length * 7;
  measureCtx.font = font;
  const w = measureCtx.measureText(text).width;
  widthCache.set(key, w);
  return w;
}

interface LabelNode {
  el: HTMLElement;
  spec: LabelSpec;
}

interface BadgeNode {
  el: HTMLElement;
  spec: BadgeSpec;
  width: number;
}

export interface MapOverlay {
  setLabels: (specs: LabelSpec[]) => void;
  setBadges: (specs: BadgeSpec[]) => void;
  update: (cam: MapCamera, W: number, H: number) => void;
  dispose: () => void;
}

/** Pick the wrap-tile copy of an anchor sitting nearest the middle of the
 *  frame. The board repeats east/west, so a label can be on screen twice;
 *  drawing the nearer copy once beats drawing both and letting them fight. */
function bestScreenPos(
  cam: MapCamera,
  anchor: Vector3,
  W: number,
  H: number,
  scratch: Vector3,
  out: Vector3,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const dx of [-BOARD_W, 0, BOARD_W]) {
    scratch.set(anchor.x + dx, anchor.y, anchor.z);
    const p = cam.toScreen(scratch, W, H, out);
    if (!p.visible) continue;
    const d = Math.abs(p.x - W / 2);
    if (d < bestD) {
      bestD = d;
      best = { x: p.x, y: p.y };
    }
  }
  return best;
}

export function createOverlay(container: HTMLElement): MapOverlay {
  /* overflow-hidden, not decoration: a node whose anchor is off the side of
     the board is still positioned, just far outside the frame, and without
     this it would extend the page box and raise scrollbars. */
  const labelHost = document.createElement("div");
  labelHost.className = "pointer-events-none absolute inset-0 overflow-hidden";
  const badgeHost = document.createElement("div");
  badgeHost.className = "pointer-events-none absolute inset-0 overflow-hidden";
  const legendHost = document.createElement("div");
  legendHost.className =
    "pointer-events-none absolute bottom-6 left-3.5 flex items-center gap-3 text-[11px] font-medium text-[rgba(246,240,226,.6)]";
  container.append(labelHost, badgeHost, legendHost);

  let labels: LabelNode[] = [];
  let labelKey = "";
  let badges: BadgeNode[] = [];
  let badgeKey = "";
  let legendKey = "";
  const scratch = new Vector3();
  const out = new Vector3();

  const setLabels = (specs: LabelSpec[]) => {
    /* Rebuilt only when something a node actually renders changes — this
       is called on every hover, and the anchors themselves are static. The
       sort happens here rather than at the call site because the priority
       order is what update()'s greedy collision pass consumes. */
    const key = specs
      .map(
        (s) =>
          `${s.key}\u0001${s.text}\u0001${s.hot ? 1 : 0}\u0001${s.priority}`,
      )
      .join("|");
    if (key === labelKey) return;
    labelKey = key;
    labelHost.replaceChildren();
    labels = [...specs]
      .sort((a, b) => b.priority - a.priority)
      .map((spec) => {
        const el = document.createElement("div");
        el.className =
          "absolute left-0 top-0 whitespace-nowrap uppercase [text-shadow:0_1px_4px_rgba(15,11,6,.9)] will-change-transform";
        el.style.font = spec.hot ? LABEL_FONT_HOT : LABEL_FONT;
        el.style.color = spec.hot ? "#f2d9a0" : "rgba(246,240,226,.88)";
        el.textContent = spec.text;
        labelHost.append(el);
        return { el, spec };
      });
  };

  const setBadges = (specs: BadgeSpec[]) => {
    const key = specs
      .map((s) => `${s.key}\u0001${s.kinds.join(",")}`)
      .join("|");
    if (key === badgeKey) return;
    badgeKey = key;

    badgeHost.replaceChildren();
    badges = specs.map((spec) => {
      const el = document.createElement("div");
      el.className =
        "absolute left-0 top-0 flex items-center will-change-transform";
      el.style.gap = BADGE_GAP + "px";
      for (const kind of spec.kinds) el.append(badgeEl(kind, BADGE_SIZE));
      badgeHost.append(el);
      return {
        el,
        spec,
        width:
          spec.kinds.length * BADGE_SIZE +
          BADGE_GAP * Math.max(0, spec.kinds.length - 1),
      };
    });

    const kinds = DIPLO_MARKER_ORDER.filter((k) =>
      specs.some((s) => s.kinds.includes(k)),
    );
    const legend = kinds.join("|");
    if (legend === legendKey) return;
    legendKey = legend;
    legendHost.replaceChildren();
    for (const kind of kinds) {
      const row = document.createElement("div");
      row.className = "flex items-center gap-1.5";
      row.append(badgeEl(kind, LEGEND_BADGE_SIZE));
      const text = document.createElement("span");
      text.textContent = DIPLO_LEGEND_LABELS[kind] || kind;
      row.append(text);
      legendHost.append(row);
    }
  };

  const update = (cam: MapCamera, W: number, H: number) => {
    for (const node of badges) {
      const pos = bestScreenPos(cam, node.spec.anchor, W, H, scratch, out);
      if (!pos) {
        node.el.style.visibility = "hidden";
        continue;
      }
      node.el.style.visibility = "visible";
      node.el.style.transform =
        "translate3d(" +
        Math.round(pos.x - node.width / 2) +
        "px," +
        Math.round(pos.y - BADGE_OFFSET_Y) +
        "px,0)";
    }

    /* Greedy placement in priority order: a crowded cluster (real-world
       geography packs some realms tightly) drops the lower-priority label
       rather than stacking two illegibly. */
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const node of labels) {
      const pos = bestScreenPos(cam, node.spec.anchor, W, H, scratch, out);
      if (!pos) {
        node.el.style.visibility = "hidden";
        continue;
      }
      const font = node.spec.hot ? LABEL_FONT_HOT : LABEL_FONT;
      const w = textWidth(node.spec.text, font);
      const h = node.spec.hot ? 15 : 14;
      const box = {
        x0: pos.x - w / 2 - LABEL_PAD,
        y0: pos.y - h / 2 - LABEL_PAD,
        x1: pos.x + w / 2 + LABEL_PAD,
        y1: pos.y + h / 2 + LABEL_PAD,
      };
      const collides = placed.some(
        (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
      );
      if (collides) {
        node.el.style.visibility = "hidden";
        continue;
      }
      placed.push(box);
      node.el.style.visibility = "visible";
      node.el.style.transform =
        "translate3d(" +
        Math.round(pos.x - w / 2) +
        "px," +
        Math.round(pos.y - h / 2) +
        "px,0)";
    }
  };

  const dispose = () => {
    labelHost.remove();
    badgeHost.remove();
    legendHost.remove();
    labels = [];
    badges = [];
  };

  return { setLabels, setBadges, update, dispose };
}
