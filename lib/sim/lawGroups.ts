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
        blurb:
          "Parties advocating violence or the abolition of the constitution are proscribed.",
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
        blurb:
          "Parliament can make or unmake any law, including the executive's budget.",
        pc: 14,
        fac: { urban: 4, workers: 2, patriots: -2 },
        imp: { lib: 2 },
      },
      {
        id: "consultative",
        label: "Consultative assembly",
        blurb:
          "An assembly is heard but the executive is not bound by its vote.",
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
    menu: "rights",
    cat: "Civil Liberties",
    options: [
      {
        id: "free",
        label: "Free association and assembly",
        blurb:
          "Citizens may organise, demonstrate and petition without a permit regime.",
        pc: 8,
        fac: { urban: 4, workers: 2 },
        imp: { lib: 3 },
      },
      {
        id: "restricted",
        label: "Restricted association and assembly",
        blurb:
          "Gatherings require a permit and may be refused at the state's discretion.",
        pc: 10,
        fac: { patriots: 2, urban: -4 },
        imp: { lib: -3, cri: -1 },
      },
      {
        id: "banned",
        label: "Association and assembly banned",
        blurb:
          "Public gatherings and independent civic organisation are prohibited.",
        pc: 20,
        fac: { patriots: 1, urban: -8 },
        imp: { lib: -7, cri: -2 },
      },
    ],
  },
  {
    id: "strikeLegality",
    name: "Legality of strikes",
    menu: "rights",
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
        blurb:
          "A cooling-off period and ballot threshold apply before action is lawful.",
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
        blurb:
          "Seats track vote share; smaller parties can win representation.",
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
        blurb:
          "A runoff between the leading candidates if no one clears a majority.",
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
        blurb:
          "One national government holds sovereign authority; regions administer, not legislate.",
        pc: 10,
        fac: { patriots: 2, urban: 1 },
      },
      {
        id: "federal",
        label: "Federal system",
        blurb:
          "Constituent states or provinces hold their own constitutional powers.",
        pc: 18,
        fac: { rural: 3, urban: 1, patriots: -1 },
      },
      {
        id: "confederate",
        label: "Confederation",
        blurb:
          "A loose union of largely sovereign members, bound by treaty rather than a single constitution.",
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
        blurb:
          "Unions may organise but face tight limits on recognition and action.",
        pc: 14,
        fac: { business: 2, workers: -3 },
      },
      {
        id: "legal",
        label: "Unions legal",
        blurb:
          "Workers may organise and bargain collectively without special restriction.",
        pc: 6,
        fac: { workers: 4, business: -1 },
        imp: { lib: 1 },
      },
      {
        id: "mandatorySectoral",
        label: "Mandatory sectoral bargaining",
        blurb:
          "Pay and conditions are set by sector-wide agreement, binding every employer.",
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
        blurb:
          "A works council is consulted on major decisions but does not vote.",
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
        blurb:
          "The state pension tracks average earnings, which usually outpaces prices.",
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
  {
    id: "abortion",
    name: "Abortion law",
    menu: "rights",
    cat: "Family & Bioethics",
    options: [
      {
        id: "forbidden",
        label: "Forbidden",
        blurb: "Abortion is a criminal offence with no general exception.",
        pc: 28,
        imp: { lib: -6, hlt: 1.2 },
        fac: { patriots: 6, rural: 3, urban: -8, workers: -2 },
      },
      {
        id: "restricted",
        label: "Allowed under conditions",
        blurb:
          "Permitted for medical necessity, fetal abnormality or sexual assault, within a gestational limit.",
        pc: 10,
        imp: { lib: -1 },
        fac: { patriots: 1, urban: -1 },
      },
      {
        id: "onDemand",
        label: "Allowed on request",
        blurb: "Available on request up to a statutory gestational limit.",
        pc: 14,
        imp: { lib: 5, hlt: -0.6 },
        fac: { urban: 6, workers: 2, patriots: -5, rural: -2 },
      },
    ],
  },
  {
    id: "sameSexMarriage",
    name: "Same-sex marriage",
    menu: "rights",
    cat: "Family & Bioethics",
    options: [
      {
        id: "banned",
        label: "Banned",
        blurb:
          "Marriage is defined as between a man and a woman; no equivalent status exists.",
        pc: 12,
        imp: { lib: -5 },
        fac: { patriots: 4, urban: -6 },
      },
      {
        id: "civilUnion",
        label: "Civil unions only",
        blurb:
          "Same-sex couples may register a civil union with most but not all of marriage's legal rights.",
        pc: 8,
        imp: { lib: 0 },
        fac: { urban: 2, patriots: -1 },
      },
      {
        id: "legal",
        label: "Legal marriage",
        blurb:
          "Same-sex couples may marry on the same legal terms as anyone else.",
        pc: 16,
        imp: { lib: 5 },
        fac: { urban: 6, patriots: -5 },
      },
    ],
  },
  {
    id: "euthanasia",
    name: "Assisted dying",
    menu: "rights",
    cat: "Family & Bioethics",
    options: [
      {
        id: "illegal",
        label: "Illegal",
        blurb: "Assisting a death is a criminal offence in all circumstances.",
        pc: 10,
        imp: { lib: -4 },
        fac: { patriots: 3, pensioners: -1 },
      },
      {
        id: "passiveOnly",
        label: "Passive withdrawal only",
        blurb:
          "Life-sustaining treatment may be withdrawn on request; active assistance remains illegal.",
        pc: 6,
        imp: { lib: 0 },
        fac: {},
      },
      {
        id: "assistedLegal",
        label: "Assisted dying legal",
        blurb:
          "A terminally ill adult may request medical assistance to end their life, under safeguards.",
        pc: 18,
        imp: { lib: 4 },
        fac: { urban: 4, pensioners: 2, patriots: -3 },
      },
    ],
  },
  {
    id: "transRecognition",
    name: "Transgender legal recognition",
    menu: "rights",
    cat: "Family & Bioethics",
    options: [
      {
        id: "unrecognised",
        label: "Not legally recognised",
        blurb:
          "The law records only the sex assigned at birth; no process changes it.",
        pc: 14,
        imp: { lib: -5 },
        fac: { patriots: 3, urban: -5 },
      },
      {
        id: "medicalGatekept",
        label: "Medical panel required",
        blurb:
          "Legal gender may be changed after diagnosis and review by a medical panel.",
        pc: 6,
        imp: { lib: 0 },
        fac: {},
      },
      {
        id: "selfId",
        label: "Self-identification",
        blurb:
          "An adult may change their legal gender by statutory declaration, without a medical process.",
        pc: 22,
        imp: { lib: 5 },
        fac: { urban: 5, patriots: -6 },
      },
    ],
  },
  {
    id: "surrogacy",
    name: "Surrogacy law",
    menu: "rights",
    cat: "Family & Bioethics",
    options: [
      {
        id: "banned",
        label: "Banned",
        blurb:
          "Surrogacy arrangements of any kind are unenforceable and unlawful to broker.",
        pc: 8,
        imp: { lib: -3 },
        fac: { patriots: 2 },
      },
      {
        id: "altruisticOnly",
        label: "Altruistic only",
        blurb: "Unpaid surrogacy is permitted; commercial brokerage is not.",
        pc: 6,
        imp: { lib: 0 },
        fac: {},
      },
      {
        id: "commercial",
        label: "Commercial surrogacy permitted",
        blurb: "Licensed clinics may broker paid surrogacy arrangements.",
        pc: 16,
        imp: { lib: 3 },
        fac: { business: 4, patriots: -2, rural: -2 },
      },
    ],
  },
  {
    id: "pressFreedom",
    name: "Press freedom",
    menu: "rights",
    cat: "Media & Speech",
    options: [
      {
        id: "free",
        label: "Free press",
        blurb:
          "No licensing or prior restraint on news publication; editorial decisions are the outlet's own.",
        pc: 10,
        imp: { lib: 8 },
        fac: { urban: 3, patriots: -2 },
      },
      {
        id: "restricted",
        label: "Restricted",
        blurb:
          "Outlets are licensed and subject to a statutory code enforced by a state regulator.",
        pc: 16,
        imp: { lib: 0 },
        fac: { patriots: 3 },
      },
      {
        id: "stateControlled",
        label: "State-controlled",
        blurb:
          "Major news outlets are state-owned or editorially directed by the government.",
        pc: 30,
        imp: { lib: -8 },
        fac: { patriots: 7, business: -6, urban: -10 },
      },
    ],
  },
  {
    id: "internetCensorship",
    name: "Internet censorship",
    menu: "rights",
    cat: "Media & Speech",
    options: [
      {
        id: "none",
        label: "Unfiltered",
        blurb: "No state filtering of internet content or services.",
        pc: 8,
        imp: { lib: 6 },
        fac: { urban: 2 },
      },
      {
        id: "filtered",
        label: "Filtered",
        blurb:
          "Specific categories of content are blocked at the network level.",
        pc: 14,
        imp: { lib: 0 },
        fac: { patriots: 2 },
      },
      {
        id: "firewall",
        label: "National firewall",
        blurb:
          "Foreign platforms are blocked by default and traffic is filtered at the border.",
        pc: 26,
        imp: { lib: -6 },
        ch: { tfp: -0.05 },
        fac: { patriots: 6, urban: -8 },
      },
    ],
  },
  {
    id: "blasphemyLaw",
    name: "Blasphemy and defamation",
    menu: "rights",
    cat: "Media & Speech",
    options: [
      {
        id: "none",
        label: "No blasphemy law",
        blurb: "Neither blasphemy nor insulting a religion is a legal offence.",
        pc: 6,
        imp: { lib: 4 },
        fac: {},
      },
      {
        id: "civilDefamation",
        label: "Civil defamation only",
        blurb:
          "Religious insult can found a civil claim but carries no criminal penalty.",
        pc: 8,
        imp: { lib: 0 },
        fac: { patriots: 1 },
      },
      {
        id: "criminal",
        label: "Criminal blasphemy",
        blurb: "Insulting a recognised religion is a criminal offence.",
        pc: 18,
        imp: { lib: -4 },
        fac: { patriots: 4, pensioners: 2, urban: -4 },
      },
    ],
  },
  {
    id: "gunOwnership",
    name: "Civilian gun ownership",
    menu: "rights",
    cat: "Weapons",
    options: [
      {
        id: "banned",
        label: "Total ban",
        blurb:
          "Private citizens may not own firearms outside narrow sporting exemptions.",
        pc: 16,
        imp: { lib: -4, cri: -2 },
        fac: { urban: 3, rural: -4 },
      },
      {
        id: "licensed",
        label: "Licensed ownership",
        blurb:
          "Ownership requires a licence, background checks and secure storage.",
        pc: 8,
        imp: { lib: 0 },
        fac: {},
      },
      {
        id: "openCarry",
        label: "Open and concealed carry",
        blurb: "Licensed owners may carry openly or concealed in public.",
        pc: 20,
        imp: { lib: 4, cri: 2 },
        fac: { rural: 6, patriots: 5, urban: -4 },
      },
    ],
  },
  {
    id: "religiousDress",
    name: "Religious dress in public",
    menu: "rights",
    cat: "Religious Affairs",
    options: [
      {
        id: "unrestricted",
        label: "Unrestricted",
        blurb:
          "No law governs religious dress in public or in public institutions.",
        pc: 8,
        imp: { lib: 5 },
        fac: { urban: 2, patriots: -1 },
      },
      {
        id: "restrictedInInstitutions",
        label: "Restricted in institutions",
        blurb:
          "Face-covering and overt religious dress are restricted for staff and students in public institutions.",
        pc: 12,
        imp: { lib: 0 },
        fac: { patriots: 2 },
      },
      {
        id: "bannedInPublic",
        label: "Banned in public",
        blurb:
          "Face-covering religious dress may not be worn in any public place.",
        pc: 22,
        imp: { lib: -5 },
        fac: { patriots: 5, urban: -7 },
      },
    ],
  },
  {
    id: "religionTaxStatus",
    name: "Religious organisation tax status",
    menu: "rights",
    cat: "Religious Affairs",
    options: [
      {
        id: "noSpecialStatus",
        label: "No special status",
        blurb:
          "Religious organisations are taxed on the same terms as any other body.",
        pc: 6,
        imp: {},
        fac: { patriots: -2 },
      },
      {
        id: "exemptRegistered",
        label: "Registered orgs exempt",
        blurb:
          "Registered religious charities are exempt from tax on donations and worship property.",
        pc: 8,
        imp: {},
        fac: {},
      },
      {
        id: "stateFunded",
        label: "Established church, state-funded",
        blurb:
          "A designated state religion receives direct public funding alongside its tax exemption.",
        pc: 16,
        imp: { rev: -0.15 },
        fac: { patriots: 4, rural: 2, urban: -2 },
      },
    ],
  },
  {
    id: "deathPenalty",
    name: "Capital punishment",
    menu: "justice",
    cat: "Penal Code",
    options: [
      {
        id: "abolished",
        label: "Abolished",
        blurb: "No sentence of death may be passed for any offence.",
        pc: 10,
        imp: { lib: 6 },
        fac: { urban: 3, patriots: -3 },
      },
      {
        id: "retainedRare",
        label: "Retained, rarely used",
        blurb:
          "Available in law for the gravest offences but sentenced only exceptionally.",
        pc: 16,
        imp: { lib: 0 },
        fac: { patriots: 3 },
      },
      {
        id: "retainedStandard",
        label: "Retained, standard sentence",
        blurb: "A standard sentencing option for the most serious offences.",
        pc: 26,
        imp: { lib: -6, cri: -1.5 },
        fac: { patriots: 7, rural: 3, urban: -8 },
      },
    ],
  },
  {
    id: "wiretapPowers",
    name: "Interception powers",
    menu: "justice",
    cat: "Surveillance",
    options: [
      {
        id: "warrantRequired",
        label: "Judicial warrant required",
        blurb:
          "Communications interception needs prior sign-off from a judge or equivalent.",
        pc: 8,
        imp: { lib: 3 },
        fac: {},
      },
      {
        id: "expandedWarrant",
        label: "Expanded executive warrant",
        blurb:
          "A government minister, not a judge, may authorise interception.",
        pc: 14,
        imp: { lib: -3, cri: -0.7 },
        fac: { patriots: 3, urban: -4 },
      },
      {
        id: "warrantless",
        label: "Warrantless authority",
        blurb:
          "Agencies may intercept communications without prior authorisation.",
        pc: 24,
        imp: { lib: -7, cri: -1.5 },
        fac: { patriots: 6, urban: -9 },
      },
    ],
  },
  {
    id: "biometricId",
    name: "Biometric identification",
    menu: "justice",
    cat: "Surveillance",
    options: [
      {
        id: "none",
        label: "Not deployed",
        blurb:
          "No biometric identification or facial recognition database exists.",
        pc: 8,
        imp: { lib: 3 },
        fac: {},
      },
      {
        id: "limitedToCrime",
        label: "Limited to serious crime",
        blurb:
          "Facial recognition matching is authorised only against a watchlist for serious offences.",
        pc: 12,
        imp: { lib: 0 },
        fac: {},
      },
      {
        id: "mass",
        label: "Mass deployment",
        blurb:
          "Facial recognition runs continuously across public spaces and public services.",
        pc: 22,
        imp: { lib: -6, cri: -1.2 },
        fac: { patriots: 5, business: 2, urban: -7 },
      },
    ],
  },
  {
    id: "socialCredit",
    name: "Citizen scoring system",
    menu: "justice",
    cat: "Surveillance",
    options: [
      {
        id: "none",
        label: "None",
        blurb: "No centralised system scores citizens' conduct.",
        pc: 6,
        imp: { lib: 4 },
        fac: {},
      },
      {
        id: "pilot",
        label: "Regional pilot",
        blurb:
          "A limited pilot links administrative records to a conduct score in select regions.",
        pc: 16,
        imp: { lib: -3 },
        fac: { patriots: 3, urban: -4 },
      },
      {
        id: "national",
        label: "National system",
        blurb:
          "A single national score links access to services and travel to conduct records.",
        pc: 30,
        imp: { lib: -9, open: -2 },
        fac: { patriots: 8, business: -3, urban: -10 },
      },
    ],
  },
  {
    id: "asylumPolicy",
    name: "Asylum policy",
    menu: "state",
    cat: "Borders & Immigration",
    options: [
      {
        id: "minimalQuota",
        label: "Minimal quota",
        blurb:
          "Asylum claims are accepted only in the smallest numbers required by treaty obligation.",
        pc: 14,
        imp: {},
        fac: { patriots: 7, business: -4 },
      },
      {
        id: "standardProcessing",
        label: "Standard processing",
        blurb:
          "Claims are assessed individually against the normal refugee test.",
        pc: 8,
        imp: {},
        fac: {},
      },
      {
        id: "generousQuota",
        label: "Generous quota",
        blurb:
          "An expanded annual resettlement quota accepts claims well beyond treaty minimums.",
        pc: 18,
        imp: {},
        fac: { workers: 3, urban: 3, patriots: -8 },
      },
    ],
  },
  {
    id: "familyReunification",
    name: "Family reunification",
    menu: "state",
    cat: "Borders & Immigration",
    options: [
      {
        id: "restricted",
        label: "Restricted",
        blurb:
          "Only a spouse and minor children may join a settled resident, subject to an income test.",
        pc: 10,
        imp: {},
        fac: { patriots: 4 },
      },
      {
        id: "standard",
        label: "Standard",
        blurb:
          "Immediate family may join a settled resident under the ordinary rules.",
        pc: 6,
        imp: {},
        fac: {},
      },
      {
        id: "expedited",
        label: "Expedited",
        blurb:
          "Family reunification applications are fast-tracked and the eligible family is broader.",
        pc: 14,
        imp: {},
        fac: { urban: 3, patriots: -5 },
      },
    ],
  },
  {
    id: "citizenshipPath",
    name: "Path to citizenship",
    menu: "state",
    cat: "Borders & Immigration",
    options: [
      {
        id: "strictTestAndResidency",
        label: "Strict test and residency",
        blurb:
          "Naturalisation requires an extended residency period, a language test and a civics exam.",
        pc: 12,
        imp: {},
        fac: { patriots: 6, rural: 2 },
      },
      {
        id: "standardNaturalisation",
        label: "Standard naturalisation",
        blurb:
          "A standard residency period, language requirement and civics test apply.",
        pc: 6,
        imp: {},
        fac: {},
      },
      {
        id: "fastTrack",
        label: "Fast-track",
        blurb:
          "A shortened residency period and a simplified test open the path to citizenship.",
        pc: 18,
        imp: {},
        fac: { business: 3, urban: 3, patriots: -7 },
      },
    ],
  },
];

export const LAW_GROUP_BY_ID: Record<string, LawGroup> = Object.fromEntries(
  LAW_GROUPS.map((g) => [g.id, g]),
);
