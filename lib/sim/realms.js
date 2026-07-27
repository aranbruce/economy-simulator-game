/** Playable realms: The Kingdom plus sovereign trade partners.
 *  Click any mapped country to play as that seat. Blurbs live on COUNTRIES. */
import { COUNTRIES } from "./countries.js";

export const DEFAULT_REALM_ID = "home";
export const DEFAULT_HOME_ISO = "826";

const HOME_BLURB = "An island treasury. Thin growth, hot prices, debt at a generational high.";

const SEAT_TAGS = {
  home: "North Atlantic",
  germany: "Central Europe",
  france: "Western Europe",
  italy: "Southern Europe",
  spain: "Iberia",
  netherlands: "Low Countries",
  poland: "Eastern Europe",
  united_states: "Western republics",
  canada: "Northern Americas",
  china: "Eastern giant",
  russia: "Northern mass",
  india: "Southern giant",
  brazil: "Atlantic south",
  mexico: "North America",
  argentina: "Southern Cone",
  japan: "Pacific rim",
  korea: "Peninsula",
  australia: "Oceania",
  indonesia: "Archipelago",
  vietnam: "Indochina",
  turkey: "Anatolia",
  saudi: "Warm water",
  uae: "Gulf hub",
  nigeria: "West Africa",
  south_africa: "Southern Africa",
  egypt: "Nile",
  kenya: "East Africa",
};

export const PLAYABLE_REALMS = [
  {
    id: "home",
    role: "home",
    name: "The Kingdom",
    iso: "826",
    tag: SEAT_TAGS.home,
    blurb: HOME_BLURB,
  },
  ...COUNTRIES.filter((c) => c.id !== "kingdom").map((c) => ({
    id: c.id,
    role: c.id,
    name: c.name,
    iso: c.iso,
    tag: SEAT_TAGS[c.id] || c.region,
    blurb: c.blurb,
  })),
];

export function realmById(id) {
  return PLAYABLE_REALMS.find((r) => r.id === id) || PLAYABLE_REALMS[0];
}

export function realmByRole(role) {
  if (!role || role === "home") return PLAYABLE_REALMS[0];
  return PLAYABLE_REALMS.find((r) => r.role === role) || realmById(role) || PLAYABLE_REALMS[0];
}

export function homeIsoForRealm(realm) {
  if (realm?.iso) return String(realm.iso).padStart(3, "0");
  if (realm?.role === "home") return DEFAULT_HOME_ISO;
  const c = COUNTRIES.find((x) => x.id === realm?.role);
  return c ? c.iso : DEFAULT_HOME_ISO;
}
