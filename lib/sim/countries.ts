/**
 * Sovereign trade partners. Each country is a bilateral actor on the board.
 * Bloc membership lives in engine state (G.blocMember), not here.
 */

/**
 * A trade deal offer is pure content data — shape varies by deal (need/imp/ch/fac
 * keys documented in CLAUDE.md "Adding content"), so it stays loosely typed
 * here rather than modelled field-by-field, same as engine.js's TAXES/POLICIES/EVENTS.
 */
export interface CountryDeal {
  id: string;
  name: string;
  pc: number;
  terms: string[];
  need?: Record<string, any>;
  homeOff?: string[];
  imp?: Record<string, number>;
  ch?: Record<string, number>;
  fac?: Record<string, number>;
  [key: string]: any;
}

export interface Country {
  id: string;
  name: string;
  region: string;
  iso: string;
  tradeShare: number;
  blurb: string;
  deals: CountryDeal[];
  /** Real-world capital lat/lng, for the 3D map layer's capital-city markers.
   *  `iso` is a real ISO-3166 numeric code plotted on the unmodified Natural
   *  Earth topojson (see WorldMap.tsx) — countries sit at their real
   *  geographic position on this board (only the politics are fictional), so
   *  real capital coordinates land correctly; do not swap these for invented
   *  positions. */
  capital: { lat: number; lng: number };
}

export const COUNTRY_REGIONS: Record<string, string> = {
  europe: "Europe",
  americas: "Americas",
  asia: "Asia",
  africa: "Africa",
  gulf: "Gulf",
  oceania: "Oceania",
};

/** Default bloc membership at game start (exclusive). */
export const DEFAULT_BLOC_MEMBER: Record<string, string> = {
  germany: "continental_union",
  france: "continental_union",
  italy: "continental_union",
  spain: "continental_union",
  netherlands: "continental_union",
  poland: "continental_union",
  japan: "pacific_accord",
  australia: "pacific_accord",
  saudi: "gulf_council",
  uae: "gulf_council",
  brazil: "andes_pact",
  argentina: "andes_pact",
  indonesia: "asean_circle",
  vietnam: "asean_circle",
};

export const COUNTRIES: Country[] = [
  {
    id: "germany",
    name: "Germany",
    region: "europe",
    iso: "276",
    capital: { lat: 52.52, lng: 13.405 }, // Berlin
    tradeShare: 0.1,
    blurb:
      "Industrial heartland. Rules-minded, export-heavy, allergic to fiscal chaos elsewhere.",
    deals: [
      {
        id: "de_fta",
        name: "Bilateral free trade agreement",
        pc: 14,
        terms: [
          "Zero tariffs on manufactures",
          "Mutual recognition of standards",
        ],
        need: { relation: 50, policyOff: ["closeBorders"] },
        homeOff: ["germany"],
        imp: { open: 4 },
        ch: { tariffCut: 1.8, access: 3.0 },
        fac: { business: 5, urban: 2, rural: -3, patriots: -5 },
      },
      {
        id: "de_mobility",
        name: "Labour mobility pact",
        pc: 16,
        terms: ["Reciprocal right to work", "Recognition of qualifications"],
        need: { relation: 58, policyOff: ["closeBorders"] },
        homeOff: ["germany"],
        ch: { migrate: 0.45, access: 0.7 },
        fac: { business: 4, urban: 3, patriots: -9, rural: -3 },
      },
    ],
  },
  {
    id: "france",
    name: "France",
    region: "europe",
    iso: "250",
    capital: { lat: 48.8566, lng: 2.3522 }, // Paris
    tradeShare: 0.065,
    blurb:
      "Wine, strikes, and institutions that outlast whichever government is nominally in charge.",
    deals: [
      {
        id: "fr_fta",
        name: "Comprehensive free trade agreement",
        pc: 16,
        terms: ["Zero tariffs on goods", "Mutual recognition of standards"],
        need: { relation: 52, policyOff: ["closeBorders"] },
        homeOff: ["france"],
        imp: { open: 5 },
        ch: { tariffCut: 2.0, access: 3.4 },
        fac: { business: 6, urban: 2, rural: -4, patriots: -6 },
      },
      {
        id: "fr_customs",
        name: "Customs union",
        pc: 24,
        terms: [
          "Common external tariff",
          "Your tariff lever is surrendered",
          "Frictionless goods trade",
        ],
        need: { deal: "fr_fta", tariffMax: 6 },
        homeOff: ["france"],
        imp: { open: 6 },
        ch: { tariffCut: 3.0, access: 4.6 },
        fac: { business: 8, urban: 3, patriots: -11, rural: -3 },
        lockTariff: 4,
      },
    ],
  },
  {
    id: "italy",
    name: "Italy",
    region: "europe",
    iso: "380",
    capital: { lat: 41.9028, lng: 12.4964 }, // Rome
    tradeShare: 0.045,
    blurb:
      "Design, food, and a debt stock that makes every budget conversation longer.",
    deals: [
      {
        id: "it_fta",
        name: "Bilateral trade accord",
        pc: 12,
        terms: ["Tariff reductions on goods", "Services market access"],
        need: { relation: 48 },
        homeOff: ["italy"],
        imp: { open: 3 },
        ch: { tariffCut: 1.4, access: 2.2 },
        fac: { business: 4, urban: 2, patriots: -3 },
      },
    ],
  },
  {
    id: "spain",
    name: "Spain",
    region: "europe",
    iso: "724",
    capital: { lat: 40.4168, lng: -3.7038 }, // Madrid
    tradeShare: 0.038,
    blurb: "Tourism, agriculture, and a bridge to the southern Atlantic.",
    deals: [
      {
        id: "es_fta",
        name: "Bilateral trade accord",
        pc: 12,
        terms: ["Tariff cuts on goods and services", "Energy cooperation"],
        need: { relation: 48 },
        homeOff: ["spain"],
        imp: { open: 3 },
        ch: { tariffCut: 1.3, access: 2.0 },
        fac: { business: 4, rural: 2, patriots: -2 },
      },
    ],
  },
  {
    id: "netherlands",
    name: "Netherlands",
    region: "europe",
    iso: "528",
    capital: { lat: 52.3676, lng: 4.9041 }, // Amsterdam
    tradeShare: 0.085,
    blurb:
      "Ports, logistics, and a very direct view of whether your customs policy works.",
    deals: [
      {
        id: "nl_fta",
        name: "Trade and logistics pact",
        pc: 14,
        terms: ["Frictionless port access", "Tariff-free re-exports"],
        need: { relation: 50 },
        homeOff: ["netherlands"],
        imp: { open: 4 },
        ch: { tariffCut: 1.6, access: 2.8 },
        fac: { business: 6, urban: 2, patriots: -4 },
      },
    ],
  },
  {
    id: "united_states",
    name: "United States",
    region: "americas",
    iso: "840",
    capital: { lat: 38.9072, lng: -77.0369 }, // Washington, D.C.
    tradeShare: 0.22,
    blurb:
      "Enormous, litigious, and extremely interested in your digital services tax.",
    deals: [
      {
        id: "us_tech",
        name: "Technology and services accord",
        pc: 14,
        terms: ["Digital services tax abolished", "Data flows unrestricted"],
        need: { taxOff: ["digitalTax"] },
        homeOff: ["united_states"],
        imp: { open: 3 },
        ch: { access: 2.6, tfp: 0.06 },
        fac: { business: 6, urban: -3, patriots: -2 },
      },
      {
        id: "us_defence",
        name: "Defence procurement pact",
        pc: 12,
        terms: [
          "Defence spending held at or above 2.8% of GDP",
          "Joint programmes",
        ],
        need: { deptMin: { defence: 2.8 } },
        homeOff: ["united_states"],
        ch: { access: 0.7 },
        fac: { patriots: 9, business: 3, urban: -5, workers: -2 },
      },
      {
        id: "us_agri",
        name: "Agricultural access deal",
        pc: 16,
        terms: [
          "Their food standards accepted",
          "Tariff-free agricultural imports",
        ],
        need: {},
        homeOff: ["united_states"],
        imp: { open: 2 },
        ch: { tariffCut: 1.2, access: 1.1 },
        fac: { business: 4, rural: -12, urban: -2 },
      },
    ],
  },
  {
    id: "china",
    name: "China",
    region: "asia",
    iso: "156",
    capital: { lat: 39.9042, lng: 116.4074 }, // Beijing
    tradeShare: 0.05,
    blurb:
      "Cheap inputs, deep pockets, and a foreign policy your backbenchers hate.",
    deals: [
      {
        id: "cn_trade",
        name: "Bulk goods trade agreement",
        pc: 12,
        terms: [
          "Tariff reductions on manufactured goods",
          "Currency swap line",
        ],
        need: {},
        imp: { open: 4 },
        ch: { tariffCut: 1.6, access: 2.2 },
        fac: {
          business: 5,
          pensioners: 2,
          workers: -6,
          urban: -4,
          patriots: -6,
        },
      },
      {
        id: "cn_invest",
        name: "Infrastructure investment treaty",
        pc: 20,
        terms: [
          "Their capital funds your ports and grid",
          "Long concession periods",
        ],
        need: { relation: 55 },
        imp: { spend: -0.6 },
        ch: { kboost: 0.5 },
        fac: { business: 4, workers: 2, patriots: -10, urban: -4 },
      },
    ],
  },
  {
    id: "russia",
    name: "Russia",
    region: "europe",
    iso: "643",
    capital: { lat: 55.7558, lng: 37.6173 }, // Moscow
    tradeShare: 0.02,
    blurb:
      "Energy, commodities, and a long border with the continent. Cheap barrels, expensive politics.",
    deals: [
      {
        id: "ru_energy",
        name: "Long-term energy supply contract",
        pc: 12,
        terms: [
          "Pipeline and LNG volumes locked",
          "Price collar indexed to their formula",
        ],
        need: { relation: 42 },
        ch: { ucost: -0.18 },
        fac: { business: 5, pensioners: 2, urban: -4, patriots: -8 },
        resilience: 0.4,
      },
      {
        id: "ru_commod",
        name: "Commodities and metals access",
        pc: 10,
        terms: ["Tariff cuts on bulk commodities", "Preferential offtake"],
        need: {},
        imp: { open: 2 },
        ch: { tariffCut: 1.0, access: 1.4 },
        fac: { business: 4, workers: 1, patriots: -6, urban: -2 },
      },
    ],
  },
  {
    id: "india",
    name: "India",
    region: "asia",
    iso: "356",
    capital: { lat: 28.6139, lng: 77.209 }, // New Delhi
    tradeShare: 0.038,
    blurb:
      "Fast growth, deep labour markets, and a services trade your firms already depend on.",
    deals: [
      {
        id: "in_services",
        name: "Services and digital trade accord",
        pc: 12,
        terms: [
          "Mutual recognition for professional services",
          "Visa lanes for skilled workers",
        ],
        need: { relation: 48, policyOff: ["closeBorders"] },
        imp: { open: 3 },
        ch: { access: 2.0, tfp: 0.05, migrate: 0.25 },
        fac: { business: 5, urban: 3, workers: -3, patriots: -4 },
      },
      {
        id: "in_goods",
        name: "Goods and pharmaceuticals access",
        pc: 10,
        terms: ["Tariff cuts on manufactures and generics"],
        need: {},
        imp: { open: 2 },
        ch: { tariffCut: 1.2, access: 1.5 },
        fac: { business: 4, pensioners: 2, rural: -2, patriots: -2 },
      },
    ],
  },
  {
    id: "brazil",
    name: "Brazil",
    region: "americas",
    iso: "076",
    capital: { lat: -15.7939, lng: -47.8828 }, // Brasília
    tradeShare: 0.015,
    blurb:
      "Commodity exports, deep cities, and a soft-power rivalry with the United States.",
    deals: [
      {
        id: "br_commod",
        name: "Commodities and lithium corridor",
        pc: 11,
        terms: ["Tariff cuts on soy, copper and battery metals"],
        need: {},
        imp: { open: 2 },
        ch: { tariffCut: 1.0, access: 1.2 },
        fac: { business: 4, rural: -3, patriots: -2 },
      },
    ],
  },
  {
    id: "mexico",
    name: "Mexico",
    region: "americas",
    iso: "484",
    capital: { lat: 19.4326, lng: -99.1332 }, // Mexico City
    tradeShare: 0.01,
    blurb:
      "Manufacturing bridge to the north. Trade policy follows whoever has the louder capital.",
    deals: [
      {
        id: "mx_trade",
        name: "Manufacturing supply chain pact",
        pc: 10,
        terms: ["Rules-of-origin cooperation", "Tariff cuts on components"],
        need: { relation: 46 },
        imp: { open: 2 },
        ch: { tariffCut: 0.8, access: 1.3 },
        fac: { business: 4, workers: 1, patriots: -2 },
      },
    ],
  },
  {
    id: "japan",
    name: "Japan",
    region: "asia",
    iso: "392",
    capital: { lat: 35.6762, lng: 139.6503 }, // Tokyo
    tradeShare: 0.025,
    blurb:
      "Precision industry, ageing demography, and capital that travels quietly.",
    deals: [
      {
        id: "jp_tech",
        name: "Technology and standards accord",
        pc: 12,
        terms: [
          "Mutual recognition for automotive and electronics",
          "Data adequacy",
        ],
        need: { relation: 50 },
        imp: { open: 3 },
        ch: { access: 2.0, tfp: 0.05 },
        fac: { business: 5, urban: 2, patriots: -3 },
      },
    ],
  },
  {
    id: "australia",
    name: "Australia",
    region: "oceania",
    iso: "036",
    capital: { lat: -35.2809, lng: 149.13 }, // Canberra
    tradeShare: 0.015,
    blurb: "Warm words, modest volumes, and a great deal of shared paperwork.",
    deals: [
      {
        id: "au_fta",
        name: "Commonwealth trade area",
        pc: 10,
        terms: [
          "Reciprocal tariff elimination",
          "Shared professional standards",
        ],
        need: { relation: 48 },
        imp: { open: 3 },
        ch: { tariffCut: 1.1, access: 1.7 },
        fac: { patriots: 5, business: 3, rural: -2 },
      },
      {
        id: "au_students",
        name: "Education and mobility scheme",
        pc: 8,
        terms: ["Uncapped student visas", "Two-year post-study work rights"],
        need: {},
        ch: { migrate: 0.35, tfp: 0.04 },
        fac: { urban: 4, business: 2, patriots: -5 },
      },
    ],
  },
  {
    id: "saudi",
    name: "Saudi Arabia",
    region: "gulf",
    iso: "682",
    capital: { lat: 24.7136, lng: 46.6753 }, // Riyadh
    tradeShare: 0.03,
    blurb: "Patient capital with opinions about who you criticise.",
    deals: [
      {
        id: "sa_invest",
        name: "Sovereign investment partnership",
        pc: 14,
        terms: [
          "Direct investment in energy and housing",
          "Quiet diplomacy on human rights",
        ],
        need: { relation: 54 },
        imp: { spend: -0.8 },
        ch: { kboost: 0.45 },
        fac: { business: 6, pensioners: 2, urban: -6 },
      },
      {
        id: "sa_energy",
        name: "Long-term energy supply contract",
        pc: 10,
        terms: ["Twenty-year gas and hydrogen supply", "Price collar"],
        need: {},
        ch: { ucost: -0.12 },
        fac: { business: 4, urban: -3 },
        resilience: 0.35,
      },
    ],
  },
  {
    id: "uae",
    name: "United Arab Emirates",
    region: "gulf",
    iso: "784",
    capital: { lat: 24.4539, lng: 54.3773 }, // Abu Dhabi
    tradeShare: 0.02,
    blurb:
      "Hub economy. Logistics, finance, and a view of every trade lane that matters.",
    deals: [
      {
        id: "ae_hub",
        name: "Logistics and finance hub pact",
        pc: 10,
        terms: ["Re-export privileges", "Financial services access"],
        need: { relation: 48 },
        ch: { access: 1.5, tfp: 0.03 },
        fac: { business: 5, urban: 2, patriots: -3 },
      },
    ],
  },
  {
    id: "nigeria",
    name: "Nigeria",
    region: "africa",
    iso: "566",
    capital: { lat: 9.0765, lng: 7.3986 }, // Abuja
    tradeShare: 0.015,
    blurb:
      "Young population, commodity cycles, and a migration question your parties cannot ignore.",
    deals: [
      {
        id: "ng_minerals",
        name: "Critical minerals access",
        pc: 12,
        terms: ["Preferential offtake on copper and LNG"],
        need: {},
        imp: { open: 2 },
        ch: { tariffCut: 0.9, access: 1.3, ucost: -0.06 },
        fac: { business: 4, patriots: -3, urban: -2 },
        resilience: 0.25,
      },
      {
        id: "ng_mobility",
        name: "Skills and mobility partnership",
        pc: 10,
        terms: ["Managed migration corridors", "Mutual recognition for nurses"],
        need: { relation: 46, policyOff: ["closeBorders"] },
        ch: { migrate: 0.4, labour: 0.08 },
        fac: { business: 3, urban: 2, workers: -4, patriots: -7 },
      },
    ],
  },
  {
    id: "south_africa",
    name: "South Africa",
    region: "africa",
    iso: "710",
    capital: { lat: -25.7479, lng: 28.2293 }, // Pretoria
    tradeShare: 0.01,
    blurb:
      "Industrial base of the continent. Power cuts at home, platinum abroad.",
    deals: [
      {
        id: "za_trade",
        name: "Mining and manufacturing access",
        pc: 10,
        terms: ["Tariff cuts on metals and autos", "Investment protection"],
        need: { relation: 44 },
        imp: { open: 2 },
        ch: { tariffCut: 0.8, access: 1.2 },
        fac: { business: 3, workers: 1, patriots: -2 },
      },
    ],
  },
  {
    id: "canada",
    name: "Canada",
    region: "americas",
    iso: "124",
    capital: { lat: 45.4215, lng: -75.6972 }, // Ottawa
    tradeShare: 0.042,
    blurb:
      "Commodity wealth, deep capital markets, and a long border with the United States.",
    deals: [
      {
        id: "ca_fta",
        name: "Comprehensive economic partnership",
        pc: 12,
        terms: ["Tariff-free goods", "Mutual recognition for professionals"],
        need: { relation: 48, policyOff: ["closeBorders"] },
        homeOff: ["canada"],
        imp: { open: 4 },
        ch: { tariffCut: 1.5, access: 2.4 },
        fac: { business: 5, urban: 2, patriots: -4 },
      },
      {
        id: "ca_energy",
        name: "Energy and critical minerals corridor",
        pc: 10,
        terms: ["Preferential offtake on oil, gas and battery metals"],
        need: {},
        homeOff: ["canada"],
        ch: { ucost: -0.1, access: 0.8 },
        fac: { business: 4, rural: 2, urban: -2 },
        resilience: 0.3,
      },
    ],
  },
  {
    id: "korea",
    name: "South Korea",
    region: "asia",
    iso: "410",
    capital: { lat: 37.5665, lng: 126.978 }, // Seoul
    tradeShare: 0.02,
    blurb:
      "Export machine and semiconductor power. Ageing at home, restless abroad.",
    deals: [
      {
        id: "kr_tech",
        name: "Technology and standards accord",
        pc: 12,
        terms: [
          "Mutual recognition for electronics and autos",
          "Chip supply cooperation",
        ],
        need: { relation: 50 },
        homeOff: ["korea"],
        imp: { open: 3 },
        ch: { access: 2.2, tfp: 0.06 },
        fac: { business: 6, urban: 2, patriots: -3 },
      },
      {
        id: "kr_fta",
        name: "Bilateral free trade agreement",
        pc: 11,
        terms: ["Tariff cuts on manufactures", "Services market access"],
        need: { relation: 48 },
        homeOff: ["korea"],
        imp: { open: 3 },
        ch: { tariffCut: 1.4, access: 2.0 },
        fac: { business: 5, rural: -2, patriots: -3 },
      },
    ],
  },
  {
    id: "indonesia",
    name: "Indonesia",
    region: "asia",
    iso: "360",
    capital: { lat: -6.2088, lng: 106.8456 }, // Jakarta
    tradeShare: 0.015,
    blurb:
      "Archipelago giant. Young demography, commodity cycles, and a manufacturing climb.",
    deals: [
      {
        id: "id_commod",
        name: "Critical minerals and palm corridor",
        pc: 11,
        terms: ["Preferential offtake on nickel and commodities"],
        need: {},
        homeOff: ["indonesia"],
        imp: { open: 2 },
        ch: { tariffCut: 1.0, access: 1.4, ucost: -0.05 },
        fac: { business: 4, rural: -2, patriots: -2 },
        resilience: 0.25,
      },
      {
        id: "id_fta",
        name: "Comprehensive partnership",
        pc: 12,
        terms: ["Tariff reductions", "Investment protection"],
        need: { relation: 46 },
        homeOff: ["indonesia"],
        imp: { open: 3 },
        ch: { tariffCut: 1.2, access: 1.8 },
        fac: { business: 5, workers: 1, patriots: -3 },
      },
    ],
  },
  {
    id: "turkey",
    name: "Turkey",
    region: "europe",
    iso: "792",
    capital: { lat: 39.9334, lng: 32.8597 }, // Ankara
    tradeShare: 0.015,
    blurb:
      "Bridge between the continent and the warm seas. Soft lira, hard politics.",
    deals: [
      {
        id: "tr_customs",
        name: "Customs and industrial access",
        pc: 14,
        terms: ["Deepened customs cooperation", "Tariff cuts on manufactures"],
        need: { relation: 48, tariffMax: 10 },
        homeOff: ["turkey"],
        imp: { open: 4 },
        ch: { tariffCut: 1.6, access: 2.5 },
        fac: { business: 5, urban: 2, patriots: -5 },
      },
      {
        id: "tr_energy",
        name: "Energy transit partnership",
        pc: 10,
        terms: ["Pipeline and LNG transit privileges"],
        need: {},
        homeOff: ["turkey"],
        ch: { ucost: -0.08, access: 0.6 },
        fac: { business: 4, patriots: -3 },
        resilience: 0.2,
      },
    ],
  },
  {
    id: "argentina",
    name: "Argentina",
    region: "americas",
    iso: "032",
    capital: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
    tradeShare: 0.01,
    blurb:
      "Grain, beef, and a bond market that never quite settles. Soft growth, loud prices.",
    deals: [
      {
        id: "ar_agri",
        name: "Agricultural and lithium access",
        pc: 10,
        terms: ["Tariff cuts on soy, beef and battery metals"],
        need: {},
        homeOff: ["argentina"],
        imp: { open: 2 },
        ch: { tariffCut: 1.0, access: 1.3 },
        fac: { business: 4, rural: -4, patriots: -2 },
      },
      {
        id: "ar_invest",
        name: "Investment and debt cooperation",
        pc: 12,
        terms: ["Investment protection", "Quiet support on external financing"],
        need: { relation: 50 },
        homeOff: ["argentina"],
        ch: { access: 1.0, kboost: 0.25 },
        fac: { business: 5, urban: -2, patriots: -4 },
      },
    ],
  },
  {
    id: "vietnam",
    name: "Vietnam",
    region: "asia",
    iso: "704",
    capital: { lat: 21.0285, lng: 105.8542 }, // Hanoi
    tradeShare: 0.01,
    blurb:
      "Factory floor of the China-plus-one shift. Fast growth, thin capital markets.",
    deals: [
      {
        id: "vn_mfg",
        name: "Manufacturing supply-chain pact",
        pc: 11,
        terms: ["Rules-of-origin cooperation", "Tariff cuts on components"],
        need: { relation: 46 },
        homeOff: ["vietnam"],
        imp: { open: 3 },
        ch: { tariffCut: 1.2, access: 1.8, tfp: 0.03 },
        fac: { business: 5, workers: 2, patriots: -3 },
      },
      {
        id: "vn_fta",
        name: "Bilateral trade agreement",
        pc: 10,
        terms: ["Tariff reductions on goods", "Investment protection"],
        need: {},
        homeOff: ["vietnam"],
        imp: { open: 2 },
        ch: { tariffCut: 1.0, access: 1.4 },
        fac: { business: 4, rural: -2, patriots: -2 },
      },
    ],
  },
  {
    id: "poland",
    name: "Poland",
    region: "europe",
    iso: "616",
    capital: { lat: 52.2297, lng: 21.0122 }, // Warsaw
    tradeShare: 0.032,
    blurb:
      "Manufacturing heartland of the east. Growing fast, watching the northern border.",
    deals: [
      {
        id: "pl_fta",
        name: "Industrial and services accord",
        pc: 12,
        terms: [
          "Tariff cuts on manufactures",
          "Mutual recognition of standards",
        ],
        need: { relation: 48, policyOff: ["closeBorders"] },
        homeOff: ["poland"],
        imp: { open: 3 },
        ch: { tariffCut: 1.4, access: 2.2 },
        fac: { business: 5, workers: 2, patriots: -4 },
      },
      {
        id: "pl_defence",
        name: "Defence industrial partnership",
        pc: 10,
        terms: [
          "Joint programmes",
          "Defence spending held at or above 2.5% of GDP",
        ],
        need: { deptMin: { defence: 2.5 } },
        homeOff: ["poland"],
        ch: { access: 0.6 },
        fac: { patriots: 8, business: 2, urban: -3 },
      },
    ],
  },
  {
    id: "egypt",
    name: "Egypt",
    region: "africa",
    iso: "818",
    capital: { lat: 30.0444, lng: 31.2357 }, // Cairo
    tradeShare: 0.01,
    blurb: "Demography, canals, and a fiscal squeeze that never quite ends.",
    deals: [
      {
        id: "eg_canal",
        name: "Logistics and canal partnership",
        pc: 11,
        terms: ["Preferential transit and port access", "Logistics investment"],
        need: { relation: 46 },
        homeOff: ["egypt"],
        ch: { access: 1.6, tfp: 0.02 },
        fac: { business: 5, urban: 1, patriots: -3 },
      },
      {
        id: "eg_trade",
        name: "Goods and energy access",
        pc: 10,
        terms: ["Tariff cuts on manufactures and LNG"],
        need: {},
        homeOff: ["egypt"],
        imp: { open: 2 },
        ch: { tariffCut: 0.9, access: 1.2 },
        fac: { business: 3, patriots: -2 },
      },
    ],
  },
  {
    id: "kenya",
    name: "Kenya",
    region: "africa",
    iso: "404",
    capital: { lat: -1.2921, lng: 36.8219 }, // Nairobi
    tradeShare: 0.005,
    blurb:
      "East African hub. Young workforce, thin fiscal space, and a view of every trade lane south of Suez.",
    deals: [
      {
        id: "ke_hub",
        name: "Trade and logistics hub pact",
        pc: 9,
        terms: ["Port and corridor privileges", "Investment protection"],
        need: { relation: 44 },
        homeOff: ["kenya"],
        ch: { access: 1.2, tfp: 0.02 },
        fac: { business: 4, urban: 2, patriots: -2 },
      },
      {
        id: "ke_mobility",
        name: "Skills and mobility partnership",
        pc: 10,
        terms: ["Managed migration corridors", "Mutual recognition for nurses"],
        need: { relation: 46, policyOff: ["closeBorders"] },
        homeOff: ["kenya"],
        ch: { migrate: 0.3, labour: 0.06 },
        fac: { business: 3, urban: 2, workers: -3, patriots: -6 },
      },
    ],
  },
  {
    id: "kingdom",
    name: "United Kingdom",
    region: "europe",
    iso: "826",
    capital: { lat: 51.5074, lng: -0.1278 }, // London
    tradeShare: 0.05,
    blurb:
      "An island treasury. Thin growth, hot prices, and a bond market that still sets the weather.",
    deals: [
      {
        id: "uk_services",
        name: "Services and City access",
        pc: 12,
        terms: [
          "Passporting for financial services",
          "Mutual recognition for professionals",
        ],
        need: { relation: 48 },
        imp: { open: 3 },
        ch: { access: 1.8, tfp: 0.04 },
        fac: { business: 5, urban: 2, patriots: -3 },
      },
      {
        id: "uk_defence",
        name: "Defence and intelligence compact",
        pc: 10,
        terms: ["Joint programmes and shared basing", "Intelligence liaison"],
        need: { deptMin: { defence: 2.5 } },
        ch: { access: 0.5 },
        fac: { patriots: 8, business: 2, urban: -3 },
      },
    ],
  },
];

export function resolveHomeRole(role?: string | null) {
  if (!role || role === "home") return "home";
  return role;
}
