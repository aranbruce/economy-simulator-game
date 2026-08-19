/** Playable realms: United Kingdom plus sovereign trade partners.
 *  Click any mapped country to play as that seat. Blurbs live on COUNTRIES. */
import { COUNTRIES } from "./countries.ts";

export const DEFAULT_REALM_ID = "home";
export const DEFAULT_HOME_ISO = "826";

const HOME_BLURB =
  "An island treasury. Thin growth, hot prices, debt at a generational high.";

export const PLAYABLE_REALMS = [
  {
    id: "home",
    role: "home",
    name: "United Kingdom",
    iso: "826",
    blurb: HOME_BLURB,
  },
  ...COUNTRIES.filter((c) => c.id !== "kingdom").map((c) => ({
    id: c.id,
    role: c.id,
    name: c.name,
    iso: c.iso,
    blurb: c.blurb,
  })),
];

export function realmById(id: string) {
  return PLAYABLE_REALMS.find((r) => r.id === id) || PLAYABLE_REALMS[0];
}

/** Opening picker choice: any mapped seat, equally likely. */
export function randomPlayableRealm() {
  return PLAYABLE_REALMS[(Math.random() * PLAYABLE_REALMS.length) | 0];
}

export function realmByRole(role?: string | null) {
  if (!role || role === "home") return PLAYABLE_REALMS[0];
  return (
    PLAYABLE_REALMS.find((r) => r.role === role) ||
    realmById(role) ||
    PLAYABLE_REALMS[0]
  );
}

export function homeIsoForRealm(
  realm?: { iso?: string; role?: string } | null,
) {
  if (realm?.iso) return String(realm.iso).padStart(3, "0");
  if (realm?.role === "home") return DEFAULT_HOME_ISO;
  const c = COUNTRIES.find((x) => x.id === realm?.role);
  return c ? c.iso : DEFAULT_HOME_ISO;
}
