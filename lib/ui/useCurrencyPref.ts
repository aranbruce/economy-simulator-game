"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  loadCurrencyPref,
  saveCurrencyPref,
  subscribeCurrencyPref,
  type CurrencyPref,
} from "./currencyPref.ts";

const SERVER_SNAPSHOT: CurrencyPref = { display: null };

/** Reactive access to the persisted display-currency preference, shared
 *  across every component that reads it (CurrencyPanel, RealmStats,
 *  TaxesPanel, …) — a change in one is visible in all the others on the
 *  next render, not just after they happen to remount. Lives outside G
 *  entirely, so it rides its own external store rather than useGame()'s
 *  bump()-driven tick. */
export function useCurrencyPref() {
  const pref = useSyncExternalStore(
    subscribeCurrencyPref,
    loadCurrencyPref,
    () => SERVER_SNAPSHOT,
  );

  const setDisplay = useCallback((display: string | null) => {
    saveCurrencyPref({ ...loadCurrencyPref(), display });
  }, []);

  return { pref, setDisplay };
}
