/**
 * Trade blocs — real-world names, membership limited to seats on this board.
 *
 * Exclusive membership is a game rule (one bloc per country), so overlapping
 * real treaties are collapsed to the deepest or most identity-defining club:
 *
 *   European Union  DE FR IT ES NL PL     customs union (Turkey is a CU
 *                                         partner, not a member — stay out)
 *   CPTPP           JP AU                 FTA. Members keep their own
 *                                         commercial policy (extra-bloc FTAs).
 *                                         Real CPTPP also includes VN, MX, CA,
 *                                         and the UK; KR is not a member.
 *   GCC             SA AE                 FTA here (real GCC is a CU; left
 *                                         as FTA so opening tariffs stay put)
 *   Mercosur        BR AR                 FTA here (real Mercosur is a CU).
 *                                         MX was never a member — old "Andes
 *                                         Pact" geography was wrong.
 *   ASEAN           ID VN                 FTA / AFTA
 *
 * Deliberately not modelled as starting blocs (exclusive membership still
 * applies — one club per country — even though FTA members may sign extra-
 * bloc FTAs):
 *   USMCA  (US/CA/MX)
 *   AfCFTA (NG/ZA/EG/KE — still shallow)
 *   RCEP   (would swallow ASEAN + CPTPP + CN)
 *   EAEU   (only RU is on the board)
 *
 * Ids stay stable (`continental_union`, …) so saves/tests/mp snapshots
 * don't churn; `name` is what the UI shows.
 */

export const BLOC_TEMPLATES = {
  continental_union: {
    id: "continental_union",
    name: "European Union",
    type: "customs_union",
    defaultCet: 4,
    chair: "france",
    members: ["germany", "france", "italy", "spain", "netherlands", "poland"],
    accessBonus: 1.15,
    accession: {
      memberRelationMin: 48,
      chairRelationMin: 52,
      steps: { apply: 8, align: 14, accede: 24 },
      need: {
        policyOff: ["closeBorders"],
        tariffMax: 8,
      },
    },
    /* Signed at a summit with any member — not a country FTA, and not
       membership. Preferential access fans out to current members. */
    externalDeal: {
      id: "eu_assoc",
      name: "Association agreement",
      pc: 18,
      terms: [
        "Preferential goods access across the union",
        "Mutual recognition of standards",
      ],
      need: { relation: 50, policyOff: ["closeBorders"] },
      imp: { open: 4 },
      ch: { tariffCut: 1.8, access: 2.2 },
      fac: { business: 6, urban: 2, rural: -3, patriots: -5 },
      blocId: "continental_union",
    },
  },
  pacific_accord: {
    id: "pacific_accord",
    name: "CPTPP",
    type: "fta",
    chair: "japan",
    members: ["japan", "australia"],
    accessBonus: 1.08,
    accession: {
      memberRelationMin: 45,
      steps: { apply: 6, align: 10, accede: 16 },
      need: {
        tariffMax: 10,
      },
    },
  },
  gulf_council: {
    id: "gulf_council",
    name: "Gulf Cooperation Council",
    type: "fta",
    chair: "saudi",
    members: ["saudi", "uae"],
    accessBonus: 1.06,
    accession: {
      memberRelationMin: 44,
      steps: { apply: 6, align: 8, accede: 14 },
      need: {
        tariffMax: 12,
      },
    },
  },
  andes_pact: {
    id: "andes_pact",
    name: "Mercosur",
    type: "fta",
    chair: "brazil",
    members: ["brazil", "argentina"],
    accessBonus: 1.07,
    accession: {
      memberRelationMin: 45,
      steps: { apply: 6, align: 10, accede: 16 },
      need: {
        tariffMax: 10,
      },
    },
  },
  asean_circle: {
    id: "asean_circle",
    name: "ASEAN",
    type: "fta",
    chair: "indonesia",
    members: ["indonesia", "vietnam"],
    accessBonus: 1.06,
    accession: {
      memberRelationMin: 44,
      steps: { apply: 6, align: 9, accede: 14 },
      need: {
        tariffMax: 12,
      },
    },
  },
};

/** Custom alliance templates the player can found. */
export const CUSTOM_BLOC_TEMPLATES = {
  shallow_fta: {
    id: "shallow_fta",
    name: "Free trade area",
    type: "fta",
    tariffCap: 8,
    accessBonus: 1.05,
    pc: 28,
    externalDealRelationMin: 42,
  },
  deep_integration: {
    id: "deep_integration",
    name: "Deep integration pact",
    type: "customs_union",
    defaultCet: 5,
    accessBonus: 1.12,
    pc: 42,
    externalDealRelationMin: 45,
  },
};

const TEMPLATES: Record<string, any> = BLOC_TEMPLATES;

export function blocById(id: string) {
  return TEMPLATES[id] || null;
}

export function countriesInBloc(
  blocId: string,
  blocMember: Record<string, string>,
) {
  return Object.keys(blocMember).filter((c) => blocMember[c] === blocId);
}

export function isCustomsUnion(bloc: any) {
  return bloc && bloc.type === "customs_union";
}

/** Association treaty a custom customs union offers to independent outsiders. */
export function customUnionAssociationDeal(blocId: string) {
  return {
    id: "assoc_" + blocId,
    name: "Association agreement",
    pc: 16,
    terms: [
      "Preferential goods access across the union",
      "Mutual recognition of standards",
    ],
    need: { relation: 50, policyOff: ["closeBorders"] },
    imp: { open: 4 },
    ch: { tariffCut: 1.6, access: 2.0 },
    fac: { business: 5, urban: 2, rural: -2, patriots: -4 },
    blocId,
  };
}

/** Unaligned and FTA members keep their own commercial policy; CU members do not. */
export function hasIndependentCommercialPolicy(
  countryId: string,
  blocMember?: Record<string, string> | null,
  customBlocs?: Record<string, any> | null,
) {
  if (!countryId) return true;
  const bid = blocMember && blocMember[countryId];
  if (!bid) return true;
  const bloc = blocById(bid) || (customBlocs && customBlocs[bid]);
  return !isCustomsUnion(bloc);
}
