/** Playable realms: The Kingdom plus sovereign trade partners.
 *  Click any mapped country to play as that seat. */
import { COUNTRIES } from "./countries.js";

export const DEFAULT_REALM_ID = "home";
export const DEFAULT_HOME_ISO = "826";
export const DEFAULT_COUNTRY = "The Kingdom";

const SEAT_BLURBS = {
  home: "An island treasury. Thin growth, hot prices, debt at a generational high.",
  germany: "Industrial heartland. Export-heavy, rules-minded, allergic to fiscal chaos elsewhere.",
  france: "A crowded single market seat. Soft growth, heavy debt, institutions that run deep.",
  italy: "Design, food, and a debt stock that makes every budget conversation longer.",
  spain: "Tourism, agriculture, and a bridge to the southern Atlantic.",
  netherlands: "Ports, logistics, and a very direct view of whether customs policy works.",
  poland: "Manufacturing heartland of the east. Growing fast, watching the northern border.",
  united_states: "Deep capital markets and a wide deficit. The reserve currency still papers over a lot.",
  canada: "Commodity wealth and deep capital markets. A long border with the Federated States.",
  china: "Factory of the world. Fast enough to matter, leveraged enough to worry.",
  russia: "Commodity weight and a long near abroad. Thin public debt, expensive politics.",
  india: "Fast growth and deep labour markets. The demography still works in your favour.",
  brazil: "Commodity exporters and deep cities. Soft growth, warm prices, and a loud neighbourhood.",
  mexico: "Manufacturing bridge to the north. Trade policy follows whoever has the louder capital.",
  argentina: "Grain, beef, and a bond market that never quite settles. Soft growth, loud prices.",
  japan: "Precision industry, ageing demography, and capital that travels quietly.",
  korea: "Export machine and semiconductor power. Ageing at home, restless abroad.",
  australia: "Old ties across a long ocean. Language travels; capital and people less so.",
  indonesia: "Archipelago giant. Young demography, commodity cycles, and a manufacturing climb.",
  vietnam: "Factory floor of the China-plus-one shift. Fast growth, thin capital markets.",
  turkey: "Bridge between the continent and the warm seas. Soft lira, hard politics.",
  saudi: "Sovereign wealth on warm water. Near fiscal balance — until the oil cycle turns.",
  uae: "Hub economy. Logistics, finance, and a view of every trade lane that matters.",
  nigeria: "Young demography and commodity cycles. Inflation sticks; the frontier is still open.",
  south_africa: "Industrial base of the continent. Power cuts at home, platinum abroad.",
  egypt: "Demography, canals, and a fiscal squeeze that never quite ends.",
  kenya: "East African hub. Young workforce, thin fiscal space, and a view south of Suez.",
};

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
    blurb: SEAT_BLURBS.home,
  },
  ...COUNTRIES.filter((c) => c.id !== "kingdom").map((c) => ({
    id: c.id,
    role: c.id,
    name: c.name,
    iso: c.iso,
    tag: SEAT_TAGS[c.id] || c.region,
    blurb: SEAT_BLURBS[c.id] || c.blurb,
  })),
];

export function realmById(id) {
  return PLAYABLE_REALMS.find((r) => r.id === id) || PLAYABLE_REALMS[0];
}

export function realmByRole(role) {
  if (!role || role === "home") return PLAYABLE_REALMS[0];
  return PLAYABLE_REALMS.find((r) => r.role === role) || realmById(role) || PLAYABLE_REALMS[0];
}

export function realmByIso(iso) {
  const id = String(iso).padStart(3, "0");
  return PLAYABLE_REALMS.find((r) => r.iso === id) || null;
}

export function homeIsoForRealm(realm) {
  if (realm?.iso) return String(realm.iso).padStart(3, "0");
  if (realm?.role === "home") return DEFAULT_HOME_ISO;
  const c = COUNTRIES.find((x) => x.id === realm?.role);
  return c ? c.iso : DEFAULT_HOME_ISO;
}
