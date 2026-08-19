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
 *  Rose / rust / gold family (#D4896E, #C46B2E, #F2C14A and kin), kept
 *  saturated enough to lift off the scenery tan. */
export const REALM_FILL: Record<string, string> = {
  home: "#D4896E",
  kingdom: "#D4896E",
  germany: "#C46B2E",
  france: "#F2C14A",
  italy: "#E07040",
  spain: "#E8A85C",
  netherlands: "#D89848",
  poland: "#F0D46A",
  united_states: "#B85A2C",
  canada: "#E09050",
  china: "#E8B040",
  russia: "#A84A28",
  india: "#F5C84E",
  brazil: "#E08840",
  mexico: "#D4A058",
  argentina: "#B04830",
  japan: "#D4A048",
  korea: "#D06038",
  australia: "#F0B838",
  indonesia: "#C87848",
  vietnam: "#D48838",
  turkey: "#B05030",
  saudi: "#F5D070",
  uae: "#D08040",
  nigeria: "#D07038",
  south_africa: "#E8C070",
  egypt: "#C07040",
  kenya: "#E09858",
};
const HOME_MARK = "#D4AF69";
const NO_BLOC_FILL = "#4a3a28";
const CUSTOM_BLOC_FILL = "#8a7a5a";

/** Distinct bloc hues — members of the same bloc share a fill. */
const BLOC_FILL: Record<string, string> = {
  continental_union: "#a8703f",
  pacific_accord: "#5a8a5a",
  gulf_council: "#c09050",
  andes_pact: "#9a6b4a",
  asean_circle: "#6a8a5a",
};

export function roleCountryId(role: string, G: GameState) {
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
    /* A country has no relation score with itself — null suppresses the
       figure everywhere boardMetricValueLabel() feeds (the map label, the
       MapChrome caption), rather than showing a meaningless "100". The
       map fill still resolves to HOME_MARK regardless, in
       boardMetricColour(). */
    if (metric === "relations") return null;
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
    return REALM_FILL[role] || "#D4896E";
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

