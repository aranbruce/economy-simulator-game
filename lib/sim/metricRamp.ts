/**
 * Shared choropleth / board-metric ramp: green → yellow → orange → red.
 * t = 0 is good (green); t = 1 is bad (red). Callers invert when "high is good".
 * No blue — these modes should never read as a cool→warm spectrum.
 */

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

/** RGB stops — iOS system green / amber / red with yellow between. */
const STOPS: [number, number, number][] = [
  [48, 209, 88], // #30D158 green
  [180, 214, 50], // yellow-green
  [255, 214, 10], // yellow
  [255, 159, 10], // #FF9F0A amber / orange
  [255, 99, 46], // deep orange
  [255, 69, 58], // #FF453A red
];

function metricRamp(t: number): [number, number, number] {
  t = clamp(t, 0, 1);
  const x = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

export function metricRampCss(t: number) {
  const c = metricRamp(t);
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

/** Neutral fill when a scalar metric has no value — not blue. */
export const METRIC_MISSING = "#c9bd9c";
