/**
 * Board-wide map colouring for the packed world map (not regional choropleths).
 */
import {
  getG,
  NATION_PROFILE,
  balanceOf,
  countryBlocId,
  playerCountryId,
} from "./engine.ts";
import { relationColour } from "./partners.ts";
import { metricRampCss, METRIC_MISSING } from "./metricRamp.ts";
import { blocById } from "./blocs.ts";
import type { GameState } from "./types.ts";

const PROFILES: Record<string, any> = NATION_PROFILE;

export const BOARD_METRICS = [
  { id: "countries", name: "Countries" },
  { id: "blocs", name: "Trade blocs" },
  { id: "relations", name: "Relations" },
  { id: "growth", name: "Growth" },
  { id: "deficit", name: "Deficit" },
];

/** Fixed fills so each country reads apart — used by Countries view and setup.
 *  A warm ochre/terracotta/olive family (aged-atlas palette), not the cool
 *  blue-grey set this used to be — no blues or purples in the roster. */
export const REALM_FILL: Record<string, string> = {
  home: "#dcc390",
  kingdom: "#dcc390",
  germany: "#cca786",
  france: "#bfb287",
  italy: "#d2aa87",
  spain: "#bda782",
  netherlands: "#b0b28f",
  poland: "#c6b88a",
  united_states: "#c9b38f",
  canada: "#b5b78f",
  china: "#d0b28a",
  russia: "#bdaa92",
  india: "#d8af7f",
  brazil: "#c59f85",
  mexico: "#bda787",
  argentina: "#ccae8a",
  japan: "#d0a78f",
  korea: "#c5af87",
  australia: "#b5ba92",
  indonesia: "#bdbf8f",
  vietnam: "#adb78d",
  turkey: "#cbaa87",
  saudi: "#d8ba8a",
  uae: "#e0c292",
  nigeria: "#bdc292",
  south_africa: "#c5c29a",
  egypt: "#d0bf8f",
  kenya: "#b5bf8a",
};
const HOME_MARK = "#D4AF69";
const NO_BLOC_FILL = "#9c8e76";
const CUSTOM_BLOC_FILL = "#bcae8f";

/** Distinct bloc hues — members of the same bloc share a fill. */
const BLOC_FILL: Record<string, string> = {
  continental_union: "#ccaa82",
  pacific_accord: "#a5b78f",
  gulf_council: "#d8ba8a",
  andes_pact: "#c5a787",
  asean_circle: "#adb78f",
};

function roleCountryId(role: string, G: GameState) {
  return role === "home" ? playerCountryId(G.homeRole) : role;
}

function roleBlocId(role: string, G: GameState = getG()) {
  if (!G) return null;
  return countryBlocId(roleCountryId(role, G), G.blocMember);
}

export function boardMetricBlocName(role: string, G: GameState = getG()) {
  const bid = roleBlocId(role, G);
  if (!bid) return "No trade bloc";
  const bloc = blocById(bid) || G.customBlocs?.[bid];
  return bloc ? bloc.name : bid;
}

function ensureNations(e: any) {
  if (e.nations) return e.nations;
  e.nations = {};
  for (const id in PROFILES) {
    const n = PROFILES[id];
    e.nations[id] = {
      y: 100,
      growth: n.trend,
      debt: n.debt0,
      deficit: n.deficit0,
      inflation: 2.2,
    };
  }
  return e.nations;
}

function homeGrowth(G: GameState) {
  if (G.log && G.log.length) return G.log[G.log.length - 1].growth;
  return G.econ.trendGrowth || 0;
}

function homeDeficit(G: GameState) {
  if (G.log && G.log.length) return -G.log[G.log.length - 1].balance;
  return -balanceOf(G.law, G.econ).balance;
}

function boardMetricValue(
  role: string,
  metric: string,
  G: GameState = getG(),
) {
  if (!G) return null;
  if (metric === "countries" || metric === "blocs") return null;
  if (role === "home") {
    if (metric === "relations") return 100;
    if (metric === "growth") return homeGrowth(G);
    if (metric === "deficit") return homeDeficit(G);
    return null;
  }
  const nations = ensureNations(G.econ);
  const n = nations[role];
  if (!n) return null;
  if (metric === "relations") return G.rel[role] ?? 50;
  if (metric === "growth") return n.growth;
  if (metric === "deficit") return n.deficit;
  return null;
}

/** Formatted figure for the active map mode, or null when the mode has none. */
export function boardMetricValueLabel(
  role: string,
  metric: string,
  G: GameState = getG(),
) {
  if (metric === "blocs") return boardMetricBlocName(role, G);
  const v = boardMetricValue(role, metric, G);
  if (v == null || !Number.isFinite(+v)) return null;
  if (metric === "relations") return Math.round(v).toString();
  if (metric === "growth") return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  if (metric === "deficit") return v.toFixed(1) + "%";
  return null;
}

/** Map pin text: country name, plus the mode's figure when it has one. */
export function boardMetricMapLabel(
  role: string,
  metric: string | null,
  displayName?: string | null,
  G: GameState = getG(),
) {
  const name = displayName || role;
  if (!metric || metric === "countries") return name;
  const fig = boardMetricValueLabel(role, metric, G);
  if (fig == null || fig === "") return name;
  return name + " · " + fig;
}

export function boardMetricColour(
  role: string,
  metric: string,
  G: GameState = getG(),
) {
  if (!G) return METRIC_MISSING;
  if (metric === "countries") {
    if (role === "home") return HOME_MARK;
    return REALM_FILL[role] || "#c2b896";
  }
  if (metric === "blocs") {
    if (role === "home" && !roleBlocId(role, G)) return HOME_MARK;
    const bid = roleBlocId(role, G);
    if (!bid) return NO_BLOC_FILL;
    if (BLOC_FILL[bid]) return BLOC_FILL[bid];
    return CUSTOM_BLOC_FILL;
  }
  if (metric === "relations") {
    if (role === "home") return HOME_MARK;
    return relationColour(G.rel[role] ?? 50);
  }
  const v = boardMetricValue(role, metric, G);
  if (v == null) return METRIC_MISSING;
  if (metric === "growth") {
    /* High growth → green; contraction → red. No blue in the scale. */
    let t = (v - -1.5) / (5.5 - -1.5);
    t = 1 - t;
    return metricRampCss(t);
  }
  if (metric === "deficit") {
    /* Surplus → green; fat deficit → red. */
    const t = (v - -2) / (10 - -2);
    return metricRampCss(t);
  }
  return METRIC_MISSING;
}

