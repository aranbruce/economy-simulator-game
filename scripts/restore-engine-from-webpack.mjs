/**
 * EMERGENCY RECOVERY ONLY — reconstruct lib/sim/engine.js from a Next.js webpack
 * hot-update chunk after a bad edit. Not a sync workflow. Pin `src` to a real
 * chunk path under .next/ before running. Prefer git checkout for recovery.
 */
import fs from "fs";

const src = fs.readFileSync(
  ".next/static/webpack/_app-pages-browser_components_game_GameApp_jsx.34c0d760a320cba7.hot-update.js",
  "utf8"
);
const marker = 'eval(__webpack_require__.ts("';
const start = src.indexOf(marker) + marker.length;
let i = start;
let raw = "";
while (i < src.length) {
  const ch = src[i];
  if (ch === "\\") {
    const next = src[i + 1];
    if (next === "n") { raw += "\n"; i += 2; continue; }
    if (next === "t") { raw += "\t"; i += 2; continue; }
    if (next === "r") { raw += "\r"; i += 2; continue; }
    if (next === '"') { raw += '"'; i += 2; continue; }
    if (next === "\\") { raw += "\\"; i += 2; continue; }
    raw += ch; i++; continue;
  }
  if (ch === '"') break;
  raw += ch; i++;
}

const bodyStart = raw.indexOf("/* ==================================================================\n   1. THE STATUTE BOOK");
const bodyEnd = raw.indexOf("\nvar _c, _c1");
let body = raw.slice(bodyStart, bodyEnd);

body = body.replace(/\(0,_(\w+)_js__WEBPACK_IMPORTED_MODULE_\d+__\.(\w+)\)/g, "$2");
body = body.replace(/_(\w+)_js__WEBPACK_IMPORTED_MODULE_\d+__\.(\w+)/g, "$2");

// Strip React Fast Refresh artifacts from webpack bundle
body = body.replace(/^_c\d* = [^;]+;\n/gm, "");
body = body.replace(/Object\.fromEntries\(_c\d+ = (\w+)\.map\(_c\d+ = /g, "Object.fromEntries($1.map(");

const header = `import { REALM_LAW, applyRealmLawOverlay } from "./realmLaws.js";
import { TRADE_MATRIX, shareFor, shareLabel } from "./tradeMatrix.js";
import {
  COUNTRIES, COUNTRY_REGIONS, DEFAULT_BLOC_MEMBER, LEGACY_ROLE_MAP, resolveHomeRole,
} from "./countries.js";
import {
  BLOC_TEMPLATES, CUSTOM_BLOC_TEMPLATES, blocById, countriesInBloc, isCustomsUnion,
} from "./blocs.js";
import { NATION_PROFILE, REL_0 } from "./nationProfiles.js";

`;

body = body.replace(/^let G = null;/m, "export let G = null;");
body = body.replace(/^let G = null;/m, "export let G = null;");
body = body.replace(/^let tab = null;/m, "export let tab = null;");
body = body.replace(
  /Opening macros live in nationProfiles\.js \(one row per sovereign partner\)\. \*\/ function openingFac/,
  `Opening macros live in nationProfiles.js (one row per sovereign partner). */
const FAC_0 = { business: 50, workers: 48, pensioners: 52, urban: 47, rural: 49, patriots: 45 };
function openingFac`
);

const footer = `
export {
  FACTIONS, DEPTS, OTHER_SPEND, OTHER_REV, TERM_LEN,
  TAXES, TAX_BY_ID, REGIMES, REGIME_BY_ID, POLICIES, POLICY_BY_ID,
  VICE, VICE_BY_ID, PARTNERS, DEAL_BY_ID, BAND_NAMES, DEF_INCOME, DEF_NI,
  MISSIONS, MISSION_BY_ID, MISSION_CD, REL_TRADE, RETAL_COLD, REL_IMPULSE_DECAY,
  REGIONS, MAP_METRICS, NATION_PROFILE, PARTNER_BEARING, EVENTS, TABS, COL,
  TRADE_REST_SHARE, SETTLE_QUARTERS, activePartners, tradeRestShare,
  partnerShare, dealsForPartner, shareFor, shareLabel, TRADE_MATRIX,
  hasDeal, dealsWith, lockedTariff, effectiveTariff, tariffScheduleAverage, importTariffLevel,
  partnerAccessTargets, tradeExposureTarget, tariffLocked,
  countryBlocId, blocMembers, joinBloc, leaveBloc, createCustomBloc, inviteToBloc, playerCountryId,
  canJoinBloc, blocJoinBlockers, blocMemberApprovals, blocExternalDealBlockers, needBlockers, simulateFromDraft,
  BLOC_TEMPLATES, CUSTOM_BLOC_TEMPLATES, pickEventPartner, partnerById, prepareEvent,
  applyDraftMissions, ensureDiploStocks,
  gdp0ForSeat, realmGdpBn, fmtGdpBn, worldDemandBn, refreshWorldY, restGdp0ForRole,
  clearOpeningCache, openingFac, openingRel, REL_0, FAC_0,
  MUTABLE, IMPACT_ROWS, IMP_NAMES,
  clamp, baseLaw, lawForRole, newGame, aggregate, revenue, spending, balanceOf,
  pinsForRole,
  step, project, simulate, billClauses, billShock, projectionWarnings,
  impactOf, impactOfRatePin, lawWithOnlyClause, withForecastError, previewOption, applyEventOption,
  incomeYield, incomeProfile, effectiveBands, personalAllowance, TAPER_START,
  capitalTaxOn, CAP_INCOME_SHARE, PRIVATE_WEALTH0, MPC_INCIDENCE,
  dragRatio, serviceScore,
  spendForScore, welfareCost, welfareAdequacy, taxAvailable,
  researchEffort, knowledgeTfp, R0, DEPREC_R, R_TFP, TFP_FRONTIER, CATCHUP_K,
  baselineTfpGrowth, tfpCatchupRate, impliedLabourGrowth, labourGrowthRate,
  effectiveBirthRate, FERTILITY_CH,
  potentialLevel, potentialGrowth, humanCapital, H_CAP0, DEPREC_H, stepHumanCapital,
  electionQuartersLeft, electionThermometer, qualEffects,
  regionStats, regionColour, mapGeometry, countryField, paintMap, mapPick,
  initMap, Map2D, updateMap, updateMapLabel,
  composePress, pushPress, renderPress, dismissPress, dismissNewestPress, expandPress,
  dealBlockers, fullEffects, impactChips, impactFactions,
  impactStripHtml, impactPanelHtml,
  approvalOf, grade, gameOver, election, checkCrises, rollEvent, writeBriefing,
  qLabel, dialHtml, chip, spark, leverHtml, wireLevers, ctrlRow, thresholdSliderMax,
  incomePanelHtml, wireIncomePanel, lineChart, compositionBar,
  nationTableHtml, budgetModeHtml, ledgerTable, clausesIn, isFiscalOnly,
  esc, fmt, sgn, clone, ICONS, despatch, enact, projectionModal,
  render, renderChrome, renderPanel, $, registerEl, T,
  setOnState, bump, setOnSetup, requestSetup, setTab, getTab, getG,
  setMapMetric, getMapMetric, setMapHover, recapitaliseBank,
};
`;

const out = header + body + footer;
fs.writeFileSync("lib/sim/engine.js", out);
console.log("Restored lib/sim/engine.js", out.split("\n").length, "lines");
