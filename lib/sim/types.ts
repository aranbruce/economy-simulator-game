/**
 * Shared cross-cutting types for the sim/UI boundary.
 *
 * `lib/sim/engine.js` is untyped until Phase 4 of the TS migration (see
 * CLAUDE.md). `GameState` is a deliberate `any` alias marking "the live `G`
 * object, not yet modelled" — grep this file when Phase 4 lands to replace
 * it with the real `Law`/`Econ`/faction shape.
 */
export type GameState = any;

/** The six faction blocs whose approval drives political capital. */
export type FactionId =
  "business" | "workers" | "pensioners" | "urban" | "rural" | "patriots";

/** A points-per-faction effect bag — present on taxes, policies, regimes,
 * vice states and diplomatic missions. Every key is optional; absent
 * factions are simply unaffected. */
type FactionEffects = Partial<Record<FactionId, number>>;

/** A structural-channel effect bag (labour, tfp, ucost, part, …) — see
 * CLAUDE.md "Adding content" for the open list of channel keys. Loosely
 * typed by design: the channel set is extended in content data, not in
 * the engine, so a closed union would fight every new tax/policy. */
type ChannelEffects = Partial<Record<string, number>>;

/** One of `FACTIONS` in engine.ts — the six blocs above, with the
 * population-weight used to aggregate approval. */
export interface Faction {
  id: FactionId;
  name: string;
  w: number;
}

/** One of `DEPTS` — a departmental spending line, opening share of GDP and
 * slider bounds. See "Three ways to set a budget" in CLAUDE.md. */
export interface Dept {
  id: string;
  name: string;
  def: number;
  min: number;
  max: number;
}

/** One of `TAXES`. `base`/`eti` calibrate the revenue and Laffer curves;
 * see CLAUDE.md "Adding content" and "Tax bases are not GDP". */
export interface Tax {
  id: string;
  name: string;
  grp: string;
  basis: "income" | "consumption" | "profits" | "assets" | "volume" | "wages";
  def: number;
  max: number;
  step?: number;
  base: number;
  eti: number;
  on: boolean;
  pc: number;
  /** Vice-gated taxes: `[viceId, ...allowedStates]` — see `taxAvailable()`. */
  req?: string[];
  ch?: ChannelEffects;
  imp?: Partial<Record<string, number>>;
  fac?: FactionEffects;
  /** Per-partner trade friction, e.g. digitalTax vs `united_states`. */
  trade?: Record<string, number>;
}

/** One of `POLICIES`. `cost` is annual % of GDP (negative saves money);
 * `kills` lists mutually exclusive policies. See CLAUDE.md "Adding content". */
export interface Policy {
  id: string;
  name: string;
  cat: string;
  cost: number;
  pc: number;
  blurb: string;
  ch?: ChannelEffects;
  imp?: Partial<Record<string, number>>;
  fac: FactionEffects;
  kills?: string[];
  /** Scalar bonus/penalty added straight into `E.trade` (openness), unlike
   * a Tax's `trade`, which is a per-partner friction record. */
  trade?: number;
  /** Shock resilience contribution (e.g. diversification policies). */
  resilience?: number;
  /** One-off structural flags read by name at the call site, not effect
   * bags. */
  fund?: boolean;
  rule?: boolean;
  tripleLock?: boolean;
  /** When set, this item reads as law rather than economic policy and
   * renders in the Laws drawer's State & Constitution rail under this
   * category name instead of in PoliciesPanel — see `components/drawers/
   * LawsPanel.tsx` and `components/drawers/PoliciesPanel.tsx`. */
  lawsCat?: string;
}

/** One option within a `LawGroup` — see `lib/sim/lawGroups.ts`. Shaped like
 * a `ViceState` but for a law that isn't a regulated vice good (state form,
 * union legality, judicial immunity, …). `req` reuses the generalised
 * `resolveReqState()` format: `["polity", ...allowed]` or bare vice id. */
export interface LawGroupOption {
  id: string;
  label: string;
  blurb: string;
  pc: number;
  req?: string[];
  imp?: Partial<Record<string, number>>;
  fac?: FactionEffects;
  ch?: ChannelEffects;
}

/** One of `LAW_GROUPS` — the generalised "pick one of N states" pattern
 * VICE established, lifted out of the vice-goods domain so State &
 * Constitution / Labor & Welfare (and future menus) can use it too.
 * `law.groups[id]` holds the current option id. `menu` selects which rail
 * category of the Laws drawer the group renders under. */
export interface LawGroup {
  id: string;
  name: string;
  menu: "state" | "labor" | "rights" | "justice";
  cat: string;
  options: LawGroupOption[];
}

/** One legality state of a `Vice` (e.g. cannabis: banned/decrim/legal). */
export interface ViceState {
  id: string;
  label: string;
  blurb: string;
  imp?: Partial<Record<string, number>>;
  fac?: FactionEffects;
}

/** One of `VICE` — a regulated good/service with a ladder of legality
 * states and an optional matching duty in `TAXES` (`tax`). */
export interface Vice {
  id: string;
  name: string;
  pc: number;
  tax?: string;
  states: ViceState[];
}

/** One of `MISSIONS` — a diplomatic bill clause (summit/protest/sanctions). */
export interface Mission {
  id: string;
  name: string;
  pc: number;
  /** Relation-points impulse, decaying over subsequent quarters. */
  impulse: number;
  fac: FactionEffects;
  retalNudge?: number;
  uncertainty?: number;
}

/** One slice of the taxpaying population: weight (share of population) and
 * gross annual income in game-£. See lib/sim/incomeDist.ts. */
export interface IncomeSlice {
  w: number;
  inc: number;
}

/** Opening macro snapshot for a sovereign partner seat. See
 * lib/sim/nationProfiles.ts (NATION_PROFILE). */
export interface NationProfile {
  polity: "democracy" | "hybrid" | "authoritarian";
  /** Opening `law.groups.hereditary` pin — only set true on seats with a
   * hereditary head of state; every other seat defaults to elected. See
   * `lib/sim/lawGroups.ts`. */
  hereditary?: boolean;
  trend: number;
  debt0: number;
  deficit0: number;
  inflation0: number;
  gdp0: number;
  vol: number;
  beta: number;
  yRel: number;
  birthRate: number;
  migBase: number;
  dep0: number;
  popChild0: number;
  /** Opening old-age population share, where it diverges from `dep0 * popWork0`
   * (only set on a subset of seats). */
  popOld0?: number;
  unemployment0: number;
  nairu0: number;
  /** Effective mortgage/loan rate opening pin, where it diverges from the
   * policy rate (only set on a subset of seats). */
  effInterest0?: number;
  shareC: number;
  shareI: number;
  shareX: number;
  shareM: number;
  worldRate: number;
  fxUip: number;
  currency: string;
  fac0: {
    business: number;
    workers: number;
    pensioners: number;
    urban: number;
    rural: number;
    patriots: number;
  };
  soc0: {
    services: number;
    liberty: number;
    crime: number;
    health: number;
    env: number;
    openness: number;
    gini: number;
  };
}
