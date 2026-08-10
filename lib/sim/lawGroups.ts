/**
 * The generalised "pick one of N states" pattern VICE established, lifted
 * out of the vice-goods domain. `law.groups[id]` holds the current option
 * id for each `LawGroup`; `aggregate()` sums the active option's `imp`/
 * `fac`/`ch` the same way it sums a vice state (see the `LAW_GROUPS` loop
 * in engine.ts, added directly after the VICE loop).
 *
 * `menu` picks which rail category of the Laws drawer (`components/drawers/
 * LawsPanel.tsx`) a group renders under. Two menus exist today — `state`
 * (State & Constitution) and `labor` (Labor & Social Welfare) — with room
 * for future menus (Justice & Security, Civil Rights, …) to add their own
 * groups here without touching `aggregate()` again.
 */
import type { LawGroup } from "./types.ts";

export const LAW_GROUPS: LawGroup[] = [
  {
    id: "hereditary",
    name: "Head-of-state succession",
    menu: "state",
    cat: "Head of State",
    options: [
      {
        id: "elected",
        label: "Elected head of state",
        blurb: "The head of state holds no hereditary claim to office.",
        pc: 16,
        fac: { patriots: 1, business: 1 },
        imp: { lib: 1 },
      },
      {
        id: "hereditary",
        label: "Hereditary head of state",
        blurb: "The office passes by hereditary succession.",
        pc: 20,
        fac: { patriots: 6, rural: 3, urban: -3 },
      },
    ],
  },
  {
    id: "termLimit",
    name: "Consecutive term limit",
    menu: "state",
    cat: "Head of State",
    options: [
      {
        id: "none",
        label: "No limit",
        blurb: "The head of state may seek re-election indefinitely.",
        pc: 14,
        fac: { patriots: 3, urban: -4 },
      },
      {
        id: "one",
        label: "Single term only",
        blurb: "One term, then mandatory succession.",
        pc: 10,
        fac: { urban: 3, patriots: -2 },
      },
      {
        id: "two",
        label: "Two-term limit",
        blurb: "Two terms in office, consecutive or otherwise.",
        pc: 8,
        fac: { urban: 2 },
      },
      {
        id: "three",
        label: "Three-term limit",
        blurb: "A looser cap that still forecloses a permanent incumbency.",
        pc: 6,
        fac: { patriots: 1, urban: 1 },
      },
    ],
  },
  {
    id: "judicialImmunity",
    name: "Head-of-state judicial immunity",
    menu: "state",
    cat: "Head of State",
    options: [
      {
        id: "total",
        label: "Total immunity in office",
        blurb: "No criminal or civil process reaches the office while held.",
        pc: 16,
        fac: { patriots: 2, urban: -6, business: 1 },
        imp: { lib: -4, cri: -1 },
      },
      {
        id: "partial",
        label: "Partial immunity",
        blurb: "Immunity from civil suit, but not from criminal prosecution.",
        pc: 8,
        fac: { urban: 1 },
      },
      {
        id: "none",
        label: "No immunity",
        blurb: "The office is answerable to the courts like any other.",
        pc: 10,
        fac: { urban: 5, workers: 2, patriots: -3 },
        imp: { lib: 4 },
      },
    ],
  },
  {
    id: "partyPluralism",
    name: "Political party pluralism",
    menu: "state",
    cat: "Political Parties",
    options: [
      {
        id: "multiParty",
        label: "Multi-party pluralism",
        blurb: "Any party may register, campaign and stand for office.",
        pc: 10,
        fac: { urban: 4, business: 1 },
        imp: { lib: 3 },
      },
      {
        id: "singleParty",
        label: "Single-party rule",
        blurb: "One party governs; others may exist but not contest power.",
        pc: 26,
        fac: { patriots: 4, urban: -10, workers: -3 },
        imp: { lib: -6, cri: -1 },
      },
      {
        id: "banned",
        label: "All opposition banned",
        blurb: "No party but the ruling apparatus may organise at all.",
        pc: 34,
        fac: { patriots: 2, urban: -14, business: -2 },
        imp: { lib: -10, cri: -2 },
      },
    ],
  },
  {
    id: "extremistLegality",
    name: "Legality of extremist parties",
    menu: "state",
    cat: "Political Parties",
    options: [
      {
        id: "legal",
        label: "Extremist parties legal",
        blurb: "No party is proscribed on the basis of its programme alone.",
        pc: 8,
        fac: { patriots: 1, urban: -1 },
        imp: { lib: 1 },
      },
      {
        id: "banned",
        label: "Extremist parties banned",
        blurb: "Parties advocating violence or the abolition of the constitution are proscribed.",
        pc: 10,
        fac: { urban: 2 },
        imp: { lib: -1, cri: -1 },
      },
    ],
  },
  {
    id: "parliamentaryPowers",
    name: "Parliamentary powers",
    menu: "state",
    cat: "Parliament",
    options: [
      {
        id: "sovereign",
        label: "Sovereign parliament",
        blurb: "Parliament can make or unmake any law, including the executive's budget.",
        pc: 14,
        fac: { urban: 4, workers: 2, patriots: -2 },
        imp: { lib: 2 },
      },
      {
        id: "consultative",
        label: "Consultative assembly",
        blurb: "An assembly is heard but the executive is not bound by its vote.",
        pc: 10,
        fac: { patriots: 2, urban: -4 },
        imp: { lib: -2 },
      },
      {
        id: "suppressed",
        label: "Parliament suppressed",
        blurb: "No standing legislature checks the executive.",
        pc: 28,
        fac: { patriots: 1, urban: -9, business: -1 },
        imp: { lib: -6, cri: -1 },
      },
    ],
  },
  {
    id: "assemblyRights",
    name: "Freedom of association & assembly",
    menu: "state",
    cat: "Civil Liberties",
    options: [
      {
        id: "free",
        label: "Free association and assembly",
        blurb: "Citizens may organise, demonstrate and petition without a permit regime.",
        pc: 8,
        fac: { urban: 4, workers: 2 },
        imp: { lib: 3 },
      },
      {
        id: "restricted",
        label: "Restricted association and assembly",
        blurb: "Gatherings require a permit and may be refused at the state's discretion.",
        pc: 10,
        fac: { patriots: 2, urban: -4 },
        imp: { lib: -3, cri: -1 },
      },
      {
        id: "banned",
        label: "Association and assembly banned",
        blurb: "Public gatherings and independent civic organisation are prohibited.",
        pc: 20,
        fac: { patriots: 1, urban: -8 },
        imp: { lib: -7, cri: -2 },
      },
    ],
  },
  {
    id: "strikeLegality",
    name: "Legality of strikes",
    menu: "state",
    cat: "Civil Liberties",
    options: [
      {
        id: "protected",
        label: "Right to strike protected",
        blurb: "Lawful industrial action cannot be enjoined or penalised.",
        pc: 10,
        fac: { workers: 5, business: -3 },
        imp: { lib: 2 },
        ch: { ucost: 0.02 },
      },
      {
        id: "restricted",
        label: "Strikes restricted",
        blurb: "A cooling-off period and ballot threshold apply before action is lawful.",
        pc: 8,
        fac: { business: 2, workers: -1 },
      },
      {
        id: "banned",
        label: "Strikes banned",
        blurb: "Industrial action is unlawful outright.",
        pc: 18,
        fac: { business: 4, workers: -6, patriots: 1 },
        imp: { lib: -3 },
        ch: { ucost: -0.02 },
      },
    ],
  },
  {
    id: "votingSystem",
    name: "Electoral voting system",
    menu: "state",
    cat: "Electoral System",
    options: [
      {
        id: "proportional",
        label: "Proportional representation",
        blurb: "Seats track vote share; smaller parties can win representation.",
        pc: 14,
        fac: { urban: 3, rural: -1 },
        imp: { lib: 1 },
      },
      {
        id: "majoritySingle",
        label: "Majority, single-member",
        blurb: "First-past-the-post in single-member constituencies.",
        pc: 10,
        fac: { patriots: 1, rural: 1 },
      },
      {
        id: "majorityTwoRound",
        label: "Majority, two-round",
        blurb: "A runoff between the leading candidates if no one clears a majority.",
        pc: 10,
        fac: { rural: 1, urban: 1 },
      },
    ],
  },
  {
    id: "territorialStructure",
    name: "Territorial structure",
    menu: "state",
    cat: "Regional Sovereignty",
    options: [
      {
        id: "unitary",
        label: "Unitary state",
        blurb: "One national government holds sovereign authority; regions administer, not legislate.",
        pc: 10,
        fac: { patriots: 2, urban: 1 },
      },
      {
        id: "federal",
        label: "Federal system",
        blurb: "Constituent states or provinces hold their own constitutional powers.",
        pc: 18,
        fac: { rural: 3, urban: 1, patriots: -1 },
      },
      {
        id: "confederate",
        label: "Confederation",
        blurb: "A loose union of largely sovereign members, bound by treaty rather than a single constitution.",
        pc: 24,
        fac: { rural: 5, patriots: -4, business: -2 },
        imp: { open: 0.3 },
      },
    ],
  },
  {
    id: "unionLegality",
    name: "Trade union legality",
    menu: "labor",
    cat: "Workplace Association",
    options: [
      {
        id: "banned",
        label: "Trade unions banned",
        blurb: "No independent labour organisation may bargain collectively.",
        pc: 26,
        fac: { business: 6, workers: -10, patriots: 1 },
        imp: { lib: -3, cri: -1 },
        ch: { ucost: -0.03 },
      },
      {
        id: "restricted",
        label: "Unions restricted",
        blurb: "Unions may organise but face tight limits on recognition and action.",
        pc: 14,
        fac: { business: 2, workers: -3 },
      },
      {
        id: "legal",
        label: "Unions legal",
        blurb: "Workers may organise and bargain collectively without special restriction.",
        pc: 6,
        fac: { workers: 4, business: -1 },
        imp: { lib: 1 },
      },
      {
        id: "mandatorySectoral",
        label: "Mandatory sectoral bargaining",
        blurb: "Pay and conditions are set by sector-wide agreement, binding every employer.",
        pc: 16,
        fac: { workers: 8, business: -6 },
        imp: { gini: -1 },
        ch: { ucost: 0.03 },
      },
    ],
  },
  {
    id: "boardRepresentation",
    name: "Employee board representation",
    menu: "labor",
    cat: "Workplace Association",
    options: [
      {
        id: "none",
        label: "No board seats",
        blurb: "Employees have no statutory seat at board level.",
        pc: 4,
        fac: { business: 2 },
      },
      {
        id: "consultative",
        label: "Consultative works council",
        blurb: "A works council is consulted on major decisions but does not vote.",
        pc: 8,
        fac: { workers: 2, business: -1 },
      },
      {
        id: "binding",
        label: "Binding board representation",
        blurb: "Elected employee representatives hold voting board seats.",
        pc: 14,
        fac: { workers: 6, business: -5 },
        imp: { gini: -0.5 },
      },
    ],
  },
  {
    id: "informalEnforcement",
    name: "Informal work enforcement",
    menu: "labor",
    cat: "Workplace Association",
    options: [
      {
        id: "light",
        label: "Light-touch enforcement",
        blurb: "Undeclared work is rarely pursued outright.",
        pc: 4,
        fac: { business: 1 },
        imp: { eva: 1, blk: 1 },
      },
      {
        id: "standard",
        label: "Standard enforcement",
        blurb: "Ordinary inspection and penalty regime.",
        pc: 6,
      },
      {
        id: "strict",
        label: "Strict enforcement",
        blurb: "Active investigation and heavy penalties for undeclared work.",
        pc: 10,
        fac: { workers: 2, business: -2 },
        imp: { eva: -1.5, blk: -1.5 },
      },
    ],
  },
  {
    id: "pensionIndexing",
    name: "Pension indexing model",
    menu: "labor",
    cat: "Retirement",
    options: [
      {
        id: "cpi",
        label: "Linked to inflation",
        blurb: "The state pension rises with CPI each year.",
        pc: 6,
        fac: { pensioners: 2 },
      },
      {
        id: "wages",
        label: "Linked to wage growth",
        blurb: "The state pension tracks average earnings, which usually outpaces prices.",
        pc: 10,
        fac: { pensioners: 5, workers: -1 },
      },
      {
        id: "discretionary",
        label: "Discretionary, set annually",
        blurb: "No standing formula; the uprating is decided budget by budget.",
        pc: 4,
        fac: { pensioners: -3 },
      },
    ],
  },
];

export const LAW_GROUP_BY_ID: Record<string, LawGroup> = Object.fromEntries(
  LAW_GROUPS.map((g) => [g.id, g]),
);
