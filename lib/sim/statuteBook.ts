/**
 * The statute book: pure content data (no reference to the live game state
 * `G`) extracted from lib/sim/engine.ts's "1. THE STATUTE BOOK" section —
 * FACTIONS, DEPTS, TAXES, POLICIES, VICE, PARTNERS, MISSIONS, and the
 * macro constants interleaved among them. Verified line-by-line to
 * contain zero references to `G` before being moved here; the polity-
 * transition helper functions that *do* reference `G` (normalisePolityId,
 * polityOf, coupMetric, and friends) stay behind in engine.ts. See
 * CLAUDE.md's "TypeScript migration" section for why the rest of engine.ts
 * (state, aggregation, the engine, projection, the bill, rendering,
 * despatches, flow) is not split the same way: those sections are tightly
 * mutually recursive around the `G` global and splitting them needs a
 * `G`-decoupling rearchitecture, not a mechanical move.
 */
import type { Faction, Dept, Tax, Policy, Vice, Mission } from "./types.ts";
import { COUNTRIES } from "./countries.ts";

const FACTIONS = [
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
/* Political regime per seat (democracy/hybrid/authoritarian) — unrelated to
   tax architecture (isFlatIncome/isDualCapital/landCommitment/
   consumptionCommitment in engine.ts). Opening pin on NATION_PROFILE; live
   player polity lives on law.polity and can be restaged from Society. Three
   types only — former absolute monarchies (Saudi, UAE) use authoritarian. */ const POLITY: Record<
  string,
  any
> = {
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
  /* Above this, the allowance withdraws at a fixed 50p in the pound
     (TAPER_RATE in engine.ts, not player-adjustable — this slider only
     moves where the taper starts). */ taperStart: 100000,
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
     UK-ish dividend and savings rates; if the two ever agree, that already
     is a "dual" system (isDualCapital in engine.ts) — no separate field
     needed. */ divRate: 33,
  saveRate: 20,
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
/* ---- State & Constitution / Labor & Welfare bespoke slider groups ----
   Same shape as DEF_INCOME/DEF_NI above: a plain defaults object living
   directly on `law` rather than in a generic content array, because each
   is a group of related numeric levers rather than a single on/off/rate
   toggle. See lib/sim/lawGroups.ts for the "pick one of N" law groups
   (state form, union legality, …) that sit alongside these. */
const DEF_HEAD_OF_STATE = {
  mandateYears: 5,
};
const DEF_ELECTORAL = {
  votingAge: 18,
  mandatoryVoting: false,
};
const DEF_WORK_HOURS = {
  weeklyHours: 38,
  leaveDays: 28,
};
const DEF_CHILDCARE = {
  subsidyPct: 0,
};
/* A statutory minimum-wage rate, distinct from the "Living wage uprating"
   POLICIES entry: that policy pegs the floor to two thirds of median
   earnings as an uprating *rule*; this is the numeric rate itself, which
   the wage/price block and the low-income participation margin read
   directly. The UK has had a statutory minimum wage since 1999 (the
   National Living Wage today), so this is on by default; rate is ~ the
   NLW for 21+, projected to mid-2026. Every REALM_LAW overlay sets its
   own on/rate — see realmLaws.ts — since most countries have one but a
   few genuinely don't (Italy: wages set by sectoral bargaining, no
   statutory floor; UAE: no broad statutory minimum for the private-sector
   workforce). */ const DEF_MIN_WAGE = {
  on: true,
  rate: 12.6,
};
/* ~ the real UK new State Pension (annual, 2025-26). */ const DEF_PENSION = {
  retirementAge: 66,
  statePensionAnnual: 12000,
};
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
const TAX_BY_ID = Object.fromEntries(TAXES.map((t) => [t.id, t])) as Record<
  TaxId,
  Tax
>;
/* --- the structure of the tax system itself ---
   These used to be five mutually-exclusive `REGIMES` the player picked from
   a card. All five are now derived from the sliders that already exist —
   Flat and Dual from rate *agreement* (isFlatIncome/isDualCapital in
   engine.ts), Land value shift and Consumption-led from how far Land value
   tax / VAT sit from their defaults (landCommitment/consumptionCommitment).
   The four bundles below carry exactly the old regimes' magnitudes; nothing
   here is a re-tune, just a move off the discrete `id`/`pc`/`blurb` shape
   (billClauses() prices the two crisp ones directly; the continuous pair's
   cost is already paid through the underlying tax's own rate-change price).
   Growth effects come from lighter labour wedges (part), lower capital costs
   (ucost) and land-use (kboost), not from a pot fudge. Inequality is derived
   from the post-tax income distribution. */ const FLAT_BONUS = {
  incomeMult: 0.88,
  imp: { eva: -0.05 },
  ch: { part: 0.35, ucost: -0.06 },
  fac: { business: 7, workers: -7, urban: -5, pensioners: -2 },
};
const DUAL_BONUS = {
  incomeMult: 0.95,
  wealthMult: 1.55,
  imp: { eva: -0.08 },
  ch: { ucost: -0.04 },
  fac: { business: 2, workers: 1 },
};
const LAND_BONUS = {
  incomeMult: 0.9,
  wealthMult: 2.4,
  ch: { part: 0.2, ucost: -0.12, kboost: 0.28 },
  fac: { rural: -11, business: 3, urban: 4, pensioners: -4 },
};
const CONSUMPTION_BONUS = {
  incomeMult: 0.72,
  consumptionMult: 1.35,
  ch: { part: 0.25, ucost: -0.08 },
  fac: { business: 5, workers: -5, pensioners: -5, urban: -2 },
};
/* --- policies. cost is % of GDP per year; pc is political capital ---
   `imp` is the social layer (services, liberty, crime, health, environment,
   evasion, black market). Macro effects belong in `ch`: labour supply, capital,
   TFP, user cost, replacement ratio, migration, housing supply. Inequality is
   derived from the income distribution where the policy changes transfers or
   wages, not authored as a Gini override. */ const POLICIES = [
  {
    id: "ubi",
    lawsCat: "Welfare",
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
    lawsCat: "Work",
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
    lawsCat: "Work",
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
    lawsCat: "Work",
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
    lawsCat: "Housing",
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
    lawsCat: "Housing",
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
    lawsCat: "Housing",
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
    lawsCat: "Education",
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
    lawsCat: "Education",
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
    lawsCat: "Welfare",
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
    lawsCat: "Welfare",
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
    lawsCat: "Industry & Enterprise",
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
    lawsCat: "Industry & Enterprise",
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
    lawsCat: "Industry & Enterprise",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Policing & Prisons",
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
    lawsCat: "Policing & Prisons",
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
    lawsCat: "Civil Liberties",
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
    lawsCat: "Borders & Immigration",
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
    lawsCat: "Borders & Immigration",
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
    id: "undocumentedAmnesty",
    lawsCat: "Borders & Immigration",
    name: "Regularisation of undocumented workers",
    cat: "Borders",
    cost: 0.15,
    pc: 16,
    blurb:
      "A one-off path to legal status for undocumented residents already working and resident.",
    ch: {
      labour: 0.3,
      part: 0.4,
    },
    fac: {
      workers: 4,
      urban: 3,
      patriots: -9,
      business: 2,
    },
  },
  {
    id: "conscript",
    name: "National service",
    cat: "State",
    lawsCat: "Defence",
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
    lawsCat: "Fiscal Framework",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Energy & Climate",
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
    lawsCat: "Housing",
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
    lawsCat: "Housing",
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
    lawsCat: "Education",
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
    lawsCat: "Housing",
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
    lawsCat: "Work",
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
    lawsCat: "Housing",
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
    lawsCat: "Welfare",
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
    lawsCat: "Welfare",
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
    lawsCat: "Energy & Climate",
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
  {
    id: "highSpeedRail",
    lawsCat: "Infrastructure",
    name: "High-speed rail programme",
    cat: "Infrastructure",
    cost: 1.3,
    pc: 20,
    blurb:
      "A new high-speed line linking major cities. Years of disruption along the route for a permanent capacity gain.",
    ch: {
      kboost: 0.4,
      tfp: 0.05,
    },
    fac: {
      business: 5,
      workers: 3,
      urban: 3,
      rural: -4,
    },
  },
  {
    id: "smartGrid",
    lawsCat: "Infrastructure",
    name: "Smart grid rollout",
    cat: "Infrastructure",
    cost: 0.7,
    pc: 14,
    blurb:
      "Digital metering and load-balancing across the national grid, cutting waste and easing renewables integration.",
    imp: {
      env: 2,
    },
    ch: {
      kboost: 0.3,
      tfp: 0.08,
    },
    fac: {
      business: 4,
      urban: 2,
    },
  },
  {
    id: "motorwayExpansion",
    lawsCat: "Infrastructure",
    name: "Motorway network expansion",
    cat: "Infrastructure",
    cost: 0.8,
    pc: 12,
    blurb:
      "New lanes and links across the strategic road network. Faster freight, more traffic, more emissions.",
    imp: {
      env: -3,
    },
    ch: {
      kboost: 0.35,
    },
    fac: {
      business: 4,
      rural: 4,
      urban: -2,
    },
  },
  {
    id: "airportExpansion",
    lawsCat: "Infrastructure",
    name: "Airport capacity expansion",
    cat: "Infrastructure",
    cost: 0.5,
    pc: 14,
    blurb:
      "New runway and terminal capacity at the country's busiest airports. More routes and trade, more noise for those nearby.",
    imp: {
      open: 2,
      env: -3,
    },
    ch: {
      kboost: 0.25,
    },
    fac: {
      business: 6,
      urban: -4,
    },
  },
  {
    id: "telecomRollout",
    lawsCat: "Infrastructure",
    name: "National telecom network rollout",
    cat: "Infrastructure",
    cost: 0.4,
    pc: 10,
    blurb:
      "Fibre and next-generation mobile coverage extended to every region, including where the commercial case alone wouldn't reach.",
    ch: {
      tfp: 0.1,
      kboost: 0.1,
    },
    fac: {
      business: 5,
      rural: 4,
    },
  },
] as const satisfies Policy[];
type PolicyId = (typeof POLICIES)[number]["id"];
const POLICY_BY_ID = Object.fromEntries(
  POLICIES.map((p) => [p.id, p]),
) as Record<PolicyId, Policy>;
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
const VICE_BY_ID = Object.fromEntries(
  VICE.map((v) => [v.id, v]),
) as unknown as Record<ViceId, Vice>;
/* --- the rest of the world ---
   `tradeShare` is the partner's weight in bilateral exports (sums to 0.96; the
   residual 0.04 is the rest of the world in the gravity block). */ const PARTNERS =
  COUNTRIES;
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
const MISSION_BY_ID = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
) as Record<MissionId, Mission>;
const MISSION_CD = 3;
const REL_IMPULSE_DECAY = 0.78;

export {
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
};
