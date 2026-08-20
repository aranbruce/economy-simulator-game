import type { FactionId } from "./types.ts";
import { REALM_LAW, applyRealmLawOverlay } from "./realmLaws.ts";
import {
  TRADE_MATRIX,
  shareFor,
  shareLabel,
  partnerTradeSharePct,
} from "./tradeMatrix.ts";
import {
  COUNTRY_REGIONS,
  DEFAULT_BLOC_MEMBER,
  resolveHomeRole,
} from "./countries.ts";
import {
  theCountry,
  TheCountry,
  countryPhrase,
  countryLabel,
  countryAt,
  capSentenceThe,
  precededByThe,
} from "./countryPhrase.ts";
import {
  BLOC_TEMPLATES,
  CUSTOM_BLOC_TEMPLATES,
  blocById,
  countriesInBloc,
  isCustomsUnion,
  hasIndependentCommercialPolicy as blocIndependentPolicy,
  customUnionAssociationDeal,
} from "./blocs.ts";
import { NATION_PROFILE, REL_0 } from "./nationProfiles.ts";
import {
  clearBilateralTrade,
  seatsFromWorld,
  worldSeatIds,
} from "./worldTrade.ts";
import { stepCurrencyAreas } from "./fxAreas.ts";
import {
  CURRENCY_META,
  liveUsdRate,
  fxPairForCurrency,
  liveRateBetween,
  fmtFxRate,
  snapshotCurrencyRates,
} from "./currencyMeta.ts";
import {
  BASE_INCOME_DIST,
  BASE_DIST_GINI,
  buildIncomeDist,
  incomeDistForRole,
  activeIncomeDist,
  distMedian,
  preTaxGini,
  clearIncomeDistCache,
} from "./incomeDist.ts";
import {
  LEDGER_DECAY,
  LEDGER_FLOOR,
  ENVOY_SLOTS,
  ENVOY_TARGET,
  ENVOY_DRIFT,
  ENVOY_BUILD_CAP,
  ENVOY_ASSIGN_PC,
  ENVOY_UPKEEP_PC,
  ENVOY_RECALL_PC,
  ULTIMATUM_PC,
  ULTIMATUM_CD,
  ULTIMATUM_WAIT,
  ULTIMATUM_JITTER,
  DIPLO_POLICY_KEYS,
  DIPLO_SPHERES,
  DIPLO_CAMPS,
  ensureDiploStocks as ensureDiploStocksCore,
  tickEnvoyBuild,
  seedRelBase,
  addDiploLedger,
  setSanctionStance,
  clearSanctionStance,
  decayDiploLedger,
  maybeClearSanctionStance,
  spherePatronsForPartner,
  buildRelationModifiers,
  canIssueUltimatum as canIssueUltimatumCore,
  emptyEnvoys,
  ultimatumDemandsFor,
  baseP,
  concedeP,
  partnerSelfInterest,
  interestTag,
  commercialAcceptScore,
  commercialPackageScore,
  COMMERCIAL_ACCEPT_P,
  partnerTariffOnPlayer,
  ultimatumOutcomeImpacts,
  rollMissionEvent,
  formatMissionEventText,
  formatMissionTokens,
  MISSION_EVENTS,
  sharedCamp,
  VISIT_DURATION,
  SUMMIT_EVENT_BEATS,
  beginActiveVisit,
  visitQuartersLeft,
  isVisitActive,
  diploMapMarkers,
  hasFormalProtest,
} from "./diplomacy.ts";
import { queueDrawerPartnerScroll } from "../scrollDrawerPartner.ts";
import {
  COACH_STEPS,
  capitalShortfallHint,
  coachAwaitSatisfied,
  coachStepAt,
  coachStepCount,
  coachSubtasks,
} from "./coach.ts";

/* ==================================================================
   1. THE STATUTE BOOK  (all content data)
   ================================================================== */
/* The pure-data content arrays (FACTIONS, DEPTS, TAXES, POLICIES, VICE,
   PARTNERS, MISSIONS) and their macro-constant neighbours now live in
   ./statuteBook.ts, split out for having zero dependency on the live game
   state `G`. The diplomacy/ultimatum/bloc-accession/multiplayer-sync
   subsystem and the polity-transition helpers just below (normalisePolityId,
   polityOf, coupMetric, ...) were extracted to lib/sim/diplomacyMp.ts and
   reverted: the extraction worked (verified via typecheck/test/balance/
   world-modes/build/browser smoke test) but introduced the codebase's first
   circular module import for an organisational win only, which on reflection
   wasn't worth it — grand-strategy sims with a similar shape (Paradox's
   EU4/CK3/Stellaris) keep this kind of tightly-coupled simulation core as one
   unit for the same reason. What stayed from that attempt: every function
   here now reads state through `getG()`/`setG()` rather than the bare `G`
   binding, finishing a `g || G` fallback pattern that used to be applied
   inconsistently — see "TypeScript migration" above. */
import {
  FACTIONS,
  DEPTS,
  type DeptId,
  OTHER_SPEND,
  POLITY,
  POLITY_IDS,
  POLITY_LADDER,
  REL_POLITY,
  ULC_PASS,
  IMPORT_PASS,
  CRED_GAIN,
  RATE_FLOOR,
  MANUAL_RATE_MIN,
  PI_CONVEX,
  SLACK_MPC,
  WORLD_CORP,
  INDEX_LINKED,
  TAYLOR_PI,
  OKUN_BETA,
  LABOUR_SHARE,
  EMPLOYER_COLLECT,
  DEF_INCOME,
  CAP_INCOME_SHARE,
  DIV_OF_CAPITAL,
  DEF_NI,
  DEF_HEAD_OF_STATE,
  DEF_ELECTORAL,
  DEF_WORK_HOURS,
  DEF_CHILDCARE,
  DEF_MIN_WAGE,
  DEF_PENSION,
  BAND_NAMES,
  INDIRECT_PASS,
  TARIFF_PASS,
  TARIFF_IMPORT,
  type TaxId,
  TAXES,
  TAX_BY_ID,
  FLAT_BONUS,
  DUAL_BONUS,
  LAND_BONUS,
  CONSUMPTION_BONUS,
  POLICIES,
  type PolicyId,
  POLICY_BY_ID,
  VICE,
  type ViceId,
  VICE_BY_ID,
  PARTNERS,
  GRAVITY_Y,
  DEAL_BY_ID,
  MISSIONS,
  MISSION_BY_ID,
  MISSION_CD,
  REL_IMPULSE_DECAY,
  declaredFactor,
  OTHER_REV,
  TERM_LEN,
  CRED_LOSS,
  SHIFT_ELAST,
  IL_REAL_COUPON,
  MATURITY_PASS,
  TAYLOR_Y,
  TAYLOR_SMOOTH,
  U_ADJ,
  EMPLOYEE_COLLECT,
} from "./statuteBook.ts";
import { LAW_GROUPS, LAW_GROUP_BY_ID } from "./lawGroups.ts";
import {
  PARTIES,
  PARTY_BY_ID,
  PARTY_IDS,
  CHAMBER_SEATS,
  allocateElection,
  chamberVote,
  driftPopularity,
  lawDeltaTaste,
  leaderTitle as leaderTitleOf,
  layoutSeatsForConstitution,
  parliamentPowersOf,
  partyPluralismOf,
  partyStances,
  policyTaste,
  groupTaste,
  taxTaste,
  viceTaste,
  seedParties,
  seatsFromVotes,
  rulingAyeShare,
  voteIntentionFromFac,
  applyValenceSwing,
  whipAyeBoost,
  WHIP_MAX,
  votingSystemOf,
  labelledParties,
  applyPartyLabels,
  partyOverlayForRole,
  type PartyId,
} from "./parties.ts";
function normalisePolityId(key: any) {
  return key && POLITY[key] ? key : null;
}
/** Opening / partner pin from NATION_PROFILE only. */ function profilePolityId(
  role: any,
) {
  const id = resolveHomeRole(role != null ? role : "home");
  const p =
    id === "home" || id === "kingdom"
      ? NATION_PROFILE.kingdom
      : NATION_PROFILE[id];
  return normalisePolityId(p && p.polity) || "democracy";
}
/** Live polity id: player law.polity when present, else the profile pin. */ function polityIdOf(
  role?: any,
) {
  const g = getG();
  const id = resolveHomeRole(
    role != null
      ? role
      : (typeof g !== "undefined" && g && g.homeRole) || "home",
  );
  if (typeof g !== "undefined" && g && g.law && g.law.polity) {
    const live = normalisePolityId(g.law.polity);
    if (live) {
      const home = resolveHomeRole(g.homeRole || "home");
      if (id === home || role == null || role === g.homeRole) {
        if (g.law.polity !== live) g.law.polity = live;
        return live;
      }
    }
  }
  return profilePolityId(id);
}
function polityOf(role?: any) {
  return POLITY[polityIdOf(role)];
}
/** True once any LawGroup option that only makes sense under one-party rule
 *  is staged — single-party or banned opposition, a suppressed parliament,
 *  or banned assembly rights. Drives `syncPolityFromGroups` below, so the
 *  player never picks a contradictory "democracy with banned opposition"
 *  state; `law.polity` follows automatically instead of being its own
 *  pickable field. Hybrid is deliberately unreachable this way — the
 *  derivation is binary. */ function isAuthoritarianSignal(law: any) {
  const g = (law && law.groups) || {};
  return (
    g.partyPluralism === "singleParty" ||
    g.partyPluralism === "banned" ||
    g.parliamentaryPowers === "suppressed" ||
    g.assemblyRights === "banned"
  );
}
/** Derives `law.polity` (democracy/authoritarian only) from the LawGroup
 *  selections above, called from `setGroupOption` after every stage. Only
 *  flips at the boundary — staging a second authoritarian-signal option
 *  while already authoritarian is a no-op, same on the way back down. */ function syncPolityFromGroups(
  law: any,
) {
  if (!law || !law.groups) return;
  const authSignal = isAuthoritarianSignal(law);
  const wasAuth = law.polity === "authoritarian";
  if (authSignal && !wasAuth) law.polity = "authoritarian";
  else if (!authSignal && wasAuth) law.polity = "democracy";
}
function termLenOf(role: any) {
  const base = polityOf(role).termLen || TERM_LEN;
  const g = getG();
  /* Only override when the player has actually moved the mandate-duration
     slider away from its default — at the default, every polity keeps its
     own natural cadence (a 20-quarter election clock, a 40-quarter party
     congress, …) exactly as before this lever existed. */ if (
    g &&
    g.law &&
    g.law.headOfState &&
    g.law.headOfState.mandateYears &&
    g.law.headOfState.mandateYears !== DEF_HEAD_OF_STATE.mandateYears
  ) {
    const id = resolveHomeRole(
      role != null ? role : (g && g.homeRole) || "home",
    );
    const home = resolveHomeRole(g.homeRole || "home");
    if (id === home || role == null || role === g.homeRole) {
      return Math.round(g.law.headOfState.mandateYears) * 4;
    }
  }
  return base;
}
/** All live polity ids (ladder order). `from` is ignored — any system can
 *  stage any other; capital scales with distance via polityChangePc. */ function polityReachable(
  _from: any,
) {
  return POLITY_LADDER.slice();
}
function polityCanReach(from: any, to: any) {
  return !!normalisePolityId(to);
}
/** Steps on the democracy–hybrid–authoritarian ladder. */ function politySteps(
  from: any,
  to: any,
) {
  return Math.abs(polityRank(to) - polityRank(from));
}
/** Small multiplier on the capital cost of a polity change, driven by
 *  judicial immunity and parliamentary powers (lib/sim/lawGroups.ts) — the
 *  one place that content reaches past pure data into the polity mechanics
 *  themselves. `law.polity`/`POLITY`/`polityRank`/`polityAffinity` etc. stay
 *  untouched; this only scales the price. */ function stateFormChangePcMult(
  law: any,
) {
  const groups = (law && law.groups) || {};
  let mult = 1;
  /* "partial" immunity and "sovereign" powers are the opening defaults, so
     they carry no premium — only a departure from them does, keeping the
     multiplier exactly 1 (a no-op) at the game's default settings. */ if (
    groups.judicialImmunity === "total"
  )
    mult += 0.15;
  else if (groups.judicialImmunity === "none") mult -= 0.1;
  if (groups.parliamentaryPowers === "suppressed") mult += 0.25;
  else if (groups.parliamentaryPowers === "consultative") mult += 0.05;
  return clamp(mult, 0.6, 1.6);
}
function stateFormCapitalRegenMult(law: any) {
  const groups = (law && law.groups) || {};
  return groups.parliamentaryPowers === "suppressed" ? 0.85 : 1;
}
const FISCAL_RULE_PC = 3;
const FISCAL_RULE_DEFICIT = 4;
function fiscalRuleCapitalHit(law: any, deficitPct: number) {
  if (
    law &&
    law.policies &&
    law.policies.fiscalRule &&
    deficitPct > FISCAL_RULE_DEFICIT
  ) {
    return FISCAL_RULE_PC;
  }
  return 0;
}
/** Political capital to stage a polity change. Adjacent uses the target's
 *  changePc; leaping democracy ↔ authoritarian adds POLITY_LEAP_EXTRA. */ const POLITY_LEAP_EXTRA = 32;
function polityChangePc(from: any, to: any) {
  const dest = normalisePolityId(to);
  const src = normalisePolityId(from) || "democracy";
  if (!dest || src === dest) return 0;
  const base = POLITY[dest].changePc || 40;
  const steps = politySteps(src, dest);
  const g = getG();
  const mult = stateFormChangePcMult(g && (g.draft || g.law));
  return Math.ceil((base + Math.max(0, steps - 1) * POLITY_LEAP_EXTRA) * mult);
}
/** Symmetric affinity score in [-1, 1] for relations target. */ function polityAffinity(
  a: any,
  b: any,
) {
  const x = normalisePolityId(a) || "democracy";
  const y = normalisePolityId(b) || "democracy";
  if (x === y) return 1;
  const pair = (u: any, v: any) => (u < v ? u + "|" + v : v + "|" + u);
  const p = pair(x, y);
  if (p === "democracy|hybrid" || p === "authoritarian|hybrid") return 0.35;
  if (p === "authoritarian|democracy") return -0.7;
  return 0;
}
/** Ladder rank for liberalising / tightening shocks. */ function polityRank(
  id: any,
) {
  const i = POLITY_LADDER.indexOf(normalisePolityId(id) || id);
  return i >= 0 ? i : 0;
}
function polityShockFac(from: any, to: any) {
  const s = {
    business: 0,
    workers: 0,
    pensioners: 0,
    urban: 0,
    rural: 0,
    patriots: 0,
  };
  if (!from || !to || from === to) return s;
  const d = polityRank(to) - polityRank(from);
  if (d < 0) {
    /* Liberalising */ s.urban = 8;
    s.workers = 3;
    s.patriots = -10;
    s.business = -2;
  } else if (d > 0) {
    /* Tightening */ s.patriots = 8;
    s.urban = -10;
    s.business = 3;
    s.workers = -3;
  }
  return s;
}
function coupMetric(fac: any, meta: any) {
  const m = meta || polityOf();
  if (m.coupOn === "patriots")
    return fac && fac.patriots != null ? fac.patriots : 50;
  return approvalOf(fac);
}
function reviewNoun(meta?: any) {
  const m = meta || polityOf();
  return m.kind === "congress"
    ? "congress"
    : m.kind === "managed"
      ? "ballot"
      : "election";
}
function reviewStamp(meta: any) {
  const m = meta || polityOf();
  return m.kind === "congress"
    ? "Party congress"
    : m.kind === "managed"
      ? "Managed ballot"
      : "General election";
}
function careerHint(meta: any, sandbox: any) {
  const m = meta || polityOf();
  if (sandbox)
    return "Sandbox is on: you cannot be removed from office. Switch to Career any time from the Programme drawer.";
  if (m.kind === "congress") {
    return "Career mode: survive the party congress, keep the apparatus loyal, or the bond market ends you. Political capital recovers slowly. Sandbox is one click away in the Programme drawer.";
  }
  if (m.kind === "managed") {
    return "Career mode: managed ballots still matter, as does your party — or the bond market ends you. Sandbox is one click away in the Programme drawer.";
  }
  return "Career mode: lose an election, a party coup, or the bond market and it is over. Sandbox is one click away in the Programme drawer.";
}
function polityShiftAge() {
  const g = getG();
  if (!g || !g.polityShift || g.polityShift.q == null) return null;
  return g.q - g.polityShift.q;
}
function polityShiftIsLiberalising(shift: any) {
  if (!shift) return false;
  return polityRank(shift.to) < polityRank(shift.from);
}
function polityShiftIsTightening(shift: any) {
  if (!shift) return false;
  return polityRank(shift.to) > polityRank(shift.from);
}
/* Income distribution: BASE_INCOME_DIST in lib/sim/incomeDist.js. Seats reshape
   it to their soc0.gini at settle (econ.incomeDist); fixed for the run. */
/* Chosen so the implied multipliers land near the empirical range: roughly 1.0
   for public investment, 0.75 for transfers, 0.55 for a broad tax cut. Multipliers
   now emerge from the national-accounts identity; this note is documentation only. */ /* Employer contributions are ultimately borne by workers as lower wages, but the
   pass-through takes years (Gruber 1997; Saez, Matsaganis & Tsakloglou 2012).
   Until it completes, the tax sits as a wedge between what a job costs and what
   the worker receives, and that unshifted part is what shows up in employment.
   At 0.075 a quarter, half of a change has passed into wages after nine
   quarters and nearly all of it after five years. */ const WAGE_SHIFT = 0.075;
/* Wage-setting / price-setting equilibrium unemployment, after Layard, Nickell
   and Jackman. Structural unemployment rises with the total tax wedge, with the
   benefit replacement ratio, and falls with active labour market spending:

     u* = u0 + a1*(wedge - wedge0) + a2*(unshifted employer wedge)
             + a3*(replacement ratio) - a4*(skills)

   The wedge enters in percentage points. a1 near 0.06 sits at the lower end of
   Nickell's estimates; a2 is larger because a cost that has not yet reached
   wages falls directly on labour demand. */ const U_STAR = 4.1,
  WEDGE_ELAST = 0.06,
  LABOUR_COST_ELAST = 0.3,
  REPLACEMENT_ELAST = 0.06,
  SKILLS_ELAST = 0.05;
/* Natural real rate (r*) for the Taylor rule and the consumption real-rate term. */ const R_NEUTRAL = 3.4,
  R_NEUTRAL_REAL = 2.0;
/* Phillips curve: lambda is inertia, kappa the slope, anchor the weight on target */ const PI_TARGET = 2.0,
  PI_LAMBDA = 0.55,
  PI_KAPPA = 0.16,
  PI_ADJ = 0.09;
/* ---- Wages and unit labour costs ----
   Prices do not respond to the output gap directly. Firms mark up over unit
   labour costs, and unit labour costs are wage growth less productivity growth.
   Wages are bargained against expected inflation and the state of the labour
   market:

       wage growth = expected inflation + productivity growth + w*(u* - u)
       ULC growth  = wage growth - productivity growth
       inflation   = markup pass-through of ULC + import prices + indirect taxes

   This is what makes the employer NI wedge, the minimum wage and the
   participation margin reach prices through the channel they actually use. */ const WAGE_CURVE = 0.42; // wage response to a point of labour market slack

/** Drop unknown missions and sanctions staged against a live state visit. */
function pruneInvalidDraftMissions(g: any) {
  const state = g || (typeof getG() !== "undefined" ? getG() : null);
  if (!state || !state.draft || !state.draft.missions) return;
  for (const pid of Object.keys(state.draft.missions)) {
    const mid = state.draft.missions[pid];
    if (!(MISSION_BY_ID as any)[mid]) {
      delete state.draft.missions[pid];
      continue;
    }
    if (mid === "sanctionsPosture" && isVisitActive(state, pid)) {
      delete state.draft.missions[pid];
    }
  }
}

function seedGameRelBase(g: any) {
  if (!g || !g.econ || !g.rel) return;
  ensureDiploStocks(g.econ);
  const polityOffset: Record<string, any> = {};
  for (const id of Object.keys(g.rel)) {
    const aff = polityAffinity(polityIdOf(g.homeRole), profilePolityId(id));
    (polityOffset as any)[id] = REL_POLITY * aff;
  }
  seedRelBase(g.econ, g.rel, { polityOffset });
}

const SUMMIT_TARIFF_DELTA = 2;
const SUMMIT_COMMERCIAL_WAIT = 4;
const SUMMIT_DEAL_REL = 8;
const SUMMIT_DEAL_IMPULSE = 6;

function diploDeps() {
  return {
    clamp,
    aggregate,
    effectiveTariff,
    BASE_TARIFF,
    REL_POLITY,
    polityAffinity,
    polityIdOf,
    profilePolityId,
    DEAL_BY_ID,
    dealById,
    TAXES,
    partnerShare,
    playerCountryId,
    activePartners,
    lawForRole,
    COUNTRY_REGIONS,
    partnerById,
    realmGdpBn,
    sharedCamp,
    T,
    buildSummitCommercialEvent,
    isHumanMpSeat,
  };
}

function snapshotPartnerTariffs(g: any) {
  if (!g) return {};
  const deps = diploDeps();
  const out: Record<string, number> = {};
  for (const p of activePartners(g.homeRole)) {
    const t = partnerTariffOnPlayer(p.id, g, deps);
    if (t != null) out[p.id] = t;
  }
  return out;
}

/** Bilateral exports and imports in the same index points as the net-trade
 *  chart. Named partners plus `rest` are scaled so they sum to headline X
 *  and M — a breakdown of the series, not a second set of units.
 *  Inbound legs are size-weighted by the partner's opening GDP so a large
 *  exporter's small share of its own trade still shows up as a large slice
 *  of our import bill.
 */
function snapshotPartnerTrade(g: any) {
  if (!g || !g.econ) return {};
  const e = g.econ;
  const playerId = playerCountryId(g.homeRole);
  const partners = activePartners(g.homeRole);
  const flows =
    (g.worldTrade && g.worldTrade.flows) || ({} as Record<string, any>);
  const bilat = e.bilateralX || {};
  const outFlows = e.clearedFlows || flows[playerId] || {};
  const totals =
    e.clearedTotals ||
    (g.worldTrade && g.worldTrade.totals && g.worldTrade.totals[playerId]) ||
    null;
  const homeGdp0 = gdp0ForSeat(g.homeRole);

  const raw: Record<string, { X: number; M: number }> = {};
  let namedX = 0;
  let namedM = 0;
  let namedMRaw = 0;
  for (const p of partners) {
    const X =
      bilat[p.id] != null
        ? +bilat[p.id]
        : outFlows[p.id] != null
          ? +outFlows[p.id]
          : 0;
    const inbound = flows[p.id];
    const Mraw = inbound && inbound[playerId] != null ? +inbound[playerId] : 0;
    const theirs = gdp0ForSeat(p.id);
    const sizeW =
      homeGdp0 > 0 && theirs > 0
        ? Math.max(0.2, Math.pow(theirs / homeGdp0, 0.62))
        : 1;
    const M = Mraw * sizeW;
    raw[p.id] = { X, M };
    namedX += X;
    namedM += M;
    namedMRaw += Mraw;
  }

  const restX =
    bilat.rest != null
      ? +bilat.rest
      : outFlows.rest != null
        ? +outFlows.rest
        : 0;
  const playerM = totals && totals.M != null ? +totals.M : namedMRaw;
  raw.rest = { X: restX, M: Math.max(0, playerM - namedMRaw) };

  const sumX = namedX + raw.rest.X;
  let sumM = namedM + raw.rest.M;
  const targetX = e.X != null ? e.X : sumX;
  const targetM = e.M != null ? e.M : sumM;
  if (sumM < 1e-9 && targetM > 0 && sumX > 1e-9) {
    for (const id of Object.keys(raw)) raw[id].M = raw[id].X;
    sumM = sumX;
  }
  const scaleX = sumX > 1e-9 ? targetX / sumX : 1;
  const scaleM = sumM > 1e-9 ? targetM / sumM : 1;
  const out: Record<string, { X: number; M: number }> = {};
  for (const id of Object.keys(raw)) {
    out[id] = { X: raw[id].X * scaleX, M: raw[id].M * scaleM };
  }
  return out;
}

function livePartnerTariffOnPlayer(partnerId: any, g?: any) {
  const state = g || getG();
  return partnerTariffOnPlayer(partnerId, state, diploDeps());
}

function canNegotiateReciprocalTariffs(g: any, partnerId: any) {
  if (!g || !partnerId) return false;
  const player = playerCountryId(g.homeRole);
  if (!hasIndependentCommercialPolicy(player, g.blocMember)) return false;
  if (!hasIndependentCommercialPolicy(partnerId, g.blocMember)) return false;
  if (shareSameBloc(partnerId, g.homeRole, g.blocMember)) return false;
  if (tariffLocked(g.draft || g.law, g.homeRole, g.blocMember).mode !== "none")
    return false;
  return true;
}

function dealById(id: any, g?: any) {
  if (!id) return null;
  if ((DEAL_BY_ID as any)[id]) return (DEAL_BY_ID as any)[id];
  const state = g || getG();
  const custom = state && state.customBlocs;
  if (!custom) return null;
  for (const bid of Object.keys(custom)) {
    const d = custom[bid] && custom[bid].externalDeal;
    if (d && d.id === id) return d;
  }
  return null;
}

function unionAssociationDeal(blocId: any, g?: any) {
  if (!blocId) return null;
  const named = blocById(blocId);
  if (named && named.externalDeal) return named.externalDeal;
  const state = g || getG();
  const custom = state && state.customBlocs && state.customBlocs[blocId];
  return (custom && custom.externalDeal) || null;
}

function countryCuBlocId(countryId: any, g: any) {
  if (!countryId || !g) return null;
  if (hasIndependentCommercialPolicy(countryId, g.blocMember)) return null;
  return countryBlocId(countryId, g.blocMember);
}

/** One side is a customs union, the other has independent commercial policy. */
function cuBoundary(g: any, partnerId: any) {
  if (!g || !partnerId) return null;
  if (shareSameBloc(partnerId, g.homeRole, g.blocMember)) return null;
  const player = playerCountryId(g.homeRole);
  const playerCu = countryCuBlocId(player, g);
  const partnerCu = countryCuBlocId(partnerId, g);
  if (playerCu && !partnerCu) {
    return {
      blocId: playerCu,
      outsiderId: partnerId,
      playerInCu: true,
      hostId: partnerId,
    };
  }
  if (!playerCu && partnerCu) {
    return {
      blocId: partnerCu,
      outsiderId: player,
      playerInCu: false,
      hostId: partnerId,
    };
  }
  return null;
}

function canNegotiateUnionCommercial(g: any, partnerId: any) {
  return !!cuBoundary(g, partnerId);
}

function canNegotiateTariffs(g: any, partnerId: any) {
  return (
    canNegotiateReciprocalTariffs(g, partnerId) ||
    canNegotiateUnionCommercial(g, partnerId)
  );
}

function unionCommercialRelationMin(blocId: any, g?: any) {
  const state = g || getG();
  const custom = state && state.customBlocs && state.customBlocs[blocId];
  const named = blocById(blocId);
  const tpl = custom && (CUSTOM_BLOC_TEMPLATES as any)[custom.template];
  if (tpl && tpl.externalDealRelationMin != null)
    return tpl.externalDealRelationMin;
  if (named && named.accession && named.accession.memberRelationMin != null)
    return named.accession.memberRelationMin;
  return 42;
}

function unionPackageApprovals(g: any, bound: any) {
  if (!g || !bound) return [];
  return blocDealMemberApprovals(
    bound.blocId,
    unionCommercialRelationMin(bound.blocId, g),
  );
}

function unionCommercialDealBlockers(partnerId: any, dealId: any, g?: any) {
  return unionDealContentBlockers(partnerId, dealId, g);
}

/** Host score, capped by the coolest union member. Warmth is never a veto. */
function commercialScore(
  kind: "tariff" | "deal",
  partnerId: any,
  g: any,
  meta?: any,
) {
  const deps = diploDeps();
  const host = commercialAcceptScore(kind, partnerId, g, deps, meta);
  if (isHumanMpSeat(g, partnerId)) return host;
  const bound = cuBoundary(g, partnerId);
  if (!bound) return host;
  let p = host.p != null ? +host.p : host.ok ? 1 : 0;
  let reason = host.reason;
  for (const a of unionPackageApprovals(g, bound)) {
    if (!a || a.id === partnerId) continue;
    const r = commercialAcceptScore(kind, a.id, g, deps, meta);
    const rp = r.p != null ? +r.p : r.ok ? 1 : 0;
    if (rp < p) {
      p = rp;
      if (!r.ok) reason = r.reason;
    }
  }
  const ok = p >= COMMERCIAL_ACCEPT_P;
  return Object.assign({}, host, { p, ok, reason: ok ? null : reason });
}

function unionDealContentBlockers(partnerId: any, dealId: any, g?: any) {
  const state = g || getG();
  const out = [];
  const bound = cuBoundary(state, partnerId);
  const d = dealById(dealId, state);
  if (!d) {
    out.push("unknown deal");
    return out;
  }
  if (!bound) {
    out.push("not a customs-union boundary");
    return out;
  }
  if (d.blocId) {
    if (d.blocId !== bound.blocId) out.push("deal does not match union");
    if (bound.playerInCu) out.push("association is for outsiders");
  } else if (d.partner) {
    if (!bound.playerInCu) out.push("country treaties are for union members");
    if (d.partner !== bound.outsiderId) out.push("deal does not match partner");
  }
  if (d.need) {
    needBlockers(d.need, state.draft || state.law, {
      partner: bound.playerInCu ? bound.outsiderId : partnerId,
    }).forEach((b: any) => out.push(b));
  }
  return out;
}

function cutCountryRateOnLaw(
  law: any,
  targetId: any,
  delta: any,
  homeRole: any,
  blocMember: any,
) {
  if (!law || !targetId || !delta) return;
  ensureTariffSchedule(law);
  const cur = effectiveTariff(targetId, law, homeRole, blocMember);
  law.tariffSchedule.country[targetId] = clamp(cur - delta, 0, 45);
  syncTariffHeadline(law, homeRole);
}

function cutBlocRateOnLaw(
  law: any,
  blocId: any,
  delta: any,
  samplePartnerId: any,
  homeRole: any,
  blocMember: any,
) {
  if (!law || !blocId || !delta) return;
  ensureTariffSchedule(law);
  const cur = effectiveTariff(samplePartnerId, law, homeRole, blocMember);
  law.tariffSchedule.bloc[blocId] = clamp(cur - delta, 0, 45);
  for (const m of countriesInBloc(blocId, blocMember || {})) {
    if (law.tariffSchedule.country) delete law.tariffSchedule.country[m];
  }
  syncTariffHeadline(law, homeRole);
}

function revertUnionIssuerTariff(g: any, fromId: any, inbound: any) {
  const issuer = g && g.world && g.world[fromId];
  const law = issuer && issuer.law;
  if (!law) return;
  ensureTariffSchedule(law);
  const bid = inbound && inbound.unionBlocId;
  if (bid && inbound.playerInCu) {
    if (law.tariffSchedule.country)
      delete law.tariffSchedule.country[inbound.outsiderId];
  } else if (bid) {
    if (law.tariffSchedule.bloc) delete law.tariffSchedule.bloc[bid];
  } else if (inbound && inbound.toId && law.tariffSchedule.country) {
    delete law.tariffSchedule.country[inbound.toId];
  }
  syncTariffHeadline(law, issuer.role || worldRoleForSeat(fromId));
}

function applyUnionPlayerTariffCut(g: any, bound: any, delta: any) {
  if (!g || !bound || !delta) return true;
  const player = playerCountryId(g.homeRole);
  const bm = g.blocMember || {};
  if (bound.playerInCu) {
    cutCountryRateOnLaw(g.law, bound.outsiderId, delta, g.homeRole, bm);
    cutCountryRateOnLaw(g.draft, bound.outsiderId, delta, g.homeRole, bm);
    for (const mid of blocMembers(bound.blocId, bm)) {
      if (mid === player) continue;
      const seat = g.world && g.world[mid];
      if (!seat || !seat.law) continue;
      const role = seat.role || worldRoleForSeat(mid);
      cutCountryRateOnLaw(seat.law, bound.outsiderId, delta, role, bm);
    }
  } else {
    cutBlocRateOnLaw(g.law, bound.blocId, delta, bound.hostId, g.homeRole, bm);
    cutBlocRateOnLaw(
      g.draft,
      bound.blocId,
      delta,
      bound.hostId,
      g.homeRole,
      bm,
    );
  }
  mirrorPlayerToWorld(g);
  return true;
}

function applyUnionPartnerTariffCut(g: any, bound: any, delta: any) {
  if (!g || !bound || !delta) return true;
  const player = playerCountryId(g.homeRole);
  const bm = g.blocMember || {};
  if (bound.playerInCu) {
    const seat = g.world && g.world[bound.outsiderId];
    if (!seat || !seat.law) return false;
    const role = seat.role || worldRoleForSeat(bound.outsiderId);
    cutBlocRateOnLaw(seat.law, bound.blocId, delta, player, role, bm);
  } else {
    for (const mid of blocMembers(bound.blocId, bm)) {
      const seat = g.world && g.world[mid];
      if (!seat || !seat.law) continue;
      const role = seat.role || worldRoleForSeat(mid);
      cutCountryRateOnLaw(seat.law, player, delta, role, bm);
    }
  }
  return true;
}

function applyOurSummitTariffCut(g: any, partnerId: any, delta: any) {
  const bound = cuBoundary(g, partnerId);
  if (bound) return applyUnionPlayerTariffCut(g, bound, delta);
  return applyPlayerTariffCutOnPartner(g, partnerId, delta);
}

function applyDraftOurSummitTariffCut(g: any, partnerId: any, delta: any) {
  const bound = cuBoundary(g, partnerId);
  if (!bound) return applyDraftTariffCutOnPartner(g, partnerId, delta);
  if (!g || !g.draft || !delta) return !!delta;
  const bm = g.blocMember || {};
  if (bound.playerInCu) {
    cutCountryRateOnLaw(g.draft, bound.outsiderId, delta, g.homeRole, bm);
  } else {
    cutBlocRateOnLaw(
      g.draft,
      bound.blocId,
      delta,
      bound.hostId,
      g.homeRole,
      bm,
    );
  }
  return true;
}

function applyTheirSummitTariffCut(g: any, partnerId: any, delta: any) {
  const bound = cuBoundary(g, partnerId);
  const player = playerCountryId(g.homeRole);
  if (bound) return applyUnionPartnerTariffCut(g, bound, delta);
  return applyPartnerTariffCutOnPlayer(g, partnerId, player, delta);
}

function applyPlayerTariffCutOnPartner(g: any, partnerId: any, delta: any) {
  if (!g || !partnerId) return false;
  if (!delta) return true;
  const applyTo = (law: any) => {
    if (!law) return;
    ensureTariffSchedule(law);
    const cur = law.tariffSchedule.country[partnerId];
    const base =
      cur != null
        ? cur
        : law.tariffSchedule.default != null
          ? law.tariffSchedule.default
          : BASE_TARIFF;
    law.tariffSchedule.country[partnerId] = clamp(base - delta, 0, 45);
    syncTariffHeadline(law, g.homeRole);
  };
  applyTo(g.draft);
  applyTo(g.law);
  mirrorPlayerToWorld(g);
  return true;
}

function applyDraftTariffCutOnPartner(g: any, partnerId: any, delta: any) {
  if (!g || !g.draft || !partnerId) return false;
  if (!delta) return true;
  ensureTariffSchedule(g.draft);
  const cur = g.draft.tariffSchedule.country[partnerId];
  const base =
    cur != null
      ? cur
      : g.draft.tariffSchedule.default != null
        ? g.draft.tariffSchedule.default
        : BASE_TARIFF;
  g.draft.tariffSchedule.country[partnerId] = clamp(base - delta, 0, 45);
  syncTariffHeadline(g.draft, g.homeRole);
  return true;
}

function applyPartnerTariffCutOnPlayer(
  g: any,
  partnerId: any,
  playerId: any,
  delta: any,
) {
  const seat = g && g.world && g.world[partnerId];
  if (!seat || !seat.law || !playerId) return false;
  if (!delta) return true;
  ensureTariffSchedule(seat.law);
  const cur = seat.law.tariffSchedule.country[playerId];
  const base =
    cur != null
      ? cur
      : seat.law.tariffSchedule.default != null
        ? seat.law.tariffSchedule.default
        : BASE_TARIFF;
  seat.law.tariffSchedule.country[playerId] = clamp(base - delta, 0, 45);
  syncTariffHeadline(seat.law, seat.role || worldRoleForSeat(partnerId));
  return true;
}

function aiAcceptsReciprocalTariff(
  g: any,
  partnerId: any,
  ourDelta?: any,
  theirDelta?: any,
) {
  const od = ourDelta != null ? +ourDelta : SUMMIT_TARIFF_DELTA;
  const td = theirDelta != null ? +theirDelta : od;
  return commercialScore("tariff", partnerId, g, {
    ourDelta: od,
    theirDelta: td,
    delta: td,
  }).ok;
}

function summitAgendaParts(
  g: any,
  partnerId: any,
  ourDelta: any,
  theirDelta: any,
  dealIds: any,
) {
  const parts: { p: number; ok: boolean; pending?: boolean }[] = [];
  if ((+ourDelta || 0) > 0 || (+theirDelta || 0) > 0) {
    const r = commercialScore("tariff", partnerId, g, {
      ourDelta: +ourDelta || 0,
      theirDelta: +theirDelta || 0,
      delta: +theirDelta || 0,
    });
    parts.push({ p: r.p, ok: !!r.ok });
  }
  for (const id of Array.isArray(dealIds) ? dealIds : []) {
    if (!id) continue;
    const r = commercialScore("deal", partnerId, g, {
      dealId: id,
    });
    parts.push({ p: r.p, ok: !!r.ok });
  }
  return parts;
}

function aiAcceptsSummitAgenda(
  g: any,
  partnerId: any,
  ourDelta: any,
  theirDelta: any,
  dealIds: any,
) {
  if (isHumanMpSeat(g, partnerId)) return { p: 1, ok: true, pending: true };
  return commercialPackageScore(
    summitAgendaParts(g, partnerId, ourDelta, theirDelta, dealIds),
  );
}

function aiAcceptsBilateralDeal(g: any, partnerId: any, dealId: any) {
  const d = dealById(dealId, g);
  if (!d) return false;
  return commercialScore("deal", partnerId, g, {
    dealId,
  }).ok;
}

function enactBilateralDealOnLaw(g: any, dealId: any) {
  if (!g.law.deals) g.law.deals = {};
  if (!g.draft.deals) g.draft.deals = {};
  g.law.deals[dealId] = true;
  g.draft.deals[dealId] = true;
  applySphereTrespassOnDeal(dealId, true);
  mirrorPlayerToWorld(g);
}

/** Ratify a bilateral deal when both sides agree — no bill, capital, or vote. */
function ratifyBilateralDealWithPartner(
  g: any,
  partnerId: any,
  dealId: any,
  skipAccept?: boolean,
) {
  const d = dealById(dealId, g);
  if (!d) return { ok: false, error: "Unknown deal" };
  const pid = partnerId || d.partner;
  const bound = cuBoundary(g, pid);
  if (d.blocId) {
    if (!bound || bound.blocId !== d.blocId)
      return { ok: false, error: "Partner mismatch" };
  } else if (d.partner !== pid) {
    return { ok: false, error: "Partner mismatch" };
  }
  if (bound) {
    const unmet = unionCommercialDealBlockers(pid, dealId, g);
    if (unmet.length)
      return { ok: false, error: "Deal blocked", blocked: true };
  } else if (dealBlockers(d).length) {
    return { ok: false, error: "Deal blocked", blocked: true };
  }
  if (g.law && g.law.deals && g.law.deals[dealId])
    return { ok: true, already: true };

  const playerId = playerCountryId(g.homeRole);
  const pName = theCountry(partnerById(pid)?.name || pid);

  if (isHumanMpSeat(g, pid)) {
    if (!parkInboundDealProposal(g, playerId, pid, dealId)) {
      return {
        ok: false,
        error: "Partner already has a pending treaty proposal",
      };
    }
    if (g.brief) {
      g.brief = [pName + " — treaty proposal sent, awaiting their answer."]
        .concat(g.brief)
        .slice(0, 3);
    }
    return { ok: true, pending: true };
  }

  if (!skipAccept && !aiAcceptsBilateralDeal(g, pid, dealId)) {
    if (g.rel && g.rel[pid] != null) {
      g.rel[pid] = clamp(g.rel[pid] - 2, 5, 95);
    }
    if (g.brief) {
      g.brief = [pName + " declined the treaty — " + d.name + "."]
        .concat(g.brief)
        .slice(0, 3);
    }
    pushDiploAlert(g, {
      kind: "deal_propose_decline",
      partnerId: pid,
      dealId,
      label: d.name,
      q: g.q,
      expiresQ: (g.q || 0) + 3,
    });
    return { ok: false, declined: true };
  }

  enactBilateralDealOnLaw(g, dealId);
  return { ok: true };
}

function summitTariffRoom(g: any, partnerId: any) {
  const their = livePartnerTariffOnPlayer(partnerId, g);
  const law = (g && (g.draft || g.law)) || null;
  const our = law
    ? effectiveTariff(partnerId, law, g.homeRole, g.blocMember)
    : null;
  if (their == null || our == null) return null;
  const ourMax = Math.max(0, Math.floor(our + 1e-6));
  const theirMax = Math.max(0, Math.floor(their + 1e-6));
  if (ourMax < 1 && theirMax < 1) return null;
  return { our, their, ourMax, theirMax };
}

function summitTariffPackages(g: any, partnerId: any) {
  const room = summitTariffRoom(g, partnerId);
  if (!room) return [];
  const { ourMax, theirMax } = room;
  const packs: { ourDelta: number; theirDelta: number; delta?: number }[] = [];
  const seen = new Set<string>();
  const add = (ourDelta: number, theirDelta: number, equal?: boolean) => {
    const o = Math.max(0, Math.min(ourMax, Math.round(ourDelta)));
    const t = Math.max(0, Math.min(theirMax, Math.round(theirDelta)));
    if (o <= 0 && t <= 0) return;
    const k = o + ":" + t;
    if (seen.has(k)) return;
    seen.add(k);
    packs.push(
      equal
        ? { ourDelta: o, theirDelta: t, delta: o }
        : { ourDelta: o, theirDelta: t },
    );
  };
  const eqCap = Math.min(ourMax, theirMax);
  if (eqCap >= 1) add(1, 1, true);
  if (eqCap >= 2) add(2, 2, true);
  if (eqCap >= 3) add(eqCap, eqCap, true);
  if (ourMax !== theirMax && ourMax >= 1 && theirMax >= 1)
    add(ourMax, theirMax);
  return packs;
}

function tariffPackageLabel(
  ourDelta: number,
  theirDelta: number,
  ourMax: number,
  theirMax: number,
) {
  if (ourDelta === theirDelta) {
    if (ourDelta <= 1)
      return (
        "Modest reciprocal cut (−" +
        ourDelta +
        " pt" +
        (ourDelta === 1 ? "" : "s") +
        " each way)"
      );
    if (ourDelta <= 2)
      return "Reciprocal tariff cut (−" + ourDelta + " pts each way)";
    if (ourDelta >= ourMax && theirDelta >= theirMax)
      return "Both sides to 0 (−" + ourDelta + " / −" + theirDelta + ")";
    return "Deep reciprocal cut (−" + ourDelta + " pts each way)";
  }
  const ourZ = ourDelta >= ourMax && ourMax > 0;
  const theirZ = theirDelta >= theirMax && theirMax > 0;
  return (
    "We cut " +
    ourDelta +
    (ourZ ? " (to 0)" : "") +
    " · they cut " +
    theirDelta +
    (theirZ ? " (to 0)" : "")
  );
}

function previewSummitTariff(partnerId: any, ourDelta: any, theirDelta: any) {
  const g = getG();
  if (!g || !partnerId) return { ok: false, reason: "No partner" };
  if (!canNegotiateTariffs(g, partnerId))
    return { ok: false, reason: "Cannot negotiate tariffs here" };
  if (isHumanMpSeat(g, partnerId))
    return { ok: true, reason: null, pending: true, p: 1 };
  return commercialScore("tariff", partnerId, g, {
    ourDelta,
    theirDelta,
    delta: theirDelta,
  });
}

function formatSummitCommercialOpt(
  o: any,
  ctx: any,
  pName: string,
  rivalName: string,
  _commercial: boolean,
  onPick: (opt: any) => void,
) {
  return {
    b: formatMissionTokens(o.b, pName, rivalName),
    e: formatMissionTokens(o.e, pName, rivalName),
    hint: missionOptionHint(o, ctx),
    disabled: false,
    f: () => onPick(o),
  };
}

function pendingInboundSummitCommercial(pol: any) {
  const prop = pol && pol.inboundSummitCommercial;
  if (!prop || prop.status !== "pending") return null;
  return prop;
}

function summitDealEntries(g: any, dealIds: any) {
  const out: { id: string; label: string; terms: string[] }[] = [];
  const seen = new Set<string>();
  for (const id of Array.isArray(dealIds) ? dealIds : []) {
    if (!id || seen.has(id)) continue;
    const d = dealById(id, g);
    if (!d) continue;
    seen.add(id);
    out.push({
      id: d.id,
      label: d.name,
      terms: Array.isArray(d.terms) ? d.terms.slice() : [],
    });
  }
  return out;
}

function inboundSummitDeals(prop: any, extra?: any) {
  const out: { id: string; label: string; terms: string[] }[] = [];
  const seen = new Set<string>();
  const add = (id: any, label?: any, terms?: any) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const d = dealById(id);
    out.push({
      id,
      label: label || (d && d.name) || id,
      terms: Array.isArray(terms)
        ? terms.slice()
        : d && Array.isArray(d.terms)
          ? d.terms.slice()
          : [],
    });
  };
  if (Array.isArray(prop && prop.deals)) {
    for (const d of prop.deals)
      add(d && (d.id || d.dealId), d && (d.label || d.name), d && d.terms);
  }
  if (Array.isArray(prop && prop.dealIds)) {
    for (const id of prop.dealIds) add(id);
  }
  if (prop && prop.dealId) add(prop.dealId, prop.label, prop.terms);
  if (extra && extra.dealId) add(extra.dealId, extra.label, extra.terms);
  if (Array.isArray(extra && extra.deals)) {
    for (const d of extra.deals)
      add(d && (d.id || d.dealId), d && (d.label || d.name), d && d.terms);
  }
  return out;
}

function inboundSummitDealKey(prop: any) {
  return inboundSummitDeals(prop)
    .map((d) => d.id)
    .join(",");
}

/** Attach treaties onto a parked summit tariff offer so the recipient sees one agenda. */
function attachInboundSummitDeals(
  g: any,
  fromId: any,
  toId: any,
  dealIds: any,
) {
  const deals = summitDealEntries(g, dealIds);
  if (!deals.length) return false;
  if (!g || !fromId || !toId || fromId === toId) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const pol = normalizeDiploPolitics(g.politics[toId]);
  const existing = pendingInboundSummitCommercial(pol);
  if (!existing || (existing.fromId && existing.fromId !== fromId))
    return false;
  if (!existing.deals) existing.deals = [];
  const have = new Set(existing.deals.map((d: any) => d.id));
  for (const d of deals) if (!have.has(d.id)) existing.deals.push(d);
  return true;
}

function parkInboundSummitCommercial(
  g: any,
  fromId: any,
  toId: any,
  ourDelta: any,
  theirDelta?: any,
) {
  const od = ourDelta != null ? +ourDelta : 0;
  const td = theirDelta != null ? +theirDelta : od;
  if (!g || !fromId || !toId || fromId === toId) return false;
  if (!(td > 0)) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const pol = normalizeDiploPolitics(g.politics[toId]);
  const existing = pol.inboundSummitCommercial;
  if (
    existing &&
    existing.status === "pending" &&
    existing.fromId &&
    existing.fromId !== fromId
  ) {
    return false;
  }
  const bound = cuBoundary(g, toId);
  const keptDeals =
    existing &&
    existing.status === "pending" &&
    existing.fromId === fromId &&
    Array.isArray(existing.deals)
      ? existing.deals
      : [];
  pol.inboundSummitCommercial = {
    fromId,
    ourDelta: od,
    theirDelta: td,
    delta: td,
    deals: keptDeals,
    sentQ: g.q || 0,
    expiresQ: (g.q || 0) + SUMMIT_COMMERCIAL_WAIT,
    status: "pending",
    unionBlocId: bound ? bound.blocId : null,
    outsiderId: bound ? bound.outsiderId : null,
    playerInCu: bound ? !!bound.playerInCu : false,
    toId,
  };
  return true;
}

function clearInboundSummitCommercial(g: any, toId: any) {
  const pol = g && g.politics && g.politics[toId];
  if (!pol) return;
  pol.inboundSummitCommercial = null;
}

function applyMpInboundSummitCommercialChoice(
  g: any,
  seatId: any,
  accept: any,
) {
  if (!g || !g.world || !g.world[seatId]) {
    return { ok: false, error: "Unknown seat" };
  }
  if (!g.politics || !g.politics[seatId]) {
    return { ok: false, error: "Missing seat politics" };
  }
  const targetPol = normalizeDiploPolitics(g.politics[seatId]);
  const inbound = pendingInboundSummitCommercial(targetPol);
  if (!inbound) {
    return { ok: false, error: "No pending summit commercial offer" };
  }
  const fromId = inbound.fromId;
  if (!fromId || !g.politics[fromId] || !g.world[fromId]) {
    return { ok: false, error: "Unknown issuer" };
  }
  const prev = getG();
  const savedMount = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
    mods: g.mods,
    sandbox: g.sandbox,
    rateManual: g.rateManual,
    manualRate: g.manualRate,
  };
  try {
    setG(g);
    g.q = g.q != null ? g.q : 0;

    const cut = inbound.theirDelta != null ? inbound.theirDelta : inbound.delta;
    const hasTariff = +cut > 0;
    const deals = inboundSummitDeals(inbound);
    const pairedDeal = pendingInboundDealProposal(targetPol);
    if (pairedDeal && pairedDeal.fromId === fromId) {
      for (const d of inboundSummitDeals(pairedDeal)) {
        if (!deals.some((x) => x.id === d.id)) deals.push(d);
      }
    }

    clearInboundSummitCommercial(g, seatId);
    if (pairedDeal && pairedDeal.fromId === fromId) {
      clearInboundDealProposal(g, seatId);
    }
    if (accept) {
      if (hasTariff) {
        if (inbound.unionBlocId) {
          const bound = {
            blocId: inbound.unionBlocId,
            outsiderId: inbound.outsiderId,
            playerInCu: !!inbound.playerInCu,
            hostId: seatId,
          };
          applyUnionPartnerTariffCut(g, bound, cut);
        } else {
          applyPartnerTariffCutOnPlayer(g, seatId, fromId, cut);
        }
      }
      if (deals.length) {
        const issuerSeat = g.world[fromId];
        if (issuerSeat && issuerSeat.law) {
          if (!issuerSeat.law.deals) issuerSeat.law.deals = {};
          for (const d of deals) issuerSeat.law.deals[d.id] = true;
        }
      }
    } else if (hasTariff) {
      revertUnionIssuerTariff(g, fromId, inbound);
      const issuer = g.world[fromId];
      const law = issuer && issuer.law;
      if (
        law &&
        law.tariffSchedule &&
        law.tariffSchedule.country &&
        !inbound.unionBlocId
      ) {
        delete law.tariffSchedule.country[seatId];
        syncTariffHeadline(law, issuer.role);
      }
    }

    const tPol = mountMpSeatOnSnapshot(g, seatId);
    if (hasTariff) {
      if (accept && fromId && getG().rel) {
        getG().rel[fromId] = clamp(
          (getG().rel[fromId] != null ? getG().rel[fromId] : 50) + 4,
          5,
          95,
        );
      } else if (!accept && getG().rel && getG().rel[seatId] != null) {
        getG().rel[seatId] = clamp(getG().rel[seatId] - 2, 5, 95);
      }
    }
    if (deals.length) {
      if (accept) {
        if (getG().fac) {
          getG().fac.business = clamp((getG().fac.business || 50) + 2, 2, 96);
        }
        for (const d of deals) {
          pushDiploAlert(getG(), {
            kind: "deal_inbound_accept",
            partnerId: fromId,
            dealId: d.id,
            label: d.label,
            q: getG().q,
            expiresQ: (getG().q || 0) + 3,
          });
        }
      } else {
        if (getG().fac) {
          getG().fac.patriots = clamp((getG().fac.patriots || 50) + 2, 2, 96);
          getG().fac.business = clamp((getG().fac.business || 50) - 2, 2, 96);
        }
        if (fromId && getG().rel) {
          getG().rel[fromId] = clamp(
            (getG().rel[fromId] != null ? getG().rel[fromId] : 50) - 3,
            5,
            95,
          );
        }
        for (const d of deals) {
          pushDiploAlert(getG(), {
            kind: "deal_inbound_decline",
            partnerId: fromId,
            dealId: d.id,
            label: d.label,
            q: getG().q,
            expiresQ: (getG().q || 0) + 3,
          });
        }
      }
    }
    syncMpPoliticsFromG(tPol);

    const iPol = mountMpSeatOnSnapshot(g, fromId);
    if (hasTariff) {
      pushDiploAlert(getG(), {
        kind: accept ? "summit_tariff_accept" : "summit_tariff_decline",
        partnerId: seatId,
        fromId,
        q: getG().q || 0,
        expiresQ: (getG().q || 0) + 3,
      });
    }
    if (deals.length) {
      if (accept) {
        for (const d of deals) applySphereTrespassOnDeal(d.id, true);
      } else if (getG().rel) {
        getG().rel[seatId] = clamp(
          (getG().rel[seatId] != null ? getG().rel[seatId] : 50) - 3,
          5,
          95,
        );
      }
      for (const d of deals) {
        pushDiploAlert(getG(), {
          kind: accept ? "deal_propose_accept" : "deal_propose_decline",
          partnerId: seatId,
          dealId: d.id,
          label: d.label,
          q: getG().q,
          expiresQ: (getG().q || 0) + 3,
        });
      }
      const p = partnerById(seatId);
      const name = theCountry(p ? p.name : seatId);
      if (getG().brief) {
        const note = accept
          ? name +
            " accepts the summit agenda" +
            (deals.length === 1 ? " — " + deals[0].label + "." : ".")
          : name + " declines the summit agenda — nothing signed.";
        getG().brief = [note].concat(getG().brief).slice(0, 3);
      }
    }
    syncMpPoliticsFromG(iPol);

    return { ok: true, accept: !!accept };
  } finally {
    g.homeRole = savedMount.homeRole;
    g.econ = savedMount.econ;
    g.law = savedMount.law;
    g.draft = savedMount.draft;
    g.prevLaw = savedMount.prevLaw;
    g.capital = savedMount.capital;
    g.fac = savedMount.fac;
    g.rel = savedMount.rel;
    g.country = savedMount.country;
    g.envoys = savedMount.envoys;
    g.ultimatums = savedMount.ultimatums;
    g.activeVisits = savedMount.activeVisits;
    g.missionEvents = savedMount.missionEvents;
    g.diploAlerts = savedMount.diploAlerts;
    g.mods = savedMount.mods;
    g.sandbox = savedMount.sandbox;
    g.rateManual = savedMount.rateManual;
    g.manualRate = savedMount.manualRate;
    setG(prev);
  }
}

/** Expired inbound summit tariff offers count as decline. */
function timeoutInboundSummitCommercial(g: any) {
  if (!g || !g.politics) return;
  const q = g.q || 0;
  const due = [];
  for (const toId of Object.keys(g.politics)) {
    const pol = g.politics[toId];
    const inbound = pendingInboundSummitCommercial(pol);
    if (!inbound) continue;
    if (q < (inbound.expiresQ != null ? inbound.expiresQ : 0)) continue;
    due.push(toId);
  }
  for (const toId of due) {
    applyMpInboundSummitCommercialChoice(g, toId, false);
  }
}

function summitCommercialDealOptions(partnerOrId: any, g: any) {
  const out = [];
  const partnerId =
    typeof partnerOrId === "string"
      ? partnerOrId
      : partnerOrId && partnerOrId.id;
  const bound = cuBoundary(g, partnerId);
  if (bound) {
    if (bound.playerInCu) {
      for (const d of dealsForPartner(partnerId, g.homeRole)) {
        if (g.law && g.law.deals && g.law.deals[d.id]) continue;
        if (g.draft && g.draft.deals && g.draft.deals[d.id]) continue;
        if (unionDealContentBlockers(partnerId, d.id, g).length) continue;
        out.push(d);
      }
    } else {
      const d = unionAssociationDeal(bound.blocId, g);
      if (
        d &&
        !(g.law && g.law.deals && g.law.deals[d.id]) &&
        !(g.draft && g.draft.deals && g.draft.deals[d.id]) &&
        !unionDealContentBlockers(partnerId, d.id, g).length
      ) {
        out.push(d);
      }
    }
    return out;
  }
  for (const d of dealsForPartner(partnerOrId, g.homeRole)) {
    if (g.law && g.law.deals && g.law.deals[d.id]) continue;
    if (g.draft && g.draft.deals && g.draft.deals[d.id]) continue;
    if (dealBlockers(d).length) continue;
    out.push(d);
  }
  return out;
}

function buildSummitCommercialEvent(partnerId: any, g: any) {
  const opts: any[] = [];
  const room = summitTariffRoom(g, partnerId);
  if (canNegotiateTariffs(g, partnerId) && room) {
    for (const pack of summitTariffPackages(g, partnerId)) {
      const depth = Math.max(pack.ourDelta, pack.theirDelta);
      const pts = depth <= 1 ? 3 : depth >= 4 ? 5 : 4;
      opts.push({
        b: tariffPackageLabel(
          pack.ourDelta,
          pack.theirDelta,
          room.ourMax,
          room.theirMax,
        ),
        e: "Country rates on both statute books",
        summitKind: "tariff",
        ourDelta: pack.ourDelta,
        theirDelta: pack.theirDelta,
        delta: pack.delta,
        setRel: { _partner: depth <= 1 ? 3 : depth >= 4 ? 6 : 5 },
        fac: { business: depth <= 1 ? 2 : 3, patriots: -1 },
        relImpulse: pts,
        ledger: { label: "Tariff package", pts },
      });
    }
  }
  for (const d of summitCommercialDealOptions(partnerId, g)) {
    opts.push({
      b: "Sign " + d.name.toLowerCase(),
      e: "Treaty enters force when both sides agree",
      summitKind: "deal",
      dealId: d.id,
      setRel: { _partner: SUMMIT_DEAL_REL },
      fac: { business: 2 },
      relImpulse: SUMMIT_DEAL_IMPULSE,
      ledger: { label: "Treaty signed", pts: SUMMIT_DEAL_IMPULSE },
    });
  }
  opts.push({
    b: "No commercial breakthrough",
    e: "Political goodwill only",
    summitKind: "decline",
    setRel: { _partner: 1 },
    fac: { patriots: 1 },
  });
  return {
    id: "summit_commercial_agenda",
    missions: ["summit"],
    title: "Commercial agenda with {P}",
    text: "The working session turns to trade. Set each side's duty cut, table any unsigned treaties, or both — they take the agenda as a package.",
    opts,
    partnerId,
    rivalId: null,
    rivalName: null,
  };
}

function applySummitReciprocalTariff(
  g: any,
  partnerId: any,
  ourDelta: any,
  theirDelta?: any,
  skipAccept?: boolean,
) {
  if (!canNegotiateTariffs(g, partnerId)) return false;
  const room = summitTariffRoom(g, partnerId);
  if (!room) return false;
  const od = Math.max(
    0,
    Math.min(room.ourMax, Math.round(ourDelta != null ? +ourDelta : 0)),
  );
  const td = Math.max(
    0,
    Math.min(room.theirMax, Math.round(theirDelta != null ? +theirDelta : od)),
  );
  if (od <= 0 && td <= 0) return false;
  if (isHumanMpSeat(g, partnerId)) {
    if (od > 0) applyDraftOurSummitTariffCut(g, partnerId, od);
    if (td > 0)
      return parkInboundSummitCommercial(
        g,
        playerCountryId(g.homeRole),
        partnerId,
        od,
        td,
      );
    return od > 0;
  }
  /* Accept against current rates — never after cutting our own draft, or a
     2pt trim can make their remaining duty look too high and they "decline"
     an offer they had already accepted. */
  if (!skipAccept && !aiAcceptsReciprocalTariff(g, partnerId, od, td)) {
    if (g.rel && g.rel[partnerId] != null) {
      g.rel[partnerId] = clamp(g.rel[partnerId] - 3, 5, 95);
    }
    return false;
  }
  if (od > 0) applyOurSummitTariffCut(g, partnerId, od);
  if (td > 0) applyTheirSummitTariffCut(g, partnerId, td);
  return true;
}

function applySummitCommercialOption(opt: any, ctx: any) {
  const g = getG();
  if (!g || !opt) return;
  const partnerId = ctx && ctx.partnerId;
  const strip = (o: any) => {
    const plain = Object.assign({}, o);
    delete plain.summitKind;
    delete plain.delta;
    delete plain.ourDelta;
    delete plain.theirDelta;
    delete plain.dealId;
    delete plain.dealIds;
    delete plain.disabled;
    delete plain.blockReason;
    return plain;
  };
  if (opt.summitKind === "decline") {
    applyMissionEventOption(strip(opt), ctx);
    bump();
    return;
  }

  const dealIds: string[] = [];
  if (Array.isArray(opt.dealIds)) {
    for (const id of opt.dealIds)
      if (id && dealIds.indexOf(id) < 0) dealIds.push(id);
  }
  if (opt.dealId && dealIds.indexOf(opt.dealId) < 0) dealIds.push(opt.dealId);
  const isPackage = opt.summitKind === "package";
  const wantTariff = opt.summitKind === "tariff" || isPackage;
  const ourDelta =
    opt.ourDelta != null
      ? opt.ourDelta
      : opt.delta != null
        ? opt.delta
        : isPackage
          ? 0
          : SUMMIT_TARIFF_DELTA;
  const theirDelta = opt.theirDelta != null ? opt.theirDelta : ourDelta;
  const packageOk =
    isPackage &&
    aiAcceptsSummitAgenda(g, partnerId, ourDelta, theirDelta, dealIds).ok;
  if (isPackage && !packageOk && !isHumanMpSeat(g, partnerId)) {
    if (g.rel && g.rel[partnerId] != null) {
      g.rel[partnerId] = clamp(g.rel[partnerId] - 2, 5, 95);
    }
    const pName = theCountry(partnerById(partnerId)?.name || partnerId);
    if (g.brief) {
      g.brief = [
        pName + " declined the commercial agenda — nothing signed this visit.",
      ]
        .concat(g.brief)
        .slice(0, 3);
    }
    bump();
    return;
  }

  if (wantTariff) {
    if (ourDelta > 0 || theirDelta > 0) {
      const ok = applySummitReciprocalTariff(
        g,
        partnerId,
        ourDelta,
        theirDelta,
        packageOk,
      );
      if (ok) {
        const depth = Math.max(+ourDelta || 0, +theirDelta || 0);
        applyMissionEventOption(
          {
            setRel: opt.setRel || {
              _partner: depth <= 1 ? 3 : depth >= 4 ? 6 : 5,
            },
            fac: opt.fac || { business: depth <= 1 ? 2 : 3, patriots: -1 },
            relImpulse:
              opt.relImpulse != null
                ? opt.relImpulse
                : depth <= 1
                  ? 3
                  : depth >= 4
                    ? 5
                    : 4,
            ledger: opt.ledger || { label: "Tariff package", pts: 4 },
          },
          ctx,
        );
      } else {
        const pName = theCountry(partnerById(partnerId)?.name || partnerId);
        if (g.brief) {
          g.brief = [
            pName +
              " declined a reciprocal tariff cut — duties on both sides unchanged.",
          ]
            .concat(g.brief)
            .slice(0, 3);
        }
        if (!dealIds.length) {
          bump();
          return;
        }
      }
    }
  }

  if (opt.summitKind === "deal" || isPackage) {
    const dealBoost = () =>
      applyMissionEventOption(
        {
          setRel:
            opt.summitKind === "deal" && opt.setRel
              ? opt.setRel
              : { _partner: SUMMIT_DEAL_REL },
          fac: { business: 2 },
          relImpulse:
            opt.summitKind === "deal" && opt.relImpulse != null
              ? opt.relImpulse
              : SUMMIT_DEAL_IMPULSE,
          ledger: { label: "Treaty signed", pts: SUMMIT_DEAL_IMPULSE },
        },
        ctx,
      );
    if (
      isHumanMpSeat(g, partnerId) &&
      dealIds.length &&
      attachInboundSummitDeals(
        g,
        playerCountryId(g.homeRole),
        partnerId,
        dealIds,
      )
    ) {
      for (let i = 0; i < dealIds.length; i++) dealBoost();
    } else {
      for (const dealId of dealIds) {
        const result = ratifyBilateralDealWithPartner(
          g,
          partnerId,
          dealId,
          packageOk,
        );
        if (!result.ok) continue;
        dealBoost();
      }
    }
  }

  bump();
}

function relationModifiers(partnerId: any, g: any, law: any) {
  const state = g || getG();
  const L = law || (state && state.law);
  return buildRelationModifiers(partnerId, state, L, diploDeps()).mods;
}

function relationTarget(partnerId: any, g?: any, law?: any) {
  const state = g || getG();
  const L = law || (state && state.law);
  return buildRelationModifiers(partnerId, state, L, diploDeps()).target;
}

const canIssueUltimatum = (partnerId: any, g?: any) =>
  canIssueUltimatumCore(partnerId, g || getG(), diploDeps());

function assignEnvoy(partnerId: any) {
  const g = getG();
  if (!g || !partnerId) return false;
  if (!g.envoys) g.envoys = emptyEnvoys();
  /* Idempotent: already posted is success (rapid clicks / UI ahead of BE). */
  if (g.envoys.includes(partnerId)) return true;
  if ((g.capital || 0) < ENVOY_ASSIGN_PC) return false;
  const slot = g.envoys.indexOf(null);
  if (slot < 0) return false;
  g.capital = clamp(g.capital - ENVOY_ASSIGN_PC, 0, 100);
  g.envoys[slot] = partnerId;
  if (!g.envoySpend) g.envoySpend = {};
  g.envoySpend[partnerId] = ENVOY_ASSIGN_PC;
  return true;
}

function recallEnvoy(partnerId: any) {
  const g = getG();
  if (!g || !partnerId) return true;
  if (!g.envoys) return true;
  const i = g.envoys.indexOf(partnerId);
  /* Idempotent: already vacant is the desired state. */
  if (i < 0) return true;
  if (ENVOY_RECALL_PC > 0) {
    if ((g.capital || 0) < ENVOY_RECALL_PC) return false;
    g.capital = clamp(g.capital - ENVOY_RECALL_PC, 0, 100);
  }
  g.envoys[i] = null;
  /* Same-quarter assign can be undone — refund the capital that was spent. */
  if (g.envoySpend && g.envoySpend[partnerId]) {
    g.capital = clamp((g.capital || 0) + g.envoySpend[partnerId], 0, 100);
    delete g.envoySpend[partnerId];
  }
  return true;
}

/** True when `seatId` is a human multiplayer seat (has a politics bag). */
function isHumanMpSeat(g: any, seatId: any) {
  return !!(g && g.politics && seatId && g.politics[seatId]);
}

function parkInboundUltimatum(g: any, fromId: any, toId: any, ult: any) {
  if (!g || !fromId || !toId || !ult || fromId === toId) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const pol = g.politics[toId];
  if (!pol.inboundUltimatums || typeof pol.inboundUltimatums !== "object") {
    pol.inboundUltimatums = {};
  }
  pol.inboundUltimatums[fromId] = {
    demand: ult.demand,
    label: ult.label,
    policyKey: ult.policyKey,
    sentQ: ult.sentQ != null ? ult.sentQ : g.q || 0,
    expiresQ: ult.expiresQ != null ? ult.expiresQ : (g.q || 0) + ULTIMATUM_WAIT,
    status: "pending",
  };
  return true;
}

function clearInboundUltimatum(g: any, fromId: any, toId: any) {
  const pol = g && g.politics && g.politics[toId];
  if (!pol || !pol.inboundUltimatums) return;
  delete pol.inboundUltimatums[fromId];
}

function firstPendingInbound(pol: any) {
  if (!pol || !pol.inboundUltimatums) return null;
  for (const fromId of Object.keys(pol.inboundUltimatums)) {
    const u = pol.inboundUltimatums[fromId];
    if (u && u.status === "pending") return { fromId, ult: u };
  }
  return null;
}

/** Every act on a parked notice; tolerates the flat single-act shape. */
function inboundNoticeActs(notice: any) {
  if (!notice) return [];
  if (Array.isArray(notice.acts) && notice.acts.length) return notice.acts;
  return [
    {
      fromId: notice.fromId,
      kind: notice.kind || "notice",
      label: notice.label || "",
    },
  ];
}

/** One-button Noted paper for unilateral hostile acts (tariff hike / sanctions). */
function parkInboundNotice(g: any, fromId: any, toId: any, notice: any) {
  if (!g || !fromId || !toId || fromId === toId) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const pol = g.politics[toId];
  const act = {
    fromId,
    kind: (notice && notice.kind) || "notice",
    label: (notice && notice.label) || "",
  };
  /* One deliver can land several hostile acts on the same seat (a tariff hike
     and sanctions, or two different peers). They ride one Noted paper rather
     than the first claiming the slot and the rest going unreported. */
  const open = pol.inboundNotice;
  if (open && open.status === "pending") {
    const acts = inboundNoticeActs(open);
    if (acts.some((a: any) => a.fromId === act.fromId && a.kind === act.kind)) {
      return false;
    }
    acts.push(act);
    open.acts = acts;
    return true;
  }
  pol.inboundNotice = {
    fromId: act.fromId,
    kind: act.kind,
    label: act.label,
    acts: [act],
    q: g.q || 0,
    status: "pending",
  };
  return true;
}
function clearInboundNotice(g: any, toId: any) {
  const pol = g && g.politics && g.politics[toId];
  if (!pol) return;
  pol.inboundNotice = null;
}
function pendingInboundNotice(pol: any) {
  const n = pol && pol.inboundNotice;
  return n && n.status === "pending" ? n : null;
}
function applyMpInboundNoticeChoice(g: any, seatId: any) {
  if (!g || !seatId) return { ok: false, error: "Unknown seat" };
  if (!g.politics || !g.politics[seatId]) {
    return { ok: false, error: "Missing seat politics" };
  }
  clearInboundNotice(g, seatId);
  return { ok: true };
}

/** Fan tariff/sanctions/protest news to both human seats; park Noted on hostile inbound. */
function notifyHumanPeerActions(
  state: any,
  fromId: any,
  prevLaw: any,
  nextLaw: any,
  missions: any,
) {
  if (!state || !fromId || !state.politics) return;
  const fromPol = state.politics[fromId];
  if (!fromPol) return;
  const q = state.q || 0;
  const fromRole = worldRoleForSeat(fromId);
  const bm = state.blocMember || {};
  for (const pid of Object.keys(state.politics)) {
    if (pid === fromId) continue;
    if (!isHumanMpSeat(state, pid)) continue;
    const before = effectiveTariff(pid, prevLaw, fromRole, bm);
    const after = effectiveTariff(pid, nextLaw, fromRole, bm);
    if (Math.abs(after - before) < 1) continue;
    const hike = after > before;
    const label = Math.round(before) + "% to " + Math.round(after) + "%";
    pushDiploAlert(fromPol, {
      kind: hike ? "tariff_hike" : "tariff_cut",
      partnerId: pid,
      q,
      label,
    });
    pushDiploAlert(state.politics[pid], {
      kind: hike ? "tariff_inbound_hike" : "tariff_inbound_cut",
      partnerId: fromId,
      q,
      label,
    });
    if (hike) {
      parkInboundNotice(state, fromId, pid, {
        kind: "tariff_inbound_hike",
        label,
      });
    }
  }
  for (const pid in missions || {}) {
    const mid = missions[pid];
    if (mid !== "sanctionsPosture" && mid !== "demarche") continue;
    if (!isHumanMpSeat(state, pid) || pid === fromId) continue;
    const hostile = mid === "sanctionsPosture";
    const label = hostile ? "Restrictive measures" : "Formal protest";
    pushDiploAlert(fromPol, {
      kind: hostile ? "sanctions_outbound" : "protest_outbound",
      partnerId: pid,
      q,
      label,
    });
    pushDiploAlert(state.politics[pid], {
      kind: hostile ? "sanctions_inbound" : "protest_inbound",
      partnerId: fromId,
      q,
      label,
    });
    if (hostile) {
      parkInboundNotice(state, fromId, pid, {
        kind: "sanctions_inbound",
        label,
      });
    }
  }
}

function pushDiploAlert(state: any, alert: any) {
  if (!state) return;
  if (!state.diploAlerts) state.diploAlerts = [];
  /* Skip an exact duplicate already at the head (double-push / remount). */
  const key = diploAlertKey(alert);
  if (
    key &&
    state.diploAlerts[0] &&
    diploAlertKey(state.diploAlerts[0]) === key
  ) {
    return;
  }
  state.diploAlerts.unshift(alert);
  state.diploAlerts = state.diploAlerts.slice(0, 4);
}

/** Stable identity for an outcome alert — used to keep `noted` across hydrate. */
function diploAlertKey(a: any) {
  if (!a) return "";
  return [
    a.kind || "",
    a.partnerId || "",
    a.q != null ? a.q : "",
    a.blocId || "",
    a.dealId || "",
    a.label || a.demand || "",
  ].join("|");
}

/**
 * Server snapshots never store `noted` (clients mark locally after briefing).
 * Re-hydrate / mid-quarter merge would otherwise re-fire the same accept clip.
 */
function mergeDiploAlertsNoted(prevAlerts: any, nextAlerts: any) {
  if (!nextAlerts || !nextAlerts.length)
    return nextAlerts ? clone(nextAlerts) : [];
  const noted = new Set();
  for (const a of prevAlerts || []) {
    if (a && a.noted) {
      const k = diploAlertKey(a);
      if (k) noted.add(k);
    }
  }
  return nextAlerts.map((a: any) => {
    if (!a) return a;
    const copy = clone(a);
    if (noted.has(diploAlertKey(copy))) copy.noted = true;
    return copy;
  });
}

/** Outcome kinds shown on the next morning note after a mid-quarter answer. */
const DIPLO_OUTCOME_KINDS = {
  ult_concede: 1,
  ult_defy: 1,
  ult_inbound_concede: 1,
  ult_inbound_defy: 1,
  bloc_invite_accept: 1,
  bloc_invite_decline: 1,
  bloc_inbound_accept: 1,
  bloc_inbound_decline: 1,
  bloc_member_joined: 1,
  bloc_self_joined: 1,
  bloc_member_left: 1,
  bloc_self_left: 1,
  deal_propose_accept: 1,
  deal_propose_decline: 1,
  deal_inbound_accept: 1,
  deal_inbound_decline: 1,
};

/** Bloc invite / membership / leave and trade treaties — newspaper only,
 *  not morning-note lines (avoids replaying the briefing mid-quarter). */
const DIPLO_PRESS_ONLY_KINDS = {
  bloc_invite_accept: 1,
  bloc_invite_decline: 1,
  bloc_inbound_accept: 1,
  bloc_inbound_decline: 1,
  bloc_member_joined: 1,
  bloc_self_joined: 1,
  bloc_member_left: 1,
  bloc_self_left: 1,
  deal_propose_accept: 1,
  deal_propose_decline: 1,
  deal_inbound_accept: 1,
  deal_inbound_decline: 1,
  deal_collapse: 1,
  tariff_hike: 1,
  tariff_cut: 1,
  tariff_inbound_hike: 1,
  tariff_inbound_cut: 1,
  sanctions_outbound: 1,
  sanctions_inbound: 1,
  protest_outbound: 1,
  protest_inbound: 1,
};

/** Alerts not yet shown on a morning note / press strip.
 *  Mid-quarter answers can land before Deliver bumps q, so we also accept
 *  `a.q === qNow - 1` — but only until `noted` is set. */
function diploOutcomeAlertsForBrief(alerts: any, q: any) {
  const qNow = q != null ? q : 0;
  return (alerts || []).filter((a: any) => {
    if (!a || a.noted) return false;
    if (
      !(DIPLO_OUTCOME_KINDS as any)[a.kind] &&
      !(DIPLO_PRESS_ONLY_KINDS as any)[a.kind]
    )
      return false;
    const aq = a.q != null ? a.q : qNow;
    return aq === qNow || aq === qNow - 1;
  });
}

function markDiploAlertsNoted(alerts: any) {
  if (!alerts || !alerts.length) return;
  for (const a of alerts) {
    if (a) a.noted = true;
  }
}

/** Apply concede/defy on the issuer seat bag, clear outbound, set cooldown + alert. */
function finishOutboundUltimatum(
  issuerState: any,
  targetId: any,
  ult: any,
  concede: any,
) {
  const deps = diploDeps();
  const impacts = ultimatumOutcomeImpacts(
    issuerState,
    targetId,
    ult,
    !!concede,
    deps,
  );
  const p = partnerById(targetId);
  const name = theCountry(p ? p.name : targetId);
  const note = concede
    ? name + " conceded to our ultimatum."
    : name + " defied our ultimatum.";
  pushDiploAlert(issuerState, {
    kind: concede ? "ult_concede" : "ult_defy",
    partnerId: targetId,
    demand: ult.demand,
    label: ult.label || ult.demand || "your demand",
    impacts,
    q: issuerState.q,
    expiresQ: (issuerState.q || 0) + 3,
  });
  ensureDiploStocks(issuerState.econ);
  issuerState.econ.ultimatumCd[targetId] = ULTIMATUM_CD;
  if (issuerState.ultimatums) delete issuerState.ultimatums[targetId];
  if (issuerState.brief)
    issuerState.brief = [note].concat(issuerState.brief).slice(0, 3);
  return impacts;
}

function issueUltimatum(partnerId: any, demandId: any) {
  const g = getG();
  if (!g || !partnerId) return false;
  ensureDiploStocks(g.econ);
  const existing = g.ultimatums && g.ultimatums[partnerId];
  /* Idempotent: a live ultimatum is already the desired state. */
  if (existing && existing.status === "pending") return true;
  const check = canIssueUltimatumCore(partnerId, g, diploDeps());
  if (!check.ok) return false;
  const demands = ultimatumDemandsFor(partnerId, g, diploDeps());
  const pick = demandId
    ? demands.find((d) => d.id === demandId) || {
        id: demandId,
        label: demandId,
      }
    : demands[0];
  if (!pick) return false;
  g.capital = clamp(g.capital - ULTIMATUM_PC, 0, 100);
  if (!g.ultimatums) g.ultimatums = {};
  const awaitHuman = isHumanMpSeat(g, partnerId);
  g.ultimatums[partnerId] = {
    demand: pick.id,
    label: pick.label,
    policyKey: pick.policyKey,
    sentQ: g.q,
    expiresQ: g.q + ULTIMATUM_WAIT,
    status: "pending",
    ...(awaitHuman ? { awaitHuman: true } : {}),
  };
  if (awaitHuman) {
    parkInboundUltimatum(
      g,
      playerCountryId(g.homeRole),
      partnerId,
      g.ultimatums[partnerId],
    );
  }
  addDiploLedger(g, partnerId, {
    id: "ultimatum_issued_" + g.q,
    label: "Issued an ultimatum",
    pts: -8,
  });
  if (g.fac) {
    g.fac.patriots = clamp((g.fac.patriots || 50) + 3, 2, 96);
    g.fac.business = clamp((g.fac.business || 50) - 2, 2, 96);
  }
  return true;
}

function ultimatumSentQ(g: any, u: any) {
  if (!u) return null;
  if (u.sentQ != null) return u.sentQ;
  if (u.expiresQ != null) return u.expiresQ - ULTIMATUM_WAIT;
  return null;
}

/** Same-quarter undo only — after Deliver the demand is already in flight. */
function canWithdrawUltimatum(partnerId: any, g?: any) {
  const state = g || getG();
  if (!state || !partnerId) return false;
  const u = state.ultimatums && state.ultimatums[partnerId];
  if (!u || u.status !== "pending") return false;
  return ultimatumSentQ(state, u) === (state.q || 0);
}

function withdrawUltimatum(partnerId: any) {
  const g = getG();
  if (!g || !partnerId) return false;
  const existing = g.ultimatums && g.ultimatums[partnerId];
  /* Idempotent: already gone is the desired state. */
  if (!existing || existing.status !== "pending") return true;
  if (ultimatumSentQ(g, existing) !== (g.q || 0)) return false;
  g.capital = clamp((g.capital || 0) + ULTIMATUM_PC, 0, 100);
  if (g.fac) {
    g.fac.patriots = clamp((g.fac.patriots || 50) - 3, 2, 96);
    g.fac.business = clamp((g.fac.business || 50) + 2, 2, 96);
  }
  const ledger =
    g.econ && g.econ.diploLedger && g.econ.diploLedger[partnerId];
  if (Array.isArray(ledger)) {
    const id = "ultimatum_issued_" + (g.q || 0);
    const i = ledger.findIndex((x: any) => x && x.id === id);
    if (i >= 0) ledger.splice(i, 1);
  }
  delete g.ultimatums[partnerId];
  clearInboundUltimatum(g, playerCountryId(g.homeRole), partnerId);
  return true;
}

function processUltimatums(g: any, det: any) {
  const state = g || getG();
  if (!state || !state.ultimatums) return;
  ensureDiploStocks(state.econ);
  const deps = diploDeps();
  for (const pid of Object.keys(state.ultimatums)) {
    const u = state.ultimatums[pid];
    if (!u || u.status !== "pending") continue;
    if (state.q < u.expiresQ) continue;
    /* Human targets answer via inbound despatch (or lockstep timeout) — no RNG. */
    if (u.awaitHuman) continue;
    const meta = { policyKey: u.policyKey, label: u.label };
    const base = baseP(pid, u.demand, state, deps, meta);
    const concede = det
      ? base >= 0.5
      : Math.random() < concedeP(pid, u.demand, state, deps, false, meta);
    finishOutboundUltimatum(state, pid, u, concede);
  }
}

/**
 * Human target answers an inbound ultimatum. Effects apply on the issuer seat
 * (same as AI concede/defy); both seats get diplo alerts.
 */
function applyMpInboundUltimatumChoice(
  g: any,
  seatId: any,
  fromId: any,
  concede: any,
) {
  if (!g || !g.world || !g.world[seatId]) {
    return { ok: false, error: "Unknown seat" };
  }
  if (!fromId || !g.politics || !g.politics[fromId]) {
    return { ok: false, error: "Unknown issuer" };
  }
  const targetPol = normalizeDiploPolitics(g.politics[seatId] || {});
  if (!g.politics[seatId]) g.politics[seatId] = targetPol;
  const inbound =
    targetPol.inboundUltimatums && targetPol.inboundUltimatums[fromId];
  if (!inbound || inbound.status !== "pending") {
    return { ok: false, error: "No pending inbound ultimatum" };
  }
  const prev = getG();
  const savedMount = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
    mods: g.mods,
    sandbox: g.sandbox,
    rateManual: g.rateManual,
    manualRate: g.manualRate,
  };
  try {
    setG(g);
    g.q = g.q != null ? g.q : 0;
    const issuerPol = mountMpSeatOnSnapshot(g, fromId);
    const ult = (getG().ultimatums && getG().ultimatums[seatId]) || {
      demand: inbound.demand,
      label: inbound.label,
      policyKey: inbound.policyKey,
    };
    const impacts = finishOutboundUltimatum(getG(), seatId, ult, !!concede);
    syncMpPoliticsFromG(issuerPol);

    mountMpSeatOnSnapshot(g, seatId);
    pushDiploAlert(getG(), {
      kind: concede ? "ult_inbound_concede" : "ult_inbound_defy",
      partnerId: fromId,
      demand: inbound.demand,
      label: inbound.label || inbound.demand || "their demand",
      impacts,
      q: getG().q,
      expiresQ: (getG().q || 0) + 3,
    });
    clearInboundUltimatum(g, fromId, seatId);
    syncMpPoliticsFromG(g.politics[seatId]);
    return { ok: true, concede: !!concede };
  } finally {
    g.homeRole = savedMount.homeRole;
    g.econ = savedMount.econ;
    g.law = savedMount.law;
    g.draft = savedMount.draft;
    g.prevLaw = savedMount.prevLaw;
    g.capital = savedMount.capital;
    g.fac = savedMount.fac;
    g.rel = savedMount.rel;
    g.country = savedMount.country;
    g.envoys = savedMount.envoys;
    g.ultimatums = savedMount.ultimatums;
    g.activeVisits = savedMount.activeVisits;
    g.missionEvents = savedMount.missionEvents;
    g.diploAlerts = savedMount.diploAlerts;
    g.mods = savedMount.mods;
    g.sandbox = savedMount.sandbox;
    g.rateManual = savedMount.rateManual;
    g.manualRate = savedMount.manualRate;
    setG(prev);
  }
}

/** Expired inbound ultimatums with no human answer count as defiance. */
function timeoutInboundUltimatums(g: any) {
  if (!g || !g.politics) return;
  const q = g.q || 0;
  const due = [];
  for (const toId of Object.keys(g.politics)) {
    const pol = g.politics[toId];
    if (!pol || !pol.inboundUltimatums) continue;
    for (const fromId of Object.keys(pol.inboundUltimatums)) {
      const inbound = pol.inboundUltimatums[fromId];
      if (!inbound || inbound.status !== "pending") continue;
      if (q < (inbound.expiresQ != null ? inbound.expiresQ : 0)) continue;
      due.push({ toId, fromId });
    }
  }
  for (const { toId, fromId } of due) {
    applyMpInboundUltimatumChoice(g, toId, fromId, false);
  }
}

function parkInboundBlocInvite(g: any, fromId: any, toId: any, inv: any) {
  if (!g || !fromId || !toId || !inv || fromId === toId) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const pol = normalizeDiploPolitics(g.politics[toId]);
  pol.inboundBlocInvite = {
    fromId,
    blocId: inv.blocId,
    sentQ: inv.sentQ != null ? inv.sentQ : g.q || 0,
    expiresQ: inv.expiresQ != null ? inv.expiresQ : (g.q || 0) + 4,
    status: "pending",
  };
  return true;
}

function clearInboundBlocInvite(g: any, toId: any) {
  const pol = g && g.politics && g.politics[toId];
  if (!pol) return;
  pol.inboundBlocInvite = null;
}

function pendingInboundBlocInvite(pol: any) {
  const inv = pol && pol.inboundBlocInvite;
  if (!inv || inv.status !== "pending") return null;
  return inv;
}

/**
 * Human target answers a bloc invitation. Accept starts their accession track;
 * decline clears the invite. Silence past expiresQ counts as decline.
 */
function applyMpInboundBlocInviteChoice(g: any, seatId: any, accept: any) {
  if (!g || !g.world || !g.world[seatId]) {
    return { ok: false, error: "Unknown seat" };
  }
  if (!g.politics || !g.politics[seatId]) {
    return { ok: false, error: "Missing seat politics" };
  }
  const targetPol = normalizeDiploPolitics(g.politics[seatId]);
  const inbound = pendingInboundBlocInvite(targetPol);
  if (!inbound) {
    return { ok: false, error: "No pending bloc invitation" };
  }
  const fromId = inbound.fromId;
  if (!fromId || !g.politics[fromId]) {
    return { ok: false, error: "Unknown issuer" };
  }
  const blocId = inbound.blocId;
  const bloc = blocById(blocId) || (g.customBlocs && g.customBlocs[blocId]);
  const blocName = bloc ? bloc.name : blocId;
  const prev = getG();
  const savedMount = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
    mods: g.mods,
    sandbox: g.sandbox,
    rateManual: g.rateManual,
    manualRate: g.manualRate,
    blocAccession: g.blocAccession,
  };
  try {
    setG(g);
    g.q = g.q != null ? g.q : 0;

    const tPol = mountMpSeatOnSnapshot(g, seatId);
    if (accept) {
      if (countryBlocId(seatId, g.blocMember) === blocId) {
        return { ok: false, error: "Already in this trade bloc" };
      }
      applyPoachLeave(g, seatId, blocId);
      /* Same automatic pipeline as AI invitees — issuer can track via
       * blocAccessionByCountry, and re-invites are blocked while ascending. */
      if (!g.blocAccessionByCountry) g.blocAccessionByCountry = {};
      g.blocAccessionByCountry[seatId] = {
        blocId,
        step: 1,
        sinceQ: g.q || 0,
        invitedBy: fromId,
      };
      getG().blocAccession = null;
      if (getG().fac) {
        getG().fac.business = clamp((getG().fac.business || 50) + 5, 2, 96);
        getG().fac.patriots = clamp((getG().fac.patriots || 50) - 6, 2, 96);
      }
      pushDiploAlert(getG(), {
        kind: "bloc_inbound_accept",
        partnerId: fromId,
        blocId,
        label: blocName,
        q: getG().q,
        expiresQ: (getG().q || 0) + 3,
      });
    } else {
      if (getG().fac) {
        getG().fac.patriots = clamp((getG().fac.patriots || 50) + 3, 2, 96);
        getG().fac.business = clamp((getG().fac.business || 50) - 2, 2, 96);
      }
      getG().capital = clamp((getG().capital || 0) - 2, 0, 100);
      if (fromId && getG().rel) {
        getG().rel[fromId] = clamp(
          (getG().rel[fromId] != null ? getG().rel[fromId] : 50) - 2,
          5,
          95,
        );
      }
      pushDiploAlert(getG(), {
        kind: "bloc_inbound_decline",
        partnerId: fromId,
        blocId,
        label: blocName,
        q: getG().q,
        expiresQ: (getG().q || 0) + 3,
      });
    }
    tPol.blocAccession = null;
    clearInboundBlocInvite(g, seatId);
    if (g.blocInvites) delete g.blocInvites[seatId];
    syncMpPoliticsFromG(tPol);

    const iPol = mountMpSeatOnSnapshot(g, fromId);
    pushDiploAlert(getG(), {
      kind: accept ? "bloc_invite_accept" : "bloc_invite_decline",
      partnerId: seatId,
      blocId,
      label: blocName,
      q: getG().q,
      expiresQ: (getG().q || 0) + 3,
    });
    if (!accept && getG().rel) {
      getG().rel[seatId] = clamp(
        (getG().rel[seatId] != null ? getG().rel[seatId] : 50) - 2,
        5,
        95,
      );
    }
    const p = partnerById(seatId);
    const name = theCountry(p ? p.name : seatId);
    if (getG().brief) {
      const note = accept
        ? name + " accepts the invitation to " + theCountry(blocName) + "."
        : name + " declines the invitation to " + theCountry(blocName) + ".";
      getG().brief = [note].concat(getG().brief).slice(0, 3);
    }
    syncMpPoliticsFromG(iPol);
    return { ok: true, accept: !!accept };
  } finally {
    g.homeRole = savedMount.homeRole;
    g.econ = savedMount.econ;
    g.law = savedMount.law;
    g.draft = savedMount.draft;
    g.prevLaw = savedMount.prevLaw;
    g.capital = savedMount.capital;
    g.fac = savedMount.fac;
    g.rel = savedMount.rel;
    g.country = savedMount.country;
    g.envoys = savedMount.envoys;
    g.ultimatums = savedMount.ultimatums;
    g.activeVisits = savedMount.activeVisits;
    g.missionEvents = savedMount.missionEvents;
    g.diploAlerts = savedMount.diploAlerts;
    g.mods = savedMount.mods;
    g.sandbox = savedMount.sandbox;
    g.rateManual = savedMount.rateManual;
    g.manualRate = savedMount.manualRate;
    g.blocAccession = savedMount.blocAccession;
    setG(prev);
  }
}

/** Expired inbound bloc invites with no human answer count as decline. */
function timeoutInboundBlocInvites(g: any) {
  if (!g || !g.politics) return;
  const q = g.q || 0;
  const due = [];
  for (const toId of Object.keys(g.politics)) {
    const pol = g.politics[toId];
    const inbound = pendingInboundBlocInvite(pol);
    if (!inbound) continue;
    if (q < (inbound.expiresQ != null ? inbound.expiresQ : 0)) continue;
    due.push(toId);
  }
  for (const toId of due) {
    applyMpInboundBlocInviteChoice(g, toId, false);
  }
}

const DEAL_PROPOSAL_WAIT = 4;

function pendingInboundDealProposal(pol: any) {
  const prop = pol && pol.inboundDealProposal;
  if (!prop || prop.status !== "pending") return null;
  return prop;
}

function parkInboundDealProposal(g: any, fromId: any, toId: any, dealId: any) {
  if (!g || !fromId || !toId || !dealId || fromId === toId) return false;
  if (!isHumanMpSeat(g, toId)) return false;
  const d = dealById(dealId, g);
  if (!d) return false;
  const pol = normalizeDiploPolitics(g.politics[toId]);
  const existing = pol.inboundDealProposal;
  /* One inbound slot — do not clobber another issuer's pending offer. */
  if (
    existing &&
    existing.status === "pending" &&
    existing.fromId &&
    existing.fromId !== fromId
  ) {
    return false;
  }
  pol.inboundDealProposal = {
    fromId,
    dealId,
    label: d.name,
    terms: Array.isArray(d.terms) ? d.terms.slice() : [],
    sentQ: g.q || 0,
    expiresQ: (g.q || 0) + DEAL_PROPOSAL_WAIT,
    status: "pending",
  };
  const fromPol = normalizeDiploPolitics(g.politics[fromId]);
  fromPol.outboundDealProposal = {
    toId,
    dealId,
    label: d.name,
    sentQ: g.q || 0,
    expiresQ: (g.q || 0) + DEAL_PROPOSAL_WAIT,
    status: "pending",
  };
  return true;
}

function clearInboundDealProposal(g: any, toId: any) {
  const pol = g && g.politics && g.politics[toId];
  if (!pol) return;
  const inbound = pol.inboundDealProposal;
  if (inbound && inbound.fromId && g.politics[inbound.fromId]) {
    const fromPol = g.politics[inbound.fromId];
    if (
      fromPol.outboundDealProposal &&
      fromPol.outboundDealProposal.toId === toId
    ) {
      fromPol.outboundDealProposal = null;
    }
  }
  pol.inboundDealProposal = null;
}

/**
 * Human target answers a trade-deal proposal. Accept writes the deal onto the
 * issuer's law only (proposer-only reciprocity); decline clears the pending ask.
 */
function applyMpInboundDealChoice(g: any, seatId: any, accept: any) {
  if (!g || !g.world || !g.world[seatId]) {
    return { ok: false, error: "Unknown seat" };
  }
  if (!g.politics || !g.politics[seatId]) {
    return { ok: false, error: "Missing seat politics" };
  }
  const targetPol = normalizeDiploPolitics(g.politics[seatId]);
  const inbound = pendingInboundDealProposal(targetPol);
  if (!inbound) {
    return { ok: false, error: "No pending deal proposal" };
  }
  const fromId = inbound.fromId;
  if (!fromId || !g.politics[fromId] || !g.world[fromId]) {
    return { ok: false, error: "Unknown issuer" };
  }
  const dealId = inbound.dealId;
  const d = dealById(dealId, g);
  const dealName = d ? d.name : inbound.label || dealId;
  const prev = getG();
  const savedMount = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
    mods: g.mods,
    sandbox: g.sandbox,
    rateManual: g.rateManual,
    manualRate: g.manualRate,
  };
  try {
    setG(g);
    g.q = g.q != null ? g.q : 0;

    if (accept) {
      const issuerSeat = g.world[fromId];
      if (!issuerSeat.law.deals) issuerSeat.law.deals = {};
      issuerSeat.law.deals[dealId] = true;
    }

    const tPol = mountMpSeatOnSnapshot(g, seatId);
    if (accept) {
      if (getG().fac) {
        getG().fac.business = clamp((getG().fac.business || 50) + 2, 2, 96);
      }
      pushDiploAlert(getG(), {
        kind: "deal_inbound_accept",
        partnerId: fromId,
        dealId,
        label: dealName,
        q: getG().q,
        expiresQ: (getG().q || 0) + 3,
      });
    } else {
      if (getG().fac) {
        getG().fac.patriots = clamp((getG().fac.patriots || 50) + 2, 2, 96);
        getG().fac.business = clamp((getG().fac.business || 50) - 2, 2, 96);
      }
      if (fromId && getG().rel) {
        getG().rel[fromId] = clamp(
          (getG().rel[fromId] != null ? getG().rel[fromId] : 50) - 3,
          5,
          95,
        );
      }
      pushDiploAlert(getG(), {
        kind: "deal_inbound_decline",
        partnerId: fromId,
        dealId,
        label: dealName,
        q: getG().q,
        expiresQ: (getG().q || 0) + 3,
      });
    }
    clearInboundDealProposal(g, seatId);
    syncMpPoliticsFromG(tPol);

    const iPol = mountMpSeatOnSnapshot(g, fromId);
    if (accept) {
      /* Sphere trespass ledger runs against the issuer's mounted seat. */
      applySphereTrespassOnDeal(dealId, true);
    }
    pushDiploAlert(getG(), {
      kind: accept ? "deal_propose_accept" : "deal_propose_decline",
      partnerId: seatId,
      dealId,
      label: dealName,
      q: getG().q,
      expiresQ: (getG().q || 0) + 3,
    });
    if (!accept && getG().rel) {
      getG().rel[seatId] = clamp(
        (getG().rel[seatId] != null ? getG().rel[seatId] : 50) - 3,
        5,
        95,
      );
    }
    const p = partnerById(seatId);
    const name = theCountry(p ? p.name : seatId);
    if (getG().brief) {
      const note = accept
        ? name + " accepts the treaty — " + dealName + "."
        : name + " declines the treaty — " + dealName + ".";
      getG().brief = [note].concat(getG().brief).slice(0, 3);
    }
    syncMpPoliticsFromG(iPol);
    return { ok: true, accept: !!accept };
  } finally {
    g.homeRole = savedMount.homeRole;
    g.econ = savedMount.econ;
    g.law = savedMount.law;
    g.draft = savedMount.draft;
    g.prevLaw = savedMount.prevLaw;
    g.capital = savedMount.capital;
    g.fac = savedMount.fac;
    g.rel = savedMount.rel;
    g.country = savedMount.country;
    g.envoys = savedMount.envoys;
    g.ultimatums = savedMount.ultimatums;
    g.activeVisits = savedMount.activeVisits;
    g.missionEvents = savedMount.missionEvents;
    g.diploAlerts = savedMount.diploAlerts;
    g.mods = savedMount.mods;
    g.sandbox = savedMount.sandbox;
    g.rateManual = savedMount.rateManual;
    g.manualRate = savedMount.manualRate;
    setG(prev);
  }
}

/** Expired inbound deal proposals with no human answer count as decline. */
function timeoutInboundDealProposals(g: any) {
  if (!g || !g.politics) return;
  const q = g.q || 0;
  const due = [];
  for (const toId of Object.keys(g.politics)) {
    const pol = g.politics[toId];
    const inbound = pendingInboundDealProposal(pol);
    if (!inbound) continue;
    if (q < (inbound.expiresQ != null ? inbound.expiresQ : 0)) continue;
    due.push(toId);
  }
  for (const toId of due) {
    applyMpInboundDealChoice(g, toId, false);
  }
}

function applyMissionEventOption(opt: any, ctx: any) {
  const g = getG();
  if (!g || !opt) return;
  const partnerId = ctx && ctx.partnerId;
  const rivalId = ctx && ctx.rivalId;
  ensureDiploStocks(g.econ);
  if (opt.setRel) {
    for (const k in opt.setRel) {
      const pid = k === "_partner" ? partnerId : k === "_rival" ? rivalId : k;
      if (!pid) continue;
      g.rel[pid] = clamp(
        (g.rel[pid] != null ? g.rel[pid] : 50) + opt.setRel[k],
        5,
        95,
      );
    }
  }
  if (opt.fac && g.fac) {
    for (const f in opt.fac)
      g.fac[f] = clamp((g.fac[f] || 50) + opt.fac[f], 2, 96);
  }
  if (opt.relImpulse && partnerId) {
    g.econ.relImpulse[partnerId] =
      (g.econ.relImpulse[partnerId] || 0) + opt.relImpulse;
  }
  if (opt.capital) g.capital = clamp(g.capital + opt.capital, 0, 100);
  if (opt.ledger && partnerId) {
    addDiploLedger(g, partnerId, {
      id:
        "mission_evt_" +
        g.q +
        "_" +
        String(opt.ledger.label || "evt").slice(0, 12),
      label: opt.ledger.label,
      pts: opt.ledger.pts,
    });
  }
  if (opt.rivalLedger && rivalId) {
    addDiploLedger(g, rivalId, {
      id: "mission_rival_" + g.q,
      label: opt.rivalLedger.label,
      pts: opt.rivalLedger.pts,
    });
  }
  if (opt.access && partnerId) {
    g.econ.partnerAccessEff[partnerId] =
      (g.econ.partnerAccessEff[partnerId] || 0) + opt.access;
  }
  if (opt.tariffCut && lockedTariff(g.law) == null) {
    g.law.tariff = Math.max(0, (g.law.tariff || 0) - opt.tariffCut);
  }
  if (opt.sanctionRival && rivalId)
    setSanctionStance(g, rivalId, { against: true });
}

function missionOptionHint(opt: any, ctx: any) {
  if (!opt) return "";
  const bits = [];
  const relLabel = (key: any) => {
    if (key === "_partner")
      return partnerById(ctx.partnerId)?.name || "Partner";
    if (key === "_rival") return ctx.rivalName || "Rival";
    return partnerById(key)?.name || key;
  };
  if (opt.setRel) {
    for (const k in opt.setRel) {
      const v = opt.setRel[k];
      if (!v) continue;
      if (k === "_rival" && !ctx.rivalId) continue;
      bits.push(
        '<span class="' +
          (v > 0 ? "up" : "dn") +
          '">' +
          esc(relLabel(k)) +
          " relations " +
          (v > 0 ? "+" : "") +
          v +
          "</span>",
      );
    }
  }
  if (opt.fac) {
    const f = (Object.entries(opt.fac) as [string, number][])
      .filter((e) => e[1])
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [fid, v] of f.slice(0, 3)) {
      const fn = (FACTIONS.find((x) => x.id === fid) || {}).name || fid;
      bits.push(
        '<span class="' +
          (v > 0 ? "up" : "dn") +
          '">' +
          esc(fn) +
          (v > 0 ? " +" : " ") +
          v +
          "</span>",
      );
    }
  }
  if (opt.capital)
    bits.push(
      '<span class="' +
        (opt.capital > 0 ? "up" : "dn") +
        '">Capital ' +
        (opt.capital > 0 ? "+" : "") +
        opt.capital +
        "</span>",
    );
  if (opt.relImpulse)
    bits.push(
      '<span class="up">Relations drift +' + opt.relImpulse + "/Q</span>",
    );
  if (opt.tariffCut)
    bits.push('<span class="up">Tariffs −' + opt.tariffCut + " pts</span>");
  if (opt.access)
    bits.push('<span class="up">Market access +' + opt.access + "</span>");
  if (opt.sanctionRival && ctx.rivalId)
    bits.push(
      '<span class="dn">Sanctions on ' +
        esc(ctx.rivalName || "rival") +
        "</span>",
    );
  if (opt.summitKind === "tariff")
    bits.push(
      '<span class="up">Reciprocal country tariff −' +
        (opt.delta || SUMMIT_TARIFF_DELTA) +
        " pts</span>",
    );
  if (opt.summitKind === "deal" && opt.dealId) {
    const d = dealById(opt.dealId);
    bits.push(
      '<span class="up">Signs ' +
        esc(d ? d.name.toLowerCase() : opt.dealId) +
        "</span>",
    );
  }
  if (!bits.length) return "";
  return '<div class="impfac mission-hint">' + bits.join("") + "</div>";
}

function queueSummitVisitEvents(g: any) {
  if (!g || !g.activeVisits) return;
  if (!g.missionEvents) g.missionEvents = [];
  const q = g.q || 0;
  for (const pid of Object.keys(g.activeVisits)) {
    const v = g.activeVisits[pid];
    if (!v || v.missionId !== "summit") continue;
    /* Enact steps the clock before we queue, so left may already be 0. */
    if (v.endsQ < q) continue;
    const total = v.eventsTotal != null ? v.eventsTotal : SUMMIT_EVENT_BEATS;
    const fired = v.eventsFired || 0;
    if (fired >= total) continue;
    const humanHost = isHumanMpSeat(g, pid);
    /* Political paper then commercial agenda — same Deliver, sequential.
       A human host speaks for themselves: skip scripted demand papers. */
    for (let i = fired; i < total; i++) {
      if (humanHost && i !== 1) continue;
      g.missionEvents.push({
        partnerId: pid,
        missionId: "summit",
        q,
        eventIndex: i,
      });
    }
    v.eventsFired = total;
  }
}

function commercialAgendaDespatchData(
  partnerId: any,
  pName: any,
  intro: any,
  onPropose: (ourDelta: number, theirDelta: number, dealIds: string[]) => void,
) {
  const g = getG();
  const room = summitTariffRoom(g, partnerId);
  const bound = cuBoundary(g, partnerId);
  const bloc =
    bound &&
    (blocById(bound.blocId) || (g.customBlocs && g.customBlocs[bound.blocId]));
  const approvals = bound ? unionPackageApprovals(g, bound) : [];
  const deals = summitCommercialDealOptions(partnerId, g).map((d: any) => {
    if (isHumanMpSeat(g, partnerId)) {
      return {
        id: d.id,
        name: d.name,
        ok: true,
        p: 1,
        pending: true,
      };
    }
    const r = commercialScore("deal", partnerId, g, {
      dealId: d.id,
    });
    return {
      id: d.id,
      name: d.name,
      ok: r.ok,
      p: r.p,
    };
  });
  return {
    intro,
    hint: bound
      ? "This agenda is with " +
        (bloc && bloc.name ? bloc.name : "the union") +
        ". Preferential duties bind every member. Cool members drag acceptance; they do not veto."
      : "Cut duties, table any unsigned treaty, or both. The whole agenda is accepted or declined together. Offering a deeper cut than you ask of them improves acceptance.",
    partnerId,
    partnerName: pName,
    ourRate: room ? room.our : 0,
    theirRate: room ? room.their : 0,
    ourMax: room ? room.ourMax : 0,
    theirMax: room ? room.theirMax : 0,
    canNegotiate: !!(room && canNegotiateTariffs(g, partnerId)),
    deals,
    onPropose,
    union: bound
      ? {
          blocId: bound.blocId,
          name: (bloc && bloc.name) || bound.blocId,
          approvals,
        }
      : null,
  };
}

/** Read-only commercial agenda shown to the human who must accept or decline. */
function inboundSummitAgendaDespatchData(
  prop: any,
  name: any,
  deals: { id: string; label: string; terms: string[] }[],
) {
  name = theCountry(name);
  const g = getG();
  const fromId = prop && prop.fromId;
  const theirDelta =
    prop && prop.theirDelta != null
      ? +prop.theirDelta
      : prop && prop.delta != null
        ? +prop.delta
        : 0;
  const ourDelta = prop && prop.ourDelta != null ? +prop.ourDelta : theirDelta;
  const law = g && (g.draft || g.law);
  const ourFrom =
    fromId && law
      ? +(effectiveTariff(fromId, law, g.homeRole, g.blocMember) || 0)
      : 0;
  const theirFrom = fromId ? +(livePartnerTariffOnPlayer(fromId, g) || 0) : 0;
  const ourTo = Math.max(0, ourFrom - Math.max(0, theirDelta || 0));
  const theirTo = Math.max(0, theirFrom - Math.max(0, ourDelta || 0));
  const hasTariff = ourDelta > 0 || theirDelta > 0;
  const bloc =
    prop &&
    prop.unionBlocId &&
    (blocById(prop.unionBlocId) ||
      (g.customBlocs && g.customBlocs[prop.unionBlocId]));
  const unionName = theCountry(bloc && bloc.name ? bloc.name : "the union");
  const ourLabel =
    prop && prop.unionBlocId
      ? "Our duty on " + unionName
      : "Our duty on " + name;
  const theirLabel =
    prop && prop.unionBlocId
      ? unionName + "'s duty on {C}"
      : name + "'s duty on {C}";
  let intro = "";
  if (hasTariff && deals.length) {
    intro =
      "<p>" +
      name +
      " tables a commercial agenda with {C}. The duty cuts below move on both statute books if you accept; the treaties take effect on theirs. Decline and the whole agenda lapses, including their staged cut on us.</p>";
  } else if (hasTariff) {
    intro =
      "<p>" +
      name +
      " proposes the duty cuts below. Accept and both country rates move on the statute books. Decline and their staged cut on us is withdrawn.</p>";
  } else if (deals.length) {
    const listed = deals.map((d) => "<b>" + esc(d.label) + "</b>").join(", ");
    intro =
      "<p>" +
      name +
      " proposes to ratify " +
      listed +
      " with {C}. Accept and the treaty takes effect on their statute book; you may ratify a reciprocal deal of your own later. Decline and the offer lapses.</p>";
  }
  return {
    inbound: true,
    intro,
    hint: hasTariff
      ? "Green is the rate after the cut; the pale stretch is what comes off."
      : null,
    ourLabel,
    theirLabel,
    ourFrom,
    ourTo,
    theirFrom,
    theirTo,
    hasTariff,
    deals: deals.map((d) => ({
      id: d.id,
      name: d.label,
      terms: Array.isArray(d.terms) ? d.terms.slice() : [],
    })),
  };
}

function presentNextMissionEvent(onDone: any) {
  if (!getG().missionEvents || !getG().missionEvents.length) {
    onDone();
    return;
  }
  const item = getG().missionEvents.shift();
  const ev = rollMissionEvent(
    item.missionId,
    item.partnerId,
    getG(),
    diploDeps(),
    false,
    item.eventIndex,
  );
  if (!ev) {
    presentNextMissionEvent(onDone);
    return;
  }
  const pName = partnerById(item.partnerId)?.name || item.partnerId;
  const rivalName = ev.rivalName || "a rival";
  const title = T(formatMissionTokens(ev.title || "", pName, rivalName));
  const commercial = ev.id === "summit_commercial_agenda";
  const ctx = {
    partnerId: item.partnerId,
    rivalId: ev.rivalId,
    rivalName: ev.rivalName,
  };
  const otherOpts = commercial
    ? (ev.opts || []).filter(
        (o: any) => o.summitKind !== "tariff" && o.summitKind !== "deal",
      )
    : ev.opts;
  const optsWithHints = (otherOpts || []).map((o: any) =>
    formatSummitCommercialOpt(
      o,
      ctx,
      pName,
      rivalName,
      commercial,
      (picked) => {
        if (commercial) applySummitCommercialOption(picked, ctx);
        else
          applyMissionEventOption(picked, {
            partnerId: item.partnerId,
            rivalId: ev.rivalId,
            missionId: item.missionId,
          });
        presentNextMissionEvent(onDone);
      },
    ),
  );
  if (!commercial && !optsWithHints.some((o: any) => o.hint || o.disabled)) {
    presentNextMissionEvent(onDone);
    return;
  }
  if (commercial) {
    despatch(
      title,
      "Foreign Office",
      {
        kind: "commercial",
        data: commercialAgendaDespatchData(
          item.partnerId,
          pName,
          formatMissionEventText(ev, getG(), diploDeps()),
          (ourDelta: number, theirDelta: number, dealIds: string[]) => {
            applySummitCommercialOption(
              {
                summitKind: "package",
                ourDelta,
                theirDelta,
                dealIds: dealIds || [],
              },
              ctx,
            );
            presentNextMissionEvent(onDone);
          },
        ),
      },
      optsWithHints,
    );
    return;
  }
  const body =
    "<p>" +
    formatMissionEventText(ev, getG(), diploDeps()) +
    "</p>" +
    '<p class="hint">' +
    "Each choice shifts relations and factions. Expected impacts are listed under every option." +
    "</p>";
  despatch(title, "Foreign Office", body, optsWithHints);
}

function processActiveVisits(g: any, briefExtra: any) {
  if (!g || !g.activeVisits) return;
  const e = g.econ;
  if (!e) return;
  ensureDiploStocks(e);
  const ended = [];
  for (const pid of Object.keys(g.activeVisits)) {
    const v = g.activeVisits[pid];
    if (!v) continue;
    const left = v.endsQ - (g.q || 0);
    if (left <= 0) {
      ended.push(pid);
      continue;
    }
    if (v.missionId === "summit") {
      e.relImpulse[pid] = (e.relImpulse[pid] || 0) + 2;
    }
  }
  for (const pid of ended) {
    delete g.activeVisits[pid];
    const p = partnerById(pid);
    briefExtra.push(
      "State visit with " + theCountry(p ? p.name : pid) + " concluded.",
    );
  }
}

function applySphereTrespassOnDeal(dealId: any, ratified: any) {
  const g = getG();
  if (!g || !dealId) return;
  const d = dealById(dealId, g);
  if (!d || !d.partner) return;
  const player = playerCountryId();
  for (const { patron } of spherePatronsForPartner(d.partner)) {
    if (patron === player) continue;
    if (ratified) {
      const client = partnerById(d.partner);
      addDiploLedger(g, patron, {
        id: "sphere_" + dealId,
        label:
          "Trade deal in their sphere (" +
          (client ? client.name : d.partner) +
          ")",
        pts: -6,
      });
    }
  }
}

function sphereRiskHint(partnerId: any) {
  const patrons = spherePatronsForPartner(partnerId);
  if (!patrons.length) return "";
  const player = playerCountryId();
  const names = patrons
    .filter((p) => p.patron !== player)
    .map((p) => {
      const x = partnerById(p.patron);
      return x ? x.name : p.patron;
    });
  if (!names.length) return "";
  return (
    names[0] + " may see this as interference in their sphere (− relations)"
  );
}
/** Partners still on the board for this game. Excludes the seat you occupy and
 *  The Kingdom when you are The Kingdom (ISO 826 already maps to "home"). */ function activePartners(
  homeRole?: any,
) {
  const g = getG();
  const role = resolveHomeRole(
    homeRole != null
      ? homeRole
      : (typeof g !== "undefined" && g && g.homeRole) || "home",
  );
  return PARTNERS.filter((p) => {
    if (p.id === role) return false;
    if (p.id === "kingdom" && role === "home") return false;
    return true;
  });
}
/** Bilateral export weight for an active partner from the seat's trade matrix. */ function partnerShare(
  homeRole: any,
  partner: any,
) {
  const g = getG();
  const role =
    homeRole != null
      ? homeRole
      : (typeof g !== "undefined" && g && g.homeRole) || "home";
  const id = typeof partner === "string" ? partner : partner.id;
  const fb =
    typeof partner === "object" && partner ? partner.tradeShare : undefined;
  return shareFor(role, id, fb);
}
/** Rest-of-world residual so named active shares + rest still sum to 1. */ function tradeRestShare(
  homeRole: any,
) {
  const g = getG();
  const role =
    homeRole != null
      ? homeRole
      : (typeof g !== "undefined" && g && g.homeRole) || "home";
  const named = activePartners(role).reduce(
    (s, p) => s + partnerShare(role, p),
    0,
  );
  return Math.max(0, 1 - named);
}
/** Deals offered to this seat for a partner (hides Kingdom-as-outsider trees). */ function dealsForPartner(
  partner: any,
  homeRole: any,
) {
  const g = getG();
  const role =
    homeRole != null
      ? homeRole
      : (typeof g !== "undefined" && g && g.homeRole) || "home";
  const p = typeof partner === "string" ? partnerById(partner) : partner;
  if (!p || !p.deals) return [];
  return p.deals.filter((d: any) => {
    if (d.homeOff && d.homeOff.includes(role)) return false;
    if (d.homeOnly && !d.homeOnly.includes(role)) return false;
    return true;
  });
}
function hasDeal(id: any, law?: any) {
  const g = getG();
  const L = law || (g && g.law);
  return !!(L && L.deals && L.deals[id]);
}
function dealsWith(pid: any, law?: any) {
  const g = getG();
  const L = law || (g && g.law);
  if (!L || !L.deals) return [];
  return Object.keys(L.deals).filter((id) => {
    if (!L.deals[id]) return false;
    const d = dealById(id, g);
    if (!d) return false;
    if (d.partner === pid) return true;
    if (d.blocId && countryBlocId(pid) === d.blocId) return true;
    return false;
  });
}
/** Lowest lockTariff among ratified deals, or null if the lever is free. */ function lockedTariff(
  law: any,
) {
  const g = getG();
  const L = law || (g && g.law);
  const blocLock = tariffLocked(L);
  if (blocLock.mode !== "none") return blocLock.cet != null ? blocLock.cet : 4;
  if (!L || !L.deals) return null;
  let lock = null;
  for (const id in L.deals) {
    if (!L.deals[id]) continue;
    const d = dealById(id);
    if (d && d.lockTariff != null)
      lock = lock == null ? d.lockTariff : Math.min(lock, d.lockTariff);
  }
  return lock;
}
function defaultTariffSchedule() {
  return {
    default: BASE_TARIFF,
    bloc: {},
    country: {},
    cet: null,
  };
}
function ensureTariffSchedule(law: any) {
  if (!law.tariffSchedule) law.tariffSchedule = defaultTariffSchedule();
  if (!law.tariffSchedule.bloc) law.tariffSchedule.bloc = {};
  if (!law.tariffSchedule.country) law.tariffSchedule.country = {};
  return law.tariffSchedule;
}
function syncTariffHeadline(law: any, homeRole?: any) {
  const g = getG();
  const L = law || (g && g.law);
  if (!L) return BASE_TARIFF;
  ensureTariffSchedule(L);
  L.tariff = tariffScheduleAverage(L, homeRole);
  return L.tariff;
}
function playerCountryId(homeRole?: any) {
  const g = getG();
  const role = resolveHomeRole(
    homeRole != null
      ? homeRole
      : (typeof g !== "undefined" && g && g.homeRole) || "home",
  );
  return role === "home" ? "kingdom" : role;
}
/** True when `id` is the local player's seat (home/kingdom alias included). */
function isPlayerSeat(id: any, homeRole?: any) {
  if (!id) return false;
  const pid = playerCountryId(homeRole);
  if (id === pid) return true;
  const g = getG();
  const role = resolveHomeRole(
    homeRole != null ? homeRole : (g && g.homeRole) || "home",
  );
  if (id === "kingdom" && (role === "home" || pid === "kingdom")) return true;
  if (id === "home" && pid === "kingdom") return true;
  return false;
}
function activePartnerIds(homeRole?: any) {
  return activePartners(homeRole).map((p) => p.id);
}
/** Partner is on the board and is not the local seat. */
function requirePartner(id: any) {
  return !!id && activePartners().some((p) => p.id === id);
}
/** AI partner: on the board, not the local seat, not a human MP seat. */
function requireScriptablePartner(id: any) {
  return requirePartner(id) && !isHumanMpSeat(getG(), id);
}
function scriptablePartners(extraFilter?: (p: any) => boolean) {
  return activePartners().filter((p) => {
    if (isHumanMpSeat(getG(), p.id)) return false;
    if (extraFilter && !extraFilter(p)) return false;
    return true;
  });
}
function firstPresentPartner(ids: any[]) {
  for (const id of ids || []) {
    if (requirePartner(id)) return id;
  }
  return null;
}
function firstScriptablePartner(ids: any[]) {
  for (const id of ids || []) {
    if (requireScriptablePartner(id)) return id;
  }
  return null;
}
function countryBlocId(countryId: any, blocMember?: any) {
  const g = getG();
  const bm = blocMember || (g && g.blocMember) || {};
  return bm[countryId] || null;
}
function hasIndependentCommercialPolicy(countryId: any, blocMember?: any) {
  const g = getG();
  const bm = blocMember || (g && g.blocMember) || {};
  return blocIndependentPolicy(countryId, bm, g && g.customBlocs);
}
function blocMembers(blocId: any, blocMember?: any) {
  const g = getG();
  const bm = blocMember || (g && g.blocMember) || {};
  return countriesInBloc(blocId, bm);
}
/** Fellow members of any bloc (FTA or customs union) trade duty-free with each other —
 * that is the defining feature of bloc membership, not something exclusive to a
 * common-external-tariff union. */
function shareSameBloc(partnerId: any, homeRole: any, blocMember: any) {
  const player = playerCountryId(homeRole);
  const pb = countryBlocId(partnerId, blocMember);
  const hb = countryBlocId(player, blocMember);
  return !!pb && !!hb && pb === hb;
}
function effectiveTariff(
  partnerId: any,
  law: any,
  homeRole?: any,
  blocMember?: any,
) {
  const g = getG();
  const L = law || (g && g.law);
  const sched = ensureTariffSchedule(L);
  const role = homeRole != null ? homeRole : (g && g.homeRole) || "home";
  const bm = blocMember || (g && g.blocMember) || {};
  if (shareSameBloc(partnerId, role, bm)) return 0;
  const lock = tariffLocked(L, role, bm);
  /* The common external tariff is only the *shared baseline* against
   * outsiders — any member can still layer their own tariff on top of it
   * for a specific outside bloc or country, same as a non-union player
   * would (tariffCetBlockers() gates changing the CET itself, not this). */
  let baseline = sched.default;
  if (lock.mode === "cet") {
    if (lock.cet != null) baseline = lock.cet;
    else {
      const bloc = blocById(lock.blocId);
      baseline =
        bloc && bloc.defaultCet != null ? bloc.defaultCet : sched.default;
    }
  }
  /* A country rate layers on a specific partner even when they sit in a
   * foreign bloc. Same-bloc partners already returned 0 above. */
  if (sched.country[partnerId] != null) return sched.country[partnerId];
  const pb = countryBlocId(partnerId, bm);
  if (pb && sched.bloc[pb] != null) return sched.bloc[pb];
  return baseline;
}
function tariffScheduleAverage(law: any, homeRole?: any, blocMember?: any) {
  const g = getG();
  const role = homeRole != null ? homeRole : (g && g.homeRole) || "home";
  const bm = blocMember != null ? blocMember : (g && g.blocMember) || {};
  let sum = 0,
    w = 0;
  for (const p of activePartners(role)) {
    const sh = partnerShare(role, p);
    sum += sh * effectiveTariff(p.id, law, role, bm);
    w += sh;
  }
  return w > 0 ? sum / w : ensureTariffSchedule(law).default;
}
/* Trade-weighted effective import barrier: schedule/CU/CET minus phased deal cuts. */ function importTariffLevel(
  law: any,
  E: any,
  e: any,
  homeRole: any,
  blocMember: any,
) {
  const cutNow =
    (E.tariffCut || 0) + (e && e.tariffCutEff != null ? e.tariffCutEff : 0);
  const avg = tariffScheduleAverage(law, homeRole, blocMember);
  return Math.max(0, avg - cutNow);
}
/* Per-partner market-access targets from ratified deals and shared bloc membership. */ function partnerAccessTargets(
  law: any,
  homeRole: any,
  blocMember: any,
) {
  const g = getG();
  const role = homeRole != null ? homeRole : (g && g.homeRole) || "home";
  const bm = blocMember != null ? blocMember : (g && g.blocMember) || {};
  const player = playerCountryId(role);
  const out: Record<string, any> = {};
  for (const id in law.deals || {}) {
    if (!law.deals[id]) continue;
    const d = dealById(id);
    if (!d || !d.ch || !d.ch.access) continue;
    if (d.blocId) {
      for (const m of countriesInBloc(d.blocId, bm)) {
        if (m === player) continue;
        (out as any)[m] = ((out as any)[m] || 0) + d.ch.access;
      }
    } else if (d.partner) {
      (out as any)[d.partner] = ((out as any)[d.partner] || 0) + d.ch.access;
    }
  }
  const bid = countryBlocId(player, bm);
  if (bid) {
    const bloc = blocById(bid) || (g && g.customBlocs && g.customBlocs[bid]);
    if (bloc && bloc.accessBonus) {
      const pts = (bloc.accessBonus - 1) * 100;
      for (const p of activePartners(role)) {
        if (countryBlocId(p.id, bm) === bid)
          (out as any)[p.id] = ((out as any)[p.id] || 0) + pts;
      }
    }
  }
  return out;
}
/* Phased trade-depth target: partner access plus tariff integration vs opening. */ function tradeExposureTarget(
  law: any,
  E: any,
  e: any,
  homeRole: any,
  blocMember: any,
) {
  const access = E.access || 0;
  const importT = importTariffLevel(law, E, e, homeRole, blocMember);
  const tariffInt = (Math.max(0, BASE_TARIFF - importT) / BASE_TARIFF) * 100;
  return access + tariffInt;
}
/** Customs-union members share one external tariff, but nobody sets it alone
 * — any member may propose a new rate, and it takes effect only once every
 * other member's relations clear the bar (see tariffCetBlockers()), the same
 * consensus gate the union already uses for accession and external deals.
 * "Chair" still exists (see blocAccessionSpec) for admission gating, but no
 * longer buys sole authority over the shared rate. */
function tariffLocked(law: any, homeRole?: any, blocMember?: any) {
  const g = getG();
  const role = homeRole != null ? homeRole : (g && g.homeRole) || "home";
  const L = law || (g && g.law);
  const player = playerCountryId(role);
  const bm = blocMember || (g && g.blocMember) || {};
  const bid = countryBlocId(player, bm);
  if (!bid)
    return {
      mode: "none",
    };
  const bloc = blocById(bid) || (g && g.customBlocs && g.customBlocs[bid]);
  if (!bloc || !isCustomsUnion(bloc))
    return {
      mode: "none",
    };
  const sched = ensureTariffSchedule(L);
  const cet = sched.cet != null ? sched.cet : bloc.defaultCet;
  return {
    mode: "cet",
    blocId: bid,
    cet,
  };
}
/** Fellow members who would need to sign off on a proposed CET change,
 * reusing the same relation-threshold approval already used for accession
 * and bloc-external deals. */
function tariffCetBlockers(blocId: any) {
  return blocMemberApprovals(blocId)
    .filter((a: any) => !a.ok)
    .map(
      (a: any) =>
        "relations with " +
        a.name +
        " " +
        a.rel.toFixed(0) +
        " (need " +
        a.min +
        "+)",
    );
}
function initBlocState(homeRole: any) {
  const bm = clone(DEFAULT_BLOC_MEMBER);
  const player = playerCountryId(homeRole);
  if (homeRole === "home" || player === "kingdom") delete bm.kingdom;
  return bm;
}
function blocByIdOrCustom(blocId: any) {
  const g = getG();
  return (
    blocById(blocId) || (g && g.customBlocs && g.customBlocs[blocId]) || null
  );
}
function blocAccessionSpec(blocId: any) {
  const g = getG();
  const bloc = blocByIdOrCustom(blocId);
  if (bloc && bloc.accession) return bloc.accession;
  /* Custom blocs have no full accession spec object; use a default
   * accession shape so founded blocs can be rejoined. */
  if (bloc && g && g.customBlocs && g.customBlocs[blocId]) {
    return {
      memberRelationMin: 45,
      steps: {
        apply: 8,
        align: 14,
        accede: 16,
      },
      need: {},
    };
  }
  return null;
}
function defaultAccessionForBloc(blocId: any) {
  const spec = blocAccessionSpec(blocId);
  if (spec) return spec;
  return {
    memberRelationMin: 45,
    steps: {
      apply: 4,
      align: 6,
      accede: 8,
    },
  };
}
function inviteAcceptMin(blocId: any, candidateId?: any) {
  const spec = defaultAccessionForBloc(blocId);
  let min = spec.memberRelationMin || 45;
  if (candidateId && isPoachCandidate(blocId, candidateId)) {
    const home = countryBlocId(candidateId);
    min += isCustomsUnion(blocByIdOrCustom(home)) ? 12 : 8;
  }
  return min;
}
function isPoachCandidate(destBlocId: any, candidateId: any) {
  const home = countryBlocId(candidateId);
  return !!(home && home !== destBlocId);
}
function poachRelMin(homeBlocId: any) {
  const bloc = blocByIdOrCustom(homeBlocId);
  return isCustomsUnion(bloc) ? 62 : 55;
}
function inviteCapitalCost(destBlocId: any, candidateId: any) {
  if (!isPoachCandidate(destBlocId, candidateId)) return 12;
  const home = countryBlocId(candidateId);
  return isCustomsUnion(blocByIdOrCustom(home)) ? 24 : 20;
}
function inviteClauseLabel(destBlocId: any, candidateId: any) {
  const c = partnerById(candidateId);
  const dest = blocByIdOrCustom(destBlocId);
  const destName = theCountry(dest ? dest.name : "bloc");
  const name = theCountry(c ? c.name : candidateId);
  if (!isPoachCandidate(destBlocId, candidateId)) {
    return "Propose " + name + " join " + destName;
  }
  const home = blocByIdOrCustom(countryBlocId(candidateId));
  const homeName = theCountry(home ? home.name : "their bloc");
  return "Propose " + name + " leave " + homeName + " and join " + destName;
}
function applyPoachDepartureHits(
  state: any,
  departingId: any,
  leftBlocId: any,
) {
  if (!state || !state.rel || !departingId || !leftBlocId) return;
  const bloc = blocByIdOrCustom(leftBlocId);
  const chair = bloc && (bloc.chair || bloc.founder);
  const members = countriesInBloc(leftBlocId, state.blocMember || {});
  for (const m of members) {
    if (m === departingId) continue;
    if (state.rel[m] == null) continue;
    const pts = m === chair ? -8 : -4;
    state.rel[m] = clamp(state.rel[m] + pts, 0, 100);
  }
}
function applyPoachLeave(state: any, countryId: any, destBlocId: any) {
  const oldBid = countryBlocId(countryId, state && state.blocMember);
  if (!oldBid || oldBid === destBlocId) return false;
  applyPoachDepartureHits(state, countryId, oldBid);
  const bagLaw =
    state.world && state.world[countryId] && state.world[countryId].law;
  const player =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  const law = bagLaw || (countryId === player ? state.law : null);
  const prev = getG();
  setG(state);
  try {
    leaveBloc(law || state.law, countryId);
  } finally {
    if (prev && prev !== state) setG(prev);
  }
  return true;
}
function blocInviteMemberApprovals(blocId: any, _candidateId: any) {
  const g = getG();
  const spec = defaultAccessionForBloc(blocId);
  const min = spec.memberRelationMin || 45;
  const player = playerCountryId();
  return blocMembers(blocId)
    .filter((m) => m !== player)
    .map((m) => {
      const rel = g.rel[m] != null ? g.rel[m] : 50;
      const p = partnerById(m);
      return {
        id: m,
        name: p ? p.name : m,
        rel,
        min,
        ok: rel >= min,
      };
    });
}
function blocInviteBlockers(blocId: any, candidateId: any) {
  const g = getG();
  const out = [];
  const player = playerCountryId();
  if (countryBlocId(player) !== blocId) out.push("not in a trade bloc");
  const home = countryBlocId(candidateId);
  if (home === blocId) out.push("already a member");
  if (g.blocInvites && g.blocInvites[candidateId]) out.push("invite pending");
  if (g.blocAccessionByCountry && g.blocAccessionByCountry[candidateId])
    out.push("accession in progress");
  if (candidateId === player && g.blocAccession)
    out.push("accession in progress");
  const candPol = g.politics && g.politics[candidateId];
  if (candPol && candPol.blocAccession) out.push("accession in progress");
  const rel = g.rel[candidateId] != null ? g.rel[candidateId] : 50;
  const relMin = home && home !== blocId ? poachRelMin(home) : 40;
  if (rel < relMin)
    out.push(
      "relations with candidate " + rel.toFixed(0) + " (need " + relMin + "+)",
    );
  for (const a of blocInviteMemberApprovals(blocId, candidateId)) {
    if (!a.ok)
      out.push(
        "relations with " +
          a.name +
          " " +
          a.rel.toFixed(0) +
          " (need " +
          a.min +
          "+)",
      );
  }
  return out;
}
function blocInviteIsStale(blocId: any, candidateId: any) {
  const blockers = blocInviteBlockers(blocId, candidateId);
  return blockers.some(
    (b) =>
      b === "already a member" ||
      b === "invite pending" ||
      b === "accession in progress",
  );
}
function ensureDraftBlocState() {
  const g = getG();
  if (!g || !g.draft) return;
  if (!g.draft.blocInvite || typeof g.draft.blocInvite !== "object")
    g.draft.blocInvite = {};
}
/** Drop staged invites that already went out or finished — they must not block Deliver. */ function pruneDraftBlocInvites() {
  const g = getG();
  ensureDraftBlocState();
  const playerBloc = countryBlocId(playerCountryId());
  if (!playerBloc) return;
  for (const cid of Object.keys(g.draft.blocInvite)) {
    if (blocInviteIsStale(playerBloc, cid)) delete g.draft.blocInvite[cid];
  }
}
/** Per-member relation gate for unanimous accession approval. */ function blocMemberApprovals(
  blocId: any,
) {
  const g = getG();
  const spec = blocAccessionSpec(blocId);
  const min = spec ? spec.memberRelationMin || 45 : 45;
  const player = playerCountryId();
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return [];
  return (bloc.members || [])
    .filter((m: any) => m !== player)
    .map((m: any) => {
      const rel = g.rel[m] != null ? g.rel[m] : 50;
      const p = partnerById(m);
      return {
        id: m,
        name: p ? p.name : m,
        rel,
        min,
        ok: rel >= min,
      };
    });
}
function needBlockers(need: any, law: any, ctx?: any) {
  const out = [];
  const n = need || {};
  const D = law || getG().draft || {};
  const partner = ctx && ctx.partner;
  (n.policyOff || []).forEach((p: any) => {
    if (D.policies[p])
      out.push(
        "incompatible with " + (POLICY_BY_ID as any)[p].name.toLowerCase(),
      );
  });
  (n.policyOn || []).forEach((p: any) => {
    if (!D.policies[p])
      out.push("requires " + (POLICY_BY_ID as any)[p].name.toLowerCase());
  });
  (n.taxOff || []).forEach((t: any) => {
    if (D.taxes[t] && D.taxes[t].on)
      out.push(
        "requires abolishing the " + (TAX_BY_ID as any)[t].name.toLowerCase(),
      );
  });
  if (n.tariffMax != null) {
    const t =
      partner != null ? effectiveTariff(partner, D) : tariffScheduleAverage(D);
    if (t > n.tariffMax)
      out.push("tariff must be " + n.tariffMax + "% or lower");
  }
  if (n.tariffMin != null) {
    const t =
      partner != null ? effectiveTariff(partner, D) : tariffScheduleAverage(D);
    if (t < n.tariffMin)
      out.push("tariff must be at least " + n.tariffMin + "%");
  }
  for (const k in n.deptMin || {})
    if (D.spend[k] < n.deptMin[k])
      out.push(k + " spending must be at least " + n.deptMin[k] + "%");
  return out;
}
/** Why a predefined-bloc accession step may be blocked. */ function blocJoinBlockers(
  blocId: any,
  phase: any,
) {
  const g = getG();
  const out = [];
  const ph = phase || "apply";
  const player = playerCountryId();
  if (countryBlocId(player)) out.push("leave your current bloc first");
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return ["unknown bloc"];
  const spec = blocAccessionSpec(blocId);
  const chairId = bloc.chair || bloc.founder;
  const acc = g.blocAccession;
  const autoAcc = g.blocAccessionByCountry && g.blocAccessionByCountry[player];
  if (acc && acc.blocId !== blocId)
    out.push("withdraw your current application first");
  if (autoAcc && autoAcc.blocId !== blocId)
    out.push("withdraw your current application first");
  if (ph === "apply" && autoAcc && autoAcc.blocId === blocId)
    out.push("accession already in progress");
  if (ph !== "apply") {
    if (
      (!acc || acc.blocId !== blocId) &&
      !(autoAcc && autoAcc.blocId === blocId)
    )
      out.push("application not filed");
    else if (
      ph === "align" &&
      ((acc && acc.step < 1) || (autoAcc && autoAcc.step < 1))
    )
      out.push("application not yet accepted");
    else if (
      ph === "accede" &&
      ((acc && acc.step < 2) || (autoAcc && autoAcc.step < 2))
    )
      out.push("alignment not complete");
  }
  if (ph === "apply" && spec && spec.chairRelationMin && chairId) {
    const rel = g.rel[chairId] != null ? g.rel[chairId] : 50;
    if (rel < spec.chairRelationMin) {
      const chair = partnerById(chairId);
      out.push(
        "Relations with " +
          (chair ? chair.name : chairId) +
          " " +
          rel.toFixed(0) +
          " (need " +
          spec.chairRelationMin +
          "+)",
      );
    }
  }
  if ((ph === "align" || ph === "accede") && spec && spec.need) {
    needBlockers(spec.need, g.draft).forEach((b) => out.push(b));
  }
  if (ph === "accede") {
    for (const a of blocMemberApprovals(blocId)) {
      if (!a.ok)
        out.push(
          "relations with " +
            a.name +
            " " +
            a.rel.toFixed(0) +
            " (need " +
            a.min +
            "+)",
        );
    }
    if (spec && spec.chairRelationMin && chairId) {
      const rel = g.rel[chairId] != null ? g.rel[chairId] : 50;
      if (rel < spec.chairRelationMin) {
        out.push(
          "chair relations " +
            rel.toFixed(0) +
            " (need " +
            spec.chairRelationMin +
            "+)",
        );
      }
    }
  }
  return out;
}
function clearBilateralDeals(law: any) {
  if (!law.deals) law.deals = {};
  for (const k of Object.keys(law.deals)) delete law.deals[k];
}
/** Trade-integration for the joiner and members now emerges from tariffs/access
 *  via world trade clearing — no exogenous growth pulse. */ function applyBlocJoinNationEffects(
  state: any,
  _countryId: any,
  _blocId: any,
) {
  if (!state) return;
  if (state.world) {
    try {
      refreshWorldTrade(state);
      syncNationsFromWorld(state);
    } catch {}
  }
}
/** When a partner joins the player's bloc, nudge phased access toward that market. */ function applyBlocJoinPlayerTrade(
  state: any,
  blocId: any,
  countryId: any,
) {
  const role = state.homeRole || "home";
  const player = state.homeRole === "home" ? "kingdom" : resolveHomeRole(role);
  if (countryBlocId(player, state.blocMember) !== blocId) return;
  if (countryId === player) return;
  const e = state.econ,
    law = state.law;
  if (!e || !law) return;
  const targets = partnerAccessTargets(law, role, state.blocMember);
  const target = (targets as any)[countryId] || 0;
  if (target <= 0) return;
  if (!e.partnerAccessEff) e.partnerAccessEff = {};
  const cur = e.partnerAccessEff[countryId] || 0;
  e.partnerAccessEff[countryId] = Math.max(cur, cur + (target - cur) * 0.45);
  refreshWorldY(e, role);
}
/** Single join path: membership, statute books, nation books, and player trade access. */ function finalizeBlocJoin(
  state: any,
  countryId: any,
  blocId: any,
  law: any,
) {
  if (!state || !countryId || !blocId) return false;
  if (countryBlocId(countryId, state.blocMember) === blocId) return false;
  state.blocMember[countryId] = blocId;
  const custom = state.customBlocs && state.customBlocs[blocId];
  if (custom && !custom.members.includes(countryId))
    custom.members.push(countryId);
  const bloc = blocById(blocId) || custom;
  const player =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  const bagLaw =
    state.world && state.world[countryId] && state.world[countryId].law;
  const L = bagLaw || (countryId === player ? law || state.law : null);
  if (L) {
    if (bloc && isCustomsUnion(bloc)) {
      const sched = ensureTariffSchedule(L);
      if (sched.cet == null)
        sched.cet = bloc.defaultCet != null ? bloc.defaultCet : sched.default;
      const role =
        countryId === player
          ? state.homeRole
          : state.world &&
            state.world[countryId] &&
            state.world[countryId].role;
      syncTariffHeadline(L, role || state.homeRole);
      clearBilateralDeals(L);
    }
  }
  if (countryId === player && state.law && L && state.law !== L) {
    if (bloc && isCustomsUnion(bloc)) {
      const sched = ensureTariffSchedule(state.law);
      if (sched.cet == null)
        sched.cet = bloc.defaultCet != null ? bloc.defaultCet : sched.default;
      syncTariffHeadline(state.law, state.homeRole);
      clearBilateralDeals(state.law);
    }
  }
  /* The draft is a separate copy from `law`/`L` and this join can land
   * mid-quarter (auto-accession finalizes inside step()), so without this
   * the draft's cet stays null against a now-non-null law.cet — billClauses()
   * then reads that mismatch as a phantom "propose a CET change" clause the
   * player never asked for. Only backfill an unset draft value; a value the
   * player is actively proposing must not be clobbered. */
  if (countryId === player && state.draft && bloc && isCustomsUnion(bloc)) {
    const dSched = ensureTariffSchedule(state.draft);
    if (dSched.cet == null)
      dSched.cet = bloc.defaultCet != null ? bloc.defaultCet : dSched.default;
  }
  applyBlocJoinNationEffects(state, countryId, blocId);
  applyBlocJoinPlayerTrade(state, blocId, countryId);
  return true;
}
function joinBloc(blocId: any, law: any) {
  const g = getG();
  const player = playerCountryId();
  if (!player || countryBlocId(player)) return false;
  return finalizeBlocJoin(g, player, blocId, law || g.law);
}
function isBlocFounder() {
  const g = getG();
  const player = playerCountryId();
  const bid = countryBlocId(player);
  if (!bid) return false;
  const custom = g && g.customBlocs && g.customBlocs[bid];
  return !!(custom && custom.founder === player);
}
function blocDealMemberApprovals(blocId: any, relationMin: any) {
  const g = getG();
  const min = relationMin || 42;
  const player = playerCountryId();
  return blocMembers(blocId)
    .filter((m) => m !== player)
    .map((m) => {
      const rel = g.rel[m] != null ? g.rel[m] : 50;
      const p = partnerById(m);
      return {
        id: m,
        name: p ? p.name : m,
        rel,
        min,
        ok: rel >= min,
      };
    });
}
function blocExternalDealBlockers(partnerId: any, dealId: any) {
  return unionCommercialDealBlockers(partnerId, dealId);
}
function draftBlocSnapshotFrom(draft: any) {
  const g = getG();
  const d = draft || g.draft || {};
  const bm = clone(g.blocMember);
  const custom = clone(g.customBlocs);
  const player = playerCountryId();
  if (d.blocLeave) delete bm[player];
  if (d.blocCreate && !bm[player]) {
    const tpl = (CUSTOM_BLOC_TEMPLATES as any)[d.blocCreate.template];
    if (tpl) {
      const tid = "__preview_bloc__";
      custom[tid] = {
        id: tid,
        name: d.blocCreate.name || tpl.name,
        founder: player,
        members: [player],
        template: d.blocCreate.template,
        type: tpl.type,
        defaultCet: tpl.defaultCet || null,
        accessBonus: tpl.accessBonus,
      };
      bm[player] = tid;
    }
  }
  return {
    blocMember: bm,
    customBlocs: custom,
  };
}
function applyDraftBlocLaw(law: any, snap: any, draft: any, seatId?: any) {
  const d = draft || getG().draft || {};
  const player = seatId || playerCountryId();
  const bid = snap.blocMember[player];
  ensureTariffSchedule(law);
  if (bid) {
    const bloc = blocById(bid) || snap.customBlocs[bid];
    if (bloc && isCustomsUnion(bloc)) {
      law.tariffSchedule.cet =
        bloc.defaultCet != null ? bloc.defaultCet : law.tariffSchedule.cet;
      syncTariffHeadline(law);
    }
  } else if (d.blocLeave) {
    law.tariffSchedule.cet = null;
    syncTariffHeadline(law);
  }
}
function dissolveCustomBlocIfEmpty(blocId: any) {
  const g = getG();
  if (!blocId || !g || !g.customBlocs || !g.customBlocs[blocId]) return false;
  if (blocMembers(blocId).length > 0) return false;
  delete g.customBlocs[blocId];
  if (g.blocInvites) {
    for (const cid of Object.keys(g.blocInvites)) {
      if (g.blocInvites[cid] && g.blocInvites[cid].blocId === blocId)
        delete g.blocInvites[cid];
    }
  }
  if (g.blocAccessionByCountry) {
    for (const cid of Object.keys(g.blocAccessionByCountry)) {
      if (
        g.blocAccessionByCountry[cid] &&
        g.blocAccessionByCountry[cid].blocId === blocId
      )
        delete g.blocAccessionByCountry[cid];
    }
  }
  if (g.blocAccession && g.blocAccession.blocId === blocId)
    g.blocAccession = null;
  for (const law of [g.law, g.draft]) {
    if (
      law &&
      law.tariffSchedule &&
      law.tariffSchedule.bloc &&
      law.tariffSchedule.bloc[blocId] != null
    ) {
      delete law.tariffSchedule.bloc[blocId];
    }
  }
  return true;
}
/**
 * Leave the player's current trade bloc. Optional `seatId` pins the departing
 * seat (multiplayer enact) so a wrong homeRole cannot drop a peer by mistake.
 */
function leaveBloc(law: any, seatId?: any) {
  const g = getG();
  const player = seatId || playerCountryId();
  const bid = countryBlocId(player);
  if (!bid) return false;
  const bloc = blocById(bid) || (g.customBlocs && g.customBlocs[bid]);
  const blocName = bloc ? bloc.name : bid;
  delete g.blocMember[player];
  const custom = g.customBlocs && g.customBlocs[bid];
  if (custom && Array.isArray(custom.members)) {
    custom.members = custom.members.filter((m: any) => m !== player);
    /* Founder succession — remaining members keep a chair for external deals. */
    if (custom.founder === player) {
      custom.founder = custom.members[0] || null;
    }
  }
  dissolveCustomBlocIfEmpty(bid);
  const L = law || g.law;
  const sched = ensureTariffSchedule(L);
  sched.cet = null;
  syncTariffHeadline(L);
  /* Drop any in-flight leave flag so a re-staged draft cannot no-op. */
  if (g.draft) g.draft.blocLeave = false;
  if (L && L !== g.draft) L.blocLeave = false;
  notifyBlocDeparture(g, player, bid, blocName);
  return true;
}

/** Fan out leave news to the departing seat and remaining human members. */
function notifyBlocDeparture(
  state: any,
  leftId: any,
  blocId: any,
  blocName: any,
) {
  if (!state || !leftId || !blocId) return;
  const q = state.q || 0;
  const label = blocName || blocId;
  const selfAlert = {
    kind: "bloc_self_left",
    partnerId: leftId,
    blocId,
    label,
    q,
    expiresQ: q + 3,
  };
  if (state.politics && state.politics[leftId]) {
    pushDiploAlert(state.politics[leftId], selfAlert);
  } else {
    pushDiploAlert(state, selfAlert);
  }
  if (!state.politics) return;
  for (const seatId of Object.keys(state.politics)) {
    if (seatId === leftId) continue;
    /* Remaining humans who were in this bloc (membership already updated). */
    if (countryBlocId(seatId, state.blocMember) !== blocId) continue;
    pushDiploAlert(state.politics[seatId], {
      kind: "bloc_member_left",
      partnerId: leftId,
      blocId,
      label,
      q,
      expiresQ: q + 3,
    });
  }
}
function createCustomBloc(name: any, templateId: any) {
  const g = getG();
  const tpl = (CUSTOM_BLOC_TEMPLATES as any)[templateId];
  if (!tpl) return null;
  if (!canCreateCustomBloc()) return null;
  const player = playerCountryId();
  const id = "custom_" + Date.now();
  g.customBlocs[id] = {
    id,
    name: name || tpl.name,
    founder: player,
    members: [player],
    template: templateId,
    type: tpl.type,
    defaultCet: tpl.defaultCet || null,
    accessBonus: tpl.accessBonus,
    createdQ: g.q,
    externalDeal: isCustomsUnion(tpl) ? customUnionAssociationDeal(id) : null,
  };
  finalizeBlocJoin(g, player, id, g.law);
  g._customBlocFoundedQ = g.q;
  return id;
}

/** True when the player may found a custom bloc (not a member, not ascending). */
function canCreateCustomBloc(state?: any) {
  const g = state || getG();
  if (!g) return false;
  const pid = playerCountryId(g.homeRole);
  if (!pid) return false;
  if (countryBlocId(pid, g.blocMember)) return false;
  if (g.blocAccession) return false;
  if (g.blocAccessionByCountry && g.blocAccessionByCountry[pid]) return false;
  return true;
}

/**
 * Abort an in-flight accession for `seatId` (shared pipeline + seat bag).
 * Used by solo Cancel joining and the MP withdrawBlocAccession diplo action.
 */
function withdrawBlocAccession(state: any, seatId?: any) {
  const g = state || getG();
  if (!g) return false;
  const pid = seatId || playerCountryId(g.homeRole);
  if (!pid) return false;
  let changed = false;
  if (g.blocAccessionByCountry && g.blocAccessionByCountry[pid]) {
    delete g.blocAccessionByCountry[pid];
    changed = true;
  }
  if (g.blocAccession) {
    g.blocAccession = null;
    changed = true;
  }
  if (g.draft) {
    g.draft.blocAccession = null;
    g.draft.blocCreate = null;
  }
  if (g.politics && g.politics[pid]) {
    if (g.politics[pid].blocAccession) {
      g.politics[pid].blocAccession = null;
      changed = true;
    }
  }
  return changed;
}
function processBlocInvites(g: any) {
  const state = g || (typeof getG() !== "undefined" ? getG() : null);
  if (!state || !state.blocInvites) return;
  const notes = [];
  const player =
    state.homeRole === "home" ? "kingdom" : resolveHomeRole(state.homeRole);
  for (const cid of Object.keys(state.blocInvites)) {
    const inv = state.blocInvites[cid];
    if (!inv) continue;
    /* Human invitees answer via inbound despatch — never auto-accept. */
    if (inv.awaitHuman) continue;
    const rel = state.rel[cid] != null ? state.rel[cid] : 50;
    const p = partnerById(cid);
    const bloc =
      blocById(inv.blocId) ||
      (state.customBlocs && state.customBlocs[inv.blocId]);
    const acceptMin = inviteAcceptMin(inv.blocId, cid);
    if (cid === player) continue;
    if (state.q >= inv.expiresQ) {
      if (
        state.blocMember[cid] !== inv.blocId &&
        !(state.blocAccessionByCountry && state.blocAccessionByCountry[cid])
      ) {
        const why =
          rel < acceptMin
            ? " — relations too cool (" +
              rel.toFixed(0) +
              ", need " +
              acceptMin +
              "+)"
            : "";
        notes.push(
          theCountry(p ? p.name : cid) +
            " declines the bloc invitation" +
            why +
            ".",
        );
      }
      delete state.blocInvites[cid];
      continue;
    }
    if (
      state.q >= (inv.sentQ != null ? inv.sentQ : inv.expiresQ - 4) + 1 &&
      state.blocMember[cid] !== inv.blocId &&
      !(state.blocAccessionByCountry && state.blocAccessionByCountry[cid])
    ) {
      if (rel >= acceptMin) {
        applyPoachLeave(state, cid, inv.blocId);
        if (!state.blocAccessionByCountry) state.blocAccessionByCountry = {};
        state.blocAccessionByCountry[cid] = {
          blocId: inv.blocId,
          step: 1,
          sinceQ: state.q,
          invitedBy: inv.fromId || player,
        };
        delete state.blocInvites[cid];
        notes.push(
          theCountry(p ? p.name : cid) +
            " begins accession to " +
            theCountry(bloc ? bloc.name : inv.blocId) +
            ".",
        );
        notifyBlocInviteAccept(
          state,
          cid,
          inv.blocId,
          bloc ? bloc.name : inv.blocId,
          inv.fromId || player,
        );
      }
    }
  }
  if (notes.length && state.brief)
    state.brief = notes.concat(state.brief).slice(0, 3);
}

/** Fan out AI/solo invite-accept news to human co-members and the inviter. */
function notifyBlocInviteAccept(
  state: any,
  acceptedId: any,
  blocId: any,
  blocName: any,
  invitedBy: any,
) {
  if (!state || !acceptedId || !blocId) return;
  const q = state.q || 0;
  const alert = {
    kind: "bloc_invite_accept",
    partnerId: acceptedId,
    blocId,
    label: blocName || blocId,
    q,
    expiresQ: q + 3,
  };
  const player =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  const notified = new Set([acceptedId]);
  const notifySeat = (seatId: any) => {
    if (!seatId || notified.has(seatId)) return;
    notified.add(seatId);
    if (state.politics && state.politics[seatId]) {
      pushDiploAlert(state.politics[seatId], alert);
    } else if (seatId === player) {
      pushDiploAlert(state, alert);
    }
  };
  if (state.politics) {
    for (const seatId of Object.keys(state.politics)) {
      if (countryBlocId(seatId, state.blocMember) === blocId)
        notifySeat(seatId);
    }
  }
  if (countryBlocId(player, state.blocMember) === blocId) notifySeat(player);
  if (invitedBy) notifySeat(invitedBy);
  const custom = state.customBlocs && state.customBlocs[blocId];
  if (custom && custom.founder) notifySeat(custom.founder);
}

function processBlocAccessions(g: any) {
  const state = g || (typeof getG() !== "undefined" ? getG() : null);
  if (!state || !state.blocAccessionByCountry) return;
  const notes = [];
  const maxQ = 8;
  const willingnessMin = 40;
  const player =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  for (const cid of Object.keys(state.blocAccessionByCountry)) {
    const acc = state.blocAccessionByCountry[cid];
    if (!acc) continue;
    const p = partnerById(cid);
    const rel = state.rel[cid] != null ? state.rel[cid] : 50;
    const bloc =
      blocById(acc.blocId) ||
      (state.customBlocs && state.customBlocs[acc.blocId]);
    if (state.blocMember[cid] === acc.blocId) {
      delete state.blocAccessionByCountry[cid];
      continue;
    }
    if (state.q - acc.sinceQ > maxQ || (!acc.self && rel < willingnessMin)) {
      delete state.blocAccessionByCountry[cid];
      if (acc.self || cid === player) state.blocAccession = null;
      if (state.politics && state.politics[cid])
        state.politics[cid].blocAccession = null;
      notes.push(
        theCountry(p ? p.name : cid) + " accession stalls and is withdrawn.",
      );
      continue;
    }
    /* One accession stage per quarter (policy alignment → treaty → join). */
    if (acc.step === 1 && state.q - acc.sinceQ >= 1) {
      if (acc.self) {
        if (cid !== player) continue;
        const alignBlock = playerAccessionGate(state, acc.blocId, "align");
        if (alignBlock) {
          notes.push("Accession alignment waiting — " + alignBlock + ".");
          continue;
        }
      }
      acc.step = 2;
      acc.sinceQ = state.q;
      if (acc.self) state.blocAccession = { blocId: acc.blocId, step: 2 };
    } else if (acc.step === 2 && state.q - acc.sinceQ >= 1) {
      if (acc.self) {
        /* Self-accession gates need the applicant's own law + relations.
         * In lockstep, only the applicant seat's step has those mounted. */
        if (cid !== player) continue;
        const joinBlock = playerAccessionGate(state, acc.blocId, "accede");
        if (joinBlock) {
          notes.push("Accession treaty waiting — " + joinBlock + ".");
          continue;
        }
      }
      const joinLaw =
        (state.world && state.world[cid] && state.world[cid].law) ||
        (cid === player ? state.law : null);
      const invitedBy = acc.invitedBy || null;
      finalizeBlocJoin(state, cid, acc.blocId, joinLaw);
      delete state.blocAccessionByCountry[cid];
      if (acc.self || cid === player) state.blocAccession = null;
      if (state.politics && state.politics[cid]) {
        state.politics[cid].blocAccession = null;
      }
      const blocLabel = bloc ? bloc.name : acc.blocId;
      /* Membership news is press-only (diplo alerts) — not morning-note lines. */
      notifyBlocMembership(state, cid, acc.blocId, blocLabel, invitedBy);
    }
  }
  if (notes.length && state.brief)
    state.brief = notes.concat(state.brief).slice(0, 3);
}

/** Fan out join news to the new member, human co-members, and the inviter. */
function notifyBlocMembership(
  state: any,
  joinedId: any,
  blocId: any,
  blocName: any,
  invitedBy: any,
) {
  if (!state || !joinedId || !blocId) return;
  const q = state.q || 0;
  const label = blocName || blocId;
  const player =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  const selfAlert = {
    kind: "bloc_self_joined",
    partnerId: joinedId,
    blocId,
    label,
    q,
    expiresQ: q + 3,
  };
  if (state.politics && state.politics[joinedId]) {
    pushDiploAlert(state.politics[joinedId], selfAlert);
  } else if (joinedId === player) {
    pushDiploAlert(state, selfAlert);
  }
  const memberAlert = {
    kind: "bloc_member_joined",
    partnerId: joinedId,
    blocId,
    label,
    q,
    expiresQ: q + 3,
  };
  const notified = new Set([joinedId]);
  const notifySeat = (seatId: any) => {
    if (!seatId || notified.has(seatId)) return;
    notified.add(seatId);
    if (state.politics && state.politics[seatId]) {
      pushDiploAlert(state.politics[seatId], memberAlert);
    } else if (seatId === player) {
      pushDiploAlert(state, memberAlert);
    }
  };
  /* Other humans already in the bloc. */
  if (state.politics) {
    for (const seatId of Object.keys(state.politics)) {
      if (countryBlocId(seatId, state.blocMember) === blocId)
        notifySeat(seatId);
    }
  }
  /* Solo player with no politics bag — still hear about a peer joining. */
  if (countryBlocId(player, state.blocMember) === blocId) notifySeat(player);
  /* Inviting country / custom founder — even if they somehow left the map. */
  if (invitedBy) notifySeat(invitedBy);
  const custom = state.customBlocs && state.customBlocs[blocId];
  if (custom && custom.founder) notifySeat(custom.founder);
  const named = blocById(blocId);
  if (named && named.chair) notifySeat(named.chair);
}

/** Policy / member gates for the player's own auto-accession (uses seat law + rel). */
function playerAccessionGate(state: any, blocId: any, phase: any) {
  const spec = blocAccessionSpec(blocId);
  const law = state.law || state.draft;
  if ((phase === "align" || phase === "accede") && spec && spec.need) {
    const blockers = needBlockers(spec.need, law);
    if (blockers.length) return blockers[0];
  }
  if (phase === "accede") {
    const bloc = blocByIdOrCustom(blocId);
    const min = spec ? spec.memberRelationMin || 45 : 45;
    const player =
      state.homeRole === "home"
        ? "kingdom"
        : resolveHomeRole(state.homeRole || "home");
    for (const m of (bloc && bloc.members) || []) {
      if (m === player) continue;
      const rel = state.rel[m] != null ? state.rel[m] : 50;
      if (rel < min) {
        const p = partnerById(m);
        return (
          "relations with " +
          theCountry(p ? p.name : m) +
          " " +
          rel.toFixed(0) +
          " (need " +
          min +
          "+)"
        );
      }
    }
    const chairId = bloc && (bloc.chair || bloc.founder);
    if (spec && spec.chairRelationMin && chairId) {
      const rel = state.rel[chairId] != null ? state.rel[chairId] : 50;
      if (rel < spec.chairRelationMin) {
        return (
          "chair relations " +
          rel.toFixed(0) +
          " (need " +
          spec.chairRelationMin +
          "+)"
        );
      }
    }
  }
  return null;
}
/** Start the player's automatic accession after a one-time application bill. */
function beginPlayerBlocAccession(state: any, blocId: any) {
  if (!state || !blocId) return;
  const pid =
    state.homeRole === "home"
      ? "kingdom"
      : resolveHomeRole(state.homeRole || "home");
  if (!state.blocAccessionByCountry) state.blocAccessionByCountry = {};
  /* sinceQ is next quarter: apply + step bump q in the same Deliver, so a
   * plain getG().q would advance alignment immediately on the application quarter. */
  state.blocAccessionByCountry[pid] = {
    blocId,
    step: 1,
    sinceQ: (state.q || 0) + 1,
    self: true,
  };
  state.blocAccession = { blocId, step: 1 };
}

function applyBlocAccessionDraft(state: any, ba: any) {
  if (!state || !ba || !ba.blocId) return;
  /* Only the application costs capital; later stages run automatically. */
  if (ba.phase === "apply" || !ba.phase) {
    beginPlayerBlocAccession(state, ba.blocId);
  }
}
function inviteToBloc(countryId: any, blocId: any) {
  const g = getG();
  if (countryBlocId(countryId) === blocId) return false;
  if (!g.blocInvites) g.blocInvites = {};
  const fromId = playerCountryId(g.homeRole);
  const awaitHuman = isHumanMpSeat(g, countryId);
  g.blocInvites[countryId] = {
    blocId,
    sentQ: g.q,
    expiresQ: g.q + 4,
    fromId,
    ...(awaitHuman ? { awaitHuman: true } : {}),
  };
  if (awaitHuman)
    parkInboundBlocInvite(g, fromId, countryId, g.blocInvites[countryId]);
  return true;
}
/** Pick an active partner. Optional score(p) → higher wins; filter(p) to exclude.
 *  Pass `scriptable: true` to skip human-occupied MP seats (agency events). */ function pickEventPartner(
  opts?: any,
) {
  const o = opts || {};
  const base = o.scriptable ? scriptablePartners() : activePartners();
  const pool = base.filter((p) => !o.filter || o.filter(p));
  if (!pool.length) return null;
  if (o.score) {
    let best = pool[0],
      bestS = o.score(best);
    for (let i = 1; i < pool.length; i++) {
      const s = o.score(pool[i]);
      if (s > bestS) {
        best = pool[i];
        bestS = s;
      }
    }
    return best;
  }
  return pool[getG().sandbox ? 0 : Math.floor(Math.random() * pool.length)];
}
function partnerById(id: any) {
  return PARTNERS.find((p) => p.id === id) || null;
}
function ensureDiploStocks(e: any) {
  ensureDiploStocksCore(e);
}
/** Headlines for nation table / gravity from a full econ bag. */ function headlinesFromEcon(
  econ: any,
) {
  if (!econ) return nationStateFromProfile(NATION_PROFILE.kingdom);
  return {
    y: econ.gdp != null ? econ.gdp : 100,
    growth:
      econ._lastGrowth != null
        ? econ._lastGrowth
        : econ.trendGrowth != null
          ? econ.trendGrowth
          : 1,
    debt: econ.debt != null ? econ.debt : 50,
    deficit: econ._lastDeficit != null ? econ._lastDeficit : 3,
    inflation: econ.inflation != null ? econ.inflation : 2,
    fx: econ.fx != null ? econ.fx : 1,
    fx0: econ.fx0 != null ? econ.fx0 : 1,
    riskPremium: econ.riskPremium != null ? econ.riskPremium : 0,
    rate: econ.rate,
    potential: econ.potential,
  };
}
function worldRoleForSeat(seatId: any) {
  return seatId === "kingdom" ? "home" : seatId;
}
/** Build G.world with settled econ+law for every non-player seat. */ function initWorldState(
  g: any,
) {
  if (!g) return;
  const playerId = playerCountryId(g.homeRole);
  g.world = {};
  for (const id of worldSeatIds()) {
    if (id === playerId) continue;
    const role = worldRoleForSeat(id);
    const snap = openingSnapshot(role);
    g.world[id] = {
      econ: snap.econ,
      law: clone(snap.law || lawForRole(role)),
      prevLaw: clone(snap.law || lawForRole(role)),
      id,
      role,
    };
    /* Align CU CET on AI statute books. */ applyDraftBlocLaw(
      g.world[id].law,
      {
        blocMember: g.blocMember,
        customBlocs: g.customBlocs || {},
      },
      g.world[id].law,
      id,
    );
  }
  mirrorPlayerToWorld(g);
  syncNationsFromWorld(g);
  refreshWorldTrade(g);
}
function mirrorPlayerToWorld(g: any) {
  if (!g || !g.econ) return;
  const playerId = playerCountryId(g.homeRole);
  if (!g.world) g.world = {};
  const prev = g.world[playerId];
  /* Preserve per-seat quarter series — lockstep and solo both push onto g.log,
     and MP hydrate reads bag.log for the top bar. Replacing the bag wholesale
     used to orphan the series and leave guests on the host's log. */
  g.world[playerId] = {
    econ: g.econ,
    law: g.law,
    prevLaw: g.prevLaw || g.law,
    id: playerId,
    role: g.homeRole || "home",
    isPlayer: true,
    log: Array.isArray(g.log) ? g.log : prev && prev.log,
  };
}
function syncNationsFromWorld(g: any, forceLive?: any) {
  if (!g || !g.econ) return;
  const e = g.econ;
  if (!e.nations) e.nations = {};
  const playerId = playerCountryId(g.homeRole);
  const atOpen = !(g.q > 0) && !forceLive;
  for (const id of worldSeatIds()) {
    if (id === playerId) {
      e.nations[id] = headlinesFromEcon(e);
      continue;
    }
    const bag = g.world && g.world[id];
    const prof = NATION_PROFILE[id];
    if (atOpen && prof) {
      const fxBag =
        bag && bag.econ
          ? headlinesFromEcon(bag.econ)
          : nationStateFromProfile(prof);
      e.nations[id] = {
        y: 100,
        growth: prof.trend,
        debt: prof.debt0,
        deficit: prof.deficit0,
        inflation: prof.inflation0 != null ? prof.inflation0 : 2.2,
        fx: fxBag.fx != null ? fxBag.fx : 1,
        fx0: fxBag.fx0 != null ? fxBag.fx0 : 1,
        riskPremium: fxBag.riskPremium != null ? fxBag.riskPremium : 0,
      };
      ensureNationFx(e.nations[id]);
      continue;
    }
    if (bag && bag.econ) e.nations[id] = headlinesFromEcon(bag.econ);
    else if (!e.nations[id] && prof)
      e.nations[id] = nationStateFromProfile(prof);
    ensureNationFx(e.nations[id]);
  }
}
/** Fiscal wedge in the user cost of capital. Convex above DEBT_UC_HI; floored
 *  relief below DEBT_UC_LO so creditor states do not print endless investment.
 *  Deep net-asset positions raise uc again — domestic capital is abundant and
 *  marginal projects are abroad. */ function debtFinanceWedge(debt: any) {
  const d = debt != null ? debt : 90;
  if (d > DEBT_UC_HI) return Math.pow(d - DEBT_UC_HI, 1.1) * DEBT_UC_HI_K;
  if (d < DEBT_UC_LO) {
    const room = (DEBT_UC_LO - d) / (DEBT_UC_LO + 80);
    const relief = -DEBT_UC_LO_MAX * Math.min(1, Math.max(0, room));
    if (d < 0) return relief + Math.pow(-d / 90, 1.15) * DEBT_UC_CREDITOR_K;
    return relief;
  }
  return 0;
}
/** Automatic fiscal rule for AI seats — keep debt inside a band around each
 *  seat's opening anchor. Tightens when debt (or the deficit) threatens to run
 *  away upward; eases when the seat is accumulating net assets or a fat surplus.
 *  High-debt openers (Japan) aim near their own norm, not a 60% Maastricht
 *  number that would force a depression. */ function applyAiFiscalRule(
  law: any,
  econ: any,
) {
  if (!law || !econ || !law.spend) return;
  const def = econ._lastDeficit;
  if (def == null || !Number.isFinite(def)) return;
  const debt = econ.debt != null ? econ.debt : 0;
  const anchor = econ.debtAnchor != null ? econ.debtAnchor : 80;
  const target = clamp(anchor, 50, 260);
  const bandLo = target - Math.min(22, 12 + target * 0.12);
  const bandHi = target + Math.min(30, 14 + target * 0.14);
  const aboveTarget = debt - target;
  const aboveBand = debt - bandHi;
  /* Deficit tolerance tightens as debt leaves the seat's norm: still allow a
     normal cyclical gap near the anchor, but do not wait until debt has already
     cleared bandHi before reacting. */ const defTrigger =
    aboveBand > 30
      ? 2.5
      : aboveBand > 0
        ? 3.5
        : aboveTarget > 8
          ? 4.5
          : aboveTarget > 0
            ? 5.5
            : 7.0;
  /* ---- High side: prevent debt accumulation ----
     Tighten on a fat deficit anywhere, or once debt is above target with a
     still-positive deficit. Gentle when only a little above target; firmer
     once past bandHi. Skip if already running a primary-ish surplus (debt will
     fall on its own). */ if (
    def > defTrigger ||
    (aboveTarget > 0 && def > 0.8) ||
    (aboveBand > 0 && def > -0.5)
  ) {
    const stress =
      aboveBand > 40
        ? 1.45
        : aboveBand > 0
          ? 1.25
          : aboveTarget > 20
            ? 1.15
            : 1;
    const cut =
      (aboveBand > 20 ? 0.055 : aboveTarget > 10 ? 0.045 : 0.035) * stress;
    for (const d of DEPTS) {
      if (law.spend[d.id] > d.min + 0.15)
        law.spend[d.id] = Math.max(d.min, law.spend[d.id] - cut);
    }
    if (
      law.taxes &&
      law.taxes.vat &&
      law.taxes.vat.on &&
      law.taxes.vat.rate < 25
    ) {
      law.taxes.vat.rate = Math.min(25, law.taxes.vat.rate + 0.14 * stress);
    }
    if (aboveBand > 0 && law.income) law.income.uprate = false;
    return;
  }
  /* ---- Low side: prevent creditor / surplus spirals ----
     Ease toward the target so AI seats do not accumulate −150% net assets.
     Do not ease on surplus alone when debt is already above target. */ if (
    debt < bandLo ||
    (def < -2.5 && debt < target)
  ) {
    const ease = debt < bandLo - 20 || def < -6 ? 1.6 : 1;
    for (const d of DEPTS) {
      if (
        d.id === "health" ||
        d.id === "education" ||
        d.id === "infra" ||
        d.id === "welfare"
      ) {
        if (law.spend[d.id] < d.max - 0.1)
          law.spend[d.id] = Math.min(d.max, law.spend[d.id] + 0.05 * ease);
      }
    }
    if (
      law.taxes &&
      law.taxes.vat &&
      law.taxes.vat.on &&
      law.taxes.vat.rate > 16
    ) {
      law.taxes.vat.rate = Math.max(16, law.taxes.vat.rate - 0.12 * ease);
    }
    if (law.income && law.income.uprate === false && debt < bandLo)
      law.income.uprate = true;
  }
}
/**
 * Run the full macro step for one seat (player or AI).
 * Politics/capital are no-ops for AI (`aiSeat`). World recursion is suppressed via skipWorld.
 */ function stepCountry(opts: any) {
  const o = opts || {};
  const role = o.role != null ? o.role : "home";
  const law = o.law;
  const prevLaw = o.prevLaw || law;
  const g = {
    econ: o.econ,
    homeRole: role,
    blocMember: o.blocMember || {},
    customBlocs: o.customBlocs || {},
    rel: o.rel || {},
    fac: o.fac || {
      business: 50,
      workers: 50,
      pensioners: 50,
      urban: 50,
      rural: 50,
      patriots: 50,
    },
    capital: o.capital != null ? o.capital : 50,
    mods: o.mods || [],
    rateManual: !!o.rateManual,
    manualRate: o.manualRate,
    sandbox: o.sandbox != null ? !!o.sandbox : true,
    q: o.q != null ? o.q : 0,
    term: 1,
    termStartQ: 0,
    log: o.log || [],
    brief: [],
    draft: law,
    law,
    prevLaw,
    blocInvites: o.blocInvites || {},
    blocAccessionByCountry: o.blocAccessionByCountry || {},
    blocAccession: o.blocAccession != null ? o.blocAccession : null,
    _settling: o.skipWorld !== false,
    _aiSeat: !!o.aiSeat,
    world: o.world || null,
    country: o.country || role,
    ruleBreaches: o.ruleBreaches != null ? o.ruleBreaches : 0,
    over: false,
    envoys: o.envoys != null ? o.envoys : emptyEnvoys(),
    ultimatums: o.ultimatums != null ? o.ultimatums : {},
    activeVisits: o.activeVisits != null ? o.activeVisits : {},
    missionEvents: o.missionEvents != null ? o.missionEvents : [],
    diploAlerts: o.diploAlerts != null ? o.diploAlerts : [],
    /* Full MP politics map so bloc/join alerts can fan out to every seat
         while this seat's ephemeral bag is mounted (not only the current player). */
    politics: o.politicsMap || null,
  };
  if (o.world && o.seedNations !== false) {
    const playerId = o.playerId;
    syncNationsIntoEcon(
      g.econ,
      o.world,
      o.countryId || playerCountryId(role),
      o.playerEcon,
      playerId,
    );
  }
  const r = step(g, law, prevLaw, o.det !== false);
  if (o.econ) {
    o.econ._lastGrowth = r.growth;
    o.econ._lastDeficit = r.deficit;
  }
  if (o.politics) {
    o.politics.capital = g.capital;
    if (o.politics.fac && g.fac !== o.politics.fac) {
      for (const k of Object.keys(g.fac || {})) o.politics.fac[k] = g.fac[k];
    }
    if (o.politics.rel && g.rel !== o.politics.rel) {
      for (const k of Object.keys(g.rel || {})) o.politics.rel[k] = g.rel[k];
    }
    syncDiploPoliticsFromGame(o.politics, g);
  }
  r.capital = g.capital;
  return r;
}
function syncNationsIntoEcon(
  e: any,
  world: any,
  selfId: any,
  playerEcon: any,
  playerId: any,
) {
  if (!e) return;
  if (!e.nations) e.nations = {};
  for (const id of worldSeatIds()) {
    if (id === selfId) {
      e.nations[id] = headlinesFromEcon(e);
      continue;
    }
    if (playerId && id === playerId && playerEcon) {
      e.nations[id] = headlinesFromEcon(playerEcon);
      continue;
    }
    const bag = world && world[id];
    if (bag && bag.econ) e.nations[id] = headlinesFromEcon(bag.econ);
    else if (!e.nations[id] && NATION_PROFILE[id])
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
    ensureNationFx(e.nations[id]);
  }
}
function pairTariff(exporterId: any, partnerId: any, g: any) {
  const bag = g.world && g.world[exporterId];
  const law = bag && bag.isPlayer ? g.law : bag && bag.law;
  const role = worldRoleForSeat(exporterId);
  if (!law) return BASE_TARIFF;
  return effectiveTariff(partnerId, law, role, g.blocMember);
}
function pairAccess(exporterId: any, partnerId: any, g: any) {
  const bag = g.world && g.world[exporterId];
  const econ = bag && bag.isPlayer ? g.econ : bag && bag.econ;
  if (!econ || !econ.partnerAccessEff) return 0;
  return econ.partnerAccessEff[partnerId] || 0;
}
function refreshWorldTrade(g: any) {
  if (!g || !g.world) return null;
  const playerId = playerCountryId(g.homeRole);
  mirrorPlayerToWorld(g);
  const seats = seatsFromWorld(
    g.world,
    playerId,
    g.econ,
    (i, j) => pairTariff(i, j, g),
    (i, j) => pairAccess(i, j, g),
  );
  const cleared = clearBilateralTrade(seats);
  g.worldTrade = cleared;
  if (g.econ) {
    g.econ.clearedFlows = cleared.flows[playerId] || null;
    g.econ.clearedTotals = cleared.totals[playerId] || null;
  }
  for (const id of Object.keys(g.world)) {
    if (!g.world[id] || !g.world[id].econ) continue;
    g.world[id].econ.clearedFlows = cleared.flows[id] || null;
    g.world[id].econ.clearedTotals = cleared.totals[id] || null;
  }
  return cleared;
}
/** One-quarter synthetic mods so AI seats feel the player's active global pulses. */ function globalModsForAiSeat(
  playerEcon: any,
  partnerId: any,
) {
  const mods: any[] = [];
  if (!playerEcon) return mods;
  const w = playerEcon.worldShock || 0;
  const wi = playerEcon.modWorldInfl || 0;
  const wr = playerEcon.modWorldRate || 0;
  const wt = playerEcon.modWorldTfp || 0;
  const bilat =
    (playerEcon.partnerShock && playerEcon.partnerShock[partnerId]) || 0;
  const beta =
    NATION_PROFILE[partnerId] && NATION_PROFILE[partnerId].beta != null
      ? NATION_PROFILE[partnerId].beta
      : 0.8;
  if (w) {
    mods.push({
      world: w,
      q: 1,
    });
    /* Synchronised demand drag (legacy worldPulse * beta intent). */ mods.push(
      {
        uncertainty: -w * 0.5 * beta,
        q: 1,
      },
    );
  }
  if (bilat) {
    mods.push({
      world: bilat,
      q: 1,
    });
    mods.push({
      uncertainty: -bilat * 0.5 * beta,
      q: 1,
    });
  }
  if (wi)
    mods.push({
      worldInfl: wi,
      q: 1,
    });
  if (wr)
    mods.push({
      worldRate: wr,
      q: 1,
    });
  if (wt) {
    mods.push({
      worldTfp: wt,
      q: 1,
    });
    mods.push({
      tfp: wt * WORLD_TFP_SPILL,
      q: 1,
    });
  }
  return mods;
}
/** Advance every non-player seat with the full country macro, then FX areas + trade clear. */ function stepWorldPartners(
  g: any,
  det: any,
) {
  if (!g || !g.world || g._settling || g._aiSeat) return;
  const playerId = playerCountryId(g.homeRole);
  mirrorPlayerToWorld(g);
  for (const id of Object.keys(g.world)) {
    if (id === playerId) continue;
    const seat = g.world[id];
    if (!seat || !seat.econ || !seat.law) continue;
    if (!g.disableAiFiscal) applyAiFiscalRule(seat.law, seat.econ);
    stepCountry({
      econ: seat.econ,
      law: seat.law,
      prevLaw: seat.prevLaw || seat.law,
      role: seat.role || worldRoleForSeat(id),
      countryId: id,
      playerId,
      playerEcon: g.econ,
      blocMember: g.blocMember,
      customBlocs: g.customBlocs,
      rel: g.rel,
      det: det !== false,
      world: g.world,
      skipWorld: true,
      aiSeat: true,
      q: g.q,
      mods: globalModsForAiSeat(g.econ, id),
    });
    seat.prevLaw = clone(seat.law);
  }
  const bags: Record<string, any> = {};
  for (const id of Object.keys(g.world)) (bags as any)[id] = g.world[id];
  stepCurrencyAreas(bags, worldSeatIds(), {
    playerId,
    playerEcon: g.econ,
  });
  refreshWorldTrade(g);
  /* Keep opening-quarter partner Y at profile pins so Q1 trade does not jump
     when world bags first advance; live headlines sync after g.q increments. */ if (
    g.q > 0
  )
    syncNationsFromWorld(g, true);
  else syncNationsFromWorld(g);
}

/**
 * Multiplayer lockstep: enact each human draft (capital-gated), AI-fiscal the
 * rest, step all seats once, clear trade/FX, advance q. Rolls per-seat events
 * into politics[id].pendingEvent for clients to resolve. Mutates `g` in place.
 */
function resolveLockstepQuarter(g: any, humanSeatIds: any, submissions: any) {
  if (!g || !g.world) throw new Error("resolveLockstepQuarter: missing world");
  const humans = (humanSeatIds || []).filter(Boolean);
  const humanSet = new Set(humans);
  const subs = submissions || {};
  if (!g.politics) g.politics = {};

  const prevG = getG();
  try {
    for (const id of humans) {
      const sub = subs[id];
      const draft = sub && sub.draft;
      if (!draft) continue;
      /* A bill can pass validation at submit time and still fail re-validation
       * here at resolve time — e.g. a bloc-invite target's relations drift
       * below the threshold from the other human's own turn resolving first
       * in this same quarter. enactHumanSeatOnSnapshot's early-return path
       * runs before it mutates anything for this seat, so it is safe to just
       * skip this seat's bill for the quarter (same as a solo player whose
       * blocked draft never reaches enact()) rather than aborting the whole
       * lockstep resolution — and everyone else's turn — over one seat's
       * now-stale clause. enactHumanSeatOnSnapshot's own `finally` always
       * restores the mount fields even on a throw, so it is also safe to
       * swallow an unexpected exception here the same way, instead of
       * letting one seat's bug take down the shared quarter for everyone. */
      try {
        const r = enactHumanSeatOnSnapshot(g, id, draft, {
          envoys: sub.envoys,
          ultimatums: sub.ultimatums,
          whipSpend: sub.whipSpend,
        });
        if (!r.ok) continue;
      } catch (err) {
        /* Unlike the graceful !r.ok path above (an expected, already-
         * described validation failure), a thrown exception here is
         * unexpected — still safe to skip so it can't take down every
         * other player's turn, but worth a server-side trace so a genuine
         * bug doesn't silently vanish as "my bill didn't apply". */
        console.error(
          `resolveLockstepQuarter: enactHumanSeatOnSnapshot threw for seat=${id}`,
          err,
        );
        continue;
      }
    }
    for (const id of worldSeatIds()) {
      if (humanSet.has(id)) continue;
      const seat = g.world[id];
      if (!seat || !seat.econ || !seat.law) continue;
      applyAiFiscalRule(seat.law, seat.econ);
    }

    const leadId = humans[0] || worldSeatIds()[0];
    /* stepCountry()/step() run against the local per-seat `g` object passed
     * below, but a few bloc helpers reachable from inside step() (e.g. a
     * pending invite's accession spec) take no state param and read the
     * module-level G directly. G was never mounted this far into resolve —
     * only the human-enact loop above and the "career flags" block below set
     * it — so any of those helpers null-deref on customBlocs the first time
     * a human seat carries a live blocInvites/blocAccessionByCountry entry
     * into its own step(). Mount the real snapshot for the whole seat loop;
     * it shares blocMember/customBlocs by reference with what's already
     * threaded through stepCountry's opts, so this doesn't change behavior
     * when G happened to be mounted already — it only fixes the case where
     * it wasn't. */
    setG(g);
    for (const id of worldSeatIds()) {
      const seat = g.world[id];
      if (!seat || !seat.econ || !seat.law) continue;
      const isHuman = humanSet.has(id);
      if (isHuman && !g.politics[id]) {
        g.politics[id] = defaultMpPolitics(
          id,
          seat.role || worldRoleForSeat(id),
        );
      }
      const pol = isHuman ? g.politics[id] : null;
      if (isHuman && !Array.isArray(seat.log)) {
        /* Lead seat inherits the opening settle series; other humans keep
                 whatever bag.log they already have (seeded at start) or []. */
        seat.log =
          id === leadId && g.log && g.log.length
            ? clone(g.log)
            : seat.log || [];
      }
      const seatLog = isHuman ? seat.log : [];
      if (isHuman) normalizeDiploPolitics(pol);
      let r;
      try {
        r = stepCountry({
          econ: seat.econ,
          law: seat.law,
          prevLaw: seat.prevLaw || seat.law,
          role: seat.role || worldRoleForSeat(id),
          countryId: id,
          playerId: leadId,
          playerEcon: g.world[leadId] && g.world[leadId].econ,
          blocMember: g.blocMember,
          customBlocs: g.customBlocs,
          blocInvites: g.blocInvites || (g.blocInvites = {}),
          blocAccessionByCountry:
            g.blocAccessionByCountry || (g.blocAccessionByCountry = {}),
          rel: pol ? pol.rel : g.rel,
          fac: pol ? pol.fac : undefined,
          capital: pol ? pol.capital : undefined,
          politics: pol,
          rateManual: pol ? !!pol.rateManual : false,
          manualRate:
            pol && pol.manualRate != null ? pol.manualRate : undefined,
          sandbox: pol ? !!pol.sandbox : true,
          log: seatLog,
          det: true,
          world: g.world,
          skipWorld: true,
          aiSeat: !isHuman,
          q: g.q,
          envoys: pol ? pol.envoys : undefined,
          ultimatums: pol ? pol.ultimatums : undefined,
          activeVisits: pol ? pol.activeVisits : undefined,
          missionEvents: pol ? pol.missionEvents : undefined,
          diploAlerts: pol ? pol.diploAlerts : undefined,
          politicsMap: g.politics,
          mods: isHuman
            ? pol.mods || []
            : globalModsForAiSeat(g.world[leadId] && g.world[leadId].econ, id),
        });
      } catch (err) {
        throw new Error(
          `[RLQ:stepCountry seat=${id}] ${err instanceof Error ? err.message : err}`,
        );
      }
      /* step() may replace the world bag via mirrorPlayerToWorld — re-fetch. */
      const seatNow = g.world[id] || seat;
      seatNow.prevLaw = clone(seatNow.law);
      if (isHuman) {
        seatNow.log = seatLog;
        if (id === leadId) g.log = seatLog;
        if (pol && r) {
          pol.lastRes = {
            growth: r.growth,
            pg: r.pg,
            deficit: r.deficit,
            E: clone(r.E),
            sp: clone(r.sp),
          };
          /* Career flags + lowRun without UI — client shows verdict on hydrate. */
          {
            const prev = getG();
            try {
              setG(g);
              mountMpSeatOnSnapshot(g, id);
              const e = getG().econ;
              const meta = polityOf(getG().homeRole);
              const metric = coupMetric(getG().fac, meta);
              getG().lowRun =
                metric < meta.coupFloor ? (getG().lowRun || 0) + 1 : 0;
              if (!getG().sandbox) {
                if (e.yield > 10 && e.debt > 118) getG().over = true;
                else if (e.inflation > 22) getG().over = true;
                else if (getG().lowRun >= meta.coupQuarters) getG().over = true;
              }
              syncMpPoliticsFromG(pol);
            } catch (err) {
              throw new Error(
                `[RLQ:career-flags seat=${id}] ${err instanceof Error ? err.message : err}`,
              );
            } finally {
              setG(prev);
            }
          }
          /* Roll events against this seat after its step; choice is async. */
          try {
            rollMpEventIntoPolitics(g, id, g.q);
          } catch (err) {
            throw new Error(
              `[RLQ:rollMpEventIntoPolitics seat=${id}] ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      }
    }

    const bags: Record<string, any> = {};
    for (const id of Object.keys(g.world)) (bags as any)[id] = g.world[id];
    stepCurrencyAreas(bags, worldSeatIds(), {
      playerId: leadId,
      playerEcon: g.world[leadId] && g.world[leadId].econ,
    });

    /* Mount lead on the snapshot for legacy top-level readers — but do NOT
         restore the pre-step econ/law. That left snap.econ frozen at opening
         (e.g. debt 94 forever) while world bags advanced, so any client that
         missed a per-seat remount showed identical host opening books. */
    g.homeRole = worldRoleForSeat(leadId);
    if (g.world[leadId]) {
      g.econ = g.world[leadId].econ;
      g.law = g.world[leadId].law;
      g.prevLaw = g.world[leadId].prevLaw || g.law;
      if (Array.isArray(g.world[leadId].log)) g.log = g.world[leadId].log;
    }
    setG(g);
    mirrorPlayerToWorld(g);
    refreshWorldTrade(g);
    g.q = (g.q || 0) + 1;
    if (g.q > 0 && g.q % termLenOf(g.homeRole) === 0)
      g.term = (g.term || 1) + 1;
    /* Inbound human ultimatums past their deadline count as defiance. */
    timeoutInboundUltimatums(g);
    /* Inbound bloc invites past their deadline count as decline. */
    timeoutInboundBlocInvites(g);
    /* Inbound deal proposals past their deadline count as decline. */
    timeoutInboundDealProposals(g);
    timeoutInboundSummitCommercial(g);
    /* Same-quarter envoy refunds must not leak into the next quarter. */
    for (const id of humans) {
      if (g.politics && g.politics[id]) g.politics[id].envoySpend = {};
    }
    if (g.envoySpend) g.envoySpend = {};
    g.envoysBaselineQ = null;
    syncNationsFromWorld(g, true);
    if (g.world) {
      for (const id of Object.keys(g.world)) {
        if (g.world[id]) g.world[id].isPlayer = false;
      }
      /* Re-assert human logs after mirror/trade (mirror preserves, belt-and-braces). */
      for (const id of humans) {
        const seat = g.world[id];
        if (seat && !Array.isArray(seat.log)) seat.log = [];
      }
    }
    /* Human capital regen runs inside step (aiSeat false). AI seats skip it. */
  } finally {
    setG(prevG);
  }
  return g;
}

/** Per-seat diplomacy activity — never share these across human seats. */
function normalizeDiploPolitics(pol: any) {
  if (!pol) return pol;
  if (!Array.isArray(pol.envoys) || pol.envoys.length !== ENVOY_SLOTS) {
    const prev = Array.isArray(pol.envoys)
      ? pol.envoys.filter((x: any) => x != null)
      : [];
    pol.envoys = emptyEnvoys();
    for (let i = 0; i < Math.min(ENVOY_SLOTS, prev.length); i++)
      pol.envoys[i] = prev[i];
  }
  if (!pol.ultimatums || typeof pol.ultimatums !== "object")
    pol.ultimatums = {};
  if (!pol.inboundUltimatums || typeof pol.inboundUltimatums !== "object")
    pol.inboundUltimatums = {};
  if (pol.inboundBlocInvite === undefined) pol.inboundBlocInvite = null;
  if (pol.inboundDealProposal === undefined) pol.inboundDealProposal = null;
  if (pol.inboundSummitCommercial === undefined)
    pol.inboundSummitCommercial = null;
  if (pol.inboundNotice === undefined) pol.inboundNotice = null;
  if (pol.outboundDealProposal === undefined) pol.outboundDealProposal = null;
  if (!pol.activeVisits || typeof pol.activeVisits !== "object")
    pol.activeVisits = {};
  if (!Array.isArray(pol.missionEvents)) pol.missionEvents = [];
  if (!Array.isArray(pol.diploAlerts)) pol.diploAlerts = [];
  if (!pol.envoySpend || typeof pol.envoySpend !== "object")
    pol.envoySpend = {};
  return pol;
}
function cloneDiploPolitics(src: any) {
  const s = src || {};
  return {
    envoys: clone(Array.isArray(s.envoys) ? s.envoys : emptyEnvoys()),
    ultimatums: clone(
      s.ultimatums && typeof s.ultimatums === "object" ? s.ultimatums : {},
    ),
    activeVisits: clone(
      s.activeVisits && typeof s.activeVisits === "object"
        ? s.activeVisits
        : {},
    ),
    missionEvents: clone(Array.isArray(s.missionEvents) ? s.missionEvents : []),
    diploAlerts: clone(Array.isArray(s.diploAlerts) ? s.diploAlerts : []),
    envoySpend: clone(
      s.envoySpend && typeof s.envoySpend === "object" ? s.envoySpend : {},
    ),
  };
}
function mountDiploOntoGame(g: any, pol: any) {
  if (!g || !pol) return;
  normalizeDiploPolitics(pol);
  g.envoys = pol.envoys;
  g.ultimatums = pol.ultimatums;
  g.activeVisits = pol.activeVisits;
  g.missionEvents = pol.missionEvents;
  g.diploAlerts = pol.diploAlerts;
  g.envoySpend = pol.envoySpend;
}
function syncDiploPoliticsFromGame(pol: any, g: any) {
  if (!pol || !g) return;
  const bag = cloneDiploPolitics(g);
  pol.envoys = bag.envoys;
  pol.ultimatums = bag.ultimatums;
  pol.activeVisits = bag.activeVisits;
  pol.missionEvents = bag.missionEvents;
  pol.diploAlerts = bag.diploAlerts;
  pol.envoySpend = bag.envoySpend;
}
/**
 * True when the client is re-posting an ultimatum the server already resolved
 * (peer conceded/defied, or the window already closed). Without this, a stale
 * Deliver after mid-quarter resolve re-parks inbound and the next lockstep
 * auto-defies — the target sees "We defied" after they already conceded.
 */
function isStaleMpUltimatumResubmit(
  pid: any,
  prevU: any,
  nextU: any,
  econ: any,
  q: any,
) {
  if (!nextU || nextU.status !== "pending") return false;
  if (prevU && prevU.status === "pending") return false;
  const cd = (econ && econ.ultimatumCd && econ.ultimatumCd[pid]) || 0;
  if (cd > 0) return true;
  if (nextU.expiresQ != null && (q || 0) >= nextU.expiresQ) return true;
  return false;
}

/**
 * Capital cost of newly posted envoys / newly issued ultimatums vs the seat's
 * last committed politics. Recalls are free.
 */
function diploActivityCapitalCost(
  pol: any,
  nextEnvoys: any,
  nextUltimatums: any,
  opts: any,
) {
  let cost = 0;
  const prevEnv = normalizeDiploPolitics(pol || {}).envoys || emptyEnvoys();
  const rawEnv = Array.isArray(nextEnvoys) ? nextEnvoys : prevEnv;
  const nextEnv = emptyEnvoys();
  const seen = new Set();
  let slot = 0;
  for (const pid of rawEnv) {
    if (!pid) continue;
    if (seen.has(pid)) {
      return { ok: false, error: "Duplicate envoy posting", cost: 0 };
    }
    if (slot >= ENVOY_SLOTS) {
      return { ok: false, error: "All envoy slots are filled", cost: 0 };
    }
    seen.add(pid);
    nextEnv[slot++] = pid;
  }
  for (const pid of nextEnv) {
    if (pid && !prevEnv.includes(pid)) cost += ENVOY_ASSIGN_PC;
  }
  const prevUlt = (pol && pol.ultimatums) || {};
  const o = opts || {};
  const nextUlt =
    nextUltimatums && typeof nextUltimatums === "object"
      ? clone(nextUltimatums)
      : clone(prevUlt);
  if (o.econ) ensureDiploStocks(o.econ);
  for (const pid of Object.keys(nextUlt)) {
    const nu = nextUlt[pid];
    if (!nu || nu.status !== "pending") continue;
    const pu = prevUlt[pid];
    if (isStaleMpUltimatumResubmit(pid, pu, nu, o.econ, o.q)) {
      delete nextUlt[pid];
      continue;
    }
    if (!pu || pu.status !== "pending" || pu.demand !== nu.demand) {
      cost += ULTIMATUM_PC;
    }
  }
  return { ok: true, cost, envoys: nextEnv, ultimatums: nextUlt };
}
/** Seed opening capital/fac/rel for each human seat on a room snapshot. */
function defaultMpPolitics(seatId: any, role: any, name?: any) {
  return normalizeDiploPolitics({
    capital: 42,
    fac: openingFac(role),
    parties: seedParties(openingFac(role), lawForRole(role), role),
    rel: openingRel(role),
    country: (name || role || seatId).toString().slice(0, 34),
    rateManual: false,
    manualRate: OPENING.rate,
    sandbox: false,
    mods: [],
    lastEventQ: -3,
    lastEventId: null,
    setPiece8: false,
    setPiece16: false,
    nextMajorQ: scheduleNextMajorQ(0, true),
    episode: null,
    pendingEvent: null,
    polityShift: null,
    lowRun: 0,
    over: false,
    envoys: emptyEnvoys(),
    ultimatums: {},
    inboundUltimatums: {},
    inboundBlocInvite: null,
    inboundDealProposal: null,
    inboundSummitCommercial: null,
    inboundNotice: null,
    outboundDealProposal: null,
    blocAccession: null,
    activeVisits: {},
    missionEvents: [],
    diploAlerts: [],
  });
}
function syncMpPoliticsFromG(pol: any) {
  const g = getG();
  if (!pol || !g) return;
  pol.capital = g.capital;
  pol.fac = g.fac;
  pol.parties = g.parties ? clone(g.parties) : pol.parties;
  pol.rel = g.rel;
  pol.mods = g.mods || [];
  pol.sandbox = !!g.sandbox;
  pol.rateManual = !!g.rateManual;
  pol.manualRate = g.manualRate;
  pol.lastEventQ = g.lastEventQ;
  pol.lastEventId = g.lastEventId;
  pol.setPiece8 = !!g.setPiece8;
  pol.setPiece16 = !!g.setPiece16;
  pol.nextMajorQ = g.nextMajorQ;
  pol.episode = g.episode ? clone(g.episode) : null;
  pol.polityShift = g.polityShift ? clone(g.polityShift) : null;
  pol.lowRun = g.lowRun || 0;
  pol.over = !!g.over;
  pol.blocAccession = g.blocAccession ? clone(g.blocAccession) : null;
  if (pol.country == null && g.country) pol.country = g.country;
  syncDiploPoliticsFromGame(pol, g);
}
function mountMpSeatOnSnapshot(g: any, seatId: any) {
  const seat = g.world[seatId];
  if (!seat) return null;
  if (!g.politics) g.politics = {};
  if (!g.politics[seatId]) {
    g.politics[seatId] = defaultMpPolitics(
      seatId,
      seat.role || worldRoleForSeat(seatId),
    );
  }
  const pol = normalizeDiploPolitics(g.politics[seatId]);
  g.homeRole = seat.role || worldRoleForSeat(seatId);
  g.econ = seat.econ;
  g.law = seat.law;
  g.prevLaw = seat.prevLaw || seat.law;
  g.draft = seat.law;
  g.fac = pol.fac;
  if (!pol.parties) {
    pol.parties = seedParties(
      pol.fac || openingFac(g.homeRole),
      g.law,
      g.homeRole,
    );
  }
  g.parties = clone(pol.parties);
  g.rel = pol.rel;
  g.capital = pol.capital != null ? pol.capital : 42;
  g.mods = Array.isArray(pol.mods) ? pol.mods : [];
  g.sandbox = !!pol.sandbox;
  g.rateManual = !!pol.rateManual;
  g.manualRate = pol.manualRate != null ? pol.manualRate : OPENING.rate;
  g.lastEventQ = pol.lastEventQ != null ? pol.lastEventQ : -3;
  g.lastEventId = pol.lastEventId || null;
  g.setPiece8 = !!pol.setPiece8;
  g.setPiece16 = !!pol.setPiece16;
  g.nextMajorQ = pol.nextMajorQ;
  g.episode = pol.episode || null;
  g.polityShift = pol.polityShift || null;
  g.lowRun = pol.lowRun || 0;
  g.over = !!pol.over;
  g.country = pol.country || seatId;
  /* Per-seat accession — do not keep another human's shared snap.blocAccession. */
  g.blocAccession = pol.blocAccession ? clone(pol.blocAccession) : null;
  /* Top-bar chips read G.log — always mount this seat's series, never the
     snapshot lead's log left on g.log after lockstep resolve. */
  g.log = Array.isArray(seat.log) ? seat.log : [];
  mountDiploOntoGame(g, pol);
  return pol;
}

/**
 * Live multiplayer diplo: assign/recall envoy or issue ultimatum onto a seat's
 * politics + world bag econ. Mutates that seat's politics (and seat.econ) in
 * place; restores top-level mount fields so the snapshot draft is untouched.
 */
function applyMpDiploAction(g: any, seatId: any, action: any, opts: any) {
  const o = opts || {};
  if (!g || !g.world || !g.world[seatId]) {
    return { ok: false, error: "Unknown seat" };
  }
  if (!g.politics || !g.politics[seatId]) {
    return { ok: false, error: "Missing seat politics" };
  }
  const prev = getG();
  const saved = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
    mods: g.mods,
    sandbox: g.sandbox,
    rateManual: g.rateManual,
    manualRate: g.manualRate,
  };
  try {
    setG(g);
    const pol = mountMpSeatOnSnapshot(g, seatId);
    if (!pol) return { ok: false, error: "Unknown seat" };
    g.q = g.q != null ? g.q : 0;
    let ok = false;
    let error = null;
    if (action === "assignEnvoy") {
      ok = assignEnvoy(o.partnerId);
      if (!ok) {
        if ((getG().capital || 0) < ENVOY_ASSIGN_PC)
          error = "Need " + ENVOY_ASSIGN_PC + " capital";
        else if (getG().envoys && getG().envoys.indexOf(null) < 0)
          error = "All envoy slots are filled";
        else error = "Could not assign envoy";
      }
    } else if (action === "recallEnvoy") {
      ok = recallEnvoy(o.partnerId);
      if (!ok) error = "Could not recall envoy";
    } else if (action === "issueUltimatum") {
      ok = issueUltimatum(o.partnerId, o.demandId || null);
      if (!ok) {
        const check = canIssueUltimatum(o.partnerId);
        error =
          check.reasons && check.reasons.length
            ? check.reasons.join("; ")
            : check.cooldown > 0
              ? "cooldown " + check.cooldown + "Q"
              : "Could not issue ultimatum";
      }
    } else if (action === "withdrawUltimatum") {
      ok = withdrawUltimatum(o.partnerId);
      if (!ok) error = "Cannot withdraw after Deliver";
    } else if (action === "withdrawBlocAccession") {
      ok = withdrawBlocAccession(g, seatId);
      if (!ok) error = "No accession to cancel";
    } else {
      return { ok: false, error: "Unknown action" };
    }
    if (!ok) return { ok: false, error: error || "Action failed" };
    syncMpPoliticsFromG(pol);
    /* Seat bag econ is the live ref from mount — ledger/fac already written. */
    return {
      ok: true,
      capital: pol.capital,
      fac: clone(pol.fac),
      envoys: clone(pol.envoys),
      ultimatums: clone(pol.ultimatums),
      rel: clone(pol.rel),
      blocAccession: null,
      blocAccessionCleared: action === "withdrawBlocAccession",
    };
  } finally {
    g.homeRole = saved.homeRole;
    g.econ = saved.econ;
    g.law = saved.law;
    g.draft = saved.draft;
    g.prevLaw = saved.prevLaw;
    g.capital = saved.capital;
    g.fac = saved.fac;
    g.rel = saved.rel;
    g.country = saved.country;
    g.envoys = saved.envoys;
    g.ultimatums = saved.ultimatums;
    g.activeVisits = saved.activeVisits;
    g.missionEvents = saved.missionEvents;
    g.diploAlerts = saved.diploAlerts;
    g.mods = saved.mods;
    g.sandbox = saved.sandbox;
    g.rateManual = saved.rateManual;
    g.manualRate = saved.manualRate;
    setG(prev);
  }
}

/** Patch live G from a successful MP diplo response without wiping the draft. */
function applyMpDiploPatch(patch: any) {
  const g = getG();
  if (!g || !patch) return;
  if (patch.capital != null) g.capital = patch.capital;
  if (patch.envoys) g.envoys = clone(patch.envoys);
  if (patch.ultimatums) g.ultimatums = clone(patch.ultimatums);
  if (patch.fac) g.fac = clone(patch.fac);
  if (patch.rel) g.rel = clone(patch.rel);
  if (patch.blocAccessionCleared) {
    const seatId = playerCountryId(g.homeRole);
    withdrawBlocAccession(g, seatId);
  }
  const seatId = playerCountryId(g.homeRole);
  if (g.politics && g.politics[seatId]) {
    const pol = g.politics[seatId];
    if (patch.capital != null) pol.capital = patch.capital;
    if (patch.envoys) pol.envoys = clone(patch.envoys);
    if (patch.ultimatums) pol.ultimatums = clone(patch.ultimatums);
    if (patch.fac) pol.fac = clone(patch.fac);
    if (patch.rel) pol.rel = clone(patch.rel);
  }
}

/** Capture diplo UI fields so an optimistic MP click can roll back on API failure. */
function snapshotMpDiploUi(g: any) {
  const state = g || getG();
  if (!state) return null;
  const seatId = playerCountryId(state.homeRole);
  return {
    capital: state.capital,
    envoys: clone(state.envoys || emptyEnvoys()),
    ultimatums: clone(state.ultimatums || {}),
    envoySpend: clone(state.envoySpend || {}),
    fac: state.fac ? clone(state.fac) : null,
    rel: state.rel ? clone(state.rel) : null,
    diploLedger:
      state.econ && state.econ.diploLedger
        ? clone(state.econ.diploLedger)
        : null,
    waiting: !!(state.mp && state.mp.waiting),
    lockedSubmission:
      state.mp && state.mp.lockedSubmission
        ? clone(state.mp.lockedSubmission)
        : null,
    blocAccession: state.blocAccession ? clone(state.blocAccession) : null,
    accessionEntry:
      seatId &&
      state.blocAccessionByCountry &&
      state.blocAccessionByCountry[seatId]
        ? clone(state.blocAccessionByCountry[seatId])
        : null,
    draftBlocAccession:
      state.draft && state.draft.blocAccession
        ? clone(state.draft.blocAccession)
        : null,
    draftBlocCreate:
      state.draft && state.draft.blocCreate
        ? clone(state.draft.blocCreate)
        : null,
    seatId,
  };
}

function restoreMpDiploUi(snap: any, g?: any) {
  const state = g || getG();
  if (!state || !snap) return;
  state.capital = snap.capital;
  state.envoys = clone(snap.envoys);
  state.ultimatums = clone(snap.ultimatums);
  state.envoySpend = clone(snap.envoySpend || {});
  if (snap.fac) state.fac = clone(snap.fac);
  if (snap.rel) state.rel = clone(snap.rel);
  if (state.econ && snap.diploLedger) {
    state.econ.diploLedger = clone(snap.diploLedger);
  }
  if (state.mp) {
    state.mp.waiting = !!snap.waiting;
    state.mp.lockedSubmission = snap.lockedSubmission
      ? clone(snap.lockedSubmission)
      : null;
  }
  state.blocAccession = snap.blocAccession ? clone(snap.blocAccession) : null;
  if (state.draft) {
    state.draft.blocAccession = snap.draftBlocAccession
      ? clone(snap.draftBlocAccession)
      : null;
    state.draft.blocCreate = snap.draftBlocCreate
      ? clone(snap.draftBlocCreate)
      : null;
  }
  const seatId = snap.seatId || playerCountryId(state.homeRole);
  if (seatId) {
    if (!state.blocAccessionByCountry) state.blocAccessionByCountry = {};
    if (snap.accessionEntry) {
      state.blocAccessionByCountry[seatId] = clone(snap.accessionEntry);
    } else if (state.blocAccessionByCountry[seatId]) {
      delete state.blocAccessionByCountry[seatId];
    }
  }
  if (state.politics && state.politics[seatId]) {
    const pol = state.politics[seatId];
    pol.capital = state.capital;
    pol.fac = state.fac;
    pol.rel = state.rel;
    pol.blocAccession = state.blocAccession ? clone(state.blocAccession) : null;
    syncDiploPoliticsFromGame(pol, state);
  }
}

/**
 * Apply assign/recall/ultimatum on the live client immediately (optimistic MP).
 * Returns { ok, error } — same validation as the solo helpers.
 */
function applyLocalMpDiploAction(action: any, opts: any) {
  const g = getG();
  const o = opts || {};
  if (!g) return { ok: false, error: "No game" };
  let ok = false;
  let error = null;
  if (action === "assignEnvoy") {
    ok = assignEnvoy(o.partnerId);
    if (!ok) {
      if ((g.capital || 0) < ENVOY_ASSIGN_PC)
        error = "Need " + ENVOY_ASSIGN_PC + " capital";
      else if (g.envoys && g.envoys.indexOf(null) < 0)
        error = "All envoy slots are filled";
      else error = "Could not assign envoy";
    }
  } else if (action === "recallEnvoy") {
    ok = recallEnvoy(o.partnerId);
    if (!ok) error = "Could not recall envoy";
  } else if (action === "issueUltimatum") {
    ok = issueUltimatum(o.partnerId, o.demandId || null);
    if (!ok) {
      const check = canIssueUltimatum(o.partnerId);
      error =
        check.reasons && check.reasons.length
          ? check.reasons.join("; ")
          : check.cooldown > 0
            ? "cooldown " + check.cooldown + "Q"
            : "Could not issue ultimatum";
    }
  } else if (action === "withdrawUltimatum") {
    ok = withdrawUltimatum(o.partnerId);
    if (!ok) error = "Cannot withdraw after Deliver";
  } else if (action === "withdrawBlocAccession") {
    ok = withdrawBlocAccession(g);
    if (!ok) error = "No accession to cancel";
  } else {
    return { ok: false, error: "Unknown action" };
  }
  if (!ok) return { ok: false, error: error || "Action failed" };
  const seatId = playerCountryId(g.homeRole);
  if (g.politics && g.politics[seatId]) {
    const pol = g.politics[seatId];
    pol.capital = g.capital;
    pol.fac = g.fac;
    pol.rel = g.rel;
    syncDiploPoliticsFromGame(pol, g);
  }
  return { ok: true };
}

/** Pin the envoy roster at the start of each quarter so Orders can undo mid-quarter posts. */
function syncEnvoysBaseline(g: any) {
  const state = g || getG();
  if (!state) return;
  if (!state.envoys) state.envoys = emptyEnvoys();
  if (!state.envoySpend) state.envoySpend = {};
  if (state.envoysBaselineQ !== state.q) {
    state.envoysBaseline = clone(state.envoys);
    state.envoysBaselineQ = state.q;
  }
}

function clearQuarterEnvoySpend(g: any) {
  const state = g || getG();
  if (!state) return;
  state.envoySpend = {};
  /* Next billClauses() will re-pin baseline to the post-Deliver roster. */
  state.envoysBaselineQ = null;
  const seatId =
    state.homeRole != null ? playerCountryId(state.homeRole) : null;
  if (seatId && state.politics && state.politics[seatId]) {
    state.politics[seatId].envoySpend = {};
  }
}

/** Snapshot of what was sent on Deliver — used to auto-withdraw on later edits. */
function lockMpSubmission(g: any) {
  const state = g || getG();
  if (!state || !state.mp) return;
  state.mp.lockedSubmission = {
    draft: clone(state.draft),
    envoys: clone(state.envoys || [null, null]),
    ultimatums: clone(state.ultimatums || {}),
    rateManual: !!state.rateManual,
    manualRate: state.manualRate,
    sandbox: !!state.sandbox,
  };
}

function clearMpLockedSubmission(g: any) {
  const state = g || getG();
  if (state && state.mp) state.mp.lockedSubmission = null;
}

function mpSubmissionFingerprint(parts: any) {
  return JSON.stringify({
    draft: parts.draft,
    envoys: parts.envoys || [null, null],
    ultimatums: parts.ultimatums || {},
    rateManual: !!parts.rateManual,
    manualRate: parts.manualRate,
    sandbox: !!parts.sandbox,
  });
}

function mpSubmissionDiverged(g: any) {
  const state = g || getG();
  if (!state || !state.mp || !state.mp.waiting || !state.mp.lockedSubmission)
    return false;
  const locked = state.mp.lockedSubmission;
  const live = {
    draft: state.draft,
    envoys: state.envoys || [null, null],
    ultimatums: state.ultimatums || {},
    rateManual: !!state.rateManual,
    manualRate: state.manualRate,
    sandbox: !!state.sandbox,
  };
  return mpSubmissionFingerprint(live) !== mpSubmissionFingerprint(locked);
}

/**
 * If the player edits their bill while waiting on peers, withdraw Deliver so
 * the room never resolves against a stale submission.
 */
function maybeAutoUnsubmitMp() {
  const g = getG();
  if (!g || !g.mp || g.mp.bootstrapping || !g.mp.waiting) return;
  if (!mpSubmissionDiverged(g)) return;
  if (typeof g.mp.onAutoUnsubmit === "function") g.mp.onAutoUnsubmit();
}
/** After a seat steps in lockstep, roll an ordinary/major event into pendingEvent. */
function promoteMpMissionEvent(pol: any) {
  if (!pol || pol.pendingEvent) return false;
  if (!Array.isArray(pol.missionEvents) || !pol.missionEvents.length)
    return false;
  const item = pol.missionEvents.shift();
  if (!item) return false;
  pol.pendingEvent = {
    missionEvent: true,
    partnerId: item.partnerId,
    missionId: item.missionId || "summit",
    eventIndex: item.eventIndex != null ? item.eventIndex : 0,
    q: item.q,
  };
  return true;
}
function rollMpEventIntoPolitics(g: any, seatId: any, q: any) {
  const prev = getG();
  try {
    setG(g);
    const pol = mountMpSeatOnSnapshot(g, seatId);
    if (!pol || pol.pendingEvent || pol.over) return;
    g.q = q;
    /* Summit visits queue before ordinary rolls — same order as solo Deliver. */
    queueSummitVisitEvents(g);
    syncDiploPoliticsFromGame(pol, g);
    /* Clones break the shared ref — remount so promote/sync do not restore
         the pre-promote missionEvents queue (which double-fired summit events). */
    mountDiploOntoGame(g, pol);
    if (promoteMpMissionEvent(pol)) {
      syncMpPoliticsFromG(pol);
      return;
    }
    if (g.episode && g.q >= g.episode.endsQ) {
      pol.pendingEvent = {
        episodeEnd: true,
      };
      syncMpPoliticsFromG(pol);
      return;
    }
    const major = rollMajorEvent();
    if (major) {
      g.lastEventQ = g.q;
      g.lastEventId = major.id;
      pol.pendingEvent = {
        id: major.id,
        isMajor: true,
      };
      syncMpPoliticsFromG(pol);
      return;
    }
    const ev = rollEvent();
    if (ev) {
      g.lastEventQ = g.q;
      g.lastEventId = ev.id;
      pol.pendingEvent = {
        id: ev.id,
        isMajor: false,
      };
      syncMpPoliticsFromG(pol);
    } else {
      syncMpPoliticsFromG(pol);
    }
  } finally {
    setG(prev);
  }
}
/**
 * Apply a pending MP event option (or episode end) for one seat on the room snapshot.
 */
function applyMpEventChoice(
  g: any,
  seatId: any,
  optionIndex: any,
  extra?: any,
) {
  if (!g || !g.world || !g.world[seatId]) {
    return {
      ok: false,
      error: "Unknown seat",
    };
  }
  const pol = g.politics && g.politics[seatId];
  if (!pol || !pol.pendingEvent) {
    return {
      ok: false,
      error: "No pending event",
    };
  }
  const prev = getG();
  try {
    setG(g);
    mountMpSeatOnSnapshot(g, seatId);
    g.q = g.q || 0;
    const pending = pol.pendingEvent;
    if (pending.episodeEnd) {
      endEpisode();
      pol.pendingEvent = null;
      syncMpPoliticsFromG(pol);
      return {
        ok: true,
      };
    }
    if (pending.missionEvent) {
      const ev = rollMissionEvent(
        pending.missionId || "summit",
        pending.partnerId,
        g,
        diploDeps(),
        true,
        pending.eventIndex != null ? pending.eventIndex : 0,
      );
      if (!ev || !ev.opts || !ev.opts.length) {
        pol.pendingEvent = null;
        promoteMpMissionEvent(pol);
        syncMpPoliticsFromG(pol);
        return {
          ok: false,
          error: "Mission event unavailable",
        };
      }
      const ctx = {
        partnerId: pending.partnerId,
        rivalId: ev.rivalId,
        missionId: pending.missionId || "summit",
      };
      if (extra && (extra.commercialTariff || extra.commercialPackage)) {
        if (ev.id !== "summit_commercial_agenda") {
          return {
            ok: false,
            error: "Not a commercial agenda",
          };
        }
        applySummitCommercialOption(
          {
            summitKind: "package",
            ourDelta: extra.ourDelta,
            theirDelta: extra.theirDelta,
            dealIds: extra.dealIds || [],
          },
          ctx,
        );
      } else {
        const idx = optionIndex | 0;
        if (idx < 0 || idx >= ev.opts.length) {
          return {
            ok: false,
            error: "Invalid option",
          };
        }
        if (ev.id === "summit_commercial_agenda") {
          applySummitCommercialOption(ev.opts[idx], ctx);
        } else {
          applyMissionEventOption(ev.opts[idx], ctx);
        }
      }
      pol.pendingEvent = null;
      promoteMpMissionEvent(pol);
      syncMpPoliticsFromG(pol);
      return {
        ok: true,
      };
    }
    const base = EVENTS.find((e) => e.id === pending.id);
    if (!base) {
      pol.pendingEvent = null;
      return {
        ok: false,
        error: "Unknown event",
      };
    }
    const ev = prepareEvent(base);
    if (!ev || !ev.opts || !ev.opts.length) {
      pol.pendingEvent = null;
      syncMpPoliticsFromG(pol);
      return {
        ok: false,
        error: "Event unavailable",
      };
    }
    const idx = optionIndex | 0;
    if (idx < 0 || idx >= ev.opts.length) {
      return {
        ok: false,
        error: "Invalid option",
      };
    }
    const opt = ev.opts[idx];
    applyEventOption(opt);
    if (pending.isMajor) beginEpisode(ev, opt);
    pol.pendingEvent = null;
    syncMpPoliticsFromG(pol);
    return {
      ok: true,
    };
  } finally {
    setG(prev);
  }
}
function seedMpPolitics(snap: any, humans: any) {
  if (!snap) return snap;
  if (!snap.politics) snap.politics = {};
  for (const h of humans || []) {
    const seatId = h.seatId || seatIdForRoleSafe(h.role);
    const role = h.role || worldRoleForSeat(seatId);
    if (!snap.politics[seatId]) {
      snap.politics[seatId] = defaultMpPolitics(seatId, role, h.name);
    } else {
      const pol = snap.politics[seatId];
      if (pol.sandbox == null) pol.sandbox = false;
      if (pol.rateManual == null) pol.rateManual = false;
      if (!Array.isArray(pol.mods)) pol.mods = [];
      if (pol.lastEventQ == null) pol.lastEventQ = -3;
      if (pol.nextMajorQ == null) pol.nextMajorQ = scheduleNextMajorQ(0, true);
      if (!pol.parties || !pol.parties.seats || !pol.parties.rulingId) {
        pol.parties = seedParties(
          pol.fac || openingFac(role),
          lawForRole(role),
          role,
        );
      }
      normalizeDiploPolitics(pol);
    }
    /* Each human needs their own quarter log for the top bar. The host's
         export only stamps the lead bag; guests start empty so chips fall back
         to live econ until their first resolve entry. */
    if (
      snap.world &&
      snap.world[seatId] &&
      !Array.isArray(snap.world[seatId].log)
    ) {
      const leadId =
        humans[0] && (humans[0].seatId || seatIdForRoleSafe(humans[0].role));
      snap.world[seatId].log =
        seatId === leadId && Array.isArray(snap.log) ? clone(snap.log) : [];
    }
  }
  return snap;
}

function seatIdForRoleSafe(role: any) {
  return !role || role === "home" ? "kingdom" : role;
}

/**
 * Bill capital cost between law and draft without mutating live G permanently.
 * Uses a temporary G shell so billClauses/pruneDraftBlocInvites can run.
 */
function computeBillCost(law: any, draft: any, ctx: any): any {
  const o = ctx || {};
  const prev = getG();
  const draftCopy = clone(draft);
  try {
    setG({
      law: law,
      draft: draftCopy,
      homeRole: o.homeRole || "home",
      blocMember: o.blocMember || {},
      customBlocs: o.customBlocs || {},
      blocInvites: o.blocInvites || {},
      blocAccession: o.blocAccession || null,
      blocAccessionByCountry: o.blocAccessionByCountry || {},
      econ: o.econ || null,
      fac: o.fac || null,
      rel: o.rel || {},
      capital: o.capital != null ? o.capital : 42,
      /* The seat's own chamber, so the vote below is scored against its real
         seat layout rather than one freshly seeded from factions. */
      parties: o.parties ? clone(o.parties) : null,
      whipSpend: o.whipSpend != null ? o.whipSpend : 0,
    });
    /* Drop a Found clause that cannot enact — avoids charging capital for a no-op. */
    if (draftCopy.blocCreate && !canCreateCustomBloc()) {
      draftCopy.blocCreate = null;
    }
    const gateErr = mpDraftBlocGateError();
    if (gateErr) {
      return { ok: false, cost: 0, error: gateErr, clauses: [] };
    }
    const cl = billClauses();
    const vote = billVoteData();
    return {
      ok: true,
      cost: billCost(cl),
      whipSpend: legislativeClauses(cl).length ? whipSpendOf() : 0,
      vote,
      passage: vote ? pressPassageFromVote(vote) : pressPassageFromClauses(cl),
      clauses: cl.map((c) => ({
        label: c.label,
        pc: c.sunk ? 0 : c.pc,
        sunk: !!c.sunk,
        executive: !!c.executive,
      })),
      draft: draftCopy,
    };
  } catch (err) {
    return {
      ok: false,
      cost: 9999,
      error: (err && (err as any).message) || "Bill costing failed",
      clauses: [],
    };
  } finally {
    setG(prev);
  }
}

/** Solo/MP shared: reject draft bloc actions that would no-op or break gates. */
function mpDraftBlocGateError() {
  const g = getG();
  if (!g || !g.draft) return null;
  if (
    g.draft.blocAccession &&
    blocJoinBlockers(g.draft.blocAccession.blocId, "apply").length
  ) {
    return (
      "Cannot apply to join — " +
      blocJoinBlockers(g.draft.blocAccession.blocId, "apply")[0]
    );
  }
  for (const cid in g.draft.blocInvite || {}) {
    if (!g.draft.blocInvite[cid]) continue;
    const playerBloc = countryBlocId(playerCountryId());
    if (!playerBloc) return "Cannot invite — not in a trade bloc";
    const blockers = blocInviteBlockers(playerBloc, cid);
    if (blockers.length) return "Cannot invite — " + blockers[0];
  }
  {
    const tLock = tariffLocked(g.draft);
    ensureTariffSchedule(g.draft);
    ensureTariffSchedule(g.law);
    if (
      tLock.mode === "cet" &&
      g.draft.tariffSchedule.cet !== g.law.tariffSchedule.cet
    ) {
      const blockers = tariffCetBlockers(tLock.blocId);
      if (blockers.length)
        return "Cannot change the common external tariff — " + blockers[0];
    }
  }
  return null;
}

/** Validate a multiplayer submission against seat politics + current law. */
function validateMpSubmission(
  snap: any,
  seatId: any,
  draft: any,
  opts: any,
): any {
  if (!snap || !snap.world || !snap.world[seatId]) {
    return {
      ok: false,
      error: "Unknown seat",
    };
  }
  if (!snap.politics || !snap.politics[seatId]) {
    return {
      ok: false,
      error: "Missing seat politics",
    };
  }
  const seat = snap.world[seatId];
  const pol = normalizeDiploPolitics(snap.politics[seatId]);
  const role = seat.role || worldRoleForSeat(seatId);
  const o = opts || {};
  const priced = computeBillCost(seat.law, draft, {
    homeRole: role,
    blocMember: snap.blocMember,
    customBlocs: snap.customBlocs,
    blocInvites: snap.blocInvites,
    blocAccession: pol.blocAccession || snap.blocAccession || null,
    blocAccessionByCountry: snap.blocAccessionByCountry || {},
    econ: seat.econ,
    fac: pol.fac,
    rel: pol.rel,
    capital: pol.capital,
    parties: pol.parties,
    whipSpend: o.whipSpend,
  });
  if (!priced.ok) return priced;
  /* Persist stripped Found so enact does not reintroduce a dead clause. */
  if (priced.draft && draft && draft.blocCreate && !priced.draft.blocCreate) {
    draft.blocCreate = null;
  }
  /* Reject human-targeted deals if the partner already has another pending offer. */
  {
    const prevDeals = (seat.law && seat.law.deals) || {};
    const nextDeals = (draft && draft.deals) || {};
    for (const dealId of Object.keys(nextDeals)) {
      if (!nextDeals[dealId] || prevDeals[dealId]) continue;
      const d = (DEAL_BY_ID as any)[dealId];
      if (!d || !d.partner || !isHumanMpSeat(snap, d.partner)) continue;
      const tPol = snap.politics[d.partner];
      const inbound = tPol && tPol.inboundDealProposal;
      if (
        inbound &&
        inbound.status === "pending" &&
        inbound.fromId &&
        inbound.fromId !== seatId
      ) {
        return {
          ok: false,
          error: "Partner already has a pending treaty proposal",
        };
      }
    }
  }
  const diplo = diploActivityCapitalCost(pol, o.envoys, o.ultimatums, {
    econ: seat.econ,
    q: snap.q,
  });
  if (!diplo.ok) return diplo;
  const billCost = priced.cost;
  const diploCost = diplo.cost;
  const whipCost = priced.whipSpend || 0;
  const total = billCost + diploCost + whipCost;
  if (total > pol.capital) {
    return {
      ok: false,
      error:
        "Not enough political capital (" +
        total +
        " needed, " +
        Math.round(pol.capital) +
        " available)",
      cost: billCost,
      diploCost,
      capital: pol.capital,
    };
  }
  /* Capital first, then the chamber — the same order solo enact() gates in.
     The client disables Deliver on a lost vote, but the seat's parties are
     server-side state, so the majority is checked here too. */
  if (
    priced.vote &&
    priced.vote.needed &&
    !priced.vote.advisory &&
    !priced.vote.pass
  ) {
    return {
      ok: false,
      error:
        "The chamber voted the Programme down (" +
        priced.vote.aye +
        "–" +
        priced.vote.nay +
        ")",
      cost: billCost,
      diploCost,
      capital: pol.capital,
    };
  }
  return {
    ok: true,
    cost: billCost,
    diploCost,
    whipCost,
    totalCost: total,
    clauses: priced.clauses,
    passage: priced.passage,
    vote: priced.vote,
    envoys: diplo.envoys,
    ultimatums: diplo.ultimatums,
  };
}

/**
 * Apply newly submitted ultimatums (ledger + faction) that were not already pending.
 */
function applyNewMpUltimatums(
  g: any,
  prevUltimatums: any,
  nextUltimatums: any,
) {
  const prev = prevUltimatums || {};
  const next = nextUltimatums || {};
  ensureDiploStocks(g.econ);
  const fromId = playerCountryId(g.homeRole);
  for (const pid of Object.keys(next)) {
    const nu = next[pid];
    if (!nu || nu.status !== "pending") continue;
    const pu = prev[pid];
    if (pu && pu.status === "pending" && pu.demand === nu.demand) continue;
    if (isStaleMpUltimatumResubmit(pid, pu, nu, g.econ, g.q)) {
      delete next[pid];
      continue;
    }
    if (isHumanMpSeat(g, pid)) {
      nu.awaitHuman = true;
      if (nu.expiresQ == null) nu.expiresQ = (g.q || 0) + ULTIMATUM_WAIT;
      if (nu.sentQ == null) nu.sentQ = g.q || 0;
      parkInboundUltimatum(g, fromId, pid, nu);
    }
    addDiploLedger(g, pid, {
      id: "ultimatum_issued_" + (g.q || 0),
      label: "Issued an ultimatum",
      pts: -8,
    });
    if (g.fac) {
      g.fac.patriots = clamp((g.fac.patriots || 50) + 3, 2, 96);
      g.fac.business = clamp((g.fac.business || 50) - 2, 2, 96);
    }
  }
}

/**
 * Apply one human draft onto a room snapshot seat (capital, missions, CET).
 * Shared blocMember on `g` is mutated for leave/join like solo enact.
 */
function enactHumanSeatOnSnapshot(
  g: any,
  seatId: any,
  draft: any,
  opts: any,
): any {
  const seat = g.world[seatId];
  if (!seat)
    return {
      ok: false,
      error: "Unknown seat",
    };
  if (!g.politics) g.politics = {};
  if (!g.politics[seatId]) {
    g.politics[seatId] = defaultMpPolitics(
      seatId,
      seat.role || worldRoleForSeat(seatId),
    );
  }
  const pol = normalizeDiploPolitics(g.politics[seatId]);
  const role = seat.role || worldRoleForSeat(seatId);
  const o = opts || {};
  const check = validateMpSubmission(g, seatId, draft, o);
  if (!check.ok) return check;

  const draftCopy = clone(draft);
  const prevUlt = clone(pol.ultimatums || {});
  const prev = getG();
  const saved = {
    homeRole: g.homeRole,
    econ: g.econ,
    law: g.law,
    draft: g.draft,
    prevLaw: g.prevLaw,
    capital: g.capital,
    fac: g.fac,
    parties: g.parties,
    rel: g.rel,
    country: g.country,
    envoys: g.envoys,
    ultimatums: g.ultimatums,
    activeVisits: g.activeVisits,
    missionEvents: g.missionEvents,
    diploAlerts: g.diploAlerts,
  };
  try {
    setG(g);
    g.homeRole = role;
    g.econ = seat.econ;
    g.law = seat.law;
    g.draft = draftCopy;
    g.prevLaw = seat.prevLaw || seat.law;
    g.capital = pol.capital;
    g.fac = pol.fac;
    /* This seat's chamber, not whichever seat was mounted last — anything
       reachable from here that reads parties must see the right ones. */
    g.parties = pol.parties;
    g.rel = pol.rel;
    g.country = pol.country;
    mountDiploOntoGame(g, pol);

    /* Commit submitted envoy / ultimatum activity before missions (visit gate). */
    if (check.envoys) {
      pol.envoys = check.envoys;
      g.envoys = pol.envoys;
    }
    if (check.ultimatums) {
      applyNewMpUltimatums(g, prevUlt, check.ultimatums);
      pol.ultimatums = check.ultimatums;
      g.ultimatums = pol.ultimatums;
    }

    if (g.draft.blocLeave) leaveBloc(g.draft, seatId);
    if (g.draft.blocAccession) {
      applyBlocAccessionDraft(g, g.draft.blocAccession);
    }
    if (g.draft.blocCreate) {
      if (!canCreateCustomBloc()) {
        g.draft.blocCreate = null;
      } else if (
        !createCustomBloc(g.draft.blocCreate.name, g.draft.blocCreate.template)
      ) {
        g.draft.blocCreate = null;
      }
    }
    for (const cid in g.draft.blocInvite || {}) {
      const playerBloc = countryBlocId(playerCountryId());
      if (playerBloc && !blocInviteBlockers(playerBloc, cid).length) {
        inviteToBloc(cid, playerBloc);
      }
    }

    /* New deals targeting another human seat need their consent — strip from
         draft so they do not enact; park inbound proposal on the target. */
    if (!g.draft.deals) g.draft.deals = {};
    const prevDeals = (seat.law && seat.law.deals) || {};
    for (const dealId of Object.keys(g.draft.deals)) {
      if (!g.draft.deals[dealId]) continue;
      if (prevDeals[dealId]) continue;
      const d = (DEAL_BY_ID as any)[dealId];
      if (!d || !d.partner) continue;
      if (!isHumanMpSeat(g, d.partner)) continue;
      if (!parkInboundDealProposal(g, seatId, d.partner, dealId)) {
        return {
          ok: false,
          error: "Partner already has a pending treaty proposal",
        };
      }
      delete g.draft.deals[dealId];
    }

    /* totalCost = bill + diplo delta vs politics. Live diplo commits already
         charged capital / ledger, so identical pending envoys/ultimatums cost 0. */
    const spend = check.totalCost != null ? check.totalCost : check.cost;
    pol.capital = clamp(pol.capital - spend, 0, 100);
    g.capital = pol.capital;
    syncServiceHolds(g.draft, seat.econ);
    seat.prevLaw = clone(seat.law);
    seat.law = clone(g.draft);
    /* Notify off what applyDraftMissions actually applied, not what was
       staged: sanctions dropped for a live state visit must not fan a
       hostile notice at a seat nothing happened to. */
    const appliedMissions = applyDraftMissions(
      seat.law,
      g.draft,
      seat.econ,
      pol.fac,
    );
    const lock = lockedTariff(seat.law);
    if (lock != null) {
      ensureTariffSchedule(seat.law);
      seat.law.tariffSchedule.cet = lock;
      syncTariffHeadline(seat.law);
    }
    /* After the bloc CET clamp, so a locked schedule is never reported as a
       hike the seat never actually made. */
    notifyHumanPeerActions(g, seatId, seat.prevLaw, seat.law, appliedMissions);
    if (seat.law.missions) seat.law.missions = {};
    seat.law.blocAccession = null;
    seat.law.blocLeave = false;
    seat.law.blocCreate = null;
    seat.law.blocInvite = {};
    {
      const clauses = check.clauses || [];
      pol.lastBill = clauses.length
        ? {
            clauses,
            passage: check.passage || pressPassageFromClauses(clauses),
            cost: check.cost || 0,
            balDelta:
              balanceOf(g.draft, g.econ).balance -
              balanceOf(g.law, g.econ).balance,
            q: g.q != null ? g.q : 0,
          }
        : null;
    }
    syncDiploPoliticsFromGame(pol, g);
    return {
      ok: true,
      cost: check.cost,
      diploCost: check.diploCost || 0,
      totalCost: spend,
    };
  } finally {
    g.homeRole = saved.homeRole;
    g.econ = saved.econ;
    g.law = saved.law;
    g.draft = saved.draft;
    g.prevLaw = saved.prevLaw;
    g.capital = saved.capital;
    g.fac = saved.fac;
    g.parties = saved.parties;
    g.rel = saved.rel;
    g.country = saved.country;
    g.envoys = saved.envoys;
    g.ultimatums = saved.ultimatums;
    g.activeVisits = saved.activeVisits;
    g.missionEvents = saved.missionEvents;
    g.diploAlerts = saved.diploAlerts;
    setG(prev);
  }
}

/** Deep snapshot of live G. `opts.mode === "solo"` additionally keeps the
 *  in-progress press inbox and open drawer, for a single-player localStorage
 *  save (see lib/sp/save.ts) — MP rooms never want mid-clip / mid-drawer
 *  state carried into a fellow player's mount. */
function exportGameSnapshot(g: any, opts?: any) {
  const o = opts || {};
  const solo = o.mode === "solo";
  const src = g || getG();
  if (!src) return null;
  mirrorPlayerToWorld(src);
  /* Keep the mounted player's quarter series on their world bag for MP hydrate. */
  const playerId = playerCountryId(src.homeRole);
  if (src.world && src.world[playerId] && src.log) {
    src.world[playerId].log = src.log;
  }
  const snap: Record<string, any> = {};
  for (const k of MUTABLE) {
    if (src[k] === undefined) continue;
    (snap as any)[k] = clone(src[k]);
  }
  snap.q = src.q;
  snap.term = src.term;
  snap.log = clone(src.log || []);
  snap.press = solo ? clone(src.press || []) : [];
  if (solo) snap.tab = tab;
  snap.lastEventQ = src.lastEventQ;
  snap.lastEventId = src.lastEventId;
  snap.ruleBreaches = src.ruleBreaches;
  if (src.politics) snap.politics = clone(src.politics);
  else if (!snap.politics) snap.politics = {};
  /* Keep local player's politics in sync when exporting from a live client. */
  if (src.capital != null || src.fac) {
    const sid = playerCountryId(src.homeRole);
    const prevPol = src.politics && src.politics[sid];
    const diplo = cloneDiploPolitics(src);
    snap.politics[sid] = normalizeDiploPolitics({
      capital: src.capital != null ? src.capital : 42,
      fac: clone(src.fac || openingFac(src.homeRole || "home")),
      /* The seat's chamber travels with it — dropping it here re-seeded seats
         from factions on every export, losing drift and election results. */
      parties: clone(
        src.parties ||
          (prevPol && prevPol.parties) ||
          seedParties(
            src.fac || openingFac(src.homeRole || "home"),
            src.law || lawForRole(src.homeRole || "home"),
            src.homeRole || "home",
          ),
      ),
      rel: clone(src.rel || openingRel(src.homeRole || "home")),
      country: src.country || sid,
      rateManual: !!src.rateManual,
      manualRate: src.manualRate != null ? src.manualRate : OPENING.rate,
      sandbox: !!src.sandbox,
      mods: clone(src.mods || []),
      lastEventQ: src.lastEventQ != null ? src.lastEventQ : -3,
      lastEventId: src.lastEventId || null,
      setPiece8: !!src.setPiece8,
      setPiece16: !!src.setPiece16,
      nextMajorQ: src.nextMajorQ,
      episode: src.episode ? clone(src.episode) : null,
      pendingEvent:
        prevPol && prevPol.pendingEvent ? clone(prevPol.pendingEvent) : null,
      inboundUltimatums:
        prevPol && prevPol.inboundUltimatums
          ? clone(prevPol.inboundUltimatums)
          : {},
      inboundBlocInvite:
        prevPol && prevPol.inboundBlocInvite
          ? clone(prevPol.inboundBlocInvite)
          : null,
      inboundDealProposal:
        prevPol && prevPol.inboundDealProposal
          ? clone(prevPol.inboundDealProposal)
          : null,
      inboundSummitCommercial:
        prevPol && prevPol.inboundSummitCommercial
          ? clone(prevPol.inboundSummitCommercial)
          : null,
      inboundNotice:
        prevPol && prevPol.inboundNotice ? clone(prevPol.inboundNotice) : null,
      outboundDealProposal:
        prevPol && prevPol.outboundDealProposal
          ? clone(prevPol.outboundDealProposal)
          : null,
      blocAccession:
        prevPol && prevPol.blocAccession
          ? clone(prevPol.blocAccession)
          : src.blocAccession
            ? clone(src.blocAccession)
            : null,
      polityShift: src.polityShift ? clone(src.polityShift) : null,
      lowRun: src.lowRun || 0,
      over: !!src.over,
      envoys: diplo.envoys,
      ultimatums: diplo.ultimatums,
      activeVisits: diplo.activeVisits,
      missionEvents: diplo.missionEvents,
      diploAlerts: diplo.diploAlerts,
    });
    if (snap.world && snap.world[sid] && src.log) {
      snap.world[sid].log = clone(src.log);
    }
  }
  /* Top-level diplo activity is seat-mounted only — clear shared leftovers so
     guests never inherit the host's envoys/visits from snap.envoys. */
  if (snap.politics && Object.keys(snap.politics).length) {
    snap.envoys = emptyEnvoys();
    snap.ultimatums = {};
    snap.activeVisits = {};
    snap.missionEvents = [];
    snap.diploAlerts = [];
  }
  /* Detach player aliases into plain bags. */
  if (snap.world) {
    for (const id of Object.keys(snap.world)) {
      const seat = snap.world[id];
      if (!seat) continue;
      seat.isPlayer = false;
      seat.id = id;
      seat.role = seat.role || worldRoleForSeat(id);
    }
  }
  return snap;
}

/**
 * Load a room snapshot into live G and mount `homeRole` as the local player.
 * Skips the morning-note despatch. `opts.mode === "solo"` restores the
 * mid-bill draft, press inbox and open drawer instead of resetting them —
 * a lockstep MP remount deliberately drops those (see exportGameSnapshot).
 */
function hydrateGameSnapshot(snap: any, opts: any) {
  const o = opts || {};
  const solo = o.mode === "solo";
  if (!snap) throw new Error("hydrateGameSnapshot: missing snapshot");
  const homeRole = resolveHomeRole(o.homeRole || snap.homeRole || "home");
  const seatId = o.seatId || playerCountryId(homeRole);
  /* Keep locally-noted outcome alerts across remount — server never stores noted. */
  const prevSeatPol = getG() && getG().politics && getG().politics[seatId];
  const prevNotedAlerts =
    prevSeatPol && prevSeatPol.diploAlerts
      ? prevSeatPol.diploAlerts
      : (getG() && getG().diploAlerts) || [];
  /* Press is client display state (export always sends []). Keep the inbox
   * across lockstep remounts so Fiscal Gazette clips survive the quarter. */
  const prevPress =
    getG() && Array.isArray(getG().press) ? getG().press.slice() : [];
  setG(clone(snap));
  getG().homeRole = homeRole;
  getG().homeIso = o.homeIso || getG().homeIso || "826";
  getG().homeScale = o.homeScale != null ? o.homeScale : getG().homeScale;
  if (!getG().politics) getG().politics = {};
  const pol = getG().politics[seatId];
  if (typeof o.country === "string" && o.country.trim()) {
    getG().country = o.country.trim().slice(0, 34);
  } else if (pol && pol.country) {
    getG().country = pol.country;
  }
  if (!getG().world) getG().world = {};
  let bag = getG().world[seatId];
  if (!bag) {
    const roleSnap = openingSnapshot(homeRole);
    bag = {
      econ: roleSnap.econ,
      law: clone(roleSnap.law || lawForRole(homeRole)),
      prevLaw: clone(roleSnap.law || lawForRole(homeRole)),
      log: clone(roleSnap.log || []),
      id: seatId,
      role: homeRole,
    };
    getG().world[seatId] = bag;
  }
  /* Always remount from this seat's world bag — never leave top-level snap.econ
     (often the host's frozen opening books) as the live series. */
  getG().econ = bag.econ;
  getG().law = bag.law;
  getG().prevLaw = bag.prevLaw || bag.law;
  if (!solo) {
    getG().draft = clone(getG().law);
    getG().draft.blocAccession = null;
    getG().draft.blocLeave = false;
    getG().draft.blocCreate = null;
    getG().draft.blocInvite = {};
    if (getG().draft.missions) getG().draft.missions = {};
  }
  /* Top-bar Growth/Balance read G.log — this seat's series only. */
  if (Array.isArray(bag.log) && bag.log.length) {
    getG().log = bag.log;
  } else if (pol && pol.lastRes && bag.econ) {
    /* Recover a one-row series if logs were dropped (old rooms / mirror bugs). */
    const lr = pol.lastRes;
    getG().log = [
      {
        label: qLabel(
          {
            q: getG().q,
            term: getG().term,
          },
          Math.max(0, (getG().q || 1) - 1),
        ),
        growth: lr.growth,
        inflation: bag.econ.inflation,
        unemployment: bag.econ.unemployment,
        balance: lr.deficit != null ? -lr.deficit : null,
        debt: bag.econ.debt,
        yield: bag.econ.yield,
        rate: bag.econ.rate,
        approval: approvalOf(pol.fac || {}),
        capital: pol.capital,
      },
    ];
    bag.log = getG().log;
  } else {
    getG().log = Array.isArray(bag.log) ? bag.log : [];
  }
  if (pol) {
    normalizeDiploPolitics(pol);
    getG().capital = pol.capital != null ? pol.capital : 42;
    getG().fac = clone(pol.fac || openingFac(homeRole));
    getG().parties = pol.parties
      ? clone(pol.parties)
      : seedParties(getG().fac, getG().law, getG().homeRole);
    getG().rel = clone(pol.rel || openingRel(homeRole));
    /* Per-seat Bank mode — top-level snap.rateManual is the host export and
         must not overwrite every human on hydrate. */
    getG().rateManual = !!pol.rateManual;
    getG().manualRate = pol.manualRate != null ? pol.manualRate : OPENING.rate;
    if (getG().rateManual && getG().econ) {
      getG().econ.rate = clamp(getG().manualRate, MANUAL_RATE_MIN, 20);
      getG().econ.atBound = getG().econ.rate <= RATE_FLOOR + 0.02;
    }
    getG().sandbox = !!pol.sandbox;
    getG().mods = Array.isArray(pol.mods) ? clone(pol.mods) : [];
    getG().lastEventQ = pol.lastEventQ != null ? pol.lastEventQ : -3;
    getG().lastEventId = pol.lastEventId || null;
    getG().setPiece8 = !!pol.setPiece8;
    getG().setPiece16 = !!pol.setPiece16;
    getG().nextMajorQ = pol.nextMajorQ;
    getG().episode = pol.episode ? clone(pol.episode) : null;
    getG().polityShift = pol.polityShift ? clone(pol.polityShift) : null;
    getG().lowRun = pol.lowRun || 0;
    getG().over = !!pol.over;
    /* Per-seat accession — do not keep another human's shared snap.blocAccession. */
    getG().blocAccession = pol.blocAccession ? clone(pol.blocAccession) : null;
    /* Remount this seat's diplomacy — never keep shared snap.envoys. */
    const diplo = cloneDiploPolitics(pol);
    getG().envoys = diplo.envoys;
    getG().ultimatums = diplo.ultimatums;
    getG().activeVisits = diplo.activeVisits;
    getG().missionEvents = diplo.missionEvents;
    getG().diploAlerts = mergeDiploAlertsNoted(
      prevNotedAlerts,
      diplo.diploAlerts,
    );
    getG().envoySpend = diplo.envoySpend;
    pol.envoys = getG().envoys;
    pol.ultimatums = getG().ultimatums;
    pol.activeVisits = getG().activeVisits;
    pol.missionEvents = getG().missionEvents;
    pol.diploAlerts = getG().diploAlerts;
    pol.envoySpend = getG().envoySpend;
  } else {
    getG().capital = getG().capital != null ? getG().capital : 42;
    if (!getG().fac) getG().fac = openingFac(homeRole);
    if (!getG().parties)
      getG().parties = seedParties(getG().fac, getG().law, getG().homeRole);
    if (!getG().rel) getG().rel = openingRel(homeRole);
    getG().sandbox = o.sandbox != null ? !!o.sandbox : false;
    getG().politics[seatId] = defaultMpPolitics(
      seatId,
      homeRole,
      getG().country,
    );
    getG().politics[seatId].sandbox = getG().sandbox;
    getG().politics[seatId].rateManual = !!getG().rateManual;
    getG().politics[seatId].manualRate = getG().manualRate;
    if (!getG().envoys) getG().envoys = emptyEnvoys();
    if (!getG().ultimatums) getG().ultimatums = {};
    if (!getG().activeVisits) getG().activeVisits = {};
    if (!getG().missionEvents) getG().missionEvents = [];
    if (!getG().diploAlerts) getG().diploAlerts = [];
    syncDiploPoliticsFromGame(getG().politics[seatId], getG());
  }
  getG().mp = o.mp || null;
  getG().over = !!getG().over;
  if (solo) {
    /* Press and tab already arrived via setG(clone(snap)) above — snap.press
       carries the unanswered inbox and snap.tab the open drawer for a solo
       save (exportGameSnapshot with mode: "solo"), unlike an MP remount. */
    resetPressUi();
    tab = snap.tab || null;
  } else {
    /* Drop host opening brief; seat briefings come from lastRes / showMpBriefing. */
    getG().brief = [];
    resetPressUi();
    getG().press = prevPress;
    tab = null;
  }
  mirrorPlayerToWorld(getG());
  /* mirror rebuilds the player bag — keep the log we just mounted. */
  if (getG().world[seatId]) getG().world[seatId].log = getG().log;
  syncNationsFromWorld(getG(), getG().q > 0);
  if (o.render !== false) {
    render();
  }
  return getG();
}

/* ==================================================================
   2. STATE
   ================================================================== */ const clamp =
  (v: any, a: any, b: any) => Math.max(a, Math.min(b, v));
/* Behavioural response of a tax base to its own rate, in the standard
   constant-elasticity form used throughout the public finance literature
   (Saez 2001; Saez, Slemrod & Giertz 2012):

       B(tau) = B0 * ((1 - tau) / (1 - tau0)) ^ e

   where e is the elasticity of the taxable base with respect to the net-of-tax
   rate. Revenue is tau * B(tau), so it is maximised at tau* = 1/(1+e): the
   declared revenue-maximising rate and the elasticity are the same statement.
   `base` is therefore revenue per point of rate at the default rate, before any
   behavioural response, and the response is entirely carried by `eti`.

   This replaced an arbitrary quadratic whose peak and local slope could not be
   set independently of one another.

   A note on corporation tax, where two good benchmarks genuinely disagree. The
   ready-reckoner figure (about 0.13% of GDP per point) is a short-run costing,
   which implies marginal revenue close to average and therefore a small
   elasticity. The Laffer literature puts the peak at 30-45%, which implies an
   elasticity near 1.5 and marginal revenue at half of average. Both cannot hold
   at a 25% rate. The elasticity here is set at 1.15, a deliberate compromise:
   the peak lands at 46%, a little above the literature, and the marginal figure
   comes in at about two thirds of the ready reckoner. The short-run costing and
   the long-run peak are measuring different horizons, and a single-elasticity
   model cannot honour both. */ const baseResponse = (
  rate: any,
  def: any,
  eti: any,
) => {
  const tau = Math.min(0.985, rate / 100),
    tau0 = def / 100;
  return Math.pow((1 - tau) / (1 - tau0), eti);
};
/* ---- income tax and national insurance, integrated over the distribution ---- */ /* The personal allowance is the authoritative start of the first band; the UI
   deliberately offers no separate "starts at" control for band one. Thresholds
   are forced strictly increasing, so a band dragged below the allowance is
   simply absorbed by it rather than paying negative tax. */ /* Above £100k the allowance is withdrawn at 50p in the pound, which creates the
   famous 60% marginal band when the higher rate is 40%:
     MTR = statutory + 0.5 * statutory  while the taper runs. */ const TAPER_START = 100000,
  TAPER_RATE = 0.5;
/** Flat = every currently-active labour band agrees on rate — trivially
 *  true the moment only Basic is left (removeIncomeBand), same as when
 *  several bands are dragged to the same number. Crisp, not fuzzy —
 *  sliders in this UI are stepped, so exact agreement is a deliberate,
 *  reachable action, not a hairsbreadth accident. Capital income
 *  (dividend/savings) is a genuinely separate question: capitalTaxOn()
 *  always reads its own two rates, so a flat labour schedule never
 *  silently overrides what the capital-rate sliders show — a flat income
 *  tax with untouched capital rates is a real, common shape (most
 *  real-world flat-tax proposals are about the labour schedule only), not
 *  a partial/incomplete version of something else. */ function isFlatIncome(
  law: any,
) {
  const bands = law.income.bands;
  const r0 = bands[0].rate;
  return bands.every((b: any) => Math.abs(b.rate - r0) < 1e-6);
}
/** Dual = dividend and savings rates agree with each other (capital
 *  unified onto one rate) while the labour bands stay progressive — if
 *  labour is already flat there's nothing left to call "dual" instead. */ function isDualCapital(
  law: any,
) {
  if (isFlatIncome(law)) return false;
  return Math.abs(law.income.divRate - law.income.saveRate) < 1e-6;
}
/** 0..1: how far Land value tax's rate sits between off and its own max —
 *  replaces the old "Land value shift" regime pick. 0 at the opening
 *  default (tax off), so the opening deficit is untouched until the
 *  player actually raises it. */ function landCommitment(law: any) {
  const t = law.taxes.landTax;
  if (!t || !t.on) return 0;
  return clamp(t.rate / TAX_BY_ID.landTax.max, 0, 1);
}
/** 0..1: how far VAT's rate sits between its opening default and its max —
 *  replaces the old "Consumption-led" regime pick. 0 at the opening
 *  default rate, same reasoning as landCommitment. */ function consumptionCommitment(
  law: any,
) {
  const t = law.taxes.vat;
  if (!t || !t.on) return 0;
  const def = TAX_BY_ID.vat.def,
    max = TAX_BY_ID.vat.max;
  return clamp((t.rate - def) / (max - def), 0, 1);
}
/** Combined base multipliers from all four derived signals, additive on
 *  the delta from 1 so they stack rather than fight for exclusivity — a
 *  flat income tax and a land-value lean are independent choices now, not
 *  mutually exclusive picks. income is floored defensively; nothing today
 *  pushes it toward a ceiling. */ function regimeMultipliers(law: any) {
  const flat = isFlatIncome(law) ? 1 : 0;
  const dual = isDualCapital(law) ? 1 : 0;
  const land = landCommitment(law);
  const cons = consumptionCommitment(law);
  return {
    income: Math.max(
      0.5,
      1 -
        (1 - FLAT_BONUS.incomeMult) * flat -
        (1 - DUAL_BONUS.incomeMult) * dual -
        (1 - LAND_BONUS.incomeMult) * land -
        (1 - CONSUMPTION_BONUS.incomeMult) * cons,
    ),
    wealth:
      1 +
      (DUAL_BONUS.wealthMult - 1) * dual +
      (LAND_BONUS.wealthMult - 1) * land,
    consumption: 1 + (CONSUMPTION_BONUS.consumptionMult - 1) * cons,
  };
}
function effectiveBands(law: any) {
  const I = law.income;
  const b = I.bands.map((x: any, i: any) =>
    i === 0
      ? {
          from: I.allowance,
          rate: x.rate,
        }
      : {
          from: x.from,
          rate: x.rate,
        },
  );
  for (let i = 1; i < b.length; i++)
    if (b[i].from < b[i - 1].from) b[i].from = b[i - 1].from;
  return isFlatIncome(law)
    ? [
        {
          from: b[0].from,
          rate: b[0].rate,
        },
      ]
    : b;
}
function personalAllowance(y: any, law: any) {
  const A0 = law.income.allowance;
  if (isFlatIncome(law)) return A0;
  const ts =
    law.income.taperStart != null ? law.income.taperStart : TAPER_START;
  return Math.max(0, A0 - TAPER_RATE * Math.max(0, y - ts));
}
function bandsForIncome(y: any, law: any) {
  const bands = effectiveBands(law);
  if (isFlatIncome(law)) return bands;
  const A = personalAllowance(y, law);
  return bands.map((b: any, i: any) =>
    i === 0
      ? {
          from: A,
          rate: b.rate,
        }
      : {
          from: b.from,
          rate: b.rate,
        },
  );
}
function marginalBand(bands: any, y: any) {
  let r = 0;
  for (const b of bands) if (y > b.from) r = b.rate;
  return r;
}
/* Where the taxpayer's top band starts. Behavioural response applies only to
   income above this kink: raising the additional rate should not make someone
   declare less of the salary they were already paying basic rate on. */ function bandKink(
  bands: any,
  y: any,
) {
  let k = 0;
  for (const b of bands) if (y > b.from) k = b.from;
  return k;
}
function incomeTaxOn(y: any, bands: any) {
  let t = 0;
  for (let i = 0; i < bands.length; i++) {
    const from = bands[i].from,
      to = i + 1 < bands.length ? bands[i + 1].from : Infinity;
    if (y > from) t += ((Math.min(y, to) - from) * bands[i].rate) / 100;
  }
  return t;
}
/* Extra marginal points from allowance withdrawal (0 outside the taper window). */ function taperMtrBoost(
  y: any,
  law: any,
) {
  if (isFlatIncome(law)) return 0;
  const A0 = law.income.allowance;
  if (A0 <= 0) return 0;
  const ts =
    law.income.taperStart != null ? law.income.taperStart : TAPER_START;
  const end = ts + A0 / TAPER_RATE;
  if (y <= ts || y >= end) return 0;
  const bands = effectiveBands(law);
  return marginalBand(bands, y) * TAPER_RATE;
}
/* `floor` is the income tax personal allowance: NI bites where income tax does. */ function niOn(
  y: any,
  ni: any,
  floor: any,
) {
  const base = Math.max(0, y - floor);
  return {
    emp:
      ni.empOn === false ? 0 : ((base * ni.empRate) / 100) * EMPLOYEE_COLLECT,
    er: ni.erOn === false ? 0 : ((base * ni.erRate) / 100) * EMPLOYER_COLLECT,
  };
}
/** Always reads its own two rates — no special "flat forces capital to the
 *  labour rate" branch, since isFlatIncome() is now labour-only. When a
 *  player does align divRate/saveRate with the labour rate too, this
 *  already produces the identical number to the old forced branch; it's
 *  just no longer forced. */ function capitalTaxOn(
  yDiv: any,
  ySave: any,
  law: any,
) {
  const I = law.income;
  if (I.on === false) return 0;
  const divR = I.divRate != null ? I.divRate : 33;
  const saveR = I.saveRate != null ? I.saveRate : 20;
  return (yDiv * divR) / 100 + (ySave * saveR) / 100;
}
function incomeYield(law: any, E: any, econ: any) {
  const ni = law.ni,
    wage = (econ && econ.wageIndex) || 1;
  const dist = activeIncomeDist(econ);
  const mult = regimeMultipliers(law).income;
  const incomeOn = law.income.on !== false;
  let tax = 0,
    emp = 0,
    er = 0,
    meanBase = 0,
    capTax = 0;
  for (const slice of dist) {
    const y = slice.inc * wage;
    meanBase += y * slice.w;
    const yLab = y * (1 - CAP_INCOME_SHARE);
    const yCap = y * CAP_INCOME_SHARE;
    const yDiv = yCap * DIV_OF_CAPITAL;
    const ySave = yCap * (1 - DIV_OF_CAPITAL);
    const bands = bandsForIncome(yLab, law);
    const floor = bands[0].from;
    const mtrNi = ni.empOn === false ? 0 : yLab > floor ? ni.empRate : 0;
    const mtrLab = incomeOn
      ? marginalBand(bands, yLab) + taperMtrBoost(yLab, law)
      : 0;
    const mtr = (mtrLab + mtrNi) / 100;
    const kink = bandKink(bands, yLab);
    const declaredLab =
      Math.min(yLab, kink) +
      Math.max(0, yLab - kink) * declaredFactor(slice.inc, mtr);
    if (incomeOn) {
      tax +=
        incomeTaxOn(declaredLab, bandsForIncome(declaredLab, law)) * slice.w;
      capTax += capitalTaxOn(yDiv, ySave, law) * slice.w;
    }
    const q = niOn(declaredLab, ni, personalAllowance(declaredLab, law));
    emp += q.emp * slice.w;
    er += q.er * slice.w;
  }
  /* Avoidance responses to a tax's own rate already live in that tax's Laffer
     term. This economy-wide channel is only for the structural stuff (a wealth
     tax, an FTT, a digital ID regime), so it is deliberately weak: at 0.15 a
     single point of inheritance tax lost more revenue across the whole base
     than the tax itself raised, which made its marginal yield negative. */ const evasion =
    1 - clamp(E ? E.eva : 0, -0.7, 0.7) * 0.05;
  const k = ((LABOUR_SHARE * 100) / meanBase) * evasion;
  const labourTax = tax * k * mult;
  const capital = capTax * k;
  return {
    income: labourTax + capital,
    labour: labourTax,
    capital,
    employee: emp * k,
    employer: er * k,
    total: (tax * mult + capTax + emp + er) * k,
  };
}
/** Revenue raised by each nominal income-tax band (% of GDP), for the
 *  per-band UI readout — mirrors incomeYield()'s exact declaredLab/scaling
 *  so the figures sum to incomeYield(...).labour, at the cost of some
 *  duplication with its loop (same trade-off revenue() already makes for
 *  its own per-tax `by` breakdown). Bracket arithmetic matches
 *  incomeTaxOn()'s internal loop, just kept per-bracket instead of summed.
 *  Under a derived flat tax, bandsForIncome() collapses to one bracket —
 *  every nominal band's rate already agrees there, so that single total is
 *  split back across the nominal bands by width rather than showing zero
 *  for the ones the collapse absorbed. */ function incomeByBand(
  law: any,
  E: any,
  econ: any,
) {
  const nBands = law.income.bands.length;
  const out = new Array(nBands).fill(0);
  if (law.income.on === false) return out;
  const ni = law.ni,
    wage = (econ && econ.wageIndex) || 1;
  const dist = activeIncomeDist(econ);
  const mult = regimeMultipliers(law).income;
  const flat = isFlatIncome(law);
  let meanBase = 0;
  for (const slice of dist) {
    const y = slice.inc * wage;
    meanBase += y * slice.w;
    const yLab = y * (1 - CAP_INCOME_SHARE);
    const bands = bandsForIncome(yLab, law);
    const floor = bands[0].from;
    const mtrNi = ni.empOn === false ? 0 : yLab > floor ? ni.empRate : 0;
    const mtrLab = marginalBand(bands, yLab) + taperMtrBoost(yLab, law);
    const mtr = (mtrLab + mtrNi) / 100;
    const kink = bandKink(bands, yLab);
    const declaredLab =
      Math.min(yLab, kink) +
      Math.max(0, yLab - kink) * declaredFactor(slice.inc, mtr);
    const taxedBands = bandsForIncome(declaredLab, law);
    if (flat) {
      const totalTax = incomeTaxOn(declaredLab, taxedBands) * slice.w;
      const nomBands = law.income.bands;
      const widths = nomBands.map((b: any, i: any) => {
        const to = i + 1 < nBands ? nomBands[i + 1].from : declaredLab;
        return Math.max(0, Math.min(declaredLab, to) - b.from);
      });
      const totalWidth = widths.reduce((s: number, w: number) => s + w, 0);
      if (totalWidth > 0)
        widths.forEach((w: number, i: number) => {
          out[i] += (totalTax * w) / totalWidth;
        });
    } else {
      for (let i = 0; i < taxedBands.length && i < nBands; i++) {
        const from = taxedBands[i].from,
          to = i + 1 < taxedBands.length ? taxedBands[i + 1].from : Infinity;
        if (declaredLab > from)
          out[i] +=
            (((Math.min(declaredLab, to) - from) * taxedBands[i].rate) / 100) *
            slice.w;
      }
    }
  }
  const evasion = 1 - clamp(E ? E.eva : 0, -0.7, 0.7) * 0.05;
  const k = ((LABOUR_SHARE * 100) / meanBase) * evasion;
  return out.map((v) => v * k * mult);
}
/* Population-weighted marginal rate and progressivity. Declared-income effects
   are handled inside incomeYield; this is the separate real-economy channel:
   high marginal rates on labour reduce participation and raise structural
   unemployment, and a progressive schedule compresses the distribution. */ /* The propensity to consume falls with income: a poor household spends nearly
   all of an extra pound, a rich one saves most of it. The model already
   integrates the tax system over a 23-slice income distribution, so the same
   distribution can carry consumption behaviour, and the *incidence* of a tax
   change then drives demand directly.

   This replaced a single aggregate split keyed off the Gini, which could not
   tell the difference between raising the personal allowance and cutting the
   additional rate. It now can: the first puts money where it is spent. */ const MPC_BOTTOM = 0.88,
  MPC_TOP = 0.22;
function mpcAt(income: any, median: any) {
  const rel = Math.log(Math.max(0.15, income / median)) / Math.log(9);
  return clamp(
    MPC_BOTTOM + (MPC_TOP - MPC_BOTTOM) * clamp(rel + 0.45, 0, 1),
    MPC_TOP,
    MPC_BOTTOM,
  );
}
function incomeProfile(law: any, econ: any) {
  const ni = law.ni,
    wage = (econ && econ.wageIndex) || 1;
  const dist = activeIncomeDist(econ);
  const medianInc = distMedian(dist);
  const median = medianInc * wage;
  const topCut = medianInc * 3.3;
  const pol = (law && law.policies) || {};
  /* UBI is a flat adult transfer; min wage lifts the bottom of the earned
     distribution. Both change post-tax inequality through the schedule rather
     than through an authored Gini coefficient. */ const ubi = pol.ubi
    ? 3200 * wage
    : 0;
  const minFloor = pol.minWage ? 22000 * wage : 0;
  let netW = 0,
    mpcW = 0;
  let meanMtr = 0,
    taxLow = 0,
    incLow = 0,
    taxTop = 0,
    incTop = 0;
  const slices = [];
  for (const s of dist) {
    let y = s.inc * wage;
    if (minFloor && y < minFloor && y > 8000 * wage)
      y = minFloor * 0.55 + y * 0.45;
    const yLab = y * (1 - CAP_INCOME_SHARE);
    const yCap = y * CAP_INCOME_SHARE;
    const yDiv = yCap * DIV_OF_CAPITAL;
    const ySave = yCap * (1 - DIV_OF_CAPITAL);
    const bands = bandsForIncome(yLab, law);
    const floor = bands[0].from;
    const mtrNi = ni.empOn === false ? 0 : yLab > floor ? ni.empRate : 0;
    const incomeOn = law.income.on !== false;
    const mtrLab = incomeOn
      ? marginalBand(bands, yLab) + taperMtrBoost(yLab, law)
      : 0;
    meanMtr += ((mtrLab + mtrNi) / 100) * s.w;
    const liab =
      (incomeOn
        ? incomeTaxOn(yLab, bands) + capitalTaxOn(yDiv, ySave, law)
        : 0) + niOn(yLab, ni, floor).emp;
    const net = Math.max(0, y - liab) + ubi;
    slices.push({
      w: s.w,
      net,
    });
    netW += net * s.w;
    mpcW += net * s.w * mpcAt(y, median);
    if (s.inc <= medianInc) {
      taxLow += liab * s.w;
      incLow += y * s.w;
    }
    if (s.inc >= topCut) {
      taxTop += liab * s.w;
      incTop += y * s.w;
    }
  }
  return {
    meanMtr,
    distMPC: netW > 0 ? mpcW / netW : 0.55,
    netIncome: netW,
    progressivity:
      (incTop ? taxTop / incTop : 0) - (incLow ? taxLow / incLow : 0),
    gini: giniFromSlices(slices),
  };
}
/* Gini coefficient of a discrete weighted income distribution:
     G = (1/(2 mu)) * sum_i sum_j w_i w_j |y_i - y_j|
   Scaled to the familiar 0–100 index the rest of the game uses. */ function giniFromSlices(
  slices: any,
) {
  let mean = 0,
    wSum = 0;
  for (const s of slices) {
    mean += s.net * s.w;
    wSum += s.w;
  }
  mean /= Math.max(1e-9, wSum);
  if (mean <= 0) return 35;
  let absDiff = 0;
  for (let i = 0; i < slices.length; i++) {
    for (let j = 0; j < slices.length; j++) {
      absDiff +=
        slices[i].w * slices[j].w * Math.abs(slices[i].net - slices[j].net);
    }
  }
  return clamp((absDiff / (2 * mean * wSum * wSum)) * 100, 14, 68);
}
const PROG_BASE = 0.3;
/* Real (CPI) value of the personal allowance against this seat's opening
   schedule. Below 1 the Chancellor is raising taxes without announcing it.
   Uprate tracks the same inflation factor as cpiIndex, so Freeze is what
   drives the ratio down; earnings growth is deliberately not in the deflator. */ function allowanceBase(
  econ: any,
  law: any,
) {
  if (econ && econ.allowBase > 0) return econ.allowBase;
  if (law && law.income && law.income.allowance > 0)
    return law.income.allowance;
  return DEF_INCOME.allowance;
}
function dragRatio(law: any, econ: any) {
  const cpi = (econ && econ.cpiIndex) || 1;
  return law.income.allowance / cpi / allowanceBase(econ, law);
}
const SYNTH_GRP = {
  incomeTax: "income",
  niEmployee: "income",
  niEmployer: "income",
};
const taxGroup = (id: any) =>
  (SYNTH_GRP as any)[id] ||
  ((TAX_BY_ID as any)[id] ? (TAX_BY_ID as any)[id].grp : "other");
const clone = (o: any) => JSON.parse(JSON.stringify(o));
/* Copy carries {C}/{P}/{S} tokens. Applied where authored text reaches the
   screen: modal despatches, the morning briefing, card blurbs, stamps, and
   floating press clippings. Country names that take a definite article
   (United Kingdom, United States, …) pick up "the"/"The" from the
   surrounding sentence — see lib/sim/countryPhrase.ts. */ const T = (
  str: any,
) => {
  const out = String(str)
    .replace(/\{C\}/g, (_m, offset, full) =>
      countryAt(full, offset, (G && G.country) || "United Kingdom"),
    )
    .replace(/\{P\}/g, (_m, offset, full) => {
      const id = G && G.eventFocus;
      const p = id && partnerById(id);
      return countryAt(full, offset, p ? p.name : "a partner");
    })
    .replace(/\{S\}/g, (_m, offset, full) => {
      const ids = G && G.eventSponsors;
      if (!ids || !ids.length) return "allies";
      const names = ids
        .map((id: any) => {
          const p = partnerById(id);
          return p ? theCountry(p.name) : null;
        })
        .filter(Boolean);
      if (!names.length) return "allies";
      let joined;
      if (names.length === 1) joined = names[0];
      else if (names.length === 2) joined = names[0] + " and " + names[1];
      else
        joined =
          names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
      if (precededByThe(full.slice(0, offset)))
        return joined.replace(/^the\s+/i, "");
      return joined;
    });
  return capSentenceThe(out);
};
const fmt = function (v: any, d: any = 1) {
  return (v >= 0 ? "" : "-") + Math.abs(v).toFixed(d);
};
const sgn = function (v: any, d: any = 1) {
  return (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v).toFixed(d);
};
const cap1 = (s: any) => s.charAt(0).toUpperCase() + s.slice(1);
/** Format a game-money amount (face value in the played nation's own
 *  currency) with a currency symbol. `displayCcy` converts to any other ISO
 *  code via the live fx-derived cross-rate; defaults to the played nation's
 *  own currency, so existing call sites are unaffected. */
const money = (v: any, displayCcy?: string, g?: any) => {
  const G = g || (typeof getG === "function" ? getG() : null);
  const nativeCcy = currencyForSeat(G && G.homeRole);
  const ccy = displayCcy || nativeCcy;
  const shown =
    ccy === nativeCcy || !G ? v : v * liveRateBetween(nativeCcy, ccy, G);
  const symbol = (CURRENCY_META[ccy] || CURRENCY_META.USD).symbol;
  return (
    symbol +
    Math.round(shown)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
};
/** Untyped until a later modelling pass — the live game-state singleton.
 * `any` is deliberate: annotated so property access doesn't error on `never`. */
export let G: any = null;
/** Currently-open drawer tab id, or null. See `G` above. */
export let tab: string | null = null;
function baseLaw() {
  const law = {
    polity: "democracy",
    taxes: Object.fromEntries(
      TAXES.map((t) => [
        t.id,
        {
          on: !!t.on,
          rate: t.def,
        },
      ]),
    ),
    spend: Object.fromEntries(DEPTS.map((d) => [d.id, d.def])),
    income: clone(DEF_INCOME),
    ni: Object.assign({}, DEF_NI),
    policies: {},
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
    deals: {},
    hold: {},
    mode: {},
    tariff: BASE_TARIFF,
    tariffSchedule: defaultTariffSchedule(),
    missions: {},
    /* State & Constitution / Labor & Welfare: `groups` is the generalised
       VICE "pick one of N" pattern (see lib/sim/lawGroups.ts), defaulted to
       a UK-like opening position. The rest are bespoke slider groups
       following the law.income/law.ni pattern. */ groups: {
      hereditary: "elected",
      territorialStructure: "unitary",
      termLimit: "none",
      judicialImmunity: "partial",
      partyPluralism: "multiParty",
      extremistLegality: "legal",
      parliamentaryPowers: "sovereign",
      assemblyRights: "free",
      strikeLegality: "protected",
      votingSystem: "majoritySingle",
      electionCalendar: "flexible",
      unionLegality: "legal",
      boardRepresentation: "none",
      informalEnforcement: "standard",
      pensionIndexing: "discretionary",
      abortion: "onDemand",
      sameSexMarriage: "legal",
      euthanasia: "passiveOnly",
      transRecognition: "medicalGatekept",
      surrogacy: "altruisticOnly",
      pressFreedom: "free",
      internetCensorship: "none",
      blasphemyLaw: "none",
      gunOwnership: "licensed",
      religiousDress: "unrestricted",
      religionTaxStatus: "exemptRegistered",
      deathPenalty: "abolished",
      wiretapPowers: "warrantRequired",
      biometricId: "limitedToCrime",
      socialCredit: "none",
      asylumPolicy: "standardProcessing",
      familyReunification: "standard",
      citizenshipPath: "standardNaturalisation",
    },
    headOfState: Object.assign({}, DEF_HEAD_OF_STATE),
    electoral: Object.assign({}, DEF_ELECTORAL),
    workHours: Object.assign({}, DEF_WORK_HOURS),
    childcare: Object.assign({}, DEF_CHILDCARE),
    minWage: Object.assign({}, DEF_MIN_WAGE),
    pension: Object.assign({}, DEF_PENSION),
  };
  return law;
}
/** Resolve which REALM_LAW key to apply. Prefer the country id so every seat
 *  can carry its own spend / tax / policy book; fall back to legacy bloc keys. */ function realmLawKey(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  if (id === "home") return "home";
  return id;
}
/** Force vice duties off when the legality gate fails. */ function syncViceTaxes(
  law: any,
) {
  for (const t of TAXES) {
    if (!t.req) continue;
    if (!resolveReqState(law, t.req)) law.taxes[t.id].on = false;
  }
}
/** Force a LawGroup option off the draft when its own `req` gate fails
 *  (e.g. Absolute Monarchy staged, then the player reverts `law.polity` to
 *  democracy) — mirrors syncViceTaxes for the generalised group pattern. */ function syncGroupReqs(
  law: any,
) {
  if (!law.groups) return;
  for (const g of LAW_GROUPS) {
    const cur = g.options.find((o) => o.id === law.groups[g.id]);
    if (cur && cur.req && !resolveReqState(law, cur.req)) {
      const fallback = g.options.find(
        (o) => !o.req || resolveReqState(law, o.req),
      );
      if (fallback) law.groups[g.id] = fallback.id;
    }
  }
}
/** Opening statute for a playable seat. `home` is the UK baseLaw unchanged. */ function lawForRole(
  role: any,
) {
  const law = baseLaw();
  applyRealmLawOverlay(law, REALM_LAW[realmLawKey(role)] || null);
  syncViceTaxes(law);
  law.polity = profilePolityId(role);
  const id = resolveHomeRole(role || "home");
  const profile =
    id === "home" || id === "kingdom"
      ? NATION_PROFILE.kingdom
      : (NATION_PROFILE as any)[id];
  law.groups.hereditary =
    profile && profile.hereditary ? "hereditary" : "elected";
  const overlay = partyOverlayForRole(id === "home" ? "kingdom" : id);
  if (overlay && overlay.partyPluralism) {
    law.groups.partyPluralism = overlay.partyPluralism;
  } else if (law.polity === "authoritarian") {
    law.groups.partyPluralism = "singleParty";
  }
  if (overlay && overlay.parliamentaryPowers) {
    law.groups.parliamentaryPowers = overlay.parliamentaryPowers;
  } else if (law.polity === "authoritarian") {
    law.groups.parliamentaryPowers = "consultative";
  }
  if (overlay && overlay.electionCalendar) {
    law.groups.electionCalendar = overlay.electionCalendar;
  } else if (law.polity === "authoritarian") {
    law.groups.electionCalendar = "fixed";
  }
  if (overlay && overlay.votingSystem) {
    law.groups.votingSystem = overlay.votingSystem;
  }
  syncGroupReqs(law);
  if (law.tariff != null) law.tariffSchedule.default = law.tariff;
  syncTariffHeadline(law, role);
  return law;
}
/* Published UK opening headlines. Held fixed while flows (C, I, X, M, K*, FX)
   clear around them, so the player inherits one consistent state rather than a
   collage that then corrects itself in Q1–Q2. Non-home seats overlay debt,
   deficit, inflation and trend from NATION_PROFILE, and a realm-specific
   statute book from REALM_LAW. */ const OPENING = {
  debt: 94,
  effInterest: 3.3,
  yield: 4.6,
  inflation: 2.9,
  expect: 2.5,
  rate: 3.75,
  credibility: 0.62,
  riskPremium: 0,
  unemployment: 4.9,
  deficit0: null,
  trend: 1.2,
};
const HOME_TREND_REF = 1.2;
const SETTLE_QUARTERS = 48;
/* How many settle quarters, at the tail end, ease off the rate/inflation/
   riskPremium/expectations pin instead of resetting it outright — see the
   comment in settleOpeningEcon(). */ const SETTLE_TAPER_QUARTERS = 12;
let _openingByRole: Record<string, any> = {};
/** Steady-state Taylor guess at zero gap — seed for non-home settle only. */ function taylorRateForInflation(
  pi: any,
) {
  const underlying = pi != null ? pi : PI_TARGET;
  return clamp(
    R_NEUTRAL_REAL + underlying + TAYLOR_PI * (underlying - PI_TARGET),
    RATE_FLOOR,
    20,
  );
}
/** Kingdom / UK society baselines (also the soc0 on NATION_PROFILE.kingdom). */ const SOC_UK =
  {
    services: 55,
    liberty: 58,
    crime: 28,
    health: 55,
    env: 44,
    openness: 50,
    gini: 35,
  };
/** Opening + equilibrium society pins for a playable seat. */ function societyPinsFromRole(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  const p =
    id === "home" || id === "kingdom"
      ? NATION_PROFILE.kingdom
      : NATION_PROFILE[id];
  const s = Object.assign({}, SOC_UK, (p && p.soc0) || {});
  return {
    services0: s.services,
    liberty0: s.liberty,
    crime0: s.crime,
    health0: s.health,
    env0: s.env,
    openness0: s.openness,
    gini0: s.gini,
  };
}
/** Structural supply + opening stocks for a playable seat. */ function seatSupplyFromRole(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  const p = id !== "home" && NATION_PROFILE[id] ? NATION_PROFILE[id] : null;
  const home = NATION_PROFILE.kingdom;
  const dep0 = p && p.dep0 != null ? p.dep0 : DEP_0;
  const popWork0 = POP_WORK0;
  const popOld0 = p && p.popOld0 != null ? p.popOld0 : dep0 * popWork0;
  const popChild0 = p && p.popChild0 != null ? p.popChild0 : POP_CHILD0;
  const soc = societyPinsFromRole(id);
  return {
    yRel: p && p.yRel != null ? p.yRel : home.yRel != null ? home.yRel : 0.88,
    birthRate: p && p.birthRate != null ? p.birthRate : BIRTH_RATE,
    migBase: p && p.migBase != null ? p.migBase : MIG_BASE,
    dep0,
    popWork0,
    popOld0,
    popChild0,
    shareC: p && p.shareC != null ? p.shareC : SHARE_C,
    shareI: p && p.shareI != null ? p.shareI : SHARE_I,
    shareX: p && p.shareX != null ? p.shareX : SHARE_X,
    shareM: p && p.shareM != null ? p.shareM : SHARE_M,
    worldRate: p && p.worldRate != null ? p.worldRate : WORLD_RATE,
    fxUip: p && p.fxUip != null ? p.fxUip : FX_UIP,
    ...soc,
  };
}
/** Opening pins for a playable seat. `home` keeps the UK OPENING; other roles
 *  take debt/deficit/inflation/trend/labour from NATION_PROFILE and seed the
 *  Bank rate from a Taylor guess (settle then lets Taylor run — see freeRate). */ function pinsForRole(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  const supply = seatSupplyFromRole(id);
  if (id === "home" || !NATION_PROFILE[id]) {
    return {
      debt: OPENING.debt,
      inflation: OPENING.inflation,
      expect: OPENING.expect,
      effInterest: OPENING.effInterest,
      yield: OPENING.yield,
      rate: OPENING.rate,
      credibility: OPENING.credibility,
      riskPremium: OPENING.riskPremium,
      unemployment: OPENING.unemployment,
      nairu: U_STAR,
      deficit0: null,
      trend: OPENING.trend,
      ...supply,
    };
  }
  const p = NATION_PROFILE[id];
  const rate0 = taylorRateForInflation(p.inflation0);
  const u0 = p.unemployment0 != null ? p.unemployment0 : OPENING.unemployment;
  const nairu0 = p.nairu0 != null ? p.nairu0 : U_STAR;
  const eff0 = p.effInterest0 != null ? p.effInterest0 : OPENING.effInterest;
  return {
    debt: p.debt0,
    inflation: p.inflation0,
    expect: Math.max(0.5, p.inflation0 - 0.4),
    effInterest: eff0,
    yield: rate0 + (OPENING.yield - OPENING.rate),
    rate: rate0,
    credibility: OPENING.credibility,
    riskPremium: OPENING.riskPremium,
    unemployment: u0,
    nairu: nairu0,
    deficit0: p.deficit0,
    trend: p.trend,
    ...supply,
  };
}
/** Pin fiscal / price headlines for settle. When `freeRate` is set, leave the
 *  policy rate (and bond / mortgage crawl) alone so Taylor can respond to the
 *  seat's inflation instead of resetting to a UK pin every quarter.
 *  Effective interest is always re-pinned: otherwise a high-debt settle crawls
 *  effInterest toward crisis yields while debt is held fixed, and Japan opens
 *  with a 15%+ coupon on 250% debt. */ function pinOpeningHeadlines(
  e: any,
  law: any,
  pins: any,
  statutePin: any,
  opts: any,
) {
  const pin = pins || OPENING;
  const freeRate = !!(opts && opts.freeRate);
  const keepRate = freeRate ? e.rate : pin.rate;
  const keepYield = freeRate ? e.yield : pin.yield;
  const keepMort = freeRate ? e.mortgageRate : pin.rate;
  const dep0 = pin.dep0 != null ? pin.dep0 : DEP_0;
  const popWork0 = pin.popWork0 != null ? pin.popWork0 : POP_WORK0;
  const popOld0 = pin.popOld0 != null ? pin.popOld0 : POP_OLD0;
  const popChild0 = pin.popChild0 != null ? pin.popChild0 : POP_CHILD0;
  Object.assign(e, {
    debt: pin.debt,
    effInterest: pin.effInterest,
    yield: keepYield,
    inflation: pin.inflation,
    expect: pin.expect,
    credibility: pin.credibility,
    riskPremium: pin.riskPremium != null ? pin.riskPremium : 0,
    supplyShock: 0,
    rate: keepRate,
    unemployment: pin.unemployment != null ? pin.unemployment : e.unemployment,
    worldY: 100,
    worldRestY: 100,
    worldDemand0: 0,
    worldShock: 0,
    vatEcho: 0,
    wageIndex: 1,
    cpiIndex: 1,
    realWage: 1,
    pubProd: 1,
    dependency: dep0,
    L: 100,
    participation: 1,
    hCap: H_CAP0,
    mortgageDebt: MORT_DEBT0,
    mortgageRate: keepMort,
    housePrice: 100,
    housePriceGrowth: 0,
    housingStock: H0,
    rentIndex: 100,
    housingInvest: 0,
    bankLeverage: BANK_LEV0,
    bankCapital: BANK_CAP0,
    creditSpread: 0,
    bankLoans: BANK_LOANS0,
    bankDeposits: BANK_LOANS0 * 0.92,
    depositRun: 0,
    bankStress: false,
    bankStressCd: 0,
    popWork: popWork0,
    popOld: popOld0,
    popChild: popChild0,
    pensionIndex: 1,
    uncertainty: 0,
    contactHit: 0,
    retaliation: 0,
    tradeDepth: 0,
    openEff: 0,
    tariffCutEff: 0,
    importTariff: BASE_TARIFF,
    partnerAccessEff: {},
    privateWealth: PRIVATE_WEALTH0,
    residCarry: 0,
    relImpulse: {},
    missionCd: {},
    dealStress: {},
    diploLedger: {},
    sanctionStance: {},
    relBase: {},
    envoyBuild: {},
    ultimatumCd: {},
    liberty: pin.liberty0 != null ? pin.liberty0 : 58,
    crime: pin.crime0 != null ? pin.crime0 : CRIME_BASE,
    health: pin.health0 != null ? pin.health0 : 55,
    env: pin.env0 != null ? pin.env0 : 44,
    openness: pin.openness0 != null ? pin.openness0 : 50,
    services: pin.services0 != null ? pin.services0 : 55,
    gini: pin.gini0 != null ? pin.gini0 : 35,
    services0: pin.services0 != null ? pin.services0 : 55,
    liberty0: pin.liberty0 != null ? pin.liberty0 : 58,
    crime0: pin.crime0 != null ? pin.crime0 : CRIME_BASE,
    health0: pin.health0 != null ? pin.health0 : 55,
    env0: pin.env0 != null ? pin.env0 : 44,
    openness0: pin.openness0 != null ? pin.openness0 : 50,
    gini0: pin.gini0 != null ? pin.gini0 : 35,
    shareC: pin.shareC != null ? pin.shareC : SHARE_C,
    shareI: pin.shareI != null ? pin.shareI : SHARE_I,
    shareX: pin.shareX != null ? pin.shareX : SHARE_X,
    shareM: pin.shareM != null ? pin.shareM : SHARE_M,
    worldRate: pin.worldRate != null ? pin.worldRate : WORLD_RATE,
    fxUip: pin.fxUip != null ? pin.fxUip : FX_UIP,
  });
  if (pin.nairu != null) e.nairu = pin.nairu;
  if (e.nations) {
    for (const id of Object.keys(e.nations)) {
      const p = NATION_PROFILE[id];
      if (!p) continue;
      Object.assign(e.nations[id], nationStateFromProfile(p));
    }
  }
  /* Keep the seat's income/NI schedule, not a silent reset to UK defaults. */ const statute =
    statutePin || law;
  law.income = clone(statute.income);
  law.ni = clone(statute.ni);
  if (!(e.allowBase > 0) && statute.income && statute.income.allowance > 0) {
    e.allowBase = statute.income.allowance;
  }
}
/** Set otherRevAdj so balanceOf matches the profile deficit (after debt pin). */ function plugOpeningDeficit(
  e: any,
  law: any,
  deficit0: any,
) {
  if (deficit0 == null) {
    e.otherRevAdj = 0;
    return;
  }
  e.otherRevAdj = 0;
  const measured = -balanceOf(law, e).balance;
  e.otherRevAdj = measured - deficit0;
}
function freshEcon(pins: any) {
  const pin = pins || OPENING;
  const shareC = pin.shareC != null ? pin.shareC : SHARE_C;
  const shareI = pin.shareI != null ? pin.shareI : SHARE_I;
  const shareX = pin.shareX != null ? pin.shareX : SHARE_X;
  const shareM = pin.shareM != null ? pin.shareM : SHARE_M;
  const dep0 = pin.dep0 != null ? pin.dep0 : DEP_0;
  const popWork0 = pin.popWork0 != null ? pin.popWork0 : POP_WORK0;
  const popOld0 = pin.popOld0 != null ? pin.popOld0 : POP_OLD0;
  const popChild0 = pin.popChild0 != null ? pin.popChild0 : POP_CHILD0;
  return {
    gdp: 100,
    potential: 100,
    inflation: pin.inflation,
    expect: pin.expect,
    unemployment: pin.unemployment,
    rate: pin.rate,
    effInterest: pin.effInterest,
    yield: pin.yield,
    debt: pin.debt,
    riskPremium: 0,
    supplyShock: 0,
    vatEcho: 0,
    carry: [0, 0],
    demandNeed: 0,
    services: pin.services0 != null ? pin.services0 : 55,
    gini: pin.gini0 != null ? pin.gini0 : 35,
    services0: pin.services0 != null ? pin.services0 : 55,
    liberty0: pin.liberty0 != null ? pin.liberty0 : 58,
    crime0: pin.crime0 != null ? pin.crime0 : CRIME_BASE,
    health0: pin.health0 != null ? pin.health0 : 55,
    env0: pin.env0 != null ? pin.env0 : 44,
    openness0: pin.openness0 != null ? pin.openness0 : 50,
    gini0: pin.gini0 != null ? pin.gini0 : 35,
    wageIndex: 1,
    cpiIndex: 1,
    allowBase: pin.allowBase != null ? pin.allowBase : DEF_INCOME.allowance,
    erBorne: 0,
    erBornePrev: 0,
    C: shareC,
    I: shareI,
    X: shareX,
    M: shareM,
    shareC,
    shareI,
    shareX,
    shareM,
    K: K0,
    A: A0,
    L: 100,
    nairu: pin.nairu != null ? pin.nairu : U_STAR,
    trendGrowth: pin.trend || HOME_TREND_REF,
    Kstar: K0,
    userCost: UC_BASE,
    ucSmooth: UC_BASE,
    fx: 1,
    fx0: 1,
    dependency: dep0,
    pubProd: 1,
    realWage: 1,
    participation: 1,
    hCap: H_CAP0,
    KG: KG0,
    R: R0,
    permInc: 59.6,
    rtShare: RULE_OF_THUMB,
    credibility: pin.credibility,
    baseConsumption: 1,
    baseWages: 1,
    baseProfits: 1,
    baseProfitsRaw: 1,
    baseAssets: 1,
    baseAssetsRaw: 1,
    assetPrice: 1,
    fuelVolume: 1,
    profitShare: 1,
    profitShift: 1,
    blendedRate: pin.effInterest,
    privateWealth: PRIVATE_WEALTH0,
    retaliation: 0,
    tradeDepth: 0,
    openEff: 0,
    tariffCutEff: 0,
    importTariff: BASE_TARIFF,
    partnerAccessEff: {},
    relImpulse: {},
    missionCd: {},
    dealStress: {},
    diploLedger: {},
    sanctionStance: {},
    relBase: {},
    envoyBuild: {},
    ultimatumCd: {},
    balPrivate: 0,
    balGovt: 0,
    balForeign: 0,
    balResidual: 0,
    residCarry: 0,
    mortgageDebt: MORT_DEBT0,
    mortgageRate: pin.rate,
    housePrice: 100,
    housePriceGrowth: 0,
    housingStock: H0,
    rentIndex: 100,
    housingInvest: 0,
    bankLeverage: BANK_LEV0,
    bankCapital: BANK_CAP0,
    creditSpread: 0,
    bankLoans: BANK_LOANS0,
    bankDeposits: BANK_LOANS0 * 0.92,
    depositRun: 0,
    bankStress: false,
    bankStressCd: 0,
    popWork: popWork0,
    popOld: popOld0,
    popChild: popChild0,
    pensionIndex: 1,
    uncertainty: 0,
    contactHit: 0,
    worldY: 100,
    worldRestY: 100,
    worldDemand0: 0,
    worldP: 1,
    priceP: 1,
    worldShock: 0,
    worldRate: pin.worldRate != null ? pin.worldRate : WORLD_RATE,
    fxUip: pin.fxUip != null ? pin.fxUip : FX_UIP,
    liberty: pin.liberty0 != null ? pin.liberty0 : 58,
    crime: pin.crime0 != null ? pin.crime0 : CRIME_BASE,
    health: pin.health0 != null ? pin.health0 : 55,
    env: pin.env0 != null ? pin.env0 : 44,
    openness: pin.openness0 != null ? pin.openness0 : 50,
    fund: 0,
    otherRevAdj: 0,
    yRel: pin.yRel != null ? pin.yRel : 0.88,
    yRel0: pin.yRel != null ? pin.yRel : 0.88,
    potential0: 100,
    debtAnchor: pin.debt != null ? pin.debt : OPENING.debt,
    birthRate: pin.birthRate != null ? pin.birthRate : BIRTH_RATE,
    migBase: pin.migBase != null ? pin.migBase : MIG_BASE,
    labourGrowth: null,
  };
}
/* Renormalise the level to GDP = 100 after a settle step. Scaling only at the
   end left K* and the consumption target behind and produced a fake Q1 slump. */ function renormaliseOpeningLevel(
  e: any,
  law: any,
) {
  const k = 100 / Math.max(1, e.gdp);
  ["gdp", "C", "I", "X", "M", "K", "KG", "R", "permInc", "Kstar"].forEach(
    (key) => {
      if (e[key] != null) e[key] *= k;
    },
  );
  e.worldY = 100;
  e.worldRestY = 100;
  e.worldDemand0 = 0;
  e.worldP = 1;
  e.priceP = 1;
  e.A = 1;
  e.A = 100 / potentialLevel(law, aggregate(law), e);
  e.potential = 100;
  e.potential0 = 100;
  if (e.yRel0 == null) e.yRel0 = e.yRel != null ? e.yRel : 0.88;
  e.gdp = 100;
}
function settleLabel(i: any) {
  const remaining = SETTLE_QUARTERS - 1 - i;
  const yearsBack = Math.floor(remaining / 4);
  const q = (i % 4) + 1;
  return "\u2212" + yearsBack + "y Q" + q;
}
function syncLogRowToEcon(row: any, e: any, g: any, law: any) {
  if (!row) return;
  const bal = balanceOf(law, e);
  row.debt = e.debt;
  row.inflation = e.inflation;
  row.unemployment = e.unemployment;
  row.rate = e.rate;
  row.yield = e.yield;
  row.gdp = e.gdp;
  row.potential = e.potential;
  row.balance = bal.balance;
  row.rev = bal.rev.total;
  row.spend = bal.sp.prog;
  row.interest = bal.sp.interest;
  row.trend = e.trendGrowth;
  row.K = e.K;
  row.C = e.C;
  row.I = e.I;
  row.X = e.X;
  row.M = e.M;
  row.netTrade = e.X - e.M;
  row.approval = approvalOf(g.fac);
  row.fac = Object.assign({}, g.fac);
  row.drag = dragRatio(law, e);
  row.allowance = law.income.allowance;
  row.fx = fxDisplayIndex("home", {
    econ: e,
    homeRole: g.homeRole,
  });
  row.ccyRates = snapshotCurrencyRates(g);
  row.pre = true;
}
/** During non-home settle, crawl the policy rate toward the Taylor prescription
 *  for the *pinned* inflation (step's Taylor saw a mid-quarter Phillips path that
 *  is then wiped). Keeps real rates coherent for high-CPI seats. */ function applySettleTaylor(
  e: any,
  pin: any,
) {
  const underlying = pin.inflation != null ? pin.inflation : PI_TARGET;
  const target =
    R_NEUTRAL_REAL + underlying + TAYLOR_PI * (underlying - PI_TARGET);
  e.rate = clamp(
    e.rate + (clamp(target, RATE_FLOOR, 20) - e.rate) * TAYLOR_SMOOTH,
    RATE_FLOOR,
    20,
  );
  e.yield = clamp(e.rate + (OPENING.yield - OPENING.rate), 0.2, 25);
  if (e.mortgageRate != null) {
    e.mortgageRate += (e.rate - e.mortgageRate) * 0.2;
  }
  e.atBound = e.rate <= RATE_FLOOR + 0.02;
}
/* Pin headline stocks each quarter and let the expenditure block clear at
   GDP = 100. FX is free (UIP at the Bank rate). Cached per homeRole. */ function settleOpeningEcon(
  pins: any,
  role: any,
) {
  const pin = pins || pinsForRole("home");
  const homeRole = role || "home";
  const statute = lawForRole(homeRole);
  const supply = seatSupplyFromRole(homeRole);
  const freeRate = homeRole !== "home";
  const g: Record<string, any> = {
    q: 0,
    term: 1,
    termStartQ: 0,
    over: false,
    sandbox: false,
    country: "United Kingdom",
    capital: 42,
    whipSpend: 0,
    homeRole,
    log: [],
    mods: [],
    brief: [],
    press: [],
    lastEventQ: -3,
    lastEventId: null,
    lowRun: 0,
    ruleBreaches: 0,
    coachDone: false,
    setPiece8: false,
    setPiece16: false,
    econ: freshEcon(pin),
    fac: openingFac(homeRole),
    parties: seedParties(openingFac(homeRole), statute, homeRole),
    rel: openingRel(homeRole),
    law: clone(statute),
    _settling: true,
  };
  Object.assign(g.econ, supply);
  /* Per-seat pre-tax shape; fixed for the run (not rewritten in step). */ g.econ.incomeDist =
    incomeDistForRole(homeRole);
  g.econ.allowBase = statute.income.allowance;
  if (freeRate) {
    g.rateManual = true;
    g.manualRate = g.econ.rate;
  }
  g.prevLaw = clone(g.law);
  g.draft = clone(g.law);
  plugOpeningDeficit(g.econ, g.law, pin.deficit0);
  for (let i = 0; i < SETTLE_QUARTERS; i++) {
    step(g, g.law, g.law, true);
    const row = g.log[g.log.length - 1];
    if (row) {
      row.label = settleLabel(i);
      row.pre = true;
    }
    /* pinOpeningHeadlines resets rate/inflation/riskPremium/expectations to
       the exact target every quarter, all the way to the end of settle, then
       stops the instant live play begins — the same hard-cutoff problem FX
       itself used to have (see the comment below: forcing FX back to a fixed
       value "reopened a competitiveness jump in Q1"). Over the tail of
       settle, ease the pin's grip on just these FX-relevant fields toward
       whatever the model organically computed that quarter, so the
       underlying state (expectations, credibility, the wage/price loop) is
       already consistent with the target by the time pinning stops for
       real — not just the headline number itself. The guaranteed pin call
       right after this loop still snaps everything to the exact published
       opening figures, so this only affects how settle gets there, never
       what it publishes. */ const quartersToEnd = SETTLE_QUARTERS - 1 - i;
    const taper =
      quartersToEnd < SETTLE_TAPER_QUARTERS
        ? 1 - quartersToEnd / SETTLE_TAPER_QUARTERS
        : 0;
    const organic = taper
      ? {
          rate: g.econ.rate,
          inflation: g.econ.inflation,
          riskPremium: g.econ.riskPremium,
          expect: g.econ.expect,
          credibility: g.econ.credibility,
        }
      : null;
    pinOpeningHeadlines(g.econ, g.law, pin, statute, {
      freeRate,
    });
    if (organic) {
      for (const k of [
        "rate",
        "inflation",
        "riskPremium",
        "expect",
        "credibility",
      ] as const) {
        g.econ[k] += (organic[k] - g.econ[k]) * taper;
      }
    }
    Object.assign(g.econ, supply);
    if (freeRate) {
      applySettleTaylor(g.econ, pin);
      g.manualRate = g.econ.rate;
    }
    renormaliseOpeningLevel(g.econ, g.law);
    plugOpeningDeficit(g.econ, g.law, pin.deficit0);
  }
  const e = g.econ;
  /* Leave FX at its UIP level under the (possibly Taylor-set) Bank rate. Forcing
     fx back to 1 (and burying the gap in priceP) reopened a competitiveness jump
     in Q1. */ pinOpeningHeadlines(e, g.law, pin, statute, {
    freeRate,
  });
  Object.assign(e, supply);
  if (freeRate) {
    applySettleTaylor(e, pin);
    g.manualRate = e.rate;
  }
  e.worldP = 1;
  e.priceP = 1;
  /* Seat-specific public-service volume baseline: at opening statute and unit
     cost, quality/quality0 ≈ 1 so services sit near services0 rather than the
     UK HEALTH+EDU composite. */ e.quality0 =
    (g.law.spend.health || 0) + (g.law.spend.education || 0) * 0.55;
  /* soc0 is the *observed* opening society layer. Opening statute already
     embeds policy/tax/vice liberty and crime effects in aggregate(); subtract
     those opening impulses so steady state holds at soc0 until the law moves. */ {
    const E0 = aggregate(g.law);
    e.socOpen = {
      lib: E0.lib || 0,
      cri: E0.cri || 0,
      hlt: E0.hlt || 0,
      env: E0.env || 0,
      open: E0.open || 0,
      blk: E0.blackLevel || 0,
      justice: g.law.spend.justice || 0,
      envSpend: g.law.spend.environment || 0,
      carbon:
        g.law.taxes.carbon && g.law.taxes.carbon.on
          ? g.law.taxes.carbon.rate
          : 0,
    };
  }
  /* Pin FX baselines after settle so USD GDP opens at gdp0. Leave the live
     UIP level intact; only the denominator of the valuation formula is set. */ e.fx0 =
    e.fx != null ? e.fx : 1;
  if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE)
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
  }
  for (const id in e.nations) {
    const n = e.nations[id];
    ensureNationFx(n);
    n.fx0 = n.fx;
  }
  /* Term starts at currency strength = 100; rewrite settle history to match. */ for (const row of g.log) {
    if (row) row.fx = 100;
  }
  /* row.ccyRates needs the same "flat until term start" treatment row.fx
     gets just above, for every currency uniformly — only the home nation is
     actually simulated during settle, so there is no genuine independent
     trajectory to show for any other currency: fxPairForCurrency() can't see
     a real one either (G.econ.nations isn't populated until after this
     loop), so it was already silently flat for every currency but home.
     Showing real movement for the home currency alone while every other
     currency sat dead flat wasn't "preserving genuine dynamics" — it made
     any comparison that didn't involve the home currency (which the
     currency picker lets the player choose freely) flatline for the whole
     pre-game period and then jump at Q1, the exact artifact row.fx already
     avoids by being flat everywhere. Flatten every currency, including
     home, to its CURRENCY_META baseline for the whole settle run — real
     relative movement begins at term start for every pair, consistently. */
  for (const row of g.log) {
    if (!row || !row.ccyRates) continue;
    for (const code of Object.keys(row.ccyRates)) {
      row.ccyRates[code] = (CURRENCY_META[code] || CURRENCY_META.USD).usdRate;
    }
  }
  e.worldRestY = 100;
  e.worldDemand0 = 0;
  refreshWorldY(e, homeRole);
  e.A = 1;
  e.A = 100 / potentialLevel(g.law, aggregate(g.law), e);
  e.potential = 100;
  e.gdp = 100;
  e.R = R0;
  e.labourGrowth = impliedLabourGrowth(e, aggregate(g.law));
  e.trendGrowth = potentialGrowth(g.law, aggregate(g.law), e);
  plugOpeningDeficit(e, g.law, pin.deficit0);
  syncLogRowToEcon(g.log[g.log.length - 1], e, g, g.law);
  return {
    econ: e,
    log: g.log,
    law: clone(g.law),
  };
}
function openingSnapshot(role: any) {
  const key = role || "home";
  if (!_openingByRole[key])
    _openingByRole[key] = settleOpeningEcon(pinsForRole(key), key);
  const snap = _openingByRole[key];
  return {
    econ: clone(snap.econ),
    log: clone(snap.log),
    law: clone(snap.law || lawForRole(key)),
  };
}
/** Drop cached settles (tests / recalibration after NATION_PROFILE edits). */ function clearOpeningCache() {
  _openingByRole = {};
  clearIncomeDistCache();
}
function openingBrief(pins: any, country: any) {
  const debt = pins.debt;
  const def = pins.deficit0;
  const pi = pins.inflation;
  let fiscal;
  if (def == null) {
    fiscal =
      "Growth is thin, prices are still running hot, and debt is the highest in a generation.";
  } else if (def < 1.5 && debt < 40) {
    fiscal =
      "The books open near balance, with public debt still light by peer standards.";
  } else if (def >= 6 || debt >= 110) {
    fiscal =
      "You inherit a wide deficit and debt already above " +
      debt.toFixed(0) +
      "% of GDP.";
  } else if (pi >= 5) {
    fiscal =
      "Prices are still running hot at " +
      pi.toFixed(1) +
      "%, and the fiscal inheritance is uncomfortable.";
  } else {
    fiscal =
      "Debt sits near " +
      debt.toFixed(0) +
      "% of GDP, with the deficit around " +
      (def != null ? def.toFixed(1) : "4.5") +
      "% — workable, not comfortable.";
  }
  return [
    "You have the keys to the Treasury of " +
      theCountry(country) +
      ". " +
      fiscal,
    "The Bank sets interest rates, not you. The statute book is yours: rates, structures, laws, treaties. All of it costs political capital, and you start with very little.",
  ];
}
function newGame(opts?: any) {
  const o = opts || {};
  _lastQuarterFlashKey = null;
  const wantTutorial = o.tutorial === true;
  /* Tutorial is always the UK seat — copy and relations (e.g. France) assume it. */
  const country = wantTutorial
    ? "United Kingdom"
    : typeof o.country === "string" && o.country.trim()
      ? o.country.trim().slice(0, 34)
      : "United Kingdom";
  const homeRole = wantTutorial
    ? "home"
    : resolveHomeRole(o.homeRole || "home");
  const homeIso = wantTutorial
    ? "826"
    : String(o.homeIso || "826").padStart(3, "0");
  const homeScale =
    typeof o.homeScale === "number" && o.homeScale > 0 ? o.homeScale : null;
  const pins = pinsForRole(homeRole);
  const snap = openingSnapshot(homeRole);
  setG({
    q: 0,
    term: 1,
    termStartQ: 0,
    over: false,
    sandbox: wantTutorial ? true : o.sandbox === true,
    rateManual: false,
    manualRate: OPENING.rate,
    country,
    homeIso,
    homeScale,
    homeRole,
    capital: 42,
    whipSpend: 0,
    log: snap.log,
    mods: [],
    brief: [],
    press: [],
    lastEventQ: -3,
    lastEventId: null,
    lowRun: 0,
    ruleBreaches: 0,
    coachDone: !wantTutorial,
    coach: wantTutorial ? { step: 0, phase: "brief", startQ: 0 } : null,
    setPiece8: false,
    setPiece16: false,
    episode: null,
    nextMajorQ: scheduleNextMajorQ(0, false),
    polityShift: null,
    eventFocus: null,
    eventSponsors: null,
    econ: snap.econ,
    fac: openingFac(homeRole),
    rel: openingRel(homeRole),
    law: snap.law || lawForRole(homeRole),
    blocMember: initBlocState(homeRole),
    customBlocs: {},
    blocInvites: {},
    blocAccession: null,
    blocAccessionByCountry: {},
    envoys: emptyEnvoys(),
    ultimatums: {},
    missionEvents: [],
    activeVisits: {},
    diploAlerts: [],
  });
  syncEnvoysBaseline(G);
  ensureDiploStocks(G.econ);
  seedGameRelBase(G);
  G.prevLaw = clone(G.law);
  G.draft = clone(G.law);
  G.draft.blocAccession = null;
  G.draft.blocLeave = false;
  G.draft.blocCreate = null;
  G.draft.blocInvite = {};
  applyDraftBlocLaw(
    G.law,
    {
      blocMember: G.blocMember,
      customBlocs: G.customBlocs,
    },
    G.draft,
  );
  applyDraftBlocLaw(
    G.draft,
    {
      blocMember: G.blocMember,
      customBlocs: G.customBlocs,
    },
    G.draft,
  );
  initWorldState(G);
  const openingTariffs = snapshotPartnerTariffs(G);
  /* Settle logged partner tariffs without world bags / CU membership, so EU
     members sat at their standalone MFN (1–3%) instead of the CET. Flatten
     the pre-game series to the live opening rates — same treatment as FX. */
  for (const row of G.log || []) {
    row.partnerTariffs = clone(openingTariffs);
  }
  const openingTrade = snapshotPartnerTrade(G);
  /* Same flatten as partnerTariffs: settle ran before world bags existed, so
     inbound flows were missing. Stamp the live opening split on every
     pre-game row so the Net trade partner series does not jump at Q1. */
  for (const row of G.log || []) {
    row.partnerTrade = clone(openingTrade);
  }
  G.parties = seedParties(G.fac, G.law, G.homeRole);
  G.brief = openingBrief(pins, country);
  G.q = 0;
  G.term = 1;
  G.termStartQ = 0;
  G.mods = [];
  G.over = false;
  G.press = [];
  G.briefImpact = null;
  resetPressUi();
  tab = null;
  render();
  /* Opening morning note is first-class, not buried in the Budget drawer. */ if (
    o.silent
  ) {
    closeDespatch();
    bump();
    return;
  }
  const morningHint = careerHint(polityOf(G.homeRole), G.sandbox);
  const morningBody = {
    kind: "briefing",
    data: briefingData(G.brief, { hint: morningHint }),
  };
  if (wantTutorial) {
    despatch("Morning note", "Permanent Secretary", morningBody, [
      {
        b: "Get started",
        e: "Begin the walkthrough",
        f: () => {
          /* Skip already finished the coach — do not re-open it from this note. */
          if (G.coachDone && !G.coach) return;
          beginCoachStep(0);
        },
      },
    ]);
  } else {
    despatch("Morning note", "Permanent Secretary", morningBody, [
      {
        b: "To work",
        e: "Open the statute book",
        f: () => {
          render();
        },
      },
    ]);
  }
}
/* ---- Consumption: Campbell-Mankiw ----
   Two kinds of household. A rule-of-thumb share is liquidity-constrained and
   simply spends its disposable income; the rest smooth against permanent income
   and respond to the real interest rate.

       C = lambda * YD_constrained + (1-lambda) * C_permanent

   This is what makes the *distribution* of a fiscal change matter for demand,
   not only for fairness: money given to constrained households is spent, the
   same money given to unconstrained households is largely saved. With a single
   MPC, as before, redistribution had no effect on aggregate demand at all. */ const RULE_OF_THUMB = 0.4; // share of households spending current income
const MPC_RT = 0.95; // constrained households spend nearly all of it
const MPC_PERM = 0.42; // the rest smooth
const PERM_ADJ = 0.09; // speed at which permanent income updates
/* Constrained households take a smaller share of market income than of
   transfers, which is why a pound of welfare moves demand more than a pound of
   basic-rate tax cut. */ const RT_MARKET_SHARE = 0.26,
  RT_TRANSFER_SHARE = 0.66;
const REDIST_SENS = 0.5; // a more equal distribution raises the constrained share
/* Amplifies the distributional signal into the constrained share. The raw
   spread in aggregate MPC across plausible tax settings is only a point or two,
   which is realistic but too quiet to feel, so it is levered up here. */ /* How hard the distributional MPC feeds into aggregate demand. 0 would ignore
   incidence; 1 would pass it through one-for-one. Anchored near 0.65 so a
   deficit-financed additional-rate cut is not strongly contractionary on impact
   (the yield/FX twin-deficit channel still can be). Pinned by calibration
   ready-reckoners on relative demand from transfers vs rate cuts. */ const MPC_INCIDENCE = 0.65,
  MPC_DIST_BASE = 0.4661;
/* Investment is neoclassical rather than a reduced form. Firms have a desired
   capital stock given by the first-order condition of a Cobb-Douglas production
   function, MPK = user cost:

       alpha * Y / K = uc      =>      K* = alpha * Y / uc

   Investment covers depreciation and trend growth, plus partial adjustment
   toward any gap between desired and actual capital. Corporation tax and the
   policy rate enter through the user cost,

       uc = real rate + depreciation + corporate tax wedge

   which is where they actually bite. Investment then accumulates into the
   capital stock, and the capital stock is an argument of potential output, so a
   decade of weak investment shows up as weak supply instead of being forgotten. */ const ALPHA = 0.33; // capital share of income
const DEPREC = 5.0; // annual depreciation of the capital stock, %
const CORP_WEDGE = 0.027; // points of user cost per point of corporation tax
const K_ADJ = 0.05; // annual speed of adjustment toward desired capital
/* Desired capital is unit-elastic to the user cost under Cobb-Douglas, which at
   quarterly frequency makes investment whipsaw on every move in the policy rate.
   Firms plan against a smoothed cost of capital instead. */ const UC_SMOOTH = 0.07;
const I_ACCEL = 0.1; // short-run accelerator on top of the stock model
const K0 = 300; // private capital stock, about three times annual output
/* Public capital is a separate factor of production. Infrastructure spending
   accumulates into it rather than being credited to TFP through a fudge, and it
   depreciates more slowly than private capital because it is mostly structures. */ const KG0 = 70; // public capital stock, roughly 0.7 of annual output
const ALPHA_G = 0.09; // output elasticity of public capital
const DEPREC_G = 3.2; // annual depreciation of public capital, %
/* Knowledge stock: public (and credited private) R&D accumulates into R and
   lifts TFP growth. Ideas obsolete slower than machines. Steady state at the
   default research spend of 0.7% of GDP is R0 = 0.7 / (DEPREC_R/100). */ const DEPREC_R = 4.0; // annual obsolescence of the knowledge stock, %
const R0 = 0.7 / (DEPREC_R / 100);
const R_TFP = 0.14; // points of annual TFP growth per unit of (R/R0 - 1)
const EDU_RND_SPILL = 0.1; // share of education above baseline that feeds R
/* The bare first-order condition implies more capital than firms actually hold,
   because of adjustment costs, risk premia and mark-ups. This scales K* so that
   the baseline economy sits in steady state. */ /* Anchored on the long-run real rate, not the opening one. The game starts with
   inflation above target and policy therefore restrictive, so desired capital
   starts below its steady state and investment is weak until the Bank can ease.
   That is the position the UK is actually in. */ const UC_BASE =
  3.4 - 2.0 + DEPREC + 25 * CORP_WEDGE;
const KSTAR_SCALE = K0 / ((ALPHA * 100) / (UC_BASE / 100));
/* ==================================================================
   3. AGGREGATION  (what the statute book does to the country)
   ================================================================== */ /** Resolve a `req` array against live law state. Historically `req` always
 *  meant `[viceId, ...allowedStates]` against `law.vice`; a `LawGroupOption`
 *  (see lib/sim/lawGroups.ts) can also gate against `law.polity` or another
 *  law group, using a `"kind:id"` prefix. Bare ids (no prefix) keep meaning
 *  `law.vice[id]`, so every existing vice-gated tax is unaffected. */ function resolveReqState(
  law: any,
  req: string[],
) {
  const [key, ...allowed] = req;
  if (key === "polity") return allowed.includes(law.polity || "democracy");
  const [kind, id] = key.includes(":") ? key.split(":") : ["vice", key];
  const val = kind === "group" ? law.groups && law.groups[id] : law.vice[id];
  return allowed.includes(val);
}
function taxAvailable(t: any, law: any) {
  if (!t.req) return true;
  return resolveReqState(law, t.req);
}
/* First-round CPI contribution from a change in duties, VAT or the tariff. */ function indirectTaxDelta(
  law: any,
  prevLaw: any,
) {
  let d = 0;
  for (const t of TAXES) {
    const pass = (INDIRECT_PASS as any)[t.id];
    if (pass == null) continue;
    const a = prevLaw.taxes[t.id],
      b = law.taxes[t.id];
    if (!a || !b) continue;
    const rateA = a.on && taxAvailable(t, prevLaw) ? a.rate : 0;
    const rateB = b.on && taxAvailable(t, law) ? b.rate : 0;
    d += (rateB - rateA) * pass;
  }
  return d;
}
/* Keys allowed on content `imp`. Anything that moves growth, inflation or the
   NAIRU must go through `ch` (or a tax base / price wedge) instead. */ const IMP_KEYS =
  new Set([
    "gini",
    "srv",
    "lib",
    "cri",
    "hlt",
    "env",
    "eva",
    "blk",
    "rev",
    "spend",
    "open",
    "resilience",
    "trade",
  ]);
const CH_KEYS = new Set([
  "part",
  "labour",
  "migrate",
  "tfp",
  "ucost",
  "replace",
  "mpcw",
  "kboost",
  "access",
  "tariffCut",
  "hbuild",
  "nairu",
  "rndEffort",
  "fertility",
]);
/* ---- Labor & Social Welfare bespoke slider effects ----
   Each mirrors the shape of the generic `add()` loops above but reads a
   plain law.* group rather than a content array, following the law.income/
   law.ni pattern (see CLAUDE.md "TypeScript migration"). Every term is
   measured against the DEF_* default, so a law left at its default
   contributes nothing — only a deviation from it moves the model. */ function workHoursEffect(
  law: any,
) {
  const wh = law.workHours || DEF_WORK_HOURS;
  const dHours = wh.weeklyHours - DEF_WORK_HOURS.weeklyHours;
  const dLeave = wh.leaveDays - DEF_WORK_HOURS.leaveDays;
  return {
    part: -0.08 * dHours - 0.02 * dLeave,
    tfp: -0.012 * dHours,
    fac: {
      workers: -0.5 * dHours + 0.3 * dLeave,
      business: 0.4 * dHours - 0.25 * dLeave,
    },
  };
}
/** Childcare subsidy, 0-100% ("Free" at 100). Supersedes the old boolean
 *  "Universal childcare" policy — at subsidyPct === 100 this reproduces its
 *  exact ch/fac/cost numbers; below that, effects scale linearly. Not in
 *  DIPLO_POLICY_KEYS or any `kills` list, so the clean replacement is safe
 *  (unlike minWage, which stayed additive because it *is* watchlisted). */ function childcareEffect(
  law: any,
) {
  const c = law.childcare || DEF_CHILDCARE;
  const k = (c.subsidyPct || 0) / 100;
  return {
    fac: { workers: 5 * k, urban: 4 * k, business: 2 * k, pensioners: -1 * k },
    ch: { part: 2.5 * k, fertility: 2.6 * k, tfp: 0.04 * k },
    spend: 0.85 * k,
  };
}
/** A statutory minimum-wage rate, distinct from the "Living wage uprating"
 *  policy (see DEF_MIN_WAGE). Scaled so `rate === DEF_MIN_WAGE.rate` exactly
 *  reproduces what that policy already models — this is a genuinely new,
 *  independent lever, not a replacement for it. */ function minWageEffect(
  law: any,
) {
  const mw = law.minWage || DEF_MIN_WAGE;
  if (!mw.on || !(mw.rate > 0)) return { imp: null, fac: null, ch: null };
  const k = mw.rate / DEF_MIN_WAGE.rate;
  return {
    imp: { gini: -0.3 * k },
    fac: { workers: 6 * k, business: -6 * k, rural: -2 * k },
    ch: {
      replace: 1.0 * k,
      mpcw: 4.0 * k,
      ucost: 0.02 * k,
      nairu: 0.03 * k,
      part: 0.05 * k,
    },
  };
}
/** Level shift in the minimum-wage rate this quarter, feeding the wage/price
 *  block the same way the employer-NI-rate delta (`dEr`) does. */ function minWageRateOf(
  law: any,
) {
  return law.minWage && law.minWage.on ? law.minWage.rate : 0;
}
function electoralEffect(law: any) {
  const el = law.electoral || DEF_ELECTORAL;
  const dAge = el.votingAge - DEF_ELECTORAL.votingAge;
  const fac: Record<string, number> = {
    urban: -0.15 * dAge,
    rural: 0.1 * dAge,
  };
  const imp: Record<string, number> = {};
  if (el.mandatoryVoting) {
    fac.workers = (fac.workers || 0) + 1;
    fac.patriots = (fac.patriots || 0) - 1;
    imp.lib = -0.5;
  }
  return { imp, fac };
}
/** Retirement age feeds labour supply directly through `ch.labour` — the
 *  same multiplier the demography block's own labour-force growth already
 *  goes through (`force = L*(1+E.labour/100)*part`). Deliberately does NOT
 *  touch `ageingLabourDrag`/`DEP_0`: CLAUDE.md flags the cohort dependency
 *  identity as load-bearing and required to mirror step()'s demography
 *  block exactly, so a second independent lever into it is out of scope
 *  here. */ function pensionEffect(law: any) {
  const p = law.pension || DEF_PENSION;
  const dAge = p.retirementAge - DEF_PENSION.retirementAge;
  return {
    ch: { labour: 0.35 * dAge },
    fac: { pensioners: -0.6 * dAge, workers: 0.15 * dAge },
  };
}
function aggregate(law: any, homeRole?: any, blocMember?: any): any {
  /* `ch` carries effects that act through a real channel: labour supply, the
     capital stock, productivity, the cost of capital, the replacement ratio,
     migration, housing investment, market access. Those reach output the way
     the thing they describe actually would. `imp` is kept only for the social
     indicators and a few fiscal/trade bookkeeping fields — never pot/gro/inf. */ const E: Record<
    string,
    any
  > = {
    gini: 0,
    srv: 0,
    lib: 0,
    cri: 0,
    hlt: 0,
    env: 0,
    nairu: 0,
    eva: 0,
    blk: 0,
    rev: 0,
    spend: 0,
    open: 0,
    resilience: 0,
    trade: 0,
    part: 0,
    labour: 0,
    migrate: 0,
    tfp: 0,
    ucost: 0,
    replace: 0,
    mpcw: 0,
    kboost: 0,
    hbuild: 0,
    access: 0,
    tariffCut: 0,
    dealOpen: 0,
    dealTariffCut: 0,
    rndEffort: 0,
    fertility: 0,
    fac: {
      business: 0,
      workers: 0,
      pensioners: 0,
      urban: 0,
      rural: 0,
      patriots: 0,
    },
  };
  const add = function (imp: any, fac: any, k: any = 1, ch?: any) {
    if (imp)
      for (const key in imp) {
        if (!IMP_KEYS.has(key)) continue;
        if (key in E) (E as any)[key] += imp[key] * k;
      }
    if (ch)
      for (const key in ch) {
        if (!CH_KEYS.has(key) && key !== "tariffCut" && key !== "access")
          continue;
        if (key in E) (E as any)[key] += ch[key] * k;
      }
    if (fac) {
      for (const f in fac) if (f in E.fac) (E.fac as any)[f] += fac[f] * k;
    }
  };
  add(FLAT_BONUS.imp, FLAT_BONUS.fac, isFlatIncome(law) ? 1 : 0, FLAT_BONUS.ch);
  add(
    DUAL_BONUS.imp,
    DUAL_BONUS.fac,
    isDualCapital(law) ? 1 : 0,
    DUAL_BONUS.ch,
  );
  add(null, LAND_BONUS.fac, landCommitment(law), LAND_BONUS.ch);
  add(
    null,
    CONSUMPTION_BONUS.fac,
    consumptionCommitment(law),
    CONSUMPTION_BONUS.ch,
  );
  for (const t of TAXES) {
    const s = law.taxes[t.id];
    if (!s || !s.on || !taxAvailable(t, law)) continue;
    add(t.imp, t.fac, s.rate - t.def, t.ch);
  }
  /* Tariffs: openness and faction effects here; the price and volume channels
     run through import prices and Marshall–Lerner competitiveness below. */ add(
    {
      open: -0.55,
    },
    {
      patriots: 0.55,
      business: -0.38,
      rural: 0.3,
      urban: -0.2,
    },
    law.tariff,
  );
  for (const id in law.policies) {
    if (!law.policies[id]) continue;
    const p = (POLICY_BY_ID as any)[id];
    if (!p) continue;
    add(p.imp, p.fac, 1, p.ch);
    E.spend += p.cost || 0;
    if (p.resilience) E.resilience += p.resilience;
    if (p.trade) E.trade += p.trade;
  }
  for (const v of VICE) {
    const st = v.states.find((s) => s.id === law.vice[v.id]);
    if (st) add(st.imp, st.fac);
  }
  /* State & Constitution / Labor & Welfare: the generalised "pick one of N"
     pattern (lib/sim/lawGroups.ts), summed the same way as the VICE loop
     just above — one generic block regardless of how many groups exist. */ for (const grp of LAW_GROUPS) {
    const opt =
      (law.groups && grp.options.find((o) => o.id === law.groups[grp.id])) ||
      null;
    if (opt) add(opt.imp, opt.fac, 1, opt.ch);
  }
  const wh = workHoursEffect(law);
  add(null, wh.fac, 1, { part: wh.part, tfp: wh.tfp });
  const mw = minWageEffect(law);
  add(mw.imp, mw.fac, 1, mw.ch);
  const el = electoralEffect(law);
  add(el.imp, el.fac);
  const pe = pensionEffect(law);
  add(null, pe.fac, 1, pe.ch);
  const cc = childcareEffect(law);
  add(null, cc.fac, 1, cc.ch);
  E.spend += cc.spend;
  for (const id in law.deals) {
    if (!law.deals[id]) continue;
    const d = dealById(id);
    if (!d) continue;
    /* Trade-volume channels phase in through stocks in expenditureStep.
       Applying open / tariffCut / access in full on the enactment quarter
       front-loaded growth as a one-off level jump; peel them into deal*
       targets so only DEAL_PHASE of the gap closes each quarter. */ const imp =
      d.imp ? Object.assign({}, d.imp) : null;
    const ch = d.ch ? Object.assign({}, d.ch) : null;
    if (imp && imp.open) {
      E.dealOpen += imp.open;
      delete imp.open;
    }
    if (ch && ch.tariffCut) {
      E.dealTariffCut += ch.tariffCut;
      delete ch.tariffCut;
    }
    if (ch && ch.access) delete ch.access;
    add(imp, d.fac, 1, ch);
    if (d.resilience) E.resilience += d.resilience;
  }
  const role = homeRole != null ? homeRole : (G && G.homeRole) || "home";
  const bm = blocMember != null ? blocMember : (G && G.blocMember) || {};
  const pat = partnerAccessTargets(law, role, bm);
  E.partnerAccess = pat;
  E.access = Object.values(pat).reduce((s, v) => s + v, 0);
  E.blackLevel = clamp(10 + E.blk, 0, 78);
  return E;
}
/* How far a tax's own base has moved from its opening level. */ function taxBaseIndex(
  t: any,
  econ: any,
) {
  if (!econ || !t.basis) return 1;
  switch (t.basis) {
    case "consumption":
      return clamp(econ.baseConsumption || 1, 0.4, 2.2);
    case "wages":
      return clamp(econ.baseWages || 1, 0.4, 2.2);
    case "profits":
      return clamp(econ.baseProfits || 1, 0.2, 3.0);
    case "assets":
      return clamp(econ.baseAssets || 1, 0.2, 3.0);
    case "volume":
      return clamp(econ.fuelVolume || 1, 0.1, 1.5);
    default:
      return 1;
  }
}
function revenue(law: any, E: any, econ?: any) {
  const mult = regimeMultipliers(law);
  const by: Record<string, any> = {};
  let total = 0;
  for (const t of TAXES) {
    const s = law.taxes[t.id];
    if (!s || !s.on || !taxAvailable(t, law)) continue;
    let base = t.base * ((mult as any)[t.grp] || 1);
    if (t.grp === "vice") base *= 1 - E.blackLevel / 100;
    base *= taxBaseIndex(t, econ);
    const y = Math.max(
      0,
      s.rate *
        base *
        baseResponse(s.rate, t.def, t.eti) *
        (1 - clamp(E.eva, -0.7, 0.7) * 0.05),
    );
    (by as any)[t.id] = y;
    total += y;
  }
  const inc = incomeYield(
    law,
    E,
    econ || (typeof G !== "undefined" && G ? G.econ : null),
  );
  by.incomeTax = inc.income;
  by.niEmployee = inc.employee;
  by.niEmployer = inc.employer;
  total += inc.total;
  const adj = (econ && econ.otherRevAdj) || 0;
  const hr = (typeof G !== "undefined" && G && G.homeRole) || "home";
  const avgTariff = tariffScheduleAverage(law, hr);
  const other = OTHER_REV + adj + E.rev + avgTariff * 0.055;
  return {
    total: total + other,
    by,
    other,
    inc,
  };
}
/* The welfare line is generosity, not a total. What it costs depends on how many
   people are claiming, and that moves with the cycle: roughly 0.3 points of GDP
   for every point of unemployment above equilibrium, which is the size of the
   UK's cyclical welfare bill. This is the automatic stabiliser working on the
   spending side, and it means a recession widens the deficit whether or not the
   Chancellor does anything. */ const CYCLICAL_WELFARE = 0.3;
/* Receipts are about 1.3 times as elastic as output over the cycle. */ const REV_GAP_ELAST = 0.3;
/* ---- Tax bases are not GDP ----
   Every tax here used to sit on a base proportional to output, which is the
   crudest thing left in the revenue model. They sit on different aggregates and
   those aggregates move very differently over a cycle:

     consumption   VAT and the duties, which track C rather than Y
     wages         income tax and NI, which track the wage bill
     profits       corporation tax, on the most cyclical base there is
     assets        capital gains, inheritance and transaction taxes, which
                   track asset prices and therefore move inversely with rates
     volume        fuel duty, on a base that shrinks as engines improve

   The profit share swings two to three times as hard as output, which is why
   corporation tax receipts collapse in a recession and overshoot in a boom.
   Asset prices are discounted at the real rate, so a tightening cycle takes
   capital gains receipts with it. And fuel duty sits on a physically declining
   base, which is a real fiscal problem rather than a modelling curiosity. */ const PROFIT_CYC = 2.6; // profit share elasticity to the output gap
const ASSET_RATE = 7.5; // asset price sensitivity to the real rate
const ASSET_ADJ = 0.22;
const FUEL_EROSION = 1.6; // annual decline in the fuel base, %
const CARBON_EROSION = 0.05; // extra decline per point of carbon price
const CORP_LAG = 0.3; // corporation tax is paid in arrears
const CGT_LAG = 0.25;
const PENSION_GDP_SHARE = 5.8; // roughly the state-pension share inside welfare
const TRIPLE_FLOOR = 2.5; // statutory floor under the triple lock, %/year
/* Deliberately close to DEF_PENSION.statePensionAnnual (12000) so the floor
   below lands ≈0.96 at the default — matching the typical benefit/caseload
   value almost exactly, rather than introducing a jump on a fresh game. */ const PENSION_ADEQUACY_REF = 12500;
function welfareCost(law: any, econ: any) {
  const u = (econ && econ.unemployment) || U_STAR;
  /* Triple lock: the state pension rises by max(earnings growth, CPI, 2.5%)
     each year. Cost = baseline pension share × (index − 1) × old-age caseload. */ const lockOn =
    !!(law.policies && law.policies.tripleLock);
  const idx = (econ && econ.pensionIndex) || 1;
  const oldLoad = ((econ && econ.popOld) || POP_OLD0) / POP_OLD0;
  const lockCost = lockOn
    ? PENSION_GDP_SHARE * Math.max(0, idx - 1) * oldLoad
    : 0;
  return law.spend.welfare + lockCost + CYCLICAL_WELFARE * (u - U_STAR);
}
/* ---- Service level per department ----
   A budget is an input; what matters is what it buys. Volume is real spending
   divided by the unit cost of delivery, need is the population it has to cover,
   and the score is the ratio, indexed so the opening settings score 55.

   This is why a share of GDP is a poor control on its own: hold it constant and
   the score still falls, because the unit cost of delivery rises faster than the
   money does. The Budget panel therefore shows both, and offers to hold the
   score steady and let the cost follow, which is the honest way round. */ function deptUnitCost(
  econ: any,
) {
  return ((econ && econ.realWage) || 1) / ((econ && econ.pubProd) || 1);
}
function deptNeed(id: DeptId, econ: any) {
  const pop = ((econ && econ.L) || 100) / 100;
  const dep = (econ && econ.dependency) || DEP_0;
  const ageing = id === "health" ? 1 + AGEING_HEALTH * (dep - DEP_0) : 1;
  return pop * ageing;
}
function serviceScore(id: DeptId, law: any, econ: any) {
  const d = DEPTS.find((x) => x.id === id)!;
  if (!d || (TRANSFER_DEPTS as any)[id]) return null;
  const gdp = (econ && econ.gdp) || 100;
  const volume = ((law.spend[id] / 100) * gdp) / deptUnitCost(econ);
  return clamp(
    (55 * (volume / deptNeed(id, econ))) / ((d.def / 100) * 100),
    0,
    100,
  );
}
/* The budget that would hold a given score: cost follows the standard, rather
   than the standard following whatever the budget happens to buy. */ function spendForScore(
  id: DeptId,
  score: any,
  econ: any,
) {
  const d = DEPTS.find((x) => x.id === id)!;
  const gdp = (econ && econ.gdp) || 100;
  const volume = (score / 55) * ((d.def / 100) * 100) * deptNeed(id, econ);
  return clamp(((volume * deptUnitCost(econ)) / gdp) * 100, d.min, d.max);
}
/* Hold mode freezes a service standard. The slider still edits % of GDP, so the
   held score must be derived from the live spend before the bill becomes law —
   otherwise a drag that only updated spend snaps back to the old hold on step. */ function syncServiceHolds(
  law: any,
  econ: any,
) {
  if (!law || !law.mode) return;
  if (!law.hold) law.hold = {};
  for (const d of DEPTS) {
    if ((TRANSFER_DEPTS as any)[d.id]) continue;
    if (law.mode[d.id] !== "service") {
      delete law.hold[d.id];
      continue;
    }
    const score = serviceScore(d.id, law, econ);
    if (score != null) law.hold[d.id] = score;
  }
}
/* What a claimant actually receives: the bill divided by the caseload, which
   rises with unemployment and with the old-age dependency ratio. */ function welfareAdequacy(
  law: any,
  econ: any,
) {
  const u = (econ && econ.unemployment) || U_STAR;
  const dep = (econ && econ.dependency) || DEP_0;
  const caseload =
    1 + (u - U_STAR) * 0.055 + AGEING_PENSION * Math.max(0, dep - DEP_0);
  const idx = (econ && econ.pensionIndex) || 1;
  const lockOn = !!(law.policies && law.policies.tripleLock);
  const benefit = (law.spend.welfare / 13.3) * (lockOn ? idx : 1);
  const floor =
    ((law.pension || DEF_PENSION).statePensionAnnual || 0) /
    PENSION_ADEQUACY_REF;
  return Math.max(benefit / caseload, floor);
}
function spending(law: any, E: any, econ: any) {
  let prog = 0;
  for (const d of DEPTS)
    prog += d.id === "welfare" ? welfareCost(law, econ) : law.spend[d.id];
  prog += OTHER_SPEND + E.spend;
  const il =
    IL_REAL_COUPON +
    Math.max(-2, econ.inflation !== undefined ? econ.inflation : 2);
  const blended = (1 - INDEX_LINKED) * econ.effInterest + INDEX_LINKED * il;
  const interest = (econ.debt * blended) / 100;
  return {
    prog,
    interest,
    total: prog + interest,
  };
}
function balanceOf(law: any, econ: any) {
  const E = aggregate(law);
  const rev = revenue(law, E, econ),
    sp = spending(law, E, econ);
  return {
    E,
    rev,
    sp,
    balance: rev.total - sp.total,
  };
}
/* ---- Potential output from a production function ----
     Y* = A * K^alpha * (L*h)^(1-alpha)
   so trend growth is growth accounting rather than an assumed number:
     g(Y*) = g(A) + alpha*g(K) + (1-alpha)*(g(L) + g(h))

   A is total factor productivity, which trend growth in the UK has been weak
   enough to make the binding constraint; K comes from the investment block, so
   a decade of weak investment now shows up in supply; L is the labour force net
   of structural unemployment, which is where migration policy and the tax wedge
   enter; h is human capital from education spending, with Mincerian returns. */ /* Participation responds to the net-of-tax wage. The elasticity is deliberately
   modest: prime-age men barely move, while second earners and those near
   retirement move a good deal, and 0.15 is roughly the aggregate of that. This
   is a margin the model previously did not have at all, so income tax could
   only affect employment through the wage-bargaining wedge. */ const PART_ELAST = 0.15,
  PART_ADJ = 0.09;
const HYSTERESIS = 0.22; // how far potential follows a sustained output gap
/* Shared advanced-economy TFP residual. Per-seat differences come from
   catch-up (relative income yRel), knowledge, openness and trade — not a
   per-realm tfpTrend table. */ const TFP_FRONTIER = 0.72;
const CATCHUP_K = 2.15; // points of annual TFP per log(1/yRel)
const FERTILITY_CH = 2.2; // birth-rate response to policy fertility channel
const WELFARE_FERT = 0.012; // birth-rate elasticity to welfare pts above 13.3
const MINCER = 0.06; // return to a point of GDP of extra education spend
/* Human capital is a stock, not a flow on current education spend. Schools and
   colleges build it; skills decay; cutting education scars potential with a lag. */ const H_CAP0 = 1.0;
const DEPREC_H = 2.8; // annual decay of excess human capital, %
const H_BUILD = 0.55; // annual build rate per point of GDP of education above floor
const EDU_FLOOR = 3.35; // education share that holds H_CAP0 steady at opening spend 4.1
const A0 =
  100 /
  (Math.pow(K0, ALPHA) *
    Math.pow(KG0, ALPHA_G) *
    Math.pow(100, 1 - ALPHA - ALPHA_G));
function humanCapital(law: any, econ: any) {
  const stock = econ && econ.hCap != null ? econ.hCap : H_CAP0;
  const edu = (law && law.spend && law.spend.education) || 4.1;
  const flow = MINCER * (edu - 4.1);
  /* Stock dominates long-run supply. A thin contemporaneous flow keeps the
     education slider visible in potentialLevel / projections immediately. */ return clamp(
    stock + flow * 0.25,
    0.72,
    1.45,
  );
}
function humanCapitalTarget(law: any, E: any, _econ: any) {
  const edu = (law && law.spend && law.spend.education) || 4.1;
  const skillsBoost = E && E.hbuild ? E.hbuild * 0.08 : 0;
  const mig = E && E.migrate ? E.migrate * 0.015 : 0;
  /* Steady-state index consistent with education spend and policy feeders. */ return clamp(
    H_CAP0 + MINCER * (edu - 4.1) + skillsBoost + mig,
    0.72,
    1.45,
  );
}
function stepHumanCapital(law: any, E: any, econ: any) {
  const e = econ;
  if (e.hCap == null) e.hCap = H_CAP0;
  const edu = (law.spend && law.spend.education) || 4.1;
  const invest =
    (H_BUILD * Math.max(0, edu - EDU_FLOOR)) / 100 +
    ((E && E.hbuild) || 0) * 0.012 +
    Math.max(0, (E && E.migrate) || 0) * 0.002;
  const decay = (DEPREC_H / 100) * Math.max(0, e.hCap - 0.85);
  e.hCap = clamp(e.hCap + (invest - decay) / 4, 0.72, 1.45);
  /* Soft pull toward the target so a sustained education cut does scar. */ const target =
    humanCapitalTarget(law, E, e);
  e.hCap += (target - e.hCap) * 0.02;
  e.hCap = clamp(e.hCap, 0.72, 1.45);
}
/* R&D effort as a share of GDP: the research budget, a small spillover from
   education above baseline (universities), and any private effort pulled in by
   research-credit policy. Public spend already enters G; private rndEffort also
   lifts desired investment in expenditureStep so the credit is not a pure
   fiscal drain while the knowledge stock is still catching up. */ function researchEffort(
  law: any,
  E: any,
) {
  const spend = (law.spend && law.spend.research) || 0;
  const edu = (law.spend && law.spend.education) || 4.1;
  const spill = EDU_RND_SPILL * Math.max(0, edu - 4.1);
  return spend + spill + ((E && E.rndEffort) || 0);
}
function knowledgeTfp(econ: any) {
  const R = econ && econ.R != null ? econ.R : R0;
  return R_TFP * (R / R0 - 1);
}
/* Relative income vs the frontier (federated ≈ 1). Catch-up TFP growth for
   seats below the frontier — Barro-style log gap, not a per-realm tfpTrend. */ function tfpCatchupRate(
  econ: any,
) {
  const y = econ && econ.yRel != null ? econ.yRel : 1;
  return (
    CATCHUP_K * Math.max(0, Math.log(1 / Math.max(0.08, clamp(y, 0.08, 1.6))))
  );
}
function baselineTfpGrowth(econ: any) {
  return TFP_FRONTIER + tfpCatchupRate(econ);
}
/** Pin opening relative-income / potential baselines once per seat. */ function ensureYRelPins(
  econ: any,
) {
  if (!econ) return;
  if (econ.yRel0 == null) econ.yRel0 = econ.yRel != null ? econ.yRel : 0.88;
  if (econ.potential0 == null || !(econ.potential0 > 0))
    econ.potential0 = econ.potential != null ? econ.potential : 100;
}
/** Live relative income: opening yRel scaled by own potential path vs the
 *  frontier (US) potential path. Catch-up fades as a seat converges. */ function liveYRel(
  econ: any,
  frontierEcon: any,
) {
  ensureYRelPins(econ);
  if (!frontierEcon) return clamp(econ.yRel0, 0.08, 1.6);
  ensureYRelPins(frontierEcon);
  const own = (econ.potential || 100) / Math.max(1e-6, econ.potential0);
  const fr =
    (frontierEcon.potential || 100) / Math.max(1e-6, frontierEcon.potential0);
  return clamp((econ.yRel0 * own) / Math.max(1e-6, fr), 0.08, 1.6);
}
function refreshSeatYRel(econ: any, frontierEcon: any) {
  if (!econ) return;
  const target = liveYRel(econ, frontierEcon);
  const cur = econ.yRel != null ? econ.yRel : target;
  econ.yRel = clamp(cur * 0.82 + target * 0.18, 0.08, 1.6);
}
/** After world partners and the player have new potential levels, refresh
 *  every seat's yRel so catch-up is endogenous. */ function refreshWorldYRel(
  g: any,
) {
  if (!g || !g.econ) return;
  const frontierId = "united_states";
  let frontier = null;
  const playerId = playerCountryId(g.homeRole);
  if (playerId === frontierId) frontier = g.econ;
  else if (g.world && g.world[frontierId] && g.world[frontierId].econ)
    frontier = g.world[frontierId].econ;
  refreshSeatYRel(g.econ, frontier);
  if (!g.world) return;
  for (const id of Object.keys(g.world)) {
    const bag = g.world[id];
    if (!bag || !bag.econ || bag.econ === g.econ) continue;
    refreshSeatYRel(bag.econ, frontier);
  }
}
/* Births per working-age head per quarter, moved by fertility policy and a
   thin welfare-generosity link. */ function effectiveBirthRate(
  econ: any,
  law: any,
  E: any,
) {
  const base = econ && econ.birthRate != null ? econ.birthRate : BIRTH_RATE;
  const fert = (E && E.fertility) || 0;
  const wel =
    law && law.spend && law.spend.welfare != null ? law.spend.welfare : 13.3;
  const welBoost = 1 + WELFARE_FERT * Math.max(0, wel - 13.3);
  return clamp(
    base * (1 + (FERTILITY_CH * fert) / 100) * welBoost,
    0.0004,
    0.014,
  );
}
/* Participation drag on the labour force from an ageing workforce, %/year.
   Shared by the L step and impliedLabourGrowth so the growth-accounting trend
   and the simulated labour force cannot disagree. */ function ageingLabourDrag(
  econ: any,
) {
  const dep = econ && econ.dependency != null ? econ.dependency : DEP_0;
  return (dep - DEP_0) * 15 * 0.15;
}
/* Annualised labour-force growth implied by the cohort stocks: the same
   ageing-in / ageing-out / migration arithmetic the popWork step applies,
   less the ageing participation drag the L step applies. This MUST mirror the
   demography block in step(): trend growth (potentialGrowth) and Okun's law
   both benchmark against it, so any wedge between this and the simulated L
   shows up as a permanent unemployment drift and a mispriced trend. Seat
   differences come from migBase, birthRate and popChild — no labourTrend
   table. */ function impliedLabourGrowth(econ: any, E: any) {
  const e = econ || {};
  const pw = Math.max(1, e.popWork != null ? e.popWork : POP_WORK0);
  const pc = e.popChild != null ? e.popChild : POP_CHILD0;
  const mig =
    (e.migBase != null ? e.migBase : MIG_BASE) + ((E && E.migrate) || 0);
  const cohort = ((AGE_IN * pc - AGE_OUT * pw) / pw) * 400;
  return clamp(cohort + mig - ageingLabourDrag(e), -1.5, 6);
}
function labourGrowthRate(econ: any, E: any) {
  /* Prefer demography-implied growth for the accounting identity. Tracking
     quarter-to-quarter ΔL whipsaws after settle renormalisation. */ return impliedLabourGrowth(
    econ,
    E,
  );
}
/* Effective labour input: the labour force less structural unemployment, times
   human capital. Migration policy moves the force itself. */ function labourInput(
  law: any,
  E: any,
  econ: any,
) {
  const uStar = (econ && econ.nairu) || U_STAR;
  const part = (econ && econ.participation) || 1;
  const force = ((econ && econ.L) || 100) * (1 + (E.labour || 0) / 100) * part;
  return (
    ((force * (1 - uStar / 100)) / (1 - U_STAR / 100)) * humanCapital(law, econ)
  );
}
function potentialLevel(law: any, E: any, econ: any) {
  const K = (econ && econ.K) || K0;
  const KG = (econ && econ.KG) || KG0;
  const A = (econ && econ.A) || A0;
  return (
    A *
    Math.pow(Math.max(1, K), ALPHA) *
    Math.pow(Math.max(1, KG), ALPHA_G) *
    Math.pow(Math.max(1, labourInput(law, E, econ)), 1 - ALPHA - ALPHA_G)
  );
}
/* Annualised trend growth, reported for display and used by the investment
   block. Derived from the production function rather than asserted. */ function potentialGrowth(
  law: any,
  E: any,
  econ: any,
) {
  const e = econ || (typeof G !== "undefined" && G ? G.econ : null);
  if (!e || !e.K) return 1.2;
  const gL = labourGrowthRate(e, E);
  const gA =
    baselineTfpGrowth(e) +
    (E.tfp || 0) +
    (e.tradeDepth || 0) * TRADE_TFP +
    (clamp(50 + (E.open || 0) + (e.openEff || 0), 5, 95) - 50) * 0.006 +
    knowledgeTfp(e);
  const gK = ((e.I - (DEPREC / 100) * e.K) / e.K) * 100;
  const gKG =
    (((law.spend.infra / 100) * e.gdp - (DEPREC_G / 100) * e.KG) / e.KG) * 100;
  return clamp(
    gA + ALPHA * gK + ALPHA_G * gKG + (1 - ALPHA - ALPHA_G) * gL,
    -2.5,
    8,
  );
}
function approvalOf(fac: any) {
  return FACTIONS.reduce((a, f) => a + fac[f.id] * f.w, 0);
}
/* ==================================================================
   THE EXPENDITURE SIDE
   Output is the national accounts identity, Y = C + I + G + X - M,
   with each component given its own behavioural equation. Nothing here
   is a "multiplier weight": multipliers are emergent, falling out of the
   marginal propensity to consume, the tax take and import leakage in
   the usual way, 1 / (1 - c(1-t)(1-m)).
   ================================================================== */ /* Baseline shares of GDP, chosen to match a mid-sized open economy and to sum
   to 100: C 62 + I 18 + G 23 + X 30 - M 33. */ /* UK 2025-26 outturn, as shares of GDP. Household plus non-profit consumption
   about 61 (ONS put household spending alone at 59% in 2025), private and
   dwellings investment 17, government consumption and investment 22, exports 31
   and imports 31. They sum to 100 by construction. */ const SHARE_C = 61,
  SHARE_I = 17,
  SHARE_G = 22,
  SHARE_X = 31,
  SHARE_M = 31;
/* Which spending is government demand and which is a transfer to households.
   Transfers are not G: they are income, and they reach output only through the
   consumption function. Getting this wrong would double-count the welfare bill. */ const TRANSFER_DEPTS =
  {
    welfare: true,
  };
const OTHER_G = 1.8,
  OTHER_TRANSFER = 5.9; // splits OTHER_SPEND (research carved out)
/* Import content of each spending line. A pound of defence procurement leaks
   abroad far faster than a pound of nurses' pay, which is why the two do not
   share a multiplier even though both are government consumption. */ const IMPORT_CONTENT =
  {
    health: 0.08,
    education: 0.05,
    infra: 0.18,
    research: 0.15,
    defence: 0.3,
    justice: 0.07,
    environment: 0.12,
    welfare: 0.1,
    other: 0.12,
  };
/* Consumption. Partial adjustment toward a target set by disposable income.
   Most of the interest-rate channel now runs through the mortgage stock below;
   C_RATE is the residual non-mortgage credit term. */ const C_ADJ = 0.34,
  C_RATE = 0.08,
  HH_TAX_SHARE = 0.7;
/* Precautionary saving and contact-intensive capacity: event shocks land here
   rather than as a naked demand add to C. */ const C_UNC = 0.55; // consumption response to uncertainty stock
const C_CONTACT = 0.7; // consumption response to contact-capacity hit
const I_UNC = 0.45; // investment response to uncertainty
const UNC_DECAY = 0.72; // quarterly persistence of uncertainty
const CONTACT_DECAY = 0.65;
/* Income tax plus NI on the extra earned, then VAT and duty on what is spent. */ const MARGINAL_LEAK = 0.44;
/* Pinned so that at the baseline (Y = potential = 100, receipts 37.6% of GDP,
   transfers 15.4% of GDP) the consumption function returns exactly SHARE_C. */ const C_AUTO = 6.23;
const R_REAL_NEUTRAL = R_NEUTRAL - PI_TARGET;
/* ---- Housing / mortgage transmission ----
   UK mortgages reprice slowly (fixation), so Bank rate changes land on debt
   service with a lag. House prices carry a wealth effect into consumption, and
   the mortgage stock responds to prices and the effective mortgage rate.

   The dwelling stock is a diPasquale–Wheaton stock-flow: construction responds
   to the ratio of house prices to build costs, public housebuilding adds to the
   stock directly, and rents clear against vacancy. Prices are the capitalised
   rent at the current user cost of housing. */ const MORT_DEBT0 = 65; // mortgage stock, % of GDP
const MORT_SPREAD = 0.45; // mortgage rate above Bank rate when fully passed through
const MORT_FIX = 0.1; // quarterly share of mortgages that reprice (~2.5y half-life)
const MORT_NEUTRAL = 3.75; // effective rate at which debt service is neutral for C
const C_MORT = 0.85; // consumption response to mortgage service gap
const MORT_STOCK_ADJ = 0.06; // slow mean-reversion of the mortgage stock
const HP_ADJ = 0.12; // house-price partial adjustment
const HH_HOUSING_WEALTH = 300; // housing wealth, % of GDP
const C_WEALTH = 0.0075; // quarterly MPC out of housing-wealth gains
/* Net private *financial* wealth (ex housing), % of GDP. Accumulates the
   private sectoral balance and feeds a small wealth effect into C plus a
   collateral channel into the credit spread. */ const PRIVATE_WEALTH0 = 80;
const C_FIN_WEALTH = 0.0045; // quarterly MPC out of financial-wealth gap
const WEALTH_COLLAT = 0.04; // credit-spread relief per 10pp of excess financial wealth
const RESID_C_ADJ = 0.12; // share of sectoral residual absorbed into C next quarter
const H0 = 100; // dwelling stock index
const H_DEPREC = 0.45; // annual depreciation / obsolescence of dwellings, %
const H_BUILD_ELAST = 0.55; // construction response to price/cost ratio
const H_BUILD_BASE = 0.55; // baseline gross investment, % of stock per year
const RENT_VAC_ELAST = 1.4; // rent response to vacancy
const RENT_Y_ELAST = 0.35; // rent response to the output gap
const RENT_CTRL_CUT = 0.12; // rent-control haircut on market rent
const CAP_RATE0 = 0.035; // baseline capitalisation rate for house prices
/* ---- Credit accelerator (Bernanke–Gertler–Gilchrist) ----
   Bank capital accumulates net interest margin less loan losses. Leverage and
   the credit spread follow; deposit-run risk gates mortgage supply. */ const BANK_LEV0 = 12.5; // assets / equity
const BANK_LEV_TARGET = 12.0;
const BANK_CAP0 = 8.0; // bank capital, index
const BANK_LOANS0 = 95; // loan book, % of GDP (mortgages + corporate)
const BANK_NIM = 0.35; // quarterly NIM contribution to capital at baseline
const BANK_LGD = 0.45; // loss given default
const CREDIT_PHI = 0.18; // spread points per point of excess leverage
const CREDIT_SOV = 0.35; // sovereign yield pass-through into bank capital
const MORT_CREDIT_ELAST = 0.55; // mortgage-stock response to credit supply
const PD_U = 0.012; // PD points per point of unemployment gap
const PD_LTV = 0.008; // PD points per 10pp of LTV above 70
const PD_HOUSE = 0.01; // PD points per point of annualised house-price fall
const CREDIT_I_PASS = 1.35; // user-cost points per point of credit spread
/* Sovereign fiscal conditions pass mildly into private finance. High debt raises
   the user cost; once debt is in a comfortable band, further consolidation does
   not keep cheapening capital — that was the surplus→investment spiral. */ const DEBT_UC_HI = 110; // above this, debt starts raising uc (yields already bite earlier)
const DEBT_UC_LO = 55; // below this, further falls barely help
const DEBT_UC_HI_K = 0.004; // mild uc points per (debt-110) ^1.1 — yields do the heavy lifting
const DEBT_UC_LO_MAX = 0.35; // maximum uc relief from being very safe, pp
const DEBT_UC_CREDITOR_K = 0.55; // uc points from deep negative debt ( /90 )^1.15
/* Endogenous stress: high leverage and thin capital force a credit crunch and
   a fiscal recap without waiting for a scripted event. */ const BANK_STRESS_LEV = 16.0;
const BANK_STRESS_CAP = 5.8;
const BANK_STRESS_CD = 6; // quarters before another forced crisis / bank event
/* Fiscal recapitalisation: points of GDP debt per point of bank-capital index. */ const RECAP_COST = 0.22;
/* Investment: accelerator plus user cost of capital,
      uc = real rate + depreciation + corporate tax wedge
   which is where corporation tax and the policy rate actually bite. */ /* Trade. Price elasticities comfortably satisfy Marshall-Lerner, so a loss of
   competitiveness worsens the balance. */ const T_ADJ = 0.3,
  ELAST_X = 0.85,
  ELAST_M = 0.6;
/* Import content of the baseline spending programme, so only deviations count. */ const BASE_LEAK =
  2.5 * 0.12 +
  8.4 * 0.08 +
  4.1 * 0.05 +
  2.5 * 0.18 +
  2.4 * 0.3 +
  1.9 * 0.07 +
  0.8 * 0.12;
const WORLD_GROWTH = 2.0,
  WORLD_INFL = 2.0,
  BASE_TARIFF = 3;
/* Fraction of a worldTfp pulse that spills into the home country's TFP growth. */ const WORLD_TFP_SPILL = 0.35;
/* Major world episodes: next one is scheduled 16–32 quarters (4–8 years) after the last ends. */ const MAJOR_GAP_MIN = 16,
  MAJOR_GAP_SPAN = 17;
/* Trade policy is not unilateral. Raise a tariff and partners raise theirs, with
   a lag and roughly in proportion, which hits exports on top of the domestic
   price effect. Without this a tariff was purely a domestic tax and protection
   looked far cheaper than it is. Poor relations make retaliation worse; a
   ratified agreement restrains it. */ const RETAL_SHARE = 0.75,
  RETAL_ADJ = 0.16,
  RETAL_ELAST = 1.1;
/* Bilateral exports scale gently with relations; cold partners also amplify
   tariff retaliation (trade-share weighted). */ const REL_TRADE = 0.22,
  RETAL_COLD = 0.55;
/* ---- Trade agreements take years, and then keep giving ----
   A deal used to land as a one-off level shift: exports jumped within two
   quarters and then sat there forever. Neither half of that is right.

   Firms do not re-plan supply chains in a quarter, so market access, the deal's
   tariff preference and its openness bump all phase in over roughly five years
   (Baier and Bergstrand find bilateral trade keeps rising for a decade after an
   agreement). And the larger gains are dynamic rather than static: exposure to
   competition, specialisation and the technology that comes with trade raise
   productivity for as long as the openness lasts. `tradeDepth` / `openEff` /
   `tariffCutEff` carry the phase-in; `TRADE_TFP` carries the dynamic gain.
   Depth is a 0–100 index (access points + tariff integration). At 0.020 per
   point, an EU customs-union seat printed ~2pp of permanent TFP growth and ran
   away from the frontier. */ const DEAL_PHASE = 0.055,
  TRADE_TFP = 0.0035;
/* ---- Exchange rate: uncovered interest parity ----
   A higher domestic policy rate attracts capital and appreciates the currency
   immediately, leaving expected depreciation to offset the yield advantage. A
   risk premium pushes the other way, which is why a fiscal scare weakens the
   currency even as it raises rates. Trade volumes then respond to the real
   exchange rate with a lag, which is what produces a J-curve: the balance
   worsens on impact before volumes catch up. */ const WORLD_RATE = 2.6; // world short rate, %
/* A point of interest differential sustained over several years is worth a few
   per cent on the currency, which is the usual empirical range. */ const FX_UIP = 0.03; // fractional appreciation per point of differential
const FX_RISK = 0.055; // fractional depreciation per point of risk premium
const FX_ADJ = 0.38; // markets move fast, but not instantly
/* A sustained trade surplus/deficit also moves the currency, independent of
   the rate differential: exporters' earnings need converting into the home
   currency, and a persistent deficit has to be funded by selling it. Kept
   small relative to FX_UIP so it nudges rather than dominates. */ const FX_CA = 0.15; // fractional appreciation per point of net-exports/potential
/* The current account is a multi-year phenomenon in practice — a small share
   of daily FX turnover next to capital flows — so it acts on a slow
   accumulator (e.caSmooth) rather than the raw quarterly trade balance, the
   same partial-adjustment idiom FX_ADJ/T_ADJ already use elsewhere. Half-life
   ~11 quarters. */ const CA_ADJ = 0.06;
/* ---- Demography ----
   Three population stocks (child, working-age, old) with simple cohort flows.
   Old-age dependency = N_old / N_work drives pension caseload, health need and
   labour-force growth. Migration policy adds to the working-age stock rather
   than permanently adding a labour fudge to trend growth. */ const DEP_0 = 0.3;
const POP_WORK0 = 100,
  POP_OLD0 = 30,
  POP_CHILD0 = 28;
/* Quarterly cohort rates, calibrated against ONS-style projections: at
   baseline migration the working-age stock holds roughly flat, the child stock
   is stationary (births ≈ ageing-in at the opening ratio), and old-age
   dependency climbs from 0.30 to about 0.38–0.40 over thirty years. AGE_OUT is
   deliberately partial — within-workforce ageing is carried by the smaller
   labour drag in `ageingLabourDrag` rather than a retirement cliff. */ const BIRTH_RATE = 0.0026; // births into child stock, per working-age head
const AGE_IN = 0.0093; // child → working age
const AGE_OUT = 0.0029; // working age → old
const DEATH_OLD = 0.006; // deaths from old stock
const MIG_BASE = 0.12; // baseline net migration, % of working-age / year
const AGEING_HEALTH = 3.4; // elasticity of health demand to the dependency ratio
const AGEING_PENSION = 1.0; // pension caseload loading on dependency
/* Society scores are invented 0–100 indices. Crime’s neutral baseline used to
   sit at 42, which read as “high” on the Society tab before anything happened.
   28 is still above a perfect score, but it looks like a calm country rather
   than one already in trouble. */ const CRIME_BASE = 28;
/* ---- Baumol's cost disease ----
   Public services are labour-intensive and their measured productivity barely
   moves, while their wage bill has to track the wider economy. A pound of
   health spending therefore buys less volume every year. This is why services
   decay at a constant share of GDP: not because of an assumed drift, but
   because unit costs rise faster than the money does. */ const PUB_PROD_GROWTH = 0.0; // annual public sector productivity growth, %
const SVC_ADJ = 0.16; // capacity takes time to build or lose
function govDemandShares(law: any, econ: any) {
  let g = OTHER_G,
    tr = OTHER_TRANSFER;
  let leak = OTHER_G * IMPORT_CONTENT.other;
  for (const d of DEPTS) {
    const amount =
      d.id === "welfare" ? welfareCost(law, econ) : law.spend[d.id];
    if ((TRANSFER_DEPTS as any)[d.id]) tr += amount;
    else {
      g += amount;
      leak += amount * ((IMPORT_CONTENT as any)[d.id] || 0.1);
    }
  }
  return {
    g,
    tr,
    leak,
  };
}
/* One quarter of the expenditure side. Every component is a level indexed so
   that the baseline economy is 100, and each adjusts partially, which is what
   produces a multiplier that builds over a few quarters instead of landing
   all at once. */ function expenditureStep(
  e: any,
  law: any,
  E: any,
  revShare: any,
  modSpend: any,
  g: any,
  det: any,
) {
  const pot = e.potential;
  const { g: gShare, tr, leak } = govDemandShares(law, e);
  // --- G: plans are set against trend output, not against this quarter's
  // outturn, which is both realistic and what keeps the system from feeding
  // back on itself within a quarter.
  const G = ((gShare + (modSpend || 0)) / 100) * pot;
  const TR = (tr / 100) * pot;
  // --- C: autonomous consumption plus the marginal propensity to consume out
  // of disposable income, less an interest-rate term for debt service and the
  // cost of credit. C_AUTO is pinned so the baseline economy reproduces its
  // consumption share exactly.
  /* Households pay the average rate on baseline income but the marginal rate on
     anything above it: income tax and NI on the extra earnings, then VAT and
     duties on what is spent. That wedge is the automatic stabiliser, and it is
     also most of what keeps the multiplier finite. Using the average rate here
     overstated multipliers by roughly a third. */ const hhTax =
    (revShare / 100) * pot * HH_TAX_SHARE + MARGINAL_LEAK * (e.gdp - pot);
  const yd = e.gdp - hhTax + TR;
  /* The rate that matters for a spending or investment decision is ex ante:
     nominal less *expected* inflation. Using realised headline inflation here
     meant a VAT rise, which spikes the price level for one quarter, registered
     as a large fall in real rates and stimulated consumption. Households
     putting up with a VAT rise are not being stimulated by it. */ const realRate =
    e.rate - e.expect;
  /* Split disposable income between the two household types. A more equal
     distribution puts more of it in the hands of those who spend it. */ /* How much of disposable income sits with households that spend it. Two
     things move it: the overall distribution, and the incidence of the tax
     system itself, taken from the same income distribution the tax code is
     integrated over. A cut aimed at the bottom raises it; one aimed at the top
     lowers it, and demand follows. */ const equality =
    1 + (REDIST_SENS * (35 - (e.gini || 35))) / 35;
  const incidence =
    1 + MPC_INCIDENCE * (incomeProfile(law, e).distMPC / MPC_DIST_BASE - 1);
  /* More households are constrained when the economy is weak, which is why the
     same budget buys more output in a slump than in a boom. */ const slack =
    clamp(-(e.gdp / pot - 1) * 100, -4, 4);
  const stateDep = 1 + SLACK_MPC * slack;
  const rtShare = clamp(
    RULE_OF_THUMB * equality * incidence * stateDep * (1 + (E.mpcw || 0) / 100),
    0.15,
    0.78,
  );
  const market = e.gdp - hhTax;
  const ydRT =
    market * RT_MARKET_SHARE * (rtShare / RULE_OF_THUMB) +
    TR * RT_TRANSFER_SHARE * (rtShare / RULE_OF_THUMB);
  const ydPerm = yd - ydRT;
  /* Permanent income is a slow-moving average of the unconstrained households'
     disposable income, which is what gives consumption smoothing. */ e.permInc +=
    (ydPerm - e.permInc) * PERM_ADJ;
  /* Mortgage fixation: the stock rate crawls toward Bank rate plus spread.
     Dwelling stock, rents and capitalised prices follow a stock-flow; credit
     conditions ration new mortgage lending. */ if (e.mortgageDebt == null)
    e.mortgageDebt = MORT_DEBT0;
  if (e.mortgageRate == null) e.mortgageRate = e.rate;
  if (e.housePrice == null) e.housePrice = 100;
  if (e.housingStock == null) e.housingStock = H0;
  if (e.rentIndex == null) e.rentIndex = 100;
  if (e.bankLeverage == null) e.bankLeverage = BANK_LEV0;
  if (e.bankCapital == null) e.bankCapital = BANK_CAP0;
  if (e.creditSpread == null) e.creditSpread = 0;
  const prevHp = e.hpLag != null ? e.hpLag : e.housePrice;
  e.mortgageRate +=
    (e.rate + MORT_SPREAD + (e.creditSpread || 0) * 0.35 - e.mortgageRate) *
    MORT_FIX;
  const pol = law.policies || {};
  /* Build cost: user cost of capital, eased by planning reform, raised by rent
     controls (developers face capped revenues) and by stamp-like asset taxes. */ const landRate =
    law.taxes.landTax && law.taxes.landTax.on ? law.taxes.landTax.rate : 0;
  const cgtGap =
    law.taxes.capGains && law.taxes.capGains.on
      ? Math.max(0, law.taxes.capGains.rate - 24)
      : 0;
  const buildCost =
    100 *
    (1 +
      0.012 * (realRate - R_REAL_NEUTRAL) +
      0.01 * ((E.ucost || 0) + (e.modUcost || 0) + (e.creditSpread || 0)) -
      (pol.planning ? 0.085 : 0) +
      (pol.rentCtrl ? 0.055 : 0) +
      landRate * 0.008 +
      cgtGap * 0.0015);
  /* Housing demand vs stock → vacancy → rent. */ const gapFrac =
    e.gdp / pot - 1;
  const demandH =
    H0 *
    (1 + 0.55 * gapFrac + 0.12 * ((e.popWork || POP_WORK0) / POP_WORK0 - 1));
  const vacancy = clamp(e.housingStock / Math.max(1, demandH) - 1, -0.25, 0.35);
  let rentTarget =
    100 * (1 - RENT_VAC_ELAST * vacancy + RENT_Y_ELAST * gapFrac);
  if (pol.rentCtrl) rentTarget *= 1 - RENT_CTRL_CUT;
  e.rentIndex += (rentTarget - e.rentIndex) * 0.14;
  e.rentIndex = clamp(e.rentIndex, 55, 180);
  /* Price = capitalised rent. */ const capRate = Math.max(
    0.015,
    CAP_RATE0 +
      ((realRate - R_REAL_NEUTRAL) / 100) * 0.55 +
      ((e.creditSpread || 0) / 100) * 0.4,
  );
  const hpTarget = clamp(e.rentIndex * (CAP_RATE0 / capRate), 55, 180);
  e.housePrice += (hpTarget - e.housePrice) * HP_ADJ;
  e.housePrice = clamp(e.housePrice, 55, 180);
  e.housePriceGrowth = (e.housePrice / Math.max(1, prevHp) - 1) * 400;
  e.hpLag = e.housePrice;
  /* Construction: private I^H responds to P/C; social housebuilding adds stock. */ const priceCost =
    e.housePrice / Math.max(40, buildCost);
  const privBuild =
    H_BUILD_BASE *
    Math.pow(Math.max(0.4, priceCost), H_BUILD_ELAST) *
    (pol.rentCtrl ? 0.72 : 1);
  const pubBuild = (E.hbuild || 0) * 0.35;
  const hInvest = ((privBuild + pubBuild) / 100) * e.housingStock;
  e.housingInvest = hInvest;
  e.housingStock = Math.max(
    70,
    e.housingStock * (1 - H_DEPREC / 400) + hInvest,
  );
  e.buildCost = buildCost;
  e.vacancy = vacancy;
  /* Credit: NIM − loan losses → bank capital; leverage → spread; deposit-run
     risk gates mortgage supply. */ if (e.bankLoans == null)
    e.bankLoans = BANK_LOANS0;
  if (e.bankDeposits == null) e.bankDeposits = BANK_LOANS0 * 0.92;
  if (e.depositRun == null) e.depositRun = 0;
  const uGap = Math.max(0, e.unemployment - (e.nairu || U_STAR));
  const ltv =
    ((e.mortgageDebt || MORT_DEBT0) / Math.max(40, e.housePrice)) * 100;
  const hpFall = Math.max(0, -(e.housePriceGrowth || 0));
  const pd = clamp(
    0.004 +
      PD_U * uGap +
      (PD_LTV * Math.max(0, ltv - 70)) / 10 +
      PD_HOUSE * hpFall +
      Math.max(0, e.riskPremium) * 0.01,
    0.001,
    0.12,
  );
  const corpLoans = Math.max(20, e.bankLoans - e.mortgageDebt);
  e.bankLoans = clamp(
    0.55 * e.mortgageDebt + 0.45 * (corpLoans + e.I * 0.8),
    40,
    160,
  );
  const nim =
    BANK_NIM *
    (e.bankLoans / BANK_LOANS0) *
    (1 + ((e.mortgageRate || e.rate) - MORT_NEUTRAL) * 0.04);
  const losses = BANK_LGD * pd * e.bankLoans * 0.25;
  e.bankCapital +=
    nim -
    losses -
    CREDIT_SOV *
      Math.max(0, e.riskPremium) *
      (e.bankLeverage / BANK_LEV0) *
      0.12;
  e.bankCapital += (BANK_CAP0 - e.bankCapital) * 0.025;
  e.bankCapital = clamp(e.bankCapital, 2, 16);
  /* Deposit flight when spreads and unemployment rise. */ const runPressure =
    Math.max(0, e.creditSpread) * 0.15 +
    uGap * 0.04 +
    Math.max(0, e.riskPremium) * 0.1;
  e.depositRun = clamp(e.depositRun * 0.7 + runPressure, 0, 8);
  e.bankDeposits = clamp(
    e.bankDeposits * (1 - e.depositRun / 400) +
      (e.bankLoans * 0.92 - e.bankDeposits) * 0.06,
    30,
    180,
  );
  e.bankLeverage = clamp(
    (e.bankLoans / Math.max(2, e.bankCapital)) *
      (BANK_CAP0 / BANK_LOANS0) *
      BANK_LEV0,
    6,
    28,
  );
  e.creditSpread = Math.max(
    0,
    (e.bankLeverage - BANK_LEV_TARGET) * CREDIT_PHI +
      Math.max(0, e.riskPremium) * 0.25 +
      e.depositRun * 0.12 +
      Math.max(0, -(e.housePriceGrowth || 0)) * 0.035 -
      WEALTH_COLLAT *
        Math.max(
          -2,
          ((e.privateWealth || PRIVATE_WEALTH0) - PRIVATE_WEALTH0) / 10,
        ),
  );
  /* Endogenous bank stress: force a credit crunch and fiscal recap when leverage
     is high and capital is thin. Scripted bank events are gated while stressed. */ if (
    e.bankStressCd == null
  )
    e.bankStressCd = 0;
  if (e.bankStressCd > 0) e.bankStressCd -= 1;
  if (
    !det &&
    !e.bankStress &&
    e.bankStressCd <= 0 &&
    e.bankLeverage >= BANK_STRESS_LEV &&
    e.bankCapital <= BANK_STRESS_CAP
  ) {
    e.bankStress = true;
    e.bankStressCd = BANK_STRESS_CD;
    e.creditSpread = Math.max(e.creditSpread, 2.8);
    e.depositRun = Math.max(e.depositRun, 3.5);
    e.uncertainty = (e.uncertainty || 0) + 0.35;
    recapitaliseBank(e, 2.2, 1.4);
    e._bankStressNote =
      "A mid-sized lender failed the stress test. Deposit flight forced a fiscal recapitalisation and credit is scarce.";
  } else if (
    e.bankStress &&
    e.bankCapital >= BANK_CAP0 - 0.5 &&
    e.creditSpread < 1.2
  ) {
    e.bankStress = false;
  }
  if (e.bankStress) {
    e.creditSpread = Math.max(e.creditSpread, 1.6);
  }
  const creditSupply = clamp(
    1 - (MORT_CREDIT_ELAST * e.creditSpread) / 4 - e.depositRun * 0.06,
    0.35,
    1.15,
  );
  const rateFactor = Math.pow(
    (1 + MORT_NEUTRAL / 100) / (1 + Math.max(0.2, e.mortgageRate) / 100),
    1.15,
  );
  const mortDesired =
    MORT_DEBT0 *
    (e.housePrice / 100) *
    rateFactor *
    (pol.rentCtrl ? 0.96 : 1) *
    creditSupply *
    (1 - cgtGap * 0.004 - landRate * 0.01);
  e.mortgageDebt += (mortDesired - e.mortgageDebt) * MORT_STOCK_ADJ;
  e.mortgageDebt = clamp(e.mortgageDebt, 25, 120);
  const mortService = (e.mortgageDebt / 100) * (e.mortgageRate - MORT_NEUTRAL);
  const wealthImpulse =
    ((C_WEALTH * (e.housePrice / 100 - 1) * HH_HOUSING_WEALTH) / 100) * pot +
    ((C_FIN_WEALTH * ((e.privateWealth || PRIVATE_WEALTH0) - PRIVATE_WEALTH0)) /
      100) *
      pot;
  if (e.uncertainty == null) e.uncertainty = 0;
  if (e.contactHit == null) e.contactHit = 0;
  if (e.residCarry == null) e.residCarry = 0;
  const target =
    (C_AUTO / 100) * pot +
    MPC_RT * ydRT +
    MPC_PERM * e.permInc -
    ((C_RATE * (realRate - R_REAL_NEUTRAL)) / 100) * pot -
    ((C_MORT * mortService) / 100) * pot +
    wealthImpulse -
    ((C_UNC * e.uncertainty) / 100) * pot -
    ((C_CONTACT * e.contactHit) / 100) * pot +
    ((RESID_C_ADJ * e.residCarry) / 100) * pot;
  e.C += (target - e.C) * C_ADJ;
  e.rtShare = rtShare;
  // --- I: desired capital stock from the production function's FOC
  const corpRate =
    law.taxes.corpTax && law.taxes.corpTax.on ? law.taxes.corpTax.rate : 0;
  const fiscalUc = debtFinanceWedge(e.debt);
  e.fiscalFinance = fiscalUc;
  const userCost = Math.max(
    1.2,
    realRate +
      DEPREC +
      corpRate * CORP_WEDGE +
      (E.ucost || 0) +
      (e.modUcost || 0) +
      (e.creditSpread || 0) * CREDIT_I_PASS +
      e.uncertainty * 0.08 +
      fiscalUc,
  );
  e.ucSmooth += (userCost - e.ucSmooth) * UC_SMOOTH;
  const gapPct = (e.gdp / pot - 1) * 100;
  const Kstar =
    (KSTAR_SCALE * ALPHA * e.gdp) / (Math.max(1.2, e.ucSmooth) / 100);
  const trendG = e.trendGrowth || 1.2;
  const Istar =
    ((DEPREC + trendG) / 100) * e.K +
    K_ADJ * (Kstar - e.K) +
    (I_ACCEL / 100) * gapPct * pot +
    ((E.kboost || 0) / 100) * pot +
    ((E.rndEffort || 0) / 100) * pot -
    ((I_UNC * e.uncertainty) / 100) * pot;
  e.I += (Istar - e.I) * 0.3;
  e.Kstar = Kstar;
  e.userCost = userCost;
  // net capital accumulation, quarterly
  e.K += (e.I - (DEPREC / 100) * e.K) / 4;
  e.KG += ((law.spend.infra / 100) * e.gdp - (DEPREC_G / 100) * e.KG) / 4;
  if (e.R == null) e.R = R0;
  e.R += ((researchEffort(law, E) / 100) * e.gdp - (DEPREC_R / 100) * e.R) / 4;
  e.R = Math.max(1, e.R);
  stepHumanCapital(law, E, e);
  // --- X and M
  /* Retaliation builds toward a share of whatever tariff wall you put up, less
     whatever your treaties hold back. Poor relations make retaliation worse. */ ensureDiploStocks(
    e,
  );
  const bm = (g && g.blocMember) || {};
  const relMap = (g && g.rel) || {};
  const homeRole = g && g.homeRole;
  let coldW = 0,
    coldSum = 0,
    provokeW = 0,
    provokeSum = 0;
  for (const p of activePartners(homeRole)) {
    const rel = relMap[p.id] != null ? relMap[p.id] : 50;
    const w = partnerShare(homeRole, p);
    const effT = effectiveTariff(p.id, law, homeRole, bm);
    const cutP = 0; /* per-partner deal cuts folded into access */
    const provokeP = Math.max(0, effT - BASE_TARIFF - cutP);
    provokeW += w;
    provokeSum += w * provokeP;
    coldW += w;
    coldSum += w * Math.max(0, (48 - rel) / 48);
  }
  const provoke = provokeW > 0 ? provokeSum / provokeW : 0;
  const restraint = 1 - clamp((E.access || 0) / 22, 0, 0.65);
  const cold = coldW > 0 ? coldSum / coldW : 0;
  const retalTarget =
    provoke * RETAL_SHARE * restraint * (1 + RETAL_COLD * cold);
  e.retaliation += (retalTarget - e.retaliation) * RETAL_ADJ;
  /* World demand is the trade-share × absolute-GDP basket of partners, plus a
     rest-of-world residual. Opening worldY is normalised to 100 via worldDemand0. */ refreshWorldY(
    e,
    homeRole,
  );
  e.worldP *= 1 + (WORLD_INFL + (e.modWorldInfl || 0)) / 400;
  /* Competitiveness runs on underlying prices, not headline. VAT is
     border-adjusted: exports leave zero-rated and imports pay it, so a VAT rise
     is not a loss of competitiveness. Feeding headline inflation in here made
     every VAT change look like a real appreciation, which it is not. */ e.priceP *=
    1 + (e.inflation - e.vatEcho * 0.9) / 400;
  /* Uncovered interest parity, with a risk premium and a current-account
     term: a slow-moving average of net exports as a share of potential
     output (the current account is a multi-year phenomenon next to capital
     flows, not a quarterly one — see CA_ADJ), so a persistent surplus/deficit
     pulls the currency independently of rates. The dollar is the numeraire
     itself (fxAreas.ts pins every USD-area AI seat's target at 1 for the same
     reason): if the player is playing as the United States, there is no
     "USD vs USD" to float. Everyone else reacts to the US seat's *actual*
     simulated rate this quarter, not a fixed proxy — it's a live AI seat by
     this point, not an assumption. */ const homeIsUsd =
    currencyForSeat(homeRole) === "USD";
  const usRate =
    !homeIsUsd &&
    g &&
    g.world &&
    g.world.united_states &&
    g.world.united_states.econ
      ? g.world.united_states.econ.rate
      : null;
  const worldRate =
    (usRate != null ? usRate : e.worldRate != null ? e.worldRate : WORLD_RATE) +
    (e.modWorldRate || 0);
  const fxUip = e.fxUip != null ? e.fxUip : FX_UIP;
  const caNow = pot > 0 ? (e.X - e.M) / pot : 0;
  if (e.caSmooth == null) e.caSmooth = caNow;
  e.caSmooth += (caNow - e.caSmooth) * CA_ADJ;
  const fxTarget = homeIsUsd
    ? 1
    : 1 +
      fxUip * (e.rate - worldRate) -
      FX_RISK * e.riskPremium +
      FX_CA * e.caSmooth;
  e.fx += (fxTarget - e.fx) * FX_ADJ;
  /* Deal channels phase in. Statutory tariff and non-deal openness still bite
     immediately; only the deal's open / tariffCut / access crawl via DEAL_PHASE. */ if (
    e.openEff == null
  )
    e.openEff = 0;
  if (e.tariffCutEff == null) e.tariffCutEff = 0;
  if (e.tradeDepth == null) e.tradeDepth = 0;
  e.openEff += ((E.dealOpen || 0) - e.openEff) * DEAL_PHASE;
  e.tariffCutEff += ((E.dealTariffCut || 0) - e.tariffCutEff) * DEAL_PHASE;
  if (!e.partnerAccessEff) e.partnerAccessEff = {};
  for (const p of activePartners(homeRole)) {
    const target = (E.partnerAccess && E.partnerAccess[p.id]) || 0;
    const stressed = (e.dealStress[p.id] || 0) >= 1;
    const effTarget = stressed ? 0 : target;
    const cur = e.partnerAccessEff[p.id] || 0;
    e.partnerAccessEff[p.id] = cur + (effTarget - cur) * DEAL_PHASE;
  }
  const exposureTarget = tradeExposureTarget(law, E, e, homeRole, bm);
  e.tradeDepth += (exposureTarget - e.tradeDepth) * DEAL_PHASE;
  /* Competitiveness is indexed to the opening settings, so a fresh game starts
     in equilibrium rather than in a trade-induced recession. A stronger currency
     makes exports dearer and imports cheaper. */ const openNow =
    (E.open || 0) + e.openEff;
  const cutNow = (E.tariffCut || 0) + e.tariffCutEff;
  const avgTariff = tariffScheduleAverage(law, homeRole, bm);
  const compBase =
    ((e.worldP / e.priceP) * (1 + openNow / 200) * (1 + BASE_TARIFF / 100)) /
    (1 + Math.max(0, avgTariff - cutNow) / 100) /
    Math.max(0.5, e.fx);
  /* Gravity bilateral exports: X_i ∝ share_i · Y · Y_i^β · comp^ε.
     Partner shocks and partner-specific deals hit the matching bilateral term
     rather than a half-weight add to world demand. */ if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE) {
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
    }
  }
  const partnerPulse = e.partnerShock || {};
  /* A `world` shock is a synchronised foreign-demand pulse: it hits every
     bilateral export leg (scaled by partner beta), not only the ~4% rest
     residual. Without this, "global recession" barely moved X. */ const worldPulse =
    e.worldShock || 0;
  const bilat: Record<string, any> = {};
  let Xstar = 0;
  const partners = activePartners(homeRole);
  const shareX = e.shareX != null ? e.shareX : SHARE_X;
  const shareM = e.shareM != null ? e.shareM : SHARE_M;
  const shareC = e.shareC != null ? e.shareC : SHARE_C;
  const shareI = e.shareI != null ? e.shareI : SHARE_I;
  for (const p of partners) {
    const Yi = (e.nations[p.id] && e.nations[p.id].y) || 100;
    const effT = effectiveTariff(p.id, law, homeRole, bm);
    const comp =
      (compBase * (1 + BASE_TARIFF / 100)) /
      (1 + Math.max(0, effT - cutNow) / 100);
    const access = (e.partnerAccessEff && e.partnerAccessEff[p.id]) || 0;
    const beta =
      NATION_PROFILE[p.id] && NATION_PROFILE[p.id].beta != null
        ? NATION_PROFILE[p.id].beta
        : 0.8;
    const pulse = (partnerPulse[p.id] || 0) + worldPulse * beta;
    const rel = relMap[p.id] != null ? relMap[p.id] : 50;
    const relFac = 1 + (REL_TRADE * (rel - 50)) / 50;
    let Xi;
    const gravityXi =
      ((partnerShare(homeRole, p) * shareX) / 100) *
      e.worldY *
      Math.pow(Math.max(0.4, Yi / 100), GRAVITY_Y) *
      Math.pow(comp, ELAST_X) *
      (1 + pulse / 100) *
      (1 + access / 200) *
      relFac;
    if (e.clearedFlows && e.clearedFlows[p.id] != null) {
      /* Phase cleared trade in over a year so Q1 does not jump when world bags wake. */ const blend =
        g && g.q != null ? Math.min(1, Math.max(0, g.q) / 4) : 1;
      const clearedXi =
        e.clearedFlows[p.id] * (1 + pulse / 100) * (1 + access / 400) * relFac;
      Xi = gravityXi * (1 - blend) + clearedXi * blend;
    } else {
      Xi = gravityXi;
    }
    (bilat as any)[p.id] = Xi;
    Xstar += Xi;
  }
  const gravityRest =
    ((tradeRestShare(homeRole) * shareX) / 100) *
    e.worldY *
    Math.pow(compBase, ELAST_X) *
    (1 + worldPulse / 100);
  const restBlend = g && g.q != null ? Math.min(1, Math.max(0, g.q) / 4) : 1;
  const restCleared =
    e.clearedFlows && e.clearedFlows.rest != null
      ? e.clearedFlows.rest * (1 + worldPulse / 100)
      : null;
  const restX =
    restCleared != null
      ? gravityRest * (1 - restBlend) + restCleared * restBlend
      : gravityRest;
  bilat.rest = restX;
  Xstar += restX;
  const domestic = e.C + e.I + G;
  /* Imports pulled in by domestic demand, plus the direct import content of the
     government's own purchases. */ const Mstar =
    (shareM / (shareC + shareI + SHARE_G)) *
      domestic *
      Math.pow(compBase, -ELAST_M) +
    ((leak - BASE_LEAK) / 100) * pot;
  /* Exports also grow with the country's own supply capacity, not just world
     demand: a bigger, more productive economy sells more abroad. Without this
     the trade balance drifted structurally as trend growth diverged from the
     world's. */ const Xcap = Math.pow(pot / e.worldY, 0.85);
  Xstar *= Xcap * Math.max(0.35, 1 - (e.retaliation * RETAL_ELAST) / 100);
  e.bilateralX = bilat;
  e.X += (Xstar - e.X) * T_ADJ;
  e.M += (Mstar - e.M) * T_ADJ;
  return {
    C: e.C,
    I: e.I,
    G,
    TR,
    X: e.X,
    M: e.M,
    Y: e.C + e.I + G + e.X - e.M,
    comp: compBase,
    userCost,
    yd,
  };
}
/* ==================================================================
   4. THE ENGINE
   ================================================================== */ function step(
  g: any,
  law: any,
  prevLaw: any,
  det: any,
): any {
  const e = g.econ;
  const E = aggregate(law, g.homeRole, g.blocMember);
  const prof = incomeProfile(law, e);
  /* Wage-setting reference: each seat's own opening statute, captured on the
     seat's first step (during settle, before any legislation). u* and the
     participation margin measure deviations against this rather than the
     Kingdom's defaults, so a seat whose normal statute has low welfare or a
     light tax wedge opens at its profile nairu0 instead of drifting toward a
     UK-anchored rate it never legislated for. */ if (!e.wageRef)
    e.wageRef = {
      nairu: e.nairu != null ? e.nairu : U_STAR,
      mtr: prof.meanMtr,
      welfare: law.spend.welfare != null ? law.spend.welfare : 13.3,
      education: law.spend.education != null ? law.spend.education : 4.1,
      er: law.ni.erOn === false ? 0 : law.ni.erRate,
      hCap: humanCapitalTarget(law, E, e),
      replace: E.replace || 0,
      nairuCh: E.nairu || 0,
    };
  const wref = e.wageRef;
  const pg = potentialGrowth(law, E, e);
  /* Event mods are structural channels only: world demand, cost of capital,
     labour supply, terms of trade, TFP, uncertainty, contact capacity,
     worldInfl / worldRate / worldTfp, and temporary social pressures (srv/hlt/cri).
     They must not write GDP growth or CPI outcomes. Legacy `demand`/`growth`
     map into the uncertainty stock. */ let mS = 0,
    mA = 0,
    mP = 0,
    mW = 0,
    mUC = 0,
    mPart = 0,
    mLab = 0,
    mMig = 0,
    mToT = 0,
    mUnc = 0,
    mContact = 0;
  let mSrv = 0,
    mHlt = 0,
    mCri = 0,
    mWorldInfl = 0,
    mWorldRate = 0,
    mWorldTfp = 0;
  e.partnerShock = {};
  g.mods = g.mods.filter((m: any) => m.q > 0);
  g.mods.forEach((m: any) => {
    /* Legacy demand/growth → precautionary uncertainty (sign: cut demand = more uncertainty). */ const dem =
      (m.demand || 0) + (m.growth || 0);
    if (dem) mUnc += -dem;
    mUnc += m.uncertainty || 0;
    mContact += m.contact || 0;
    mS += m.spend || 0;
    mA += m.approval || 0;
    mP += (m.tfp || 0) + (m.potential || 0);
    mW += m.world || 0;
    mUC += m.ucost || 0;
    mPart += m.part || 0;
    mLab += m.labour || 0;
    mMig += m.migrate || 0;
    mToT += m.tot || 0;
    mSrv += m.srv || 0;
    mHlt += m.hlt || 0;
    mCri += m.cri || 0;
    mWorldInfl += m.worldInfl || 0;
    mWorldRate += m.worldRate || 0;
    mWorldTfp += m.worldTfp || 0;
    if (m.worldPartner && m.partner) {
      e.partnerShock[m.partner] =
        (e.partnerShock[m.partner] || 0) + m.worldPartner;
    }
    m.q--;
  });
  mP += WORLD_TFP_SPILL * mWorldTfp;
  e.worldShock = mW;
  e.modWorldInfl = mWorldInfl;
  e.modWorldRate = mWorldRate;
  e.modWorldTfp = mWorldTfp;
  e.modUcost = mUC;
  e.modToT = mToT;
  e.modSrv = mSrv;
  e.modHlt = mHlt;
  e.modCri = mCri;
  e.uncertainty = Math.max(0, (e.uncertainty || 0) * UNC_DECAY + mUnc);
  e.contactHit = Math.max(0, (e.contactHit || 0) * CONTACT_DECAY + mContact);
  /* Partner macros and trade clear before expenditure so foreign demand is live.
     Settle / AI seats skip the world loop to avoid recursion. */ if (
    g.world &&
    !g._settling &&
    !g._aiSeat
  ) {
    stepWorldPartners(g, det);
  } else {
    stepNations(e, det, g);
  }
  stepWorldRest(e);
  // fiscal impulse from whatever the bill changed
  /* The old fiscal-impulse term lived here. It is gone: G enters the identity
     directly and taxes enter through disposable income, so the multiplier is
     produced by the model rather than asserted by a coefficient. */ /* ---- Output is the national accounts identity ----
       Y = C + I + G + X - M
     Each component has its own equation in the expenditure block above. The
     fiscal multiplier is not set anywhere: it emerges from the marginal
     propensity to consume, the tax take out of income and import leakage,
     which is where multipliers come from in the first place. */ const revShare =
    revenue(law, E, e).total;
  const prevY = e.gdp;
  const acct = expenditureStep(e, law, E, revShare, mS, g, det);
  /* Elevated gilt yields hit borrowers as a credit-spread shock attributed to
     private demand so sectoral balances still close. */ const yieldShock =
    -Math.pow(Math.max(0, e.yield - 6.0), 1.3) * 0.45;
  const noise = det ? 0 : (Math.random() - 0.5) * 0.7;
  const exog = ((yieldShock + noise) / 400) * prevY;
  e.C += exog;
  acct.C = e.C;
  acct.Y = e.C + acct.I + acct.G + acct.X - acct.M;
  e.gdp = Math.max(5, acct.Y);
  const growth = clamp((e.gdp / prevY - 1) * 400, -18, 18);
  e.gdp = prevY * (1 + growth / 400);
  if (acct.Y > 0) {
    const kY = e.gdp / acct.Y;
    e.C *= kY;
    acct.C = e.C;
    acct.Y = e.gdp;
  }
  e.acct = acct;
  /* Potential is the production function evaluated on the current stocks, not a
     compounding growth rate. TFP is the only piece that trends on its own. */ /* Hysteresis. A sustained gap does not simply close on its own: a boom pulls
     in capacity and a slump scars it, and potential follows demand part of the
     way. Without this the baseline ran persistently hot, because nothing tied
     supply to the demand it was failing to meet. */ const hyst =
    HYSTERESIS * clamp((e.gdp / e.potential - 1) * 100, -4, 4);
  e.A *=
    1 +
    (baselineTfpGrowth(e) +
      (E.tfp || 0) +
      (e.tradeDepth || 0) * TRADE_TFP +
      (clamp(50 + (E.open || 0) + (e.openEff || 0), 5, 95) - 50) * 0.006 +
      knowledgeTfp(e) +
      hyst +
      mP) /
      400;
  /* ---- Demography: cohort stocks, then labour force ----
     Working-age population grows with ageing-in, net migration and less
     ageing-out. Dependency is N_old/N_work. Migration policy and mobility
     deals feed the working-age stock via `migrate`, not a permanent labour
     additive on trend growth. Fertility policy moves the birth rate. */ if (
    e.popWork == null
  ) {
    e.popWork = POP_WORK0;
    e.popOld = POP_OLD0;
    e.popChild = POP_CHILD0;
  }
  const birthRate = effectiveBirthRate(e, law, E);
  const migBase = e.migBase != null ? e.migBase : MIG_BASE;
  const births = birthRate * e.popWork;
  const ageIn = AGE_IN * e.popChild;
  const ageOut = AGE_OUT * e.popWork;
  const deaths = DEATH_OLD * e.popOld;
  const mig =
    ((migBase + (E.migrate || 0) + mMig + (E.labour || 0) * 0.35 + mLab * 0.5) /
      400) *
    e.popWork;
  e.popChild = Math.max(5, e.popChild + births - ageIn);
  e.popWork = Math.max(40, e.popWork + ageIn - ageOut + mig);
  e.popOld = Math.max(5, e.popOld + ageOut - deaths);
  e.dependency = clamp(e.popOld / e.popWork, 0.18, 0.55);
  /* Labour force tracks working-age population; residual labour channel is for
     conscription-style temporary withdrawals, not migration. */ const prevL =
    e.L;
  e.L *=
    1 +
    ((e.popWork / POP_WORK0 - e.L / 100) * 12 +
      (E.labour || 0) * 0.4 -
      ageingLabourDrag(e)) /
      400;
  e.L = clamp(e.L, 40, 160);
  e.labourGrowth = clamp((e.L / Math.max(1, prevL) - 1) * 400, -2.5, 8);
  /* Participation margin: people enter and leave the workforce as the reward
     for working changes. */ const netWage =
    (1 - prof.meanMtr) / (1 - wref.mtr);
  const partTarget =
    (1 + PART_ELAST * (netWage - 1)) * (1 + ((E.part || 0) + mPart) / 100);
  e.participation += (partTarget - e.participation) * PART_ADJ;
  e.potential = potentialLevel(law, E, e); // uses last quarter's u*, set below
  /* Catch-up uses live yRel. Refresh after potential moves so seats that have
     converged stop collecting a permanent TFP subsidy. Player step also refreshes
     partner bags (already advanced this quarter). */ if (
    g.world &&
    !g._settling &&
    !g._aiSeat
  )
    refreshWorldYRel(g);
  else if (g._aiSeat && g.world) {
    const frontierId = "united_states";
    const playerId = playerCountryId(g.homeRole);
    let frontier = null;
    if (playerId === frontierId) frontier = g.econ;
    else if (g.world[frontierId] && g.world[frontierId].econ)
      frontier = g.world[frontierId].econ;
    refreshSeatYRel(e, frontier);
  }
  e.trendGrowth = pg;
  /* ---- Expectations-augmented Phillips curve ----
       pi_t = lambda*pi_{t-1} + (1-lambda)*pi^e + kappa*gap + shocks
     Expectations are partly anchored on the target and partly backward-looking,
     which is what lets inflation de-anchor if it is allowed to run. */ const newGap =
    (e.gdp / e.potential - 1) * 100;
  /* First-round price-level shift from duties/VAT and from the effective import
     tariff (schedule + deals). Tariff echo uses importTariffLevel so phased deal
     cuts move CPI the same way statutory schedule changes do. */ const importT =
    importTariffLevel(law, E, e, g.homeRole, g.blocMember);
  const prevImportT = e.importTariff != null ? e.importTariff : importT;
  const dTax =
    indirectTaxDelta(law, prevLaw) + (importT - prevImportT) * TARIFF_PASS;
  e.vatEcho = e.vatEcho * 0.6 + dTax;
  /* Credibility earned or lost, and it sets how strongly expectations are
     anchored to the target rather than to recent experience. */ const miss =
    Math.abs(e.inflation - PI_TARGET);
  e.credibility = clamp(
    e.credibility +
      (miss < 1
        ? CRED_GAIN * (1 - e.credibility)
        : -CRED_LOSS * Math.min(3, miss - 1)),
    0.05,
    0.97,
  );
  const anchor = 0.1 + 0.55 * e.credibility;
  e.expect +=
    ((1 - anchor) * e.inflation + anchor * PI_TARGET - e.expect) * PI_ADJ;
  const shockNow = e.supplyShock * (1 - clamp(E.resilience, 0, 0.8));
  const dEr =
    ((law.ni.erOn === false ? 0 : law.ni.erRate) -
      (prevLaw.ni.erOn === false ? 0 : prevLaw.ni.erRate)) *
    0.06;
  /* A fresh minimum-wage rise passes through into prices the quarter it
     lands, mirroring dEr above. Expressed as a fraction of the reference
     rate so it is zero whenever the lever is untouched (or off). */ const dMinWage =
    ((minWageRateOf(law) - minWageRateOf(prevLaw)) / DEF_MIN_WAGE.rate) * 3;
  /* Inertia carries *underlying* inflation forward, not the indirect-tax echo. A
     VAT change is a one-off shift in the price level: it shows up in the annual
     rate for four quarters and then drops out. Feeding it through the persistence
     term made a single VAT rise look like a permanent inflation problem, which
     the Bank then tightened into for years. */ /* Wage bargaining, then unit labour costs, then prices. */ const slack =
    e.nairu - e.unemployment;
  const gL = labourGrowthRate(e, E);
  const prodGrowth = Math.max(-1, e.trendGrowth - gL);
  const wageGrowth = e.expect + prodGrowth + WAGE_CURVE * slack;
  e.wageGrowth = wageGrowth;
  const ulc = wageGrowth - prodGrowth;
  /* Import prices: world inflation, FX, terms-of-trade shocks, and the level of
     the effective import tariff relative to the opening rate (P_m' = P_m (1+τ)). */ const importInf =
    WORLD_INFL +
    (e.modWorldInfl || 0) -
    (e.fx - 1) * 100 * 0.6 +
    (e.modToT || 0) +
    (importT - BASE_TARIFF) * TARIFF_IMPORT;
  e.ulc = ulc;
  e.importTariff = importT;
  const inertia = e.inflation - e.vatEcho * 0.6;
  e.inflation = clamp(
    PI_LAMBDA * inertia +
      (1 - PI_LAMBDA) *
        (ULC_PASS * ulc +
          IMPORT_PASS * importInf +
          (1 - ULC_PASS - IMPORT_PASS) * e.expect) +
      PI_KAPPA * (1 + PI_CONVEX * Math.max(0, newGap)) * newGap +
      shockNow +
      e.vatEcho +
      dEr +
      dMinWage,
    -4,
    45,
  );
  e.supplyShock *= 0.55;
  /* ---- Taylor rule ----
       i = r* + pi + a_pi*(pi - pi*) + a_y*gap
     with partial adjustment, because policy rates move in steps.
     Manual mode (sandbox-style toggle) pins the rate and skips the rule. */ if (
    g.rateManual
  ) {
    e.rate = clamp(
      g.manualRate != null ? g.manualRate : e.rate,
      MANUAL_RATE_MIN,
      20,
    );
  } else {
    /* Central banks look through the first-round effect of an indirect tax change
       rather than tightening into it, so the rule sees inflation net of most of
       the VAT echo. Without this, a VAT rise hit demand twice: once directly and
       once through a rate rise it should never have caused. */ const underlying =
      e.inflation - e.vatEcho * 0.75;
    const target =
      R_NEUTRAL_REAL +
      underlying +
      TAYLOR_PI * (underlying - PI_TARGET) +
      TAYLOR_Y * newGap;
    e.rate = clamp(
      e.rate + (clamp(target, RATE_FLOOR, 20) - e.rate) * TAYLOR_SMOOTH,
      RATE_FLOOR,
      20,
    );
  }
  e.atBound = e.rate <= RATE_FLOOR + 0.02;
  /* ---- Okun's law around a wage-setting equilibrium ----
       du = -beta*(g - g*) + adjustment toward u*
     u* itself comes from the wage-setting block below. */ const erGap =
    (law.ni.erOn === false ? 0 : law.ni.erRate) - wref.er;
  /* Track how much of the employer NI deviation has not yet passed into wages.
     A rate change lands unshifted and decays toward the wage bill from there. */ e.erBorne +=
    erGap - e.erBornePrev;
  e.erBornePrev = erGap;
  e.erBorne *= 1 - WAGE_SHIFT;
  const shifted = erGap - e.erBorne;
  const wedgePP = (prof.meanMtr - wref.mtr) * 100 + shifted;
  const nairu =
    wref.nairu +
    WEDGE_ELAST * wedgePP +
    LABOUR_COST_ELAST * e.erBorne +
    REPLACEMENT_ELAST *
      (law.spend.welfare - wref.welfare + (E.replace || 0) - wref.replace) -
    SKILLS_ELAST * (law.spend.education - wref.education) * 0.35 -
    4.0 * ((e.hCap != null ? e.hCap : H_CAP0) - wref.hCap) +
    E.nairu -
    wref.nairuCh;
  e.nairu = nairu;
  e.unemployment = clamp(
    e.unemployment -
      (OKUN_BETA * (growth - pg)) / 2 +
      (nairu - e.unemployment) * U_ADJ,
    1.6,
    25,
  );
  /* ---- Debt dynamics ----
       db = (r - g)/(1 + g) * b - primary balance
     the standard accumulation identity, plus a convex risk premium in the
     yield: markets ignore the debt level until they abruptly do not. */ const rev =
      revenue(law, E, e),
    sp = spending(law, E, e);
  /* ---- Growth is not fiscally neutral ----
     Spending is a plan in real terms, set against trend output, so its share of
     GDP falls when the economy runs ahead of trend and rises in a slump. And
     receipts are more than unit-elastic to output: profits, capital gains and
     transaction taxes are all strongly cyclical, so the receipts ratio itself
     improves in a boom.

     Before this the books were pure ratios on both sides, which made growth
     fiscally neutral except through the debt dynamics. Growing your way out of
     a deficit was impossible, which is not how public finances work. */ const gapNow =
    e.gdp / e.potential - 1;
  const pot = e.potential;
  const spendRatio = pot / e.gdp; // real plans, nominal denominator
  const revCyc = 1 + REV_GAP_ELAST * gapNow;
  const progShare = (sp.prog + mS) * spendRatio;
  const revShareEff = rev.total * revCyc;
  e.revShareEff = revShareEff;
  e.progShare = progShare;
  const primaryDeficit = progShare - revShareEff;
  const nominalGrowth = growth + e.inflation;
  /* Debt may go negative. Sustained surpluses turn the liability into a stock of
     public assets, and from there the interest line becomes income rather than
     cost: a sovereign wealth fund, arrived at by running the books properly
     rather than by buying one. The floor used to be 3% of GDP, so paying the
     debt off simply stopped working. */ /* The indexed portion of the stock cannot be inflated away: its cost rises
     with prices, so only the conventional share is eroded by nominal growth.
     Inflating your way out of the debt works, but on three quarters of it. */ const ilCost =
    IL_REAL_COUPON + Math.max(-2, e.inflation);
  const blended = (1 - INDEX_LINKED) * e.effInterest + INDEX_LINKED * ilCost;
  e.blendedRate = blended;
  e.debt = clamp(
    e.debt * (1 + (blended - nominalGrowth) / 400) +
      primaryDeficit / 4 -
      e.fund * 0.02,
    -200,
    400,
  );
  const deficit = -(revShareEff - progShare - sp.interest);
  /* ---- Sectoral balances ----
     One sector's deficit is another's surplus, so the three must sum to zero:

         (S - I)private  +  (T - G)government  +  (M - X)foreign  =  0

     This is the Godley identity, and it was not holding: each block was
     individually sensible but nothing forced them to add up, so the model could
     produce combinations that cannot exist. Private disposable income is now
     defined properly as output less net taxes plus the debt interest the state
     pays out, which is what closes it.

     The residual is carried explicitly rather than hidden, so a drift shows up
     instead of quietly distorting the accounts. */ const trShare =
    govDemandShares(law, e).tr;
  const netTaxes = revShareEff - trShare;
  const privateDispY = 100 - netTaxes + sp.interest; // as % of GDP
  const consumeShare = (acct.C / e.gdp) * 100;
  const investShare = (acct.I / e.gdp) * 100;
  const measuredPrivate = privateDispY - consumeShare - investShare;
  e.balGovt = -deficit;
  e.balForeign = ((acct.M - acct.X) / e.gdp) * 100;
  /* Force the Godley identity for the stock that accumulates; keep the
     measurement gap as an explicit residual that feeds back into C. */ e.balPrivate =
    -(e.balGovt + e.balForeign);
  e.balResidual = measuredPrivate - e.balPrivate;
  e.residCarry = (e.residCarry || 0) * 0.55 + e.balResidual;
  /* Net private financial wealth accumulates the identity-consistent private
     balance and feeds consumption and credit collateral. */ if (
    e.privateWealth == null
  )
    e.privateWealth = PRIVATE_WEALTH0;
  e.privateWealth = clamp(e.privateWealth + e.balPrivate / 4, -50, 400);
  /* A creditor state still earns on its assets, but private finance does not
     keep getting cheaper with every extra point of net assets — see debtFinanceWedge. */ if (
    e.debt < 0
  ) {
    e.yield = clamp(e.rate + 0.3, 0.2, 25);
    e.riskPremium = 0;
  } else {
    /* Sovereign risk is always priced off excess debt above the seat's own
         opening anchor — same curve whether this bag is the player or an AI
         partner. Japan at 250% is its steady state; the Kingdom at 94% still
         pays more as debt climbs above that pin. */ const anchor =
      e.debtAnchor != null ? e.debtAnchor : 80;
    const debtForRisk = 80 + Math.max(0, e.debt - anchor);
    e.yield = clamp(
      e.rate +
        0.3 +
        Math.pow(Math.max(0, debtForRisk - 80), 1.35) * 0.012 +
        Math.pow(Math.max(0, deficit - 3), 1.4) * 0.2 +
        e.riskPremium -
        (law.policies.fiscalRule ? 0.5 : 0),
      0.2,
      25,
    );
  }
  e.riskPremium *= 0.7;
  /* High-debt openers (Japan) carry a long-maturity, financially-repressed
     stock: the effective coupon crawls toward the market yield much more slowly
     than a UK gilt portfolio. Without this, settle pins effInterest at ~1% and
     live play then marches it to 4–5% in a decade, blowing the debt ratio. */ const maturityPass =
    e.debtAnchor != null && e.debtAnchor >= 150
      ? MATURITY_PASS * 0.22
      : MATURITY_PASS;
  e.effInterest += (e.yield - e.effInterest) * maturityPass;
  if (law.policies.swf && deficit < 2) e.fund += 0.25;
  // wages, thresholds and fiscal drag
  e.wageIndex *= 1 + Math.max(-0.02, (growth + e.inflation) / 400);
  /* Headline CPI index — same inflation factor the Uprate toggle applies to
     cash thresholds, so real allowance holds when uprating and falls when frozen. */ e.cpiIndex =
    (e.cpiIndex || 1) * (1 + Math.max(0, e.inflation) / 400);
  if (law.income.uprate) {
    const up = 1 + Math.max(0, e.inflation) / 400;
    law.income.allowance *= up;
    law.income.bands.forEach((b: any) => (b.from *= up));
  }
  // society
  /* ---- Public services: volume against need, not an assumed decay ----
     The old model simply added a constant to required spending every quarter,
     so services degraded because they were told to. They now degrade for the
     two reasons they actually do.

     Baumol: a unit of public service costs the public sector wage bill divided
     by public sector productivity. Wages track economy-wide productivity, which
     grows several times faster than measured productivity in health and
     education, so a pound buys less volume every year.

       unit cost   = real wage / public productivity
       volume      = real spending / unit cost
       need        = population * demand per head(dependency ratio)
       quality     = volume / need

     A constant share of GDP therefore delivers falling quality without anyone
     deciding it should, and the size of the effect is derived from the
     productivity gap and the demography rather than picked. */ /* ---- Tax base indices ----
     Each is 1 at the opening settings, so a tax with `basis` set is scaled by
     how its own base has moved rather than by output.

     Revenue is already % of GDP. Bases are therefore GDP-share relatives and
     cyclical factors — not the GDP *index*. Multiplying by gdp/100 double-counted
     growth and sent fast seats' tax take toward 60%+ of GDP. */ const gapPct =
    e.gdp / e.potential - 1;
  const shareC0 = e.shareC != null ? e.shareC : SHARE_C;
  e.baseConsumption = e.C / Math.max(1e-6, shareC0);
  /* Wage-bill proxy: participation and unemployment, not the GDP index. */ e.baseWages =
    (e.participation || 1) * (1 - ((e.unemployment - U_STAR) / 100) * 1.4);
  e.profitShare = Math.max(0.15, 1 + PROFIT_CYC * gapPct);
  /* Profits booked here rather than abroad. A rate above the world average
     drives the base out; a rate below it pulls the base in, which is the whole
     logic of tax competition and the main reason corporation tax raises less
     than a static costing suggests. */ const cRate =
    law.taxes.corpTax && law.taxes.corpTax.on ? law.taxes.corpTax.rate : 0;
  e.profitShift = clamp(1 - SHIFT_ELAST * (cRate - WORLD_CORP), 0.45, 1.35);
  e.baseProfitsRaw = e.profitShare * e.profitShift;
  e.baseProfits = e.baseProfits + (e.baseProfitsRaw - e.baseProfits) * CORP_LAG;
  const realRateNow = e.rate - e.expect;
  const assetTarget =
    Math.max(0.25, 1 / (1 + (realRateNow - R_REAL_NEUTRAL) / ASSET_RATE)) *
    (1 + gapPct * 0.8);
  e.assetPrice += (assetTarget - e.assetPrice) * ASSET_ADJ;
  /* Asset-tax base tracks real asset prices (and the gap), not GDP level. */ e.baseAssetsRaw =
    e.assetPrice;
  e.baseAssets = e.baseAssets + (e.baseAssetsRaw - e.baseAssets) * CGT_LAG;
  e.fuelVolume *=
    1 -
    (FUEL_EROSION +
      CARBON_EROSION * (law.taxes.carbon.on ? law.taxes.carbon.rate : 0)) /
      400;
  e.pubProd *= 1 + PUB_PROD_GROWTH / 400;
  e.realWage *= 1 + Math.max(-0.5, pg) / 400; // wages track trend productivity
  const unitCost = e.realWage / e.pubProd;
  e.unitCost = unitCost;
  /* Departments set to hold their service level have their budget uprated to
     whatever that standard now costs — before quality is scored, so this
     quarter's services reflect the held standard at current unit costs.
     Three ways to set a budget, and they diverge over time:
       share    the default, a fixed share of GDP, so it grows with the economy
       real     indexed to inflation, so the cash keeps its value but the share
                falls as the economy grows and services decay faster
       service  the standard is fixed and the cost follows it
     The middle option is what "keep spending in line with inflation" means, and
     it is worth seeing that it is not enough to stop services deteriorating:
     inflation-indexing covers price rises but not the real wage growth of the
     people who deliver the service, nor a growing population. */ for (const d of DEPTS) {
    const mode = (law.mode || {})[d.id];
    if (!mode || mode === "share") continue;
    if (mode === "service" && !(TRANSFER_DEPTS as any)[d.id]) {
      const want = (law.hold || {})[d.id] || serviceScore(d.id, law, e);
      law.spend[d.id] = spendForScore(d.id, want, e);
    } else if (mode === "real") {
      // hold the cash constant in real terms: the share moves with real growth
      const realGrowth = Math.max(-8, growth);
      law.spend[d.id] = clamp(
        law.spend[d.id] * (1 - realGrowth / 400),
        d.min,
        d.max,
      );
    }
  }
  const hSpend = law.spend.health + law.spend.education * 0.55;
  const volume = ((hSpend / 100) * e.gdp) / unitCost;
  const need = (e.L / 100) * (1 + AGEING_HEALTH * (e.dependency - DEP_0));
  const quality = volume / need;
  const QUALITY_UK = 8.4 + 4.1 * 0.55; // Kingdom health + 0.55×education
  const quality0 = e.quality0 != null ? e.quality0 : QUALITY_UK;
  const services0 = e.services0 != null ? e.services0 : 55;
  const health0 = e.health0 != null ? e.health0 : 55;
  const crime0 = e.crime0 != null ? e.crime0 : CRIME_BASE;
  const liberty0 = e.liberty0 != null ? e.liberty0 : 58;
  const env0 = e.env0 != null ? e.env0 : 44;
  const openness0 = e.openness0 != null ? e.openness0 : 50;
  const gini0 = e.gini0 != null ? e.gini0 : 35;
  const sTarget = clamp(
    (services0 * quality) / Math.max(0.5, quality0) -
      Math.max(0, e.inflation - 2) * 1.2 +
      E.srv +
      E.hlt * 2 +
      (e.modSrv || 0) +
      (e.modHlt || 0) * 2,
    0,
    100,
  );
  e.services = clamp(e.services + (sTarget - e.services) * SVC_ADJ, 0, 100);
  e.svcQuality = quality / Math.max(0.5, quality0);
  /* Pension caseload rises with the dependency ratio, so a fixed share of GDP
     buys steadily less generosity per pensioner. This is the demographic squeeze
     the triple lock argues about. */ /* Triple lock: ΔP = max(wage growth, CPI, 2.5%) while the policy is on. */ if (
    e.pensionIndex == null
  )
    e.pensionIndex = 1;
  if (law.policies && law.policies.tripleLock) {
    const earnG = e.wageGrowth != null ? e.wageGrowth : Math.max(0, growth);
    const lock = Math.max(earnG, e.inflation, TRIPLE_FLOOR);
    e.pensionIndex *= 1 + lock / 400;
  }
  e.pensionAdequacy = welfareAdequacy(law, e);
  const soc0 = e.socOpen || {
    lib: 0,
    cri: 0,
    hlt: 0,
    env: 0,
    open: 0,
    blk: 10,
    justice: 1.9,
    envSpend: 0.8,
    carbon: 0,
  };
  const carbonNow =
    law.taxes.carbon && law.taxes.carbon.on ? law.taxes.carbon.rate : 0;
  e.health = clamp(
    e.health +
      (health0 +
        (E.hlt - soc0.hlt) * 6 +
        (e.modHlt || 0) * 6 +
        (e.services - services0) * 0.4 -
        Math.max(0, e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 1.1 -
        Math.max(0, e.dependency - DEP_0) * 18 -
        e.health) *
        0.15,
    0,
    100,
  );
  e.crime = clamp(
    e.crime +
      (crime0 +
        (E.cri - soc0.cri) * 1.6 +
        (e.modCri || 0) * 1.6 +
        (E.blackLevel - soc0.blk) * 0.35 -
        (law.spend.justice - soc0.justice) * 7 +
        (e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 2.2 +
        Math.max(0, e.gini - gini0) * 0.18 -
        e.crime) *
        0.16,
    0,
    100,
  );
  e.liberty = clamp(
    e.liberty + (liberty0 + (E.lib - soc0.lib) - e.liberty) * 0.25,
    0,
    100,
  );
  e.env = clamp(
    e.env +
      (env0 +
        (E.env - soc0.env) +
        (law.spend.environment - soc0.envSpend) * 6 +
        (carbonNow - soc0.carbon) * 0.5 -
        e.env) *
        0.14,
    0,
    100,
  );
  e.openness = clamp(openness0 + (E.open - soc0.open), 5, 95);
  /* Inequality is derived from the post-tax income distribution (and UBI / min
     wage where those policies are on). Unemployment and residual social `imp`
     still nudge the path, but authored Gini overrides are no longer the core. */ const distGini =
    prof.gini != null ? prof.gini : 35;
  const gTarget =
    distGini +
    (e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 0.35 +
    E.gini -
    (prof.progressivity - PROG_BASE) * 6;
  e.gini = clamp(e.gini + (gTarget - e.gini) * 0.14, 14, 68);
  e._lastGrowth = growth;
  e._lastDeficit = deficit;
  if (g._aiSeat) {
    g.q++;
    return {
      growth,
      pg,
      deficit,
      gap: newGap,
      E,
      rev,
      sp,
    };
  }
  // relations drift and react; missions leave a decaying impulse on the target
  ensureDiploStocks(e);
  seedGameRelBase(g);
  if (!g.envoys) g.envoys = emptyEnvoys();
  if (!g.ultimatums) g.ultimatums = {};
  const briefExtra = [];
  for (const p of activePartners(g.homeRole)) {
    tickEnvoyBuild(g, p.id);
    const t = relationTarget(p.id, g, law);
    const prev = g.rel[p.id] != null ? g.rel[p.id] : 50;
    g.rel[p.id] = clamp(prev + (t - prev) * 0.15, 0, 100);
    const impulse = e.relImpulse[p.id] || 0;
    if (impulse) e.relImpulse[p.id] = impulse * REL_IMPULSE_DECAY;
    if (Math.abs(e.relImpulse[p.id] || 0) < 0.05) delete e.relImpulse[p.id];
    if (e.missionCd[p.id] > 0) e.missionCd[p.id]--;
    if (e.ultimatumCd[p.id] > 0) e.ultimatumCd[p.id]--;
    /* Deal stress ladder: cold relations freeze access, then force a withdrawal. */ const partnerDeals =
      dealsWith(p.id, law);
    if (partnerDeals.length) {
      let floor = 28;
      for (const id of partnerDeals) {
        const need =
          ((DEAL_BY_ID as any)[id].need &&
            (DEAL_BY_ID as any)[id].need.relation) ||
          0;
        if (need) floor = Math.max(floor, need - 12);
      }
      if (g.rel[p.id] < floor)
        e.dealStress[p.id] = (e.dealStress[p.id] || 0) + 1;
      else e.dealStress[p.id] = Math.max(0, (e.dealStress[p.id] || 0) - 0.5);
      if ((e.dealStress[p.id] || 0) >= 4) {
        const softest = partnerDeals
          .slice()
          .sort(
            (a, b) =>
              ((DEAL_BY_ID as any)[a].pc || 0) -
              ((DEAL_BY_ID as any)[b].pc || 0),
          )[0];
        if (softest) {
          delete law.deals[softest];
          if (g.draft && g.draft.deals) delete g.draft.deals[softest];
          briefExtra.push(
            (DEAL_BY_ID as any)[softest].name +
              " with " +
              theCountry(p.name) +
              " collapsed under diplomatic strain.",
          );
          addDiploLedger(g, p.id, {
            id: "deal_collapse_" + softest,
            label: "Treaty collapsed under strain",
            pts: -8,
          });
          pushDiploAlert(g, {
            kind: "deal_collapse",
            partnerId: p.id,
            q: g.q || 0,
            label: (DEAL_BY_ID as any)[softest].name,
          });
        }
        e.dealStress[p.id] = 0;
      }
    } else {
      e.dealStress[p.id] = Math.max(0, (e.dealStress[p.id] || 0) - 0.5);
    }
  }
  processActiveVisits(g, briefExtra);
  decayDiploLedger(e);
  maybeClearSanctionStance(g);
  if (briefExtra.length && g.brief) g._dealCollapseNotes = briefExtra;
  // the public
  const realIncome = growth - Math.max(0, e.inflation - 2) * 0.85;
  const svcRef = e.services0 != null ? e.services0 : 55;
  const giniRef = e.gini0 != null ? e.gini0 : 35;
  const libRef = e.liberty0 != null ? e.liberty0 : 58;
  const envRef = e.env0 != null ? e.env0 : 44;
  const crimeRef = e.crime0 != null ? e.crime0 : CRIME_BASE;
  const openRef = e.openness0 != null ? e.openness0 : 50;
  const common =
    40 +
    realIncome * 2.6 -
    Math.max(0, e.inflation - 3) * 2.0 -
    (e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 2.6 +
    (e.services - svcRef) * 0.4;
  const extra = {
    business: (pg - 1.5) * 5,
    workers:
      -(e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 2.0 -
      (e.gini - giniRef) * 0.3,
    pensioners:
      -Math.max(0, e.inflation - 2) * 2.2 + (e.services - svcRef) * 0.25,
    urban: (e.liberty - libRef) * 0.22 + (e.env - envRef) * 0.14,
    rural: -(e.crime - crimeRef) * 0.14,
    patriots: -(e.openness - openRef) * 0.14 - (e.crime - crimeRef) * 0.2,
  };
  const basicRate = law.income.on === false ? 0 : law.income.bands[0].rate;
  const topRate =
    law.income.on === false
      ? 0
      : law.income.bands[law.income.bands.length - 1].rate;
  extra.workers -= (basicRate - 20) * 0.55;
  extra.business -= (topRate - 45) * 0.22;
  extra.urban += (prof.progressivity - PROG_BASE) * 10;
  extra.rural -= (basicRate - 20) * 0.3;
  const fiscalDrag = clamp(1 - dragRatio(law, e), -0.4, 0.6);
  extra.workers -=
    fiscalDrag * 16 +
    ((law.ni.empOn === false ? 0 : law.ni.empRate) - DEF_NI.empRate) * 0.9;
  extra.pensioners -= fiscalDrag * 10;
  extra.pensioners += ((e.pensionAdequacy || 1) - 1) * 30;
  /* The empirical result on employer payroll taxes is that most of the burden
     lands on wages within a few years rather than on employment. So the bulk of
     it is felt by workers as pay that never arrives, a smaller part by
     employers, and only a little shows up as structural unemployment above. */ extra.business -=
    erGap * 0.55;
  extra.workers -= erGap * 0.6;
  const shock = billShock(law, prevLaw);
  for (const f of FACTIONS) {
    const t = common + (E.fac as any)[f.id] + ((extra as any)[f.id] || 0);
    g.fac[f.id] = clamp(
      g.fac[f.id] + (t - g.fac[f.id]) * 0.2 + ((shock as any)[f.id] || 0) + mA,
      2,
      96,
    );
  }
  driftSeatParties(g);
  const appr = approvalOf(g.fac);
  const { gain, envoyUpkeep } = capitalRegenGain(g, law, appr);
  g.capital = clamp(g.capital + gain - envoyUpkeep, 0, 100);
  const ruleHit = fiscalRuleCapitalHit(law, deficit);
  if (ruleHit) {
    g.ruleBreaches++;
    g.capital = clamp(g.capital - ruleHit, 0, 100);
  }
  g.q++;
  processBlocInvites(g);
  processBlocAccessions(g);
  processUltimatums(g, det);
  if (g.world) {
    mirrorPlayerToWorld(g);
    syncNationsFromWorld(g, true);
  }
  g.log.push({
    label: qLabel(g, g.q - 1),
    growth,
    inflation: e.inflation,
    unemployment: e.unemployment,
    balance: -deficit,
    debt: e.debt,
    yield: e.yield,
    approval: appr,
    rate: e.rate,
    gdp: e.gdp,
    potential: e.potential,
    services: e.services,
    gini: e.gini,
    capital: g.capital,
    C: acct.C,
    I: acct.I,
    Gov: acct.G,
    X: acct.X,
    M: acct.M,
    netTrade: acct.X - acct.M,
    K: e.K,
    tfp: e.A * 1000,
    userCost: e.ucSmooth,
    trend: pg,
    drag: dragRatio(law, e),
    allowance: law.income.allowance,
    fx: fxDisplayIndex("home", g),
    ccyRates: snapshotCurrencyRates(g),
    fac: Object.assign({}, g.fac),
    parties:
      g.parties && g.parties.popularity
        ? Object.assign({}, g.parties.popularity)
        : null,
    rev: rev.total,
    spend: sp.prog + mS,
    interest: sp.interest,
    partnerTariffs: snapshotPartnerTariffs(g),
    partnerTrade: snapshotPartnerTrade(g),
  });
  return {
    growth,
    pg,
    deficit,
    gap: newGap,
    E,
    rev,
    sp,
  };
}
/* one-off popularity jolt from what the bill actually did */ function billShock(
  law: any,
  prevLaw: any,
) {
  const s = {
    business: 0,
    workers: 0,
    pensioners: 0,
    urban: 0,
    rural: 0,
    patriots: 0,
  };
  for (const t of TAXES) {
    const a = prevLaw.taxes[t.id],
      b = law.taxes[t.id];
    if (!a || !b) continue;
    const wasOn = a.on && taxAvailable(t, prevLaw),
      isOn = b.on && taxAvailable(t, law);
    const d = (isOn ? b.rate : 0) - (wasOn ? a.rate : 0);
    if (!d) continue;
    const weight =
      t.grp === "income" ? 0.55 : t.grp === "consumption" ? 0.4 : 0.25;
    for (const f in s) (s as any)[f] -= d * weight * 0.5;
    if (t.fac) {
      for (const f in t.fac)
        if (f in s) (s as any)[f] += ((t.fac as any)[f] || 0) * d * 0.25;
    }
  }
  const rateNow = (law: any) =>
    law.income.on === false ? 0 : law.income.bands[0].rate;
  const topNow = (law: any) =>
    law.income.on === false
      ? 0
      : law.income.bands[law.income.bands.length - 1].rate;
  const dBasic = rateNow(law) - rateNow(prevLaw);
  const dAllow = (law.income.allowance - prevLaw.income.allowance) / 1000;
  const dEmp =
    (law.ni.empOn === false ? 0 : law.ni.empRate) -
    (prevLaw.ni.empOn === false ? 0 : prevLaw.ni.empRate);
  const dEr =
    (law.ni.erOn === false ? 0 : law.ni.erRate) -
    (prevLaw.ni.erOn === false ? 0 : prevLaw.ni.erRate);
  s.workers += -dBasic * 1.7 + dAllow * 1.9 - dEmp * 1.9;
  s.pensioners += -dBasic * 1.1 + dAllow * 1.3;
  s.urban += -dBasic * 1.2 + dAllow * 1.2 - dEmp * 0.9;
  s.rural += -dBasic * 1.2 + dAllow * 1.2 - dEmp * 0.9;
  s.business += -dEr * 2.4 - dBasic * 0.3;
  const dTop =
    law.income.bands.length === prevLaw.income.bands.length ||
    law.income.on === false ||
    prevLaw.income.on === false
      ? topNow(law) - topNow(prevLaw)
      : 0;
  s.business -= dTop * 1.1;
  s.workers += dTop * 0.5;
  for (const dp of DEPTS) {
    const d = law.spend[dp.id] - prevLaw.spend[dp.id];
    if (!d) continue;
    const pop = {
      health: 1.5,
      education: 0.9,
      welfare: 1.2,
      infra: 0.4,
      research: 0.35,
      defence: 0.3,
      justice: 0.6,
      environment: 0.3,
    }[dp.id]!;
    for (const f in s) (s as any)[f] += d * pop * 0.55;
  }
  if (prevLaw.polity && law.polity && prevLaw.polity !== law.polity) {
    const pf = polityShockFac(prevLaw.polity, law.polity);
    for (const f in pf) if (f in s) (s as any)[f] += (pf as any)[f];
  }
  return s;
}
function qLabel(g: any, i: any) {
  return (
    "Y" + (Math.floor(i / 4) + 1 + (g.term - 1) * 5) + " Q" + ((i % 4) + 1)
  );
}

/** Brief flash when a quarter advances — solo Deliver and multiplayer resolve.
 *  Returns a Promise that resolves when the flash has finished (or immediately
 *  when reduced-motion / no DOM), so the morning note can wait. */
const QUARTER_FLASH_MS = 2500;
let _lastQuarterFlashKey: string | null = null;
let _quarterFlashLock = false;
function isDeliverLocked() {
  return _quarterFlashLock || pressChoicePending();
}

function announceQuarterAdvance() {
  return new Promise<void>((resolve) => {
    if (typeof document === "undefined" || !G) {
      resolve();
      return;
    }
    /* One flash per seat-quarter — avoids a second wash after a summit choice. */
    const flashKey = (G.homeRole || "home") + ":" + G.term + ":" + G.q;
    if (_lastQuarterFlashKey === flashKey) {
      resolve();
      return;
    }
    _lastQuarterFlashKey = flashKey;
    /* Newspapers wait until the flash finishes — hide any leftover clips. */
    const pressHost = document.getElementById("pressLayer");
    if (pressHost) pressHost.hidden = true;
    const finish = () => {
      if (pressHost) pressHost.hidden = false;
      resolve();
    };
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tb = document.getElementById("tbTerm");
    if (tb) {
      tb.classList.remove("q-advance");
      void tb.offsetWidth;
      tb.classList.add("q-advance");
      window.setTimeout(
        () => tb.classList.remove("q-advance"),
        QUARTER_FLASH_MS + 100,
      );
    }
    const el = document.getElementById("quarterFlash");
    if (reduced || !el) {
      window.setTimeout(finish, reduced ? 160 : 40);
      return;
    }
    const label = el.querySelector(".quarter-flash-label");
    if (label) label.textContent = qLabel(G, G.q);
    el.hidden = false;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
    window.setTimeout(() => {
      el.classList.remove("on");
      el.hidden = true;
      finish();
    }, QUARTER_FLASH_MS);
  });
}

function morningNoteStamp() {
  if (!G) return "Permanent Secretary";
  return "Permanent Secretary · " + qLabel(G, G.q);
}
/* ==================================================================
   5. PROJECTION  (the independent forecast)
   ================================================================== */ /* Deterministic counterfactual: run `law` forward from today's state without
   touching the live game. Everything in the impact panel is derived from this,
   so the numbers shown can never drift away from the model that produces them.
   `opts` can override monetary mode so a pinned-rate path can be scored against
   the Bank without mutating live G. */ function simulate(
  law: any,
  quarters: any,
  opts?: any,
) {
  const o = opts || {};
  const rateManual = o.rateManual != null ? !!o.rateManual : !!G.rateManual;
  const manualRate = o.manualRate != null ? o.manualRate : G.manualRate;
  const draft = clone(law);
  const sim = {
    q: G.q,
    term: G.term,
    mods: clone(G.mods),
    econ: clone(G.econ),
    fac: clone(G.fac),
    parties: G.parties ? clone(G.parties) : null,
    rel: clone(G.rel),
    capital: G.capital,
    log: [],
    ruleBreaches: 0,
    sandbox: true,
    rateManual,
    manualRate,
    homeRole: G.homeRole,
    country: G.country,
    law: draft,
    draft,
    prevLaw: clone(G.law),
    blocMember: clone(o.blocMember != null ? o.blocMember : G.blocMember),
    customBlocs: clone(o.customBlocs != null ? o.customBlocs : G.customBlocs),
    blocInvites: clone(G.blocInvites),
    blocAccessionByCountry: clone(G.blocAccessionByCountry || {}),
    world: G.world ? cloneWorldForSim(G) : null,
    episode: G.episode ? clone(G.episode) : null,
    nextMajorQ: G.nextMajorQ,
    envoys: clone(G.envoys || emptyEnvoys()),
    ultimatums: clone(G.ultimatums || {}),
    diploAlerts: clone(G.diploAlerts || []),
    missionEvents: clone(G.missionEvents || []),
    activeVisits: clone(G.activeVisits || {}),
    _settling: !G.world,
  };
  const rateLo = rateManual ? MANUAL_RATE_MIN : RATE_FLOOR;
  if (o.rate != null) sim.econ.rate = clamp(o.rate, rateLo, 20);
  else if (rateManual && manualRate != null)
    sim.econ.rate = clamp(manualRate, rateLo, 20);
  const rows = [];
  let prev = clone(G.law);
  for (let i = 0; i < quarters; i++) {
    const r = step(sim, draft, prev, true);
    prev = draft;
    rows.push({
      label: qLabel(sim, sim.q - 1),
      growth: r.growth,
      inflation: sim.econ.inflation,
      unemployment: sim.econ.unemployment,
      balance: -r.deficit,
      debt: sim.econ.debt,
      yield: sim.econ.yield,
      gap: r.gap,
      approval: approvalOf(sim.fac),
      services: sim.econ.services,
      trend: sim.econ.trendGrowth,
      potential: sim.econ.potential,
      netTrade: sim.econ.acct ? sim.econ.acct.X - sim.econ.acct.M : 0,
      fx: fxDisplayIndex("home", sim),
    });
  }
  return {
    rows,
    end: sim,
  };
}
/** Forward simulation that applies staged bloc join/leave/create on top of a draft law. */ function simulateFromDraft(
  draft: any,
  quarters: any,
  opts?: any,
) {
  const snap = draftBlocSnapshotFrom(draft);
  const law = clone(draft);
  applyDraftBlocLaw(law, snap, draft);
  return simulate(
    law,
    quarters,
    Object.assign({}, opts || {}, {
      blocMember: snap.blocMember,
      customBlocs: snap.customBlocs,
    }),
  );
}
function project(quarters: any) {
  return simulateFromDraft(G.draft, quarters);
}
/* ---- The forecast is not the outturn ----
   The projection used to run the true model, so it was always exactly right.
   Real Chancellors are handed forecasts that miss: the OBR's own one-year-ahead
   error is around 1% of GDP on borrowing and well over a point on growth. The
   numbers shown are therefore perturbed by a persistent error drawn once per
   forecast, which is what makes the decision a judgement rather than a lookup. */ const FC_GROWTH_SD = 0.75,
  FC_BAL_SD = 0.55,
  FC_INF_SD = 0.45;
function withForecastError(p: any) {
  /* Sandbox is the mode for seeing how the model works, so the forecast is the
     model: no error, and the projection is exactly what will happen if nothing
     else does. Turn sandbox off and you get the Chancellor's actual problem,
     which is deciding on numbers that will turn out to be wrong. */ if (
    G.sandbox
  )
    return {
      rows: p.rows,
      end: p.end,
      err: {
        growth: 0,
        balance: 0,
      },
      exact: true,
    };
  const gauss = () =>
    (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  const eg = gauss() * FC_GROWTH_SD,
    eb = gauss() * FC_BAL_SD,
    ei = gauss() * FC_INF_SD;
  const rows = p.rows.map((r: any, i: any) => {
    const ramp = (i + 1) / p.rows.length; // error widens with the horizon
    return Object.assign({}, r, {
      growth: r.growth + eg * ramp,
      balance: r.balance + eb * ramp,
      inflation: r.inflation + ei * ramp,
      unemployment: r.unemployment - eg * ramp * 0.3,
      debt: r.debt - eb * ramp * 0.9,
    });
  });
  return {
    rows,
    end: p.end,
    err: {
      growth: eg,
      balance: eb,
    },
  };
}
/* The law you would have if only clause `i` of the current bill passed. Built by
   cloning the draft and undoing every other clause, so it uses exactly the same
   machinery the bill itself does rather than a parallel description of it. */ function lawWithOnlyClause(
  i: any,
) {
  const saved = G.draft;
  G.draft = clone(G.draft);
  const cl = billClauses();
  cl.forEach((c, j) => {
    if (j !== i) c.undo();
  });
  const only = clone(G.draft);
  G.draft = saved;
  return only;
}
const IMPACT_ROWS = [
  {
    k: "balance",
    name: "Budget balance",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "growth",
    name: "Growth",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "trend",
    name: "Trend growth",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "potential",
    name: "Potential",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "inflation",
    name: "Inflation",
    unit: "pts",
    dp: 2,
    good: "down",
  },
  {
    k: "unemployment",
    name: "Unemployment",
    unit: "pts",
    dp: 2,
    good: "down",
  },
  {
    k: "debt",
    name: "Debt",
    unit: "pts",
    dp: 2,
    good: "down",
  },
  {
    k: "yield",
    name: "Gilt yield",
    unit: "pts",
    dp: 2,
    good: "down",
  },
  {
    k: "approval",
    name: "Approval",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "services",
    name: "Public services",
    unit: "pts",
    dp: 2,
    good: "up",
  },
  {
    k: "fx",
    name: "Currency strength",
    unit: "pts",
    dp: 1,
    good: "up",
  },
];
/* Compound the path's quarterly growth rates into total % growth over the
   horizon. Each row's `growth` is already annualised (qoq × 400), so undo that
   before compounding. Over four quarters this is year-on-year GDP growth. */ function pathGrowth(
  rows: any,
) {
  let y = 1;
  for (const r of rows) y *= 1 + r.growth / 400;
  return (y - 1) * 100;
}
/* Difference a law makes against a baseline, after `quarters` quarters.
   Most headline series are end-of-horizon levels. Growth is the cumulative
   rise in GDP over the whole path versus the baseline path — not the final
   quarter's annualised pace, which whipsaws after a level jump. */ function impactOf(
  law: any,
  baseline: any,
  quarters: any,
) {
  const v = simulateFromDraft(law, quarters);
  const a = baseline.rows[baseline.rows.length - 1],
    b = v.rows[v.rows.length - 1];
  const out: Record<string, any> = {
    head: {},
    fac: {},
    gini: v.end.econ.gini - baseline.end.econ.gini,
  };
  IMPACT_ROWS.forEach((r) => {
    (out.head as any)[r.k] =
      r.k === "growth"
        ? pathGrowth(v.rows) - pathGrowth(baseline.rows)
        : (b as any)[r.k] - a[r.k];
  });
  FACTIONS.forEach((f) => {
    (out.fac as any)[f.id] = v.end.fac[f.id] - baseline.end.fac[f.id];
  });
  out.revenue =
    revenue(law, aggregate(law)).total - revenue(G.law, aggregate(G.law)).total;
  return out;
}
/* Pin the base rate versus leaving it with the Bank, same horizon as the bill
   impact panel. Uses current law so the strip isolates the monetary choice. */ function impactOfRatePin(
  quarters: any,
) {
  const q = quarters || 4;
  const pin = clamp(
    G.manualRate != null ? G.manualRate : G.econ.rate,
    MANUAL_RATE_MIN,
    20,
  );
  const base = simulate(G.law, q, {
    rateManual: false,
  });
  const v = simulate(G.law, q, {
    rateManual: true,
    manualRate: pin,
    rate: pin,
  });
  const a = base.rows[base.rows.length - 1],
    b = v.rows[v.rows.length - 1];
  const out = {
    head: {},
    fac: {},
    gini: v.end.econ.gini - base.end.econ.gini,
    pin,
    revenue: 0,
  };
  IMPACT_ROWS.forEach((r) => {
    (out.head as any)[r.k] =
      r.k === "growth"
        ? pathGrowth(v.rows) - pathGrowth(base.rows)
        : (b as any)[r.k] - (a as any)[r.k];
  });
  FACTIONS.forEach((f) => {
    (out.fac as any)[f.id] = v.end.fac[f.id] - base.end.fac[f.id];
  });
  return out;
}
function rateImpactData() {
  if (!G.rateManual) return null;
  let im;
  try {
    im = impactOfRatePin(4);
  } catch {
    return null;
  }
  const chips = impactChipsData(im);
  const empty = chips.length === 0;
  return {
    pin: im.pin,
    empty,
    chips,
    factions: empty ? null : impactFactionsData(im),
  };
}
function projectionWarnings(p: any) {
  const w = [],
    last = p.rows[p.rows.length - 1],
    first = p.rows[0],
    e = p.end.econ;
  if (last.yield > 7.5)
    w.push(
      "Gilt yields reach " +
        last.yield.toFixed(1) +
        "%. The debt market is repricing {C}.",
    );
  if (last.debt > G.econ.debt + 4)
    w.push(
      "Debt rises " +
        (last.debt - G.econ.debt).toFixed(1) +
        " points of GDP over four quarters and keeps climbing.",
    );
  if (last.balance < -7)
    w.push(
      "The deficit settles near " +
        Math.abs(last.balance).toFixed(1) +
        "% of GDP, well beyond what the market has tolerated before.",
    );
  if (e.inflation > 5)
    w.push(
      "Inflation is still " +
        e.inflation.toFixed(1) +
        "% a year out, so expect the Bank to keep tightening.",
    );
  if (e.inflation < 0.5)
    w.push(
      "Inflation drops to " +
        e.inflation.toFixed(1) +
        "%. Deflation risk is real.",
    );
  if (first.growth < -0.4)
    w.push(
      "The first quarter contracts. Fiscal tightening lands before anything else does.",
    );
  if (last.unemployment > G.econ.unemployment + 0.8)
    w.push(
      "Unemployment rises " +
        (last.unemployment - G.econ.unemployment).toFixed(1) +
        " points on this plan.",
    );
  if (last.approval < 32) {
    const meta = polityOf(G.homeRole);
    if (meta.coupOn === "patriots") {
      w.push(
        "Approval falls to " +
          last.approval.toFixed(0) +
          "%. The party apparatus will notice if loyalty frays.",
      );
    } else {
      w.push(
        "Approval falls to " +
          last.approval.toFixed(0) +
          "%. Your parliamentary party will notice.",
      );
    }
  }
  if (e.services < 40)
    w.push(
      "Public services degrade to " +
        e.services.toFixed(0) +
        " on the composite index.",
    );
  if (G.draft.policies.fiscalRule && last.balance < -4)
    w.push("This plan breaches your own statutory debt rule.");
  const vote = billVoteData();
  if (vote && vote.needed && !vote.advisory && !vote.pass) {
    w.push(
      "The chamber is " +
        vote.aye +
        "–" +
        vote.nay +
        ". This bill does not have a majority.",
    );
  } else if (vote && vote.needed && vote.advisory && !vote.pass) {
    w.push(
      "The assembly would vote " +
        vote.aye +
        "–" +
        vote.nay +
        ". It cannot bind you, but the apparatus will notice.",
    );
  }
  if (!w.length)
    w.push(
      "Nothing in this plan trips a Treasury warning. The forecast is still a forecast.",
    );
  return w;
}
/* ==================================================================
   6. THE BILL  (diff between what is law and what you propose)
   ================================================================== */ const dp =
  (t: any) => (t.step && t.step < 1 ? 1 : 0);
const fmtRate = (t: any, r: any) => r.toFixed(dp(t)) + "%";
const rateCost = (t: any, d: any) =>
  Math.max(1, Math.ceil((Math.abs(d) / t.max) * 25));
/** Generic diff for a bespoke slider group living directly on `law` — the
 *  law.income/law.ni pattern (see CLAUDE.md "TypeScript migration"), lifted
 *  into one shared helper instead of one hand-written block per group.
 *  Every clause is tagged `tab: "laws"`. */ function sliderGroupClauses(
  out: any[],
  groupKey: string,
  label: string,
  L: any,
  D: any,
  fields: Record<
    string,
    { name: string; pc: number; decimals?: number; unit?: string }
  >,
) {
  const a = L[groupKey] || {};
  const b = D[groupKey] || {};
  for (const key in fields) {
    const av = a[key];
    const bv = b[key];
    const f = fields[key];
    if (typeof av === "boolean" || typeof bv === "boolean") {
      if (!!av === !!bv) continue;
      out.push({
        label: label + ": " + f.name + (bv ? " on" : " off"),
        pc: f.pc,
        tab: "laws",
        undo: () => {
          b[key] = av;
        },
      });
      continue;
    }
    if (Math.abs((bv || 0) - (av || 0)) < 1e-9) continue;
    const dec = f.decimals ?? 0;
    const unit = f.unit || "";
    out.push({
      label:
        label +
        ": " +
        f.name +
        " " +
        (av || 0).toFixed(dec) +
        unit +
        " to " +
        (bv || 0).toFixed(dec) +
        unit,
      pc: Math.max(1, Math.ceil(Math.abs(bv - av) * f.pc)),
      tab: "laws",
      undo: () => {
        b[key] = av;
      },
    });
  }
}
/** Per-partner/per-bloc tariff clauses — identical undo/fallback logic for
 *  both scopes (an unset override falls back to the schedule default),
 *  differing only in which sub-object is touched and how the id names. */
function tariffScopeClauses(
  out: any[],
  D: any,
  L: any,
  scope: "bloc" | "country",
  nameOf: (id: string) => string,
  baseline: number,
) {
  for (const id in D.tariffSchedule[scope]) {
    const raw = L.tariffSchedule[scope][id];
    const a = raw != null ? raw : baseline;
    const b = D.tariffSchedule[scope][id];
    if (a === b) continue;
    out.push({
      label: nameOf(id) + " tariff " + a + "% to " + b + "%",
      pc: Math.max(1, Math.ceil(Math.abs(b - a) * 0.6)),
      undo: () => {
        if (raw == null) delete D.tariffSchedule[scope][id];
        else D.tariffSchedule[scope][id] = raw;
        syncTariffHeadline(D);
      },
    });
  }
}
function billClauses() {
  pruneDraftBlocInvites();
  const L = G.law,
    D = G.draft,
    out = [];
  /* Flat/Dual are derived (isFlatIncome/isDualCapital), not a separate
     pick, and deliberately carry no clause of their own — reaching either
     one is already priced through the band/rate clauses below (restructure
     the bands, each band's own rate change, dividend/savings rate changes).
     A standalone "you triggered Flat, that's 34 capital" surcharge on top
     would be an extra, unexplained cost with nothing in the UI to justify
     it now that there's no regime label shown. */
  if ((D.polity || "democracy") !== (L.polity || "democracy")) {
    const to = D.polity || "democracy";
    const from = L.polity || "democracy";
    if (polityCanReach(from, to)) {
      out.push({
        label:
          "Change the political system: " +
          ((POLITY[to] && POLITY[to].label) || to),
        pc: polityChangePc(from, to),
        tab: "laws",
        undo: () => {
          D.polity = L.polity;
        },
      });
    } else {
      D.polity = L.polity;
    }
  }
  for (const t of TAXES) {
    const a = L.taxes[t.id],
      b = D.taxes[t.id];
    if (a.on !== b.on) {
      out.push({
        label:
          (b.on ? "Introduce " : "Abolish ") +
          t.name +
          (b.on ? " at " + fmtRate(t, b.rate) : ""),
        pc: b.on ? t.pc || 6 : Math.ceil((t.pc || 6) * 0.6),
        undo: () => {
          b.on = a.on;
          b.rate = a.rate;
        },
      });
    } else if (a.on && Math.abs(a.rate - b.rate) > 1e-9) {
      out.push({
        label: t.name + ", " + fmtRate(t, a.rate) + " to " + fmtRate(t, b.rate),
        pc: rateCost(t, b.rate - a.rate),
        undo: () => {
          b.rate = a.rate;
        },
      });
    }
  }
  // income tax structure
  if ((L.income.on !== false) !== (D.income.on !== false)) {
    const abolishing = D.income.on === false;
    out.push({
      label: (abolishing ? "Abolish " : "Reintroduce ") + "income tax",
      pc: abolishing ? 32 : 28,
      undo: () => {
        D.income.on = L.income.on;
      },
    });
  }
  if (D.income.on !== false) {
    if (Math.abs(D.income.allowance - L.income.allowance) > 1) {
      out.push({
        label:
          "Personal allowance " +
          money(L.income.allowance) +
          " to " +
          money(D.income.allowance),
        pc: Math.max(
          1,
          Math.ceil(Math.abs(D.income.allowance - L.income.allowance) / 1800),
        ),
        undo: () => {
          D.income.allowance = L.income.allowance;
          D.income.bands[0].from = L.income.bands[0].from;
        },
      });
    }
    if (
      Math.abs(
        (D.income.taperStart != null ? D.income.taperStart : TAPER_START) -
          (L.income.taperStart != null ? L.income.taperStart : TAPER_START),
      ) > 1
    ) {
      const from =
        L.income.taperStart != null ? L.income.taperStart : TAPER_START;
      const to =
        D.income.taperStart != null ? D.income.taperStart : TAPER_START;
      out.push({
        label: "Allowance taper starts at " + money(from) + " to " + money(to),
        pc: Math.max(1, Math.ceil(Math.abs(to - from) / 5000)),
        undo: () => {
          D.income.taperStart = L.income.taperStart;
        },
      });
    }
    if (D.income.uprate !== L.income.uprate) {
      out.push({
        label: D.income.uprate
          ? "Uprate thresholds with inflation each year"
          : "Freeze thresholds in cash terms",
        pc: 8,
        undo: () => {
          D.income.uprate = L.income.uprate;
        },
      });
    }
    if (D.income.bands.length !== L.income.bands.length) {
      out.push({
        label:
          "Restructure the rate bands: " +
          L.income.bands.length +
          " to " +
          D.income.bands.length,
        pc: 12,
        undo: () => {
          D.income.bands = clone(L.income.bands);
        },
      });
    } else {
      D.income.bands.forEach((b: any, i: any) => {
        const a = L.income.bands[i];
        if (Math.abs(a.rate - b.rate) > 1e-9)
          out.push({
            label:
              (BAND_NAMES[i] || "Band " + (i + 1)) +
              " rate " +
              a.rate +
              "% to " +
              b.rate +
              "%",
            pc: Math.max(1, Math.ceil(Math.abs(b.rate - a.rate) / 3)),
            undo: () => {
              b.rate = a.rate;
            },
          });
        if (i > 0 && Math.abs(a.from - b.from) > 1)
          out.push({
            label:
              (BAND_NAMES[i] || "Band " + (i + 1)) +
              " threshold " +
              money(a.from) +
              " to " +
              money(b.from),
            pc: Math.max(1, Math.ceil(Math.abs(b.from - a.from) / 2500)),
            undo: () => {
              b.from = a.from;
            },
          });
      });
    }
    const CAP_LABEL = {
      divRate: "Dividend rate",
      saveRate: "Savings rate",
    };
    for (const k in CAP_LABEL) {
      const a = L.income[k],
        b = D.income[k];
      if (a == null || b == null || Math.abs(a - b) < 1e-9) continue;
      out.push({
        label:
          (CAP_LABEL as any)[k] +
          " " +
          a.toFixed(0) +
          "% to " +
          b.toFixed(0) +
          "%",
        pc: Math.max(1, Math.ceil(Math.abs(b - a) / 4)),
        undo: () => {
          D.income[k] = a;
        },
      });
    }
  }
  /* Abolition first: if a side is being scrapped, its rate and threshold moves
     are moot, so they are suppressed to keep the bill readable. */ [
    ["empOn", "Employee national insurance"],
    ["erOn", "Employer national insurance"],
  ].forEach((param) => {
    const [k, name] = param;
    if (L.ni[k] === D.ni[k]) return;
    const abolishing = !D.ni[k];
    out.push({
      label: (abolishing ? "Abolish " : "Reintroduce ") + name.toLowerCase(),
      pc: abolishing ? 26 : 20,
      undo: () => {
        D.ni[k] = L.ni[k];
      },
    });
  });
  const NI_LABEL = {
    empRate: "Employee NI rate",
    erRate: "Employer NI rate",
  };
  for (const k in NI_LABEL) {
    const a = L.ni[k],
      b = D.ni[k];
    if (Math.abs(a - b) < 1e-9) continue;
    if (!D.ni.empOn && k === "empRate") continue; // scrapped: the rate is moot
    if (!D.ni.erOn && k === "erRate") continue;
    out.push({
      label:
        (NI_LABEL as any)[k] +
        " " +
        a.toFixed(1) +
        "% to " +
        b.toFixed(1) +
        "%",
      pc: Math.max(1, Math.ceil(Math.abs(b - a) / 1.5)),
      undo: () => {
        D.ni[k] = a;
      },
    });
  }
  for (const d of DEPTS) {
    const mL = (L.mode || {})[d.id] || "share",
      mD = (D.mode || {})[d.id] || "share";
    if (mL !== mD) {
      const label = {
        share: "a fixed share of GDP",
        real: "indexed to inflation",
        service: "pegged to its service level",
      };
      out.push({
        label: d.name + " budget " + (label as any)[mD],
        pc: 5,
        undo: () => {
          if (mL === "share") delete D.mode[d.id];
          else D.mode[d.id] = mL;
          if (mL === "service") D.hold[d.id] = (L.hold || {})[d.id];
          else delete D.hold[d.id];
        },
      });
    }
    const diff = D.spend[d.id] - L.spend[d.id];
    if (Math.abs(diff) > 1e-9)
      out.push({
        label: d.name + " " + sgn(diff, 1) + " points of GDP",
        pc: Math.max(1, Math.ceil(Math.abs(diff) * 2)),
        undo: () => {
          D.spend[d.id] = L.spend[d.id];
          /* Spend and hold travel together in service mode — undoing one
                 without the other leaves step() enforcing a stale standard. */ if (
            ((D.mode || {})[d.id] || "share") === "service"
          ) {
            if (!D.hold) D.hold = {};
            if ((L.hold || {})[d.id] != null) D.hold[d.id] = L.hold[d.id];
            else delete D.hold[d.id];
          }
        },
      });
  }
  {
    ensureTariffSchedule(D);
    ensureTariffSchedule(L);
    const tLock = tariffLocked(D);
    if (tLock.mode === "cet" && tLock.cet != null) {
      /* The shared baseline replaces "default" while in a customs union, but
       * bloc/country overrides against outsiders stay player-editable —
       * only the CET itself needs the rest of the union to sign off
       * (tariffCetBlockers()). */
      D.tariffSchedule.default = L.tariffSchedule.default;
    } else {
      const lock = lockedTariff(L);
      if (lock != null) {
        D.tariffSchedule.default = lock;
        D.tariffSchedule.cet = lock;
        D.tariffSchedule.bloc = clone(L.tariffSchedule.bloc);
        D.tariffSchedule.country = clone(L.tariffSchedule.country);
      }
    }
    if (
      D.tariffSchedule.cet !== L.tariffSchedule.cet &&
      tLock.mode !== "none"
    ) {
      out.push({
        label:
          "Common external tariff " +
          (L.tariffSchedule.cet || tLock.cet) +
          "% to " +
          D.tariffSchedule.cet +
          "%",
        pc: Math.max(
          2,
          Math.ceil(
            Math.abs(
              (D.tariffSchedule.cet || 0) - (L.tariffSchedule.cet || 0),
            ) * 1.2,
          ),
        ),
        undo: () => {
          D.tariffSchedule.cet = L.tariffSchedule.cet;
          syncTariffHeadline(D);
        },
      });
    }
    /* Same "before" baseline effectiveTariff()/the UI use: the law's CET
     * while in a customs union (bloc/country overrides layer on top of it),
     * else the plain default schedule. Using the stale `default` field
     * unconditionally here mispriced/mislabeled a locked member's own
     * outsider-tariff clauses against a rate they were never actually on. */
    const lawBaseline =
      tLock.mode === "cet"
        ? L.tariffSchedule.cet != null
          ? L.tariffSchedule.cet
          : (tLock.cet ?? L.tariffSchedule.default)
        : L.tariffSchedule.default;
    tariffScopeClauses(
      out,
      D,
      L,
      "bloc",
      (bid) => {
        const bloc = blocById(bid);
        return bloc ? bloc.name : bid;
      },
      lawBaseline,
    );
    tariffScopeClauses(
      out,
      D,
      L,
      "country",
      (cid) => {
        const c = partnerById(cid);
        return c ? c.name : cid;
      },
      lawBaseline,
    );
    if (
      D.tariffSchedule.default !== L.tariffSchedule.default &&
      tLock.mode === "none"
    ) {
      out.push({
        label:
          "Default external tariff " +
          L.tariffSchedule.default +
          "% to " +
          D.tariffSchedule.default +
          "%",
        pc: Math.max(
          1,
          Math.ceil(
            Math.abs(D.tariffSchedule.default - L.tariffSchedule.default) * 0.4,
          ),
        ),
        undo: () => {
          D.tariffSchedule.default = L.tariffSchedule.default;
          syncTariffHeadline(D);
        },
      });
    }
    syncTariffHeadline(D);
  }
  if (G.draft.blocAccession && !countryBlocId(playerCountryId())) {
    const ba = G.draft.blocAccession;
    const bloc = blocById(ba.blocId) || blocByIdOrCustom(ba.blocId);
    const spec = blocAccessionSpec(ba.blocId);
    const steps =
      spec && spec.steps
        ? spec.steps
        : {
            apply: 8,
            align: 14,
            accede: 16,
          };
    /* Application is the only capital-costed accession clause; alignment and
     * accession then advance automatically each quarter. */
    if (ba.phase === "apply" || !ba.phase) {
      out.push({
        label: "Application to join " + (bloc ? bloc.name : ba.blocId),
        pc: steps.apply || 8,
        undo: () => {
          G.draft.blocAccession = null;
        },
      });
    }
  }
  if (G.draft.blocLeave && countryBlocId(playerCountryId())) {
    const bid = countryBlocId(playerCountryId());
    const bloc = blocById(bid) || G.customBlocs[bid];
    out.push({
      label: "Leave " + (bloc ? bloc.name : bid),
      pc: 20,
      undo: () => {
        G.draft.blocLeave = false;
      },
    });
  }
  if (G.draft.blocCreate && canCreateCustomBloc()) {
    const tpl = (CUSTOM_BLOC_TEMPLATES as any)[G.draft.blocCreate.template];
    out.push({
      label: "Found " + (G.draft.blocCreate.name || tpl.name),
      pc: tpl ? tpl.pc : 28,
      undo: () => {
        G.draft.blocCreate = null;
      },
    });
  }
  for (const cid in G.draft.blocInvite || {}) {
    const c = partnerById(cid);
    const bid = countryBlocId(playerCountryId());
    const bloc = bid && (blocById(bid) || G.customBlocs[bid]);
    out.push({
      label: bid
        ? inviteClauseLabel(bid, cid)
        : "Propose " +
          (c ? c.name : cid) +
          " join " +
          (bloc ? bloc.name : "bloc"),
      pc: bid ? inviteCapitalCost(bid, cid) : 12,
      undo: () => {
        delete G.draft.blocInvite[cid];
      },
    });
  }
  for (const p of POLICIES) {
    const a = !!L.policies[p.id],
      b = !!D.policies[p.id];
    if (a !== b)
      out.push({
        label: (b ? "Enact " : "Repeal ") + p.name,
        pc: b ? p.pc : Math.ceil(p.pc * 0.7),
        tab: (p as any).lawsCat ? "laws" : undefined,
        undo: () => {
          if (a) D.policies[p.id] = true;
          else delete D.policies[p.id];
        },
      });
  }
  for (const v of VICE) {
    if (L.vice[v.id] !== D.vice[v.id]) {
      const to = v.states.find((s) => s.id === D.vice[v.id])!;
      out.push({
        label: v.name + ": " + to.label.toLowerCase(),
        pc: v.pc,
        tab: "laws",
        undo: () => {
          D.vice[v.id] = L.vice[v.id];
        },
      });
    }
  }
  /* State & Constitution / Labor & Welfare — see lib/sim/lawGroups.ts. One
     generic diff for every LawGroup (mirrors the VICE block just above),
     plus the bespoke slider groups that follow the law.income/law.ni
     pattern. Every clause here is tagged `tab: "laws"` explicitly rather
     than relying on clausesIn()'s regex fallback. */ for (const grp of LAW_GROUPS) {
    if ((L.groups || {})[grp.id] !== (D.groups || {})[grp.id]) {
      const to = grp.options.find((o) => o.id === D.groups[grp.id])!;
      out.push({
        label: grp.name + ": " + to.label.toLowerCase(),
        pc: to.pc,
        tab: "laws",
        undo: () => {
          D.groups[grp.id] = L.groups[grp.id];
        },
      });
    }
  }
  sliderGroupClauses(out, "headOfState", "Head of state", L, D, {
    mandateYears: { name: "Mandate duration", pc: 3, decimals: 0, unit: " yr" },
  });
  sliderGroupClauses(out, "electoral", "Electoral system", L, D, {
    votingAge: { name: "Minimum voting age", pc: 1, decimals: 0, unit: "" },
    mandatoryVoting: { name: "Mandatory voting", pc: 8 },
  });
  sliderGroupClauses(out, "workHours", "Work hours", L, D, {
    weeklyHours: {
      name: "Legal weekly hours",
      pc: 1.5,
      decimals: 0,
      unit: " hrs",
    },
    leaveDays: {
      name: "Paid annual leave",
      pc: 0.8,
      decimals: 0,
      unit: " days",
    },
  });
  sliderGroupClauses(out, "childcare", "Childcare", L, D, {
    subsidyPct: { name: "Childcare subsidy", pc: 0.15, decimals: 0, unit: "%" },
  });
  sliderGroupClauses(out, "minWage", "Minimum wage", L, D, {
    on: { name: "Statutory minimum wage", pc: 12 },
    rate: { name: "Minimum wage rate", pc: 1.2, decimals: 2, unit: "/hr" },
  });
  sliderGroupClauses(out, "pension", "Pension", L, D, {
    retirementAge: {
      name: "Legal retirement age",
      pc: 1.5,
      decimals: 0,
      unit: " yrs",
    },
    statePensionAnnual: {
      name: "State pension",
      pc: 0.001,
      decimals: 0,
      unit: "/yr",
    },
  });
  const dealIds = new Set(Object.keys(DEAL_BY_ID));
  for (const id of Object.keys(L.deals || {})) dealIds.add(id);
  for (const id of Object.keys(G.draft.deals || {})) dealIds.add(id);
  for (const id of dealIds) {
    const a = !!L.deals[id],
      b = !!G.draft.deals[id];
    if (a !== b) {
      const d = dealById(id);
      if (!d) continue;
      out.push({
        label: (b ? "Ratify " : "Withdraw from ") + d.name,
        pc: b ? d.pc : Math.ceil(d.pc * 1.8),
        undo: () => {
          if (a) G.draft.deals[id] = true;
          else delete G.draft.deals[id];
        },
      });
    }
  }
  /* Missions live on draft only; staging one is a one-shot clause. */
  pruneInvalidDraftMissions(G);
  const missions = G.draft.missions || {};
  for (const pid in missions) {
    const mid = missions[pid];
    const m = (MISSION_BY_ID as any)[mid];
    const p = partnerById(pid);
    if (!m || !p) continue;
    out.push({
      label: m.name + " with " + theCountry(p.name),
      pc: m.pc,
      executive: mid === "summit",
      undo: () => {
        delete G.draft.missions[pid];
      },
    });
  }
  /* Live envoys posted or recalled this quarter — undoable from Orders. */
  syncEnvoysBaseline(G);
  const baseEnv = G.envoysBaseline || emptyEnvoys();
  const curEnv = G.envoys || emptyEnvoys();
  for (const pid of curEnv) {
    if (!pid || baseEnv.includes(pid)) continue;
    const p = partnerById(pid);
    out.push({
      label: "Post envoy to " + theCountry(p ? p.name : pid),
      pc: ENVOY_ASSIGN_PC,
      sunk: true,
      executive: true,
      undo: () => {
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          G.mp.onDiploAction({ action: "recallEnvoy", partnerId: pid });
        } else {
          recallEnvoy(pid);
        }
      },
    });
  }
  for (const pid of baseEnv) {
    if (!pid || curEnv.includes(pid)) continue;
    const p = partnerById(pid);
    out.push({
      label: "Recall envoy from " + theCountry(p ? p.name : pid),
      pc: 0,
      executive: true,
      undo: () => {
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          G.mp.onDiploAction({ action: "assignEnvoy", partnerId: pid });
        } else {
          assignEnvoy(pid);
        }
      },
    });
  }
  return out;
}
/** Summits and envoys are executive — they cost capital and appear on the
 *  Programme, but they do not go through the chamber. */
function legislativeClauses(cl?: any) {
  return (cl || billClauses()).filter((c: any) => !c.executive);
}
/** Draft used for the chamber vote: same Programme, minus summit missions. */
function draftForChamberVote(state: any) {
  const missions = {
    ...((state && state.draft && state.draft.missions) || {}),
  };
  for (const pid of Object.keys(missions)) {
    if (missions[pid] === "summit") delete missions[pid];
  }
  return { ...state.draft, missions };
}
const billCost = (cl?: any): number =>
  (cl || billClauses()).reduce(
    (a: number, c: any) => a + (c.sunk ? 0 : c.pc),
    0,
  );

/** Capital burned on the ruling whip for the staged Programme. UI-only until
 *  Deliver — not a clause, and cleared after enact or when the bill empties. */
function whipSpendOf(g?: any) {
  const state = g || getG();
  if (!state) return 0;
  return clamp(Math.round(state.whipSpend || 0), 0, WHIP_MAX);
}

function setWhipSpend(n: number) {
  if (!G) return;
  G.whipSpend = clamp(Math.round(n || 0), 0, WHIP_MAX);
  bump();
}

/** Bill clause cost plus any staged whip. Empty Programme charges no whip. */
function programmeCost(cl?: any, g?: any) {
  const clauses = cl || billClauses();
  const bill = billCost(clauses);
  if (!legislativeClauses(clauses).length) return bill;
  return bill + whipSpendOf(g);
}

function ensureParties(g?: any) {
  const state = g || getG();
  if (!state) return null;
  if (
    !state.parties ||
    !state.parties.seats ||
    !state.parties.popularity ||
    !state.parties.rulingId
  ) {
    state.parties = seedParties(state.fac || {}, state.law, state.homeRole);
  }
  return state.parties;
}

function driftSeatParties(g: any) {
  if (!g) return;
  const parties = ensureParties(g);
  if (!parties) return;
  const target = applyValenceSwing(voteIntentionFromFac(g.fac || {}), {
    rulingId: parties.rulingId,
    approval: approvalOf(g.fac),
  });
  const pluralism = partyPluralismOf(g.law);
  if (pluralism === "banned") {
    const pop: Record<string, number> = {};
    for (const id of PARTY_IDS) pop[id] = id === parties.rulingId ? 1 : 0;
    parties.popularity = pop;
    return;
  }
  parties.popularity = driftPopularity(parties.popularity, target);
}

function relayoutPartiesFromLaw(g: any) {
  const parties = ensureParties(g);
  if (!parties || !g.law) return;
  parties.seats = layoutSeatsForConstitution({
    popularity: parties.popularity,
    pluralism: partyPluralismOf(g.law),
    votingSystem: votingSystemOf(g.law),
    rulingId: parties.rulingId,
    majorityMaker: false,
  });
}

function electionRecord(g?: any) {
  const state = g || getG();
  if (!state || !state.econ) return 0;
  const e = state.econ;
  const recent = (state.log || []).slice(-8);
  const n = recent.length || 1;
  return (
    (recent.reduce((a: any, r: any) => a + (r.growth || 0), 0) / n) * 2.5 -
    Math.max(0, e.inflation - 3) * 1.5 -
    (e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 1.5 +
    (e.services - (e.services0 != null ? e.services0 : 55)) * 0.15
  );
}

function projectElection(g?: any) {
  const state = g || getG();
  const parties = ensureParties(state);
  if (!parties) return null;
  const meta = polityOf(state.homeRole);
  return allocateElection({
    fac: state.fac || {},
    rulingId: parties.rulingId,
    votingSystem: votingSystemOf(state.law),
    pluralism: partyPluralismOf(state.law),
    record: electionRecord(state),
    hybridBonus: meta && meta.kind === "managed",
    approval: approvalOf(state.fac),
  });
}

function applyElectionResult(g: any, result: any) {
  const parties = ensureParties(g);
  if (!parties || !result) return;
  parties.popularity = result.popularity;
  parties.seats = result.seats;
}

function rulingIsFirst(seats: Record<string, number>, rulingId: string) {
  const mine = seats[rulingId] || 0;
  for (const id of PARTY_IDS) {
    if (id === rulingId) continue;
    if ((seats[id] || 0) > mine) return false;
  }
  return true;
}

function billVoteData(g?: any) {
  const state = g || getG();
  if (!state || !state.law) return null;
  const parties = ensureParties(state);
  const cl = billClauses();
  const voteCl = legislativeClauses(cl);
  const cost = billCost(cl);
  const whip = voteCl.length ? whipSpendOf(state) : 0;
  const powers = parliamentPowersOf(state.law);
  const suppressed = powers === "suppressed";
  if (!voteCl.length) {
    return {
      needed: false,
      advisory: false,
      pass: true,
      aye: 0,
      nay: 0,
      parties: [],
      following: false,
      powers,
      cost,
      whipSpend: 0,
      whipBoost: 0,
      programmeCost: cost,
    };
  }
  if (suppressed) {
    return {
      needed: false,
      advisory: false,
      pass: true,
      aye: CHAMBER_SEATS,
      nay: 0,
      parties: [],
      following: false,
      powers,
      cost,
      whipSpend: 0,
      whipBoost: 0,
      programmeCost: cost,
    };
  }
  const taste = lawDeltaTaste(state.law, draftForChamberVote(state));
  const leftover = Math.max(0, (state.capital || 0) - cost - whip);
  const approval = approvalOf(state.fac);
  const vote = chamberVote({
    seats: parties.seats,
    rulingId: parties.rulingId,
    billTaste: taste,
    approval,
    leftoverCapital: leftover,
    whipSpend: whip,
  });
  return {
    needed: true,
    advisory: powers === "consultative",
    pass: vote.pass,
    aye: vote.aye,
    nay: vote.nay,
    parties: applyPartyLabels(vote.parties, state.homeRole),
    following: vote.following,
    mandate: vote.mandate,
    powers,
    cost,
    whipSpend: whip,
    whipBoost: vote.whipBoost || 0,
    rulingSeats: vote.rulingSeats || 0,
    programmeCost: cost + whip,
    taste,
  };
}

function chamberBlocksDeliver(g?: any) {
  const vote = billVoteData(g);
  if (!vote || !vote.needed || vote.advisory) return false;
  return !vote.pass;
}

function majorityShortfallHint() {
  const vote = billVoteData();
  if (!vote) return "No majority.";
  return (
    "The chamber is " +
    vote.aye +
    "–" +
    vote.nay +
    ". Drop clauses, whip your own party from the Programme, or wait until you are more popular with them."
  );
}

function applyConsultativeShock(g: any) {
  if (!g || !g.fac) return;
  g.fac.patriots = clamp((g.fac.patriots || 50) - 4, 2, 96);
  const parties = ensureParties(g);
  if (!parties) return;
  const id = parties.rulingId;
  const pop = { ...parties.popularity };
  pop[id] = (pop[id] || 0) * 0.92;
  parties.popularity = driftPopularity(pop, pop, 1);
}

function seatedStances(rows: any[]) {
  const seats = (ensureParties() || {}).seats || {};
  return rows.filter((r) => (seats[r.id] || 0) > 0);
}

function clausePartyStances(i: number) {
  if (!G) return [];
  const cl = billClauses();
  if (!cl[i] || cl[i].executive) return [];
  const only = lawWithOnlyClause(i);
  return seatedStances(
    applyPartyLabels(partyStances(lawDeltaTaste(G.law, only)), G.homeRole),
  );
}

function billPartyStances() {
  if (!G) return [];
  return seatedStances(
    applyPartyLabels(
      partyStances(lawDeltaTaste(G.law, draftForChamberVote(G))),
      G.homeRole,
    ),
  );
}

function itemPartyStances(kind: string, spec: any) {
  let taste = {};
  if (kind === "policy") taste = policyTaste(spec.id, !!spec.enacting);
  else if (kind === "tax") taste = taxTaste(spec.id, spec.delta || 0);
  else if (kind === "vice") taste = viceTaste(spec.id, spec.from, spec.to);
  else if (kind === "group") taste = groupTaste(spec.id, spec.from, spec.to);
  else if (kind === "fac") taste = spec.fac || {};
  return seatedStances(applyPartyLabels(partyStances(taste), G && G.homeRole));
}

function leaderTitle(law?: any, polityId?: string, role?: string) {
  const state = getG();
  const L = law || (state && state.draft) || (state && state.law);
  const pid = polityId || (L && L.polity) || polityIdOf();
  const r = role || (state && state.homeRole);
  return leaderTitleOf(L, pid, r);
}

function partiesState(g?: any) {
  return ensureParties(g || getG());
}

function rulingSeats(g?: any) {
  const parties = ensureParties(g || getG());
  if (!parties) return 0;
  return parties.seats[parties.rulingId] || 0;
}

function seatRows(g?: any) {
  const state = g || getG();
  const parties = ensureParties(state);
  if (!parties) return [];
  return labelledParties(state && state.homeRole)
    .map((p) => ({
      id: p.id,
      name: p.name,
      short: p.short,
      color: p.color,
      seats: parties.seats[p.id] || 0,
      popularity: parties.popularity[p.id] || 0,
      ruling: p.id === parties.rulingId,
    }))
    .filter((r) => r.seats > 0);
}

function displayParties(g?: any) {
  const state = g || getG();
  return labelledParties(state && state.homeRole);
}
/** Capital regen for one quarter — base 3.2, ±0.1 per point of approval
 *  either side of the 45 neutral point, scaled by polity/state-form regen,
 *  less envoy upkeep (a standing commitment: each posted envoy costs a
 *  little capital every quarter on top of the upfront assignment fee).
 *  Authoritarian seats recover capital more slowly — tenure is cheaper than
 *  legislative pace. Suppressing parliament costs a little more still —
 *  there is no legislature to lean on for legitimacy. Shared by step()'s
 *  quarter-advance and capitalOutlook()'s preview so the two can't drift
 *  out of sync. */
function capitalRegenGain(g: any, law: any, approval: number) {
  const regen =
    polityOf(g.homeRole).capitalRegen * stateFormCapitalRegenMult(law);
  const gain = (3.2 + (approval - 45) * 0.1) * regen;
  const envoyCount = (g.envoys || []).filter(Boolean).length;
  const envoyUpkeep = envoyCount * ENVOY_UPKEEP_PC;
  return { regen, gain, envoyCount, envoyUpkeep, breakeven: 45 - 3.2 / 0.1 };
}
/** Next-quarter capital preview for the Programme drawer, evaluated against
 *  the draft law and today's approval rather than a full simulate() pass, so
 *  it's cheap enough to show unconditionally (not gated to sandbox like the
 *  4-quarter impact figures). Approval itself only partly reflects a staged
 *  bill's faction effects each quarter (the 0.2 damping in the regen step),
 *  so today's approval is a reasonable stand-in for next quarter's without
 *  needing a forward simulation. */
function capitalOutlook(cost?: number) {
  if (!G) return null;
  if (cost == null) cost = programmeCost();
  const approval = approvalOf(G.fac);
  const { gain, envoyCount, envoyUpkeep, breakeven } = capitalRegenGain(
    G,
    G.draft,
    approval,
  );
  const whip = legislativeClauses().length ? whipSpendOf() : 0;
  const billOnly = cost - whip;
  const afterBill = clamp(G.capital - cost, 0, 100);
  const books = balanceOf(G.draft, G.econ);
  const fiscalRuleHit = fiscalRuleCapitalHit(G.draft, -books.balance);
  return {
    cost,
    billCost: billOnly,
    whipSpend: whip,
    current: G.capital,
    afterBill,
    gain,
    envoyCount,
    envoyUpkeep,
    fiscalRuleHit,
    nextQuarter: clamp(afterBill + gain - envoyUpkeep - fiscalRuleHit, 0, 100),
    approval,
    breakeven,
  };
}
/* ==================================================================
   7. RENDERING
   ================================================================== */

const $ = (id: any): any =>
  typeof document !== "undefined" ? document.getElementById(id) : null;
const esc = (s: any) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
/* ==================================================================
   7a. THE MAP
   The procedurally generated fictional-country canvas that used to live here
   (radial-noise coastline, nine regions by nearest seed, flood-filled ocean)
   has been fully replaced by the real Natural-Earth/topojson map component
   (components/map3d/WorldMap3D.tsx + lib/sim/boardMetrics.ts); a map-load
   failure now falls back to a plain message in the shell, not to any
   function here. REGIONS, initRegions() and stepRegions() (the per-region
   approval/unemployment/prosperity breakdown the procedural map's choropleth
   used to read) were removed with it, once nothing consumed econ.regions
   either. A future "regional breakdown" feature (CLAUDE.md's Backlog) would
   need to rebuild this from scratch rather than resurrect it.
   ================================================================== */
/* ---------- The rest of the world keeps its own books ----------
   Partners are not just relationship counters: each runs an economy with its own
   trend growth, deficit and debt, correlated to the world cycle and to shocks.
   Opening macros live in nationProfiles.js (one row per sovereign partner). */ /** Default faction approvals (Kingdom / UK-balanced). */ const FAC_0 =
  {
    business: 50,
    workers: 48,
    pensioners: 52,
    urban: 47,
    rural: 49,
    patriots: 45,
  };
function openingFac(homeRole: any) {
  const id = resolveHomeRole(homeRole || "home");
  if (id === "home") return Object.assign({}, FAC_0);
  const p = NATION_PROFILE[id];
  return Object.assign({}, FAC_0, (p && p.fac0) || {});
}
function openingRel(homeRole: any) {
  const id = resolveHomeRole(homeRole || "home");
  const row = REL_0[id] || REL_0.home;
  const out: Record<string, any> = {};
  for (const p of activePartners(id)) {
    (out as any)[p.id] = row[p.id] != null ? row[p.id] : 50;
  }
  return out;
}
/** Opening GDP (USD bn) for a seat id, including the displaceable Kingdom. */ function gdp0ForSeat(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  if (id === "home") return NATION_PROFILE.kingdom.gdp0;
  const p = NATION_PROFILE[id];
  return p && p.gdp0 != null ? p.gdp0 : NATION_PROFILE.kingdom.gdp0;
}
/** ISO currency code for a playable seat (or partner nation). */ function currencyForSeat(
  role: any,
) {
  const id = resolveHomeRole(role || "home");
  if (id === "home") return NATION_PROFILE.kingdom.currency || "GBP";
  const p = NATION_PROFILE[id];
  return (p && p.currency) || "USD";
}
/** Fill missing FX fields on a partner nation state (older saves / lazy init). */ function ensureNationFx(
  n: any,
) {
  if (!n) return n;
  if (n.fx == null) n.fx = 1;
  if (n.fx0 == null) n.fx0 = n.fx;
  if (n.riskPremium == null) n.riskPremium = 0;
  return n;
}
/** Currency strength index, 100 at opening. Home uses e.fx; partners use n.fx. */ function fxDisplayIndex(
  role: any,
  g?: any,
) {
  const G = g || (typeof getG === "function" ? getG() : null);
  if (!G || !G.econ) return 100;
  const e = G.econ;
  if (role == null || role === "home") {
    const fx0 = e.fx0 != null ? e.fx0 : 1;
    const fx = e.fx != null ? e.fx : 1;
    return (100 * fx) / Math.max(0.01, fx0);
  }
  if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE)
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
  }
  const n = ensureNationFx(
    e.nations[role] ||
      (e.nations[role] = nationStateFromProfile(
        NATION_PROFILE[role] || NATION_PROFILE.kingdom,
      )),
  );
  return (100 * n.fx) / Math.max(0.01, n.fx0);
}
/** Live USD GDP bn: opening size × real index × relative FX (vs opening).
 *  Higher e.fx is a stronger currency, so the same real output is worth more
 *  dollars; depreciation shrinks the USD figure. */ function realmGdpBn(
  role: any,
  g: any,
) {
  const G = g || (typeof getG === "function" ? getG() : null);
  if (!G || !G.econ) return gdp0ForSeat(role);
  const e = G.econ;
  if (role === "home") {
    const seat = G.homeRole || "home";
    const fx0 = e.fx0 != null ? e.fx0 : 1;
    const fx = e.fx != null ? e.fx : 1;
    return gdp0ForSeat(seat) * (e.gdp / 100) * (fx / Math.max(0.01, fx0));
  }
  if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE)
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
  }
  const n = ensureNationFx(
    e.nations[role] ||
      (e.nations[role] = nationStateFromProfile(
        NATION_PROFILE[role] || {
          trend: 1,
          debt0: 50,
          deficit0: 3,
          inflation0: 2.2,
        },
      )),
  );
  const y = n.y != null ? n.y : 100;
  return gdp0ForSeat(role) * (y / 100) * (n.fx / Math.max(0.01, n.fx0));
}
/** Implied rest-of-world GDP (bn) matching the average of the named trade basket. */ function restGdp0ForRole(
  homeRole: any,
) {
  let named = 0,
    namedShare = 0;
  for (const p of activePartners(homeRole)) {
    const w = partnerShare(homeRole, p);
    named += w * gdp0ForSeat(p.id);
    namedShare += w;
  }
  if (namedShare < 1e-9) return 1000;
  return named / namedShare;
}
/** Trade-share × absolute-GDP foreign demand, including the rest residual. */ function worldDemandBn(
  e: any,
  homeRole: any,
) {
  if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE)
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
  }
  if (e.worldRestY == null) e.worldRestY = 100;
  let D = 0;
  for (const p of activePartners(homeRole)) {
    const n = e.nations[p.id];
    const y = n && n.y != null ? n.y : 100;
    D += partnerShare(homeRole, p) * gdp0ForSeat(p.id) * (y / 100);
  }
  const restShare = tradeRestShare(homeRole);
  D += restShare * restGdp0ForRole(homeRole) * (e.worldRestY / 100);
  return D;
}
/** Recompute worldY from the partner GDP basket. Pins worldDemand0 on first use. */ function refreshWorldY(
  e: any,
  homeRole: any,
) {
  if (e.worldRestY == null) e.worldRestY = 100;
  const D = worldDemandBn(e, homeRole);
  if (!(e.worldDemand0 > 0)) e.worldDemand0 = D;
  e.worldY = (100 * D) / Math.max(1e-9, e.worldDemand0);
  return e.worldY;
}
/** Rest-of-world residual grows at the exogenous world rate (+ event shocks). */ function stepWorldRest(
  e: any,
) {
  if (e.worldRestY == null) e.worldRestY = 100;
  e.worldRestY *= 1 + (WORLD_GROWTH + (e.worldShock || 0)) / 400;
}
/** Format a USD bn figure as $3.6tn / $420bn for the realm card. `displayCcy`
 *  converts via the live fx-derived cross-rate; defaults to USD, so existing
 *  call sites are unaffected. */ function fmtGdpBn(
  bn: any,
  displayCcy?: string,
  g?: any,
) {
  if (bn == null || !isFinite(bn)) return "—";
  /* Only resolve "native" against a caller-supplied g — CountryPicker calls
     this pre-game with no g at all, where USD is the right neutral unit for
     comparing realms, not whatever currency a previous game happened to
     leave in the global singleton. */
  const nativeCcy = g ? currencyForSeat(g.homeRole) : "USD";
  const ccy = displayCcy || nativeCcy;
  const shown = ccy === "USD" || !g ? bn : bn * liveRateBetween("USD", ccy, g);
  const symbol = (CURRENCY_META[ccy] || CURRENCY_META.USD).symbol;
  if (shown >= 1000)
    return symbol + (shown / 1000).toFixed(shown >= 10000 ? 0 : 1) + "tn";
  return symbol + shown.toFixed(0) + "bn";
}
function nationStateFromProfile(p: any) {
  return {
    y: 100,
    growth: p.trend,
    debt: p.debt0,
    deficit: p.deficit0,
    inflation: p.inflation0 != null ? p.inflation0 : 2.2,
    fx: 1,
    fx0: 1,
    riskPremium: 0,
  };
}
function stepNations(e: any, det: any, g: any) {
  if (g && g.world) {
    syncNationsFromWorld(g);
    return;
  }
  if (!e.nations) {
    e.nations = {};
    for (const id in NATION_PROFILE) {
      e.nations[id] = nationStateFromProfile(NATION_PROFILE[id]);
    }
  }
  const worldPulse = e.worldShock || 0;
  const worldTfpPulse = e.modWorldTfp || 0;
  const partnerPulse = e.partnerShock || {};
  for (const id in NATION_PROFILE) {
    const p = NATION_PROFILE[id],
      s2 = ensureNationFx(e.nations[id]);
    const shock = det ? 0 : (Math.random() + Math.random() - 1) * p.vol;
    const bilat = partnerPulse[id] || 0;
    const piStar = p.inflation0 != null ? p.inflation0 : 2.0;
    s2.growth =
      s2.growth * 0.55 +
      (p.trend + worldPulse * p.beta + worldTfpPulse * p.beta + bilat + shock) *
        0.45;
    s2.y *= 1 + s2.growth / 400;
    s2.deficit = clamp(
      s2.deficit * 0.85 + (p.deficit0 - (s2.growth - p.trend) * 0.7) * 0.15,
      -12,
      18,
    );
    s2.debt = clamp(
      s2.debt * (1 + (2.6 - s2.growth - s2.inflation) / 400) + s2.deficit / 4,
      0,
      400,
    );
    s2.inflation = clamp(
      s2.inflation * 0.8 + (piStar + (s2.growth - p.trend) * 0.35) * 0.2,
      -3,
      30,
    );
    const fxUip = p.fxUip != null ? p.fxUip : FX_UIP;
    const worldRate = p.worldRate != null ? p.worldRate : WORLD_RATE;
    const proxyRate = clamp(
      worldRate + (s2.inflation - WORLD_INFL) * 0.85,
      RATE_FLOOR,
      20,
    );
    const stress =
      (s2.debt - p.debt0) * 0.02 + Math.max(0, s2.deficit - p.deficit0) * 0.15;
    s2.riskPremium = Math.max(
      0,
      (s2.riskPremium || 0) * 0.7 + Math.max(0, stress),
    );
    const fxTarget =
      1 + fxUip * (proxyRate - worldRate) - FX_RISK * s2.riskPremium;
    s2.fx += (fxTarget - s2.fx) * FX_ADJ * 0.5;
  }
}
const TABS = [
  {
    id: "budget",
    name: "Budget",
    icon: "coin",
  },
  {
    id: "taxes",
    name: "Taxes",
    icon: "percent",
    wide: true,
  },
  {
    id: "laws",
    name: "Laws",
    icon: "scroll",
    wide: true,
  },
  {
    id: "trade",
    name: "Trade",
    icon: "globe",
  },
  {
    id: "diplomacy",
    name: "Diplomacy",
    icon: "seal",
  },
  {
    id: "charts",
    name: "Charts",
    icon: "chart",
    wide: true,
  },
];
const ICONS = {
  coin: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 4.6v6.8M6.2 6.2h3.1a1.4 1.4 0 010 2.8H6.6h3.2"/></svg>',
  percent:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="5" cy="5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M12.5 3.5l-9 9"/></svg>',
  scroll:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 2.5h7.5v11H4z"/><path d="M6 5.5h3.5M6 8h3.5M6 10.5h2"/></svg>',
  globe:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2C6.2 4 6.2 12 8 14"/></svg>',
  seal: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="7" r="4.2"/><path d="M5.2 10.8L4 14l4-1.4L12 14l-1.2-3.2"/><circle cx="8" cy="7" r="1.4"/></svg>',
  chart:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 13.5h11"/><path d="M4 11V7.5M7 11V4M10 11V8.5M13 11V6"/></svg>',
  gavel:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M9.5 2.5l4 4-1.6 1.6-4-4z"/><path d="M7.8 4.2l4 4L4.7 15.3l-1.9-1.9z"/><path d="M2 14.5h6"/></svg>',
  clock:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 4.5v4l2.5 2.5"/></svg>',
  close:
    '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
};
/* --- the top bar --- */ /* `kind` marks a reading the Chancellor does not control, which is worth making
   visually obvious: the Bank rate is a response to your budget, not a lever in
   it. */ /** Quarters of the current term before a snap election is allowed. */
const EARLY_ELECTION_MIN_Q = 4;
function termElapsed() {
  if (!G) return 0;
  return Math.max(0, G.q - (G.termStartQ || 0));
}
/** Quarters remaining until the next scheduled term review. */ function electionQuartersLeft() {
  if (!G || G.over) return 0;
  const len = termLenOf(G.homeRole);
  const elapsed = termElapsed();
  if (elapsed >= len && G.q > 0) return 0;
  return Math.max(0, len - elapsed);
}
/** Rough running score the termReview() formula will use — for the thermometer. */ function electionThermometer() {
  return termReviewScore();
}
/** Single source of truth for "is the term review going badly enough to
 *  matter" — the last 4 quarters before the review, scored below the
 *  polity's loseAt threshold. Used by OverviewPanel's warning box,
 *  ongoingSituations() (so it surfaces on the rail's Overview badge too),
 *  and the pre-election news story below. */
function electionAtRisk() {
  const left = electionQuartersLeft();
  const therm = electionThermometer();
  const meta = polityOf();
  if (meta.kind === "congress") {
    return { left, therm, atRisk: left <= 4 && therm <= meta.loseAt };
  }
  const projected = projectElection();
  const parties = ensureParties();
  const first =
    projected && parties
      ? rulingIsFirst(projected.seats, parties.rulingId)
      : true;
  const mine =
    projected && parties
      ? projected.seats[parties.rulingId as PartyId] || 0
      : 0;
  return {
    left,
    therm,
    atRisk: left <= 4 && !first,
    plurality: first,
    projectedSeats: mine,
  };
}
function termReviewScore() {
  const e = G.econ;
  const meta = polityOf(G.homeRole);
  const recent = G.log.slice(-8);
  const n = recent.length || 1;
  const record =
    (recent.reduce((a: any, r: any) => a + (r.growth || 0), 0) / n) * 2.5 -
    Math.max(0, e.inflation - 3) * 1.5 -
    (e.unemployment - (e.nairu != null ? e.nairu : 4.2)) * 1.5 +
    (e.services - (e.services0 != null ? e.services0 : 55)) * 0.15;
  if (meta.kind === "congress") {
    const patriots = G.fac && G.fac.patriots != null ? G.fac.patriots : 50;
    return 0.55 * patriots + 0.45 * approvalOf(G.fac) + record;
  }
  return approvalOf(G.fac) + record;
}
function termReviewDue() {
  if (!G || G.over || !(G.q > 0)) return false;
  return termElapsed() >= termLenOf(G.homeRole);
}
function electionCalendarOf(law?: any) {
  const L = law || (G && G.law);
  return (L && L.groups && L.groups.electionCalendar) || "flexible";
}
/** Why a snap election is blocked, or null if the executive may dissolve. */
function earlyElectionBlocker() {
  if (!G || G.over) return "The term is over.";
  if (pressChoicePending()) return "A Cabinet paper is waiting.";
  const meta = polityOf();
  if (meta.kind === "congress") return "The congress sits on its own calendar.";
  if (partyPluralismOf(G.law) !== "multiParty")
    return "There is no competitive ballot to call.";
  if (electionCalendarOf() !== "flexible")
    return "Elections fall on a fixed calendar.";
  if (termElapsed() < EARLY_ELECTION_MIN_Q)
    return "Too early in the term — a year in office first.";
  if (termReviewDue() || electionQuartersLeft() <= 1)
    return "The ballot is already upon you.";
  return null;
}
function canCallEarlyElection() {
  return !earlyElectionBlocker();
}
/** Confirm, then run the same term review a scheduled ballot uses. */
function callEarlyElection() {
  const why = earlyElectionBlocker();
  if (why) return false;
  const noun = reviewNoun();
  const parties = ensureParties();
  const projected = projectElection();
  const mine =
    projected && parties
      ? projected.seats[parties.rulingId as PartyId] || 0
      : 0;
  const first =
    !!projected &&
    !!parties &&
    rulingIsFirst(projected.seats, parties.rulingId);
  const outlook = projected
    ? first
      ? "On these numbers you would come first with " + mine + " seats."
      : "On these numbers you would not come first (" + mine + " seats)."
    : "";
  despatch(
    "Call an early " + noun,
    "Cabinet Office",
    "<p>Dissolve the chamber and face the country this quarter. Seats are reallocated from current vote intention. A win resets the clock and restores political capital. Lose the plurality and, outside sandbox, you lose the job.</p>" +
      (outlook ? "<p>" + outlook + "</p>" : ""),
    [
      {
        b: "Go to the country",
        e: "Face the " + noun + " now",
        f: () => termReview(),
      },
      {
        b: "Not now",
        e: "Keep the term",
        f: () => render(),
      },
    ],
  );
  return true;
}
function renderChrome() {
  /* Every tab now renders through React; kept as a stable no-op for
     render()'s call site rather than touching that orchestration. */
}
function clausesIn(tabId: any, cl: any) {
  const pats = {
    budget: /points of GDP/,
    taxes: /tax|duty|levy|rate|tariff|Restructure|price|pricing/i,
    trade: /Ratify|Withdraw|tariff|Propose|Leave|Found|join /i,
    diplomacy:
      /summit|State visit|Formal protest|Restrictive measures|envoy|mission/i,
    charts: /(?!)/,
    laws: /(?!)/,
  };
  /* Every Laws-drawer clause (and the pre-existing polity-change clause)
     carries an explicit `tab`, checked first so new content never needs a
     new regex here — the fallback below is unchanged for older clauses that
     don't set one. */ return cl.some((c: any) =>
    c.tab
      ? c.tab === tabId
      : (pats as any)[tabId] && (pats as any)[tabId].test(c.label),
  );
}
/* Cash thresholds uprate with wages; keep real slider headroom constant so a
   long run never pins the thumb at a stale nominal ceiling. */ function thresholdSliderMax(
  baseMax: any,
  current: any,
  step: any,
) {
  const wage = (G && G.econ && G.econ.wageIndex) || 1;
  const ceil = Math.max(baseMax * wage, (current || 0) * 1.15);
  return Math.ceil(ceil / step) * step;
}
/* A throwaway copy of the law with one NI side switched back on, so the panel
   can quote what abolition actually costs. */ function withNi(
  law: any,
  key: any,
  val: any,
) {
  const c = clone(law);
  c.ni[key] = val;
  return c;
}
function withIncomeOn(law: any, on: any) {
  const c = clone(law);
  c.income.on = on;
  return c;
}
/**
 * Same scales and layout as the SVG chart the drawers render, returned as
 * plain numbers/points for React consumers (ChartsPanel.tsx). Returns null
 * when there isn't enough data (the "not enough quarters" empty state).
 */
function lineChartSpec(series: any, opts?: any) {
  opts = opts || {};
  const h = opts.h || 168,
    w = 600,
    padL = 36,
    padR = 54,
    padT = 10,
    padB = 20;
  const len = series[0] ? series[0].data.length : 0;
  if (len < 2) return null;
  const all = series
    .flatMap((s: any) => s.data)
    .filter((v: any) => isFinite(v));
  let mn = Math.min(...all),
    mx = Math.max(...all);
  if (opts.target != null) {
    mn = Math.min(mn, opts.target);
    mx = Math.max(mx, opts.target);
  }
  if (opts.zero) {
    mn = Math.min(mn, 0);
    mx = Math.max(mx, 0);
  }
  const pad = (mx - mn) * 0.14 || 1;
  mn -= pad;
  mx += pad;
  const X = (i: any) => padL + (i / (len - 1)) * (w - padL - padR);
  const Y = (v: any) => padT + (1 - (v - mn) / (mx - mn)) * (h - padT - padB);

  /* Most series (percentages, index points) read fine at a fixed 0-1
     decimals; a few (raw FX rates spanning GBP's 1.27 down to VND's
     0.000039) need their own formatter, so opts.fmt overrides it. */ const fmtVal =
    opts.fmt || ((v: any) => v.toFixed(Math.abs(mx) > 60 ? 0 : 1));
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4,
      y = Y(v);
    gridLines.push({
      y: +y.toFixed(1),
      label: fmtVal(v),
    });
  }

  const targetLine =
    opts.target != null ? { y: +Y(opts.target).toFixed(1) } : null;

  const lbl = G.log.map((r: any) => r.label);
  const xLabels = [];
  for (let i = 0; i < len; i += Math.max(1, Math.ceil(len / 7))) {
    xLabels.push({ x: +X(i).toFixed(1), label: lbl[i] || "" });
  }

  const chartSeries = series.map((s: any) => {
    const points = s.data.map((v: any, i: any) => [
      +X(i).toFixed(1),
      +Y(v).toFixed(1),
    ]);
    const lv = s.data[len - 1];
    return {
      label: s.label,
      color: s.color,
      wide: !!s.wide,
      dash: !!s.dash,
      points,
      lastPoint: [+X(len - 1).toFixed(1), +Y(lv).toFixed(1)],
      lastValue: fmtVal(lv),
    };
  });

  return {
    w,
    h,
    padR,
    gridLines,
    targetLine,
    xLabels,
    series: chartSeries,
    targetLabel: opts.targetLabel || null,
  };
}
const COL = {
  ink: "#ffffff",
  ox: "#FF5A4E",
  green: "#3DDC84",
  blue: "#D4AF69",
  brass: "#E8A838",
  plum: "#B894F0",
  soft: "rgba(255,255,255,.45)",
};
/** Data form of compositionBar() for React consumers. */
function compositionBarData() {
  const E = aggregate(G.draft),
    rev = revenue(G.draft, E);
  const groups: Record<string, any> = {
    income: 0,
    consumption: 0,
    corporate: 0,
    wealth: 0,
    vice: 0,
  };
  for (const id in rev.by) {
    (groups as any)[taxGroup(id)] += (rev.by as any)[id];
  }
  groups.other = rev.other;
  const names: Record<string, string> = {
    income: "Income tax and NI",
    consumption: "Consumption",
    corporate: "Corporate",
    wealth: "Capital & land",
    vice: "Duties on regulated goods",
    other: "Other receipts",
  };
  const cols: Record<string, string> = {
    income: COL.ink,
    consumption: COL.brass,
    corporate: COL.blue,
    wealth: COL.plum,
    vice: COL.green,
    other: COL.soft,
  };
  const total = Object.values(groups).reduce((a: any, b: any) => a + b, 0) || 1;
  let x = 0;
  const bars: { key: string; x: number; width: number; color: string }[] = [];
  for (const k in groups) {
    const wdt = ((groups as any)[k] / total) * 100;
    bars.push({ key: k, x, width: wdt, color: cols[k] });
    x += wdt;
  }
  const legend = Object.keys(groups).map((k) => ({
    key: k,
    color: cols[k],
    label: names[k],
    value: (groups as any)[k],
  }));
  return { bars, legend };
}
function nationTableData() {
  const e = G.econ,
    n = e.nations || {};
  const last = G.log.length ? G.log[G.log.length - 1] : null;
  const bal = balanceOf(G.law, e);
  const rows: any[] = (
    [
      {
        name: G.country,
        growth: last ? last.growth : e.trendGrowth,
        debt: e.debt,
        deficit: last ? -last.balance : -bal.balance,
        inflation: e.inflation,
        us: true,
      },
    ] as any[]
  ).concat(
    activePartners()
      .filter((p) => n[p.id])
      .map((p) => ({
        name: p.name,
        growth: n[p.id].growth,
        debt: n[p.id].debt,
        deficit: n[p.id].deficit,
        inflation: n[p.id].inflation,
      })),
  );
  rows.sort((a, b) => b.growth - a.growth);
  return rows;
}

function renderPanel() {
  /* Every tab now renders through React; kept as a stable no-op for
     render()'s call site. */
}

function pendingUltimatumIds(g: any) {
  const state = g || getG();
  if (!state || !state.ultimatums) return [];
  return Object.keys(state.ultimatums).filter(
    (id) => state.ultimatums[id] && state.ultimatums[id].status === "pending",
  );
}

function ultimatumQuartersLeft(g: any, partnerId: any) {
  const state = g || getG();
  const u = state && state.ultimatums && state.ultimatums[partnerId];
  if (!u || u.status !== "pending") return 0;
  return Math.max(0, (u.expiresQ || 0) - (state.q || 0));
}

function ultimatumWaitingCopy(ultLeft: any) {
  if (ultLeft <= 1) return "Their answer lands when you Deliver next quarter";
  return (
    "They have " + ultLeft + "Q to respond · checked each time you Deliver"
  );
}

function hasDiploAttention(g: any) {
  const state = g || getG();
  if (!state) return false;
  if (pendingUltimatumIds(state).length) return true;
  return Object.keys(state.activeVisits || {}).some(
    (id) => visitQuartersLeft(state, id) > 0,
  );
}

/** Active state visits plus the current major-world episode, if any — the
 *  Overview drawer's "Ongoing situations" list and the rail's Overview
 *  badge count both read off this same list, so they can never disagree. */
function ongoingSituations(g?: any) {
  const state = g || getG();
  if (!state) return [];
  const out: {
    id: string;
    kind: "visit" | "episode" | "election";
    label: string;
    sub: string;
    left: number;
  }[] = [];
  for (const id of Object.keys(state.activeVisits || {})) {
    const left = visitQuartersLeft(state, id);
    if (left <= 0) continue;
    const p = partnerById(id);
    out.push({
      id: "visit:" + id,
      kind: "visit",
      label: "State visit — " + theCountry(p ? p.name : id),
      sub: `${left} quarter${left === 1 ? "" : "s"} left`,
      left,
    });
  }
  if (state.episode) {
    const left = Math.max(0, state.episode.endsQ - state.q);
    out.push({
      id: "episode:" + state.episode.id,
      kind: "episode",
      label: state.episode.title || "Ongoing episode",
      sub: `${left} quarter${left === 1 ? "" : "s"} left`,
      left,
    });
  }
  /* electionAtRisk() reads the live G directly rather than `state` — fine
     while this function's only two callers (IconRail, OverviewPanel) both
     pass the live G; would need threading through if ongoingSituations()
     ever gains a preview/simulate call site. */
  const risk = electionAtRisk();
  if (risk.atRisk) {
    const noun = reviewNoun();
    out.push({
      id: "election-risk",
      kind: "election",
      label: `${noun.charAt(0).toUpperCase() + noun.slice(1)} at risk`,
      sub: `${risk.left} quarter${risk.left === 1 ? "" : "s"} to go — ${
        risk.projectedSeats != null
          ? risk.projectedSeats + " seats on these numbers"
          : "score ~" + risk.therm.toFixed(0)
      }`,
      left: risk.left,
    });
  }
  return out;
}

/** Ultimatums only — state visits/summits are "ongoing situations" now,
 *  shown in the Overview drawer instead of a persistent floating pill. */
function diploHudChips(g: any) {
  const state = g || getG();
  if (!state) return [];
  const chips = [];
  for (const id of pendingUltimatumIds(state)) {
    const p = partnerById(id);
    const left = ultimatumQuartersLeft(state, id);
    const u = state.ultimatums[id];
    const label = u.label || u.demand || "demand";
    chips.push({
      kind: "ult",
      title: "Ultimatum — opens Diplomacy",
      name: p ? p.name : id,
      label,
      left,
    });
  }
  return chips;
}

/** Data form of relationModifiersHtml() for React consumers. */
function relationModifiersData(partnerId: any) {
  ensureDiploStocks(G.econ);
  seedGameRelBase(G);
  const { mods } = buildRelationModifiers(
    partnerId,
    G,
    G.draft || G.law,
    diploDeps(),
  );
  const rest = mods
    .filter((m: any) => m.kind !== "base" && Math.abs(m.pts) >= 0.5)
    .sort((a: any, b: any) => Math.abs(b.pts) - Math.abs(a.pts));
  const shown = rest.slice(0, 5).map((m: any) => ({
    tone: m.pts > 0 ? "up" : "dn",
    label: m.label,
    pts: m.pts,
  }));
  const extra =
    rest.length > 5
      ? {
          count: rest.length - 5,
          pts: rest.slice(5).reduce((s: number, m: any) => s + m.pts, 0),
        }
      : null;
  return { shown, extra };
}

function memberAccessionTrack(bid: any, cid: any) {
  const inv = G.blocInvites && G.blocInvites[cid];
  const acc = G.blocAccessionByCountry && G.blocAccessionByCountry[cid];
  const p = partnerById(cid);
  const name = p ? p.name : cid;
  const rel = G.rel[cid] != null ? G.rel[cid] : 50;
  const need = inviteAcceptMin(bid, cid);
  if (inv && inv.blocId === bid) {
    const sentQ = inv.sentQ != null ? inv.sentQ : inv.expiresQ - 4;
    const acceptQ = sentQ + 1;
    const waitingWindow = G.q < acceptQ;
    const qLeft = Math.max(0, inv.expiresQ - G.q);
    return {
      cid,
      name,
      rel,
      need,
      cur: waitingWindow ? 0 : 1,
      status: waitingWindow
        ? "Invitation sent"
        : rel >= need
          ? "Considering invitation"
          : "Relations too cool",
      detail: waitingWindow
        ? "Response expected from next quarter · " + qLeft + "Q until expiry"
        : "Relations " +
          rel.toFixed(0) +
          "/" +
          need +
          (rel >= need ? " — likely to accept" : " — may decline"),
      qLeft,
      ok: rel >= need,
    };
  }
  if (acc && acc.blocId === bid) {
    const qIn = G.q - acc.sinceQ;
    const qNeed = 1;
    const qLeft = Math.max(0, qNeed - qIn);
    return {
      cid,
      name,
      rel,
      need: 40,
      cur: acc.step === 1 ? 2 : 3,
      status: acc.step === 1 ? "Policy alignment" : "Accession treaty",
      detail:
        qLeft +
        " quarter" +
        (qLeft === 1 ? "" : "s") +
        " remaining · relations " +
        rel.toFixed(0) +
        "/40",
      qLeft,
      ok: rel >= 40,
    };
  }
  return null;
}
function flashBillPip() {
  requestAnimationFrame(() => {
    const bill = $("billBtn");
    if (bill) {
      bill.classList.add("pip-flash");
      setTimeout(() => bill.classList.remove("pip-flash"), 1400);
    }
    const deliver = $("deliverBtn");
    if (deliver) {
      deliver.classList.add("pip-flash");
      setTimeout(() => deliver.classList.remove("pip-flash"), 1400);
    }
  });
}
function toggleBlocInvite(cid: any) {
  ensureDraftBlocState();
  if (!cid) return false;
  const bid = countryBlocId(playerCountryId());
  if (!bid) return false;
  if (blocInviteIsStale(bid, cid)) return false;
  const wasStaged = !!G.draft.blocInvite[cid];
  if (wasStaged) delete G.draft.blocInvite[cid];
  else G.draft.blocInvite[cid] = true;
  return !wasStaged;
}
function blocInviteCandidates(bid: any) {
  const out = [];
  for (const p of activePartners()) {
    if (countryBlocId(p.id) === bid) continue;
    if (G.blocInvites && G.blocInvites[p.id]) continue;
    if (G.blocAccessionByCountry && G.blocAccessionByCountry[p.id]) continue;
    const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
    const homeId = countryBlocId(p.id);
    const home = homeId ? blocByIdOrCustom(homeId) : null;
    out.push({
      partner: p,
      rel,
      poach: !!homeId,
      homeBlocId: homeId,
      homeBlocName: home ? home.name : null,
      capital: inviteCapitalCost(bid, p.id),
      blockers: blocInviteBlockers(bid, p.id),
      staged: !!(G.draft.blocInvite && G.draft.blocInvite[p.id]),
    });
  }
  return out;
}
function playerJoiningBloc() {
  if (!G) return false;
  const player = playerCountryId();
  if (G.draft && G.draft.blocAccession) return true;
  if (G.blocAccession) return true;
  if (player && G.blocAccessionByCountry && G.blocAccessionByCountry[player])
    return true;
  return false;
}
function tariffLeverValue(
  key: any,
  law: any,
  homeRole?: any,
  blocMember?: any,
) {
  ensureTariffSchedule(law);
  const sched = law.tariffSchedule;
  if (key === "tariffDefault") return sched.default;
  if (key === "tariffCet") {
    const lock = tariffLocked(law, homeRole, blocMember);
    return sched.cet != null
      ? sched.cet
      : lock.cet != null
        ? lock.cet
        : sched.default;
  }
  if (key.startsWith("tariffBloc:")) {
    const bid = key.slice(11);
    return sched.bloc[bid] != null ? sched.bloc[bid] : sched.default;
  }
  if (key.startsWith("tariffCountry:")) {
    const cid = key.slice(14);
    return sched.country[cid] != null ? sched.country[cid] : sched.default;
  }
  return law.tariff != null ? law.tariff : sched.default;
}
function dealBlockers(d: any) {
  const out = [],
    D = G.draft,
    n = d.need || {};
  if (!hasIndependentCommercialPolicy(playerCountryId()))
    out.push("bilateral deals unavailable while in a customs union");
  if (d.partner && !hasIndependentCommercialPolicy(d.partner))
    out.push("partner trades through their bloc");
  if (n.deal && !D.deals[n.deal])
    out.push("requires " + (DEAL_BY_ID as any)[n.deal].name.toLowerCase());
  needBlockers(n, D, {
    partner: d.partner,
  }).forEach((b) => out.push(b));
  if (n.notInBloc && countryBlocId(playerCountryId()))
    out.push("requires leaving your trade bloc");
  if (n.inBloc && !countryBlocId(playerCountryId()))
    out.push("requires bloc membership");
  return out;
}
/** Data form of ledgerTable() for React consumers — last 12 quarters. */
function ledgerRows() {
  return G.log.slice(-12).map((r: any) => ({
    label: r.label,
    growth: r.growth,
    trend: r.trend,
    inflation: r.inflation,
    unemployment: r.unemployment,
    balance: r.balance,
    debt: r.debt,
    yield: r.yield,
    approval: r.approval,
    capital: r.capital,
  }));
}
function render(options?: any) {
  const opts = options || {};
  const skipBump = !!opts.skipBump;
  const scrollPartner = opts.scrollPartner || null;
  maybeAutoUnsubmitMp();
  if (!skipBump && typeof bump === "function") bump();
  try {
    renderChrome();
  } catch (e) {
    console.error("renderChrome", e);
  }
  try {
    renderPanel();
  } catch (e) {
    console.error("renderPanel", e);
  }
  if (scrollPartner && (tab === "trade" || tab === "diplomacy")) {
    queueDrawerPartnerScroll(scrollPartner);
  }
}
/* ==================================================================
   8. DESPATCHES, EVENTS, ELECTIONS
   ================================================================== */
/** Applies the `{C}` → country-name substitution to a structured despatch
 * body's known text fields (the html-string path applies it via `T(html)`
 * below instead — see the `{C}` naming rule in CLAUDE.md). */
function applyTToDespatchBody(body: { kind: string; data: any }) {
  const d = body.data || {};
  if (body.kind === "briefing") {
    return {
      ...d,
      lines: (d.lines || []).map((s: any) => T(s)),
      impact: d.impact
        ? {
            quiet: d.impact.quiet ? T(d.impact.quiet) : d.impact.quiet,
            economic: d.impact.economic
              ? T(d.impact.economic)
              : d.impact.economic,
            approval: d.impact.approval
              ? T(d.impact.approval)
              : d.impact.approval,
            politics: d.impact.politics
              ? T(d.impact.politics)
              : d.impact.politics,
          }
        : d.impact,
      footer: d.footer ? T(d.footer) : d.footer,
      hint: d.hint ? T(d.hint) : d.hint,
    };
  }
  if (body.kind === "verdict") {
    return { ...d, lede: (d.lede || []).map((s: any) => T(s)) };
  }
  if (body.kind === "commercial") {
    return {
      ...d,
      intro: d.intro ? T(d.intro) : d.intro,
      hint: d.hint ? T(d.hint) : d.hint,
      ourLabel: d.ourLabel ? T(d.ourLabel) : d.ourLabel,
      theirLabel: d.theirLabel ? T(d.theirLabel) : d.theirLabel,
    };
  }
  return d;
}
function despatch(title: any, stamp: any, html: any, opts: any) {
  const prepared = (opts || []).map((o: any) => ({
    b: o.b,
    e: o.e,
    hint: o.hint || "",
    disabled: !!o.disabled,
    f: o.f,
  }));
  const structured = html && typeof html === "object";
  _despatchOpen = {
    title: T(title),
    stamp: T(stamp),
    body: structured ? "" : T(html),
    kind: structured ? html.kind : null,
    data: structured ? applyTToDespatchBody(html) : null,
    opts: prepared,
  };
  if (_onDespatchChange) _onDespatchChange(_despatchOpen);
}
/* Structural event shocks. Options disturb model inputs, not GDP/CPI outcomes.
   Allowed channels: world, worldPartner(+partner), worldInfl, worldRate, worldTfp,
   tot, ucost, labour, migrate, part, tfp|potential, supplyShock, riskPremium,
   expect, spend, uncertainty, contact, approval, srv, hlt, cri. Legacy
   demand/growth still accepted and mapped to uncertainty. Social channels press
   on the services/health/crime targets rather than writing those stocks directly.
   Major episodes (major: true) use a separate 4–8 year schedule with start/end
   despatches — see beginEpisode / endEpisode / rollMajorEvent. */ const EVENT_SHOCK_CHANNELS =
  {
    world: "mod",
    worldPartner: "mod",
    worldInfl: "mod",
    worldRate: "mod",
    worldTfp: "mod",
    tot: "mod",
    ucost: "mod",
    labour: "mod",
    migrate: "mod",
    part: "mod",
    tfp: "mod",
    potential: "mod",
    spend: "mod",
    uncertainty: "mod",
    contact: "mod",
    demand: "mod",
    approval: "mod",
    srv: "mod",
    hlt: "mod",
    cri: "mod",
    supplyShock: "econ",
    riskPremium: "econ",
    expect: "econ",
  };
/* Fiscal bank recapitalisation: debt rises, capital is restored. */ function recapitaliseBank(
  econ: any,
  capitalBoost: any,
  debtCost: any,
) {
  const boost = capitalBoost != null ? capitalBoost : 2;
  const cost = debtCost != null ? debtCost : boost * RECAP_COST;
  econ.debt += cost;
  econ.bankCapital = Math.min(
    16,
    Math.max(econ.bankCapital, BANK_CAP0) + boost,
  );
  econ.depositRun = Math.max(0, (econ.depositRun || 0) - 2);
  econ.creditSpread = Math.max(0, (econ.creditSpread || 0) - 0.8);
  econ.bankLeverage = Math.min(econ.bankLeverage, BANK_LEV_TARGET + 1);
}
function applyEventOption(opt: any) {
  if (!opt) return;
  if (opt.setRel) {
    for (const k in opt.setRel) {
      const pid = k === "_partner" ? G.eventFocus : k;
      if (!pid || isPlayerSeat(pid) || !requirePartner(pid)) continue;
      G.rel[pid] = clamp((G.rel[pid] || 50) + opt.setRel[k], 0, 100);
    }
  }
  if (opt.fac) {
    for (const k in opt.fac) G.fac[k] = (G.fac[k] || 0) + opt.fac[k];
  }
  if (opt.capital != null) G.capital = clamp(G.capital + opt.capital, 0, 100);
  if (opt.shocks) {
    for (const s of opt.shocks) {
      const ch = s.channel;
      const kind = (EVENT_SHOCK_CHANNELS as any)[ch];
      if (!kind) continue;
      const pts = s.points != null ? s.points : 0;
      const q = s.q != null ? s.q : 4;
      if (kind === "econ") {
        if (ch === "supplyShock")
          G.econ.supplyShock = (G.econ.supplyShock || 0) + pts;
        else if (ch === "riskPremium")
          G.econ.riskPremium = (G.econ.riskPremium || 0) + pts;
        else if (ch === "expect") G.econ.expect = (G.econ.expect || 0) + pts;
      } else {
        const mod: Record<string, any> = {
          q,
        };
        if (ch === "tfp") mod.tfp = pts;
        else if (ch === "potential") mod.potential = pts;
        else if (ch === "worldPartner") {
          const partner =
            !s.partner || s.partner === "_partner" ? G.eventFocus : s.partner;
          if (!partner || isPlayerSeat(partner)) continue;
          mod.worldPartner = pts;
          mod.partner = partner;
        } else (mod as any)[ch] = pts;
        G.mods.push(mod);
      }
    }
  }
  if (typeof opt.f === "function") opt.f();
}
function scheduleNextMajorQ(fromQ: any, det: any) {
  const base = fromQ != null ? fromQ : 0;
  const gap = det
    ? 24
    : MAJOR_GAP_MIN + Math.floor(Math.random() * MAJOR_GAP_SPAN);
  return base + gap;
}
function episodeDuration(ev: any, opt: any) {
  if (opt && opt.episodeDuration != null) return opt.episodeDuration;
  if (ev && ev.duration != null) return ev.duration;
  let maxQ = 4;
  if (opt && opt.shocks) {
    for (const s of opt.shocks) {
      if (s.q != null && s.q > maxQ) maxQ = s.q;
    }
  }
  return maxQ;
}
function beginEpisode(ev: any, opt: any) {
  if (!ev || !ev.major) return;
  const o = opt || {};
  const dur = episodeDuration(ev, o);
  G.episode = {
    id: ev.id,
    title: ev.title,
    endTitle: ev.endTitle || "The episode ends",
    stamp: ev.stamp || "Cabinet Office",
    endStamp: ev.endStamp || ev.stamp || "Cabinet Office",
    endText:
      ev.endText || "The pressures that defined this episode have eased.",
    startedQ: G.q,
    endsQ: G.q + dur,
    restorePlayerTariffs: !o.keepPlayerTariffs,
    restorePartnerTariffs: o.restorePartnerTariffs !== false,
    tariffSnap: o._tariffSnap || G._pendingTariffSnap || null,
  };
  G._pendingTariffSnap = null;
}
function snapshotTariffSchedules() {
  const player = G.law ? clone(ensureTariffSchedule(G.law)) : null;
  const world: Record<string, any> = {};
  if (G.world) {
    const playerId = playerCountryId(G.homeRole);
    for (const id of Object.keys(G.world)) {
      if (id === playerId) continue;
      const seat = G.world[id];
      if (seat && seat.law)
        (world as any)[id] = clone(ensureTariffSchedule(seat.law));
    }
  }
  return {
    player,
    world,
  };
}
/** Raise default external tariffs for a trade-war episode. Skips CU locks and CU partners. */ function raiseTradeWarTariffs(
  delta: any,
  opts: any,
) {
  const o = opts || {};
  const snap = snapshotTariffSchedules();
  const d = delta != null ? delta : 8;
  const playerId = playerCountryId(G.homeRole);
  const playerBloc = countryBlocId(playerId, G.blocMember);
  if (o.raisePlayer !== false && G.law) {
    if (lockedTariff(G.law) == null) {
      ensureTariffSchedule(G.law);
      G.law.tariffSchedule.default = clamp(
        (G.law.tariffSchedule.default != null
          ? G.law.tariffSchedule.default
          : BASE_TARIFF) + d,
        0,
        45,
      );
      syncTariffHeadline(G.law);
    }
  }
  if (G.world) {
    for (const id of Object.keys(G.world)) {
      if (id === playerId) continue;
      if (playerBloc && countryBlocId(id, G.blocMember) === playerBloc)
        continue;
      const seat = G.world[id];
      if (!seat || !seat.law) continue;
      ensureTariffSchedule(seat.law);
      seat.law.tariffSchedule.default = clamp(
        (seat.law.tariffSchedule.default != null
          ? seat.law.tariffSchedule.default
          : BASE_TARIFF) + d,
        0,
        45,
      );
      syncTariffHeadline(seat.law, seat.role || worldRoleForSeat(id));
    }
  }
  return snap;
}
/** Raise or cut a partner's bilateral tariff on the player (and optionally the
 *  player's rate on them). Returns the pre-change snapshot; a *major* option
 *  wanting an end-of-episode unwind must park it on G._pendingTariffSnap
 *  itself. Ordinary events call this for a permanent move and ignore the
 *  return, so nothing parks a snapshot a later episode would restore. */
function adjustBilateralTariffs(partnerId: any, delta: any, opts?: any) {
  const o = opts || {};
  const snap = snapshotTariffSchedules();
  const d = delta != null ? delta : 0;
  const playerId = playerCountryId();
  if (!partnerId || isPlayerSeat(partnerId) || !d) return snap;
  const applyDelta = (law: any, againstId: any, role?: any) => {
    if (!law) return;
    ensureTariffSchedule(law);
    const cur = law.tariffSchedule.country[againstId];
    const base =
      cur != null
        ? cur
        : law.tariffSchedule.default != null
          ? law.tariffSchedule.default
          : BASE_TARIFF;
    law.tariffSchedule.country[againstId] = clamp(base + d, 0, 45);
    syncTariffHeadline(law, role);
  };
  const seat = G.world && G.world[partnerId];
  if (seat && seat.law)
    applyDelta(seat.law, playerId, seat.role || worldRoleForSeat(partnerId));
  if ((o.raisePlayer || o.cutPlayer) && G.law && lockedTariff(G.law) == null)
    applyDelta(G.law, partnerId);
  return snap;
}
function restoreEpisodeTariffs(ep: any) {
  if (!ep || !ep.tariffSnap) return;
  const snap = ep.tariffSnap;
  if (ep.restorePlayerTariffs !== false && snap.player && G.law) {
    G.law.tariffSchedule = clone(snap.player);
    syncTariffHeadline(G.law);
  }
  if (ep.restorePartnerTariffs !== false && snap.world && G.world) {
    for (const id of Object.keys(snap.world)) {
      const seat = G.world[id];
      if (seat && seat.law) {
        seat.law.tariffSchedule = clone(snap.world[id]);
        syncTariffHeadline(seat.law, seat.role || worldRoleForSeat(id));
      }
    }
  }
}
function endEpisode() {
  const ep = G.episode;
  if (!ep) return null;
  restoreEpisodeTariffs(ep);
  G.episode = null;
  G.nextMajorQ = scheduleNextMajorQ(G.q, !!G.sandbox);
  return ep;
}
function rollMajorEvent() {
  /* Tutorial owns the despatch lane — leave summit visits, suppress majors. */
  if (G && G.coach && !G.coachDone) return null;
  if (G.episode) return null;
  if (G.nextMajorQ == null) G.nextMajorQ = scheduleNextMajorQ(0, true);
  if (G.q < G.nextMajorQ) return null;
  const pool = EVENTS.filter(
    (e) => e.major && e.cond && e.cond() && e.id !== G.lastEventId,
  );
  if (!pool.length) return null;
  const total = pool.reduce((a, e) => a + (e.w || 1), 0);
  let r = G.sandbox ? 0 : Math.random() * total;
  for (const e of pool) {
    r -= e.w || 1;
    if (r <= 0) {
      const prepared = prepareEvent(e);
      if (prepared) return prepared;
      break;
    }
  }
  for (const e of pool) {
    const prepared = prepareEvent(e);
    if (prepared) return prepared;
  }
  return null;
}
function applyRecessPartnerShocks() {
  const ids = [G.eventFocus].concat(G.eventSponsors || []).filter(Boolean);
  const n = Math.max(1, ids.length);
  const pts = -3.6 / n;
  ids.forEach((id: any) => {
    if (!id || isPlayerSeat(id)) return;
    G.mods.push({
      worldPartner: pts,
      partner: id,
      q: 5,
    });
  });
  G.mods.push({
    world: -0.5,
    q: 5,
  });
}
function makeSlowdownMajor(cfg: any) {
  const pid = cfg.partner;
  const name = theCountry(cfg.name);
  const court = cfg.court || [];
  return {
    id: cfg.id,
    major: true,
    w: cfg.w != null ? cfg.w : 5,
    duration: 8,
    stamp: "Foreign & Commonwealth",
    title: "A deep slowdown in " + name,
    endTitle: name + "'s slowdown bottoms out",
    endStamp: "Foreign & Commonwealth",
    endText:
      "Activity in " +
      name +
      " has stabilised. The bilateral demand shock from that episode has lifted.",
    text:
      name +
      "'s investment cycle has cracked. Factories are cutting orders and the shock will travel through the trade matrix into {C}'s export markets.",
    news: {
      masthead: "The World Post",
      headline: name + "'s investment cycle cracks",
      lede: (opt: any) =>
        "Factories in " +
        name +
        " are cutting orders. The shock will travel into {C}. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => requirePartner(pid),
    resolve: () => ({ focus: pid }),
    opts: [
      {
        b: "Diversify quietly",
        e: "No legislative change",
        shocks: [
          { channel: "worldPartner", partner: pid, points: -6.5, q: 8 },
          { channel: "world", points: -2.2, q: 7 },
        ],
      },
      {
        b: "Court alternative partners",
        e: "A relations push toward other markets",
        fac: { business: 2, patriots: 1 },
        shocks: [
          { channel: "worldPartner", partner: pid, points: -6.5, q: 8 },
          { channel: "world", points: -1.6, q: 7 },
        ],
        f: () => {
          const id = firstPresentPartner(court);
          if (!id) return;
          G.rel[id] = clamp((G.rel[id] || 50) + 8, 0, 100);
        },
      },
      {
        b: "Support exporters with credit",
        e: "A modest spending impulse",
        fac: { business: 3, rural: 1 },
        shocks: [
          { channel: "worldPartner", partner: pid, points: -6.5, q: 8 },
          { channel: "spend", points: 0.35, q: 5 },
          { channel: "world", points: -1.4, q: 6 },
        ],
      },
    ],
  };
}
function makeBilateralTariffMajor(cfg: any) {
  const pid = cfg.partner;
  const name = theCountry(cfg.name);
  const up = !!cfg.up;
  const delta = up ? 8 : -8;
  return {
    id: cfg.id,
    major: true,
    w: 5,
    duration: 8,
    stamp: "Foreign & Commonwealth",
    title: up
      ? name + " raises tariffs on {C}"
      : name + " opens its schedule to {C}",
    endTitle: up
      ? name + "'s tariff wall comes down"
      : name + "'s tariff cut expires",
    endStamp: "Foreign & Commonwealth",
    endText: up
      ? "The bilateral tariff wall " +
        name +
        " raised for this episode has come down, unless {C} chose to keep a matching rate."
      : "The temporary opening in " +
        name +
        "'s schedule has closed, unless {C} locked in a reciprocal cut.",
    text: up
      ? name +
        " has lifted duties on {C}'s goods. Retaliation is a choice; absorbing the hit is another."
      : name +
        " has cut duties on {C}'s goods. Pocket the access, or cut your own rate in return.",
    news: {
      masthead: "The Trade Gazette",
      headline: up
        ? name + " slaps tariffs on {C}"
        : name + " cuts duties on {C}'s goods",
      lede: (opt: any) =>
        (up
          ? name + " has raised barriers against {C}. "
          : name + " has opened its schedule to {C}. ") +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => requireScriptablePartner(pid),
    resolve: () => ({ focus: pid }),
    opts: up
      ? [
          {
            b: "Stay open and absorb the hit",
            e: "They raise the wall; you do not",
            fac: { business: -3, rural: -2, patriots: -2 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: -2.0, q: 6 },
              { channel: "uncertainty", points: 0.8, q: 6 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, delta);
            },
          },
          {
            b: "Match the wall, restore later",
            e: "Raise your bilateral rate; both sides unwind when it ends",
            fac: { business: -2, rural: 2, patriots: 4 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: -1.5, q: 6 },
              { channel: "uncertainty", points: 0.6, q: 6 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, delta, {
                raisePlayer: true,
              });
            },
          },
          {
            b: "Match and keep the higher wall",
            e: "They unwind later; your bilateral rate stays up",
            keepPlayerTariffs: true,
            fac: { business: -4, rural: 3, patriots: 6 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: -1.2, q: 6 },
              { channel: "uncertainty", points: 0.5, q: 5 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, 10, {
                raisePlayer: true,
              });
            },
          },
        ]
      : [
          {
            b: "Pocket the access",
            e: "Enjoy the cut; no reciprocal opening",
            fac: { business: 3, patriots: 2 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: 1.4, q: 6 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, delta);
            },
          },
          {
            b: "Reciprocate, restore later",
            e: "Cut your rate on them too; episode restores both",
            fac: { business: 4, rural: -2 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: 1.8, q: 6 },
              { channel: "tfp", points: 0.06, q: 8 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, delta, {
                cutPlayer: true,
              });
            },
          },
          {
            b: "Lock in liberalisation",
            e: "Both sides keep the lower bilateral rates",
            keepPlayerTariffs: true,
            restorePartnerTariffs: false,
            fac: { business: 6, rural: -4, patriots: -3 },
            shocks: [
              { channel: "worldPartner", partner: pid, points: 2.0, q: 8 },
              { channel: "tfp", points: 0.1, q: 10 },
            ],
            f: () => {
              G._pendingTariffSnap = adjustBilateralTariffs(pid, delta, {
                cutPlayer: true,
              });
            },
          },
        ],
  };
}
const EVENTS = [
  /* ---- foreign relations ---- */ {
    id: "blocInvitation",
    w: 9,
    stamp: "Foreign & Commonwealth",
    title: "{P} invites {C} to its trade bloc",
    text: () => {
      const player = playerCountryId();
      const home = countryBlocId(player);
      const bloc = home ? blocByIdOrCustom(home) : null;
      return home
        ? "{P} has invited {C} to join their trade alliance. Membership is exclusive — accepting means leaving " +
            (bloc ? bloc.name : "your current bloc") +
            " first."
        : "{P} has invited {C} to join their trade alliance. Membership is exclusive — you would leave any other bloc first.";
    },
    news: {
      masthead: "The Trade Gazette",
      headline: "{P} invites {C} into a trade bloc",
      lede: (opt: any) =>
        "{P} has asked {C} to join its alliance. " +
        (opt && opt.b === "Accept"
          ? "{C} has opened accession talks."
          : opt && opt.b === "Leak the terms"
            ? "{C} leaked the terms; relations with {P} have soured."
            : "{C} declined, leaving the door open."),
    },
    cond: () => {
      const player = playerCountryId();
      const inv = G.blocInvites && G.blocInvites[player];
      /* Human MP invites use the inbound despatch, not this random event. */
      if (inv && inv.awaitHuman) return false;
      if (!inv || !(blocById(inv.blocId) || G.customBlocs[inv.blocId]))
        return false;
      if (countryBlocId(player) === inv.blocId) return false;
      return true;
    },
    resolve: () => {
      const player = playerCountryId();
      const inv = G.blocInvites && G.blocInvites[player];
      if (!inv) return null;
      const from = activePartners().find(
        (p) => p.id !== player && countryBlocId(p.id) === inv.blocId,
      );
      return from
        ? {
            focus: from.id,
            blocId: inv.blocId,
          }
        : {
            blocId: inv.blocId,
          };
    },
    opts: [
      {
        b: "Accept",
        e: "Accession begins — alignment and treaty still required",
        fac: {
          business: 5,
          patriots: -6,
        },
        f: () => {
          const player = playerCountryId();
          const inv = G.blocInvites && G.blocInvites[player];
          if (!inv) return;
          applyPoachLeave(G, player, inv.blocId);
          beginPlayerBlocAccession(G, inv.blocId);
          if (G.blocAccessionByCountry && G.blocAccessionByCountry[player]) {
            G.blocAccessionByCountry[player].invitedBy = inv.fromId || null;
          }
          delete G.blocInvites[player];
        },
      },
      {
        b: "Decline politely",
        e: "Door stays open",
        fac: {
          patriots: 3,
          business: -2,
        },
        capital: -2,
        f: () => {
          const player = playerCountryId();
          delete G.blocInvites[player];
        },
      },
      {
        b: "Leak the terms",
        e: "Relations sour",
        fac: {
          patriots: 4,
          business: -4,
        },
        capital: -4,
        f: () => {
          const player = playerCountryId();
          const inv = G.blocInvites && G.blocInvites[player];
          if (inv && G.eventFocus)
            G.rel[G.eventFocus] = clamp(
              (G.rel[G.eventFocus] || 50) - 8,
              0,
              100,
            );
          delete G.blocInvites[player];
        },
      },
    ],
  },
  {
    id: "customAllianceFounding",
    w: 6,
    stamp: "Foreign & Commonwealth",
    title: "Your alliance charter",
    text: "The founding treaty is registered. Court partners one at a time — each seat can hold only one bloc membership.",
    cond: () => G._customBlocFoundedQ != null && G.q === G._customBlocFoundedQ,
    opts: [
      {
        b: "Open the trade drawer",
        e: "Invitations are staged from the bill",
        fac: {
          business: 3,
          patriots: -2,
        },
      },
      {
        b: "Keep it quiet for now",
        e: "Sovereignty preserved a little longer",
        fac: {
          patriots: 4,
          business: -2,
        },
      },
    ],
  },
  {
    id: "memberDefection",
    w: 7,
    stamp: "Foreign & Commonwealth",
    title: "{P} wavers inside the bloc",
    text: "Relations with {P} have soured inside your trade pact. Their delegation hints at walking away.",
    cond: () => {
      const player = playerCountryId();
      const bid = countryBlocId(player);
      if (!bid) return false;
      return scriptablePartners().some(
        (p) => countryBlocId(p.id) === bid && (G.rel[p.id] || 50) < 22,
      );
    },
    resolve: () => {
      const player = playerCountryId();
      const bid = countryBlocId(player);
      const pool = scriptablePartners().filter(
        (p) => countryBlocId(p.id) === bid && (G.rel[p.id] || 50) < 22,
      );
      return pool.length
        ? {
            focus: pool.sort(
              (a, b) => (G.rel[a.id] || 50) - (G.rel[b.id] || 50),
            )[0].id,
          }
        : null;
    },
    opts: [
      {
        b: "Offer concessions",
        e: "They stay, capital spent",
        capital: -8,
        setRel: {},
        fac: {
          business: -3,
          patriots: -4,
        },
        f: () => {
          if (G.eventFocus)
            G.rel[G.eventFocus] = clamp(
              (G.rel[G.eventFocus] || 50) + 14,
              0,
              100,
            );
        },
      },
      {
        b: "Let them leave",
        e: "The pact shrinks",
        fac: {
          patriots: 3,
          business: -5,
        },
        f: () => {
          if (!G.eventFocus) return;
          const bid = countryBlocId(G.eventFocus);
          delete G.blocMember[G.eventFocus];
          const custom = bid && G.customBlocs[bid];
          if (custom)
            custom.members = custom.members.filter(
              (m: any) => m !== G.eventFocus,
            );
        },
      },
      {
        b: "Threaten retaliation",
        e: "They stay, relations freeze",
        fac: {
          patriots: 6,
          business: -4,
        },
        f: () => {
          if (G.eventFocus)
            G.rel[G.eventFocus] = clamp(
              (G.rel[G.eventFocus] || 50) - 6,
              0,
              100,
            );
        },
      },
    ],
  },
  {
    id: "blocExitReferendum",
    w: 8,
    stamp: "Home Affairs",
    title: "Leave the bloc?",
    text: "A petition to leave your trade bloc has passed a million signatures. Business warns of disruption; patriots cheer.",
    cond: () => countryBlocId(playerCountryId()) && G.q > 8,
    opts: [
      {
        b: "Hold a vote and leave",
        e: "Sovereignty restored, trade frictions rise",
        f: () => {
          /* Confirm before any effect — applyEventOption runs f() after
           * declarative shocks, so fac/shocks live here not on the option. */
          const ok =
            typeof window !== "undefined" &&
            typeof window.confirm === "function"
              ? window.confirm(
                  "Leave your trade bloc now? Membership ends immediately when you confirm.",
                )
              : true;
          if (!ok) return;
          leaveBloc(G.law);
          G.fac.patriots = (G.fac.patriots || 0) + 10;
          G.fac.business = (G.fac.business || 0) - 8;
          G.fac.rural = (G.fac.rural || 0) + 4;
          G.mods.push({ q: 6, uncertainty: 0.4 });
          G.mods.push({ q: 8, tot: 0.3 });
        },
      },
      {
        b: "Renegotiate terms",
        e: "Half a loaf",
        capital: -6,
        fac: {
          business: 2,
          patriots: -3,
        },
        f: () => {
          const bid = countryBlocId(playerCountryId());
          if (!bid) return;
          activePartners().forEach((p) => {
            if (countryBlocId(p.id) !== bid) return;
            G.rel[p.id] = clamp((G.rel[p.id] || 50) + 5, 0, 100);
          });
        },
      },
      {
        b: "Ignore it",
        e: "The streets stay noisy",
        fac: {
          patriots: -6,
          business: 2,
        },
        capital: -4,
      },
    ],
  },
  {
    id: "ultimatum",
    w: 11,
    stamp: "Foreign & Commonwealth",
    title: "Washington issues an ultimatum",
    text: "The United States has given {C} ninety days to drop the digital services tax, or face tariffs on {C}'s largest export categories.",
    news: {
      masthead: "The World Post",
      headline: "Washington ultimatum: drop the digital tax",
      lede: (opt: any) =>
        "The United States has given {C} ninety days to scrap the digital services tax. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => {
      if (!requireScriptablePartner("united_states")) return false;
      if (hasDeal("us_tech")) return false;
      if ((G.rel.united_states != null ? G.rel.united_states : 50) < 25)
        return false;
      return G.law.taxes.digitalTax.on && G.law.taxes.digitalTax.rate > 1;
    },
    resolve: () => ({ focus: "united_states" }),
    opts: [
      {
        b: "Abolish the digital services tax",
        e: "Relations recover, receipts fall",
        setRel: {
          united_states: 18,
        },
        fac: {
          business: 5,
          patriots: -7,
          urban: -3,
        },
        f: () => {
          G.law.taxes.digitalTax.on = false;
          addDiploLedger(G, "united_states", {
            id: "ultimatum_comply",
            label: "Complied on digital tax",
            pts: 8,
          });
        },
      },
      {
        b: "Halve it and call it a compromise",
        e: "Nobody is happy, nobody escalates",
        setRel: {
          united_states: 6,
        },
        capital: -3,
        f: () => {
          const t = G.law.taxes.digitalTax;
          t.rate = Math.round(t.rate / 2);
          addDiploLedger(G, "united_states", {
            id: "ultimatum_half",
            label: "Compromised on digital tax",
            pts: 3,
          });
        },
      },
      {
        b: "Refuse and prepare for tariffs",
        e: "They follow through",
        setRel: {
          united_states: -16,
        },
        fac: {
          patriots: 8,
          business: -7,
        },
        shocks: [
          {
            channel: "tot",
            points: 0.35,
            q: 6,
          },
          {
            channel: "worldPartner",
            partner: "united_states",
            points: -2.0,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 0.25,
            q: 4,
          },
        ],
        f: () => {
          addDiploLedger(G, "united_states", {
            id: "ultimatum_refuse",
            label: "Defied digital-tax ultimatum",
            pts: -12,
          });
        },
      },
    ],
  },
  {
    id: "sanctions",
    w: 10,
    stamp: "Foreign & Commonwealth",
    title: "{S} want {C} inside sanctions on {P}",
    text: "{S} are assembling a sanctions package against {P} and want {C} inside it. Trade with {P} is not costless to lose.",
    news: {
      masthead: "The Diplomatic Courier",
      headline: "{S} press {C} to sanction {P}",
      lede: (opt: any) =>
        "Allies have asked {C} to join restrictive measures against {P}. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => {
      if (G.q <= 4) return false;
      const target = pickEventPartner({
        filter: (p: any) => {
          const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
          if (rel >= 52) return false;
          if (
            ["france", "germany", "united_states", "australia"].includes(
              p.id,
            ) &&
            rel > 40
          )
            return false;
          return dealsWith(p.id).length < 3;
        },
        score: (p: any) =>
          (52 - (G.rel[p.id] != null ? G.rel[p.id] : 50)) * 3 +
          partnerShare(G.homeRole, p) * 25,
      });
      return !!target;
    },
    resolve: () => {
      const focus = pickEventPartner({
        filter: (p: any) => {
          const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
          if (rel >= 52) return false;
          if (
            ["france", "germany", "united_states", "australia"].includes(
              p.id,
            ) &&
            rel > 40
          )
            return false;
          return true;
        },
        score: (p: any) =>
          (52 - (G.rel[p.id] != null ? G.rel[p.id] : 50)) * 3 +
          partnerShare(G.homeRole, p) * 25,
      });
      const sponsors = scriptablePartners()
        .filter(
          (p) =>
            ["france", "germany", "united_states", "australia"].includes(
              p.id,
            ) &&
            p.id !== (focus && focus.id) &&
            (G.rel[p.id] != null ? G.rel[p.id] : 50) >= 40,
        )
        .map((p) => p.id);
      return focus
        ? {
            focus: focus.id,
            sponsors,
          }
        : null;
    },
    opts: [
      {
        b: "Join the package in full",
        e: "Allies delighted, inputs get dearer",
        fac: {
          patriots: 5,
          business: -5,
        },
        shocks: [
          {
            channel: "supplyShock",
            points: 0.9,
          },
          {
            channel: "tot",
            points: 0.45,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 0.2,
            q: 4,
          },
        ],
        f: () => {
          const tid = G.eventFocus;
          if (!tid) return;
          G.rel[tid] = clamp((G.rel[tid] || 50) - 26, 0, 100);
          (G.eventSponsors || []).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) + 12, 0, 100);
          });
          for (const id of dealsWith(tid)) delete G.law.deals[id];
          G.mods.push({
            worldPartner: -1.8,
            partner: tid,
            q: 6,
          });
          addDiploLedger(G, tid, {
            id: "sanctions_full_" + tid,
            label: "Joined sanctions against them",
            pts: -18,
          });
          setSanctionStance(G, tid, { against: true });
          (G.eventSponsors || []).forEach((id: any) => {
            addDiploLedger(G, id, {
              id: "sanctions_with_" + id + "_" + G.q,
              label: "Stood with them on sanctions",
              pts: 8,
            });
            setSanctionStance(G, id, { with: true });
          });
        },
      },
      {
        b: "Join the symbolic measures only",
        e: "Half in, trusted by neither side",
        capital: -4,
        f: () => {
          const tid = G.eventFocus;
          if (!tid) return;
          G.rel[tid] = clamp((G.rel[tid] || 50) - 9, 0, 100);
          (G.eventSponsors || []).slice(0, 2).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) + 3, 0, 100);
          });
          addDiploLedger(G, tid, {
            id: "sanctions_sym_" + tid,
            label: "Symbolic sanctions against them",
            pts: -9,
          });
          setSanctionStance(G, tid, { against: true });
          (G.eventSponsors || []).slice(0, 2).forEach((id: any) => {
            addDiploLedger(G, id, {
              id: "sanctions_sym_with_" + id,
              label: "Soft support on sanctions",
              pts: 3,
            });
            setSanctionStance(G, id, { with: true });
          });
        },
      },
      {
        b: "Stay out of it",
        e: "Trade protected, allies remember",
        fac: {
          business: 4,
          urban: -4,
        },
        f: () => {
          const tid = G.eventFocus;
          if (tid) {
            G.rel[tid] = clamp((G.rel[tid] || 50) + 10, 0, 100);
            addDiploLedger(G, tid, {
              id: "sanctions_out_" + tid,
              label: "Refused to sanction them",
              pts: 6,
            });
          }
          (G.eventSponsors || []).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) - 14, 0, 100);
            addDiploLedger(G, id, {
              id: "sanctions_abandon_" + id,
              label: "Abandoned them on sanctions",
              pts: -10,
            });
            clearSanctionStance(G, id);
          });
        },
      },
    ],
  },
  {
    id: "newGovt",
    w: 10,
    stamp: "Foreign & Commonwealth",
    title: () => {
      const meta = polityOf(G.eventFocus);
      if (meta.kind === "congress") return "{P} reshuffles its leadership";
      return "A new government in {P}";
    },
    text: () => {
      const meta = polityOf(G.eventFocus);
      if (meta.kind === "congress") {
        return "A leadership reshuffle in {P} has produced a circle with very different views about {C}. Everything previously agreed is now, in their words, open for discussion.";
      }
      return "An election in {P} has produced a government with very different views about {C}. Everything previously agreed is now, in their words, open for discussion.";
    },
    cond: () => G.q > 2 && scriptablePartners().length > 0,
    resolve: () => {
      const p = pickEventPartner({ scriptable: true });
      return p
        ? {
            focus: p.id,
          }
        : null;
    },
    opts: [
      {
        b: "Court them early",
        e: "Costs capital, buys goodwill",
        capital: -6,
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) + 14, 0, 100);
            addDiploLedger(G, id, {
              id: "newgovt_court_" + id,
              label: "Courtship after change of government",
              pts: 8,
            });
          }
        },
      },
      {
        b: "Wait and see",
        e: "Free, and the drift is theirs to choose",
        f: () => {
          const id = G.eventFocus;
          if (id)
            G.rel[id] = clamp(
              (G.rel[id] || 50) + (!G.sandbox && Math.random() < 0.5 ? -12 : 5),
              0,
              100,
            );
        },
      },
      {
        b: "Publicly criticise them",
        e: "Popular at home, expensive abroad",
        fac: {
          patriots: 7,
          business: -3,
        },
        f: () => {
          activePartners().forEach((p) => {
            G.rel[p.id] = clamp(G.rel[p.id] - 6, 0, 100);
            addDiploLedger(G, p.id, {
              id: "newgovt_crit_" + G.q,
              label: "Public criticism of foreign governments",
              pts: -4,
            });
          });
        },
      },
    ],
  },
  {
    id: "swapLine",
    w: 9,
    stamp: "Bank of {C}",
    title: "An offer of a currency swap line",
    text: () => {
      const gulf =
        requireScriptablePartner("saudi") || requireScriptablePartner("uae");
      const cu =
        countryBlocId(playerCountryId()) !== "continental_union" &&
        (requireScriptablePartner("france") ||
          requireScriptablePartner("germany"));
      if (gulf && cu)
        return "The Gulf states and the European Union have both offered a standing swap line. It would steady the currency in a crisis. It also means someone else has a view on your budget.";
      if (gulf)
        return "The Gulf states have offered a standing swap line. It would steady the currency in a crisis. It also means someone else has a view on your budget.";
      return "The European Union has offered a standing swap line. It would steady the currency in a crisis. It also means someone else has a view on your budget.";
    },
    cond: () => {
      if (!(G.econ.yield > 5.5 || G.econ.debt > 105)) return false;
      const gulf =
        requireScriptablePartner("saudi") || requireScriptablePartner("uae");
      const cu =
        countryBlocId(playerCountryId()) !== "continental_union" &&
        (requireScriptablePartner("france") ||
          requireScriptablePartner("germany"));
      return !!(gulf || cu);
    },
    opts: [
      {
        b: "Take the EU line",
        e: "Cheaper borrowing, conditions attached",
        setRel: {
          france: 13,
          germany: 11,
        },
        fac: {
          business: 4,
          patriots: -6,
        },
        shocks: [
          {
            channel: "riskPremium",
            points: -0.7,
          },
          {
            channel: "approval",
            points: -0.3,
            q: 8,
          },
        ],
        available: () =>
          countryBlocId(playerCountryId()) !== "continental_union" &&
          (requireScriptablePartner("france") ||
            requireScriptablePartner("germany")),
        f: () => {
          ["france", "germany"].forEach((id) => {
            if (!requirePartner(id)) return;
            addDiploLedger(G, id, {
              id: "swap_cu_" + id,
              label: "Accepted EU swap line",
              pts: 6,
            });
          });
        },
      },
      {
        b: "Take the Gulf line",
        e: "No conditions, awkward questions",
        setRel: {
          saudi: 15,
          uae: 12,
        },
        fac: {
          business: 3,
          urban: -5,
        },
        shocks: [
          {
            channel: "riskPremium",
            points: -0.5,
          },
        ],
        available: () =>
          requireScriptablePartner("saudi") || requireScriptablePartner("uae"),
        f: () => {
          ["saudi", "uae"].forEach((id) => {
            if (!requirePartner(id)) return;
            addDiploLedger(G, id, {
              id: "swap_gulf_" + id,
              label: "Accepted Gulf swap line",
              pts: 6,
            });
          });
        },
      },
      {
        b: "Decline both",
        e: "Nobody owns you, nobody catches you",
        fac: {
          patriots: 5,
        },
        shocks: [
          {
            channel: "riskPremium",
            points: 0.3,
          },
        ],
      },
    ],
  },
  {
    id: "migration",
    w: 9,
    stamp: "Home Office",
    title: "{P} wants a migration deal",
    text: "Displacement abroad has brought sustained arrivals at {C}'s frontier. {P} wants a burden-sharing agreement; your backbenchers want a fence.",
    news: {
      masthead: "The World Post",
      headline: "Arrivals at {C}'s frontier — {P} wants a deal",
      lede: (opt: any) =>
        "{P} has asked {C} to share the caseload. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => G.q > 3 && scriptablePartners().length > 0,
    resolve: () => {
      const p = pickEventPartner({
        scriptable: true,
        score: (x: any) => partnerShare(G.homeRole, x) * 20,
      });
      if (!p) return null;
      const others = scriptablePartners()
        .filter((x) => x.id !== p.id)
        .sort(
          (a, b) => partnerShare(G.homeRole, b) - partnerShare(G.homeRole, a),
        )
        .slice(0, 2)
        .map((x) => x.id);
      return { focus: p.id, sponsors: others };
    },
    opts: [
      {
        b: "Sign the burden-sharing agreement",
        e: "Capacity rises, patriots revolt",
        setRel: {
          _partner: 13,
        },
        fac: {
          patriots: -11,
          urban: 5,
        },
        shocks: [
          {
            channel: "labour",
            points: 0.35,
            q: 14,
          },
          {
            channel: "spend",
            points: 0.35,
            q: 14,
          },
        ],
        f: () => {
          const ids = [G.eventFocus]
            .concat(G.eventSponsors || [])
            .filter(Boolean);
          ids.forEach((id: any) => {
            if (!requirePartner(id)) return;
            if (id !== G.eventFocus)
              G.rel[id] = clamp((G.rel[id] || 50) + 8, 0, 100);
            addDiploLedger(G, id, {
              id: "migration_share_" + id,
              label: "Burden-sharing agreement",
              pts: 6,
            });
          });
        },
      },
      {
        b: "Pay them to hold the line",
        e: "Money instead of politics",
        setRel: {
          _partner: 5,
        },
        fac: {
          patriots: 2,
        },
        shocks: [
          {
            channel: "spend",
            points: 0.5,
            q: 10,
          },
        ],
      },
      {
        b: "Close the border",
        e: "Popular at home, isolating abroad",
        fac: {
          patriots: 11,
          rural: 4,
          business: -6,
          urban: -6,
        },
        shocks: [
          {
            channel: "labour",
            points: -0.4,
            q: 12,
          },
        ],
        f: () => {
          activePartners().forEach((p) => {
            G.rel[p.id] = clamp(G.rel[p.id] - 10, 0, 100);
            addDiploLedger(G, p.id, {
              id: "migration_close_" + G.q,
              label: "Closed the border",
              pts: -6,
            });
          });
        },
      },
    ],
  },
  {
    id: "espionage",
    w: 8,
    stamp: "Cabinet Secretary",
    title: "{P} caught spying",
    text: "{P}'s intelligence service has been operating inside {C}'s ministries. The press has it, and expects you to say something before lunch.",
    news: {
      masthead: "The World Post",
      headline: "{P} caught spying inside {C}'s ministries",
      lede: (opt: any) =>
        "{P}'s intelligence service has been operating in {C}. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => G.q > 5 && scriptablePartners().length > 0,
    resolve: () => {
      const p = pickEventPartner({ scriptable: true });
      return p
        ? {
            focus: p.id,
          }
        : null;
    },
    opts: [
      {
        b: "Expel their diplomats",
        e: "Firm, and reciprocated",
        fac: {
          patriots: 8,
          business: -3,
        },
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) - 20, 0, 100);
            addDiploLedger(G, id, {
              id: "espionage_expel_" + id,
              label: "Expelled their diplomats",
              pts: -14,
            });
          }
        },
      },
      {
        b: "Handle it privately",
        e: "Quiet, and it leaks anyway",
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) - 5, 0, 100);
            addDiploLedger(G, id, {
              id: "espionage_quiet_" + id,
              label: "Quiet espionage row",
              pts: -5,
            });
          }
          FACTIONS.forEach((f) => (G.fac[f.id] -= 2));
        },
      },
      {
        b: "Deny there is anything to it",
        e: "Cheapest today, worst later",
        fac: {
          patriots: -5,
        },
        shocks: [
          {
            channel: "approval",
            points: -0.6,
            q: 6,
          },
        ],
      },
    ],
  },
  {
    id: "tradeBoom",
    w: 8,
    stamp: "Business & Trade",
    title: "{P} opens its market",
    text: "{P} has unilaterally cut tariffs on the goods {C} is best at making. They would like something in return, eventually.",
    news: {
      masthead: "The Trade Gazette",
      headline: "{P} opens its market to {C}",
      lede: (opt: any) =>
        "{P} has cut tariffs on {C}'s strongest exports. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () => {
      if (G.q <= 2) return false;
      return !!pickEventPartner({
        scriptable: true,
        filter: (p: any) => {
          const signed = dealsWith(p.id);
          return signed.length < dealsForPartner(p, G.homeRole).length;
        },
        score: (p: any) =>
          partnerShare(G.homeRole, p) * 20 +
          (dealsForPartner(p, G.homeRole).length - dealsWith(p.id).length) * 5,
      });
    },
    resolve: () => {
      const p = pickEventPartner({
        scriptable: true,
        filter: (p: any) =>
          dealsWith(p.id).length < dealsForPartner(p, G.homeRole).length,
        score: (p: any) =>
          partnerShare(G.homeRole, p) * 20 +
          (dealsForPartner(p, G.homeRole).length - dealsWith(p.id).length) * 5,
      });
      return p
        ? {
            focus: p.id,
          }
        : null;
    },
    opts: [
      {
        b: "Reciprocate immediately",
        e: "Openness both ways",
        fac: {
          business: 5,
          rural: -4,
        },
        shocks: [
          {
            channel: "tfp",
            points: 0.08,
            q: 10,
          },
          {
            channel: "worldPartner",
            partner: "_partner",
            points: 1.0,
            q: 5,
          },
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) + 15, 0, 100);
            adjustBilateralTariffs(id, -6, { cutPlayer: true });
          }
        },
      },
      {
        b: "Take the access, keep your tariffs",
        e: "Good quarter, worse reputation",
        fac: {
          business: 3,
          patriots: 3,
        },
        shocks: [
          {
            channel: "worldPartner",
            partner: "_partner",
            points: 1.2,
            q: 5,
          },
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) - 8, 0, 100);
            adjustBilateralTariffs(id, -6);
          }
        },
      },
      {
        b: "Match it and go further",
        e: "A bet on being open",
        fac: {
          business: 7,
          rural: -8,
          patriots: -5,
        },
        shocks: [
          {
            channel: "tfp",
            points: 0.16,
            q: 14,
          },
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) + 12, 0, 100);
            adjustBilateralTariffs(id, -8, { cutPlayer: true });
          }
          if (lockedTariff(G.law) == null) G.law.tariff = 0;
        },
      },
    ],
  },
  {
    id: "energy",
    w: 7,
    stamp: "Cabinet Office",
    title: "Energy prices double overnight",
    text: "A supply disruption abroad has sent wholesale gas through the roof. Bills follow within weeks.",
    cond: () => true,
    opts: [
      {
        b: "Cap household bills",
        e: "About 1.4% of GDP for a year",
        shocks: [
          {
            channel: "supplyShock",
            points: 1.6,
          },
          {
            channel: "spend",
            points: 1.4,
            q: 4,
          },
          {
            channel: "approval",
            points: 1.2,
            q: 4,
          },
        ],
      },
      {
        b: "Let prices pass through",
        e: "No fiscal cost, considerable anger",
        shocks: [
          {
            channel: "supplyShock",
            points: 2.9,
          },
        ],
        f: () => {
          FACTIONS.forEach((x) => (G.fac[x.id] -= 5));
        },
      },
      {
        b: "Windfall levy on producers",
        e: "Introduces the levy at 40%",
        fac: {
          business: -6,
          workers: 3,
        },
        shocks: [
          {
            channel: "supplyShock",
            points: 2.2,
          },
        ],
        f: () => {
          G.law.taxes.windfall.on = true;
          G.law.taxes.windfall.rate = 40;
        },
      },
    ],
  },
  {
    id: "gilts",
    w: 9,
    stamp: "Debt Management Office",
    title: "A failed bond auction",
    text: "This morning's auction was undersubscribed. The market wants to know whether you are serious about the deficit.",
    cond: () => G.econ.debt > 105 || balanceOf(G.law, G.econ).balance < -6,
    opts: [
      {
        b: "Announce a consolidation plan",
        e: "Credibility restored, households pull back",
        shocks: [
          {
            channel: "riskPremium",
            points: -0.5,
          },
          {
            channel: "uncertainty",
            points: 0.5,
            q: 5,
          },
          {
            channel: "approval",
            points: -1.4,
            q: 5,
          },
        ],
      },
      {
        b: "Hold your nerve",
        e: "The premium may stick",
        shocks: [
          {
            channel: "riskPremium",
            points: 0.7,
          },
          {
            channel: "uncertainty",
            points: 0.35,
            q: 4,
          },
        ],
      },
      {
        b: "Lean on the Bank to buy bonds",
        e: "Yields fall, expectations de-anchor",
        fac: {
          business: -5,
        },
        shocks: [
          {
            channel: "expect",
            points: 1.1,
          },
          {
            channel: "riskPremium",
            points: -0.9,
          },
        ],
      },
    ],
  },
  {
    id: "strike",
    w: 6,
    stamp: "Cabinet Office",
    title: "Public sector pay dispute",
    text: "Nurses, teachers and rail staff have coordinated ballots. Real pay has fallen three years running.",
    cond: () => G.econ.services < 55 || G.econ.inflation > 4,
    opts: [
      {
        b: "Fund an above-inflation settlement",
        e: "Raises health and education spending",
        fac: {
          workers: 5,
        },
        shocks: [
          {
            channel: "supplyShock",
            points: 0.35,
          },
        ],
        f: () => {
          G.law.spend.health = clamp(G.law.spend.health + 0.4, 3, 16);
          G.law.spend.education = clamp(G.law.spend.education + 0.3, 1, 10);
        },
      },
      {
        b: "Offer a one-off lump sum",
        e: "Buys about a year of peace",
        shocks: [
          {
            channel: "spend",
            points: 0.5,
            q: 4,
          },
          {
            channel: "approval",
            points: 0.4,
            q: 4,
          },
        ],
      },
      {
        b: "Hold firm and legislate on strikes",
        e: "Services degrade, patriots approve",
        fac: {
          workers: -9,
          patriots: 4,
        },
        shocks: [
          {
            channel: "uncertainty",
            points: 0.3,
            q: 3,
          },
          {
            channel: "srv",
            points: -8,
            q: 6,
          },
          {
            channel: "part",
            points: -0.4,
            q: 4,
          },
        ],
      },
    ],
  },
  {
    id: "recess",
    w: 6,
    stamp: "Foreign & Commonwealth",
    title: "Recession in {P}",
    text: () =>
      G.eventSponsors && G.eventSponsors[0]
        ? "{P} and {S} have both contracted. Order books in {C} are thinning."
        : "{P} has contracted. Order books in {C} are thinning.",
    news: {
      masthead: "The Fiscal Gazette",
      headline: () =>
        G.eventSponsors && G.eventSponsors[0]
          ? "{P} and {S} slip into recession"
          : "{P} slips into recession",
      lede: (opt: any) =>
        "Export orders from {C}'s largest markets are thinning. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () =>
      activePartners().length > 0 &&
      !(
        G.episode &&
        (G.episode.id === "globalRecess" || G.episode.id === "creditCrunch")
      ),
    resolve: () => {
      const ranked = activePartners()
        .slice()
        .sort(
          (a, b) => partnerShare(G.homeRole, b) - partnerShare(G.homeRole, a),
        );
      if (!ranked.length) return null;
      return {
        focus: ranked[0].id,
        sponsors: ranked[1] ? [ranked[1].id] : [],
      };
    },
    opts: [
      {
        b: "Let the automatic stabilisers work",
        e: "No new policy",
        shocks: [
          {
            channel: "spend",
            points: 0.5,
            q: 5,
          },
        ],
        f: () => applyRecessPartnerShocks(),
      },
      {
        b: "Bring forward capital projects",
        e: "Raises infrastructure spending",
        f: () => {
          applyRecessPartnerShocks();
          G.law.spend.infra = clamp(G.law.spend.infra + 0.6, 0, 8);
        },
      },
      {
        b: "Cut VAT temporarily",
        e: "Cuts the standard rate by five points; reverse it when you dare",
        shocks: [
          {
            channel: "uncertainty",
            points: -0.5,
            q: 4,
          },
          {
            channel: "approval",
            points: 1.0,
            q: 4,
          },
        ],
        f: () => {
          applyRecessPartnerShocks();
          const v = G.law.taxes.vat;
          if (v && v.on) v.rate = Math.max(0, v.rate - 5);
        },
      },
    ],
  },
  {
    id: "bank",
    w: 5,
    stamp: "Financial Stability",
    title: "A lender is in trouble",
    text: "A mid-sized bank has lost a fifth of its deposits in two days. The Governor called at six this morning.",
    cond: () =>
      !G.econ.bankStress &&
      !(G.econ.bankStressCd > 0) &&
      (G.econ.rate > 7.5 || G.econ.yield > 8.0) &&
      G.econ.bankLeverage < BANK_STRESS_LEV - 0.5,
    opts: [
      {
        b: "Guarantee deposits and recapitalise",
        e: "Fiscal recap onto the debt; capital restored",
        fac: {
          business: 3,
          workers: -3,
        },
        f: () => {
          recapitaliseBank(G.econ, 3, 1.8);
        },
      },
      {
        b: "Force a private sale",
        e: "Balance-sheet repair if buyers exist; otherwise a capital hit",
        shocks: [
          {
            channel: "ucost",
            points: 1.0,
            q: 4,
          },
          {
            channel: "uncertainty",
            points: 0.35,
            q: 4,
          },
        ],
        f: () => {
          G.econ.bankCapital = Math.max(2, G.econ.bankCapital - 1.5);
          G.econ.bankLoans = Math.max(
            40,
            (G.econ.bankLoans || BANK_LOANS0) * 0.96,
          );
          G.econ.depositRun = Math.min(8, (G.econ.depositRun || 0) + 1.2);
          G.fac.business += 1;
        },
      },
      {
        b: "Let it fail",
        e: "Balance-sheet wipeout and a credit crunch",
        fac: {
          business: -4,
          workers: -2,
          urban: -2,
          pensioners: -2,
        },
        shocks: [
          {
            channel: "ucost",
            points: 3.0,
            q: 5,
          },
          {
            channel: "uncertainty",
            points: 0.8,
            q: 4,
          },
        ],
        f: () => {
          G.econ.bankCapital = Math.max(2, G.econ.bankCapital - 5);
          G.econ.bankLoans = Math.max(
            40,
            (G.econ.bankLoans || BANK_LOANS0) * 0.88,
          );
          G.econ.depositRun = Math.min(8, (G.econ.depositRun || 0) + 4);
          G.econ.creditSpread += 1.5;
        },
      },
    ],
  },
  {
    id: "blackmarket",
    w: 5,
    stamp: "Revenue & Customs",
    title: "Smuggling is out of hand",
    text: "Duty-paid volumes have collapsed. Organised crime has taken over distribution of everything you tax heavily or ban outright.",
    cond: () => aggregate(G.law).blackLevel > 28,
    opts: [
      {
        b: "Fund enforcement",
        e: "Raises justice spending",
        shocks: [
          {
            channel: "cri",
            points: -3,
            q: 8,
          },
        ],
        f: () => {
          G.law.spend.justice = clamp(G.law.spend.justice + 0.5, 0.5, 6);
        },
      },
      {
        b: "Cut the duty rates that caused it",
        e: "Tobacco and alcohol duty down a third",
        shocks: [
          {
            channel: "approval",
            points: 0.4,
            q: 6,
          },
        ],
        f: () => {
          ["tobaccoDuty", "alcoholDuty"].forEach((id) => {
            const s = G.law.taxes[id];
            if (s) s.rate = Math.round(s.rate * 0.66);
          });
        },
      },
      {
        b: "Accept the losses",
        e: "Crime and evasion both compound",
        fac: {
          rural: -4,
          patriots: -4,
        },
        shocks: [
          {
            channel: "spend",
            points: 0.3,
            q: 8,
          },
          {
            channel: "cri",
            points: 4,
            q: 10,
          },
        ],
      },
    ],
  },
  {
    id: "referendum",
    w: 5,
    stamp: "Cabinet Secretary",
    title: "Pressure for a referendum",
    text: () =>
      countryBlocId(playerCountryId()) === "continental_union"
        ? "A petition on the customs-union settlement has passed two million signatures. The backbenches are restive even though the tariff lever is already surrendered."
        : "A petition on your trade and border settlement has passed two million signatures. The backbenches are restive.",
    cond: () => G.q > 6 && (G.econ.openness > 62 || G.econ.openness < 38),
    opts: [
      {
        b: "Concede a referendum",
        e: "Months of paralysis, whatever the result",
        fac: {
          patriots: 5,
        },
        capital: -8,
        shocks: [
          {
            channel: "uncertainty",
            points: 0.5,
            q: 5,
          },
          {
            channel: "tfp",
            points: -0.05,
            q: 5,
          },
        ],
      },
      {
        b: "Refuse outright",
        e: "Costs capital, settles the question",
        fac: {
          patriots: -7,
          business: 4,
        },
        capital: -4,
      },
      {
        b: "Offer a parliamentary vote instead",
        e: "Splits the difference",
        fac: {
          patriots: -2,
        },
        capital: -2,
      },
    ],
  },
  {
    id: "pandemic",
    w: 3,
    stamp: "COBRA",
    title: "A public health emergency",
    text: "A novel respiratory illness is spreading. The health advice is unambiguous. The economic advice is not.",
    cond: () => G.q > 4,
    opts: [
      {
        b: "Full support package and restrictions",
        e: "Enormous cost, deep short recession",
        shocks: [
          {
            channel: "part",
            points: -5.5,
            q: 4,
          },
          {
            channel: "contact",
            points: 1.8,
            q: 4,
          },
          {
            channel: "uncertainty",
            points: 1.0,
            q: 4,
          },
          {
            channel: "spend",
            points: 6.0,
            q: 4,
          },
          {
            channel: "approval",
            points: 1.5,
            q: 4,
          },
          {
            channel: "hlt",
            points: 2,
            q: 6,
          },
          {
            channel: "contact",
            points: -1.5,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: -0.8,
            q: 6,
          },
        ],
      },
      {
        b: "Targeted restrictions only",
        e: "Nobody is satisfied",
        shocks: [
          {
            channel: "part",
            points: -2.8,
            q: 4,
          },
          {
            channel: "contact",
            points: 1.0,
            q: 4,
          },
          {
            channel: "uncertainty",
            points: 0.5,
            q: 4,
          },
          {
            channel: "spend",
            points: 2.5,
            q: 4,
          },
          {
            channel: "srv",
            points: -4,
            q: 6,
          },
          {
            channel: "hlt",
            points: -1,
            q: 5,
          },
          {
            channel: "contact",
            points: -0.7,
            q: 5,
          },
        ],
      },
      {
        b: "Keep the economy open",
        e: "Output holds, the health system does not",
        fac: {
          workers: -4,
          urban: -4,
          pensioners: -5,
          business: 2,
        },
        shocks: [
          {
            channel: "part",
            points: -1.6,
            q: 5,
          },
          {
            channel: "srv",
            points: -12,
            q: 8,
          },
          {
            channel: "hlt",
            points: -8,
            q: 8,
          },
          {
            channel: "uncertainty",
            points: 0.4,
            q: 5,
          },
        ],
      },
    ],
  },
  {
    id: "demog",
    w: 4,
    stamp: "Work & Pensions",
    title: "The pensions bill is rising",
    text: "The dependency ratio has crossed a threshold. On current rules, pension spending grows faster than the economy every year from here.",
    cond: () => G.econ.dependency > 0.325 || G.q > 12,
    opts: [
      {
        b: "Raise the pension age",
        e: "Saves real money, costs real votes",
        fac: {
          pensioners: -14,
        },
        shocks: [
          {
            channel: "spend",
            points: -0.9,
            q: 40,
          },
          {
            channel: "labour",
            points: 0.25,
            q: 40,
          },
          {
            channel: "migrate",
            points: 0.05,
            q: 20,
          },
        ],
        f: () => {
          G.econ.popOld = Math.max(5, G.econ.popOld * 0.97);
          G.econ.popWork = G.econ.popWork * 1.01;
          G.econ.dependency = G.econ.popOld / G.econ.popWork;
        },
      },
      {
        b: "Means test the universal elements",
        e: "Smaller saving, similar row",
        fac: {
          pensioners: -8,
        },
        shocks: [
          {
            channel: "spend",
            points: -0.5,
            q: 40,
          },
        ],
      },
      {
        b: "Leave it to your successor",
        e: "Nothing changes today",
        shocks: [
          {
            channel: "spend",
            points: 0.35,
            q: 40,
          },
        ],
      },
    ],
  },
  {
    id: "tradeRow",
    w: 8,
    stamp: "Foreign & Commonwealth",
    title: "{P} threatens retaliation",
    text: "{P} has objected to {C}'s tax and tariff settlement, and has published a list of goods it intends to target.",
    news: {
      masthead: "The Trade Gazette",
      headline: "{P} threatens tariffs on {C}",
      lede: (opt: any) =>
        "{P} has published a retaliation list against {C}. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    cond: () =>
      G.law.tariff > 6 ||
      G.law.taxes.digitalTax.rate > 5 ||
      (G.econ.retaliation || 0) > 2.5,
    resolve: () => {
      const dt = G.law.taxes.digitalTax;
      let focus;
      if (dt.on && dt.rate > 5 && requireScriptablePartner("united_states"))
        focus = partnerById("united_states");
      else
        focus = pickEventPartner({
          scriptable: true,
          score: (p: any) =>
            partnerShare(G.homeRole, p) * 30 +
            Math.max(0, 50 - (G.rel[p.id] != null ? G.rel[p.id] : 50)),
        });
      return focus
        ? {
            focus: focus.id,
          }
        : null;
    },
    opts: [
      {
        b: "Concede: cut tariffs to 2%",
        e: "Relations recover, patriots do not",
        fac: {
          patriots: -8,
          business: 5,
        },
        f: () => {
          if (lockedTariff(G.law) == null) G.law.tariff = 2;
          const id = G.eventFocus;
          if (id) G.rel[id] = clamp((G.rel[id] || 50) + 8, 0, 100);
          else
            activePartners().forEach(
              (p) => (G.rel[p.id] = clamp(G.rel[p.id] + 6, 0, 100)),
            );
        },
      },
      {
        b: "Retaliate in kind",
        e: "Tariffs up, trade down",
        fac: {
          patriots: 7,
        },
        shocks: [
          {
            channel: "tot",
            points: 0.4,
            q: 5,
          },
          {
            channel: "worldPartner",
            partner: "_partner",
            points: -1.5,
            q: 5,
          },
          {
            channel: "uncertainty",
            points: 0.2,
            q: 4,
          },
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) {
            G.rel[id] = clamp((G.rel[id] || 50) - 12, 0, 100);
            adjustBilateralTariffs(id, 8, { raisePlayer: true });
          }
        },
      },
      {
        b: "Take it to arbitration",
        e: "Years of process, no resolution",
        capital: -3,
        shocks: [
          {
            channel: "uncertainty",
            points: 0.2,
            q: 6,
          },
        ],
      },
    ],
  },
  {
    id: "scandal",
    w: 4,
    stamp: "Cabinet Secretary",
    title: "Procurement scandal",
    text: "Contracts worth 0.3% of GDP went to firms with donor connections. The audit office publishes on Thursday.",
    cond: () => true,
    opts: [
      {
        b: "Order a public inquiry",
        e: "Keeps it alive for months",
        shocks: [
          {
            channel: "approval",
            points: -0.4,
            q: 6,
          },
        ],
        fac: {
          workers: -2,
          urban: -2,
          patriots: -1,
        },
      },
      {
        b: "Sack the minister immediately",
        e: "Decisive, and it looks like an admission",
        capital: -3,
        fac: {
          workers: -3,
          urban: -2,
          business: -1,
          patriots: -1,
        },
      },
      {
        b: "Defend the process",
        e: "Loyalty is noticed, so is the smell",
        fac: {
          workers: -4,
          urban: -3,
          rural: -2,
          patriots: -3,
          business: -2,
          pensioners: -2,
        },
      },
    ],
  },
  {
    id: "boom",
    w: 4,
    stamp: "Office for Statistics",
    title: "Productivity surprise",
    text: "Revised figures show output per hour has been growing faster than anyone measured.",
    cond: () =>
      !(
        G.episode &&
        (G.episode.id === "aiBoom" || G.episode.id === "greenTransition")
      ),
    opts: [
      {
        b: "Bank the windfall against debt",
        e: "Let higher receipts repair the books",
        fac: {
          business: 3,
        },
        shocks: [
          {
            channel: "tfp",
            points: 2.4,
            q: 1,
          },
        ],
      },
      {
        b: "Spend it on public services",
        e: "Raises health spending",
        fac: {
          workers: 4,
        },
        shocks: [
          {
            channel: "tfp",
            points: 2.4,
            q: 1,
          },
        ],
        f: () => {
          G.law.spend.health = clamp(G.law.spend.health + 0.4, 3, 16);
        },
      },
      {
        b: "Cut the basic rate by a point",
        e: "Popular, and hard to reverse",
        fac: {
          business: 1,
          workers: 2,
          urban: 1,
          rural: 1,
          pensioners: 1,
          patriots: 1,
        },
        shocks: [
          {
            channel: "tfp",
            points: 2.4,
            q: 1,
          },
        ],
        f: () => {
          G.law.income.bands[0].rate = clamp(
            G.law.income.bands[0].rate - 1,
            0,
            90,
          );
        },
      },
    ],
  },
  /* ---- Major world episodes (separate 4–8 year schedule) ---- */ {
    id: "globalRecess",
    major: true,
    w: 8,
    duration: 10,
    stamp: "Foreign & Commonwealth",
    title: "A synchronised world downturn",
    endTitle: "The world downturn eases",
    endStamp: "Foreign & Commonwealth",
    endText:
      "Order books abroad are filling again. The synchronised contraction has passed; what you enacted during it stays on the statute book.",
    text: "Every major market {C} sells into is contracting at once. This is not a bilateral scare — it is a world cycle turning down.",
    cond: () => true,
    opts: [
      {
        b: "Let the automatic stabilisers work",
        e: "No new policy; absorb the hit",
        shocks: [
          {
            channel: "world",
            points: -6.5,
            q: 10,
          },
          {
            channel: "uncertainty",
            points: 1.9,
            q: 8,
          },
        ],
      },
      {
        b: "Bring forward capital projects",
        e: "Raises infrastructure spending",
        shocks: [
          {
            channel: "world",
            points: -6.5,
            q: 10,
          },
          {
            channel: "ucost",
            points: 0.3,
            q: 6,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.7, 0, 8);
        },
      },
      {
        b: "Cut VAT temporarily",
        e: "Cuts the standard rate by four points",
        shocks: [
          {
            channel: "world",
            points: -6.5,
            q: 10,
          },
          {
            channel: "uncertainty",
            points: 1.0,
            q: 6,
          },
        ],
        f: () => {
          G.law.taxes.vat.rate = clamp(G.law.taxes.vat.rate - 4, 0, 30);
        },
      },
    ],
  },
  {
    id: "aiBoom",
    major: true,
    w: 7,
    duration: 14,
    stamp: "Office for Science",
    title: "A global technology wave",
    endTitle: "The technology wave settles",
    endStamp: "Office for Science",
    endText:
      "The extraordinary productivity pulse abroad has normalised. Catch-up and diffusion continue at a quieter pace.",
    text: "Labs and boardrooms across the Pacific tech corridor are shipping tools that raise measured output per hour. Foreign demand and the technology frontier are both moving.",
    cond: () => true,
    opts: [
      {
        b: "Let diffusion do the work",
        e: "Ride the wave without new spending",
        fac: {
          business: 3,
        },
        shocks: [
          {
            channel: "worldTfp",
            points: 0.75,
            q: 14,
          },
          {
            channel: "world",
            points: 1.7,
            q: 10,
          },
        ],
      },
      {
        b: "Match it with research spending",
        e: "Raises the research budget",
        fac: {
          business: 4,
          urban: 2,
        },
        shocks: [
          {
            channel: "worldTfp",
            points: 0.75,
            q: 14,
          },
          {
            channel: "world",
            points: 1.7,
            q: 10,
          },
        ],
        f: () => {
          G.law.spend.research = clamp(G.law.spend.research + 0.35, 0, 4);
        },
      },
      {
        b: "Cut corporation tax a point",
        e: "Business cheers; receipts take a hit",
        fac: {
          business: 6,
          workers: -2,
        },
        shocks: [
          {
            channel: "worldTfp",
            points: 0.65,
            q: 14,
          },
          {
            channel: "world",
            points: 1.7,
            q: 10,
          },
        ],
        f: () => {
          G.law.taxes.corpTax.rate = clamp(G.law.taxes.corpTax.rate - 1, 0, 45);
        },
      },
    ],
  },
  {
    id: "worldInflation",
    major: true,
    w: 7,
    duration: 6,
    stamp: "Central bank",
    title: "Global inflation surge",
    endTitle: "World inflation cools",
    endStamp: "Central bank",
    endText:
      "Import price pressure from abroad has eased. Domestic policy and the Bank still decide what happens next at home.",
    text: "World prices are rising fast. Central banks abroad are tightening, and the import bill is climbing before your own wage round has even started.",
    cond: () => true,
    opts: [
      {
        b: "Look through the first round",
        e: "No new fiscal action",
        shocks: [
          {
            channel: "worldInfl",
            points: 3.2,
            q: 6,
          },
          {
            channel: "worldRate",
            points: 1.9,
            q: 8,
          },
          {
            channel: "world",
            points: -1.8,
            q: 6,
          },
        ],
      },
      {
        b: "Freeze fuel duty",
        e: "A political shield; receipts suffer",
        fac: {
          rural: 4,
          workers: 2,
          business: -1,
        },
        shocks: [
          {
            channel: "worldInfl",
            points: 3.2,
            q: 6,
          },
          {
            channel: "worldRate",
            points: 1.9,
            q: 8,
          },
          {
            channel: "world",
            points: -1.8,
            q: 6,
          },
        ],
        f: () => {
          G.law.taxes.fuel.rate = clamp(G.law.taxes.fuel.rate - 2, 0, 80);
        },
      },
      {
        b: "Tighten the fiscal stance",
        e: "Cuts departmental spending",
        fac: {
          business: 2,
          workers: -4,
          pensioners: -2,
        },
        shocks: [
          {
            channel: "worldInfl",
            points: 3.2,
            q: 6,
          },
          {
            channel: "worldRate",
            points: 1.9,
            q: 8,
          },
          {
            channel: "world",
            points: -1.8,
            q: 6,
          },
        ],
        f: () => {
          G.law.spend.health = clamp(G.law.spend.health - 0.25, 3, 16);
          G.law.spend.education = clamp(G.law.spend.education - 0.15, 2, 10);
        },
      },
    ],
  },
  {
    id: "commodityShock",
    major: true,
    w: 6,
    duration: 5,
    stamp: "Energy & Trade",
    title: "A commodity price spike",
    endTitle: "Commodity prices retreat",
    endStamp: "Energy & Trade",
    endText:
      "Oil and food prices abroad have come off their peaks. The terms-of-trade hit is fading.",
    text: "Oil and staple foods have jumped on world markets. Import costs rise and real incomes are squeezed before any wage catch-up.",
    cond: () => true,
    opts: [
      {
        b: "Absorb it",
        e: "No new policy",
        shocks: [
          {
            channel: "tot",
            points: -1.9,
            q: 6,
          },
          {
            channel: "worldInfl",
            points: 2.4,
            q: 6,
          },
          {
            channel: "world",
            points: -1.5,
            q: 5,
          },
        ],
      },
      {
        b: "Subsidise household energy bills",
        e: "A temporary spending boost",
        fac: {
          workers: 4,
          pensioners: 3,
          business: -2,
        },
        shocks: [
          {
            channel: "tot",
            points: -1.9,
            q: 6,
          },
          {
            channel: "worldInfl",
            points: 2.4,
            q: 6,
          },
          {
            channel: "spend",
            points: 0.6,
            q: 4,
          },
        ],
        f: () => {
          G.law.spend.welfare = clamp(G.law.spend.welfare + 0.4, 8, 22);
        },
      },
      {
        b: "Accelerate domestic energy investment",
        e: "Raises infrastructure and environment spend",
        fac: {
          rural: 2,
          business: 2,
          patriots: 1,
        },
        shocks: [
          {
            channel: "tot",
            points: -1.8,
            q: 6,
          },
          {
            channel: "worldInfl",
            points: 2.4,
            q: 6,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.35, 0, 8);
          G.law.spend.environment = clamp(G.law.spend.environment + 0.2, 0, 5);
        },
      },
    ],
  },
  {
    id: "globalEasing",
    major: true,
    w: 5,
    duration: 5,
    stamp: "Central bank",
    title: "World interest rates cut",
    endTitle: "Foreign rates stabilise",
    endStamp: "Central bank",
    endText:
      "The burst of foreign easing has run its course. Exchange-rate and capital-flow effects from that episode are fading.",
    text: "Major central banks abroad are cutting together. Capital is looking for yield, and the currency will feel it.",
    cond: () => true,
    opts: [
      {
        b: "Let the exchange rate adjust",
        e: "No new fiscal action",
        shocks: [
          {
            channel: "worldRate",
            points: -1.8,
            q: 6,
          },
          {
            channel: "world",
            points: 1.1,
            q: 6,
          },
        ],
      },
      {
        b: "Issue more long gilts while yields are soft",
        e: "Markets notice the supply",
        fac: {
          business: 1,
        },
        shocks: [
          {
            channel: "worldRate",
            points: -1.8,
            q: 6,
          },
          {
            channel: "world",
            points: 1.1,
            q: 6,
          },
          {
            channel: "riskPremium",
            points: 0.15,
          },
        ],
      },
      {
        b: "Bring forward housing and infrastructure",
        e: "Raises capital spending",
        fac: {
          urban: 3,
          rural: 2,
          business: 2,
        },
        shocks: [
          {
            channel: "worldRate",
            points: -1.8,
            q: 6,
          },
          {
            channel: "world",
            points: 1.1,
            q: 6,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.5, 0, 8);
        },
      },
    ],
  },
  {
    id: "tradeWar",
    major: true,
    w: 7,
    duration: 8,
    stamp: "Foreign & Commonwealth",
    title: "A global tariff war",
    endTitle: "The tariff war winds down",
    endStamp: "Foreign & Commonwealth",
    endText:
      "Partner tariff walls raised for this episode have come down. Your own schedule is restored unless you chose to keep the higher wall.",
    text: "Capitals are raising external tariffs in sequence. Retaliation will follow the statute book — this is a barrier war, not a demand fudge.",
    cond: () => true,
    opts: [
      {
        b: "Stay open and absorb the hit",
        e: "Partners raise walls; you do not",
        fac: {
          business: -3,
          rural: -2,
          patriots: -2,
        },
        shocks: [
          {
            channel: "world",
            points: -2.0,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 1.2,
            q: 6,
          },
        ],
        f: () => {
          G._pendingTariffSnap = raiseTradeWarTariffs(8, {
            raisePlayer: false,
          });
        },
      },
      {
        b: "Match the wall, restore later",
        e: "Raise your default tariff; both sides unwind when it ends",
        fac: {
          business: -2,
          rural: 2,
          patriots: 4,
        },
        shocks: [
          {
            channel: "world",
            points: -1.5,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 1.0,
            q: 6,
          },
        ],
        f: () => {
          G._pendingTariffSnap = raiseTradeWarTariffs(8, {
            raisePlayer: true,
          });
        },
      },
      {
        b: "Join and keep the higher wall",
        e: "Partners unwind later; your tariff stays up",
        keepPlayerTariffs: true,
        fac: {
          business: -4,
          rural: 3,
          patriots: 6,
        },
        shocks: [
          {
            channel: "world",
            points: -1.2,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 0.8,
            q: 5,
          },
        ],
        f: () => {
          G._pendingTariffSnap = raiseTradeWarTariffs(10, {
            raisePlayer: true,
          });
        },
      },
    ],
  },
  {
    id: "chinaSlowdown",
    major: true,
    w: 6,
    duration: 8,
    stamp: "Foreign & Commonwealth",
    title: "A deep slowdown in China",
    endTitle: "China's slowdown bottoms out",
    endStamp: "Foreign & Commonwealth",
    endText:
      "Activity in China has stabilised. The bilateral demand shock from that episode has lifted.",
    text: "China's investment cycle has cracked. Factories are cutting orders and the shock will travel through the trade matrix into {C}'s export markets.",
    cond: () => requirePartner("china"),
    resolve: () => ({ focus: "china" }),
    news: {
      masthead: "The World Post",
      headline: "China's investment cycle cracks",
      lede: (opt: any) =>
        "Factories in China are cutting orders. The shock will travel through the trade matrix into {C}. " +
        (opt && opt.b
          ? "{C}'s government chose to " + opt.b.toLowerCase() + "."
          : ""),
    },
    opts: [
      {
        b: "Diversify quietly",
        e: "No legislative change",
        shocks: [
          {
            channel: "worldPartner",
            partner: "china",
            points: -6.5,
            q: 8,
          },
          {
            channel: "world",
            points: -2.2,
            q: 7,
          },
        ],
      },
      {
        b: "Court alternative Asian partners",
        e: "A relations push toward India",
        setRel: {
          india: 8,
        },
        fac: {
          business: 2,
          patriots: 1,
        },
        shocks: [
          {
            channel: "worldPartner",
            partner: "china",
            points: -6.5,
            q: 8,
          },
          {
            channel: "world",
            points: -1.6,
            q: 7,
          },
        ],
      },
      {
        b: "Support exporters with credit",
        e: "A modest spending impulse",
        fac: {
          business: 3,
          rural: 1,
        },
        shocks: [
          {
            channel: "worldPartner",
            partner: "china",
            points: -6.5,
            q: 8,
          },
          {
            channel: "spend",
            points: 0.35,
            q: 5,
          },
          {
            channel: "world",
            points: -1.4,
            q: 6,
          },
        ],
      },
    ],
  },
  makeSlowdownMajor({
    id: "usSlowdown",
    partner: "united_states",
    name: "United States",
    court: ["mexico", "canada"],
  }),
  makeSlowdownMajor({
    id: "indiaSlowdown",
    partner: "india",
    name: "India",
    court: ["indonesia", "vietnam", "korea"],
  }),
  makeBilateralTariffMajor({
    id: "usTariffUp",
    partner: "united_states",
    name: "United States",
    up: true,
  }),
  makeBilateralTariffMajor({
    id: "usTariffDown",
    partner: "united_states",
    name: "United States",
    up: false,
  }),
  makeBilateralTariffMajor({
    id: "chinaTariffUp",
    partner: "china",
    name: "China",
    up: true,
  }),
  makeBilateralTariffMajor({
    id: "chinaTariffDown",
    partner: "china",
    name: "China",
    up: false,
  }),
  {
    id: "creditCrunch",
    major: true,
    w: 6,
    duration: 6,
    stamp: "Treasury",
    title: "A global credit crunch",
    endTitle: "Global credit conditions ease",
    endStamp: "Treasury",
    endText:
      "Risk premia and foreign funding stress from the crunch have subsided. Domestic banks still carry whatever scars you left them with.",
    text: "Wholesale funding markets abroad have seized. The cost of capital is up everywhere, and risk premia are moving before your own bank stress gauge does.",
    cond: () => true,
    opts: [
      {
        b: "Hold fire",
        e: "No new fiscal action",
        shocks: [
          {
            channel: "ucost",
            points: 1.9,
            q: 6,
          },
          {
            channel: "riskPremium",
            points: 1.1,
          },
          {
            channel: "world",
            points: -3.5,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 1.4,
            q: 5,
          },
        ],
      },
      {
        b: "Guarantee bank liabilities",
        e: "Calms markets; puts the taxpayer on the hook",
        fac: {
          business: 3,
          workers: -2,
          patriots: -1,
        },
        shocks: [
          {
            channel: "ucost",
            points: 1.3,
            q: 6,
          },
          {
            channel: "riskPremium",
            points: 0.45,
          },
          {
            channel: "world",
            points: -3.5,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 0.8,
            q: 5,
          },
        ],
        f: () => {
          recapitaliseBank(G.econ, 1.5, 1.2);
        },
      },
      {
        b: "Accelerate public investment",
        e: "Fill private demand with the state",
        fac: {
          workers: 2,
          business: 1,
        },
        shocks: [
          {
            channel: "ucost",
            points: 1.9,
            q: 6,
          },
          {
            channel: "riskPremium",
            points: 0.95,
          },
          {
            channel: "world",
            points: -3.5,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 1.1,
            q: 5,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.55, 0, 8);
        },
      },
    ],
  },
  {
    id: "greenTransition",
    major: true,
    w: 5,
    duration: 14,
    stamp: "Environment",
    title: "A global green investment wave",
    endTitle: "The green investment wave plateaus",
    endStamp: "Environment",
    endText:
      "The burst of global clean-tech capex has levelled off. Productivity and price effects from that wave settle into the trend.",
    text: "Governments and firms abroad are pouring capital into clean power and industrial retrofit. It lifts the technology frontier and reshuffles relative prices.",
    cond: () => true,
    opts: [
      {
        b: "Ride the foreign wave",
        e: "No new domestic push",
        shocks: [
          {
            channel: "worldTfp",
            points: 0.4,
            q: 14,
          },
          {
            channel: "tot",
            points: 0.45,
            q: 8,
          },
          {
            channel: "ucost",
            points: 0.3,
            q: 8,
          },
        ],
      },
      {
        b: "Match it with environment spending",
        e: "Raises the environment budget",
        fac: {
          urban: 3,
          rural: -2,
          business: 1,
        },
        shocks: [
          {
            channel: "worldTfp",
            points: 0.4,
            q: 14,
          },
          {
            channel: "tot",
            points: 0.35,
            q: 8,
          },
        ],
        f: () => {
          G.law.spend.environment = clamp(G.law.spend.environment + 0.4, 0, 5);
        },
      },
      {
        b: "Lean into nuclear and infrastructure",
        e: "Raises energy-related capital spend",
        fac: {
          business: 2,
          patriots: 2,
          rural: 1,
        },
        shocks: [
          {
            channel: "worldTfp",
            points: 0.32,
            q: 14,
          },
          {
            channel: "ucost",
            points: 0.25,
            q: 8,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.4, 0, 8);
        },
      },
    ],
  },
  {
    id: "polityBacklash",
    w: 16,
    stamp: "Home Affairs",
    title: "The streets answer the opening",
    text: "Liberalising the political system has brought crowds into the squares and hardliners into the salons. Urban districts cheer; the patriotic press calls it a surrender of order.",
    cond: () => {
      const age = polityShiftAge();
      return (
        age != null &&
        age >= 2 &&
        age <= 8 &&
        polityShiftIsLiberalising(G.polityShift)
      );
    },
    opts: [
      {
        b: "Protect the reformers",
        e: "Spend capital; urban holds, patriots sour",
        capital: -8,
        fac: {
          urban: 6,
          workers: 2,
          patriots: -8,
        },
      },
      {
        b: "Buy off the hardliners",
        e: "Quiet the barracks; reformers feel sold",
        capital: -6,
        fac: {
          patriots: 6,
          urban: -6,
          business: 2,
        },
      },
      {
        b: "Let the dust settle",
        e: "Neither side is satisfied",
        fac: {
          urban: -3,
          patriots: -3,
          workers: -2,
        },
        shocks: [
          {
            channel: "uncertainty",
            points: 0.2,
            q: 4,
          },
        ],
      },
    ],
  },
  {
    id: "polityConsolidation",
    w: 16,
    stamp: "Cabinet Office",
    title: "The apparatus asks for clarity",
    text: "Tightening the political system has emboldened the loyalists and unsettled the cities. The machine wants either a purge or a carefully managed co-option.",
    cond: () => {
      const age = polityShiftAge();
      return (
        age != null &&
        age >= 2 &&
        age <= 8 &&
        polityShiftIsTightening(G.polityShift)
      );
    },
    opts: [
      {
        b: "Purge the unreliable",
        e: "Patriots cheer; cities and capital take the hit",
        capital: -5,
        fac: {
          patriots: 8,
          urban: -8,
          workers: -3,
          business: -2,
        },
        shocks: [
          {
            channel: "uncertainty",
            points: 0.25,
            q: 4,
          },
        ],
        f: () => {
          if (POLICY_BY_ID.police) G.law.policies.police = true;
        },
      },
      {
        b: "Co-opt the critics",
        e: "Spend capital to keep the peace",
        capital: -10,
        fac: {
          patriots: 3,
          urban: -2,
          business: 3,
        },
      },
      {
        b: "Tighten without a show trial",
        e: "Slow squeeze; little drama",
        fac: {
          patriots: 4,
          urban: -5,
          workers: -2,
        },
      },
    ],
  },
  {
    id: "polityRecognition",
    w: 14,
    stamp: "Foreign & Commonwealth",
    title: "Capitals read the change of system",
    text: "Allied and rival capitals are recalibrating how they treat {C} after the change of political system. Kindred regimes send warm notes; the others sharpen their talking points.",
    cond: () => {
      const age = polityShiftAge();
      return (
        age != null &&
        age >= 2 &&
        age <= 8 &&
        !!G.polityShift &&
        activePartners().length > 0
      );
    },
    opts: [
      {
        b: "Court kindred regimes",
        e: "Warm similar systems; cool the opposites",
        capital: -4,
        fac: {
          patriots: 2,
          business: 1,
        },
        f: () => {
          const to = (G.polityShift && G.polityShift.to) || polityIdOf();
          let n = 0;
          for (const p of activePartners()) {
            const a = polityAffinity(to, profilePolityId(p.id));
            if (a >= 0.35 && n < 3) {
              G.rel[p.id] = clamp((G.rel[p.id] || 50) + 8, 0, 100);
              n++;
            } else if (a <= -0.25) {
              G.rel[p.id] = clamp((G.rel[p.id] || 50) - 5, 0, 100);
            }
          }
        },
      },
      {
        b: "Reassure the democracies",
        e: "Buy goodwill where affinity is thinnest",
        capital: -6,
        fac: {
          urban: 3,
          patriots: -3,
        },
        f: () => {
          const to = (G.polityShift && G.polityShift.to) || polityIdOf();
          let n = 0;
          for (const p of activePartners()) {
            const a = polityAffinity(to, profilePolityId(p.id));
            if (a <= -0.25 && n < 3) {
              G.rel[p.id] = clamp((G.rel[p.id] || 50) + 7, 0, 100);
              n++;
            }
          }
        },
      },
      {
        b: "Ignore the commentary",
        e: "Let affinity do the work unaided",
        fac: {
          business: 1,
          patriots: 1,
        },
      },
    ],
  },
  /* Guaranteed set-pieces at mid and late term (rolled from rollEvent flags). */ {
    id: "setPieceFiscal",
    w: 0,
    stamp: "Treasury",
    title: "The mid-term books look soft",
    text: "Halfway through the term, the permanent secretary puts a note on your desk. Receipts are thin, gilt buyers are twitchy, and a partner is offering a swap line with conditions.",
    cond: () => booksLookSoft(),
    opts: [
      {
        b: "Ask the European Union for a swap line",
        e: "Liquidity now, leverage later",
        setRel: {
          france: 10,
          germany: 8,
        },
        fac: {
          business: 2,
          patriots: -5,
        },
        shocks: [
          {
            channel: "riskPremium",
            points: -0.6,
          },
        ],
        available: () =>
          requireScriptablePartner("france") ||
          requireScriptablePartner("germany"),
      },
      {
        b: "Announce a mid-term consolidation",
        e: "Unprotected departments take a 6% cut",
        fac: {
          business: 4,
          workers: -5,
          urban: -2,
        },
        shocks: [
          {
            channel: "uncertainty",
            points: 0.3,
            q: 4,
          },
        ],
        f: () => {
          const cut = 0.06;
          for (const d of DEPTS) {
            if (d.id === "welfare" || d.id === "health") continue;
            G.law.spend[d.id] = clamp(
              G.law.spend[d.id] * (1 - cut),
              d.min,
              d.max,
            );
          }
        },
      },
      {
        b: "Hold your nerve and do nothing",
        e: "The note is filed; the risk premium is not",
        fac: {
          patriots: 3,
        },
        shocks: [
          {
            channel: "riskPremium",
            points: 0.35,
          },
          {
            channel: "uncertainty",
            points: 0.2,
            q: 4,
          },
        ],
      },
    ],
  },
  {
    id: "setPieceAlly",
    w: 0,
    stamp: "Foreign & Commonwealth",
    title: "{S} ask {C} to sanction {P}",
    text: "Late in the term, {S} want {C} inside a sanctions package against {P} that would hit a cheaper supplier. Standing aside costs you the alliance; joining costs you inputs.",
    cond: () => scriptablePartners().length > 0,
    resolve: () => {
      const focus =
        pickEventPartner({
          filter: (p: any) => (G.rel[p.id] != null ? G.rel[p.id] : 50) < 55,
          score: (p: any) =>
            55 -
            (G.rel[p.id] != null ? G.rel[p.id] : 50) +
            partnerShare(G.homeRole, p) * 20,
        }) || pickEventPartner();
      const sponsors = scriptablePartners()
        .filter(
          (p) =>
            ["france", "germany", "united_states", "australia"].includes(
              p.id,
            ) && p.id !== (focus && focus.id),
        )
        .map((p) => p.id);
      return focus
        ? {
            focus: focus.id,
            sponsors,
          }
        : null;
    },
    opts: [
      {
        b: "Join the allies in full",
        e: "Relations recover with sponsors; inputs get dearer",
        fac: {
          patriots: 4,
          business: -5,
        },
        shocks: [
          {
            channel: "supplyShock",
            points: 0.7,
          },
          {
            channel: "tot",
            points: 0.35,
            q: 6,
          },
          {
            channel: "uncertainty",
            points: 0.15,
            q: 4,
          },
        ],
        f: () => {
          const tid = G.eventFocus;
          if (tid) G.rel[tid] = clamp((G.rel[tid] || 50) - 18, 0, 100);
          (G.eventSponsors || []).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) + 10, 0, 100);
          });
        },
      },
      {
        b: "Offer a symbolic package only",
        e: "Trusted by neither side",
        capital: -4,
        fac: {
          patriots: 1,
          business: -1,
        },
        f: () => {
          (G.eventSponsors || []).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) + 3, 0, 100);
          });
        },
      },
      {
        b: "Refuse and keep the cheaper inputs",
        e: "Supply holds; allies cool",
        fac: {
          business: 4,
          patriots: -6,
        },
        shocks: [
          {
            channel: "ucost",
            points: -0.1,
            q: 4,
          },
        ],
        f: () => {
          (G.eventSponsors || []).forEach((id: any) => {
            G.rel[id] = clamp((G.rel[id] || 50) - 12, 0, 100);
          });
        },
      },
    ],
  },
];
function prepareEvent(ev: any) {
  G.eventFocus = null;
  G.eventSponsors = null;
  if (typeof ev.resolve === "function") {
    const r = ev.resolve();
    if (!r || !r.focus) return null;
    G.eventFocus = r.focus;
    G.eventSponsors = r.sponsors || null;
  }
  const text = typeof ev.text === "function" ? ev.text() : ev.text;
  const title = typeof ev.title === "function" ? ev.title() : ev.title;
  const opts = (ev.opts || []).filter(
    (o: any) => !o.available || o.available(),
  );
  if (!opts.length) return null;
  return Object.assign({}, ev, {
    title,
    text,
    opts,
  });
}
/* Mid-term Treasury note: milder than the gilt-auction crisis (debt > 105 or
   deficit > 6). Anchored on the seat's own opening debt, so a high-debt
   steady state (Japan) is not automatically "soft". */ function booksLookSoft() {
  if (!G || !G.econ || !G.law) return false;
  const e = G.econ;
  const bal = balanceOf(G.law, e).balance;
  const anchor = e.debtAnchor != null ? e.debtAnchor : OPENING.debt;
  return (
    bal <= -5 ||
    e.debt >= anchor + 6 ||
    (e.riskPremium || 0) >= 0.3 ||
    e.yield >= (e.rate || 0) + 1.4
  );
}
function fiscalSetPieceWindow() {
  if (!G) return false;
  const elapsed = termElapsed();
  const mid = Math.round(termLenOf(G.homeRole) / 2);
  return elapsed >= mid && elapsed < mid + 4;
}
function rollEvent() {
  /* Tutorial owns the despatch lane — leave summit visits, suppress ordinary
       events and set-pieces until the coach finishes or is skipped. */
  if (G && G.coach && !G.coachDone) return null;
  const shiftAge = polityShiftAge();
  if (shiftAge != null && shiftAge > 12) G.polityShift = null;
  /* Mid-term fiscal set-piece: halfway through the current term, and only
     when the books are actually soft. */ if (
    !G.setPiece8 &&
    fiscalSetPieceWindow()
  ) {
    const fiscal = EVENTS.find((e) => e.id === "setPieceFiscal");
    if (fiscal && fiscal.cond()) {
      const p = prepareEvent(fiscal);
      if (p) {
        G.setPiece8 = true;
        return p;
      }
    }
  }
  if (G.q === 16 && !G.setPiece16) {
    G.setPiece16 = true;
    const ally = EVENTS.find((e) => e.id === "setPieceAlly");
    if (ally) {
      const p = prepareEvent(ally);
      if (p) return p;
    }
  }
  if (G.q - G.lastEventQ < 4) return null; // at least four clear quarters
  if (Math.random() > 0.2) return null; // and only occasionally even then
  /* Majors ride a separate 4–8 year track via rollMajorEvent. */ const pool =
    EVENTS.filter(
      (e) =>
        !e.major &&
        e.cond() &&
        e.id !== G.lastEventId &&
        e.id !== "setPieceFiscal" &&
        e.id !== "setPieceAlly",
    );
  if (!pool.length) return null;
  const total = pool.reduce((a, e) => a + e.w, 0);
  let r = G.sandbox ? 0 : Math.random() * total;
  for (const e of pool) {
    r -= e.w;
    if (r <= 0) {
      const prepared = prepareEvent(e);
      if (prepared) return prepared;
      break;
    }
  }
  for (const e of pool) {
    const prepared = prepareEvent(e);
    if (prepared) return prepared;
  }
  return null;
}
function writeBriefing(res: any) {
  const e = G.econ,
    b = [],
    E = res.E;
  if (res.growth < -0.5)
    b.push(
      "The economy contracted this quarter. Expect the word recession in tomorrow's papers.",
    );
  else if (res.growth > res.pg + 1.2)
    b.push(
      "Output is running well ahead of what the economy can sustainably produce.",
    );
  else if (res.growth > 0.4)
    b.push("Modest growth, broadly in line with trend.");
  else b.push("Growth has stalled. Nothing dramatic, just nothing happening.");
  if (e.inflation > 8)
    b.push(
      "Inflation at " +
        e.inflation.toFixed(1) +
        "% is out of control, and wage demands are following it up.",
    );
  else if (e.inflation > 4)
    b.push(
      "Inflation is " +
        e.inflation.toFixed(1) +
        "%, and the Bank has taken rates to " +
        e.rate.toFixed(2) +
        "%.",
    );
  else if (e.inflation < 0.5)
    b.push(
      "Prices are barely moving. The Bank is more worried about deflation than you are.",
    );
  if (e.yield > 7)
    b.push(
      "Gilt yields hit " +
        e.yield.toFixed(1) +
        "%. The market is pricing in the possibility that you cannot pay.",
    );
  else if (e.debt > 130)
    b.push(
      "Debt is " +
        e.debt.toFixed(0) +
        "% of GDP, and interest alone costs " +
        res.sp.interest.toFixed(1) +
        "% of national income.",
    );
  if (E.blackLevel > 34)
    b.push(
      "Roughly " +
        E.blackLevel.toFixed(0) +
        "% of the trade in what you regulate now happens outside the law, and outside the tax base.",
    );
  if (e.services < 35)
    b.push(
      "Waiting lists and class sizes are the front page most mornings now.",
    );
  if (e.unemployment > 8)
    b.push(
      "Unemployment at " +
        e.unemployment.toFixed(1) +
        "% is the number your backbenchers quote at you.",
    );
  /* Crisis runway — foreshadow terminal outcomes one or two quarters ahead. */ if (
    e.yield > 8.5 &&
    e.debt > 110
  )
    b.unshift(
      "The gilt market looks fragile. Another scare and the door may close.",
    );
  if (e.inflation > 16)
    b.unshift(
      "Inflation above sixteen percent is a political emergency in waiting.",
    );
  const meta = polityOf(G.homeRole);
  const metric = coupMetric(G.fac, meta);
  if (G.lowRun >= 2 || metric < meta.coupFloor + 2) {
    if (meta.coupOn === "patriots") {
      b.unshift(
        "The apparatus is restless. " +
          meta.coupQuarters +
          " quarters below " +
          meta.coupFloor +
          " among the patriots and you are removed.",
      );
    } else {
      b.unshift(
        "Letters are going in. Four quarters below twenty percent and your own side will remove you.",
      );
    }
  }
  if (e.bankStress)
    b.unshift(
      "The banking system is under stress. Credit is scarce and a fiscal recap may be forced.",
    );
  const worst = FACTIONS.slice().sort((a, b2) => G.fac[a.id] - G.fac[b2.id])[0];
  if (G.fac[worst.id] < 30)
    b.push(
      worst.name +
        " have effectively abandoned you, and they are " +
        Math.round(worst.w * 100) +
        "% of the electorate.",
    );
  if (G.capital < 12)
    b.push(
      "You have almost no political capital left. Ambitious legislation is off the table until that recovers.",
    );
  const left = electionQuartersLeft();
  if (left <= 4 && left > 0) {
    const therm = electionThermometer();
    const noun = reviewNoun(meta);
    b.push(
      therm <= meta.loseAt
        ? noun.charAt(0).toUpperCase() +
            noun.slice(1) +
            " in " +
            left +
            " quarters. On today's numbers you would lose."
        : noun.charAt(0).toUpperCase() +
            noun.slice(1) +
            " in " +
            left +
            " quarters. The running score is still just about enough.",
    );
  }
  G.brief = b.slice(0, 3).map(T);
}
/* Permanent Secretary prose for what a bill or Cabinet choice does over four
   quarters against holding still. Same model as the sandbox impact chips. */ const BRIEF_IMPACT_MIN = 0.05;
const BRIEF_ECON_PIN = ["growth", "inflation", "balance"];
const BRIEF_ECON_ORDER = [
  "growth",
  "inflation",
  "balance",
  "debt",
  "unemployment",
  "yield",
  "services",
  "fx",
  "trend",
  "potential",
];
const BRIEF_ECON_MAX = 4;
function pickBriefingEconomicRows(head: any) {
  const all = IMPACT_ROWS.filter((r) => r.k !== "approval")
    .map((r) => ({
      r,
      v: head[r.k] || 0,
    }))
    .filter((x) => Math.abs(x.v) >= BRIEF_IMPACT_MIN);
  const picked: any[] = [],
    seen = new Set();
  BRIEF_ECON_PIN.forEach((k) => {
    const x = all.find((row) => row.r.k === k);
    if (x) {
      picked.push(x);
      seen.add(k);
    }
  });
  all
    .filter((x) => !seen.has(x.r.k))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .forEach((x) => {
      if (picked.length >= BRIEF_ECON_MAX) return;
      picked.push(x);
      seen.add(x.r.k);
    });
  const rank = (k: any) => {
    const i = BRIEF_ECON_ORDER.indexOf(k);
    return i === -1 ? 99 : i;
  };
  return picked.sort((a, b) => rank(a.r.k) - rank(b.r.k));
}
function pickBriefingApprovalRow(head: any) {
  const v = head.approval || 0;
  if (Math.abs(v) < BRIEF_IMPACT_MIN) return null;
  const r = IMPACT_ROWS.find((row) => row.k === "approval");
  return r
    ? {
        r,
        v,
      }
    : null;
}
function briefingImpactClause(row: any, v: any) {
  const n = Math.abs(v).toFixed(row.dp);
  const up = v > 0;
  switch (row.k) {
    case "growth":
      return up
        ? "growth about " + n + " points stronger"
        : "growth about " + n + " points weaker";
    case "trend":
      return up
        ? "the trend rate about " + n + " points higher"
        : "the trend rate about " + n + " points lower";
    case "potential":
      return up
        ? "capacity about " + n + " points higher"
        : "capacity about " + n + " points lower";
    case "balance":
      return up
        ? "the deficit about " + n + " points of GDP narrower"
        : "the deficit about " + n + " points of GDP wider";
    case "debt":
      return up
        ? "debt about " + n + " points of GDP higher"
        : "debt about " + n + " points of GDP lower";
    case "inflation":
      return up
        ? "inflation about " + n + " points higher"
        : "inflation about " + n + " points lower";
    case "unemployment":
      return up
        ? "unemployment about " + n + " points higher"
        : "unemployment about " + n + " points lower";
    case "yield":
      return up
        ? "gilts about " + n + " points dearer"
        : "gilts about " + n + " points easier";
    case "approval":
      return up
        ? "about " + n + " points gained in the polls"
        : "about " + n + " points off in the polls";
    case "services":
      return up
        ? "public services about " + n + " points stronger"
        : "public services about " + n + " points weaker";
    case "fx":
      return up
        ? "the pound about " + n + " points firmer"
        : "the pound about " + n + " points softer";
    default:
      return (
        (up ? "higher " : "lower ") +
        row.name.toLowerCase() +
        " by about " +
        n +
        " points"
      );
  }
}
function joinBriefingClauses(clauses: any) {
  if (!clauses.length) return "";
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return clauses[0] + " and " + clauses[1];
  return clauses[0] + ", " + clauses[1] + ", and " + clauses[2];
}
function briefingFactionLine(facs: any) {
  const warm = facs
    .filter((e: any) => e[1] > 0)
    .slice(0, 2)
    .map((e: any) => factionName(e[0]));
  const cool = facs
    .filter((e: any) => e[1] < 0)
    .slice(0, 2)
    .map((e: any) => factionName(e[0]));
  if (warm.length && cool.length) {
    if (warm.length === 1 && cool.length === 1) {
      return warm[0] + " will take this better than " + cool[0] + ".";
    }
    return (
      "Politically, " +
      warm.join(" and ") +
      " are with you; " +
      cool.join(" and ") +
      " are not."
    );
  }
  if (warm.length) {
    return (
      warm.join(" and ") +
      (warm.length === 1 ? " should be on side." : " should both be on side.")
    );
  }
  if (cool.length) {
    return "Expect pushback from " + cool.join(" and ") + ".";
  }
  return "";
}
function briefingImpactParts(im: any, meta: any) {
  if (!im || !im.head) return null;
  const kind = (meta && meta.kind) || "bill";
  const econRows = pickBriefingEconomicRows(im.head);
  const approvalRow = pickBriefingApprovalRow(im.head);
  const facs = (Object.entries(im.fac || {}) as [string, number][])
    .filter((e) => Math.abs(e[1]) > 0.3)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const politics = briefingFactionLine(facs);
  if (!econRows.length && !approvalRow && !politics) {
    if (kind === "bill" && meta && meta.clauses && meta.clauses.length) {
      return {
        kind,
        quiet:
          "This barely moves the dial on a year-ahead view. Nothing the markets or the whips will lose sleep over.",
        economic: null,
        approval: null,
        politics: null,
      };
    }
    if (kind === "decision") {
      return {
        kind,
        quiet: "This barely moves the dial on a year-ahead view.",
        economic: null,
        approval: null,
        politics: null,
      };
    }
    return null;
  }
  const tail =
    kind === "decision"
      ? ", over the next year, compared with doing nothing."
      : ", over the next year, compared with standing still.";
  let economic = null;
  if (econRows.length) {
    const body = joinBriefingClauses(
      econRows.map((x) => briefingImpactClause(x.r, x.v)),
    );
    economic = body.charAt(0).toUpperCase() + body.slice(1) + tail;
  }
  let approval = null;
  if (approvalRow) {
    const clause = briefingImpactClause(approvalRow.r, approvalRow.v);
    approval = clause.charAt(0).toUpperCase() + clause.slice(1) + tail;
  }
  const out = {
    kind,
    economic: economic ? T(economic) : null,
    approval: approval ? T(approval) : null,
    politics: politics ? T(politics) : null,
    quiet: null,
  };
  return out.economic || out.approval || out.politics ? out : null;
}
function briefingImpactLines(im: any, meta: any) {
  const p = briefingImpactParts(im, meta);
  if (!p) return [];
  const lines = [];
  if (p.quiet) lines.push(p.quiet);
  else {
    if (p.economic) lines.push(p.economic);
    if (p.approval) lines.push(p.approval);
  }
  if (p.politics) lines.push(p.politics);
  return lines;
}
function mergeBriefingImpact(brief: any, impactLines: any) {
  if (!impactLines || !impactLines.length) return brief || [];
  return impactLines.concat(brief || []).slice(0, 4);
}
/** Data form of the morning briefing for React consumers (see BriefingBody.tsx). */
function briefingData(brief: any, opts?: any) {
  const o = opts || {};
  const impact = o.impact != null ? o.impact : G && G.briefImpact;
  const hasImpact =
    impact &&
    (impact.quiet || impact.economic || impact.approval || impact.politics);
  return {
    impact: hasImpact
      ? {
          quiet: impact.quiet || null,
          economic: impact.economic || null,
          approval: impact.approval || null,
          politics: impact.politics || null,
        }
      : null,
    lines: (brief || []).slice(),
    footer: o.footer || null,
    hint: o.hint || null,
  };
}
/** After a multiplayer quarter resolves, show pending event (if any) then morning note.
 *  Pass `{ skipAnnounce: true }` when remounting the same quarter (e.g. after a
 *  summit choice) so the flash does not run again. */
/**
 * Patch mid-quarter inbound asks onto the live seat without a full remount
 * (full hydrate would wipe an in-progress draft). Returns a pendingKey string
 * when something actionable arrived, else null.
 */
function mergeMpInboundAsksFromSnapshot(snap: any, seatId: any) {
  if (!G || !G.mp || !snap || !seatId) return null;
  if (!G.politics) G.politics = {};
  if (!snap.politics || !snap.politics[seatId]) return null;
  if (!G.politics[seatId]) {
    G.politics[seatId] = defaultMpPolitics(seatId, worldRoleForSeat(seatId));
  }
  const local = normalizeDiploPolitics(G.politics[seatId]);
  const remote = normalizeDiploPolitics(clone(snap.politics[seatId]));
  local.inboundUltimatums = clone(remote.inboundUltimatums || {});
  local.inboundBlocInvite = remote.inboundBlocInvite
    ? clone(remote.inboundBlocInvite)
    : null;
  local.inboundDealProposal = remote.inboundDealProposal
    ? clone(remote.inboundDealProposal)
    : null;
  local.inboundSummitCommercial = remote.inboundSummitCommercial
    ? clone(remote.inboundSummitCommercial)
    : null;
  local.inboundNotice = remote.inboundNotice
    ? clone(remote.inboundNotice)
    : null;
  if (remote.pendingEvent) local.pendingEvent = clone(remote.pendingEvent);
  else if (local.pendingEvent && !remote.pendingEvent)
    local.pendingEvent = null;
  if (Array.isArray(remote.diploAlerts)) {
    local.diploAlerts = mergeDiploAlertsNoted(
      local.diploAlerts,
      remote.diploAlerts,
    );
  }
  /* Keep the mounted bag in sync when this is our seat. */
  const selfId = playerCountryId(G.homeRole);
  if (selfId === seatId) {
    G.diploAlerts = local.diploAlerts || [];
    /* Drop local outbound the server already cleared (peer answered). Do not
         invent new outbound from remote — that would wipe mid-draft staging. */
    if (G.ultimatums && typeof G.ultimatums === "object") {
      const remoteUlt = remote.ultimatums || {};
      for (const pid of Object.keys(G.ultimatums)) {
        const localU = G.ultimatums[pid];
        const remoteU = remoteUlt[pid];
        if (
          localU &&
          localU.status === "pending" &&
          !(remoteU && remoteU.status === "pending")
        ) {
          delete G.ultimatums[pid];
        }
      }
      local.ultimatums = clone(G.ultimatums);
    }
  }
  const inboundMap = local.inboundUltimatums;
  const inboundKey = inboundMap
    ? Object.keys(inboundMap)
        .filter((id) => inboundMap[id] && inboundMap[id].status === "pending")
        .sort()
        .map((id) => id + ":" + (inboundMap[id].demand || ""))
        .join("|")
    : "";
  const blocInv = local.inboundBlocInvite;
  const blocKey =
    blocInv && blocInv.status === "pending"
      ? "bloc:" + (blocInv.fromId || "") + ":" + (blocInv.blocId || "")
      : "";
  const dealProp = local.inboundDealProposal;
  const dealKey =
    dealProp && dealProp.status === "pending"
      ? "deal:" + (dealProp.fromId || "") + ":" + (dealProp.dealId || "")
      : "";
  const summitComm = local.inboundSummitCommercial;
  const summitKey =
    summitComm && summitComm.status === "pending"
      ? "summit:" +
        (summitComm.fromId || "") +
        ":" +
        (summitComm.ourDelta != null
          ? summitComm.ourDelta
          : summitComm.delta || "") +
        ":" +
        (summitComm.theirDelta != null
          ? summitComm.theirDelta
          : summitComm.delta || "") +
        ":" +
        inboundSummitDealKey(summitComm)
      : "";
  const notice = local.inboundNotice;
  const noticeKey =
    notice && notice.status === "pending"
      ? "notice:" +
        inboundNoticeActs(notice)
          .map((a: any) => (a.fromId || "") + ":" + (a.kind || ""))
          .join("|")
      : "";
  const pending = local.pendingEvent;
  if (pending) return JSON.stringify(pending);
  if (inboundKey) return "inbound:" + inboundKey;
  if (blocKey) return blocKey;
  if (
    dealKey &&
    summitKey &&
    dealProp &&
    summitComm &&
    dealProp.fromId === summitComm.fromId
  ) {
    return "summit-agenda:" + dealKey + ":" + summitKey;
  }
  if (dealKey) return dealKey;
  if (summitKey) return summitKey;
  if (noticeKey) return noticeKey;
  /* Outcome alerts (accept / join / treaty) are press or next morning note —
     never a mid-quarter pendingKey, or showMpBriefing replays the briefing. */
  return null;
}

/**
 * Push newspaper clips for unnoted press-only diplo outcomes (bloc / treaty)
 * without opening the morning note. Used mid-quarter when a peer answers.
 */
function flushMpDiploPressAlerts() {
  if (!G || !G.mp) return false;
  const seatId = playerCountryId(G.homeRole);
  const pol = G.politics && G.politics[seatId];
  const alertSrc =
    pol && pol.diploAlerts && pol.diploAlerts.length
      ? pol.diploAlerts
      : G.diploAlerts;
  const fresh = diploOutcomeAlertsForBrief(alertSrc, G.q).filter(
    (a: any) => a && (DIPLO_PRESS_ONLY_KINDS as any)[a.kind],
  );
  if (!fresh.length) return false;
  markDiploAlertsNoted(fresh);
  const pressBefore = G.press ? G.press.length : 0;
  const clips = composePress({
    ultimatumOutcomes: fresh,
    q: G.q != null ? G.q : 0,
  });
  if (clips.length) {
    pushPress(clips);
    for (let i = G.press.length - 1; i >= pressBefore; i--) {
      if (G.press[i].kind === "ultimatum") {
        expandPress(G.press[i].id);
        break;
      }
    }
  }
  if (pol && alertSrc === pol.diploAlerts) {
    pol.diploAlerts = alertSrc;
    G.diploAlerts = alertSrc;
  }
  return true;
}

function showMpBriefing(opts?: any) {
  if (!G || !G.mp) return false;
  const skipAnnounce = !!(opts && opts.skipAnnounce);
  const afterFlash = () => {
    if (!G || !G.mp) return;
    const seatId = playerCountryId(G.homeRole);
    const pol = G.politics && G.politics[seatId];
    if (pol && pol.pendingEvent) {
      showMpPendingEvent({ skipAnnounce: true });
      return;
    }
    const inbound = firstPendingInbound(pol);
    if (inbound) {
      showMpInboundUltimatum(inbound.fromId, inbound.ult);
      return;
    }
    const blocInv = pendingInboundBlocInvite(pol);
    if (blocInv) {
      showMpInboundBlocInvite(blocInv);
      return;
    }
    const dealProp = pendingInboundDealProposal(pol);
    const summitComm = pendingInboundSummitCommercial(pol);
    if (
      summitComm &&
      dealProp &&
      dealProp.fromId &&
      summitComm.fromId === dealProp.fromId
    ) {
      showMpInboundSummitCommercial(summitComm);
      return;
    }
    if (dealProp) {
      showMpInboundDealProposal(dealProp);
      return;
    }
    if (summitComm) {
      showMpInboundSummitCommercial(summitComm);
      return;
    }
    const notice = pendingInboundNotice(pol);
    if (notice) {
      showMpInboundNotice(notice);
      return;
    }
    const res = pol && pol.lastRes;
    if (!res || res.E == null) return;
    writeBriefing(res);
    /* Prefer seat politics alerts (MP) then top-level G.diploAlerts. */
    const alertSrc =
      pol && pol.diploAlerts && pol.diploAlerts.length
        ? pol.diploAlerts
        : G.diploAlerts;
    const freshUlt = diploOutcomeAlertsForBrief(alertSrc, G.q);
    for (const a of freshUlt) {
      const p = partnerById(a.partnerId);
      const name = theCountry(p ? p.name : a.partnerId);
      const demand = theCountry(a.label || a.demand || "your demand");
      let line;
      if (a.kind === "ult_concede") {
        line = name + " conceded to our ultimatum — " + demand + ".";
      } else if (a.kind === "ult_defy") {
        line = name + " defied our ultimatum — " + demand + ".";
      } else if (a.kind === "ult_inbound_concede") {
        line = "We conceded to " + name + "'s ultimatum — " + demand + ".";
      } else if (a.kind === "ult_inbound_defy") {
        line = "We defied " + name + "'s ultimatum — " + demand + ".";
      } else if (a.kind === "bloc_invite_accept") {
        line = name + " accepts the invitation to " + demand + ".";
      } else if (a.kind === "bloc_invite_decline") {
        line = name + " declines the invitation to " + demand + ".";
      } else if (a.kind === "bloc_inbound_accept") {
        line = "We accepted " + name + "'s invitation to " + demand + ".";
      } else if (a.kind === "bloc_inbound_decline") {
        line = "We declined " + name + "'s invitation to " + demand + ".";
      } else if (a.kind === "bloc_self_joined") {
        line = "{C} is now a full member of " + demand + ".";
      } else if (a.kind === "bloc_member_joined") {
        line = name + " is now a full member of " + demand + ".";
      } else if (a.kind === "bloc_self_left") {
        line = "{C} has left " + demand + ".";
      } else if (a.kind === "bloc_member_left") {
        line = name + " has left " + demand + ". {C} remains a member.";
      } else if (a.kind === "deal_propose_accept") {
        line = name + " accepts the treaty — " + demand + ".";
      } else if (a.kind === "deal_propose_decline") {
        line = name + " declines the treaty — " + demand + ".";
      } else if (a.kind === "deal_inbound_accept") {
        line = "We accepted " + name + "'s treaty — " + demand + ".";
      } else if (a.kind === "deal_inbound_decline") {
        line = "We declined " + name + "'s treaty — " + demand + ".";
      } else {
        continue;
      }
      /* Press-only kinds (bloc / treaty) stay off the morning note. */
      if (!(DIPLO_PRESS_ONLY_KINDS as any)[a.kind]) {
        G.brief = [T(line)].concat(G.brief || []).slice(0, 5);
      }
    }
    markDiploAlertsNoted(freshUlt);
    const lastBill = pol && pol.lastBill;
    const pressBefore = G.press ? G.press.length : 0;
    const clips = composePress({
      clauses: (lastBill && lastBill.clauses) || [],
      passage: lastBill && lastBill.passage,
      cost: (lastBill && lastBill.cost) || 0,
      balDelta: lastBill && lastBill.balDelta,
      ultimatumOutcomes: freshUlt,
      q:
        lastBill && lastBill.q != null
          ? lastBill.q
          : Math.max(0, (G.q || 1) - 1),
      brief: G.brief,
      res,
      econ: G.econ,
    });
    if (clips.length) {
      pushPress(clips);
      for (let i = G.press.length - 1; i >= pressBefore; i--) {
        if (G.press[i].kind === "ultimatum") {
          expandPress(G.press[i].id);
          break;
        }
      }
    }
    if (pol) pol.lastBill = null;
    if (freshUlt.length && pol && alertSrc === pol.diploAlerts) {
      pol.diploAlerts = alertSrc;
      G.diploAlerts = alertSrc;
    }
    if (!G.brief || !G.brief.length) return;
    despatch(
      "Morning note",
      morningNoteStamp(),
      { kind: "briefing", data: briefingData(G.brief) },
      [
        {
          b: "Continue",
          e: "Back to the statute book",
          f: () => render(),
        },
      ],
    );
  };
  if (skipAnnounce) afterFlash();
  else Promise.resolve(announceQuarterAdvance()).then(afterFlash);
  return true;
}

/** Present an inbound human ultimatum; choice goes through G.mp.onEventChoice. */
function showMpInboundUltimatum(fromId: any, ult: any) {
  if (!G || !G.mp || !fromId || !ult) return false;
  const choose = (payload: any) => {
    if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
    else render();
  };
  const p = partnerById(fromId);
  const name = theCountry(p ? p.name : fromId);
  const demand = ult.label || ult.demand || "a diplomatic concession";
  const body =
    "<p>" +
    T(
      name +
        " has issued an ultimatum against {C}: <b>" +
        esc(demand) +
        "</b>. Concede and their demand takes effect; defy and they may retaliate. Silence past the deadline counts as defiance.",
    ) +
    "</p>";
  despatch(T("Ultimatum from " + name), "Foreign Office", body, [
    {
      b: "Concede",
      e: "Accept their demand",
      f: () => choose({ inboundUltimatum: true, fromId, concede: true }),
    },
    {
      b: "Defy",
      e: "Refuse — risk retaliation",
      f: () => choose({ inboundUltimatum: true, fromId, concede: false }),
    },
  ]);
  return true;
}

/** Present an inbound bloc invitation; choice goes through G.mp.onEventChoice. */
function showMpInboundBlocInvite(inv: any) {
  if (!G || !G.mp || !inv) return false;
  const choose = (payload: any) => {
    if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
    else render();
  };
  const fromId = inv.fromId;
  const p = partnerById(fromId);
  const name = theCountry(p ? p.name : fromId);
  const bloc =
    blocById(inv.blocId) || (G.customBlocs && G.customBlocs[inv.blocId]);
  const blocName = theCountry(bloc ? bloc.name : inv.blocId);
  const body =
    "<p>" +
    T(
      name +
        " has invited {C} to join <b>" +
        esc(blocName) +
        "</b>. Accept and accession begins — alignment and the final treaty still require legislation. Decline and the door stays open. Silence past the deadline counts as a polite decline.",
    ) +
    "</p>";
  despatch(T("Invitation to " + blocName), "Foreign & Commonwealth", body, [
    {
      b: "Accept",
      e: "Accession begins",
      f: () => choose({ inboundBlocInvite: true, accept: true }),
    },
    {
      b: "Decline politely",
      e: "Door stays open",
      f: () => choose({ inboundBlocInvite: true, accept: false }),
    },
  ]);
  return true;
}

/** Present an inbound trade-deal proposal; choice goes through G.mp.onEventChoice. */
function showMpInboundDealProposal(prop: any) {
  if (!G || !G.mp || !prop) return false;
  const choose = (payload: any) => {
    if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
    else render();
  };
  const fromId = prop.fromId;
  const p = partnerById(fromId);
  const name = theCountry(p ? p.name : fromId);
  const dealName = prop.label || prop.dealId || "a treaty";
  const terms =
    Array.isArray(prop.terms) && prop.terms.length
      ? "<ul>" +
        prop.terms.map((t: any) => "<li>" + esc(t) + "</li>").join("") +
        "</ul>"
      : "";
  const body =
    "<p>" +
    T(
      name +
        " proposes to ratify <b>" +
        esc(dealName) +
        "</b> with {C}. Accept and the treaty takes effect on their statute book; you may ratify a reciprocal deal of your own later. Decline and the offer lapses. Silence past the deadline counts as a decline.",
    ) +
    "</p>" +
    terms;
  despatch(T("Treaty proposal from " + name), "Board of Trade", body, [
    {
      b: "Accept",
      e: "They may ratify",
      f: () => choose({ inboundDealProposal: true, accept: true }),
    },
    {
      b: "Decline",
      e: "Offer lapses",
      f: () => choose({ inboundDealProposal: true, accept: false }),
    },
  ]);
  return true;
}

function showMpInboundSummitCommercial(prop: any) {
  if (!G || !G.mp || !prop) return false;
  const choose = (payload: any) => {
    if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
    else render();
  };
  const fromId = prop.fromId;
  const p = partnerById(fromId);
  const name = theCountry(p ? p.name : fromId);
  const theirDelta =
    prop.theirDelta != null
      ? +prop.theirDelta
      : prop.delta != null
        ? +prop.delta
        : 0;
  const ourDelta = prop.ourDelta != null ? +prop.ourDelta : theirDelta;
  const hasTariff = ourDelta > 0 || theirDelta > 0;
  const seatId = playerCountryId(G.homeRole);
  const pol = G.politics && G.politics[seatId];
  const paired = pendingInboundDealProposal(pol);
  const extra =
    paired && paired.fromId === fromId && paired.status === "pending"
      ? paired
      : null;
  const deals = inboundSummitDeals(prop, extra);
  const title = deals.length
    ? hasTariff
      ? T("Summit agenda from " + name)
      : T("Summit treaty proposal from " + name)
    : T("Summit tariff offer from " + name);
  const acceptE = deals.length
    ? hasTariff
      ? "Cuts and treaties take effect"
      : "They may ratify"
    : "Reciprocal cut takes effect";
  despatch(
    title,
    "Board of Trade",
    {
      kind: "commercial",
      data: inboundSummitAgendaDespatchData(prop, name, deals),
    },
    [
      {
        b: "Accept",
        e: acceptE,
        f: () => choose({ inboundSummitCommercial: true, accept: true }),
      },
      {
        b: "Decline",
        e: "Offer lapses",
        f: () => choose({ inboundSummitCommercial: true, accept: false }),
      },
    ],
  );
  return true;
}

/** Present a unilateral hostile notice (tariff hike / sanctions); Noted clears it. */
function showMpInboundNotice(notice: any) {
  if (!G || !G.mp || !notice) return false;
  const choose = (payload: any) => {
    if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
    else render();
  };
  const acts = inboundNoticeActs(notice);
  const nameOf = (id: any) => {
    const p = partnerById(id);
    return theCountry(p ? p.name : id);
  };
  const paraFor = (act: any) => {
    const name = nameOf(act.fromId);
    return act.kind === "tariff_inbound_hike"
      ? "<p>" +
          T(
            name +
              " has lifted duties on {C}'s goods" +
              (act.label ? " — " + esc(act.label) : "") +
              ". The change is already on their statute book. Exporters will feel it this quarter.",
          ) +
          "</p>"
      : "<p>" +
          T(
            name +
              " has imposed restrictive measures on {C}. Trade and finance with that seat will get dearer.",
          ) +
          "</p>";
  };
  const one = acts.length === 1 ? acts[0] : null;
  const title = one
    ? one.kind === "tariff_inbound_hike"
      ? T(nameOf(one.fromId) + " raises tariffs on {C}")
      : T(nameOf(one.fromId) + " sanctions {C}")
    : T("Measures against {C}");
  const body = acts.map(paraFor).join("");
  despatch(title, "Foreign & Commonwealth", body, [
    {
      b: "Noted",
      e: "Back to the statute book",
      f: () => choose({ inboundNotice: true }),
    },
  ]);
  return true;
}
/** Present a lockstep-rolled event; choice is applied via G.mp.onEventChoice. */
function showMpPendingEvent(opts: any) {
  if (!G || !G.mp) return false;
  const seatId = playerCountryId(G.homeRole);
  const pol = G.politics && G.politics[seatId];
  const pending = pol && pol.pendingEvent;
  if (!pending) return false;
  const present = () => {
    if (!G || !G.mp) return false;
    const polNow = G.politics && G.politics[seatId];
    const pend = polNow && polNow.pendingEvent;
    if (!pend) return false;
    const choose = (payload: any) => {
      if (typeof G.mp.onEventChoice === "function") G.mp.onEventChoice(payload);
      else render();
    };
    if (pend.episodeEnd) {
      const ep = G.episode || polNow.episode;
      despatch(
        T((ep && ep.endTitle) || "The episode ends"),
        (ep && ep.endStamp) || "Cabinet Office",
        "<p>" +
          T(
            (ep && ep.endText) ||
              "The pressures that defined this episode have eased.",
          ) +
          "</p>",
        [
          {
            b: "Noted",
            e: "The episode closes",
            f: () =>
              choose({
                episodeEnd: true,
              }),
          },
        ],
      );
      return true;
    }
    if (pend.missionEvent) {
      const ev = rollMissionEvent(
        pend.missionId || "summit",
        pend.partnerId,
        G,
        diploDeps(),
        true,
        pend.eventIndex != null ? pend.eventIndex : 0,
      );
      if (!ev || !ev.opts || !ev.opts.length) {
        choose({ dismiss: true });
        return false;
      }
      const pName = partnerById(pend.partnerId)?.name || pend.partnerId;
      const rivalName = ev.rivalName || "a rival";
      const commercial = ev.id === "summit_commercial_agenda";
      const title = T(formatMissionTokens(ev.title || "", pName, rivalName));
      const ctx = {
        partnerId: pend.partnerId,
        rivalId: ev.rivalId,
        rivalName: ev.rivalName,
      };
      const otherOpts = commercial
        ? (ev.opts || []).filter(
            (o: any) => o.summitKind !== "tariff" && o.summitKind !== "deal",
          )
        : ev.opts;
      const optsWithHints = (otherOpts || []).map((o: any, i: number) =>
        formatSummitCommercialOpt(o, ctx, pName, rivalName, commercial, () =>
          choose({
            optionIndex: commercial ? ev.opts.indexOf(o) : i,
          }),
        ),
      );
      if (
        !commercial &&
        !optsWithHints.some((o: any) => o.hint || o.disabled)
      ) {
        choose({ dismiss: true });
        return false;
      }
      if (commercial) {
        despatch(
          title,
          morningNoteStamp(),
          {
            kind: "commercial",
            data: commercialAgendaDespatchData(
              pend.partnerId,
              pName,
              formatMissionEventText(ev, G, diploDeps()),
              (ourDelta: number, theirDelta: number, dealIds: string[]) =>
                choose({
                  commercialPackage: true,
                  ourDelta,
                  theirDelta,
                  dealIds: dealIds || [],
                }),
            ),
          },
          optsWithHints,
        );
        return true;
      }
      const body =
        "<p>" +
        formatMissionEventText(ev, G, diploDeps()) +
        "</p>" +
        '<p class="hint">' +
        "Each choice shifts relations and factions. Expected impacts are listed under every option." +
        "</p>";
      despatch(title, morningNoteStamp(), body, optsWithHints);
      return true;
    }
    const base = EVENTS.find((e) => e.id === pend.id);
    const ev = base ? prepareEvent(base) : null;
    if (!ev || !ev.opts || !ev.opts.length) {
      choose({
        dismiss: true,
      });
      return false;
    }
    presentEventAsPress(ev, (_o: any, i: any) =>
      choose({
        optionIndex: i,
      }),
    );
    return true;
  };
  if (opts && opts.skipAnnounce) {
    present();
    return true;
  }
  Promise.resolve(announceQuarterAdvance()).then(present);
  return true;
}
/* ---- Press clippings: a persistent news inbox, hidden until opened ----
   Templates only — no LLM. G.press is display state; keep it out of
   MUTABLE / simulate(). */ const PRESS_MAX = 20;
let _pressSeq = 0;
function partnerName(id: any) {
  const p = PARTNERS.find((x) => x.id === id);
  return p ? p.name : id;
}
function factionName(id: FactionId) {
  const f = FACTIONS.find((x) => x.id === id);
  return f ? f.name : id;
}
function ultimatumPressImpactText(impacts: any) {
  if (!impacts) return "";
  const bits = [];
  if (impacts.diplomatic)
    bits.push("Diplomatically, " + lcFirst(impacts.diplomatic));
  if (impacts.economic) bits.push("Economically, " + lcFirst(impacts.economic));
  return bits.length ? " " + bits.join(" ") + "." : "";
}

function lcFirst(str: any) {
  if (!str) return "";
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function billClauseHeadline(label: any) {
  const s = String(label || "");
  const m = s.match(/^(.+),\s*([\d.]+)%\s+to\s+([\d.]+)%$/);
  if (m) {
    const name = m[1];
    const from = parseFloat(m[2]);
    const to = parseFloat(m[3]);
    if (to > from) return name + " rises to " + to + " percent";
    if (to < from) return name + " cut to " + to + " percent";
    return name + " held at " + to + " percent";
  }
  return s;
}
function stripEventHtml(s: any) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function eventPressCopy(event: any, option: any) {
  const news = event && event.news;
  let masthead = "The World Post";
  let headline = event && event.title;
  let lede = "";
  if (news) {
    masthead =
      typeof news.masthead === "function"
        ? news.masthead()
        : news.masthead || masthead;
    headline =
      typeof news.headline === "function"
        ? news.headline()
        : news.headline || headline;
    if (typeof news.lede === "function") lede = news.lede(option) || "";
    else if (news.lede) lede = news.lede;
  }
  if (!headline) headline = (option && option.b) || "A decision in {C}";
  if (!lede) {
    const text = stripEventHtml(event && event.text).slice(0, 180);
    const choice =
      option && option.b ? "{C}'s government chose to " + option.b + "." : "";
    lede = [text, choice].filter(Boolean).join(" ");
  }
  return {
    masthead: T(masthead),
    headline: T(headline),
    lede: T(lede),
  };
}
function macroPressClips(input: any, date: any) {
  const e = (input && input.econ) || (G && G.econ);
  const res = input && input.res;
  if (!e) return [];
  const out: any[] = [];
  const growth = res && res.growth;
  if (growth != null && growth < -0.5) {
    out.push({
      pri: 10,
      masthead: "The Fiscal Gazette",
      headline: "{C} slips into contraction",
      lede: "Output contracted this quarter. Markets are already using the word recession.",
    });
  }
  if (e.inflation > 8) {
    out.push({
      pri: 9,
      masthead: "The Fiscal Gazette",
      headline: "Prices run away as the Bank tightens",
      lede:
        "Inflation printed at " +
        e.inflation.toFixed(1) +
        " percent. Wage demands are following it up.",
    });
  } else if (e.inflation > 4) {
    out.push({
      pri: 6,
      masthead: "The Fiscal Gazette",
      headline: "Prices climb as the Bank tightens",
      lede:
        "Inflation is " +
        e.inflation.toFixed(1) +
        " percent, and the policy rate has moved to " +
        (e.rate != null ? e.rate.toFixed(2) : "—") +
        " percent.",
    });
  }
  if (e.unemployment > 8) {
    out.push({
      pri: 8,
      masthead: "The Fiscal Gazette",
      headline: "Jobless rate becomes the political number",
      lede:
        "Unemployment at " +
        e.unemployment.toFixed(1) +
        " percent is the figure the backbenches quote.",
    });
  }
  if (e.yield > 7) {
    out.push({
      pri: 8,
      masthead: "The Fiscal Gazette",
      headline: "Bond market baulks at {C}'s books",
      lede:
        "Yields hit " +
        e.yield.toFixed(1) +
        " percent. Investors are pricing in the chance that the Treasury cannot pay.",
    });
  } else if (e.debt > 130) {
    out.push({
      pri: 5,
      masthead: "The Fiscal Gazette",
      headline: "Debt burden weighs on {C}",
      lede:
        "Public debt sits near " +
        e.debt.toFixed(0) +
        " percent of GDP, and the interest bill is climbing.",
    });
  }
  if (e.services < 35) {
    out.push({
      pri: 7,
      masthead: "The Fiscal Gazette",
      headline: "Waiting lists dominate the front pages",
      lede: "Public services have deteriorated far enough that the queues are now a daily political fact.",
    });
  }
  out.sort((a, b) => b.pri - a.pri);
  return out.slice(0, 2).map((c) => ({
    kind: "macro",
    masthead: T(c.masthead),
    headline: T(c.headline),
    lede: T(c.lede),
    kicker: date,
  }));
}
function clauseLooksExecutive(c: any) {
  if (c && c.executive) return true;
  const s = String((c && c.label) || "");
  return (
    /^State visit/i.test(s) ||
    /^Post envoy /i.test(s) ||
    /^Recall envoy from /i.test(s)
  );
}

function pressPassageFromVote(vote: any): "chamber" | "advisory" | "executive" {
  if (!vote || !vote.needed) return "executive";
  if (vote.advisory) return "advisory";
  return "chamber";
}

function pressPassageFromClauses(clauses: any[]) {
  const powers = parliamentPowersOf(G && G.law);
  if (powers === "suppressed") return "executive";
  if (!(clauses || []).some((c) => !clauseLooksExecutive(c)))
    return "executive";
  if (powers === "consultative") return "advisory";
  return "chamber";
}

/** How a single-clause bill reached the statute book — chamber vote,
 *  advisory consultation, or executive act. Avoids UK-only "red box"
 *  copy on seats that never take a vote. */
function billPassageLede(clauses: any[], passage?: string) {
  const kind = passage || pressPassageFromClauses(clauses);
  if (kind === "executive")
    return "The government enacted the measure this quarter.";
  if (kind === "advisory")
    return "The government enacted the measure this quarter. The chamber's vote was advisory.";
  return "The measure passed the chamber this quarter.";
}
function composePress(input: any) {
  const clauses = ((input && input.clauses) || []).filter((c: any) => {
    /* Leave is announced via bloc_self_left / bloc_member_left, not the fiscal bill strip. */
    return !(c && c.label && /^Leave /.test(c.label));
  });
  const balDelta = input && input.balDelta;
  const qIdx =
    input && input.q != null ? input.q : Math.max(0, (G && G.q ? G.q : 1) - 1);
  const date = G ? qLabel(G, qIdx) : "Q" + (qIdx + 1);
  const clips = [];
  if (clauses.length) {
    const byCost = clauses.slice().sort((a: any, b: any) => b.pc - a.pc);
    let headline, lede;
    if (clauses.length === 1) {
      headline = billClauseHeadline(clauses[0].label);
      lede = billPassageLede(clauses, input && input.passage);
    } else {
      headline = billClauseHeadline(byCost[0].label);
      lede =
        "Also in the package: " +
        byCost
          .slice(1, 3)
          .map((c: any) => billClauseHeadline(c.label))
          .join("; ") +
        ".";
    }
    if (typeof balDelta === "number" && Math.abs(balDelta) >= 0.05) {
      lede +=
        balDelta > 0
          ? " The books tighten by about " +
            Math.abs(balDelta).toFixed(1) +
            " points of GDP on delivery."
          : " The deficit widens by about " +
            Math.abs(balDelta).toFixed(1) +
            " points of GDP on delivery.";
    }
    clips.push({
      kind: "bill",
      masthead: "The Fiscal Gazette",
      headline: T(headline),
      lede: T(lede),
      kicker: date,
    });
  }
  const ultOutcomes = (input && input.ultimatumOutcomes) || [];
  for (const u of ultOutcomes) {
    const name = theCountry(partnerName(u.partnerId));
    const demand = theCountry(u.label || u.demand || "your demand");
    const impact = ultimatumPressImpactText(u.impacts);
    if (u.kind === "ult_concede") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: T(name + " backs down"),
        lede: T(
          name +
            " has conceded to {C}'s ultimatum — " +
            demand +
            ". Foreign Office sources describe the climbdown as unconditional." +
            impact,
        ),
        kicker: date,
      });
    } else if (u.kind === "ult_defy") {
      clips.push({
        kind: "ultimatum",
        masthead: "The World Post",
        headline: T(name + " defies {C}"),
        lede: T(
          name +
            " has rejected {C}'s ultimatum — " +
            demand +
            ". Ministers are returning to the diplomatic drawing board." +
            impact,
        ),
        kicker: date,
      });
    } else if (u.kind === "ult_inbound_concede") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: T("{C} concedes"),
        lede: T(
          "{C} has conceded to " +
            name +
            "'s ultimatum — " +
            demand +
            "." +
            impact,
        ),
        kicker: date,
      });
    } else if (u.kind === "ult_inbound_defy") {
      clips.push({
        kind: "ultimatum",
        masthead: "The World Post",
        headline: T("{C} stands firm"),
        lede: T(
          "{C} has defied " + name + "'s ultimatum — " + demand + "." + impact,
        ),
        kicker: date,
      });
    } else if (
      u.kind === "bloc_invite_accept" ||
      u.kind === "bloc_inbound_accept"
    ) {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(
          u.kind === "bloc_invite_accept"
            ? name + " accepts {C}'s invitation to " + demand
            : "{C} accepts " + name + "'s invitation to " + demand,
        ),
        lede: T(
          u.kind === "bloc_invite_accept"
            ? name + " accepts the invitation to " + demand + "."
            : "{C} accepts " + name + "'s invitation to " + demand + ".",
        ),
        kicker: date,
      });
    } else if (
      u.kind === "bloc_invite_decline" ||
      u.kind === "bloc_inbound_decline"
    ) {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(
          u.kind === "bloc_invite_decline"
            ? name + " declines {C}'s invitation to " + demand
            : "{C} declines " + name + "'s invitation to " + demand,
        ),
        lede: T(
          u.kind === "bloc_invite_decline"
            ? name + " declines the invitation to " + demand + "."
            : "{C} declines " + name + "'s invitation to " + demand + ".",
        ),
        kicker: date,
      });
    } else if (u.kind === "bloc_self_joined") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T("{C} joins " + demand),
        lede: T(
          "{C} is now a full member of " +
            demand +
            ". Internal tariffs and market access take effect under the bloc's rules.",
        ),
        kicker: date,
      });
    } else if (u.kind === "bloc_member_joined") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(name + " joins " + demand),
        lede: T(
          name +
            " is now a full member of " +
            demand +
            ". The accession pipeline is complete.",
        ),
        kicker: date,
      });
    } else if (u.kind === "bloc_self_left") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T("{C} leaves " + demand),
        lede: T(
          "{C} has left " +
            demand +
            ". Preferential access and any common external tariff no longer apply.",
        ),
        kicker: date,
      });
    } else if (u.kind === "bloc_member_left") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(name + " leaves " + demand),
        lede: T(name + " has left " + demand + ". {C} remains a member."),
        kicker: date,
      });
    } else if (
      u.kind === "deal_propose_accept" ||
      u.kind === "deal_inbound_accept"
    ) {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(
          u.kind === "deal_propose_accept"
            ? name + " accepts {C}'s treaty"
            : "{C} accepts " + name + "'s treaty",
        ),
        lede: T(
          u.kind === "deal_propose_accept"
            ? name + " accepts the treaty — " + demand + "."
            : "{C} accepts " + name + "'s treaty — " + demand + ".",
        ),
        kicker: date,
      });
    } else if (
      u.kind === "deal_propose_decline" ||
      u.kind === "deal_inbound_decline"
    ) {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(
          u.kind === "deal_propose_decline"
            ? name + " declines {C}'s treaty"
            : "{C} declines " + name + "'s treaty",
        ),
        lede: T(
          u.kind === "deal_propose_decline"
            ? name + " declines the treaty — " + demand + "."
            : "{C} declines " + name + "'s treaty — " + demand + ".",
        ),
        kicker: date,
      });
    } else if (u.kind === "deal_collapse") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T("{C}'s treaty with " + name + " collapses"),
        lede: T(
          (demand ? demand : "A treaty") +
            " with " +
            name +
            " has collapsed under diplomatic strain. Preferential access is gone.",
        ),
        kicker: date,
      });
    } else if (u.kind === "tariff_hike") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T("{C} raises duties on " + name),
        lede: T(
          "{C} has lifted tariffs on " +
            name +
            (demand ? " — " + demand : "") +
            ". Exporters in " +
            name +
            " will feel it first.",
        ),
        kicker: date,
      });
    } else if (u.kind === "tariff_cut") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T("{C} opens its schedule to " + name),
        lede: T(
          "{C} has cut tariffs on " +
            name +
            (demand ? " — " + demand : "") +
            ". The barrier is coming down.",
        ),
        kicker: date,
      });
    } else if (u.kind === "tariff_inbound_hike") {
      clips.push({
        kind: "ultimatum",
        masthead: "The World Post",
        headline: T(name + " slaps tariffs on {C}"),
        lede: T(
          name +
            " has raised duties on {C}'s goods" +
            (demand ? " — " + demand : "") +
            ". Exporters are already counting the cost.",
        ),
        kicker: date,
      });
    } else if (u.kind === "tariff_inbound_cut") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Trade Gazette",
        headline: T(name + " cuts duties on {C}'s goods"),
        lede: T(
          name +
            " has lowered tariffs facing {C}" +
            (demand ? " — " + demand : "") +
            ".",
        ),
        kicker: date,
      });
    } else if (u.kind === "sanctions_outbound") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: T("{C} tightens the screws on " + name),
        lede: T(
          "{C} has imposed restrictive measures on " +
            name +
            ". Trade and finance with that seat will get dearer.",
        ),
        kicker: date,
      });
    } else if (u.kind === "sanctions_inbound") {
      clips.push({
        kind: "ultimatum",
        masthead: "The World Post",
        headline: T(name + " sanctions {C}"),
        lede: T(
          name +
            " has placed restrictive measures on {C}. The Foreign Office called it a hostile act.",
        ),
        kicker: date,
      });
    } else if (u.kind === "protest_outbound") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: T("{C} delivers a formal protest to " + name),
        lede: T(
          "A démarche has been lodged in " +
            name +
            ". Relations take a knock; the note is now on the record.",
        ),
        kicker: date,
      });
    } else if (u.kind === "protest_inbound") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: T(name + " protests to {C}"),
        lede: T(
          name +
            " has delivered a formal protest. The démarche is public, and the relationship is cooler tonight.",
        ),
        kicker: date,
      });
    }
  }
  for (const m of macroPressClips(input, date)) clips.push(m);
  return clips;
}
let _pressExpanded: string | null = null;
let _newsOpen = false;
/** Closes the news inbox and any focused clip within it — shared by every
 *  call site that needs the drawer and the inbox to never be open at once
 *  (resetPressUi, enact()'s quarter advance, setTab() opening a drawer). */
function closeNewsInbox() {
  if (pressChoicePending()) return;
  _newsOpen = false;
  _pressExpanded = null;
}
function resetPressUi() {
  closeNewsInbox();
}
function pushPress(clips: any) {
  if (!G) return;
  if (!G.press) G.press = [];
  const list = Array.isArray(clips) ? clips : [clips];
  list.forEach((raw) => {
    if (!raw) return;
    const id = "p" + ++_pressSeq;
    const clip: Record<string, any> = {
      id,
      q: G.q,
      kind: raw.kind || "bill",
      masthead: raw.masthead || "",
      headline: raw.headline || "",
      lede: raw.lede || "",
      kicker: raw.kicker || "",
      rot: Math.random() * 10 - 5,
      seen: false,
    };
    if (raw.eventId) clip.eventId = raw.eventId;
    if (raw.pendingChoice) {
      clip.pendingChoice = true;
      clip.opts = raw.opts || null;
    }
    G.press.push(clip);
  });
  while (G.press.length > PRESS_MAX) {
    const dropAt = G.press.findIndex((c: any) => !c.pendingChoice);
    if (dropAt < 0) break;
    const dropped = G.press.splice(dropAt, 1)[0];
    if (dropped && _pressExpanded === dropped.id) _pressExpanded = null;
  }
  bump();
}
/* Marks a clip read and focused, and — since callers only reach for this
   when something needs to surface right now (an ultimatum outcome, say) —
   opens the inbox too, so an important clip still auto-pops the way it
   always has even though ordinary clips now wait to be opened. */
function expandPress(id: any) {
  if (!G || !G.press) return false;
  const clip = G.press.find((c: any) => c.id === id);
  if (!clip) return false;
  clip.seen = true;
  _pressExpanded = id;
  _newsOpen = true;
  /* Same reason toggleNewsOpen() clears tab: the focused-clip overlay sits
     below the drawer's z-index, so an auto-popped clip would otherwise
     render invisibly behind an open drawer instead of over it. */
  tab = null;
  bump();
  return true;
}
function pressChoicePending() {
  return !!(G && G.press && G.press.some((c: any) => c.pendingChoice));
}
/** Immediate chips (and sandbox 4-quarter forecast) for an event's options. */
function eventChoiceOpts(ev: any, onPick: any) {
  const preview = !!G.sandbox;
  let base = null;
  if (preview) {
    try {
      base = simulate(G.law, 4);
    } catch {
      base = null;
    }
  }
  return (ev.opts || []).map((o: any, i: number) => {
    const inspected = inspectEventOption(o, preview ? base : null);
    return {
      b: o.b,
      e: o.e,
      immediate:
        inspected.chips && inspected.chips.length ? inspected.chips : null,
      chips:
        preview && inspected.forecast
          ? impactChipsData(inspected.forecast)
          : null,
      factions:
        preview && inspected.forecast
          ? impactFactionsData(inspected.forecast)
          : null,
      f: () => onPick(o, i),
    };
  });
}
/** Settle the clip whose button was pressed — by id, not "the first pending
 *  one", which answers the wrong story when two clips are awaiting a choice. */
function resolvePressEventChoice(clipId: any, ev: any, option: any) {
  if (!G || !G.press) return;
  const clip = G.press.find((c: any) => c.id === clipId);
  if (!clip) return;
  const after = eventPressCopy(ev, option);
  clip.headline = after.headline;
  clip.lede = after.lede;
  clip.masthead = after.masthead;
  clip.pendingChoice = false;
  clip.opts = null;
  clip.seen = true;
  if (_pressExpanded === clip.id) _pressExpanded = null;
  bump();
}
/** Cabinet events land as a newspaper clipping you must answer — not a HUD
 *  despatch and then a second clip of the same story. */
function presentEventAsPress(ev: any, onPick: any) {
  if (!ev || !G) return false;
  const copy = eventPressCopy(ev, null);
  /* A lockstep remount keeps the inbox, so the same unanswered event can be
     presented twice. Refresh that clip in place: a second clip for one story
     would leave one of them pending for ever, and pressChoicePending() holds
     Deliver shut until every clip is answered. */
  let clip = ev.id
    ? G.press &&
      G.press.find((c: any) => c.pendingChoice && c.eventId === ev.id)
    : null;
  if (!clip) {
    pushPress({
      kind: "event",
      eventId: ev.id || null,
      masthead: copy.masthead,
      headline: copy.headline,
      lede: copy.lede,
      kicker: qLabel(G, G.q),
      pendingChoice: true,
    });
    clip = G.press[G.press.length - 1];
    if (!clip) return false;
  }
  const clipId = clip.id;
  clip.opts = eventChoiceOpts(ev, (o: any, i: number) => {
    resolvePressEventChoice(clipId, ev, o);
    onPick(o, i);
  });
  expandPress(clipId);
  return true;
}
function getPressExpanded() {
  return _pressExpanded;
}
/* Closes the focused reading view without deleting the clip — a persistent
   inbox should let you back out to the list, unlike the old ephemeral
   clippings where "dismiss" and "close" were the same action. */
function closeFocusedPress() {
  if (!_pressExpanded) return false;
  const clip =
    G && G.press && G.press.find((c: any) => c.id === _pressExpanded);
  if (clip && clip.pendingChoice) return true;
  _pressExpanded = null;
  bump();
  return true;
}
/** Remove a clip from the inbox. Display-only — does not touch diplo alerts. */
function discardPress(id: any) {
  if (!G || !G.press || !id) return false;
  const i = G.press.findIndex((c: any) => c.id === id);
  if (i < 0) return false;
  if (G.press[i].pendingChoice) return false;
  G.press.splice(i, 1);
  if (_pressExpanded === id) _pressExpanded = null;
  bump();
  return true;
}
function getNewsOpen() {
  return _newsOpen;
}
function toggleNewsOpen() {
  if (_newsOpen) {
    if (pressChoicePending()) return _newsOpen;
    /* Closing via the rail button (not the in-focus back/close control)
       should always return to the list next time, not resume whatever
       clip was last open. */
    closeNewsInbox();
  } else {
    _newsOpen = true;
    /* Opening the inbox closes whatever drawer is open — they'd otherwise
       dock to the same side and fight for space. */
    tab = null;
  }
  bump();
  return _newsOpen;
}
function newsUnreadCount() {
  if (!G || !G.press) return 0;
  return G.press.filter((c: any) => !c.seen).length;
}
/* Escape-key dismiss: only acts while the inbox is actually open, so it
   never silently touches anything the player can't see. Closes the
   focused clip first (back to the list), then the inbox itself. */
function dismissNewestPress() {
  if (!_newsOpen) return false;
  if (_pressExpanded) return closeFocusedPress();
  _newsOpen = false;
  bump();
  return true;
}
function checkCrises(_res: any) {
  const e = G.econ;
  if (e.yield > 10 && e.debt > 118)
    return gameOver(
      "F",
      "The market closed the door",
      "{C} could not roll over its debt at any price you were willing to pay. An emergency programme was agreed with the international lender of last resort, and its conditions were not written in this building.",
    );
  if (e.inflation > 22)
    return gameOver(
      "F",
      "Prices ran away",
      "Inflation above twenty percent stopped being an economic statistic and became a political one. Savings evaporated, indexation spread, and the government fell before you could unwind any of it.",
    );
  const meta = polityOf(G.homeRole);
  const metric = coupMetric(G.fac, meta);
  G.lowRun = metric < meta.coupFloor ? G.lowRun + 1 : 0;
  if (G.lowRun >= meta.coupQuarters) {
    if (meta.coupOn === "patriots") {
      return gameOver(
        "E",
        "The apparatus removed you",
        meta.coupQuarters +
          " straight quarters below " +
          meta.coupFloor +
          " among the patriots. The security elite closed ranks, and you were offered a quiet exit.",
      );
    }
    return gameOver(
      "E",
      "Your own side removed you",
      "Four straight quarters below twenty percent. The letters went in, the meeting was short, and you were offered a peerage on the way out.",
    );
  }
}
/** The same 8-factor composite gameOver()'s verdict grades on, exposed live
 *  so the Overview drawer can show "how well you're doing" continuously
 *  rather than only once, at the very end of a game that (outside sandbox)
 *  most runs never reach. Pure read of the current econ/faction state. */
function governmentScoreData() {
  const e = G.econ;
  const s = clamp((e.gdp / e.potential - 1) * 10 + 3, 0, 6);
  const factors = [
    { label: "Output vs potential", value: s },
    {
      label: "Inflation",
      value: clamp(6 - Math.abs(e.inflation - 2) * 1.2, 0, 6),
    },
    {
      label: "Unemployment",
      value: clamp(6 - (e.unemployment - 4) * 1.1, 0, 6),
    },
    { label: "Debt", value: clamp(6 - (e.debt - 90) * 0.06, 0, 6) },
    { label: "Public services", value: clamp((e.services - 35) * 0.15, 0, 6) },
    { label: "Approval", value: clamp((approvalOf(G.fac) - 25) * 0.14, 0, 6) },
    { label: "Civil liberty", value: clamp((e.liberty - 30) * 0.09, 0, 6) },
    { label: "Inequality", value: clamp(6 - (e.gini - 28) * 0.22, 0, 6) },
  ];
  const total = factors.reduce((a, f) => a + f.value, 0);
  const pct = total / 48;
  const letter =
    pct > 0.8
      ? "A"
      : pct > 0.66
        ? "B"
        : pct > 0.5
          ? "C"
          : pct > 0.34
            ? "D"
            : "E";
  return { pct, letter, factors };
}
function grade() {
  return governmentScoreData().letter;
}
function gameOver(g: any, title: any, text: any) {
  /* Sandbox keeps you in office. The crisis still happened and the briefing
     still says so; you simply are not removed for it. */ if (G.sandbox) {
    G.brief = [
      title +
        ". In another government this would have ended you, but you are still here.",
      text,
    ]
      .concat(G.brief)
      .slice(0, 3);
    G.lowRun = 0;
    G.econ.riskPremium = Math.min(G.econ.riskPremium, 0.4);
    return;
  }
  G.over = true;
  const e = G.econ;
  const rows: [string, string][] = [
    ["Quarters served", String(G.q)],
    ["Terms", String(G.term)],
    ["Output vs potential", fmt((e.gdp / e.potential - 1) * 100, 1) + "%"],
    ["Inflation", e.inflation.toFixed(1) + "%"],
    ["Unemployment", e.unemployment.toFixed(1) + "%"],
    ["Debt", e.debt.toFixed(0) + "% of GDP"],
    ["Public services", e.services.toFixed(0) + " / 100"],
    ["Civil liberty", e.liberty.toFixed(0) + " / 100"],
    ["Inequality", e.gini.toFixed(1) + " Gini"],
    ["Final approval", approvalOf(G.fac).toFixed(0) + "%"],
  ];
  despatch(
    title,
    "Verdict",
    { kind: "verdict", data: { grade: g, lede: [text], rows } },
    [
      {
        b: "Form a new government",
        e: "Start again from the beginning",
        f: () => requestSetup(),
      },
    ],
  );
  render();
}
function election() {
  return termReview();
}
function termReview() {
  if (G.over) return;
  const e = G.econ;
  const meta = polityOf(G.homeRole);
  const score = termReviewScore();
  const stamp = reviewStamp(meta);
  const parties = ensureParties(G);
  const beforeSeats = parties ? { ...parties.seats } : null;

  if (meta.kind === "congress") {
    if (score <= meta.loseAt && !G.sandbox) {
      return gameOver(
        grade(),
        "You lost the congress",
        "The party had a view and expressed it. Your successor inherits debt at " +
          e.debt.toFixed(0) +
          "% of GDP, inflation at " +
          e.inflation.toFixed(1) +
          "% and a dossier you had better hope was polite.",
      );
    }
    const held = score <= meta.loseAt;
    if (parties) {
      const pop = { ...parties.popularity };
      const id = parties.rulingId;
      pop[id] = clamp((pop[id] || 0.5) + (held ? -0.04 : 0.03), 0.05, 0.95);
      parties.popularity = driftPopularity(pop, pop, 1);
    }
    G.term++;
    G.termStartQ = G.q;
    G.setPiece8 = false;
    G.setPiece16 = false;
    G.capital = clamp(G.capital + 22, 0, 100);
    const title = held
      ? "Confirmed on a technicality"
      : "Confirmed by the congress";
    const lede = held
      ? "On these numbers the apparatus would have moved you. Sandbox mode is on, so you are confirmed anyway, with a majority you have not earned."
      : "The congress confirms you. The red box, the debt and the demographic arithmetic remain yours.";
    despatch(
      title,
      stamp,
      {
        kind: "verdict",
        data: {
          lede: [
            lede,
            "A fresh mandate is worth real political capital. Spend it on something that outlasts you.",
          ],
        },
      },
      [
        {
          b: "Continue",
          e: "Term " + G.term + " begins",
          f: () => render(),
        },
      ],
    );
    return;
  }

  const result = projectElection(G);
  if (result) applyElectionResult(G, result);
  const rulingId = parties && parties.rulingId;
  const lostPlurality =
    !!result && !!rulingId && !rulingIsFirst(result.seats, rulingId);

  if (lostPlurality && !G.sandbox) {
    if (meta.kind === "managed") {
      return gameOver(
        grade(),
        "You lost the ballot",
        "Even a managed contest can go wrong. Your successor inherits debt at " +
          e.debt.toFixed(0) +
          "% of GDP, inflation at " +
          e.inflation.toFixed(1) +
          "% and a note in the desk drawer you had better hope was polite.",
      );
    }
    return gameOver(
      grade(),
      "You lost the election",
      "The country had a view and expressed it. Your successor inherits debt at " +
        e.debt.toFixed(0) +
        "% of GDP, inflation at " +
        e.inflation.toFixed(1) +
        "% and a note in the desk drawer you had better hope was polite.",
    );
  }

  G.term++;
  G.termStartQ = G.q;
  G.setPiece8 = false;
  G.setPiece16 = false;
  G.capital = clamp(G.capital + 22, 0, 100);
  const held = lostPlurality;
  const mine = result && rulingId ? result.seats[rulingId as PartyId] || 0 : 0;
  let title, lede;
  if (meta.kind === "managed") {
    title = held ? "Returned on a technicality" : "Returned to office";
    lede = held
      ? "On these numbers the managed ballot would have thrown you out. Sandbox mode is on, so you are returned anyway."
      : "The managed ballot returns you with " +
        mine +
        " seats. You keep the red box, the debt and the demographic arithmetic.";
  } else {
    title = held ? "Returned on a technicality" : "Returned to office";
    lede = held
      ? "On these numbers the country would have thrown you out. Sandbox mode is on, so you are returned anyway, with a majority you have not earned."
      : "The government is returned with " +
        mine +
        " seats. You keep the red box, the debt and the demographic arithmetic.";
  }
  const roster = labelledParties(G.homeRole);
  const seatLines = roster
    .map((p) => {
      const now = result ? result.seats[p.id] || 0 : 0;
      const was = beforeSeats ? beforeSeats[p.id] || 0 : now;
      const d = now - was;
      const mark = rulingId === p.id ? " (you)" : "";
      return now > 0
        ? p.short +
            mark +
            ": " +
            now +
            " seats" +
            (d ? " (" + (d > 0 ? "+" : "") + d + ")" : "")
        : null;
    })
    .filter(Boolean);
  despatch(
    title,
    stamp,
    {
      kind: "verdict",
      data: {
        lede: [
          lede,
          seatLines.join(" · "),
          "A fresh mandate is worth real political capital. Spend it on something that outlasts you.",
        ],
      },
    },
    [
      {
        b: "Continue",
        e: "Term " + G.term + " begins",
        f: () => render(),
      },
    ],
  );
}
/* ==================================================================
   9. FLOW
   ================================================================== */ /* ---------- sandbox impact analysis ---------- */ const IMP_NAMES =
  {
    gini: "inequality",
    srv: "public services",
    lib: "liberty",
    cri: "crime",
    hlt: "public health",
    env: "environment",
    nairu: "structural unemployment",
    eva: "evasion",
    blk: "black market",
    rev: "receipts",
    spend: "spending",
    open: "openness",
    resilience: "shock resilience",
    trade: "trade relations",
    part: "participation",
    labour: "labour force",
    migrate: "migration",
    tfp: "trend productivity",
    rndEffort: "private R&D effort",
    fertility: "fertility",
    ucost: "cost of capital",
    replace: "replacement ratio",
    mpcw: "constrained demand",
    kboost: "investment (capital)",
    hbuild: "housebuilding (supply)",
    access: "market access",
    tariffCut: "tariff cut",
    uncertainty: "uncertainty",
    contact: "contact capacity",
    pc: "political capital",
  };
/** Data form of fullEffects() for React consumers. */
function fullEffectsData(imp: any, fac: any, cost: any, ch?: any) {
  const bits = [];
  if (cost)
    bits.push({
      text:
        (cost > 0 ? "costs " : "saves ") + Math.abs(cost).toFixed(2) + "% GDP",
      bold: true,
    });
  for (const k in imp || {}) {
    if (!imp[k]) continue;
    bits.push({
      text:
        ((IMP_NAMES as any)[k] || k) +
        " " +
        sgn(imp[k], Math.abs(imp[k]) < 1 ? 2 : 1),
      bold: false,
    });
  }
  for (const k in ch || {}) {
    if (!ch[k]) continue;
    bits.push({
      text:
        ((IMP_NAMES as any)[k] || k) +
        " " +
        sgn(ch[k], Math.abs(ch[k]) < 1 ? 2 : 1),
      bold: false,
    });
  }
  const f = (Object.entries(fac || {}) as [string, number][])
    .filter((e) => e[1])
    .sort((a, b) => b[1] - a[1]);
  const facText = f.length
    ? f.map(([k, v]) => cap1(k) + " " + sgn(v, 1)).join(", ")
    : null;
  return { bits, facText };
}
/** Data form of qualEffects() for React consumers. */
function qualEffectsData(imp: any, fac: any, cost: any, ch?: any) {
  const bits = [];
  if (cost)
    bits.push({ text: cost > 0 ? "costs GDP" : "saves GDP", bold: true });
  const pushSigned = (label: any, v: any) => {
    if (!v) return;
    bits.push({ text: label + (v > 0 ? " ↑" : " ↓"), bold: false });
  };
  for (const k in imp || {}) pushSigned((IMP_NAMES as any)[k] || k, imp[k]);
  for (const k in ch || {}) pushSigned((IMP_NAMES as any)[k] || k, ch[k]);
  const f = (Object.entries(fac || {}) as [string, number][])
    .filter((e) => e[1])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const facText = f.length
    ? f
        .slice(0, 3)
        .map(([k, v]) => cap1(k) + (v > 0 ? " ↑" : " ↓"))
        .join(", ")
    : null;
  return { bits, facText };
}
/** Data form of impactChips() for React consumers. */
function impactChipsData(im: any) {
  return IMPACT_ROWS.map((r) => {
    const v = im.head[r.k];
    if (Math.abs(v) < 0.005) return null;
    const better = r.good === "up" ? v > 0 : v < 0;
    return { name: r.name, value: v, dp: r.dp, up: better };
  }).filter(Boolean);
}
/** Data form of impactFactions() for React consumers. */
function impactFactionsData(im: any) {
  const f = (Object.entries(im.fac) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .filter((e) => Math.abs(e[1]) > 0.05);
  if (!f.length) return { empty: true, best: null, worst: null, gini: null };
  const best = f[0],
    worst = f[f.length - 1];
  return {
    empty: false,
    best: best[1] > 0 ? { name: cap1(best[0]), value: best[1] } : null,
    worst: worst[1] < 0 ? { name: cap1(worst[0]), value: worst[1] } : null,
    gini: Math.abs(im.gini) > 0.05 ? { value: im.gini, up: im.gini < 0 } : null,
  };
}
/* What an event option would actually do. Options mutate the game directly, so
   inspectEventOption snapshots every mutable field, runs the option, reads
   immediate chips (and an optional 4-quarter forecast), then puts it all back.
   A test asserts the state is byte-identical afterwards. */ const MUTABLE = [
  "econ",
  "fac",
  "parties",
  "rel",
  "mods",
  "law",
  "draft",
  "capital",
  "whipSpend",
  "brief",
  "q",
  "term",
  "termStartQ",
  "over",
  "lowRun",
  "sandbox",
  "rateManual",
  "manualRate",
  "country",
  "homeIso",
  "homeScale",
  "homeRole",
  "eventFocus",
  "eventSponsors",
  "coachDone",
  "coach",
  "setPiece8",
  "setPiece16",
  "episode",
  "nextMajorQ",
  "polityShift",
  "blocMember",
  "customBlocs",
  "blocInvites",
  "blocAccession",
  "blocAccessionByCountry",
  "world",
  "worldTrade",
  "envoys",
  "ultimatums",
  "missionEvents",
  "activeVisits",
  "diploAlerts",
];
/* simulate()'s local `sim` object intentionally does not carry every MUTABLE
   field: `law`/`draft`/`sandbox`/`rateManual`/`manualRate`/`blocMember`/
   `customBlocs`/`world` are deliberately NOT plain clones of G (that's the
   whole point of running a hypothetical law forward), so they can't be driven
   generically off this list. The remaining fields below are omitted because
   `step()` — the only function simulate()'s loop actually calls — never reads
   them (confirmed by grepping step()'s body for each one); they're pure UI/
   display/player-flow state with no effect on a projection's numbers. Kept as
   an explicit allowlist, checked by a test below, so a future field added to
   MUTABLE can't silently go unaccounted-for in simulate() the way CLAUDE.md
   warns about — it will either need to be threaded into `sim` or added here
   with the same justification. */
const SIMULATE_OMITS = [
  "over",
  "lowRun",
  "brief",
  "homeIso",
  "homeScale",
  "eventFocus",
  "eventSponsors",
  "coachDone",
  "coach",
  "setPiece8",
  "setPiece16",
  "polityShift",
  "blocAccession",
  "worldTrade",
  "termStartQ",
  "whipSpend",
];
function cloneWorldForSim(g: any) {
  if (!g || !g.world) return null;
  const playerId = playerCountryId(g.homeRole);
  const out: Record<string, any> = {};
  for (const id of Object.keys(g.world)) {
    const seat = g.world[id];
    if (!seat) continue;
    if (id === playerId || seat.isPlayer) continue;
    (out as any)[id] = {
      econ: clone(seat.econ),
      law: clone(seat.law),
      prevLaw: clone(seat.prevLaw || seat.law),
      id,
      role: seat.role,
    };
  }
  return out;
}
function snapshotMutable() {
  const snap: Record<string, any> = {};
  MUTABLE.forEach((k) => {
    (snap as any)[k] = G[k] === undefined ? undefined : clone(G[k]);
  });
  return snap;
}
function restoreMutable(snap: Record<string, any>) {
  MUTABLE.forEach((k) => {
    G[k] = (snap as any)[k];
  });
}
/** Immediate, on-impact chips for an event option: named relation moves
 *  (including those written in `f()` rather than `setRel`), capital, and
 *  faction jumps. Forecast chips stay on the sandbox path. */ function immediateChipsFromSnap(
  snap: Record<string, any>,
) {
  const chips: {
    name: string;
    value: number;
    dp: number;
    up: boolean;
  }[] = [];
  const rel0 = snap.rel || {};
  const rel = G.rel || {};
  const relBits: { name: string; d: number }[] = [];
  for (const id of new Set([...Object.keys(rel0), ...Object.keys(rel)])) {
    if (!id || isPlayerSeat(id)) continue;
    const d =
      (rel[id] != null ? rel[id] : 50) - (rel0[id] != null ? rel0[id] : 50);
    if (Math.abs(d) < 0.95) continue;
    const p = partnerById(id);
    const name = (p && p.name) || id;
    relBits.push({ name, d });
  }
  relBits.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  for (const x of relBits.slice(0, 6)) {
    chips.push({
      name: x.name + " relations",
      value: Math.round(x.d),
      dp: 0,
      up: x.d > 0,
    });
  }
  const capD =
    (G.capital != null ? G.capital : 0) -
    (snap.capital != null ? snap.capital : 0);
  if (Math.abs(capD) >= 0.95) {
    chips.push({
      name: "Capital",
      value: Math.round(capD),
      dp: 0,
      up: capD > 0,
    });
  }
  const fac0 = snap.fac || {};
  const fac = G.fac || {};
  const facBits: { name: string; d: number }[] = [];
  FACTIONS.forEach((f) => {
    const d =
      (fac[f.id] != null ? fac[f.id] : 0) -
      (fac0[f.id] != null ? fac0[f.id] : 0);
    if (Math.abs(d) < 0.95) return;
    facBits.push({ name: f.name, d });
  });
  facBits.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (
    facBits.length >= 4 &&
    facBits.every((x) => Math.round(x.d) === Math.round(facBits[0].d))
  ) {
    chips.push({
      name: "Factions",
      value: Math.round(facBits[0].d),
      dp: 0,
      up: facBits[0].d > 0,
    });
  } else {
    for (const x of facBits.slice(0, 3)) {
      chips.push({
        name: x.name,
        value: Math.round(x.d),
        dp: 0,
        up: x.d > 0,
      });
    }
  }
  return chips;
}
/** Snapshot, apply, read immediate chips (and optional 4-quarter forecast),
 *  restore. One apply covers both career relation chips and sandbox
 *  forecast chips. */ function inspectEventOption(
  opt: any,
  forecastBase: any,
) {
  const snap = snapshotMutable();
  let chips: ReturnType<typeof immediateChipsFromSnap> = [];
  let forecast = null;
  try {
    applyEventOption(opt);
    chips = immediateChipsFromSnap(snap);
    if (forecastBase) forecast = impactOf(clone(G.law), forecastBase, 4);
  } catch {
    chips = [];
    forecast = null;
  }
  restoreMutable(snap);
  return { chips, forecast };
}
function immediateOptionChips(opt: any) {
  return inspectEventOption(opt, null).chips;
}
function previewOption(opt: any, base: any) {
  return inspectEventOption(opt, base).forecast;
}
/** Running total for whatever is staged — shown in the bill drawer only. */
function impactStripData() {
  const cl = billClauses();
  if (!cl.length) return null;
  if (!G.sandbox) {
    return {
      career: true,
      count: cl.length,
      cost: programmeCost(cl),
      bits: cl.slice(0, 6).map((c) => c.label),
      chips: null,
      factions: null,
    };
  }
  let im;
  try {
    im = impactOf(clone(G.draft), simulate(G.law, 4), 4);
  } catch {
    return null;
  }
  return {
    career: false,
    count: cl.length,
    cost: programmeCost(cl),
    bits: null,
    chips: impactChipsData(im),
    factions: impactFactionsData(im),
  };
}
function impactPanelData(cl: any) {
  if (!cl.length) return null;
  const base = simulate(G.law, 4);
  const items = cl.map((c: any, i: any) => {
    const im = impactOf(lawWithOnlyClause(i), base, 4);
    return {
      label: c.label,
      cost: c.pc,
      revenue: Math.abs(im.revenue) > 0.005 ? im.revenue : null,
      chips: impactChipsData(im),
      factions: impactFactionsData(im),
    };
  });
  let whole = null;
  if (cl.length > 1) {
    const im = impactOf(clone(G.draft), base, 4);
    whole = {
      cost: billCost(cl),
      chips: impactChipsData(im),
      factions: impactFactionsData(im),
    };
  }
  return { items, whole };
}
function showBlocFoundModal() {
  if (playerJoiningBloc()) return;
  setBlocModal({ kind: "found" });
}
function showBlocInviteModal(bid: any) {
  setBlocModal({ kind: "invite", bid });
}
function projectionModal(onConfirm?: any) {
  syncServiceHolds(G.draft, G.econ);
  const cl = billClauses(),
    cost = programmeCost(cl);
  const truth = project(4);
  const p = withForecastError(truth);
  const warn = projectionWarnings(truth);
  const rows = p.rows
    .map(
      (r: any) =>
        "<tr><td>" +
        r.label +
        "</td>" +
        '<td class="' +
        (r.growth > 0 ? "pos" : "neg") +
        '">' +
        fmt(r.growth, 1) +
        "</td>" +
        "<td>" +
        r.inflation.toFixed(1) +
        "</td><td>" +
        r.unemployment.toFixed(1) +
        "</td>" +
        '<td class="' +
        (r.balance >= 0 ? "pos" : "neg") +
        '">' +
        fmt(r.balance, 1) +
        "</td>" +
        "<td>" +
        r.debt.toFixed(0) +
        "</td><td>" +
        r.yield.toFixed(2) +
        "</td><td>" +
        r.approval.toFixed(0) +
        "</td></tr>",
    )
    .join("");
  const cur = balanceOf(G.law, G.econ).balance,
    draftBal = balanceOf(G.draft, G.econ).balance;
  const body =
    '<p style="color:var(--ink-soft);font-size:13px">Independent four-quarter forecast on the assumption this bill passes unchanged and nothing else happens. Something else always happens.</p>' +
    '<div class="proj"><div class="proj-scroll"><table><thead><tr><th>Quarter</th><th>Growth</th><th>Infl.</th><th>Unemp.</th><th>Balance</th><th>Debt</th><th>Yield</th><th>Appr.</th></tr></thead><tbody>' +
    rows +
    "</tbody></table></div></div>" +
    '<div style="margin-top:12px;font-family:var(--mono);font-size:11.5px;color:var(--ink-soft)">' +
    "Balance on delivery " +
    fmt(draftBal, 1) +
    "% of GDP (" +
    sgn(draftBal - cur, 1) +
    " versus current law) &middot; " +
    cl.length +
    " clause" +
    (cl.length === 1 ? "" : "s") +
    " &middot; " +
    cost +
    " of " +
    Math.round(G.capital) +
    " capital" +
    (function () {
      const v = billVoteData();
      if (!v || !v.needed || !cl.length) return "";
      return (
        " &middot; chamber " +
        v.aye +
        "–" +
        v.nay +
        (v.pass ? "" : v.advisory ? " (advisory)" : " (no majority)")
      );
    })() +
    "</div>" +
    '<ul class="warnlist">' +
    warn.map((w) => "<li>" + esc(w) + "</li>").join("") +
    "</ul>" +
    '<div class="hint" style="margin-top:12px">' +
    (p.exact
      ? "Sandbox: this forecast is exact. It is the model itself, so the outturn will match it unless something else happens."
      : "This is a forecast, not a promise. Independent forecasts of borrowing miss by about a point of GDP a year out, " +
        "and by more on growth. The figures above carry an error of that size, so the outturn will not match them. " +
        "Turn on sandbox in the bill panel for an exact one.") +
    "</div>";
  const confirm = typeof onConfirm === "function" ? onConfirm : () => enact();
  despatch(
    cl.length ? "Forecast for this bill" : "Forecast on current policy",
    "Office for Budget Responsibility",
    body,
    [
      {
        b: cl.length ? "Confirm and deliver" : "Proceed to next quarter",
        e: cl.length
          ? "Enact every clause and move to the next quarter"
          : "Advance with no new legislation",
        f: confirm,
      },
      {
        b: "Go back",
        e: "Return without advancing the quarter",
        f: () => render(),
      },
    ],
  );
}
/** Applies staged missions and returns the ones that actually took effect. */
function applyDraftMissions(law: any, draft: any, econ: any, fac: any) {
  ensureDiploStocks(econ);
  if (typeof G !== "undefined" && G) pruneInvalidDraftMissions(G);
  const missions = (draft && draft.missions) || (law && law.missions) || {};
  const gBag = { econ, q: typeof G !== "undefined" && G ? G.q : 0 };
  const applied: Record<string, any> = {};
  for (const pid in missions) {
    const m = (MISSION_BY_ID as any)[missions[pid]];
    if (!m) continue;
    /* Tone whiplash: no sanctions while a state visit with this partner is live. */
    if (
      m.id === "sanctionsPosture" &&
      typeof G !== "undefined" &&
      G &&
      isVisitActive(G, pid)
    ) {
      continue;
    }
    applied[pid] = m.id;
    econ.missionCd[pid] = MISSION_CD;
    if (m.fac && fac) {
      for (const f in m.fac)
        fac[f] = clamp((fac[f] || 0) + (m.fac as any)[f], 2, 96);
    }
    if (m.id === "summit") {
      if (typeof G !== "undefined" && G) beginActiveVisit(G, pid, "summit");
      continue;
    }
    econ.relImpulse[pid] = (econ.relImpulse[pid] || 0) + m.impulse;
    if (m.retalNudge) econ.retaliation = (econ.retaliation || 0) + m.retalNudge;
    if (m.uncertainty)
      econ.uncertainty = (econ.uncertainty || 0) + m.uncertainty;
    if (m.id === "demarche") {
      addDiploLedger(gBag, pid, {
        id: "mission_demarche_" + (gBag.q || 0),
        label: "Formal protest",
        pts: -3,
      });
    } else if (m.id === "sanctionsPosture") {
      addDiploLedger(gBag, pid, {
        id: "mission_sanctions_" + (gBag.q || 0),
        label: "Restrictive measures",
        pts: -10,
      });
      setSanctionStance(gBag, pid, { against: true });
    }
  }
  if (law) delete law.missions;
  if (draft) draft.missions = {};
  return applied;
}
function enact() {
  if (G.over) return;
  /* Close any open drawer/news inbox immediately, before the quarter-flash
     animation, rather than leaving it open over the new quarter. */
  tab = null;
  closeNewsInbox();
  pruneDraftBlocInvites();
  if (G.draft.blocCreate && !canCreateCustomBloc()) G.draft.blocCreate = null;
  const cl = billClauses();
  const total = programmeCost(cl);
  if (total > G.capital) return;
  const vote = billVoteData();
  if (vote && vote.needed && !vote.advisory && !vote.pass) return;
  /* Same blocker set handleDeliver() already pre-checks before ever calling
   * enact() — kept here too as a backstop for any direct caller (tests,
   * future callers) that bypasses that pre-check. */
  if (mpDraftBlocGateError()) return;
  const balDelta =
    balanceOf(G.draft, G.econ).balance - balanceOf(G.law, G.econ).balance;
  G.capital -= total;
  G.whipSpend = 0;
  G.prevLaw = clone(G.law);
  /* Sphere trespass ledger when newly ratifying deals in a patron's backyard. */
  for (const id in G.draft.deals || {}) {
    if (G.draft.deals[id] && !(G.prevLaw.deals && G.prevLaw.deals[id])) {
      applySphereTrespassOnDeal(id, true);
    }
  }
  if (G.draft.blocLeave) leaveBloc(G.draft);
  if (G.draft.blocAccession) {
    applyBlocAccessionDraft(G, G.draft.blocAccession);
  }
  if (G.draft.blocCreate) {
    if (
      !createCustomBloc(G.draft.blocCreate.name, G.draft.blocCreate.template)
    ) {
      /* Capital for Found was already in `cost` only if canCreateCustomBloc
             held at billClauses time; belt-and-braces clear. */
      G.draft.blocCreate = null;
    }
  }
  for (const cid in G.draft.blocInvite || {}) {
    const playerBloc = countryBlocId(playerCountryId());
    if (playerBloc) inviteToBloc(cid, playerBloc);
  }
  /* Slider edits spend; hold must match before step() enforces the standard. */ syncServiceHolds(
    G.draft,
    G.econ,
  );
  const prevPolity = (G.prevLaw && G.prevLaw.polity) || "democracy";
  const nextPolity = G.draft.polity || "democracy";
  const prevPluralism = partyPluralismOf(G.prevLaw);
  G.law = clone(G.draft);
  if (nextPolity !== prevPolity && polityCanReach(prevPolity, nextPolity)) {
    G.polityShift = {
      from: prevPolity,
      to: nextPolity,
      q: G.q,
    };
  }
  if (prevPluralism !== partyPluralismOf(G.law)) {
    relayoutPartiesFromLaw(G);
  }
  if (vote && vote.needed && vote.advisory && !vote.pass && cl.length) {
    applyConsultativeShock(G);
  }
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  const lock = lockedTariff(G.law);
  if (lock != null) {
    ensureTariffSchedule(G.law);
    G.law.tariffSchedule.cet = lock;
    syncTariffHeadline(G.law);
  }
  /* Measure the bill against holding still before any event shocks land. */ let billImpact =
    null;
  if (cl.length) {
    try {
      billImpact = impactOf(clone(G.law), simulate(G.prevLaw, 4), 4);
    } catch {
      billImpact = null;
    }
  }
  const proceed = (chosen: any) => {
    /* Prefer the bill score; add the Cabinet choice only if there was no bill. */ G.briefImpact =
      null;
    if (billImpact) {
      G.briefImpact = briefingImpactParts(billImpact, {
        kind: "bill",
        clauses: cl,
      });
    } else if (chosen && chosen.impact) {
      G.briefImpact = briefingImpactParts(chosen.impact, {
        kind: "decision",
      });
    }
    const res = step(G, G.law, G.prevLaw, !!G.sandbox);
    clearQuarterEnvoySpend(G);
    syncEnvoysBaseline(G);
    G.draft = clone(G.law);
    G.draft.blocAccession = null;
    G.draft.blocLeave = false;
    G.draft.blocCreate = null;
    G.draft.blocInvite = {};
    if (G.draft.missions) G.draft.missions = {};
    writeBriefing(res);
    const freshUltOutcomes = diploOutcomeAlertsForBrief(G.diploAlerts, G.q);
    markDiploAlertsNoted(freshUltOutcomes);
    if (G._dealCollapseNotes && G._dealCollapseNotes.length) {
      G.brief = G._dealCollapseNotes.map(T).concat(G.brief).slice(0, 3);
      G._dealCollapseNotes = null;
    }
    if (G.econ._bankStressNote) {
      G.brief = [G.econ._bankStressNote].concat(G.brief).slice(0, 3);
      G.econ._bankStressNote = null;
    }
    checkCrises(res);
    const pressBefore = G.press ? G.press.length : 0;
    const clips = composePress({
      clauses: cl,
      passage: pressPassageFromVote(vote),
      balDelta,
      ultimatumOutcomes: freshUltOutcomes,
      q: Math.max(0, G.q - 1),
      brief: G.brief,
      res,
      econ: G.econ,
    });
    /* A one-off warning story exactly two quarters out — electionAtRisk()
       only reads true right at that boundary once per term, so this can't
       double-fire without another full step() (i.e. another Deliver). */
    const risk = electionAtRisk();
    if (risk.atRisk && risk.left === 2) {
      const noun = reviewNoun();
      const isCoup = polityOf(G.homeRole).kind === "congress";
      clips.push({
        kind: "election-risk",
        masthead: isCoup ? "Party Bulletin" : "The Fiscal Gazette",
        headline: isCoup
          ? "Whispers of a reshuffle in the ranks"
          : `Two quarters from the ${noun} — and it shows`,
        lede: isCoup
          ? "Patriot sentiment inside the apparatus is running cold. Allies and rivals alike are watching the numbers."
          : `The score is running behind where it needs to be. Unless it turns, the ${noun} looks lost.`,
        kicker: qLabel(G, Math.max(0, G.q - 1)),
      });
    }
    render();
    _quarterFlashLock = true;
    const _db = $("deliverBtn");
    if (_db) _db.disabled = true;
    Promise.resolve(announceQuarterAdvance()).then(() => {
      if (!G) return;
      _quarterFlashLock = false;
      render();
      /* Press always lands after the quarter flash. */
      if (clips.length) {
        pushPress(clips);
        for (let i = G.press.length - 1; i >= pressBefore; i--) {
          if (G.press[i].kind === "ultimatum") {
            expandPress(G.press[i].id);
            break;
          }
        }
      }
      const electionDue = !G.over && termReviewDue();
      if (electionDue) termReview();
      else if (!G.over && G.brief && G.brief.length) {
        /* Morning note after bills and Cabinet choices alike — impact lives here. */ despatch(
          "Morning note",
          morningNoteStamp(),
          { kind: "briefing", data: briefingData(G.brief) },
          [
            {
              b: "Continue",
              e: electionQuartersLeft() + " quarters to the " + reviewNoun(),
              f: () => render(),
            },
          ],
        );
      }
    });
  };
  const presentChoice = (ev: any, isMajor: any) => {
    G.lastEventQ = G.q;
    G.lastEventId = ev.id;
    presentEventAsPress(ev, (o: any) => {
      let impact = null;
      let base = null;
      try {
        base = simulate(G.law, 4);
      } catch {
        base = null;
      }
      applyEventOption(o);
      if (isMajor) beginEpisode(ev, o);
      if (base) {
        try {
          impact = impactOf(clone(G.law), base, 4);
        } catch {
          impact = null;
        }
      }
      proceed({
        event: ev,
        option: o,
        impact,
      });
    });
  };
  if (G.episode && G.q >= G.episode.endsQ) {
    const ep = G.episode;
    despatch(T(ep.endTitle), ep.endStamp, "<p>" + T(ep.endText) + "</p>", [
      {
        b: "Noted",
        e: "The episode closes",
        f: () => {
          endEpisode();
          proceed({
            episodeEnd: ep,
          });
        },
      },
    ]);
  } else {
    const afterMissionEvents = () => {
      const major = rollMajorEvent();
      if (major) presentChoice(major, true);
      else {
        const ev = rollEvent();
        if (ev) presentChoice(ev, false);
        else proceed(null);
      }
    };
    queueSummitVisitEvents(G);
    presentNextMissionEvent(afterMissionEvents);
  }
}
/* Module bridge for React */ let _onState: any = null;
let _despatchOpen: any = null;
let _onDespatchChange: any = null;
let _onBlocModal: any = null;
let _blocModal: any = null;

function setOnDespatchChange(fn: any) {
  _onDespatchChange = fn;
}
function setOnBlocModal(fn: any) {
  _onBlocModal = fn;
}
function setBlocModal(v: any) {
  _blocModal = v;
  if (_onBlocModal) _onBlocModal(v);
}
function hideDespatchShell() {
  setBlocModal(null);
}
function isDespatchShellOpen() {
  return !!_blocModal;
}
function getDespatch() {
  return _despatchOpen;
}
function closeDespatch() {
  _despatchOpen = null;
  if (_onDespatchChange) _onDespatchChange(null);
}
function setOnState(fn: any) {
  _onState = fn;
}
function finishCoach() {
  if (!G) return;
  G.coachDone = true;
  G.coach = null;
}
function skipCoach() {
  finishCoach();
  /* Drop morning note / any open despatch so Get started cannot re-seed the coach. */
  if (typeof closeDespatch === "function") closeDespatch();
  bump();
}
function coachCtx() {
  return {
    getTab: () => tab,
    q: G.q,
    startQ: G.coach && G.coach.startQ != null ? G.coach.startQ : 0,
    draft: G.draft,
    law: G.law,
    rel: G.rel,
    blocMember: G.blocMember,
    blocAccession: G.blocAccession,
    blocAccessionByCountry: G.blocAccessionByCountry,
    homeRole: G.homeRole,
  };
}
function beginCoachStep(stepIndex: any) {
  if (!G) return;
  const step = coachStepAt(stepIndex);
  if (!step) {
    finishCoach();
    bump();
    return;
  }
  /* Coach uses the side panel — drop any leftover centered despatch. */
  if (typeof closeDespatch === "function") closeDespatch();
  G.coachDone = false;
  const isBrief = !step.task;
  /* If the player already advanced during the previous step (e.g. Deliver
     during the forecast brief), keep that baseline so trackStartQ still clears. */
  const prevStartQ = G.coach && G.coach.startQ != null ? G.coach.startQ : G.q;
  const startQ = step.trackStartQ && G.q > prevStartQ ? prevStartQ : G.q;
  G.coach = {
    step: stepIndex,
    phase: isBrief ? "brief" : "await",
    startQ,
  };
  /* Do not auto-open drawers — the task asks the player to open them.
       Some steps close the current drawer so a re-open is intentional. */
  if (step.reopenTab) setTab(null);
  else bump();
}
/** Advance from intro brief or a confirmAfter ready phase. */
function continueCoach() {
  if (!G || !G.coach) return;
  if (G.coach.phase === "brief") {
    const next = G.coach.step + 1;
    if (next >= coachStepCount()) {
      finishCoach();
      bump();
      return;
    }
    beginCoachStep(next);
    return;
  }
  if (G.coach.phase === "ready") {
    advanceCoachAfterSuccess();
    return;
  }
}
function advanceCoachAfterSuccess() {
  if (!G || !G.coach) return;
  const stepIndex = G.coach.step;
  const next = stepIndex + 1;
  if (next >= coachStepCount()) {
    finishCoach();
    bump();
    return;
  }
  beginCoachStep(next);
}
function tickCoach() {
  if (!G || G.coachDone || !G.coach || G.coach.phase !== "await") return false;
  if (!coachAwaitSatisfied(G.coach.step, coachCtx())) return false;
  const step = coachStepAt(G.coach.step);
  const subs = coachSubtasks(G.coach.step, coachCtx());
  /* Multi-checkbox steps always wait for Next once every box is ticked. */
  if ((step && step.confirmAfter) || (subs && subs.length > 1)) {
    G.coach.phase = "ready";
    return true;
  }
  advanceCoachAfterSuccess();
  return true;
}
function getCoachPanel() {
  if (!G || G.coachDone || !G.coach) return null;
  const step = coachStepAt(G.coach.step);
  if (!step) return null;
  const ready = G.coach.phase === "ready";
  const subs = coachSubtasks(G.coach.step, coachCtx());
  const hasChecks = !!(subs && subs.length);
  return {
    step: G.coach.step + 1,
    total: coachStepCount(),
    title: step.title,
    body: step.body,
    task: ready || hasChecks ? null : step.task,
    subtasks: hasChecks ? subs : null,
    phase: G.coach.phase,
    canContinue: G.coach.phase === "brief" || ready,
    continueLabel: ready ? "Next" : step.id === "done" ? "Finish" : "Continue",
  };
}
function bump() {
  maybeAutoUnsubmitMp();
  tickCoach();
  if (_onState) _onState();
}
function notifyUi() {
  bump();
}
/* Opening / restart country picker. Tests and the reference HTML keep calling
   newGame() directly; the Next shell registers a setup overlay instead. */ let _onSetup: any =
  null;
function setOnSetup(fn: any) {
  _onSetup = fn;
}
function requestSetup() {
  if (_onSetup) {
    _onSetup();
    return;
  }
  newGame();
}
let _onTabChange: any = null;
function setOnTabChange(fn: any) {
  _onTabChange = fn;
}
function setTab(t: any, scrollPartner?: any) {
  const prev = tab;
  tab = t;
  /* Opening a drawer closes the news inbox — mirrors toggleNewsOpen()
     closing whatever drawer is open, so the two never fight for the same
     side of the screen. */
  if (t) closeNewsInbox();
  /* A partner scroll target has to land on the pill that actually shows
     that partner's card, or queueDrawerPartnerScroll() retries for ~1.5s
     and silently gives up — the card is never in the DOM to find. Mutated
     directly (not via setDrawerCat) since this function does its own
     bump() below. */ if (scrollPartner) {
    if (t === "trade") drawerCat.trade = "partners";
    else if (t === "diplomacy") {
      const p = partnerById(scrollPartner);
      if (p && p.region) drawerCat.diplomacy = p.region;
    }
  }
  if (_onTabChange && t !== prev) _onTabChange(t, prev);
  render(scrollPartner ? { skipBump: true, scrollPartner } : undefined);
  /* React chrome reads tab via getTab() but only re-renders on bump(). */
  if (scrollPartner && typeof bump === "function") bump();
}
function getTab() {
  return tab;
}
/** Which pill category is selected within a given drawer tab (laws/charts/
 *  taxes) — lives outside G so it's not part of the game-state clone/save
 *  surface, same rationale as `tab` itself. Keyed per-tab so switching
 *  drawers remembers each one's last category instead of resetting it.
 *  DrawerShell.tsx owns the pill row; panels just read their own slot. */ const drawerCat: Record<
  string,
  string
> = {};
function getDrawerCat(tabId: string, def: string) {
  return drawerCat[tabId] || def;
}
function setDrawerCat(tabId: string, cat: string) {
  drawerCat[tabId] = cat;
  bump();
}
function getG() {
  return G;
}
function setG(next: any) {
  G = next;
  return G;
}

export {
  FACTIONS,
  DEPTS,
  type DeptId,
  OTHER_SPEND,
  OTHER_REV,
  TERM_LEN,
  POLITY,
  POLITY_IDS,
  POLITY_LADDER,
  REL_POLITY,
  TAXES,
  TAX_BY_ID,
  type TaxId,
  FLAT_BONUS,
  DUAL_BONUS,
  LAND_BONUS,
  CONSUMPTION_BONUS,
  POLICIES,
  POLICY_BY_ID,
  type PolicyId,
  VICE,
  VICE_BY_ID,
  type ViceId,
  PARTNERS,
  DEAL_BY_ID,
  BAND_NAMES,
  DEF_INCOME,
  DEF_NI,
  DEF_HEAD_OF_STATE,
  DEF_ELECTORAL,
  DEF_WORK_HOURS,
  DEF_CHILDCARE,
  DEF_MIN_WAGE,
  DEF_PENSION,
  LAW_GROUPS,
  LAW_GROUP_BY_ID,
  resolveReqState,
  isAuthoritarianSignal,
  syncPolityFromGroups,
  MISSIONS,
  MISSION_BY_ID,
  MISSION_CD,
  REL_TRADE,
  RETAL_COLD,
  REL_IMPULSE_DECAY,
  LEDGER_DECAY,
  LEDGER_FLOOR,
  ENVOY_SLOTS,
  ENVOY_TARGET,
  ENVOY_DRIFT,
  ENVOY_BUILD_CAP,
  ENVOY_ASSIGN_PC,
  ENVOY_UPKEEP_PC,
  ENVOY_RECALL_PC,
  ULTIMATUM_PC,
  ULTIMATUM_CD,
  ULTIMATUM_JITTER,
  DIPLO_POLICY_KEYS,
  DIPLO_SPHERES,
  DIPLO_CAMPS,
  NATION_PROFILE,
  EVENTS,
  TABS,
  COL,
  SETTLE_QUARTERS,
  activePartners,
  tradeRestShare,
  partnerShare,
  dealsForPartner,
  shareFor,
  shareLabel,
  partnerTradeSharePct,
  TRADE_MATRIX,
  hasDeal,
  dealsWith,
  lockedTariff,
  effectiveTariff,
  tariffScheduleAverage,
  importTariffLevel,
  partnerAccessTargets,
  tradeExposureTarget,
  tariffLocked,
  tariffCetBlockers,
  countryBlocId,
  hasIndependentCommercialPolicy,
  isCustomsUnion,
  blocMembers,
  joinBloc,
  leaveBloc,
  createCustomBloc,
  canCreateCustomBloc,
  withdrawBlocAccession,
  inviteToBloc,
  finalizeBlocJoin,
  blocById,
  COUNTRY_REGIONS,
  blocByIdOrCustom,
  isBlocFounder,
  blocAccessionSpec,
  inviteAcceptMin,
  inviteCapitalCost,
  inviteClauseLabel,
  isPoachCandidate,
  blocInviteIsStale,
  ensureDraftBlocState,
  pruneDraftBlocInvites,
  ensureTariffSchedule,
  tariffLeverValue,
  playerJoiningBloc,
  toggleBlocInvite,
  blocInviteCandidates,
  flashBillPip,
  syncTariffHeadline,
  memberAccessionTrack,
  showBlocFoundModal,
  showBlocInviteModal,
  playerCountryId,
  stepCountry,
  initWorldState,
  syncNationsFromWorld,
  mirrorPlayerToWorld,
  stepWorldPartners,
  refreshWorldTrade,
  applyAiFiscalRule,
  resolveLockstepQuarter,
  exportGameSnapshot,
  hydrateGameSnapshot,
  seedMpPolitics,
  computeBillCost,
  validateMpSubmission,
  enactHumanSeatOnSnapshot,
  showMpBriefing,
  mergeMpInboundAsksFromSnapshot,
  flushMpDiploPressAlerts,
  applyMpEventChoice,
  applyMpDiploAction,
  applyMpDiploPatch,
  diploOutcomeAlertsForBrief,
  markDiploAlertsNoted,
  applyMpInboundUltimatumChoice,
  timeoutInboundUltimatums,
  applyMpInboundBlocInviteChoice,
  timeoutInboundBlocInvites,
  applyMpInboundDealChoice,
  applyMpInboundSummitCommercialChoice,
  timeoutInboundDealProposals,
  timeoutInboundSummitCommercial,
  buildSummitCommercialEvent,
  applySummitCommercialOption,
  ratifyBilateralDealWithPartner,
  snapshotPartnerTariffs,
  snapshotPartnerTrade,
  livePartnerTariffOnPlayer,
  previewSummitTariff,
  cuBoundary,
  canNegotiateUnionCommercial,
  canNegotiateReciprocalTariffs,
  dealById,
  unionAssociationDeal,
  unionCommercialDealBlockers,
  applyMpInboundNoticeChoice,
  inboundNoticeActs,
  announceQuarterAdvance,
  lockMpSubmission,
  clearMpLockedSubmission,
  snapshotMpDiploUi,
  restoreMpDiploUi,
  applyLocalMpDiploAction,
  blocJoinBlockers,
  blocMemberApprovals,
  blocInviteMemberApprovals,
  blocInviteBlockers,
  blocExternalDealBlockers,
  mpDraftBlocGateError,
  needBlockers,
  simulateFromDraft,
  BLOC_TEMPLATES,
  CUSTOM_BLOC_TEMPLATES,
  pickEventPartner,
  isPlayerSeat,
  requirePartner,
  requireScriptablePartner,
  scriptablePartners,
  adjustBilateralTariffs,
  isHumanMpSeat,
  partnerById,
  prepareEvent,
  applyDraftMissions,
  ensureDiploStocks,
  addDiploLedger,
  setSanctionStance,
  clearSanctionStance,
  seedRelBase,
  relationModifiers,
  relationModifiersData,
  relationTarget,
  assignEnvoy,
  recallEnvoy,
  issueUltimatum,
  withdrawUltimatum,
  canWithdrawUltimatum,
  processUltimatums,
  diploDeps,
  seedGameRelBase,
  pruneInvalidDraftMissions,
  buildRelationModifiers,
  spherePatronsForPartner,
  sphereRiskHint,
  canIssueUltimatum,
  applySphereTrespassOnDeal,
  emptyEnvoys,
  hasFormalProtest,
  ultimatumDemandsFor,
  baseP,
  concedeP,
  partnerSelfInterest,
  interestTag,
  commercialAcceptScore,
  COMMERCIAL_ACCEPT_P,
  commercialPackageScore,
  partnerTariffOnPlayer,
  ultimatumOutcomeImpacts,
  rollMissionEvent,
  formatMissionEventText,
  formatMissionTokens,
  applyMissionEventOption,
  MISSION_EVENTS,
  queueSummitVisitEvents,
  VISIT_DURATION,
  SUMMIT_EVENT_BEATS,
  beginActiveVisit,
  visitQuartersLeft,
  isVisitActive,
  diploMapMarkers,
  pendingUltimatumIds,
  ultimatumQuartersLeft,
  ultimatumWaitingCopy,
  hasDiploAttention,
  diploHudChips,
  ongoingSituations,
  gdp0ForSeat,
  realmGdpBn,
  fmtGdpBn,
  worldDemandBn,
  refreshWorldY,
  restGdp0ForRole,
  currencyForSeat,
  fxDisplayIndex,
  CURRENCY_META,
  liveUsdRate,
  fxPairForCurrency,
  liveRateBetween,
  fmtFxRate,
  snapshotCurrencyRates,
  ensureNationFx,
  clearOpeningCache,
  openingFac,
  openingRel,
  REL_0,
  FAC_0,
  MUTABLE,
  SIMULATE_OMITS,
  IMPACT_ROWS,
  IMP_NAMES,
  clamp,
  baseLaw,
  lawForRole,
  realmLawKey,
  newGame,
  aggregate,
  revenue,
  spending,
  balanceOf,
  pinsForRole,
  step,
  project,
  simulate,
  billClauses,
  billCost,
  programmeCost,
  whipSpendOf,
  setWhipSpend,
  WHIP_MAX,
  capitalOutlook,
  billShock,
  projectionWarnings,
  impactOf,
  impactOfRatePin,
  lawWithOnlyClause,
  withForecastError,
  previewOption,
  immediateOptionChips,
  applyEventOption,
  incomeYield,
  incomeByBand,
  incomeProfile,
  effectiveBands,
  personalAllowance,
  TAPER_START,
  TAPER_RATE,
  capitalTaxOn,
  isFlatIncome,
  isDualCapital,
  landCommitment,
  consumptionCommitment,
  regimeMultipliers,
  CAP_INCOME_SHARE,
  PRIVATE_WEALTH0,
  MPC_INCIDENCE,
  BASE_INCOME_DIST,
  BASE_DIST_GINI,
  buildIncomeDist,
  incomeDistForRole,
  activeIncomeDist,
  distMedian,
  preTaxGini,
  clearIncomeDistCache,
  dragRatio,
  serviceScore,
  spendForScore,
  syncServiceHolds,
  welfareCost,
  welfareAdequacy,
  taxAvailable,
  taxGroup,
  dp,
  money,
  withNi,
  withIncomeOn,
  researchEffort,
  knowledgeTfp,
  R0,
  DEPREC_R,
  R_TFP,
  TFP_FRONTIER,
  CATCHUP_K,
  baselineTfpGrowth,
  tfpCatchupRate,
  impliedLabourGrowth,
  labourGrowthRate,
  effectiveBirthRate,
  FERTILITY_CH,
  potentialLevel,
  potentialGrowth,
  humanCapital,
  H_CAP0,
  DEPREC_H,
  stepHumanCapital,
  polityOf,
  polityIdOf,
  profilePolityId,
  polityAffinity,
  polityReachable,
  polityCanReach,
  polityChangePc,
  politySteps,
  POLITY_LEAP_EXTRA,
  polityShockFac,
  polityShiftAge,
  termLenOf,
  coupMetric,
  reviewNoun,
  reviewStamp,
  careerHint,
  electionQuartersLeft,
  electionThermometer,
  electionAtRisk,
  termReviewScore,
  termReviewDue,
  termReview,
  canCallEarlyElection,
  earlyElectionBlocker,
  callEarlyElection,
  EARLY_ELECTION_MIN_Q,
  qualEffectsData,
  composePress,
  eventPressCopy,
  pushPress,
  dismissNewestPress,
  expandPress,
  getPressExpanded,
  closeFocusedPress,
  discardPress,
  getNewsOpen,
  pressChoicePending,
  presentEventAsPress,
  toggleNewsOpen,
  newsUnreadCount,
  dealBlockers,
  fullEffectsData,
  impactStripData,
  impactPanelData,
  rateImpactData,
  approvalOf,
  grade,
  governmentScoreData,
  gameOver,
  election,
  checkCrises,
  rollEvent,
  rollMajorEvent,
  writeBriefing,
  briefingImpactLines,
  mergeBriefingImpact,
  briefingImpactParts,
  briefingData,
  beginEpisode,
  endEpisode,
  scheduleNextMajorQ,
  raiseTradeWarTariffs,
  snapshotTariffSchedules,
  globalModsForAiSeat,
  WORLD_TFP_SPILL,
  MAJOR_GAP_MIN,
  MAJOR_GAP_SPAN,
  refreshWorldYRel,
  liveYRel,
  qLabel,
  thresholdSliderMax,
  lineChartSpec,
  compositionBarData,
  nationTableData,
  ledgerRows,
  clausesIn,
  esc,
  fmt,
  sgn,
  clone,
  ICONS,
  despatch,
  enact,
  projectionModal,
  capitalShortfallHint,
  COACH_STEPS,
  beginCoachStep,
  continueCoach,
  skipCoach,
  tickCoach,
  getCoachPanel,
  coachSubtasks,
  RATE_FLOOR,
  MANUAL_RATE_MIN,
  render,
  renderChrome,
  renderPanel,
  $,
  T,
  theCountry,
  TheCountry,
  countryPhrase,
  countryLabel,
  setOnState,
  setOnDespatchChange,
  setOnBlocModal,
  getDespatch,
  closeDespatch,
  hideDespatchShell,
  isDespatchShellOpen,
  notifyUi,
  bump,
  isDeliverLocked,
  chamberBlocksDeliver,
  billVoteData,
  majorityShortfallHint,
  clausePartyStances,
  billPartyStances,
  itemPartyStances,
  leaderTitle,
  partiesState,
  rulingSeats,
  seatRows,
  displayParties,
  CHAMBER_SEATS,
  PARTIES,
  PARTY_BY_ID,
  PARTY_IDS,
  lawDeltaTaste,
  partyStances,
  policyTaste,
  taxTaste,
  viceTaste,
  groupTaste,
  seatsFromVotes,
  voteIntentionFromFac,
  applyValenceSwing,
  rulingAyeShare,
  whipAyeBoost,
  chamberVote,
  seedParties,
  allocateElection,
  parliamentPowersOf,
  setOnSetup,
  requestSetup,
  setTab,
  getTab,
  getDrawerCat,
  setDrawerCat,
  setOnTabChange,
  getG,
  setG,
  recapitaliseBank,
};
