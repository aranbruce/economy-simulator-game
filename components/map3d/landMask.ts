/**
 * A coarse "is this point on land?" lookup, rasterised once from the same
 * country polygons the terrain is extruded from.
 *
 * The fleet needs this because a trade route is a Bézier between two
 * capitals, and plenty of them cut across continents. On the flat map that
 * put container ships on Kazakhstan; here the land has real thickness, so a
 * hull is buried but the masts still stand proud of the terrain, which
 * reads as a fleet parked in the Alps. Testing every boat against ~180
 * polygons every frame is far too slow, so the polygons are filled into an
 * offscreen 2D canvas once and read back as a bitmap: build cost is a few
 * milliseconds, lookup is one array index.
 *
 * Nothing here is game logic — it is geometry the renderer asks about.
 */

import { BOARD_H, BOARD_W } from "../../lib/map/projection.ts";
import type { Polys } from "../../lib/map/geo.ts";

/** Mask width in pixels. 360° across this many pixels is about a third of a
 *  degree per texel — far finer than a ship is long, and the whole bitmap
 *  is well under half a megabyte. */
const MASK_W = 1024;

export interface LandMask {
  /** True if the normalised board point is on land. `nx` wraps; an `ny`
   *  outside the board is open water (the plate is cropped north/south). */
  at: (nx: number, ny: number) => boolean;
}

/** Ocean everywhere — the fallback when no 2D canvas is available, so a
 *  missing mask shows every ship rather than hiding the whole fleet. */
export const OPEN_SEA: LandMask = { at: () => false };

export function buildLandMask(countries: { polys: Polys }[]): LandMask {
  if (typeof document === "undefined") return OPEN_SEA;
  const h = Math.max(1, Math.round((MASK_W * BOARD_H) / BOARD_W));
  const canvas = document.createElement("canvas");
  canvas.width = MASK_W;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return OPEN_SEA;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const { polys } of countries) {
    for (const rings of polys) {
      for (const ring of rings) {
        ring.forEach(([nx, ny], i) => {
          const x = nx * MASK_W;
          const y = ny * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
  }
  /* One path for every country at once, filled even-odd so each country's
     holes (the Caspian, lakes) stay water. Countries never overlap, so
     merging them into a single path can't cancel one against another. */
  ctx.fill("evenodd");

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, MASK_W, h).data;
  } catch (err) {
    /* getImageData can throw on a tainted canvas. Nothing here draws an
       image, so this shouldn't happen — but the fleet is not worth failing
       the map over. */
    console.warn("landMask: could not read back the mask", err);
    return OPEN_SEA;
  }

  const bits = new Uint8Array(MASK_W * h);
  for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4 + 3] > 127 ? 1 : 0;

  return {
    at: (nx, ny) => {
      if (!(ny >= 0 && ny < 1)) return false;
      const wrapped = ((nx % 1) + 1) % 1;
      const x = Math.min(MASK_W - 1, (wrapped * MASK_W) | 0);
      const y = Math.min(h - 1, (ny * h) | 0);
      return bits[y * MASK_W + x] === 1;
    },
  };
}
