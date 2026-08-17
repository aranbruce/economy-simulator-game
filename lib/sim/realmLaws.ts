/**
 * Starting statute book by playable seat. Overlays on baseLaw(): taxes, NI,
 * income schedule, spending shares, policies already in force, and vice law.
 * Figures are stylised to the real-world bloc behind each realm (IMF Fiscal
 * Monitor / WEO, OECD revenue stats — orders of magnitude), then clamped to
 * the model's instrument ranges.
 *
 * Opening macros (debt, deficit, inflation, trend) live in NATION_PROFILE.
 * This file is statute only. The engine stays UK-calibrated; otherRevAdj still
 * plugs the opening deficit to NATION_PROFILE after settle.
 */

/** Deep-merge overlay onto a cloned base law. Both are the untyped engine.js
 * law bag shape — real typing lands with Phase 4's engine.js pass. */
export function applyRealmLawOverlay(law: any, overlay: any) {
  if (!overlay) return law;
  if (overlay.tariff != null) law.tariff = overlay.tariff;
  if (overlay.tariffCountry) {
    if (!law.tariffSchedule) {
      law.tariffSchedule = { default: law.tariff, bloc: {}, country: {}, cet: null };
    }
    if (!law.tariffSchedule.country) law.tariffSchedule.country = {};
    Object.assign(law.tariffSchedule.country, overlay.tariffCountry);
  }
  if (overlay.spend) {
    for (const id in overlay.spend) {
      if (law.spend[id] != null) law.spend[id] = overlay.spend[id];
    }
  }
  if (overlay.taxes) {
    for (const id in overlay.taxes) {
      if (!law.taxes[id]) continue;
      const o = overlay.taxes[id];
      if (o.on != null) law.taxes[id].on = !!o.on;
      if (o.rate != null) law.taxes[id].rate = o.rate;
    }
  }
  if (overlay.income) {
    Object.assign(law.income, overlay.income);
    if (overlay.income.bands)
      law.income.bands = overlay.income.bands.map((b: any) => ({ ...b }));
  }
  if (overlay.ni) Object.assign(law.ni, overlay.ni);
  if (overlay.minWage) Object.assign(law.minWage, overlay.minWage);
  if (overlay.policies) {
    for (const id in overlay.policies) {
      if (overlay.policies[id]) law.policies[id] = true;
      else delete law.policies[id];
    }
  }
  if (overlay.vice) Object.assign(law.vice, overlay.vice);
  if (overlay.deals) {
    if (!law.deals) law.deals = {};
    for (const id in overlay.deals) {
      if (overlay.deals[id]) law.deals[id] = true;
      else delete law.deals[id];
    }
  }
  return law;
}

/**
 * Per-seat overlays keyed by country id. `home` / `kingdom` carry UK FTA
 * country rates; missing keys fall back to UK baseLaw.
 * Income thresholds stay in the game's £ units; rates and shares do the flavour.
 */
const UK_FTA_RATES = {
  japan: 1,
  australia: 1,
  korea: 1,
  canada: 1,
  vietnam: 1,
  mexico: 1,
};

export const REALM_LAW: Record<string, any> = {
  /* UK residual preference with continuity FTAs. EU partners stay on the
     default / CET — the UK is outside the union, and zeroing those duties
     at t=0 blows the opening-growth settle. */
  home: { tariffCountry: UK_FTA_RATES },
  kingdom: { tariffCountry: UK_FTA_RATES },
  /* Gaul Republic (France): standard VAT 20%, the OECD's heaviest social
     protection bill, defence at the NATO 2% outturn, ETS-ish carbon,
     CBAM / net-zero pathway. */
  france: {
    tariff: 2,
    spend: {
      health: 9.0,
      education: 4.7,
      infra: 3.2,
      research: 0.9,
      welfare: 20.0,
      defence: 2.1,
      justice: 1.7,
      environment: 1.1,
    },
    taxes: {
      vat: { on: true, rate: 20 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 12 },
      inherit: { on: true, rate: 30 },
      capGains: { on: true, rate: 26 },
      fuel: { on: true, rate: 10 },
      ftt: { on: true, rate: 0.1 },
    },
    income: {
      allowance: 11000,
      bands: [
        { from: 11000, rate: 20 },
        { from: 45000, rate: 42 },
        { from: 120000, rate: 45 },
      ],
      divRate: 30,
      saveRate: 25,
    },
    ni: { empOn: true, erOn: true, empRate: 10, erRate: 14 },
    /* SMIC — generous relative to median pay by European standards. */ minWage:
      { on: true, rate: 12 },
    policies: {
      minWage: true,
      netZero: true,
      cbam: true,
      childcare: true,
      socialCare: true,
      fiscalRule: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Federated States (US): no federal VAT, payroll taxes, defence ~3.4% GDP, estate
     tax on, state-level cannabis → legal & dutied, light labour regulation.
     Public health (Medicare + Medicaid + VA) outweighs the UK's; cash welfare
     (Social Security + income security) sits well below it. */
  united_states: {
    tariff: 4,
    deals: { cw_fta: true },
    spend: {
      health: 9.2,
      education: 4.8,
      infra: 2.4,
      research: 0.95,
      welfare: 8.5,
      defence: 3.5,
      justice: 2.0,
      environment: 0.5,
    },
    taxes: {
      vat: { on: false, rate: 0 },
      /* Combined federal + average state statutory, matching the file's
         combined-rate convention (Germany / Japan at 30). */
      corpTax: { on: true, rate: 26 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: true, rate: 40 },
      capGains: { on: true, rate: 20 },
      fuel: { on: true, rate: 4 },
      airDuty: { on: true, rate: 8 },
      ftt: { on: false, rate: 0 },
      cannabisDuty: { on: true, rate: 15 },
    },
    income: {
      allowance: 14000,
      bands: [
        { from: 14000, rate: 12 },
        { from: 55000, rate: 24 },
        { from: 180000, rate: 37 },
      ],
      divRate: 20,
      saveRate: 20,
    },
    ni: { empOn: true, erOn: true, empRate: 6, erRate: 6 },
    /* Federal floor ($7.25/hr) is notoriously low relative to income —
       many states run well above it, but there is no national floor near
       what the allowance scale would otherwise suggest. */ minWage: {
      on: true,
      rate: 8,
    },
    policies: {
      minWage: true,
      planning: true,
      dereg: true,
      openVisas: true,
      fracking: true,
    },
    vice: {
      cannabis: "legal",
      psychedelics: "medical",
      gambling: "liberal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Eastern Republic (China): VAT 13, investment-led (infra + research), thinner welfare, strict
     vice and borders, digital ID / industrial strategy on. */
  china: {
    tariff: 8,
    spend: {
      health: 3.0,
      education: 3.8,
      infra: 5.5,
      research: 1.4,
      welfare: 6.5,
      defence: 1.7,
      justice: 1.5,
      environment: 0.9,
    },
    taxes: {
      vat: { on: true, rate: 13 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: true, rate: 4 },
      inherit: { on: false, rate: 0 },
      capGains: { on: true, rate: 20 },
      wealthTax: { on: false, rate: 0 },
      fuel: { on: true, rate: 6 },
    },
    income: {
      allowance: 8000,
      bands: [
        { from: 8000, rate: 10 },
        { from: 40000, rate: 25 },
        { from: 100000, rate: 45 },
      ],
      divRate: 20,
      saveRate: 20,
    },
    ni: { empOn: true, erOn: true, empRate: 8, erRate: 16 },
    /* Provincial minimum wages exist nationwide but sit modestly below
       typical income, with patchier enforcement than developed markets. */ minWage:
      { on: true, rate: 5 },
    policies: {
      rnd: true,
      skills: true,
      digitalId: true,
      closeBorders: true,
      fiscalRule: true,
    },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Northern Reach (Russia): mineral/windfall state, war-economy defence,
     mildly progressive labour tax (2025 reform), liberal alcohol, tight
     society and borders. */
  russia: {
    tariff: 8,
    spend: {
      health: 3.7,
      education: 3.4,
      infra: 3.2,
      research: 0.55,
      welfare: 10.0,
      defence: 6.5,
      justice: 2.0,
      environment: 0.4,
    },
    taxes: {
      /* VAT 20 → 22 from January 2026. */
      vat: { on: true, rate: 22 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      windfall: { on: true, rate: 25 },
      fuel: { on: true, rate: 5 },
    },
    income: {
      allowance: 7000,
      /* 2025 progressive scale (13/15/18…22) via dual capital + rising top —
         divRate === saveRate so isDualCapital(law) derives true on open. */
      bands: [
        { from: 7000, rate: 13 },
        { from: 60000, rate: 15 },
        { from: 200000, rate: 18 },
      ],
      divRate: 15,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 10, erRate: 12 },
    /* MROT set nationally by decree; modest relative to typical earnings. */ minWage:
      { on: true, rate: 4 },
    policies: { conscript: true, nuclear: true, police: true, fracking: true },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "liberal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Lotus Republic (India): GST ~18, thin public health, rising infra, heavy tobacco,
     digital ID, gambling banned. */
  india: {
    tariff: 12,
    spend: {
      health: 2.0,
      education: 4.0,
      infra: 4.2,
      research: 0.55,
      welfare: 5.5,
      defence: 2.3,
      justice: 1.4,
      environment: 0.5,
    },
    taxes: {
      vat: { on: true, rate: 18 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: true, rate: 3 },
      inherit: { on: false, rate: 0 },
      tobaccoDuty: { on: true, rate: 75 },
      fuel: { on: true, rate: 9 },
    },
    income: {
      allowance: 6000,
      bands: [
        { from: 6000, rate: 5 },
        { from: 35000, rate: 20 },
        { from: 100000, rate: 30 },
      ],
      divRate: 20,
      saveRate: 20,
    },
    ni: { empOn: true, erOn: true, empRate: 4, erRate: 8 },
    /* Minimum Wages Act / Code on Wages coverage, but low relative to
       income and unevenly enforced across states and sectors. */ minWage: {
      on: true,
      rate: 3,
    },
    policies: {
      openVisas: false,
      skills: true,
      digitalId: true,
      minWage: true,
    },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Green Coast Republic (Nigeria): a genuinely thin state (real general
     government runs near 13% of GDP), higher tariffs, commodity windfall,
     visitor levy, light carbon. Shares below sit above reality but are the
     closest the UK-calibrated instrument ranges allow. */
  nigeria: {
    tariff: 10,
    spend: {
      health: 2.5,
      education: 2.5,
      infra: 2.8,
      research: 0.35,
      welfare: 4.0,
      defence: 1.0,
      justice: 1.2,
      environment: 0.45,
    },
    taxes: {
      vat: { on: true, rate: 7.5 },
      corpTax: { on: true, rate: 28 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      windfall: { on: true, rate: 20 },
      fuel: { on: true, rate: 6 },
      touristLevy: { on: true, rate: 8 },
    },
    income: {
      allowance: 5000,
      bands: [
        { from: 5000, rate: 10 },
        { from: 30000, rate: 25 },
        { from: 80000, rate: 35 },
      ],
      divRate: 20,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 5, erRate: 7 },
    /* National Minimum Wage Act, raised substantially in 2024 (₦70,000/mo)
       but still modest in absolute terms and unevenly enforced. */ minWage: {
      on: true,
      rate: 3,
    },
    policies: { openVisas: true, skills: true, police: true },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Atlantic Federation (Brazil): the world's heaviest consumption taxes
     (reform IVA lands near 27%), pension-heavy welfare (RGPS + RPPS alone
     run near 12% of GDP), corp at the IRPJ + CSLL 34%, notoriously thin
     public investment, cannabis decriminalised patchwork, social housing. */
  brazil: {
    tariff: 11,
    spend: {
      health: 4.2,
      education: 4.7,
      infra: 1.8,
      research: 0.45,
      welfare: 13.0,
      defence: 1.3,
      justice: 1.8,
      environment: 0.55,
    },
    taxes: {
      vat: { on: true, rate: 27 },
      corpTax: { on: true, rate: 34 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: true, rate: 4 },
      inherit: { on: true, rate: 20 },
      fuel: { on: true, rate: 7 },
    },
    income: {
      allowance: 7500,
      bands: [
        { from: 7500, rate: 15 },
        { from: 40000, rate: 27 },
        { from: 110000, rate: 35 },
      ],
      divRate: 20,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 7, erRate: 12 },
    /* Salário mínimo — a major, actively-uprated national institution. */ minWage:
      { on: true, rate: 5 },
    policies: { minWage: true, socialHousing: true, openVisas: true },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Southern Cross (Australia): GST 10, corp ~30, no inheritance tax, solid welfare, net zero,
     open visas; employee NI off (payroll/super flavour via employer only). */
  australia: {
    tariff: 3,
    tariffCountry: { kingdom: 1 },
    deals: { king_services: true },
    spend: {
      health: 6.8,
      education: 4.6,
      infra: 3.0,
      research: 0.6,
      welfare: 9.5,
      defence: 2.0,
      justice: 1.8,
      environment: 0.9,
    },
    taxes: {
      vat: { on: true, rate: 10 },
      corpTax: { on: true, rate: 30 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: true, rate: 8 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 9 },
      tobaccoDuty: { on: true, rate: 70 },
    },
    income: {
      allowance: 18000,
      bands: [
        { from: 18000, rate: 19 },
        { from: 45000, rate: 32 },
        { from: 120000, rate: 45 },
      ],
      divRate: 30,
      saveRate: 19,
    },
    ni: { empOn: false, erOn: true, empRate: 0, erRate: 11 },
    /* National Minimum Wage — one of the highest in the world in both
       absolute and relative terms. */ minWage: { on: true, rate: 19 },
    policies: {
      minWage: true,
      netZero: true,
      openVisas: true,
      skills: true,
      fiscalRule: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "medical",
      gambling: "liberal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Desert Kingdom (Saudi): no personal income tax or NI, VAT 15, oil windfall, high defence,
     SWF, subsidised fuel, strict vice. */
  saudi: {
    tariff: 5,
    spend: {
      health: 3.3,
      education: 4.2,
      infra: 4.5,
      research: 0.4,
      welfare: 3.5,
      defence: 7.0,
      justice: 1.5,
      environment: 0.35,
    },
    taxes: {
      vat: { on: true, rate: 15 },
      corpTax: { on: true, rate: 20 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      capGains: { on: false, rate: 0 },
      windfall: { on: true, rate: 40 },
      fuel: { on: true, rate: 1 },
    },
    income: {
      on: false,
      allowance: 20000,
      bands: [
        { from: 20000, rate: 0 },
        { from: 80000, rate: 0 },
        { from: 200000, rate: 0 },
      ],
      divRate: 0,
      saveRate: 0,
    },
    ni: { empOn: false, erOn: false, empRate: 0, erRate: 0 },
    /* A wage floor exists only for Saudi nationals (Saudization/Nitaqat),
       not the foreign workforce that is the majority of the private
       sector — off, since there is no broad statutory minimum. */ minWage: {
      on: false,
      rate: 0,
    },
    policies: {
      swf: true,
      nuclear: true,
      closeBorders: true,
      conscript: true,
      fracking: true,
    },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "banned",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Laurentian Federation (Canada): GST 5, carbon, open visas, dual lean. */
  canada: {
    tariff: 3,
    tariffCountry: { kingdom: 1 },
    spend: {
      health: 8.0,
      education: 4.8,
      infra: 2.8,
      research: 0.6,
      welfare: 10.5,
      defence: 2.0,
      justice: 1.6,
      environment: 1.0,
    },
    taxes: {
      vat: { on: true, rate: 5 },
      corpTax: { on: true, rate: 26 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 14 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 8 },
    },
    income: {
      allowance: 15000,
      bands: [
        { from: 15000, rate: 15 },
        { from: 55000, rate: 29 },
        { from: 150000, rate: 33 },
      ],
      /* divRate === saveRate so isDualCapital(law) derives true on open. */ divRate: 25,
      saveRate: 25,
    },
    ni: { empOn: true, erOn: true, empRate: 6, erRate: 8 },
    /* Provincial minimum wages nationwide, solid mid-to-upper generosity. */ minWage:
      { on: true, rate: 15 },
    policies: {
      openVisas: true,
      skills: true,
      netZero: true,
      minWage: true,
      fiscalRule: true,
    },
    vice: {
      cannabis: "legal",
      psychedelics: "medical",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Morning Calm Republic (Korea): high education/research, competitive corp, ageing. */
  korea: {
    tariff: 4,
    tariffCountry: { kingdom: 1 },
    spend: {
      health: 5.5,
      education: 4.8,
      infra: 3.2,
      research: 1.4,
      welfare: 8.0,
      defence: 2.6,
      justice: 1.4,
      environment: 0.6,
    },
    taxes: {
      vat: { on: true, rate: 10 },
      /* 24 national + local surtax ≈ 26 combined. */
      corpTax: { on: true, rate: 26 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: true, rate: 6 },
      inherit: { on: true, rate: 40 },
      fuel: { on: true, rate: 8 },
    },
    income: {
      allowance: 8000,
      bands: [
        { from: 8000, rate: 6 },
        { from: 40000, rate: 24 },
        { from: 120000, rate: 42 },
      ],
      divRate: 25,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 7, erRate: 10 },
    /* Single national minimum wage, substantially raised in recent years. */ minWage:
      { on: true, rate: 8 },
    policies: {
      skills: true,
      rnd: true,
      minWage: true,
      digitalId: true,
      conscript: true,
    },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Nusantara Union (Indonesia): lighter welfare, higher tariffs, younger demography. */
  indonesia: {
    tariff: 8,
    spend: {
      health: 2.0,
      education: 3.5,
      infra: 3.0,
      research: 0.3,
      welfare: 3.5,
      defence: 0.8,
      justice: 1.2,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 12 },
      corpTax: { on: true, rate: 22 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 5 },
      touristLevy: { on: true, rate: 6 },
    },
    income: {
      allowance: 4500,
      bands: [
        { from: 4500, rate: 5 },
        { from: 28000, rate: 25 },
        { from: 90000, rate: 35 },
      ],
      divRate: 20,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 4, erRate: 6 },
    /* Provincial UMP system; modest relative to income. */ minWage: {
      on: true,
      rate: 3,
    },
    policies: { skills: true, minWage: true, openVisas: false },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Anatolian Republic (Türkiye): VAT-heavy, elevated defence, inflation-era rates. */
  turkey: {
    tariff: 6,
    spend: {
      health: 4.0,
      education: 3.8,
      infra: 3.0,
      research: 0.5,
      welfare: 7.5,
      defence: 2.2,
      justice: 1.5,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 20 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: false, rate: 0 },
      inherit: { on: true, rate: 15 },
      fuel: { on: true, rate: 7 },
    },
    income: {
      allowance: 6000,
      bands: [
        { from: 6000, rate: 15 },
        { from: 35000, rate: 27 },
        { from: 100000, rate: 40 },
      ],
      divRate: 20,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 9, erRate: 14 },
    /* Asgari ücret — risen sharply in nominal terms and now a large share
       (over half) of the average wage. */ minWage: { on: true, rate: 4 },
    policies: { conscript: true, minWage: true, police: true },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Pampas Confederation (Argentina): VAT-heavy, thin fiscal space, commodity
     lean, public works slashed, armed forces run on a shoestring. */
  argentina: {
    tariff: 13,
    spend: {
      health: 5.0,
      education: 4.2,
      infra: 1.5,
      research: 0.35,
      welfare: 9.0,
      defence: 0.5,
      justice: 1.6,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 21 },
      corpTax: { on: true, rate: 35 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 6 },
      windfall: { on: true, rate: 15 },
    },
    income: {
      allowance: 5000,
      bands: [
        { from: 5000, rate: 15 },
        { from: 30000, rate: 30 },
        { from: 90000, rate: 35 },
      ],
      divRate: 15,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 8, erRate: 14 },
    /* SMVM exists but has been persistently eroded by high inflation. */ minWage:
      { on: true, rate: 2.5 },
    policies: { minWage: true, socialHousing: true },
    vice: {
      cannabis: "legal",
      psychedelics: "banned",
      gambling: "liberal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Red River Republic (Vietnam): manufacturing state, light welfare, high tariff. */
  vietnam: {
    tariff: 9,
    tariffCountry: { kingdom: 1 },
    spend: {
      health: 2.6,
      education: 3.6,
      infra: 4.0,
      research: 0.4,
      welfare: 3.0,
      defence: 2.2,
      justice: 1.2,
      environment: 0.35,
    },
    taxes: {
      vat: { on: true, rate: 10 },
      corpTax: { on: true, rate: 20 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 5 },
    },
    income: {
      allowance: 4000,
      bands: [
        { from: 4000, rate: 5 },
        { from: 25000, rate: 20 },
        { from: 80000, rate: 35 },
      ],
      divRate: 15,
      saveRate: 10,
    },
    ni: { empOn: true, erOn: true, empRate: 4, erRate: 8 },
    /* Regional minimum wage system; modest relative to income. */ minWage: {
      on: true,
      rate: 2.5,
    },
    policies: { skills: true, minWage: true, openVisas: false },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Vistula Republic (Poland): near-continental VAT/welfare, elevated defence. */
  poland: {
    tariff: 3,
    spend: {
      health: 5.5,
      education: 4.5,
      infra: 3.5,
      research: 0.7,
      welfare: 14.0,
      defence: 4.2,
      justice: 1.6,
      environment: 0.7,
    },
    taxes: {
      vat: { on: true, rate: 23 },
      corpTax: { on: true, rate: 19 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: true, rate: 8 },
      inherit: { on: true, rate: 20 },
      fuel: { on: true, rate: 9 },
    },
    income: {
      allowance: 10000,
      bands: [
        { from: 10000, rate: 12 },
        { from: 45000, rate: 32 },
        { from: 120000, rate: 32 },
      ],
      divRate: 19,
      saveRate: 19,
    },
    ni: { empOn: true, erOn: true, empRate: 9, erRate: 12 },
    /* Actively and substantially uprated in recent years — a solid floor. */ minWage:
      { on: true, rate: 8 },
    policies: { minWage: true, skills: true, fiscalRule: true, nuclear: true },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Nile Republic (Egypt): tourism/canal lean, thin public capital, higher tariff. */
  egypt: {
    tariff: 10,
    spend: {
      health: 2.8,
      education: 3.2,
      infra: 3.0,
      research: 0.25,
      welfare: 5.0,
      defence: 1.2,
      justice: 1.4,
      environment: 0.3,
    },
    taxes: {
      vat: { on: true, rate: 14 },
      corpTax: { on: true, rate: 22 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 4 },
      touristLevy: { on: true, rate: 10 },
    },
    income: {
      allowance: 4000,
      bands: [
        { from: 4000, rate: 10 },
        { from: 25000, rate: 25 },
        { from: 80000, rate: 30 },
      ],
      divRate: 15,
      saveRate: 10,
    },
    ni: { empOn: true, erOn: true, empRate: 5, erRate: 8 },
    /* Private-sector minimum wage was only formalised/raised recently
       (~2024); still weakly enforced. */ minWage: { on: true, rate: 2.5 },
    policies: { conscript: true, closeBorders: false, police: true },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Highlands Republic (Kenya): young demography, thinner state, visitor levy. */
  kenya: {
    tariff: 10,
    spend: {
      health: 2.5,
      education: 4.0,
      infra: 3.2,
      research: 0.25,
      welfare: 2.5,
      defence: 1.2,
      justice: 1.4,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 16 },
      corpTax: { on: true, rate: 30 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 6 },
      touristLevy: { on: true, rate: 8 },
    },
    income: {
      allowance: 3500,
      bands: [
        { from: 3500, rate: 10 },
        { from: 22000, rate: 25 },
        { from: 70000, rate: 35 },
      ],
      divRate: 15,
      saveRate: 10,
    },
    ni: { empOn: true, erOn: true, empRate: 4, erRate: 6 },
    /* Sector/region wage-board system; patchy enforcement, modest levels. */ minWage:
      { on: true, rate: 2 },
    policies: { skills: true, openVisas: true, police: true },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Rhine Federation (Germany): near-continental VAT/ETS; higher research;
     fiscal-rule lean; slightly lower welfare than France. */
  germany: {
    tariff: 2,
    spend: {
      health: 9.5,
      education: 4.6,
      infra: 2.6,
      research: 1.1,
      welfare: 17.5,
      defence: 2.4,
      justice: 1.6,
      environment: 1.0,
    },
    taxes: {
      vat: { on: true, rate: 19 },
      corpTax: { on: true, rate: 30 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 14 },
      inherit: { on: true, rate: 30 },
      capGains: { on: true, rate: 25 },
      fuel: { on: true, rate: 10 },
      ftt: { on: true, rate: 0.1 },
    },
    income: {
      allowance: 11000,
      bands: [
        { from: 11000, rate: 14 },
        { from: 45000, rate: 42 },
        { from: 120000, rate: 45 },
      ],
      divRate: 26,
      saveRate: 25,
    },
    ni: { empOn: true, erOn: true, empRate: 10, erRate: 15 },
    /* Mindestlohn, introduced 2015 — now a well-established national floor. */ minWage:
      { on: true, rate: 10 },
    policies: {
      minWage: true,
      netZero: true,
      cbam: true,
      fiscalRule: true,
      skills: true,
      rnd: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Tyrrhenian States (Italy): VAT 22; heavier welfare; softer defence. */
  italy: {
    tariff: 2,
    spend: {
      health: 7.0,
      education: 4.0,
      infra: 2.4,
      research: 0.55,
      welfare: 17.5,
      defence: 1.5,
      justice: 1.6,
      environment: 0.8,
    },
    taxes: {
      vat: { on: true, rate: 22 },
      corpTax: { on: true, rate: 24 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 10 },
      inherit: { on: true, rate: 8 },
      capGains: { on: true, rate: 26 },
      fuel: { on: true, rate: 10 },
      touristLevy: { on: true, rate: 6 },
    },
    income: {
      allowance: 9000,
      bands: [
        { from: 9000, rate: 23 },
        { from: 40000, rate: 35 },
        { from: 100000, rate: 43 },
      ],
      divRate: 26,
      saveRate: 26,
    },
    ni: { empOn: true, erOn: true, empRate: 10, erRate: 14 },
    /* Italy has no statutory minimum wage — pay floors come from sectoral
       collective bargaining agreements instead, one of the few EU
       countries without a legal minimum. */ minWage: { on: false, rate: 0 },
    policies: {
      minWage: true,
      netZero: true,
      socialCare: true,
      fiscalRule: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "liberal",
      alcohol: "liberal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Iberian Republic (Spain): VAT 21; tourism levy; softer defence. */
  spain: {
    tariff: 2,
    spend: {
      health: 7.5,
      education: 4.2,
      infra: 2.5,
      research: 0.6,
      welfare: 15.0,
      defence: 1.3,
      justice: 1.5,
      environment: 0.9,
    },
    taxes: {
      vat: { on: true, rate: 21 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 10 },
      inherit: { on: true, rate: 25 },
      fuel: { on: true, rate: 9 },
      touristLevy: { on: true, rate: 8 },
    },
    income: {
      allowance: 10000,
      bands: [
        { from: 10000, rate: 19 },
        { from: 42000, rate: 37 },
        { from: 110000, rate: 45 },
      ],
      divRate: 23,
      saveRate: 19,
    },
    ni: { empOn: true, erOn: true, empRate: 6, erRate: 14 },
    /* SMI has risen over 50% since 2018 — now fairly generous relative to
       income. */ minWage: { on: true, rate: 10 },
    policies: {
      minWage: true,
      netZero: true,
      childcare: true,
      openVisas: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Low Countries (Netherlands): VAT 21; very open; competitive corp; FTT off. */
  netherlands: {
    tariff: 1,
    spend: {
      health: 8.5,
      education: 5.0,
      infra: 3.0,
      research: 0.95,
      welfare: 13.5,
      defence: 2.1,
      justice: 1.6,
      environment: 1.1,
    },
    taxes: {
      vat: { on: true, rate: 21 },
      corpTax: { on: true, rate: 25 },
      digitalTax: { on: true, rate: 3 },
      carbon: { on: true, rate: 12 },
      inherit: { on: true, rate: 20 },
      fuel: { on: true, rate: 10 },
      ftt: { on: false, rate: 0 },
    },
    income: {
      allowance: 12000,
      bands: [
        { from: 12000, rate: 19 },
        { from: 48000, rate: 37 },
        { from: 120000, rate: 49 },
      ],
      divRate: 26,
      saveRate: 19,
    },
    ni: { empOn: true, erOn: true, empRate: 8, erRate: 12 },
    /* Wettelijk minimumloon — a solid European-standard wage floor. */ minWage:
      { on: true, rate: 11 },
    policies: {
      minWage: true,
      netZero: true,
      openVisas: true,
      fiscalRule: true,
      planning: true,
    },
    vice: {
      cannabis: "legal",
      psychedelics: "medical",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "licensed",
    },
  },

  /* Sunrise Republic (Mexico): VAT 16; lighter welfare than Brazil; cannabis decrim. */
  mexico: {
    tariff: 6,
    tariffCountry: { kingdom: 1 },
    spend: {
      health: 3.0,
      education: 3.8,
      infra: 2.4,
      research: 0.35,
      welfare: 5.5,
      defence: 0.7,
      justice: 1.6,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 16 },
      corpTax: { on: true, rate: 30 },
      digitalTax: { on: true, rate: 2 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      fuel: { on: true, rate: 6 },
    },
    income: {
      allowance: 5500,
      bands: [
        { from: 5500, rate: 10 },
        { from: 32000, rate: 25 },
        { from: 90000, rate: 35 },
      ],
      divRate: 15,
      saveRate: 15,
    },
    ni: { empOn: true, erOn: true, empRate: 5, erRate: 10 },
    /* Salario mínimo rose sharply through the late 2010s/2020s reforms;
       still modest in absolute terms but much improved relative to before. */ minWage:
      { on: true, rate: 4 },
    policies: { minWage: true, openVisas: true, skills: true },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },

  /* Rising Sun Federation (Japan): consumption tax 10; high health/welfare;
     corp ~30; ageing; strict vice. */
  japan: {
    tariff: 3,
    tariffCountry: { kingdom: 1 },
    spend: {
      health: 9.0,
      education: 3.5,
      infra: 3.2,
      research: 0.85,
      welfare: 14.0,
      defence: 1.8,
      justice: 1.2,
      environment: 0.6,
    },
    taxes: {
      vat: { on: true, rate: 10 },
      corpTax: { on: true, rate: 30 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: true, rate: 6 },
      inherit: { on: true, rate: 45 },
      fuel: { on: true, rate: 8 },
      tobaccoDuty: { on: true, rate: 70 },
    },
    income: {
      allowance: 8000,
      bands: [
        { from: 8000, rate: 10 },
        { from: 40000, rate: 33 },
        { from: 120000, rate: 45 },
      ],
      divRate: 20,
      saveRate: 20,
    },
    ni: { empOn: true, erOn: true, empRate: 10, erRate: 12 },
    /* Prefecture-set regional minimum wage; moderate and rising. */ minWage: {
      on: true,
      rate: 6,
    },
    policies: {
      fiscalRule: true,
      skills: true,
      nuclear: true,
      digitalId: true,
    },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Emirates League (UAE): no PIT/NI; VAT 5; high infra/defence; SWF; strict vice. */
  uae: {
    tariff: 4,
    spend: {
      health: 3.5,
      education: 3.8,
      infra: 5.0,
      research: 0.5,
      welfare: 2.5,
      defence: 4.5,
      justice: 1.4,
      environment: 0.4,
    },
    taxes: {
      vat: { on: true, rate: 5 },
      corpTax: { on: true, rate: 9 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: false, rate: 0 },
      inherit: { on: false, rate: 0 },
      capGains: { on: false, rate: 0 },
      windfall: { on: true, rate: 25 },
      fuel: { on: true, rate: 2 },
      touristLevy: { on: true, rate: 5 },
    },
    income: {
      on: false,
      allowance: 20000,
      bands: [
        { from: 20000, rate: 0 },
        { from: 80000, rate: 0 },
        { from: 200000, rate: 0 },
      ],
      divRate: 0,
      saveRate: 0,
    },
    ni: { empOn: false, erOn: false, empRate: 0, erRate: 0 },
    /* No broad statutory minimum wage for the private-sector/expatriate
       workforce that makes up the vast majority of employment. */ minWage: {
      on: false,
      rate: 0,
    },
    policies: { swf: true, openVisas: true, planning: true, nuclear: true },
    vice: {
      cannabis: "banned",
      psychedelics: "banned",
      gambling: "banned",
      alcohol: "banned",
      tobacco: "legal",
      adult: "banned",
    },
  },

  /* Cape Republic (South Africa): VAT 15; elevated welfare/justice; mining windfall. */
  south_africa: {
    tariff: 8,
    spend: {
      health: 4.5,
      education: 5.5,
      infra: 2.8,
      research: 0.4,
      welfare: 6.0,
      defence: 0.7,
      justice: 2.2,
      environment: 0.5,
    },
    taxes: {
      vat: { on: true, rate: 15 },
      corpTax: { on: true, rate: 27 },
      digitalTax: { on: false, rate: 0 },
      carbon: { on: true, rate: 4 },
      inherit: { on: true, rate: 20 },
      windfall: { on: true, rate: 20 },
      fuel: { on: true, rate: 7 },
    },
    income: {
      allowance: 6000,
      bands: [
        { from: 6000, rate: 18 },
        { from: 35000, rate: 31 },
        { from: 100000, rate: 45 },
      ],
      divRate: 20,
      saveRate: 18,
    },
    ni: { empOn: true, erOn: true, empRate: 4, erRate: 8 },
    /* National Minimum Wage Act (2019) — a moderate, actively-enforced
       policy priority. */ minWage: { on: true, rate: 4 },
    policies: {
      minWage: true,
      skills: true,
      police: true,
      socialHousing: true,
    },
    vice: {
      cannabis: "decrim",
      psychedelics: "banned",
      gambling: "legal",
      alcohol: "legal",
      tobacco: "legal",
      adult: "decrim",
    },
  },
};
