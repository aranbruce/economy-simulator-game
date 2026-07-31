import type {
  Faction,
  Dept,
  Tax,
  Regime,
  Policy,
  Vice,
  Mission,
} from "./types.ts";
import { REALM_LAW, applyRealmLawOverlay } from "./realmLaws.ts";
import { TRADE_MATRIX, shareFor, shareLabel } from "./tradeMatrix.ts";
import {
  COUNTRIES,
  COUNTRY_REGIONS,
  DEFAULT_BLOC_MEMBER,
  LEGACY_ROLE_MAP,
  resolveHomeRole,
} from "./countries.ts";
import {
  BLOC_TEMPLATES,
  CUSTOM_BLOC_TEMPLATES,
  blocById,
  countriesInBloc,
  isCustomsUnion,
} from "./blocs.ts";
import { NATION_PROFILE, REL_0 } from "./nationProfiles.ts";
import {
  clearBilateralTrade,
  seatsFromWorld,
  worldSeatIds,
} from "./worldTrade.ts";
import { stepCurrencyAreas } from "./fxAreas.ts";
import { metricRamp } from "./metricRamp.ts";
import { relationColour } from "./partners.ts";
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
  ENVOY_ASSIGN_PC,
  ENVOY_RECALL_PC,
  ULTIMATUM_PC,
  ULTIMATUM_CD,
  ULTIMATUM_WAIT,
  ULTIMATUM_JITTER,
  DIPLO_POLICY_KEYS,
  DIPLO_SPHERES,
  DIPLO_CAMPS,
  ensureDiploStocks as ensureDiploStocksCore,
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
  baseLabel,
  ultimatumDemandsFor,
  baseP,
  concedeP,
  partnerSelfInterest,
  interestTag,
  partnerTariffOnPlayer,
  applyUltimatumConcede,
  applyUltimatumDefy,
  ultimatumOutcomeImpacts,
  rollMissionEvent,
  formatMissionEventText,
  MISSION_EVENTS,
  sharedCamp,
  VISIT_DURATION,
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
   ================================================================== */ const FACTIONS =
  [
    {
      id: "business",
      name: "Business",
      w: 0.16,
    },
    {
      id: "workers",
      name: "Workers",
      w: 0.22,
    },
    {
      id: "pensioners",
      name: "Pensioners",
      w: 0.2,
    },
    {
      id: "urban",
      name: "Urban",
      w: 0.18,
    },
    {
      id: "rural",
      name: "Rural",
      w: 0.14,
    },
    {
      id: "patriots",
      name: "Patriots",
      w: 0.1,
    },
  ] as const satisfies Faction[];
type FactionKey = (typeof FACTIONS)[number]["id"];
const DEPTS = [
  {
    id: "health",
    name: "Health",
    def: 8.4,
    min: 3,
    max: 16,
  },
  {
    id: "education",
    name: "Education",
    def: 4.1,
    min: 1,
    max: 10,
  },
  {
    id: "infra",
    name: "Infrastructure",
    def: 2.5,
    min: 0,
    max: 8,
  },
  {
    id: "research",
    name: "Research & innovation",
    def: 0.7,
    min: 0,
    max: 3,
  },
  {
    id: "welfare",
    name: "Welfare & pensions",
    def: 13.3,
    min: 4,
    max: 22,
  },
  {
    id: "defence",
    name: "Defence",
    def: 2.4,
    min: 0.5,
    max: 8,
  },
  {
    id: "justice",
    name: "Justice & policing",
    def: 1.9,
    min: 0.5,
    max: 6,
  },
  {
    id: "environment",
    name: "Environment",
    def: 0.8,
    min: 0,
    max: 5,
  },
] as const satisfies Dept[];
type DeptId = (typeof DEPTS)[number]["id"];
/* UK 2025-26: total managed expenditure 44.8% of GDP, receipts 40.4%, deficit
   about 4.4%, debt 94.3%. Programme spending here sums with the departmental
   lines to reach that total; OTHER_REV covers council tax, business rates,
   stamp duty and the smaller duties. Research (0.7) is carved out of the
   residual so the opening fiscal position stays put. */ const OTHER_SPEND = 7.7,
  OTHER_REV = 12.25,
  TERM_LEN = 20;
/* Political regime per seat. Opening pin on NATION_PROFILE; live player polity
   lives on law.polity and can be restaged from Society. REGIMES above is tax
   architecture only. Three types only — former absolute monarchies (Saudi, UAE)
   use authoritarian. */ const POLITY: Record<string, any> = {
  democracy: {
    termLen: 20,
    loseAt: 44,
    kind: "election",
    label: "Democracy",
    capitalRegen: 1.0,
    coupOn: "approval",
    coupFloor: 20,
    coupQuarters: 4,
    changePc: 40,
    blurb:
      "Competitive elections on a five-year clock. Capital recovers at full rate.",
  },
  hybrid: {
    termLen: 20,
    loseAt: 30,
    kind: "managed",
    label: "Hybrid regime",
    capitalRegen: 0.85,
    coupOn: "approval",
    coupFloor: 20,
    coupQuarters: 4,
    changePc: 36,
    blurb:
      "Managed ballots and thinner mandates. Capital recovers a little slower.",
  },
  authoritarian: {
    termLen: 40,
    loseAt: 28,
    kind: "congress",
    label: "Authoritarian",
    capitalRegen: 0.55,
    coupOn: "patriots",
    coupFloor: 28,
    coupQuarters: 3,
    changePc: 48,
    blurb:
      "Party congress on a decade clock. Slow capital recovery; elite coup risk.",
  },
};
const POLITY_IDS = Object.keys(POLITY);
const POLITY_LADDER = ["democracy", "hybrid", "authoritarian"];
const REL_POLITY = 6;
/** Collapse legacy "monarchy" pins into authoritarian. */ function normalisePolityId(
  key: any,
) {
  if (key === "monarchy") return "authoritarian";
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
  const id = resolveHomeRole(
    role != null
      ? role
      : (typeof G !== "undefined" && G && G.homeRole) || "home",
  );
  if (typeof G !== "undefined" && G && G.law && G.law.polity) {
    const live = normalisePolityId(G.law.polity);
    if (live) {
      const home = resolveHomeRole(G.homeRole || "home");
      if (id === home || role == null || role === G.homeRole) {
        if (G.law.polity !== live) G.law.polity = live;
        return live;
      }
    }
  }
  return profilePolityId(id);
}
function polityOf(role?: any) {
  return POLITY[polityIdOf(role)];
}
function termLenOf(role: any) {
  return polityOf(role).termLen || TERM_LEN;
}
/** All live polity ids (ladder order). `from` is ignored — any system can
 *  stage any other; capital scales with distance via polityChangePc. */ function polityReachable(
  from: any,
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
/** Political capital to stage a polity change. Adjacent uses the target's
 *  changePc; leaping democracy ↔ authoritarian adds POLITY_LEAP_EXTRA. */ const POLITY_LEAP_EXTRA = 32;
function polityChangePc(from: any, to: any) {
  const dest = normalisePolityId(to);
  const src = normalisePolityId(from) || "democracy";
  if (!dest || src === dest) return 0;
  const base = POLITY[dest].changePc || 40;
  const steps = politySteps(src, dest);
  return base + Math.max(0, steps - 1) * POLITY_LEAP_EXTRA;
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
    return "Sandbox is on: you cannot be removed from office. Switch to Career any time from the top bar.";
  if (m.kind === "congress") {
    return "Career mode: survive the party congress, keep the apparatus loyal, or the bond market ends you. Political capital recovers slowly. Sandbox is one click away in the top bar.";
  }
  if (m.kind === "managed") {
    return "Career mode: managed ballots still matter, as does your party — or the bond market ends you. Sandbox is one click away in the top bar.";
  }
  return "Career mode: lose an election, a party coup, or the bond market and it is over. Sandbox is one click away in the top bar.";
}
function polityShiftAge() {
  if (!G || !G.polityShift || G.polityShift.q == null) return null;
  return G.q - G.polityShift.q;
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
const ULC_PASS = 0.62; // pass-through of unit labour costs into prices
const IMPORT_PASS = 0.16; // pass-through of import prices
/* ---- Credibility as a stock ----
   How firmly expectations are anchored is not a constant. It is earned by
   keeping inflation near target and lost by missing it, and it decides how much
   weight expectations put on the target rather than on recent experience. */ const CRED_GAIN = 0.035,
  CRED_LOSS = 0.03;
/* ---- Effective lower bound ----
   Policy can cut into mild negative territory (euro-area / Swiss style NIRP).
   At the bound the monetary offset disappears, so fiscal multipliers rise on
   their own and a fall in inflation raises the real rate rather than lowering
   it. Manual mode can go a little deeper for experimentation. */ const RATE_FLOOR =
  -1;
const MANUAL_RATE_MIN = -2;
/* Taylor rule */ /* Policy rates are smoothed heavily in practice: central banks move in steps
   and rarely jump to the rule's prescription in one quarter. At 0.45 the Bank
   was offsetting a fiscal impulse inside the same quarter it landed, which
   cancelled induced consumption entirely and left transfer multipliers near
   zero. */ /* The Phillips curve is convex: nearly flat when there is slack, steep once the
   economy runs hot. A linear curve let an overheating economy generate only
   proportionate inflation, which is exactly the regime where a Chancellor's
   mistakes should start compounding. */ const PI_CONVEX = 1.7;
/* Multipliers are state-dependent (Auerbach & Gorodnichenko): fiscal policy
   works harder in a slump, because more households are liquidity-constrained
   when incomes are falling and there is idle capacity to put back to work. */ const SLACK_MPC = 0.075;
/* Profit shifting. The dominant behavioural response to corporate tax is not
   less investment, it is profits being booked somewhere else. Reported profits
   move by roughly 1.5 to 2 per cent per point of differential against the rest
   of the world. */ const WORLD_CORP = 21,
  SHIFT_ELAST = 0.018;
/* About a quarter of UK gilts are index-linked, so that portion cannot be
   inflated away: its cost rises one-for-one with prices. Long average maturity
   is the other side of the coin, and slows how fast a yield shock reaches the
   interest bill. */ const INDEX_LINKED = 0.25,
  IL_REAL_COUPON = 0.6,
  MATURITY_PASS = 0.045;
const TAYLOR_PI = 0.6,
  TAYLOR_Y = 0.3,
  TAYLOR_SMOOTH = 0.26;
/* Okun */ const OKUN_BETA = 0.35,
  U_ADJ = 0.08;
const LABOUR_SHARE = 0.614; // employment income as a share of GDP
/* Collection factors. The employer figure is reliefs and the employment
   allowance. The employee figure is larger because this model has no upper
   earnings limit: a flat 8% on everything above the allowance would raise far
   more than the UK's 8%-then-2% structure does, so the visible rate stays at
   the real headline and the collected share carries the difference. */ const EMPLOYER_COLLECT = 0.71,
  EMPLOYEE_COLLECT = 0.62;
/* Elasticity of taxable income, rising with income: the top of the tail has the
   accountants. This is what bends the revenue curve, so there is no separate
   Laffer fudge on income. */ const ETI_OF = (inc: any) =>
  0.05 + 0.55 * Math.pow(Math.max(0, Math.min(1, (inc - 40000) / 260000)), 0.7);
/* Above roughly a 45% combined marginal rate, activity stops being avoided and
   starts being hidden. This is what gives the basic rate a revenue peak; the
   ETI above only bends the top of the distribution. */ const informality = (
  mtr: any,
) => 1.7 * Math.pow(Math.max(0, mtr - 0.45), 2);
/* Standard iso-elastic response: declared income moves with the net-of-tax
   rate raised to the elasticity. On this form the revenue-maximising marginal
   rate is 1/(1+e), which is why the top of the distribution turns over near
   60% and the bottom does not turn over until informality bites. */ const MTR_REF = 0.3;
function declaredFactor(inc: any, mtr: any) {
  const m = Math.min(0.95, Math.max(0, mtr));
  const e = ETI_OF(inc);
  return Math.max(
    0.15,
    Math.pow((1 - m) / (1 - MTR_REF), e) * (1 - informality(m)),
  );
}
const DEF_INCOME = {
  on: true,
  allowance: 12570,
  uprate: true,
  bands: [
    {
      from: 12570,
      rate: 20,
    },
    {
      from: 50270,
      rate: 40,
    },
    {
      from: 125140,
      rate: 45,
    },
  ],
  /* Capital income is a share of each slice, taxed separately from labour.
     Progressive: UK-ish dividend and savings rates. Dual: one flat capitalRate. */ divRate: 33,
  saveRate: 20,
  capitalRate: 25,
};
/* Share of gross personal income treated as capital (dividends + savings), and
   the split between those two within the capital slice. */ const CAP_INCOME_SHARE = 0.14;
const DIV_OF_CAPITAL = 0.65;
/* Two rates, nothing else. Real NI carries its own thresholds and an upper
   earnings limit, but those duplicate the income tax bands the player already
   controls, so NI simply starts where income tax starts. What stays is the part
   that is actually distinct: incidence. The employee side comes out of the pay
   packet; the employer side taxes the job, so it feeds structural unemployment
   and prices instead. Either side can be abolished outright. */ const DEF_NI =
  {
    empOn: true,
    erOn: true,
    empRate: 8,
    erRate: 15,
  };
const BAND_NAMES = [
  "Basic",
  "Higher",
  "Additional",
  "Fourth",
  "Fifth",
  "Sixth",
];
/* Pass-through of a point of rate into the CPI basket (first-round price-level
   shift). VAT is large because most of the basket is standard-rated; duties are
   smaller shares. Used by the generalised indirect-tax echo, not as permanent
   inflation. */ const INDIRECT_PASS = {
  vat: 0.38,
  fuel: 0.1,
  carbon: 0.055,
  sugarLevy: 0.035,
  airDuty: 0.012,
  roadPricing: 0.04,
  touristLevy: 0.01,
  alcoholDuty: 0.028,
  tobaccoDuty: 0.022,
  gamblingLevy: 0.014,
  cannabisDuty: 0.016,
  psyDuty: 0.004,
  adultLevy: 0.005,
};
const TARIFF_PASS = 0.045; // first-round CPI from a point of tariff
const TARIFF_IMPORT = 0.035; // ongoing import-price level effect vs BASE_TARIFF
/* --- tax instruments. base = % of GDP raised per point of rate ---
   `imp` is social / compliance only. Macro effects go through `ch` or the tax's
   own base (consumption, assets, volume) and the indirect-tax price wedge. */ /* `pc` is political capital to introduce (abolish costs ~60% of that). Every
   tax is abolishable; ones that start on still need a price for the reverse. */ const TAXES_DEF =
  [
    {
      id: "capGains",
      basis: "assets",
      name: "Capital gains tax",
      grp: "wealth",
      def: 24,
      max: 60,
      base: 0.02292,
      eti: 1.37,
      on: true,
      pc: 12,
      ch: {
        ucost: 0.008,
      },
      fac: {
        business: -0.34,
        workers: 0.08,
      },
    },
    {
      id: "inherit",
      basis: "assets",
      name: "Inheritance tax",
      grp: "wealth",
      def: 40,
      max: 70,
      base: 0.00811,
      eti: 0.538,
      on: true,
      pc: 14,
      fac: {
        pensioners: -0.3,
        rural: -0.22,
        business: -0.1,
        workers: 0.1,
      },
    },
    {
      id: "wealthTax",
      basis: "assets",
      name: "Annual wealth tax",
      grp: "wealth",
      def: 0,
      max: 5,
      step: 0.1,
      base: 0.42,
      eti: 19.0,
      on: false,
      pc: 16,
      imp: {
        eva: 0.12,
      },
      ch: {
        ucost: 0.3,
      },
      fac: {
        business: -5.0,
        workers: 1.6,
        urban: 1.0,
      },
    },
    {
      id: "landTax",
      basis: "assets",
      name: "Land value tax",
      grp: "wealth",
      def: 0,
      max: 6,
      step: 0.1,
      /* Base was 0.85 — a 2.5% LVT alone cleared the books over 30y. */ base: 0.55,
      eti: 10.111,
      on: false,
      pc: 20,
      imp: {
        eva: -0.02,
      },
      ch: {
        ucost: -0.03,
        kboost: 0.08,
      },
      fac: {
        rural: -5.2,
        business: 0.4,
        urban: 1.0,
        pensioners: -1.8,
      },
    },
    {
      id: "vat",
      basis: "consumption",
      name: "Value added tax",
      grp: "consumption",
      def: 20,
      max: 35,
      base: 0.295,
      eti: 0.667,
      on: true,
      pc: 20,
      fac: {
        workers: -0.24,
        pensioners: -0.26,
        business: -0.1,
        urban: -0.14,
      },
    },
    {
      id: "fuel",
      basis: "volume",
      name: "Fuel duty",
      grp: "consumption",
      def: 8,
      max: 25,
      base: 0.11336,
      eti: 1.564,
      on: true,
      pc: 10,
      fac: {
        rural: -0.7,
        business: -0.2,
        urban: 0.1,
      },
    },
    {
      id: "airDuty",
      basis: "consumption",
      name: "Air departure duty",
      grp: "consumption",
      def: 13,
      max: 45,
      base: 0.01067,
      eti: 1.326,
      on: true,
      pc: 6,
      fac: {
        business: -0.1,
        urban: -0.08,
      },
    },
    {
      id: "sugarLevy",
      basis: "consumption",
      name: "Sugar and salt levy",
      grp: "consumption",
      def: 0,
      max: 30,
      base: 0.018,
      eti: 1.941,
      on: false,
      pc: 6,
      imp: {
        hlt: 0.03,
      },
      fac: {
        business: -0.14,
        rural: -0.08,
        urban: 0.1,
      },
    },
    {
      id: "carbon",
      basis: "consumption",
      name: "Carbon price",
      grp: "consumption",
      def: 5,
      max: 45,
      base: 0.04486,
      eti: 0.923,
      on: true,
      pc: 8,
      imp: {
        env: 0.05,
      },
      ch: {
        ucost: 0.006,
      },
      fac: {
        business: -0.26,
        rural: -0.2,
        urban: 0.22,
      },
    },
    {
      id: "roadPricing",
      basis: "consumption",
      name: "Road pricing",
      grp: "consumption",
      def: 0,
      max: 20,
      base: 0.055,
      eti: 3.545,
      on: false,
      pc: 14,
      ch: {
        ucost: 0.004,
        kboost: 0.05,
      },
      fac: {
        rural: -1.1,
        urban: 0.45,
        business: -0.2,
      },
    },
    {
      id: "touristLevy",
      basis: "consumption",
      name: "Visitor levy",
      grp: "consumption",
      def: 0,
      max: 20,
      base: 0.02,
      eti: 3.545,
      on: false,
      pc: 5,
      fac: {
        business: -0.18,
        urban: 0.1,
        rural: 0.1,
      },
    },
    {
      id: "corpTax",
      basis: "profits",
      name: "Corporation tax",
      grp: "corporate",
      def: 25,
      max: 50,
      base: 0.1318,
      eti: 1.05,
      /* see note on the corporate tax conflict */ on: true,
      pc: 18,
      fac: {
        business: -0.52,
        workers: 0.14,
      },
    },
    {
      id: "digitalTax",
      basis: "profits",
      name: "Digital services tax",
      grp: "corporate",
      def: 2,
      max: 15,
      base: 0.05469,
      eti: 5.667,
      on: true,
      pc: 10,
      fac: {
        business: -0.3,
        urban: 0.1,
      },
      trade: {
        united_states: -0.8,
      },
    },
    {
      id: "ftt",
      basis: "assets",
      name: "Financial transaction tax",
      grp: "corporate",
      def: 0,
      max: 1,
      step: 0.05,
      base: 1.8,
      eti: 99.0,
      on: false,
      pc: 15,
      imp: {
        eva: 0.1,
      },
      ch: {
        ucost: 0.35,
      },
      fac: {
        business: -6.0,
        workers: 2.2,
        urban: 1.0,
      },
    },
    {
      id: "windfall",
      basis: "profits",
      name: "Energy windfall levy",
      grp: "corporate",
      def: 0,
      max: 80,
      base: 0.019,
      eti: 0.299,
      on: false,
      pc: 8,
      ch: {
        ucost: 0.004,
      },
      fac: {
        business: -0.24,
        workers: 0.16,
        pensioners: 0.14,
      },
    },
    {
      id: "alcoholDuty",
      basis: "consumption",
      name: "Alcohol duty",
      grp: "vice",
      def: 12,
      max: 45,
      base: 0.02332,
      eti: 1.564,
      on: true,
      pc: 6,
      req: ["alcohol", "legal", "liberal"],
      imp: {
        hlt: 0.012,
        blk: 0.01,
      },
      fac: {
        workers: -0.16,
        rural: -0.1,
      },
    },
    {
      id: "tobaccoDuty",
      basis: "consumption",
      name: "Tobacco duty",
      grp: "vice",
      def: 55,
      max: 95,
      base: 0.01736,
      eti: 0.22,
      on: true,
      pc: 8,
      req: ["tobacco", "legal", "liberal"],
      imp: {
        hlt: 0.01,
        blk: 0.016,
      },
      fac: {
        workers: -0.1,
        patriots: -0.08,
      },
    },
    {
      id: "gamblingLevy",
      basis: "consumption",
      name: "Gambling levy",
      grp: "vice",
      def: 15,
      max: 60,
      base: 0.01703,
      eti: 0.923,
      on: true,
      pc: 6,
      req: ["gambling", "legal", "liberal"],
      imp: {
        hlt: 0.008,
        blk: 0.014,
      },
      fac: {
        business: -0.16,
      },
    },
    {
      id: "cannabisDuty",
      basis: "consumption",
      name: "Cannabis duty",
      grp: "vice",
      def: 0,
      max: 60,
      base: 0.021,
      eti: 0.923,
      on: false,
      pc: 4,
      req: ["cannabis", "legal"],
      imp: {
        blk: 0.022,
      },
      fac: {},
    },
    {
      id: "psyDuty",
      basis: "consumption",
      name: "Psychedelics duty",
      grp: "vice",
      def: 0,
      max: 50,
      base: 0.006,
      eti: 1.326,
      on: false,
      pc: 4,
      req: ["psychedelics", "legal"],
      imp: {
        blk: 0.018,
      },
      fac: {},
    },
    {
      id: "adultLevy",
      basis: "consumption",
      name: "Licensed adult services levy",
      grp: "vice",
      def: 0,
      max: 40,
      base: 0.008,
      eti: 1.941,
      on: false,
      pc: 5,
      req: ["adult", "licensed"],
      imp: {
        blk: 0.02,
      },
      fac: {},
    },
    {
      id: "stampDuty",
      basis: "assets",
      name: "Property transaction tax",
      grp: "wealth",
      def: 0,
      max: 15,
      step: 0.5,
      base: 0.085,
      eti: 2.2,
      on: false,
      pc: 10,
      ch: {
        kboost: -0.02,
      },
      fac: {
        urban: -0.22,
        workers: -0.12,
        business: -0.1,
        rural: 0.06,
      },
    },
    {
      id: "bankLevy",
      basis: "profits",
      name: "Bank levy",
      grp: "corporate",
      def: 0,
      max: 10,
      step: 0.1,
      base: 0.095,
      eti: 1.8,
      on: false,
      pc: 12,
      fac: {
        business: -0.3,
        workers: 0.1,
        urban: 0.1,
      },
    },
    {
      id: "businessRates",
      basis: "assets",
      name: "Business property levy",
      grp: "wealth",
      def: 0,
      max: 8,
      step: 0.1,
      base: 0.22,
      eti: 1.4,
      on: false,
      pc: 8,
      fac: {
        business: -0.4,
        workers: 0.08,
        urban: -0.14,
      },
    },
  ] as const satisfies Tax[];
type TaxId = (typeof TAXES_DEF)[number]["id"];
/* Widened view of TAXES_DEF: every call site below reads TAXES expecting the
   uniform Tax shape (optional fields present-or-undefined), not the narrow
   per-element literal types `as const` produces. TaxId above is the only
   thing that needs the literal types. */
const TAXES = TAXES_DEF as Tax[];
const TAX_BY_ID: Record<string, Tax> = Object.fromEntries(
  TAXES.map((t) => [t.id, t]),
);
/* --- the structure of the tax system itself ---
   Growth effects come from lighter labour wedges (part), lower capital costs
   (ucost) and land-use (kboost), not from a pot fudge. Inequality is derived
   from the post-tax income distribution. */ const REGIMES = [
  {
    id: "progressive",
    name: "Progressive bands",
    pc: 0,
    blurb:
      "Graduated rates on income, separate rates on capital. What {C} has always done.",
    mult: {},
    imp: {},
    fac: {},
  },
  {
    id: "flat",
    name: "Flat tax",
    pc: 34,
    blurb:
      "One rate on all income above an allowance. The additional rate is abolished and collection gets cheaper.",
    mult: {
      income: 0.88,
    },
    imp: {
      eva: -0.05,
    },
    ch: {
      part: 0.35,
      ucost: -0.06,
    },
    fac: {
      business: 7,
      workers: -7,
      urban: -5,
      pensioners: -2,
    },
    flatIncome: true,
  },
  {
    id: "consumption",
    name: "Consumption-led",
    pc: 32,
    blurb:
      "Tax what people spend, not what they earn. Income tax bases shrink, VAT and duties do the heavy lifting.",
    mult: {
      income: 0.72,
      consumption: 1.35,
    },
    ch: {
      part: 0.25,
      ucost: -0.08,
    },
    fac: {
      business: 5,
      workers: -5,
      pensioners: -5,
      urban: -2,
    },
  },
  {
    id: "landValue",
    name: "Land value shift",
    pc: 38,
    blurb:
      "Tax the unimproved value of land and lighten the load on work. Economists approve. Landowners do not.",
    mult: {
      income: 0.9,
      wealth: 2.4,
    },
    ch: {
      part: 0.2,
      ucost: -0.12,
      kboost: 0.28,
    },
    fac: {
      rural: -11,
      business: 3,
      urban: 4,
      pensioners: -4,
    },
  },
  {
    id: "dual",
    name: "Dual income system",
    pc: 28,
    blurb:
      "Labour income taxed progressively, capital income at a single flat rate. Broad base, fewer leaks.",
    mult: {
      wealth: 1.55,
      income: 0.95,
    },
    imp: {
      eva: -0.08,
    },
    ch: {
      ucost: -0.04,
    },
    fac: {
      business: 2,
      workers: 1,
    },
    dualCapital: true,
  },
] as const satisfies Regime[];
type RegimeId = (typeof REGIMES)[number]["id"];
const REGIME_BY_ID: Record<string, Regime> = Object.fromEntries(
  REGIMES.map((r) => [r.id, r]),
);
/* --- policies. cost is % of GDP per year; pc is political capital ---
   `imp` is the social layer (services, liberty, crime, health, environment,
   evasion, black market). Macro effects belong in `ch`: labour supply, capital,
   TFP, user cost, replacement ratio, migration, housing supply. Inequality is
   derived from the income distribution where the policy changes transfers or
   wages, not authored as a Gini override. */ const POLICIES = [
  {
    id: "childcare",
    name: "Universal childcare",
    cat: "Work",
    cost: 0.85,
    pc: 12,
    blurb:
      "Free places from nine months. Pulls a lot of second earners back into work.",
    ch: {
      part: 2.5,
      fertility: 2.6,
      tfp: 0.04,
    },
    fac: {
      workers: 5,
      urban: 4,
      business: 2,
      pensioners: -1,
    },
  },
  {
    id: "ubi",
    name: "Universal basic income",
    cat: "Welfare",
    cost: 5.2,
    pc: 32,
    blurb:
      "An unconditional payment to every adult, replacing most of the means-tested system.",
    ch: {
      replace: 2.6,
      mpcw: 6.0,
      part: -1.1,
    },
    fac: {
      workers: 7,
      urban: 6,
      pensioners: 2,
      business: -8,
      rural: -2,
    },
  },
  {
    id: "fourDay",
    name: "Four-day week in the public sector",
    cat: "Work",
    cost: 0.5,
    pc: 14,
    blurb: "Same pay, fewer hours. A trial everyone will treat as permanent.",
    ch: {
      part: -1.4,
    },
    fac: {
      workers: 6,
      urban: 3,
      business: -5,
    },
  },
  {
    id: "minWage",
    name: "Living wage uprating",
    cat: "Work",
    cost: 0.15,
    pc: 10,
    blurb: "Statutory minimum pegged to two thirds of median earnings.",
    ch: {
      replace: 1.0,
      mpcw: 4.0,
    },
    fac: {
      workers: 6,
      business: -6,
      rural: -2,
    },
  },
  {
    id: "dereg",
    name: "Labour market deregulation",
    cat: "Work",
    cost: 0,
    pc: 18,
    blurb:
      "Lighter dismissal rules and fewer sectoral protections. Hiring gets easier both ways.",
    ch: {
      replace: -2.2,
      part: 0.8,
      tfp: 0.1,
    },
    fac: {
      business: 8,
      workers: -9,
      urban: -2,
    },
    kills: ["fourDay", "zeroHoursBan"],
  },
  {
    id: "rentCtrl",
    name: "Rent controls",
    cat: "Housing",
    cost: 0,
    pc: 12,
    blurb: "Caps on in-tenancy increases. Relief now, less building later.",
    ch: {
      kboost: -0.25,
    },
    fac: {
      urban: 7,
      workers: 3,
      business: -5,
    },
  },
  {
    id: "planning",
    name: "Planning liberalisation",
    cat: "Housing",
    cost: 0,
    pc: 22,
    blurb:
      "Presumption in favour of development. The single biggest thing you can do to trend growth, and the most hated.",
    ch: {
      kboost: 0.38,
      tfp: 0.05,
    },
    fac: {
      rural: -10,
      urban: 5,
      business: 5,
    },
    kills: ["greenBelt"],
  },
  {
    id: "socialHousing",
    name: "Mass social housebuilding",
    cat: "Housing",
    cost: 1.4,
    pc: 14,
    blurb: "Three hundred thousand public homes a year.",
    ch: {
      kboost: 0.35,
      hbuild: 1.4,
    },
    fac: {
      workers: 5,
      urban: 5,
      business: 1,
      rural: -2,
    },
    kills: ["stockSales"],
  },
  {
    id: "tuition",
    name: "Abolish tuition fees",
    cat: "Education",
    cost: 0.85,
    pc: 12,
    blurb: "Publicly funded higher education, restored.",
    ch: {
      tfp: 0.07,
      part: 0.3,
    },
    fac: {
      urban: 6,
      workers: 3,
      business: -1,
      pensioners: -2,
    },
  },
  {
    id: "skills",
    name: "National skills guarantee",
    cat: "Education",
    cost: 0.5,
    pc: 8,
    blurb: "Retraining entitlement at any age, delivered through colleges.",
    ch: {
      tfp: 0.09,
      replace: -1.2,
      part: 0.4,
      hbuild: 0.35,
    },
    fac: {
      workers: 3,
      business: 3,
    },
  },
  {
    id: "tripleLock",
    name: "Pension triple lock",
    cat: "Welfare",
    cost: 0.35,
    pc: 10,
    blurb:
      "Pensions rise by the highest of earnings, prices or 2.5%. The cost compounds forever.",
    imp: {},
    fac: {
      pensioners: 9,
      workers: -2,
      urban: -3,
    },
    tripleLock: true,
  },
  {
    id: "socialCare",
    name: "Free personal social care",
    cat: "Welfare",
    cost: 0.85,
    pc: 14,
    blurb: "Care costs met from general taxation, and hospital beds freed up.",
    imp: {
      srv: 5,
      hlt: 0.7,
    },
    ch: {
      part: 1.25,
    },
    fac: {
      pensioners: 8,
      workers: 3,
      business: -2,
    },
  },
  {
    id: "swf",
    name: "Sovereign wealth fund",
    cat: "Economy",
    cost: 1.0,
    pc: 18,
    blurb:
      "Put a slice of receipts away every year. Boring, and your successors will thank you.",
    imp: {},
    fac: {
      business: 3,
      patriots: 3,
      workers: -1,
    },
    fund: true,
  },
  {
    id: "rnd",
    name: "Research credits and industrial strategy",
    cat: "Economy",
    cost: 0.55,
    pc: 8,
    blurb:
      "Generous expensing that pulls private labs into the public research effort.",
    /* Additionality ~1:1 with the fiscal cost (HMRC finds higher). The effort
       builds R for TFP and also enters investment demand — labs spend now. */ ch: {
      rndEffort: 0.55,
    },
    fac: {
      business: 5,
      workers: 1,
    },
  },
  {
    id: "nationalise",
    name: "Public ownership of rail and water",
    cat: "Economy",
    cost: 2.2,
    pc: 28,
    blurb:
      "Buy back the networks at regulated asset value. Expensive, popular, irreversible in practice.",
    imp: {
      srv: 3,
    },
    ch: {
      ucost: 0.35,
    },
    fac: {
      workers: 8,
      urban: 5,
      pensioners: 2,
      business: -12,
    },
  },
  {
    id: "nuclear",
    name: "Civil nuclear programme",
    cat: "Energy & climate",
    cost: 0.9,
    pc: 14,
    blurb:
      "Six reactors and a small modular pipeline. Insulates you from the next energy shock.",
    imp: {
      env: 4,
    },
    ch: {
      kboost: 0.35,
      ucost: -0.12,
    },
    fac: {
      business: 4,
      patriots: 4,
      urban: -2,
      rural: -3,
    },
    resilience: 0.5,
  },
  {
    id: "netZero",
    name: "Binding net zero pathway",
    cat: "Energy & climate",
    cost: 0.7,
    pc: 16,
    blurb: "Statutory carbon budgets with legal teeth.",
    imp: {
      env: 9,
    },
    ch: {
      ucost: 0.2,
    },
    fac: {
      urban: 7,
      business: -4,
      rural: -5,
    },
  },
  {
    id: "cbam",
    name: "Carbon border adjustment",
    cat: "Energy & climate",
    cost: 0,
    pc: 12,
    blurb:
      "Charge imports for the carbon they embody. Protects your industry, annoys everyone else's.",
    imp: {
      env: 3,
    },
    ch: {
      tariffCut: -1.4,
    },
    fac: {
      business: 3,
      urban: 2,
      patriots: 2,
    },
    trade: -1.0,
  },
  {
    id: "rewild",
    name: "Land restoration programme",
    cat: "Energy & climate",
    cost: 0.35,
    pc: 6,
    blurb: "Peat, woodland and river catchments, at scale.",
    imp: {
      env: 5,
    },
    fac: {
      urban: 3,
      rural: -4,
    },
  },
  {
    id: "prisonReform",
    name: "Sentencing and prison reform",
    cat: "Justice",
    cost: -0.25,
    pc: 12,
    blurb:
      "Fewer short sentences, more community disposals. Saves money, costs headlines.",
    imp: {
      cri: 3,
      lib: 6,
    },
    fac: {
      urban: 4,
      patriots: -7,
      rural: -3,
    },
  },
  {
    id: "police",
    name: "Neighbourhood policing expansion",
    cat: "Justice",
    cost: 0.45,
    pc: 6,
    blurb: "Twenty thousand officers back on the beat.",
    imp: {
      cri: -6,
      lib: -2,
    },
    fac: {
      rural: 5,
      patriots: 5,
      pensioners: 4,
      urban: -1,
    },
  },
  {
    id: "digitalId",
    name: "Digital identity and real-time tax reporting",
    cat: "State",
    cost: 0.3,
    pc: 22,
    blurb:
      "Every transaction visible to the revenue. Evasion collapses. So does privacy.",
    imp: {
      eva: -0.35,
      lib: -10,
    },
    fac: {
      business: 2,
      urban: -6,
      patriots: -7,
    },
  },
  {
    id: "openVisas",
    name: "Open work visas",
    cat: "Borders",
    cost: 0,
    pc: 18,
    blurb: "Uncapped routes for shortage occupations.",
    ch: {
      migrate: 0.7,
      replace: -0.6,
    },
    fac: {
      business: 7,
      urban: 3,
      patriots: -13,
      rural: -5,
    },
    kills: ["closeBorders"],
  },
  {
    id: "closeBorders",
    name: "Strict migration caps",
    cat: "Borders",
    cost: 0.2,
    pc: 14,
    blurb: "Hard numerical limits across every route.",
    ch: {
      migrate: -1.15,
    },
    fac: {
      patriots: 12,
      rural: 5,
      business: -8,
      urban: -5,
    },
    kills: ["openVisas"],
  },
  {
    id: "conscript",
    name: "National service",
    cat: "State",
    cost: 0.6,
    pc: 16,
    blurb: "A year of civic or military service at eighteen.",
    ch: {
      labour: -0.55,
    },
    fac: {
      patriots: 10,
      pensioners: 4,
      rural: 2,
      urban: -8,
      workers: -3,
    },
  },
  {
    id: "fiscalRule",
    name: "Statutory debt rule",
    cat: "State",
    cost: 0,
    pc: 10,
    blurb:
      "Debt must fall as a share of GDP within five years. Buys credibility, removes your excuses.",
    imp: {},
    fac: {
      business: 5,
      pensioners: 2,
    },
    rule: true,
  },
  {
    id: "fracking",
    name: "Shale and fracking licence",
    cat: "Energy & climate",
    cost: 0.15,
    pc: 14,
    blurb:
      "Licences for onshore shale. Cheaper gas and less import exposure, paid for in the countryside.",
    imp: {
      env: -6,
    },
    ch: {
      ucost: -0.22,
    },
    fac: {
      business: 6,
      patriots: 4,
      rural: -8,
      urban: -5,
    },
    resilience: 0.45,
    kills: ["hydroPause"],
  },
  {
    id: "energyBills",
    name: "Household energy bill support",
    cat: "Energy & climate",
    cost: 1.1,
    pc: 10,
    blurb:
      "A temporary cap on household energy bills, paid from general taxation.",
    imp: {
      hlt: 0.2,
    },
    ch: {
      mpcw: 3.5,
    },
    fac: {
      workers: 5,
      pensioners: 6,
      rural: 3,
      business: -3,
    },
  },
  {
    id: "firstHome",
    name: "First-home buyer support",
    cat: "Housing",
    cost: 0.45,
    pc: 10,
    blurb:
      "Guarantees and deposits for first-time buyers. Demand up; prices follow.",
    ch: {
      kboost: 0.15,
      hbuild: 0.2,
    },
    fac: {
      urban: 4,
      workers: 3,
      rural: -2,
      business: 2,
    },
  },
  {
    id: "stockSales",
    name: "Social housing stock sales",
    cat: "Housing",
    cost: -0.4,
    pc: 12,
    blurb:
      "Sell the existing public housing stock to tenants and investors. Cash now, fewer homes later.",
    ch: {
      hbuild: -0.8,
      kboost: -0.1,
    },
    fac: {
      workers: -4,
      urban: -5,
      business: 4,
      rural: 2,
    },
    kills: ["socialHousing"],
  },
  {
    id: "apprentices",
    name: "Apprenticeship and college expansion",
    cat: "Education",
    cost: 0.4,
    pc: 8,
    blurb:
      "Funded places in technical colleges and apprenticeships. Builds skills with a lag.",
    ch: {
      hbuild: 0.55,
      tfp: 0.04,
      replace: -0.5,
      part: 0.25,
    },
    fac: {
      workers: 4,
      business: 3,
      rural: 2,
    },
  },
  {
    id: "greenBelt",
    name: "Protected countryside",
    cat: "Housing",
    cost: 0,
    pc: 12,
    blurb:
      "Statutory protection for green belts and valued landscapes. Building gets harder.",
    ch: {
      kboost: -0.35,
      hbuild: -0.4,
    },
    fac: {
      rural: 8,
      patriots: 4,
      urban: -6,
      business: -5,
    },
    kills: ["planning"],
  },
  {
    id: "zeroHoursBan",
    name: "Ban on zero-hours contracts",
    cat: "Work",
    cost: 0.1,
    pc: 12,
    blurb:
      "Every job must carry guaranteed hours. Security for workers, rigidity for firms.",
    ch: {
      replace: 0.8,
      part: -0.3,
    },
    fac: {
      workers: 7,
      business: -8,
      urban: 2,
    },
    kills: ["dereg"],
  },
  {
    id: "evictionBan",
    name: "No-fault eviction ban",
    cat: "Housing",
    cost: 0.05,
    pc: 10,
    blurb:
      "Landlords need a reason to end a tenancy. Security without a hard rent cap.",
    ch: {
      kboost: -0.08,
    },
    fac: {
      urban: 6,
      workers: 4,
      business: -5,
    },
  },
  {
    id: "waitingList",
    name: "Elective waiting-list recovery",
    cat: "Welfare",
    cost: 0.85,
    pc: 10,
    blurb:
      "A dedicated fund to clear the backlog of elective procedures and outpatient waits.",
    imp: {
      srv: 5,
      hlt: 0.6,
    },
    fac: {
      pensioners: 5,
      workers: 4,
      urban: 3,
      business: -2,
    },
  },
  {
    id: "winterMeans",
    name: "Means-test winter energy payment",
    cat: "Welfare",
    cost: -0.25,
    pc: 8,
    blurb:
      "Restrict the winter energy payment to lower incomes. Saves money; pensioners notice.",
    fac: {
      pensioners: -8,
      workers: 2,
      business: 1,
    },
  },
  {
    id: "hydroPause",
    name: "Domestic hydrocarbon licensing pause",
    cat: "Energy & climate",
    cost: 0.1,
    pc: 12,
    blurb:
      "No new licences for oil and gas extraction. Cleaner, and more exposed to import prices.",
    imp: {
      env: 5,
    },
    ch: {
      ucost: 0.18,
    },
    fac: {
      urban: 5,
      rural: -4,
      business: -3,
      patriots: -2,
    },
    resilience: -0.25,
    kills: ["fracking"],
  },
] as const satisfies Policy[];
type PolicyId = (typeof POLICIES)[number]["id"];
const POLICY_BY_ID: Record<string, Policy> = Object.fromEntries(
  POLICIES.map((p) => [p.id, p]),
);
/* --- what is legal, and on what terms --- */ const VICE = [
  {
    id: "cannabis",
    name: "Cannabis",
    pc: 14,
    tax: "cannabisDuty",
    states: [
      {
        id: "banned",
        label: "Prohibited",
        blurb: "Possession and supply are criminal offences.",
        imp: {
          blk: 9,
          cri: 5,
          lib: -4,
        },
        fac: {
          patriots: 3,
          pensioners: 3,
          rural: 2,
          urban: -3,
        },
      },
      {
        id: "decrim",
        label: "Decriminalised",
        blurb:
          "Possession is a civil matter. Supply stays criminal, so the market stays illegal.",
        imp: {
          blk: 6,
          cri: 1,
          lib: 3,
          hlt: 0.2,
        },
        fac: {
          urban: 3,
          patriots: -2,
          pensioners: -2,
        },
      },
      {
        id: "legal",
        label: "Legal & regulated",
        blurb:
          "Licensed retail, potency limits, and a duty you can actually collect.",
        imp: {
          blk: -1,
          cri: -4,
          lib: 6,
          hlt: -0.3,
        },
        fac: {
          urban: 6,
          workers: 2,
          patriots: -5,
          pensioners: -6,
          rural: -3,
        },
      },
    ],
  },
  {
    id: "psychedelics",
    name: "Psychedelics",
    pc: 12,
    tax: "psyDuty",
    states: [
      {
        id: "banned",
        label: "Prohibited",
        blurb: "Schedule one. No research exemptions.",
        imp: {
          lib: -2,
        },
        fac: {
          pensioners: 2,
        },
      },
      {
        id: "medical",
        label: "Medical use",
        blurb: "Licensed clinical use for treatment-resistant conditions.",
        imp: {
          lib: 3,
          hlt: 0.5,
        },
        fac: {
          urban: 4,
          pensioners: -1,
        },
      },
      {
        id: "legal",
        label: "Legal & regulated",
        blurb: "Supervised adult access through licensed centres.",
        imp: {
          lib: 6,
          hlt: 0.2,
          blk: -1,
        },
        fac: {
          urban: 5,
          patriots: -4,
          pensioners: -6,
          rural: -3,
        },
      },
    ],
  },
  {
    id: "gambling",
    name: "Gambling",
    pc: 10,
    tax: "gamblingLevy",
    states: [
      {
        id: "banned",
        label: "Prohibited",
        blurb: "All commercial gambling outlawed. The market moves offshore.",
        imp: {
          blk: 11,
          cri: 4,
          lib: -6,
          hlt: 1.2,
        },
        fac: {
          pensioners: 2,
          patriots: 1,
          business: -4,
          workers: -3,
        },
      },
      {
        id: "legal",
        label: "Restricted",
        blurb: "Licensed operators, advertising limits, affordability checks.",
        imp: {
          hlt: 0.2,
        },
        fac: {},
      },
      {
        id: "liberal",
        label: "Liberalised",
        blurb:
          "Light-touch licensing and open advertising. Receipts rise, so do harms.",
        imp: {
          hlt: -1.4,
          cri: 1,
        },
        fac: {
          business: 5,
          workers: -2,
          urban: -3,
          pensioners: -3,
        },
      },
    ],
  },
  {
    id: "alcohol",
    name: "Alcohol",
    pc: 12,
    tax: "alcoholDuty",
    states: [
      {
        id: "banned",
        label: "Prohibition",
        blurb: "A bold experiment with a well-documented history.",
        imp: {
          blk: 22,
          cri: 14,
          lib: -12,
          hlt: 1.0,
        },
        fac: {
          workers: -14,
          rural: -9,
          urban: -11,
          business: -8,
          pensioners: -3,
        },
      },
      {
        id: "legal",
        label: "Regulated",
        blurb: "Licensing hours, minimum unit pricing, age checks.",
        imp: {},
        fac: {},
      },
      {
        id: "liberal",
        label: "Liberalised",
        blurb: "Longer hours, cheaper units, fewer licensing conditions.",
        imp: {
          hlt: -1.0,
          cri: 2,
        },
        fac: {
          workers: 3,
          business: 3,
          urban: 2,
          pensioners: -3,
        },
      },
    ],
  },
  {
    id: "tobacco",
    name: "Tobacco",
    pc: 12,
    tax: "tobaccoDuty",
    states: [
      {
        id: "banned",
        label: "Generational ban",
        blurb:
          "Nobody born after a certain year may ever be sold tobacco. The duty base dies with the cohort.",
        imp: {
          blk: 9,
          hlt: 2.2,
          lib: -5,
        },
        fac: {
          urban: 3,
          pensioners: 2,
          workers: -4,
          business: -3,
          patriots: -4,
        },
      },
      {
        id: "legal",
        label: "Regulated",
        blurb: "Plain packaging, display bans, high duty.",
        imp: {},
        fac: {},
      },
      {
        id: "liberal",
        label: "Liberalised",
        blurb: "Relaxed packaging and advertising rules.",
        imp: {
          hlt: -1.6,
        },
        fac: {
          business: 3,
          workers: 1,
          urban: -4,
        },
      },
    ],
  },
  {
    id: "adult",
    name: "Adult services",
    pc: 12,
    tax: "adultLevy",
    states: [
      {
        id: "banned",
        label: "Criminalised",
        blurb:
          "Purchase and sale both prosecuted. The trade continues out of sight.",
        imp: {
          blk: 8,
          cri: 5,
          lib: -5,
          hlt: 0.6,
        },
        fac: {
          pensioners: 3,
          patriots: 2,
          urban: -3,
        },
      },
      {
        id: "decrim",
        label: "Decriminalised",
        blurb: "No prosecutions, no licensing regime, no receipts.",
        imp: {
          blk: 4,
          cri: -2,
          lib: 4,
        },
        fac: {
          urban: 3,
          pensioners: -3,
        },
      },
      {
        id: "licensed",
        label: "Licensed & regulated",
        blurb:
          "Licensed premises, health checks, employment rights and a levy.",
        imp: {
          blk: -2,
          cri: -5,
          lib: 6,
          hlt: 0.4,
        },
        fac: {
          urban: 4,
          workers: 2,
          pensioners: -6,
          patriots: -4,
          rural: -3,
        },
      },
    ],
  },
] as const satisfies Vice[];
type ViceId = (typeof VICE)[number]["id"];
const VICE_BY_ID: Record<string, Vice> = Object.fromEntries(
  VICE.map((v) => [v.id, v]),
);
/* --- the rest of the world ---
   `tradeShare` is the partner's weight in bilateral exports (sums to 0.96; the
   residual 0.04 is the rest of the world in the gravity block). */ const PARTNERS =
  COUNTRIES;
const TRADE_REST_SHARE = 0.04;
const GRAVITY_Y = 0.65; // elasticity of bilateral exports to partner income
const DEAL_BY_ID: Record<string, any> = {};
COUNTRIES.forEach((p) =>
  (p.deals || []).forEach((d) => {
    d.partner = p.id;
    (DEAL_BY_ID as any)[d.id] = d;
  }),
);
/* Diplomatic missions: one-shot bill clauses that add a decaying relImpulse
   rather than a permanent jump mean-reversion would eat in a quarter.
   Improve = summit; deter ladder = protest → ultimatum → sanctions.
   Economic goodwill lives in summit/event options, not a separate mission. */
const MISSIONS = [
  {
    id: "summit",
    name: "State visit / summit",
    pc: 8,
    impulse: 10,
    fac: {
      patriots: -2,
      business: 1,
    },
  },
  {
    id: "demarche",
    name: "Formal protest",
    pc: 4,
    impulse: -5,
    fac: {
      patriots: 4,
      business: -1,
    },
  },
  {
    id: "sanctionsPosture",
    name: "Restrictive measures",
    pc: 10,
    impulse: -14,
    fac: {
      patriots: 6,
      business: -5,
    },
    retalNudge: 0.8,
    uncertainty: 0.15,
  },
] as const satisfies Mission[];
type MissionId = (typeof MISSIONS)[number]["id"];
const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);
const MISSION_CD = 3;
const REL_IMPULSE_DECAY = 0.78;

/** Drop unknown missions and sanctions staged against a live state visit. */
function pruneInvalidDraftMissions(g: any) {
  const state = g || (typeof G !== "undefined" ? G : null);
  if (!state || !state.draft || !state.draft.missions) return;
  for (const pid of Object.keys(state.draft.missions)) {
    const mid = state.draft.missions[pid];
    if (!MISSION_BY_ID[mid]) {
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
  };
}

function relationModifiers(partnerId: any, g: any, law: any) {
  const state = g || G;
  const L = law || (state && state.law);
  return buildRelationModifiers(partnerId, state, L, diploDeps()).mods;
}

function relationTarget(partnerId: any, g?: any, law?: any) {
  const state = g || G;
  const L = law || (state && state.law);
  return buildRelationModifiers(partnerId, state, L, diploDeps()).target;
}

const canIssueUltimatum = (partnerId: any, g?: any) =>
  canIssueUltimatumCore(partnerId, g || G, diploDeps());

function assignEnvoy(partnerId: any) {
  if (!G || !partnerId) return false;
  if (!G.envoys) G.envoys = emptyEnvoys();
  /* Idempotent: already posted is success (rapid clicks / UI ahead of BE). */
  if (G.envoys.includes(partnerId)) return true;
  if ((G.capital || 0) < ENVOY_ASSIGN_PC) return false;
  const slot = G.envoys.indexOf(null);
  if (slot < 0) return false;
  G.capital = clamp(G.capital - ENVOY_ASSIGN_PC, 0, 100);
  G.envoys[slot] = partnerId;
  if (!G.envoySpend) G.envoySpend = {};
  G.envoySpend[partnerId] = ENVOY_ASSIGN_PC;
  return true;
}

function recallEnvoy(partnerId: any) {
  if (!G || !partnerId) return true;
  if (!G.envoys) return true;
  const i = G.envoys.indexOf(partnerId);
  /* Idempotent: already vacant is the desired state. */
  if (i < 0) return true;
  if (ENVOY_RECALL_PC > 0) {
    if ((G.capital || 0) < ENVOY_RECALL_PC) return false;
    G.capital = clamp(G.capital - ENVOY_RECALL_PC, 0, 100);
  }
  G.envoys[i] = null;
  /* Same-quarter assign can be undone — refund the capital that was spent. */
  if (G.envoySpend && G.envoySpend[partnerId]) {
    G.capital = clamp((G.capital || 0) + G.envoySpend[partnerId], 0, 100);
    delete G.envoySpend[partnerId];
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
};

/** Alerts not yet shown on a morning note / press strip.
 *  Mid-quarter answers can land before Deliver bumps q, so we also accept
 *  `a.q === qNow - 1` — but only until `noted` is set. */
function diploOutcomeAlertsForBrief(alerts: any, q: any) {
  const qNow = q != null ? q : 0;
  return (alerts || []).filter((a: any) => {
    if (!a || !(DIPLO_OUTCOME_KINDS as any)[a.kind] || a.noted) return false;
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
  const name = p ? p.name : targetId;
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
  if (!G || !partnerId) return false;
  ensureDiploStocks(G.econ);
  const existing = G.ultimatums && G.ultimatums[partnerId];
  /* Idempotent: a live ultimatum is already the desired state. */
  if (existing && existing.status === "pending") return true;
  const check = canIssueUltimatumCore(partnerId, G, diploDeps());
  if (!check.ok) return false;
  const demands = ultimatumDemandsFor(partnerId, G, diploDeps());
  const pick = demandId
    ? demands.find((d) => d.id === demandId) || {
        id: demandId,
        label: demandId,
      }
    : demands[0];
  if (!pick) return false;
  G.capital = clamp(G.capital - ULTIMATUM_PC, 0, 100);
  if (!G.ultimatums) G.ultimatums = {};
  const awaitHuman = isHumanMpSeat(G, partnerId);
  G.ultimatums[partnerId] = {
    demand: pick.id,
    label: pick.label,
    policyKey: pick.policyKey,
    sentQ: G.q,
    expiresQ: G.q + ULTIMATUM_WAIT,
    status: "pending",
    ...(awaitHuman ? { awaitHuman: true } : {}),
  };
  if (awaitHuman) {
    parkInboundUltimatum(
      G,
      playerCountryId(G.homeRole),
      partnerId,
      G.ultimatums[partnerId],
    );
  }
  addDiploLedger(G, partnerId, {
    id: "ultimatum_issued_" + G.q,
    label: "Issued an ultimatum",
    pts: -8,
  });
  if (G.fac) {
    G.fac.patriots = clamp((G.fac.patriots || 50) + 3, 2, 96);
    G.fac.business = clamp((G.fac.business || 50) - 2, 2, 96);
  }
  return true;
}

function processUltimatums(g: any, det: any) {
  const state = g || G;
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
  const prev = G;
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
    G = g;
    g.q = g.q != null ? g.q : 0;
    const issuerPol = mountMpSeatOnSnapshot(g, fromId);
    const ult = (G.ultimatums && G.ultimatums[seatId]) || {
      demand: inbound.demand,
      label: inbound.label,
      policyKey: inbound.policyKey,
    };
    const impacts = finishOutboundUltimatum(G, seatId, ult, !!concede);
    syncMpPoliticsFromG(issuerPol);

    mountMpSeatOnSnapshot(g, seatId);
    pushDiploAlert(G, {
      kind: concede ? "ult_inbound_concede" : "ult_inbound_defy",
      partnerId: fromId,
      demand: inbound.demand,
      label: inbound.label || inbound.demand || "their demand",
      impacts,
      q: G.q,
      expiresQ: (G.q || 0) + 3,
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
    G = prev;
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
  const prev = G;
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
    G = g;
    g.q = g.q != null ? g.q : 0;

    const tPol = mountMpSeatOnSnapshot(g, seatId);
    if (accept) {
      if (countryBlocId(seatId, g.blocMember)) {
        return { ok: false, error: "Already in a trade bloc" };
      }
      /* Same automatic pipeline as AI invitees — issuer can track via
       * blocAccessionByCountry, and re-invites are blocked while ascending. */
      if (!g.blocAccessionByCountry) g.blocAccessionByCountry = {};
      g.blocAccessionByCountry[seatId] = {
        blocId,
        step: 1,
        sinceQ: g.q || 0,
        invitedBy: fromId,
      };
      G.blocAccession = null;
      if (G.fac) {
        G.fac.business = clamp((G.fac.business || 50) + 5, 2, 96);
        G.fac.patriots = clamp((G.fac.patriots || 50) - 6, 2, 96);
      }
      pushDiploAlert(G, {
        kind: "bloc_inbound_accept",
        partnerId: fromId,
        blocId,
        label: blocName,
        q: G.q,
        expiresQ: (G.q || 0) + 3,
      });
    } else {
      if (G.fac) {
        G.fac.patriots = clamp((G.fac.patriots || 50) + 3, 2, 96);
        G.fac.business = clamp((G.fac.business || 50) - 2, 2, 96);
      }
      G.capital = clamp((G.capital || 0) - 2, 0, 100);
      if (fromId && G.rel) {
        G.rel[fromId] = clamp(
          (G.rel[fromId] != null ? G.rel[fromId] : 50) - 2,
          5,
          95,
        );
      }
      pushDiploAlert(G, {
        kind: "bloc_inbound_decline",
        partnerId: fromId,
        blocId,
        label: blocName,
        q: G.q,
        expiresQ: (G.q || 0) + 3,
      });
    }
    tPol.blocAccession = null;
    clearInboundBlocInvite(g, seatId);
    if (g.blocInvites) delete g.blocInvites[seatId];
    syncMpPoliticsFromG(tPol);

    const iPol = mountMpSeatOnSnapshot(g, fromId);
    pushDiploAlert(G, {
      kind: accept ? "bloc_invite_accept" : "bloc_invite_decline",
      partnerId: seatId,
      blocId,
      label: blocName,
      q: G.q,
      expiresQ: (G.q || 0) + 3,
    });
    if (!accept && G.rel) {
      G.rel[seatId] = clamp(
        (G.rel[seatId] != null ? G.rel[seatId] : 50) - 2,
        5,
        95,
      );
    }
    const p = partnerById(seatId);
    const name = p ? p.name : seatId;
    if (G.brief) {
      const note = accept
        ? name + " accepts the invitation to " + blocName + "."
        : name + " declines the invitation to " + blocName + ".";
      G.brief = [note].concat(G.brief).slice(0, 3);
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
    G = prev;
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
  const d = (DEAL_BY_ID as any)[dealId];
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
  const d = (DEAL_BY_ID as any)[dealId];
  const dealName = d ? d.name : inbound.label || dealId;
  const prev = G;
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
    G = g;
    g.q = g.q != null ? g.q : 0;

    if (accept) {
      const issuerSeat = g.world[fromId];
      if (!issuerSeat.law.deals) issuerSeat.law.deals = {};
      issuerSeat.law.deals[dealId] = true;
    }

    const tPol = mountMpSeatOnSnapshot(g, seatId);
    if (accept) {
      if (G.fac) {
        G.fac.business = clamp((G.fac.business || 50) + 2, 2, 96);
      }
      pushDiploAlert(G, {
        kind: "deal_inbound_accept",
        partnerId: fromId,
        dealId,
        label: dealName,
        q: G.q,
        expiresQ: (G.q || 0) + 3,
      });
    } else {
      if (G.fac) {
        G.fac.patriots = clamp((G.fac.patriots || 50) + 2, 2, 96);
        G.fac.business = clamp((G.fac.business || 50) - 2, 2, 96);
      }
      if (fromId && G.rel) {
        G.rel[fromId] = clamp(
          (G.rel[fromId] != null ? G.rel[fromId] : 50) - 3,
          5,
          95,
        );
      }
      pushDiploAlert(G, {
        kind: "deal_inbound_decline",
        partnerId: fromId,
        dealId,
        label: dealName,
        q: G.q,
        expiresQ: (G.q || 0) + 3,
      });
    }
    clearInboundDealProposal(g, seatId);
    syncMpPoliticsFromG(tPol);

    const iPol = mountMpSeatOnSnapshot(g, fromId);
    if (accept) {
      /* Sphere trespass ledger runs against the issuer's mounted seat. */
      applySphereTrespassOnDeal(dealId, true);
    }
    pushDiploAlert(G, {
      kind: accept ? "deal_propose_accept" : "deal_propose_decline",
      partnerId: seatId,
      dealId,
      label: dealName,
      q: G.q,
      expiresQ: (G.q || 0) + 3,
    });
    if (!accept && G.rel) {
      G.rel[seatId] = clamp(
        (G.rel[seatId] != null ? G.rel[seatId] : 50) - 3,
        5,
        95,
      );
    }
    const p = partnerById(seatId);
    const name = p ? p.name : seatId;
    if (G.brief) {
      const note = accept
        ? name + " accepts the treaty — " + dealName + "."
        : name + " declines the treaty — " + dealName + ".";
      G.brief = [note].concat(G.brief).slice(0, 3);
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
    G = prev;
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
  if (!G || !opt) return;
  const partnerId = ctx && ctx.partnerId;
  const rivalId = ctx && ctx.rivalId;
  ensureDiploStocks(G.econ);
  if (opt.setRel) {
    for (const k in opt.setRel) {
      const pid = k === "_partner" ? partnerId : k === "_rival" ? rivalId : k;
      if (!pid) continue;
      G.rel[pid] = clamp(
        (G.rel[pid] != null ? G.rel[pid] : 50) + opt.setRel[k],
        5,
        95,
      );
    }
  }
  if (opt.fac && G.fac) {
    for (const f in opt.fac)
      G.fac[f] = clamp((G.fac[f] || 50) + opt.fac[f], 2, 96);
  }
  if (opt.relImpulse && partnerId) {
    G.econ.relImpulse[partnerId] =
      (G.econ.relImpulse[partnerId] || 0) + opt.relImpulse;
  }
  if (opt.capital) G.capital = clamp(G.capital + opt.capital, 0, 100);
  if (opt.ledger && partnerId) {
    addDiploLedger(G, partnerId, {
      id:
        "mission_evt_" +
        G.q +
        "_" +
        String(opt.ledger.label || "evt").slice(0, 12),
      label: opt.ledger.label,
      pts: opt.ledger.pts,
    });
  }
  if (opt.rivalLedger && rivalId) {
    addDiploLedger(G, rivalId, {
      id: "mission_rival_" + G.q,
      label: opt.rivalLedger.label,
      pts: opt.rivalLedger.pts,
    });
  }
  if (opt.access && partnerId) {
    G.econ.partnerAccessEff[partnerId] =
      (G.econ.partnerAccessEff[partnerId] || 0) + opt.access;
  }
  if (opt.tariffCut && lockedTariff(G.law) == null) {
    G.law.tariff = Math.max(0, (G.law.tariff || 0) - opt.tariffCut);
  }
  if (opt.sanctionRival && rivalId)
    setSanctionStance(G, rivalId, { against: true });
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
  if (!bits.length) return "";
  return '<div class="impfac mission-hint">' + bits.join("") + "</div>";
}

function queueSummitVisitEvents(g: any) {
  if (!g || !g.activeVisits) return;
  if (!g.missionEvents) g.missionEvents = [];
  for (const pid of Object.keys(g.activeVisits)) {
    const v = g.activeVisits[pid];
    if (!v || v.missionId !== "summit") continue;
    if (visitQuartersLeft(g, pid) <= 0) continue;
    const total = v.eventsTotal != null ? v.eventsTotal : VISIT_DURATION;
    const fired = v.eventsFired || 0;
    if (fired >= total) continue;
    g.missionEvents.push({
      partnerId: pid,
      missionId: "summit",
      q: g.q,
      eventIndex: fired,
    });
    v.eventsFired = fired + 1;
  }
}

function presentNextMissionEvent(onDone: any) {
  if (!G.missionEvents || !G.missionEvents.length) {
    onDone();
    return;
  }
  const item = G.missionEvents.shift();
  const ev = rollMissionEvent(
    item.missionId,
    item.partnerId,
    G,
    diploDeps(),
    false,
    item.eventIndex,
  );
  if (!ev) {
    presentNextMissionEvent(onDone);
    return;
  }
  const pName = partnerById(item.partnerId)?.name || item.partnerId;
  let title = (ev.title || "")
    .replace(/\{P\}/g, pName)
    .replace(/\{R\}/g, ev.rivalName || "a rival");
  title = T(title);
  const body =
    "<p>" +
    formatMissionEventText(ev, G, diploDeps()) +
    "</p>" +
    '<p class="hint">Each choice shifts relations and factions. Expected impacts are listed under every option.</p>';
  const ctx = {
    partnerId: item.partnerId,
    rivalId: ev.rivalId,
    rivalName: ev.rivalName,
  };
  const optsWithHints = ev.opts.map((o) => ({
    b: o.b,
    e: o.e,
    hint: missionOptionHint(o, ctx),
    f: () => {
      applyMissionEventOption(o, {
        partnerId: item.partnerId,
        rivalId: ev.rivalId,
        missionId: item.missionId,
      });
      presentNextMissionEvent(onDone);
    },
  }));
  if (!optsWithHints.some((o) => o.hint)) {
    presentNextMissionEvent(onDone);
    return;
  }
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
    briefExtra.push("State visit with " + (p ? p.name : pid) + " concluded.");
  }
}

function applySphereTrespassOnDeal(dealId: any, ratified: any) {
  if (!G || !dealId) return;
  const d = (DEAL_BY_ID as any)[dealId];
  if (!d || !d.partner) return;
  const player = playerCountryId();
  for (const { patron, label } of spherePatronsForPartner(d.partner)) {
    if (patron === player) continue;
    if (ratified) {
      const client = partnerById(d.partner);
      addDiploLedger(G, patron, {
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
  const role = resolveHomeRole(
    homeRole != null
      ? homeRole
      : (typeof G !== "undefined" && G && G.homeRole) || "home",
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
  const role =
    homeRole != null
      ? homeRole
      : (typeof G !== "undefined" && G && G.homeRole) || "home";
  const id = typeof partner === "string" ? partner : partner.id;
  const fb =
    typeof partner === "object" && partner ? partner.tradeShare : undefined;
  return shareFor(role, id, fb);
}
/** Rest-of-world residual so named active shares + rest still sum to 1. */ function tradeRestShare(
  homeRole: any,
) {
  const role =
    homeRole != null
      ? homeRole
      : (typeof G !== "undefined" && G && G.homeRole) || "home";
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
  const role =
    homeRole != null
      ? homeRole
      : (typeof G !== "undefined" && G && G.homeRole) || "home";
  const p = typeof partner === "string" ? partnerById(partner) : partner;
  if (!p || !p.deals) return [];
  return p.deals.filter((d: any) => {
    if (d.homeOff && d.homeOff.includes(role)) return false;
    if (d.homeOnly && !d.homeOnly.includes(role)) return false;
    return true;
  });
}
function hasDeal(id: any, law?: any) {
  const L = law || (G && G.law);
  return !!(L && L.deals && L.deals[id]);
}
function dealsWith(pid: any, law?: any) {
  const L = law || (G && G.law);
  if (!L || !L.deals) return [];
  return Object.keys(L.deals).filter(
    (id) =>
      L.deals[id] &&
      (DEAL_BY_ID as any)[id] &&
      (DEAL_BY_ID as any)[id].partner === pid,
  );
}
/** Lowest lockTariff among ratified deals, or null if the lever is free. */ function lockedTariff(
  law: any,
) {
  const L = law || (G && G.law);
  const blocLock = tariffLocked(L);
  if (blocLock.mode !== "none") return blocLock.cet != null ? blocLock.cet : 4;
  if (!L || !L.deals) return null;
  let lock = null;
  for (const id in L.deals) {
    if (!L.deals[id]) continue;
    const d = (DEAL_BY_ID as any)[id];
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
  const L = law || (G && G.law);
  if (!L) return BASE_TARIFF;
  ensureTariffSchedule(L);
  L.tariff = tariffScheduleAverage(L, homeRole);
  return L.tariff;
}
function playerCountryId(homeRole?: any) {
  const role = resolveHomeRole(
    homeRole != null
      ? homeRole
      : (typeof G !== "undefined" && G && G.homeRole) || "home",
  );
  return role === "home" ? "kingdom" : role;
}
function countryBlocId(countryId: any, blocMember?: any) {
  const bm = blocMember || (G && G.blocMember) || {};
  return bm[countryId] || null;
}
function blocMembers(blocId: any, blocMember?: any) {
  const bm = blocMember || (G && G.blocMember) || {};
  return countriesInBloc(blocId, bm);
}
function shareSameCustomsUnion(partnerId: any, homeRole: any, blocMember: any) {
  const player = playerCountryId(homeRole);
  const pb = countryBlocId(partnerId, blocMember);
  const hb = countryBlocId(player, blocMember);
  if (!pb || !hb || pb !== hb) return false;
  const bloc =
    blocById(pb) ||
    (Object.values((G && G.customBlocs) || {}) as any[]).find(
      (b) => b.id === pb,
    );
  return bloc && isCustomsUnion(bloc);
}
function effectiveTariff(
  partnerId: any,
  law: any,
  homeRole?: any,
  blocMember?: any,
) {
  const L = law || (G && G.law);
  const sched = ensureTariffSchedule(L);
  const role = homeRole != null ? homeRole : (G && G.homeRole) || "home";
  const bm = blocMember || (G && G.blocMember) || {};
  if (shareSameCustomsUnion(partnerId, role, bm)) return 0;
  const lock = tariffLocked(L, role, bm);
  if (lock.mode === "cet" || lock.mode === "full") {
    let _blocById;
    if (lock.cet != null) return lock.cet;
    const pb = countryBlocId(partnerId, bm);
    if (pb && pb === lock.blocId) return 0;
    let _blocById_defaultCet;
    return sched.cet != null
      ? sched.cet
      : (_blocById_defaultCet =
            (_blocById = blocById(lock.blocId)) === null || _blocById === void 0
              ? void 0
              : _blocById.defaultCet) !== null &&
          _blocById_defaultCet !== void 0
        ? _blocById_defaultCet
        : sched.default;
  }
  const pb = countryBlocId(partnerId, bm);
  if (pb && sched.bloc[pb] != null) return sched.bloc[pb];
  if (!pb && sched.country[partnerId] != null) return sched.country[partnerId];
  return sched.default;
}
function tariffScheduleAverage(law: any, homeRole?: any, blocMember?: any) {
  const role = homeRole != null ? homeRole : (G && G.homeRole) || "home";
  const bm = blocMember != null ? blocMember : (G && G.blocMember) || {};
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
  const role = homeRole != null ? homeRole : (G && G.homeRole) || "home";
  const bm = blocMember != null ? blocMember : (G && G.blocMember) || {};
  const out: Record<string, any> = {};
  for (const id in law.deals || {}) {
    if (!law.deals[id]) continue;
    const d = (DEAL_BY_ID as any)[id];
    if (!d || !d.partner || !d.ch || !d.ch.access) continue;
    (out as any)[d.partner] = ((out as any)[d.partner] || 0) + d.ch.access;
  }
  const player = playerCountryId(role);
  const bid = countryBlocId(player, bm);
  if (bid) {
    const bloc = blocById(bid) || (G && G.customBlocs && G.customBlocs[bid]);
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
function tariffLocked(law: any, homeRole?: any, blocMember?: any) {
  const role = homeRole != null ? homeRole : (G && G.homeRole) || "home";
  const L = law || (G && G.law);
  const player = playerCountryId(role);
  const bm = blocMember || (G && G.blocMember) || {};
  const bid = countryBlocId(player, bm);
  if (!bid)
    return {
      mode: "none",
    };
  const bloc = blocById(bid) || (G && G.customBlocs && G.customBlocs[bid]);
  if (!bloc || !isCustomsUnion(bloc))
    return {
      mode: "none",
    };
  const chair =
    bloc.chair ||
    (G && G.customBlocs && G.customBlocs[bid] && G.customBlocs[bid].founder);
  const sched = ensureTariffSchedule(L);
  const cet = sched.cet != null ? sched.cet : bloc.defaultCet;
  if (chair === player)
    return {
      mode: "cet",
      blocId: bid,
      cet,
    };
  return {
    mode: "full",
    blocId: bid,
    cet,
  };
}
function initBlocState(homeRole: any) {
  const bm = clone(DEFAULT_BLOC_MEMBER);
  const player = playerCountryId(homeRole);
  if (homeRole === "home" || player === "kingdom") delete bm.kingdom;
  return bm;
}
function blocByIdOrCustom(blocId: any) {
  return blocById(blocId) || (G.customBlocs && G.customBlocs[blocId]) || null;
}
function canJoinBloc(blocId: any) {
  const player = playerCountryId();
  if (countryBlocId(player)) return false;
  return blocJoinBlockers(blocId, "accede").length === 0;
}
function blocAccessionSpec(blocId: any) {
  const bloc = blocByIdOrCustom(blocId);
  if (bloc && bloc.accession) return bloc.accession;
  /* Custom blocs have no full accession spec object; use a default
   * accession shape so founded blocs can be rejoined. */
  if (bloc && G.customBlocs && G.customBlocs[blocId]) {
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
function inviteAcceptMin(blocId: any) {
  const spec = defaultAccessionForBloc(blocId);
  return spec.memberRelationMin || 45;
}
function blocInviteMemberApprovals(blocId: any, candidateId: any) {
  const spec = defaultAccessionForBloc(blocId);
  const min = spec.memberRelationMin || 45;
  const player = playerCountryId();
  return blocMembers(blocId)
    .filter((m) => m !== player)
    .map((m) => {
      const rel = G.rel[m] != null ? G.rel[m] : 50;
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
  const out = [];
  const player = playerCountryId();
  if (countryBlocId(player) !== blocId) out.push("not in a trade bloc");
  if (countryBlocId(candidateId)) out.push("already in a bloc");
  if (G.blocInvites && G.blocInvites[candidateId]) out.push("invite pending");
  if (G.blocAccessionByCountry && G.blocAccessionByCountry[candidateId])
    out.push("accession in progress");
  if (candidateId === player && G.blocAccession)
    out.push("accession in progress");
  const candPol = G.politics && G.politics[candidateId];
  if (candPol && candPol.blocAccession) out.push("accession in progress");
  const rel = G.rel[candidateId] != null ? G.rel[candidateId] : 50;
  if (rel < 40)
    out.push("relations with candidate " + rel.toFixed(0) + " (need 40+)");
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
      b === "already in a bloc" ||
      b === "invite pending" ||
      b === "accession in progress",
  );
}
function ensureDraftBlocState() {
  if (!G || !G.draft) return;
  if (!G.draft.blocInvite || typeof G.draft.blocInvite !== "object")
    G.draft.blocInvite = {};
}
/** Drop staged invites that already went out or finished — they must not block Deliver. */ function pruneDraftBlocInvites() {
  ensureDraftBlocState();
  const playerBloc = countryBlocId(playerCountryId());
  if (!playerBloc) return;
  for (const cid of Object.keys(G.draft.blocInvite)) {
    if (blocInviteIsStale(playerBloc, cid)) delete G.draft.blocInvite[cid];
  }
}
/** Per-member relation gate for unanimous accession approval. */ function blocMemberApprovals(
  blocId: any,
) {
  const spec = blocAccessionSpec(blocId);
  const min = spec ? spec.memberRelationMin || 45 : 45;
  const player = playerCountryId();
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return [];
  return (bloc.members || [])
    .filter((m: any) => m !== player)
    .map((m: any) => {
      const rel = G.rel[m] != null ? G.rel[m] : 50;
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
  const D = law || G.draft || {};
  const partner = ctx && ctx.partner;
  (n.policyOff || []).forEach((p: any) => {
    if (D.policies[p])
      out.push("incompatible with " + POLICY_BY_ID[p].name.toLowerCase());
  });
  (n.policyOn || []).forEach((p: any) => {
    if (!D.policies[p])
      out.push("requires " + POLICY_BY_ID[p].name.toLowerCase());
  });
  (n.taxOff || []).forEach((t: any) => {
    if (D.taxes[t] && D.taxes[t].on)
      out.push("requires abolishing the " + TAX_BY_ID[t].name.toLowerCase());
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
  const out = [];
  const ph = phase || "apply";
  const player = playerCountryId();
  if (countryBlocId(player)) out.push("leave your current bloc first");
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return ["unknown bloc"];
  const spec = blocAccessionSpec(blocId);
  const chairId = bloc.chair || bloc.founder;
  const acc = G.blocAccession;
  const autoAcc = G.blocAccessionByCountry && G.blocAccessionByCountry[player];
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
    const rel = G.rel[chairId] != null ? G.rel[chairId] : 50;
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
    needBlockers(spec.need, G.draft).forEach((b) => out.push(b));
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
      const rel = G.rel[chairId] != null ? G.rel[chairId] : 50;
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
  countryId: any,
  blocId: any,
) {
  if (!state) return;
  if (state.world) {
    try {
      refreshWorldTrade(state);
      syncNationsFromWorld(state);
    } catch (err) {}
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
    }
    clearBilateralDeals(L);
  }
  if (countryId === player && state.law && L && state.law !== L) {
    if (bloc && isCustomsUnion(bloc)) {
      const sched = ensureTariffSchedule(state.law);
      if (sched.cet == null)
        sched.cet = bloc.defaultCet != null ? bloc.defaultCet : sched.default;
      syncTariffHeadline(state.law, state.homeRole);
    }
    clearBilateralDeals(state.law);
  }
  applyBlocJoinNationEffects(state, countryId, blocId);
  applyBlocJoinPlayerTrade(state, blocId, countryId);
  return true;
}
function joinBloc(blocId: any, law: any) {
  const player = playerCountryId();
  if (!player || countryBlocId(player)) return false;
  return finalizeBlocJoin(G, player, blocId, law || G.law);
}
function isBlocFounder() {
  const player = playerCountryId();
  const bid = countryBlocId(player);
  if (!bid) return false;
  const custom = G.customBlocs[bid];
  return !!(custom && custom.founder === player);
}
function blocDealMemberApprovals(blocId: any, relationMin: any) {
  const min = relationMin || 42;
  const player = playerCountryId();
  return blocMembers(blocId)
    .filter((m) => m !== player)
    .map((m) => {
      const rel = G.rel[m] != null ? G.rel[m] : 50;
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
  const out = [];
  const player = playerCountryId();
  const bid = countryBlocId(player);
  if (!bid) out.push("not in a trade bloc");
  else if (!isBlocFounder())
    out.push("only the bloc founder can negotiate external treaties");
  if (countryBlocId(partnerId)) out.push("partner trades through their bloc");
  const custom = bid && G.customBlocs[bid];
  const tpl = custom && (CUSTOM_BLOC_TEMPLATES as any)[custom.template];
  const min =
    tpl && tpl.externalDealRelationMin ? tpl.externalDealRelationMin : 42;
  const rel = G.rel[partnerId] != null ? G.rel[partnerId] : 50;
  if (rel < min)
    out.push(
      "relations with partner " + rel.toFixed(0) + " (need " + min + "+)",
    );
  if (bid) {
    for (const a of blocDealMemberApprovals(bid, min)) {
      if (!a.ok)
        out.push(
          a.name +
            " withholds approval (" +
            a.rel.toFixed(0) +
            "/" +
            a.min +
            ")",
        );
    }
  }
  if (dealId && (DEAL_BY_ID as any)[dealId]) {
    const d = (DEAL_BY_ID as any)[dealId];
    if (d.partner !== partnerId) out.push("deal does not match partner");
    if (d.need)
      needBlockers(d.need, G.draft, {
        partner: partnerId,
      }).forEach((b) => out.push(b));
  }
  return out;
}
function draftBlocSnapshotFrom(draft: any) {
  const d = draft || G.draft || {};
  const bm = clone(G.blocMember);
  const custom = clone(G.customBlocs);
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
function applyDraftBlocLaw(law: any, snap: any, draft: any) {
  const d = draft || G.draft || {};
  const player = playerCountryId();
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
  if (!blocId || !G || !G.customBlocs || !G.customBlocs[blocId]) return false;
  if (blocMembers(blocId).length > 0) return false;
  delete G.customBlocs[blocId];
  if (G.blocInvites) {
    for (const cid of Object.keys(G.blocInvites)) {
      if (G.blocInvites[cid] && G.blocInvites[cid].blocId === blocId)
        delete G.blocInvites[cid];
    }
  }
  if (G.blocAccessionByCountry) {
    for (const cid of Object.keys(G.blocAccessionByCountry)) {
      if (
        G.blocAccessionByCountry[cid] &&
        G.blocAccessionByCountry[cid].blocId === blocId
      )
        delete G.blocAccessionByCountry[cid];
    }
  }
  if (G.blocAccession && G.blocAccession.blocId === blocId)
    G.blocAccession = null;
  for (const law of [G.law, G.draft]) {
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
  const player = seatId || playerCountryId();
  const bid = countryBlocId(player);
  if (!bid) return false;
  const bloc = blocById(bid) || (G.customBlocs && G.customBlocs[bid]);
  const blocName = bloc ? bloc.name : bid;
  delete G.blocMember[player];
  const custom = G.customBlocs && G.customBlocs[bid];
  if (custom && Array.isArray(custom.members)) {
    custom.members = custom.members.filter((m: any) => m !== player);
    /* Founder succession — remaining members keep a chair for external deals. */
    if (custom.founder === player) {
      custom.founder = custom.members[0] || null;
    }
  }
  dissolveCustomBlocIfEmpty(bid);
  const L = law || G.law;
  const sched = ensureTariffSchedule(L);
  sched.cet = null;
  syncTariffHeadline(L);
  /* Drop any in-flight leave flag so a re-staged draft cannot no-op. */
  if (G.draft) G.draft.blocLeave = false;
  if (L && L !== G.draft) L.blocLeave = false;
  notifyBlocDeparture(G, player, bid, blocName);
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
  const tpl = (CUSTOM_BLOC_TEMPLATES as any)[templateId];
  if (!tpl) return null;
  if (!canCreateCustomBloc()) return null;
  const player = playerCountryId();
  const id = "custom_" + Date.now();
  G.customBlocs[id] = {
    id,
    name: name || tpl.name,
    founder: player,
    members: [player],
    template: templateId,
    type: tpl.type,
    defaultCet: tpl.defaultCet || null,
    accessBonus: tpl.accessBonus,
    createdQ: G.q,
  };
  finalizeBlocJoin(G, player, id, G.law);
  G._customBlocFoundedQ = G.q;
  return id;
}

/** True when the player may found a custom bloc (not a member, not ascending). */
function canCreateCustomBloc(state?: any) {
  const g = state || G;
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
  const g = state || G;
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
  const state = g || (typeof G !== "undefined" ? G : null);
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
    const acceptMin = inviteAcceptMin(inv.blocId);
    if (cid === player) continue;
    if (state.q >= inv.expiresQ) {
      if (
        !state.blocMember[cid] &&
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
          (p ? p.name : cid) + " declines the bloc invitation" + why + ".",
        );
      }
      delete state.blocInvites[cid];
      continue;
    }
    if (
      state.q >= (inv.sentQ != null ? inv.sentQ : inv.expiresQ - 4) + 1 &&
      !state.blocMember[cid] &&
      !(state.blocAccessionByCountry && state.blocAccessionByCountry[cid])
    ) {
      if (rel >= acceptMin) {
        if (!state.blocAccessionByCountry) state.blocAccessionByCountry = {};
        state.blocAccessionByCountry[cid] = {
          blocId: inv.blocId,
          step: 1,
          sinceQ: state.q,
          invitedBy: inv.fromId || player,
        };
        delete state.blocInvites[cid];
        notes.push(
          (p ? p.name : cid) +
            " begins accession to " +
            (bloc ? bloc.name : inv.blocId) +
            ".",
        );
      }
    }
  }
  if (notes.length && state.brief)
    state.brief = notes.concat(state.brief).slice(0, 3);
}
function processBlocAccessions(g: any) {
  const state = g || (typeof G !== "undefined" ? G : null);
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
      notes.push((p ? p.name : cid) + " accession stalls and is withdrawn.");
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
          (p ? p.name : m) +
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
   * plain G.q would advance alignment immediately on the application quarter. */
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
  if (countryBlocId(countryId)) return false;
  if (!G.blocInvites) G.blocInvites = {};
  const fromId = playerCountryId(G.homeRole);
  const awaitHuman = isHumanMpSeat(G, countryId);
  G.blocInvites[countryId] = {
    blocId,
    sentQ: G.q,
    expiresQ: G.q + 4,
    fromId,
    ...(awaitHuman ? { awaitHuman: true } : {}),
  };
  if (awaitHuman)
    parkInboundBlocInvite(G, fromId, countryId, G.blocInvites[countryId]);
  return true;
}
/** Pick an active partner. Optional score(p) → higher wins; filter(p) to exclude. */ function pickEventPartner(
  opts?: any,
) {
  const o = opts || {};
  const pool = activePartners().filter((p) => !o.filter || o.filter(p));
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
  return pool[G.sandbox ? 0 : Math.floor(Math.random() * pool.length)];
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

  const prevG = G;
  try {
    for (const id of humans) {
      const sub = subs[id];
      const draft = sub && sub.draft;
      if (!draft) continue;
      const r = enactHumanSeatOnSnapshot(g, id, draft, {
        envoys: sub.envoys,
        ultimatums: sub.ultimatums,
      });
      if (!r.ok) throw new Error(r.error || "Enact failed for " + id);
    }
    for (const id of worldSeatIds()) {
      if (humanSet.has(id)) continue;
      const seat = g.world[id];
      if (!seat || !seat.econ || !seat.law) continue;
      applyAiFiscalRule(seat.law, seat.econ);
    }

    const leadId = humans[0] || worldSeatIds()[0];
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
      const r = stepCountry({
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
        manualRate: pol && pol.manualRate != null ? pol.manualRate : undefined,
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
            const prev = G;
            try {
              G = g;
              mountMpSeatOnSnapshot(g, id);
              const e = G.econ;
              const meta = polityOf(G.homeRole);
              const metric = coupMetric(G.fac, meta);
              G.lowRun = metric < meta.coupFloor ? (G.lowRun || 0) + 1 : 0;
              if (!G.sandbox) {
                if (e.yield > 10 && e.debt > 118) G.over = true;
                else if (e.inflation > 22) G.over = true;
                else if (G.lowRun >= meta.coupQuarters) G.over = true;
              }
              syncMpPoliticsFromG(pol);
            } finally {
              G = prev;
            }
          }
          /* Roll events against this seat after its step; choice is async. */
          rollMpEventIntoPolitics(g, id, g.q);
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
    G = g;
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
    G = prevG;
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
    outboundDealProposal: null,
    blocAccession: null,
    activeVisits: {},
    missionEvents: [],
    diploAlerts: [],
  });
}
function syncMpPoliticsFromG(pol: any) {
  if (!pol || !G) return;
  pol.capital = G.capital;
  pol.fac = G.fac;
  pol.rel = G.rel;
  pol.mods = G.mods || [];
  pol.sandbox = !!G.sandbox;
  pol.rateManual = !!G.rateManual;
  pol.manualRate = G.manualRate;
  pol.lastEventQ = G.lastEventQ;
  pol.lastEventId = G.lastEventId;
  pol.setPiece8 = !!G.setPiece8;
  pol.setPiece16 = !!G.setPiece16;
  pol.nextMajorQ = G.nextMajorQ;
  pol.episode = G.episode ? clone(G.episode) : null;
  pol.polityShift = G.polityShift ? clone(G.polityShift) : null;
  pol.lowRun = G.lowRun || 0;
  pol.over = !!G.over;
  pol.blocAccession = G.blocAccession ? clone(G.blocAccession) : null;
  if (pol.country == null && G.country) pol.country = G.country;
  syncDiploPoliticsFromGame(pol, G);
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
  const prev = G;
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
    G = g;
    const pol = mountMpSeatOnSnapshot(g, seatId);
    if (!pol) return { ok: false, error: "Unknown seat" };
    g.q = g.q != null ? g.q : 0;
    let ok = false;
    let error = null;
    if (action === "assignEnvoy") {
      ok = assignEnvoy(o.partnerId);
      if (!ok) {
        if ((G.capital || 0) < ENVOY_ASSIGN_PC)
          error = "Need " + ENVOY_ASSIGN_PC + " capital";
        else if (G.envoys && G.envoys.indexOf(null) < 0)
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
    G = prev;
  }
}

/** Patch live G from a successful MP diplo response without wiping the draft. */
function applyMpDiploPatch(patch: any) {
  if (!G || !patch) return;
  if (patch.capital != null) G.capital = patch.capital;
  if (patch.envoys) G.envoys = clone(patch.envoys);
  if (patch.ultimatums) G.ultimatums = clone(patch.ultimatums);
  if (patch.fac) G.fac = clone(patch.fac);
  if (patch.rel) G.rel = clone(patch.rel);
  if (patch.blocAccessionCleared) {
    const seatId = playerCountryId(G.homeRole);
    withdrawBlocAccession(G, seatId);
  }
  const seatId = playerCountryId(G.homeRole);
  if (G.politics && G.politics[seatId]) {
    const pol = G.politics[seatId];
    if (patch.capital != null) pol.capital = patch.capital;
    if (patch.envoys) pol.envoys = clone(patch.envoys);
    if (patch.ultimatums) pol.ultimatums = clone(patch.ultimatums);
    if (patch.fac) pol.fac = clone(patch.fac);
    if (patch.rel) pol.rel = clone(patch.rel);
  }
}

/** Capture diplo UI fields so an optimistic MP click can roll back on API failure. */
function snapshotMpDiploUi(g: any) {
  const state = g || G;
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
  const state = g || G;
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
  const o = opts || {};
  if (!G) return { ok: false, error: "No game" };
  let ok = false;
  let error = null;
  if (action === "assignEnvoy") {
    ok = assignEnvoy(o.partnerId);
    if (!ok) {
      if ((G.capital || 0) < ENVOY_ASSIGN_PC)
        error = "Need " + ENVOY_ASSIGN_PC + " capital";
      else if (G.envoys && G.envoys.indexOf(null) < 0)
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
  } else if (action === "withdrawBlocAccession") {
    ok = withdrawBlocAccession(G);
    if (!ok) error = "No accession to cancel";
  } else {
    return { ok: false, error: "Unknown action" };
  }
  if (!ok) return { ok: false, error: error || "Action failed" };
  const seatId = playerCountryId(G.homeRole);
  if (G.politics && G.politics[seatId]) {
    const pol = G.politics[seatId];
    pol.capital = G.capital;
    pol.fac = G.fac;
    pol.rel = G.rel;
    syncDiploPoliticsFromGame(pol, G);
  }
  return { ok: true };
}

/** Pin the envoy roster at the start of each quarter so Orders can undo mid-quarter posts. */
function syncEnvoysBaseline(g: any) {
  const state = g || G;
  if (!state) return;
  if (!state.envoys) state.envoys = emptyEnvoys();
  if (!state.envoySpend) state.envoySpend = {};
  if (state.envoysBaselineQ !== state.q) {
    state.envoysBaseline = clone(state.envoys);
    state.envoysBaselineQ = state.q;
  }
}

function clearQuarterEnvoySpend(g: any) {
  const state = g || G;
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
  const state = g || G;
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
  const state = g || G;
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
  const state = g || G;
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
  if (!G || !G.mp || G.mp.bootstrapping || !G.mp.waiting) return;
  if (!mpSubmissionDiverged(G)) return;
  if (typeof G.mp.onAutoUnsubmit === "function") G.mp.onAutoUnsubmit();
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
  const prev = G;
  try {
    G = g;
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
    G = prev;
  }
}
/**
 * Apply a pending MP event option (or episode end) for one seat on the room snapshot.
 */
function applyMpEventChoice(g: any, seatId: any, optionIndex: any) {
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
  const prev = G;
  try {
    G = g;
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
      const idx = optionIndex | 0;
      if (idx < 0 || idx >= ev.opts.length) {
        return {
          ok: false,
          error: "Invalid option",
        };
      }
      applyMissionEventOption(ev.opts[idx], {
        partnerId: pending.partnerId,
        rivalId: ev.rivalId,
        missionId: pending.missionId || "summit",
      });
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
    G = prev;
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
  const prev = G;
  const draftCopy = clone(draft);
  try {
    G = {
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
    };
    /* Drop a Found clause that cannot enact — avoids charging capital for a no-op. */
    if (draftCopy.blocCreate && !canCreateCustomBloc()) {
      draftCopy.blocCreate = null;
    }
    const gateErr = mpDraftBlocGateError();
    if (gateErr) {
      return { ok: false, cost: 0, error: gateErr, clauses: [] };
    }
    const cl = billClauses();
    return {
      ok: true,
      cost: billCost(),
      clauses: cl.map((c) => ({
        label: c.label,
        pc: c.sunk ? 0 : c.pc,
        sunk: !!c.sunk,
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
    G = prev;
  }
}

/** Solo/MP shared: reject draft bloc actions that would no-op or break gates. */
function mpDraftBlocGateError() {
  if (!G || !G.draft) return null;
  if (
    G.draft.blocAccession &&
    blocJoinBlockers(G.draft.blocAccession.blocId, "apply").length
  ) {
    return (
      "Cannot apply to join — " +
      blocJoinBlockers(G.draft.blocAccession.blocId, "apply")[0]
    );
  }
  if (G.draft.blocExternalDeal) {
    const bed = G.draft.blocExternalDeal;
    const blockers = blocExternalDealBlockers(bed.partnerId, bed.dealId);
    if (blockers.length) return "Cannot ratify external deal — " + blockers[0];
  }
  for (const cid in G.draft.blocInvite || {}) {
    if (!G.draft.blocInvite[cid]) continue;
    const playerBloc = countryBlocId(playerCountryId());
    if (!playerBloc) return "Cannot invite — not in a trade bloc";
    const blockers = blocInviteBlockers(playerBloc, cid);
    if (blockers.length) return "Cannot invite — " + blockers[0];
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
  const total = billCost + diploCost;
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
  return {
    ok: true,
    cost: billCost,
    diploCost,
    totalCost: total,
    clauses: priced.clauses,
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
  const prev = G;
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
  };
  try {
    G = g;
    g.homeRole = role;
    g.econ = seat.econ;
    g.law = seat.law;
    g.draft = draftCopy;
    g.prevLaw = seat.prevLaw || seat.law;
    g.capital = pol.capital;
    g.fac = pol.fac;
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
    if (g.draft.blocExternalDeal) {
      const bed = g.draft.blocExternalDeal;
      g.draft.deals[bed.dealId] = true;
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
    applyDraftMissions(seat.law, g.draft, seat.econ, pol.fac);
    const lock = lockedTariff(seat.law);
    if (lock != null) {
      ensureTariffSchedule(seat.law);
      seat.law.tariffSchedule.cet = lock;
      syncTariffHeadline(seat.law);
    }
    if (seat.law.missions) seat.law.missions = {};
    seat.law.blocAccession = null;
    seat.law.blocLeave = false;
    seat.law.blocCreate = null;
    seat.law.blocInvite = {};
    seat.law.blocExternalDeal = null;
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
    g.rel = saved.rel;
    g.country = saved.country;
    g.envoys = saved.envoys;
    g.ultimatums = saved.ultimatums;
    g.activeVisits = saved.activeVisits;
    g.missionEvents = saved.missionEvents;
    g.diploAlerts = saved.diploAlerts;
    G = prev;
  }
}

/** Deep snapshot of live G for multiplayer rooms (JSON-safe). */
function exportGameSnapshot(g: any) {
  const src = g || G;
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
  snap.press = [];
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
 * Skips the morning-note despatch.
 */
function hydrateGameSnapshot(snap: any, opts: any) {
  const o = opts || {};
  if (!snap) throw new Error("hydrateGameSnapshot: missing snapshot");
  const homeRole = resolveHomeRole(o.homeRole || snap.homeRole || "home");
  const seatId = o.seatId || playerCountryId(homeRole);
  /* Keep locally-noted outcome alerts across remount — server never stores noted. */
  const prevSeatPol = G && G.politics && G.politics[seatId];
  const prevNotedAlerts =
    prevSeatPol && prevSeatPol.diploAlerts
      ? prevSeatPol.diploAlerts
      : (G && G.diploAlerts) || [];
  G = clone(snap);
  G.homeRole = homeRole;
  G.homeIso = o.homeIso || G.homeIso || "826";
  G.homeScale = o.homeScale != null ? o.homeScale : G.homeScale;
  if (!G.politics) G.politics = {};
  const pol = G.politics[seatId];
  if (typeof o.country === "string" && o.country.trim()) {
    G.country = o.country.trim().slice(0, 34);
  } else if (pol && pol.country) {
    G.country = pol.country;
  }
  if (!G.world) G.world = {};
  let bag = G.world[seatId];
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
    G.world[seatId] = bag;
  }
  /* Always remount from this seat's world bag — never leave top-level snap.econ
     (often the host's frozen opening books) as the live series. */
  G.econ = bag.econ;
  G.law = bag.law;
  G.prevLaw = bag.prevLaw || bag.law;
  G.draft = clone(G.law);
  G.draft.blocAccession = null;
  G.draft.blocLeave = false;
  G.draft.blocCreate = null;
  G.draft.blocInvite = {};
  G.draft.blocExternalDeal = null;
  if (G.draft.missions) G.draft.missions = {};
  /* Top-bar Growth/Balance read G.log — this seat's series only. */
  if (Array.isArray(bag.log) && bag.log.length) {
    G.log = bag.log;
  } else if (pol && pol.lastRes && bag.econ) {
    /* Recover a one-row series if logs were dropped (old rooms / mirror bugs). */
    const lr = pol.lastRes;
    G.log = [
      {
        label: qLabel(
          {
            q: G.q,
            term: G.term,
          },
          Math.max(0, (G.q || 1) - 1),
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
    bag.log = G.log;
  } else {
    G.log = Array.isArray(bag.log) ? bag.log : [];
  }
  if (pol) {
    normalizeDiploPolitics(pol);
    G.capital = pol.capital != null ? pol.capital : 42;
    G.fac = clone(pol.fac || openingFac(homeRole));
    G.rel = clone(pol.rel || openingRel(homeRole));
    /* Per-seat Bank mode — top-level snap.rateManual is the host export and
         must not overwrite every human on hydrate. */
    G.rateManual = !!pol.rateManual;
    G.manualRate = pol.manualRate != null ? pol.manualRate : OPENING.rate;
    if (G.rateManual && G.econ) {
      G.econ.rate = clamp(G.manualRate, MANUAL_RATE_MIN, 20);
      G.econ.atBound = G.econ.rate <= RATE_FLOOR + 0.02;
    }
    G.sandbox = !!pol.sandbox;
    G.mods = Array.isArray(pol.mods) ? clone(pol.mods) : [];
    G.lastEventQ = pol.lastEventQ != null ? pol.lastEventQ : -3;
    G.lastEventId = pol.lastEventId || null;
    G.setPiece8 = !!pol.setPiece8;
    G.setPiece16 = !!pol.setPiece16;
    G.nextMajorQ = pol.nextMajorQ;
    G.episode = pol.episode ? clone(pol.episode) : null;
    G.polityShift = pol.polityShift ? clone(pol.polityShift) : null;
    G.lowRun = pol.lowRun || 0;
    G.over = !!pol.over;
    /* Per-seat accession — do not keep another human's shared snap.blocAccession. */
    G.blocAccession = pol.blocAccession ? clone(pol.blocAccession) : null;
    /* Remount this seat's diplomacy — never keep shared snap.envoys. */
    const diplo = cloneDiploPolitics(pol);
    G.envoys = diplo.envoys;
    G.ultimatums = diplo.ultimatums;
    G.activeVisits = diplo.activeVisits;
    G.missionEvents = diplo.missionEvents;
    G.diploAlerts = mergeDiploAlertsNoted(prevNotedAlerts, diplo.diploAlerts);
    G.envoySpend = diplo.envoySpend;
    pol.envoys = G.envoys;
    pol.ultimatums = G.ultimatums;
    pol.activeVisits = G.activeVisits;
    pol.missionEvents = G.missionEvents;
    pol.diploAlerts = G.diploAlerts;
    pol.envoySpend = G.envoySpend;
  } else {
    G.capital = G.capital != null ? G.capital : 42;
    if (!G.fac) G.fac = openingFac(homeRole);
    if (!G.rel) G.rel = openingRel(homeRole);
    G.sandbox = o.sandbox != null ? !!o.sandbox : false;
    G.politics[seatId] = defaultMpPolitics(seatId, homeRole, G.country);
    G.politics[seatId].sandbox = G.sandbox;
    G.politics[seatId].rateManual = !!G.rateManual;
    G.politics[seatId].manualRate = G.manualRate;
    if (!G.envoys) G.envoys = emptyEnvoys();
    if (!G.ultimatums) G.ultimatums = {};
    if (!G.activeVisits) G.activeVisits = {};
    if (!G.missionEvents) G.missionEvents = [];
    if (!G.diploAlerts) G.diploAlerts = [];
    syncDiploPoliticsFromGame(G.politics[seatId], G);
  }
  G.mp = o.mp || null;
  G.over = !!G.over;
  /* Drop host opening brief; seat briefings come from lastRes / showMpBriefing. */
  G.brief = [];
  G.press = [];
  clearAllPressFades();
  tab = null;
  mirrorPlayerToWorld(G);
  /* mirror rebuilds the player bag — keep the log we just mounted. */
  if (G.world[seatId]) G.world[seatId].log = G.log;
  syncNationsFromWorld(G, G.q > 0);
  if (o.render !== false) {
    render();
    renderPress();
  }
  return G;
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
  return REGIME_BY_ID[law.regime].flatIncome
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
  if (REGIME_BY_ID[law.regime].flatIncome) return A0;
  return Math.max(0, A0 - TAPER_RATE * Math.max(0, y - TAPER_START));
}
function bandsForIncome(y: any, law: any) {
  const bands = effectiveBands(law);
  if (REGIME_BY_ID[law.regime].flatIncome) return bands;
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
  if (REGIME_BY_ID[law.regime].flatIncome) return 0;
  const A0 = law.income.allowance;
  if (A0 <= 0) return 0;
  const end = TAPER_START + A0 / TAPER_RATE;
  if (y <= TAPER_START || y >= end) return 0;
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
function capitalTaxOn(yDiv: any, ySave: any, law: any) {
  const I = law.income;
  if (I.on === false) return 0;
  const R = REGIME_BY_ID[law.regime];
  if (R.flatIncome) {
    const r = (I.bands[0] && I.bands[0].rate) || 20;
    return ((yDiv + ySave) * r) / 100;
  }
  if (R.dualCapital) {
    const r = I.capitalRate != null ? I.capitalRate : 25;
    return ((yDiv + ySave) * r) / 100;
  }
  const divR = I.divRate != null ? I.divRate : 33;
  const saveR = I.saveRate != null ? I.saveRate : 20;
  return (yDiv * divR) / 100 + (ySave * saveR) / 100;
}
function incomeYield(law: any, E: any, econ: any) {
  const ni = law.ni,
    wage = (econ && econ.wageIndex) || 1;
  const dist = activeIncomeDist(econ);
  const mult = (REGIME_BY_ID[law.regime].mult || {}).income || 1;
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
const MTR_BASE = 0.295,
  PROG_BASE = 0.3;
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
  (SYNTH_GRP as any)[id] || (TAX_BY_ID[id] ? TAX_BY_ID[id].grp : "other");
const clone = (o: any) => JSON.parse(JSON.stringify(o));
/* Copy carries a {C} token so the country can be named by the player. Applied
   where authored text reaches the screen: modal despatches, the morning
   briefing, card blurbs in the drawers, and floating press clippings. */ const T =
  (str: any) =>
    String(str)
      .replace(/\{C\}/g, (G && G.country) || "United Kingdom")
      .replace(/\{P\}/g, () => {
        const id = G && G.eventFocus;
        const p = id && partnerById(id);
        return p ? p.name : "a partner";
      });
const fmt = function (v: any, d: any = 1) {
  return (v >= 0 ? "" : "-") + Math.abs(v).toFixed(d);
};
const sgn = function (v: any, d: any = 1) {
  return (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v).toFixed(d);
};
const cap1 = (s: any) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (v: any) =>
  "\u00a3" +
  Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** Untyped until a later modelling pass — the live game-state singleton.
 * `any` is deliberate: annotated so property access doesn't error on `never`. */
export let G: any = null;
/** Currently-open drawer tab id, or null. See `G` above. */
export let tab: string | null = null;
let policyFilter = "all";
const POLICY_CAT_ORDER = [
  "Work",
  "Housing",
  "Welfare",
  "Education",
  "Economy",
  "Energy & climate",
  "Justice",
  "Borders",
  "State",
];
function baseLaw() {
  const law = {
    regime: "progressive",
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
    const [viceId, ...allowed] = t.req;
    if (!allowed.includes(law.vice[viceId])) law.taxes[t.id].on = false;
  }
}
/** Opening statute for a playable seat. `home` is the UK baseLaw unchanged. */ function lawForRole(
  role: any,
) {
  const law = baseLaw();
  applyRealmLawOverlay(law, REALM_LAW[realmLawKey(role)] || null);
  syncViceTaxes(law);
  law.polity = profilePolityId(role);
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
    over: false,
    sandbox: false,
    country: "United Kingdom",
    capital: 42,
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
    pinOpeningHeadlines(g.econ, g.law, pin, statute, {
      freeRate,
    });
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
  e.regions = initRegions(e);
  e.prevX = e.X;
  e.prevG = govDemandShares(g.law, e).g;
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
    "You have the keys to the Treasury of " + country + ". " + fiscal,
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
  G = {
    q: 0,
    term: 1,
    over: false,
    sandbox: wantTutorial ? true : o.sandbox === true,
    rateManual: false,
    manualRate: OPENING.rate,
    country,
    homeIso,
    homeScale,
    homeRole,
    capital: 42,
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
  };
  syncEnvoysBaseline(G);
  G.econ.regions = initRegions(G.econ);
  ensureDiploStocks(G.econ);
  seedGameRelBase(G);
  G.prevLaw = clone(G.law);
  G.draft = clone(G.law);
  G.draft.blocAccession = null;
  G.draft.blocLeave = false;
  G.draft.blocCreate = null;
  G.draft.blocInvite = {};
  G.draft.blocExternalDeal = null;
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
  G.brief = openingBrief(pins, country);
  G.q = 0;
  G.term = 1;
  G.mods = [];
  G.over = false;
  G.press = [];
  G.briefImpact = null;
  clearAllPressFades();
  tab = null;
  render();
  renderPress();
  /* Opening morning note is first-class, not buried in the Budget drawer. */ if (
    o.silent
  ) {
    closeDespatch();
    bump();
    return;
  }
  const morningHint = careerHint(polityOf(G.homeRole), G.sandbox);
  const morningBody =
    briefingHtml(G.brief) +
    '<p class="hint" style="margin-top:10px">' +
    morningHint +
    "</p>";
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
   ================================================================== */ function taxAvailable(
  t: any,
  law: any,
) {
  if (!t.req) return true;
  const [viceId, ...allowed] = t.req;
  return allowed.includes(law.vice[viceId]);
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
  const R = REGIME_BY_ID[law.regime];
  add(R.imp, R.fac, 1, R.ch);
  for (const t of TAXES) {
    const s = law.taxes[t.id];
    if (!s || !s.on || !taxAvailable(t, law)) continue;
    if (R.kills && R.kills.includes(t.id)) continue;
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
    const p = POLICY_BY_ID[id];
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
  for (const id in law.deals) {
    if (!law.deals[id]) continue;
    const d = (DEAL_BY_ID as any)[id];
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
/* Aggregate MPC implied by how post-tax income is distributed. */ function distMPC(
  law: any,
  econ: any,
) {
  const p = incomeProfile(law, econ);
  return p.distMPC;
}
function revenue(law: any, E: any, econ?: any) {
  const R = REGIME_BY_ID[law.regime],
    mult = R.mult || {};
  const by: Record<string, any> = {};
  let total = 0;
  for (const t of TAXES) {
    const s = law.taxes[t.id];
    if (!s || !s.on || !taxAvailable(t, law)) continue;
    if (R.kills && R.kills.includes(t.id)) continue;
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
function deptNeed(id: any, econ: any) {
  const pop = ((econ && econ.L) || 100) / 100;
  const dep = (econ && econ.dependency) || DEP_0;
  const ageing = id === "health" ? 1 + AGEING_HEALTH * (dep - DEP_0) : 1;
  return pop * ageing;
}
function serviceScore(id: any, law: any, econ: any) {
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
  id: any,
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
  return benefit / caseload;
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
const TFP_TREND = TFP_FRONTIER; // legacy alias
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
function humanCapitalTarget(law: any, E: any, econ: any) {
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
  const now = potentialLevel(law, E, e);
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
  /* Uncovered interest parity, with a risk premium. */ const worldRate =
    (e.worldRate != null ? e.worldRate : WORLD_RATE) + (e.modWorldRate || 0);
  const fxUip = e.fxUip != null ? e.fxUip : FX_UIP;
  const fxTarget = 1 + fxUip * (e.rate - worldRate) - FX_RISK * e.riskPremium;
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
  const E = aggregate(law, g.homeRole, g.blocMember),
    Ep = aggregate(prevLaw, g.homeRole, g.blocMember);
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
      dEr,
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
  /* Regional divergence, driven by what each place is exposed to. */ const tradeG =
    ((acct.X - (e.prevX || acct.X)) / Math.max(1, acct.X)) * 400;
  const publicG =
    (govDemandShares(law, e).g - (e.prevG || govDemandShares(law, e).g)) * 4;
  stepRegions(
    e,
    law,
    growth,
    clamp(tradeG, -12, 12),
    clamp(publicG, -6, 6),
    (e.ucSmooth || UC_BASE) - UC_BASE,
  );
  e.prevX = acct.X;
  e.prevG = govDemandShares(law, e).g;
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
              p.name +
              " collapsed under diplomatic strain.",
          );
          addDiploLedger(g, p.id, {
            id: "deal_collapse_" + softest,
            label: "Treaty collapsed under strain",
            pts: -8,
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
  const appr = approvalOf(g.fac);
  /* Base regen plus a mild approval bonus. Tuned so a mid-term chancellor can
     stage a few medium bills without living permanently at the capital floor.
     Authoritarian seats recover capital more slowly — tenure is
     cheaper than legislative pace. */ const regen = polityOf(
    g.homeRole,
  ).capitalRegen;
  g.capital = clamp(g.capital + (3.2 + (appr - 45) * 0.1) * regen, 0, 100);
  if (law.policies.fiscalRule && deficit > 4) {
    g.ruleBreaches++;
    g.capital = clamp(g.capital - 3, 0, 100);
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
    fac: Object.assign({}, g.fac),
    rev: rev.total,
    spend: sp.prog + mS,
    interest: sp.interest,
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
  return _quarterFlashLock;
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
function rateImpactHtml() {
  if (!G.rateManual) return "";
  let im;
  try {
    im = impactOfRatePin(4);
  } catch (err) {
    return "";
  }
  const chips = impactChips(im);
  const empty = !chips || chips === '<div class="impchips"></div>';
  return (
    '<div class="impblock rate-impact">' +
    '<div class="imphead">Four quarters at ' +
    im.pin.toFixed(2) +
    "% vs the Bank</div>" +
    '<div class="hint" style="margin:0 0 6px">Same law, pinned rate against the Taylor rule from today\'s starting point.</div>' +
    (empty
      ? '<div class="impfac">No measurable move over four quarters.</div>'
      : chips + impactFactions(im)) +
    "</div>"
  );
}
/** Data form of rateImpactHtml() for React consumers. */
function rateImpactData() {
  if (!G.rateManual) return null;
  let im;
  try {
    im = impactOfRatePin(4);
  } catch (err) {
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
function billClauses() {
  pruneDraftBlocInvites();
  const L = G.law,
    D = G.draft,
    out = [];
  if (D.regime !== L.regime)
    out.push({
      label: "Restructure the tax system: " + REGIME_BY_ID[D.regime].name,
      pc: REGIME_BY_ID[D.regime].pc,
      undo: () => {
        D.regime = L.regime;
      },
    });
  if ((D.polity || "democracy") !== (L.polity || "democracy")) {
    const to = D.polity || "democracy";
    const from = L.polity || "democracy";
    if (polityCanReach(from, to)) {
      out.push({
        label:
          "Change the political system: " +
          ((POLITY[to] && POLITY[to].label) || to),
        pc: polityChangePc(from, to),
        tab: "society",
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
      capitalRate: "Capital income rate",
    };
    for (const k in CAP_LABEL) {
      const a = L.income[k],
        b = D.income[k];
      if (a == null || b == null || Math.abs(a - b) < 1e-9) continue;
      const dual = !!REGIME_BY_ID[D.regime].dualCapital;
      if (dual && (k === "divRate" || k === "saveRate")) continue;
      if (!dual && k === "capitalRate") continue;
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
    if (tLock.mode === "full") {
      D.tariffSchedule = clone(L.tariffSchedule);
    } else if (tLock.mode === "cet" && tLock.cet != null) {
      D.tariffSchedule.default = L.tariffSchedule.default;
      D.tariffSchedule.bloc = clone(L.tariffSchedule.bloc);
      D.tariffSchedule.country = clone(L.tariffSchedule.country);
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
    for (const bid in D.tariffSchedule.bloc) {
      const a = L.tariffSchedule.bloc[bid],
        b = D.tariffSchedule.bloc[bid];
      if (a !== b) {
        const bloc = blocById(bid);
        out.push({
          label: (bloc ? bloc.name : bid) + " tariff " + a + "% to " + b + "%",
          pc: Math.max(1, Math.ceil(Math.abs(b - a) * 0.6)),
          undo: () => {
            D.tariffSchedule.bloc[bid] = a;
            syncTariffHeadline(D);
          },
        });
      }
    }
    for (const cid in D.tariffSchedule.country) {
      const a = L.tariffSchedule.country[cid],
        b = D.tariffSchedule.country[cid];
      if (a !== b) {
        const c = partnerById(cid);
        out.push({
          label: (c ? c.name : cid) + " tariff " + a + "% to " + b + "%",
          pc: Math.max(1, Math.ceil(Math.abs(b - a) * 0.6)),
          undo: () => {
            D.tariffSchedule.country[cid] = a;
            syncTariffHeadline(D);
          },
        });
      }
    }
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
  if (G.draft.blocExternalDeal) {
    const bed = G.draft.blocExternalDeal;
    const d = (DEAL_BY_ID as any)[bed.dealId];
    const p = partnerById(bed.partnerId);
    const bid = countryBlocId(playerCountryId());
    const bloc = bid && (blocById(bid) || G.customBlocs[bid]);
    if (d && bloc) {
      out.push({
        label:
          bloc.name +
          " ratifies " +
          d.name.toLowerCase() +
          " with " +
          (p ? p.name : bed.partnerId),
        pc: d.pc,
        undo: () => {
          G.draft.blocExternalDeal = null;
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
      label:
        "Propose " +
        (c ? c.name : cid) +
        " join " +
        (bloc ? bloc.name : "bloc"),
      pc: 12,
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
        undo: () => {
          D.vice[v.id] = L.vice[v.id];
        },
      });
    }
  }
  for (const id in DEAL_BY_ID) {
    const a = !!L.deals[id],
      b = !!G.draft.deals[id];
    if (a !== b) {
      const d = (DEAL_BY_ID as any)[id];
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
    const m = MISSION_BY_ID[mid];
    const p = partnerById(pid);
    if (!m || !p) continue;
    out.push({
      label: m.name + " with " + p.name,
      pc: m.pc,
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
      label: "Post envoy to " + (p ? p.name : pid),
      pc: ENVOY_ASSIGN_PC,
      sunk: true,
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
      label: "Recall envoy from " + (p ? p.name : pid),
      pc: 0,
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
const billCost = () =>
  billClauses().reduce((a, c) => a + (c.sunk ? 0 : c.pc), 0);
const isFiscalOnly = (cl: any) =>
  cl.every(
    (c: any) =>
      !/Ratify|Withdraw|Enact|Repeal|Cannabis|Psychedelics|Gambling|Alcohol|Tobacco|Adult|summit|protest|Restrictive|State visit|Formal protest|envoy/i.test(
        c.label,
      ),
  );
/* ==================================================================
   7. RENDERING
   ================================================================== */
const UI_REACT_CHROME = true;
const UI_REACT_PANELS = new Set([
  "bill",
  "budget",
  "taxes",
  "policies",
  "society",
  "trade",
  "diplomacy",
  "charts",
]);
const UI_REACT_PRESS = true;
const UI_REACT_MAP_CHROME = true;

const _els = Object.create(null);
function registerEl(id: any, el: any) {
  if (el) _els[id] = el;
  else delete _els[id];
}
const $ = (id: any) =>
  _els[id] ||
  (typeof document !== "undefined" ? document.getElementById(id) : null);
const esc = (s: any) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
/* --- seamless 3D value noise --- */ function hash3(i: any, j: any, k: any) {
  let n = (i | 0) * 374761393 + (j | 0) * 668265263 + (k | 0) * 1442695040;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function vnoise(x: any, y: any, z: any) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const c = (a: any, b: any, cc: any) => hash3(xi + a, yi + b, zi + cc);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u,
    x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u,
    x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  return (
    x00 +
    (x10 - x00) * v +
    (x01 + (x11 - x01) * v - (x00 + (x10 - x00) * v)) * w
  );
}
function fbm(x: any, y: any, z: any, oct: any) {
  let s = 0,
    a = 0.5,
    f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    f *= 2.05;
    a *= 0.5;
  }
  return s;
}
/* ==================================================================
   7a. THE MAP
   A procedurally generated fictional country, drawn to a 2D canvas.
   No libraries and no map data: the coastline is radial noise sampled
   on the angle (seamless by construction) and the interior is carved
   into regions by nearest seed. Geometry is pure arithmetic over typed
   arrays so it can be tested without a canvas; only painting needs one.
   ================================================================== */ const REGIONS =
  [
    {
      id: "capital",
      name: "Capital District",
      x: 0.04,
      y: 0.08,
      w: 0.2,
      mix: {
        urban: 0.55,
        business: 0.25,
        workers: 0.2,
      },
      prosper: 1.34,
      beta: 0.85,
      trade: 0.7,
      publicShare: 0.22,
      housing: 1.6,
    },
    {
      id: "uplands",
      name: "Northern Uplands",
      x: -0.04,
      y: -0.58,
      w: 0.07,
      mix: {
        rural: 0.55,
        pensioners: 0.25,
        patriots: 0.2,
      },
      prosper: 0.78,
      beta: 0.65,
      trade: 0.5,
      publicShare: 0.34,
      housing: 0.4,
    },
    {
      id: "westcoast",
      name: "West Coast",
      x: -0.52,
      y: -0.02,
      w: 0.11,
      mix: {
        workers: 0.4,
        urban: 0.3,
        pensioners: 0.3,
      },
      prosper: 0.9,
      beta: 1.15,
      trade: 1.2,
      publicShare: 0.32,
      housing: 0.7,
    },
    {
      id: "eastplain",
      name: "Eastern Plain",
      x: 0.52,
      y: -0.1,
      w: 0.09,
      mix: {
        rural: 0.6,
        business: 0.2,
        patriots: 0.2,
      },
      prosper: 0.86,
      beta: 0.7,
      trade: 0.9,
      publicShare: 0.28,
      housing: 0.5,
    },
    {
      id: "downs",
      name: "Southern Downs",
      x: 0.1,
      y: 0.52,
      w: 0.14,
      mix: {
        pensioners: 0.45,
        rural: 0.3,
        business: 0.25,
      },
      prosper: 1.05,
      beta: 0.8,
      trade: 0.6,
      publicShare: 0.3,
      housing: 1.1,
    },
    {
      id: "belt",
      name: "Industrial Belt",
      x: -0.28,
      y: 0.26,
      w: 0.14,
      mix: {
        workers: 0.62,
        urban: 0.23,
        patriots: 0.15,
      },
      prosper: 0.82,
      beta: 1.55,
      trade: 1.6,
      publicShare: 0.3,
      housing: 0.5,
    },
    {
      id: "port",
      name: "Port Region",
      x: 0.42,
      y: 0.36,
      w: 0.12,
      mix: {
        workers: 0.4,
        business: 0.35,
        urban: 0.25,
      },
      prosper: 0.95,
      beta: 1.3,
      trade: 2.1,
      publicShare: 0.26,
      housing: 0.6,
    },
    {
      id: "lakes",
      name: "The Lakelands",
      x: -0.4,
      y: -0.36,
      w: 0.07,
      mix: {
        rural: 0.5,
        pensioners: 0.35,
        urban: 0.15,
      },
      prosper: 0.88,
      beta: 0.6,
      trade: 0.5,
      publicShare: 0.36,
      housing: 0.4,
    },
    {
      id: "marches",
      name: "Border Marches",
      x: 0.36,
      y: -0.46,
      w: 0.06,
      mix: {
        patriots: 0.45,
        rural: 0.4,
        workers: 0.15,
      },
      prosper: 0.74,
      beta: 0.75,
      trade: 0.8,
      publicShare: 0.4,
      housing: 0.3,
    },
  ];
const CAPITAL_XY = {
  x: 0.04,
  y: 0.08,
};
/* Where each trading partner lies relative to the country, for the edge arrows. */ const PARTNER_BEARING =
  {
    germany: {
      a: 82,
      label: "E",
    },
    france: {
      a: 78,
      label: "E",
    },
    italy: {
      a: 95,
      label: "SE",
    },
    spain: {
      a: 108,
      label: "SE",
    },
    netherlands: {
      a: 85,
      label: "E",
    },
    poland: {
      a: 75,
      label: "E",
    },
    united_states: {
      a: 250,
      label: "W",
    },
    canada: {
      a: 260,
      label: "W",
    },
    china: {
      a: 118,
      label: "SE",
    },
    russia: {
      a: 55,
      label: "NE",
    },
    india: {
      a: 128,
      label: "SE",
    },
    brazil: {
      a: 230,
      label: "SW",
    },
    mexico: {
      a: 245,
      label: "W",
    },
    argentina: {
      a: 220,
      label: "SW",
    },
    japan: {
      a: 105,
      label: "E",
    },
    korea: {
      a: 100,
      label: "E",
    },
    australia: {
      a: 168,
      label: "S",
    },
    indonesia: {
      a: 145,
      label: "SE",
    },
    vietnam: {
      a: 125,
      label: "SE",
    },
    turkey: {
      a: 100,
      label: "SE",
    },
    saudi: {
      a: 140,
      label: "SSE",
    },
    uae: {
      a: 135,
      label: "SSE",
    },
    nigeria: {
      a: 160,
      label: "S",
    },
    south_africa: {
      a: 155,
      label: "S",
    },
    egypt: {
      a: 148,
      label: "SSE",
    },
    kenya: {
      a: 152,
      label: "S",
    },
    kingdom: {
      a: 200,
      label: "NW",
    },
  };
function fbm2(x: any, y: any, oct: any) {
  let s = 0,
    a = 0.5,
    f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, 0.37);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
/* The country is built from overlapping lobes rather than one radial blob,
   which is what gives it peninsulas, bays and an asymmetric silhouette instead
   of a circle. Offshore islands are separate lobes; the lake is a negative one. */ const LOBES =
  [
    [0.0, -0.06, 0.42],
    [-0.14, -0.46, 0.3],
    [0.3, -0.4, 0.22],
    [-0.46, -0.1, 0.26],
    [0.44, 0.02, 0.23],
    [-0.34, 0.32, 0.21],
    [0.36, 0.34, 0.22],
    [0.04, 0.56, 0.19],
    [-0.1, 0.2, 0.3], // waist, keeps north and south joined
  ];
const ISLES = [
  [-0.74, -0.44, 0.085],
  [0.72, 0.5, 0.07],
  [-0.66, 0.52, 0.055],
];
const LAKE = [-0.2, -0.16, 0.115];
function lobeField(list: any, dx: any, dy: any) {
  let f = 0;
  for (const L of list) {
    const ex = (dx - L[0]) / L[2],
      ey = (dy - L[1]) / L[2];
    const d2 = ex * ex + ey * ey;
    if (d2 < 6) f += Math.exp(-d2 * 1.05);
  }
  return f;
}
/* >0 is land. The noise is added in world space rather than radially, so the
   coast wanders the way a real one does instead of rippling around a circle. */ function countryField(
  dx: any,
  dy: any,
) {
  const warp = (fbm2(dx * 1.9 + 5.1, dy * 1.9 + 2.7, 4) - 0.5) * 0.52;
  const fine = (fbm2(dx * 6.2 + 17.3, dy * 6.2 + 9.1, 3) - 0.5) * 0.2;
  const land = lobeField(LOBES, dx, dy) + warp + fine - 0.62;
  const isle = lobeField(ISLES, dx, dy) + warp * 0.5 + fine - 0.58;
  let v = Math.max(land, isle);
  // inland water
  const lx = (dx - LAKE[0]) / LAKE[2],
    ly = (dy - LAKE[1]) / LAKE[2];
  const lake = Math.exp(-(lx * lx + ly * ly) * 1.3) + fine * 0.8 - 0.72;
  if (lake > 0) v = Math.min(v, -0.02);
  return v;
}
/* Region index per pixel: 255 means sea. Also returns a border mask and the
   pixel count per region, which is what the geometry tests assert on. */ function mapGeometry(
  W: any,
  H: any,
) {
  const idx = new Uint8Array(W * H),
    edge = new Uint8Array(W * H),
    shelf = new Uint8Array(W * H);
  const counts = new Array(REGIONS.length).fill(0);
  let land = 0;
  for (let py = 0; py < H; py++) {
    const dy = ((py + 0.5) / H) * 2 - 1;
    for (let px = 0; px < W; px++) {
      const dx = ((px + 0.5) / W) * 2 - 1;
      const i = py * W + px;
      if (countryField(dx, dy) <= 0) {
        idx[i] = 255;
        continue;
      }
      let best = 0,
        bd = Infinity;
      for (let r = 0; r < REGIONS.length; r++) {
        const R = REGIONS[r];
        const d = (dx - R.x) * (dx - R.x) + (dy - R.y) * (dy - R.y);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      idx[i] = best;
      counts[best]++;
      land++;
    }
  }
  // internal borders
  for (let py = 1; py < H - 1; py++)
    for (let px = 1; px < W - 1; px++) {
      const i = py * W + px,
        v = idx[i];
      if (v === 255) continue;
      if (
        idx[i - 1] !== v ||
        idx[i + 1] !== v ||
        idx[i - W] !== v ||
        idx[i + W] !== v
      )
        edge[i] = 1;
    }
  /* Ocean is whatever the frame edge can reach. Any water it cannot reach is
     inland, and is drawn as a lake rather than as sea. */ const ocean =
      new Uint8Array(W * H),
    stack: any[] = [];
  const push = (i: any) => {
    if (idx[i] === 255 && !ocean[i]) {
      ocean[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop(),
      x = i % W,
      y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  let lake = 0;
  for (let i = 0; i < W * H; i++) if (idx[i] === 255 && !ocean[i]) lake++;
  /* Continental shelf: how many dilation steps of sea from the nearest coast,
     which is what lets the water shade from shallow to deep. */ const RINGS =
    Math.max(3, Math.round(Math.min(W, H) * 0.045));
  let front = [];
  for (let i = 0; i < W * H; i++) if (idx[i] !== 255) front.push(i);
  const seen = new Uint8Array(W * H);
  front.forEach((i) => {
    seen[i] = 1;
  });
  for (let ring = 1; ring <= RINGS && front.length; ring++) {
    const next = [];
    for (const i of front) {
      const x = i % W,
        y = (i / W) | 0;
      const nb = [];
      if (x > 0) nb.push(i - 1);
      if (x < W - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - W);
      if (y < H - 1) nb.push(i + W);
      for (const j of nb)
        if (!seen[j] && idx[j] === 255) {
          seen[j] = 1;
          shelf[j] = RINGS - ring + 1;
          next.push(j);
        }
    }
    front = next;
  }
  return {
    idx,
    edge,
    shelf,
    ocean,
    counts,
    land,
    lake,
    rings: RINGS,
    W,
    H,
  };
}
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
/** Format USD bn as $3.6tn / $420bn for the realm card. */ function fmtGdpBn(
  bn: any,
) {
  if (bn == null || !isFinite(bn)) return "—";
  if (bn >= 1000) return "$" + (bn / 1000).toFixed(bn >= 10000 ? 0 : 1) + "tn";
  if (bn >= 100) return "$" + bn.toFixed(0) + "bn";
  return "$" + bn.toFixed(0) + "bn";
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
/* ---------- Regions diverge ----------
   Each place has its own output and unemployment, and its own exposure. `beta`
   is how hard the national cycle lands there, `trade` how exposed it is to
   exports, `publicShare` how much of it depends on the state, `housing` how
   much the cost of capital matters. So the Industrial Belt takes a downturn
   harder than the Capital District, a port region feels a tariff war first, and
   a region living on public employment feels a squeeze on departmental budgets
   before anyone else does.

   Regional unemployment is sticky: it converges toward the national rate slowly,
   which is why a shock that has passed nationally can still be visible in a
   place years later. */ const REGION_STICKY = 0.045,
  REGION_OKUN = 0.3;
/* Places do not start level. A region built on heavy industry carries higher
   unemployment and lower output per head before the Chancellor does anything,
   which is the inheritance rather than the policy. */ function initRegions(
  e: any,
) {
  return REGIONS.map((R) => ({
    y: 100 * (0.88 + R.prosper * 0.12),
    u: clamp(e.unemployment * (0.72 + R.beta * 0.28), 1.5, 14),
  }));
}
function stepRegions(
  e: any,
  law: any,
  growth: any,
  tradeGrowth: any,
  publicGrowth: any,
  ucGap: any,
) {
  if (!e.regions) e.regions = initRegions(e);
  const trend = e.trendGrowth || 1.0;
  const hpG = e.housePriceGrowth || 0;
  e.regions.forEach((r: any, i: any) => {
    const R = REGIONS[i];
    const local =
      trend +
      (growth - trend) * R.beta +
      tradeGrowth * (R.trade - 1) * 0.55 +
      publicGrowth * R.publicShare * 1.5 -
      ucGap * R.housing * 0.3 +
      hpG * R.housing * 0.22;
    r.y *= 1 + local / 400;
    r.u = clamp(
      r.u -
        (REGION_OKUN * (local - trend)) / 2 +
        (e.unemployment - r.u) * REGION_STICKY,
      0.8,
      30,
    );
  });
}
/* ---------- what each region is feeling ---------- */ function regionStats(
  r: any,
) {
  const e = G.econ;
  const i = REGIONS.indexOf(r);
  const st = (e.regions && e.regions[i]) || {
    y: 100,
    u: e.unemployment,
  };
  let appr = 0;
  for (const f in r.mix) appr += (G.fac[f] || 50) * r.mix[f];
  /* A region that has fallen behind is a region whose people are less impressed,
     so local conditions feed back into local politics. */ appr +=
    (st.y / 100 - e.gdp / 100) * 55 - (st.u - e.unemployment) * 2.4;
  const urbanShare = r.mix.urban || 0;
  const prosper =
    r.prosper *
    (st.y / 100) *
    (1 - (e.gini - (e.gini0 != null ? e.gini0 : 35)) * 0.006);
  const services = clamp(
    e.services + (urbanShare - 0.3) * 10 - (r.prosper < 0.85 ? 6 : 0),
    0,
    100,
  );
  return {
    approval: clamp(appr, 0, 100),
    unemployment: st.u,
    prosperity: prosper * 100,
    services,
  };
}
const MAP_METRICS = [
  {
    id: "approval",
    name: "Approval",
    fmt: (v: any) => v.toFixed(0) + "%",
    lo: 20,
    hi: 70,
    good: "high",
  },
  {
    id: "unemployment",
    name: "Unemployment",
    fmt: (v: any) => v.toFixed(1) + "%",
    lo: 2,
    hi: 12,
    good: "low",
  },
  {
    id: "prosperity",
    name: "Prosperity",
    fmt: (v: any) => v.toFixed(0),
    lo: 70,
    hi: 140,
    good: "high",
  },
  {
    id: "services",
    name: "Services",
    fmt: (v: any) => v.toFixed(0),
    lo: 25,
    hi: 75,
    good: "high",
  },
];
let mapMetric = "approval",
  mapHover = -1;
/* Green → yellow → orange → red via shared metricRamp. No blue.
   `good` flips which end is which. */ function ramp(t: any) {
  return metricRamp(t);
}
function regionColour(r: any, metric: any) {
  const m = MAP_METRICS.find((x) => x.id === metric) || MAP_METRICS[0];
  const v = (regionStats(r) as any)[m.id];
  let t = (v - m.lo) / (m.hi - m.lo);
  if (m.good === "high") t = 1 - t; // good things stay cool
  return ramp(t);
}
const Map2D: Record<string, any> = {
  cv: null,
  ctx: null,
  geo: null,
  host: null,
  dpr: 1,
  raf: 0,
};
function paintMap() {
  const M = Map2D;
  if (!M.ctx || !M.geo) return;
  const { idx, edge, shelf, ocean, rings, W, H } = M.geo;
  const img = M.ctx.createImageData(W, H);
  const d = img.data;
  const pal = REGIONS.map((r) => regionColour(r, mapMetric));
  for (let i = 0; i < W * H; i++) {
    const p = i * 4,
      v = idx[i];
    if (v === 255) {
      if (!ocean[i]) {
        d[p] = 26;
        d[p + 1] = 58;
        d[p + 2] = 92;
      } else {
        const t = shelf[i] / rings; // shallow near the coast
        d[p] = 7 + t * 22;
        d[p + 1] = 15 + t * 44;
        d[p + 2] = 30 + t * 58;
      }
      d[p + 3] = 255;
      continue;
    }
    const c = pal[v];
    let k = 1;
    if (v === mapHover) k = 1.3;
    if (edge[i]) k *= 0.66; // internal region borders
    d[p] = Math.min(255, c[0] * k);
    d[p + 1] = Math.min(255, c[1] * k);
    d[p + 2] = Math.min(255, c[2] * k);
    d[p + 3] = 255;
  }
  // coastline: darken any land pixel touching water
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (idx[i] === 255) continue;
      if (
        idx[i - 1] === 255 ||
        idx[i + 1] === 255 ||
        idx[i - W] === 255 ||
        idx[i + W] === 255
      ) {
        const p = i * 4;
        d[p] *= 0.55;
        d[p + 1] *= 0.55;
        d[p + 2] *= 0.58;
      }
    }
  M.ctx.putImageData(img, 0, 0);
  const toPx = (x: any, y: any) => [((x + 1) / 2) * W, ((y + 1) / 2) * H];
  M.ctx.save();
  const [cx, cy] = toPx(CAPITAL_XY.x, CAPITAL_XY.y);
  M.ctx.beginPath();
  M.ctx.arc(cx, cy, W * 0.011, 0, Math.PI * 2);
  M.ctx.fillStyle = "#fff";
  M.ctx.fill();
  M.ctx.lineWidth = W * 0.005;
  M.ctx.strokeStyle = "rgba(0,0,0,.5)";
  M.ctx.stroke();
  M.ctx.font =
    "600 " + ((W * 0.02) | 0) + "px -apple-system, system-ui, sans-serif";
  M.ctx.textAlign = "center";
  M.ctx.textBaseline = "middle";
  for (const p of activePartners()) {
    const b = (PARTNER_BEARING as any)[p.id];
    if (!b) continue;
    const rad = ((b.a - 90) * Math.PI) / 180;
    const rr = Math.min(W, H) * 0.462;
    const ax = W / 2 + Math.cos(rad) * rr,
      ay = H / 2 + Math.sin(rad) * rr;
    const rel = G.rel[p.id] || 50;
    M.ctx.fillStyle = rel > 62 ? "#3DDC84" : rel > 45 ? "#E8C988" : "#FF5A4E";
    M.ctx.beginPath();
    M.ctx.arc(ax, ay, W * 0.012, 0, Math.PI * 2);
    M.ctx.fill();
    M.ctx.fillStyle = "rgba(255,255,255,.85)";
    M.ctx.fillText(b.label, ax, ay - W * 0.03);
  }
  M.ctx.restore();
}
function mapPick(clientX: any, clientY: any) {
  const M = Map2D;
  if (!M.cv || !M.geo) return -1;
  const r = M.cv.getBoundingClientRect();
  if (!r.width || !r.height) return -1;
  const px = Math.floor(((clientX - r.left) / r.width) * M.geo.W);
  const py = Math.floor(((clientY - r.top) / r.height) * M.geo.H);
  if (px < 0 || py < 0 || px >= M.geo.W || py >= M.geo.H) return -1;
  const v = M.geo.idx[py * M.geo.W + px];
  return v === 255 ? -1 : v;
}
function initMap(host: any) {
  try {
    const W = 620,
      H = 620;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    cv.className = "mapcanvas";
    const ctx = cv.getContext("2d");
    if (!ctx) return false;
    host.appendChild(cv);
    Object.assign(Map2D, {
      cv,
      ctx,
      host,
      geo: mapGeometry(W, H),
    });
    cv.addEventListener("pointermove", (ev) => {
      const r = mapPick(ev.clientX, ev.clientY);
      if (r !== mapHover) {
        mapHover = r;
        paintMap();
        updateMapLabel();
      }
    });
    cv.addEventListener("pointerleave", () => {
      mapHover = -1;
      paintMap();
      updateMapLabel();
    });
    cv.addEventListener("click", (ev) => {
      const r = mapPick(ev.clientX, ev.clientY);
      if (r >= 0) {
        mapHover = r;
        paintMap();
        updateMapLabel();
      }
    });
    paintMap();
    return true;
  } catch (err) {
    return false;
  }
}
function updateMapLabel() {
  const box = $("mapLabel");
  if (!box) return;
  if (mapHover < 0) {
    const m = MAP_METRICS.find((x) => x.id === mapMetric)!;
    box.innerHTML =
      "<b>" + esc(G.country) + "</b><span>" + m.name + " by region</span>";
    return;
  }
  const r = REGIONS[mapHover],
    st = regionStats(r);
  box.innerHTML =
    "<b>" +
    esc(r.name) +
    "</b>" +
    "<span>" +
    MAP_METRICS.map((m) => m.name + " " + m.fmt((st as any)[m.id])).join(
      " &middot; ",
    ) +
    "</span>";
}
function updateMap() {
  if (Map2D.ctx) {
    paintMap();
    updateMapLabel();
  }
}
function mapFallbackHtml() {
  return (
    '<div class="globe-fallback"><p>The map could not be drawn here. ' +
    "Everything else in the game is unaffected.</p></div>"
  );
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
  },
  {
    id: "policies",
    name: "Policies",
    icon: "scroll",
  },
  {
    id: "society",
    name: "Society",
    icon: "people",
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
  },
];
function spark(key: any, w: any = 44, h: any = 13) {
  const vals = G.log.map((r: any) => r[key]);
  if (vals.length < 2) return "";
  const mn = Math.min(...vals),
    mx = Math.max(...vals),
    rg = mx - mn || 1;
  const pts = vals
    .map(
      (v: any, i: any) =>
        ((i / (vals.length - 1)) * w).toFixed(1) +
        "," +
        (h - ((v - mn) / rg) * h).toFixed(1),
    )
    .join(" ");
  return (
    '<svg width="' +
    w +
    '" height="' +
    h +
    '" aria-hidden="true"><polyline points="' +
    pts +
    '" fill="none" stroke="#eed69a" stroke-width="1.2"/></svg>'
  );
}
function dialHtml(
  k: any,
  v: any,
  unit: any,
  delta: any,
  warn: any,
  sk: any,
  invert: any,
) {
  const cls =
    delta == null
      ? ""
      : invert
        ? delta < 0
          ? "up"
          : "dn"
        : delta > 0
          ? "up"
          : "dn";
  const dt = delta == null ? "&nbsp;" : sgn(delta, 1);
  return (
    '<div class="dial' +
    (warn ? " warn" : "") +
    '"><div class="k">' +
    k +
    '</div><div class="v">' +
    v +
    "<small>" +
    unit +
    '</small></div><div class="d ' +
    cls +
    '">' +
    dt +
    "</div>" +
    (sk ? spark(sk) : "") +
    "</div>"
  );
}
const ICONS = {
  coin: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 4.6v6.8M6.2 6.2h3.1a1.4 1.4 0 010 2.8H6.6h3.2"/></svg>',
  percent:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="5" cy="5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M12.5 3.5l-9 9"/></svg>',
  scroll:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 2.5h7.5v11H4z"/><path d="M6 5.5h3.5M6 8h3.5M6 10.5h2"/></svg>',
  people:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="5.5" r="2.2"/><path d="M2.4 13c.3-2.3 1.8-3.6 3.6-3.6S9.3 10.7 9.6 13"/><path d="M10.6 4.2a2.1 2.1 0 010 4M11 9.6c1.6.2 2.7 1.5 3 3.4"/></svg>',
  globe:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2C6.2 4 6.2 12 8 14"/></svg>',
  seal: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="7" r="4.2"/><path d="M5.2 10.8L4 14l4-1.4L12 14l-1.2-3.2"/><circle cx="8" cy="7" r="1.4"/></svg>',
  chart:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 13.5h11"/><path d="M4 11V7.5M7 11V4M10 11V8.5M13 11V6"/></svg>',
  clock:
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 4.5v4l2.5 2.5"/></svg>',
  close:
    '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
};
/* --- the top bar --- */ /* `kind` marks a reading the Chancellor does not control, which is worth making
   visually obvious: the Bank rate is a response to your budget, not a lever in
   it. */ /** Quarters remaining until the next scheduled term review. */ function electionQuartersLeft() {
  if (!G || G.over) return 0;
  const len = termLenOf(G.homeRole);
  const into = G.q % len;
  return into === 0 && G.q > 0 ? len : len - into;
}
/** Rough running score the termReview() formula will use — for the thermometer. */ function electionThermometer() {
  return termReviewScore();
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
  return G.q % termLenOf(G.homeRole) === 0;
}
function chip(
  k: any,
  v: any,
  unit: any,
  delta: any,
  state: any,
  invert?: any,
  kind?: any,
) {
  const cls =
    delta == null
      ? ""
      : invert
        ? delta < 0
          ? "up"
          : "dn"
        : delta > 0
          ? "up"
          : "dn";
  // Always reserve the delta row so chips without a change stay the same height.
  const d =
    delta == null
      ? '<div class="d" aria-hidden="true">&nbsp;</div>'
      : '<div class="d ' + cls + '">' + sgn(delta, 2) + "</div>";
  const title =
    kind === "bank"
      ? G.rateManual
        ? ' title="Pinned by you. Turn Bank mode back on in the Bill panel to return the rate to the Taylor rule."'
        : ' title="Set by the Bank, not by you. It follows a Taylor rule: it rises when inflation is above target or output is above potential, and it is smoothed, so it moves in steps. Pin it yourself in the Bill panel."'
      : kind === "trend"
        ? ' title="Annualised potential growth from TFP, capital and labour — not outturn GDP."'
        : "";
  return (
    '<div class="chip ' +
    (state || "") +
    (kind ? " " + kind : "") +
    '"' +
    title +
    '><div class="k">' +
    k +
    "</div>" +
    '<div class="v">' +
    v +
    (unit ? "<small>" + unit + "</small>" : "") +
    "</div>" +
    d +
    "</div>"
  );
}
function renderChrome() {
  if (UI_REACT_CHROME) return;
  const n = G.log.length,
    last = n ? G.log[n - 1] : null,
    prev = n > 1 ? G.log[n - 2] : null;
  const d = (k: any) => (last && prev ? last[k] - prev[k] : null);
  const e = G.econ,
    appr = approvalOf(G.fac);
  /* Balance must match the Deficit reading elsewhere (deficit = −balance).
     After the first outturn that means the logged figure from step(), which
     applies the cyclical revenue and spending shares — not a fresh balanceOf,
     which ignores those and drifts from the books the game actually ran. */ const balShow =
    last ? last.balance : balanceOf(G.law, e).balance;
  const nb = $("nameBtn");
  if (nb && document.activeElement !== nb) nb.textContent = G.country;
  const tb = $("tbTerm");
  if (tb) {
    const left = electionQuartersLeft();
    const therm = electionThermometer();
    const noun = reviewNoun();
    const electHint =
      left <= 4
        ? " · " +
          noun +
          " score ~" +
          therm.toFixed(0) +
          (therm <= polityOf().loseAt ? " (at risk)" : "")
        : "";
    tb.textContent =
      ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"][
        Math.min(G.term - 1, 5)
      ] +
      " term \u00b7 " +
      qLabel(G, G.q) +
      " \u00b7 " +
      noun +
      " in " +
      left +
      "Q" +
      electHint;
  }
  const mode = $("tbMode");
  if (mode) {
    mode.innerHTML =
      '<button type="button" class="mode-toggle" id="modeCareer" aria-pressed="' +
      !G.sandbox +
      '">Career</button>' +
      '<button type="button" class="mode-toggle" id="modeSandbox" aria-pressed="' +
      !!G.sandbox +
      '" title="Cannot be removed from office">Sandbox</button>';
    const setMode = (sb: any) => {
      G.sandbox = sb;
      const sid = playerCountryId();
      if (G.politics && G.politics[sid]) G.politics[sid].sandbox = sb;
      render();
    };
    const mc = $("modeCareer");
    if (mc) mc.onclick = () => setMode(false);
    const ms = $("modeSandbox");
    if (ms) ms.onclick = () => setMode(true);
  }
  const stats = $("tbStats");
  if (stats) {
    const gShow = last ? last.growth : e.trendGrowth;
    const left = electionQuartersLeft();
    const therm = electionThermometer();
    const reviewLabel =
      polityOf().kind === "congress"
        ? "Congress"
        : polityOf().kind === "managed"
          ? "Ballot"
          : "Election";
    stats.innerHTML =
      chip(
        "Growth",
        fmt(gShow, 1),
        "%",
        d("growth"),
        last && last.growth < 0 ? "alert" : "",
      ) +
      chip(
        "Trend",
        (e.trendGrowth != null ? e.trendGrowth : 0).toFixed(1),
        "%",
        null,
        "",
        null,
        "trend",
      ) +
      chip(
        "Inflation",
        e.inflation.toFixed(1),
        "%",
        d("inflation"),
        e.inflation > 4 || e.inflation < 0 ? "alert" : "",
        true,
      ) +
      chip(
        "Base rate",
        e.rate.toFixed(2),
        "%",
        d("rate"),
        e.atBound ? "alert" : "",
        null,
        "bank",
      ) +
      chip(
        "Unemp.",
        e.unemployment.toFixed(1),
        "%",
        d("unemployment"),
        e.unemployment > 6 ? "alert" : "",
        true,
      ) +
      chip(
        "Balance",
        fmt(balShow, 1),
        "%",
        d("balance"),
        balShow < -6 ? "alert" : balShow >= 0 ? "good" : "",
      ) +
      chip(
        "Debt",
        e.debt.toFixed(0),
        "%",
        d("debt"),
        e.debt > 120 ? "alert" : "",
        true,
      ) +
      chip(
        "Yield",
        e.yield.toFixed(2),
        "%",
        d("yield"),
        e.yield > 6.5 ? "alert" : "",
        true,
      ) +
      chip(
        "Approval",
        appr.toFixed(0),
        "%",
        null,
        appr < 30 ? "alert" : appr > 55 ? "good" : "",
      ) +
      chip(
        "Capital",
        Math.round(G.capital),
        "",
        null,
        G.capital < 12 ? "alert" : "",
      ) +
      chip(
        reviewLabel,
        String(left),
        "Q",
        null,
        left <= 4 ? (therm <= polityOf().loseAt ? "alert" : "") : "",
        null,
      );
  }
  const cl = billClauses(),
    cost = billCost(),
    afford = cost <= G.capital;
  const dock = $("dockTabs");
  if (dock) {
    dock.innerHTML = TABS.map((t) => {
      let pip = "";
      if (clausesIn(t.id, cl)) pip = '<span class="pip"></span>';
      else if (t.id === "diplomacy" && hasDiploAttention(G)) {
        pip = pendingUltimatumIds(G).length
          ? '<span class="pip ult"></span>'
          : '<span class="pip"></span>';
      }
      return (
        '<button class="dock-btn" data-tab="' +
        t.id +
        '" aria-label="' +
        t.name +
        '" aria-expanded="' +
        (t.id === tab) +
        '">' +
        ((ICONS as any)[t.icon] || "") +
        "<span>" +
        t.name +
        "</span>" +
        pip +
        "</button>"
      );
    }).join("");
    dock.querySelectorAll("[data-tab]").forEach((btn: any) => {
      btn.onclick = () => {
        setTab(tab === btn.dataset.tab ? null : btn.dataset.tab);
      };
    });
  }
  const bill = $("billBtn");
  if (bill) {
    bill.setAttribute("aria-expanded", tab === "bill");
    $("billLabel").textContent = "Programme";
    $("billCost").textContent = cl.length
      ? cl.length + " \u00b7 " + cost + " cap"
      : "Empty";
    bill.onclick = () => {
      setTab(tab === "bill" ? null : "bill");
    };
  }
  const db = $("deliverBtn");
  if (db) {
    if (G.mp && G.mp.bootstrapping) {
      db.disabled = true;
      db.textContent = "Starting\u2026";
      db.title = "Connecting multiplayer room\u2026";
    } else if (G.mp && G.mp.waiting) {
      /* Stay clickable so a player can withdraw while others have not delivered. */
      db.disabled = false;
      const n = G.mp.submittedCount;
      const h = G.mp.humanCount;
      db.textContent =
        h != null && n != null ? "Waiting " + n + "/" + h : "Waiting on others";
      db.title = "Edit anything to withdraw, or click here";
    } else {
      db.disabled = _quarterFlashLock || G.over || (cl.length > 0 && !afford);
      db.textContent = G.over
        ? "Term over"
        : cl.length === 0
          ? "Next quarter"
          : afford
            ? "Deliver"
            : "No capital";
      db.removeAttribute("title");
    }
  }
  const dh = $("diploHud");
  if (dh) {
    const hud = diploHudHtml();
    dh.classList.toggle("below-mp", !!(G.mp && G.mp.humanCount));
    if (hud) {
      dh.innerHTML = hud;
      dh.hidden = false;
      if (!dh.dataset.wired) {
        dh.dataset.wired = "1";
        dh.onclick = () => {
          setTab("diplomacy");
        };
      }
    } else {
      dh.innerHTML = "";
      dh.hidden = true;
    }
  }
  const dw = $("drawer");
  if (dw) {
    const open = !!tab;
    dw.hidden = !open;
    dw.classList.toggle(
      "wide",
      tab === "charts" || tab === "policies" || tab === "taxes",
    );
    if (open) {
      const meta =
        tab === "bill"
          ? {
              name: "The Programme",
              sub: cl.length
                ? cost + " of " + Math.round(G.capital) + " capital"
                : "no clauses",
            }
          : tab === "trade"
            ? {
                name: "Trade",
                sub:
                  "Currency strength (" +
                  currencyForSeat(G.homeRole) +
                  ") " +
                  fxDisplayIndex("home").toFixed(1),
              }
            : tab === "diplomacy"
              ? {
                  name: "Diplomacy",
                  sub: "Envoys · missions · relations",
                }
              : {
                  name: (TABS.find((t) => t.id === tab) || {}).name || "",
                  sub: "",
                };
      $("dwTitle").textContent = meta.name;
      $("dwSub").textContent = meta.sub;
    }
  }
}
function clausesIn(tabId: any, cl: any) {
  const pats = {
    budget: /points of GDP/,
    taxes: /tax|duty|levy|rate|tariff|Restructure|price|pricing/i,
    policies: /Enact|Repeal/,
    society:
      /Cannabis|Psychedelics|Gambling|Alcohol|Tobacco|Adult services|Change the political system/,
    trade: /Ratify|Withdraw|tariff|Propose|Leave|Found|join /i,
    diplomacy:
      /summit|State visit|Formal protest|Restrictive measures|envoy|mission/i,
    charts: /(?!)/,
  };
  return cl.some(
    (c: any) => (pats as any)[tabId] && (pats as any)[tabId].test(c.label),
  );
}
/* ---- sliders ---- */ function leverHtml(
  id: any,
  name: any,
  val: any,
  min: any,
  max: any,
  stepv: any,
  decimals: any,
  note: any,
  cls?: any,
  disabled?: any,
) {
  return (
    '<div class="lever ' +
    (cls || "") +
    '" data-lever="' +
    id +
    '">' +
    '<div class="top"><span class="nm">' +
    name +
    '</span><span class="val">' +
    val.toFixed(decimals) +
    '%</span><span class="chg"></span></div>' +
    '<input type="range" min="' +
    min +
    '" max="' +
    max +
    '" step="' +
    stepv +
    '" value="' +
    val +
    '" aria-label="' +
    esc(name) +
    '"' +
    (disabled ? " disabled" : "") +
    ">" +
    (note ? '<div class="yield">' + note + "</div>" : "") +
    "</div>"
  );
}
function wireLevers(root: any, get: any, set: any, decimals: any) {
  root.querySelectorAll("[data-lever] input").forEach((inp: any) => {
    const row = inp.closest("[data-lever]"),
      id = row.dataset.lever;
    const paint = () => {
      const v = get(id),
        base = row.dataset.base !== undefined ? +row.dataset.base : null;
      const dp = +row.dataset.dp || decimals;
      if (v == null || !Number.isFinite(+v)) {
        row.querySelector(".val").textContent = "—";
        const c = row.querySelector(".chg");
        if (c) c.textContent = "";
        return;
      }
      row.querySelector(".val").textContent = v.toFixed(dp) + "%";
      const c = row.querySelector(".chg");
      if (base !== null) {
        const d = v - base;
        c.textContent =
          Math.abs(d) < 0.049 ? "" : sgn(d, +row.dataset.dp || decimals);
        c.className = "chg " + (d > 0 ? "up" : d < 0 ? "dn" : "");
      }
    };
    paint();
    inp.addEventListener("input", () => {
      set(id, parseFloat(inp.value));
      paint();
      renderChrome();
    });
    inp.addEventListener("change", () => {
      render();
    });
  });
}
/* ---- income tax and national insurance panel ---- */ function ctrlRow(
  name: any,
  val: any,
  min: any,
  max: any,
  step: any,
  disp: any,
  note: any,
  attrs: any,
) {
  return (
    '<div class="taxrow" ' +
    (attrs || "") +
    ">" +
    '<div class="top"><span class="nm">' +
    name +
    '</span><span class="val">' +
    disp +
    '</span><span class="chg"></span></div>' +
    '<input type="range" min="' +
    min +
    '" max="' +
    max +
    '" step="' +
    step +
    '" value="' +
    val +
    '" aria-label="' +
    esc(name) +
    '">' +
    (note ? '<div class="yield">' + note + "</div>" : "") +
    "</div>"
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
function incomePanelHtml() {
  const I = G.draft.income,
    N = G.draft.ni,
    E = aggregate(G.draft);
  const y = incomeYield(G.draft, E, G.econ);
  const flat = !!REGIME_BY_ID[G.draft.regime].flatIncome;
  const dr = dragRatio(G.draft, G.econ);
  const incomeOn = I.on !== false;
  let h = "";
  h +=
    '<div class="eyebrow mt">Income tax <b>' +
    (incomeOn ? y.income.toFixed(2) + "% of GDP" : "abolished") +
    "</b>" +
    (incomeOn && y.capital != null
      ? ' <span style="color:var(--ink-faint)">(labour ' +
        y.labour.toFixed(2) +
        ", capital " +
        y.capital.toFixed(2) +
        ")</span>"
      : "") +
    ' <button class="btn ' +
    (incomeOn ? "danger " : "") +
    'tiny" data-incometoggle="1" style="margin-left:8px">' +
    (incomeOn ? "Abolish" : "Reintroduce") +
    "</button></div>";
  h +=
    '<div class="hint">' +
    (incomeOn
      ? "Labour rates apply only above their own threshold, and only to wages and salaries." +
        (flat
          ? " The flat tax structure has collapsed every band into the first, and capital income is taxed at that same rate."
          : "") +
        (G.sandbox
          ? " Sandbox note: cutting the additional rate puts money where the MPC is low; with deficit finance the yield/FX channel can make the demand effect weakly negative — incidence is calibrated against relative demand from transfers and rate cuts."
          : "")
      : "Scrapped. About " +
        incomeYield(withIncomeOn(G.draft, true), E, G.econ).income.toFixed(2) +
        "% of GDP forgone. National insurance still starts at the personal allowance.") +
    "</div>";
  if (!incomeOn) {
    h +=
      '<div class="panel"><div class="hint" style="margin:0">The schedule is preserved so you can reintroduce it later. Abolishing costs 32 capital; bringing it back costs 28.</div></div>';
  } else {
    h +=
      '<div class="panel">' +
      ctrlRow(
        "Personal allowance",
        I.allowance,
        0,
        thresholdSliderMax(30000, I.allowance, 250),
        250,
        money(I.allowance),
        "real value " +
          Math.round(dr * 100) +
          "% of where it started" +
          (dr < 0.97
            ? " &middot; <b class=\'warn-t\'>fiscal drag is raising taxes without a vote</b>"
            : ""),
        'data-inc="allowance"',
      ) +
      '<div class="taxrow"><div class="top"><span class="nm">Threshold policy</span>' +
      '<span class="seg mini"><button data-uprate="1" aria-pressed="' +
      (I.uprate ? "true" : "false") +
      '">Uprate</button>' +
      '<button data-uprate="0" aria-pressed="' +
      (!I.uprate ? "true" : "false") +
      '">Freeze</button></span></div>' +
      '<div class="yield">Freezing thresholds raises real receipts every year without announcing anything. Voters work it out eventually.</div></div>' +
      "</div>";
    h += '<div class="panel">';
    I.bands.forEach((b: any, i: any) => {
      const nm = BAND_NAMES[i] || "Band " + (i + 1);
      const top =
        i + 1 < I.bands.length ? money(I.bands[i + 1].from) : "upwards";
      const dim = flat && i > 0;
      h +=
        '<div class="bandblock' +
        (dim ? " dim" : "") +
        '">' +
        '<div class="bandhead"><b>' +
        nm +
        "</b><span>" +
        money(b.from) +
        " to " +
        top +
        "</span>" +
        (I.bands.length > 1 && i === I.bands.length - 1
          ? '<button class="btn danger tiny" data-delband="' +
            i +
            '">Remove</button>'
          : "") +
        "</div>" +
        ctrlRow(
          nm + " rate",
          b.rate,
          0,
          90,
          1,
          b.rate + "%",
          null,
          'data-band="' + i + '" data-field="rate"',
        ) +
        (i > 0
          ? ctrlRow(
              nm + " starts at",
              b.from,
              15000,
              thresholdSliderMax(300000, b.from, 1000),
              1000,
              money(b.from),
              null,
              'data-band="' + i + '" data-field="from"',
            )
          : "") +
        "</div>";
    });
    if (I.bands.length < 6)
      h +=
        '<div class="bandadd"><button class="btn" data-addband="1">Add a band</button>' +
        '<span class="pc">Restructuring the bands costs 12 capital</span></div>';
    h += "</div>";
    const dualCap = !!REGIME_BY_ID[G.draft.regime].dualCapital;
    if (!flat) {
      h +=
        '<div class="eyebrow mt">Capital income <b>' +
        y.capital.toFixed(2) +
        "% of GDP</b></div>";
      h +=
        '<div class="hint">' +
        (dualCap
          ? "Tax on investment returns — dividends and savings interest — not on wealth itself. Both share one flat rate under this system. Selling an asset is capital gains tax."
          : "Tax on investment returns — dividends and savings interest — not on wealth itself, and not through the labour bands above. Selling an asset is capital gains tax.") +
        "</div>";
      h += '<div class="panel">';
      if (dualCap) {
        h += ctrlRow(
          "Capital income rate",
          I.capitalRate != null ? I.capitalRate : 25,
          0,
          60,
          1,
          (I.capitalRate != null ? I.capitalRate : 25) + "%",
          "one rate on dividends and savings interest alike",
          'data-inc="capitalRate"',
        );
      } else {
        h += ctrlRow(
          "Dividend rate",
          I.divRate != null ? I.divRate : 33,
          0,
          60,
          1,
          (I.divRate != null ? I.divRate : 33) + "%",
          "on dividends paid to shareholders from company profits",
          'data-inc="divRate"',
        );
        h += ctrlRow(
          "Savings rate",
          I.saveRate != null ? I.saveRate : 20,
          0,
          60,
          1,
          (I.saveRate != null ? I.saveRate : 20) + "%",
          "on interest from deposits, bonds and similar savings",
          'data-inc="saveRate"',
        );
      }
      h += "</div>";
    }
  } /* end incomeOn */
  h +=
    '<div class="eyebrow mt">National insurance <b>' +
    (y.employee + y.employer).toFixed(2) +
    "% of GDP</b></div>";
  h +=
    '<div class="hint">Two separate taxes wearing one name, and the difference is who really pays. Both start where income tax starts, so the personal allowance sets the floor for all three.</div>';
  const niHead = (name: any, on: any, yieldPct: any, key: any) =>
    '<div class="bandhead"><b>' +
    name +
    "</b>" +
    "<span>" +
    (on ? yieldPct.toFixed(2) + "% of GDP" : "abolished") +
    "</span>" +
    '<button class="btn ' +
    (on ? "danger " : "") +
    'tiny" data-nitoggle="' +
    key +
    '">' +
    (on ? "Abolish" : "Reintroduce") +
    "</button></div>";
  const floorTxt = money(effectiveBands(G.draft)[0].from);
  h +=
    '<div class="panel">' +
    '<div class="bandblock' +
    (N.empOn ? "" : " dim") +
    '">' +
    niHead("Employee", N.empOn, y.employee, "empOn") +
    (N.empOn
      ? ctrlRow(
          "Employee rate",
          N.empRate,
          0,
          30,
          0.5,
          N.empRate.toFixed(1) + "%",
          "on earnings above " +
            floorTxt +
            " &middot; comes out of the pay packet",
          'data-ni="empRate"',
        )
      : '<div class="hint" style="margin:2px 0 0">Scrapped. About ' +
        incomeYield(
          withNi(G.draft, "empOn", true),
          aggregate(G.draft),
          G.econ,
        ).employee.toFixed(2) +
        "% of GDP forgone, and every earner above the allowance keeps it.</div>") +
    "</div>" +
    '<div class="bandblock' +
    (N.erOn ? "" : " dim") +
    '">' +
    niHead("Employer", N.erOn, y.employer, "erOn") +
    (N.erOn
      ? ctrlRow(
          "Employer rate",
          N.erRate,
          0,
          30,
          0.1,
          N.erRate.toFixed(1) + "%",
          "a tax on the job, not the pay &middot; every point adds roughly 0.06 to structural unemployment",
          'data-ni="erRate"',
        )
      : '<div class="hint" style="margin:2px 0 0">Scrapped. About ' +
        incomeYield(
          withNi(G.draft, "erOn", true),
          aggregate(G.draft),
          G.econ,
        ).employer.toFixed(2) +
        "% of GDP forgone, but hiring gets cheaper and structural unemployment falls.</div>") +
    "</div></div>";
  return h;
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
function wireIncomePanel(host: any) {
  const I = G.draft.income,
    N = G.draft.ni;
  const live = (el?: any) => {
    renderChrome();
  };
  host.querySelectorAll("[data-incometoggle]").forEach((b: any) => {
    b.onclick = () => {
      I.on = !(I.on !== false);
      render();
    };
  });
  host.querySelectorAll("[data-nitoggle]").forEach((b: any) => {
    b.onclick = () => {
      const k = b.dataset.nitoggle;
      G.draft.ni[k] = !G.draft.ni[k];
      render();
    };
  });
  host.querySelectorAll('[data-inc="allowance"] input').forEach((inp: any) => {
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      I.allowance = v;
      I.bands[0].from = v;
      inp.closest("[data-inc]").querySelector(".val").textContent = money(v);
      live();
    });
    inp.addEventListener("change", render);
  });
  host
    .querySelectorAll(
      '[data-inc="divRate"] input, [data-inc="saveRate"] input, [data-inc="capitalRate"] input',
    )
    .forEach((inp: any) => {
      const row = inp.closest("[data-inc]"),
        k = row.dataset.inc;
      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        I[k] = v;
        row.querySelector(".val").textContent = v + "%";
        live();
      });
      inp.addEventListener("change", render);
    });
  host.querySelectorAll("[data-band] input").forEach((inp: any) => {
    const row = inp.closest("[data-band]"),
      i = +row.dataset.band,
      f = row.dataset.field;
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      I.bands[i][f] = v;
      row.querySelector(".val").textContent = f === "rate" ? v + "%" : money(v);
      live();
    });
    inp.addEventListener("change", render);
  });
  host.querySelectorAll("[data-ni] input").forEach((inp: any) => {
    const row = inp.closest("[data-ni]"),
      k = row.dataset.ni;
    const isRate = k === "empRate" || k === "empUpper" || k === "erRate";
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      N[k] = v;
      row.querySelector(".val").textContent = isRate
        ? v.toFixed(1) + "%"
        : money(v);
      live();
    });
    inp.addEventListener("change", render);
  });
  host.querySelectorAll("[data-uprate]").forEach((b: any) => {
    b.onclick = () => {
      I.uprate = b.dataset.uprate === "1";
      render();
    };
  });
  host.querySelectorAll("[data-addband]").forEach((b: any) => {
    b.onclick = () => {
      const last = I.bands[I.bands.length - 1];
      I.bands.push({
        from: Math.round((last.from * 1.8) / 1000) * 1000 + 20000,
        rate: Math.min(90, last.rate + 5),
      });
      render();
    };
  });
  host.querySelectorAll("[data-delband]").forEach((b: any) => {
    b.onclick = () => {
      I.bands.splice(+b.dataset.delband, 1);
      render();
    };
  });
}
/* ---- charts ---- */ function lineChart(series: any, opts?: any) {
  opts = opts || {};
  const h = opts.h || 168,
    w = 600,
    padL = 36,
    padR = 54,
    padT = 10,
    padB = 20;
  const len = series[0] ? series[0].data.length : 0;
  if (len < 2)
    return '<div class="empty">Not enough quarters recorded yet.</div>';
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
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4,
      y = Y(v);
    g +=
      '<line x1="' +
      padL +
      '" y1="' +
      y.toFixed(1) +
      '" x2="' +
      (w - padR) +
      '" y2="' +
      y.toFixed(1) +
      '" stroke="#d6cdb8" stroke-width="1"/>' +
      '<text x="' +
      (padL - 5) +
      '" y="' +
      (y + 3.5).toFixed(1) +
      '" text-anchor="end" font-size="8.5" font-family="IBM Plex Mono, monospace" fill="#8d8474">' +
      v.toFixed(Math.abs(mx) > 60 ? 0 : 1) +
      "</text>";
  }
  if (opts.target != null) {
    const y = Y(opts.target);
    g +=
      '<line x1="' +
      padL +
      '" y1="' +
      y.toFixed(1) +
      '" x2="' +
      (w - padR) +
      '" y2="' +
      y.toFixed(1) +
      '" stroke="#c0392f" stroke-width="1" stroke-dasharray="3 3"/>';
  }
  const lbl = G.log.map((r: any) => r.label);
  for (let i = 0; i < len; i += Math.max(1, Math.ceil(len / 7))) {
    g +=
      '<text x="' +
      X(i).toFixed(1) +
      '" y="' +
      (h - 6) +
      '" text-anchor="middle" font-size="8" font-family="IBM Plex Mono, monospace" fill="#8d8474">' +
      (lbl[i] || "") +
      "</text>";
  }
  series.forEach((s: any) => {
    const pts = s.data
      .map((v: any, i: any) => X(i).toFixed(1) + "," + Y(v).toFixed(1))
      .join(" ");
    g +=
      '<polyline points="' +
      pts +
      '" fill="none" stroke="' +
      s.color +
      '" stroke-width="' +
      (s.wide ? 2 : 1.4) +
      '"' +
      (s.dash ? ' stroke-dasharray="4 3"' : "") +
      "/>";
    const lv = s.data[len - 1];
    g +=
      '<circle cx="' +
      X(len - 1).toFixed(1) +
      '" cy="' +
      Y(lv).toFixed(1) +
      '" r="2.2" fill="' +
      s.color +
      '"/>' +
      '<text x="' +
      (w - padR + 6) +
      '" y="' +
      (Y(lv) + 3).toFixed(1) +
      '" font-size="9" font-family="IBM Plex Mono, monospace" fill="' +
      s.color +
      '">' +
      lv.toFixed(1) +
      "</text>";
  });
  return (
    '<svg viewBox="0 0 ' +
    w +
    " " +
    h +
    '" width="100%" height="' +
    h +
    '" role="img">' +
    g +
    "</svg>" +
    '<div class="legend">' +
    series
      .map(
        (s: any) =>
          '<span><i style="background:' +
          s.color +
          '"></i>' +
          s.label +
          "</span>",
      )
      .join("") +
    (opts.targetLabel
      ? '<span><i style="background:#c0392f"></i>' +
        opts.targetLabel +
        "</span>"
      : "") +
    "</div>"
  );
}
/**
 * Data form of lineChart() for React consumers — same scales and layout,
 * returned as plain numbers/points instead of an SVG string. Returns null
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

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4,
      y = Y(v);
    gridLines.push({
      y: +y.toFixed(1),
      label: v.toFixed(Math.abs(mx) > 60 ? 0 : 1),
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
      lastValue: lv.toFixed(1),
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
const chartBox = (title: any, cap: any, body: any) =>
  '<div class="chartbox"><h3>' +
  title +
  '</h3><div class="cap">' +
  cap +
  "</div>" +
  body +
  "</div>";
const col = (k: any) => G.log.map((r: any) => r[k]);
function compositionBar() {
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
  const names = {
    income: "Income tax and NI",
    consumption: "Consumption",
    corporate: "Corporate",
    wealth: "Capital & land",
    vice: "Duties on regulated goods",
    other: "Other receipts",
  };
  const cols = {
    income: COL.ink,
    consumption: COL.brass,
    corporate: COL.blue,
    wealth: COL.plum,
    vice: COL.green,
    other: COL.soft,
  };
  const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1;
  let x = 0,
    bar = "";
  for (const k in groups) {
    const wdt = ((groups as any)[k] / total) * 100;
    bar +=
      '<rect x="' +
      x.toFixed(2) +
      '%" y="0" width="' +
      wdt.toFixed(2) +
      '%" height="22" fill="' +
      (cols as any)[k] +
      '"/>';
    x += wdt;
  }
  return (
    '<svg viewBox="0 0 100 22" width="100%" height="22" preserveAspectRatio="none">' +
    bar +
    "</svg>" +
    '<div class="legend">' +
    Object.keys(groups)
      .map(
        (k) =>
          '<span><i style="background:' +
          (cols as any)[k] +
          '"></i>' +
          (names as any)[k] +
          " " +
          (groups as any)[k].toFixed(1) +
          "</span>",
      )
      .join("") +
    "</div>"
  );
}
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
/* ---- tab panels ---- */ function globeFallbackHtml() {
  let img = "";
  try {
    img =
      '<img alt="Map of the world of {C}" src="' +
      (globalThis as any).worldCanvas().toDataURL("image/png") +
      '">';
  } catch (err) {
    img = "";
  }
  return (
    '<div class="globe-fallback">' +
    img +
    "<p>3D globe unavailable here, so this is the flat map. Everything else in the game is unaffected.</p></div>"
  );
}
/* Share of GDP, indexed to inflation, or pegged to a service standard. */ /* Us against the rest of the world, on the numbers a Chancellor is judged on. */ function nationTableHtml() {
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
  const cell = (v: any, d: any, inv?: any) =>
    '<td class="' +
    ((inv ? -v : v) > 0 ? "pos" : (inv ? -v : v) < 0 ? "neg" : "") +
    '">' +
    fmt(v, d) +
    "</td>";
  return (
    '<div class="ledger-wrap"><table class="ledger">' +
    "<thead><tr><th>Country</th><th>Growth</th><th>Inflation</th><th>Deficit</th><th>Debt</th></tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr" +
          (r.us ? ' style="background:rgba(212,175,105,.16)"' : "") +
          ">" +
          "<td>" +
          esc(r.name) +
          (r.us ? " &middot; you" : "") +
          "</td>" +
          cell(r.growth, 1) +
          "<td>" +
          r.inflation.toFixed(1) +
          "</td>" +
          cell(-r.deficit, 1) +
          "<td>" +
          r.debt.toFixed(0) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
/** Data form of nationTableHtml() for React consumers. */
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
function budgetModeHtml(d: any, transferOnly?: any) {
  const cur = (G.draft.mode || {})[d.id] || "share";
  const opts = transferOnly
    ? [
        ["share", "Share of GDP"],
        ["real", "With inflation"],
      ]
    : [
        ["share", "Share of GDP"],
        ["real", "With inflation"],
        ["service", "Hold service level"],
      ];
  return (
    '<div class="seg mini" style="margin-top:6px">' +
    opts
      .map(
        (o) =>
          '<button data-mode="' +
          d.id +
          '" data-modeval="' +
          o[0] +
          '" aria-pressed="' +
          (o[0] === cur) +
          '">' +
          o[1] +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}
function panelHost() {
  if (typeof document !== "undefined") {
    const live = document.getElementById("drawerBody");
    if (live) {
      registerEl("drawerBody", live);
      return live;
    }
  }
  return $("drawerBody");
}

function renderPanelInto(host: any, tabOverride?: any) {
  if (!host) return;
  const prevTab = tab;
  const activeTab = tabOverride != null ? tabOverride : tab;
  if (!activeTab) return;
  tab = activeTab;
  try {
    _renderPanelBody(host);
  } finally {
    tab = prevTab;
  }
}

function renderPanel() {
  if (!tab || UI_REACT_PANELS.has(tab)) return;
  const host = panelHost();
  if (!host) return;
  renderPanelInto(host);
}

function paintBillPanel(host: any) {
  if (!host || !G) return;
  const cl = billClauses();
  const dr = balanceOf(G.draft, G.econ),
    cur = balanceOf(G.law, G.econ);
  const delta = dr.balance - cur.balance;
  host.innerHTML =
    impactStripHtml() +
    (cl.length
      ? '<div id="clauses">' +
        cl
          .map(
            (c, i) =>
              '<div class="clause"><button class="x" data-undo="' +
              i +
              '" title="Remove clause">' +
              ICONS.close +
              "</button>" +
              "<span>" +
              esc(c.label) +
              '</span><span class="cost">' +
              (c.sunk ? "paid" : c.pc) +
              "</span></div>",
          )
          .join("") +
        "</div>"
      : '<div class="empty-bill">No clauses yet. Change anything in Budget, Taxes, Policies, Society, Trade or Diplomacy ' +
        "and it appears here to be costed before it becomes law.</div>") +
    '<div class="arith">' +
    "<div><span>Receipts</span><span>" +
    dr.rev.total.toFixed(1) +
    "</span></div>" +
    "<div><span>Departmental</span><span>" +
    dr.sp.prog.toFixed(1) +
    "</span></div>" +
    "<div><span>Debt interest</span><span>" +
    dr.sp.interest.toFixed(1) +
    "</span></div>" +
    '<div class="total"><span>' +
    (dr.balance >= 0 ? "Surplus" : "Deficit") +
    "</span>" +
    '<span class="' +
    (dr.balance >= 0 ? "pos" : "neg") +
    '">' +
    fmt(dr.balance, 1) +
    "% of GDP</span></div>" +
    (Math.abs(delta) > 0.049
      ? '<div class="note" style="padding-top:5px">' +
        sgn(delta, 1) +
        " points versus current law</div>"
      : "") +
    "</div>" +
    (G.sandbox ? impactPanelHtml(cl) : "") +
    '<div class="eyebrow mt">Rules</div>' +
    '<div class="panel" style="padding:11px 13px;margin-top:0">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:140px"><div style="font-weight:600;font-size:13.5px">Central Bank</div>' +
    '<div class="hint" style="margin:2px 0 0">' +
    (G.rateManual
      ? "Base rate is pinned by you. No political capital. Forecasts use the same pin."
      : "The Bank follows a Taylor rule. Switch to Manual to pin the base rate for experimentation — free, no capital cost.") +
    "</div></div>" +
    '<span class="seg mini">' +
    '<button data-rate-mode="bank" aria-pressed="' +
    (!G.rateManual ? "true" : "false") +
    '">Bank</button>' +
    '<button data-rate-mode="manual" aria-pressed="' +
    (G.rateManual ? "true" : "false") +
    '">Manual</button>' +
    "</span>" +
    "</div>" +
    (G.rateManual
      ? '<div id="manualRateLever" style="margin-top:10px">' +
        leverHtml(
          "manualRate",
          "Base rate",
          G.manualRate,
          MANUAL_RATE_MIN,
          20,
          0.25,
          2,
          "Applied immediately. Held every quarter until you return the rate to the Bank. Down to −2%; the Bank itself floors at −1%.",
        ) +
        "</div>" +
        rateImpactHtml()
      : "") +
    "</div>" +
    '<button class="reset" id="resetBtn2" style="margin-top:14px">Start a new government</button>';
  host.querySelectorAll("[data-undo]").forEach((btn: any) => {
    btn.onclick = () => {
      billClauses()[+btn.dataset.undo].undo();
      render();
    };
  });
  const rb = $("resetBtn2");
  if (rb)
    rb.onclick = () => {
      $("scrim").hidden = true;
      requestSetup();
    };
  host.querySelectorAll("[data-rate-mode]").forEach((b: any) => {
    b.onclick = () => {
      const manual = b.dataset.rateMode === "manual";
      if (manual && !G.rateManual) {
        G.manualRate = +G.econ.rate.toFixed(2);
        G.econ.rate = G.manualRate;
      }
      G.rateManual = manual;
      const sid = playerCountryId();
      if (G.politics && G.politics[sid]) {
        G.politics[sid].rateManual = manual;
        G.politics[sid].manualRate = G.manualRate;
      }
      render();
    };
  });
  const mrl = $("manualRateLever");
  if (mrl) {
    wireLevers(
      mrl,
      () => G.manualRate,
      (id: any, v: any) => {
        G.manualRate = clamp(v, MANUAL_RATE_MIN, 20);
        G.econ.rate = G.manualRate;
        G.econ.atBound = G.econ.rate <= RATE_FLOOR + 0.02;
        const sid = playerCountryId();
        if (G.politics && G.politics[sid])
          G.politics[sid].manualRate = G.manualRate;
      },
      2,
    );
  }
}

function paintBudgetPanel(host: any) {
  if (!host || !G) return;
  const e = G.econ;
  /* Keep held standards aligned with the live sliders before we paint. */ syncServiceHolds(
    G.draft,
    G.econ,
  );
  /* Next year / Approval / This quarter live on Programme (and the
     morning-note despatch), not duplicated at the top of Budget. */
  host.innerHTML =
    '<div class="eyebrow">Departmental spending, % of GDP</div>' +
    '<div class="hint">Standing still is a cut: demand for services rises about one percent a year on its own.</div>' +
    '<div class="panel" id="deptLevers">' +
    DEPTS.map((d) => {
      const held = G.draft.hold && G.draft.hold[d.id];
      if ((TRANSFER_DEPTS as any)[d.id]) {
        const bill = welfareCost(G.draft, G.econ),
          adeq = welfareAdequacy(G.draft, G.econ);
        return leverHtml(
          d.id,
          d.name,
          G.draft.spend[d.id],
          d.min,
          d.max,
          0.1,
          1,
          "costs <b>" +
            bill.toFixed(2) +
            "%</b> of GDP at today&rsquo;s unemployment &middot; " +
            "per claimant " +
            (adeq * 100).toFixed(0) +
            "% of the opening rate",
          "spend",
        );
      }
      const score = held != null ? held : serviceScore(d.id, G.draft, G.econ);
      const holdCost = spendForScore(d.id, score, G.econ);
      return leverHtml(
        d.id,
        d.name,
        G.draft.spend[d.id],
        d.min,
        d.max,
        0.1,
        1,
        "service level <b>" +
          score.toFixed(0) +
          "</b> / 100 &middot; " +
          "holding this level costs " +
          holdCost.toFixed(2) +
          "% of GDP" +
          budgetModeHtml(d),
        "spend",
      );
    }).join("") +
    "</div>" +
    '<div class="eyebrow mt">The ledger</div>' +
    '<div class="ledger-wrap">' +
    ledgerTable() +
    "</div>";
  host.querySelectorAll("[data-mode]").forEach((b: any) => {
    /* Keep the range from blurring on mousedown — otherwise change→render()
         destroys this button before click, or commits a stale thumb. */
    b.addEventListener("pointerdown", (ev: any) => ev.preventDefault());
    b.onclick = () => {
      const id = b.dataset.mode,
        m = b.dataset.modeval;
      if (!G.draft.mode) G.draft.mode = {};
      if (!G.draft.hold) G.draft.hold = {};
      /* Commit the live slider for this dept before snapshotting hold. */
      const inp = host.querySelector('[data-lever="' + id + '"] input');
      if (inp && !(TRANSFER_DEPTS as any)[id]) {
        const live = parseFloat(inp.value);
        if (Number.isFinite(live)) G.draft.spend[id] = live;
      }
      if (m === "share") delete G.draft.mode[id];
      else G.draft.mode[id] = m;
      if (m === "service") {
        G.draft.hold[id] = serviceScore(id, G.draft, G.econ);
        /* Pin spend to the cost of that level so the thumb matches hold. */
        G.draft.spend[id] = spendForScore(id, G.draft.hold[id], G.econ);
      } else delete G.draft.hold[id];
      render();
    };
  });
  const root = $("deptLevers");
  DEPTS.forEach((d) => {
    const r = root.querySelector('[data-lever="' + d.id + '"]');
    r.dataset.base = G.law.spend[d.id];
    r.dataset.dp = 1;
  });
  wireLevers(
    root,
    (id: any) => G.draft.spend[id],
    (id: any, v: any) => {
      G.draft.spend[id] = v;
      /* Hold mode freezes a service standard — keep it aligned with the slider. */
      if (
        (G.draft.mode || {})[id] === "service" &&
        !(TRANSFER_DEPTS as any)[id]
      ) {
        if (!G.draft.hold) G.draft.hold = {};
        G.draft.hold[id] = serviceScore(id, G.draft, G.econ);
      }
    },
    1,
  );
}

function paintTaxesPanel(host: any) {
  if (!host || !G) return;
  const e = G.econ,
    E = aggregate(G.draft);
  const rev = revenue(G.draft, E);
  const groups = [
    ["income", "__income__"],
    ["wealth", "Capital, land and inheritance"],
    ["consumption", "Consumption and duties"],
    ["corporate", "Business"],
    ["vice", "Regulated goods and services"],
  ];
  host.innerHTML =
    '<div class="eyebrow">The structure of the system</div>' +
    '<div class="hint">Changing the architecture is the biggest thing you can do, and the most expensive. Rates within a system are cheap by comparison.</div>' +
    '<div class="cards">' +
    REGIMES.map((r) => {
      const on = G.draft.regime === r.id,
        isLaw = G.law.regime === r.id;
      return (
        '<div class="card ' +
        (isLaw ? "on" : "") +
        " " +
        (on && !isLaw ? "staged" : "") +
        '"><h4>' +
        r.name +
        '<span class="cat">' +
        (isLaw ? "in force" : r.pc + " capital") +
        "</span></h4>" +
        "<p>" +
        T(r.blurb) +
        "</p>" +
        '<div class="foot">' +
        (on
          ? '<span class="pc">' +
            (isLaw ? "Current system" : "Staged in the bill") +
            "</span>"
          : '<button class="btn" data-regime="' + r.id + '">Adopt</button>') +
        "</div></div>"
      );
    }).join("") +
    "</div>" +
    '<div class="eyebrow mt">Where the money comes from</div>' +
    compositionBar() +
    groups
      .map((param) => {
        const [g, label] = param;
        if (g === "income") return incomePanelHtml();
        const list = TAXES.filter((t) => t.grp === g);
        return (
          '<div class="eyebrow mt">' +
          label +
          '</div><div class="panel" data-taxgrp="' +
          g +
          '">' +
          list
            .map((t) => {
              const s = G.draft.taxes[t.id],
                avail = taxAvailable(t, G.draft);
              const killed = (
                REGIME_BY_ID[G.draft.regime].kills || []
              ).includes(t.id);
              if (!avail)
                return (
                  '<div class="lever" style="opacity:.5"><div class="top"><span>' +
                  t.name +
                  "</span>" +
                  '<span class="val" style="color:var(--ink-faint)">unavailable</span></div>' +
                  '<div class="yield">Requires a change to the law on ' +
                  VICE_BY_ID[t.req![0]].name.toLowerCase() +
                  ".</div></div>"
                );
              if (killed)
                return (
                  '<div class="lever" style="opacity:.5"><div class="top"><span>' +
                  t.name +
                  "</span>" +
                  '<span class="val" style="color:var(--ink-faint)">abolished</span></div><div class="yield">Removed by the flat tax structure.</div></div>'
                );
              if (!s.on)
                return (
                  '<div class="lever"><div class="top"><span style="color:var(--ink-soft)">' +
                  t.name +
                  "</span>" +
                  '<span class="val" style="color:var(--ink-faint)">not levied</span>' +
                  '<button class="btn" data-newtax="' +
                  t.id +
                  '" style="margin-left:8px">Introduce</button></div>' +
                  '<div class="yield">Introducing it costs ' +
                  (t.pc || 6) +
                  " political capital.</div></div>"
                );
              const y = (rev.by as any)[t.id] || 0;
              return leverHtml(
                t.id,
                t.name,
                s.rate,
                0,
                t.max,
                t.step || 1,
                dp(t),
                "raises " +
                  y.toFixed(2) +
                  "% of GDP" +
                  (t.grp === "vice"
                    ? " &middot; black market " + E.blackLevel.toFixed(0) + "%"
                    : "") +
                  ' <button class="btn danger" data-killtax="' +
                  t.id +
                  '" style="margin-left:8px;padding:2px 7px">Abolish</button>',
              );
            })
            .join("") +
          "</div>"
        );
      })
      .join("");
  wireIncomePanel(host);
  host.querySelectorAll("[data-regime]").forEach(
    (b: any) =>
      (b.onclick = () => {
        G.draft.regime = b.dataset.regime;
        render();
      }),
  );
  host.querySelectorAll("[data-newtax]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const t = TAX_BY_ID[b.dataset.newtax];
        const s = G.draft.taxes[t.id];
        s.on = true;
        if (!(s.rate > 0))
          s.rate =
            t.def > 0 ? t.def : t.step ? t.step * 5 : Math.round(t.max * 0.2);
        render();
      }),
  );
  host.querySelectorAll("[data-killtax]").forEach(
    (b: any) =>
      (b.onclick = () => {
        G.draft.taxes[b.dataset.killtax].on = false;
        render();
      }),
  );
  host.querySelectorAll("[data-taxgrp]").forEach((root: any) => {
    root.querySelectorAll("[data-lever]").forEach((r: any) => {
      const t = TAX_BY_ID[r.dataset.lever];
      r.dataset.base = G.law.taxes[t.id].on ? G.law.taxes[t.id].rate : 0;
      r.dataset.dp = dp(t);
    });
    wireLevers(
      root,
      (id: any) => G.draft.taxes[id].rate,
      (id: any, v: any) => {
        G.draft.taxes[id].rate = v;
      },
      0,
    );
  });
}

function paintPoliciesPanel(host: any) {
  if (!host || !G) return;
  const cats = POLICY_CAT_ORDER.filter((c) =>
    POLICIES.some((p) => p.cat === c),
  ).concat(
    [...new Set(POLICIES.map((p) => p.cat))].filter(
      (c) => !POLICY_CAT_ORDER.includes(c),
    ),
  );
  const matchFilter = (p: any) => {
    const isLaw = !!G.law.policies[p.id],
      staged = !!G.draft.policies[p.id];
    if (policyFilter === "force") return isLaw;
    if (policyFilter === "staged") return staged !== isLaw;
    if (policyFilter === "available") return !isLaw && staged === isLaw;
    return true;
  };
  const killLine = (p: any) => {
    if (!p.kills || !p.kills.length) return "";
    const names = p.kills.map(
      (id: any) => (POLICY_BY_ID[id] && POLICY_BY_ID[id].name) || id,
    );
    return (
      '<div class="eff" style="color:var(--amber)">Cannot sit with ' +
      esc(names.join(", ")) +
      "</div>"
    );
  };
  const cardHtml = (p: any) => {
    const isLaw = !!G.law.policies[p.id],
      staged = !!G.draft.policies[p.id];
    /* Career and Sandbox both get signed qualitative effects; Sandbox also
     gets the full numeric channel list via fullEffects. */ const effects =
      G.sandbox
        ? fullEffects(p.imp, p.fac, p.cost, p.ch)
        : qualEffects(p.imp, p.fac, p.cost, p.ch);
    return (
      '<div class="card ' +
      (isLaw ? "on" : "") +
      " " +
      (staged !== isLaw ? "staged" : "") +
      '">' +
      "<h4>" +
      p.name +
      "</h4><p>" +
      T(p.blurb) +
      "</p>" +
      effects +
      killLine(p) +
      '<div class="foot"><span class="pc">' +
      (staged === isLaw ? (isLaw ? "In force" : p.pc + " capital") : "staged") +
      "</span>" +
      '<button class="btn ' +
      (staged ? "danger" : "") +
      '" data-pol="' +
      p.id +
      '">' +
      (staged ? "Repeal" : "Enact") +
      "</button></div></div>"
    );
  };
  const filters = [
    ["all", "All"],
    ["force", "In force"],
    ["staged", "Staged"],
    ["available", "Available"],
  ];
  host.innerHTML =
    '<div class="eyebrow">The statute book</div>' +
    '<div class="hint">Enacted policy stays in force until repealed, and repeal costs capital too. Costs are annual, in points of GDP.</div>' +
    '<div class="seg mini" style="margin:8px 0 12px" id="polFilter">' +
    filters
      .map((param) => {
        const [id, lab] = param;
        return (
          '<button type="button" data-polfilter="' +
          id +
          '" aria-pressed="' +
          (policyFilter === id) +
          '">' +
          lab +
          "</button>"
        );
      })
      .join("") +
    "</div>" +
    cats
      .map((c) => {
        const list = POLICIES.filter((p) => p.cat === c && matchFilter(p));
        if (!list.length) return "";
        return (
          '<div class="eyebrow mt">' +
          c +
          '</div><div class="cards">' +
          list.map(cardHtml).join("") +
          "</div>"
        );
      })
      .join("");
  host.querySelectorAll("[data-polfilter]").forEach(
    (b: any) =>
      (b.onclick = () => {
        policyFilter = b.dataset.polfilter;
        render();
      }),
  );
  host.querySelectorAll("[data-pol]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const p = POLICY_BY_ID[b.dataset.pol];
        if (G.draft.policies[p.id]) delete G.draft.policies[p.id];
        else {
          G.draft.policies[p.id] = true;
          (p.kills || []).forEach((k) => delete G.draft.policies[k]);
        }
        render();
      }),
  );
}

function paintSocietyPanel(host: any) {
  if (!host || !G) return;
  const e = G.econ,
    E = aggregate(G.draft);
  const facHtml =
    '<div class="eyebrow">Where you stand</div><div class="panel" style="padding:11px 13px">' +
    FACTIONS.map((f) => {
      const v = G.fac[f.id],
        cls = v > 55 ? "good" : v < 38 ? "bad" : "";
      return (
        '<div class="frow" style="grid-template-columns:110px 1fr 34px;margin-bottom:4px">' +
        "<span>" +
        f.name +
        ' <span style="color:var(--ink-faint);font-size:10px">' +
        Math.round(f.w * 100) +
        "%</span></span>" +
        '<span class="fb"><i class="' +
        cls +
        '" style="width:' +
        v.toFixed(0) +
        '%"></i></span>' +
        '<span class="fv">' +
        v.toFixed(0) +
        "</span></div>"
      );
    }).join("") +
    '<div class="frow" style="grid-template-columns:110px 1fr 34px;border-top:1px solid var(--rule);padding-top:5px;margin-top:3px">' +
    '<span style="font-weight:600">Approval</span><span class="fb"><i style="width:' +
    approvalOf(G.fac).toFixed(0) +
    '%;background:var(--red)"></i></span>' +
    '<span class="fv" style="font-weight:600">' +
    approvalOf(G.fac).toFixed(0) +
    "</span></div></div>";
  const bars = [
    ["liberty", "Civil liberty", e.liberty],
    ["crime", "Crime", e.crime],
    ["health", "Public health", e.health],
    ["env", "Environment", e.env],
    ["black", "Black market share", E.blackLevel],
    ["gini", "Inequality (Gini)", e.gini],
  ];
  const lawPolity = G.law.polity || "democracy";
  const draftPolity = G.draft.polity || "democracy";
  const polityStaged = draftPolity !== lawPolity;
  const polityHtml =
    '<div class="eyebrow mt">Political system</div>' +
    '<div class="hint">Stage any system. A neighbour costs the listed capital; leaping democracy ↔ authoritarian costs much more. Factions move when you deliver.</div>' +
    '<div class="cards">' +
    POLITY_LADDER.map((id) => {
      const m = POLITY[id];
      const isLaw = id === lawPolity;
      const on = id === draftPolity;
      const pc = polityChangePc(lawPolity, id);
      const steps = politySteps(lawPolity, id);
      const leap = steps > 1;
      const cat = isLaw
        ? "in force"
        : leap
          ? "leap · " + pc + " capital"
          : pc + " capital";
      return (
        '<div class="card ' +
        (isLaw ? "on" : "") +
        " " +
        (on && !isLaw ? "staged" : "") +
        '"><h4>' +
        m.label +
        '<span class="cat">' +
        cat +
        "</span></h4>" +
        "<p>" +
        m.blurb +
        "</p>" +
        '<div class="foot">' +
        (on
          ? '<span class="pc">' +
            (isLaw
              ? "Current system"
              : leap
                ? "Staged leap — " + pc + " capital"
                : "Staged in the bill") +
            "</span>"
          : '<button class="btn" data-polity="' +
            id +
            '">' +
            (isLaw ? "Revert" : leap ? "Stage leap" : "Stage") +
            "</button>") +
        "</div></div>"
      );
    }).join("") +
    "</div>";
  host.innerHTML =
    facHtml +
    '<div class="eyebrow mt">Social indicators</div>' +
    '<div class="panel" style="padding:11px 13px">' +
    bars
      .map((param) => {
        const [k, n, v] = param;
        return (
          '<div class="frow" style="grid-template-columns:150px 1fr 34px;margin-bottom:4px"><span>' +
          n +
          "</span>" +
          '<span class="fb"><i style="width:' +
          clamp(v, 0, 100).toFixed(0) +
          "%;background:" +
          (k === "crime" || k === "black" || k === "gini"
            ? v > 50
              ? "var(--red)"
              : "var(--ink-soft)"
            : v > 55
              ? "var(--green)"
              : "var(--ink-soft)") +
          '"></i></span>' +
          '<span class="fv">' +
          v.toFixed(0) +
          "</span></div>"
        );
      })
      .join("") +
    "</div>" +
    polityHtml +
    '<div class="eyebrow mt">What is legal, and on what terms</div>' +
    '<div class="hint">Prohibition pushes a market underground: no receipts, more crime. Legalising creates a tax base you can then set a duty on, over on the Taxes tab.</div>' +
    '<div class="cards">' +
    VICE.map((v) => {
      const cur = G.draft.vice[v.id],
        inLaw = G.law.vice[v.id];
      const st = v.states.find((s) => s.id === cur)!;
      return (
        '<div class="card ' +
        (cur !== inLaw ? "staged" : "on") +
        '"><h4>' +
        v.name +
        '<span class="cat">' +
        v.pc +
        " capital</span></h4>" +
        '<div class="seg">' +
        v.states
          .map(
            (s) =>
              '<button data-vice="' +
              v.id +
              '" data-state="' +
              s.id +
              '" aria-pressed="' +
              (s.id === cur) +
              '" class="' +
              (s.id === cur && s.id !== inLaw ? "staged" : "") +
              '">' +
              s.label +
              "</button>",
          )
          .join("") +
        "</div>" +
        "<p>" +
        T(st.blurb) +
        "</p>" +
        (G.sandbox
          ? fullEffects(st.imp, st.fac, 0)
          : qualEffects(st.imp, st.fac, 0)) +
        (v.tax
          ? '<div class="eff" style="color:var(--ink-faint)">' +
            (taxAvailable(TAX_BY_ID[v.tax], G.draft)
              ? "Duty available"
              : "No duty can be levied in this state") +
            "</div>"
          : "") +
        "</div>"
      );
    }).join("") +
    "</div>";
  host.querySelectorAll("[data-polity]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const id = b.dataset.polity;
        if (!polityCanReach(lawPolity, id)) return;
        G.draft.polity = id;
        render();
      }),
  );
  host.querySelectorAll("[data-vice]").forEach(
    (b: any) =>
      (b.onclick = () => {
        G.draft.vice[b.dataset.vice] = b.dataset.state;
        for (const t of TAXES)
          if (!taxAvailable(t, G.draft)) G.draft.taxes[t.id].on = false;
        render();
      }),
  );
}

function paintTradePanel(host: any) {
  if (!host || !G) return;
  ensureDiploStocks(G.econ);
  const Eagg = aggregate(G.draft, G.homeRole, G.blocMember);
  syncTariffHeadline(G.draft);
  const importT = importTariffLevel(
    G.draft,
    Eagg,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  const pae = G.econ.partnerAccessEff || {};
  const accessPhased = (Object.values(pae) as number[]).reduce(
    (s, v) => s + v,
    0,
  );
  const exposureTarget = tradeExposureTarget(
    G.draft,
    Eagg,
    G.econ,
    G.homeRole,
    G.blocMember,
  );
  const bilat = G.econ.bilateralX || {};
  const bilatTotal =
    Object.keys(bilat).reduce((s, k) => s + (bilat[k] || 0), 0) || 1;
  const tradeReadout =
    '<div class="hint">Treaty benefits phase in over about five years — openness, tariff cuts and market access crawl in; they do not jump on the day you ratify.</div>' +
    '<div class="hint">Retaliation ' +
    (G.econ.retaliation || 0).toFixed(1) +
    " &middot; trade-weighted tariff " +
    importT.toFixed(1) +
    "%" +
    " &middot; partner access " +
    accessPhased.toFixed(1) +
    " of " +
    (Eagg.access || 0).toFixed(1) +
    " &middot; trade depth " +
    (G.econ.tradeDepth || 0).toFixed(1) +
    " of " +
    exposureTarget.toFixed(1) +
    " &middot; openness phased " +
    (G.econ.openEff || 0).toFixed(1) +
    " of " +
    (Eagg.dealOpen || 0).toFixed(1) +
    "</div>";
  const fxIdx = fxDisplayIndex("home");
  const fxCode = currencyForSeat(G.homeRole);
  const fxColor =
    fxIdx > 100.5 ? "var(--green-lt)" : fxIdx < 99.5 ? "var(--red-lt)" : "#fff";
  const fxPanel =
    '<div class="eyebrow">Currency</div>' +
    '<div class="panel" style="padding:12px 14px;margin-bottom:12px">' +
    '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">' +
    '<div style="font-size:28px;font-weight:650;letter-spacing:-.03em;line-height:1;color:' +
    fxColor +
    '">' +
    fxIdx.toFixed(1) +
    "</div>" +
    '<div style="flex:1;min-width:160px">' +
    '<div style="font-weight:650;font-size:14px">Currency strength (' +
    fxCode +
    ")</div>" +
    '<div class="hint" style="margin:3px 0 0">Versus the USD numeraire. Opening = 100. A stronger currency hurts exports and cheapens imports. The Bank and fiscal risk move it — you do not set it directly.</div>' +
    "</div></div></div>";
  const byRegion = partnersByRegion();
  let partnerCards = "";
  for (const r of ["europe", "americas", "asia", "africa", "gulf", "oceania"]) {
    const list = (byRegion as any)[r];
    if (!list || !list.length) continue;
    partnerCards +=
      '<div class="eyebrow mt">' +
      (COUNTRY_REGIONS[r] || r) +
      '</div><div class="cards">';
    partnerCards += list
      .map((p: any) => partnerTradeCardHtml(p, bilat, bilatTotal))
      .join("");
    partnerCards += "</div>";
  }
  host.innerHTML =
    fxPanel +
    blocMembershipPanelHtml() +
    '<div class="eyebrow mt">Tariffs</div>' +
    '<div class="hint">Set rates by bloc or country. Partners in the same bloc share one lever. Customs-union members trade at zero internally.</div>' +
    tradeReadout +
    tariffSchedulePanelHtml() +
    '<div class="eyebrow mt">How {C} compares</div>' +
    nationTableHtml() +
    '<div class="eyebrow mt">Partners and agreements</div>' +
    partnerCards;
  wireTariffSchedule(host);
  host.querySelectorAll("[data-deal]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const id = b.dataset.deal;
        if (G.draft.deals[id]) delete G.draft.deals[id];
        else G.draft.deals[id] = true;
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-ext-deal]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const dealId = b.dataset.blocExtDeal,
          pid = b.dataset.partner;
        if (
          G.draft.blocExternalDeal &&
          G.draft.blocExternalDeal.dealId === dealId &&
          G.draft.blocExternalDeal.partnerId === pid
        )
          G.draft.blocExternalDeal = null;
        else
          G.draft.blocExternalDeal = {
            partnerId: pid,
            dealId,
          };
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-acc]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const id = b.dataset.blocId;
        const phase = b.dataset.blocAcc;
        if (phase !== "apply") return;
        if (
          blocJoinBlockers(id, phase).length &&
          !(
            G.draft.blocAccession &&
            G.draft.blocAccession.blocId === id &&
            G.draft.blocAccession.phase === phase
          )
        )
          return;
        if (
          G.draft.blocAccession &&
          G.draft.blocAccession.blocId === id &&
          G.draft.blocAccession.phase === phase
        ) {
          G.draft.blocAccession = null;
        } else {
          /* Joining and founding are mutually exclusive. */
          G.draft.blocCreate = null;
          G.draft.blocAccession = {
            blocId: id,
            phase: "apply",
          };
        }
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-withdraw]").forEach(
    (b: any) =>
      (b.onclick = () => {
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          const r = G.mp.onDiploAction({ action: "withdrawBlocAccession" });
          if (r && r.ok === false) {
            if (r.error) alert(r.error);
            return;
          }
        } else {
          withdrawBlocAccession(G);
        }
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-leave]").forEach(
    (b: any) =>
      (b.onclick = () => {
        G.draft.blocLeave = !G.draft.blocLeave;
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-create-unstage]").forEach(
    (b: any) =>
      (b.onclick = () => {
        G.draft.blocCreate = null;
        render();
      }),
  );
  host.querySelectorAll("[data-bloc-found-open]").forEach(
    (b: any) =>
      (b.onclick = () => {
        if (playerJoiningBloc()) return;
        showBlocFoundModal();
      }),
  );
  host.querySelectorAll("[data-bloc-invite-open]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const bid = countryBlocId(playerCountryId());
        if (bid) showBlocInviteModal(bid);
      }),
  );
  wireBlocInviteButtons(host);
}

function paintDiplomacyPanel(host: any) {
  if (!host || !G) return;
  ensureDiploStocks(G.econ);
  const byRegion = partnersByRegion();
  let partnerCards = "";
  for (const r of ["europe", "americas", "asia", "africa", "gulf", "oceania"]) {
    const list = (byRegion as any)[r];
    if (!list || !list.length) continue;
    partnerCards +=
      '<div class="eyebrow mt">' +
      (COUNTRY_REGIONS[r] || r) +
      '</div><div class="cards diplo-cards">';
    partnerCards += list.map((p: any) => partnerDiploCardHtml(p)).join("");
    partnerCards += "</div>";
  }
  host.innerHTML =
    envoySummaryHtml() +
    '<div class="eyebrow mt">Partners</div>' +
    partnerCards;
  if (!G.draft.missions) G.draft.missions = {};
  pruneInvalidDraftMissions(G);
  host.querySelectorAll("[data-mission]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const pid = b.dataset.partner,
          mid = b.dataset.mission;
        const already = G.draft.missions[pid] === mid;
        /* Allow unstage during a visit; only block newly staging sanctions. */
        if (!already && mid === "sanctionsPosture" && isVisitActive(G, pid))
          return;
        if (already) delete G.draft.missions[pid];
        else G.draft.missions[pid] = mid;
        render();
      }),
  );
  host.querySelectorAll("[data-envoy-assign]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const pid = b.dataset.envoyAssign;
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          /* Optimistic: local apply + queue; hard failures stay silent (buttons gate). */
          Promise.resolve(
            G.mp.onDiploAction({ action: "assignEnvoy", partnerId: pid }),
          );
          return;
        }
        if (assignEnvoy(pid)) render();
      }),
  );
  host.querySelectorAll("[data-envoy-recall]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const pid = b.dataset.envoyRecall;
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          Promise.resolve(
            G.mp.onDiploAction({ action: "recallEnvoy", partnerId: pid }),
          );
          return;
        }
        if (recallEnvoy(pid)) render();
      }),
  );
  host.querySelectorAll("[data-ultimatum]").forEach(
    (b: any) =>
      (b.onclick = () => {
        const raw = b.dataset.ultimatum || "";
        const colon = raw.indexOf(":");
        const pid = colon >= 0 ? raw.slice(0, colon) : raw;
        const demandId = colon >= 0 ? raw.slice(colon + 1) : null;
        if (G.mp && typeof G.mp.onDiploAction === "function") {
          Promise.resolve(
            G.mp.onDiploAction({
              action: "issueUltimatum",
              partnerId: pid,
              demandId,
            }),
          );
          return;
        }
        if (issueUltimatum(pid, demandId)) render();
      }),
  );
}

function paintChartsPanel(host: any) {
  if (!host || !G) return;
  if (G.log.length < 2) {
    host.innerHTML =
      '<div class="empty">Deliver a bill or two. The charts need at least two quarters of data.</div>';
    return;
  }
  const preN = G.log.filter((r: any) => r.pre).length;
  const chartNote = preN
    ? '<div class="hint">Includes the ' +
      preN +
      "-quarter run-up before your appointment.</div>"
    : "";
  const tr = G.econ.trendGrowth;
  const gapPts = G.econ.potential
    ? (G.econ.gdp / G.econ.potential - 1) * 100
    : 0;
  host.innerHTML =
    chartNote +
    chartBox(
      "Output against potential",
      "Index, 100 at the start of your term. The gap is cyclical pressure on prices. Trend (top bar) is how fast potential itself expands — currently " +
        (tr != null ? tr.toFixed(2) : "—") +
        "% a year; gap " +
        fmt(gapPts, 1) +
        " pts.",
      lineChart([
        {
          label: "Actual output",
          color: COL.ink,
          data: col("gdp"),
          wide: true,
        },
        {
          label: "Potential",
          color: COL.soft,
          data: col("potential"),
          dash: true,
        },
      ]),
    ) +
    '<div class="chartgrid">' +
    chartBox(
      "Inflation and Bank rate",
      G.rateManual
        ? "Base rate is pinned by you. Inflation still answers to the gap and expectations."
        : "You set fiscal policy. The Bank answers with the rate.",
      lineChart(
        [
          {
            label: "Inflation",
            color: COL.ox,
            data: col("inflation"),
            wide: true,
          },
          {
            label: "Bank rate",
            color: COL.blue,
            data: col("rate"),
          },
        ],
        {
          target: 2,
          targetLabel: "Target",
        },
      ),
    ) +
    chartBox(
      "Currency strength (" + currencyForSeat(G.homeRole) + ")",
      "Index versus the USD numeraire, 100 at term start. Stronger hurts exports and cheapens imports — watch net trade below.",
      lineChart(
        [
          {
            label: "Currency strength",
            color: COL.brass,
            data: col("fx"),
            wide: true,
          },
        ],
        {
          target: 100,
          targetLabel: "Opening",
        },
      ),
    ) +
    chartBox(
      "Unemployment",
      "Okun's relationship: output above trend pulls people into work.",
      lineChart([
        {
          label: "Unemployment",
          color: COL.plum,
          data: col("unemployment"),
          wide: true,
        },
      ]),
    ) +
    chartBox(
      "Debt",
      "Per cent of GDP. Interest compounds whether you are looking or not.",
      lineChart([
        {
          label: "Debt",
          color: COL.ink,
          data: col("debt"),
          wide: true,
        },
      ]),
    ) +
    chartBox(
      "Gilt yield",
      "What the market charges {C} to borrow.",
      lineChart([
        {
          label: "Yield",
          color: COL.ox,
          data: col("yield"),
          wide: true,
        },
      ]),
    ) +
    "</div>" +
    chartBox(
      "Approval by faction",
      "The overall number hides everything interesting.",
      lineChart(
        (
          FACTIONS.map((f, i) => ({
            label: f.name,
            color: [COL.blue, COL.ox, COL.brass, COL.plum, COL.green, COL.ink][
              i
            ],
            data: G.log.map((r: any) => r.fac[f.id]),
          })) as any[]
        ).concat([
          {
            label: "Overall",
            color: COL.soft,
            data: col("approval"),
            wide: true,
            dash: true,
          },
        ]),
      ),
    ) +
    chartBox(
      "The personal allowance in real terms",
      "Deflated by CPI and indexed to this seat's opening allowance. Uprate holds the line; Freeze lets inflation raise taxes without a vote.",
      lineChart(
        [
          {
            label: "Real value of the allowance",
            color: COL.brass,
            data: G.log.map((r: any) => r.drag * 100),
            wide: true,
          },
        ],
        {
          target: 100,
          targetLabel: "Where it started",
        },
      ),
    ) +
    chartBox(
      "Capital stock and the cost of capital",
      "Investment accumulates into the capital stock, which is an argument of potential output. Corporation tax and the policy rate move the user cost, and the user cost moves desired capital.",
      lineChart([
        {
          label: "Capital stock",
          color: COL.blue,
          data: col("K"),
          wide: true,
        },
      ]),
    ) +
    chartBox(
      "Trend growth",
      "Annualised potential growth — the long-run score from TFP, capital and labour. Not outturn GDP. Latest " +
        (tr != null ? tr.toFixed(2) : "—") +
        "% a year.",
      lineChart([
        {
          label: "Trend growth %",
          color: COL.green,
          data: col("trend"),
          wide: true,
        },
        {
          label: "User cost of capital",
          color: COL.brass,
          data: col("userCost"),
        },
      ]),
    ) +
    chartBox(
      "Where output comes from",
      "The national accounts identity. Output is not a growth rate the model invents: it is the sum of these, less imports.",
      lineChart([
        {
          label: "Consumption",
          color: COL.blue,
          data: col("C"),
          wide: true,
        },
        {
          label: "Government",
          color: COL.green,
          data: col("Gov"),
          wide: true,
        },
        {
          label: "Investment",
          color: COL.plum,
          data: col("I"),
        },
        {
          label: "Exports",
          color: COL.brass,
          data: col("X"),
        },
        {
          label: "Imports",
          color: COL.ox,
          data: col("M"),
        },
      ]),
    ) +
    chartBox(
      "Net trade",
      "Exports less imports, in index points. Competitiveness runs on underlying prices, so a VAT change does not move it.",
      lineChart(
        [
          {
            label: "Net trade",
            color: COL.ox,
            data: col("netTrade"),
            wide: true,
          },
        ],
        {
          zero: true,
        },
      ),
    ) +
    chartBox(
      "Receipts and spending",
      "Points of GDP. The distance between the lines is the deficit.",
      lineChart([
        {
          label: "Receipts",
          color: COL.green,
          data: col("rev"),
          wide: true,
        },
        {
          label: "Departmental spending",
          color: COL.ox,
          data: col("spend"),
          wide: true,
        },
        {
          label: "Debt interest",
          color: COL.brass,
          data: col("interest"),
        },
      ]),
    );
}

function _renderPanelBody(host: any) {
  if (!host || !tab) return;
  if (tab === "bill") paintBillPanel(host);
  else if (tab === "budget") paintBudgetPanel(host);
  else if (tab === "taxes") paintTaxesPanel(host);
  else if (tab === "policies") paintPoliciesPanel(host);
  else if (tab === "society") paintSocietyPanel(host);
  else if (tab === "trade") paintTradePanel(host);
  else if (tab === "diplomacy") paintDiplomacyPanel(host);
  else if (tab === "charts") paintChartsPanel(host);
}

function relationTone(rel: any) {
  if (rel >= 60) return "warm";
  if (rel <= 38) return "cold";
  return "neutral";
}

function missionShortLabel(m: any) {
  if (m.id === "summit") return "Summit";
  if (m.id === "demarche") return "Protest";
  if (m.id === "sanctionsPosture") return "Sanctions";
  return m.name.split(" / ")[0];
}

function interestTone(interest: any) {
  if (interest >= 0.25) return "for";
  if (interest <= -0.25) return "against";
  return "mixed";
}

function pendingUltimatumIds(g: any) {
  const state = g || G;
  if (!state || !state.ultimatums) return [];
  return Object.keys(state.ultimatums).filter(
    (id) => state.ultimatums[id] && state.ultimatums[id].status === "pending",
  );
}

function ultimatumQuartersLeft(g: any, partnerId: any) {
  const state = g || G;
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
  const state = g || G;
  if (!state) return false;
  if (pendingUltimatumIds(state).length) return true;
  return Object.keys(state.activeVisits || {}).some(
    (id) => visitQuartersLeft(state, id) > 0,
  );
}

function diploHudHtml(g?: any) {
  const state = g || G;
  if (!state) return "";
  const chips = [];
  for (const id of pendingUltimatumIds(state)) {
    const p = partnerById(id);
    const left = ultimatumQuartersLeft(state, id);
    const u = state.ultimatums[id];
    const label = u.label || u.demand || "demand";
    chips.push(
      '<span class="diplo-hud-chip ult" title="Ultimatum — opens Diplomacy">' +
        esc(p ? p.name : id) +
        " · " +
        esc(label) +
        " <b>" +
        left +
        "Q</b></span>",
    );
  }
  for (const id of Object.keys(state.activeVisits || {})) {
    const left = visitQuartersLeft(state, id);
    if (left <= 0) continue;
    const p = partnerById(id);
    chips.push(
      '<span class="diplo-hud-chip visit" title="State visit — opens Diplomacy">' +
        esc(p ? p.name : id) +
        " · visit <b>" +
        left +
        "Q</b></span>",
    );
  }
  return chips.join("");
}
/** Data form of diploHudHtml() for React consumers. */
function diploHudChips(g: any) {
  const state = g || G;
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
  for (const id of Object.keys(state.activeVisits || {})) {
    const left = visitQuartersLeft(state, id);
    if (left <= 0) continue;
    const p = partnerById(id);
    chips.push({
      kind: "visit",
      title: "State visit — opens Diplomacy",
      name: p ? p.name : id,
      label: null,
      left,
    });
  }
  return chips;
}

function relationModifiersHtml(partnerId: any) {
  ensureDiploStocks(G.econ);
  seedGameRelBase(G);
  const { mods } = buildRelationModifiers(
    partnerId,
    G,
    G.draft || G.law,
    diploDeps(),
  );
  const rest = mods
    .filter((m) => m.kind !== "base" && Math.abs(m.pts) >= 0.5)
    .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  if (!rest.length) return "";
  let h = '<div class="diplo-mods">';
  for (const m of rest.slice(0, 5)) {
    const tone = m.pts > 0 ? "up" : "dn";
    const sign = m.pts > 0 ? "+" : "";
    h +=
      '<span class="diplo-mod ' +
      tone +
      '" title="' +
      esc(m.label) +
      '">' +
      esc(m.label) +
      " <b>" +
      sign +
      m.pts.toFixed(1) +
      "</b></span>";
  }
  if (rest.length > 5) {
    const other = rest.slice(5).reduce((s, m) => s + m.pts, 0);
    h +=
      '<span class="diplo-mod other">+' +
      (rest.length - 5) +
      " more <b>" +
      (other >= 0 ? "+" : "") +
      other.toFixed(1) +
      "</b></span>";
  }
  h += "</div>";
  return h;
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

function partnerDiploCardHtml(p: any) {
  const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
  const target = relationTarget(p.id);
  const cd = G.econ.missionCd[p.id] || 0;
  const stagedM = (G.draft.missions && G.draft.missions[p.id]) || null;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  if (!G.envoys) G.envoys = emptyEnvoys();
  ensureDiploStocks(G.econ);
  const envoyOn = G.envoys.includes(p.id);
  const ultPending =
    G.ultimatums &&
    G.ultimatums[p.id] &&
    G.ultimatums[p.id].status === "pending";
  const ultCd = G.econ.ultimatumCd[p.id] || 0;
  const ultCheck = canIssueUltimatum(p.id, G);
  const visitLeft = visitQuartersLeft(G, p.id);
  const visitActive = visitLeft > 0;
  const relCol = relationColour(rel);
  const tone = relationTone(rel);
  const missionRow = MISSIONS.map((m) => {
    const on = stagedM === m.id;
    const visitBlock =
      (m.id === "summit" || m.id === "sanctionsPosture") && visitActive && !on;
    const blocked = !on && (cd > 0 || visitBlock);
    let tip =
      m.name +
      " · " +
      m.pc +
      " capital · relations " +
      (m.impulse > 0 ? "+" : "") +
      m.impulse;
    if (cd > 0) tip += " · cooldown " + cd + "Q";
    if (visitBlock) {
      tip =
        m.id === "sanctionsPosture"
          ? "Cannot start sanctions during a state visit · " +
            visitLeft +
            "Q remaining"
          : "State visit underway · " + visitLeft + "Q remaining";
    }
    const verb = on ? "Cancel " : "Start ";
    return (
      '<button type="button" class="diplo-mission' +
      (on ? " on" : "") +
      '" data-mission="' +
      m.id +
      '" data-partner="' +
      p.id +
      '"' +
      (blocked ? " disabled" : "") +
      ' title="' +
      esc(tip) +
      '"><span class="diplo-mission-name">' +
      verb +
      missionShortLabel(m) +
      '</span><span class="diplo-mission-pc">' +
      m.pc +
      "</span></button>"
    );
  }).join("");
  let envoyRow = "";
  if (envoyOn) {
    envoyRow =
      '<button type="button" class="btn diplo-envoy danger" data-envoy-recall="' +
      p.id +
      '">Recall envoy</button>';
  } else {
    const freeSlot = G.envoys.indexOf(null) >= 0;
    const canAssign = freeSlot && (G.capital || 0) >= ENVOY_ASSIGN_PC;
    let assignTip =
      "Spend " +
      ENVOY_ASSIGN_PC +
      " capital · +" +
      ENVOY_TARGET +
      " relations per quarter";
    if (!freeSlot) assignTip = "All envoy slots are filled";
    else if (!canAssign) assignTip = "Need " + ENVOY_ASSIGN_PC + " capital";
    envoyRow =
      '<button type="button" class="btn diplo-envoy" data-envoy-assign="' +
      p.id +
      '"' +
      (canAssign ? "" : " disabled") +
      ' title="' +
      assignTip +
      '">Assign envoy · ' +
      ENVOY_ASSIGN_PC +
      " cap</button>";
  }
  let ultBody = "";
  let ultLeft = 0;
  let ultLabel = "";
  if (ultPending) {
    const u = G.ultimatums[p.id];
    ultLeft = ultimatumQuartersLeft(G, p.id);
    ultLabel = u.label || u.demand || "demand";
    const ultMeta = { policyKey: u.policyKey, label: u.label };
    const ultOdds = Math.round(
      concedeP(p.id, u.demand, G, diploDeps(), false, ultMeta) * 100,
    );
    ultBody =
      '<div class="diplo-ult-waiting"><strong>Ultimatum issued</strong><span class="diplo-ult-demand">' +
      esc(ultLabel) +
      '</span><span class="diplo-ult-countdown">' +
      ultimatumWaitingCopy(ultLeft) +
      '</span><span class="diplo-ult-odds">Estimated ~' +
      ultOdds +
      "% chance they concede</span></div>";
  } else if (ultCd > 0) {
    ultBody =
      '<div class="diplo-ult-cooldown"><span class="diplo-ult-clock" aria-hidden="true">' +
      ICONS.clock +
      "</span><span>Cooldown " +
      ultCd +
      "Q</span></div>";
    if (ultCheck.reasons.length) {
      ultBody +=
        '<div class="diplo-muted">' +
        esc(ultCheck.reasons.join(" · ")) +
        "</div>";
    }
  } else if (ultCheck.ok) {
    const demands = ultimatumDemandsFor(p.id, G, diploDeps());
    ultBody = demands
      .map((d) => {
        const pct = Math.round(d.baseP * 100);
        const tag = G.sandbox
          ? '<span class="diplo-demand-tag ' +
            interestTone(d.interest) +
            '">' +
            esc(d.interestLabel) +
            "</span>"
          : "";
        return (
          '<button type="button" class="diplo-demand" data-ultimatum="' +
          p.id +
          ":" +
          d.id +
          '" title="Spend ' +
          ULTIMATUM_PC +
          ' capital immediately">' +
          '<span class="diplo-demand-main">' +
          esc(d.label) +
          "</span>" +
          '<span class="diplo-demand-meta"><span class="diplo-demand-odds">~' +
          pct +
          "%</span>" +
          tag +
          "</span></button>"
        );
      })
      .join("");
  } else {
    ultBody =
      '<div class="diplo-muted">' +
      esc(ultCheck.reasons.join(" · ")) +
      "</div>";
  }
  let cardBanner = "";
  if (ultPending) {
    cardBanner +=
      '<div class="diplo-ult-banner"><span class="diplo-ult-pulse"></span>Ultimatum live · ' +
      esc(ultLabel) +
      " · " +
      (ultLeft <= 1 ? "answer due next Deliver" : ultLeft + "Q to respond") +
      "</div>";
  }
  if (visitActive) {
    cardBanner +=
      '<div class="diplo-visit-banner"><span class="diplo-visit-pulse"></span>State visit underway · ' +
      visitLeft +
      " quarter" +
      (visitLeft === 1 ? "" : "s") +
      " left</div>";
  }
  const ultSectionClass = ultPending
    ? " diplo-section ult-live"
    : " diplo-section";
  return (
    '<div class="card diplo-card' +
    (stagedM ? " staged" : "") +
    (visitActive ? " visit-active" : "") +
    (ultPending ? " ult-active" : "") +
    '" id="partner-diplo-' +
    p.id +
    '" data-partner-card="' +
    p.id +
    '">' +
    cardBanner +
    '<div class="diplo-head">' +
    '<div class="diplo-title"><h4>' +
    p.name +
    '</h4><span class="cat">' +
    T(shareLabel(G.homeRole, p.id, p.tradeShare)) +
    "</span></div>" +
    '<div class="diplo-rel-badge ' +
    tone +
    '" style="--rel-col:' +
    relCol +
    '" title="Relations with ' +
    esc(p.name) +
    '">' +
    rel.toFixed(0) +
    "</div>" +
    "</div>" +
    (bloc ? '<div class="diplo-meta">' + esc(bloc.name) + "</div>" : "") +
    '<div class="diplo-rel-row"><div class="frow diplo-frow"><span>Relations</span><span class="fb"><i class="' +
    tone +
    '" style="width:' +
    rel.toFixed(0) +
    '%"></i></span><span class="fv">' +
    rel.toFixed(0) +
    "</span></div>" +
    '<div class="diplo-drift">Equilibrium <b>' +
    target.toFixed(0) +
    "</b></div></div>" +
    '<div class="diplo-section"><div class="diplo-section-h">Missions<span>Stage into bill</span></div><div class="diplo-missions">' +
    missionRow +
    "</div></div>" +
    '<div class="diplo-section"><div class="diplo-section-h">Envoy<span>+' +
    ENVOY_TARGET +
    "/Q while posted</span></div>" +
    envoyRow +
    "</div>" +
    '<div class="' +
    ultSectionClass.trim() +
    '"><div class="diplo-section-h">Ultimatum<span>' +
    (ultPending ? "Response pending" : ULTIMATUM_PC + " cap · immediate") +
    '</span></div><div class="diplo-ultimatums">' +
    ultBody +
    "</div></div>" +
    "</div>"
  );
}

function envoySummaryHtml() {
  if (!G.envoys) G.envoys = emptyEnvoys();
  const slots = G.envoys
    .map((id: any, i: any) => {
      if (!id)
        return (
          '<span class="diplo-slot empty">Slot ' + (i + 1) + " · vacant</span>"
        );
      const p = partnerById(id);
      return (
        '<span class="diplo-slot filled">' + esc(p ? p.name : id) + "</span>"
      );
    })
    .join("");
  return (
    '<div class="diplo-summary panel"><div class="diplo-summary-h">Your envoys</div><div class="diplo-slots">' +
    slots +
    '</div><div class="hint" style="margin:6px 0 0">Assign costs ' +
    ENVOY_ASSIGN_PC +
    " capital · missions go into the bill · ultimatums spend capital immediately</div></div>"
  );
}

function partnerTradeCardHtml(p: any, bilat: any, bilatTotal: any) {
  const rel = G.rel[p.id];
  const Xi = bilat[p.id] || 0;
  const sharePct = ((100 * Xi) / bilatTotal).toFixed(0);
  const stress = G.econ.dealStress[p.id] || 0;
  const bid = countryBlocId(p.id);
  const bloc = bid ? blocById(bid) || G.customBlocs[bid] : null;
  const playerBid = countryBlocId(playerCountryId());
  const playerInBloc = !!playerBid;
  const partnerInBloc = !!bid;
  const founder = isBlocFounder();
  let dealsHtml = "";
  if (playerInBloc && !founder) {
    dealsHtml =
      '<div class="eff" style="color:var(--ink-faint);display:block;margin-top:6px">Bilateral deals unavailable while in a trade bloc.</div>';
  } else if (playerInBloc && founder && !partnerInBloc) {
    dealsHtml = dealsForPartner(p, G.homeRole)
      .map((d: any) => {
        const signed = !!G.law.deals[d.id],
          staged = !!(
            G.draft.blocExternalDeal &&
            G.draft.blocExternalDeal.dealId === d.id &&
            G.draft.blocExternalDeal.partnerId === p.id
          );
        const unmet = blocExternalDealBlockers(p.id, d.id);
        return (
          '<div style="border-top:1px solid var(--doc-3);padding-top:8px;margin-top:4px">' +
          '<div style="font-size:13px;font-weight:600">' +
          d.name +
          ' <span class="cat">bloc treaty</span></div>' +
          '<div class="eff" style="display:block;color:var(--ink-soft);margin:3px 0 5px">' +
          d.terms.map((t: any) => "&middot; " + t).join("<br>") +
          "</div>" +
          (unmet.length && !signed
            ? '<div class="eff" style="color:var(--red);display:block">Blocked: ' +
              unmet.join("; ") +
              "</div>"
            : "") +
          '<div class="foot"><span class="pc">' +
          (signed ? "ratified" : d.pc + " capital") +
          "</span>" +
          '<button class="btn ' +
          (staged ? "danger" : "") +
          '" data-bloc-ext-deal="' +
          d.id +
          '" data-partner="' +
          p.id +
          '"' +
          (unmet.length && !staged && !signed ? " disabled" : "") +
          ">" +
          (staged ? "Cancel" : signed ? "Withdraw" : "Ratify as bloc") +
          "</button></div></div>"
        );
      })
      .join("");
  } else {
    dealsHtml = dealsForPartner(p, G.homeRole)
      .map((d: any) => {
        const signed = !!G.law.deals[d.id],
          staged = !!G.draft.deals[d.id];
        const unmet = dealBlockers(d);
        if (playerInBloc) return "";
        const sphereHint = !signed && !unmet.length ? sphereRiskHint(p.id) : "";
        return (
          '<div style="border-top:1px solid var(--doc-3);padding-top:8px;margin-top:4px">' +
          '<div style="font-size:13px;font-weight:600">' +
          d.name +
          "</div>" +
          '<div class="eff" style="display:block;color:var(--ink-soft);margin:3px 0 5px">' +
          d.terms.map((t: any) => "&middot; " + t).join("<br>") +
          "</div>" +
          (unmet.length && !signed
            ? '<div class="eff" style="color:var(--red);display:block">Blocked: ' +
              unmet.join("; ") +
              "</div>"
            : "") +
          (sphereHint
            ? '<div class="eff" style="color:var(--amber);display:block">' +
              esc(sphereHint) +
              "</div>"
            : "") +
          '<div class="foot"><span class="pc">' +
          (signed ? "ratified" : d.pc + " capital") +
          "</span>" +
          '<button class="btn ' +
          (staged ? "danger" : "") +
          '" data-deal="' +
          d.id +
          '"' +
          (unmet.length && !staged ? " disabled" : "") +
          ">" +
          (staged ? (signed ? "Withdraw" : "Cancel") : "Ratify") +
          "</button></div></div>"
        );
      })
      .join("");
    if (playerInBloc && !founder) dealsHtml = "";
    else if (partnerInBloc && !playerInBloc) {
      dealsHtml =
        '<div class="eff" style="color:var(--ink-faint);display:block;margin-top:6px">Partner trades through ' +
        (bloc ? bloc.name : "their bloc") +
        " — bilateral deals unavailable.</div>";
    }
  }
  return (
    '<div class="card" id="partner-trade-' +
    p.id +
    '" data-partner-card="' +
    p.id +
    '"><h4>' +
    p.name +
    '<span class="cat">' +
    T(shareLabel(G.homeRole, p.id, p.tradeShare)) +
    "</span></h4>" +
    (bloc
      ? '<div class="eff" style="color:var(--ink-faint)">' +
        bloc.name +
        "</div>"
      : "") +
    "<p>" +
    p.blurb +
    "</p>" +
    '<div class="frow" style="grid-template-columns:70px 1fr 30px"><span style="font-size:11px">Relations</span>' +
    '<span class="fb"><i class="' +
    (rel > 60 ? "good" : rel < 38 ? "bad" : "") +
    '" style="width:' +
    rel.toFixed(0) +
    '%"></i></span><span class="fv">' +
    rel.toFixed(0) +
    "</span></div>" +
    '<div class="eff" style="display:block;color:var(--ink-soft);margin:4px 0">Exports ' +
    Xi.toFixed(1) +
    " (" +
    sharePct +
    "%) · tariff " +
    effectiveTariff(p.id, G.draft).toFixed(1) +
    "%</div>" +
    (stress >= 1
      ? '<div class="eff" style="color:var(--red);display:block">Deal access suspended (stress ' +
        stress.toFixed(0) +
        ")</div>"
      : "") +
    dealsHtml +
    "</div>"
  );
}

function partnersByRegion() {
  const groups: Record<string, any> = {};
  for (const p of activePartners()) {
    const r = p.region || "other";
    if (!(groups as any)[r]) (groups as any)[r] = [];
    (groups as any)[r].push(p);
  }
  return groups;
}
function tariffSchedulePanelHtml() {
  ensureTariffSchedule(G.draft);
  ensureTariffSchedule(G.law);
  const lock = tariffLocked(G.draft);
  const sched = G.draft.tariffSchedule;
  let h = "";
  if (lock.mode !== "none") {
    h +=
      '<div class="hint">You are in a customs union. External tariff is ' +
      (sched.cet != null ? sched.cet : lock.cet) +
      "%." +
      (lock.mode === "full"
        ? " Set in the bloc capital — you cannot change it."
        : "") +
      "</div>";
    if (lock.mode === "cet") {
      h +=
        '<div class="panel" id="cetLever">' +
        leverHtml(
          "tariffCet",
          "Common external tariff",
          sched.cet || lock.cet || 4,
          0,
          25,
          1,
          0,
          "Applies to all partners outside your customs union",
        ) +
        "</div>";
    }
  } else {
    h +=
      '<div class="panel" id="defaultTariffLever">' +
      leverHtml(
        "tariffDefault",
        "Default external tariff",
        sched.default,
        0,
        25,
        1,
        0,
        "Trade-weighted average " +
          tariffScheduleAverage(G.draft).toFixed(1) +
          "%",
      ) +
      "</div>";
    const usedBlocs: Record<string, any> = {};
    for (const p of activePartners()) {
      const bid = countryBlocId(p.id);
      if (bid) (usedBlocs as any)[bid] = ((usedBlocs as any)[bid] || 0) + 1;
    }
    for (const bid in usedBlocs) {
      const bloc = blocById(bid);
      const val = sched.bloc[bid] != null ? sched.bloc[bid] : sched.default;
      h +=
        '<div class="panel">' +
        leverHtml(
          "tariffBloc:" + bid,
          (bloc ? bloc.name : bid) +
            " (" +
            (usedBlocs as any)[bid] +
            " countries)",
          val,
          0,
          25,
          1,
          0,
          "One rate for all members",
        ) +
        "</div>";
    }
    const byRegion = partnersByRegion();
    for (const r in byRegion) {
      const lone = (byRegion as any)[r].filter(
        (p: any) => !countryBlocId(p.id),
      );
      if (!lone.length) continue;
      h +=
        '<div class="eyebrow mt">' +
        (COUNTRY_REGIONS[r] || r) +
        " (non-bloc)</div>";
      for (const p of lone) {
        const val =
          sched.country[p.id] != null ? sched.country[p.id] : sched.default;
        h +=
          '<div class="panel">' +
          leverHtml(
            "tariffCountry:" + p.id,
            p.name,
            val,
            0,
            25,
            1,
            0,
            "Effective " + effectiveTariff(p.id, G.draft).toFixed(1) + "%",
          ) +
          "</div>";
      }
    }
  }
  return h;
}
function accessionPolicyChecklist(blocId: any, law: any) {
  const spec = blocAccessionSpec(blocId);
  if (!spec || !spec.need) return "";
  const need = spec.need;
  const items = [];
  (need.policyOff || []).forEach((p: any) => {
    const on = !!(law || G.draft).policies[p];
    const pol = POLICY_BY_ID[p];
    items.push({
      ok: !on,
      label: (pol ? pol.name : p) + " off",
    });
  });
  (need.policyOn || []).forEach((p: any) => {
    const on = !!(law || G.draft).policies[p];
    const pol = POLICY_BY_ID[p];
    items.push({
      ok: on,
      label: (pol ? pol.name : p) + " on",
    });
  });
  if (need.tariffMax != null) {
    const t = tariffScheduleAverage(law || G.draft);
    items.push({
      ok: t <= need.tariffMax,
      label: "Tariff " + t.toFixed(1) + "% (max " + need.tariffMax + "%)",
    });
  }
  if (!items.length) return "";
  return (
    '<div class="eff" style="display:block;margin:6px 0">' +
    items
      .map(
        (it) =>
          '<span style="color:' +
          (it.ok ? "var(--green)" : "var(--red)") +
          '">' +
          (it.ok ? "✓ " : "✗ ") +
          esc(it.label) +
          "</span>",
      )
      .join("<br>") +
    "</div>"
  );
}
function accessionPipelineSteps(cur: any, steps?: any) {
  const labels = steps || ["Invite", "Accept", "Align", "Treaty", "Member"];
  return (
    '<div class="acc-pipe">' +
    labels
      .map((label: any, i: any) => {
        const done = i < cur;
        const active = i === cur;
        const cls = done ? "done" : active ? "active" : "";
        return (
          '<div class="acc-step ' +
          cls +
          '"><span class="acc-dot">' +
          (done ? "✓" : String(i + 1)) +
          '</span><span class="acc-label">' +
          esc(label) +
          "</span></div>" +
          (i < labels.length - 1
            ? '<div class="acc-line' + (done ? " done" : "") + '"></div>'
            : "")
        );
      })
      .join("") +
    "</div>"
  );
}
function accessionStepIndicator(blocId: any) {
  const acc =
    G.blocAccession && G.blocAccession.blocId === blocId
      ? G.blocAccession
      : null;
  const step = acc ? acc.step : 0;
  const phases = ["Apply", "Align", "Accede"];
  return accessionPipelineSteps(step, phases);
}
function memberAccessionTrack(bid: any, cid: any) {
  const inv = G.blocInvites && G.blocInvites[cid];
  const acc = G.blocAccessionByCountry && G.blocAccessionByCountry[cid];
  const p = partnerById(cid);
  const name = p ? p.name : cid;
  const rel = G.rel[cid] != null ? G.rel[cid] : 50;
  const need = inviteAcceptMin(bid);
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
function blocAccessionTrackerHtml(bid: any) {
  const cids = new Set();
  for (const c of Object.keys(G.blocInvites || {}))
    if (G.blocInvites[c].blocId === bid) cids.add(c);
  for (const c of Object.keys(G.blocAccessionByCountry || {}))
    if (G.blocAccessionByCountry[c].blocId === bid) cids.add(c);
  if (!cids.size) return "";
  let h =
    '<div class="eyebrow" style="margin-top:10px">Accession pipeline</div>';
  for (const cid of cids) {
    const t = memberAccessionTrack(bid, cid);
    if (!t) continue;
    h +=
      '<div class="card acc-track" style="margin-top:8px"><h4>' +
      esc(t.name) +
      '<span class="cat">' +
      esc(t.status) +
      "</span></h4>";
    h += accessionPipelineSteps(t.cur);
    h += '<div class="hint">' + esc(t.detail) + "</div>";
    if (!t.ok)
      h +=
        '<div class="eff" style="color:var(--red);display:block">At risk — relations below the threshold</div>';
    h += "</div>";
  }
  return h;
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
    if (countryBlocId(p.id)) continue;
    if (G.blocInvites && G.blocInvites[p.id]) continue;
    if (G.blocAccessionByCountry && G.blocAccessionByCountry[p.id]) continue;
    const rel = G.rel[p.id] != null ? G.rel[p.id] : 50;
    out.push({
      partner: p,
      rel,
      blockers: blocInviteBlockers(bid, p.id),
      staged: !!(G.draft.blocInvite && G.draft.blocInvite[p.id]),
    });
  }
  return out;
}
function wireBlocInviteButtons(host: any) {
  host.querySelectorAll("[data-bloc-invite]").forEach((b: any) => {
    b.type = "button";
    b.onclick = () => {
      const cid = b.dataset.blocInvite;
      const staged = toggleBlocInvite(cid);
      render();
      if (staged) {
        requestAnimationFrame(() => {
          const el = document.getElementById("bloc-staged-" + cid);
          if (el)
            el.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          flashBillPip();
        });
      }
    };
  });
}
function accessionMemberTable(blocId: any) {
  const approvals = blocMemberApprovals(blocId);
  if (!approvals.length) return "";
  let h = '<div class="eyebrow" style="margin-top:6px">Member approval</div>';
  for (const a of approvals) {
    h +=
      '<div class="frow" style="grid-template-columns:90px 1fr 36px;margin:3px 0">' +
      '<span style="font-size:11px">' +
      esc(a.name) +
      "</span>" +
      '<span class="fb"><i class="' +
      (a.ok ? "good" : "bad") +
      '" style="width:' +
      a.rel.toFixed(0) +
      '%"></i></span>' +
      '<span class="fv" style="color:' +
      (a.ok ? "var(--green)" : "var(--red)") +
      '">' +
      a.rel.toFixed(0) +
      "</span></div>";
  }
  return h;
}
function accessionCardHtml(blocId: any) {
  const bloc = blocByIdOrCustom(blocId);
  if (!bloc) return "";
  const player = playerCountryId();
  if ((bloc.members || []).includes(player)) return "";
  const acc = G.blocAccession;
  const autoAcc = G.blocAccessionByCountry && G.blocAccessionByCountry[player];
  if (acc && acc.blocId !== blocId) return "";
  if (autoAcc && autoAcc.blocId !== blocId) return "";
  if (autoAcc && autoAcc.blocId === blocId) return "";
  if (acc && acc.blocId === blocId) return "";
  const spec = bloc.accession;
  const steps =
    spec && spec.steps
      ? spec.steps
      : {
          apply: 8,
          align: 14,
          accede: 16,
        };
  const staged =
    G.draft.blocAccession && G.draft.blocAccession.blocId === blocId
      ? G.draft.blocAccession.phase
      : null;
  const blockers = blocJoinBlockers(blocId, "apply");
  const blocked = blockers.length > 0;
  let h =
    '<div class="card" style="margin-top:8px"><h4>' +
    bloc.name +
    '<span class="cat">' +
    (bloc.type === "customs_union" ? "Customs union" : "FTA") +
    "</span></h4>";
  h += accessionStepIndicator(blocId);
  h +=
    '<div class="hint">One application bill starts accession. Alignment and the treaty then advance automatically each quarter — no further capital.</div>';
  h +=
    '<div class="hint">Member relations and policy alignment are checked as stages complete.</div>';
  if (blocked)
    h +=
      '<div class="eff" style="color:var(--red);display:block">' +
      esc(blockers[0]) +
      "</div>";
  const pc = steps.apply || 8;
  h +=
    '<div class="foot"><span class="pc">' +
    pc +
    " capital</span>" +
    '<button class="btn' +
    (staged === "apply" ? " danger" : "") +
    (blocked && staged !== "apply" ? " disabled" : "") +
    '" data-bloc-acc="apply" data-bloc-id="' +
    blocId +
    '"' +
    (blocked && staged !== "apply"
      ? ' title="' + esc(blockers.join("; ")) + '"'
      : "") +
    ">" +
    (staged === "apply" ? "Cancel" : "Join") +
    "</button></div></div>";
  return h;
}
function inviteMemberTable(blocId: any, candidateId: any) {
  const approvals = blocInviteMemberApprovals(blocId, candidateId);
  if (!approvals.length) return "";
  let h = '<div class="eyebrow" style="margin-top:6px">Member approval</div>';
  for (const a of approvals) {
    h +=
      '<div class="frow" style="grid-template-columns:90px 1fr 36px;margin:3px 0">' +
      '<span style="font-size:11px">' +
      esc(a.name) +
      "</span>" +
      '<span class="fb"><i class="' +
      (a.ok ? "good" : "bad") +
      '" style="width:' +
      a.rel.toFixed(0) +
      '%"></i></span>' +
      '<span class="fv" style="color:' +
      (a.ok ? "var(--green)" : "var(--red)") +
      '">' +
      a.rel.toFixed(0) +
      "</span></div>";
  }
  return h;
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
function blocMembershipPanelHtml() {
  pruneDraftBlocInvites();
  const player = playerCountryId();
  const bid = countryBlocId(player);
  let h = '<div class="eyebrow mt">Trade blocs</div>';
  if (bid) {
    const bloc = blocById(bid) || G.customBlocs[bid];
    const members = blocMembers(bid)
      .map((id) => {
        let _partnerById;
        return (
          ((_partnerById = partnerById(id)) === null || _partnerById === void 0
            ? void 0
            : _partnerById.name) || id
        );
      })
      .join(", ");
    h +=
      '<div class="hint">Member of <b>' +
      (bloc ? bloc.name : bid) +
      "</b>" +
      (members ? " with " + members : "") +
      ".</div>" +
      '<div class="hint">Country-level bilateral deals are suspended while you are in a bloc.</div>' +
      '<div class="hint">Any member may propose a new member; every other member must approve. Proposals stage in your bill — use <b>Deliver</b> to send the invitation.</div>';
    if (isBlocFounder()) {
      h +=
        '<div class="hint">As bloc founder you may ratify external treaties with non-bloc partners from their trade cards.</div>';
    } else if (G.customBlocs[bid]) {
      h +=
        '<div class="hint">External treaties are negotiated by the bloc founder.</div>';
    } else {
      h +=
        '<div class="hint">External treaties are negotiated by the bloc chair.</div>';
    }
    for (const cid in G.draft.blocInvite || {}) {
      if (!G.draft.blocInvite[cid]) continue;
      const c = partnerById(cid);
      const blockers = blocInviteBlockers(bid, cid);
      h +=
        '<div class="card staged-bloc-invite" id="bloc-staged-' +
        cid +
        '" data-bloc-staged="' +
        cid +
        '" style="margin-top:8px"><h4>Propose ' +
        (c ? c.name : cid) +
        " join " +
        (bloc ? bloc.name : bid) +
        '<span class="cat">12 capital</span></h4>';
      h +=
        '<div class="hint">Deliver this bill to send the invitation. After acceptance, accession runs automatically over several quarters.</div>';
      h += accessionPipelineSteps(0);
      h += inviteMemberTable(bid, cid);
      if (blockers.length)
        h +=
          '<div class="eff" style="color:var(--red);display:block">' +
          esc(blockers[0]) +
          "</div>";
      else
        h +=
          '<div class="eff" style="color:var(--green);display:block">Ready to deliver — every member approves.</div>';
      h +=
        '<div class="foot"><button type="button" class="btn danger tiny" data-bloc-invite="' +
        cid +
        '">Cancel</button></div></div>';
    }
    h += blocAccessionTrackerHtml(bid);
    h +=
      '<div class="bloc-leave-wrap"><button type="button" class="btn ' +
      (G.draft.blocLeave ? "danger" : "") +
      '" data-bloc-leave="1">' +
      (G.draft.blocLeave ? "Cancel leave" : "Leave") +
      "</button></div>";
    const inviteCandidates = blocInviteCandidates(bid);
    const inviteLabel = inviteCandidates.length
      ? "Invite a member (" + inviteCandidates.length + " eligible)"
      : "Invite a member";
    h +=
      '<div style="margin-top:12px"><button type="button" class="btn" data-bloc-invite-open="1" style="width:100%;padding:10px 16px;font-size:15px;font-weight:600"' +
      (inviteCandidates.length
        ? ""
        : ' disabled title="No eligible partners — all are in blocs or already invited"') +
      ">" +
      inviteLabel +
      "</button></div>";
  } else {
    const autoAcc =
      G.blocAccessionByCountry && G.blocAccessionByCountry[player];
    const acc = G.blocAccession;
    if (
      autoAcc ||
      (acc && G.blocAccessionByCountry && G.blocAccessionByCountry[player])
    ) {
      const track = autoAcc || G.blocAccessionByCountry[player];
      const b = blocByIdOrCustom(track.blocId);
      const t = memberAccessionTrack(track.blocId, player);
      h +=
        '<div class="hint">Accession in progress: <b>' +
        esc(b ? b.name : track.blocId) +
        "</b> — advances automatically each quarter (no further capital).</div>";
      h +=
        '<button class="btn tiny" data-bloc-withdraw="1">Cancel joining</button>';
      if (t) {
        h +=
          '<div class="card acc-track" style="margin-top:8px"><h4>' +
          esc(b ? b.name : track.blocId) +
          '<span class="cat">' +
          esc(t.status) +
          "</span></h4>";
        h += accessionPipelineSteps(t.cur);
        h += accessionPolicyChecklist(track.blocId, G.draft);
        if (track.step >= 2) h += accessionMemberTable(track.blocId);
        h += '<div class="hint">' + esc(t.detail) + "</div></div>";
      }
    } else if (acc) {
      const b = blocByIdOrCustom(acc.blocId);
      h +=
        '<div class="hint">Accession in progress: <b>' +
        (b ? b.name : acc.blocId) +
        "</b> — advances automatically each quarter.</div>";
      h +=
        '<button class="btn tiny" data-bloc-withdraw="1">Cancel joining</button>';
    } else {
      h +=
        '<div class="hint">Joining a bloc takes one application bill. Alignment and the accession treaty then advance automatically each quarter — no further capital. Members must still approve at the final step.</div>';
      for (const id in BLOC_TEMPLATES) {
        h += accessionCardHtml(id);
      }
      for (const cb of Object.values(G.customBlocs || {}) as any[]) {
        if (cb && cb.founder === player) h += accessionCardHtml(cb.id);
      }
    }
    /* Founding is blocked while joining or staging a join. */
    if (!playerJoiningBloc()) {
      if (G.draft.blocCreate) {
        const tpl = (CUSTOM_BLOC_TEMPLATES as any)[G.draft.blocCreate.template];
        h +=
          '<div class="card staged-bloc-create" style="margin-top:12px"><h4>Found <b>' +
          esc(G.draft.blocCreate.name || (tpl ? tpl.name : "bloc")) +
          '</b><span class="cat">' +
          (tpl ? tpl.pc : 28) +
          " capital</span></h4>";
        h +=
          '<div class="hint">' +
          (G.draft.blocCreate.template === "deep_integration"
            ? "Customs union · zero internal tariffs · common external tariff locked at 5%"
            : "Free trade area · preferential internal rates · members keep independent tariff policy") +
          "</div>";
        h +=
          '<div class="foot"><button type="button" class="btn danger tiny" data-bloc-create-unstage="1">Cancel</button></div></div>';
      } else {
        h +=
          '<div style="margin-top:12px"><button type="button" class="btn" data-bloc-found-open="1" style="width:100%;padding:10px 16px;font-size:15px;font-weight:600">Found a trade bloc</button></div>';
      }
    }
  }
  return h;
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
function wireTariffSchedule(host: any) {
  ensureTariffSchedule(G.draft);
  const lock = tariffLocked(G.draft);
  const apply = (key: any, v: any) => {
    if (key === "tariffDefault") G.draft.tariffSchedule.default = v;
    else if (key === "tariffCet") G.draft.tariffSchedule.cet = v;
    else if (key.startsWith("tariffBloc:"))
      G.draft.tariffSchedule.bloc[key.slice(11)] = v;
    else if (key.startsWith("tariffCountry:"))
      G.draft.tariffSchedule.country[key.slice(14)] = v;
    syncTariffHeadline(G.draft);
  };
  host.querySelectorAll("[data-lever]").forEach((lever: any) => {
    const key = lever.dataset.lever;
    const base = tariffLeverValue(key, G.law);
    lever.dataset.base = base;
    lever.dataset.dp = 0;
    if (lock.mode === "full") {
      lever.disabled = true;
      lever.style.opacity = "0.55";
      return;
    }
    wireLevers(
      lever.parentElement,
      () => tariffLeverValue(key, G.draft),
      (id: any, v: any) => apply(key, v),
      0,
    );
  });
}
function dealBlockers(d: any) {
  const out = [],
    D = G.draft,
    n = d.need || {};
  if (countryBlocId(playerCountryId()))
    out.push("bilateral deals unavailable while in a trade bloc");
  if (d.partner && countryBlocId(d.partner))
    out.push("partner trades through their bloc");
  if (n.relation && G.rel[d.partner] < n.relation)
    out.push("relations below " + n.relation);
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
function ledgerTable() {
  if (!G.log.length)
    return '<div class="empty">No quarters recorded. Set out a bill and deliver it.</div>';
  const rows = G.log
    .slice(-12)
    .map((r: any) => {
      const c = (v: any, d: any) =>
        '<td class="' +
        (v > 0 ? "pos" : v < 0 ? "neg" : "") +
        '">' +
        fmt(v, d) +
        "</td>";
      return (
        "<tr><td>" +
        r.label +
        "</td>" +
        c(r.growth, 1) +
        "<td>" +
        (r.trend != null ? r.trend.toFixed(1) : "—") +
        "</td><td>" +
        r.inflation.toFixed(1) +
        "</td><td>" +
        r.unemployment.toFixed(1) +
        "</td>" +
        c(r.balance, 1) +
        "<td>" +
        r.debt.toFixed(0) +
        "</td><td>" +
        r.yield.toFixed(2) +
        "</td><td>" +
        r.approval.toFixed(0) +
        "</td><td>" +
        Math.round(r.capital) +
        "</td></tr>"
      );
    })
    .join("");
  return (
    '<table class="ledger"><thead><tr><th>Quarter</th><th>Growth</th><th>Trend</th><th>Inflation</th><th>Unemp.</th><th>Balance</th><th>Debt</th><th>Yield</th><th>Approval</th><th>Capital</th></tr></thead><tbody>' +
    rows +
    "</tbody></table>"
  );
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
  try {
    updateMap();
  } catch (e) {
    console.error("updateMap", e);
  }
  if (scrollPartner && (tab === "trade" || tab === "diplomacy")) {
    queueDrawerPartnerScroll(scrollPartner);
  }
}
/* ==================================================================
   8. DESPATCHES, EVENTS, ELECTIONS
   ================================================================== */ function despatch(
  title: any,
  stamp: any,
  html: any,
  opts: any,
  cfg?: any,
) {
  const preview = cfg && cfg.preview && G.sandbox;
  let base = null;
  if (preview) {
    try {
      base = simulate(G.law, 4);
    } catch (err) {
      base = null;
    }
  }
  const prepared = opts.map((o: any) => {
    let extra = "";
    if (preview && base) {
      const im = previewOption(o.previewTarget || o, base);
      if (im) extra = impactChips(im) + impactFactions(im);
    }
    return {
      b: o.b,
      e: o.e,
      hint: o.hint || "",
      extra,
      f: o.f,
    };
  });
  _despatchOpen = {
    title: T(title),
    stamp,
    body: T(html),
    opts: prepared,
  };
  if (_onDespatchChange) {
    _onDespatchChange(_despatchOpen);
    return;
  }
  const titleEl = $("dpTitle"),
    stampEl = $("dpStamp"),
    bodyEl = $("dpBody"),
    box = $("dpOpts");
  if (!titleEl || !stampEl || !bodyEl || !box) return;
  titleEl.textContent = _despatchOpen.title;
  stampEl.textContent = stamp;
  bodyEl.innerHTML = _despatchOpen.body;
  box.innerHTML = "";
  prepared.forEach((o: any) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML =
      "<b>" +
      T(esc(o.b)) +
      "</b>" +
      (o.e ? "<em>" + T(esc(o.e)) + "</em>" : "") +
      (o.hint || "") +
      o.extra;
    b.onclick = () => {
      closeDespatch();
      const scrim = $("scrim");
      if (scrim) scrim.hidden = true;
      o.f();
    };
    box.appendChild(b);
  });
  const scrim = $("scrim");
  if (scrim) scrim.hidden = false;
  setTimeout(() => {
    const f = box.querySelector(".opt");
    if (f) f.focus();
  }, 40);
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
    for (const k in opt.setRel)
      G.rel[k] = clamp((G.rel[k] || 50) + opt.setRel[k], 0, 100);
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
          mod.worldPartner = pts;
          mod.partner = s.partner;
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
function restoreEpisodeTariffs(ep: any) {
  if (!ep || !ep.tariffSnap) return;
  const snap = ep.tariffSnap;
  if (ep.restorePlayerTariffs !== false && snap.player && G.law) {
    G.law.tariffSchedule = clone(snap.player);
    syncTariffHeadline(G.law);
  }
  if (snap.world && G.world) {
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
const EVENTS = [
  /* ---- foreign relations ---- */ {
    id: "blocInvitation",
    w: 9,
    stamp: "Foreign & Commonwealth",
    title: "A bloc invitation arrives",
    text: "A partner realm has invited {C} to join their trade alliance. Membership is exclusive — you would leave any other bloc first.",
    cond: () => {
      const player = playerCountryId();
      if (countryBlocId(player)) return false;
      const inv = G.blocInvites && G.blocInvites[player];
      /* Human MP invites use the inbound despatch, not this random event. */
      if (inv && inv.awaitHuman) return false;
      return !!(inv && (blocById(inv.blocId) || G.customBlocs[inv.blocId]));
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
    title: "A bloc partner wavers",
    text: "Relations with {P} have soured inside your trade pact. Their delegation hints at walking away.",
    cond: () => {
      const player = playerCountryId();
      const bid = countryBlocId(player);
      if (!bid) return false;
      return activePartners().some(
        (p) => countryBlocId(p.id) === bid && (G.rel[p.id] || 50) < 22,
      );
    },
    resolve: () => {
      const player = playerCountryId();
      const bid = countryBlocId(player);
      const pool = activePartners().filter(
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
        setRel: {
          france: 5,
          germany: 5,
        },
        fac: {
          business: 2,
          patriots: -3,
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
    title: "A partner issues an ultimatum",
    text: "The United States has given {C} ninety days to drop the digital services tax, or face tariffs on {C}'s largest export categories.",
    cond: () => {
      if (!activePartners().some((p) => p.id === "united_states")) return false;
      if (hasDeal("us_tech")) return false;
      if ((G.rel.united_states != null ? G.rel.united_states : 50) < 25)
        return false;
      return G.law.taxes.digitalTax.on && G.law.taxes.digitalTax.rate > 1;
    },
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
    title: "You are asked to join sanctions",
    text: "{C}'s allies are assembling a sanctions package against {P} and want {C} inside it. Trade with {P} is not costless to lose.",
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
      const sponsors = activePartners()
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
      if (meta.kind === "congress")
        return "A partner reshuffles its leadership";
      return "A partner changes government";
    },
    text: () => {
      const meta = polityOf(G.eventFocus);
      if (meta.kind === "congress") {
        return "A leadership reshuffle in {P} has produced a circle with very different views about {C}. Everything previously agreed is now, in their words, open for discussion.";
      }
      return "An election in {P} has produced a government with very different views about {C}. Everything previously agreed is now, in their words, open for discussion.";
    },
    cond: () => G.q > 2 && activePartners().length > 0,
    resolve: () => {
      const p = pickEventPartner();
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
    text: () =>
      countryBlocId(playerCountryId()) === "continental_union"
        ? "The Gulf states have offered a standing swap line. It would steady the currency in a crisis. It also means someone else has a view on your budget."
        : "The Gulf states and the Continental Union have both offered a standing swap line. It would steady the currency in a crisis. It also means someone else has a view on your budget.",
    cond: () => G.econ.yield > 5.5 || G.econ.debt > 105,
    opts: [
      {
        b: "Take the Continental line",
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
          activePartners().some((p) => p.id === "france"),
        f: () => {
          ["france", "germany"].forEach((id) => {
            if (!partnerById(id)) return;
            addDiploLedger(G, id, {
              id: "swap_cu_" + id,
              label: "Accepted Continental swap line",
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
        available: () => activePartners().some((p) => p.id === "saudi"),
        f: () => {
          ["saudi", "uae"].forEach((id) => {
            if (!partnerById(id)) return;
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
    title: "A migration crisis on the border",
    text: "Displacement abroad has brought sustained arrivals at {C}'s frontier. Neighbouring governments want a burden-sharing agreement; your backbenchers want a fence.",
    cond: () => G.q > 3,
    opts: [
      {
        b: "Sign the burden-sharing agreement",
        e: "Capacity rises, patriots revolt",
        setRel: {
          france: 13,
          germany: 11,
          australia: 10,
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
          ["france", "germany", "australia"].forEach((id) => {
            if (!partnerById(id)) return;
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
          france: 5,
          germany: 5,
          australia: 4,
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
    title: "An espionage scandal",
    text: "{P}'s intelligence service has been operating inside {C}'s ministries. The press has it, and expects you to say something before lunch.",
    cond: () => G.q > 5 && activePartners().length > 0,
    resolve: () => {
      const p = pickEventPartner();
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
    title: "A partner opens its market",
    text: "{P} has unilaterally cut tariffs on the goods {C} is best at making. They would like something in return, eventually.",
    cond: () => {
      if (G.q <= 2) return false;
      return !!pickEventPartner({
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
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) G.rel[id] = clamp((G.rel[id] || 50) + 15, 0, 100);
          if (lockedTariff(G.law) == null)
            G.law.tariff = Math.max(0, G.law.tariff - 3);
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
            channel: "world",
            points: 1.2,
            q: 5,
          },
        ],
        f: () => {
          const id = G.eventFocus;
          if (id) G.rel[id] = clamp((G.rel[id] || 50) - 8, 0, 100);
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
          activePartners().forEach(
            (p) => (G.rel[p.id] = clamp(G.rel[p.id] + 7, 0, 100)),
          );
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
    title: "Recession among your trading partners",
    text: "{C}'s two largest export markets have both contracted. Order books are thinning.",
    cond: () =>
      !(
        G.episode &&
        (G.episode.id === "globalRecess" || G.episode.id === "creditCrunch")
      ),
    opts: [
      {
        b: "Let the automatic stabilisers work",
        e: "No new policy",
        shocks: [
          {
            channel: "world",
            points: -3.6,
            q: 5,
          },
          {
            channel: "spend",
            points: 0.5,
            q: 5,
          },
        ],
      },
      {
        b: "Bring forward capital projects",
        e: "Raises infrastructure spending",
        shocks: [
          {
            channel: "world",
            points: -3.6,
            q: 5,
          },
        ],
        f: () => {
          G.law.spend.infra = clamp(G.law.spend.infra + 0.6, 0, 8);
        },
      },
      {
        b: "Cut VAT temporarily",
        e: "Cuts the standard rate by five points; reverse it when you dare",
        shocks: [
          {
            channel: "world",
            points: -3.6,
            q: 5,
          },
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
    title: "A partner threatens retaliation",
    text: "{P} has objected to {C}'s tax and tariff settlement, and has published a list of goods it intends to target.",
    cond: () =>
      G.law.tariff > 6 ||
      G.law.taxes.digitalTax.rate > 5 ||
      (G.econ.retaliation || 0) > 2.5,
    resolve: () => {
      const dt = G.law.taxes.digitalTax;
      let focus;
      if (
        dt.on &&
        dt.rate > 5 &&
        activePartners().some((p) => p.id === "united_states")
      )
        focus = partnerById("united_states");
      else
        focus = pickEventPartner({
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
            channel: "world",
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
          if (lockedTariff(G.law) == null)
            G.law.tariff = clamp(G.law.tariff + 5, 0, 25);
          const id = G.eventFocus;
          if (id) G.rel[id] = clamp((G.rel[id] || 50) - 12, 0, 100);
          else
            activePartners().forEach(
              (p) => (G.rel[p.id] = clamp(G.rel[p.id] - 9, 0, 100)),
            );
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
    text: "Labs and boardrooms from the United States to China are shipping tools that raise measured output per hour. Foreign demand and the technology frontier are both moving.",
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
    cond: () => activePartners().some((p) => p.id === "china"),
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
    cond: () => true,
    opts: [
      {
        b: "Ask the Continental Union for a swap line",
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
        available: () => activePartners().some((p) => p.id === "france"),
      },
      {
        b: "Announce a mid-term consolidation",
        e: "Markets calm; voters do not",
        fac: {
          business: 4,
          workers: -5,
          pensioners: -3,
          urban: -3,
        },
        shocks: [
          {
            channel: "spend",
            points: -0.8,
            q: 8,
          },
          {
            channel: "riskPremium",
            points: -0.4,
          },
          {
            channel: "uncertainty",
            points: 0.15,
            q: 4,
          },
        ],
        f: () => {
          for (const d of DEPTS) {
            if (d.id === "welfare" || d.id === "health") continue;
            G.law.spend[d.id] = clamp(G.law.spend[d.id] - 0.15, d.min, d.max);
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
    title: "An ally asks you to choose",
    text: "Late in the term, {P} wants {C} inside a sanctions package that would hit a cheaper supplier. Standing aside costs you the alliance; joining costs you inputs.",
    cond: () => activePartners().length > 0,
    resolve: () => {
      const focus =
        pickEventPartner({
          filter: (p: any) => (G.rel[p.id] != null ? G.rel[p.id] : 50) < 55,
          score: (p: any) =>
            55 -
            (G.rel[p.id] != null ? G.rel[p.id] : 50) +
            partnerShare(G.homeRole, p) * 20,
        }) || pickEventPartner();
      const sponsors = activePartners()
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
function rollEvent() {
  /* Tutorial owns the despatch lane — leave summit visits, suppress ordinary
       events and set-pieces until the coach finishes or is skipped. */
  if (G && G.coach && !G.coachDone) return null;
  const shiftAge = polityShiftAge();
  if (shiftAge != null && shiftAge > 12) G.polityShift = null;
  /* Guaranteed mid/late-term set-pieces so a 20-quarter term always has drama. */ if (
    G.q === 8 &&
    !G.setPiece8
  ) {
    G.setPiece8 = true;
    const fiscal = EVENTS.find((e) => e.id === "setPieceFiscal");
    if (fiscal) {
      const p = prepareEvent(fiscal);
      if (p) return p;
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
function briefingHtml(brief: any, opts?: any) {
  const o = opts || {};
  const impact = o.impact != null ? o.impact : G && G.briefImpact;
  let h = '<div class="briefing">';
  if (
    impact &&
    (impact.quiet || impact.economic || impact.approval || impact.politics)
  ) {
    h += '<div class="briefing-impact-grid">';
    if (impact.quiet) {
      h +=
        '<section class="briefing-impact briefing-impact--econ briefing-impact--wide"><div class="briefing-label">Year-ahead view</div><p class="briefing-impact-line">' +
        esc(impact.quiet) +
        "</p></section>";
    } else {
      if (impact.economic) {
        h +=
          '<section class="briefing-impact briefing-impact--econ"><div class="briefing-label">Next year</div><div class="briefing-impact-hint">Four-quarter total, not this quarter alone</div><p class="briefing-impact-line">' +
          esc(impact.economic) +
          "</p></section>";
      }
      if (impact.approval || impact.politics) {
        h +=
          '<section class="briefing-impact briefing-impact--approval"><div class="briefing-label">Approval</div><div class="briefing-impact-hint">Four-quarter total, not this quarter alone</div>';
        if (impact.approval)
          h +=
            '<p class="briefing-impact-line">' + esc(impact.approval) + "</p>";
        if (impact.politics)
          h += '<p class="briefing-politics">' + esc(impact.politics) + "</p>";
        h += "</section>";
      }
    }
    h += "</div>";
  }
  const outturn = brief || [];
  if (outturn.length) {
    h +=
      '<section class="briefing-outturn' +
      (impact && (impact.economic || impact.approval || impact.quiet)
        ? ""
        : " briefing-outturn--solo") +
      '">';
    if (impact && (impact.economic || impact.approval || impact.quiet))
      h += '<div class="briefing-label">This quarter</div>';
    outturn.forEach((t: any) => (h += "<p>" + esc(t) + "</p>"));
    h += "</section>";
  }
  if (o.footer) h += '<div class="src">' + esc(o.footer) + "</div>";
  h += "</div>";
  return h;
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
  const pending = local.pendingEvent;
  if (pending) return JSON.stringify(pending);
  if (inboundKey) return "inbound:" + inboundKey;
  if (blocKey) return blocKey;
  if (dealKey) return dealKey;
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
    renderPress();
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
    if (dealProp) {
      showMpInboundDealProposal(dealProp);
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
      const name = p ? p.name : a.partnerId;
      const demand = a.label || a.demand || "your demand";
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
    if (freshUlt.length) {
      const pressBefore = G.press ? G.press.length : 0;
      const clips = composePress({
        ultimatumOutcomes: freshUlt,
        q: Math.max(0, (G.q || 1) - 1),
        brief: G.brief,
      });
      if (clips.length) {
        pushPress(clips);
        for (let i = G.press.length - 1; i >= pressBefore; i--) {
          if (G.press[i].kind === "ultimatum") {
            expandPress(G.press[i].id);
            break;
          }
        }
        renderPress();
      }
      if (pol && alertSrc === pol.diploAlerts) {
        pol.diploAlerts = alertSrc;
        G.diploAlerts = alertSrc;
      }
    }
    if (!G.brief || !G.brief.length) return;
    despatch("Morning note", morningNoteStamp(), briefingHtml(G.brief), [
      {
        b: "Continue",
        e: "Back to the statute book",
        f: () => render(),
      },
    ]);
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
  const name = p ? p.name : fromId;
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
  const name = p ? p.name : fromId;
  const bloc =
    blocById(inv.blocId) || (G.customBlocs && G.customBlocs[inv.blocId]);
  const blocName = bloc ? bloc.name : inv.blocId;
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
  const name = p ? p.name : fromId;
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
      let title = (ev.title || "")
        .replace(/\{P\}/g, pName)
        .replace(/\{R\}/g, ev.rivalName || "a rival");
      title = T(title);
      const body =
        "<p>" +
        formatMissionEventText(ev, G, diploDeps()) +
        "</p>" +
        '<p class="hint">Each choice shifts relations and factions.</p>';
      const ctx = {
        partnerId: pend.partnerId,
        rivalId: ev.rivalId,
        rivalName: ev.rivalName,
      };
      const optsWithHints = ev.opts.map((o, i) => ({
        b: o.b,
        e: o.e,
        hint: missionOptionHint(o, ctx),
        f: () => choose({ optionIndex: i }),
      }));
      if (!optsWithHints.some((o) => o.hint)) {
        choose({ dismiss: true });
        return false;
      }
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
    despatch(
      ev.title,
      ev.stamp,
      "<p>" + T(ev.text) + "</p>",
      ev.opts.map((o: any, i: any) => ({
        b: o.b,
        e: o.e,
        previewTarget: o,
        f: () =>
          choose({
            optionIndex: i,
          }),
      })),
      {
        preview: true,
      },
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
/* ---- Floating press clippings ----
   Non-blocking scraps over the map after Deliver. Templates only — no LLM.
   G.press is display state; keep it out of MUTABLE / simulate(). */ const PRESS_MAX = 3;
const PRESS_FADE_MS = 12000;
let _pressSeq = 0;
const _pressFade = new Map();
function partnerName(id: any) {
  const p = PARTNERS.find((x) => x.id === id);
  return p ? p.name : id;
}
function factionName(id: any) {
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

function composePress(input: any) {
  const clauses = ((input && input.clauses) || []).filter((c: any) => {
    /* Leave is announced via bloc_self_left / bloc_member_left, not the fiscal bill strip. */
    return !(c && c.label && /^Leave /.test(c.label));
  });
  const cost = (input && input.cost) || 0;
  const balDelta = input && input.balDelta;
  const event = input && input.event;
  const option = input && input.option;
  const qIdx =
    input && input.q != null ? input.q : Math.max(0, (G && G.q ? G.q : 1) - 1);
  const date = G ? qLabel(G, qIdx) : "Q" + (qIdx + 1);
  const clips = [];
  if (clauses.length) {
    const byCost = clauses.slice().sort((a: any, b: any) => b.pc - a.pc);
    let headline, lede;
    if (clauses.length === 1) {
      headline = clauses[0].label;
      lede = "A single measure cleared the red box this quarter.";
    } else if (clauses.length === 2) {
      headline = byCost[0].label;
      lede = "Also: " + byCost[1].label + ".";
    } else {
      headline = "Chancellor's bill: " + clauses.length + " measures";
      lede =
        byCost
          .slice(0, 2)
          .map((c: any) => c.label)
          .join(". ") + ".";
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
    } else if (cost > 0) {
      lede += " Political capital spent: " + cost + ".";
    }
    clips.push({
      kind: "bill",
      masthead: "The Fiscal Gazette",
      headline: T(headline),
      lede: T(lede),
      kicker: date,
    });
  }
  if (event && option) {
    let lede = option.e || "";
    const extras: any[] = [];
    if (option.setRel) {
      Object.keys(option.setRel).forEach((id) => {
        const d = option.setRel[id];
        if (!d) return;
        extras.push(partnerName(id) + (d > 0 ? " warmer" : " cooler"));
      });
    }
    if (option.fac) {
      Object.keys(option.fac).forEach((id) => {
        const d = option.fac[id];
        if (!d) return;
        extras.push(factionName(id) + (d > 0 ? " pleased" : " angered"));
      });
    }
    if (extras.length)
      lede =
        (lede ? lede.replace(/\s*$/, "") + " " : "") +
        extras.slice(0, 3).join("; ") +
        ".";
    if (!lede && event.text)
      lede = String(event.text)
        .replace(/<[^>]+>/g, "")
        .slice(0, 160);
    clips.push({
      kind: "event",
      masthead: event.stamp || "Despatch",
      headline: T(option.b || event.title || "Cabinet decision"),
      lede: T(lede || "A choice was made in the Cabinet Room."),
      kicker: date,
    });
  }
  const ultOutcomes = (input && input.ultimatumOutcomes) || [];
  for (const u of ultOutcomes) {
    const name = partnerName(u.partnerId);
    const demand = u.label || u.demand || "your demand";
    const impact = ultimatumPressImpactText(u.impacts);
    if (u.kind === "ult_concede") {
      clips.push({
        kind: "ultimatum",
        masthead: "The Diplomatic Courier",
        headline: name + " backs down",
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
        headline: "Bloc invitation accepted",
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
        headline: "Bloc invitation declined",
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
        headline: name + " joins " + demand,
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
        headline: name + " leaves " + demand,
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
        headline: "Treaty accepted",
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
        headline: "Treaty declined",
        lede: T(
          u.kind === "deal_propose_decline"
            ? name + " declines the treaty — " + demand + "."
            : "{C} declines " + name + "'s treaty — " + demand + ".",
        ),
        kicker: date,
      });
    }
  }
  return clips;
}
function clearPressFade(id: any) {
  const t = _pressFade.get(id);
  if (t) {
    clearTimeout(t);
    _pressFade.delete(id);
  }
}
let _pressExpanded: string | null = null;
function clearAllPressFades() {
  _pressFade.forEach((t) => clearTimeout(t));
  _pressFade.clear();
  _pressExpanded = null;
}
function schedulePressFade(id: any) {
  clearPressFade(id);
  if (typeof setTimeout !== "function") return;
  if (_pressExpanded === id) return;
  const host =
    (typeof document !== "undefined" &&
      document.getElementById("pressLayer")) ||
    $("pressLayer");
  if (!host) return;
  const t = setTimeout(() => {
    dismissPress(id);
  }, PRESS_FADE_MS);
  _pressFade.set(id, t);
}
function pushPress(clips: any) {
  if (!G) return;
  if (!G.press) G.press = [];
  const list = Array.isArray(clips) ? clips : [clips];
  list.forEach((raw) => {
    if (!raw) return;
    const id = "p" + ++_pressSeq;
    const clip = {
      id,
      q: G.q,
      kind: raw.kind || "bill",
      masthead: raw.masthead || "",
      headline: raw.headline || "",
      lede: raw.lede || "",
      kicker: raw.kicker || "",
      rot: Math.random() * 10 - 5,
    };
    G.press.push(clip);
    schedulePressFade(id);
  });
  while (G.press.length > PRESS_MAX) {
    const dropped = G.press.shift();
    if (dropped) {
      clearPressFade(dropped.id);
      if (_pressExpanded === dropped.id) _pressExpanded = null;
    }
  }
  if (UI_REACT_PRESS) bump();
  else renderPress();
}
function expandPress(id: any) {
  if (!G || !G.press) return false;
  if (!G.press.some((c: any) => c.id === id)) return false;
  clearPressFade(id);
  _pressExpanded = id;
  if (UI_REACT_PRESS) bump();
  else renderPress();
  return true;
}
function dismissPress(id: any) {
  if (!G || !G.press) return false;
  const i = G.press.findIndex((c: any) => c.id === id);
  if (i < 0) return false;
  clearPressFade(id);
  if (_pressExpanded === id) _pressExpanded = null;
  G.press.splice(i, 1);
  if (UI_REACT_PRESS) bump();
  else renderPress();
  return true;
}
function getPressExpanded() {
  return _pressExpanded;
}
function dismissNewestPress() {
  if (_pressExpanded) return dismissPress(_pressExpanded);
  if (!G || !G.press || !G.press.length) return false;
  return dismissPress(G.press[G.press.length - 1].id);
}
function clipBodyHtml(c: any) {
  return (
    '<div class="clip-mast">' +
    esc(c.masthead) +
    "</div>" +
    '<div class="clip-kick">' +
    esc(c.kicker) +
    "</div>" +
    '<h4 class="clip-hed">' +
    esc(c.headline) +
    "</h4>" +
    '<p class="clip-lede">' +
    esc(c.lede) +
    "</p>"
  );
}
function renderPress() {
  if (UI_REACT_PRESS) return;
  const host = $("pressLayer");
  if (!host) return;
  const clips = G && G.press ? G.press : [];
  const focused =
    _pressExpanded && clips.find((c: any) => c.id === _pressExpanded);
  if (!focused) _pressExpanded = null;
  host.classList.toggle("is-focusing", !!focused);
  host.innerHTML = clips
    .map((c: any, i: any) => {
      if (focused && c.id === focused.id) return "";
      const rot = (c.rot != null ? c.rot : 0).toFixed(2);
      const delay = (i * 0.05).toFixed(2);
      return (
        '<article class="clipping" data-id="' +
        esc(c.id) +
        '" style="--clip-rot:' +
        rot +
        "deg;--clip-delay:" +
        delay +
        's" role="button" tabindex="0" aria-label="Open clipping">' +
        clipBodyHtml(c) +
        "</article>"
      );
    })
    .join("");
  if (focused) {
    const rot = (focused.rot != null ? focused.rot : -1).toFixed(2);
    host.insertAdjacentHTML(
      "beforeend",
      '<div class="press-focus" role="dialog" aria-modal="true" aria-label="Newspaper clipping">' +
        '<article class="clipping clipping-focus" style="--clip-rot:' +
        rot +
        'deg">' +
        clipBodyHtml(focused) +
        '<button type="button" class="clip-dismiss">Dismiss</button>' +
        "</article>" +
        "</div>",
    );
    const backdrop = host.querySelector(".press-focus");
    const go = () => {
      dismissPress(focused.id);
    };
    backdrop.onclick = (e: any) => {
      if (e.target === backdrop) go();
    };
    const btn = host.querySelector(".clip-dismiss");
    if (btn) {
      btn.onclick = (e: any) => {
        e.stopPropagation();
        go();
      };
      setTimeout(() => {
        try {
          btn.focus();
        } catch (err) {}
      }, 40);
    }
  }
  host.querySelectorAll(".clipping:not(.clipping-focus)").forEach((el: any) => {
    const id = el.getAttribute("data-id");
    const open = () => {
      expandPress(id);
    };
    el.onclick = open;
    el.onkeydown = (e: any) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    };
  });
}
function checkCrises(res: any) {
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
function grade() {
  const e = G.econ;
  let s = 0;
  s += clamp((e.gdp / e.potential - 1) * 10 + 3, 0, 6);
  s += clamp(6 - Math.abs(e.inflation - 2) * 1.2, 0, 6);
  s += clamp(6 - (e.unemployment - 4) * 1.1, 0, 6);
  s += clamp(6 - (e.debt - 90) * 0.06, 0, 6);
  s += clamp((e.services - 35) * 0.15, 0, 6);
  s += clamp((approvalOf(G.fac) - 25) * 0.14, 0, 6);
  s += clamp((e.liberty - 30) * 0.09, 0, 6);
  s += clamp(6 - (e.gini - 28) * 0.22, 0, 6);
  const pct = s / 48;
  return pct > 0.8
    ? "A"
    : pct > 0.66
      ? "B"
      : pct > 0.5
        ? "C"
        : pct > 0.34
          ? "D"
          : "E";
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
  const rows = [
    ["Quarters served", G.q],
    ["Terms", G.term],
    ["Output vs potential", fmt((e.gdp / e.potential - 1) * 100, 1) + "%"],
    ["Inflation", e.inflation.toFixed(1) + "%"],
    ["Unemployment", e.unemployment.toFixed(1) + "%"],
    ["Debt", e.debt.toFixed(0) + "% of GDP"],
    ["Public services", e.services.toFixed(0) + " / 100"],
    ["Civil liberty", e.liberty.toFixed(0) + " / 100"],
    ["Inequality", e.gini.toFixed(1) + " Gini"],
    ["Final approval", approvalOf(G.fac).toFixed(0) + "%"],
  ]
    .map((r) => "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>")
    .join("");
  despatch(
    title,
    "Verdict",
    '<div class="verdict"><div class="grade">' +
      g +
      '</div><div class="lede">' +
      text +
      "</div><table>" +
      rows +
      "</table></div>",
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
  if (score <= meta.loseAt && !G.sandbox) {
    if (meta.kind === "congress") {
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
  G.capital = clamp(G.capital + 22, 0, 100);
  const held = score <= meta.loseAt;
  let title, lede;
  if (meta.kind === "congress") {
    title = held ? "Confirmed on a technicality" : "Confirmed by the congress";
    lede = held
      ? "<p>On these numbers the apparatus would have moved you. Sandbox mode is on, so you are confirmed anyway, with a majority you have not earned.</p>"
      : "<p>The congress confirms you. The red box, the debt and the demographic arithmetic remain yours.</p>";
  } else if (meta.kind === "managed") {
    title = held ? "Returned on a technicality" : "Returned to office";
    lede = held
      ? "<p>On these numbers the managed ballot would have thrown you out. Sandbox mode is on, so you are returned anyway.</p>"
      : "<p>The managed ballot returns you with a working majority. You keep the red box, the debt and the demographic arithmetic.</p>";
  } else {
    title = held ? "Returned on a technicality" : "Returned to office";
    lede = held
      ? "<p>On these numbers the country would have thrown you out. Sandbox mode is on, so you are returned anyway, with a majority you have not earned.</p>"
      : "<p>The government is returned with a working majority. You keep the red box, the debt and the demographic arithmetic.</p>";
  }
  despatch(
    title,
    stamp,
    lede +
      "<p>A fresh mandate is worth real political capital. Spend it on something that outlasts you.</p>",
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
function fullEffects(imp: any, fac: any, cost: any, ch?: any) {
  const bits = [];
  if (cost)
    bits.push(
      "<b>" +
        (cost > 0 ? "costs " : "saves ") +
        Math.abs(cost).toFixed(2) +
        "% GDP</b>",
    );
  for (const k in imp || {}) {
    if (!imp[k]) continue;
    bits.push(
      ((IMP_NAMES as any)[k] || k) +
        " " +
        sgn(imp[k], Math.abs(imp[k]) < 1 ? 2 : 1),
    );
  }
  for (const k in ch || {}) {
    if (!ch[k]) continue;
    bits.push(
      ((IMP_NAMES as any)[k] || k) +
        " " +
        sgn(ch[k], Math.abs(ch[k]) < 1 ? 2 : 1),
    );
  }
  const f = (Object.entries(fac || {}) as [string, number][])
    .filter((e) => e[1])
    .sort((a, b) => b[1] - a[1]);
  const facTxt = f
    .map((param) => {
      const [k, v] = param;
      return cap1(k) + " " + sgn(v, 1);
    })
    .join(", ");
  return (
    '<div class="eff">' +
    bits.join(" &middot; ") +
    "</div>" +
    (facTxt
      ? '<div class="eff" style="color:var(--ink-faint)">' + facTxt + "</div>"
      : "")
  );
}
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
/** Career mode: signed qualitative effects without exact foresight numbers. */ function qualEffects(
  imp: any,
  fac: any,
  cost: any,
  ch?: any,
) {
  const bits = [];
  if (cost) bits.push("<b>" + (cost > 0 ? "costs GDP" : "saves GDP") + "</b>");
  const pushSigned = (label: any, v: any) => {
    if (!v) return;
    bits.push(label + (v > 0 ? " ↑" : " ↓"));
  };
  for (const k in imp || {}) pushSigned((IMP_NAMES as any)[k] || k, imp[k]);
  for (const k in ch || {}) pushSigned((IMP_NAMES as any)[k] || k, ch[k]);
  const f = (Object.entries(fac || {}) as [string, number][])
    .filter((e) => e[1])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const facTxt = f
    .slice(0, 3)
    .map((param) => {
      const [k, v] = param;
      return cap1(k) + (v > 0 ? " ↑" : " ↓");
    })
    .join(", ");
  return (
    '<div class="eff">' +
    bits.join(" &middot; ") +
    "</div>" +
    (facTxt
      ? '<div class="eff" style="color:var(--ink-faint)">' + facTxt + "</div>"
      : "")
  );
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
function impactChips(im: any) {
  return (
    '<div class="impchips">' +
    IMPACT_ROWS.map((r) => {
      const v = im.head[r.k];
      if (Math.abs(v) < 0.005) return "";
      const better = r.good === "up" ? v > 0 : v < 0;
      return (
        '<span class="' +
        (better ? "up" : "dn") +
        '">' +
        r.name +
        " " +
        sgn(v, r.dp) +
        "</span>"
      );
    })
      .filter(Boolean)
      .join("") +
    "</div>"
  );
}
function impactFactions(im: any) {
  const f = (Object.entries(im.fac) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .filter((e) => Math.abs(e[1]) > 0.05);
  if (!f.length)
    return '<div class="impfac">No faction moves enough to notice.</div>';
  const best = f[0],
    worst = f[f.length - 1];
  return (
    '<div class="impfac">' +
    (best[1] > 0
      ? '<span class="up">' + cap1(best[0]) + " " + sgn(best[1], 1) + "</span>"
      : "") +
    (worst[1] < 0
      ? '<span class="dn">' +
        cap1(worst[0]) +
        " " +
        sgn(worst[1], 1) +
        "</span>"
      : "") +
    (Math.abs(im.gini) > 0.05
      ? '<span class="' +
        (im.gini < 0 ? "up" : "dn") +
        '">Inequality ' +
        sgn(im.gini, 2) +
        "</span>"
      : "") +
    "</div>"
  );
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
   this snapshots every mutable field, runs the option, measures, then puts it
   all back. A test asserts the state is byte-identical afterwards. */ const MUTABLE =
  [
    "econ",
    "fac",
    "rel",
    "mods",
    "law",
    "draft",
    "capital",
    "brief",
    "q",
    "term",
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
function previewOption(opt: any, base: any) {
  const snap: Record<string, any> = {};
  MUTABLE.forEach((k) => {
    (snap as any)[k] = G[k] === undefined ? undefined : clone(G[k]);
  });
  let im = null;
  try {
    applyEventOption(opt);
    im = impactOf(clone(G.law), base, 4);
  } catch (err) {
    im = null;
  }
  MUTABLE.forEach((k) => {
    G[k] = (snap as any)[k];
  });
  return im;
}
/* Running total for whatever is staged — shown in the bill drawer only.
   Cheap: one baseline plus one variant simulation. */ function impactStripHtml() {
  const cl = billClauses();
  if (!cl.length) return "";
  if (!G.sandbox) {
    /* Career: qualitative signed summary from authored effects, not exact sims. */ const bits =
      cl
        .slice(0, 6)
        .map((c) => esc(c.label))
        .join(" · ");
    return (
      '<div class="impstrip"><div class="impstrip-h">Staged: ' +
      cl.length +
      " change" +
      (cl.length === 1 ? "" : "s") +
      " &middot; " +
      billCost() +
      " capital</div>" +
      '<div class="eff">' +
      bits +
      "</div>" +
      '<div class="hint">Career mode shows the direction of travel. Turn on Sandbox for exact four-quarter forecasts.</div></div>'
    );
  }
  let im;
  try {
    im = impactOf(clone(G.draft), simulate(G.law, 4), 4);
  } catch (err) {
    return "";
  }
  return (
    '<div class="impstrip"><div class="impstrip-h">Staged: ' +
    cl.length +
    " change" +
    (cl.length === 1 ? "" : "s") +
    " &middot; " +
    billCost() +
    " capital</div>" +
    impactChips(im) +
    impactFactions(im) +
    '<div class="hint">Trend growth is annualised potential growth; four-quarter moves are small but compound. Growth is cumulative outturn GDP.</div></div>'
  );
}
/* Every clause on its own, four quarters out, against passing nothing. */ function impactPanelHtml(
  cl: any,
) {
  if (!cl.length) return "";
  const base = simulate(G.law, 4);
  let h =
    '<div class="eyebrow mt">What each clause does on its own</div>' +
    '<div class="hint">Sandbox only. Each block is that clause alone over four quarters, measured against passing nothing at all. ' +
    "Growth is cumulative GDP over the path, not the final quarter's pace. " +
    "Trend growth and Potential are the supply-side long-run score. " +
    "They will not add up to the whole bill, because these things interact.</div>";
  cl.forEach((c: any, i: any) => {
    const im = impactOf(lawWithOnlyClause(i), base, 4);
    h +=
      '<div class="impblock"><div class="imphead">' +
      esc(c.label) +
      '<span class="cost">' +
      c.pc +
      " cap</span></div>" +
      (Math.abs(im.revenue) > 0.005
        ? '<div class="impfac"><span class="' +
          (im.revenue > 0 ? "up" : "dn") +
          '">Receipts on impact ' +
          sgn(im.revenue, 2) +
          " pts</span></div>"
        : "") +
      impactChips(im) +
      impactFactions(im) +
      "</div>";
  });
  if (cl.length > 1) {
    const whole = impactOf(clone(G.draft), base, 4);
    h +=
      '<div class="impblock whole"><div class="imphead">The bill as a whole' +
      '<span class="cost">' +
      billCost() +
      " cap</span></div>" +
      impactChips(whole) +
      impactFactions(whole) +
      "</div>";
  }
  return h;
}
/** Data form of impactStripHtml() for React consumers. */
function impactStripData() {
  const cl = billClauses();
  if (!cl.length) return null;
  if (!G.sandbox) {
    return {
      career: true,
      count: cl.length,
      cost: billCost(),
      bits: cl.slice(0, 6).map((c) => c.label),
      chips: null,
      factions: null,
    };
  }
  let im;
  try {
    im = impactOf(clone(G.draft), simulate(G.law, 4), 4);
  } catch (err) {
    return null;
  }
  return {
    career: false,
    count: cl.length,
    cost: billCost(),
    bits: null,
    chips: impactChipsData(im),
    factions: impactFactionsData(im),
  };
}
/** Data form of impactPanelHtml() for React consumers. */
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
      cost: billCost(),
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
    cost = billCost();
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
function applyDraftMissions(law: any, draft: any, econ: any, fac: any) {
  ensureDiploStocks(econ);
  if (typeof G !== "undefined" && G) pruneInvalidDraftMissions(G);
  const missions = (draft && draft.missions) || (law && law.missions) || {};
  const gBag = { econ, q: typeof G !== "undefined" && G ? G.q : 0 };
  for (const pid in missions) {
    const m = MISSION_BY_ID[missions[pid]];
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
}
function enact() {
  if (G.over) return;
  pruneDraftBlocInvites();
  if (G.draft.blocCreate && !canCreateCustomBloc()) G.draft.blocCreate = null;
  const cl = billClauses(),
    cost = billCost();
  if (cost > G.capital) return;
  if (
    G.draft.blocAccession &&
    blocJoinBlockers(G.draft.blocAccession.blocId, "apply").length
  )
    return;
  if (G.draft.blocExternalDeal) {
    const bed = G.draft.blocExternalDeal;
    if (blocExternalDealBlockers(bed.partnerId, bed.dealId).length) return;
  }
  for (const cid in G.draft.blocInvite || {}) {
    const playerBloc = countryBlocId(playerCountryId());
    if (playerBloc && blocInviteBlockers(playerBloc, cid).length) return;
  }
  const balDelta =
    balanceOf(G.draft, G.econ).balance - balanceOf(G.law, G.econ).balance;
  G.capital -= cost;
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
  if (G.draft.blocExternalDeal) {
    const bed = G.draft.blocExternalDeal;
    G.draft.deals[bed.dealId] = true;
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
  G.law = clone(G.draft);
  if (nextPolity !== prevPolity && polityCanReach(prevPolity, nextPolity)) {
    G.polityShift = {
      from: prevPolity,
      to: nextPolity,
      q: G.q,
    };
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
    } catch (err) {
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
    G.draft.blocExternalDeal = null;
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
      cost,
      balDelta,
      event: chosen && chosen.event,
      option: chosen && chosen.option,
      ultimatumOutcomes: freshUltOutcomes,
      q: Math.max(0, G.q - 1),
      brief: G.brief,
    });
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
          briefingHtml(G.brief),
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
    despatch(
      ev.title,
      ev.stamp,
      "<p>" + ev.text + "</p>",
      ev.opts.map((o: any) => ({
        b: o.b,
        e: o.e,
        previewTarget: o,
        f: () => {
          let impact = null;
          let base = null;
          try {
            base = simulate(G.law, 4);
          } catch (err) {
            base = null;
          }
          applyEventOption(o);
          if (isMajor) beginEpisode(ev, o);
          if (base) {
            try {
              impact = impactOf(clone(G.law), base, 4);
            } catch (err) {
              impact = null;
            }
          }
          proceed({
            event: ev,
            option: o,
            impact,
          });
        },
      })),
      {
        preview: true,
      },
    );
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
function coachClearDraft() {
  if (!G || !G.law) return;
  G.draft = clone(G.law);
  G.draft.blocAccession = null;
  G.draft.blocLeave = false;
  G.draft.blocCreate = null;
  G.draft.blocInvite = {};
  G.draft.blocExternalDeal = null;
  G.draft.missions = {};
  applyDraftBlocLaw(
    G.draft,
    {
      blocMember: G.blocMember,
      customBlocs: G.customBlocs,
    },
    G.draft,
  );
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
/** @deprecated use getCoachPanel */
function getCoachBanner() {
  const p = getCoachPanel();
  if (!p || p.phase !== "await" || !p.task) return null;
  return {
    step: p.step,
    total: p.total,
    label: p.task,
    title: p.title,
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
  if (_onTabChange && t !== prev) _onTabChange(t, prev);
  render(scrollPartner ? { skipBump: true, scrollPartner } : undefined);
  /* React chrome reads tab via getTab() but only re-renders on bump(). */
  if (scrollPartner && typeof bump === "function") bump();
}
function getTab() {
  return tab;
}
function getG() {
  return G;
}
function setMapMetric(id: any) {
  mapMetric = id;
  updateMap();
  updateMapLabel();
}
function getMapMetric() {
  return mapMetric;
}
function setMapHover(i: any) {
  mapHover = i;
}

export {
  FACTIONS,
  DEPTS,
  OTHER_SPEND,
  OTHER_REV,
  TERM_LEN,
  POLITY,
  POLITY_IDS,
  POLITY_LADDER,
  REL_POLITY,
  TAXES,
  TAX_BY_ID,
  REGIMES,
  REGIME_BY_ID,
  POLICIES,
  POLICY_BY_ID,
  VICE,
  VICE_BY_ID,
  PARTNERS,
  DEAL_BY_ID,
  BAND_NAMES,
  DEF_INCOME,
  DEF_NI,
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
  ENVOY_ASSIGN_PC,
  ENVOY_RECALL_PC,
  ULTIMATUM_PC,
  ULTIMATUM_CD,
  ULTIMATUM_JITTER,
  DIPLO_POLICY_KEYS,
  DIPLO_SPHERES,
  DIPLO_CAMPS,
  REGIONS,
  MAP_METRICS,
  NATION_PROFILE,
  PARTNER_BEARING,
  EVENTS,
  TABS,
  COL,
  TRADE_REST_SHARE,
  SETTLE_QUARTERS,
  activePartners,
  tradeRestShare,
  partnerShare,
  dealsForPartner,
  shareFor,
  shareLabel,
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
  countryBlocId,
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
  timeoutInboundDealProposals,
  announceQuarterAdvance,
  lockMpSubmission,
  clearMpLockedSubmission,
  snapshotMpDiploUi,
  restoreMpDiploUi,
  applyLocalMpDiploAction,
  canJoinBloc,
  blocJoinBlockers,
  blocMemberApprovals,
  blocInviteMemberApprovals,
  blocInviteBlockers,
  blocExternalDealBlockers,
  needBlockers,
  simulateFromDraft,
  BLOC_TEMPLATES,
  CUSTOM_BLOC_TEMPLATES,
  pickEventPartner,
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
  partnerTariffOnPlayer,
  ultimatumOutcomeImpacts,
  rollMissionEvent,
  applyMissionEventOption,
  MISSION_EVENTS,
  queueSummitVisitEvents,
  VISIT_DURATION,
  beginActiveVisit,
  visitQuartersLeft,
  isVisitActive,
  diploMapMarkers,
  pendingUltimatumIds,
  ultimatumQuartersLeft,
  ultimatumWaitingCopy,
  hasDiploAttention,
  diploHudHtml,
  diploHudChips,
  gdp0ForSeat,
  realmGdpBn,
  fmtGdpBn,
  worldDemandBn,
  refreshWorldY,
  restGdp0ForRole,
  currencyForSeat,
  fxDisplayIndex,
  ensureNationFx,
  clearOpeningCache,
  openingFac,
  openingRel,
  REL_0,
  FAC_0,
  MUTABLE,
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
  billShock,
  projectionWarnings,
  impactOf,
  impactOfRatePin,
  lawWithOnlyClause,
  withForecastError,
  previewOption,
  applyEventOption,
  incomeYield,
  incomeProfile,
  effectiveBands,
  personalAllowance,
  TAPER_START,
  capitalTaxOn,
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
  termReviewScore,
  termReviewDue,
  termReview,
  qualEffects,
  qualEffectsData,
  regionStats,
  regionColour,
  mapGeometry,
  countryField,
  paintMap,
  mapPick,
  initMap,
  Map2D,
  updateMap,
  updateMapLabel,
  composePress,
  pushPress,
  renderPress,
  dismissPress,
  dismissNewestPress,
  expandPress,
  getPressExpanded,
  dealBlockers,
  fullEffects,
  fullEffectsData,
  impactChips,
  impactFactions,
  impactStripHtml,
  impactPanelHtml,
  rateImpactHtml,
  impactStripData,
  impactPanelData,
  rateImpactData,
  approvalOf,
  grade,
  gameOver,
  election,
  checkCrises,
  rollEvent,
  rollMajorEvent,
  writeBriefing,
  briefingImpactLines,
  mergeBriefingImpact,
  briefingImpactParts,
  briefingHtml,
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
  dialHtml,
  chip,
  spark,
  leverHtml,
  wireLevers,
  ctrlRow,
  thresholdSliderMax,
  incomePanelHtml,
  wireIncomePanel,
  lineChart,
  lineChartSpec,
  compositionBar,
  compositionBarData,
  chartBox,
  nationTableHtml,
  nationTableData,
  budgetModeHtml,
  ledgerTable,
  ledgerRows,
  clausesIn,
  isFiscalOnly,
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
  getCoachBanner,
  coachClearDraft,
  coachSubtasks,
  RATE_FLOOR,
  MANUAL_RATE_MIN,
  paintTaxesPanel,
  paintSocietyPanel,
  paintTradePanel,
  paintDiplomacyPanel,
  paintChartsPanel,
  paintBillPanel,
  paintBudgetPanel,
  paintPoliciesPanel,
  render,
  renderChrome,
  renderPanel,
  renderPanelInto,
  $,
  registerEl,
  T,
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
  setOnSetup,
  requestSetup,
  setTab,
  getTab,
  setOnTabChange,
  getG,
  setMapMetric,
  getMapMetric,
  setMapHover,
  recapitaliseBank,
};
