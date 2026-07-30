/** ISO numeric ids from Natural Earth / world-atlas countries-110m.
 *  One sovereign partner per country; unmapped coastlines are scenery only. */
import { DEFAULT_HOME_ISO } from "./realms.ts";
import { COUNTRIES } from "./countries.ts";
import { metricRampCss } from "./metricRamp.ts";

export const HOME_ISO = DEFAULT_HOME_ISO;

/** Country id → single ISO (anchor territory on the map). */
export const PARTNER_ISO: Record<string, string[]> = Object.fromEntries(
  COUNTRIES.map((c: any) => [c.id, [c.iso]])
);

/** Resolve which board role owns an ISO. */
export function partnerForIso(
  iso: string | number,
  homeIso: string = HOME_ISO,
  homeRole: string | null = null
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

/** Relations 0–100 → green through yellow/orange to red. No blue. */
export function relationColour(rel: number) {
  const t = 1 - Math.max(0, Math.min(100, +rel || 0)) / 100;
  return metricRampCss(t);
}
