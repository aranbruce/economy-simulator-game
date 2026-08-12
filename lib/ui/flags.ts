/** Realm id (matches lib/sim/boardMetrics.ts's REALM_FILL keys) → ISO 3166-1
 *  alpha-2 code, for the real flag SVGs in public/flags/ (sourced from the
 *  MIT-licensed flag-icons project). "home"/"kingdom" is the player's
 *  default UK-shaped seat. */
export const FLAG_CODE: Record<string, string> = {
  home: "gb",
  kingdom: "gb",
  germany: "de",
  france: "fr",
  italy: "it",
  spain: "es",
  netherlands: "nl",
  poland: "pl",
  united_states: "us",
  canada: "ca",
  china: "cn",
  russia: "ru",
  india: "in",
  brazil: "br",
  mexico: "mx",
  argentina: "ar",
  japan: "jp",
  korea: "kr",
  australia: "au",
  indonesia: "id",
  vietnam: "vn",
  turkey: "tr",
  saudi: "sa",
  uae: "ae",
  nigeria: "ng",
  south_africa: "za",
  egypt: "eg",
  kenya: "ke",
};

export function flagSrc(realmId: string): string {
  return `/flags/${FLAG_CODE[realmId] || "gb"}.svg`;
}
