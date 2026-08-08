/**
 * Diplomacy stocks and relation-target helpers.
 * Structural relBase does not decay; event ledger does; live commitments stay
 * while in force (deals, envoys, stance, policy alignment).
 */
import type { GameState } from "./types.ts";

/** Engine hooks injected so this module stays free of circular imports on
 * the full engine bag — untyped until Phase 4's engine.js pass. */
type Deps = any;

export const LEDGER_DECAY = 0.93;
export const LEDGER_FLOOR = 0.5;
export const LEDGER_CAP = 25;
export const ENVOY_SLOTS = 2;
export const ENVOY_TARGET = 2;
export const ENVOY_ASSIGN_PC = 4;
export const ENVOY_RECALL_PC = 0;
export const ULTIMATUM_PC = 10;
export const ULTIMATUM_CD = 6;
export const ULTIMATUM_WAIT = 2;
export const ULTIMATUM_JITTER = 0.08;
export const VISIT_DURATION = 2;
export const POLICY_ALIGN_K = 0.45;
export const SANCTION_AGAINST_RESIDUAL = -6;
export const SANCTION_WITH_RESIDUAL = 4;
export const SPHERE_TRESPASS_PER = -3;
export const SPHERE_TRESPASS_CAP = -9;
export const SPHERE_LEDGER_PTS = -6;
export const DEAL_STRESS_PENALTY = -6;
export const CLOSE_BORDERS_DIPLO = -4;
export const DEFENCE_ALIGN_PTS = 2;

export const DIPLO_POLICY_KEYS = [
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
];

export const DIPLO_SPHERES = [
  {
    patron: "united_states",
    clients: ["canada", "mexico", "brazil", "argentina"],
    label: "American sphere",
  },
  {
    patron: "china",
    clients: ["indonesia", "vietnam", "korea", "japan"],
    label: "Sinosphere",
  },
  {
    patron: "france",
    clients: ["germany", "italy", "spain", "netherlands", "poland"],
    label: "Continental sphere",
  },
  {
    patron: "germany",
    clients: ["france", "italy", "spain", "netherlands", "poland"],
    label: "Continental sphere",
  },
];

export const DIPLO_CAMPS: Record<string, string[]> = {
  western: [
    "united_states",
    "canada",
    "france",
    "germany",
    "australia",
    "japan",
    "korea",
    "netherlands",
    "italy",
    "spain",
    "poland",
  ],
  gulf: ["saudi", "uae"],
  brics_ish: ["china", "russia", "india", "brazil", "south_africa"],
};

export function ensureDiploStocks(e: any) {
  if (!e) return e;
  if (!e.relImpulse) e.relImpulse = {};
  if (!e.missionCd) e.missionCd = {};
  if (!e.dealStress) e.dealStress = {};
  if (!e.diploLedger) e.diploLedger = {};
  if (!e.sanctionStance) e.sanctionStance = {};
  if (!e.relBase) e.relBase = {};
  if (!e.ultimatumCd) e.ultimatumCd = {};
  return e;
}

export function beginActiveVisit(
  g: GameState,
  partnerId: string,
  missionId?: string | null,
) {
  if (!g || !partnerId) return;
  if (!g.activeVisits) g.activeVisits = {};
  const q = g.q || 0;
  const mid = missionId || "summit";
  g.activeVisits[partnerId] = {
    missionId: mid,
    startedQ: q,
    endsQ: q + VISIT_DURATION,
    ...(mid === "summit"
      ? { eventsTotal: VISIT_DURATION, eventsFired: 0 }
      : {}),
  };
}

export function visitQuartersLeft(g: GameState, partnerId: string) {
  const v = g && g.activeVisits && g.activeVisits[partnerId];
  if (!v) return 0;
  return Math.max(0, v.endsQ - (g.q || 0));
}

export function isVisitActive(g: GameState, partnerId: string) {
  return visitQuartersLeft(g, partnerId) > 0;
}

export function seedRelBase(
  e: any,
  relMap: Record<string, number> | null | undefined,
  opts?: { polityOffset?: Record<string, number> },
) {
  ensureDiploStocks(e);
  if (!relMap) return;
  const polityOffset = (opts && opts.polityOffset) || {};
  for (const id of Object.keys(relMap)) {
    if (e.relBase[id] == null) {
      const off = polityOffset[id] || 0;
      e.relBase[id] = relMap[id] - off;
    }
  }
}

export function addDiploLedger(g: GameState, partnerId: string, entry: any) {
  if (!g || !partnerId || !entry) return;
  const e = g.econ;
  if (!e) return;
  ensureDiploStocks(e);
  if (!e.diploLedger[partnerId]) e.diploLedger[partnerId] = [];
  const list = e.diploLedger[partnerId];
  const id = entry.id || "anon_" + Date.now();
  const existing = list.find((x: any) => x.id === id);
  const sinceQ = entry.sinceQ != null ? entry.sinceQ : g.q != null ? g.q : 0;
  if (existing) {
    existing.pts = entry.pts;
    existing.label = entry.label || existing.label;
    existing.sinceQ = sinceQ;
  } else {
    list.push({
      id,
      label: entry.label || id,
      pts: entry.pts != null ? entry.pts : 0,
      sinceQ,
    });
  }
}

export function setSanctionStance(
  g: GameState,
  partnerId: string,
  flags: { against?: boolean; with?: boolean },
) {
  if (!g || !partnerId || !flags) return;
  const e = g.econ;
  if (!e) return;
  ensureDiploStocks(e);
  const cur = e.sanctionStance[partnerId] || {};
  const next = {
    against: flags.against != null ? !!flags.against : !!cur.against,
    with: flags.with != null ? !!flags.with : !!cur.with,
    sinceQ: g.q != null ? g.q : cur.sinceQ || 0,
  };
  if (!next.against && !next.with) {
    delete e.sanctionStance[partnerId];
    return;
  }
  e.sanctionStance[partnerId] = next;
}

export function clearSanctionStance(g: GameState, partnerId: string) {
  if (!g || !g.econ || !partnerId) return;
  ensureDiploStocks(g.econ);
  delete g.econ.sanctionStance[partnerId];
}

export function ledgerSum(e: any, partnerId: string) {
  ensureDiploStocks(e);
  const list = e.diploLedger[partnerId] || [];
  let s = 0;
  for (const x of list) s += x.pts || 0;
  return Math.max(-LEDGER_CAP, Math.min(LEDGER_CAP, s));
}

export function decayDiploLedger(e: any) {
  ensureDiploStocks(e);
  for (const pid of Object.keys(e.diploLedger)) {
    const list = e.diploLedger[pid];
    if (!list || !list.length) {
      delete e.diploLedger[pid];
      continue;
    }
    const next = [];
    for (const x of list) {
      const pts = (x.pts || 0) * LEDGER_DECAY;
      if (Math.abs(pts) >= LEDGER_FLOOR) next.push({ ...x, pts });
    }
    if (next.length) e.diploLedger[pid] = next;
    else delete e.diploLedger[pid];
  }
}

export function maybeClearSanctionStance(g: GameState) {
  if (!g || !g.econ) return;
  ensureDiploStocks(g.econ);
  const e = g.econ;
  for (const pid of Object.keys(e.sanctionStance)) {
    const st = e.sanctionStance[pid];
    if (!st) continue;
    const rel = g.rel && g.rel[pid] != null ? g.rel[pid] : 50;
    const age = (g.q != null ? g.q : 0) - (st.sinceQ || 0);
    const ledgerGone = !(e.diploLedger[pid] || []).some((x: any) =>
      String(x.id || "").includes("sanction"),
    );
    if ((rel > 55 && age >= 4) || (ledgerGone && age >= 8)) {
      delete e.sanctionStance[pid];
    }
  }
}

export function spherePatronsForPartner(clientId: string) {
  const out: { patron: string; label: string }[] = [];
  for (const s of DIPLO_SPHERES) {
    if (s.clients.includes(clientId) && s.patron !== clientId) {
      out.push({ patron: s.patron, label: s.label });
    }
  }
  return out;
}

export function sharedCamp(a: string, b: string) {
  for (const camp of Object.keys(DIPLO_CAMPS)) {
    const members = DIPLO_CAMPS[camp];
    if (members.includes(a) && members.includes(b)) return camp;
  }
  return null;
}

export function baseLabel(relBase: number) {
  if (relBase >= 58) return "Special relationship";
  if (relBase <= 42) return "Structural rivalry";
  return "Baseline";
}

/**
 * Build relationModifiers + target. deps provides engine hooks so this module
 * stays free of circular imports on the full engine bag.
 */
export function buildRelationModifiers(
  partnerId: string,
  g: GameState,
  law: any,
  deps: Deps,
) {
  const {
    clamp,
    aggregate,
    BASE_TARIFF,
    REL_POLITY,
    polityAffinity,
    polityIdOf,
    profilePolityId,
    DEAL_BY_ID,
    TAXES,
    playerCountryId,
    lawForRole,
    partnerById,
  } = deps;
  const e = g.econ;
  ensureDiploStocks(e);
  const mods: { label: string; pts: number; kind: string }[] = [];
  const base =
    e.relBase[partnerId] != null
      ? e.relBase[partnerId]
      : g.rel && g.rel[partnerId] != null
        ? g.rel[partnerId]
        : 50;
  mods.push({ label: baseLabel(base), pts: base, kind: "base" });

  const E = aggregate(law, g.homeRole, g.blocMember);
  // Tariff deviation from BASE_TARIFF only — baseline posture is already in relBase.
  let tariffPosture = 0;
  if (law.tariff != null) {
    if (law.tariff > BASE_TARIFF)
      tariffPosture = -(law.tariff - BASE_TARIFF) * 0.9;
    else if (law.tariff < BASE_TARIFF)
      tariffPosture = (BASE_TARIFF - law.tariff) * 0.5;
  }
  if (Math.abs(tariffPosture) >= 0.5) {
    mods.push({ label: "Tariff posture", pts: tariffPosture, kind: "live" });
  }
  // Trade openness: only the policy/deal contribution beyond a quiet baseline.
  const tradeOpen = (E.trade || 0) * 3;
  if (Math.abs(tradeOpen) >= 0.5) {
    mods.push({ label: "Trade openness", pts: tradeOpen, kind: "live" });
  }

  let dealBonus = 0;
  for (const id in law.deals || {}) {
    if (law.deals[id] && DEAL_BY_ID[id] && DEAL_BY_ID[id].partner === partnerId)
      dealBonus += 9;
  }
  const stressed = (e.dealStress[partnerId] || 0) >= 1;
  if (dealBonus && !stressed) {
    mods.push({ label: "Ratified deals", pts: dealBonus, kind: "live" });
  } else if (stressed && dealBonus) {
    mods.push({
      label: "Treaty under strain",
      pts: DEAL_STRESS_PENALTY,
      kind: "live",
    });
  }

  for (const tax of TAXES) {
    if (!tax.trade || typeof tax.trade !== "object") continue;
    const st = law.taxes[tax.id];
    if (!st || !st.on) continue;
    const hit = tax.trade[partnerId];
    if (hit) {
      const pts = hit * st.rate;
      if (Math.abs(pts) >= 0.5) {
        mods.push({ label: tax.name + " friction", pts, kind: "live" });
      }
    }
  }

  const aff = polityAffinity(
    polityIdOf(g.homeRole),
    profilePolityId(partnerId),
  );
  const polityPts = REL_POLITY * aff;
  if (Math.abs(polityPts) >= 0.5) {
    const label =
      aff >= 0.9
        ? "Similar governments"
        : aff < 0
          ? "Regime clash"
          : "Polity affinity";
    mods.push({ label, pts: polityPts, kind: "live" });
  }

  // Policy alignment vs partner seat law
  const partnerLaw =
    (g.world && g.world[partnerId] && g.world[partnerId].law) ||
    (lawForRole ? lawForRole(partnerId) : null);
  if (partnerLaw && partnerLaw.policies && law.policies) {
    let align = 0;
    for (const key of DIPLO_POLICY_KEYS) {
      const a = !!law.policies[key];
      const b = !!partnerLaw.policies[key];
      if (a === b) align += 1;
      else align -= 1;
    }
    const policyPts = clamp(align * POLICY_ALIGN_K, -6, 6);
    if (Math.abs(policyPts) >= 0.5) {
      mods.push({
        label: policyPts >= 0 ? "Policy alignment" : "Policy divergence",
        pts: policyPts,
        kind: "live",
      });
    }
  }

  const player = playerCountryId(g.homeRole);
  const camp = sharedCamp(player, partnerId);
  if (camp) {
    mods.push({ label: "Strategic alignment", pts: 1.5, kind: "live" });
  }

  // Sphere trespass: this partner is a patron; player has deals with their clients
  let trespass = 0;
  const sphere = DIPLO_SPHERES.find((s) => s.patron === partnerId);
  if (sphere && player !== partnerId) {
    for (const client of sphere.clients) {
      if (client === player) continue;
      for (const id in law.deals || {}) {
        if (!law.deals[id]) continue;
        const d = DEAL_BY_ID[id];
        if (d && d.partner === client) {
          trespass += SPHERE_TRESPASS_PER;
          break;
        }
      }
    }
    trespass = Math.max(SPHERE_TRESPASS_CAP, trespass);
    if (trespass <= -0.5) {
      mods.push({
        label: "Encroaching on their sphere",
        pts: trespass,
        kind: "live",
      });
    }
  }

  if (law.policies && law.policies.closeBorders) {
    const p = partnerById ? partnerById(partnerId) : null;
    const region = p && p.region;
    if (region === "europe" || region === "gulf") {
      mods.push({
        label: "Closed borders",
        pts: CLOSE_BORDERS_DIPLO,
        kind: "live",
      });
    }
  }

  if (law.spend && law.spend.defence >= 2.8) {
    const allies = [
      "united_states",
      "canada",
      "australia",
      "japan",
      "korea",
      "france",
      "germany",
    ];
    if (allies.includes(partnerId)) {
      mods.push({
        label: "Defence alignment",
        pts: DEFENCE_ALIGN_PTS,
        kind: "live",
      });
    }
  }

  const impulse = e.relImpulse[partnerId] || 0;
  if (Math.abs(impulse) >= 0.5) {
    mods.push({ label: "Mission impulse", pts: impulse, kind: "live" });
  }

  const visitLeft = visitQuartersLeft(g, partnerId);
  if (visitLeft > 0) {
    mods.push({ label: "State visit underway", pts: 3, kind: "live" });
  }

  const envoys = g.envoys || [null, null];
  if (envoys.includes(partnerId)) {
    mods.push({ label: "Envoy posted", pts: ENVOY_TARGET, kind: "envoy" });
  }

  const stance = e.sanctionStance[partnerId];
  if (stance && stance.against) {
    mods.push({
      label: "Sanctions against them",
      pts: SANCTION_AGAINST_RESIDUAL,
      kind: "live",
    });
  }
  if (stance && stance.with) {
    mods.push({
      label: "Sanctions with them",
      pts: SANCTION_WITH_RESIDUAL,
      kind: "live",
    });
  }

  for (const x of e.diploLedger[partnerId] || []) {
    if (Math.abs(x.pts || 0) >= LEDGER_FLOOR) {
      mods.push({ label: x.label || x.id, pts: x.pts, kind: "ledger" });
    }
  }

  // Target = sum of all modifier pts (base is absolute; others are deltas)
  // Base is the structural level; other mods are additives on top of the old
  // (50 + deltas) formula where we replaced 50 with base. So target = sum(mods.pts)
  // only if base is included as absolute and deltas are the rest — yes sum works
  // because base is absolute and others are deltas from the old 50-centered formula.
  // Wait: old formula was t = 50 + tariffPosture + ... where tariffPosture already
  // includes the "vs baseline" logic. So t = relBase + (same deltas that were added to 50).
  // Summing base + deltas is correct.
  let target = 0;
  for (const m of mods) target += m.pts;
  target = clamp(target, 0, 100);

  return { mods, target, base };
}

export function defaultUltimatumDemand(
  partnerId: string,
  g: GameState,
  deps: Deps,
) {
  const { partnerShare } = deps;
  const share = partnerShare ? partnerShare(g.homeRole, partnerId) : 0.05;
  const retal = (g.econ && g.econ.retaliation) || 0;
  if (retal > 2) return "tariffRestraint";
  if (share >= 0.08) return "marketAccess";
  return "political";
}

export function hasFormalProtest(e: any, partnerId: string) {
  const list = e && e.diploLedger && e.diploLedger[partnerId];
  if (!list || !list.length) return false;
  return list.some(
    (x: any) => x && /Formal protest/.test(x.label || "") && (x.pts || 0) < 0,
  );
}

export function canIssueUltimatum(partnerId: string, g: GameState, deps: Deps) {
  const reasons: string[] = [];
  if (!g) return { ok: false, reasons: ["no game"] };
  ensureDiploStocks(g.econ);
  if ((g.capital || 0) < ULTIMATUM_PC)
    reasons.push("need " + ULTIMATUM_PC + " capital");
  if (
    g.ultimatums &&
    g.ultimatums[partnerId] &&
    g.ultimatums[partnerId].status === "pending"
  ) {
    reasons.push("ultimatum already pending");
  }
  const cooldown = g.econ.ultimatumCd[partnerId] || 0;
  const rel = g.rel && g.rel[partnerId] != null ? g.rel[partnerId] : 50;
  const share = deps.partnerShare
    ? deps.partnerShare(g.homeRole, partnerId)
    : 0;
  const stance = g.econ.sanctionStance[partnerId];
  const ledgerNeg = ledgerSum(g.econ, partnerId) < -4;
  const protested = hasFormalProtest(g.econ, partnerId);
  const leverage =
    rel <= 45 ||
    share >= 0.1 ||
    (stance && stance.against) ||
    ledgerNeg ||
    protested;
  if (!leverage) reasons.push("Need cooler relations or more leverage");
  return { ok: reasons.length === 0 && cooldown <= 0, reasons, cooldown };
}

export function emptyEnvoys() {
  return Array(ENVOY_SLOTS).fill(null);
}

/** Map overlay markers for active diplomatic activity (envoy, summit, ultimatum). */
export function diploMapMarkers(g: GameState) {
  if (!g) return [];
  const out: { partnerId: string; kind: string }[] = [];
  const visits = g.activeVisits || {};
  const ultimatums = g.ultimatums || {};
  const missions = (g.draft && g.draft.missions) || {};
  const visitActive = (pid: string) => visitQuartersLeft(g, pid) > 0;

  for (const pid of g.envoys || []) {
    if (pid) out.push({ partnerId: pid, kind: "envoy" });
  }
  for (const pid of Object.keys(visits)) {
    const v = visits[pid];
    if (!visitActive(pid)) continue;
    if ((v.missionId || "summit") === "summit") {
      out.push({ partnerId: pid, kind: "summit" });
    }
  }
  for (const pid of Object.keys(missions)) {
    if (missions[pid] !== "summit") continue;
    if (visitActive(pid)) continue;
    out.push({ partnerId: pid, kind: "summit_staged" });
  }
  for (const pid of Object.keys(ultimatums)) {
    const u = ultimatums[pid];
    if (u && u.status === "pending") {
      out.push({ partnerId: pid, kind: "ultimatum" });
    }
  }
  return out;
}

const POLICY_SALIENCE = [
  "closeBorders",
  "openVisas",
  "conscript",
  "netZero",
  "nuclear",
  "fracking",
  "digitalId",
  "minWage",
  "fiscalRule",
  "rnd",
  "swf",
];

const POLICY_ULT_LABELS: Record<string, { on: string; off: string }> = {
  closeBorders: { on: "Close your borders", off: "Open your borders" },
  openVisas: { on: "Open your visa regime", off: "Tighten visa controls" },
  conscript: { on: "Introduce conscription", off: "End conscription" },
  netZero: { on: "Commit to net zero", off: "Drop net-zero targets" },
  nuclear: { on: "Expand nuclear power", off: "Phase out nuclear power" },
  fracking: { on: "Allow fracking", off: "Ban fracking" },
  digitalId: { on: "Introduce digital ID", off: "Drop digital ID plans" },
  minWage: { on: "Raise the minimum wage", off: "Freeze the minimum wage" },
  fiscalRule: { on: "Adopt a fiscal rule", off: "Drop the fiscal rule" },
  rnd: { on: "Expand research credits", off: "Cut research credits" },
  swf: { on: "Create a sovereign wealth fund", off: "Close the wealth fund" },
};

const POLITY_LADDER = ["democracy", "hybrid", "authoritarian"];

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function partnerLawBag(g: GameState, partnerId: string, deps: Deps) {
  const { lawForRole } = deps;
  if (g.world && g.world[partnerId] && g.world[partnerId].law) {
    return g.world[partnerId].law;
  }
  return lawForRole ? lawForRole(partnerId) : null;
}

function partnerBlocMember(g: GameState, partnerId: string) {
  if (g.world && g.world[partnerId] && g.world[partnerId].blocMember) {
    return g.world[partnerId].blocMember;
  }
  return g.blocMember || {};
}

export function partnerTariffOnPlayer(
  partnerId: string,
  g: GameState,
  deps: Deps,
) {
  const { effectiveTariff, playerCountryId } = deps;
  const player = playerCountryId(g.homeRole);
  const law = partnerLawBag(g, partnerId, deps);
  if (!law || !effectiveTariff) return null;
  return effectiveTariff(
    player,
    law,
    partnerId,
    partnerBlocMember(g, partnerId),
  );
}

function playerTariffOnPartner(partnerId: string, g: GameState, deps: Deps) {
  const { effectiveTariff } = deps;
  const law = g.draft || g.law;
  if (!law || !effectiveTariff) return null;
  return effectiveTariff(partnerId, law, g.homeRole, g.blocMember);
}

function hasRatifiedDeal(partnerId: string, g: GameState, deps: Deps) {
  const { DEAL_BY_ID } = deps;
  const law = g.law || g.draft;
  if (!law || !law.deals) return false;
  for (const id in law.deals) {
    if (!law.deals[id]) continue;
    const d = DEAL_BY_ID[id];
    if (d && d.partner === partnerId) return true;
  }
  return false;
}

function topPolicyDivergence(partnerId: string, g: GameState, deps: Deps) {
  const law = g.law || g.draft;
  const pl = partnerLawBag(g, partnerId, deps);
  if (!law || !law.policies || !pl || !pl.policies) return null;
  for (const key of POLICY_SALIENCE) {
    const a = !!law.policies[key];
    const b = !!pl.policies[key];
    if (a !== b) {
      const labels = POLICY_ULT_LABELS[key] || { on: key, off: key };
      return {
        key,
        label: a ? labels.on : labels.off,
        playerVal: a,
      };
    }
  }
  return null;
}

function leverageTerm(rel: number, gdpRatio: number | null | undefined) {
  const relPart = clamp01((52 - rel) / 52) * 0.42;
  const ratio = gdpRatio != null && gdpRatio > 0 ? gdpRatio : 1;
  const gdpPart =
    clamp01(Math.log2(Math.max(0.25, ratio)) * 0.22 + 0.14) * 0.38;
  return relPart + gdpPart;
}

export function partnerSelfInterest(
  demandId: string,
  partnerId: string,
  g: GameState,
  deps: Deps,
  meta?: any,
) {
  const {
    partnerShare,
    polityIdOf,
    profilePolityId,
    polityAffinity,
    aggregate,
  } = deps;
  const rel = g.rel && g.rel[partnerId] != null ? g.rel[partnerId] : 50;
  const share = partnerShare ? partnerShare(g.homeRole, partnerId) : 0;
  const pl = partnerLawBag(g, partnerId, deps);
  const bilat = (g.econ && g.econ.bilateralX) || {};
  const exportsToPartner = bilat[partnerId] || 0;
  const totalX =
    Object.values(bilat).reduce((s: number, v: any) => s + (v || 0), 0) || 1;
  const exportShare = exportsToPartner / (totalX as number);

  if (demandId === "tariffCut") {
    const theirTar = partnerTariffOnPlayer(partnerId, g, deps);
    const ourTar = playerTariffOnPartner(partnerId, g, deps);
    if (theirTar == null || ourTar == null) return 0;
    if (exportShare > share + 0.03) return 0.45;
    if (theirTar > ourTar + 2) return -0.35;
    return 0.1;
  }
  if (demandId === "marketAccess") {
    if (pl && pl.policies && pl.policies.openVisas) return 0.4;
    if (hasRatifiedDeal(partnerId, g, deps)) return -0.2;
    return pl && pl.policies && pl.policies.closeBorders ? -0.45 : 0.15;
  }
  if (demandId === "policyChange") {
    const pl = g.law || g.draft;
    const div =
      meta && meta.policyKey
        ? {
            key: meta.policyKey,
            playerVal: !!(pl && pl.policies && pl.policies[meta.policyKey]),
          }
        : topPolicyDivergence(partnerId, g, deps);
    if (!div) return 0;
    if (div.key === "conscript" && div.playerVal === false) return -0.5;
    if (div.key === "openVisas" && div.playerVal === true) return 0.35;
    if (div.key === "closeBorders" && div.playerVal === false) return 0.25;
    if (aggregate && pl) {
      try {
        const hypo = {
          ...pl,
          policies: { ...pl.policies, [div.key]: div.playerVal },
        };
        const e0 = aggregate(pl, partnerId, partnerBlocMember(g, partnerId));
        const e1 = aggregate(hypo, partnerId, partnerBlocMember(g, partnerId));
        const dTrade = (e1.trade || 0) - (e0.trade || 0);
        const dPot = (e1.pot || 0) - (e0.pot || 0);
        return clamp01(0.2 + dTrade * 2 + dPot * 0.5) * 2 - 1;
      } catch {
        return 0;
      }
    }
    return 0;
  }
  if (demandId === "regimeReform") {
    const aff = polityAffinity(
      polityIdOf(g.homeRole),
      profilePolityId(partnerId),
    );
    if (aff >= 0) return -0.2;
    const pin = profilePolityId(partnerId);
    if (pin === "hybrid") return 0.15;
    if (pin === "authoritarian") return -0.65;
    return 0;
  }
  if (demandId === "endRetaliation") {
    const retal = (g.econ && g.econ.retaliation) || 0;
    if (retal > 2 && share >= 0.06) return 0.35;
    if (rel < 35) return -0.3;
    return 0.05;
  }
  if (demandId === "political") {
    if (rel >= 58) return 0.35;
    if (rel <= 38) return -0.35;
    return 0;
  }
  return 0;
}

export function demandFit(
  demandId: string,
  partnerId: string,
  g: GameState,
  deps: Deps,
  _meta?: any,
): number {
  const { partnerShare, polityIdOf, profilePolityId, polityAffinity } = deps;
  const share = partnerShare ? partnerShare(g.homeRole, partnerId) : 0;

  if (demandId === "tariffCut") {
    const theirTar = partnerTariffOnPlayer(partnerId, g, deps);
    const ourTar = playerTariffOnPartner(partnerId, g, deps);
    if (theirTar == null || ourTar == null) return 0;
    return clamp01((theirTar - ourTar) / 10);
  }
  if (demandId === "marketAccess") {
    return hasRatifiedDeal(partnerId, g, deps) ? 0 : clamp01(share / 0.12);
  }
  if (demandId === "policyChange") {
    return topPolicyDivergence(partnerId, g, deps) ? 0.55 : 0;
  }
  if (demandId === "regimeReform") {
    const aff = polityAffinity(
      polityIdOf(g.homeRole),
      profilePolityId(partnerId),
    );
    return aff < 0 ? 0.35 : 0;
  }
  if (demandId === "endRetaliation") {
    const retal = (g.econ && g.econ.retaliation) || 0;
    return retal > 1.5 && share >= 0.06 ? clamp01(retal / 4) : 0;
  }
  if (demandId === "political") return 0.25;
  return 0;
}

function demandAvailable(
  demandId: string,
  partnerId: string,
  g: GameState,
  deps: Deps,
  _meta?: any,
): boolean {
  const { partnerShare } = deps;
  const share = partnerShare ? partnerShare(g.homeRole, partnerId) : 0;
  if (demandId === "tariffCut") {
    const theirTar = partnerTariffOnPlayer(partnerId, g, deps);
    const ourTar = playerTariffOnPartner(partnerId, g, deps);
    return theirTar != null && ourTar != null && theirTar >= ourTar + 2;
  }
  if (demandId === "marketAccess") {
    return !hasRatifiedDeal(partnerId, g, deps) && share >= 0.06;
  }
  if (demandId === "policyChange") {
    return !!topPolicyDivergence(partnerId, g, deps);
  }
  if (demandId === "regimeReform") {
    const { polityIdOf, profilePolityId, polityAffinity } = deps;
    return (
      polityAffinity(polityIdOf(g.homeRole), profilePolityId(partnerId)) < 0
    );
  }
  if (demandId === "endRetaliation") {
    return (g.econ.retaliation || 0) > 1.5 && share >= 0.06;
  }
  if (demandId === "political") return true;
  return false;
}

export function interestTag(interest: number) {
  if (interest >= 0.25) return "In their interest";
  if (interest <= -0.25) return "Against their interest";
  return "Mixed";
}

export function baseP(
  partnerId: string,
  demandId: string,
  g: GameState,
  deps: Deps,
  meta?: any,
) {
  const { realmGdpBn, playerCountryId } = deps;
  const rel = g.rel && g.rel[partnerId] != null ? g.rel[partnerId] : 50;
  const player = playerCountryId(g.homeRole);
  const gdpP = realmGdpBn ? realmGdpBn(player, g) : 1;
  const gdpR = realmGdpBn ? realmGdpBn(partnerId, g) : 1;
  const ratio = gdpR > 0 ? gdpP / gdpR : 1;
  const fit = demandFit(demandId, partnerId, g, deps, meta);
  const interest = partnerSelfInterest(demandId, partnerId, g, deps, meta);
  let p = 0.14 + leverageTerm(rel, ratio) + fit * 0.3 + interest * 0.26;
  if (demandId === "regimeReform") p -= 0.12;
  if (hasFormalProtest(g.econ, partnerId)) p += 0.04;
  return clamp01(p);
}

export function concedeP(
  partnerId: string,
  demandId: string,
  g: GameState,
  deps: Deps,
  det: boolean,
  meta?: any,
) {
  const base = baseP(partnerId, demandId, g, deps, meta);
  if (det) return base;
  const jitter = (Math.random() - 0.5) * ULTIMATUM_JITTER;
  return Math.max(0.05, Math.min(0.95, base + jitter));
}

export function ultimatumDemandsFor(
  partnerId: string,
  g: GameState,
  deps: Deps,
) {
  const ids = [
    "tariffCut",
    "marketAccess",
    "policyChange",
    "regimeReform",
    "endRetaliation",
    "political",
  ];
  const out: any[] = [];
  for (const id of ids) {
    if (id === "political") continue;
    if (!demandAvailable(id, partnerId, g, deps)) continue;
    let meta: any = {};
    if (id === "policyChange") {
      const div = topPolicyDivergence(partnerId, g, deps);
      if (!div) continue;
      meta = { policyKey: div.key, label: div.label };
    } else if (id === "tariffCut") {
      meta = { label: "Cut tariffs on our exports" };
    } else if (id === "marketAccess") {
      meta = { label: "Open market access" };
    } else if (id === "regimeReform") {
      meta = { label: "Political reform / democratic opening" };
    } else if (id === "endRetaliation") {
      meta = { label: "End trade retaliation" };
    }
    const fit = demandFit(id, partnerId, g, deps, meta);
    const interest = partnerSelfInterest(id, partnerId, g, deps, meta);
    if (fit <= 0 && interest <= -0.3) continue;
    out.push({
      id,
      label: meta.label || id,
      policyKey: meta.policyKey,
      baseP: baseP(partnerId, id, g, deps, meta),
      interest,
      interestLabel: interestTag(interest),
    });
  }
  if (!out.length) {
    out.push({
      id: "political",
      label: "General diplomatic concession",
      baseP: baseP(partnerId, "political", g, deps, {}),
      interest: partnerSelfInterest("political", partnerId, g, deps, {}),
      interestLabel: interestTag(
        partnerSelfInterest("political", partnerId, g, deps, {}),
      ),
    });
  }
  return out;
}

function stepPolityToward(from: string, to: string) {
  const a = POLITY_LADDER.indexOf(from);
  const b = POLITY_LADDER.indexOf(to);
  if (a < 0 || b < 0 || a === b) return from;
  return POLITY_LADDER[a < b ? a + 1 : a - 1];
}

export function applyUltimatumConcede(
  state: GameState,
  partnerId: string,
  ult: any,
  deps: Deps,
) {
  const { playerCountryId } = deps;
  const demand = ult.demand;
  const player = playerCountryId(state.homeRole);
  if (demand === "marketAccess") {
    if (!state.econ.partnerAccessEff) state.econ.partnerAccessEff = {};
    state.econ.partnerAccessEff[partnerId] =
      (state.econ.partnerAccessEff[partnerId] || 0) + 2.5;
  } else if (demand === "tariffCut") {
    const seat = state.world && state.world[partnerId];
    if (seat && seat.law) {
      const sched = seat.law.tariffSchedule || {
        default: 4,
        country: {},
        bloc: {},
      };
      if (!sched.country) sched.country = {};
      const cur =
        sched.country[player] != null ? sched.country[player] : sched.default;
      sched.country[player] = Math.max(0, cur - 2);
      seat.law.tariffSchedule = sched;
    } else {
      if (!state.econ.partnerAccessEff) state.econ.partnerAccessEff = {};
      state.econ.partnerAccessEff[partnerId] =
        (state.econ.partnerAccessEff[partnerId] || 0) + 1.5;
    }
  } else if (demand === "endRetaliation") {
    state.econ.retaliation = Math.max(0, (state.econ.retaliation || 0) - 0.8);
  } else if (demand === "policyChange" && ult.policyKey) {
    const seat = state.world && state.world[partnerId];
    const playerLaw = state.law || state.draft;
    if (
      seat &&
      seat.law &&
      seat.law.policies &&
      playerLaw &&
      playerLaw.policies
    ) {
      seat.law.policies[ult.policyKey] = !!playerLaw.policies[ult.policyKey];
    }
  } else if (demand === "regimeReform") {
    const seat = state.world && state.world[partnerId];
    const { polityIdOf } = deps;
    if (seat && seat.law) {
      const from = seat.law.polity || "authoritarian";
      const toward = polityIdOf(state.homeRole);
      seat.law.polity = stepPolityToward(from, toward);
    }
    state.econ.relImpulse[partnerId] =
      (state.econ.relImpulse[partnerId] || 0) + 4;
  } else {
    state.econ.relImpulse[partnerId] =
      (state.econ.relImpulse[partnerId] || 0) + 8;
  }
  addDiploLedger(state, partnerId, {
    id: "ultimatum_concede_" + (state.q || 0),
    label: "Backed down to our ultimatum",
    pts: -6,
  });
}

export function applyUltimatumDefy(state: GameState, partnerId: string) {
  addDiploLedger(state, partnerId, {
    id: "ultimatum_defy_" + (state.q || 0),
    label: "Defied our ultimatum",
    pts: -12,
  });
  state.econ.retaliation = (state.econ.retaliation || 0) + 0.5;
  state.mods = state.mods || [];
  state.mods.push({ uncertainty: 0.15, q: 4 });
}

/** Apply concede/defy and return press-facing diplomatic + economic impact lines. */
export function ultimatumOutcomeImpacts(
  state: GameState,
  partnerId: string,
  ult: any,
  conceded: boolean,
  deps: Deps,
) {
  const e = state.econ;
  ensureDiploStocks(e);
  const retal0 = e.retaliation || 0;
  const access0 = (e.partnerAccessEff && e.partnerAccessEff[partnerId]) || 0;
  const impulse0 = (e.relImpulse && e.relImpulse[partnerId]) || 0;
  const mods0 = state.mods ? state.mods.length : 0;
  const demand = ult.demand;

  if (conceded) applyUltimatumConcede(state, partnerId, ult, deps);
  else applyUltimatumDefy(state, partnerId);

  if (!conceded) {
    const economic = ["trade retaliation rises"];
    if (state.mods && state.mods.length > mods0)
      economic.push("business uncertainty lingers four quarters");
    return {
      diplomatic: "relations plunge and their trust in our ultimatum collapses",
      economic: economic.join(" · "),
    };
  }

  const diplomatic = ["they lose face on the world stage · our leverage rises"];
  const impulse1 = (e.relImpulse && e.relImpulse[partnerId]) || 0;
  if (impulse1 > impulse0 + 0.5) diplomatic.push("relations set to warm");

  const economic = [];
  const retal1 = e.retaliation || 0;
  const access1 = (e.partnerAccessEff && e.partnerAccessEff[partnerId]) || 0;
  if (retal1 < retal0 - 0.05) economic.push("trade retaliation eases");
  if (access1 > access0 + 0.05)
    economic.push("market access opens for our exporters");
  if (demand === "tariffCut")
    economic.push("their tariffs on our goods fall 2 points");
  else if (demand === "marketAccess")
    economic.push("deeper market access lifts export competitiveness");
  else if (demand === "endRetaliation")
    economic.push("bilateral commerce recovers");
  else if (demand === "policyChange")
    economic.push("they align policy with ours");
  else if (demand === "regimeReform")
    economic.push("political opening may unlock deeper trade ties");
  else economic.push("export competitiveness improves over the coming year");

  return {
    diplomatic: diplomatic.join(" · "),
    economic: economic.join(" · "),
  };
}

/** Mission visit events — summit despatch pool. */
export const MISSION_EVENTS = [
  {
    id: "summit_gaffe",
    missions: ["summit"],
    w: 12,
    title: "An awkward toast",
    text: "At the state dinner with {P}, your Chancellor misspoke on a sensitive topic. The room went quiet.",
    cond: () => true,
    opts: [
      {
        b: "Apologise at once",
        e: "Relations recover; patriots wince",
        setRel: { _partner: 6 },
        fac: { patriots: -3, urban: 2 },
        relImpulse: 4,
        ledger: { label: "Summit apology", pts: 4 },
      },
      {
        b: "Brush it off",
        e: "They notice the slight",
        setRel: { _partner: -5 },
        fac: { patriots: 2 },
        ledger: { label: "Summit gaffe", pts: -5 },
      },
      {
        b: "Change the subject with a trade pledge",
        e: "Business likes it; costs capital",
        setRel: { _partner: 3 },
        fac: { business: 3, patriots: -1 },
        capital: -2,
        relImpulse: 2,
      },
    ],
  },
  {
    id: "summit_rival",
    missions: ["summit"],
    w: 10,
    title: "A request regarding {R}",
    text: "{P} asks {C} to join a public statement condemning {R} over its latest provocation.",
    cond: (pid: string, g: GameState, deps: Deps) =>
      !!pickMissionRival(pid, g, deps),
    opts: [
      {
        b: "Join the condemnation",
        e: "Warm {P}; frosty {R}",
        setRel: { _partner: 8, _rival: -10 },
        fac: { patriots: 3, business: -2 },
        ledger: {
          label: "Joined condemnation of rival",
          pts: 5,
          partner: "_partner",
        },
        rivalLedger: { label: "Condemned us publicly", pts: -8 },
      },
      {
        b: "Stay neutral",
        e: "Nobody is fully satisfied",
        setRel: { _partner: -2 },
        fac: { patriots: -1 },
      },
      {
        b: "Warn {P} against escalation",
        e: "Principled, but cool",
        setRel: { _partner: -4, _rival: 2 },
        fac: { patriots: 4, urban: 2 },
        ledger: { label: "Refused to condemn rival", pts: -3 },
      },
    ],
  },
  {
    id: "summit_success",
    missions: ["summit"],
    w: 14,
    title: "The visit lands well",
    text: "Press in {P} runs warm coverage of the summit. Both capitals want to keep the momentum.",
    cond: (pid: string, g: GameState) =>
      (g.rel[pid] != null ? g.rel[pid] : 50) >= 48,
    opts: [
      {
        b: "Announce follow-up talks",
        e: "Relations strengthen",
        setRel: { _partner: 10 },
        relImpulse: 8,
        ledger: { label: "Successful state visit", pts: 8 },
      },
      {
        b: "Keep expectations modest",
        e: "Steady progress",
        setRel: { _partner: 4 },
        relImpulse: 4,
        ledger: { label: "Cordial summit", pts: 4 },
      },
      {
        b: "Press for immediate concessions",
        e: "Greedy tone",
        setRel: { _partner: -3 },
        fac: { business: 2, patriots: 3 },
      },
    ],
  },
  {
    id: "summit_business",
    missions: ["summit"],
    w: 11,
    title: "The business delegation",
    text: "CEOs travelling with the delegation want {C} to signal openness on market access with {P}.",
    cond: (pid: string, g: GameState, deps: Deps) =>
      !hasRatifiedDeal(pid, g, deps),
    opts: [
      {
        b: "Promise deeper access",
        e: "Markets cheer; phased in",
        setRel: { _partner: 7 },
        fac: { business: 4, patriots: -2 },
        access: 1.5,
        relImpulse: 5,
        ledger: { label: "Market-access pledge", pts: 5 },
      },
      {
        b: "Offer a symbolic tariff trim at home",
        e: "Small unilateral move",
        setRel: { _partner: 4 },
        fac: { business: 2 },
        tariffCut: 0.5,
        relImpulse: 3,
      },
      {
        b: "Decline — security first",
        e: "Cool reception",
        setRel: { _partner: -4 },
        fac: { patriots: 3, business: -2 },
      },
    ],
  },
  {
    id: "summit_sanctions_ask",
    missions: ["summit"],
    w: 8,
    title: "Sanctions on {R}?",
    text: "{P} privately asks whether {C} will join symbolic sanctions against {R}.",
    cond: (pid: string, g: GameState, deps: Deps) =>
      !!pickMissionRival(pid, g, deps),
    opts: [
      {
        b: "Join symbolic measures",
        e: "Host pleased; rival furious",
        setRel: { _partner: 6, _rival: -12 },
        fac: { patriots: 4, business: -3 },
        sanctionRival: true,
        ledger: { label: "Joined symbolic sanctions", pts: 4 },
      },
      {
        b: "Refuse",
        e: "Pragmatic distance",
        setRel: { _partner: -3, _rival: 3 },
        fac: { business: 2 },
      },
      {
        b: "Offer a trade concession instead",
        e: "Buy goodwill",
        setRel: { _partner: 5, _rival: 0 },
        capital: -3,
        relImpulse: 4,
        tariffCut: 0.5,
      },
    ],
  },
];

function pickMissionRival(
  partnerId: string,
  g: GameState,
  deps: Deps,
): { id: string; name: string } | null {
  const { activePartners, sharedCamp } = deps;
  if (!activePartners) return null;
  const player = deps.playerCountryId(g.homeRole);
  let best = null;
  let worst = 100;
  for (const p of activePartners(g.homeRole)) {
    if (p.id === partnerId) continue;
    const rel = g.rel[p.id] != null ? g.rel[p.id] : 50;
    const camp = sharedCamp ? sharedCamp(player, p.id) : null;
    const partnerCamp = sharedCamp ? sharedCamp(player, partnerId) : null;
    if (camp && camp === partnerCamp) continue;
    if (rel < worst) {
      worst = rel;
      best = p;
    }
  }
  return best && worst < 55 ? best : null;
}

export function rollMissionEvent(
  missionId: string,
  partnerId: string,
  g: GameState,
  deps: Deps,
  det: boolean,
  eventIndex?: number,
) {
  const pool = MISSION_EVENTS.filter((ev) => {
    if (!ev.missions.includes(missionId)) return false;
    if (ev.cond && !(ev.cond as any)(partnerId, g, deps)) return false;
    return true;
  });
  if (!pool.length) return null;
  let total = 0;
  for (const ev of pool) total += ev.w || 1;
  let roll = det
    ? (partnerId.charCodeAt(0) +
        (g.q || 0) * 7 +
        missionId.length +
        (eventIndex || 0) * 13) %
      total
    : Math.floor(Math.random() * total);
  for (const ev of pool) {
    roll -= ev.w || 1;
    if (roll < 0) {
      const rival = pickMissionRival(partnerId, g, deps);
      return {
        ...ev,
        partnerId,
        rivalId: rival ? rival.id : null,
        rivalName: rival ? rival.name : null,
      };
    }
  }
  const ev = pool[pool.length - 1];
  const rival = pickMissionRival(partnerId, g, deps);
  return {
    ...ev,
    partnerId,
    rivalId: rival ? rival.id : null,
    rivalName: rival ? rival.name : null,
  };
}

export function formatMissionEventText(ev: any, g: GameState, deps: Deps) {
  const { partnerById, T } = deps;
  const p = partnerById(ev.partnerId);
  let text = ev.text || "";
  text = text.replace(/\{P\}/g, p ? p.name : ev.partnerId);
  text = text.replace(/\{R\}/g, ev.rivalName || "a rival");
  if (T) text = T(text);
  else text = text.replace(/\{C\}/g, g.country || "The Kingdom");
  return text;
}
