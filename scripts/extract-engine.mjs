import fs from "fs";

let full = fs.readFileSync("scripts/_raw_script.js", "utf8");
full = full.replace(/^"use strict";\n?/, "");

full = full.replace(
  /^let G, tab = null;.*$/m,
  "export let G = null;\nexport let tab = null;"
);

full = full.replace(/^const T = .*$/m, () => {
  return 'export const T = str => String(str).replace(/\\{C\\}/g, (G && G.country) || "the Republic");';
});

full = full.replace(
  /^const \$ = id => document\.getElementById\(id\);$/m,
  `const _els = Object.create(null);
export function registerEl(id, el){ if(el) _els[id] = el; else delete _els[id]; }
const $ = id => _els[id] || (typeof document !== "undefined" ? document.getElementById(id) : null);`
);

full = full.replace(
  /function render\(\)\{\s*renderChrome\(\);\s*renderPanel\(\);\s*updateMap\(\);/,
  `function render(){
  if(typeof bump === "function") bump();
  try{ renderChrome(); }catch(e){}
  try{ renderPanel(); }catch(e){}
  try{ updateMap(); }catch(e){}`
);

const cutMarkers = [
  '$("projectBtn").onclick',
  'const stage = $("mapStage")',
];
let cut = -1;
for (const m of cutMarkers) {
  const i = full.indexOf(m);
  if (i >= 0 && (cut < 0 || i < cut)) cut = i;
}
if (cut > 0) full = full.slice(0, cut).replace(/\s+$/, "\n");
console.log("Cutting at", cut, "near:", full.slice(Math.max(0, cut - 40), cut));

full += `
/* Module bridge for React */
let _onState = null;
export function setOnState(fn){ _onState = fn; }
export function bump(){ if(_onState) _onState(); }

export function setTab(t){ tab = t; render(); }
export function getTab(){ return tab; }
export function getG(){ return G; }
export function setMapMetric(id){ mapMetric = id; updateMap(); updateMapLabel(); }
export function getMapMetric(){ return mapMetric; }
export function setMapHover(i){ mapHover = i; }

export {
  FACTIONS, DEPTS, OTHER_SPEND, OTHER_REV, TERM_LEN,
  TAXES, TAX_BY_ID, REGIMES, REGIME_BY_ID, POLICIES, POLICY_BY_ID,
  VICE, VICE_BY_ID, PARTNERS, DEAL_BY_ID, BAND_NAMES, DEF_INCOME, DEF_NI,
  REGIONS, MAP_METRICS, NATION_PROFILE, PARTNER_BEARING, EVENTS, TABS, COL,
  MUTABLE, IMPACT_ROWS, IMP_NAMES,
  clamp, baseLaw, newGame, aggregate, revenue, spending, balanceOf,
  step, project, simulate, billClauses, billShock, projectionWarnings,
  impactOf, lawWithOnlyClause, withForecastError, previewOption,
  incomeYield, incomeProfile, effectiveBands, dragRatio, serviceScore,
  spendForScore, welfareCost, welfareAdequacy, taxAvailable,
  regionStats, regionColour, mapGeometry, countryField, paintMap, mapPick,
  initMap, Map2D, updateMap, updateMapLabel,
  dealBlockers, fullEffects, impactChips, impactFactions,
  impactStripHtml, impactPanelHtml,
  approvalOf, grade, gameOver, election, checkCrises, rollEvent, writeBriefing,
  qLabel, dialHtml, chip, spark, leverHtml, wireLevers, ctrlRow, thresholdSliderMax,
  incomePanelHtml, wireIncomePanel, lineChart, compositionBar,
  nationTableHtml, budgetModeHtml, ledgerTable, clausesIn, isFiscalOnly,
  esc, fmt, sgn, clone, ICONS, despatch, enact, projectionModal,
  render, renderChrome, renderPanel, $
};
`;

fs.mkdirSync("lib/sim", { recursive: true });
fs.writeFileSync("lib/sim/engine.js", full);
console.log("Wrote lib/sim/engine.js", full.split("\n").length, "lines");

const need = ["isFiscalOnly", "esc", "fmt", "signed", "deep", "copy", "function enact", "function despatch"];
for (const n of need) {
  console.log(n, full.includes(n) ? "ok" : "MISSING");
}
