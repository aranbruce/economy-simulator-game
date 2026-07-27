/**
 * Board-wide map colouring for the packed world map (not regional choropleths).
 */
import {
  getG,
  PARTNERS,
  NATION_PROFILE,
  balanceOf,
  countryBlocId,
  playerCountryId,
} from "./engine.js";
import { relationColour } from "./partners.js";
import { blocById } from "./blocs.js";

export const BOARD_METRICS = [
  { id: "countries", name: "Countries" },
  { id: "blocs", name: "Trade blocs" },
  { id: "relations", name: "Relations" },
  { id: "growth", name: "Growth" },
  { id: "deficit", name: "Deficit" },
];

/** Fixed fills so each country reads apart — used by Countries view and setup. */
export const REALM_FILL = {
  home: "#9aa8b8",
  kingdom: "#9aa8b8",
  germany: "#5b7d9a",
  france: "#4a6d82",
  italy: "#6a7a8c",
  spain: "#8b7355",
  netherlands: "#5a8a9a",
  poland: "#6a8a7a",
  united_states: "#4a6d82",
  canada: "#5a7a6a",
  china: "#8b7355",
  russia: "#6a7a8c",
  india: "#9a6b4a",
  brazil: "#8a5a5a",
  mexico: "#7a6a5a",
  argentina: "#9a7a5a",
  japan: "#5a7a8a",
  korea: "#4a6a8a",
  australia: "#3d7a6a",
  indonesia: "#5a8a6a",
  vietnam: "#4a7a5a",
  turkey: "#8a6a5a",
  saudi: "#a08050",
  uae: "#b09060",
  nigeria: "#6b8a5a",
  south_africa: "#7a8a6a",
  egypt: "#9a8a5a",
  kenya: "#6a9a5a",
};
const HOME_MARK = "#D4AF69";
const NO_BLOC_FILL = "#3a4558";
const CUSTOM_BLOC_FILL = "#6a7a9a";

/** Distinct bloc hues — members of the same bloc share a fill. */
export const BLOC_FILL = {
  continental_union: "#4a7ab8",
  pacific_accord: "#3d8a7a",
  gulf_council: "#b09050",
  northern_compact: "#8a6a7a",
  andes_pact: "#9a6b4a",
  asean_circle: "#5a9a7a",
};

function roleCountryId(role, G) {
  return role === "home" ? playerCountryId(G.homeRole) : role;
}

export function roleBlocId(role, G = getG()) {
  if (!G) return null;
  return countryBlocId(roleCountryId(role, G), G.blocMember);
}

export function boardMetricBlocName(role, G = getG()) {
  const bid = roleBlocId(role, G);
  if (!bid) return "No trade bloc";
  const bloc = blocById(bid) || G.customBlocs?.[bid];
  return bloc ? bloc.name : bid;
}

function ensureNations(e) {
  if (e.nations) return e.nations;
  e.nations = {};
  for (const id in NATION_PROFILE) {
    const n = NATION_PROFILE[id];
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

function homeGrowth(G) {
  if (G.log && G.log.length) return G.log[G.log.length - 1].growth;
  return G.econ.trendGrowth || 0;
}

function homeDeficit(G) {
  if (G.log && G.log.length) return -G.log[G.log.length - 1].balance;
  return -balanceOf(G.law, G.econ).balance;
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function ramp(t) {
  t = clamp(t, 0, 1);
  const stops = [
    [10, 70, 120],
    [16, 120, 160],
    [48, 190, 150],
    [190, 205, 90],
    [255, 159, 10],
    [255, 69, 58],
  ];
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i],
    b = stops[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

function rgbCss(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

export function boardMetricValue(role, metric, G = getG()) {
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

export function boardMetricColour(role, metric, G = getG()) {
  if (!G) return "#1a2a44";
  if (metric === "countries") {
    if (role === "home") return HOME_MARK;
    return REALM_FILL[role] || "#6a7a94";
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
  if (v == null) return "#1a2a44";
  if (metric === "growth") {
    let t = (v - -1.5) / (5.5 - -1.5);
    t = 1 - t;
    return rgbCss(ramp(t));
  }
  if (metric === "deficit") {
    let t = (v - -2) / (10 - -2);
    return rgbCss(ramp(t));
  }
  return "#1a2a44";
}

export function boardMetricCaption(metric, G = getG()) {
  const m = BOARD_METRICS.find((x) => x.id === metric);
  if (!m || !G) return "";
  if (metric === "countries") return "Each country in its own colour";
  if (metric === "blocs") return "Coloured by trade bloc membership";
  if (metric === "relations") return "Coloured by how they stand with you";
  if (metric === "growth") return "Annualised growth across the board";
  if (metric === "deficit") return "Borrowing as a share of GDP";
  return m.name;
}
