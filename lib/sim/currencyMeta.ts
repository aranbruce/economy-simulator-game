/**
 * Currency display metadata and live cross-rates.
 * Baseline USD rates are an approximate real-world anchor, in the same
 * "stylised to the real world, orders of magnitude" spirit as realmLaws.ts;
 * the model's own fx/fx0 index moves each currency away from it every quarter.
 */
import { NATION_PROFILE } from "./nationProfiles.ts";
import { resolveHomeRole } from "./countries.ts";

export const CURRENCY_META: Record<string, { symbol: string; usdRate: number }> = {
  GBP: { symbol: "£", usdRate: 1.27 },
  EUR: { symbol: "€", usdRate: 1.08 },
  USD: { symbol: "$", usdRate: 1 },
  CNY: { symbol: "CN¥", usdRate: 0.138 },
  RUB: { symbol: "₽", usdRate: 0.0105 },
  INR: { symbol: "₹", usdRate: 0.012 },
  BRL: { symbol: "R$", usdRate: 0.185 },
  MXN: { symbol: "Mex$", usdRate: 0.05 },
  JPY: { symbol: "¥", usdRate: 0.0064 },
  AUD: { symbol: "A$", usdRate: 0.64 },
  SAR: { symbol: "SR", usdRate: 0.267 },
  AED: { symbol: "AED", usdRate: 0.272 },
  NGN: { symbol: "₦", usdRate: 0.00062 },
  ZAR: { symbol: "R", usdRate: 0.053 },
  CAD: { symbol: "C$", usdRate: 0.72 },
  KRW: { symbol: "₩", usdRate: 0.00072 },
  IDR: { symbol: "Rp", usdRate: 0.000061 },
  TRY: { symbol: "₺", usdRate: 0.023 },
  ARS: { symbol: "AR$", usdRate: 0.00072 },
  VND: { symbol: "₫", usdRate: 0.000039 },
  PLN: { symbol: "zł", usdRate: 0.245 },
  EGP: { symbol: "E£", usdRate: 0.0204 },
  KES: { symbol: "KSh", usdRate: 0.0067 },
};

/** ISO currency code for a playable seat (or partner nation). Mirrors
 *  engine.ts's currencyForSeat, kept local here to avoid a circular import. */
export function currencyForSeatId(role: any): string {
  const id = resolveHomeRole(role || "home");
  if (id === "home") return NATION_PROFILE.kingdom?.currency || "GBP";
  const p = NATION_PROFILE[id];
  return (p && p.currency) || "USD";
}

/** Baseline USD rate for `ccy`, live-adjusted by how far its fx index has
 *  moved from its own opening (fx0). Never a cached/one-time snapshot. */
export function liveUsdRate(ccy: string, fx: number, fx0: number): number {
  const base = (CURRENCY_META[ccy] || CURRENCY_META.USD).usdRate;
  return base * (fx / Math.max(0.01, fx0));
}

/** Current fx/fx0 for any currency in play, home or partner, read live off G.
 *  Any seat sharing a currency area shares one fx path, so any member of that
 *  area is a valid representative for the area's current rate. */
export function fxPairForCurrency(
  ccy: string,
  G: any,
): { fx: number; fx0: number } {
  const homeCcy = currencyForSeatId(G && G.homeRole);
  if (ccy === homeCcy) {
    return {
      fx: (G && G.econ && G.econ.fx) ?? 1,
      fx0: (G && G.econ && G.econ.fx0) ?? 1,
    };
  }
  const repSeat = Object.keys(NATION_PROFILE).find(
    (id) => NATION_PROFILE[id].currency === ccy,
  );
  const n = repSeat && G && G.econ && G.econ.nations && G.econ.nations[repSeat];
  return { fx: (n && n.fx) ?? 1, fx0: (n && n.fx0) ?? 1 };
}

/** Live cross-rate: how many units of `toCcy` one unit of `fromCcy` buys,
 *  computed fresh from this quarter's state every call — never memoised. */
export function liveRateBetween(fromCcy: string, toCcy: string, G: any): number {
  if (fromCcy === toCcy) return 1;
  const a = fxPairForCurrency(fromCcy, G);
  const b = fxPairForCurrency(toCcy, G);
  return liveUsdRate(fromCcy, a.fx, a.fx0) / liveUsdRate(toCcy, b.fx, b.fx0);
}

/** Every currency's current USD value, in one snapshot — cheap enough to
 *  call once a quarter and archive in the log row, so a historical chart can
 *  later plot any currency's movement, not only the one vs USD. Two archived
 *  rows' `native/ccy` ratio reconstructs `liveRateBetween` at that quarter. */
export function snapshotCurrencyRates(G: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ccy of Object.keys(CURRENCY_META)) {
    const { fx, fx0 } = fxPairForCurrency(ccy, G);
    out[ccy] = liveUsdRate(ccy, fx, fx0);
  }
  return out;
}

/** Readable decimals for a live rate spanning currencies from VND to KWD scale. */
export function fmtFxRate(v: number): string {
  if (!isFinite(v)) return "—";
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toPrecision(3);
}
