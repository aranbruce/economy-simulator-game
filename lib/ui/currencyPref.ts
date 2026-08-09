/** Persist the player's chosen display currency across games (unlike
 *  G.sandbox, this survives New Game — it's a UI preference, not game
 *  state). Mirrors lib/mp/session.ts's localStorage pattern.
 *
 *  Module-level cache + subscriber list rather than per-component useState:
 *  CurrencyPanel (TradePanel), RealmStats and TaxesPanel each read this
 *  independently, and a change made in one must be visible in the others
 *  without waiting for them to unmount/remount. Pairs with
 *  useSyncExternalStore in useCurrencyPref.ts. */

const KEY = "econ-currency-pref";

export interface CurrencyPref {
  /** ISO code, or null to mean "native" — whatever the played nation's own
   *  currency currently is. Reset to null at the start of every new game
   *  (see GameApp.tsx's beginGame) so a prior explicit choice never sticks
   *  to a nation it no longer applies to. */
  display: string | null;
}

const DEFAULT_PREF: CurrencyPref = { display: null };

function readFromStorage(): CurrencyPref {
  if (typeof localStorage === "undefined") return DEFAULT_PREF;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREF;
    const data = JSON.parse(raw);
    return {
      display: data && data.display != null ? String(data.display) : null,
    };
  } catch {
    return DEFAULT_PREF;
  }
}

let cached: CurrencyPref = readFromStorage();
const listeners = new Set<() => void>();

/** Current preference. Returns the same object reference until the next
 *  saveCurrencyPref(), which useSyncExternalStore relies on to know whether
 *  anything actually changed. */
export function loadCurrencyPref(): CurrencyPref {
  return cached;
}

export function saveCurrencyPref(pref: CurrencyPref) {
  cached = pref;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(pref));
    } catch {
      /* private mode / quota */
    }
  }
  listeners.forEach((fn) => fn());
}

export function subscribeCurrencyPref(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
