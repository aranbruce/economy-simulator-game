/**
 * Minimal sim smoke tests — opening books, projection purity, deterministic step,
 * structural event shocks.
 */
import { toggleDraftDeal } from "../lib/ui/actions.ts";
import {
  newGame,
  getG,
  balanceOf,
  project,
  step,
  clone,
  POLICIES,
  TAXES,
  EVENTS,
  simulate,
  impactOf,
  impactOfRatePin,
  applyEventOption,
  aggregate,
  incomeProfile,
  incomeYield,
  personalAllowance,
  TAPER_START,
  isDualCapital,
  welfareCost,
  recapitaliseBank,
  MUTABLE,
  SIMULATE_OMITS,
  SEAT_MOUNT_FIELDS,
  SEAT_MOUNT_SHARED,
  mountMpSeatOnSnapshot,
  composePress,
  eventPressCopy,
  pushPress,
  discardPress,
  expandPress,
  getPressExpanded,
  diploOutcomeAlertsForBrief,
  markDiploAlertsNoted,
  capitalShortfallHint,
  skipCoach,
  tickCoach,
  beginCoachStep,
  continueCoach,
  getCoachPanel,
  getDespatch,
  despatch,
  closeDespatch,
  immediateOptionChips,
  presentEventAsPress,
  pressChoicePending,
  closeFocusedPress,
  getNewsOpen,
  setTab,
  getTab,
  billClauses,
  PRIVATE_WEALTH0,
  R0,
  researchEffort,
  knowledgeTfp,
  potentialLevel,
  potentialGrowth,
  DEPTS,
  NATION_PROFILE,
  PARTNERS,
  SETTLE_QUARTERS,
  activePartners,
  gdp0ForSeat,
  realmGdpBn,
  fmtGdpBn,
  worldDemandBn,
  refreshWorldY,
  tradeRestShare,
  partnerShare,
  dealsForPartner,
  partnerById,
  thresholdSliderMax,
  dragRatio,
  clearOpeningCache,
  serviceScore,
  spendForScore,
  syncServiceHolds,
  currencyForSeat,
  fxDisplayIndex,
  BASE_INCOME_DIST,
  BASE_DIST_GINI,
  buildIncomeDist,
  incomeDistForRole,
  preTaxGini,
  IMPACT_ROWS,
  MISSIONS,
  joinBloc,
  leaveBloc,
  countryBlocId,
  playerCountryId,
  lockedTariff,
  mpDraftBlocGateError,
  effectiveTariff,
  importTariffLevel,
  createCustomBloc,
  canCreateCustomBloc,
  withdrawBlocAccession,
  inviteToBloc,
  pickEventPartner,
  isPlayerSeat,
  requirePartner,
  requireScriptablePartner,
  isHumanMpSeat,
  applyDraftMissions,
  DEAL_BY_ID,
  BLOC_TEMPLATES,
  prepareEvent,
  FAC_0,
  enact,
  blocJoinBlockers,
  blocMemberApprovals,
  blocInviteBlockers,
  finalizeBlocJoin,
  partnerAccessTargets,
  dealBlockers,
  blocExternalDealBlockers,
  cuBoundary,
  canNegotiateUnionCommercial,
  canNegotiateReciprocalTariffs,
  unionAssociationDeal,
  ratifyBilateralDealWithPartner,
  beginEpisode,
  endEpisode,
  scheduleNextMajorQ,
  rollEvent,
  rollMajorEvent,
  tariffScheduleAverage,
  WORLD_TFP_SPILL,
  MAJOR_GAP_MIN,
  MAJOR_GAP_SPAN,
  lawForRole,
  realmLawKey,
  baseLaw,
  briefingImpactLines,
  mergeBriefingImpact,
  briefingImpactParts,
  briefingData,
  writeBriefing,
  spending,
  POLITY,
  POLITY_IDS,
  REL_POLITY,
  polityOf,
  polityIdOf,
  profilePolityId,
  polityAffinity,
  polityReachable,
  polityCanReach,
  polityChangePc,
  POLITY_LEAP_EXTRA,
  polityShockFac,
  billShock,
  clausesIn,
  termLenOf,
  termReviewDue,
  termReview,
  canCallEarlyElection,
  earlyElectionBlocker,
  EARLY_ELECTION_MIN_Q,
  checkCrises,
  FACTIONS,
  relationModifiers,
  relationTarget,
  assignEnvoy,
  recallEnvoy,
  issueUltimatum,
  withdrawUltimatum,
  processUltimatums,
  canIssueUltimatum,
  canWithdrawUltimatum,
  addDiploLedger,
  setSanctionStance,
  applySphereTrespassOnDeal,
  ENVOY_ASSIGN_PC,
  ENVOY_TARGET,
  ENVOY_DRIFT,
  ENVOY_BUILD_CAP,
  ULTIMATUM_PC,
  LEDGER_DECAY,
  TABS,
  ultimatumDemandsFor,
  baseP,
  concedeP,
  partnerSelfInterest,
  interestTag,
  rollMissionEvent,
  formatMissionTokens,
  applyMissionEventOption,
  applySummitCommercialOption,
  applyMpInboundSummitCommercialChoice,
  buildSummitCommercialEvent,
  previewSummitTariff,
  commercialAcceptScore,
  commercialPackageScore,
  diploDeps,
  snapshotPartnerTariffs,
  snapshotPartnerTrade,
  livePartnerTariffOnPlayer,
  partnerTariffOnPlayer,
  MISSION_EVENTS,
  queueSummitVisitEvents,
  VISIT_DURATION,
  beginActiveVisit,
  visitQuartersLeft,
  isVisitActive,
  diploMapMarkers,
  diploHudChips,
  ongoingSituations,
  hasFormalProtest,
  PARTIES,
  PARTY_IDS,
  CHAMBER_SEATS,
  lawDeltaTaste,
  partyStances,
  policyTaste,
  seatsFromVotes,
  rulingAyeShare,
  chamberVote,
  seedParties,
  allocateElection,
  billVoteData,
  billCost,
  programmeCost,
  parliamentPowersOf,
  seatRows,
  capitalOutlook,
  chamberBlocksDeliver,
  leaderTitle,
  impactStripData,
  grade,
  governmentScoreData,
  T,
} from "../lib/sim/engine.ts";
import { PARTY_OVERLAYS, partyOverlayForRole } from "../lib/sim/parties.ts";
import { sharedCamp } from "../lib/sim/diplomacy.ts";
import { COUNTRIES } from "../lib/sim/countries.ts";
import { REALM_LAW } from "../lib/sim/realmLaws.ts";
import { partnerForIso } from "../lib/sim/partners.ts";
import { PLAYABLE_REALMS } from "../lib/sim/realms.ts";
import {
  theCountry,
  TheCountry,
  takesThe,
  countryPhrase,
} from "../lib/sim/countryPhrase.ts";
import { FLAG_CODE } from "../lib/ui/flags.ts";
import { REALM_FILL } from "../lib/sim/boardMetrics.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}
function ensureSched(law) {
  if (!law.tariffSchedule)
    law.tariffSchedule = { default: 4, country: {}, bloc: {} };
  if (!law.tariffSchedule.country) law.tariffSchedule.country = {};
}

newGame();
let G = getG();
const bal = balanceOf(G.law, G.econ);
const deficitPct = -bal.balance;
assert(
  deficitPct > 4 && deficitPct < 6,
  `opening deficit near UK band (got ${deficitPct.toFixed(2)}% of GDP)`,
);
assert(G.econ.debt === 94, "opening debt is 94% of GDP");
assert(G.econ.rate === 3.75, "opening Bank rate is 3.75%");
assert(G.econ.inflation === 2.9, "opening inflation is 2.9%");
assert(
  Math.abs(G.econ.privateWealth - 80) < 0.01,
  `opening privateWealth is 80% of GDP (got ${G.econ.privateWealth})`,
);
{
  const g0 = step(G, G.law, G.law, true).growth;
  const g1 = step(G, G.law, G.law, true).growth;
  assert(
    Math.abs(g0) < 2.8 && Math.abs(g1) < 2.8,
    `opening growth stays quiet (got ${g0.toFixed(2)} then ${g1.toFixed(2)})`,
  );
  assert(
    Math.abs(g0 - g1) < 1.2,
    `Q1→Q2 growth swing is small without a bill (got ${Math.abs(g0 - g1).toFixed(2)}pp)`,
  );
  /* Balance chip and Deficit card both read the logged outturn (deficit = −balance).
     A live balanceOf drifts once the cyclical shares move — do not use it for either. */
  for (let i = 0; i < 6; i++) step(G, G.law, G.law, true);
  const lastBal = G.log[G.log.length - 1].balance;
  assert(
    Math.abs(lastBal - G.econ.balGovt) < 1e-9,
    "logged balance equals sectoral balGovt",
  );
  assert(
    Math.abs(balanceOf(G.law, G.econ).balance - lastBal) > 0.01,
    "live balanceOf drifts from outturn (chip must use the log)",
  );
}
newGame();
G = getG();

const snap = JSON.stringify(G.econ);
project(4);
assert(JSON.stringify(G.econ) === snap, "project() does not mutate live econ");

// Full-state restore for deterministic comparison (includes world bags)
const snapG = clone({
  econ: G.econ,
  fac: G.fac,
  rel: G.rel,
  mods: G.mods,
  q: G.q,
  capital: G.capital,
  law: G.law,
  prevLaw: G.prevLaw,
  draft: G.draft,
  world: G.world,
  worldTrade: G.worldTrade,
});
step(G, G.law, G.prevLaw, true);
const mid = clone(G.econ);
Object.assign(G, clone(snapG));
G.econ = clone(snapG.econ);
G.fac = clone(snapG.fac);
G.rel = clone(snapG.rel);
G.mods = clone(snapG.mods);
G.law = clone(snapG.law);
G.prevLaw = clone(snapG.prevLaw);
G.draft = clone(snapG.draft);
G.world = clone(snapG.world);
G.worldTrade = clone(snapG.worldTrade);
G.q = snapG.q;
G.capital = snapG.capital;
step(G, G.law, G.prevLaw, true);
assert(
  JSON.stringify(G.econ) === JSON.stringify(mid),
  "step(det=true) is deterministic",
);

assert(POLICIES.length > 10, `policies loaded (${POLICIES.length})`);
assert(TAXES.length > 10, `taxes loaded (${TAXES.length})`);

newGame();
G = getG();
const path = simulate(G.law, 8);
assert(
  path && Array.isArray(path.rows) && path.rows.length === 8,
  "simulate returns eight quarterly rows",
);

/* Event options must leave only structural mod keys — never growth/inflation. */
const BANNED_MOD = new Set(["growth", "inflation"]);
let bannedHit = 0;
let optCount = 0;
for (const ev of EVENTS) {
  for (const opt of ev.opts) {
    optCount++;
    newGame();
    G = getG();
    /* Force conditions that law-gated options need. */
    G.law.taxes.digitalTax.on = true;
    G.law.taxes.digitalTax.rate = 5;
    G.law.tariff = 10;
    G.q = 8;
    G.econ.debt = 110;
    G.econ.yield = 6;
    G.econ.rate = 6;
    G.econ.services = 40;
    G.econ.openness = 70;
    /* Partner-bound events need a focus seat before apply. */
    if (typeof ev.resolve === "function") {
      prepareEvent(ev);
    }
    if (!G.eventFocus) {
      const p = pickEventPartner();
      if (p) G.eventFocus = p.id;
    }
    const before = {};
    MUTABLE.forEach((k) => {
      before[k] = G[k] === undefined ? undefined : clone(G[k]);
    });
    try {
      applyEventOption(opt);
    } catch (err) {
      bannedHit++;
      console.error(
        "FAIL: applyEventOption threw on",
        ev.id,
        opt.b,
        err.message,
      );
      continue;
    }
    for (const m of G.mods) {
      for (const k of Object.keys(m)) {
        if (BANNED_MOD.has(k)) {
          bannedHit++;
          console.error("FAIL: banned mod key", k, "from", ev.id, "/", opt.b);
        }
      }
    }
    MUTABLE.forEach((k) => {
      G[k] = before[k];
    });
  }
}
assert(
  bannedHit === 0,
  `no event option leaves growth/inflation mods (${optCount} options)`,
);

/* Social pressure channels press targets — not a one-shot stock smash. */
newGame();
G = getG();
const svc0 = G.econ.services;
applyEventOption({ shocks: [{ channel: "srv", points: -10, q: 8 }] });
for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
assert(
  G.econ.services < svc0 - 1,
  `srv shock degrades services over time (${svc0.toFixed(1)} → ${G.econ.services.toFixed(1)})`,
);

/* Boom is a TFP revision, not a debt write-down. */
newGame();
G = getG();
const boomDebt0 = G.econ.debt;
const boomA0 = G.econ.A;
const boom = EVENTS.find((e) => e.id === "boom");
applyEventOption(boom.opts[0]);
assert(Math.abs(G.econ.debt - boomDebt0) < 1e-9, "boom does not smash debt");
step(G, G.law, G.law, true);
assert(
  G.econ.A > boomA0,
  `boom lifts TFP via tfp channel (${boomA0.toFixed(4)} → ${G.econ.A.toFixed(4)})`,
);

/* Event option f() bodies must not assign outcome stocks directly. */
{
  const src = EVENTS.map((e) =>
    e.opts
      .map((o) => (o.f ? Function.prototype.toString.call(o.f) : ""))
      .join("\n"),
  ).join("\n");
  const bannedAssign = [
    /G\.econ\.services\s*[+\-*/]?=/,
    /G\.econ\.health\s*[+\-*/]?=/,
    /G\.econ\.crime\s*[+\-*/]?=/,
    /G\.econ\.gdp\s*[+\-*/]?=/,
    /G\.econ\.inflation\s*[+\-*/]?=/,
    /G\.econ\.A\s*\*=/,
    /G\.econ\.debt\s*[+\-]=/,
  ];
  let smash = 0;
  for (const re of bannedAssign) {
    if (re.test(src)) {
      smash++;
      console.error("FAIL: event f() still assigns outcome stock matching", re);
    }
  }
  assert(
    smash === 0,
    "event option f() does not assign services/health/crime/gdp/inflation/A/debt",
  );
}

/* Foreign-tariff style shock: tot + worldPartner should worsen net trade and
   lift import-side inflation pressure vs an untouched baseline. */
newGame();
G = getG();
const base = simulate(G.law, 6);
newGame();
G = getG();
applyEventOption({
  shocks: [
    { channel: "tot", points: 0.5, q: 6 },
    { channel: "worldPartner", partner: "united_states", points: -2.0, q: 6 },
  ],
});
const hit = simulate(G.law, 6);
const baseNT = base.rows.reduce((a, r) => a + (r.netTrade ?? r.X - r.M), 0);
const hitNT = hit.rows.reduce((a, r) => a + (r.netTrade ?? r.X - r.M), 0);
const baseInf =
  base.rows.reduce((a, r) => a + r.inflation, 0) / base.rows.length;
const hitInf = hit.rows.reduce((a, r) => a + r.inflation, 0) / hit.rows.length;
assert(
  hitNT < baseNT,
  `tariff shock worsens cumulative net trade (${hitNT.toFixed(2)} vs ${baseNT.toFixed(2)})`,
);
assert(
  hitInf >= baseInf - 0.05,
  `tariff shock does not lower average inflation (${hitInf.toFixed(2)} vs ${baseInf.toFixed(2)})`,
);

/* Housing / mortgage transmission: fixation lag and rate → weaker consumption. */
function pathAtPinnedRate(rate, quarters) {
  newGame();
  const g0 = getG();
  const sim = {
    q: g0.q,
    term: g0.term,
    mods: clone(g0.mods),
    econ: clone(g0.econ),
    fac: clone(g0.fac),
    rel: clone(g0.rel),
    capital: g0.capital,
    log: [],
    ruleBreaches: 0,
    sandbox: true,
  };
  const draft = clone(g0.law);
  let prev = clone(g0.law);
  const rows = [];
  for (let i = 0; i < quarters; i++) {
    sim.econ.rate = rate;
    const r = step(sim, draft, prev, true);
    prev = draft;
    sim.econ.rate = rate;
    rows.push({
      growth: r.growth,
      C: sim.econ.C,
      I: sim.econ.I,
      mortgageRate: sim.econ.mortgageRate,
      housePrice: sim.econ.housePrice,
    });
  }
  return { rows, end: sim };
}

newGame();
G = getG();
assert(
  G.econ.mortgageDebt > 40 && G.econ.housePrice > 90,
  `housing stocks initialise (debt ${G.econ.mortgageDebt}, hp ${G.econ.housePrice})`,
);

const mort0 = G.econ.mortgageRate;
G.econ.rate = mort0 + 2;
step(G, G.law, G.prevLaw, true);
const mortDelta = G.econ.mortgageRate - mort0;
assert(
  mortDelta > 0 && mortDelta < 1.5,
  `mortgage fixation: rate +2 moves mortgageRate by ${mortDelta.toFixed(3)} (< full pass-through)`,
);

const loose = pathAtPinnedRate(3.75, 8);
const tight = pathAtPinnedRate(5.75, 8);
const sumG = (rows) => rows.reduce((a, r) => a + r.growth, 0);
const sumI = (rows) => rows.reduce((a, r) => a + r.I, 0);
assert(
  sumG(tight.rows) < sumG(loose.rows),
  `higher Bank rate lowers cumulative growth (${sumG(tight.rows).toFixed(2)} vs ${sumG(loose.rows).toFixed(2)})`,
);
assert(
  sumI(tight.rows) < sumI(loose.rows),
  `higher Bank rate lowers cumulative investment (${sumI(tight.rows).toFixed(2)} vs ${sumI(loose.rows).toFixed(2)})`,
);
assert(
  tight.end.econ.mortgageRate > loose.end.econ.mortgageRate,
  "pinned high rate lifts effective mortgage rate over eight quarters",
);
assert(
  tight.end.econ.housePrice < loose.end.econ.housePrice,
  `higher rates weigh on house prices (${tight.end.econ.housePrice.toFixed(2)} vs ${loose.end.econ.housePrice.toFixed(2)})`,
);
/* Consumption levels are buffered by tax stabilisers and a state-dependent
   constrained share, so the mortgage channel is checked via service and wealth
   stocks rather than the raw C total. */

/* Manual base rate: free pin skips the Taylor rule; Bank mode still moves. */
newGame();
G = getG();
assert(G.rateManual === false, "fresh game defaults to Bank rate mode");
{
  const r0 = G.econ.rate;
  for (let i = 0; i < 8; i++) step(G, G.law, G.prevLaw, true);
  assert(
    Math.abs(G.econ.rate - r0) > 0.005,
    `Bank mode moves the rate under Taylor (${r0.toFixed(2)} → ${G.econ.rate.toFixed(2)})`,
  );
}
newGame();
G = getG();
G.rateManual = true;
G.manualRate = 5.0;
G.econ.rate = 5.0;
for (let i = 0; i < 6; i++) step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - 5.0) < 1e-9,
  `manual mode holds the rate at 5.0 (got ${G.econ.rate})`,
);
{
  const pinned = simulate(G.law, 4);
  assert(
    Math.abs(pinned.end.econ.rate - 5.0) < 1e-9,
    `simulate respects manual rate pin (got ${pinned.end.econ.rate})`,
  );
}
assert(
  Math.abs(G.econ.rate - 5.0) < 1e-9,
  "simulate does not leak a Taylor drift into live manual rate",
);
{
  const im = impactOfRatePin(4);
  assert(Math.abs(im.pin - 5.0) < 1e-9, "rate impact reports the pinned level");
  assert(
    im.head.growth < -0.05,
    `pinning above the Bank cuts cumulative growth vs Taylor (${im.head.growth.toFixed(2)})`,
  );
  const before = G.econ.rate;
  impactOfRatePin(4);
  assert(
    G.econ.rate === before && G.rateManual === true,
    "rate impact preview does not mutate live state",
  );
}
newGame();
G = getG();
G.rateManual = true;
G.manualRate = -0.5;
G.econ.rate = -0.5;
for (let i = 0; i < 4; i++) step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - -0.5) < 1e-9,
  `manual mode can hold a negative rate (got ${G.econ.rate})`,
);
G.manualRate = -2;
G.econ.rate = -2;
for (let i = 0; i < 4; i++) step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - -2) < 1e-9,
  `manual mode can hold at −2% (got ${G.econ.rate})`,
);
G.manualRate = -3;
G.econ.rate = -3;
step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - -2) < 1e-9,
  `manual mode clamps below −2% (got ${G.econ.rate})`,
);
assert(
  tight.end.econ.mortgageRate - 3.75 > loose.end.econ.mortgageRate - 3.75,
  "tight path carries a larger mortgage-rate gap versus neutral",
);

/* Content `imp` must not write pot/gro/inf/nairu — those are structural only. */
const BANNED_IMP = new Set(["pot", "gro", "inf", "nairu"]);
let bannedImp = 0;
for (const t of TAXES) {
  for (const k of Object.keys(t.imp || {})) {
    if (BANNED_IMP.has(k)) {
      bannedImp++;
      console.error("FAIL: tax", t.id, "imp has banned key", k);
    }
  }
}
for (const p of POLICIES) {
  for (const k of Object.keys(p.imp || {})) {
    if (BANNED_IMP.has(k)) {
      bannedImp++;
      console.error("FAIL: policy", p.id, "imp has banned key", k);
    }
  }
}
assert(bannedImp === 0, "content imp has no pot/gro/inf/nairu overrides");
newGame();
G = getG();
const E0 = aggregate(G.law);
assert(
  E0.pot === undefined && !("pot" in E0),
  "aggregate no longer exposes pot",
);
assert(
  (E0.tfp !== undefined || E0.ucost !== undefined) && E0.open <= 0,
  "aggregate still carries structural and openness channels",
);

/* Indirect-tax echo: a fuel-duty rise lifts inflation on impact vs baseline. */
newGame();
G = getG();
const baseFuel = simulate(G.law, 4);
newGame();
G = getG();
const fuelLaw = clone(G.law);
fuelLaw.taxes.fuel.rate = Math.min(25, fuelLaw.taxes.fuel.rate + 8);
const hitFuel = simulate(fuelLaw, 4);
assert(
  hitFuel.rows[0].inflation > baseFuel.rows[0].inflation,
  `fuel duty rise lifts first-quarter inflation (${hitFuel.rows[0].inflation.toFixed(2)} vs ${baseFuel.rows[0].inflation.toFixed(2)})`,
);

/* Demography: dependency and population stocks move; open visas raise working-age stock. */
newGame();
G = getG();
assert(
  G.econ.popWork > 50 && G.econ.popOld > 10 && G.econ.dependency > 0.2,
  `demography stocks initialise (work ${G.econ.popWork}, dep ${G.econ.dependency.toFixed(3)})`,
);
const dep0 = G.econ.dependency;
const work0 = G.econ.popWork;
for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
assert(
  Math.abs(G.econ.dependency - dep0) > 0.001 || G.econ.popWork !== work0,
  `demography moves over forty quarters (dep ${G.econ.dependency.toFixed(3)}, work ${G.econ.popWork.toFixed(2)})`,
);
newGame();
G = getG();
const closed = simulate(G.law, 16);
newGame();
G = getG();
const visaLaw = clone(G.law);
visaLaw.policies.openVisas = true;
const open = simulate(visaLaw, 16);
assert(
  open.end.econ.popWork > closed.end.econ.popWork,
  `open visas raise working-age population (${open.end.econ.popWork.toFixed(2)} vs ${closed.end.econ.popWork.toFixed(2)})`,
);

/* Housing stock-flow: planning raises the dwelling stock vs rent controls. */
newGame();
G = getG();
assert(
  G.econ.housingStock > 80 && G.econ.rentIndex > 80,
  `housing stock-flow initialises (H ${G.econ.housingStock}, rent ${G.econ.rentIndex})`,
);
const planLaw = clone(G.law);
planLaw.policies.planning = true;
const rentLaw = clone(G.law);
rentLaw.policies.rentCtrl = true;
const planPath = simulate(planLaw, 20);
const rentPath = simulate(rentLaw, 20);
assert(
  planPath.end.econ.housingStock > rentPath.end.econ.housingStock,
  `planning builds more dwellings than rent control (${planPath.end.econ.housingStock.toFixed(2)} vs ${rentPath.end.econ.housingStock.toFixed(2)})`,
);

/* Credit accelerator: bank capital hit raises spreads and user cost. */
newGame();
G = getG();
assert(
  G.econ.bankCapital > 4 && G.econ.bankLeverage > 6,
  `bank stocks initialise (cap ${G.econ.bankCapital}, lev ${G.econ.bankLeverage.toFixed(2)})`,
);
const beforeSpread = G.econ.creditSpread;
G.econ.bankCapital = 3;
G.econ.riskPremium = 1.5;
step(G, G.law, G.prevLaw, true);
assert(
  G.econ.creditSpread > beforeSpread,
  `weak bank capital / gilt scare lifts credit spread (${G.econ.creditSpread.toFixed(3)} vs ${beforeSpread.toFixed(3)})`,
);

/* Distributional Gini: UBI lowers measured inequality vs the baseline schedule. */
newGame();
G = getG();
const baseGini = incomeProfile(G.law, G.econ).gini;
const ubiLaw = clone(G.law);
ubiLaw.policies.ubi = true;
const ubiGini = incomeProfile(ubiLaw, G.econ).gini;
assert(
  ubiGini < baseGini - 0.5,
  `UBI lowers distributional Gini (${ubiGini.toFixed(2)} vs ${baseGini.toFixed(2)})`,
);
const flatLaw = clone(G.law);
const flatRate = flatLaw.income.bands[0].rate;
flatLaw.income.bands = flatLaw.income.bands.map((b) => ({
  ...b,
  rate: flatRate,
}));
flatLaw.income.divRate = flatRate;
flatLaw.income.saveRate = flatRate;
const flatGini = incomeProfile(flatLaw, G.econ).gini;
assert(
  flatGini > baseGini,
  `flat tax raises distributional Gini (${flatGini.toFixed(2)} vs ${baseGini.toFixed(2)})`,
);

/* Per-seat income distribution: base gini pin leaves the table unchanged;
   high-inequality seats stretch pre-tax Gini above low-inequality seats;
   step does not mutate the settled table. */
{
  clearOpeningCache();
  const baseAt35 = buildIncomeDist(BASE_DIST_GINI);
  assert(
    baseAt35.length === BASE_INCOME_DIST.length,
    "buildIncomeDist(35) keeps slice count",
  );
  for (let i = 0; i < BASE_INCOME_DIST.length; i++) {
    assert(
      Math.abs(baseAt35[i].inc - BASE_INCOME_DIST[i].inc) < 0.01 &&
        baseAt35[i].w === BASE_INCOME_DIST[i].w,
      `buildIncomeDist(35) matches BASE_INCOME_DIST slice ${i}`,
    );
  }
  const sa = preTaxGini(incomeDistForRole("south_africa"));
  const nl = preTaxGini(incomeDistForRole("netherlands"));
  assert(
    sa > nl + 2,
    `South Africa pre-tax Gini exceeds Netherlands (${sa.toFixed(1)} vs ${nl.toFixed(1)})`,
  );
  assert(
    NATION_PROFILE.south_africa.soc0.gini >
      NATION_PROFILE.netherlands.soc0.gini,
    "profile pins order South Africa above Netherlands",
  );
  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  assert(!!G.econ.incomeDist, "opening econ carries incomeDist");
  const dist0 = G.econ.incomeDist.map((s) => ({ w: s.w, inc: s.inc }));
  const y0 = incomeYield(G.law, aggregate(G.law), G.econ).income;
  for (let q = 0; q < 4; q++) step(G, G.law, G.prevLaw || G.law, true);
  assert(
    G.econ.incomeDist.length === dist0.length &&
      G.econ.incomeDist.every(
        (s, i) => s.inc === dist0[i].inc && s.w === dist0[i].w,
      ),
    "step leaves incomeDist unchanged",
  );
  clearOpeningCache();
  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  const y1 = incomeYield(G.law, aggregate(G.law), G.econ).income;
  assert(
    Math.abs(y0 - y1) < 0.05,
    `home income tax yield stable across opens (${y0.toFixed(2)} vs ${y1.toFixed(2)})`,
  );
}

/* Bilateral gravity: a united_states partner shock cuts that partner's export share. */
newGame();
G = getG();
step(G, G.law, G.prevLaw, true);
assert(
  G.econ.bilateralX &&
    G.econ.bilateralX.united_states > 0 &&
    G.econ.bilateralX.france > G.econ.bilateralX.saudi,
  "bilateral export vector initialises with france > gulf",
);
newGame();
G = getG();
const baseBilat = simulate(G.law, 6);
newGame();
G = getG();
applyEventOption({
  shocks: [
    { channel: "worldPartner", partner: "united_states", points: -4.0, q: 6 },
  ],
});
const hitBilat = simulate(G.law, 6);
const baseFed = baseBilat.end.econ.bilateralX?.united_states ?? 0;
const hitFed = hitBilat.end.econ.bilateralX?.united_states ?? 0;
assert(
  hitFed < baseFed,
  `united_states partner shock cuts bilateral X_fed (${hitFed.toFixed(3)} vs ${baseFed.toFixed(3)})`,
);
const baseCont = baseBilat.end.econ.bilateralX?.france ?? 0;
const hitCont = hitBilat.end.econ.bilateralX?.france ?? 0;
assert(
  Math.abs(hitCont - baseCont) < Math.abs(hitFed - baseFed) + 0.5,
  "partner shock mainly hits the named bilateral, not france equally",
);

/* World demand from partner GDP: opening pinned; large partners move worldY more. */
{
  clearOpeningCache();
  newGame();
  G = getG();
  assert(
    Math.abs(G.econ.worldY - 100) < 1e-6,
    `opening worldY is 100 (got ${G.econ.worldY})`,
  );
  assert(
    G.econ.worldDemand0 > 0,
    `worldDemand0 is set at open (got ${G.econ.worldDemand0})`,
  );
  assert(
    Math.abs((G.econ.worldRestY || 0) - 100) < 1e-6,
    `opening worldRestY is 100 (got ${G.econ.worldRestY})`,
  );
  const D0 = worldDemandBn(G.econ, G.homeRole);
  assert(
    Math.abs(D0 - G.econ.worldDemand0) < 0.01,
    `worldDemandBn matches stored baseline (${D0.toFixed(1)} vs ${G.econ.worldDemand0.toFixed(1)})`,
  );

  G.econ.nations.united_states.y = 120;
  G.econ.nations.saudi.y = 100;
  const yFed = refreshWorldY(G.econ, G.homeRole);
  const dFed = yFed - 100;

  G.econ.nations.united_states.y = 100;
  G.econ.nations.saudi.y = 120;
  const yGulf = refreshWorldY(G.econ, G.homeRole);
  const dGulf = yGulf - 100;
  assert(
    dFed > dGulf,
    `equal % boom: Federated lifts worldY more than Gulf (${dFed.toFixed(3)} vs ${dGulf.toFixed(3)})`,
  );

  G.econ.nations.united_states.y = 100;
  G.econ.nations.saudi.y = 100;
  G.econ.worldRestY = 120;
  const yRest = refreshWorldY(G.econ, G.homeRole);
  assert(
    yRest > 100,
    `rest-of-world boom lifts worldY (got ${yRest.toFixed(3)})`,
  );
  G.econ.worldRestY = 100;
  refreshWorldY(G.econ, G.homeRole);

  const restBefore = G.econ.worldRestY;
  applyEventOption({ shocks: [{ channel: "world", points: 8, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  assert(
    G.econ.worldRestY > restBefore,
    `world channel grows worldRestY (${G.econ.worldRestY.toFixed(3)} vs ${restBefore.toFixed(3)})`,
  );
  assert(
    G.econ.worldY > 100,
    `world channel lifts aggregate worldY (got ${G.econ.worldY.toFixed(3)})`,
  );
}

/* worldInfl / worldRate / worldTfp channels. */
newGame();
G = getG();
{
  const p0 = G.econ.worldP;
  applyEventOption({ shocks: [{ channel: "worldInfl", points: 8, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  const expected = p0 * (1 + (2 + 8) / 400);
  assert(
    Math.abs(G.econ.worldP - expected) < 1e-9,
    `worldInfl raises worldP (${G.econ.worldP.toFixed(6)} vs ${expected.toFixed(6)})`,
  );
}
newGame();
G = getG();
{
  const fx0 = G.econ.fx;
  applyEventOption({ shocks: [{ channel: "worldRate", points: 3, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  assert(
    G.econ.fx < fx0,
    `higher worldRate depreciates fx (${G.econ.fx.toFixed(4)} vs ${fx0.toFixed(4)})`,
  );
}
newGame();
G = getG();
{
  const a0 = G.econ.A;
  applyEventOption({ shocks: [{ channel: "worldTfp", points: 2, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  assert(
    G.econ.A > a0,
    `worldTfp spills into domestic A (${G.econ.A.toFixed(4)} vs ${a0.toFixed(4)}, spill=${WORLD_TFP_SPILL})`,
  );
}

/* Multi-country: world shock moves a named partner, not only worldRestY.
   Measured against an unshocked control rather than against the opening level.
   A partner is not at rest at open — it carries a quarter of trend and cycle
   like any other seat — so comparing the shocked outturn to its own starting
   GDP is really testing `momentum - shock < 0`, which sits on a knife edge:
   the same assertion flips on any change that nudges opening momentum a
   couple of tenths, in either direction, without the shock channel being
   involved at all. Running the quarter twice and differencing isolates what
   the test is named for. */
{
  const worldShockRun = (shock) => {
    newGame();
    const g = getG();
    const partnerId = Object.keys(g.world).find(
      (id) => id !== playerCountryId(g.homeRole),
    );
    if (shock) {
      applyEventOption({ shocks: [{ channel: "world", points: -8, q: 4 }] });
    }
    step(g, g.law, g.prevLaw, true);
    return { partnerId, gdp: g.world[partnerId].econ.gdp, world: !!g.world };
  };
  const quiet = worldShockRun(false);
  const hit = worldShockRun(true);
  assert(quiet.world, "live game has world bags");
  assert(!!quiet.partnerId, "has a non-player world seat");
  assert(
    hit.gdp < quiet.gdp - 0.25,
    `world shock hits partner GDP (${hit.gdp.toFixed(3)} vs unshocked ${quiet.gdp.toFixed(3)})`,
  );
}
newGame();
G = getG();

/* Major episode lifecycle: start, no second major, end schedules next. */
newGame();
G = getG();
{
  const majors = EVENTS.filter((e) => e.major);
  const majorIds = majors.map((e) => e.id).sort();
  const expectedMajors = [
    "aiBoom",
    "chinaSlowdown",
    "chinaTariffDown",
    "chinaTariffUp",
    "commodityShock",
    "creditCrunch",
    "globalEasing",
    "globalRecess",
    "greenTransition",
    "indiaSlowdown",
    "tradeWar",
    "usSlowdown",
    "usTariffDown",
    "usTariffUp",
    "worldInflation",
  ];
  assert(
    majorIds.join(",") === expectedMajors.slice().sort().join(","),
    `major episodes (${majorIds.join(", ")})`,
  );
  assert(
    G.nextMajorQ >= MAJOR_GAP_MIN &&
      G.nextMajorQ < MAJOR_GAP_MIN + MAJOR_GAP_SPAN,
    `opening nextMajorQ in 16–32 band (got ${G.nextMajorQ})`,
  );
  G.nextMajorQ = 999;
  assert(rollMajorEvent() === null, "major not drawn before nextMajorQ");
  G.nextMajorQ = G.q;
  const major = EVENTS.find((e) => e.id === "globalRecess");
  applyEventOption(major.opts[0]);
  beginEpisode(major, major.opts[0]);
  assert(
    G.episode && G.episode.id === "globalRecess",
    "beginEpisode sets active episode",
  );
  const dur = major.duration != null ? major.duration : 8;
  assert(
    G.episode.endsQ === G.q + dur,
    `episode ends after duration (endsQ=${G.episode.endsQ}, want +${dur})`,
  );
  G.nextMajorQ = G.q;
  assert(rollMajorEvent() === null, "no second major while episode active");
  const endsQ = G.episode.endsQ;
  G.q = endsQ;
  const gapBefore = G.q;
  endEpisode();
  assert(G.episode === null, "endEpisode clears episode");
  assert(
    G.nextMajorQ >= gapBefore + MAJOR_GAP_MIN &&
      G.nextMajorQ < gapBefore + MAJOR_GAP_MIN + MAJOR_GAP_SPAN,
    `endEpisode schedules next major 16–32q out (got ${G.nextMajorQ} from ${gapBefore})`,
  );
  assert(
    scheduleNextMajorQ(0, true) === 24,
    "deterministic scheduleNextMajorQ uses mid gap",
  );
}

/* Trade war raises tariffs and unwind restores them. */
newGame();
G = getG();
{
  const before = tariffScheduleAverage(G.law, G.homeRole, G.blocMember);
  const war = EVENTS.find((e) => e.id === "tradeWar");
  const opt = war.opts[1];
  applyEventOption(opt);
  beginEpisode(war, opt);
  const during = tariffScheduleAverage(G.law, G.homeRole, G.blocMember);
  assert(
    during > before,
    `trade war raises tariff average (${during.toFixed(2)} vs ${before.toFixed(2)})`,
  );
  assert(G.episode && G.episode.tariffSnap, "trade war stores tariff snapshot");
  endEpisode();
  const after = tariffScheduleAverage(G.law, G.homeRole, G.blocMember);
  assert(
    Math.abs(after - before) < 1e-9,
    `trade war unwind restores tariffs (${after.toFixed(2)} vs ${before.toFixed(2)})`,
  );
}

/* An ordinary tariff event moves rates for good: it must not park a snapshot
   that a later, unrelated episode would unwind to. */
newGame();
G = getG();
{
  const row = EVENTS.find((e) => e.id === "tradeRow");
  assert(row && !row.major, "tradeRow is an ordinary event, not a major");
  G.eventFocus = "germany";
  const rowOpt = row.opts.find((o) => typeof o.f === "function");
  applyEventOption(rowOpt);
  const raised = tariffScheduleAverage(G.law, G.homeRole, G.blocMember);
  assert(
    !G._pendingTariffSnap,
    "ordinary tariff event parks no pending tariff snapshot",
  );
  const rec = EVENTS.find((e) => e.id === "globalRecess");
  beginEpisode(rec, rec.opts[0]);
  assert(
    !(G.episode && G.episode.tariffSnap),
    "a later episode with no tariff move carries no snapshot",
  );
  G.q = G.episode.endsQ;
  endEpisode();
  assert(
    Math.abs(tariffScheduleAverage(G.law, G.homeRole, G.blocMember) - raised) <
      1e-9,
    "episode end leaves the earlier event's tariffs standing",
  );
}

/* Uncertainty stock: raises precautionary pullback vs baseline consumption path. */
newGame();
G = getG();
const calm = simulate(G.law, 6);
newGame();
G = getG();
applyEventOption({ shocks: [{ channel: "uncertainty", points: 2.0, q: 6 }] });
const jittery = simulate(G.law, 6);
assert(
  jittery.end.econ.uncertainty > calm.end.econ.uncertainty,
  `uncertainty stock persists (${jittery.end.econ.uncertainty.toFixed(2)} vs ${calm.end.econ.uncertainty.toFixed(2)})`,
);
assert(
  jittery.end.econ.C < calm.end.econ.C,
  `uncertainty lowers consumption (${jittery.end.econ.C.toFixed(2)} vs ${calm.end.econ.C.toFixed(2)})`,
);

/* Triple lock: pension index rises with max(wage, CPI, 2.5%). */
newGame();
G = getG();
G.law.policies.tripleLock = true;
G.draft.policies.tripleLock = true;
const idx0 = G.econ.pensionIndex;
for (let i = 0; i < 8; i++) step(G, G.law, G.law, true);
assert(
  G.econ.pensionIndex > idx0 * (1 + 2.4 / 400) ** 7,
  `triple lock lifts pension index (${G.econ.pensionIndex.toFixed(4)} from ${idx0})`,
);
const spendWith = welfareCost(G.law, G.econ);
G.law.policies.tripleLock = false;
const spendWithout = welfareCost(G.law, G.econ);
assert(
  spendWith > spendWithout,
  `triple lock raises welfare cost (${spendWith.toFixed(2)} vs ${spendWithout.toFixed(2)})`,
);

/* Allowance taper: £100k+ loses allowance; creates higher MTR in the window. */
newGame();
G = getG();
assert(
  personalAllowance(90000, G.law) === G.law.income.allowance,
  "allowance intact below taper",
);
assert(
  personalAllowance(110000, G.law) < G.law.income.allowance,
  `taper cuts allowance at £110k (${personalAllowance(110000, G.law).toFixed(0)})`,
);
assert(
  personalAllowance(110000, G.law) ===
    G.law.income.allowance - 0.5 * (110000 - TAPER_START),
  "taper withdraws 50p in the pound",
);
const baseRev = incomeYield(G.law, aggregate(G.law), G.econ).income;
const noTaperLaw = clone(G.law);
/* isFlatIncome disables the taper — receipts should differ from progressive. */
noTaperLaw.income.bands = [{ from: noTaperLaw.income.allowance, rate: 20 }];
noTaperLaw.income.divRate = 20;
noTaperLaw.income.saveRate = 20;
const flatRev = incomeYield(noTaperLaw, aggregate(noTaperLaw), G.econ).income;
assert(
  Math.abs(baseRev - flatRev) > 0.01,
  `taper/progressive schedule differs from flat (${baseRev.toFixed(2)} vs ${flatRev.toFixed(2)})`,
);

/* Threshold slider max tracks wages so uprating never pins the thumb. */
newGame();
G = getG();
const openMax = thresholdSliderMax(30000, G.law.income.allowance, 250);
assert(
  openMax >= 30000 && openMax >= G.law.income.allowance,
  `opening allowance slider max covers base and live value (${openMax})`,
);
G.econ.wageIndex = 2.5;
const scaledMax = thresholdSliderMax(30000, G.law.income.allowance, 250);
assert(
  scaledMax >= 30000 * 2.5,
  `wage growth lifts allowance slider max (${scaledMax} >= ${30000 * 2.5})`,
);
G.econ.wageIndex = 1;
const pastCeil = thresholdSliderMax(30000, 40000, 250);
assert(
  pastCeil >= 40000 * 1.15,
  `slider max keeps headroom above an overshot live value (${pastCeil})`,
);
const bandMax = thresholdSliderMax(300000, 350000, 1000);
assert(
  bandMax >= 350000,
  `band-floor slider max covers an overshot threshold (${bandMax})`,
);

/* Hold-service: raising the spend slider must raise the held standard, even if
   hold was left stale (the old UI bug). Otherwise step() snaps spend back. */
{
  clearOpeningCache();
  newGame({ sandbox: true, silent: true });
  G = getG();
  const id = "health";
  G.draft.mode[id] = "service";
  G.draft.hold[id] = serviceScore(id, G.draft, G.econ);
  G.draft.spend[id] = spendForScore(id, G.draft.hold[id], G.econ);
  G.prevLaw = clone(G.law);
  G.law = clone(G.draft);
  step(G, G.law, G.prevLaw, true);
  G.draft = clone(G.law);
  const hold0 = G.law.hold[id];

  /* Mimic a slider drag that updated spend but forgot hold (pre-fix path). */
  G.draft.spend[id] = Math.min(
    DEPTS.find((d) => d.id === id).max,
    G.draft.spend[id] + 1.5,
  );
  const staleHold = G.draft.hold[id];
  assert(
    Math.abs(staleHold - hold0) < 1e-9,
    "precondition: hold still at the old standard before sync",
  );
  syncServiceHolds(G.draft, G.econ);
  const hold1 = G.draft.hold[id];
  assert(
    hold1 > hold0 + 1,
    `syncServiceHolds lifts the held standard with the slider (${hold0.toFixed(1)} → ${hold1.toFixed(1)})`,
  );

  G.prevLaw = clone(G.law);
  G.law = clone(G.draft);
  step(G, G.law, G.prevLaw, true);
  G.draft = clone(G.law);
  assert(
    Math.abs(G.law.hold[id] - hold1) < 1e-9,
    "held standard survives the next quarter",
  );
  assert(
    Math.abs(serviceScore(id, G.law, G.econ) - hold1) < 0.75,
    `outturn service score tracks the new hold (got ${serviceScore(id, G.law, G.econ).toFixed(1)}, want ${hold1.toFixed(1)})`,
  );

  /* Undoing a spend clause must restore hold too. */
  G.draft.spend[id] = G.draft.spend[id] + 1;
  syncServiceHolds(G.draft, G.econ);
  const raisedHold = G.draft.hold[id];
  const spendCl = billClauses().find(
    (c) => /Health/.test(c.label) && /points of GDP/.test(c.label),
  );
  assert(spendCl, "raising health spend creates a bill clause");
  spendCl.undo();
  assert(
    Math.abs(G.draft.spend[id] - G.law.spend[id]) < 1e-9,
    "undo restores spend",
  );
  assert(
    Math.abs(G.draft.hold[id] - G.law.hold[id]) < 1e-9,
    `undo restores hold (got ${G.draft.hold[id]}, law ${G.law.hold[id]}, raised was ${raisedHold})`,
  );
}

/* Real allowance is CPI-deflated against the seat's own opening base. */
{
  clearOpeningCache();
  newGame({ sandbox: true });
  G = getG();
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.01,
    "UK opens at full real allowance",
  );
  assert(
    G.econ.allowBase === 12570,
    "UK allowBase is the UK opening allowance",
  );
  assert(Math.abs((G.econ.cpiIndex || 1) - 1) < 1e-9, "cpiIndex opens at 1");

  G.law.income.uprate = true;
  G.draft.income.uprate = true;
  for (let i = 0; i < 12; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.005,
    `Uprate holds CPI-real allowance near 100 (${(dragRatio(G.law, G.econ) * 100).toFixed(2)})`,
  );

  clearOpeningCache();
  newGame({ sandbox: true });
  G = getG();
  G.law.income.uprate = false;
  G.draft.income.uprate = false;
  for (let i = 0; i < 12; i++) step(G, G.law, G.law, true);
  assert(
    dragRatio(G.law, G.econ) < 0.97,
    `Freeze erodes CPI-real allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(2)})`,
  );

  clearOpeningCache();
  newGame({ sandbox: true, homeRole: "russia" });
  G = getG();
  assert(
    G.econ.allowBase === G.law.income.allowance,
    "russia allowBase matches seat opening",
  );
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.02,
    `russia opens near full real allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(1)})`,
  );

  clearOpeningCache();
  newGame({ sandbox: true, homeRole: "saudi" });
  G = getG();
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.02,
    `saudi opens near full real allowance despite higher cash allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(1)})`,
  );
}

/* Private wealth feeds C/credit; sectoral residual stays small. */
newGame();
G = getG();
assert(
  Math.abs(G.econ.privateWealth - PRIVATE_WEALTH0) < 0.01,
  "privateWealth opens at PRIVATE_WEALTH0",
);
{
  newGame();
  G = getG();
  G.econ.privateWealth = PRIVATE_WEALTH0 - 40;
  step(G, G.law, G.law, true);
  const cLow = G.econ.C;
  newGame();
  G = getG();
  G.econ.privateWealth = PRIVATE_WEALTH0 + 40;
  step(G, G.law, G.law, true);
  assert(
    G.econ.C > cLow,
    `higher privateWealth lifts consumption (${G.econ.C.toFixed(2)} vs ${cLow.toFixed(2)})`,
  );
}
newGame();
G = getG();
{
  let maxAbs = 0;
  for (let i = 0; i < 40; i++) {
    step(G, G.law, G.law, true);
    maxAbs = Math.max(maxAbs, Math.abs(G.econ.balResidual || 0));
  }
  assert(
    maxAbs < 1.5,
    `sectoral |balResidual| stays small over 40Q (got ${maxAbs.toFixed(3)})`,
  );
}

/* Dual income (isDualCapital derived): capital taxed at one flat rate,
   separate from labour bands. */
newGame();
G = getG();
{
  const prog = incomeYield(G.law, aggregate(G.law), G.econ);
  assert(
    prog.capital > 0.5,
    `progressive raises capital income tax (${prog.capital.toFixed(2)})`,
  );
  const dual = clone(G.law);
  dual.income.divRate = 10;
  dual.income.saveRate = 10;
  assert(isDualCapital(dual), "divRate === saveRate derives a dual system");
  const lowCap = incomeYield(dual, aggregate(dual), G.econ);
  dual.income.divRate = 40;
  dual.income.saveRate = 40;
  const highCap = incomeYield(dual, aggregate(dual), G.econ);
  assert(
    highCap.capital > lowCap.capital + 0.5,
    `dual capital rate moves capital receipts (${lowCap.capital.toFixed(2)} → ${highCap.capital.toFixed(2)})`,
  );
  assert(
    Math.abs(highCap.labour - lowCap.labour) < 0.05,
    "dual capital rate does not move labour income tax",
  );
}

/* Bank NIM / loan losses: higher unemployment raises PD and cuts capital. */
newGame();
G = getG();
assert(
  G.econ.bankLoans > 50 && G.econ.bankDeposits > 40,
  `bank loan book initialises (${G.econ.bankLoans}, deposits ${G.econ.bankDeposits})`,
);
const cap0 = G.econ.bankCapital;
G.econ.unemployment = 12;
G.econ.nairu = 4.1;
for (let i = 0; i < 6; i++) step(G, G.law, G.law, true);
assert(
  G.econ.bankCapital < cap0,
  `loan losses erode bank capital when unemployment is high (${G.econ.bankCapital.toFixed(2)} vs ${cap0})`,
);
newGame();
G = getG();
const debt0 = G.econ.debt;
recapitaliseBank(G.econ, 3, 1.8);
assert(
  G.econ.debt > debt0 && G.econ.bankCapital >= 8,
  `fiscal recap raises debt and restores capital (debt ${G.econ.debt.toFixed(1)}, cap ${G.econ.bankCapital.toFixed(1)})`,
);

/* Floating press clippings — template copy from bill clauses and event options. */
newGame();
G = getG();
assert(
  Array.isArray(G.press) && G.press.length === 0,
  "newGame starts with empty press",
);
assert(
  !MUTABLE.includes("press"),
  "press is display state and stays out of MUTABLE",
);

/* Every MUTABLE field must be accounted for by simulate(): either the
   projection actually carries it forward, or it's on the explicit
   SIMULATE_OMITS allowlist with a documented reason. Catches the "someone
   added a new field to MUTABLE and forgot simulate()" drift CLAUDE.md warns
   about. */
const simEnd = simulate(G.law, 1).end;
const unaccounted = MUTABLE.filter(
  (k) => !(k in simEnd) && !SIMULATE_OMITS.includes(k),
);
assert(
  unaccounted.length === 0,
  `every MUTABLE field lands in simulate() or SIMULATE_OMITS (missing: ${unaccounted.join(", ")})`,
);

/* A seat mount swaps a whole seat onto the shared game object, and every
   bracketing save/restore is driven off SEAT_MOUNT_FIELDS. If a mount ever
   writes a field the list doesn't name, that field leaks out of the mount into
   whichever seat was mounted before — which is exactly how the isPlayer flag
   broke multiplayer tariffs. Proxy a real mount and record what it touches, so
   the list can't drift from the code. */
{
  newGame({ country: "Probe", homeRole: "home", silent: true });
  const probeG = getG();
  const seatId = Object.keys(probeG.world).find(
    (id) => id !== playerCountryId(probeG.homeRole),
  );
  const written = new Set();
  const probe = new Proxy(probeG, {
    set(target, key, value) {
      if (typeof key === "string") written.add(key);
      target[key] = value;
      return true;
    },
  });
  mountMpSeatOnSnapshot(probe, seatId);
  const unlisted = [...written].filter(
    (k) => !SEAT_MOUNT_FIELDS.includes(k) && !SEAT_MOUNT_SHARED.includes(k),
  );
  assert(
    unlisted.length === 0,
    `mount writes only SEAT_MOUNT_FIELDS or SEAT_MOUNT_SHARED (unlisted: ${unlisted.join(", ")})`,
  );
  assert(
    SEAT_MOUNT_FIELDS.every((k) => !SEAT_MOUNT_SHARED.includes(k)),
    "no field is both restored and shared",
  );
  assert(written.size > 10, `mount probe actually observed writes (${written.size})`);
}

const CALM_ECON = {
  inflation: 2.5,
  unemployment: 4.5,
  yield: 4.5,
  debt: 94,
  services: 55,
  rate: 3.75,
};
const PAPER_MASTHEAD =
  /Fiscal Gazette|World Post|Diplomatic Courier|Trade Gazette|Party Bulletin/;

const emptyClips = composePress({
  clauses: [],
  cost: 0,
  balDelta: 0,
  event: null,
  option: null,
  q: 0,
  econ: CALM_ECON,
});
assert(emptyClips.length === 0, "quiet quarter produces no clippings");

const billClips = composePress({
  clauses: [
    { label: "Enact Carbon price", pc: 12 },
    { label: "VAT, 20% to 22%", pc: 4 },
    { label: "Health +0.5 points of GDP", pc: 2 },
  ],
  cost: 18,
  balDelta: -0.4,
  q: 0,
  econ: CALM_ECON,
});
assert(
  billClips.length === 1 && billClips[0].kind === "bill",
  "non-empty bill yields one bill clipping",
);
assert(
  /Carbon price/.test(billClips[0].headline),
  "multi-clause bill leads with the costliest measure",
);
assert(
  !/Chancellor's bill/.test(billClips[0].headline) &&
    !/Political capital/.test(billClips[0].lede),
  "bill clip is reporting, not a clause dump",
);
assert(
  /VAT rises to 22 percent/.test(billClips[0].lede) &&
    /deficit widens/.test(billClips[0].lede),
  "bill lede names remaining clauses and fiscal direction",
);
assert(
  PAPER_MASTHEAD.test(billClips[0].masthead),
  "bill masthead is a newspaper",
);

{
  const chamber = composePress({
    clauses: [{ label: "Abolish fuel duty", pc: 8 }],
    q: 0,
    econ: CALM_ECON,
  });
  assert(
    chamber.length === 1 &&
      /passed the chamber/.test(chamber[0].lede) &&
      !/red box/i.test(chamber[0].lede),
    "sovereign legislative clip reports a chamber vote, not the red box",
  );
  const exec = composePress({
    clauses: [{ label: "State visit with Japan", pc: 6, executive: true }],
    q: 0,
    econ: CALM_ECON,
  });
  assert(
    /government enacted/.test(exec[0].lede) && !/chamber/.test(exec[0].lede),
    "executive-only clip does not claim a parliamentary vote",
  );
  const summitMp = composePress({
    clauses: [{ label: "State visit / summit with Japan", pc: 8 }],
    q: 0,
    econ: CALM_ECON,
  });
  assert(
    /government enacted/.test(summitMp[0].lede) &&
      !/chamber/.test(summitMp[0].lede),
    "a summit clip without an executive flag still does not claim a chamber vote",
  );
}

{
  newGame();
  G = getG();
  G.law.groups.parliamentaryPowers = "suppressed";
  G.draft.groups.parliamentaryPowers = "suppressed";
  const clip = composePress({
    clauses: [{ label: "Abolish fuel duty", pc: 8 }],
    q: 0,
    econ: CALM_ECON,
  });
  assert(
    /government enacted/.test(clip[0].lede) &&
      !/passed the chamber/.test(clip[0].lede),
    "suppressed parliament clip is an executive act",
  );
}

{
  newGame();
  G = getG();
  G.law.groups.parliamentaryPowers = "consultative";
  G.draft.groups.parliamentaryPowers = "consultative";
  const clip = composePress({
    clauses: [{ label: "Abolish fuel duty", pc: 8 }],
    q: 0,
    econ: CALM_ECON,
  });
  assert(
    /advisory/.test(clip[0].lede),
    "consultative parliament clip notes the vote was advisory",
  );
}

const ev = EVENTS.find((e) => e.id === "ultimatum");
const opt = ev.opts[0];
const eventCopy = eventPressCopy(ev, opt);
assert(
  /Washington/.test(eventCopy.headline) &&
    eventCopy.headline.indexOf(opt.b) < 0,
  "event headline is the story, not the chosen option",
);
assert(
  PAPER_MASTHEAD.test(eventCopy.masthead) && eventCopy.masthead !== ev.stamp,
  "event masthead is a newspaper, not a ministry stamp",
);
assert(
  !composePress({
    clauses: [{ label: "Abolish fuel duty", pc: 8 }],
    event: ev,
    option: opt,
    q: 1,
    econ: CALM_ECON,
  }).some((c) => c.kind === "event"),
  "composePress no longer files event clips — those land via presentEventAsPress",
);

const macroClips = composePress({
  clauses: [],
  q: 0,
  res: { growth: -1.2 },
  econ: { ...CALM_ECON, inflation: 5.1, rate: 4.5 },
});
assert(
  macroClips.some((c) => c.kind === "macro" && /contraction/i.test(c.headline)),
  "contraction yields a macro clip",
);
assert(
  macroClips.some((c) => /Prices climb/i.test(c.headline)),
  "high inflation yields a prices clip",
);
assert(
  macroClips.length <= 2 &&
    macroClips.every((c) => PAPER_MASTHEAD.test(c.masthead)),
  "at most two macro clips, all on newspaper mastheads",
);

const econBefore = JSON.stringify(G.econ);
const pressBefore = G.press.length;
pushPress(billClips);
assert(G.press.length === pressBefore + 1, "pushPress appends to G.press");
assert(
  JSON.stringify(G.econ) === econBefore,
  "pushPress does not mutate live econ",
);
assert(
  G.press[G.press.length - 1].headline.indexOf("Carbon price") >= 0,
  "pushed clip keeps headline",
);

/* Well under the cap — the inbox is persistent now, not a three-item ticker */
pushPress(billClips);
pushPress(billClips);
pushPress(billClips);
assert(G.press.length === 4, "press inbox holds every clip below the cap");

/* Push well past the cap (20 — see PRESS_MAX in engine.ts) and confirm it
   still trims from the oldest end rather than growing unbounded */
for (let i = 0; i < 25; i++) pushPress(billClips);
assert(G.press.length === 20, "press inbox caps at twenty clips");

{
  const n = G.press.length;
  const keep = G.press[0].id;
  const drop = G.press[n - 1].id;
  expandPress(drop);
  assert(getPressExpanded() === drop, "expandPress focuses a clip");
  assert(discardPress(drop) === true, "discardPress removes a clip");
  assert(G.press.length === n - 1, "discardPress shortens the inbox");
  assert(!G.press.some((c) => c.id === drop), "discarded clip is gone");
  assert(
    G.press[0].id === keep,
    "discardPress does not shuffle remaining clips",
  );
  assert(
    getPressExpanded() === null,
    "discarding the focused clip clears focus",
  );
  assert(
    discardPress("missing") === false,
    "discardPress no-ops on unknown id",
  );
}

/* Morning-note impact: Permanent Secretary prose from impactOf, not the Gazette. */
{
  const quiet = briefingImpactLines(
    { head: {}, fac: {} },
    { kind: "bill", clauses: [] },
  );
  assert(quiet.length === 0, "empty impact yields no briefing lines");

  const noopBill = briefingImpactLines(
    { head: { growth: 0.01, balance: 0.01 }, fac: { business: 0.1 } },
    { kind: "bill", clauses: [{ label: "VAT, 20% to 21%", pc: 2 }] },
  );
  assert(
    noopBill.length === 1 && /barely moves the dial/.test(noopBill[0]),
    "near-zero bill impact still gets a barely-moves line",
  );

  const rich = briefingImpactLines(
    {
      head: {
        growth: 0.32,
        balance: 0.45,
        debt: -0.2,
        inflation: 0.01,
        unemployment: -0.02,
        yield: 0,
        approval: 0.8,
        services: 0,
        trend: 0.01,
        potential: 0.02,
        fx: 0,
      },
      fac: { business: 1.2, workers: -0.9, capital: 0.1 },
    },
    { kind: "bill", clauses: [{ label: "VAT, 20% to 22%", pc: 4 }] },
  );
  assert(
    rich.length >= 2,
    "material impact yields economic and approval lines",
  );
  assert(
    /over the next year, compared with standing still/.test(rich[0]),
    "economic impact closes with year-ahead comparison",
  );
  assert(
    /growth/i.test(rich[0]) && /deficit/i.test(rich[0]),
    "economic impact names growth and deficit",
  );
  assert(/polls/i.test(rich[1]), "approval sits in its own line");

  const parts = briefingImpactParts(
    {
      head: {
        growth: 0.32,
        balance: 0.45,
        debt: -0.2,
        inflation: 0.01,
        unemployment: -0.02,
        yield: 0,
        approval: 0.8,
        services: 0,
        trend: 0.01,
        potential: 0.02,
        fx: 0,
      },
      fac: { business: 1.2, workers: -0.9, capital: 0.1 },
    },
    { kind: "bill", clauses: [{ label: "VAT, 20% to 22%", pc: 4 }] },
  );
  assert(
    parts && parts.economic && parts.approval,
    "impact parts split economic and approval",
  );
  assert(
    /growth/i.test(parts.economic) && /deficit/i.test(parts.economic),
    "economic box covers growth and deficit",
  );
  assert(/polls/i.test(parts.approval), "approval box covers polls");
  assert(/Business/.test(parts.politics), "faction warmth stays with approval");

  const macro = briefingImpactLines(
    {
      head: {
        growth: 0.28,
        inflation: 0.41,
        balance: 0.55,
        debt: -0.15,
        unemployment: -0.02,
        yield: 0,
        approval: 1.1,
        services: 0,
        trend: 0.01,
        potential: 0.02,
        fx: 0,
      },
      fac: {},
    },
    { kind: "bill", clauses: [{ label: "VAT, 20% to 22%", pc: 4 }] },
  );
  assert(
    /growth/i.test(macro[0]) &&
      /inflation/i.test(macro[0]) &&
      /deficit/i.test(macro[0]),
    "material growth, inflation and deficit are always mentioned",
  );
  assert(
    !/polls/i.test(macro[0]),
    "approval stays out of the economic line when split",
  );

  const decision = briefingImpactLines(
    {
      head: {
        growth: -0.2,
        balance: 0,
        debt: 0,
        inflation: 0,
        unemployment: 0,
        yield: 0,
        approval: 0,
        services: 0,
        trend: 0,
        potential: 0,
        fx: 0,
      },
      fac: {},
    },
    { kind: "decision" },
  );
  assert(
    /over the next year, compared with doing nothing/.test(decision[0]),
    "event impact uses decision comparison",
  );

  const merged = mergeBriefingImpact(["Outturn colour."], rich);
  assert(merged[0] === rich[0], "legacy merge still puts impact lines first");
  assert(merged.length <= 4, "merged briefing stays short");
  assert(
    merged.includes("Outturn colour."),
    "outturn survives when there is room",
  );

  newGame();
  G = getG();
  G.draft.taxes.vat.rate = (G.law.taxes.vat.rate || 20) + 2;
  const im = impactOf(clone(G.draft), simulate(G.law, 4), 4);
  const liveParts = briefingImpactParts(im, {
    kind: "bill",
    clauses: [{ label: "VAT up", pc: 4 }],
  });
  assert(
    liveParts && liveParts.economic,
    "live VAT rise produces economic impact box",
  );
  assert(
    /growth/i.test(liveParts.economic) &&
      /inflation/i.test(liveParts.economic) &&
      /deficit/i.test(liveParts.economic),
    "live VAT mentions growth, inflation and deficit",
  );
  assert(
    liveParts.approval && /polls/i.test(liveParts.approval),
    "live VAT puts approval in its own box",
  );
  G.briefImpact = liveParts;
  const briefSnap = JSON.stringify(G.econ);
  const E = aggregate(G.law);
  writeBriefing({
    growth: 0.5,
    pg: 0.8,
    E,
    sp: spending(G.law, E, G.econ),
    deficit: 4.5,
  });
  assert(
    JSON.stringify(G.econ) === briefSnap,
    "briefing impact does not mutate econ",
  );

  const brief = briefingData(G.brief, { impact: liveParts });
  assert(
    brief.impact && brief.impact.economic && brief.impact.approval,
    "briefingData carries both impact boxes through",
  );
  assert(
    brief.lines.length > 0,
    "briefingData still carries the outturn lines",
  );
}

/* Partner opening macros match IMF-calibrated NATION_PROFILE (April 2026). */
{
  newGame();
  G = getG();
  assert(
    PARTNERS.length === 27,
    `twenty-seven sovereign partners incl. kingdom (got ${PARTNERS.length})`,
  );
  assert(
    activePartners("home").length === 26,
    "twenty-six partners when playing as United Kingdom",
  );
  assert(
    PARTNERS.some((p) => p.id === "russia"),
    "Russia is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "india"),
    "India is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "nigeria"),
    "Nigeria is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "brazil"),
    "Brazil is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "canada"),
    "Canada is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "korea"),
    "Korea is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "indonesia"),
    "Indonesia is a trade partner",
  );
  assert(
    PARTNERS.some((p) => p.id === "kingdom"),
    "United Kingdom is a displaceable partner seat",
  );
  const homePartners = activePartners("home");
  const named = homePartners.reduce(
    (s, p) => s + partnerShare("home", p.id),
    0,
  );
  assert(
    Math.abs(named + tradeRestShare("home") - 1) < 1e-9,
    `active trade shares + rest sum to 1 (named ${named}, rest ${tradeRestShare("home")})`,
  );
  assert(!!G.econ.nations, "opening econ carries partner nation books");
  assert(G.rel.russia === 24, "Northern Reach opens with frosty relations");
  assert(G.rel.india === 59, "India opens with warmish relations");
  assert(G.rel.nigeria === 46, "Nigeria opens mid-table");
  assert(G.rel.brazil === 50, "Brazil opens mid-table");
  for (const p of homePartners) {
    const prof = NATION_PROFILE[p.id];
    const n = G.econ.nations[p.id];
    assert(!!n && !!prof, `partner ${p.id} has live nation state`);
    assert(
      Math.abs(n.debt - prof.debt0) < 0.01 &&
        Math.abs(n.deficit - prof.deficit0) < 0.01 &&
        Math.abs(n.growth - prof.trend) < 0.01 &&
        Math.abs(n.inflation - prof.inflation0) < 0.01 &&
        Math.abs(n.y - 100) < 0.01,
      `${p.id} opens at profile (debt ${n.debt}, deficit ${n.deficit}, g ${n.growth}, pi ${n.inflation})`,
    );
  }
  assert(
    NATION_PROFILE.united_states.debt0 >= 120,
    "US debt opens above 120% of GDP",
  );
  assert(
    NATION_PROFILE.china.deficit0 >= 6,
    "China fiscal stance is wide (augmented)",
  );
  assert(
    NATION_PROFILE.saudi.deficit0 < 3,
    "Gulf is near fiscal balance, not a large surplus",
  );
  assert(
    NATION_PROFILE.russia.debt0 < 25 && NATION_PROFILE.russia.trend < 2,
    "Northern Reach opens Russia-like (low debt, soft trend growth)",
  );
  assert(
    NATION_PROFILE.india.trend >= 5.5 && NATION_PROFILE.india.debt0 > 70,
    "India opens India-like (fast growth, high debt)",
  );
  assert(
    NATION_PROFILE.nigeria.trend >= 3 && NATION_PROFILE.nigeria.inflation0 >= 5,
    "Nigeria opens Africa-like (growth with sticky inflation)",
  );
  assert(
    NATION_PROFILE.brazil.debt0 > 50 && NATION_PROFILE.brazil.trend < 4,
    "Brazil opens LatAm-like (middling debt, soft growth)",
  );
  assert(
    NATION_PROFILE.australia.trend < 3,
    "Commonwealth without India is slower-growing",
  );
  assert(
    NATION_PROFILE.canada.debt0 >= 90 && NATION_PROFILE.canada.debt0 <= 130,
    "Canada debt mid-high",
  );
  assert(
    NATION_PROFILE.korea.shareX >= 35 && NATION_PROFILE.korea.trend >= 1.5,
    "Korea export-heavy with solid trend",
  );
  assert(
    NATION_PROFILE.indonesia.trend >= 4,
    "Indonesia opens on a fast-growth path",
  );
  assert(
    NATION_PROFILE.argentina.inflation0 >= 15,
    "Argentina opens with high inflation",
  );
  assert(
    NATION_PROFILE.turkey.inflation0 >= 12,
    "Türkiye opens with high inflation",
  );
  assert(NATION_PROFILE.vietnam.trend >= 5, "Vietnam opens fast-growing");
  assert(
    NATION_PROFILE.poland.trend >= 2,
    "Poland opens with solid catch-up growth",
  );
  for (const id in NATION_PROFILE) {
    assert(
      NATION_PROFILE[id].gdp0 > 0,
      `${id} has a positive opening GDP level`,
    );
  }
  assert(
    NATION_PROFILE.united_states.gdp0 > NATION_PROFILE.china.gdp0 &&
      NATION_PROFILE.china.gdp0 > NATION_PROFILE.kingdom.gdp0 &&
      NATION_PROFILE.kingdom.gdp0 > NATION_PROFILE.france.gdp0,
    "opening GDP order: US > China > Kingdom > France",
  );
  assert(
    gdp0ForSeat("home") === NATION_PROFILE.kingdom.gdp0,
    "home seat uses Kingdom GDP level",
  );
  assert(
    fmtGdpBn(3600) === "$3.6tn",
    `fmtGdpBn(3600) is $3.6tn (got ${fmtGdpBn(3600)})`,
  );
  assert(
    fmtGdpBn(33000) === "$33tn",
    `fmtGdpBn(33000) is $33tn (got ${fmtGdpBn(33000)})`,
  );
  newGame();
  G = getG();
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.kingdom.gdp0) < 0.01,
    "home GDP bn tracks opening level at index 100",
  );
  assert(
    Math.abs(
      realmGdpBn("united_states", G) - NATION_PROFILE.united_states.gdp0,
    ) < 0.01,
    "partner GDP bn tracks opening level at index 100",
  );
  const last = G.log[G.log.length - 1];
  const reconstructed =
    gdp0ForSeat(G.homeRole) *
    ((last.gdp != null ? last.gdp : 100) / 100) *
    ((last.fx != null ? last.fx : 100) / 100);
  assert(
    Math.abs(reconstructed - realmGdpBn("home", G)) < 0.01,
    "log gdp×fx reconstructs the same USD GDP the realm card uses",
  );
}

/* Realm-specific openings, Kingdom as partner, settle chart history. */
{
  newGame();
  G = getG();
  assert(
    G.log.length === SETTLE_QUARTERS,
    `opening log is settle history (got ${G.log.length})`,
  );
  assert(
    G.log.every((r) => r.pre),
    "settle rows are marked pre-term",
  );
  assert(
    Math.abs(G.log[G.log.length - 1].debt - G.econ.debt) < 0.05,
    "last settle row debt matches live books",
  );
  const beforeLen = G.log.length;
  step(G, G.law, G.law, true);
  assert(
    G.log.length === beforeLen + 1,
    "first live step appends without wiping history",
  );
  assert(!G.log[G.log.length - 1].pre, "live quarter is not pre-term");

  newGame({
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  assert(
    G.econ.debt === 126,
    `united_states opens at debt 126 (got ${G.econ.debt})`,
  );
  assert(
    Math.abs(G.econ.inflation - 2.4) < 0.01,
    `united_states inflation 2.4 (got ${G.econ.inflation})`,
  );
  {
    const d = -balanceOf(G.law, G.econ).balance;
    assert(
      Math.abs(d - 7.5) < 0.15,
      `united_states deficit near 7.5 (got ${d.toFixed(2)})`,
    );
  }
  assert(
    Math.abs(G.econ.trendGrowth - 2.3) < 1.05,
    `united_states trend near 2.3 (got ${G.econ.trendGrowth})`,
  );
  assert(
    Math.abs(potentialGrowth(G.law, aggregate(G.law), G.econ) - 2.3) < 1.05,
    `united_states live potential near 2.3 (got ${potentialGrowth(G.law, aggregate(G.law), G.econ)})`,
  );
  assert(
    partnerForIso("826", "840", "united_states") === "kingdom",
    "UK coastline is United Kingdom partner when sitting in United States",
  );
  assert(
    partnerForIso("826", "826", "home") === "home",
    "UK coastline is home when sitting as United Kingdom",
  );
  const fedPartners = activePartners("united_states");
  assert(
    fedPartners.some((p) => p.id === "kingdom") &&
      !fedPartners.some((p) => p.id === "united_states"),
    "active partners include kingdom and exclude united_states seat",
  );
  assert(
    !!G.econ.nations.kingdom,
    "kingdom nation books exist when playing elsewhere",
  );
  assert(
    Math.abs(G.econ.nations.kingdom.debt - 94) < 0.01,
    "kingdom partner opens at UK debt",
  );
  assert(!G.law.taxes.vat.on, "United States open without a federal VAT");
  assert(
    G.law.taxes.corpTax.rate === 26,
    "United States open at combined federal+state 26% corporation tax",
  );
  assert(
    G.law.spend.defence === 3.5,
    "United States open with higher defence share",
  );
  assert(
    G.law.vice.cannabis === "legal",
    "United States open with legal cannabis",
  );
  assert(
    !!G.law.policies.planning && !!G.law.policies.dereg,
    "United States open with planning and labour deregulation",
  );
  assert(
    !G.law.taxes.digitalTax.on,
    "United States do not open with a digital services tax",
  );

  newGame({ homeRole: "saudi", homeIso: "682", country: "Gulf Investors" });
  G = getG();
  assert(G.econ.debt === 30, `saudi opens at debt 30 (got ${G.econ.debt})`);
  {
    const d = -balanceOf(G.law, G.econ).balance;
    assert(
      Math.abs(d - 0.5) < 0.15,
      `saudi deficit near 0.5 (got ${d.toFixed(2)})`,
    );
  }
  assert(G.law.income.on === false, "Saudi opens without personal income tax");
  assert(
    G.law.vice.alcohol === "banned",
    "Saudi opens with alcohol prohibition",
  );
  assert(
    !G.law.taxes.alcoholDuty.on,
    "Gulf alcohol duty is off under prohibition",
  );
  assert(!!G.law.policies.swf, "Saudi opens with a sovereign wealth fund");
  assert(G.law.spend.defence === 7.0, "Saudi opens with a high defence share");
  assert(
    G.law.groups.partyPluralism === "banned",
    "Saudi opens with opposition banned",
  );
  assert(
    G.law.groups.parliamentaryPowers === "suppressed",
    "Saudi opens with no standing legislature",
  );
  assert(
    G.parties.seats.national === 100,
    "Saudi chamber is 100 for the Court",
  );

  newGame({ homeRole: "vietnam", homeIso: "704", country: "Vietnam" });
  G = getG();
  assert(
    G.law.groups.partyPluralism === "singleParty",
    "Vietnam opens as a single-party system",
  );
  assert(
    G.law.groups.parliamentaryPowers === "consultative",
    "Vietnam's assembly is consultative",
  );

  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  assert(G.law.taxes.vat.rate === 20, "France opens at 20% VAT");
  assert(G.law.spend.welfare >= 15, "France opens with a large welfare share");
  assert(
    G.law.spend.defence >= 1.5 && G.law.spend.defence <= 2.2,
    "France opens near the NATO defence band",
  );
  assert(
    !!G.law.policies.netZero && !!G.law.policies.cbam,
    "France opens on a net-zero / CBAM footing",
  );
  assert(
    !!G.law.policies.socialCare,
    "France opens with free personal social care",
  );

  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  const adj0 = G.econ.otherRevAdj;
  const yRel0 = G.econ.yRel;
  project(4);
  assert(
    G.econ.otherRevAdj === adj0 && G.econ.yRel === yRel0,
    "project leaves opening plugs / supply intact",
  );
  assert(G.law.spend.infra >= 5, "China opens with heavy infrastructure spend");
  assert(G.law.taxes.vat.rate === 13, "China opens at 13% VAT");
  assert(G.law.spend.research >= 1.3, "China opens with high research spend");
  assert(
    !!G.law.policies.rnd && !!G.law.policies.closeBorders,
    "China opens with industrial strategy and strict borders",
  );
  assert(G.law.vice.gambling === "banned", "China opens with gambling banned");
  assert(
    G.law.groups.partyPluralism === "singleParty",
    "China opens as a single-party system",
  );
  assert(
    G.law.groups.parliamentaryPowers === "consultative",
    "China's assembly is consultative, not a sovereign parliament",
  );
  assert(
    G.parties.seats.national === 100,
    "China chamber is the Communist Party alone",
  );
  assert(
    !chamberBlocksDeliver(),
    "China's consultative assembly cannot block Deliver",
  );
  /* pinOpeningHeadlines must keep the seat's income schedule, not UK defaults. */
  assert(
    G.law.income.allowance === 8000,
    "Eastern income allowance survives settle pins",
  );
  assert(G.law.ni.erRate === 16, "Eastern employer NI survives settle pins");
  assert(
    G.econ.trendBias == null || G.econ.trendBias === 0,
    "no residual trendBias on Eastern open",
  );
  {
    const cap0 = G.capital;
    const outlook = capitalOutlook(0);
    assert(
      outlook && outlook.fiscalRuleHit === 3,
      "China fiscal rule is in the capital preview",
    );
    assert(
      outlook.nextQuarter < cap0 + outlook.gain - 0.5,
      "China next-turn capital nets the fiscal-rule dock, not just popularity regen",
    );
    step(G, G.law, G.law, true);
    assert(
      Math.abs(G.capital - outlook.nextQuarter) < 1.5,
      "China capital after a quiet quarter matches the preview (got " +
        G.capital.toFixed(2) +
        " vs " +
        outlook.nextQuarter.toFixed(2) +
        ")",
    );
  }

  newGame({ homeRole: "russia", homeIso: "643", country: "Northern Reach" });
  G = getG();
  assert(
    G.law.spend.defence >= 4.5,
    "Northern Reach opens with elevated defence",
  );
  assert(
    isDualCapital(G.law),
    "Northern Reach opens on a dual income-tax system",
  );
  assert(
    !!G.law.taxes.windfall.on,
    "Northern Reach opens with an energy windfall levy",
  );
  assert(
    G.law.vice.alcohol === "liberal",
    "Northern Reach opens with liberalised alcohol",
  );
  assert(!!G.law.policies.conscript, "Northern Reach opens with conscription");
  assert(
    !G.law.policies.closeBorders,
    "Northern Reach does not open with migration caps (brain drain is in migBase)",
  );

  newGame({ homeRole: "india", homeIso: "356", country: "India" });
  G = getG();
  assert(G.law.taxes.vat.rate === 18, "India opens at GST-like 18% VAT");
  assert(
    G.law.spend.health <= 3.0,
    "India opens with thin public health spend",
  );
  assert(
    G.law.taxes.tobaccoDuty.rate >= 70,
    "India opens with heavy tobacco duty",
  );
  assert(G.law.vice.gambling === "banned", "India opens with gambling banned");
  assert(!!G.law.policies.digitalId, "India opens with digital identity");

  newGame({
    homeRole: "nigeria",
    homeIso: "566",
    country: "Green Coast Republic",
  });
  G = getG();
  assert(G.law.spend.welfare <= 4.5, "Nigeria opens with a thin welfare state");
  assert(G.law.tariff >= 9, "Nigeria opens with higher tariffs");
  assert(!!G.law.taxes.touristLevy.on, "Nigeria opens with a visitor levy");
  assert(
    !!G.law.taxes.windfall.on,
    "Nigeria opens with a commodity windfall levy",
  );
  assert(!G.law.taxes.carbon.on, "Nigeria does not open with a carbon price");

  newGame({
    homeRole: "brazil",
    homeIso: "076",
    country: "Atlantic Federation",
  });
  G = getG();
  assert(G.law.taxes.vat.rate >= 17, "Brazil opens VAT-heavy");
  assert(G.law.spend.welfare >= 12, "Brazil opens pension-heavy");
  assert(
    G.law.vice.cannabis === "decrim",
    "Brazil opens with cannabis decriminalised",
  );
  assert(
    !G.law.taxes.cannabisDuty.on,
    "Brazil cannabis duty is off under decrim",
  );
  assert(
    !!G.law.policies.socialHousing,
    "Brazil opens with mass social housebuilding",
  );

  newGame({ homeRole: "australia", homeIso: "036", country: "Southern Cross" });
  G = getG();
  assert(G.law.taxes.vat.rate === 10, "Australia opens at 10% GST");
  assert(
    G.law.taxes.corpTax.rate === 30,
    "Australia opens at 30% corporation tax",
  );
  assert(!G.law.taxes.inherit.on, "Australia opens without inheritance tax");
  assert(
    !G.law.ni.empOn && G.law.ni.erOn,
    "Australia opens with employer-only payroll tax",
  );
  assert(
    !!G.law.policies.netZero && !!G.law.policies.openVisas,
    "Australia opens with net zero and open visas",
  );

  /* Home seat keeps the UK baseLaw (no REALM_LAW overlay). */
  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  assert(
    G.law.taxes.vat.on && G.law.taxes.vat.rate === 20,
    "UK opens at UK 20% VAT",
  );
  assert(G.law.spend.welfare === 13.3, "UK opens at UK welfare share");
  assert(G.law.income.allowance === 12570, "UK opens at UK personal allowance");

  /* Every non-Kingdom sovereign seat has a distinct statute overlay. */
  {
    const uk = baseLaw();
    for (const c of COUNTRIES) {
      if (c.id === "kingdom") continue;
      const key = realmLawKey(c.id);
      assert(
        !!REALM_LAW[key],
        `${c.id} resolves a REALM_LAW overlay (key ${key})`,
      );
      const law = lawForRole(c.id);
      const distinct =
        law.taxes.vat.rate !== uk.taxes.vat.rate ||
        law.taxes.vat.on !== uk.taxes.vat.on ||
        law.taxes.corpTax.rate !== uk.taxes.corpTax.rate ||
        law.spend.welfare !== uk.spend.welfare ||
        (law.income.on === false) !== (uk.income.on === false);
      assert(distinct, `${c.id} statute differs from UK baseLaw`);
    }
  }

  {
    const offices = [
      ["home", "Prime Minister"],
      ["germany", "Chancellor"],
      ["france", "President"],
      ["united_states", "President"],
      ["korea", "President"],
      ["brazil", "President"],
      ["mexico", "President"],
      ["china", "General Secretary"],
      ["vietnam", "General Secretary"],
      ["saudi", "Monarch"],
      ["uae", "Monarch"],
      ["russia", "President"],
      ["egypt", "President"],
      ["turkey", "President"],
      ["south_africa", "President"],
      ["kenya", "President"],
      ["italy", "Prime Minister"],
      ["japan", "Prime Minister"],
      ["india", "Prime Minister"],
      ["canada", "Prime Minister"],
    ];
    for (const [role, title] of offices) {
      const got = leaderTitle(lawForRole(role), undefined, role);
      assert(got === title, `${role} office is ${title} (got ${got})`);
    }
  }

  newGame({ homeRole: "germany", homeIso: "276", country: "Germany" });
  G = getG();
  assert(
    G.law.taxes.vat.rate >= 19 && G.law.taxes.vat.rate <= 21,
    `Germany opens near 19–21% VAT (got ${G.law.taxes.vat.rate})`,
  );
  assert(
    G.law.spend.research >= 1.0,
    "Germany opens with elevated research spend",
  );

  newGame({ homeRole: "japan", homeIso: "392", country: "Japan" });
  G = getG();
  assert(G.law.taxes.vat.rate === 10, "Japan opens at 10% consumption tax");

  newGame({ homeRole: "uae", homeIso: "784", country: "Emirates League" });
  G = getG();
  assert(G.law.taxes.vat.rate === 5, "UAE opens at 5% VAT");
  assert(G.law.income.on === false, "UAE opens with personal income tax off");
  assert(!G.law.ni.empOn && !G.law.ni.erOn, "UAE opens without NI");

  newGame({ homeRole: "mexico", homeIso: "484", country: "Sunrise Republic" });
  G = getG();
  assert(G.law.taxes.vat.rate === 16, "Mexico opens at 16% VAT");
  assert(G.law.taxes.vat.rate !== 20, "Mexico VAT is not the UK rate");
}

/* Society layer opens from NATION_PROFILE.soc0, not a shared UK default. */
{
  const uk = NATION_PROFILE.kingdom.soc0;
  assert(
    uk && uk.liberty === 58 && uk.crime === 28 && uk.services === 55,
    "UK soc0 is the UK baseline",
  );

  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  assert(
    Math.abs(G.econ.liberty - 58) < 0.6,
    `UK liberty near 58 (got ${G.econ.liberty})`,
  );
  assert(
    Math.abs(G.econ.crime - 28) < 0.6,
    `UK crime near 28 (got ${G.econ.crime})`,
  );
  assert(
    Math.abs(G.econ.services - 55) < 2.5,
    `UK services near 55 (got ${G.econ.services})`,
  );

  for (const c of COUNTRIES) {
    if (c.id === "kingdom") continue;
    const soc = NATION_PROFILE[c.id] && NATION_PROFILE[c.id].soc0;
    assert(!!soc, `${c.id} has a soc0 society pin`);
    const distinct =
      soc.services !== uk.services ||
      soc.liberty !== uk.liberty ||
      soc.crime !== uk.crime ||
      soc.health !== uk.health ||
      soc.env !== uk.env ||
      soc.openness !== uk.openness ||
      soc.gini !== uk.gini;
    assert(distinct, `${c.id} soc0 differs from Kingdom`);
  }

  newGame({ homeRole: "germany", homeIso: "276", country: "Germany" });
  G = getG();
  assert(G.econ.liberty0 === 62, "Germany liberty0 is 62");
  assert(
    Math.abs(G.econ.liberty - 62) < 1.0,
    `Germany liberty near 62 (got ${G.econ.liberty})`,
  );
  assert(G.econ.crime0 === 22, "Germany crime0 is 22");
  assert(
    Math.abs(G.econ.crime - 22) < 1.5,
    `Germany crime near 22 (got ${G.econ.crime})`,
  );

  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  assert(G.econ.liberty0 === 18, "China liberty0 is 18");
  assert(
    G.econ.liberty < 30,
    `China liberty well below UK (got ${G.econ.liberty})`,
  );
  assert(G.econ.openness0 === 35, "China openness0 is 35");

  newGame({ homeRole: "japan", homeIso: "392", country: "Japan" });
  G = getG();
  assert(G.econ.crime0 === 12, "Japan crime0 is 12");
  assert(G.econ.crime < 20, `Japan crime well below UK (got ${G.econ.crime})`);
  assert(G.econ.services0 === 68, "Japan services0 is 68");

  newGame({
    homeRole: "netherlands",
    homeIso: "528",
    country: "Low Countries",
  });
  G = getG();
  assert(G.econ.liberty0 === 72, "Netherlands liberty0 is 72");
  assert(G.econ.openness0 === 68, "Netherlands openness0 is 68");
  /* Anchors hold through early quarters rather than crawling back to UK. */
  for (let i = 0; i < 8; i++) step(G, G.law, G.law, true);
  assert(
    G.econ.liberty > 65,
    `Netherlands liberty stays elevated after 8Q (got ${G.econ.liberty})`,
  );
  assert(
    G.econ.openness > 60,
    `Netherlands openness stays elevated after 8Q (got ${G.econ.openness})`,
  );

  /* Opening-delta anchoring: unchanged statute holds near soc0; removing a
     liberty-negative opening policy raises liberty (policy content still bites). */
  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  assert(!!G.econ.socOpen, "China settle stores socOpen opening impulses");
  for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.liberty - 18) < 4,
    `China liberty holds near soc0 under unchanged law (got ${G.econ.liberty})`,
  );
  assert(
    Math.abs(G.econ.crime - 24) < 8,
    `China crime holds near soc0 under unchanged law (got ${G.econ.crime})`,
  );
  const libBefore = G.econ.liberty;
  assert(G.law.policies.digitalId, "China opens with digital identity");
  G.law.policies.digitalId = false;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  assert(
    G.econ.liberty > libBefore + 3,
    `Repealing digitalId raises China liberty (${libBefore.toFixed(1)} → ${G.econ.liberty.toFixed(1)})`,
  );
}

/* Polity types: term clocks, liberty pins, capital regen, elite coups. */
{
  const expect = {
    kingdom: "democracy",
    china: "authoritarian",
    russia: "authoritarian",
    vietnam: "authoritarian",
    egypt: "authoritarian",
    saudi: "authoritarian",
    uae: "authoritarian",
    turkey: "hybrid",
  };
  for (const id of Object.keys(NATION_PROFILE)) {
    const p = NATION_PROFILE[id].polity;
    assert(!!p && POLITY_IDS.includes(p), `${id} has a valid polity (${p})`);
  }
  for (const [id, kind] of Object.entries(expect)) {
    assert(
      polityIdOf(id === "kingdom" ? "home" : id) === kind,
      `${id} polity is ${kind}`,
    );
  }
  assert(termLenOf("home") === 20, "Kingdom termLen is 20");
  assert(termLenOf("china") === 40, "China termLen is 40");
  assert(termLenOf("saudi") === 40, "Saudi termLen is 40");
  assert(polityOf("china").capitalRegen === 0.55, "China capitalRegen is 0.55");
  assert(polityOf("home").capitalRegen === 1, "Kingdom capitalRegen is 1");

  newGame({
    sandbox: true,
    homeRole: "china",
    homeIso: "156",
    country: "Eastern Republic",
  });
  G = getG();
  G.q = 20;
  assert(!termReviewDue(), "China is not due a term review at q=20");
  G.q = 40;
  assert(termReviewDue(), "China is due a congress at q=40");
  const termBefore = G.term;
  termReview();
  assert(G.term === termBefore + 1, "China congress advances the term");
  assert(!G.over, "China sandbox congress does not end the run");

  newGame({
    sandbox: true,
    homeRole: "home",
    homeIso: "826",
    country: "The Kingdom",
  });
  G = getG();
  G.q = 20;
  assert(termReviewDue(), "Kingdom is due an election at q=20");
  const kt = G.term;
  termReview();
  assert(G.term === kt + 1, "Kingdom election advances the term");
  assert(G.termStartQ === 20, "scheduled election resets the term clock");

  newGame({ sandbox: true, silent: true });
  G = getG();
  assert(
    G.law.groups.electionCalendar === "flexible",
    "Kingdom opens with dissolution allowed",
  );
  assert(
    !!earlyElectionBlocker(),
    "cannot call a snap election on day one (" + earlyElectionBlocker() + ")",
  );
  G.q = EARLY_ELECTION_MIN_Q;
  assert(canCallEarlyElection(), "Kingdom may dissolve after a year");
  const snapTerm = G.term;
  const seatsBefore = { ...G.parties.seats };
  termReview();
  assert(G.term === snapTerm + 1, "early election advances the term");
  assert(
    G.termStartQ === EARLY_ELECTION_MIN_Q,
    "snap election resets the clock from today",
  );
  assert(!termReviewDue(), "snap election is not immediately due again");
  G.q = 20;
  assert(
    !termReviewDue(),
    "old q=20 date is no longer an election after a snap at q=4",
  );
  G.q = EARLY_ELECTION_MIN_Q + 20;
  assert(termReviewDue(), "next election is a full term after the snap");
  assert(
    JSON.stringify(G.parties.seats) !== JSON.stringify(seatsBefore) ||
      G.parties.seats[G.parties.rulingId] > 0,
    "early election reallocates or keeps a seated government",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  G.q = EARLY_ELECTION_MIN_Q;
  assert(
    G.law.groups.electionCalendar === "fixed",
    "United States opens with fixed terms",
  );
  assert(
    /fixed calendar/.test(earlyElectionBlocker() || ""),
    "US cannot call an early presidential term (" +
      earlyElectionBlocker() +
      ")",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "china",
    homeIso: "156",
    country: "Eastern Republic",
  });
  G = getG();
  G.q = EARLY_ELECTION_MIN_Q;
  assert(
    /congress/.test(earlyElectionBlocker() || ""),
    "China cannot call an early congress (" + earlyElectionBlocker() + ")",
  );

  /* Capital regen: same approval, China ~55% of Kingdom gain (no fiscal-rule hit). */
  function capitalGain(role, iso, name) {
    newGame({ sandbox: true, homeRole: role, homeIso: iso, country: name });
    G = getG();
    G.law.policies.fiscalRule = false;
    G.draft.policies.fiscalRule = false;
    for (const f of FACTIONS) G.fac[f.id] = 50;
    G.capital = 40;
    const before = G.capital;
    step(G, G.law, G.law, true);
    return G.capital - before;
  }
  const kg = capitalGain("home", "826", "The Kingdom");
  const cg = capitalGain("china", "156", "Eastern Republic");
  assert(
    kg > 0 && cg > 0,
    `capital gains positive (kingdom ${kg.toFixed(2)}, china ${cg.toFixed(2)})`,
  );
  assert(
    Math.abs(cg / kg - 0.55) < 0.08,
    `China capital gain ~55% of Kingdom (got ${(cg / kg).toFixed(3)})`,
  );

  /* An overspent Programme still floors the payment at 0, then applies regen —
     Next turn is not clamped to 0 before popularity. */
  {
    newGame({ sandbox: true, silent: true });
    G = getG();
    G.capital = 20;
    G.envoys = [];
    const over = capitalOutlook(G.capital + 25);
    assert(over.afterBill === 0, "overspent bill floors payment at 0");
    const fromZero = Math.max(
      0,
      Math.min(100, over.gain - over.envoyUpkeep - over.fiscalRuleHit),
    );
    assert(
      over.nextQuarter === fromZero,
      "overspent next-turn is regen from a zeroed balance (got " +
        over.nextQuarter +
        " vs " +
        fromZero +
        ")",
    );
  }

  /* Elite coup: three quarters of low patriots ends China Career. */
  newGame({
    sandbox: false,
    homeRole: "china",
    homeIso: "156",
    country: "Eastern Republic",
  });
  G = getG();
  G.sandbox = false;
  for (const f of FACTIONS) G.fac[f.id] = 50;
  G.fac.patriots = 20;
  G.lowRun = 0;
  checkCrises({});
  assert(G.lowRun === 1 && !G.over, "China coup clock starts on low patriots");
  checkCrises({});
  checkCrises({});
  assert(G.over, "China Career ends after three low-patriot quarters");

  newGame({
    sandbox: false,
    homeRole: "home",
    homeIso: "826",
    country: "The Kingdom",
  });
  G = getG();
  G.sandbox = false;
  for (const f of FACTIONS) G.fac[f.id] = 50;
  G.lowRun = 0;
  checkCrises({});
  assert(
    G.lowRun === 0 && !G.over,
    "Kingdom at 50% approval does not tick the coup clock",
  );
  for (const f of FACTIONS) G.fac[f.id] = 15;
  checkCrises({});
  checkCrises({});
  checkCrises({});
  assert(
    !G.over && G.lowRun === 3,
    "Kingdom still needs a fourth low-approval quarter",
  );
  checkCrises({});
  assert(G.over, "Kingdom Career ends after four low-approval quarters");

  /* newGovt flavour for authoritarian focus has no "election". */
  newGame({
    sandbox: true,
    homeRole: "home",
    homeIso: "826",
    country: "The Kingdom",
  });
  G = getG();
  const newGovt = EVENTS.find((e) => e.id === "newGovt");
  G.eventFocus = "china";
  const chinaText =
    typeof newGovt.text === "function" ? newGovt.text() : newGovt.text;
  assert(
    !/election/i.test(chinaText),
    "China newGovt text does not say election",
  );
  assert(
    /reshuffle|leadership/i.test(chinaText),
    "China newGovt mentions leadership reshuffle",
  );
  G.eventFocus = "saudi";
  const saudiText =
    typeof newGovt.text === "function" ? newGovt.text() : newGovt.text;
  assert(
    !/election/i.test(saudiText),
    "Saudi newGovt text does not say election",
  );
  assert(
    /reshuffle|leadership/i.test(saudiText),
    "Saudi newGovt mentions leadership reshuffle",
  );
  G.eventFocus = "germany";
  const demText =
    typeof newGovt.text === "function" ? newGovt.text() : newGovt.text;
  assert(
    /election/i.test(demText),
    "Democratic newGovt text still says election",
  );
  const prepared = prepareEvent(
    Object.assign({}, newGovt, {
      resolve: () => ({ focus: "china" }),
    }),
  );
  assert(
    prepared && !/election/i.test(prepared.text),
    "prepareEvent resolves China newGovt without election",
  );
  assert(
    prepared && /reshuffle|leadership/i.test(prepared.title),
    "prepareEvent China title is a reshuffle",
  );
}

/* Polity change (Society), affinity, and bill shocks. */
{
  assert(MUTABLE.includes("polityShift"), "polityShift is on MUTABLE");

  newGame({
    sandbox: true,
    homeRole: "home",
    homeIso: "826",
    country: "The Kingdom",
  });
  G = getG();
  assert(G.law.polity === "democracy", "Kingdom law.polity is democracy");
  assert(
    polityReachable("democracy").join(",") === "democracy,hybrid,authoritarian",
    "all three polities are reachable",
  );
  assert(
    polityCanReach("democracy", "authoritarian"),
    "democracy can leap to authoritarian",
  );
  assert(
    POLITY_IDS.includes("monarchy") === false,
    "monarchy is not a live polity type",
  );
  assert(
    polityChangePc("democracy", "hybrid") === POLITY.hybrid.changePc,
    "adjacent hybrid costs changePc",
  );
  assert(
    polityChangePc("democracy", "authoritarian") ===
      POLITY.authoritarian.changePc + POLITY_LEAP_EXTRA,
    "democracy→authoritarian leap costs changePc + leap extra",
  );
  assert(
    polityChangePc("authoritarian", "democracy") ===
      POLITY.democracy.changePc + POLITY_LEAP_EXTRA,
    "authoritarian→democracy leap costs changePc + leap extra",
  );

  G.draft.polity = "authoritarian";
  let cl = billClauses();
  const leapCl = cl.find((c) => /political system/.test(c.label));
  assert(!!leapCl, "leap polity change is a bill clause");
  assert(
    leapCl.pc === POLITY.authoritarian.changePc + POLITY_LEAP_EXTRA,
    "leap clause uses leap PC",
  );
  assert(clausesIn("laws", cl), "polity clause counts toward Laws");

  G.draft.polity = "hybrid";
  cl = billClauses();
  const polityCl = cl.find((c) => /political system/.test(c.label));
  assert(!!polityCl, "adjacent polity change is a bill clause");
  assert(
    polityCl.pc === POLITY.hybrid.changePc,
    "hybrid polity change costs changePc",
  );

  const libShock = polityShockFac("authoritarian", "hybrid");
  assert(
    libShock.urban === 8 && libShock.patriots === -10,
    "liberalising shock lifts urban and hits patriots",
  );
  const tightShock = polityShockFac("democracy", "hybrid");
  assert(
    tightShock.patriots === 8 && tightShock.urban === -10,
    "tightening shock lifts patriots and hits urban",
  );

  const prev = clone(G.law);
  const next = clone(G.law);
  next.polity = "hybrid";
  const shock = billShock(next, prev);
  assert(
    shock.urban === -10 && shock.patriots === 8,
    "billShock applies tightening polity hits",
  );

  assert(
    polityAffinity("authoritarian", "authoritarian") === 1,
    "same polity affinity is 1",
  );
  assert(
    polityAffinity("authoritarian", "democracy") === -0.7,
    "democracy↔authoritarian affinity is −0.7",
  );
  const chinaRussia =
    REL_POLITY * polityAffinity("authoritarian", profilePolityId("russia"));
  const chinaNl =
    REL_POLITY *
    polityAffinity("authoritarian", profilePolityId("netherlands"));
  assert(
    chinaRussia > chinaNl + 5,
    `China–Russia affinity target exceeds China–Netherlands (${chinaRussia} vs ${chinaNl})`,
  );

  G.capital = 80;
  G.draft.polity = "hybrid";
  G.prevLaw = clone(G.law);
  const from = G.law.polity;
  G.law = clone(G.draft);
  G.polityShift = { from, to: "hybrid", q: G.q };
  assert(
    G.polityShift.to === "hybrid",
    "polityShift records the enacted change",
  );
  assert(
    EVENTS.some((e) => e.id === "polityBacklash"),
    "polityBacklash event exists",
  );
  assert(
    EVENTS.some((e) => e.id === "polityConsolidation"),
    "polityConsolidation event exists",
  );
  assert(
    EVENTS.some((e) => e.id === "polityRecognition"),
    "polityRecognition event exists",
  );
}

/* Live potential growth tracks NATION_PROFILE.trend bands for every playable
   seat (derived from demography + yRel catch-up — not pinned tfpTrend). */
{
  const seats = [
    {
      role: "home",
      trend: 1.2,
      opts: { homeRole: "home", homeIso: "826", country: "United Kingdom" },
    },
    ...[
      ["france", "250"],
      ["united_states", "840"],
      ["china", "156"],
      ["russia", "643"],
      ["india", "356"],
      ["nigeria", "566"],
      ["brazil", "076"],
      ["australia", "036"],
      ["saudi", "682"],
      ["canada", "124"],
      ["korea", "410"],
      ["indonesia", "360"],
      ["argentina", "032"],
      ["poland", "616"],
    ].map(([role, iso]) => ({
      role,
      trend: NATION_PROFILE[role].trend,
      opts: { homeRole: role, homeIso: iso, country: role },
    })),
  ];
  for (const s of seats) {
    newGame(s.opts);
    G = getG();
    const pot = potentialGrowth(G.law, aggregate(G.law), G.econ);
    assert(
      Math.abs(pot - s.trend) < 1.05,
      `${s.role} live potential near ${s.trend} (got ${pot.toFixed(2)})`,
    );
    assert(
      G.econ.yRel != null && G.econ.birthRate != null && G.econ.migBase != null,
      `${s.role} carries structural demography / relative-income fields`,
    );
    assert(
      G.econ.tfpTrend == null && G.econ.labourTrend == null,
      `${s.role} has no hard-coded tfpTrend / labourTrend`,
    );
    assert(
      G.econ.trendBias == null || G.econ.trendBias === 0,
      `${s.role} has no residual trendBias`,
    );
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      step(G, G.law, G.law, true);
      sum += G.econ.trendGrowth;
    }
    const mean = sum / 20;
    assert(
      Math.abs(mean - s.trend) < 1.25,
      `${s.role} mean 20Q trend near ${s.trend} (got ${mean.toFixed(2)})`,
    );
  }
  /* High-CPI seats open with a Taylor-consistent Bank rate, not UK 3.75%. */
  newGame({
    homeRole: "nigeria",
    homeIso: "566",
    country: "Green Coast Republic",
  });
  G = getG();
  assert(
    G.econ.rate > 8,
    `Nigeria opens with a high Bank rate (got ${G.econ.rate})`,
  );
  newGame({ homeRole: "russia", homeIso: "643", country: "Northern Reach" });
  G = getG();
  assert(
    G.econ.rate > 6,
    `Northern Reach opens with a high Bank rate (got ${G.econ.rate})`,
  );
}

/* Multi-seat authenticity: trade matrix, demography, labour, rel/deals, openness, FX, fac. */
{
  assert(
    Math.abs(tradeRestShare("home") - 0.04) < 0.005,
    `UK rest-of-world share near 4% (got ${tradeRestShare("home")})`,
  );
  assert(
    Math.abs(tradeRestShare("france") - 0.04) < 0.02,
    `Continental rest-of-world near 4% not ~45% (got ${tradeRestShare("france")})`,
  );
  assert(
    partnerShare("united_states", "china") > partnerShare("home", "china"),
    "US→China trade weight exceeds UK→China",
  );
  assert(
    partnerShare("home", "united_states") > partnerShare("home", "germany") &&
      partnerShare("home", "germany") > partnerShare("home", "china") &&
      partnerShare("home", "china") < 0.07,
    "UK export weights rank US > Germany > China, with China near the real ~5%",
  );

  newGame();
  G = getG();
  const openingTrade = snapshotPartnerTrade(G);
  assert(
    openingTrade.united_states.X > openingTrade.germany.X &&
      openingTrade.germany.X > openingTrade.china.X,
    "opening UK exports rank US > Germany > China",
  );
  assert(
    openingTrade.china.M > openingTrade.china.X,
    "opening UK runs a deficit with China",
  );
  assert(
    openingTrade.germany.M > openingTrade.germany.X,
    "opening UK runs a deficit with Germany",
  );
  assert(
    openingTrade.united_states.X > openingTrade.united_states.M,
    "opening UK runs a surplus with the United States",
  );

  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  const ceuDeals = dealsForPartner(partnerById("france"), "france");
  assert(
    ceuDeals.length === 0,
    "Continental home sees no CEU accession deals on Continental",
  );
  assert(
    G.rel.russia != null && G.rel.russia < 40,
    "Continental opens frosty with Northern Reach",
  );
  assert(
    G.econ.dependency > 0.32,
    `Continental opens with older dependency (got ${G.econ.dependency})`,
  );
  assert(
    Math.abs(G.econ.unemployment - NATION_PROFILE.france.unemployment0) < 0.05,
    `Continental opens at unemployment ${NATION_PROFILE.france.unemployment0} (got ${G.econ.unemployment})`,
  );
  assert(
    G.econ.shareX >= 35,
    `Continental opens trade-open (shareX ${G.econ.shareX})`,
  );

  newGame({ homeRole: "india", homeIso: "356", country: "India" });
  G = getG();
  assert(
    G.econ.dependency < 0.26,
    `India opens young (dep ${G.econ.dependency})`,
  );
  assert(
    G.econ.popChild > 35,
    `India opens with a large child stock (got ${G.econ.popChild})`,
  );
  assert(
    Math.abs(G.econ.unemployment - NATION_PROFILE.india.unemployment0) < 0.05,
    "India unemployment matches profile",
  );
  assert(
    Math.abs(G.econ.nairu - NATION_PROFILE.india.nairu0) < 0.05,
    "India NAIRU matches profile",
  );

  newGame({
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  assert(
    G.econ.shareX <= 16,
    `United States open less trade-intensive (shareX ${G.econ.shareX})`,
  );
  assert(
    G.econ.fxUip < 0.02,
    `United States damp FX UIP (got ${G.econ.fxUip})`,
  );
  assert(
    G.econ.worldRate >= 3.0,
    `US worldRate near domestic (got ${G.econ.worldRate})`,
  );
  assert(G.rel.china < 40, `US opens cool with China (got ${G.rel.china})`);
  assert(!!G.law.deals.cw_fta, "US opens with Commonwealth FTA ratified");
  assert(
    G.fac.business > FAC_0.business,
    "US opens with higher business approval",
  );

  newGame({ homeRole: "saudi", homeIso: "682", country: "Saudi Arabia" });
  G = getG();
  assert(
    G.fac.patriots > FAC_0.patriots,
    "Saudi opens with higher patriot approval",
  );
  assert(
    G.econ.shareX >= 38,
    `Saudi opens export-heavy (shareX ${G.econ.shareX})`,
  );

  newGame({ homeRole: "australia", homeIso: "036", country: "CW" });
  G = getG();
  assert(
    !!G.law.deals.king_services,
    "Australia opens with UK services access",
  );
}

/* Knowledge stock R: research spend accumulates; education still lifts potential via h. */
{
  assert(
    DEPTS.some((d) => d.id === "research"),
    "research is a budget department",
  );
  newGame();
  G = getG();
  assert(
    Math.abs(G.econ.R - R0) < 0.01,
    `opening knowledge stock near R0 (got ${G.econ.R}, want ${R0})`,
  );
  assert(
    Math.abs(knowledgeTfp(G.econ)) < 1e-9,
    "knowledge TFP contribution is zero at R0",
  );
  assert(
    Math.abs(researchEffort(G.law, aggregate(G.law)) - 0.7) < 1e-9,
    "baseline research effort equals the research budget",
  );

  const base = simulate(G.law, 20);
  const hiLaw = clone(G.law);
  hiLaw.spend.research = 1.8;
  const hi = simulate(hiLaw, 20);
  assert(
    hi.end.econ.R > base.end.econ.R + 1,
    `higher research spend raises R over 20Q (${base.end.econ.R.toFixed(2)} → ${hi.end.econ.R.toFixed(2)})`,
  );
  assert(
    hi.end.econ.potential > base.end.econ.potential,
    `higher research raises potential (${base.end.econ.potential.toFixed(2)} → ${hi.end.econ.potential.toFixed(2)})`,
  );

  const cutLaw = clone(G.law);
  cutLaw.spend.research = 0;
  const cut = simulate(cutLaw, 8);
  const R8 = cut.end.econ.R;
  assert(
    R8 < R0 && R8 > R0 * 0.7,
    `cutting research decays R slowly, not a cliff (${R0.toFixed(2)} → ${R8.toFixed(2)} in 8Q)`,
  );

  /* The knowledge term is research *intensity*, so it must not grow with the
     sheer size of the economy. It used to: R accumulates as a share of GDP but
     was scored against a fixed R0, so a bigger economy scored a bigger TFP
     bonus, trend accelerated without bound, and an AI seat's GDP overflowed to
     NaN around Q400. Doubling the whole economy (potential and the stock that
     the same research share would have built at that size) must leave the
     contribution unchanged. */
  newGame();
  G = getG();
  const scaled = Object.assign({}, G.econ, {
    R: G.econ.R * 2,
    potential: G.econ.potential * 2,
    gdp: G.econ.gdp * 2,
  });
  assert(
    Math.abs(knowledgeTfp(scaled) - knowledgeTfp(G.econ)) < 1e-9,
    `knowledge TFP is scale-free (base ${knowledgeTfp(G.econ)}, 2x economy ${knowledgeTfp(scaled)})`,
  );
  /* Same research share in an economy ten times the size, same contribution. */
  const bigger = Object.assign({}, G.econ, {
    R: G.econ.R * 10,
    potential: G.econ.potential * 10,
    gdp: G.econ.gdp * 10,
  });
  assert(
    Math.abs(knowledgeTfp(bigger)) < 1e-9,
    `a 10x economy at baseline research intensity still contributes zero (got ${knowledgeTfp(bigger)})`,
  );
  /* Intensity, not level: more R at unchanged size still helps. */
  const denser = Object.assign({}, G.econ, { R: G.econ.R * 1.5 });
  assert(
    knowledgeTfp(denser) > 1e-6,
    `raising research intensity at constant size still lifts TFP (got ${knowledgeTfp(denser)})`,
  );
}

/* ---- Long-horizon stability ----
   The calibrated checks above run 20 quarters and scripts/balance-30y.mjs runs
   120; real saves reach 600+. Nothing used to watch that far out, which is how
   an unbounded TFP scale effect survived: it was invisible at 30 years and
   fatal at 100. This walks the default law well past the old failure point and
   asserts the path stays finite and inside plausible bands, with no clamp
   propping it up. */
{
  newGame();
  G = getG();
  const law = G.law;
  const QUARTERS = 600;
  const WATCH = [
    "gdp",
    "potential",
    "A",
    "K",
    "KG",
    "R",
    "I",
    "C",
    "X",
    "M",
    "L",
    "inflation",
    "unemployment",
    "debt",
    "rate",
    "yield",
    "wageIndex",
    "worldY",
  ];
  let worstTrend = 0;
  let worstGrowth = 0;
  let firstBad = null;
  for (let q = 1; q <= QUARTERS; q++) {
    const r = step(G, law, law, true);
    const e = G.econ;
    if (!firstBad) {
      const bad = WATCH.filter((k) => e[k] != null && !Number.isFinite(e[k]));
      if (bad.length) firstBad = { q, bad };
    }
    if (Number.isFinite(r.growth))
      worstGrowth = Math.max(worstGrowth, Math.abs(r.growth));
    if (Number.isFinite(e.trendGrowth))
      worstTrend = Math.max(worstTrend, Math.abs(e.trendGrowth));
  }
  assert(
    !firstBad,
    `every tracked field stays finite over ${QUARTERS}Q` +
      (firstBad
        ? ` (${firstBad.bad.join(", ")} went bad at Q${firstBad.q})`
        : ""),
  );
  assert(
    worstTrend < 6,
    `trend growth stays plausible over ${QUARTERS}Q without a clamp (peak ${worstTrend.toFixed(2)})`,
  );
  assert(
    worstGrowth < 15,
    `headline growth stays plausible over ${QUARTERS}Q without a clamp (peak ${worstGrowth.toFixed(2)})`,
  );
  assert(
    G.econ.gdp > 100 && G.econ.gdp < 20000,
    `${QUARTERS}Q of compounding lands in a sane range (got ${G.econ.gdp.toFixed(0)})`,
  );

  newGame();
  G = getG();
  const edu0 = potentialLevel(G.law, aggregate(G.law), G.econ);
  const eduLaw = clone(G.law);
  eduLaw.spend.education = 6.0;
  eduLaw.spend.research = G.law.spend.research;
  const edu1 = potentialLevel(eduLaw, aggregate(eduLaw), G.econ);
  assert(
    edu1 > edu0,
    `education spend lifts potential via human capital with research fixed (${edu0.toFixed(3)} → ${edu1.toFixed(3)})`,
  );

  newGame();
  G = getG();
  const rndLaw = clone(G.law);
  rndLaw.policies = Object.assign({}, rndLaw.policies, { rnd: true });
  const E_rnd = aggregate(rndLaw);
  assert(
    E_rnd.rndEffort > 0 && Math.abs(E_rnd.tfp) < 1e-9,
    `research credits add rndEffort (${E_rnd.rndEffort}) without a flat tfp bump (${E_rnd.tfp})`,
  );
  assert(
    Math.abs(E_rnd.rndEffort - 0.55) < 1e-9,
    `research credits induce ~1:1 private effort with their fiscal cost (got ${E_rnd.rndEffort})`,
  );
  const withCredits = simulate(rndLaw, 16);
  newGame();
  G = getG();
  const without = simulate(G.law, 16);
  assert(
    withCredits.end.econ.R > without.end.econ.R,
    `research credits raise the knowledge stock (${without.end.econ.R.toFixed(2)} → ${withCredits.end.econ.R.toFixed(2)})`,
  );
  /* Private lab spend is demand now (I), not only a knowledge-stock flow — so
     four-quarter cumulative growth should not read as a pure fiscal contraction. */
  newGame();
  G = getG();
  const rndOnly = clone(G.law);
  rndOnly.policies = Object.assign({}, rndOnly.policies, { rnd: true });
  const imRnd = impactOf(rndOnly, simulate(G.law, 4), 4);
  assert(
    imRnd.head.growth > -0.01,
    `research credits are not a short-run growth tax (4Q growth ${imRnd.head.growth.toFixed(3)})`,
  );
}

/* Impact Growth is cumulative GDP over the horizon, not the final quarter's
   annualised pace — otherwise an employer-NI cut can show Growth down while
   the economy is clearly larger by year-end. */
{
  newGame();
  G = getG();
  const base = simulate(G.law, 4);
  const cut = clone(G.law);
  cut.ni.erRate -= 2;
  const im = impactOf(cut, base, 4);
  assert(
    im.head.growth > 0.05,
    `employer NI cut raises cumulative growth over 4Q (got ${im.head.growth.toFixed(3)})`,
  );
  const add = clone(G.law);
  add.income.bands[2].rate -= 10;
  const imAdd = impactOf(add, base, 4);
  assert(
    imAdd.head.growth < 0,
    `unfunded additional-rate cut stays weakly contractionary on cumulative growth (got ${imAdd.head.growth.toFixed(3)})`,
  );
}

/* ---- Diplomacy + trade coupling ---- */
{
  newGame();
  G = getG();
  assert(MISSIONS.length === 3, "missions are summit, protest, sanctions");
  assert(
    !MISSIONS.some((m) => m.id === "concession"),
    "concession is not a staged mission",
  );
  assert(
    MISSION_EVENTS.every((ev) => !ev.missions.includes("concession")),
    "mission events are summit-only",
  );
  const demarche = MISSIONS.find((m) => m.id === "demarche");
  assert(
    demarche && demarche.pc === 4 && demarche.impulse === -5,
    "protest is cheap escalate rung",
  );
  G.draft.missions = { france: "summit" };
  const cl = billClauses();
  assert(
    cl.some((c) => /summit|State visit/i.test(c.label)),
    "staging a summit creates a bill clause",
  );
  assert(
    cl.some((c) => c.executive && /summit|State visit/i.test(c.label)),
    "a summit clause is executive",
  );
  assert(
    billVoteData() && !billVoteData().needed,
    "a summit alone does not go to the chamber",
  );
  assert(
    !chamberBlocksDeliver(),
    "a summit alone cannot be blocked by the chamber",
  );
  const vat0 = G.law.taxes.vat.rate;
  G.draft.taxes.vat.rate = vat0 + 2;
  assert(
    billVoteData() && billVoteData().needed,
    "a summit plus a tax still needs the chamber",
  );
  G.draft.taxes.vat.rate = vat0;
  const cost = cl.reduce((a, c) => a + c.pc, 0);
  const cap0 = G.capital;
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    isVisitActive(G, "france"),
    "summit begins a one-quarter state visit on enact",
  );
  assert(
    !G.missionEvents || G.missionEvents.length === 0,
    "summit does not queue mission event until deliver queues visit events",
  );
  queueSummitVisitEvents(G);
  assert(
    G.missionEvents &&
      G.missionEvents.length === 2 &&
      G.missionEvents[0].missionId === "summit" &&
      G.missionEvents[0].eventIndex === 0 &&
      G.missionEvents[1].eventIndex === 1,
    "first deliver during summit visit queues political then commercial",
  );
  assert(
    (G.econ.relImpulse.france || 0) < 10,
    "summit no longer applies full relImpulse on enact",
  );
  assert(
    G.econ.missionCd.france === 3,
    "summit sets a three-quarter mission cooldown",
  );
  const rel0 = G.rel.france;
  step(G, G.law, G.prevLaw, true);
  assert(
    G.rel.france > rel0,
    `summit impulse lifts france relations (${rel0.toFixed(1)} → ${G.rel.france.toFixed(1)})`,
  );
  assert(cap0 >= cost, "opening capital covers a summit");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.politics = {
    [playerCountryId()]: {},
    japan: {},
  };
  beginActiveVisit(G, "japan", "summit");
  G.missionEvents = [];
  queueSummitVisitEvents(G);
  assert(
    G.missionEvents.length === 1 &&
      G.missionEvents[0].partnerId === "japan" &&
      G.missionEvents[0].eventIndex === 1,
    "human-human summit queues only the commercial agenda",
  );
  const skipped = rollMissionEvent("summit", "japan", G, diploDeps(), true, 0);
  assert(
    !skipped,
    "scripted summit demand paper does not roll vs a human seat",
  );
}

{
  newGame();
  G = getG();
  assert(
    G.log.length >= 2 &&
      G.log.every(
        (r) => r.partnerTariffs && typeof r.partnerTariffs === "object",
      ),
    "settle and opening log rows carry partnerTariffs",
  );
  const live = livePartnerTariffOnPlayer("japan");
  const last = G.log[G.log.length - 1];
  assert(
    last.partnerTariffs.japan != null &&
      Math.abs(last.partnerTariffs.japan - live) < 0.01,
    "logged japan tariff matches live partnerTariffOnPlayer",
  );
  const deLive = livePartnerTariffOnPlayer("germany");
  assert(
    Math.abs(deLive - 4) < 0.01,
    "Germany charges the EU CET of 4 on the player (got " + deLive + ")",
  );
  assert(
    G.log.every(
      (r) =>
        r.partnerTariffs &&
        r.partnerTariffs.germany != null &&
        Math.abs(r.partnerTariffs.germany - deLive) < 0.01,
    ),
    "opening log does not show a pre-CET jump for EU members",
  );
  assert(
    G.world.france &&
      G.world.france.law.tariffSchedule &&
      G.world.france.law.tariffSchedule.cet === 4,
    "CU CET is stamped on AI union members' statute books",
  );
  const lenBefore = G.log.length;
  step(G, G.law, G.law, true);
  assert(
    G.log.length === lenBefore + 1,
    "step appends log rows with tariff history",
  );
  assert(
    G.log[G.log.length - 1].partnerTariffs,
    "live quarter logs partnerTariffs",
  );
}

{
  newGame();
  G = getG();
  assert(
    G.log.length >= 2 &&
      G.log.every((r) => r.partnerTrade && typeof r.partnerTrade === "object"),
    "settle and opening log rows carry partnerTrade",
  );
  const live = snapshotPartnerTrade(G);
  const last = G.log[G.log.length - 1];
  assert(
    live.japan &&
      live.japan.X > 0 &&
      last.partnerTrade.japan &&
      Math.abs(last.partnerTrade.japan.X - live.japan.X) < 0.05 &&
      Math.abs(last.partnerTrade.japan.M - live.japan.M) < 0.05,
    "logged japan trade matches live snapshotPartnerTrade",
  );
  let sumX = 0;
  let sumM = 0;
  for (const id of Object.keys(live)) {
    sumX += live[id].X || 0;
    sumM += live[id].M || 0;
  }
  assert(
    Math.abs(sumX - G.econ.X) < 0.05 && Math.abs(sumM - G.econ.M) < 0.05,
    "partner trade X/M sum to headline exports and imports",
  );
  const lenBefore = G.log.length;
  step(G, G.law, G.law, true);
  assert(
    G.log.length === lenBefore + 1 && G.log[G.log.length - 1].partnerTrade,
    "live quarter logs partnerTrade",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.draft.missions = { japan: "summit" };
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  beginActiveVisit(G, "japan", "summit");
  const ev0 = rollMissionEvent(
    "summit",
    "japan",
    G,
    {
      effectiveTariff,
      playerCountryId,
      activePartners,
      lawForRole,
      partnerById,
      DEAL_BY_ID,
      buildSummitCommercialEvent,
    },
    true,
    0,
  );
  assert(
    ev0 && ev0.id !== "summit_commercial_agenda",
    "summit beat 0 stays in the political pool",
  );
  const ev1 = rollMissionEvent(
    "summit",
    "japan",
    G,
    {
      effectiveTariff,
      playerCountryId,
      activePartners,
      lawForRole,
      partnerById,
      DEAL_BY_ID,
      buildSummitCommercialEvent,
    },
    true,
    1,
  );
  assert(
    ev1 && ev1.id === "summit_commercial_agenda",
    "summit beat 1 is the commercial agenda",
  );
  assert(
    ev1.opts.some((o) => o.summitKind === "tariff"),
    "commercial agenda offers reciprocal tariff cut",
  );
  const t0 =
    G.draft.tariffSchedule.country.japan != null
      ? G.draft.tariffSchedule.country.japan
      : G.draft.tariffSchedule.default;
  const their0 = livePartnerTariffOnPlayer("japan");
  const tariffOpt = ev1.opts.find((o) => o.summitKind === "tariff");
  applySummitCommercialOption(tariffOpt, { partnerId: "japan" });
  const t1 =
    G.draft.tariffSchedule.country.japan != null
      ? G.draft.tariffSchedule.country.japan
      : G.draft.tariffSchedule.default;
  assert(t1 < t0, "reciprocal tariff choice cuts player draft rate on japan");
  assert(
    G.law.tariffSchedule.country.japan === t1,
    "reciprocal tariff writes the player cut onto law, not only the bill",
  );
  const their1 = livePartnerTariffOnPlayer("japan");
  assert(
    their1 < their0,
    "japan reciprocates by cutting its duty on the player",
  );
  const dealOpt = ev1.opts.find((o) => o.summitKind === "deal");
  if (dealOpt) {
    G.draft.deals = {};
    G.law.deals = {};
    applySummitCommercialOption(dealOpt, { partnerId: "japan" });
    assert(
      G.law.deals[dealOpt.dealId],
      "commercial agenda ratifies eligible deal onto law when partner agrees",
    );
    assert(
      G.draft.deals[dealOpt.dealId],
      "draft stays synced after instant bilateral ratification",
    );
  }
}

{
  newGame();
  G = getG();
  const deals = dealsForPartner(partnerById("japan"), G.homeRole);
  const open = deals.find((d) => !(G.law.deals && G.law.deals[d.id]));
  if (open) {
    toggleDraftDeal(open.id);
    assert(
      !(G.law.deals && G.law.deals[open.id]),
      "unsigned bilateral deals cannot be ratified from the trade panel",
    );
  }
}

{
  newGame();
  G = getG();
  const usaEv = buildSummitCommercialEvent("united_states", G);
  const usaTariff = usaEv.opts.find((o) => o.summitKind === "tariff");
  assert(usaTariff, "USA reciprocal tariff is offered");
  const usaTheir0 = livePartnerTariffOnPlayer("united_states");
  const usaOur0 =
    G.law.tariffSchedule.country.united_states != null
      ? G.law.tariffSchedule.country.united_states
      : G.law.tariffSchedule.default;
  applySummitCommercialOption(usaTariff, { partnerId: "united_states" });
  const usaTheir1 = livePartnerTariffOnPlayer("united_states");
  const usaOur1 = G.law.tariffSchedule.country.united_states;
  assert(
    usaOur1 < usaOur0,
    "USA summit cut lands on player law (got " +
      usaOur1 +
      " from " +
      usaOur0 +
      ")",
  );
  assert(
    usaTheir1 < usaTheir0,
    "USA reciprocates rather than declining after our cut is applied (got " +
      usaTheir1 +
      " from " +
      usaTheir0 +
      ")",
  );
  assert(
    !billClauses().some((c) => /united states tariff/i.test(c.label)),
    "summit tariff cut is not a bill clause",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  const chinaEv = buildSummitCommercialEvent("china", G);
  const chinaTariff = chinaEv.opts.find((o) => o.summitKind === "tariff");
  assert(chinaTariff, "summit shows reciprocal tariff option for china");
  const chinaEqual2 = previewSummitTariff("china", 2, 2);
  assert(
    chinaEqual2 && !chinaEqual2.ok,
    "reciprocal 2pt tariff declined when partner would refuse",
  );
  assert(
    chinaEv.opts.some((o) => o.summitKind === "decline"),
    "summit still offers a no-breakthrough option for china",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 50;
  const midChina = buildSummitCommercialEvent("china", G);
  const midCuts = midChina.opts.filter((o) => o.summitKind === "tariff");
  const modest = midCuts.find((o) => o.delta === 1);
  const standard = midCuts.find((o) => o.delta === 2);
  assert(modest && standard, "China summit offers 1pt and 2pt cuts");
  assert(
    previewSummitTariff("china", 1, 1).ok,
    "China takes a modest 1pt trim at 50",
  );
  const china2 = previewSummitTariff("china", 2, 2);
  assert(
    china2 && !china2.ok,
    "China refuses a 2pt cut at 50 — the ask is too deep",
  );
  assert(
    china2.reason && !/tax our exports/i.test(china2.reason),
    "China 2pt decline is not 'they tax us more'",
  );
  const midDeal = midChina.opts.find((o) => o.summitKind === "deal");
  assert(
    midDeal,
    "China treaty can still be tabled at 50 — acceptance is the package, not a gate",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 40;
  const blockers = dealBlockers(DEAL_BY_ID.cn_invest);
  assert(
    !blockers.some((b) => /relations below/i.test(b)),
    "treaty relation floor is not a hard Trade-panel block",
  );
  const cold = commercialAcceptScore("deal", "china", G, diploDeps(), {
    dealId: "cn_invest",
  });
  assert(
    typeof cold.p === "number" && cold.p > 0,
    "a treaty below its warmth floor still scores, not a hard zero (got " +
      (cold.p != null ? cold.p.toFixed(2) : cold.p) +
      ")",
  );
  assert(cold && !cold.ok, "China still declines the investment treaty at 40");
  assert(
    cold.reason && !/too low for this treaty/i.test(cold.reason),
    "decline copy is the scored reason, not a relation veto",
  );
  const coldEv = buildSummitCommercialEvent("china", G);
  const invest = coldEv.opts.find((o) => o.dealId === "cn_invest");
  assert(
    invest,
    "China investment treaty is still tableable below its old relation floor",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 50;
  const their0 = livePartnerTariffOnPlayer("china");
  ensureSched(G.law);
  ensureSched(G.draft);
  G.law.tariffSchedule.country.china = their0;
  G.draft.tariffSchedule.country.china = their0;
  const matchedChina = buildSummitCommercialEvent("china", G);
  assert(
    matchedChina.opts.some((o) => o.summitKind === "tariff" && o.delta === 2),
    "matching rates at 50 still offers a 2pt China cut",
  );
  assert(
    !previewSummitTariff("china", 2, 2).ok,
    "matching rates at 50 does not unlock a 2pt China cut",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 72;
  const hotChina = buildSummitCommercialEvent("china", G);
  const hotStd = hotChina.opts.find(
    (o) => o.summitKind === "tariff" && o.delta === 2,
  );
  assert(hotStd, "China summit still offers a 2pt cut at high warmth");
  assert(
    previewSummitTariff("china", 2, 2).ok,
    "China accepts a 2pt cut at high warmth",
  );
  const hotDeal = hotChina.opts.find((o) => o.summitKind === "deal");
  assert(hotDeal, "China treaty can be tabled at high warmth");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.russia = 50;
  const ruEv = buildSummitCommercialEvent("russia", G);
  const ruStd = ruEv.opts.find(
    (o) => o.summitKind === "tariff" && o.delta === 2,
  );
  const ruDeep = ruEv.opts.find(
    (o) => o.summitKind === "tariff" && o.delta > 2,
  );
  assert(ruStd, "Russia summit offers a 2pt cut");
  assert(
    previewSummitTariff("russia", 2, 2).ok,
    "Russia accepts a 2pt cut at 50 despite a higher MFN",
  );
  assert(ruDeep, "Russia summit offers a deeper cut");
  assert(
    !previewSummitTariff("russia", ruDeep.ourDelta, ruDeep.theirDelta).ok,
    "Russia refuses a deeper cut at 50",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  const chinaOpen = buildSummitCommercialEvent("china", G);
  const ourOpen =
    G.law.tariffSchedule.country.china != null
      ? G.law.tariffSchedule.country.china
      : G.law.tariffSchedule.default;
  const theirOpen = livePartnerTariffOnPlayer("china");
  const toZero = chinaOpen.opts.find(
    (o) =>
      o.summitKind === "tariff" &&
      o.ourDelta === Math.floor(ourOpen + 1e-6) &&
      o.theirDelta === Math.floor(theirOpen + 1e-6),
  );
  assert(toZero, "summit offers cutting each side all the way to 0");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 50;
  const their0 = livePartnerTariffOnPlayer("china");
  const our0 =
    G.law.tariffSchedule.country.china != null
      ? G.law.tariffSchedule.country.china
      : G.law.tariffSchedule.default;
  applySummitCommercialOption(
    { summitKind: "tariff", ourDelta: Math.floor(our0 + 1e-6), theirDelta: 1 },
    { partnerId: "china" },
  );
  assert(
    G.law.tariffSchedule.country.china === 0,
    "China accepts a 1pt cut if we go to 0",
  );
  assert(
    livePartnerTariffOnPlayer("china") === their0 - 1,
    "China trims 1pt when we disarm our remaining duty",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 50;
  const their0 = livePartnerTariffOnPlayer("china");
  const our0 =
    G.law.tariffSchedule.country.china != null
      ? G.law.tariffSchedule.country.china
      : G.law.tariffSchedule.default;
  const rel0 = G.rel.china;
  applySummitCommercialOption(
    {
      summitKind: "tariff",
      ourDelta: 0,
      theirDelta: Math.floor(their0 + 1e-6),
    },
    { partnerId: "china" },
  );
  assert(
    livePartnerTariffOnPlayer("china") === their0,
    "China refuses a unilateral cut to 0",
  );
  assert(
    (G.law.tariffSchedule.country.china != null
      ? G.law.tariffSchedule.country.china
      : G.law.tariffSchedule.default) === our0,
    "our duty unchanged when they refuse",
  );
  assert(G.rel.china < rel0, "a refused ask cools relations");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.china = 50;
  const their0 = livePartnerTariffOnPlayer("china");
  const our0 =
    G.law.tariffSchedule.country.china != null
      ? G.law.tariffSchedule.country.china
      : G.law.tariffSchedule.default;
  applySummitCommercialOption(
    {
      summitKind: "tariff",
      ourDelta: Math.floor(our0 + 1e-6),
      theirDelta: 2,
    },
    { partnerId: "china" },
  );
  assert(
    livePartnerTariffOnPlayer("china") === their0 - 2,
    "China takes a 2pt cut at 50 if we go to 0",
  );
  assert(
    G.law.tariffSchedule.country.china === 0,
    "our remaining duty is the sweetener",
  );
}

{
  newGame();
  G = getG();
  const cliff = previewSummitTariff("china", 3, 0);
  assert(
    typeof cliff.p === "number" && cliff.p > 0.15,
    "China at opening relations scores a unilateral UK cut on a scale, not a hard zero (got " +
      (cliff.p != null ? cliff.p.toFixed(2) : cliff.p) +
      ")",
  );
  const equal = previewSummitTariff("china", 2, 2);
  assert(
    equal && !equal.ok,
    "China still refuses an equal 2pt cut at opening relations",
  );
}

{
  const sweet = commercialPackageScore([{ p: 0.45 }, { p: 0.82 }]);
  const product = 0.45 * 0.82;
  assert(
    sweet.p > 0.45,
    "a popular treaty sweetens a weak cut rather than dragging it (got " +
      sweet.p.toFixed(2) +
      ")",
  );
  assert(
    sweet.p > product + 0.05,
    "package score is not the product of item chances",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.japan = 70;
  const jp = buildSummitCommercialEvent("japan", G);
  const deal = jp.opts.find((o) => o.summitKind === "deal" && !o.disabled);
  assert(deal, "japan has a signable treaty at a summit");
  const rel0 = G.rel.japan;
  const their0 = livePartnerTariffOnPlayer("japan");
  applySummitCommercialOption(
    {
      summitKind: "package",
      ourDelta: 1,
      theirDelta: 1,
      dealIds: [deal.dealId],
    },
    { partnerId: "japan" },
  );
  assert(
    livePartnerTariffOnPlayer("japan") === their0 - 1,
    "package still cuts their duty",
  );
  assert(
    G.law.deals[deal.dealId],
    "package ratifies the treaty in the same session",
  );
  assert(
    G.rel.japan >= rel0 + 10,
    "tariff plus treaty lifts relations more than a cut alone (got " +
      (G.rel.japan - rel0).toFixed(1) +
      ")",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.germany = 70;
  G.politics = {
    [playerCountryId()]: {},
    germany: {},
  };
  const ev = buildSummitCommercialEvent("germany", G);
  const deal = ev.opts.find((o) => o.summitKind === "deal" && !o.disabled);
  assert(deal, "germany has a signable treaty at a summit");
  const their0 = livePartnerTariffOnPlayer("germany");
  applySummitCommercialOption(
    {
      summitKind: "package",
      ourDelta: 1,
      theirDelta: 1,
      dealIds: [deal.dealId],
    },
    { partnerId: "germany" },
  );
  const inbound = G.politics.germany.inboundSummitCommercial;
  assert(
    inbound && inbound.status === "pending",
    "human partner parks a pending summit agenda",
  );
  assert(
    (inbound.theirDelta != null ? inbound.theirDelta : inbound.delta) === 1,
    "inbound carries the asked tariff cut",
  );
  assert(
    (inbound.deals || []).some((d) => d.id === deal.dealId),
    "inbound carries the treaty on the same offer",
  );
  assert(
    !(
      G.politics.germany.inboundDealProposal &&
      G.politics.germany.inboundDealProposal.status === "pending"
    ),
    "does not park a separate treaty proposal",
  );
  assert(
    !(G.law.deals && G.law.deals[deal.dealId]),
    "treaty waits on their answer",
  );
  assert(
    livePartnerTariffOnPlayer("germany") === their0,
    "partner tariff waits on accept",
  );

  const choice = applyMpInboundSummitCommercialChoice(G, "germany", true);
  assert(choice && choice.ok, "germany can accept the combined agenda");
  assert(
    !G.politics.germany.inboundSummitCommercial,
    "accept clears the inbound agenda",
  );
  assert(
    G.world[playerCountryId()].law.deals &&
      G.world[playerCountryId()].law.deals[deal.dealId],
    "accept writes the treaty onto the issuer's law",
  );
  assert(
    livePartnerTariffOnPlayer("germany") === their0 - 1,
    "accept cuts the partner tariff",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.rel.japan = 70;
  const jp = buildSummitCommercialEvent("japan", G);
  const deal = jp.opts.find((o) => o.summitKind === "deal" && !o.disabled);
  const rel0 = G.rel.japan;
  applySummitCommercialOption(deal, { partnerId: "japan" });
  assert(
    G.rel.japan >= rel0 + 7,
    "signing a treaty lifts relations (got +" +
      (G.rel.japan - rel0).toFixed(1) +
      ")",
  );
}

{
  newGame();
  G = getG();
  const warmX = G.econ.bilateralX.russia;
  G.rel.russia = 20;
  step(G, G.law, G.prevLaw, true);
  const coldX = G.econ.bilateralX.russia;
  assert(
    coldX < warmX,
    `cold relations cut bilateral exports (${coldX.toFixed(3)} vs ${warmX.toFixed(3)})`,
  );
}

{
  newGame();
  G = getG();
  G.law.tariffSchedule.default = 12;
  G.draft.tariffSchedule.default = 12;
  G.law.tariff = 12;
  G.draft.tariff = 12;
  for (const p of activePartners()) G.rel[p.id] = 70;
  step(G, G.law, G.prevLaw, true);
  const warmRetal = G.econ.retaliation;
  newGame();
  G = getG();
  G.law.tariffSchedule.default = 12;
  G.draft.tariffSchedule.default = 12;
  G.law.tariff = 12;
  G.draft.tariff = 12;
  for (const p of activePartners()) G.rel[p.id] = 25;
  step(G, G.law, G.prevLaw, true);
  const coldRetal = G.econ.retaliation;
  assert(
    coldRetal > warmRetal,
    `cold relations amplify retaliation (${coldRetal.toFixed(3)} vs ${warmRetal.toFixed(3)})`,
  );
}

{
  /* Any member — not just a fixed "chair" — may propose a new common
   * external tariff; billClauses() must not silently discard it. It only
   * takes effect if every other member's relations clear the bar (see the
   * mpDraftBlocGateError() check below), same consensus gate the union
   * already uses for accession and external deals. */
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.draft = clone(G.law);
  assert(lockedTariff(G.law) === 4, "customs union locks tariff at 4");
  G.draft.tariffSchedule.cet = 15;
  G.draft.tariffSchedule.default = 15;
  billClauses();
  assert(
    G.draft.tariffSchedule.cet === 15,
    "billClauses keeps a member's proposed common external tariff",
  );
  assert(
    G.draft.tariffSchedule.default === G.law.tariffSchedule.default,
    "billClauses still snaps the unused 'default' field back while locked",
  );
  for (const p of activePartners()) G.rel[p.id] = 70;
  assert(
    mpDraftBlocGateError() === null,
    "a CET proposal with warm relations everywhere is not blocked",
  );
  G.rel.germany = 10;
  assert(
    /Cannot change the common external tariff/.test(
      mpDraftBlocGateError() || "",
    ),
    "a CET proposal is blocked without every member's approval",
  );
  for (const p of activePartners()) G.rel[p.id] = 70;
}

{
  newGame();
  G = getG();
  G.law.deals.cn_trade = true;
  G.draft.deals.cn_trade = true;
  let withdrawn = false;
  for (let i = 0; i < 10; i++) {
    G.rel.china = 12;
    step(G, G.law, G.law, true);
    if (!G.law.deals.cn_trade) {
      withdrawn = true;
      break;
    }
  }
  assert(withdrawn, "sustained frost forces withdrawal of a partner deal");
}

{
  newGame();
  G = getG();
  /* enact() below falls through to the ordinary solo quarter-advance, which
   * adds demand noise unless sandbox is on (newGame() defaults to sandbox
   * off) and can roll a genuine random event once the 4-quarter cooldown
   * clears regardless of sandbox — either would desync G.q from what the
   * exact-step-count assertions after the direct step() calls further down
   * expect. */
  G.sandbox = true;
  G.lastEventQ = 1e9;
  assert(
    !EVENTS.find((e) => e.id === "allianceOffer"),
    "allianceOffer event removed",
  );

  G.capital = 200;
  G.rel.france = 58;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  delete G.draft.policies.closeBorders;
  G.draft.tariffSchedule.default = 7;
  G.draft.tariff = 7;

  assert(
    blocJoinBlockers("continental_union", "apply").length === 0,
    "CU application clears with chair + tariff",
  );
  G.draft.blocAccession = { blocId: "continental_union", phase: "apply" };
  const applyCost = billClauses()
    .filter((c) => c.label && c.label.includes("Application to join"))
    .reduce((s, c) => s + c.pc, 0);
  assert(applyCost > 0, "application costs capital once");
  enact();
  const pid = playerCountryId();
  assert(
    G.blocAccessionByCountry &&
      G.blocAccessionByCountry[pid] &&
      G.blocAccessionByCountry[pid].blocId === "continental_union" &&
      G.blocAccessionByCountry[pid].step === 1 &&
      G.blocAccessionByCountry[pid].self,
    "application starts automatic accession pipeline",
  );
  assert(
    G.blocAccession && G.blocAccession.step === 1,
    "application mirrors accession step 1",
  );
  assert(
    !canCreateCustomBloc(),
    "cannot found a bloc while accession is in progress",
  );
  G.draft.blocCreate = { name: "Shadow League", template: "shallow_fta" };
  assert(
    billClauses().every((c) => !c.label || !/^Found /.test(c.label)),
    "Found is not a capital clause while ascending",
  );
  G.draft.blocCreate = null;
  {
    const savedAcc = clone(G.blocAccessionByCountry[pid]);
    const savedMirror = clone(G.blocAccession);
    assert(withdrawBlocAccession(G, pid), "cancel joining clears accession");
    assert(
      !G.blocAccessionByCountry[pid],
      "shared accession cleared on withdraw",
    );
    assert(!G.blocAccession, "seat accession cleared on withdraw");
    assert(canCreateCustomBloc(), "founding unlocked after cancel joining");
    /* Restore so the automatic accession path below still runs. */
    G.blocAccessionByCountry[pid] = savedAcc;
    G.blocAccession = savedMirror;
  }

  /* Alignment and treaty advance automatically — no further capital bills. */
  G.draft = clone(G.law);
  G.draft.blocAccession = { blocId: "continental_union", phase: "align" };
  assert(
    billClauses().every((c) => !c.label || !c.label.includes("alignment")),
    "alignment is not a capital clause",
  );
  G.draft.blocAccession = null;

  step(G, G.law, G.law, true);
  assert(
    G.blocAccessionByCountry[pid] && G.blocAccessionByCountry[pid].step === 2,
    "accession advances to alignment after one quarter",
  );

  step(G, G.law, G.law, true);
  assert(
    countryBlocId(pid) === "continental_union",
    "accession treaty joins continental union automatically",
  );
  assert(G.law.tariffSchedule.cet === 4, "accession locks CET at 4");
  assert(!G.blocAccession, "accession state cleared after join");
  assert(!G.blocAccessionByCountry[pid], "pipeline cleared after join");
}

{
  newGame();
  G = getG();
  G.blocAccession = { blocId: "continental_union", step: 2 };
  G.rel.germany = 40;
  G.rel.france = 58;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.draft.tariffSchedule.default = 7;
  const blockers = blocJoinBlockers("continental_union", "accede");
  assert(
    blockers.some((b) => b.includes("Germany")),
    "unanimous gate blocks when one member is below threshold",
  );
  const approvals = blocMemberApprovals("continental_union");
  assert(
    approvals.some((a) => a.id === "germany" && !a.ok),
    "germany flagged in member approvals",
  );
}

{
  newGame();
  G = getG();
  G.blocAccession = { blocId: "continental_union", step: 1 };
  G.draft.policies.closeBorders = true;
  G.draft.tariffSchedule.default = 7;
  const blockers = blocJoinBlockers("continental_union", "align");
  assert(
    blockers.some(
      (b) => b.includes("close borders") || b.includes("migration"),
    ),
    "close borders blocks alignment",
  );
}

{
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  const frDeal = DEAL_BY_ID.fr_fta;
  const blockers = dealBlockers(frDeal);
  assert(
    blockers.some((b) => b.includes("customs union")),
    "bilateral deals blocked while in a customs union",
  );
}

{
  newGame();
  G = getG();
  const deDeal = DEAL_BY_ID.de_fta;
  const blockers = dealBlockers(deDeal);
  assert(
    blockers.some((b) => b.includes("their bloc")),
    "cannot bilateral with partner in a customs union",
  );
}

{
  newGame();
  G = getG();
  const jpDeal = DEAL_BY_ID.jp_tech;
  const blockers = dealBlockers(jpDeal);
  assert(
    !blockers.some((b) => b.includes("their bloc")),
    "CPTPP Japan is signable — FTA members keep commercial policy",
  );
}

{
  newGame();
  G = getG();
  joinBloc("pacific_accord", G.law);
  const inDeal = DEAL_BY_ID.in_goods;
  const blockers = dealBlockers(inDeal);
  assert(
    !blockers.some(
      (b) => b.includes("customs union") || b.includes("their bloc"),
    ),
    "player in CPTPP can still sign with India",
  );
}

{
  newGame();
  G = getG();
  G.law.deals.in_goods = true;
  joinBloc("pacific_accord", G.law);
  assert(G.law.deals.in_goods, "joining an FTA keeps bilateral deals");
}

{
  newGame();
  G = getG();
  G.law.deals.in_goods = true;
  joinBloc("continental_union", G.law);
  assert(!G.law.deals.in_goods, "joining a CU wipes bilateral deals");
}

{
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.rel.france = 55;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.rel.poland = 55;
  G.rel.india = 55;
  G.draft = clone(G.law);
  assert(
    canNegotiateUnionCommercial(G, "india"),
    "EU member can table a union package with India",
  );
  assert(
    !canNegotiateReciprocalTariffs(G, "india"),
    "ordinary bilateral tariff talks stay closed in a CU",
  );
  const indiaEv = buildSummitCommercialEvent("india", G);
  assert(
    indiaEv.opts.some(
      (o) => o.summitKind === "deal" && o.dealId === "in_goods",
    ),
    "EU member summit with India offers in_goods as a union treaty",
  );
  assert(
    indiaEv.opts.some((o) => o.summitKind === "tariff"),
    "EU member summit with India offers a preferential tariff pack",
  );
  const unmet = blocExternalDealBlockers("india", "in_goods");
  assert(
    unmet.length === 0,
    "EU member union treaty with India clears when every member approves",
  );
}

{
  newGame();
  G = getG();
  G.rel.france = 55;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.rel.poland = 55;
  G.draft = clone(G.law);
  assert(cuBoundary(G, "france"), "outsider vs France is a CU boundary");
  assert(
    canNegotiateUnionCommercial(G, "france"),
    "outsider can table a union package with France",
  );
  assert(
    !canNegotiateReciprocalTariffs(G, "france"),
    "ordinary bilateral tariff talks stay closed with a CU member",
  );
  const frEv = buildSummitCommercialEvent("france", G);
  assert(
    frEv.opts.some((o) => o.summitKind === "deal" && o.dealId === "eu_assoc"),
    "outsider summit with France offers the union association",
  );
  assert(
    !frEv.opts.some((o) => o.dealId === "fr_fta"),
    "outsider summit with France does not offer France's bilateral FTA",
  );
  assert(
    frEv.opts.some((o) => o.summitKind === "tariff"),
    "outsider summit with France offers a union tariff pack",
  );
}

{
  newGame();
  G = getG();
  G.rel.france = 55;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.rel.poland = 55;
  G.draft = clone(G.law);
  const cetBefore = G.law.tariffSchedule.cet;
  const our0 = effectiveTariff("france", G.law);
  const their0 = livePartnerTariffOnPlayer("france", G);
  const frEv = buildSummitCommercialEvent("france", G);
  const tariffOpt = frEv.opts.find((o) => o.summitKind === "tariff");
  applySummitCommercialOption(tariffOpt, { partnerId: "france" });
  assert(
    G.law.tariffSchedule.bloc.continental_union != null,
    "outsider union cut writes the bloc lever",
  );
  assert(
    effectiveTariff("france", G.law) < our0,
    "outsider duty on France falls via the bloc lever",
  );
  assert(
    effectiveTariff("germany", G.law) ===
      G.law.tariffSchedule.bloc.continental_union,
    "bloc lever covers every EU member",
  );
  assert(
    G.law.tariffSchedule.cet === cetBefore,
    "union package does not cut the CET",
  );
  const their1 = livePartnerTariffOnPlayer("france", G);
  assert(their1 < their0, "France's duty on the player falls");
  const deLaw = G.world.germany.law;
  const playerId = playerCountryId();
  assert(
    deLaw.tariffSchedule.country[playerId] != null,
    "other EU members write a country overlay on the outsider",
  );
  assert(
    deLaw.tariffSchedule.cet === 4 || deLaw.tariffSchedule.cet == null,
    "member CET is unchanged",
  );
}

{
  newGame();
  G = getG();
  G.rel.france = 55;
  G.rel.germany = 30;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.rel.poland = 55;
  G.draft = clone(G.law);
  const coolPreview = previewSummitTariff("france", 2, 2);
  assert(
    coolPreview && !coolPreview.ok,
    "a cool Germany still drags a standard union cut below accept",
  );
  const frEv = buildSummitCommercialEvent("france", G);
  const standard = frEv.opts.find(
    (o) => o.summitKind === "tariff" && (o.delta === 2 || o.theirDelta === 2),
  );
  const our0 = effectiveTariff("france", G.law);
  if (standard) applySummitCommercialOption(standard, { partnerId: "france" });
  assert(
    effectiveTariff("france", G.law) === our0,
    "declined 2pt union cut does not land",
  );
}

{
  newGame();
  G = getG();
  G.rel.france = 55;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.rel.poland = 55;
  G.draft = clone(G.law);
  const assoc = unionAssociationDeal("continental_union");
  const signed = ratifyBilateralDealWithPartner(G, "france", assoc.id, true);
  assert(signed.ok, "outsider can ratify the EU association at a summit");
  assert(G.law.deals.eu_assoc, "association lands on the statute book");
  const access = partnerAccessTargets(G.law, G.homeRole, G.blocMember);
  assert(access.france > 0, "association fans access to France");
  assert(access.germany > 0, "association fans access to Germany");
  joinBloc("continental_union", G.law);
  assert(
    !G.law.deals.eu_assoc,
    "joining the EU wipes a prior association deal",
  );
}

{
  newGame();
  G = getG();
  const jpEv = buildSummitCommercialEvent("japan", G);
  assert(
    jpEv.opts.some((o) => o.summitKind === "tariff"),
    "CPTPP Japan is still a normal bilateral summit",
  );
  assert(
    !canNegotiateUnionCommercial(G, "japan"),
    "FTA Japan is not a CU-boundary summit",
  );
}

{
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.draft = clone(G.law);
  const sameBloc = buildSummitCommercialEvent("france", G);
  assert(
    !sameBloc.opts.some((o) => o.summitKind === "tariff"),
    "same-bloc visit has no tariff pack",
  );
  assert(!cuBoundary(G, "france"), "fellow CU members are not a CU boundary");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.lastEventQ = 1e9;
  createCustomBloc("Northern League", "shallow_fta");
  const bid = countryBlocId(playerCountryId());
  assert(
    blocInviteBlockers(bid, "germany").some((b) => /need 62/.test(b)),
    "CU poach stays blocked at open Germany relations",
  );
  assert(
    !blocInviteBlockers(bid, "japan").length,
    "can poach Japan from CPTPP when in a custom FTA",
  );
  G.draft.blocInvite = { japan: true };
  const poachClause = billClauses().find((c) =>
    (c.label || "").includes("Japan"),
  );
  assert(
    poachClause && poachClause.label.includes("CPTPP") && poachClause.pc === 20,
    "poach stages as leave-and-join at 20 capital",
  );
  G.draft.blocInvite = {};
  const auBefore = G.rel.australia;
  inviteToBloc("japan", bid);
  G.rel.japan = 70;
  step(G, G.law, G.law, true);
  assert(
    countryBlocId("japan") == null,
    "poach accept leaves the old bloc before accession",
  );
  assert(
    G.blocAccessionByCountry.japan &&
      G.blocAccessionByCountry.japan.blocId === bid,
    "poach accept starts accession into the inviting bloc",
  );
  assert(
    G.rel.australia < auBefore - 2,
    "poach hits remaining members of the old FTA",
  );
  assert(
    !joinBloc("pacific_accord", G.law),
    "exclusive membership still blocks a second join",
  );
}

{
  newGame();
  G = getG();
  G.capital = 200;
  G.rel.france = 58;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.law.deals.fr_fta = true;
  G.draft = clone(G.law);
  G.draft.tariffSchedule.default = 7;
  /* Seed late-stage automatic accession and advance one quarter to join. */
  G.blocAccessionByCountry = {
    [playerCountryId()]: {
      blocId: "continental_union",
      step: 2,
      sinceQ: G.q,
      self: true,
    },
  };
  G.blocAccession = { blocId: "continental_union", step: 2 };
  step(G, G.law, G.law, true);
  assert(
    countryBlocId(playerCountryId()) === "continental_union",
    "auto accession joins on final stage",
  );
  assert(!G.law.deals.fr_fta, "bilateral deals cleared on accession");
}

{
  newGame();
  G = getG();
  /* Same non-determinism as above — the two enact() calls below feed a
   * quarter-count-sensitive step() loop. */
  G.sandbox = true;
  G.lastEventQ = 1e9;
  joinBloc("continental_union", G.law);
  G.capital = 200;
  G.rel.india = 55;
  G.rel.germany = 40;
  G.rel.france = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  G.draft.blocInvite = { india: true };
  const capBefore = G.capital;
  enact();
  assert(
    !G.blocInvites || !G.blocInvites.india,
    "low member rel blocks invite enact",
  );
  assert(G.capital === capBefore, "blocked invite bill does not spend capital");
  assert(
    blocInviteBlockers("continental_union", "india").some((b) =>
      b.includes("Germany"),
    ),
    "germany blocks member-proposed invite",
  );

  G.rel.germany = 55;
  G.draft.blocInvite = { india: true };
  enact();
  assert(
    G.blocAccessionByCountry.india &&
      G.blocAccessionByCountry.india.blocId === "continental_union",
    "unanimous approval sends invite and accession begins",
  );
  let joined = false;
  for (let i = 0; i < 12; i++) {
    step(G, G.law, G.law, true);
    if (countryBlocId("india") === "continental_union") {
      joined = true;
      break;
    }
  }
  assert(joined, "india joins CU via accession after member-proposed invite");
}

{
  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  assert(
    G.world && G.world.germany && G.world.germany.econ,
    "world bags exist for partners",
  );
  assert(G.world.india && G.world.india.econ, "india world bag exists");
  assert(
    !G.world.france || G.world.france.econ === G.econ,
    "player seat is mirrored by reference, not a separate AI bag",
  );
  const access0 =
    (G.econ.partnerAccessEff && G.econ.partnerAccessEff.india) || 0;
  const tBefore = effectiveTariff("india", G.law, G.homeRole, G.blocMember);
  finalizeBlocJoin(G, "india", "continental_union", G.law);
  assert(
    countryBlocId("india") === "continental_union",
    "finalizeBlocJoin sets membership",
  );
  const tAfter = effectiveTariff("india", G.law, G.homeRole, G.blocMember);
  assert(
    tAfter < tBefore || tAfter === 0,
    "CU join zeros/cuts tariff on new member",
  );
  const access = partnerAccessTargets(G.law, G.homeRole, G.blocMember);
  assert(
    (access.india || 0) > 0,
    "player bloc access targets include new member",
  );
  assert(
    (G.econ.partnerAccessEff.india || 0) > access0,
    "player phased access moves when a partner joins the bloc",
  );
  const g0 = G.world.germany.econ.gdp;
  step(G, G.law, G.law, true);
  assert(
    G.world.germany.econ.gdp !== g0 || G.world.germany.econ._lastGrowth != null,
    "partner world bags advance with the country macro",
  );
  const snapWorld = JSON.stringify(Object.keys(G.world).sort());
  const worldGdp = G.world.germany.econ.gdp;
  project(2);
  assert(
    G.world.germany.econ.gdp === worldGdp,
    "project() does not mutate partner world bags",
  );
  assert(
    JSON.stringify(Object.keys(G.world).sort()) === snapWorld,
    "project() preserves world seat set",
  );
}

{
  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  G.sandbox = true;
  G.lastEventQ = 1e9;
  assert(
    countryBlocId(playerCountryId()) === "continental_union",
    "France starts in continental union",
  );
  assert(
    blocInviteBlockers("continental_union", "kingdom").length === 0,
    "kingdom invite clears at open as france",
  );
  G.draft.blocInvite = { kingdom: true };
  const cl = billClauses();
  assert(
    cl.some(
      (c) =>
        c.label.includes("United Kingdom") &&
        c.label.includes("European Union"),
    ),
    "staging propose kingdom adds bill clause",
  );
  G.capital = 200;
  enact();
  assert(
    G.blocAccessionByCountry.kingdom &&
      G.blocAccessionByCountry.kingdom.blocId === "continental_union",
    "france can propose and deliver kingdom invite",
  );
  G.draft.blocInvite = { kingdom: true };
  assert(
    billClauses().length === 0,
    "stale invite does not block an empty bill",
  );
  assert(
    !G.draft.blocInvite.kingdom,
    "stale staged invite cleared once accession started",
  );
}

{
  newGame();
  G = getG();
  G.q = 5;
  G.law.deals.ru_energy = true;
  G.rel.russia = 30;
  G.eventFocus = "russia";
  G.eventSponsors = ["france", "united_states"];
  const sanctions = EVENTS.find((e) => e.id === "sanctions");
  applyEventOption(sanctions.opts[0]);
  assert(
    G.rel.russia < 20,
    `sanctions against northern cut northern relations (got ${G.rel.russia})`,
  );
  assert(
    !G.law.deals.ru_energy,
    "full sanctions tear up deals with the target",
  );
}

{
  newGame();
  G = getG();
  G.sandbox = false;
  G.q = 5;
  G.law.deals.ru_energy = true;
  G.rel.russia = 30;
  G.rel.france = 55;
  G.rel.united_states = 60;
  G.eventFocus = "russia";
  G.eventSponsors = ["france", "united_states"];
  const sanctions = EVENTS.find((e) => e.id === "sanctions");
  const rel0 = clone(G.rel);
  const deals0 = clone(G.law.deals);
  const chips = immediateOptionChips(sanctions.opts[0]);
  const byName = Object.fromEntries(chips.map((c) => [c.name, c]));
  assert(
    byName["Russia relations"] && byName["Russia relations"].value <= -20,
    `join-sanctions chip names Russia (got ${JSON.stringify(chips)})`,
  );
  assert(
    byName["France relations"] && byName["France relations"].value >= 10,
    "join-sanctions chip names sponsor France",
  );
  assert(
    byName["United States relations"] &&
      byName["United States relations"].value >= 10,
    "join-sanctions chip names sponsor United States",
  );
  assert(
    JSON.stringify(G.rel) === JSON.stringify(rel0),
    "relation-chip preview does not mutate live rel",
  );
  assert(
    JSON.stringify(G.law.deals) === JSON.stringify(deals0),
    "relation-chip preview does not tear up deals",
  );
  G.sandbox = false;
  let picked = null;
  presentEventAsPress(sanctions, (o) => {
    picked = o;
  });
  const pending = (G.press || []).find((c) => c.pendingChoice);
  assert(
    pending && pending.opts && pending.opts.length,
    "event opens as a news clip with choices",
  );
  assert(
    pressChoicePending(),
    "pressChoicePending while the clip waits for an answer",
  );
  assert(
    getNewsOpen() && getPressExpanded() === pending.id,
    "event clip auto-opens the inbox",
  );
  const shown = (pending.opts[0] && pending.opts[0].immediate) || [];
  assert(
    shown.some((c) => c.name === "Russia relations" && c.value <= -20),
    "career event clip still lists relation chips",
  );
  assert(
    !pending.opts[0].chips,
    "career event clip does not attach 4-quarter forecast chips",
  );
  assert(
    discardPress(pending.id) === false,
    "cannot discard an unanswered event clip",
  );
  assert(
    closeFocusedPress() === true && getPressExpanded() === pending.id,
    "cannot dismiss an unanswered event clip",
  );
  pending.opts[0].f();
  assert(
    picked && picked.b === sanctions.opts[0].b,
    "choosing a clip option fires the callback",
  );
  assert(!pressChoicePending(), "answering clears pendingChoice");
  const archived = (G.press || []).filter((c) => c.kind === "event");
  assert(archived.length === 1, "answering does not file a second event clip");
  assert(
    /chose to join the package in full/i.test(archived[0].lede),
    "archive lede records the choice",
  );

  /* Two clips can await answers at once. A button must settle its own story:
     resolving the oldest pending clip instead would leave the other pending
     for ever, and pressChoicePending() holds Deliver shut. */
  const rowEv = EVENTS.find((e) => e.id === "tradeRow");
  let pickedA = null;
  let pickedB = null;
  presentEventAsPress(sanctions, (o) => {
    pickedA = o;
  });
  presentEventAsPress(rowEv, (o) => {
    pickedB = o;
  });
  const pendA = (G.press || []).find(
    (c) => c.pendingChoice && c.eventId === "sanctions",
  );
  const pendB = (G.press || []).find(
    (c) => c.pendingChoice && c.eventId === "tradeRow",
  );
  assert(
    pendA && pendB && pendA.id !== pendB.id,
    "two events await answers as separate clips",
  );
  pendB.opts[0].f();
  assert(pickedB && !pickedA, "only the clicked clip's callback fires");
  assert(
    !pendB.pendingChoice && pendA.pendingChoice,
    "answering settles that clip and leaves the other one pending",
  );
  assert(pressChoicePending(), "Deliver stays shut while the other clip waits");
  pendA.opts[0].f();
  assert(!pressChoicePending(), "answering the last clip lifts the block");

  /* Re-presenting an unanswered event (lockstep remount keeps the inbox)
     refreshes its clip rather than filing a rival copy. */
  presentEventAsPress(sanctions, () => {});
  const pendingCount = (G.press || []).filter((c) => c.pendingChoice).length;
  presentEventAsPress(sanctions, () => {});
  assert(
    (G.press || []).filter((c) => c.pendingChoice).length === pendingCount,
    "re-presenting an unanswered event files no second pending clip",
  );
  (G.press || []).find((c) => c.pendingChoice).opts[0].f();
  assert(!pressChoicePending(), "refreshed clip is still answerable");

  const boom = EVENTS.find((e) => e.id === "boom");
  const boomChips = immediateOptionChips(boom.opts[0]);
  assert(
    !boomChips.some((c) => /relations$/.test(c.name)),
    "domestic boom has no relation chips",
  );
}

{
  newGame();
  G = getG();
  const ids = new Set(activePartners().map((p) => p.id));
  for (let i = 0; i < 30; i++) {
    const p = pickEventPartner();
    assert(
      p && ids.has(p.id),
      `pickEventPartner stays on active seats (${p && p.id})`,
    );
  }
  G.politics = {
    [playerCountryId()]: {},
    germany: {},
  };
  for (let i = 0; i < 20; i++) {
    const p = pickEventPartner({ scriptable: true });
    assert(
      p && p.id !== "germany" && p.id !== playerCountryId(),
      `scriptable pick skips human MP seats (${p && p.id})`,
    );
  }
}

/* Fertility channel: childcare raises births; child stock moves before L. */
{
  newGame();
  G = getG();
  const fertLaw = clone(G.law);
  fertLaw.childcare.subsidyPct = 100;
  const path = simulate(fertLaw, 16);
  newGame();
  G = getG();
  const basePath = simulate(G.law, 16);
  assert(
    path.end.econ.popChild > basePath.end.econ.popChild + 0.15,
    `childcare fertility raises popChild (${path.end.econ.popChild.toFixed(2)} vs ${basePath.end.econ.popChild.toFixed(2)})`,
  );
  assert(
    aggregate(fertLaw).fertility > 0,
    "childcare exposes a fertility channel",
  );
}

/* Housing crash scars banks and investment via credit spreads. */
{
  newGame();
  G = getG();
  step(G, G.law, G.law, true);
  G.econ.housePrice = 62;
  G.econ.mortgageDebt = 95;
  const spreadAfter = [];
  const iAfter = [];
  for (let i = 0; i < 8; i++) {
    step(G, G.law, G.law, true);
    spreadAfter.push(G.econ.creditSpread);
    iAfter.push(G.econ.I);
  }
  newGame();
  G = getG();
  for (let i = 0; i < 9; i++) step(G, G.law, G.law, true);
  const peakSpread = Math.max(...spreadAfter);
  const meanI = iAfter.reduce((a, b) => a + b, 0) / iAfter.length;
  assert(
    peakSpread > G.econ.creditSpread + 0.04,
    `house-price crash lifts credit spread (peak ${peakSpread.toFixed(3)} vs baseline ${G.econ.creditSpread.toFixed(3)})`,
  );
  assert(
    meanI < G.econ.I - 0.05,
    `credit scarring cuts investment vs baseline (mean ${meanI.toFixed(2)} vs ${G.econ.I.toFixed(2)})`,
  );
}

/* Endogenous bank stress fires without the scripted bank event. */
{
  newGame();
  G = getG();
  G.econ.bankCapital = 4.2;
  G.econ.bankLoans = 130;
  G.econ.bankStressCd = 0;
  G.econ.bankStress = false;
  step(G, G.law, G.law, false);
  assert(
    G.econ.bankStress,
    "endogenous bankStress fires on thin capital / high leverage",
  );
  assert(
    G.econ.creditSpread >= 1.5,
    `stressed credit floor (got ${G.econ.creditSpread.toFixed(2)})`,
  );
  const bankEv = EVENTS.find((e) => e.id === "bank");
  assert(
    bankEv && !bankEv.cond(),
    "scripted bank event gated while stressed / on cooldown",
  );
}

/* Sandbox impact exposes trend and potential. */
{
  newGame();
  G = getG();
  G.sandbox = true;
  const draft = clone(G.law);
  draft.spend.research += 1.5;
  const im = impactOf(draft, simulate(G.law, 4), 4);
  assert(im.head.trend != null, "impact reports trend growth");
  assert(im.head.potential != null, "impact reports potential");
  assert(
    im.head.trend > 0.01 || im.head.potential > 0.05,
    `research lift raises trend or potential (trend ${im.head.trend}, pot ${im.head.potential})`,
  );
}

/* Named blocs use real-world labels; membership matches the board. */
{
  newGame();
  G = getG();
  assert(
    BLOC_TEMPLATES.continental_union.name === "European Union",
    "EU uses its real name",
  );
  assert(
    BLOC_TEMPLATES.pacific_accord.name === "CPTPP",
    "CPTPP uses its real name",
  );
  assert(
    BLOC_TEMPLATES.gulf_council.name === "Gulf Cooperation Council",
    "GCC uses its real name",
  );
  assert(
    BLOC_TEMPLATES.andes_pact.name === "Mercosur",
    "Mercosur uses its real name",
  );
  assert(
    BLOC_TEMPLATES.asean_circle.name === "ASEAN",
    "ASEAN uses its real name",
  );
  assert(
    countryBlocId("mexico") == null && countryBlocId("korea") == null,
    "Mexico and Korea start unaligned",
  );
  assert(
    countryBlocId("brazil") === "andes_pact" &&
      countryBlocId("argentina") === "andes_pact",
    "Mercosur is Brazil and Argentina",
  );
  assert(
    countryBlocId("japan") === "pacific_accord" &&
      countryBlocId("australia") === "pacific_accord",
    "CPTPP opening members are Japan and Australia",
  );
  assert(
    !BLOC_TEMPLATES.pacific_accord.members.includes("korea") &&
      !BLOC_TEMPLATES.andes_pact.members.includes("mexico"),
    "Korea is not CPTPP; Mexico is not Mercosur",
  );
}

/* Tariff schedule and bloc membership. */
{
  newGame();
  G = getG();
  /* This block's enact() calls (Deliver a Leave clause, apply to rejoin)
   * fall through to the ordinary solo quarter-advance, which adds demand
   * noise unless sandbox is on — newGame() defaults to sandbox off — and,
   * separately, can roll a genuine random EVENTS entry once the 4-quarter
   * cooldown clears (rollEvent() gates on G.lastEventQ, not sandbox; a 20%
   * roll fires regardless of it). A fired event opens a news clip instead of
   * calling proceed(), so G.q silently stops advancing on that enact() call
   * — this test never answers the clip, so it just drifted from what
   * the accession pipeline below expected. Push lastEventQ out of reach so
   * the cooldown never clears across this block's ~7 quarters. */
  G.sandbox = true;
  G.lastEventQ = 1e9;
  G.law.tariffSchedule.bloc.continental_union = 4;
  assert(
    Math.abs(effectiveTariff("germany", G.law) - 4) < 0.01,
    "bloc member uses bloc tariff rate",
  );
  G.law.tariffSchedule.country.germany = 18;
  assert(
    Math.abs(effectiveTariff("germany", G.law) - 18) < 0.01,
    "country rate on a foreign-bloc partner overrides the bloc rate",
  );
  delete G.law.tariffSchedule.country.germany;
  assert(
    effectiveTariff("india", G.law) === G.law.tariffSchedule.default,
    "non-bloc partner uses default schedule",
  );
  joinBloc("continental_union", G.law);
  assert(
    effectiveTariff("germany", G.law) === 0,
    "customs union internal tariff is zero",
  );
  assert(
    !joinBloc("pacific_accord", G.law),
    "exclusive membership blocks second bloc join",
  );
  leaveBloc(G.law);
  assert(!countryBlocId(playerCountryId()), "leaveBloc clears membership");
  assert(G.law.tariffSchedule.cet == null, "leaving CU clears CET");
  assert(
    (G.diploAlerts || []).some((a) => a.kind === "bloc_self_left"),
    "leaving posts a leave alert",
  );
  {
    const fresh = diploOutcomeAlertsForBrief(G.diploAlerts, G.q);
    const leaveClips1 = composePress({ ultimatumOutcomes: fresh, q: G.q });
    assert(
      leaveClips1.some((c) => /leaves/i.test(c.headline)),
      "leave produces a press clip",
    );
    markDiploAlertsNoted(fresh);
    G.q = (G.q || 0) + 1;
    assert(
      diploOutcomeAlertsForBrief(G.diploAlerts, G.q).length === 0,
      "noted leave alert does not reappear next quarter",
    );
  }

  /* Deliver path: stage Leave in the bill and enact. */
  joinBloc("continental_union", G.law);
  G.capital = 200;
  G.draft = clone(G.law);
  G.draft.blocLeave = true;
  assert(
    billClauses().some((c) => /^Leave /.test(c.label)),
    "leave stages as a bill clause",
  );
  enact();
  assert(!countryBlocId(playerCountryId()), "enacting Leave clears membership");
  assert(G.law.tariffSchedule.cet == null, "enacting Leave clears CET");
  assert(!G.draft.blocLeave, "leave flag cleared after enact");

  createCustomBloc("Northern League", "shallow_fta");
  const blocId = countryBlocId(playerCountryId());
  assert(!!G.customBlocs[blocId], "player can found a custom alliance");
  inviteToBloc("india", blocId);
  G.rel.india = 55;
  step(G, G.law, G.law, true);
  assert(!countryBlocId("india"), "invite does not instant-join");
  assert(
    G.blocAccessionByCountry.india && G.blocAccessionByCountry.india.step === 1,
    "warm relations start accession pipeline",
  );
  assert(
    (G.diploAlerts || []).some(
      (a) =>
        a.kind === "bloc_invite_accept" &&
        a.partnerId === "india" &&
        a.blocId === blocId,
    ),
    "founding country gets a press alert when an invited country accepts",
  );
  let customJoined = false;
  for (let i = 0; i < 10; i++) {
    step(G, G.law, G.law, true);
    if (countryBlocId("india") === blocId) {
      customJoined = true;
      break;
    }
  }
  assert(customJoined, "india joins custom bloc after accession pipeline");
  assert(
    (G.diploAlerts || []).some(
      (a) =>
        a.kind === "bloc_member_joined" &&
        a.partnerId === "india" &&
        a.blocId === blocId,
    ),
    "founding country is notified when invitee becomes a full member",
  );
  {
    const joinClips = composePress({
      ultimatumOutcomes: diploOutcomeAlertsForBrief(G.diploAlerts, G.q),
      q: G.q,
    });
    assert(
      joinClips.some(
        (c) => /joins/i.test(c.headline) && /India/i.test(c.headline + c.lede),
      ),
      "full membership produces a newspaper clip for the inviter",
    );
  }
  /* Regression: leaving a founded custom bloc must remove the founder from
   * customBlocs[blocId].members, and the founder must be able to rejoin
   * via the 3-stage bloc accession flow. */
  const playerId = playerCountryId();
  assert(
    G.customBlocs[blocId].members.includes(playerId),
    "founder is tracked as a member",
  );
  leaveBloc(G.law);
  assert(!countryBlocId(playerId), "founder left the custom bloc");
  assert(
    !G.customBlocs[blocId].members.includes(playerId),
    "leaving removes founder from customBlocs[blocId].members",
  );

  G.capital = 200;
  G.draft = clone(G.law);
  G.draft.blocAccession = { blocId, phase: "apply" };
  enact();
  assert(
    G.blocAccessionByCountry &&
      G.blocAccessionByCountry[playerId] &&
      G.blocAccessionByCountry[playerId].step === 1,
    "custom application advances to step 1",
  );

  step(G, G.law, G.law, true);
  assert(
    G.blocAccessionByCountry[playerId] &&
      G.blocAccessionByCountry[playerId].step === 2,
    "custom alignment advances to step 2 automatically",
  );

  step(G, G.law, G.law, true);
  assert(
    countryBlocId(playerId) === blocId,
    "custom accession treaty rejoins the bloc automatically",
  );
  assert(
    G.customBlocs[blocId].members.includes(playerId),
    "rejoining restores founder in members list",
  );
  const snap = clone(G.blocMember);
  project(2);
  assert(
    JSON.stringify(G.blocMember) === JSON.stringify(snap),
    "project() preserves blocMember",
  );

  leaveBloc(G.law);
  assert(!countryBlocId(playerId), "founder can leave again after rejoin");
  assert(!!G.customBlocs[blocId], "bloc survives while other members remain");

  newGame();
  G = getG();
  createCustomBloc("Solo League", "shallow_fta");
  const soloId = countryBlocId(playerCountryId());
  leaveBloc(G.law);
  assert(!G.customBlocs[soloId], "solo custom bloc dissolved on leave");
}

/* Trade-weighted import tariff feeds inflation symmetrically. */
{
  newGame();
  G = getG();
  const baseFta = simulate(G.law, 20);
  const importBase = baseFta.end.econ.importTariff;

  newGame();
  G = getG();
  G.rel.france = 60;
  G.law.deals.fr_fta = true;
  const ftaSim = simulate(G.law, 20);
  const importDeal = ftaSim.end.econ.importTariff;
  assert(
    importDeal < importBase - 0.5,
    `FTA lowers phased import tariff level (${importDeal.toFixed(2)} vs ${importBase.toFixed(2)})`,
  );

  newGame();
  G = getG();
  const E0 = aggregate(G.law);
  const beforeCu = importTariffLevel(
    G.law,
    E0,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  joinBloc("continental_union", G.law);
  const E1 = aggregate(G.law);
  const afterCu = importTariffLevel(
    G.law,
    E1,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  assert(
    afterCu < beforeCu - 0.3,
    `CU join lowers trade-weighted import tariff (${afterCu.toFixed(2)} vs ${beforeCu.toFixed(2)})`,
  );

  newGame();
  G = getG();
  const baseTar = simulate(G.law, 1);
  newGame();
  G = getG();
  const hikeLaw = clone(G.law);
  hikeLaw.tariffSchedule.default = 12;
  const hitTar = simulate(hikeLaw, 1);
  assert(
    hitTar.rows[0].inflation > baseTar.rows[0].inflation,
    `tariff schedule hike lifts first-quarter inflation (${hitTar.rows[0].inflation.toFixed(2)} vs ${baseTar.rows[0].inflation.toFixed(2)})`,
  );

  newGame();
  G = getG();
  const baseQ1 = simulate(G.law, 1);
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.law.tariffSchedule.cet = 4;
  const cuQ1 = simulate(G.law, 1, { blocMember: G.blocMember });
  assert(
    cuQ1.rows[0].inflation <= baseQ1.rows[0].inflation + 0.05,
    `CU join does not spike Q1 inflation (${cuQ1.rows[0].inflation.toFixed(2)} vs ${baseQ1.rows[0].inflation.toFixed(2)})`,
  );

  newGame();
  G = getG();
  G.law.deals.fr_fta = true;
  step(G, G.law, G.law, true);
  const ftaAccess =
    (G.econ.partnerAccessEff && G.econ.partnerAccessEff.france) || 0;
  assert(
    ftaAccess < (DEAL_BY_ID.fr_fta.ch.access || 0),
    `FTA partner access phases in (${ftaAccess.toFixed(2)} vs ${DEAL_BY_ID.fr_fta.ch.access})`,
  );

  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.law.tariffSchedule.cet = 4;
  step(G, G.law, G.law, true);
  const cuAccessQ1 =
    (G.econ.partnerAccessEff && G.econ.partnerAccessEff.germany) || 0;
  const Ecu = aggregate(G.law, G.homeRole, G.blocMember);
  const targetDe = (Ecu.partnerAccess && Ecu.partnerAccess.germany) || 0;
  assert(
    cuAccessQ1 < targetDe * 0.2,
    `CU partner access is small in Q1 (${cuAccessQ1.toFixed(2)} of ${targetDe.toFixed(1)} target)`,
  );
  const cu40 = simulate(G.law, 40, { blocMember: G.blocMember });
  const cuAccess40 =
    (cu40.end.econ.partnerAccessEff &&
      cu40.end.econ.partnerAccessEff.germany) ||
    0;
  assert(
    cuAccess40 > targetDe * 0.5,
    `CU partner access passes halfway by ~40q (${cuAccess40.toFixed(2)} of ${targetDe.toFixed(1)})`,
  );

  newGame();
  G = getG();
  const base20 = simulate(G.law, 20);
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.law.tariffSchedule.cet = 4;
  const cu20 = simulate(G.law, 20, { blocMember: G.blocMember });
  assert(
    cu20.end.econ.tradeDepth > base20.end.econ.tradeDepth + 5,
    `CU join raises trade depth over 20q (${cu20.end.econ.tradeDepth.toFixed(1)} vs ${base20.end.econ.tradeDepth.toFixed(1)})`,
  );
  assert(
    cu20.end.econ.A > base20.end.econ.A,
    `CU join lifts TFP stock over 20q (${cu20.end.econ.A.toFixed(4)} vs ${base20.end.econ.A.toFixed(4)})`,
  );
}

/* Symmetric multi-country: partner macros, accession trade feedback, EUR area rates. */
{
  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  assert(currencyForSeat("france") === "EUR", "France is EUR");
  assert(currencyForSeat("germany") === "EUR", "Germany is EUR");
  const deRate0 = G.world.germany.econ.rate;
  const itRate0 = G.world.italy.econ.rate;
  for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.world.germany.econ.rate - G.world.italy.econ.rate) < 1.5,
    `EUR members share a rate band (DE ${G.world.germany.econ.rate.toFixed(2)} vs IT ${G.world.italy.econ.rate.toFixed(2)}; open ${deRate0.toFixed(2)}/${itRate0.toFixed(2)})`,
  );

  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  const baseDE = [];
  const baseIN = [];
  for (let i = 0; i < 8; i++) {
    step(G, G.law, G.law, true);
    baseDE.push(G.world.germany.econ._lastGrowth);
    baseIN.push(G.world.india.econ._lastGrowth);
  }
  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  finalizeBlocJoin(G, "india", "continental_union", G.law);
  const joinDE = [];
  const joinIN = [];
  for (let i = 0; i < 8; i++) {
    step(G, G.law, G.law, true);
    joinDE.push(G.world.germany.econ._lastGrowth);
    joinIN.push(G.world.india.econ._lastGrowth);
  }
  const avg = (a) => a.reduce((s, v) => s + (v || 0), 0) / a.length;
  assert(
    avg(joinIN) > avg(baseIN) - 0.05,
    `india growth after CU join not worse than outsider path (${avg(joinIN).toFixed(3)} vs ${avg(baseIN).toFixed(3)})`,
  );
  assert(
    avg(joinDE) > avg(baseDE) - 0.08,
    `germany growth with india in CU not sharply worse (${avg(joinDE).toFixed(3)} vs ${avg(baseDE).toFixed(3)})`,
  );
  assert(
    effectiveTariff("india", G.law, G.homeRole, G.blocMember) === 0,
    "internal CU tariff on india is zero",
  );
}

/* FX exposure, currency metadata, and USD GDP valuation. */
{
  clearOpeningCache();
  for (const id of Object.keys(NATION_PROFILE)) {
    assert(
      typeof NATION_PROFILE[id].currency === "string" &&
        NATION_PROFILE[id].currency.length === 3,
      `${id} has a 3-letter currency code`,
    );
  }
  assert(NATION_PROFILE.kingdom.currency === "GBP", "UK currency is GBP");
  assert(NATION_PROFILE.japan.currency === "JPY", "Japan currency is JPY");
  assert(NATION_PROFILE.germany.currency === "EUR", "Germany currency is EUR");
  assert(NATION_PROFILE.united_states.currency === "USD", "US currency is USD");
  assert(currencyForSeat("home") === "GBP", "home seat currency GBP");
  assert(currencyForSeat("japan") === "JPY", "japan seat currency JPY");
  assert(currencyForSeat("brazil") === "BRL", "brazil seat currency BRL");
  assert(
    IMPACT_ROWS.some((r) => r.k === "fx"),
    "sandbox IMPACT_ROWS includes currency strength",
  );

  newGame();
  G = getG();
  assert(G.econ.fx0 != null && G.econ.fx0 > 0, "home fx0 pinned after settle");
  assert(
    Math.abs(fxDisplayIndex("home", G) - 100) < 0.05,
    "currency strength opens at 100",
  );
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.kingdom.gdp0) < 0.5,
    "home USD GDP opens at gdp0 after FX normalisation",
  );
  assert(
    Math.abs(
      realmGdpBn("united_states", G) - NATION_PROFILE.united_states.gdp0,
    ) < 0.5,
    "partner USD GDP opens at gdp0 after FX normalisation",
  );
  assert(
    Math.abs(realmGdpBn("japan", G) - NATION_PROFILE.japan.gdp0) < 0.5,
    "japan partner USD GDP opens at gdp0",
  );
  for (const id of ["germany", "japan", "brazil"]) {
    const n = G.econ.nations[id];
    assert(n && n.fx != null && n.fx0 != null, `${id} has partner FX state`);
  }

  const gdpBefore = realmGdpBn("home", G);
  const fx0 = G.econ.fx0;
  G.econ.fx = fx0 * 0.9;
  const gdpAfter = realmGdpBn("home", G);
  assert(
    Math.abs(gdpAfter / gdpBefore - 0.9) < 0.01,
    `10% depreciation cuts USD GDP ~10% (got ${(gdpAfter / gdpBefore).toFixed(3)})`,
  );
  assert(
    Math.abs(fxDisplayIndex("home", G) - 90) < 0.05,
    "fxDisplayIndex tracks depreciation",
  );
  G.econ.fx = fx0;

  const gerFx0 = G.econ.nations.germany.fx;
  G.econ.nations.germany.deficit = 14;
  G.econ.nations.germany.debt = NATION_PROFILE.germany.debt0 + 50;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.nations.germany.fx - gerFx0) > 0.004,
    `partner FX moves under fiscal stress (got ${G.econ.nations.germany.fx.toFixed(4)} from ${gerFx0.toFixed(4)})`,
  );
  assert(
    G.log[G.log.length - 1].fx != null,
    "quarterly log records currency strength",
  );

  newGame({
    homeRole: "brazil",
    homeIso: "076",
    country: "Atlantic Federation",
  });
  G = getG();
  assert(currencyForSeat(G.homeRole) === "BRL", "Brazil seat shows BRL");
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.brazil.gdp0) < 0.5,
    "Brazil USD GDP opens at gdp0",
  );
  const brBefore = realmGdpBn("home", G);
  G.econ.fx = G.econ.fx0 * 0.88;
  assert(
    Math.abs(realmGdpBn("home", G) / brBefore - 0.88) < 0.01,
    "Brazil depreciation shrinks USD GDP",
  );

  newGame({
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  assert(G.econ.fxUip < 0.02, `US fxUip stays damped (got ${G.econ.fxUip})`);
  assert(currencyForSeat(G.homeRole) === "USD", "US seat currency is USD");
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.united_states.gdp0) < 1,
    "US USD GDP opens at gdp0",
  );
  const usFx = G.econ.fx;
  for (let i = 0; i < 8; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.fx / usFx - 1) < 0.08,
    `US currency barely drifts over 8q (${G.econ.fx.toFixed(4)} vs ${usFx.toFixed(4)})`,
  );
}

/* World shocks pulse bilateral exports, not only the rest residual. */
{
  newGame();
  G = getG();
  for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
  const baseX = [];
  for (let i = 0; i < 6; i++) {
    step(G, G.law, G.law, true);
    baseX.push(G.econ.acct.X);
  }
  newGame();
  G = getG();
  for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
  const major = EVENTS.find((e) => e.id === "globalRecess");
  applyEventOption(major.opts[0]);
  beginEpisode(major, major.opts[0]);
  const hitX = [];
  const hitG = [];
  for (let i = 0; i < 6; i++) {
    const r = step(G, G.law, G.law, true);
    hitX.push(G.econ.acct.X);
    hitG.push(r.growth);
  }
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert(
    avg(hitX) < avg(baseX) - 0.35,
    `global recess cuts exports (base X ${avg(baseX).toFixed(2)} → ${avg(hitX).toFixed(2)})`,
  );
  assert(
    avg(hitG) < 0.55,
    `global recess weighs on growth (avg ${avg(hitG).toFixed(2)})`,
  );
}

/* Relative income updates with potential so catch-up is not permanent. */
{
  newGame();
  G = getG();
  assert(
    G.econ.yRel0 != null && G.econ.potential0 != null,
    "home pins yRel0 / potential0",
  );
  const cn0 = G.world.china.econ.yRel;
  const catch0 = (() => {
    const y = cn0;
    return 2.15 * Math.max(0, Math.log(1 / Math.max(0.08, y)));
  })();
  for (let i = 0; i < 80; i++) step(G, G.law, G.law, true);
  const cn1 = G.world.china.econ.yRel;
  assert(
    cn1 > cn0 + 0.03,
    `china yRel rises as it outgrows the frontier (${cn0.toFixed(3)} → ${cn1.toFixed(3)})`,
  );
  const catch1 = 2.15 * Math.max(0, Math.log(1 / Math.max(0.08, cn1)));
  assert(
    catch1 < catch0 - 0.05,
    `china catch-up TFP fades as yRel rises (${catch0.toFixed(2)} → ${catch1.toFixed(2)})`,
  );
}

/* High-debt AI seats consolidate before the books explode. */
{
  newGame();
  G = getG();
  const jp = G.world.japan;
  const spend0 = jp.law.spend.health + jp.law.spend.welfare;
  for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
  const spend1 =
    G.world.japan.law.spend.health + G.world.japan.law.spend.welfare;
  assert(
    spend1 < spend0 - 0.3 || G.world.japan.econ.debt < 380,
    `japan fiscal rule tightens spend or holds debt off the clamp (spend ${spend0.toFixed(1)}→${spend1.toFixed(1)}, debt ${G.world.japan.econ.debt.toFixed(0)})`,
  );
  assert(
    G.world.japan.econ.gdp > 70,
    `japan does not collapse to a rump economy (gdp index ${G.world.japan.econ.gdp.toFixed(1)})`,
  );
}

/* AI seats defend both sides of their debt band over a long run. */
{
  newGame();
  G = getG();
  for (let i = 0; i < 80; i++) step(G, G.law, G.law, true);
  for (const id of ["germany", "france", "united_states", "japan", "china"]) {
    const e = G.world[id].econ;
    const anchor =
      e.debtAnchor != null ? e.debtAnchor : NATION_PROFILE[id].debt0;
    const target = Math.min(260, Math.max(50, anchor));
    const bandHi = target + Math.min(30, 14 + target * 0.14);
    const bandLo = target - Math.min(22, 12 + target * 0.12);
    assert(
      e.debt < bandHi + 35,
      `AI ${id} stays near its debt band (debt ${e.debt.toFixed(0)}, bandHi ${bandHi.toFixed(0)}, anchor ${anchor})`,
    );
    assert(
      e.debt > Math.min(bandLo, 0) - 80,
      `AI ${id} does not run away to a huge creditor position (debt ${e.debt.toFixed(0)}, bandLo ${bandLo.toFixed(0)})`,
    );
  }
}

/* ---- Diplomacy dock tab ---- */
{
  const ids = TABS.map((t) => t.id);
  const tradeAt = ids.indexOf("trade");
  const diploAt = ids.indexOf("diplomacy");
  assert(
    tradeAt >= 0 && diploAt === tradeAt + 1,
    "Diplomacy tab sits next to Trade",
  );
  assert(TABS[diploAt].icon === "seal", "Diplomacy uses the seal dock icon");
  newGame();
  G = getG();
  G.draft.missions = { france: "summit" };
  const cl = billClauses();
  assert(clausesIn("diplomacy", cl), "staged mission pips the Diplomacy tab");
  assert(!clausesIn("trade", cl), "staged mission does not pip Trade");
}

/* ---- Diplomacy modifiers, envoys, ultimatums ---- */
{
  newGame();
  G = getG();
  assert(
    G.econ.relBase && G.econ.relBase.canada != null,
    "relBase seeded on newGame",
  );
  assert(Array.isArray(G.envoys) && G.envoys.length === 2, "two envoy slots");
  assert(
    MUTABLE.includes("envoys") && MUTABLE.includes("ultimatums"),
    "envoys/ultimatums on MUTABLE",
  );

  const modsCa = relationModifiers("canada");
  const baseLine = modsCa.find((m) => m.kind === "base");
  assert(
    baseLine && baseLine.pts === G.econ.relBase.canada,
    "Canada base line equals relBase",
  );
  assert(
    modsCa.some((m) =>
      /Similar governments|Polity affinity|Regime clash/.test(m.label),
    ),
    "polity affinity appears on Canada",
  );

  G.law.deals.fr_fta = true;
  G.draft.deals.fr_fta = true;
  assert(
    relationModifiers("france").some(
      (m) => m.label === "Ratified deals" && m.pts >= 9,
    ),
    "ratified deal shows +9 live modifier",
  );

  const openCa = G.rel.canada;
  for (let i = 0; i < 40; i++) step(G, G.law, G.prevLaw, true);
  assert(
    Math.abs(G.rel.canada - openCa) < 4 && G.rel.canada > 55,
    `quiet Canada stays near special relationship (${openCa.toFixed(1)} → ${G.rel.canada.toFixed(1)})`,
  );
  assert(
    relationModifiers("france").some((m) => m.label === "Ratified deals"),
    "active deal does not decay over 40q",
  );
  delete G.law.deals.fr_fta;
  delete G.draft.deals.fr_fta;
  step(G, G.law, G.prevLaw, true);
  assert(
    !relationModifiers("france").some((m) => m.label === "Ratified deals"),
    "withdrawn deal clears live bonus next step",
  );
}

{
  newGame();
  G = getG();
  const openRu = G.rel.russia;
  const baseRu = G.econ.relBase.russia;
  for (let i = 0; i < 40; i++) step(G, G.law, G.prevLaw, true);
  assert(
    G.rel.russia < 48 &&
      Math.abs(G.rel.russia - relationTarget("russia")) < 1.5,
    `Russia stays cool near its target (open ${openRu}, base ${baseRu.toFixed(1)}, now ${G.rel.russia.toFixed(1)})`,
  );
  assert(
    !(G.econ.diploLedger.russia || []).length,
    "quiet Russia has no historic ledger entry inventing the chill",
  );
}

{
  newGame();
  G = getG();
  G.capital = 80;
  const cap0 = G.capital;
  assert(assignEnvoy("france"), "assign envoy succeeds with capital");
  assert(
    G.capital === cap0 - ENVOY_ASSIGN_PC,
    "envoy assign spends capital immediately",
  );
  assert(G.envoys.includes("france"), "france occupies an envoy slot");
  const envoyCl = billClauses().find((c) => /envoy/i.test(c.label));
  assert(envoyCl, "same-quarter envoy assign appears as a Programme clause");
  assert(envoyCl.sunk, "envoy capital already paid is marked sunk");
  assert(envoyCl.executive, "posting an envoy is executive");
  assert(
    billVoteData() && !billVoteData().needed,
    "an envoy alone does not go to the chamber",
  );
  assert(
    billClauses().every((c) => c.sunk || !c.pc),
    "sunk envoy does not add unpaid capital to the Programme",
  );
  assert(
    relationModifiers("france").some(
      (m) => m.label === "Envoy posted" && m.pts === ENVOY_TARGET,
    ),
    "envoy posts +2 live modifier",
  );
  for (let i = 0; i < 12; i++) step(G, G.law, G.prevLaw, true);
  assert(
    relationModifiers("france").some((m) => m.label === "Envoy posted"),
    "active envoy does not decay",
  );
  recallEnvoy("france");
  step(G, G.law, G.prevLaw, true);
  assert(
    !relationModifiers("france").some((m) => m.label === "Envoy posted"),
    "recall clears envoy bonus next step",
  );

  G.capital = ENVOY_ASSIGN_PC - 1;
  assert(!assignEnvoy("germany"), "envoy assign no-ops when capital is short");
}

{
  newGame();
  G = getG();
  G.capital = 80;
  const rel0 = G.rel.france;
  const target0 = relationTarget("france");
  assert(assignEnvoy("france"), "post envoy to france");
  assert(
    Math.abs(relationTarget("france") - (target0 + ENVOY_TARGET)) < 0.05,
    "assign adds the +2 presence immediately",
  );
  for (let i = 0; i < 8; i++) step(G, G.law, G.prevLaw, true);
  const built = G.econ.envoyBuild.france;
  assert(
    Math.abs(built - 8 * ENVOY_DRIFT) < 1e-9,
    `envoyBuild grows ${ENVOY_DRIFT}/q while posted (got ${built})`,
  );
  const good = relationModifiers("france").find(
    (m) => m.label === "Envoy goodwill",
  );
  assert(
    good && Math.abs(good.pts - built) < 1e-9,
    "envoy goodwill appears as a live modifier",
  );
  assert(
    G.rel.france > rel0 + ENVOY_TARGET,
    `relations keep improving while posted (${rel0.toFixed(1)} → ${G.rel.france.toFixed(1)})`,
  );
  recallEnvoy("france");
  step(G, G.law, G.prevLaw, true);
  assert(
    Math.abs((G.econ.envoyBuild.france || 0) - built) < 1e-9,
    "goodwill stock is kept after recall",
  );
  assert(
    relationModifiers("france").some((m) => m.label === "Envoy goodwill"),
    "built goodwill remains after recall",
  );
  assert(
    !relationModifiers("france").some((m) => m.label === "Envoy posted"),
    "presence bonus clears on recall",
  );
  assert(assignEnvoy("france"), "re-post france");
  for (let i = 0; i < 40; i++) step(G, G.law, G.prevLaw, true);
  assert(
    G.econ.envoyBuild.france <= ENVOY_BUILD_CAP + 1e-9,
    "envoy goodwill caps",
  );
  assert(
    Math.abs(G.econ.envoyBuild.france - ENVOY_BUILD_CAP) < 1e-9,
    "long posting sits on the cap",
  );
}

{
  newGame();
  G = getG();
  G.capital = 80;
  assert(assignEnvoy("france"), "first envoy slot fills");
  assert(assignEnvoy("germany"), "second envoy slot fills");
  assert(!assignEnvoy("japan"), "third envoy assign rejected when slots full");
  assert(
    !G.envoys.includes("japan"),
    "full slots do not overwrite an existing envoy",
  );
  assert(
    G.envoys.includes("france") && G.envoys.includes("germany"),
    "prior envoys retained",
  );
}

{
  newGame();
  G = getG();
  G.capital = 80;
  assert(assignEnvoy("france"), "assign france");
  const capAfter = G.capital;
  assert(assignEnvoy("france"), "duplicate assign is idempotent success");
  assert(
    G.capital === capAfter,
    "idempotent assign does not re-charge capital",
  );
  assert(recallEnvoy("france"), "recall france");
  assert(!G.envoys.includes("france"), "slot vacated");
  assert(recallEnvoy("france"), "duplicate recall is idempotent success");
}

{
  newGame();
  G = getG();
  G.q = 5;
  G.rel.russia = 30;
  G.eventFocus = "russia";
  G.eventSponsors = ["france", "united_states"];
  const sanctions = EVENTS.find((e) => e.id === "sanctions");
  applyEventOption(sanctions.opts[0]);
  assert(
    G.econ.sanctionStance.russia && G.econ.sanctionStance.russia.against,
    "sanctions set against stance",
  );
  assert(
    (G.econ.diploLedger.russia || []).some(
      (x) => /Joined sanctions/.test(x.label) && x.pts < 0,
    ),
    "sanctions against add negative ledger",
  );
  assert(
    G.econ.sanctionStance.france && G.econ.sanctionStance.france.with,
    "sponsors get with stance",
  );
  assert(
    (G.econ.diploLedger.france || []).some(
      (x) => /Stood with them/.test(x.label) && x.pts > 0,
    ),
    "sponsors get positive ledger credit",
  );
}

{
  newGame();
  G = getG();
  G.law.deals.mx_trade = true;
  G.draft.deals.mx_trade = true;
  applySphereTrespassOnDeal("mx_trade", true);
  assert(
    relationModifiers("united_states").some((m) =>
      /Encroaching on their sphere/.test(m.label),
    ),
    "Mexico deal puts live US sphere trespass",
  );
  assert(
    (G.econ.diploLedger.united_states || []).some(
      (x) => /sphere/i.test(x.id) || /sphere/i.test(x.label),
    ),
    "sphere trespass writes a ledger scar on the patron",
  );
  const scar0 = (G.econ.diploLedger.united_states || []).find((x) =>
    String(x.id).includes("sphere"),
  );
  const pts0 = scar0 && scar0.pts;
  for (let i = 0; i < 8; i++) step(G, G.law, G.prevLaw, true);
  assert(
    relationModifiers("united_states").some((m) =>
      /Encroaching on their sphere/.test(m.label),
    ),
    "live sphere trespass persists while the deal stands",
  );
  delete G.law.deals.mx_trade;
  delete G.draft.deals.mx_trade;
  step(G, G.law, G.prevLaw, true);
  assert(
    !relationModifiers("united_states").some((m) =>
      /Encroaching on their sphere/.test(m.label),
    ),
    "withdraw clears live sphere trespass",
  );
  const scar1 = (G.econ.diploLedger.united_states || []).find((x) =>
    String(x.id).includes("sphere"),
  );
  assert(
    scar1 && Math.abs(scar1.pts) < Math.abs(pts0),
    "sphere ledger scar decays over quarters",
  );
}

{
  newGame();
  G = getG();
  G.law.polity = "authoritarian";
  assert(
    relationModifiers("canada").some(
      (m) => m.label === "Regime clash" && m.pts < 0,
    ),
    "democracy→authoritarian shows Regime clash vs Canada",
  );

  newGame();
  G = getG();
  const align0 = relationModifiers("canada").find((m) =>
    /Policy align|Policy diverge/.test(m.label),
  );
  assert(
    align0 && align0.pts > 0,
    "policy alignment positive at opening vs Canada",
  );
  // Force divergence across the watchlist so the live line stays visible.
  for (const k of [
    "closeBorders",
    "openVisas",
    "netZero",
    "nuclear",
    "conscript",
    "fracking",
    "digitalId",
    "minWage",
    "fiscalRule",
    "rnd",
    "swf",
  ]) {
    G.law.policies[k] = !G.world.canada.law.policies[k];
  }
  G.draft.policies = Object.assign({}, G.law.policies);
  const align1 = relationModifiers("canada").find((m) =>
    /Policy align|Policy diverge/.test(m.label),
  );
  assert(
    align1 && align1.pts < 0,
    "policy divergence line present after watchlist flip",
  );
  assert(
    align1.pts < align0.pts,
    `policy divergence lowers alignment (${align0.pts.toFixed(1)} → ${align1.pts.toFixed(1)})`,
  );
}

{
  newGame();
  G = getG();
  addDiploLedger(G, "germany", {
    id: "test_scar",
    label: "Test grievance",
    pts: -10,
  });
  const p0 = G.econ.diploLedger.germany[0].pts;
  step(G, G.law, G.prevLaw, true);
  const p1 = G.econ.diploLedger.germany[0].pts;
  assert(
    Math.abs(p1 - p0 * LEDGER_DECAY) < 0.01,
    `ledger decays at ${LEDGER_DECAY}/q (${p0.toFixed(2)} → ${p1.toFixed(2)})`,
  );
}

{
  newGame();
  G = getG();
  G.draft.missions = { china: "demarche" };
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    (G.econ.diploLedger.china || []).some(
      (x) => /Formal protest/.test(x.label) && x.pts === -3,
    ),
    "demarche adds named grievance ledger entry (−3)",
  );
  assert(
    (G.econ.relImpulse.china || 0) === -5,
    "demarche applies −5 relImpulse",
  );
  assert(
    hasFormalProtest(G.econ, "china"),
    "formal protest detected for leverage",
  );
  assert(
    !(G.econ.sanctionStance.china && G.econ.sanctionStance.china.against),
    "demarche does not set sanctions stance",
  );
}

{
  newGame();
  G = getG();
  /* Warm partner: protest alone should unlock ultimatum leverage. */
  G.rel.japan = 70;
  G.capital = 50;
  assert(
    !canIssueUltimatum("japan").ok,
    "warm Japan lacks ultimatum leverage before protest",
  );
  G.draft.missions = { japan: "demarche" };
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    canIssueUltimatum("japan").ok,
    "formal protest unlocks ultimatum leverage",
  );
  const depsJp = {
    partnerShare,
    playerCountryId,
    effectiveTariff,
    lawForRole,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    DEAL_BY_ID,
    aggregate,
    realmGdpBn,
  };
  const p0 = baseP("japan", "political", G, depsJp);
  /* Strip protest and compare — bump should be present with protest. */
  G.econ.diploLedger.japan = [];
  const p1 = baseP("japan", "political", G, depsJp);
  G.econ.diploLedger.japan = [
    { id: "mission_demarche_0", label: "Formal protest", pts: -3 },
  ];
  const p2 = baseP("japan", "political", G, depsJp);
  assert(p2 > p1 + 0.02, "formal protest raises ultimatum concede odds");
  assert(p0 > p1, "protest path raises baseP vs clean ledger");
}

{
  newGame();
  G = getG();
  const retal0 = G.econ.retaliation || 0;
  const unc0 = G.econ.uncertainty || 0;
  G.draft.missions = { russia: "sanctionsPosture" };
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    G.econ.sanctionStance.russia && G.econ.sanctionStance.russia.against,
    "sanctions mission sets against stance",
  );
  assert(
    (G.econ.diploLedger.russia || []).some(
      (x) => /Restrictive measures/.test(x.label) && x.pts === -10,
    ),
    "sanctions mission adds ledger −10",
  );
  assert(
    (G.econ.relImpulse.russia || 0) === -14,
    "sanctions mission applies −14 impulse",
  );
  assert(
    (G.econ.retaliation || 0) >= retal0 + 0.8 - 1e-9,
    "sanctions mission nudges retaliation",
  );
  assert(
    (G.econ.uncertainty || 0) >= unc0 + 0.15 - 1e-9,
    "sanctions mission raises uncertainty",
  );
}

{
  newGame();
  G = getG();
  beginActiveVisit(G, "france", "summit");
  G.draft.missions = { france: "sanctionsPosture" };
  assert(
    !billClauses().some((c) => /Restrictive measures/i.test(c.label)),
    "billClauses drops sanctions staged during a state visit",
  );
  assert(
    !(G.draft.missions && G.draft.missions.france),
    "prune clears sanctions from draft while visit active",
  );
  G.draft.missions = { france: "sanctionsPosture" };
  const appliedVisit = applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    !(G.econ.sanctionStance.france && G.econ.sanctionStance.france.against),
    "sanctions mission skipped while state visit active",
  );
  assert(
    !(G.econ.relImpulse.france <= -14),
    "no sanctions impulse during visit",
  );
  /* MP peer notification reads this return value, so a skipped mission must
     not appear in it or the target gets a Noted paper for nothing. */
  assert(
    appliedVisit && !appliedVisit.france,
    "applyDraftMissions omits the skipped mission from its applied set",
  );
  G.draft.missions = { china: "demarche", russia: "sanctionsPosture" };
  const appliedBoth = applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    appliedBoth &&
      appliedBoth.china === "demarche" &&
      appliedBoth.russia === "sanctionsPosture",
    "applyDraftMissions reports every mission it did apply",
  );
}

{
  newGame();
  G = getG();
  G.capital = 50;
  G.rel.russia = 30;
  ensureSched(G.law);
  G.law.tariffSchedule.country.russia = 4;
  if (G.world && G.world.russia && G.world.russia.law) {
    ensureSched(G.world.russia.law);
    G.world.russia.law.tariffSchedule.country[G.homeRole || "home"] = 12;
  }
  const deps = {
    partnerShare,
    playerCountryId,
    effectiveTariff,
    lawForRole,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    DEAL_BY_ID,
    aggregate,
    realmGdpBn,
  };
  const tcBase = baseP("russia", "tariffCut", G, deps);
  assert(tcBase >= 0.48, "asymmetric tariffs raise concede band");
  assert(canIssueUltimatum("russia").ok, "ultimatum available vs cool Russia");
  const cap0 = G.capital;
  assert(
    issueUltimatum("russia", "tariffCut"),
    "issue ultimatum spends capital",
  );
  assert(
    G.capital === cap0 - ULTIMATUM_PC,
    "ultimatum costs capital immediately",
  );
  assert(
    G.ultimatums.russia && G.ultimatums.russia.status === "pending",
    "ultimatum pending",
  );
  assert(
    !billClauses().some((c) => /ultimatum/i.test(c.label)),
    "ultimatum is not a bill clause",
  );
  G.q = G.ultimatums.russia.expiresQ;
  processUltimatums(G, true);
  assert(!G.ultimatums.russia, "pending ultimatum cleared on resolve");
  const conceded = (G.econ.diploLedger.russia || []).some((x) =>
    /Backed down/.test(x.label),
  );
  const defied = (G.econ.diploLedger.russia || []).some((x) =>
    /Defied our ultimatum/.test(x.label),
  );
  assert(conceded || defied, "tariffCut ultimatum resolves");
  assert(
    tcBase >= 0.5 ? conceded : defied,
    "det resolve follows baseP threshold",
  );
}

{
  newGame();
  G = getG();
  G.capital = 50;
  G.rel.russia = 30;
  ensureSched(G.law);
  G.law.tariffSchedule.country.russia = 4;
  const pat0 = G.fac.patriots;
  const biz0 = G.fac.business;
  assert(
    issueUltimatum("russia", "tariffCut"),
    "issue for same-quarter withdraw",
  );
  assert(canWithdrawUltimatum("russia"), "withdraw available before Deliver");
  assert(
    (G.econ.diploLedger.russia || []).some(
      (x) => x.id === "ultimatum_issued_" + G.q,
    ),
    "issue writes ledger",
  );
  assert(withdrawUltimatum("russia"), "withdraw same quarter");
  assert(G.capital === 50, "withdraw refunds capital");
  assert(!G.ultimatums.russia, "withdraw clears pending ultimatum");
  assert(
    !(G.econ.diploLedger.russia || []).some(
      (x) => x.id === "ultimatum_issued_" + G.q,
    ),
    "withdraw removes issued ledger",
  );
  assert(G.fac.patriots === pat0, "withdraw reverses patriot bump");
  assert(G.fac.business === biz0, "withdraw reverses business hit");
  assert(withdrawUltimatum("russia"), "duplicate withdraw is idempotent");
  assert(canIssueUltimatum("russia").ok, "can re-issue after withdraw");
  assert(issueUltimatum("russia", "tariffCut"), "re-issue after withdraw");
  G.q = (G.q || 0) + 1;
  assert(
    !canWithdrawUltimatum("russia"),
    "no withdraw after the quarter advances",
  );
  assert(!withdrawUltimatum("russia"), "withdraw fails after Deliver");
  assert(
    G.ultimatums.russia && G.ultimatums.russia.status === "pending",
    "still pending after failed withdraw",
  );
}

{
  newGame();
  G = getG();
  G.capital = 50;
  G.rel.france = 40;
  assert(canIssueUltimatum("france").ok, "ultimatum available at rel 40");
  assert(issueUltimatum("france", "political"), "issue ultimatum to France");
  G.q = G.ultimatums.france.expiresQ;
  processUltimatums(G, true);
  assert(
    (G.econ.diploLedger.france || []).some((x) =>
      /Defied our ultimatum/.test(x.label),
    ),
    "warmish France without leverage defies",
  );
}

{
  newGame();
  G = getG();
  G.capital = 80;
  assignEnvoy("japan");
  G.ultimatums = {
    china: { demand: "political", sentQ: 0, expiresQ: 2, status: "pending" },
  };
  const snapEnv = clone(G.envoys);
  const snapUlt = clone(G.ultimatums);
  const beforeRel = clone(G.rel);
  simulate(G.law, 4);
  assert(
    JSON.stringify(G.envoys) === JSON.stringify(snapEnv),
    "simulate does not mutate envoys",
  );
  assert(
    JSON.stringify(G.ultimatums) === JSON.stringify(snapUlt),
    "simulate does not mutate ultimatums",
  );
  assert(
    JSON.stringify(G.rel) === JSON.stringify(beforeRel),
    "simulate does not mutate live rel",
  );
}

/* ---- Diplomatic map markers ---- */
{
  newGame();
  G = getG();
  assert(diploMapMarkers(G).length === 0, "new game has no diplo map markers");

  G.capital = 80;
  assignEnvoy("france");
  G.draft.missions = { germany: "summit" };
  G.rel.russia = 40;
  issueUltimatum("russia", "tariffCut");
  const markers = diploMapMarkers(G);
  assert(
    markers.length === 3,
    "envoy + staged summit + ultimatum produce three markers",
  );
  assert(
    markers.some((m) => m.partnerId === "france" && m.kind === "envoy"),
    "france envoy marker",
  );
  assert(
    markers.some(
      (m) => m.partnerId === "germany" && m.kind === "summit_staged",
    ),
    "germany staged summit marker",
  );
  assert(
    markers.some((m) => m.partnerId === "russia" && m.kind === "ultimatum"),
    "russia ultimatum marker",
  );

  G.draft.missions = { germany: "summit" };
  beginActiveVisit(G, "germany", "summit");
  const withVisit = diploMapMarkers(G);
  assert(
    !withVisit.some(
      (m) => m.partnerId === "germany" && m.kind === "summit_staged",
    ),
    "active visit replaces staged summit marker",
  );
  assert(
    withVisit.some((m) => m.partnerId === "germany" && m.kind === "summit"),
    "active visit shows summit marker",
  );

  G.q = G.ultimatums.russia.expiresQ;
  processUltimatums(G, true);
  assert(
    !diploMapMarkers(G).some((m) => m.kind === "ultimatum"),
    "resolved ultimatum drops from map markers",
  );
}

{
  newGame();
  G = getG();
  G.capital = 80;
  G.rel.russia = 40;
  assignEnvoy("russia");
  G.draft.missions = { russia: "summit" };
  addDiploLedger(G, "russia", {
    id: "mission_demarche_0",
    label: "Formal protest",
    pts: -3,
  });
  setSanctionStance(G, "russia", { against: true });
  issueUltimatum("russia", "tariffCut");
  const stacked = diploMapMarkers(G);
  const russiaKinds = stacked
    .filter((m) => m.partnerId === "russia")
    .map((m) => m.kind)
    .sort();
  assert(
    russiaKinds.includes("envoy") &&
      russiaKinds.includes("summit_staged") &&
      russiaKinds.includes("protest") &&
      russiaKinds.includes("sanctions") &&
      russiaKinds.includes("ultimatum"),
    "one partner can show envoy, staged summit, protest, sanctions and ultimatum",
  );

  G.draft.missions = { germany: "demarche", france: "sanctionsPosture" };
  const staged = diploMapMarkers(G);
  assert(
    staged.some(
      (m) => m.partnerId === "germany" && m.kind === "protest_staged",
    ),
    "staged protest marker",
  );
  assert(
    staged.some(
      (m) => m.partnerId === "france" && m.kind === "sanctions_staged",
    ),
    "staged sanctions marker",
  );
}

{
  newGame();
  G = getG();
  G.ultimatums = {
    france: {
      demand: "policyChange",
      policyKey: "openVisas",
      label: "Open your visa regime",
      sentQ: 0,
      expiresQ: 2,
      status: "pending",
    },
  };
  project(4);
  assert(
    G.ultimatums.france && G.ultimatums.france.status === "pending",
    "project with policy ultimatum does not throw or mutate live ult",
  );
}

/* ---- Contextual ultimatums and mission events ---- */
{
  newGame();
  G = getG();
  ensureSched(G.law);
  ensureSched(G.draft);
  G.law.tariffSchedule.country.china = 4;
  G.draft.tariffSchedule.country.china = 4;
  if (G.world && G.world.china && G.world.china.law) {
    ensureSched(G.world.china.law);
    G.world.china.law.tariffSchedule.country[G.homeRole || "home"] = 12;
  }
  const deps = {
    partnerShare,
    playerCountryId,
    effectiveTariff,
    lawForRole,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    DEAL_BY_ID,
    aggregate,
    realmGdpBn,
    activePartners,
    sharedCamp,
  };
  const demandsCn = ultimatumDemandsFor("china", G, deps);
  assert(
    demandsCn.some((d) => d.id === "tariffCut"),
    "high partner tariff on player unlocks tariffCut",
  );

  for (const k of ["closeBorders", "openVisas", "conscript"]) {
    G.law.policies[k] = !G.world.canada.law.policies[k];
  }
  G.draft.policies = Object.assign({}, G.law.policies);
  const demandsCa = ultimatumDemandsFor("canada", G, deps);
  assert(
    demandsCa.some((d) => d.id === "policyChange"),
    "policy divergence unlocks policyChange",
  );

  G.law.polity = "democracy";
  G.draft.polity = "democracy";
  const demandsRu = ultimatumDemandsFor("russia", G, deps);
  assert(
    demandsRu.some((d) => d.id === "regimeReform"),
    "democracy vs authoritarian unlocks regimeReform",
  );

  ensureSched(G.law);
  G.law.tariffSchedule.country.france = 5;
  G.draft.tariffSchedule.country.france = 5;
  if (G.world && G.world.france && G.world.france.law) {
    ensureSched(G.world.france.law);
    G.world.france.law.tariffSchedule.country[G.homeRole || "home"] = 5;
  }
  const demandsFr = ultimatumDemandsFor("france", G, deps);
  assert(
    !demandsFr.some((d) => d.id === "tariffCut"),
    "symmetric tariffs omit tariffCut",
  );

  const player = playerCountryId();
  ensureSched(G.law);
  if (G.world && G.world.united_states && G.world.united_states.law) {
    ensureSched(G.world.united_states.law);
    G.world.united_states.law.tariffSchedule.country[player] = 8;
  }
  const demandsUs = ultimatumDemandsFor("united_states", G, deps);
  assert(
    demandsUs.some((d) => d.id === "marketAccess"),
    "nonzero partner tariff keeps marketAccess ultimatum",
  );
  if (G.world && G.world.united_states && G.world.united_states.law) {
    G.world.united_states.law.tariffSchedule.country[player] = 0;
  }
  const demandsUsZero = ultimatumDemandsFor("united_states", G, deps);
  assert(
    !demandsUsZero.some((d) => d.id === "marketAccess"),
    "marketAccess ultimatum drops when their tariff on us is already 0",
  );
}

{
  newGame();
  G = getG();
  G.rel.russia = 25;
  const deps = {
    partnerShare,
    playerCountryId,
    effectiveTariff,
    lawForRole,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    DEAL_BY_ID,
    aggregate,
    realmGdpBn,
  };
  const cold = baseP("russia", "political", G, deps);
  G.rel.russia = 55;
  const warm = baseP("russia", "political", G, deps);
  assert(cold > warm, "cooler relations raise baseP");

  G.rel.russia = 30;
  const lowInterest = baseP("russia", "regimeReform", G, deps);
  const highInterest = baseP("russia", "political", G, deps);
  assert(
    highInterest > lowInterest,
    "regimeReform stays lower than political at same rel",
  );

  ensureSched(G.law);
  G.law.tariffSchedule.country.china = 4;
  if (G.world && G.world.china && G.world.china.law) {
    ensureSched(G.world.china.law);
    G.world.china.law.tariffSchedule.country[G.homeRole || "home"] = 10;
  }
  const interest = partnerSelfInterest("tariffCut", "china", G, deps);
  assert(
    interestTag(interest) === "Against their interest" || interest < 0,
    "tariffCut interest tag when protectionist",
  );
}

{
  newGame();
  G = getG();
  G.rel.russia = 30;
  const deps = {
    partnerShare,
    playerCountryId,
    effectiveTariff,
    lawForRole,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    DEAL_BY_ID,
    aggregate,
    realmGdpBn,
  };
  const base = baseP("russia", "regimeReform", G, deps);
  assert(
    base < 0.25,
    "regimeReform vs authoritarian stays low even with leverage",
  );
  assert(
    concedeP("russia", "regimeReform", G, deps, true) === base,
    "det concedeP equals baseP (no jitter)",
  );

  G.rel.russia = 28;
  G.q = 2;
  assert(
    baseP("russia", "political", G, deps) < 0.5,
    "political ultimatum to defiant partner stays below det threshold",
  );
  G.ultimatums = {
    russia: { demand: "political", sentQ: 0, expiresQ: 2, status: "pending" },
  };
  processUltimatums(G, true);
  assert(
    (G.econ.diploLedger.russia || []).some((x) =>
      /Defied our ultimatum/.test(x.label),
    ),
    "det resolve defies when baseP < 0.5",
  );
  assert(
    G.diploAlerts &&
      G.diploAlerts.some(
        (a) => a.kind === "ult_defy" && a.partnerId === "russia",
      ),
    "ultimatum defy creates diplo alert",
  );
}

{
  newGame();
  G = getG();
  G.capital = 50;
  assert(issueUltimatum("germany", "tariffCut"), "player pick stores demand");
  assert(
    G.ultimatums.germany && G.ultimatums.germany.demand === "tariffCut",
    "ultimatum stores tariffCut demand",
  );
}

{
  newGame();
  G = getG();
  G.draft.missions = { japan: "summit" };
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(isVisitActive(G, "japan"), "staging summit starts the visit on enact");
  queueSummitVisitEvents(G);
  assert(
    G.missionEvents &&
      G.missionEvents.length === 2 &&
      G.missionEvents[0].partnerId === "japan" &&
      G.missionEvents[0].eventIndex === 0 &&
      G.missionEvents[1].eventIndex === 1,
    "first deliver queues political and commercial summit events together",
  );
  G.missionEvents = [];
  step(G, G.law, G.prevLaw, true);
  assert(
    !isVisitActive(G, "japan"),
    "visit is over after the quarter of the summit",
  );
  queueSummitVisitEvents(G);
  assert(
    !G.missionEvents.length,
    "does not queue another summit paper next quarter",
  );
  G.missionEvents = [];
  step(G, G.law, G.prevLaw, true);
  queueSummitVisitEvents(G);
  assert(!G.missionEvents.length, "no third summit event after visit ends");
  const ev = rollMissionEvent(
    "summit",
    "japan",
    G,
    {
      partnerShare,
      playerCountryId,
      activePartners,
      sharedCamp,
      partnerById,
      lawForRole,
      DEAL_BY_ID,
    },
    true,
  );
  assert(
    ev && ev.opts && ev.opts.length >= 2,
    "rollMissionEvent returns event with options",
  );
  const rel0 = G.rel.japan;
  applyMissionEventOption(ev.opts[0], {
    partnerId: "japan",
    rivalId: ev.rivalId,
  });
  assert(
    G.rel.japan !== rel0 || (G.econ.relImpulse.japan || 0) > 0,
    "mission option moves relations or relImpulse",
  );
  {
    const rival = MISSION_EVENTS.find((e) => e.id === "summit_rival");
    const sub = formatMissionTokens(rival.opts[0].e, "Russia", "China");
    assert(
      /Russia/.test(sub) && /China/.test(sub) && !/\{[PR]\}/.test(sub),
      "summit option copy names partner and rival, not tokens",
    );
    assert(
      /Russia/.test(formatMissionTokens(rival.opts[2].b, "Russia", "China")),
      "warn-against-escalation names the summit partner, not a leftover focus",
    );
  }
}

{
  newGame();
  G = getG();
  G.missionEvents = [{ partnerId: "france", missionId: "summit", q: 0 }];
  const snap = clone(G.missionEvents);
  simulate(G.law, 4);
  assert(
    JSON.stringify(G.missionEvents) === JSON.stringify(snap),
    "simulate does not mutate missionEvents",
  );
  assert(MUTABLE.includes("missionEvents"), "missionEvents on MUTABLE");
}

{
  newGame();
  G = getG();
  assert(
    !G.activeVisits || !Object.keys(G.activeVisits).length,
    "no active visits at opening",
  );
  beginActiveVisit(G, "france", "summit");
  assert(isVisitActive(G, "france"), "summit visit is active after begin");
  assert(
    visitQuartersLeft(G, "france") === VISIT_DURATION,
    "summit visit lasts one quarter",
  );
  assert(
    relationModifiers("france").some((m) => m.label === "State visit underway"),
    "active visit shows live modifier",
  );
  step(G, G.law, G.prevLaw, true);
  assert(!isVisitActive(G, "france"), "visit ends after one quarter");
  assert(
    !relationModifiers("france").some(
      (m) => m.label === "State visit underway",
    ),
    "visit modifier clears when visit ends",
  );
}

{
  newGame();
  G = getG();
  beginActiveVisit(G, "japan", "summit");
  const snap = clone(G.activeVisits);
  simulate(G.law, 4);
  assert(
    JSON.stringify(G.activeVisits) === JSON.stringify(snap),
    "simulate does not mutate activeVisits",
  );
  assert(MUTABLE.includes("activeVisits"), "activeVisits on MUTABLE");
}

{
  newGame();
  G = getG();
  beginActiveVisit(G, "japan", "summit");
  G.ultimatums = {
    germany: {
      demand: "tariffCut",
      label: "Cut tariffs",
      sentQ: 0,
      expiresQ: 3,
      status: "pending",
    },
  };
  const chips = diploHudChips(G);
  assert(
    !chips.some((c) => c.kind === "visit"),
    "hud no longer shows active visits — they're an Overview situation instead",
  );
  assert(
    chips.some(
      (c) =>
        c.kind === "ult" &&
        /germany/i.test(c.name) &&
        c.label === "Cut tariffs",
    ),
    "hud shows live ultimatum",
  );
  assert(
    diploHudChips({ ...G, activeVisits: {}, ultimatums: {} }).length === 0,
    "empty hud when nothing active",
  );
  const situations = ongoingSituations(G);
  assert(
    situations.some((s) => s.kind === "visit" && /japan/i.test(s.label)),
    "ongoing situations lists the active visit",
  );
}

{
  newGame();
  G = getG();
  G.diploAlerts = [
    {
      kind: "ult_concede",
      partnerId: "germany",
      demand: "tariffCut",
      label: "Cut tariffs on our exports",
      impacts: {
        diplomatic: "they lose face on the world stage · our leverage rises",
        economic: "their tariffs on our goods fall 2 points",
      },
      q: 1,
    },
  ];
  const concedeClips = composePress({ ultimatumOutcomes: G.diploAlerts, q: 1 });
  assert(
    concedeClips.length === 1 && concedeClips[0].kind === "ultimatum",
    "ultimatum concede yields press clipping",
  );
  assert(
    /backs down/i.test(concedeClips[0].headline),
    "concede headline names partner climbdown",
  );
  assert(
    /Diplomatic Courier/.test(concedeClips[0].masthead),
    "concede uses diplomatic masthead",
  );
  assert(
    /Diplomatically/i.test(concedeClips[0].lede),
    "concede lede names diplomatic impact",
  );
  assert(
    /Economically/i.test(concedeClips[0].lede),
    "concede lede names economic impact",
  );
  assert(
    /tariffs on our goods fall/i.test(concedeClips[0].lede),
    "concede lede describes tariff impact",
  );
  const defyClips = composePress({
    ultimatumOutcomes: [
      {
        kind: "ult_defy",
        partnerId: "france",
        demand: "marketAccess",
        label: "Open market access",
        impacts: {
          diplomatic:
            "relations plunge and their trust in our ultimatum collapses",
          economic:
            "trade retaliation rises · business uncertainty lingers four quarters",
        },
        q: 2,
      },
    ],
    q: 2,
  });
  assert(
    /defies/i.test(defyClips[0].headline),
    "defy headline names rejection",
  );
  assert(
    !/\{C\}/.test(defyClips[0].headline),
    "defy headline substitutes country name",
  );
  assert(
    !/\{C\}/.test(defyClips[0].lede),
    "defy lede substitutes country name",
  );
  assert(
    /Open market access/.test(defyClips[0].lede),
    "defy lede keeps demand label",
  );
  assert(
    /retaliation rises/i.test(defyClips[0].lede),
    "defy lede describes retaliation impact",
  );
  assert(
    /Diplomatically/i.test(defyClips[0].lede) &&
      /Economically/i.test(defyClips[0].lede),
    "defy lede splits diplomatic and economic impact",
  );
  assert(
    /World Post/.test(defyClips[0].masthead),
    "defy uses world press masthead",
  );
  const chips = diploHudChips(G);
  assert(
    !chips.some((c) => /conceded/i.test(c.label || "")),
    "ultimatum outcomes no longer appear on diplo hud",
  );
  assert(MUTABLE.includes("diploAlerts"), "diploAlerts on MUTABLE");
}

{
  newGame();
  G = getG();
  G.sandbox = true;
  G.law.deals.ru_energy = true;
  if (G.draft && G.draft.deals) G.draft.deals.ru_energy = true;
  G.rel.russia = 12;
  G.econ.dealStress = G.econ.dealStress || {};
  G.econ.dealStress.russia = 3;
  step(G, G.law, G.law, true);
  assert(!G.law.deals.ru_energy, "cold relations collapse the energy treaty");
  assert(
    (G.diploAlerts || []).some(
      (a) => a.kind === "deal_collapse" && a.partnerId === "russia",
    ),
    "treaty collapse posts a press alert",
  );
  const collapseClips = composePress({
    ultimatumOutcomes: diploOutcomeAlertsForBrief(G.diploAlerts, G.q),
    q: G.q,
  });
  assert(
    collapseClips.some(
      (c) =>
        /collapses/i.test(c.headline) &&
        /Trade Gazette/.test(c.masthead) &&
        /diplomatic strain/i.test(c.lede),
    ),
    "treaty collapse yields a Trade Gazette clipping",
  );
}

{
  console.log("\n— tutorial coach + capital shortfall —");
  newGame({ silent: true });
  let G = getG();
  assert(
    G.coachDone === true && G.coach == null,
    "default newGame skips coach",
  );
  assert(MUTABLE.includes("coach"), "coach on MUTABLE");

  const hint = capitalShortfallHint(18, 9);
  assert(
    /18/.test(hint) && /9/.test(hint),
    "shortfall hint names need and have",
  );
  assert(/rebuilds each quarter/i.test(hint), "shortfall hint explains regen");

  newGame({ silent: true, tutorial: true });
  G = getG();
  assert(G.sandbox === true, "tutorial forces sandbox");
  assert(
    G.coachDone === false && G.coach && G.coach.step === 0,
    "tutorial seeds coach at step 0",
  );
  assert(
    G.homeRole === "home" && G.country === "United Kingdom",
    "tutorial locks United Kingdom",
  );
  G.q = 8;
  G.setPiece8 = false;
  G.lastEventQ = -10;
  G.nextMajorQ = 0;
  assert(
    rollEvent() === null,
    "tutorial suppresses ordinary events and set-pieces",
  );
  assert(rollMajorEvent() === null, "tutorial suppresses major episodes");
  G.q = 0;
  G.nextMajorQ = scheduleNextMajorQ(0, false);

  newGame({
    silent: true,
    tutorial: true,
    homeRole: "france",
    country: "France",
    homeIso: "250",
  });
  G = getG();
  assert(
    G.homeRole === "home" && G.country === "United Kingdom",
    "tutorial overrides non-UK start",
  );
  skipCoach();
  G = getG();
  assert(G.coachDone === true && G.coach == null, "skipCoach clears coach");

  newGame({ tutorial: true });
  G = getG();
  assert(getDespatch(), "tutorial morning note opens without silent");
  skipCoach();
  G = getG();
  assert(
    G.coachDone === true && G.coach == null,
    "skip from morning note clears coach",
  );
  assert(!getDespatch(), "skipCoach dismisses morning note");
  beginCoachStep(0);
  G = getG();
  /* Direct beginCoachStep still works for tests; the morning-note handler guards restart. */
  assert(
    G.coach && G.coach.step === 0,
    "beginCoachStep can still seed after skip when called directly",
  );
  skipCoach();

  newGame({ silent: true, tutorial: true });
  G = getG();
  beginCoachStep(0);
  G = getG();
  assert(G.coach && G.coach.phase === "brief", "intro is brief phase");
  assert(!getDespatch(), "coach intro does not open blocking despatch");
  const panel0 = getCoachPanel();
  assert(panel0 && panel0.canContinue, "intro panel offers Continue");
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 1 && G.coach.phase === "await",
    "Continue starts budget await",
  );
  assert(getTab() !== "budget", "budget step does not auto-open Budget");
  assert(!getDespatch(), "coach await does not open blocking despatch");
  let panelBudget = getCoachPanel();
  assert(
    panelBudget && panelBudget.subtasks && panelBudget.subtasks.length === 2,
    "budget step lists subtasks",
  );
  assert(
    panelBudget.subtasks.every((s) => !s.done),
    "budget subtasks start incomplete",
  );

  G.draft.spend.education = G.law.spend.education + 0.5;
  assert(!tickCoach(), "education rise without Budget open does not advance");
  panelBudget = getCoachPanel();
  assert(
    panelBudget.subtasks.find((s) => s.id === "edu").done,
    "education subtask checks without tab",
  );
  assert(
    !panelBudget.subtasks.find((s) => s.id === "tab").done,
    "Open Budget still unchecked",
  );
  G.draft.spend.education = G.law.spend.education;
  setTab("budget");
  G.draft.spend.education = G.law.spend.education + 0.4;
  assert(!tickCoach(), "education +0.4 does not advance");
  G.draft.spend.education = G.law.spend.education + 0.5;
  assert(tickCoach(), "education +0.5 with Budget open readies budget step");
  G = getG();
  assert(
    G.coach && G.coach.step === 1 && G.coach.phase === "ready",
    "budget waits for Next after both checkboxes",
  );
  assert(
    billClauses().some((c) => /Education/.test(c.label)),
    "education still staged into deficit step",
  );
  const panelBudgetReady = getCoachPanel();
  assert(
    panelBudgetReady && panelBudgetReady.canContinue,
    "budget Next unlocks when checkboxes done",
  );
  continueCoach();
  G = getG();
  assert(G.coach && G.coach.step === 2, "Next advances to deficit step");

  setTab("bill");
  G = getG();
  assert(
    G.coach && G.coach.step === 2 && G.coach.phase === "ready",
    "opening Programme readies deficit step",
  );
  assert(
    billClauses().some((c) => /Education/.test(c.label)),
    "education still staged until Next",
  );
  const panelDef = getCoachPanel();
  assert(
    panelDef && panelDef.subtasks && panelDef.subtasks.length === 1,
    "deficit step has one Programme checkbox",
  );
  assert(panelDef.canContinue, "deficit Next unlocks when Programme open");
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 3 && G.coach.phase === "await",
    "Next advances to taxes",
  );
  assert(
    billClauses().some((c) => /Education/.test(c.label)),
    "education stays staged after deficit Next",
  );
  assert(getTab() !== "taxes", "taxes step does not auto-open Taxes");
  const panelTax = getCoachPanel();
  assert(
    panelTax && panelTax.subtasks && panelTax.subtasks.length === 3,
    "taxes step lists three subtasks",
  );
  assert(!panelTax.canContinue, "taxes Next locked until checkboxes done");

  G.draft.taxes.vat.rate = G.law.taxes.vat.rate + 3;
  G.draft.taxes.corpTax.rate = G.law.taxes.corpTax.rate + 5;
  assert(!tickCoach(), "tax rises without Taxes open do not advance");
  G.draft.taxes.vat.rate = G.law.taxes.vat.rate;
  G.draft.taxes.corpTax.rate = G.law.taxes.corpTax.rate;
  setTab("taxes");
  G.draft.taxes.vat.rate = G.law.taxes.vat.rate + 3;
  assert(!tickCoach(), "VAT alone does not advance");
  let panelTaxMid = getCoachPanel();
  assert(
    panelTaxMid.subtasks.find((s) => s.id === "vat").done,
    "VAT subtask checks while corp pending",
  );
  assert(
    !panelTaxMid.subtasks.find((s) => s.id === "corp").done,
    "corp subtask still open",
  );
  G.draft.taxes.corpTax.rate = G.law.taxes.corpTax.rate + 4;
  assert(!tickCoach(), "corp +4 with VAT +3 does not advance");
  G.draft.taxes.corpTax.rate = G.law.taxes.corpTax.rate + 5;
  assert(tickCoach(), "VAT +3 and corp +5 with Taxes open readies taxes step");
  G = getG();
  assert(
    G.coach && G.coach.step === 3 && G.coach.phase === "ready",
    "taxes waits for Next after checkboxes",
  );
  assert(
    getCoachPanel()?.canContinue,
    "taxes Next unlocks when checkboxes done",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 4,
    "Next advances to books step after taxes",
  );

  setTab("bill");
  G = getG();
  assert(
    G.coach && G.coach.step === 4 && G.coach.phase === "ready",
    "opening Programme readies books step",
  );
  assert(
    getCoachPanel()?.subtasks?.length === 1,
    "books step has one Programme checkbox",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 5 && G.coach.phase === "await",
    "Next advances to policies",
  );

  assert(
    !(G.law.policies && G.law.policies.skills),
    "skills guarantee off at opening",
  );
  G.draft.policies.skills = true;
  assert(!tickCoach(), "skills without Laws open does not advance");
  delete G.draft.policies.skills;
  setTab("laws");
  G.draft.policies.skills = true;
  assert(tickCoach(), "enacting skills with Laws open readies policies step");
  G = getG();
  assert(
    G.coach && G.coach.step === 5 && G.coach.phase === "ready",
    "policies waits for Next",
  );
  continueCoach();
  G = getG();
  assert(G.coach && G.coach.step === 6, "Next advances to trade after skills");

  if (!G.law.tariffSchedule) {
    G.law.tariffSchedule = { default: 3, cet: null, bloc: {}, country: {} };
  }
  if (!G.draft.tariffSchedule)
    G.draft.tariffSchedule = clone(G.law.tariffSchedule);
  const baseDefault =
    G.law.tariffSchedule.default != null ? G.law.tariffSchedule.default : 3;
  G.draft.tariffSchedule.default = baseDefault - 1;
  assert(
    !tickCoach(),
    "default tariff cut without Trade open does not advance",
  );
  G.draft.tariffSchedule.default = baseDefault;
  setTab("trade");
  G.draft.tariffSchedule.default = baseDefault - 1;
  assert(tickCoach(), "default tariff −1 with Trade open readies trade step");
  G = getG();
  assert(
    G.coach && G.coach.step === 6 && G.coach.phase === "ready",
    "trade step waits for Next after tariff cut",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 7 && G.coach.phase === "await",
    "Next advances to post-trade Programme review",
  );

  setTab("bill");
  G = getG();
  assert(
    G.coach && G.coach.step === 7 && G.coach.phase === "ready",
    "opening Programme readies tradeBooks step",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 8 && G.coach.phase === "await",
    "Next advances to accession",
  );
  assert(
    getTab() == null,
    "accession step closes drawer so Join is a deliberate look",
  );

  assert(!tickCoach(), "accession does not ready without Trade open");
  setTab("trade");
  G = getG();
  assert(
    G.coach && G.coach.step === 8 && G.coach.phase === "ready",
    "reopening Trade readies accession step",
  );
  assert(
    blocJoinBlockers("continental_union", "apply").some((b) =>
      /France/i.test(b),
    ),
    "European Union Join blocked on France relations",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 9 && G.coach.phase === "await",
    "Next advances to diplomacy",
  );

  if (!G.draft.missions) G.draft.missions = {};
  G.draft.missions.germany = "summit";
  assert(!tickCoach(), "non-France summit does not advance");
  delete G.draft.missions.germany;
  G.draft.missions.france = "summit";
  assert(!tickCoach(), "France summit without Diplomacy open does not advance");
  delete G.draft.missions.france;
  setTab("diplomacy");
  G.draft.missions.france = "summit";
  assert(
    tickCoach(),
    "France summit with Diplomacy open readies diplomacy step",
  );
  G = getG();
  assert(
    G.coach && G.coach.step === 9 && G.coach.phase === "ready",
    "diplomacy waits for Next",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 10 && G.coach.phase === "brief",
    "forecast brief after diplomacy",
  );
  const panelForecast = getCoachPanel();
  assert(
    panelForecast &&
      /Forecast on current policy/i.test(panelForecast.body || ""),
    "forecast step explains Forecast on current policy",
  );
  continueCoach();
  G = getG();
  assert(G.coach && G.coach.step === 11, "deliver step after forecast brief");

  const startQ = G.q;
  G.coach.startQ = startQ;
  G.q = startQ + 1;
  assert(tickCoach(), "quarter advance completes first Deliver step");
  G = getG();
  assert(G.coach && G.coach.step === 12, "warmFrance step after Deliver");

  /* Early Deliver during the forecast brief must still clear the deliver step. */
  beginCoachStep(10);
  G = getG();
  assert(
    G.coach && G.coach.step === 10 && G.coach.phase === "brief",
    "back on forecast brief",
  );
  const forecastStartQ = G.coach.startQ;
  G.q = forecastStartQ + 1;
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 12,
    "early Deliver during forecast advances past deliver step",
  );

  assert(!tickCoach(), "France at 50 does not clear warmFrance");
  G.rel.france = 52;
  assert(tickCoach(), "France at 52 advances to joinCU");
  G = getG();
  assert(
    G.coach && G.coach.step === 13 && G.coach.phase === "await",
    "joinCU step after warm France",
  );
  assert(getTab() == null, "joinCU closes drawer for a deliberate Join");

  assert(!tickCoach(), "joinCU does not advance without Trade + staged Join");
  setTab("trade");
  assert(!tickCoach(), "Trade open alone does not stage Join");
  G.draft.blocAccession = { blocId: "continental_union", phase: "apply" };
  assert(tickCoach(), "staging CU Join readies joinCU step");
  G = getG();
  assert(
    G.coach && G.coach.step === 13 && G.coach.phase === "ready",
    "joinCU waits for Next",
  );
  continueCoach();
  G = getG();
  assert(G.coach && G.coach.step === 14, "Next advances to deliverJoin");

  assert(!tickCoach(), "deliverJoin waits for filed accession");
  G.blocAccession = { blocId: "continental_union", step: 1 };
  G.blocAccessionByCountry = {
    kingdom: {
      blocId: "continental_union",
      step: 1,
      sinceQ: G.q + 1,
      self: true,
    },
  };
  assert(tickCoach(), "filed accession advances to accessionWait");
  G = getG();
  assert(G.coach && G.coach.step === 15, "accessionWait after filing");
  let panelAcc = getCoachPanel();
  assert(
    panelAcc && panelAcc.subtasks && panelAcc.subtasks.length === 3,
    "accessionWait lists three stages",
  );
  assert(
    panelAcc.subtasks.find((s) => s.id === "applied").done,
    "application subtask done",
  );
  assert(
    !panelAcc.subtasks.find((s) => s.id === "member").done,
    "not yet a member",
  );

  assert(!tickCoach(), "accessionWait waits for membership");
  G.blocMember.kingdom = "continental_union";
  G.blocAccession = null;
  delete G.blocAccessionByCountry.kingdom;
  assert(tickCoach(), "CU membership readies accessionWait");
  G = getG();
  assert(
    G.coach && G.coach.step === 15 && G.coach.phase === "ready",
    "accessionWait waits for Next when member",
  );
  continueCoach();
  G = getG();
  assert(
    G.coach && G.coach.step === 16 && G.coach.phase === "brief",
    "done step is congrats brief",
  );
  const panelDone = getCoachPanel();
  assert(
    panelDone &&
      panelDone.canContinue &&
      /away|Congratulations/i.test(panelDone.body || ""),
    "done panel congratulates",
  );
  continueCoach();
  G = getG();
  assert(G.coachDone === true && G.coach == null, "Finish clears coach");
}

{
  console.log("\n— mid-term fiscal set-piece —");
  const consol = EVENTS.find((e) => e.id === "setPieceFiscal").opts.find((o) =>
    /consolidation/i.test(o.b),
  );
  assert(consol, "setPieceFiscal has a consolidation option");

  newGame({ silent: true });
  G = getG();
  const beforeSpend = {};
  for (const d of DEPTS) beforeSpend[d.id] = G.law.spend[d.id];
  const prem0 = G.econ.riskPremium || 0;
  const mods0 = (G.mods || []).length;
  applyEventOption(consol);
  G = getG();
  assert(
    G.law.spend.health === beforeSpend.health &&
      G.law.spend.welfare === beforeSpend.welfare,
    "consolidation ring-fences health and welfare",
  );
  for (const d of DEPTS) {
    if (d.id === "health" || d.id === "welfare") continue;
    const got = G.law.spend[d.id];
    const want = beforeSpend[d.id] * 0.94;
    assert(
      Math.abs(got - want) < 1e-9,
      `consolidation cuts ${d.id} by 6% (${got} vs ${want})`,
    );
  }
  assert(
    (G.econ.riskPremium || 0) === prem0,
    "consolidation does not write riskPremium",
  );
  const newMods = (G.mods || []).slice(mods0);
  assert(
    !newMods.some((m) => m.spend),
    "consolidation does not push a spend shock",
  );
  assert(
    newMods.some((m) => m.uncertainty === 0.3 && m.q === 4),
    "consolidation queues a modest uncertainty input",
  );

  function armFiscalSetPiece(g, q) {
    g.q = q;
    g.termStartQ = 0;
    g.setPiece8 = false;
    g.lastEventQ = -10;
    g.nextMajorQ = 999;
  }
  function makeBooksSoft(g) {
    const anchor = g.econ.debtAnchor != null ? g.econ.debtAnchor : 94;
    g.econ.debt = anchor + 8;
  }
  function makeBooksHealthy(g) {
    const anchor = g.econ.debtAnchor != null ? g.econ.debtAnchor : 94;
    g.econ.debt = Math.min(g.econ.debt, anchor);
    g.econ.riskPremium = 0;
    g.econ.yield = g.econ.rate;
  }

  newGame({ silent: true });
  G = getG();
  makeBooksSoft(G);
  armFiscalSetPiece(G, 10);
  const fired = rollEvent();
  assert(
    fired && fired.id === "setPieceFiscal",
    "soft books at democracy mid-term fire the fiscal set-piece",
  );
  assert(getG().setPiece8 === true, "firing sets the fiscal set-piece flag");

  newGame({ silent: true });
  G = getG();
  makeBooksHealthy(G);
  armFiscalSetPiece(G, 10);
  const skipped = rollEvent();
  assert(
    !skipped || skipped.id !== "setPieceFiscal",
    "healthy books at mid-term skip the fiscal set-piece",
  );
  assert(
    getG().setPiece8 === false,
    "skipping leaves the fiscal set-piece flag clear",
  );

  newGame({ silent: true });
  G = getG();
  makeBooksSoft(G);
  armFiscalSetPiece(G, 8);
  const early = rollEvent();
  assert(
    !early || early.id !== "setPieceFiscal",
    "soft books before halfway do not fire the fiscal set-piece",
  );

  newGame({ silent: true });
  G = getG();
  G.law.polity = "authoritarian";
  makeBooksSoft(G);
  armFiscalSetPiece(G, 10);
  const authEarly = rollEvent();
  assert(
    !authEarly || authEarly.id !== "setPieceFiscal",
    "authoritarian mid-term is not quarter 10",
  );
  armFiscalSetPiece(G, 20);
  const authMid = rollEvent();
  assert(
    authMid && authMid.id === "setPieceFiscal",
    "soft books at authoritarian mid-term fire the fiscal set-piece",
  );
}

/* Self never the foreign actor; setRel / worldPartner skip the local seat. */
{
  for (const role of ["united_states", "china", "india"]) {
    newGame({
      sandbox: true,
      silent: true,
      homeRole: role,
      homeIso:
        role === "united_states" ? "840" : role === "china" ? "156" : "356",
      country: role,
    });
    G = getG();
    const self = playerCountryId();
    assert(isPlayerSeat(self), `${role}: local id is the player seat`);
    assert(!requirePartner(self), `${role}: self is not an active partner`);
    for (const p of activePartners()) {
      assert(
        p.id !== self && !isPlayerSeat(p.id),
        `${role}: activePartners excludes self (${p.id})`,
      );
    }
    const beforeRel = G.rel[self];
    applyEventOption({ setRel: { [self]: 18, germany: 4 } });
    assert(
      G.rel[self] === beforeRel,
      `${role}: setRel does not write the local seat`,
    );
    const mods0 = G.mods.length;
    applyEventOption({
      shocks: [{ channel: "worldPartner", partner: self, points: -6, q: 4 }],
    });
    assert(
      G.mods.length === mods0 && !G.mods.some((m) => m.partner === self),
      `${role}: worldPartner shock skips the local seat`,
    );
  }

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  G.law.taxes.digitalTax.on = true;
  G.law.taxes.digitalTax.rate = 5;
  assert(
    !EVENTS.find((e) => e.id === "ultimatum").cond(),
    "US home skips the Washington DST ultimatum",
  );
  assert(
    !EVENTS.find((e) => e.id === "usTariffUp").cond(),
    "US home skips US tariff-up major",
  );
  assert(
    !EVENTS.find((e) => e.id === "usSlowdown").cond(),
    "US home skips US slowdown (self is not a partner)",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "home",
    country: "The Kingdom",
  });
  G = getG();
  G.politics = {
    [playerCountryId()]: {},
    united_states: {},
  };
  G.law.taxes.digitalTax.on = true;
  G.law.taxes.digitalTax.rate = 5;
  G.rel.united_states = 50;
  assert(isHumanMpSeat(G, "united_states"), "politics bag marks US as human");
  assert(
    !requireScriptablePartner("united_states"),
    "human US is not scriptable",
  );
  assert(requirePartner("united_states"), "human US is still on the board");
  assert(
    !EVENTS.find((e) => e.id === "ultimatum").cond(),
    "human US skips DST ultimatum agency",
  );
  assert(
    !EVENTS.find((e) => e.id === "usTariffUp").cond(),
    "human US skips tariff-up agency",
  );
  assert(
    EVENTS.find((e) => e.id === "usSlowdown").cond(),
    "human US still allows an ambient slowdown",
  );
}

/* Partner-scoped foreign events hit the named seat, not a generic residual. */
{
  newGame({ sandbox: true, silent: true });
  G = getG();
  G.q = 6;
  const spy = EVENTS.find((e) => e.id === "espionage");
  const spyPrep = prepareEvent(spy);
  assert(spyPrep && G.eventFocus, "espionage resolve picks a focus");
  assert(!isPlayerSeat(G.eventFocus), "espionage focus is not the local seat");
  const spyFocus = G.eventFocus;
  const spyRel0 = G.rel[spyFocus] != null ? G.rel[spyFocus] : 50;
  applyEventOption(spy.opts[0]);
  assert(
    G.rel[spyFocus] < spyRel0 - 10,
    `expel diplomats hits ${spyFocus} relations`,
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  G.q = 5;
  const boom = EVENTS.find((e) => e.id === "tradeBoom");
  const boomPrep = prepareEvent(boom);
  assert(boomPrep && G.eventFocus, "tradeBoom resolve picks a focus");
  const boomFocus = G.eventFocus;
  const playerId = playerCountryId();
  const partnerRole =
    (G.world[boomFocus] && G.world[boomFocus].role) || boomFocus;
  const tar0 = effectiveTariff(
    playerId,
    G.world[boomFocus].law,
    partnerRole,
    G.blocMember,
  );
  const boomRel0 = G.rel[boomFocus] != null ? G.rel[boomFocus] : 50;
  applyEventOption(boom.opts[1]);
  assert(
    G.rel[boomFocus] < boomRel0,
    "taking access without reciprocating cools the named partner",
  );
  const tar1 = effectiveTariff(
    playerId,
    G.world[boomFocus].law,
    partnerRole,
    G.blocMember,
  );
  assert(
    tar1 < tar0 - 1,
    `tradeBoom cuts ${boomFocus}'s tariff on the player (${tar0} → ${tar1})`,
  );
  assert(
    G.mods.some((m) => m.partner === boomFocus && m.worldPartner),
    "tradeBoom worldPartner shock binds to the focus seat",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  G.law.tariff = 10;
  const row = EVENTS.find((e) => e.id === "tradeRow");
  const rowPrep = prepareEvent(row);
  assert(rowPrep && G.eventFocus, "tradeRow resolve picks a focus");
  const rowFocus = G.eventFocus;
  const rowRel0 = G.rel[rowFocus] != null ? G.rel[rowFocus] : 50;
  applyEventOption(row.opts[1]);
  assert(G.rel[rowFocus] < rowRel0, "retaliation cools the named partner");
  assert(
    G.mods.some((m) => m.partner === rowFocus && m.worldPartner),
    "tradeRow worldPartner shock binds to the focus seat",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  const rec = EVENTS.find((e) => e.id === "recess");
  const recPrep = prepareEvent(rec);
  assert(recPrep && G.eventFocus, "recess resolve picks an export market");
  applyEventOption(rec.opts[0]);
  assert(
    G.mods.some((m) => m.partner === G.eventFocus && m.worldPartner),
    "recess shock hits the named export market",
  );
}

/* FLAG_CODE (lib/ui/flags.ts) is a hand-synced realm-id -> ISO alpha-2 table,
   independent of PLAYABLE_REALMS (lib/sim/realms.ts). flagSrc() falls back
   to the UK flag on a miss rather than erroring, so a realm added without a
   matching entry would silently render the wrong flag instead of failing
   loudly — this test is what makes that failure loud instead. */
for (const realm of PLAYABLE_REALMS) {
  assert(
    Object.prototype.hasOwnProperty.call(FLAG_CODE, realm.id),
    `FLAG_CODE has an entry for realm "${realm.id}"`,
  );
}

/* REALM_FILL (lib/sim/boardMetrics.ts) is a second hand-synced table keyed
   off the same country ids COUNTRIES (lib/sim/countries.ts) already
   enumerates. A country added to COUNTRIES without a matching REALM_FILL
   entry doesn't error either — fillFor() falls back to a generic grey — so
   this closes the same silent-drift gap the FLAG_CODE check above does. */
for (const c of COUNTRIES) {
  assert(
    Object.prototype.hasOwnProperty.call(REALM_FILL, c.id),
    `REALM_FILL has an entry for country "${c.id}"`,
  );
}

/* Parties, chamber votes, election seat shares. */
{
  const ubi = policyTaste("ubi", true);
  const stances = partyStances(ubi);
  const social = stances.find((s) => s.id === "social");
  const cons = stances.find((s) => s.id === "conservative");
  assert(social && social.stance === "for", "UBI is For for Civic Labour");
  assert(
    cons && cons.stance === "against",
    "UBI is Against for National Conservatives",
  );

  const dereg = policyTaste("dereg", true);
  const deregStances = partyStances(dereg);
  const socialDereg = deregStances.find((s) => s.id === "social");
  assert(
    socialDereg && socialDereg.stance === "against",
    "labour deregulation is Against for Civic Labour",
  );

  const low = rulingAyeShare({
    alignment: -0.8,
    approval: 40,
    leftoverCapital: 0,
  });
  const high = rulingAyeShare({
    alignment: -0.8,
    approval: 85,
    leftoverCapital: 0,
  });
  assert(
    high > low + 0.2,
    "high leader approval pulls ruling ayes off the party line",
  );
  assert(
    high > 0.5,
    "at ~85% approval a negative alignment still yields a ruling majority of ayes",
  );

  const unwhipped = rulingAyeShare({
    alignment: -0.5,
    approval: 48,
    leftoverCapital: 0,
    whipSpend: 0,
  });
  const whipped = rulingAyeShare({
    alignment: -0.5,
    approval: 48,
    leftoverCapital: 0,
    whipSpend: 8,
  });
  const whippedHard = rulingAyeShare({
    alignment: -0.5,
    approval: 48,
    leftoverCapital: 0,
    whipSpend: 20,
  });
  assert(whipped > unwhipped + 0.08, "whipping buys a measurable aye swing");
  assert(
    whippedHard - whipped < whipped - unwhipped,
    "whip spend has diminishing returns",
  );
  assert(
    whippedHard < 0.85,
    "max whip cannot paper over a hard Against caucus",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  G.draft.policies.dereg = true;
  G.capital = 60;
  G.whipSpend = 0;
  const beforeWhip = billVoteData();
  assert(beforeWhip && beforeWhip.needed, "deregulation stages a chamber vote");
  const rulingBefore = beforeWhip.parties.find((p) => p.ruling);
  assert(
    rulingBefore && rulingBefore.nay > 0,
    "Labour rebels against deregulation",
  );
  G.whipSpend = 10;
  const afterWhip = billVoteData();
  assert(afterWhip.aye > beforeWhip.aye, "whip spend raises chamber ayes");
  assert(
    afterWhip.programmeCost === billCost() + 10,
    "programme cost includes the whip",
  );
  assert(afterWhip.whipSpend === 10, "billVoteData reports whip spend");
  /* The bill drawer's staged-capital figure quotes the same price the Dock and
     enact() charge, whip included, in both the career and sandbox branches. */
  assert(
    impactStripData().cost === programmeCost(),
    "staged capital matches the programme price in sandbox",
  );
  G.sandbox = false;
  assert(
    impactStripData().cost === programmeCost(),
    "staged capital matches the programme price in career",
  );
  G.sandbox = true;
  const capBefore = G.capital;
  /* Force a passable chamber so enact is not blocked by majority. */
  G.parties.seats = {
    social: 70,
    liberal: 10,
    conservative: 10,
    national: 5,
    agrarian: 5,
  };
  G.whipSpend = 8;
  G.fac = {
    business: 70,
    workers: 55,
    pensioners: 50,
    urban: 55,
    rural: 45,
    patriots: 50,
  };
  const voteReady = billVoteData();
  if (voteReady && voteReady.needed && !voteReady.pass && !voteReady.advisory) {
    G.whipSpend = 20;
  }
  const vote2 = billVoteData();
  if (vote2 && vote2.pass) {
    enact();
    assert(G.whipSpend === 0, "enact clears the whip");
    assert(G.capital < capBefore, "enact charges the whip with the bill");
  } else {
    /* Still assert the preview math even if this opening cannot pass. */
    assert(
      programmeCost() >= billCost(),
      "programme cost never undercuts the bill",
    );
  }

  const shares = {
    social: 0.32,
    liberal: 0.18,
    conservative: 0.28,
    national: 0.12,
    agrarian: 0.1,
  };
  const fptp = seatsFromVotes(shares, "majoritySingle", {
    majorityMaker: false,
  });
  const twoRound = seatsFromVotes(shares, "majorityTwoRound", {
    majorityMaker: false,
  });
  const pr = seatsFromVotes(shares, "proportional");
  const fptpLead = Math.max(...PARTY_IDS.map((id) => fptp[id]));
  const twoLead = Math.max(...PARTY_IDS.map((id) => twoRound[id]));
  const prLead = Math.max(...PARTY_IDS.map((id) => pr[id]));
  assert(
    fptpLead > prLead,
    "FPTP exaggerates the leader vs PR on the same shares",
  );
  assert(twoLead > prLead, "two-round exaggerates the leader vs PR");
  assert(
    fptpLead >= twoLead,
    "FPTP cube law is at least as majoritarian as two-round",
  );
  const close = {
    social: 0.3,
    conservative: 0.29,
    liberal: 0.2,
    national: 0.12,
    agrarian: 0.09,
  };
  const hung = seatsFromVotes(close, "majoritySingle", {
    majorityMaker: false,
  });
  assert(
    Math.max(...PARTY_IDS.map((id) => hung[id])) < 51,
    "FPTP cube law can still hang a close plurality (got " +
      Math.max(...PARTY_IDS.map((id) => hung[id])) +
      ")",
  );
  const made = seatsFromVotes(close, "majoritySingle");
  assert(
    Math.max(...PARTY_IDS.map((id) => made[id])) >= 51,
    "majorityMaker still manufactures a working majority when asked",
  );
  const live = allocateElection({
    fac: {
      business: 52,
      workers: 48,
      pensioners: 50,
      urban: 50,
      rural: 50,
      patriots: 50,
    },
    rulingId: "social",
    votingSystem: "majoritySingle",
    pluralism: "multiParty",
  });
  const livePr = allocateElection({
    fac: {
      business: 52,
      workers: 48,
      pensioners: 50,
      urban: 50,
      rural: 50,
      patriots: 50,
    },
    rulingId: "social",
    votingSystem: "proportional",
    pluralism: "multiParty",
  });
  const liveFptp = Math.max(...PARTY_IDS.map((id) => live.seats[id]));
  const livePrLead = Math.max(...PARTY_IDS.map((id) => livePr.seats[id]));
  assert(
    liveFptp > livePrLead,
    "a live FPTP ballot exaggerates vs PR on the same electorate",
  );

  const evenFac = (n) => ({
    business: n,
    workers: n,
    pensioners: n,
    urban: n,
    rural: n,
    patriots: n,
  });
  const popular = allocateElection({
    fac: evenFac(62),
    rulingId: "social",
    votingSystem: "majoritySingle",
    pluralism: "multiParty",
  });
  const middling = allocateElection({
    fac: evenFac(50),
    rulingId: "social",
    votingSystem: "majoritySingle",
    pluralism: "multiParty",
  });
  const unpopular = allocateElection({
    fac: evenFac(40),
    rulingId: "social",
    votingSystem: "majoritySingle",
    pluralism: "multiParty",
  });
  assert(
    popular.popularity.social > 0.32,
    "62% approval puts the incumbent above 32% of the vote (got " +
      (popular.popularity.social * 100).toFixed(1) +
      "%)",
  );
  assert(
    popular.seats.social >= 55 && popular.seats.social <= 75,
    "FPTP turns 62% approval into a working majority, not a wipeout (got " +
      popular.seats.social +
      ")",
  );
  assert(
    popular.seats.social > middling.seats.social,
    "higher approval wins more FPTP seats (" +
      popular.seats.social +
      " vs " +
      middling.seats.social +
      ")",
  );
  assert(
    middling.seats.social > unpopular.seats.social,
    "lower approval wins fewer FPTP seats (" +
      middling.seats.social +
      " vs " +
      unpopular.seats.social +
      ")",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  assert(MUTABLE.includes("parties"), "parties is on MUTABLE");
  assert(G.parties && G.parties.rulingId, "newGame seeds parties");
  const homeSeats = G.parties.seats[G.parties.rulingId];
  assert(
    G.parties.rulingId === "social",
    "opening Kingdom is a Labour government",
  );
  assert(
    homeSeats === 68,
    "opening Kingdom seats match Commons Labour share without Reform/Greens (" +
      homeSeats +
      ")",
  );
  assert(G.parties.seats.conservative === 20, "opening Conservatives ~20/100");
  assert(G.parties.seats.liberal === 12, "opening Lib Dems ~12/100");
  assert(
    G.parties.seats.national === 0,
    "Reform is folded out of the opening Commons",
  );
  assert(
    G.parties.seats.agrarian === 0,
    "Greens are folded out of the opening Commons",
  );
  const labourRow = seatRows().find((r) => r.id === "social");
  assert(
    labourRow && labourRow.name === "Labour",
    "Kingdom overlay names the social family Labour",
  );
  assert(
    labourRow && labourRow.short === "Labour",
    "Kingdom Labour short name",
  );
  assert(
    G.law.groups.votingSystem === "majoritySingle",
    "Kingdom opens first-past-the-post",
  );

  for (const r of PLAYABLE_REALMS) {
    const o = partyOverlayForRole(r.role);
    assert(!!o, r.name + " has a party overlay");
  }
  for (const id of Object.keys(PARTY_OVERLAYS)) {
    const seats = PARTY_OVERLAYS[id].seats;
    if (!seats) continue;
    const sum = PARTY_IDS.reduce((s, p) => s + (seats[p] || 0), 0);
    assert(
      sum === CHAMBER_SEATS,
      id + " opening seats sum to 100 (got " + sum + ")",
    );
    for (const p of PARTY_IDS) {
      const n = seats[p] || 0;
      assert(
        n === 0 || n > 5,
        id + " " + p + " is a splinter caucus (" + n + ")",
      );
    }
  }

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "spain",
    homeIso: "724",
    country: "Spain",
  });
  G = getG();
  assert(
    G.parties.rulingId === "social",
    "Spain is a PSOE government even though PP is larger",
  );
  assert(
    seatRows().find((r) => r.ruling).name === "PSOE",
    "Spain overlay names PSOE",
  );
  assert(G.parties.seats.conservative === 39, "Spain PP is the largest caucus");
  assert(G.law.groups.votingSystem === "proportional", "Spain opens with PR");

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "germany",
    homeIso: "276",
    country: "Germany",
  });
  G = getG();
  assert(
    G.parties.rulingId === "conservative",
    "Germany is a CDU/CSU chancellery",
  );
  assert(
    seatRows().find((r) => r.ruling).name === "CDU/CSU",
    "Germany overlay names CDU/CSU",
  );
  assert(
    G.parties.seats.conservative === 33,
    "Germany Union has 33 of 100, not a solo majority",
  );
  assert(G.law.groups.votingSystem === "proportional", "Germany opens with PR");

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "france",
    homeIso: "250",
    country: "France",
  });
  G = getG();
  assert(
    G.law.groups.votingSystem === "majorityTwoRound",
    "France opens with two-round majority",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "netherlands",
    homeIso: "528",
    country: "Netherlands",
  });
  G = getG();
  assert(
    G.law.groups.votingSystem === "proportional",
    "Netherlands opens with PR",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "kenya",
    homeIso: "404",
    country: "Kenya",
  });
  G = getG();
  assert(
    G.parties.seats.conservative === 48,
    "Kenya UDA stays a plurality, not a manufactured majority",
  );
  assert(
    G.parties.seats.social === 37,
    "Kenya leftover from folding KANU goes to ODM",
  );

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "united_states",
    homeIso: "840",
    country: "United States",
  });
  G = getG();
  assert(
    G.parties.rulingId === "conservative",
    "United States opens as a Republican administration",
  );
  assert(
    seatRows().find((r) => r.ruling).name === "Republicans",
    "US overlay names Republicans",
  );
  assert(
    G.parties.seats.conservative === 52,
    "US House GOP majority without independents",
  );
  assert(G.parties.seats.social === 48, "US House is a two-party chamber");

  newGame({
    sandbox: true,
    silent: true,
    homeRole: "japan",
    homeIso: "392",
    country: "Japan",
  });
  G = getG();
  assert(G.parties.rulingId === "conservative", "Japan is an LDP government");
  assert(
    G.parties.seats.conservative === 68,
    "Japan LDP supermajority scaled to 100",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  const snapParties = clone(G.parties);
  const before = project(4);
  assert(
    JSON.stringify(G.parties) === JSON.stringify(snapParties),
    "project() does not mutate G.parties",
  );
  void before;

  G.sandbox = false;
  G.capital = 80;
  for (const f of FACTIONS) G.fac[f.id] = 40;
  G.parties.rulingId = "social";
  G.parties.seats = {
    social: 55,
    liberal: 10,
    conservative: 25,
    national: 5,
    agrarian: 5,
  };
  G.draft.policies.dereg = true;
  const beforeLaw = !!G.law.policies.dereg;
  const beforeCap = G.capital;
  const vote = billVoteData();
  assert(
    vote && vote.needed && !vote.pass,
    "off-manifesto bill fails with low approval",
  );
  enact();
  assert(
    !!G.law.policies.dereg === beforeLaw && G.capital === beforeCap,
    "sovereign parliament: enact no-ops when aye ≤ 50; capital unchanged",
  );
  delete G.draft.policies.dereg;

  G.law.groups.parliamentaryPowers = "suppressed";
  G.draft.groups.parliamentaryPowers = "suppressed";
  G.draft.policies.dereg = true;
  G.capital = 80;
  enact();
  assert(
    !!G.law.policies.dereg,
    "suppressed parliament: enact succeeds on capital alone",
  );

  newGame({ sandbox: true, silent: true });
  G = getG();
  G.law.groups.parliamentaryPowers = "consultative";
  G.draft = clone(G.law);
  G.capital = 80;
  for (const f of FACTIONS) G.fac[f.id] = 40;
  G.parties.rulingId = "social";
  G.parties.seats = {
    social: 55,
    liberal: 10,
    conservative: 25,
    national: 5,
    agrarian: 5,
  };
  G.draft.policies.dereg = true;
  const patBefore = G.fac.patriots;
  enact();
  assert(!!G.law.policies.dereg, "consultative fail: enact proceeds");
  assert(G.fac.patriots < patBefore, "consultative fail moves patriots");

  newGame({
    sandbox: false,
    silent: true,
    homeRole: "china",
    homeIso: "156",
    country: "Eastern Republic",
  });
  G = getG();
  assert(
    G.parties.rulingId === "national",
    "China ruling party is the apparatus",
  );
  assert(
    G.parties.seats.national === 100,
    "China is not a competitive allocation (" + G.parties.seats.national + ")",
  );
  const chinaRuling = seatRows().find((r) => r.ruling);
  assert(
    chinaRuling && chinaRuling.name === "Communist Party",
    "China names the apparatus the Communist Party",
  );
  G.law.groups.partyPluralism = "banned";
  G.draft.groups.partyPluralism = "banned";
  const banned = seedParties(G.fac, G.law);
  assert(
    banned.seats.national === 100,
    "banned opposition → 100 seats for the ruling party",
  );

  newGame({ sandbox: false, silent: true });
  G = getG();
  const ruling = G.parties.rulingId;
  /* Bias the electorate against the incumbent's ideology so they cannot
     come first even with the FPTP majority maker. */
  if (ruling === "social" || ruling === "liberal") {
    G.fac = {
      business: 90,
      workers: 8,
      pensioners: 12,
      urban: 10,
      rural: 88,
      patriots: 90,
    };
  } else {
    G.fac = {
      business: 10,
      workers: 90,
      pensioners: 80,
      urban: 90,
      rural: 10,
      patriots: 8,
    };
  }
  const termWas = G.term;
  G.over = false;
  termReview();
  assert(
    G.over === true,
    "election: ruling party second in seats → over unless sandbox",
  );
  assert(G.term === termWas, "lost election does not increment term");

  newGame({ sandbox: true, silent: true });
  G = getG();
  if (G.parties.rulingId === "social" || G.parties.rulingId === "liberal") {
    G.fac = {
      business: 90,
      workers: 8,
      pensioners: 12,
      urban: 10,
      rural: 88,
      patriots: 90,
    };
  } else {
    G.fac = {
      business: 10,
      workers: 90,
      pensioners: 80,
      urban: 90,
      rural: 10,
      patriots: 8,
    };
  }
  const t0 = G.term;
  termReview();
  assert(!G.over, "sandbox election loss still returns you");
  assert(G.term === t0 + 1, "sandbox election still increments term");
}

newGame({ silent: true });
G = getG();
{
  const data = governmentScoreData();
  const total = data.factors.reduce((a, f) => a + f.value, 0);
  assert(data.factors.length === 8, "government score has eight factors");
  assert(
    data.factors.every((f) => f.value >= 0 && f.value <= 6),
    "each government-score factor is 0–6",
  );
  assert(
    Math.abs(total / 48 - data.pct) < 1e-9,
    "government score pct is total/48",
  );
  assert(data.letter === grade(), "grade() is governmentScoreData().letter");
  assert(
    ["A", "B", "C", "D", "E"].includes(data.letter),
    `opening letter grade is A–E (got ${data.letter})`,
  );
  assert(
    data.pct > 0.34 && data.pct < 0.9,
    `opening government score is mid-band (got ${(data.pct * 100).toFixed(0)}/100, ${data.letter})`,
  );
}

{
  assert(takesThe("United Kingdom"), "UK takes the");
  assert(takesThe("United States"), "US takes the");
  assert(takesThe("United Arab Emirates"), "UAE takes the");
  assert(takesThe("Netherlands"), "Netherlands takes the");
  assert(takesThe("the Kingdom"), "leading the takes the");
  assert(takesThe("European Union"), "EU takes the");
  assert(!takesThe("France"), "France does not take the");
  assert(!takesThe("South Korea"), "South Korea does not take the");
  assert(
    theCountry("United Kingdom") === "the United Kingdom",
    "UK prose is the United Kingdom",
  );
  assert(
    TheCountry("United Kingdom") === "The United Kingdom",
    "UK sentence-start is The United Kingdom",
  );
  assert(theCountry("France") === "France", "France prose is bare");
  assert(TheCountry("France") === "France", "France sentence-start is bare");
  assert(
    countryPhrase("the United States", false) === "the United States",
    "existing the-prefix is not doubled",
  );
  newGame({ country: "United Kingdom" });
  G = getG();
  assert(
    T("{C} has a deficit.") === "The United Kingdom has a deficit.",
    "T() caps the at sentence start",
  );
  assert(
    T("Order books in {C} are thinning.") ===
      "Order books in the United Kingdom are thinning.",
    "T() keeps the mid-sentence",
  );
  assert(
    T("Bank of {C}") === "Bank of the United Kingdom",
    "T() adds the after of",
  );
  assert(
    T("{C}'s government chose to wait.") ===
      "The United Kingdom's government chose to wait.",
    "T() caps possessive at sentence start",
  );
  assert(
    T("the {C} is in surplus.") === "The United Kingdom is in surplus.",
    "T() does not double a written the",
  );
  assert(
    T("<p>{C} has a deficit.</p>") ===
      "<p>The United Kingdom has a deficit.</p>",
    "T() caps the after a <p>",
  );
  newGame({ country: "France" });
  G = getG();
  assert(
    T("{C} has a deficit.") === "France has a deficit.",
    "T() leaves France bare at sentence start",
  );
  assert(
    T("Order books in {C} are thinning.") ===
      "Order books in France are thinning.",
    "T() leaves France bare mid-sentence",
  );
  newGame({ country: "The Kingdom" });
  G = getG();
  assert(
    T("{C} has a deficit.") === "The Kingdom has a deficit.",
    "T() keeps The Kingdom at sentence start",
  );
  assert(
    T("in {C}") === "in the Kingdom",
    "T() lowercases the on The Kingdom mid-sentence",
  );
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke tests passed.");
