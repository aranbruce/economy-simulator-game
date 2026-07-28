/**
 * Minimal sim smoke tests — opening books, projection purity, deterministic step,
 * structural event shocks.
 */
import {
  newGame,
  getG,
  balanceOf,
  project,
  step,
  clone,
  POLICIES,
  TAXES,
  REGIMES,
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
  welfareCost,
  recapitaliseBank,
  MUTABLE,
  composePress,
  pushPress,
  PRIVATE_WEALTH0,
  R0,
  researchEffort,
  knowledgeTfp,
  potentialLevel,
  potentialGrowth,
  DEPTS,
  NATION_PROFILE,
  PARTNERS,
  TRADE_REST_SHARE,
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
  IMPACT_ROWS,
  MISSIONS,
  billClauses,
  hasDeal,
  joinBloc,
  leaveBloc,
  countryBlocId,
  playerCountryId,
  lockedTariff,
  effectiveTariff,
  importTariffLevel,
  tariffLocked,
  createCustomBloc,
  inviteToBloc,
  pickEventPartner,
  applyDraftMissions,
  DEAL_BY_ID,
  prepareEvent,
  FAC_0,
  enact,
  blocJoinBlockers,
  blocMemberApprovals,
  blocInviteBlockers,
  blocInviteMemberApprovals,
  finalizeBlocJoin,
  partnerAccessTargets,
  stepCountry,
  dealBlockers,
  beginEpisode,
  endEpisode,
  scheduleNextMajorQ,
  raiseTradeWarTariffs,
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
  writeBriefing,
  spending,
} from "../lib/sim/engine.js";
import { COUNTRIES } from "../lib/sim/countries.js";
import { REALM_LAW } from "../lib/sim/realmLaws.js";
import { partnerForIso } from "../lib/sim/partners.js";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

newGame();
let G = getG();
const bal = balanceOf(G.law, G.econ);
const deficitPct = -bal.balance;
assert(
  deficitPct > 4 && deficitPct < 6,
  `opening deficit near UK band (got ${deficitPct.toFixed(2)}% of GDP)`
);
assert(G.econ.debt === 94, "opening debt is 94% of GDP");
assert(G.econ.rate === 3.75, "opening Bank rate is 3.75%");
assert(G.econ.inflation === 2.9, "opening inflation is 2.9%");
assert(
  Math.abs(G.econ.privateWealth - 80) < 0.01,
  `opening privateWealth is 80% of GDP (got ${G.econ.privateWealth})`
);
{
  const g0 = step(G, G.law, G.law, true).growth;
  const g1 = step(G, G.law, G.law, true).growth;
  assert(
    Math.abs(g0) < 2 && Math.abs(g1) < 2,
    `opening growth stays quiet (got ${g0.toFixed(2)} then ${g1.toFixed(2)})`
  );
  assert(
    Math.abs(g0 - g1) < 1.2,
    `Q1→Q2 growth swing is small without a bill (got ${Math.abs(g0 - g1).toFixed(2)}pp)`
  );
  /* Balance chip and Deficit card both read the logged outturn (deficit = −balance).
     A live balanceOf drifts once the cyclical shares move — do not use it for either. */
  for (let i = 0; i < 6; i++) step(G, G.law, G.law, true);
  const lastBal = G.log[G.log.length - 1].balance;
  assert(
    Math.abs(lastBal - G.econ.balGovt) < 1e-9,
    "logged balance equals sectoral balGovt"
  );
  assert(
    Math.abs(balanceOf(G.law, G.econ).balance - lastBal) > 0.01,
    "live balanceOf drifts from outturn (chip must use the log)"
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
  "step(det=true) is deterministic"
);

assert(POLICIES.length > 10, `policies loaded (${POLICIES.length})`);
assert(TAXES.length > 10, `taxes loaded (${TAXES.length})`);

newGame();
G = getG();
const path = simulate(G.law, 8);
assert(
  path && Array.isArray(path.rows) && path.rows.length === 8,
  "simulate returns eight quarterly rows"
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
      console.error("FAIL: applyEventOption threw on", ev.id, opt.b, err.message);
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
assert(bannedHit === 0, `no event option leaves growth/inflation mods (${optCount} options)`);

/* Social pressure channels press targets — not a one-shot stock smash. */
newGame();
G = getG();
const svc0 = G.econ.services;
applyEventOption({ shocks: [{ channel: "srv", points: -10, q: 8 }] });
for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
assert(
  G.econ.services < svc0 - 1,
  `srv shock degrades services over time (${svc0.toFixed(1)} → ${G.econ.services.toFixed(1)})`
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
assert(G.econ.A > boomA0, `boom lifts TFP via tfp channel (${boomA0.toFixed(4)} → ${G.econ.A.toFixed(4)})`);

/* Event option f() bodies must not assign outcome stocks directly. */
{
  const src = EVENTS.map((e) =>
    e.opts.map((o) => (o.f ? Function.prototype.toString.call(o.f) : "")).join("\n")
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
  assert(smash === 0, "event option f() does not assign services/health/crime/gdp/inflation/A/debt");
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
const baseInf = base.rows.reduce((a, r) => a + r.inflation, 0) / base.rows.length;
const hitInf = hit.rows.reduce((a, r) => a + r.inflation, 0) / hit.rows.length;
assert(
  hitNT < baseNT,
  `tariff shock worsens cumulative net trade (${hitNT.toFixed(2)} vs ${baseNT.toFixed(2)})`
);
assert(
  hitInf >= baseInf - 0.05,
  `tariff shock does not lower average inflation (${hitInf.toFixed(2)} vs ${baseInf.toFixed(2)})`
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
  `housing stocks initialise (debt ${G.econ.mortgageDebt}, hp ${G.econ.housePrice})`
);

const mort0 = G.econ.mortgageRate;
G.econ.rate = mort0 + 2;
step(G, G.law, G.prevLaw, true);
const mortDelta = G.econ.mortgageRate - mort0;
assert(
  mortDelta > 0 && mortDelta < 1.5,
  `mortgage fixation: rate +2 moves mortgageRate by ${mortDelta.toFixed(3)} (< full pass-through)`
);

const loose = pathAtPinnedRate(3.75, 8);
const tight = pathAtPinnedRate(5.75, 8);
const sumG = (rows) => rows.reduce((a, r) => a + r.growth, 0);
const sumI = (rows) => rows.reduce((a, r) => a + r.I, 0);
assert(
  sumG(tight.rows) < sumG(loose.rows),
  `higher Bank rate lowers cumulative growth (${sumG(tight.rows).toFixed(2)} vs ${sumG(loose.rows).toFixed(2)})`
);
assert(
  sumI(tight.rows) < sumI(loose.rows),
  `higher Bank rate lowers cumulative investment (${sumI(tight.rows).toFixed(2)} vs ${sumI(loose.rows).toFixed(2)})`
);
assert(
  tight.end.econ.mortgageRate > loose.end.econ.mortgageRate,
  "pinned high rate lifts effective mortgage rate over eight quarters"
);
assert(
  tight.end.econ.housePrice < loose.end.econ.housePrice,
  `higher rates weigh on house prices (${tight.end.econ.housePrice.toFixed(2)} vs ${loose.end.econ.housePrice.toFixed(2)})`
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
    Math.abs(G.econ.rate - r0) > 0.01,
    `Bank mode moves the rate under Taylor (${r0.toFixed(2)} → ${G.econ.rate.toFixed(2)})`
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
  `manual mode holds the rate at 5.0 (got ${G.econ.rate})`
);
{
  const pinned = simulate(G.law, 4);
  assert(
    Math.abs(pinned.end.econ.rate - 5.0) < 1e-9,
    `simulate respects manual rate pin (got ${pinned.end.econ.rate})`
  );
}
assert(
  Math.abs(G.econ.rate - 5.0) < 1e-9,
  "simulate does not leak a Taylor drift into live manual rate"
);
{
  const im = impactOfRatePin(4);
  assert(Math.abs(im.pin - 5.0) < 1e-9, "rate impact reports the pinned level");
  assert(
    im.head.growth < -0.05,
    `pinning above the Bank cuts cumulative growth vs Taylor (${im.head.growth.toFixed(2)})`
  );
  const before = G.econ.rate;
  impactOfRatePin(4);
  assert(G.econ.rate === before && G.rateManual === true, "rate impact preview does not mutate live state");
}
newGame();
G = getG();
G.rateManual = true;
G.manualRate = -0.5;
G.econ.rate = -0.5;
for (let i = 0; i < 4; i++) step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - (-0.5)) < 1e-9,
  `manual mode can hold a negative rate (got ${G.econ.rate})`
);
G.manualRate = -2;
G.econ.rate = -2;
for (let i = 0; i < 4; i++) step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - (-2)) < 1e-9,
  `manual mode can hold at −2% (got ${G.econ.rate})`
);
G.manualRate = -3;
G.econ.rate = -3;
step(G, G.law, G.prevLaw, true);
assert(
  Math.abs(G.econ.rate - (-2)) < 1e-9,
  `manual mode clamps below −2% (got ${G.econ.rate})`
);
assert(
  tight.end.econ.mortgageRate - 3.75 > loose.end.econ.mortgageRate - 3.75,
  "tight path carries a larger mortgage-rate gap versus neutral"
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
for (const r of REGIMES) {
  for (const k of Object.keys(r.imp || {})) {
    if (BANNED_IMP.has(k)) {
      bannedImp++;
      console.error("FAIL: regime", r.id, "imp has banned key", k);
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
  "aggregate no longer exposes pot"
);
assert(
  (E0.tfp !== undefined || E0.ucost !== undefined) && E0.open <= 0,
  "aggregate still carries structural and openness channels"
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
  `fuel duty rise lifts first-quarter inflation (${hitFuel.rows[0].inflation.toFixed(2)} vs ${baseFuel.rows[0].inflation.toFixed(2)})`
);

/* Demography: dependency and population stocks move; open visas raise working-age stock. */
newGame();
G = getG();
assert(
  G.econ.popWork > 50 && G.econ.popOld > 10 && G.econ.dependency > 0.2,
  `demography stocks initialise (work ${G.econ.popWork}, dep ${G.econ.dependency.toFixed(3)})`
);
const dep0 = G.econ.dependency;
const work0 = G.econ.popWork;
for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
assert(
  Math.abs(G.econ.dependency - dep0) > 0.001 || G.econ.popWork !== work0,
  `demography moves over forty quarters (dep ${G.econ.dependency.toFixed(3)}, work ${G.econ.popWork.toFixed(2)})`
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
  `open visas raise working-age population (${open.end.econ.popWork.toFixed(2)} vs ${closed.end.econ.popWork.toFixed(2)})`
);

/* Housing stock-flow: planning raises the dwelling stock vs rent controls. */
newGame();
G = getG();
assert(
  G.econ.housingStock > 80 && G.econ.rentIndex > 80,
  `housing stock-flow initialises (H ${G.econ.housingStock}, rent ${G.econ.rentIndex})`
);
const planLaw = clone(G.law);
planLaw.policies.planning = true;
const rentLaw = clone(G.law);
rentLaw.policies.rentCtrl = true;
const planPath = simulate(planLaw, 20);
const rentPath = simulate(rentLaw, 20);
assert(
  planPath.end.econ.housingStock > rentPath.end.econ.housingStock,
  `planning builds more dwellings than rent control (${planPath.end.econ.housingStock.toFixed(2)} vs ${rentPath.end.econ.housingStock.toFixed(2)})`
);

/* Credit accelerator: bank capital hit raises spreads and user cost. */
newGame();
G = getG();
assert(
  G.econ.bankCapital > 4 && G.econ.bankLeverage > 6,
  `bank stocks initialise (cap ${G.econ.bankCapital}, lev ${G.econ.bankLeverage.toFixed(2)})`
);
const beforeSpread = G.econ.creditSpread;
G.econ.bankCapital = 3;
G.econ.riskPremium = 1.5;
step(G, G.law, G.prevLaw, true);
assert(
  G.econ.creditSpread > beforeSpread,
  `weak bank capital / gilt scare lifts credit spread (${G.econ.creditSpread.toFixed(3)} vs ${beforeSpread.toFixed(3)})`
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
  `UBI lowers distributional Gini (${ubiGini.toFixed(2)} vs ${baseGini.toFixed(2)})`
);
const flatLaw = clone(G.law);
flatLaw.regime = "flat";
const flatGini = incomeProfile(flatLaw, G.econ).gini;
assert(
  flatGini > baseGini,
  `flat tax raises distributional Gini (${flatGini.toFixed(2)} vs ${baseGini.toFixed(2)})`
);

/* Bilateral gravity: a united_states partner shock cuts that partner's export share. */
newGame();
G = getG();
step(G, G.law, G.prevLaw, true);
assert(
  G.econ.bilateralX && G.econ.bilateralX.united_states > 0 && G.econ.bilateralX.france > G.econ.bilateralX.saudi,
  "bilateral export vector initialises with france > gulf"
);
newGame();
G = getG();
const baseBilat = simulate(G.law, 6);
newGame();
G = getG();
applyEventOption({
  shocks: [{ channel: "worldPartner", partner: "united_states", points: -4.0, q: 6 }],
});
const hitBilat = simulate(G.law, 6);
const baseFed = baseBilat.end.econ.bilateralX?.united_states ?? 0;
const hitFed = hitBilat.end.econ.bilateralX?.united_states ?? 0;
assert(
  hitFed < baseFed,
  `united_states partner shock cuts bilateral X_fed (${hitFed.toFixed(3)} vs ${baseFed.toFixed(3)})`
);
const baseCont = baseBilat.end.econ.bilateralX?.france ?? 0;
const hitCont = hitBilat.end.econ.bilateralX?.france ?? 0;
assert(
  Math.abs(hitCont - baseCont) < Math.abs(hitFed - baseFed) + 0.5,
  "partner shock mainly hits the named bilateral, not france equally"
);

/* World demand from partner GDP: opening pinned; large partners move worldY more. */
{
  clearOpeningCache();
  newGame();
  G = getG();
  assert(
    Math.abs(G.econ.worldY - 100) < 1e-6,
    `opening worldY is 100 (got ${G.econ.worldY})`
  );
  assert(
    G.econ.worldDemand0 > 0,
    `worldDemand0 is set at open (got ${G.econ.worldDemand0})`
  );
  assert(
    Math.abs((G.econ.worldRestY || 0) - 100) < 1e-6,
    `opening worldRestY is 100 (got ${G.econ.worldRestY})`
  );
  const D0 = worldDemandBn(G.econ, G.homeRole);
  assert(
    Math.abs(D0 - G.econ.worldDemand0) < 0.01,
    `worldDemandBn matches stored baseline (${D0.toFixed(1)} vs ${G.econ.worldDemand0.toFixed(1)})`
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
    `equal % boom: Federated lifts worldY more than Gulf (${dFed.toFixed(3)} vs ${dGulf.toFixed(3)})`
  );

  G.econ.nations.united_states.y = 100;
  G.econ.nations.saudi.y = 100;
  G.econ.worldRestY = 120;
  const yRest = refreshWorldY(G.econ, G.homeRole);
  assert(
    yRest > 100,
    `rest-of-world boom lifts worldY (got ${yRest.toFixed(3)})`
  );
  G.econ.worldRestY = 100;
  refreshWorldY(G.econ, G.homeRole);

  const restBefore = G.econ.worldRestY;
  applyEventOption({ shocks: [{ channel: "world", points: 8, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  assert(
    G.econ.worldRestY > restBefore,
    `world channel grows worldRestY (${G.econ.worldRestY.toFixed(3)} vs ${restBefore.toFixed(3)})`
  );
  assert(
    G.econ.worldY > 100,
    `world channel lifts aggregate worldY (got ${G.econ.worldY.toFixed(3)})`
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
    `worldInfl raises worldP (${G.econ.worldP.toFixed(6)} vs ${expected.toFixed(6)})`
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
    `higher worldRate depreciates fx (${G.econ.fx.toFixed(4)} vs ${fx0.toFixed(4)})`
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
    `worldTfp spills into domestic A (${G.econ.A.toFixed(4)} vs ${a0.toFixed(4)}, spill=${WORLD_TFP_SPILL})`
  );
}

/* Multi-country: world shock moves a named partner, not only worldRestY. */
newGame();
G = getG();
{
  assert(!!G.world, "live game has world bags");
  const partnerId = Object.keys(G.world).find((id) => !G.world[id].isPlayer);
  assert(!!partnerId, "has a non-player world seat");
  const y0 = G.world[partnerId].econ.gdp;
  applyEventOption({ shocks: [{ channel: "world", points: -8, q: 4 }] });
  step(G, G.law, G.prevLaw, true);
  assert(
    G.world[partnerId].econ.gdp < y0,
    `world shock hits partner GDP (${G.world[partnerId].econ.gdp.toFixed(3)} vs ${y0.toFixed(3)})`
  );
}

/* Major episode lifecycle: start, no second major, end schedules next. */
newGame();
G = getG();
{
  const majors = EVENTS.filter((e) => e.major);
  assert(majors.length === 9, `nine major episodes (got ${majors.length})`);
  assert(
    G.nextMajorQ >= MAJOR_GAP_MIN && G.nextMajorQ < MAJOR_GAP_MIN + MAJOR_GAP_SPAN,
    `opening nextMajorQ in 16–32 band (got ${G.nextMajorQ})`
  );
  G.nextMajorQ = 999;
  assert(rollMajorEvent() === null, "major not drawn before nextMajorQ");
  G.nextMajorQ = G.q;
  const major = EVENTS.find((e) => e.id === "globalRecess");
  applyEventOption(major.opts[0]);
  beginEpisode(major, major.opts[0]);
  assert(G.episode && G.episode.id === "globalRecess", "beginEpisode sets active episode");
  const dur = major.duration != null ? major.duration : 8;
  assert(G.episode.endsQ === G.q + dur, `episode ends after duration (endsQ=${G.episode.endsQ}, want +${dur})`);
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
    `endEpisode schedules next major 16–32q out (got ${G.nextMajorQ} from ${gapBefore})`
  );
  assert(scheduleNextMajorQ(0, true) === 24, "deterministic scheduleNextMajorQ uses mid gap");
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
  assert(during > before, `trade war raises tariff average (${during.toFixed(2)} vs ${before.toFixed(2)})`);
  assert(G.episode && G.episode.tariffSnap, "trade war stores tariff snapshot");
  endEpisode();
  const after = tariffScheduleAverage(G.law, G.homeRole, G.blocMember);
  assert(
    Math.abs(after - before) < 1e-9,
    `trade war unwind restores tariffs (${after.toFixed(2)} vs ${before.toFixed(2)})`
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
  `uncertainty stock persists (${jittery.end.econ.uncertainty.toFixed(2)} vs ${calm.end.econ.uncertainty.toFixed(2)})`
);
assert(
  jittery.end.econ.C < calm.end.econ.C,
  `uncertainty lowers consumption (${jittery.end.econ.C.toFixed(2)} vs ${calm.end.econ.C.toFixed(2)})`
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
  `triple lock lifts pension index (${G.econ.pensionIndex.toFixed(4)} from ${idx0})`
);
const spendWith = welfareCost(G.law, G.econ);
G.law.policies.tripleLock = false;
const spendWithout = welfareCost(G.law, G.econ);
assert(
  spendWith > spendWithout,
  `triple lock raises welfare cost (${spendWith.toFixed(2)} vs ${spendWithout.toFixed(2)})`
);

/* Allowance taper: £100k+ loses allowance; creates higher MTR in the window. */
newGame();
G = getG();
assert(
  personalAllowance(90000, G.law) === G.law.income.allowance,
  "allowance intact below taper"
);
assert(
  personalAllowance(110000, G.law) < G.law.income.allowance,
  `taper cuts allowance at £110k (${personalAllowance(110000, G.law).toFixed(0)})`
);
assert(
  personalAllowance(110000, G.law) === G.law.income.allowance - 0.5 * (110000 - TAPER_START),
  "taper withdraws 50p in the pound"
);
const baseRev = incomeYield(G.law, aggregate(G.law), G.econ).income;
const noTaperLaw = clone(G.law);
/* Flat regime disables taper — receipts should differ from progressive. */
noTaperLaw.regime = "flat";
noTaperLaw.income.bands = [{ from: noTaperLaw.income.allowance, rate: 20 }];
const flatRev = incomeYield(noTaperLaw, aggregate(noTaperLaw), G.econ).income;
assert(
  Math.abs(baseRev - flatRev) > 0.01,
  `taper/progressive schedule differs from flat (${baseRev.toFixed(2)} vs ${flatRev.toFixed(2)})`
);

/* Threshold slider max tracks wages so uprating never pins the thumb. */
newGame();
G = getG();
const openMax = thresholdSliderMax(30000, G.law.income.allowance, 250);
assert(
  openMax >= 30000 && openMax >= G.law.income.allowance,
  `opening allowance slider max covers base and live value (${openMax})`
);
G.econ.wageIndex = 2.5;
const scaledMax = thresholdSliderMax(30000, G.law.income.allowance, 250);
assert(
  scaledMax >= 30000 * 2.5,
  `wage growth lifts allowance slider max (${scaledMax} >= ${30000 * 2.5})`
);
G.econ.wageIndex = 1;
const pastCeil = thresholdSliderMax(30000, 40000, 250);
assert(
  pastCeil >= 40000 * 1.15,
  `slider max keeps headroom above an overshot live value (${pastCeil})`
);
const bandMax = thresholdSliderMax(300000, 350000, 1000);
assert(
  bandMax >= 350000,
  `band-floor slider max covers an overshot threshold (${bandMax})`
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
    G.draft.spend[id] + 1.5
  );
  const staleHold = G.draft.hold[id];
  assert(
    Math.abs(staleHold - hold0) < 1e-9,
    "precondition: hold still at the old standard before sync"
  );
  syncServiceHolds(G.draft, G.econ);
  const hold1 = G.draft.hold[id];
  assert(
    hold1 > hold0 + 1,
    `syncServiceHolds lifts the held standard with the slider (${hold0.toFixed(1)} → ${hold1.toFixed(1)})`
  );

  G.prevLaw = clone(G.law);
  G.law = clone(G.draft);
  step(G, G.law, G.prevLaw, true);
  G.draft = clone(G.law);
  assert(
    Math.abs(G.law.hold[id] - hold1) < 1e-9,
    "held standard survives the next quarter"
  );
  assert(
    Math.abs(serviceScore(id, G.law, G.econ) - hold1) < 0.75,
    `outturn service score tracks the new hold (got ${serviceScore(id, G.law, G.econ).toFixed(1)}, want ${hold1.toFixed(1)})`
  );

  /* Undoing a spend clause must restore hold too. */
  G.draft.spend[id] = G.draft.spend[id] + 1;
  syncServiceHolds(G.draft, G.econ);
  const raisedHold = G.draft.hold[id];
  const spendCl = billClauses().find((c) => /Health/.test(c.label) && /points of GDP/.test(c.label));
  assert(spendCl, "raising health spend creates a bill clause");
  spendCl.undo();
  assert(
    Math.abs(G.draft.spend[id] - G.law.spend[id]) < 1e-9,
    "undo restores spend"
  );
  assert(
    Math.abs(G.draft.hold[id] - G.law.hold[id]) < 1e-9,
    `undo restores hold (got ${G.draft.hold[id]}, law ${G.law.hold[id]}, raised was ${raisedHold})`
  );
}

/* Real allowance is CPI-deflated against the seat's own opening base. */
{
  clearOpeningCache();
  newGame({ sandbox: true });
  G = getG();
  assert(Math.abs(dragRatio(G.law, G.econ) - 1) < 0.01, "UK opens at full real allowance");
  assert(G.econ.allowBase === 12570, "UK allowBase is the UK opening allowance");
  assert(Math.abs((G.econ.cpiIndex || 1) - 1) < 1e-9, "cpiIndex opens at 1");

  G.law.income.uprate = true;
  G.draft.income.uprate = true;
  for (let i = 0; i < 12; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.005,
    `Uprate holds CPI-real allowance near 100 (${(dragRatio(G.law, G.econ) * 100).toFixed(2)})`
  );

  clearOpeningCache();
  newGame({ sandbox: true });
  G = getG();
  G.law.income.uprate = false;
  G.draft.income.uprate = false;
  for (let i = 0; i < 12; i++) step(G, G.law, G.law, true);
  assert(
    dragRatio(G.law, G.econ) < 0.97,
    `Freeze erodes CPI-real allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(2)})`
  );

  clearOpeningCache();
  newGame({ sandbox: true, homeRole: "russia" });
  G = getG();
  assert(G.econ.allowBase === G.law.income.allowance, "russia allowBase matches seat opening");
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.02,
    `russia opens near full real allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(1)})`
  );

  clearOpeningCache();
  newGame({ sandbox: true, homeRole: "saudi" });
  G = getG();
  assert(
    Math.abs(dragRatio(G.law, G.econ) - 1) < 0.02,
    `saudi opens near full real allowance despite higher cash allowance (${(dragRatio(G.law, G.econ) * 100).toFixed(1)})`
  );
}

/* Private wealth feeds C/credit; sectoral residual stays small. */
newGame();
G = getG();
assert(
  Math.abs(G.econ.privateWealth - PRIVATE_WEALTH0) < 0.01,
  "privateWealth opens at PRIVATE_WEALTH0"
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
    `higher privateWealth lifts consumption (${G.econ.C.toFixed(2)} vs ${cLow.toFixed(2)})`
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
  assert(maxAbs < 1.5, `sectoral |balResidual| stays small over 40Q (got ${maxAbs.toFixed(3)})`);
}

/* Dual income: capital taxed at flat capitalRate, separate from labour bands. */
newGame();
G = getG();
{
  const prog = incomeYield(G.law, aggregate(G.law), G.econ);
  assert(prog.capital > 0.5, `progressive raises capital income tax (${prog.capital.toFixed(2)})`);
  const dual = clone(G.law);
  dual.regime = "dual";
  dual.income.capitalRate = 10;
  const lowCap = incomeYield(dual, aggregate(dual), G.econ);
  dual.income.capitalRate = 40;
  const highCap = incomeYield(dual, aggregate(dual), G.econ);
  assert(
    highCap.capital > lowCap.capital + 0.5,
    `dual capitalRate moves capital receipts (${lowCap.capital.toFixed(2)} → ${highCap.capital.toFixed(2)})`
  );
  assert(
    Math.abs(highCap.labour - lowCap.labour) < 0.05,
    "dual capitalRate does not move labour income tax"
  );
}

/* Bank NIM / loan losses: higher unemployment raises PD and cuts capital. */
newGame();
G = getG();
assert(
  G.econ.bankLoans > 50 && G.econ.bankDeposits > 40,
  `bank loan book initialises (${G.econ.bankLoans}, deposits ${G.econ.bankDeposits})`
);
const cap0 = G.econ.bankCapital;
G.econ.unemployment = 12;
G.econ.nairu = 4.1;
for (let i = 0; i < 6; i++) step(G, G.law, G.law, true);
assert(
  G.econ.bankCapital < cap0,
  `loan losses erode bank capital when unemployment is high (${G.econ.bankCapital.toFixed(2)} vs ${cap0})`
);
newGame();
G = getG();
const debt0 = G.econ.debt;
recapitaliseBank(G.econ, 3, 1.8);
assert(
  G.econ.debt > debt0 && G.econ.bankCapital >= 8,
  `fiscal recap raises debt and restores capital (debt ${G.econ.debt.toFixed(1)}, cap ${G.econ.bankCapital.toFixed(1)})`
);

/* Floating press clippings — template copy from bill clauses and event options. */
newGame();
G = getG();
assert(Array.isArray(G.press) && G.press.length === 0, "newGame starts with empty press");
assert(
  !MUTABLE.includes("press"),
  "press is display state and stays out of MUTABLE"
);

const emptyClips = composePress({ clauses:[], cost:0, balDelta:0, event:null, option:null, q:0 });
assert(emptyClips.length === 0, "quiet quarter produces no clippings");

const billClips = composePress({
  clauses:[
    { label:"Enact Carbon price", pc:12 },
    { label:"VAT, 20% to 22%", pc:4 },
    { label:"Health +0.5 points of GDP", pc:2 },
  ],
  cost:18,
  balDelta:-0.4,
  q:0,
});
assert(billClips.length === 1 && billClips[0].kind === "bill", "non-empty bill yields one bill clipping");
assert(
  /Chancellor's bill:\s*3 measures/.test(billClips[0].headline),
  "multi-clause bill uses count headline"
);
assert(
  /Carbon price/.test(billClips[0].lede) && /deficit widens/.test(billClips[0].lede),
  "bill lede names a clause and fiscal direction"
);

const ev = EVENTS[0];
const opt = ev.opts[0];
const eventClips = composePress({
  clauses:[],
  event:ev,
  option:opt,
  q:2,
});
assert(eventClips.length === 1 && eventClips[0].kind === "event", "event option yields one event clipping");
assert(
  eventClips[0].headline.indexOf(opt.b) >= 0 || opt.b.indexOf("{C}") >= 0,
  "event headline comes from the chosen option"
);
assert(
  eventClips[0].masthead === ev.stamp || eventClips[0].masthead === "Despatch",
  "event masthead comes from the despatch stamp"
);

const both = composePress({
  clauses:[{ label:"Abolish fuel duty", pc:8 }],
  cost:8,
  balDelta:0.2,
  event:ev,
  option:opt,
  q:1,
});
assert(both.length === 2, "bill plus event yields two clippings");

const econBefore = JSON.stringify(G.econ);
const pressBefore = G.press.length;
pushPress(billClips);
assert(G.press.length === pressBefore + 1, "pushPress appends to G.press");
assert(JSON.stringify(G.econ) === econBefore, "pushPress does not mutate live econ");
assert(G.press[G.press.length - 1].headline.indexOf("Chancellor") >= 0, "pushed clip keeps headline");

/* Cap at three visible scraps */
pushPress(billClips);
pushPress(billClips);
pushPress(eventClips);
assert(G.press.length <= 3, "press layer caps at three scraps");

/* Morning-note impact: Permanent Secretary prose from impactOf, not the Gazette. */
{
  const quiet = briefingImpactLines({ head: {}, fac: {} }, { kind: "bill", clauses: [] });
  assert(quiet.length === 0, "empty impact yields no briefing lines");

  const noopBill = briefingImpactLines(
    { head: { growth: 0.01, balance: 0.01 }, fac: { business: 0.1 } },
    { kind: "bill", clauses: [{ label: "VAT, 20% to 21%", pc: 2 }] }
  );
  assert(
    noopBill.length === 1 && /barely move/.test(noopBill[0]),
    "near-zero bill impact still gets a barely-moves line"
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
    { kind: "bill", clauses: [{ label: "VAT, 20% to 22%", pc: 4 }] }
  );
  assert(rich.length >= 1, "material impact yields briefing lines");
  assert(/Against holding still/.test(rich[0]), "bill impact opens against holding still");
  assert(/growth/.test(rich[0]) && /budget balance|deficit/.test(rich[0]), "bill impact names growth and fiscal score");
  assert(rich.some((t) => /Business/.test(t) && /Workers/.test(t)), "faction warmth lands in a briefing line");

  const decision = briefingImpactLines(
    { head: { growth: -0.2, balance: 0, debt: 0, inflation: 0, unemployment: 0, yield: 0, approval: 0, services: 0, trend: 0, potential: 0, fx: 0 }, fac: {} },
    { kind: "decision" }
  );
  assert(/Against leaving that choice alone/.test(decision[0]), "event impact uses decision opener");

  const merged = mergeBriefingImpact(["Outturn colour."], rich);
  assert(merged[0] === rich[0], "impact lines lead the morning note");
  assert(merged.length <= 4, "merged briefing stays short");
  assert(merged.includes("Outturn colour."), "outturn survives when there is room");

  newGame();
  G = getG();
  G.draft.taxes.vat.rate = (G.law.taxes.vat.rate || 20) + 2;
  const im = impactOf(clone(G.draft), simulate(G.law, 4), 4);
  const live = briefingImpactLines(im, {
    kind: "bill",
    clauses: [{ label: "VAT up", pc: 4 }],
  });
  assert(live.length >= 1, "live VAT rise produces morning-note impact prose");
  assert(/Against holding still|barely move/.test(live[0]), "live impact uses Permanent Secretary voice");
  const briefSnap = JSON.stringify(G.econ);
  writeBriefing({
    growth: 0.5,
    pg: 0.8,
    E: aggregate(G.law),
    sp: spending(G.law, G.econ),
    deficit: 4.5,
  });
  G.brief = mergeBriefingImpact(G.brief, live);
  assert(JSON.stringify(G.econ) === briefSnap, "briefing impact merge does not mutate econ");
  assert(/Against holding still|barely move/.test(G.brief[0]), "merged morning note leads with impact");
}

/* Partner opening macros match IMF-calibrated NATION_PROFILE (April 2026). */
{
  newGame();
  G = getG();
  assert(PARTNERS.length === 27, `twenty-seven sovereign partners incl. kingdom (got ${PARTNERS.length})`);
  assert(activePartners("home").length === 26, "twenty-six partners when playing as United Kingdom");
  assert(
    PARTNERS.some((p) => p.id === "russia"),
    "Russia is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "india"),
    "India is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "nigeria"),
    "Nigeria is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "brazil"),
    "Brazil is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "canada"),
    "Canada is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "korea"),
    "Korea is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "indonesia"),
    "Indonesia is a trade partner"
  );
  assert(
    PARTNERS.some((p) => p.id === "kingdom"),
    "United Kingdom is a displaceable partner seat"
  );
  const homePartners = activePartners("home");
  const named = homePartners.reduce((s, p) => s + partnerShare("home", p.id), 0);
  assert(
    Math.abs(named + tradeRestShare("home") - 1) < 1e-9,
    `active trade shares + rest sum to 1 (named ${named}, rest ${tradeRestShare("home")})`
  );
  assert(!!G.econ.nations, "opening econ carries partner nation books");
  assert(G.rel.russia === 38, "Northern Reach opens with frosty relations");
  assert(G.rel.india === 54, "India opens with warmish relations");
  assert(G.rel.nigeria === 48, "Nigeria opens mid-table");
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
      `${p.id} opens at profile (debt ${n.debt}, deficit ${n.deficit}, g ${n.growth}, pi ${n.inflation})`
    );
  }
  assert(NATION_PROFILE.united_states.debt0 >= 120, "US debt opens above 120% of GDP");
  assert(NATION_PROFILE.china.deficit0 >= 6, "China fiscal stance is wide (augmented)");
  assert(NATION_PROFILE.saudi.deficit0 < 3, "Gulf is near fiscal balance, not a large surplus");
  assert(
    NATION_PROFILE.russia.debt0 < 25 && NATION_PROFILE.russia.trend < 2,
    "Northern Reach opens Russia-like (low debt, soft trend growth)"
  );
  assert(
    NATION_PROFILE.india.trend >= 5.5 && NATION_PROFILE.india.debt0 > 70,
    "India opens India-like (fast growth, high debt)"
  );
  assert(
    NATION_PROFILE.nigeria.trend >= 3 && NATION_PROFILE.nigeria.inflation0 >= 5,
    "Nigeria opens Africa-like (growth with sticky inflation)"
  );
  assert(
    NATION_PROFILE.brazil.debt0 > 50 && NATION_PROFILE.brazil.trend < 4,
    "Brazil opens LatAm-like (middling debt, soft growth)"
  );
  assert(
    NATION_PROFILE.australia.trend < 3,
    "Commonwealth without India is slower-growing"
  );
  assert(NATION_PROFILE.canada.debt0 >= 90 && NATION_PROFILE.canada.debt0 <= 130, "Canada debt mid-high");
  assert(NATION_PROFILE.korea.shareX >= 35 && NATION_PROFILE.korea.trend >= 1.5, "Korea export-heavy with solid trend");
  assert(NATION_PROFILE.indonesia.trend >= 4, "Indonesia opens on a fast-growth path");
  assert(NATION_PROFILE.argentina.inflation0 >= 15, "Argentina opens with high inflation");
  assert(NATION_PROFILE.turkey.inflation0 >= 12, "Türkiye opens with high inflation");
  assert(NATION_PROFILE.vietnam.trend >= 5, "Vietnam opens fast-growing");
  assert(NATION_PROFILE.poland.trend >= 2, "Poland opens with solid catch-up growth");
  for (const id in NATION_PROFILE) {
    assert(
      NATION_PROFILE[id].gdp0 > 0,
      `${id} has a positive opening GDP level`
    );
  }
  assert(
    NATION_PROFILE.united_states.gdp0 > NATION_PROFILE.china.gdp0 &&
      NATION_PROFILE.china.gdp0 > NATION_PROFILE.kingdom.gdp0 &&
      NATION_PROFILE.kingdom.gdp0 > NATION_PROFILE.france.gdp0,
    "opening GDP order: US > China > Kingdom > France"
  );
  assert(gdp0ForSeat("home") === NATION_PROFILE.kingdom.gdp0, "home seat uses Kingdom GDP level");
  assert(fmtGdpBn(3600) === "$3.6tn", `fmtGdpBn(3600) is $3.6tn (got ${fmtGdpBn(3600)})`);
  assert(fmtGdpBn(33000) === "$33tn", `fmtGdpBn(33000) is $33tn (got ${fmtGdpBn(33000)})`);
  newGame();
  G = getG();
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.kingdom.gdp0) < 0.01,
    "home GDP bn tracks opening level at index 100"
  );
  assert(
    Math.abs(realmGdpBn("united_states", G) - NATION_PROFILE.united_states.gdp0) < 0.01,
    "partner GDP bn tracks opening level at index 100"
  );
}

/* Realm-specific openings, Kingdom as partner, settle chart history. */
{
  newGame();
  G = getG();
  assert(G.log.length === SETTLE_QUARTERS, `opening log is settle history (got ${G.log.length})`);
  assert(G.log.every((r) => r.pre), "settle rows are marked pre-term");
  assert(
    Math.abs(G.log[G.log.length - 1].debt - G.econ.debt) < 0.05,
    "last settle row debt matches live books"
  );
  const beforeLen = G.log.length;
  step(G, G.law, G.law, true);
  assert(G.log.length === beforeLen + 1, "first live step appends without wiping history");
  assert(!G.log[G.log.length - 1].pre, "live quarter is not pre-term");

  newGame({ homeRole: "united_states", homeIso: "840", country: "United States" });
  G = getG();
  assert(G.econ.debt === 126, `united_states opens at debt 126 (got ${G.econ.debt})`);
  assert(Math.abs(G.econ.inflation - 2.4) < 0.01, `united_states inflation 2.4 (got ${G.econ.inflation})`);
  {
    const d = -balanceOf(G.law, G.econ).balance;
    assert(Math.abs(d - 7.5) < 0.15, `united_states deficit near 7.5 (got ${d.toFixed(2)})`);
  }
  assert(Math.abs(G.econ.trendGrowth - 2.3) < 1.05, `united_states trend near 2.3 (got ${G.econ.trendGrowth})`);
  assert(
    Math.abs(potentialGrowth(G.law, aggregate(G.law), G.econ) - 2.3) < 1.05,
    `united_states live potential near 2.3 (got ${potentialGrowth(G.law, aggregate(G.law), G.econ)})`
  );
  assert(
    partnerForIso("826", "840", "united_states") === "kingdom",
    "UK coastline is United Kingdom partner when sitting in United States"
  );
  assert(
    partnerForIso("826", "826", "home") === "home",
    "UK coastline is home when sitting as United Kingdom"
  );
  const fedPartners = activePartners("united_states");
  assert(
    fedPartners.some((p) => p.id === "kingdom") &&
      !fedPartners.some((p) => p.id === "united_states"),
    "active partners include kingdom and exclude united_states seat"
  );
  assert(!!G.econ.nations.kingdom, "kingdom nation books exist when playing elsewhere");
  assert(
    Math.abs(G.econ.nations.kingdom.debt - 94) < 0.01,
    "kingdom partner opens at UK debt"
  );
  assert(!G.law.taxes.vat.on, "United States open without a federal VAT");
  assert(G.law.taxes.corpTax.rate === 21, "United States open at 21% corporation tax");
  assert(G.law.spend.defence === 3.5, "United States open with higher defence share");
  assert(G.law.vice.cannabis === "legal", "United States open with legal cannabis");
  assert(!!G.law.policies.planning && !!G.law.policies.dereg, "United States open with planning and labour deregulation");
  assert(!G.law.taxes.digitalTax.on, "United States do not open with a digital services tax");

  newGame({ homeRole: "saudi", homeIso: "682", country: "Gulf Investors" });
  G = getG();
  assert(G.econ.debt === 30, `saudi opens at debt 30 (got ${G.econ.debt})`);
  {
    const d = -balanceOf(G.law, G.econ).balance;
    assert(Math.abs(d - 0.5) < 0.15, `saudi deficit near 0.5 (got ${d.toFixed(2)})`);
  }
  assert(G.law.income.on === false, "Saudi opens without personal income tax");
  assert(G.law.vice.alcohol === "banned", "Saudi opens with alcohol prohibition");
  assert(!G.law.taxes.alcoholDuty.on, "Gulf alcohol duty is off under prohibition");
  assert(!!G.law.policies.swf, "Saudi opens with a sovereign wealth fund");
  assert(G.law.spend.defence === 5.0, "Saudi opens with a high defence share");

  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  assert(G.law.taxes.vat.rate === 21, "France opens at ~21% VAT");
  assert(G.law.spend.welfare >= 15, "France opens with a large welfare share");
  assert(G.law.spend.defence >= 1.5 && G.law.spend.defence <= 2.2, "France opens near the NATO defence band");
  assert(!!G.law.policies.netZero && !!G.law.policies.cbam, "France opens on a net-zero / CBAM footing");
  assert(!!G.law.policies.socialCare, "France opens with free personal social care");

  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  const adj0 = G.econ.otherRevAdj;
  const yRel0 = G.econ.yRel;
  project(4);
  assert(G.econ.otherRevAdj === adj0 && G.econ.yRel === yRel0, "project leaves opening plugs / supply intact");
  assert(G.law.spend.infra >= 5, "China opens with heavy infrastructure spend");
  assert(G.law.taxes.vat.rate === 13, "China opens at 13% VAT");
  assert(G.law.spend.research >= 1.3, "China opens with high research spend");
  assert(!!G.law.policies.rnd && !!G.law.policies.closeBorders, "China opens with industrial strategy and strict borders");
  assert(G.law.vice.gambling === "banned", "China opens with gambling banned");
  /* pinOpeningHeadlines must keep the seat's income schedule, not UK defaults. */
  assert(G.law.income.allowance === 8000, "Eastern income allowance survives settle pins");
  assert(G.law.ni.erRate === 16, "Eastern employer NI survives settle pins");
  assert(G.econ.trendBias == null || G.econ.trendBias === 0, "no residual trendBias on Eastern open");

  newGame({ homeRole: "russia", homeIso: "643", country: "Northern Reach" });
  G = getG();
  assert(G.law.spend.defence >= 4.5, "Northern Reach opens with elevated defence");
  assert(G.law.regime === "dual", "Northern Reach opens on a dual income-tax regime");
  assert(!!G.law.taxes.windfall.on, "Northern Reach opens with an energy windfall levy");
  assert(G.law.vice.alcohol === "liberal", "Northern Reach opens with liberalised alcohol");
  assert(!!G.law.policies.conscript && !!G.law.policies.closeBorders, "Northern Reach opens with conscription and closed borders");

  newGame({ homeRole: "india", homeIso: "356", country: "India" });
  G = getG();
  assert(G.law.taxes.vat.rate === 18, "India opens at GST-like 18% VAT");
  assert(G.law.spend.health <= 3.0, "India opens with thin public health spend");
  assert(G.law.taxes.tobaccoDuty.rate >= 70, "India opens with heavy tobacco duty");
  assert(G.law.vice.gambling === "banned", "India opens with gambling banned");
  assert(!!G.law.policies.digitalId, "India opens with digital identity");

  newGame({ homeRole: "nigeria", homeIso: "566", country: "Green Coast Republic" });
  G = getG();
  assert(G.law.spend.welfare <= 4.5, "Nigeria opens with a thin welfare state");
  assert(G.law.tariff >= 9, "Nigeria opens with higher tariffs");
  assert(!!G.law.taxes.touristLevy.on, "Nigeria opens with a visitor levy");
  assert(!!G.law.taxes.windfall.on, "Nigeria opens with a commodity windfall levy");
  assert(!G.law.taxes.carbon.on, "Nigeria does not open with a carbon price");

  newGame({ homeRole: "brazil", homeIso: "076", country: "Atlantic Federation" });
  G = getG();
  assert(G.law.taxes.vat.rate >= 17, "Brazil opens VAT-heavy");
  assert(G.law.spend.welfare >= 8 && G.law.spend.welfare < 12, "Brazil opens with middling welfare");
  assert(G.law.vice.cannabis === "decrim", "Brazil opens with cannabis decriminalised");
  assert(!G.law.taxes.cannabisDuty.on, "Brazil cannabis duty is off under decrim");
  assert(!!G.law.policies.socialHousing, "Brazil opens with mass social housebuilding");

  newGame({ homeRole: "australia", homeIso: "036", country: "Southern Cross" });
  G = getG();
  assert(G.law.taxes.vat.rate === 10, "Australia opens at 10% GST");
  assert(G.law.taxes.corpTax.rate === 30, "Australia opens at 30% corporation tax");
  assert(!G.law.taxes.inherit.on, "Australia opens without inheritance tax");
  assert(!G.law.ni.empOn && G.law.ni.erOn, "Australia opens with employer-only payroll tax");
  assert(!!G.law.policies.netZero && !!G.law.policies.openVisas, "Australia opens with net zero and open visas");

  /* Home seat keeps the UK baseLaw (no REALM_LAW overlay). */
  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  assert(G.law.taxes.vat.on && G.law.taxes.vat.rate === 20, "UK opens at UK 20% VAT");
  assert(G.law.spend.welfare === 13.3, "UK opens at UK welfare share");
  assert(G.law.income.allowance === 12570, "UK opens at UK personal allowance");

  /* Every non-Kingdom sovereign seat has a distinct statute overlay. */
  {
    const uk = baseLaw();
    for (const c of COUNTRIES) {
      if (c.id === "kingdom") continue;
      const key = realmLawKey(c.id);
      assert(!!REALM_LAW[key], `${c.id} resolves a REALM_LAW overlay (key ${key})`);
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
  newGame({ homeRole: "germany", homeIso: "276", country: "Germany" });
  G = getG();
  assert(G.law.taxes.vat.rate >= 19 && G.law.taxes.vat.rate <= 21, `Germany opens near 19–21% VAT (got ${G.law.taxes.vat.rate})`);
  assert(G.law.spend.research >= 1.0, "Germany opens with elevated research spend");

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
  assert(uk && uk.liberty === 58 && uk.crime === 28 && uk.services === 55, "UK soc0 is the UK baseline");

  newGame({ homeRole: "home", homeIso: "826", country: "United Kingdom" });
  G = getG();
  assert(Math.abs(G.econ.liberty - 58) < 0.6, `UK liberty near 58 (got ${G.econ.liberty})`);
  assert(Math.abs(G.econ.crime - 28) < 0.6, `UK crime near 28 (got ${G.econ.crime})`);
  assert(Math.abs(G.econ.services - 55) < 2.5, `UK services near 55 (got ${G.econ.services})`);

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
  assert(Math.abs(G.econ.liberty - 62) < 1.0, `Germany liberty near 62 (got ${G.econ.liberty})`);
  assert(G.econ.crime0 === 22, "Germany crime0 is 22");
  assert(Math.abs(G.econ.crime - 22) < 1.5, `Germany crime near 22 (got ${G.econ.crime})`);

  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  assert(G.econ.liberty0 === 28, "China liberty0 is 28");
  assert(G.econ.liberty < 40, `China liberty well below UK (got ${G.econ.liberty})`);
  assert(G.econ.openness0 === 35, "China openness0 is 35");

  newGame({ homeRole: "japan", homeIso: "392", country: "Japan" });
  G = getG();
  assert(G.econ.crime0 === 12, "Japan crime0 is 12");
  assert(G.econ.crime < 20, `Japan crime well below UK (got ${G.econ.crime})`);
  assert(G.econ.services0 === 68, "Japan services0 is 68");

  newGame({ homeRole: "netherlands", homeIso: "528", country: "Low Countries" });
  G = getG();
  assert(G.econ.liberty0 === 72, "Netherlands liberty0 is 72");
  assert(G.econ.openness0 === 68, "Netherlands openness0 is 68");
  /* Anchors hold through early quarters rather than crawling back to UK. */
  for (let i = 0; i < 8; i++) step(G, G.law, G.law, true);
  assert(G.econ.liberty > 65, `Netherlands liberty stays elevated after 8Q (got ${G.econ.liberty})`);
  assert(G.econ.openness > 60, `Netherlands openness stays elevated after 8Q (got ${G.econ.openness})`);

  /* Opening-delta anchoring: unchanged statute holds near soc0; removing a
     liberty-negative opening policy raises liberty (policy content still bites). */
  newGame({ homeRole: "china", homeIso: "156", country: "China" });
  G = getG();
  assert(!!G.econ.socOpen, "China settle stores socOpen opening impulses");
  for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.liberty - 28) < 4,
    `China liberty holds near soc0 under unchanged law (got ${G.econ.liberty})`
  );
  assert(
    Math.abs(G.econ.crime - 24) < 8,
    `China crime holds near soc0 under unchanged law (got ${G.econ.crime})`
  );
  const libBefore = G.econ.liberty;
  assert(G.law.policies.digitalId, "China opens with digital identity");
  G.law.policies.digitalId = false;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  assert(
    G.econ.liberty > libBefore + 3,
    `Repealing digitalId raises China liberty (${libBefore.toFixed(1)} → ${G.econ.liberty.toFixed(1)})`
  );
}

/* Live potential growth tracks NATION_PROFILE.trend bands for every playable
   seat (derived from demography + yRel catch-up — not pinned tfpTrend). */
{
  const seats = [
    { role: "home", trend: 1.2, opts: { homeRole: "home", homeIso: "826", country: "United Kingdom" } },
    ...[
      ["france", "250"], ["united_states", "840"], ["china", "156"], ["russia", "643"],
      ["india", "356"], ["nigeria", "566"], ["brazil", "076"], ["australia", "036"], ["saudi", "682"],
      ["canada", "124"], ["korea", "410"], ["indonesia", "360"], ["argentina", "032"], ["poland", "616"],
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
      `${s.role} live potential near ${s.trend} (got ${pot.toFixed(2)})`
    );
    assert(
      G.econ.yRel != null && G.econ.birthRate != null && G.econ.migBase != null,
      `${s.role} carries structural demography / relative-income fields`
    );
    assert(
      G.econ.tfpTrend == null && G.econ.labourTrend == null,
      `${s.role} has no hard-coded tfpTrend / labourTrend`
    );
    assert(
      G.econ.trendBias == null || G.econ.trendBias === 0,
      `${s.role} has no residual trendBias`
    );
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      step(G, G.law, G.law, true);
      sum += G.econ.trendGrowth;
    }
    const mean = sum / 20;
    assert(
      Math.abs(mean - s.trend) < 1.25,
      `${s.role} mean 20Q trend near ${s.trend} (got ${mean.toFixed(2)})`
    );
  }
  /* High-CPI seats open with a Taylor-consistent Bank rate, not UK 3.75%. */
  newGame({ homeRole: "nigeria", homeIso: "566", country: "Green Coast Republic" });
  G = getG();
  assert(G.econ.rate > 8, `Nigeria opens with a high Bank rate (got ${G.econ.rate})`);
  newGame({ homeRole: "russia", homeIso: "643", country: "Northern Reach" });
  G = getG();
  assert(G.econ.rate > 6, `Northern Reach opens with a high Bank rate (got ${G.econ.rate})`);
}

/* Multi-seat authenticity: trade matrix, demography, labour, rel/deals, openness, FX, fac. */
{
  assert(
    Math.abs(tradeRestShare("home") - 0.04) < 0.005,
    `UK rest-of-world share near 4% (got ${tradeRestShare("home")})`
  );
  assert(
    Math.abs(tradeRestShare("france") - 0.04) < 0.02,
    `Continental rest-of-world near 4% not ~45% (got ${tradeRestShare("france")})`
  );
  assert(
    partnerShare("united_states", "china") > partnerShare("home", "china"),
    "US→China trade weight exceeds UK→China"
  );

  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  const ceuDeals = dealsForPartner(partnerById("france"), "france");
  assert(ceuDeals.length === 0, "Continental home sees no CEU accession deals on Continental");
  assert(G.rel.russia != null && G.rel.russia < 40, "Continental opens frosty with Northern Reach");
  assert(G.econ.dependency > 0.32, `Continental opens with older dependency (got ${G.econ.dependency})`);
  assert(Math.abs(G.econ.unemployment - NATION_PROFILE.france.unemployment0) < 0.05, `Continental opens at unemployment ${NATION_PROFILE.france.unemployment0} (got ${G.econ.unemployment})`);
  assert(G.econ.shareX >= 35, `Continental opens trade-open (shareX ${G.econ.shareX})`);

  newGame({ homeRole: "india", homeIso: "356", country: "India" });
  G = getG();
  assert(G.econ.dependency < 0.26, `India opens young (dep ${G.econ.dependency})`);
  assert(G.econ.popChild > 35, `India opens with a large child stock (got ${G.econ.popChild})`);
  assert(Math.abs(G.econ.unemployment - NATION_PROFILE.india.unemployment0) < 0.05, "India unemployment matches profile");
  assert(Math.abs(G.econ.nairu - NATION_PROFILE.india.nairu0) < 0.05, "India NAIRU matches profile");

  newGame({ homeRole: "united_states", homeIso: "840", country: "United States" });
  G = getG();
  assert(G.econ.shareX <= 16, `United States open less trade-intensive (shareX ${G.econ.shareX})`);
  assert(G.econ.fxUip < 0.02, `United States damp FX UIP (got ${G.econ.fxUip})`);
  assert(G.econ.worldRate >= 3.0, `US worldRate near domestic (got ${G.econ.worldRate})`);
  assert(G.rel.china < 40, `US opens cool with China (got ${G.rel.china})`);
  assert(!!G.law.deals.cw_fta, "US opens with Commonwealth FTA ratified");
  assert(G.fac.business > FAC_0.business, "US opens with higher business approval");

  newGame({ homeRole: "saudi", homeIso: "682", country: "Saudi Arabia" });
  G = getG();
  assert(G.fac.patriots > FAC_0.patriots, "Saudi opens with higher patriot approval");
  assert(G.econ.shareX >= 38, `Saudi opens export-heavy (shareX ${G.econ.shareX})`);

  newGame({ homeRole: "australia", homeIso: "036", country: "CW" });
  G = getG();
  assert(!!G.law.deals.king_services, "Australia opens with UK services access");
}

/* Knowledge stock R: research spend accumulates; education still lifts potential via h. */
{
  assert(
    DEPTS.some((d) => d.id === "research"),
    "research is a budget department"
  );
  newGame();
  G = getG();
  assert(
    Math.abs(G.econ.R - R0) < 0.01,
    `opening knowledge stock near R0 (got ${G.econ.R}, want ${R0})`
  );
  assert(
    Math.abs(knowledgeTfp(G.econ)) < 1e-9,
    "knowledge TFP contribution is zero at R0"
  );
  assert(
    Math.abs(researchEffort(G.law, aggregate(G.law)) - 0.7) < 1e-9,
    "baseline research effort equals the research budget"
  );

  const base = simulate(G.law, 20);
  const hiLaw = clone(G.law);
  hiLaw.spend.research = 1.8;
  const hi = simulate(hiLaw, 20);
  assert(
    hi.end.econ.R > base.end.econ.R + 1,
    `higher research spend raises R over 20Q (${base.end.econ.R.toFixed(2)} → ${hi.end.econ.R.toFixed(2)})`
  );
  assert(
    hi.end.econ.potential > base.end.econ.potential,
    `higher research raises potential (${base.end.econ.potential.toFixed(2)} → ${hi.end.econ.potential.toFixed(2)})`
  );

  const cutLaw = clone(G.law);
  cutLaw.spend.research = 0;
  const cut = simulate(cutLaw, 8);
  const R8 = cut.end.econ.R;
  assert(
    R8 < R0 && R8 > R0 * 0.7,
    `cutting research decays R slowly, not a cliff (${R0.toFixed(2)} → ${R8.toFixed(2)} in 8Q)`
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
    `education spend lifts potential via human capital with research fixed (${edu0.toFixed(3)} → ${edu1.toFixed(3)})`
  );

  newGame();
  G = getG();
  const rndLaw = clone(G.law);
  rndLaw.policies = Object.assign({}, rndLaw.policies, { rnd: true });
  const E_rnd = aggregate(rndLaw);
  assert(
    E_rnd.rndEffort > 0 && Math.abs(E_rnd.tfp) < 1e-9,
    `research credits add rndEffort (${E_rnd.rndEffort}) without a flat tfp bump (${E_rnd.tfp})`
  );
  assert(
    Math.abs(E_rnd.rndEffort - 0.55) < 1e-9,
    `research credits induce ~1:1 private effort with their fiscal cost (got ${E_rnd.rndEffort})`
  );
  const withCredits = simulate(rndLaw, 16);
  newGame();
  G = getG();
  const without = simulate(G.law, 16);
  assert(
    withCredits.end.econ.R > without.end.econ.R,
    `research credits raise the knowledge stock (${without.end.econ.R.toFixed(2)} → ${withCredits.end.econ.R.toFixed(2)})`
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
    `research credits are not a short-run growth tax (4Q growth ${imRnd.head.growth.toFixed(3)})`
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
    `employer NI cut raises cumulative growth over 4Q (got ${im.head.growth.toFixed(3)})`
  );
  const add = clone(G.law);
  add.income.bands[2].rate -= 10;
  const imAdd = impactOf(add, base, 4);
  assert(
    imAdd.head.growth < 0,
    `unfunded additional-rate cut stays weakly contractionary on cumulative growth (got ${imAdd.head.growth.toFixed(3)})`
  );
}

/* ---- Diplomacy + trade coupling ---- */
{
  newGame();
  G = getG();
  assert(MISSIONS.length >= 4, "missions table is populated");
  G.draft.missions = { france: "summit" };
  const cl = billClauses();
  assert(
    cl.some((c) => /summit|State visit/i.test(c.label)),
    "staging a summit creates a bill clause"
  );
  const cost = cl.reduce((a, c) => a + c.pc, 0);
  const cap0 = G.capital;
  applyDraftMissions(G.law, G.draft, G.econ, G.fac);
  assert(
    (G.econ.relImpulse.france || 0) >= 10,
    `summit adds relImpulse (got ${G.econ.relImpulse.france})`
  );
  assert(
    G.econ.missionCd.france === 3,
    "summit sets a three-quarter mission cooldown"
  );
  const rel0 = G.rel.france;
  step(G, G.law, G.prevLaw, true);
  assert(
    G.rel.france > rel0,
    `summit impulse lifts france relations (${rel0.toFixed(1)} → ${G.rel.france.toFixed(1)})`
  );
  assert(cap0 >= cost, "opening capital covers a summit");
}

{
  newGame();
  G = getG();
  step(G, G.law, G.prevLaw, true);
  const warmX = G.econ.bilateralX.russia;
  G.rel.russia = 20;
  step(G, G.law, G.prevLaw, true);
  const coldX = G.econ.bilateralX.russia;
  assert(
    coldX < warmX,
    `cold relations cut bilateral exports (${coldX.toFixed(3)} vs ${warmX.toFixed(3)})`
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
    `cold relations amplify retaliation (${coldRetal.toFixed(3)} vs ${warmRetal.toFixed(3)})`
  );
}

{
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.draft = clone(G.law);
  assert(lockedTariff(G.law) === 4, "customs union locks tariff at 4");
  G.draft.tariffSchedule.cet = 15;
  G.draft.tariffSchedule.default = 15;
  billClauses();
  assert(G.draft.tariffSchedule.cet === 4, "billClauses snaps draft tariff to the lock");
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
  assert(!EVENTS.find((e) => e.id === "allianceOffer"), "allianceOffer event removed");

  G.capital = 200;
  G.rel.france = 58;
  G.rel.germany = 55;
  G.rel.italy = 55;
  G.rel.spain = 55;
  G.rel.netherlands = 55;
  delete G.draft.policies.closeBorders;
  G.draft.tariffSchedule.default = 7;
  G.draft.tariff = 7;

  assert(blocJoinBlockers("continental_union", "apply").length === 0, "CU application clears with chair + tariff");
  G.draft.blocAccession = { blocId: "continental_union", phase: "apply" };
  enact();
  assert(G.blocAccession && G.blocAccession.step === 1, "application advances accession to step 1");

  G.draft.blocAccession = { blocId: "continental_union", phase: "align" };
  enact();
  assert(G.blocAccession && G.blocAccession.step === 2, "alignment advances accession to step 2");

  G.draft.blocAccession = { blocId: "continental_union", phase: "accede" };
  enact();
  assert(countryBlocId(playerCountryId()) === "continental_union", "accession treaty joins continental union");
  assert(G.law.tariffSchedule.cet === 4, "accession locks CET at 4");
  assert(!G.blocAccession, "accession state cleared after join");
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
  assert(blockers.some((b) => b.includes("Germany")), "unanimous gate blocks when one member is below threshold");
  const approvals = blocMemberApprovals("continental_union");
  assert(approvals.some((a) => a.id === "germany" && !a.ok), "germany flagged in member approvals");
}

{
  newGame();
  G = getG();
  G.blocAccession = { blocId: "continental_union", step: 1 };
  G.draft.policies.closeBorders = true;
  G.draft.tariffSchedule.default = 7;
  const blockers = blocJoinBlockers("continental_union", "align");
  assert(blockers.some((b) => b.includes("close borders") || b.includes("migration")), "close borders blocks alignment");
}

{
  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  const frDeal = DEAL_BY_ID.fr_fta;
  const blockers = dealBlockers(frDeal);
  assert(blockers.some((b) => b.includes("trade bloc")), "bilateral deals blocked while in a bloc");
}

{
  newGame();
  G = getG();
  const deDeal = DEAL_BY_ID.de_fta;
  const blockers = dealBlockers(deDeal);
  assert(blockers.some((b) => b.includes("their bloc")), "cannot bilateral with partner in a bloc");
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
  G.blocAccession = { blocId: "continental_union", step: 2 };
  G.draft.blocAccession = { blocId: "continental_union", phase: "accede" };
  enact();
  assert(!G.law.deals.fr_fta, "bilateral deals cleared on accession");
}

{
  newGame();
  G = getG();
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
  assert(!G.blocInvites || !G.blocInvites.india, "low member rel blocks invite enact");
  assert(G.capital === capBefore, "blocked invite bill does not spend capital");
  assert(blocInviteBlockers("continental_union", "india").some((b) => b.includes("Germany")), "germany blocks member-proposed invite");

  G.rel.germany = 55;
  G.draft.blocInvite = { india: true };
  enact();
  assert(
    G.blocAccessionByCountry.india && G.blocAccessionByCountry.india.blocId === "continental_union",
    "unanimous approval sends invite and accession begins"
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
  assert(G.world && G.world.germany && G.world.germany.econ, "world bags exist for partners");
  assert(G.world.india && G.world.india.econ, "india world bag exists");
  assert(!G.world.france || G.world.france.isPlayer, "player seat is mirrored, not a separate AI bag");
  const access0 = (G.econ.partnerAccessEff && G.econ.partnerAccessEff.india) || 0;
  const tBefore = effectiveTariff("india", G.law, G.homeRole, G.blocMember);
  finalizeBlocJoin(G, "india", "continental_union", G.law);
  assert(countryBlocId("india") === "continental_union", "finalizeBlocJoin sets membership");
  const tAfter = effectiveTariff("india", G.law, G.homeRole, G.blocMember);
  assert(tAfter < tBefore || tAfter === 0, "CU join zeros/cuts tariff on new member");
  const access = partnerAccessTargets(G.law, G.homeRole, G.blocMember);
  assert((access.india || 0) > 0, "player bloc access targets include new member");
  assert(
    (G.econ.partnerAccessEff.india || 0) > access0,
    "player phased access moves when a partner joins the bloc"
  );
  const g0 = G.world.germany.econ.gdp;
  step(G, G.law, G.law, true);
  assert(
    G.world.germany.econ.gdp !== g0 || G.world.germany.econ._lastGrowth != null,
    "partner world bags advance with the country macro"
  );
  const snapWorld = JSON.stringify(Object.keys(G.world).sort());
  const worldGdp = G.world.germany.econ.gdp;
  project(2);
  assert(G.world.germany.econ.gdp === worldGdp, "project() does not mutate partner world bags");
  assert(JSON.stringify(Object.keys(G.world).sort()) === snapWorld, "project() preserves world seat set");
}

{
  newGame({ homeRole: "france", homeIso: "250", country: "France" });
  G = getG();
  assert(countryBlocId(playerCountryId()) === "continental_union", "France starts in continental union");
  assert(blocInviteBlockers("continental_union", "kingdom").length === 0, "kingdom invite clears at open as france");
  G.draft.blocInvite = { kingdom: true };
  const cl = billClauses();
  assert(cl.some((c) => c.label.includes("United Kingdom") && c.label.includes("Continental Union")), "staging propose kingdom adds bill clause");
  G.capital = 200;
  enact();
  assert(
    G.blocAccessionByCountry.kingdom && G.blocAccessionByCountry.kingdom.blocId === "continental_union",
    "france can propose and deliver kingdom invite"
  );
  G.draft.blocInvite = { kingdom: true };
  assert(billClauses().length === 0, "stale invite does not block an empty bill");
  assert(!G.draft.blocInvite.kingdom, "stale staged invite cleared once accession started");
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
    `sanctions against northern cut northern relations (got ${G.rel.russia})`
  );
  assert(!G.law.deals.ru_energy, "full sanctions tear up deals with the target");
}

{
  newGame();
  G = getG();
  const ids = new Set(activePartners().map((p) => p.id));
  for (let i = 0; i < 30; i++) {
    const p = pickEventPartner();
    assert(p && ids.has(p.id), `pickEventPartner stays on active seats (${p && p.id})`);
  }
}

/* Fertility channel: childcare raises births; child stock moves before L. */
{
  newGame();
  G = getG();
  const fertLaw = clone(G.law);
  fertLaw.policies.childcare = true;
  const path = simulate(fertLaw, 16);
  newGame();
  G = getG();
  const basePath = simulate(G.law, 16);
  assert(
    path.end.econ.popChild > basePath.end.econ.popChild + 0.15,
    `childcare fertility raises popChild (${path.end.econ.popChild.toFixed(2)} vs ${basePath.end.econ.popChild.toFixed(2)})`
  );
  assert(
    aggregate(fertLaw).fertility > 0,
    "childcare exposes a fertility channel"
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
    `house-price crash lifts credit spread (peak ${peakSpread.toFixed(3)} vs baseline ${G.econ.creditSpread.toFixed(3)})`
  );
  assert(
    meanI < G.econ.I - 0.05,
    `credit scarring cuts investment vs baseline (mean ${meanI.toFixed(2)} vs ${G.econ.I.toFixed(2)})`
  );
}

/* Endogenous bank stress fires without the scripted bank event. */
{
  newGame();
  G = getG();
  G.econ.bankCapital = 4.5;
  G.econ.bankLoans = 130;
  G.econ.bankStressCd = 0;
  G.econ.bankStress = false;
  step(G, G.law, G.law, false);
  assert(G.econ.bankStress, "endogenous bankStress fires on thin capital / high leverage");
  assert(G.econ.creditSpread >= 1.5, `stressed credit floor (got ${G.econ.creditSpread.toFixed(2)})`);
  const bankEv = EVENTS.find((e) => e.id === "bank");
  assert(bankEv && !bankEv.cond(), "scripted bank event gated while stressed / on cooldown");
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
    `research lift raises trend or potential (trend ${im.head.trend}, pot ${im.head.potential})`
  );
}

/* Tariff schedule and bloc membership. */
{
  newGame();
  G = getG();
  G.law.tariffSchedule.bloc.continental_union = 4;
  assert(
    Math.abs(effectiveTariff("germany", G.law) - 4) < 0.01,
    "bloc member uses bloc tariff rate"
  );
  assert(
    effectiveTariff("india", G.law) === G.law.tariffSchedule.default,
    "non-bloc partner uses default schedule"
  );
  joinBloc("continental_union", G.law);
  assert(
    effectiveTariff("germany", G.law) === 0,
    "customs union internal tariff is zero"
  );
  assert(!joinBloc("pacific_accord", G.law), "exclusive membership blocks second bloc join");
  leaveBloc(G.law);
  createCustomBloc("Northern League", "shallow_fta");
  const blocId = countryBlocId(playerCountryId());
  assert(!!G.customBlocs[blocId], "player can found a custom alliance");
  inviteToBloc("india", blocId);
  G.rel.india = 55;
  step(G, G.law, G.law, true);
  assert(!countryBlocId("india"), "invite does not instant-join");
  assert(
    G.blocAccessionByCountry.india && G.blocAccessionByCountry.india.step === 1,
    "warm relations start accession pipeline"
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
  const snap = clone(G.blocMember);
  project(2);
  assert(JSON.stringify(G.blocMember) === JSON.stringify(snap), "project() preserves blocMember");
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
    `FTA lowers phased import tariff level (${importDeal.toFixed(2)} vs ${importBase.toFixed(2)})`
  );

  newGame();
  G = getG();
  const E0 = aggregate(G.law);
  const beforeCu = importTariffLevel(G.law, E0, G.econ, G.homeRole, G.blocMember);
  joinBloc("continental_union", G.law);
  const E1 = aggregate(G.law);
  const afterCu = importTariffLevel(G.law, E1, G.econ, G.homeRole, G.blocMember);
  assert(
    afterCu < beforeCu - 0.3,
    `CU join lowers trade-weighted import tariff (${afterCu.toFixed(2)} vs ${beforeCu.toFixed(2)})`
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
    `tariff schedule hike lifts first-quarter inflation (${hitTar.rows[0].inflation.toFixed(2)} vs ${baseTar.rows[0].inflation.toFixed(2)})`
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
    `CU join does not spike Q1 inflation (${cuQ1.rows[0].inflation.toFixed(2)} vs ${baseQ1.rows[0].inflation.toFixed(2)})`
  );

  newGame();
  G = getG();
  G.law.deals.fr_fta = true;
  step(G, G.law, G.law, true);
  const ftaAccess = (G.econ.partnerAccessEff && G.econ.partnerAccessEff.france) || 0;
  assert(
    ftaAccess < (DEAL_BY_ID.fr_fta.ch.access || 0),
    `FTA partner access phases in (${ftaAccess.toFixed(2)} vs ${DEAL_BY_ID.fr_fta.ch.access})`
  );

  newGame();
  G = getG();
  joinBloc("continental_union", G.law);
  G.law.tariffSchedule.cet = 4;
  step(G, G.law, G.law, true);
  const cuAccessQ1 = (G.econ.partnerAccessEff && G.econ.partnerAccessEff.germany) || 0;
  const Ecu = aggregate(G.law, G.homeRole, G.blocMember);
  const targetDe = (Ecu.partnerAccess && Ecu.partnerAccess.germany) || 0;
  assert(
    cuAccessQ1 < targetDe * 0.2,
    `CU partner access is small in Q1 (${cuAccessQ1.toFixed(2)} of ${targetDe.toFixed(1)} target)`
  );
  const cu40 = simulate(G.law, 40, { blocMember: G.blocMember });
  const cuAccess40 = (cu40.end.econ.partnerAccessEff && cu40.end.econ.partnerAccessEff.germany) || 0;
  assert(
    cuAccess40 > targetDe * 0.5,
    `CU partner access passes halfway by ~40q (${cuAccess40.toFixed(2)} of ${targetDe.toFixed(1)})`
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
    `CU join raises trade depth over 20q (${cu20.end.econ.tradeDepth.toFixed(1)} vs ${base20.end.econ.tradeDepth.toFixed(1)})`
  );
  assert(
    cu20.end.econ.A > base20.end.econ.A,
    `CU join lifts TFP stock over 20q (${cu20.end.econ.A.toFixed(4)} vs ${base20.end.econ.A.toFixed(4)})`
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
    `EUR members share a rate band (DE ${G.world.germany.econ.rate.toFixed(2)} vs IT ${G.world.italy.econ.rate.toFixed(2)}; open ${deRate0.toFixed(2)}/${itRate0.toFixed(2)})`
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
    `india growth after CU join not worse than outsider path (${avg(joinIN).toFixed(3)} vs ${avg(baseIN).toFixed(3)})`
  );
  assert(
    avg(joinDE) > avg(baseDE) - 0.08,
    `germany growth with india in CU not sharply worse (${avg(joinDE).toFixed(3)} vs ${avg(baseDE).toFixed(3)})`
  );
  assert(effectiveTariff("india", G.law, G.homeRole, G.blocMember) === 0, "internal CU tariff on india is zero");
}

/* FX exposure, currency metadata, and USD GDP valuation. */
{
  clearOpeningCache();
  for (const id of Object.keys(NATION_PROFILE)) {
    assert(
      typeof NATION_PROFILE[id].currency === "string" && NATION_PROFILE[id].currency.length === 3,
      `${id} has a 3-letter currency code`
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
    "sandbox IMPACT_ROWS includes currency strength"
  );

  newGame();
  G = getG();
  assert(G.econ.fx0 != null && G.econ.fx0 > 0, "home fx0 pinned after settle");
  assert(Math.abs(fxDisplayIndex("home", G) - 100) < 0.05, "currency strength opens at 100");
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.kingdom.gdp0) < 0.5,
    "home USD GDP opens at gdp0 after FX normalisation"
  );
  assert(
    Math.abs(realmGdpBn("united_states", G) - NATION_PROFILE.united_states.gdp0) < 0.5,
    "partner USD GDP opens at gdp0 after FX normalisation"
  );
  assert(
    Math.abs(realmGdpBn("japan", G) - NATION_PROFILE.japan.gdp0) < 0.5,
    "japan partner USD GDP opens at gdp0"
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
    `10% depreciation cuts USD GDP ~10% (got ${(gdpAfter / gdpBefore).toFixed(3)})`
  );
  assert(
    Math.abs(fxDisplayIndex("home", G) - 90) < 0.05,
    "fxDisplayIndex tracks depreciation"
  );
  G.econ.fx = fx0;

  const gerFx0 = G.econ.nations.germany.fx;
  G.econ.nations.germany.deficit = 14;
  G.econ.nations.germany.debt = NATION_PROFILE.germany.debt0 + 50;
  for (let i = 0; i < 16; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.nations.germany.fx - gerFx0) > 0.004,
    `partner FX moves under fiscal stress (got ${G.econ.nations.germany.fx.toFixed(4)} from ${gerFx0.toFixed(4)})`
  );
  assert(
    G.log[G.log.length - 1].fx != null,
    "quarterly log records currency strength"
  );

  newGame({ homeRole: "brazil", homeIso: "076", country: "Atlantic Federation" });
  G = getG();
  assert(currencyForSeat(G.homeRole) === "BRL", "Brazil seat shows BRL");
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.brazil.gdp0) < 0.5,
    "Brazil USD GDP opens at gdp0"
  );
  const brBefore = realmGdpBn("home", G);
  G.econ.fx = G.econ.fx0 * 0.88;
  assert(
    Math.abs(realmGdpBn("home", G) / brBefore - 0.88) < 0.01,
    "Brazil depreciation shrinks USD GDP"
  );

  newGame({ homeRole: "united_states", homeIso: "840", country: "United States" });
  G = getG();
  assert(G.econ.fxUip < 0.02, `US fxUip stays damped (got ${G.econ.fxUip})`);
  assert(currencyForSeat(G.homeRole) === "USD", "US seat currency is USD");
  assert(
    Math.abs(realmGdpBn("home", G) - NATION_PROFILE.united_states.gdp0) < 1,
    "US USD GDP opens at gdp0"
  );
  const usFx = G.econ.fx;
  for (let i = 0; i < 8; i++) step(G, G.law, G.law, true);
  assert(
    Math.abs(G.econ.fx / usFx - 1) < 0.08,
    `US currency barely drifts over 8q (${G.econ.fx.toFixed(4)} vs ${usFx.toFixed(4)})`
  );
}

/* World shocks pulse bilateral exports, not only the rest residual. */
{
  newGame();
  G = getG();
  for (let i = 0; i < 4; i++) step(G, G.law, G.law, true);
  const baseX = [];
  for (let i = 0; i < 6; i++) {
    const r = step(G, G.law, G.law, true);
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
    `global recess cuts exports (base X ${avg(baseX).toFixed(2)} → ${avg(hitX).toFixed(2)})`
  );
  assert(
    avg(hitG) < 0.55,
    `global recess weighs on growth (avg ${avg(hitG).toFixed(2)})`
  );
}

/* Relative income updates with potential so catch-up is not permanent. */
{
  newGame();
  G = getG();
  assert(G.econ.yRel0 != null && G.econ.potential0 != null, "home pins yRel0 / potential0");
  const cn0 = G.world.china.econ.yRel;
  const catch0 = (() => {
    const y = cn0;
    return 2.15 * Math.max(0, Math.log(1 / Math.max(0.08, y)));
  })();
  for (let i = 0; i < 80; i++) step(G, G.law, G.law, true);
  const cn1 = G.world.china.econ.yRel;
  assert(
    cn1 > cn0 + 0.03,
    `china yRel rises as it outgrows the frontier (${cn0.toFixed(3)} → ${cn1.toFixed(3)})`
  );
  const catch1 = 2.15 * Math.max(0, Math.log(1 / Math.max(0.08, cn1)));
  assert(
    catch1 < catch0 - 0.05,
    `china catch-up TFP fades as yRel rises (${catch0.toFixed(2)} → ${catch1.toFixed(2)})`
  );
}

/* High-debt AI seats consolidate before the books explode. */
{
  newGame();
  G = getG();
  const jp = G.world.japan;
  const spend0 = jp.law.spend.health + jp.law.spend.welfare;
  for (let i = 0; i < 40; i++) step(G, G.law, G.law, true);
  const spend1 = G.world.japan.law.spend.health + G.world.japan.law.spend.welfare;
  assert(
    spend1 < spend0 - 0.3 || G.world.japan.econ.debt < 380,
    `japan fiscal rule tightens spend or holds debt off the clamp (spend ${spend0.toFixed(1)}→${spend1.toFixed(1)}, debt ${G.world.japan.econ.debt.toFixed(0)})`
  );
  assert(
    G.world.japan.econ.gdp > 70,
    `japan does not collapse to a rump economy (gdp index ${G.world.japan.econ.gdp.toFixed(1)})`
  );
}

/* AI seats defend both sides of their debt band over a long run. */
{
  newGame();
  G = getG();
  for (let i = 0; i < 80; i++) step(G, G.law, G.law, true);
  for (const id of ["germany", "france", "united_states", "japan", "china"]) {
    const e = G.world[id].econ;
    const anchor = e.debtAnchor != null ? e.debtAnchor : NATION_PROFILE[id].debt0;
    const target = Math.min(260, Math.max(50, anchor));
    const bandHi = target + Math.min(30, 14 + target * 0.14);
    const bandLo = target - Math.min(22, 12 + target * 0.12);
    assert(
      e.debt < bandHi + 35,
      `AI ${id} stays near its debt band (debt ${e.debt.toFixed(0)}, bandHi ${bandHi.toFixed(0)}, anchor ${anchor})`
    );
    assert(
      e.debt > Math.min(bandLo, 0) - 80,
      `AI ${id} does not run away to a huge creditor position (debt ${e.debt.toFixed(0)}, bandLo ${bandLo.toFixed(0)})`
    );
  }
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke tests passed.");
