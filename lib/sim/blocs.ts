/**
 * Trade bloc templates — predefined unions and custom-alliance shapes.
 * Membership is exclusive: one bloc per country at a time (see engine G.blocMember).
 */

export const BLOC_TEMPLATES = {
  continental_union: {
    id: "continental_union",
    name: "Continental Union",
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
  },
  pacific_accord: {
    id: "pacific_accord",
    name: "Pacific Accord",
    type: "fta",
    members: ["japan", "australia", "korea"],
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
    name: "Gulf Council",
    type: "fta",
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
  northern_compact: {
    id: "northern_compact",
    name: "Northern Compact",
    type: "fta",
    members: ["russia"],
    accessBonus: 1.04,
    accession: {
      memberRelationMin: 42,
      steps: { apply: 5, align: 8, accede: 12 },
      need: {},
    },
  },
  andes_pact: {
    id: "andes_pact",
    name: "Andes Pact",
    type: "fta",
    members: ["brazil", "mexico", "argentina"],
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
    name: "Archipelago Circle",
    type: "fta",
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

export function blocForCountry(
  countryId: string,
  blocMember: Record<string, string> = {},
) {
  const bid = blocMember[countryId];
  if (!bid) return null;
  return TEMPLATES[bid] || null;
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
