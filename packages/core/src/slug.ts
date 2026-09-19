/**
 * Turn a role name into a stable URL-safe slug.
 *
 * The v1 pipeline regenerated a random UUID for every node on every CSV import,
 * so links and saved data broke on each data refresh. Slugs are derived from the
 * name instead, which keeps identifiers stable across re-imports.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "role";
}

/** Slugify a list of names, appending -2, -3 … to resolve collisions. */
export function uniqueSlugs(names: string[]): Map<string, string> {
  const used = new Map<string, number>();
  const result = new Map<string, string>();
  for (const name of names) {
    const base = slugify(name);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    result.set(name, seen === 0 ? base : `${base}-${seen + 1}`);
  }
  return result;
}

/**
 * Loose comparison key for *scraped job titles*.
 *
 * Strips seniority and grade markers so "Senior Backend Engineer III" and
 * "Backend Engineer" compare equal. Do not use this on curated role names:
 * words like "entry" and "associate" are meaningful there ("Data Entry
 * Operator", "Associate Membership of…"), and removing them produced badly
 * wrong matches. Use normalizeRoleName for those.
 */
export function normalizeTitle(title: string): string {
  return stripPunctuation(title)
    .replace(
      /\b(senior|sr|junior|jr|lead|principal|staff|entry|level|i{1,3}|iv|v|intern|trainee|associate|assistant|head|of|the|a|an)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparison key for curated role names: punctuation only, no word removal. */
export function normalizeRoleName(name: string): string {
  return stripPunctuation(name)
    .replace(/\b(of|the|a|an|in|and|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunctuation(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&(amp|nbsp|quot|#\d+);/g, " ")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    // Employment-mode words describe the listing, not the role, and would
    // otherwise stop "Remote Data Entry Operator" matching "Data Entry Operator".
    .replace(/\b(remote|hybrid|onsite|on site|wfh|freelance|contract|fulltime|full time|parttime|part time)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
