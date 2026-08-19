/**
 * The screen-space half of the map: a legend for diplomatic activity.
 * The markers themselves sit on the land as 3D props (see diploProps.ts).
 *
 * Country names live on the land (see realmLabels.ts) so they read as ink
 * on the slab. The legend stays chrome — constant size, always upright.
 *
 * Positions update from the render loop via update(); nothing here reads
 * game state.
 */

import { Vector3 } from "three";
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

/** Screen-pixel size of the legend chips. Matches the 3D tokens. */
const LEGEND_BADGE_SIZE = 13;

/** Small vector glyph per marker kind, in a 24-unit box. */
const GLYPHS: Record<string, string> = {
  envoy: '<circle cx="12" cy="7" r="3.2"/><path d="M6.5 20v-2.2a5.5 5.5 0 0 1 11 0V20"/>',
  summit: '<path d="M4 19 12 6l8 13"/><path d="M7 19h10"/>',
  protest:
    '<path d="M12 4v10"/><circle cx="12" cy="18.5" r="1.4" fill="#f2e6c8" stroke="none"/>',
  sanctions:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4" fill="#f2e6c8" stroke="none"/>',
  ultimatum:
    '<path d="M7 19.5 17 4.5"/><path d="M17 19.5 7 4.5"/><path d="M8.1 16.3 10.7 17.6"/><path d="M15.9 16.3 13.3 17.6"/>',
};

export const DIPLO_MARKER_ORDER = [
  "envoy",
  "summit",
  "protest",
  "sanctions",
  "ultimatum",
];

const DIPLO_LEGEND_LABELS: Record<string, string> = {
  envoy: "Envoy",
  summit: "Summit",
  protest: "Protest",
  sanctions: "Sanctions",
  ultimatum: "Ultimatum",
};

export function diploLegendKind(kind: string): string {
  return kind.endsWith("_staged") ? kind.slice(0, -7) : kind;
}

const BADGE_CLASS =
  "grid place-items-center rounded-full border border-[#d4af69] bg-[#17110a] shadow-[0_1px_4px_rgba(0,0,0,.55)]";

function badgeEl(kind: string, size: number): HTMLElement {
  const el = document.createElement("div");
  el.className = BADGE_CLASS;
  el.style.width = size + "px";
  el.style.height = size + "px";
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

export interface MapOverlay {
  setBadges: (specs: BadgeSpec[]) => void;
  update: (cam: MapCamera, W: number, H: number) => void;
  dispose: () => void;
}

export function createOverlay(container: HTMLElement): MapOverlay {
  const legendHost = document.createElement("div");
  legendHost.className =
    "pointer-events-none absolute bottom-6 left-3.5 flex items-center gap-3 text-[11px] font-medium text-[rgba(246,240,226,.6)]";
  container.append(legendHost);

  let legendKey = "";

  const setBadges = (specs: BadgeSpec[]) => {
    const kinds = DIPLO_MARKER_ORDER.filter((k) =>
      specs.some((s) => s.kinds.some((kind) => diploLegendKind(kind) === k)),
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

  const update = (_cam: MapCamera, _W: number, _H: number) => {};

  const dispose = () => {
    legendHost.remove();
  };

  return { setBadges, update, dispose };
}
