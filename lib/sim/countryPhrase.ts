/**
 * English definite-article handling for country (and a few bloc) names.
 *
 * Stored names stay bare — "United Kingdom", "United States", "The Kingdom".
 * Running prose adds "the"/"The" where English wants it, and does not double
 * an article the copy already wrote ("the {C}").
 */

const THE_EXACT = new Set([
  "bahamas",
  "congo",
  "czech republic",
  "european union",
  "gambia",
  "gulf cooperation council",
  "maldives",
  "netherlands",
  "philippines",
  "sudan",
  "uae",
  "uk",
  "united nations",
  "us",
  "usa",
]);

export function stripThe(name: string): string {
  return String(name || "")
    .trim()
    .replace(/^the\s+/i, "");
}

export function takesThe(name: string): boolean {
  const raw = String(name || "").trim();
  if (!raw) return false;
  if (/^the\s+/i.test(raw)) return true;
  const lower = stripThe(raw).toLowerCase();
  if (!lower) return false;
  if (THE_EXACT.has(lower)) return true;
  if (/^united\s+/.test(lower)) return true;
  return false;
}

/** Placeholders T() / mission copy use when no partner is in focus. */
function isPlaceholder(name: string): boolean {
  return (
    name === "a partner" ||
    name === "a rival" ||
    name === "allies" ||
    name === "the union"
  );
}

/**
 * Name for running prose. `cap` is sentence-initial ("The United Kingdom");
 * otherwise the article stays lowercase ("the United Kingdom"). Names that
 * do not take an article are returned bare ("France").
 */
export function countryPhrase(
  name: string | null | undefined,
  cap = false,
): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  if (isPlaceholder(raw)) return raw;
  const bare = stripThe(raw) || raw;
  if (!takesThe(raw)) return bare;
  return (cap ? "The " : "the ") + bare;
}

export const theCountry = (name: string | null | undefined) =>
  countryPhrase(name, false);
export const TheCountry = (name: string | null | undefined) =>
  countryPhrase(name, true);

/** Display / label form: keep a leading "The" only when the stored name has one. */
export function countryLabel(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  if (/^the\s+/i.test(raw)) return "The " + stripThe(raw);
  return raw;
}

export function precededByThe(before: string): boolean {
  const text = String(before || "").replace(/<[^>]*>/g, "");
  return /\bthe\s+$/i.test(text);
}

/** Article-aware replacement at `offset` in `full` (lowercase "the"; cap later). */
export function countryAt(full: string, offset: number, name: string): string {
  const before = String(full || "").slice(0, offset);
  if (precededByThe(before)) {
    const bare = stripThe(String(name || "").trim());
    return bare || String(name || "");
  }
  return theCountry(name);
}

export function replaceCountryToken(
  str: string,
  token: string,
  name: string,
): string {
  const escaped = token.replace(/[{}]/g, "\\$&");
  return String(str).replace(new RegExp(escaped, "g"), (_m, offset, full) =>
    countryAt(full, offset, name),
  );
}

/**
 * Capitalise a sentence-initial "the " — after start-of-string, `.?!`, or a
 * block tag, allowing intervening tags so `<p><em>the United…` still caps.
 */
export function capSentenceThe(s: string): string {
  return String(s).replace(
    /(^|[.!?]\s+|<(?:p|h[1-6]|li|div)[^>]*>)((?:\s|<[^>]+>)*)the(?=\s)/g,
    (_m, pre: string, gap: string) => pre + gap + "The",
  );
}
