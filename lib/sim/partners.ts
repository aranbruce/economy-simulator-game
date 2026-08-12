/** ISO numeric ids from Natural Earth / world-atlas countries-110m.
 *  One sovereign partner per country; unmapped coastlines are scenery only. */
import { DEFAULT_HOME_ISO } from "./realms.ts";
import { COUNTRIES } from "./countries.ts";
import { metricRampCss } from "./metricRamp.ts";

export const HOME_ISO = DEFAULT_HOME_ISO;

/** Resolve which board role owns an ISO. */
export function partnerForIso(
  iso: string | number,
  homeIso: string = HOME_ISO,
  homeRole: string | null = null,
) {
  const id = String(iso).padStart(3, "0");
  const home = String(homeIso || HOME_ISO).padStart(3, "0");
  const country = COUNTRIES.find((c: any) => c.iso === id);
  if (!country) return null;
  if (homeRole && homeRole !== "home" && country.id === homeRole) return "home";
  if (id === home) return "home";
  return country.id;
}

/** Which playable realm a click on this ISO should select (setup). */
export function realmRoleForIso(iso: string | number) {
  const id = String(iso).padStart(3, "0");
  if (id === HOME_ISO) return "home";
  const country = COUNTRIES.find((c: any) => c.iso === id);
  return country ? country.id : null;
}

/** Relations 0–100 → green through yellow/orange to red. No blue.
 *  A straight linear map spends most of its range in the ramp's own
 *  yellow/amber middle third, so anything short of a genuine extreme reads
 *  as the same washed-out yellow. Push values away from the neutral
 *  midpoint (sqrt of the normalised distance) before feeding the ramp, so
 *  even a mild lean reads as a real colour and only genuinely neutral
 *  relations (rel ≈ 50) stay yellow. */
export function relationColour(rel: number) {
  const r = Math.max(0, Math.min(100, +rel || 0));
  const centered = (r - 50) / 50; // -1 (worst) .. 1 (best)
  const amplified = Math.sign(centered) * Math.sqrt(Math.abs(centered));
  const t = 1 - (50 + amplified * 50) / 100;
  return metricRampCss(t);
}
