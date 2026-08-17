/**
 * Parties, chamber votes, and election seat allocation.
 *
 * Pure: no live game state `G`. Engine glue (seeding, enact gates, term
 * review, popularity drift) lives in engine.ts. Party taste is derived from
 * the same faction `fac` bags taxes/policies/vice already carry — there is
 * no second authored stance table.
 */
import type {
  FactionEffects,
  FactionId,
  Party,
  PartyId,
  PartyStanceKind,
} from "./types.ts";
import {
  DEPTS,
  DEAL_BY_ID,
  DEF_CHILDCARE,
  DEF_ELECTORAL,
  DEF_MIN_WAGE,
  DEF_PENSION,
  DEF_WORK_HOURS,
  FACTIONS,
  MISSION_BY_ID,
  POLICIES,
  POLICY_BY_ID,
  POLITY_LADDER,
  TAXES,
  TAX_BY_ID,
  VICE,
  VICE_BY_ID,
} from "./statuteBook.ts";
import { LAW_GROUPS, LAW_GROUP_BY_ID } from "./lawGroups.ts";

export const CHAMBER_SEATS = 100;
export const PR_THRESHOLD = 0.04;

const FAC_IDS: FactionId[] = [
  "business",
  "workers",
  "pensioners",
  "urban",
  "rural",
  "patriots",
];

export const PARTIES = [
  {
    id: "social",
    name: "Civic Labour",
    short: "Labour",
    color: "#FF5A4E",
    ideology: {
      workers: 0.4,
      urban: 0.28,
      pensioners: 0.18,
      rural: 0.06,
      business: 0.05,
      patriots: 0.03,
    },
  },
  {
    id: "liberal",
    name: "Open Alliance",
    short: "Alliance",
    color: "#3DDC84",
    ideology: {
      urban: 0.42,
      business: 0.28,
      workers: 0.12,
      pensioners: 0.08,
      patriots: 0.05,
      rural: 0.05,
    },
  },
  {
    id: "conservative",
    name: "National Conservatives",
    short: "Conservatives",
    color: "#6BA3D4",
    ideology: {
      business: 0.28,
      rural: 0.24,
      pensioners: 0.22,
      patriots: 0.16,
      workers: 0.06,
      urban: 0.04,
    },
  },
  {
    id: "national",
    name: "Patriotic Union",
    short: "Union",
    color: "#B894F0",
    ideology: {
      patriots: 0.48,
      rural: 0.26,
      pensioners: 0.12,
      business: 0.08,
      workers: 0.04,
      urban: 0.02,
    },
  },
  {
    id: "agrarian",
    name: "Country League",
    short: "Country",
    color: "#E8A838",
    ideology: {
      rural: 0.48,
      pensioners: 0.26,
      workers: 0.1,
      patriots: 0.1,
      business: 0.04,
      urban: 0.02,
    },
  },
] as const satisfies Party[];

export type { PartyId, PartyStanceKind, Party };

export const PARTY_BY_ID = Object.fromEntries(
  PARTIES.map((p) => [p.id, p]),
) as Record<PartyId, Party>;

export const PARTY_IDS = PARTIES.map((p) => p.id) as PartyId[];

/** Left-to-right order on the chamber diagram (ideology, not seat size). */
export const PARTY_ARC_ORDER: PartyId[] = [
  "social",
  "liberal",
  "agrarian",
  "conservative",
  "national",
];

export type PartyLabel = {
  name: string;
  short: string;
  color?: string;
};

export type PartyOverlay = {
  labels: Record<PartyId, PartyLabel>;
  rulingId: PartyId;
  /** Lower-house share scaled to 100. Omit to use the constitution layout. */
  seats?: Record<PartyId, number>;
  partyPluralism?: "multiParty" | "singleParty" | "banned";
  parliamentaryPowers?: "sovereign" | "consultative" | "suppressed";
  /** `flexible` = snap elections; `fixed` = presidential-style calendar. */
  electionCalendar?: "flexible" | "fixed";
  votingSystem?: "majoritySingle" | "proportional" | "majorityTwoRound";
  /** Head-of-government title when the constitution does not already imply
   *  one (presidential calendar → President; hereditary autocracy → Monarch).
   *  Germany's Chancellor and South Africa's President live here. */
  office?:
    | "Prime Minister"
    | "President"
    | "Chancellor"
    | "Monarch"
    | "General Secretary";
};

/** United-front window dressing before fold: 90 for the apparatus, 10 among the rest. */
const UNITED_FRONT_SEATS: Record<PartyId, number> = {
  national: 90,
  social: 3,
  conservative: 3,
  liberal: 2,
  agrarian: 2,
};

const BANNED_SEATS: Record<PartyId, number> = {
  national: 100,
  social: 0,
  conservative: 0,
  liberal: 0,
  agrarian: 0,
};

function L(name: string, short: string, color: string): PartyLabel {
  return { name, short, color };
}

/** Caucuses of this size or smaller are dropped from the opening chamber. */
const MINOR_CAUCUS = 5;

function blankSeats(): Record<PartyId, number> {
  return { social: 0, liberal: 0, conservative: 0, national: 0, agrarian: 0 };
}

/** Hamilton apportionment of `house` seats from positive weights. */
function hamiltonApportion(
  weights: Record<PartyId, number>,
  total: number,
  house = CHAMBER_SEATS,
): Record<PartyId, number> {
  const out = blankSeats();
  if (total <= 0) return out;
  const rems: { id: PartyId; rem: number }[] = [];
  let used = 0;
  for (const id of PARTY_IDS) {
    const w = weights[id] || 0;
    if (w <= 0) continue;
    const exact = (w / total) * house;
    const floor = Math.floor(exact);
    out[id] = floor;
    used += floor;
    rems.push({ id, rem: exact - floor });
  }
  rems.sort((a, b) => b.rem - a.rem || a.id.localeCompare(b.id));
  for (let i = 0; i < rems.length && used < house; i++) {
    out[rems[i].id]++;
    used++;
  }
  return out;
}

/**
 * Drop 1–5 seat splinters and rescale the rest to 100. Does not invent a
 * majority the ruling party did not already have — leftover seats go to the
 * largest remaining opposition instead.
 */
function foldMinorSeats(
  seats: Partial<Record<PartyId, number>>,
  rulingId: PartyId,
): Record<PartyId, number> {
  const kept = blankSeats();
  let tot = 0;
  for (const id of PARTY_IDS) {
    const n = Math.max(0, seats[id] || 0);
    if (n > MINOR_CAUCUS) {
      kept[id] = n;
      tot += n;
    }
  }
  if (tot <= 0) {
    const out = blankSeats();
    out[rulingId] = CHAMBER_SEATS;
    return out;
  }
  if (tot === CHAMBER_SEATS) return kept;
  const ruling0 = seats[rulingId] || 0;
  const ham = hamiltonApportion(kept, tot);
  if (ruling0 < 51 && (ham[rulingId] || 0) >= 51) {
    const leftover = CHAMBER_SEATS - tot;
    const out = { ...kept };
    let opp: PartyId | null = null;
    for (const id of PARTY_IDS) {
      if (id === rulingId || !(out[id] > 0)) continue;
      if (opp == null || out[id] > out[opp]) opp = id;
    }
    out[opp || rulingId] += leftover;
    return out;
  }
  return ham;
}

/**
 * Per-seat names, colours, ruling party and opening seats. Snapshot August 2026.
 * Five families cannot match every chamber; junior coalition partners and
 * regional residuals fold into the nearest family. Seats are the named party's
 * own share, not the whole coalition — a grand coalition still leaves the
 * chancellor's party short of 51. Caucuses of 1–5 seats are dropped and the
 * rest rescaled to 100.
 */
export const PARTY_OVERLAYS: Record<string, PartyOverlay> = {
  kingdom: {
    rulingId: "social",
    votingSystem: "majoritySingle",
    /* Commons: Labour 403, Cons 117, LD 71, Reform 7, Greens 5 of 650. */
    seats: foldMinorSeats(
      { social: 62, conservative: 18, liberal: 11, national: 5, agrarian: 4 },
      "social",
    ),
    labels: {
      social: L("Labour", "Labour", "#E4003B"),
      liberal: L("Liberal Democrats", "Lib Dems", "#FAA61A"),
      conservative: L("Conservatives", "Conservatives", "#0087DC"),
      national: L("Reform UK", "Reform", "#12B6CF"),
      agrarian: L("Greens", "Greens", "#6AB023"),
    },
  },
  germany: {
    rulingId: "conservative",
    office: "Chancellor",
    votingSystem: "proportional",
    /* Bundestag 2025: CDU/CSU 208, AfD 152, SPD 120, Greens 85, Left 64 of 630. Merz CDU–SPD coalition. */
    seats: foldMinorSeats(
      { conservative: 33, national: 24, social: 19, agrarian: 13, liberal: 11 },
      "conservative",
    ),
    labels: {
      social: L("SPD", "SPD", "#E3000F"),
      liberal: L("The Left", "Left", "#BE3075"),
      conservative: L("CDU/CSU", "Union", "#161A34"),
      national: L("AfD", "AfD", "#0489DB"),
      agrarian: L("Greens", "Greens", "#64A12D"),
    },
  },
  france: {
    rulingId: "liberal",
    electionCalendar: "fixed",
    votingSystem: "majorityTwoRound",
    /* Assembly 2024 hung, still current: NFP ~32, Ensemble ~29, RN ~25, LR ~8. Macron camp governs without a majority. */
    seats: foldMinorSeats(
      { social: 32, liberal: 29, national: 25, conservative: 8, agrarian: 6 },
      "liberal",
    ),
    labels: {
      social: L("Popular Front", "NFP", "#E81E1E"),
      liberal: L("Ensemble", "Ensemble", "#FFD600"),
      conservative: L("Republicans", "LR", "#2451A3"),
      national: L("National Rally", "RN", "#0D378A"),
      agrarian: L("Ecologists", "Greens", "#00A651"),
    },
  },
  italy: {
    rulingId: "national",
    votingSystem: "majorityTwoRound",
    /* Chamber 2022, Meloni still PM: FdI 119, Lega 66, FI 45, PD 69, M5S 52 of 400. */
    seats: foldMinorSeats(
      { national: 30, agrarian: 17, conservative: 11, social: 22, liberal: 20 },
      "national",
    ),
    labels: {
      social: L("Democratic Party", "PD", "#E31E24"),
      liberal: L("Five Star", "M5S", "#F5B800"),
      conservative: L("Forza Italia", "FI", "#00A2E8"),
      national: L("Brothers of Italy", "FdI", "#0B3B8C"),
      agrarian: L("League", "Lega", "#00A859"),
    },
  },
  spain: {
    rulingId: "social",
    votingSystem: "proportional",
    /* Congress 2023: PP 137, PSOE 121, Vox 33, Sumar 31 of 350. Sánchez minority. */
    seats: foldMinorSeats(
      { conservative: 39, social: 35, national: 9, liberal: 9, agrarian: 8 },
      "social",
    ),
    labels: {
      social: L("PSOE", "PSOE", "#E30613"),
      liberal: L("Sumar", "Sumar", "#E23B70"),
      conservative: L("People's Party", "PP", "#0055A5"),
      national: L("Vox", "Vox", "#63B365"),
      agrarian: L("Regionalists", "ERC", "#FCBD00"),
    },
  },
  netherlands: {
    rulingId: "liberal",
    votingSystem: "proportional",
    /* Jetten D66 minority with VVD and CDA, 66 of 150. PVV and GL-PvdA lead the opposition. */
    seats: foldMinorSeats(
      { social: 28, national: 24, liberal: 22, conservative: 16, agrarian: 10 },
      "liberal",
    ),
    labels: {
      social: L("GroenLinks-PvdA", "GL-PvdA", "#E31E24"),
      liberal: L("D66", "D66", "#00AE41"),
      conservative: L("VVD", "VVD", "#FF6C00"),
      national: L("PVV", "PVV", "#012758"),
      agrarian: L("CDA", "CDA", "#0A8845"),
    },
  },
  poland: {
    rulingId: "liberal",
    votingSystem: "proportional",
    /* Sejm 2023: PiS 194, KO 157, Third Way 65, Left 26, Confederation 18 of 460. Tusk KO-led coalition. */
    seats: foldMinorSeats(
      { national: 42, liberal: 34, agrarian: 14, social: 6, conservative: 4 },
      "liberal",
    ),
    labels: {
      social: L("The Left", "Left", "#AD005B"),
      liberal: L("Civic Coalition", "KO", "#F7D117"),
      conservative: L("Confederation", "Konf.", "#1A1A2E"),
      national: L("Law and Justice", "PiS", "#0033A0"),
      agrarian: L("Third Way", "TD", "#00A651"),
    },
  },
  united_states: {
    rulingId: "conservative",
    electionCalendar: "fixed",
    votingSystem: "majoritySingle",
    /* House as of 2026: Republicans 219, Democrats 213 of 435. Trump GOP. */
    seats: foldMinorSeats(
      { conservative: 51, social: 47, liberal: 1, national: 1, agrarian: 0 },
      "conservative",
    ),
    labels: {
      social: L("Democrats", "Democrats", "#00AEF3"),
      liberal: L("Independents", "Ind.", "#A0A0A0"),
      conservative: L("Republicans", "GOP", "#E81B23"),
      national: L("America First", "AF", "#C4A35A"),
      agrarian: L("Farm Belt", "Farm", "#6B8E23"),
    },
  },
  canada: {
    rulingId: "liberal",
    votingSystem: "majoritySingle",
    /* Commons April 2026: Liberals 174 of 343. Carney majority. */
    seats: foldMinorSeats(
      { liberal: 51, conservative: 42, national: 4, social: 2, agrarian: 1 },
      "liberal",
    ),
    labels: {
      social: L("NDP", "NDP", "#F58220"),
      liberal: L("Liberals", "Liberals", "#D71920"),
      conservative: L("Conservatives", "CPC", "#1A4782"),
      national: L("Bloc Québécois", "Bloc", "#00A7C7"),
      agrarian: L("Greens", "Greens", "#3D9B35"),
    },
  },
  australia: {
    rulingId: "social",
    votingSystem: "majorityTwoRound",
    /* House 2025: Labor 94, Coalition 43, Greens 10 of 150. Albanese. */
    seats: foldMinorSeats(
      { social: 63, conservative: 29, agrarian: 6, liberal: 1, national: 1 },
      "social",
    ),
    labels: {
      social: L("Labor", "Labor", "#E13940"),
      liberal: L("Teals", "Teals", "#00B2A9"),
      conservative: L("Coalition", "Coalition", "#0047AB"),
      national: L("One Nation", "ON", "#FFCD00"),
      agrarian: L("Greens", "Greens", "#009C3B"),
    },
  },
  japan: {
    rulingId: "conservative",
    votingSystem: "majoritySingle",
    /* Lower house Feb 2026: LDP 316 of 465. Takaichi supermajority. */
    seats: foldMinorSeats(
      { conservative: 68, liberal: 11, national: 8, agrarian: 7, social: 6 },
      "conservative",
    ),
    labels: {
      social: L("DPP", "DPP", "#F8C400"),
      liberal: L("Centrist Reform", "CDP", "#004098"),
      conservative: L("LDP", "LDP", "#3C8A2E"),
      national: L("Ishin", "Ishin", "#F08300"),
      agrarian: L("Sanseitō", "Sanseitō", "#7B1FA2"),
    },
  },
  korea: {
    rulingId: "social",
    electionCalendar: "fixed",
    votingSystem: "majoritySingle",
    /* Assembly 2024, President Lee from June 2025: Democrats 175, PPP 108 of 300. */
    seats: foldMinorSeats(
      { social: 58, conservative: 36, liberal: 3, national: 2, agrarian: 1 },
      "social",
    ),
    labels: {
      social: L("Democratic Party", "DP", "#004EA2"),
      liberal: L("Reform Party", "Reform", "#00A0E9"),
      conservative: L("People Power", "PPP", "#E61E2B"),
      national: L("Rebuilding Korea", "RKP", "#5C2D91"),
      agrarian: L("Progressive", "JP", "#E60012"),
    },
  },
  india: {
    rulingId: "national",
    votingSystem: "majoritySingle",
    /* Lok Sabha 2024: NDA 293 (BJP 240), Congress 99 of 543. Modi coalition majority. */
    seats: foldMinorSeats(
      { national: 54, social: 18, agrarian: 12, conservative: 8, liberal: 8 },
      "national",
    ),
    labels: {
      social: L("Congress", "INC", "#00B5E2"),
      liberal: L("AAP", "AAP", "#0072BC"),
      conservative: L("TDP", "TDP", "#FCEE23"),
      national: L("BJP", "BJP", "#FF9933"),
      agrarian: L("Regional", "SP", "#008000"),
    },
  },
  brazil: {
    rulingId: "social",
    electionCalendar: "fixed",
    votingSystem: "proportional",
    /* Chamber 2026: PT federation 81, PL 97 of 513. Lula, no solo majority. */
    seats: foldMinorSeats(
      { conservative: 28, liberal: 22, national: 19, social: 16, agrarian: 15 },
      "social",
    ),
    labels: {
      social: L("Workers' Party", "PT", "#E30613"),
      liberal: L("MDB", "MDB", "#00923F"),
      conservative: L("União", "União", "#0A5C2E"),
      national: L("Liberal Party", "PL", "#0D47A1"),
      agrarian: L("Progressistas", "PP", "#0033A0"),
    },
  },
  mexico: {
    rulingId: "social",
    electionCalendar: "fixed",
    votingSystem: "majoritySingle",
    /* Deputies 2024: Morena coalition 364 of 500. Sheinbaum supermajority. */
    seats: foldMinorSeats(
      { social: 73, conservative: 15, liberal: 8, national: 2, agrarian: 2 },
      "social",
    ),
    labels: {
      social: L("Morena", "Morena", "#B3282D"),
      liberal: L("Citizens' Movement", "MC", "#F58220"),
      conservative: L("PAN", "PAN", "#0055A5"),
      national: L("PRI", "PRI", "#E31E24"),
      agrarian: L("PVEM", "Greens", "#00A651"),
    },
  },
  indonesia: {
    rulingId: "national",
    electionCalendar: "fixed",
    votingSystem: "proportional",
    /* Prabowo Gerindra-led Advanced Indonesia Coalition, large majority. */
    seats: foldMinorSeats(
      { national: 55, social: 20, conservative: 12, liberal: 8, agrarian: 5 },
      "national",
    ),
    labels: {
      social: L("PDI-P", "PDI-P", "#D21034"),
      liberal: L("NasDem", "NasDem", "#0033A0"),
      conservative: L("Golkar", "Golkar", "#F7D117"),
      national: L("Gerindra", "Gerindra", "#C41E3A"),
      agrarian: L("PKB", "PKB", "#00923F"),
    },
  },
  argentina: {
    rulingId: "liberal",
    electionCalendar: "fixed",
    votingSystem: "proportional",
    /* Milei LLA. Peronists the main opposition, PRO the old centre-right. */
    seats: foldMinorSeats(
      { liberal: 40, social: 36, conservative: 16, national: 5, agrarian: 3 },
      "liberal",
    ),
    labels: {
      social: L("Unión por la Patria", "UxP", "#75AADB"),
      liberal: L("Liberty Advances", "LLA", "#8B5CF6"),
      conservative: L("PRO", "PRO", "#F7D117"),
      national: L("UCR", "UCR", "#E31E24"),
      agrarian: L("Federal", "Fed.", "#00A651"),
    },
  },
  nigeria: {
    rulingId: "conservative",
    electionCalendar: "fixed",
    votingSystem: "majoritySingle",
    /* Tinubu APC dominates the National Assembly. */
    seats: foldMinorSeats(
      { conservative: 62, social: 24, liberal: 8, national: 4, agrarian: 2 },
      "conservative",
    ),
    labels: {
      social: L("PDP", "PDP", "#008753"),
      liberal: L("Labour Party", "LP", "#E31E24"),
      conservative: L("APC", "APC", "#00AD57"),
      national: L("NNPP", "NNPP", "#C41E3A"),
      agrarian: L("APGA", "APGA", "#00A651"),
    },
  },
  south_africa: {
    rulingId: "social",
    office: "President",
    votingSystem: "proportional",
    /* Assembly 2024: ANC 159, DA 87, MK 58, EFF 39 of 400. ANC–DA GNU. */
    seats: foldMinorSeats(
      { social: 40, liberal: 22, national: 15, conservative: 13, agrarian: 10 },
      "social",
    ),
    labels: {
      social: L("ANC", "ANC", "#007749"),
      liberal: L("Democratic Alliance", "DA", "#005BA6"),
      conservative: L("IFP", "IFP", "#E31E24"),
      national: L("uMkhonto weSizwe", "MK", "#1B5E20"),
      agrarian: L("EFF", "EFF", "#E31E24"),
    },
  },
  kenya: {
    rulingId: "conservative",
    office: "President",
    votingSystem: "majoritySingle",
    /* Ruto UDA / Kenya Kwanza. ODM the main opposition. */
    seats: foldMinorSeats(
      { conservative: 48, social: 32, liberal: 8, national: 7, agrarian: 5 },
      "conservative",
    ),
    labels: {
      social: L("ODM", "ODM", "#FF6600"),
      liberal: L("Wiper", "Wiper", "#0055A5"),
      conservative: L("UDA", "UDA", "#F7D117"),
      national: L("Jubilee", "Jubilee", "#E31E24"),
      agrarian: L("KANU", "KANU", "#00A651"),
    },
  },
  turkey: {
    rulingId: "national",
    office: "President",
    votingSystem: "proportional",
    /* 2023: AKP+MHP People's Alliance majority. Erdoğan. Hybrid polity. */
    seats: foldMinorSeats(
      { national: 53, social: 28, liberal: 10, conservative: 6, agrarian: 3 },
      "national",
    ),
    labels: {
      social: L("CHP", "CHP", "#E31E24"),
      liberal: L("DEM", "DEM", "#7B1FA2"),
      conservative: L("MHP", "MHP", "#C41E3A"),
      national: L("AKP", "AKP", "#F7D117"),
      agrarian: L("İYİ", "İYİ", "#00A7C7"),
    },
  },
  china: {
    rulingId: "national",
    partyPluralism: "singleParty",
    parliamentaryPowers: "consultative",
    seats: foldMinorSeats(UNITED_FRONT_SEATS, "national"),
    labels: {
      social: L("Democratic League", "CDL", "#C41E3A"),
      liberal: L("Public Interest", "CZGP", "#0055A5"),
      conservative: L("National Construction", "CDNCA", "#1A4782"),
      national: L("Communist Party", "CPC", "#DE2910"),
      agrarian: L("Peasants' Party", "CAPD", "#00A651"),
    },
  },
  russia: {
    rulingId: "national",
    office: "President",
    partyPluralism: "singleParty",
    parliamentaryPowers: "consultative",
    seats: foldMinorSeats(UNITED_FRONT_SEATS, "national"),
    labels: {
      social: L("Communist Party", "CPRF", "#CC0000"),
      liberal: L("New People", "NP", "#00A0E9"),
      conservative: L("LDPR", "LDPR", "#0039A6"),
      national: L("United Russia", "ER", "#0C4499"),
      agrarian: L("A Just Russia", "SRZP", "#F7A800"),
    },
  },
  vietnam: {
    rulingId: "national",
    partyPluralism: "singleParty",
    parliamentaryPowers: "consultative",
    seats: foldMinorSeats(UNITED_FRONT_SEATS, "national"),
    labels: {
      social: L("Fatherland Front", "VFF", "#C41E3A"),
      liberal: L("Independents", "Ind.", "#A0A0A0"),
      conservative: L("Veterans", "VVA", "#1A4782"),
      national: L("Communist Party", "CPV", "#DA251D"),
      agrarian: L("Peasant Union", "VPU", "#00A651"),
    },
  },
  saudi: {
    rulingId: "national",
    partyPluralism: "banned",
    parliamentaryPowers: "suppressed",
    seats: foldMinorSeats(BANNED_SEATS, "national"),
    labels: {
      social: L("Consultative", "Shura", "#C4A35A"),
      liberal: L("Technocrats", "Tech.", "#A0A0A0"),
      conservative: L("Ulema", "Ulema", "#1A4782"),
      national: L("Royal Court", "Court", "#006C35"),
      agrarian: L("Tribal", "Tribal", "#C4A35A"),
    },
  },
  uae: {
    rulingId: "national",
    partyPluralism: "banned",
    parliamentaryPowers: "suppressed",
    seats: foldMinorSeats(BANNED_SEATS, "national"),
    labels: {
      social: L("Federal Council", "FNC", "#C4A35A"),
      liberal: L("Technocrats", "Tech.", "#A0A0A0"),
      conservative: L("Emirates", "Emir.", "#1A4782"),
      national: L("Ruling Families", "Rulers", "#00732F"),
      agrarian: L("Tribes", "Tribes", "#C4A35A"),
    },
  },
  egypt: {
    rulingId: "national",
    office: "President",
    partyPluralism: "singleParty",
    parliamentaryPowers: "consultative",
    seats: foldMinorSeats(UNITED_FRONT_SEATS, "national"),
    labels: {
      social: L("Wafd", "Wafd", "#00A651"),
      liberal: L("Dustour", "Dustour", "#0055A5"),
      conservative: L("Homeland", "HM", "#1A4782"),
      national: L("Nation's Future", "Mostaqbal", "#C41E3A"),
      agrarian: L("Independents", "Ind.", "#A0A0A0"),
    },
  },
};

export const KINGDOM_PARTY_LABELS = PARTY_OVERLAYS.kingdom.labels;
export const KINGDOM_OPENING_SEATS = PARTY_OVERLAYS.kingdom.seats as Record<
  PartyId,
  number
>;

export function partyOverlayKey(role?: string | null) {
  if (!role) return null;
  if (role === "home") return "kingdom";
  return role;
}

export function isKingdomRole(role?: string | null) {
  return role === "home" || role === "kingdom";
}

export function partyOverlayForRole(role?: string | null): PartyOverlay | null {
  const key = partyOverlayKey(role);
  return key ? PARTY_OVERLAYS[key] || null : null;
}

export function partyLabelsForRole(
  role?: string | null,
): Record<PartyId, PartyLabel> | null {
  const o = partyOverlayForRole(role);
  return o ? o.labels : null;
}

export function labelledParties(role?: string | null): Party[] {
  const labels = partyLabelsForRole(role);
  if (!labels) return [...PARTIES];
  return PARTIES.map((p) => {
    const lab = labels[p.id];
    return lab
      ? { ...p, name: lab.name, short: lab.short, color: lab.color || p.color }
      : p;
  });
}

export function applyPartyLabels<
  T extends { id: string; name?: string; short?: string; color?: string },
>(rows: T[], role?: string | null): T[] {
  const labels = partyLabelsForRole(role);
  if (!labels) return rows;
  return rows.map((r) => {
    const lab = labels[r.id as PartyId];
    if (!lab) return r;
    return {
      ...r,
      name: lab.name,
      short: lab.short,
      color: lab.color || r.color,
    };
  });
}

const DEPT_TASTE: Record<string, FactionEffects> = {
  health: { pensioners: 1.2, workers: 0.8, urban: 0.5 },
  education: { urban: 1.0, workers: 0.6, pensioners: -0.2 },
  welfare: { workers: 1.2, pensioners: 0.8, business: -0.6 },
  infra: { business: 0.5, rural: 0.4, workers: 0.3 },
  research: { urban: 0.5, business: 0.4 },
  defence: { patriots: 1.2, rural: 0.4, urban: -0.3 },
  justice: { patriots: 0.5, rural: 0.4, urban: 0.3 },
  environment: { urban: 1.0, rural: -0.3, business: -0.2 },
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export function emptyFac(): Record<FactionId, number> {
  return {
    business: 0,
    workers: 0,
    pensioners: 0,
    urban: 0,
    rural: 0,
    patriots: 0,
  };
}

export function addFac(
  into: Record<FactionId, number>,
  bag: FactionEffects | null | undefined,
  k = 1,
) {
  if (!bag) return into;
  for (const id of FAC_IDS) {
    const v = bag[id];
    if (v) into[id] += v * k;
  }
  return into;
}

export function emptySeats(): Record<PartyId, number> {
  const o = {} as Record<PartyId, number>;
  for (const id of PARTY_IDS) o[id] = 0;
  return o;
}

export function emptyShares(): Record<PartyId, number> {
  const o = {} as Record<PartyId, number>;
  for (const id of PARTY_IDS) o[id] = 0;
  return o;
}

function sumRecord(rec: Record<string, number>) {
  let s = 0;
  for (const k in rec) s += rec[k] || 0;
  return s;
}

function normalizeShares(raw: Record<string, number>): Record<PartyId, number> {
  const out = emptyShares();
  let tot = 0;
  for (const id of PARTY_IDS) tot += Math.max(0, raw[id] || 0);
  if (!(tot > 0)) {
    const even = 1 / PARTY_IDS.length;
    for (const id of PARTY_IDS) out[id] = even;
    return out;
  }
  for (const id of PARTY_IDS) out[id] = Math.max(0, raw[id] || 0) / tot;
  return out;
}

/** Largest-remainder (Hare) so seats always sum to `total`. */
export function largestRemainder(
  shares: Record<string, number>,
  total = CHAMBER_SEATS,
): Record<PartyId, number> {
  const seats = emptySeats();
  const order: { id: PartyId; frac: number }[] = [];
  let used = 0;
  const norm = normalizeShares(shares);
  for (const id of PARTY_IDS) {
    const exact = norm[id] * total;
    const whole = Math.floor(exact + 1e-9);
    seats[id] = whole;
    used += whole;
    order.push({ id, frac: exact - whole });
  }
  order.sort((a, b) => b.frac - a.frac);
  let left = total - used;
  for (let i = 0; i < order.length && left > 0; i++) {
    seats[order[i].id]++;
    left--;
  }
  return seats;
}

export function ideologyScore(party: Party, taste: FactionEffects) {
  let s = 0;
  for (const id of FAC_IDS) s += (party.ideology[id] || 0) * (taste[id] || 0);
  return s;
}

const ALIGN_K = 4;

export function alignmentFromTaste(party: Party, taste: FactionEffects) {
  return Math.tanh(ideologyScore(party, taste) / ALIGN_K);
}

export function stanceFromAlignment(alignment: number): PartyStanceKind {
  if (alignment > 0.15) return "for";
  if (alignment < -0.15) return "against";
  return "split";
}

export function partyStances(taste: FactionEffects) {
  return PARTIES.map((p) => {
    const alignment = alignmentFromTaste(p, taste);
    return {
      id: p.id,
      name: p.name,
      short: p.short,
      color: p.color,
      alignment,
      stance: stanceFromAlignment(alignment),
      score: ideologyScore(p, taste),
    };
  });
}

export function policyTaste(
  policyId: string,
  enacting: boolean,
): Record<FactionId, number> {
  const p = (POLICY_BY_ID as any)[policyId];
  const bag = emptyFac();
  addFac(bag, p && p.fac, enacting ? 1 : -1);
  return bag;
}

export function taxTaste(
  taxId: string,
  rateDelta: number,
): Record<FactionId, number> {
  const t = (TAX_BY_ID as any)[taxId];
  const bag = emptyFac();
  if (!t || !rateDelta) return bag;
  addFac(bag, t.fac, rateDelta * 0.25);
  const weight =
    t.grp === "income" ? 0.55 : t.grp === "consumption" ? 0.4 : 0.25;
  for (const id of FAC_IDS) bag[id] -= rateDelta * weight * 0.5;
  return bag;
}

export function viceTaste(viceId: string, fromId: string, toId: string) {
  const v = (VICE_BY_ID as any)[viceId];
  const bag = emptyFac();
  if (!v) return bag;
  const from = v.states.find((s: any) => s.id === fromId);
  const to = v.states.find((s: any) => s.id === toId);
  addFac(bag, to && to.fac, 1);
  addFac(bag, from && from.fac, -1);
  return bag;
}

export function groupTaste(groupId: string, fromId: string, toId: string) {
  const grp = LAW_GROUP_BY_ID[groupId];
  const bag = emptyFac();
  if (!grp) return bag;
  const from = grp.options.find((o) => o.id === fromId);
  const to = grp.options.find((o) => o.id === toId);
  addFac(bag, to && to.fac, 1);
  addFac(bag, from && from.fac, -1);
  return bag;
}

function polityRank(id: string) {
  const i = POLITY_LADDER.indexOf(id as any);
  return i < 0 ? 0 : i;
}

function polityTaste(fromId: string, toId: string) {
  const bag = emptyFac();
  if (!fromId || !toId || fromId === toId) return bag;
  const liberalising = polityRank(toId) < polityRank(fromId);
  if (liberalising) {
    addFac(bag, { urban: 8, workers: 3, patriots: -10, business: -2 });
  } else {
    addFac(bag, { patriots: 8, urban: -10, business: 3, workers: -3 });
  }
  return bag;
}

function incomeNiTaste(prev: any, next: any) {
  const bag = emptyFac();
  const rateNow = (law: any) =>
    !law || law.income.on === false ? 0 : law.income.bands[0].rate;
  const topNow = (law: any) =>
    !law || law.income.on === false
      ? 0
      : law.income.bands[law.income.bands.length - 1].rate;
  const dBasic = rateNow(next) - rateNow(prev);
  const dAllow =
    ((next.income && next.income.allowance) || 0) -
    ((prev.income && prev.income.allowance) || 0);
  const dEmp =
    (next.ni && next.ni.empOn === false
      ? 0
      : (next.ni && next.ni.empRate) || 0) -
    (prev.ni && prev.ni.empOn === false
      ? 0
      : (prev.ni && prev.ni.empRate) || 0);
  const dEr =
    (next.ni && next.ni.erOn === false ? 0 : (next.ni && next.ni.erRate) || 0) -
    (prev.ni && prev.ni.erOn === false ? 0 : (prev.ni && prev.ni.erRate) || 0);
  bag.workers += -dBasic * 1.7 + (dAllow / 1000) * 1.9 - dEmp * 1.9;
  bag.pensioners += -dBasic * 1.1 + (dAllow / 1000) * 1.3;
  bag.urban += -dBasic * 1.2 + (dAllow / 1000) * 1.2 - dEmp * 0.9;
  bag.rural += -dBasic * 1.2 + (dAllow / 1000) * 1.2 - dEmp * 0.9;
  bag.business += -dEr * 2.4 - dBasic * 0.3;
  const dTop =
    next.income &&
    prev.income &&
    next.income.bands &&
    prev.income.bands &&
    next.income.bands.length === prev.income.bands.length
      ? topNow(next) - topNow(prev)
      : 0;
  bag.business -= dTop * 1.1;
  bag.workers += dTop * 0.5;
  if (next.income && prev.income && next.income.uprate !== prev.income.uprate) {
    /* Freeze (uprate false) is a stealth tax: workers and pensioners hate it. */
    const freeze = next.income.uprate === false;
    addFac(bag, { workers: freeze ? -3 : 2, pensioners: freeze ? -2.5 : 1.5 });
  }
  return bag;
}

function sliderTaste(prev: any, next: any) {
  const bag = emptyFac();
  const whA = (prev && prev.workHours) || DEF_WORK_HOURS;
  const whB = (next && next.workHours) || DEF_WORK_HOURS;
  const dHours = (whB.weeklyHours || 0) - (whA.weeklyHours || 0);
  const dLeave = (whB.leaveDays || 0) - (whA.leaveDays || 0);
  bag.workers += -0.5 * dHours + 0.3 * dLeave;
  bag.business += 0.4 * dHours - 0.25 * dLeave;

  const cA = ((prev && prev.childcare) || DEF_CHILDCARE).subsidyPct || 0;
  const cB = ((next && next.childcare) || DEF_CHILDCARE).subsidyPct || 0;
  const dk = (cB - cA) / 100;
  addFac(bag, { workers: 5, urban: 4, business: 2, pensioners: -1 }, dk);

  const mwFac = (law: any) => {
    const mw = (law && law.minWage) || DEF_MIN_WAGE;
    if (!mw.on || !(mw.rate > 0)) return { workers: 0, business: 0, rural: 0 };
    const k = mw.rate / DEF_MIN_WAGE.rate;
    return { workers: 6 * k, business: -6 * k, rural: -2 * k };
  };
  const mwA = mwFac(prev);
  const mwB = mwFac(next);
  bag.workers += mwB.workers - mwA.workers;
  bag.business += mwB.business - mwA.business;
  bag.rural += mwB.rural - mwA.rural;

  const elA = (prev && prev.electoral) || DEF_ELECTORAL;
  const elB = (next && next.electoral) || DEF_ELECTORAL;
  const dAge = (elB.votingAge || 0) - (elA.votingAge || 0);
  bag.urban += -0.15 * dAge;
  bag.rural += 0.1 * dAge;
  if (!!elB.mandatoryVoting !== !!elA.mandatoryVoting) {
    const on = !!elB.mandatoryVoting;
    bag.workers += on ? 1 : -1;
    bag.patriots += on ? -1 : 1;
  }

  const pA = (prev && prev.pension) || DEF_PENSION;
  const pB = (next && next.pension) || DEF_PENSION;
  const dRet = (pB.retirementAge || 0) - (pA.retirementAge || 0);
  bag.pensioners += -0.6 * dRet;
  bag.workers += 0.15 * dRet;
  return bag;
}

/**
 * Faction taste of moving from `prev` law to `next` (a draft-shaped object
 * is fine — missions/deals live there). Mirrors billShock for taxes/income/NI
 * and content `fac` bags for policies, vice, groups, deals and missions.
 */
export function lawDeltaTaste(prev: any, next: any): Record<FactionId, number> {
  const bag = emptyFac();
  if (!prev || !next) return bag;

  for (const t of TAXES) {
    const a = prev.taxes && prev.taxes[t.id];
    const b = next.taxes && next.taxes[t.id];
    if (!a || !b) continue;
    const d = (b.on ? b.rate : 0) - (a.on ? a.rate : 0);
    if (!d) continue;
    addFac(bag, taxTaste(t.id, d));
  }
  addFac(bag, incomeNiTaste(prev, next));

  for (const dp of DEPTS) {
    const d =
      ((next.spend && next.spend[dp.id]) || 0) -
      ((prev.spend && prev.spend[dp.id]) || 0);
    if (!d) continue;
    addFac(bag, DEPT_TASTE[dp.id] || { workers: 0.4 }, d);
  }

  for (const p of POLICIES) {
    const a = !!(prev.policies && prev.policies[p.id]);
    const b = !!(next.policies && next.policies[p.id]);
    if (a !== b) addFac(bag, policyTaste(p.id, b));
  }
  for (const v of VICE) {
    const a = prev.vice && prev.vice[v.id];
    const b = next.vice && next.vice[v.id];
    if (a && b && a !== b) addFac(bag, viceTaste(v.id, a, b));
  }
  for (const grp of LAW_GROUPS) {
    const a = (prev.groups || {})[grp.id];
    const b = (next.groups || {})[grp.id];
    if (a && b && a !== b) addFac(bag, groupTaste(grp.id, a, b));
  }
  if ((prev.polity || "democracy") !== (next.polity || "democracy")) {
    addFac(
      bag,
      polityTaste(prev.polity || "democracy", next.polity || "democracy"),
    );
  }
  addFac(bag, sliderTaste(prev, next));

  for (const id in DEAL_BY_ID) {
    const a = !!(prev.deals && prev.deals[id]);
    const b = !!(next.deals && next.deals[id]);
    if (a === b) continue;
    const d = (DEAL_BY_ID as any)[id];
    addFac(bag, d && d.fac, b ? 1 : -1);
  }
  const missions = next.missions || {};
  for (const pid in missions) {
    const mid = missions[pid];
    const m = (MISSION_BY_ID as any)[mid];
    addFac(bag, m && m.fac, 1);
  }
  return bag;
}

export function partyLineAyeShare(alignment: number) {
  return clamp(0.5 + 0.45 * alignment, 0.05, 0.95);
}

export function mandateFromApproval(approval: number) {
  return clamp((approval - 40) / 45, 0, 1);
}

/** Max political capital the player can burn whipping their own caucus. */
export const WHIP_MAX = 20;

/**
 * Aye-share bought by spending capital on the ruling whip. Diminishing
 * returns; a strongly Against caucus yields less per point than a Split one.
 * Never enough on its own to turn a hard Against into a near-unanimous aye.
 */
export function whipAyeBoost(spend: number, alignment: number) {
  const s = Math.max(0, spend || 0);
  if (s <= 0) return 0;
  const intensity = 1 - Math.exp(-s / 12);
  const room = clamp(0.36 + 0.14 * alignment, 0.16, 0.4);
  return intensity * room;
}

export function rulingAyeShare(opts: {
  alignment: number;
  approval: number;
  leftoverCapital?: number;
  whipSpend?: number;
}) {
  const partyLine = partyLineAyeShare(opts.alignment);
  const mandate = mandateFromApproval(opts.approval);
  const followLeader = clamp(0.9 + 0.05 * opts.alignment, 0.05, 0.95);
  const leftover = clamp((opts.leftoverCapital || 0) / 50, 0, 1);
  const whip = whipAyeBoost(opts.whipSpend || 0, opts.alignment);
  return clamp(
    partyLine + mandate * (followLeader - partyLine) + 0.06 * leftover + whip,
    0.05,
    0.95,
  );
}

export function chamberVote(opts: {
  seats: Record<string, number>;
  rulingId: PartyId | string;
  billTaste: FactionEffects;
  approval: number;
  leftoverCapital?: number;
  whipSpend?: number;
}) {
  const rulingId = opts.rulingId as PartyId;
  const rows: {
    id: PartyId;
    name: string;
    short: string;
    color: string;
    seats: number;
    alignment: number;
    stance: PartyStanceKind;
    ayeShare: number;
    aye: number;
    nay: number;
    ruling: boolean;
  }[] = [];
  let aye = 0;
  let nay = 0;
  let rulingAyeShareVal = 0.5;
  let rulingAlignment = 0;
  let rulingPartyLine = 0.5;
  let rulingSeatsN = 0;
  for (const p of PARTIES) {
    const seats = Math.round(opts.seats[p.id] || 0);
    const alignment = alignmentFromTaste(p, opts.billTaste);
    const stance = stanceFromAlignment(alignment);
    const isRuling = p.id === rulingId;
    const ayeShare = isRuling
      ? rulingAyeShare({
          alignment,
          approval: opts.approval,
          leftoverCapital: opts.leftoverCapital,
          whipSpend: opts.whipSpend,
        })
      : partyLineAyeShare(alignment);
    const ayeSeats = Math.round(seats * ayeShare);
    const naySeats = seats - ayeSeats;
    if (isRuling) {
      rulingAyeShareVal = ayeShare;
      rulingAlignment = alignment;
      rulingPartyLine = partyLineAyeShare(alignment);
      rulingSeatsN = seats;
    }
    aye += ayeSeats;
    nay += naySeats;
    if (seats <= 0) continue;
    rows.push({
      id: p.id,
      name: p.name,
      short: p.short,
      color: p.color,
      seats,
      alignment,
      stance,
      ayeShare,
      aye: ayeSeats,
      nay: naySeats,
      ruling: isRuling,
    });
  }
  const pass = aye > CHAMBER_SEATS / 2;
  const mandate = mandateFromApproval(opts.approval);
  const whip = Math.max(0, opts.whipSpend || 0);
  const following =
    (mandate > 0.25 || whip > 0) &&
    rulingAlignment < -0.05 &&
    rulingAyeShareVal > rulingPartyLine + 0.08;
  const whipBoost = whipAyeBoost(whip, rulingAlignment);
  return {
    aye,
    nay,
    pass,
    parties: rows,
    following,
    mandate,
    rulingAyeShare: rulingAyeShareVal,
    rulingAlignment,
    rulingSeats: rulingSeatsN,
    whipSpend: whip,
    whipBoost,
  };
}

export function voteIntentionFromFac(fac: Record<string, number>) {
  const raw = emptyShares();
  for (const p of PARTIES) {
    let s = 0;
    for (const id of FAC_IDS) {
      s += (p.ideology[id] || 0) * (fac[id] != null ? fac[id] : 50);
    }
    raw[p.id] = Math.max(0.5, s);
  }
  return normalizeShares(raw);
}

/** Same weights as engine `approvalOf` — kept here so ballots stay pure. */
export function approvalFromFac(fac: Record<string, number>) {
  let s = 0;
  let w = 0;
  for (const f of FACTIONS) {
    s += (fac[f.id] != null ? fac[f.id] : 50) * f.w;
    w += f.w;
  }
  return w ? s / w : 50;
}

/** Incumbent vote at 50% approval, plus this many points per approval point.
 *  Tuned so ~62% approval is a comfortable FPTP majority (~60–70 seats), not
 *  a wipeout: five families plus a full cube exponent turned 39% of the vote
 *  into the high 80s. */
const VALENCE_BREAKEVEN = 50;
const VALENCE_AT_BREAKEVEN = 0.36;
const VALENCE_PER_POINT = 0.007;
const VALENCE_WEIGHT = 0.6;
const VALENCE_MIN = 0.14;
const VALENCE_MAX = 0.52;
const RECORD_VOTE = 0.004;

/**
 * Blend ideological intention with a government-popularity swing onto the
 * ruling party, then renormalise the rest. Cube law / PR see this, not the
 * raw faction mix — so 62% approval is a mid-30s vote and a working majority.
 */
export function applyValenceSwing(
  intention: Record<string, number>,
  opts: {
    rulingId: PartyId | string;
    approval: number;
    record?: number;
    hybridBonus?: boolean;
  },
) {
  const rulingId = opts.rulingId as PartyId;
  const base = normalizeShares(intention);
  let target =
    VALENCE_AT_BREAKEVEN +
    VALENCE_PER_POINT * (opts.approval - VALENCE_BREAKEVEN) +
    RECORD_VOTE * (opts.record || 0);
  if (opts.hybridBonus) target += 0.06;
  target = clamp(target, VALENCE_MIN, VALENCE_MAX);
  const share = clamp(
    (1 - VALENCE_WEIGHT) * (base[rulingId] || 0) + VALENCE_WEIGHT * target,
    VALENCE_MIN,
    VALENCE_MAX,
  );
  const out = emptyShares();
  out[rulingId] = share;
  const rest0 = Math.max(1e-9, 1 - (base[rulingId] || 0));
  const rest1 = 1 - share;
  for (const id of PARTY_IDS) {
    if (id === rulingId) continue;
    out[id] = ((base[id] || 0) / rest0) * rest1;
  }
  return normalizeShares(out);
}

/** @deprecated valence swing replaced the flat 8% incumbency bump. */
export function applyIncumbency(
  popularity: Record<PartyId, number>,
  rulingId: PartyId | string,
  record = 0,
  hybridBonus = false,
) {
  return applyValenceSwing(popularity, {
    rulingId,
    approval: VALENCE_BREAKEVEN,
    record,
    hybridBonus,
  });
}

function applyExponent(shares: Record<PartyId, number>, exp: number) {
  const raw = emptyShares();
  for (const id of PARTY_IDS)
    raw[id] = Math.pow(Math.max(shares[id] || 0, 0), exp);
  return normalizeShares(raw);
}

function ensureWorkingMajority(seats: Record<PartyId, number>) {
  const out = { ...seats } as Record<PartyId, number>;
  let leader: PartyId = PARTY_IDS[0];
  for (const id of PARTY_IDS) {
    if ((out[id] || 0) > (out[leader] || 0)) leader = id;
  }
  while ((out[leader] || 0) < 51) {
    let donor: PartyId | null = null;
    for (const id of PARTY_IDS) {
      if (id === leader) continue;
      if ((out[id] || 0) <= 0) continue;
      if (
        !donor ||
        out[id] < out[donor] ||
        (out[id] === out[donor] && id > donor)
      )
        donor = id;
    }
    if (!donor) break;
    out[donor]--;
    out[leader]++;
  }
  return out;
}

export function seatsFromVotes(
  shares: Record<string, number>,
  votingSystem: string,
  opts?: { majorityMaker?: boolean; liberalBump?: boolean },
) {
  let v = normalizeShares(shares);
  if (votingSystem === "proportional") {
    const raw = emptyShares();
    for (const id of PARTY_IDS) raw[id] = v[id] >= PR_THRESHOLD ? v[id] : 0;
    return largestRemainder(raw);
  }
  if (votingSystem === "majorityTwoRound") {
    if (opts?.liberalBump !== false) v = { ...v, liberal: v.liberal * 1.08 };
    v = normalizeShares(v);
    return largestRemainder(applyExponent(v, 2));
  }
  /* majoritySingle — FPTP. Classic cube law (exp 3) with five families
     turns a 35–40% vote into an 80-seat wipeout because the opposition is
     split four ways. 2.5 is still more majoritarian than two-round (exp 2)
     and than PR, and closer to recent UK seat–vote ratios. */
  const seats = largestRemainder(applyExponent(v, 2.5));
  if (opts?.majorityMaker === false) return seats;
  return ensureWorkingMajority(seats);
}

export function parliamentPowersOf(law: any) {
  return (law && law.groups && law.groups.parliamentaryPowers) || "sovereign";
}

export function partyPluralismOf(law: any) {
  return (law && law.groups && law.groups.partyPluralism) || "multiParty";
}

export function votingSystemOf(law: any) {
  return (law && law.groups && law.groups.votingSystem) || "majoritySingle";
}

function splitRemainder(
  n: number,
  weights: Record<PartyId, number>,
  exclude: PartyId,
) {
  const raw = emptyShares();
  for (const id of PARTY_IDS) {
    if (id === exclude) continue;
    raw[id] = Math.max(0, weights[id] || 0);
  }
  return largestRemainder(raw, n);
}

export function layoutSeatsForConstitution(opts: {
  popularity: Record<string, number>;
  pluralism: string;
  votingSystem: string;
  rulingId: PartyId | string;
  majorityMaker?: boolean;
}) {
  const rulingId = opts.rulingId as PartyId;
  const pop = normalizeShares(opts.popularity);
  if (opts.pluralism === "banned") {
    const seats = emptySeats();
    seats[rulingId] = CHAMBER_SEATS;
    return seats;
  }
  if (opts.pluralism === "singleParty") {
    const seats = emptySeats();
    seats[rulingId] = 90;
    const rest = splitRemainder(10, pop, rulingId);
    for (const id of PARTY_IDS) {
      if (id === rulingId) continue;
      seats[id] = rest[id];
    }
    return seats;
  }
  return seatsFromVotes(pop, opts.votingSystem, {
    majorityMaker: opts.majorityMaker,
  });
}

export function allocateElection(opts: {
  fac: Record<string, number>;
  rulingId: PartyId | string;
  votingSystem: string;
  pluralism: string;
  record?: number;
  hybridBonus?: boolean;
  approval?: number;
}) {
  const intention = voteIntentionFromFac(opts.fac);
  const popularity = applyValenceSwing(intention, {
    rulingId: opts.rulingId,
    approval: opts.approval != null ? opts.approval : approvalFromFac(opts.fac),
    record: opts.record || 0,
    hybridBonus: !!opts.hybridBonus,
  });
  const seats = layoutSeatsForConstitution({
    popularity,
    pluralism: opts.pluralism,
    votingSystem: opts.votingSystem,
    rulingId: opts.rulingId,
    majorityMaker: false,
  });
  return { popularity, seats, intention };
}

export function largestParty(seats: Record<string, number>): PartyId {
  let best: PartyId = PARTY_IDS[0];
  for (const id of PARTY_IDS) {
    if ((seats[id] || 0) > (seats[best] || 0)) best = id;
  }
  return best;
}

export function seedParties(
  fac: Record<string, number>,
  law: any,
  role?: string | null,
) {
  const pluralism = partyPluralismOf(law);
  const votingSystem = votingSystemOf(law);
  const authoritarian =
    (law && law.polity) === "authoritarian" ||
    pluralism === "singleParty" ||
    pluralism === "banned";
  const intention = voteIntentionFromFac(fac);
  const overlay = partyOverlayForRole(role);
  if (overlay && overlay.seats) {
    const seats = emptySeats();
    for (const id of PARTY_IDS) seats[id] = overlay.seats[id] || 0;
    const popularity = authoritarian
      ? (() => {
          const p = emptyShares();
          const rid = overlay.rulingId;
          const banned =
            pluralism === "banned" || overlay.partyPluralism === "banned";
          p[rid] = banned ? 1 : 0.78;
          if (!banned) {
            const rest = voteIntentionFromFac(fac);
            for (const id of PARTY_IDS) {
              if (id === rid) continue;
              p[id] = rest[id] * 0.22;
            }
          }
          return normalizeShares(p);
        })()
      : applyValenceSwing(intention, {
          rulingId: overlay.rulingId,
          approval: approvalFromFac(fac),
        });
    return {
      rulingId: overlay.rulingId,
      popularity,
      seats,
    };
  }
  const rulingId = authoritarian
    ? overlay?.rulingId || "national"
    : overlay?.rulingId ||
      largestParty(
        seatsFromVotes(intention, votingSystem, { majorityMaker: false }),
      );
  const popularity = authoritarian
    ? (() => {
        const p = emptyShares();
        const rid = rulingId;
        p[rid] = pluralism === "banned" ? 1 : 0.78;
        if (pluralism !== "banned") {
          const rest = voteIntentionFromFac(fac);
          for (const id of PARTY_IDS) {
            if (id === rid) continue;
            p[id] = rest[id] * 0.22;
          }
        }
        return normalizeShares(p);
      })()
    : applyValenceSwing(intention, {
        rulingId,
        approval: approvalFromFac(fac),
      });
  const seats = layoutSeatsForConstitution({
    popularity,
    pluralism:
      authoritarian && pluralism === "multiParty" ? "singleParty" : pluralism,
    votingSystem,
    rulingId,
  });
  return {
    rulingId,
    popularity,
    seats,
  };
}

export function driftPopularity(
  current: Record<string, number>,
  target: Record<string, number>,
  k = 0.2,
) {
  const out = emptyShares();
  const cur = normalizeShares(current);
  const tgt = normalizeShares(target);
  for (const id of PARTY_IDS) {
    out[id] = cur[id] + (tgt[id] - cur[id]) * k;
  }
  return normalizeShares(out);
}

export function leaderTitle(law: any, polityId?: string, role?: string) {
  const polity = polityId || (law && law.polity) || "democracy";
  const groups = (law && law.groups) || {};
  const hereditary = groups.hereditary === "hereditary";
  const presidential = groups.electionCalendar === "fixed";
  const powers = groups.parliamentaryPowers;
  const sovereign = powers !== "suppressed" && powers !== "consultative";
  const pinned = partyOverlayForRole(role)?.office;

  if (polity === "authoritarian") {
    if (hereditary) return "Monarch";
    return pinned || "General Secretary";
  }
  if (presidential) return "President";
  if (hereditary) return "Prime Minister";
  if (sovereign) return pinned || "Prime Minister";
  return pinned || "President";
}

export function clonePartiesState(state: any) {
  if (!state) return null;
  return {
    rulingId: state.rulingId,
    popularity: { ...state.popularity },
    seats: { ...state.seats },
  };
}
