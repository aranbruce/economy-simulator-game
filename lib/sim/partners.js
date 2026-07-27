/** ISO numeric ids from Natural Earth / world-atlas countries-110m.
 *  One sovereign partner per country; unmapped coastlines are scenery only. */
import { DEFAULT_HOME_ISO } from "./realms.js";
import { COUNTRIES } from "./countries.js";

export const HOME_ISO = DEFAULT_HOME_ISO;

/** Country id → single ISO (anchor territory on the map). */
export const PARTNER_ISO = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, [c.iso]])
);

/** Resolve which board role owns an ISO. */
export function partnerForIso(iso, homeIso = HOME_ISO, homeRole = null) {
  const id = String(iso).padStart(3, "0");
  const home = String(homeIso || HOME_ISO).padStart(3, "0");
  const country = COUNTRIES.find((c) => c.iso === id);
  if (!country) return null;
  if (homeRole && homeRole !== "home" && country.id === homeRole) return "home";
  if (id === home) return "home";
  return country.id;
}

/** Which playable realm a click on this ISO should select (setup). */
export function realmRoleForIso(iso) {
  const id = String(iso).padStart(3, "0");
  if (id === HOME_ISO) return "home";
  const country = COUNTRIES.find((c) => c.iso === id);
  return country ? country.id : null;
}

import { metricRampCss } from "./metricRamp.js";

/** Relations 0–100 → green through yellow/orange to red. No blue. */
export function relationColour(rel) {
  const t = 1 - Math.max(0, Math.min(100, +rel || 0)) / 100;
  return metricRampCss(t);
}
