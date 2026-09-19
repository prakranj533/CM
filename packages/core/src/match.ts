import { normalizeRoleName, normalizeTitle } from "./slug.js";

export interface MatchableRole {
  id: string;
  name: string;
  /** Extra job titles a curator has mapped onto this role. */
  aliases?: string[];
}

export interface RoleIndexEntry {
  id: string;
  name: string;
  /** Normalized forms of the role's own name. */
  nameKeys: Set<string>;
  /** Normalized forms of curator-supplied job-title aliases. */
  aliasKeys: Set<string>;
  tokens: Set<string>;
  distinctiveTokens: Set<string>;
}

export interface RoleMatch {
  roleId: string;
  score: number;
  /** How the decision was reached — surfaced in the UI/DB for auditability. */
  reason: "alias" | "exact" | "tokens";
}

/**
 * Words that appear in so many job titles that sharing one says nothing about
 * whether two roles are the same.
 */
const GENERIC_TOKENS = new Set([
  "engineer",
  "engineering",
  "developer",
  "development",
  "specialist",
  "officer",
  "executive",
  "consultant",
  "analyst",
  "manager",
  "management",
  "remote",
  "job",
  "jobs",
  "role",
  "team",
  "exam",
  "course",
  "diploma",
  "degree",
  "certificate",
  "technology",
  "technical",
  "science",
  "general",
  "senior",
  "global",
  "data",
  "business",
  "product",
  "project",
  "service",
  "services",
  "support",
  "operations",
  "operator",
  "assistant",
  "agent",
  "partner",
  "lead",
]);

export function buildRoleIndex(roles: MatchableRole[]): RoleIndexEntry[] {
  return roles.map((role) => {
    const nameKeys = new Set<string>([normalizeRoleName(role.name), normalizeTitle(role.name)]);
    const aliasKeys = new Set<string>();
    for (const alias of role.aliases ?? []) {
      aliasKeys.add(normalizeRoleName(alias));
      // Aliases are written as job titles, so index the seniority-stripped form too.
      aliasKeys.add(normalizeTitle(alias));
    }
    nameKeys.delete("");
    aliasKeys.delete("");

    const tokens = tokenize(normalizeRoleName(role.name));
    return {
      id: role.id,
      name: role.name,
      nameKeys,
      aliasKeys,
      tokens,
      distinctiveTokens: new Set([...tokens].filter((token) => !GENERIC_TOKENS.has(token))),
    };
  });
}

function tokenize(value: string): Set<string> {
  return new Set(value.split(" ").filter((token) => token.length > 1));
}

/**
 * Match a scraped job title to a career-graph role.
 *
 * Deliberately strict, because a wrong match is worse than no match: unmatched
 * postings are still browsable, but a bad one silently pollutes that role's
 * "skills in demand" statistics. Three tiers, in order of confidence:
 *
 *   1. alias — a curator explicitly mapped this title shape to the role.
 *   2. exact — normalized job title equals the normalized role name.
 *   3. tokens — strong overlap: at least two *distinctive* shared words and
 *      most of the role's own words present.
 *
 * Roles whose name is a single distinctive word ("Finance", "Bank") only ever
 * match via tiers 1 and 2; one shared common word is not evidence.
 */
export function matchRole(title: string, index: RoleIndexEntry[], minScore = 0.6): RoleMatch | null {
  const normalizedJob = normalizeTitle(title);
  const rawJob = normalizeRoleName(title);
  if (!normalizedJob && !rawJob) return null;

  // Exact name matches outrank aliases so the reported reason is the truthful one.
  for (const entry of index) {
    if (entry.nameKeys.has(normalizedJob) || entry.nameKeys.has(rawJob)) {
      return { roleId: entry.id, score: 1, reason: "exact" };
    }
  }
  for (const entry of index) {
    if (entry.aliasKeys.has(normalizedJob) || entry.aliasKeys.has(rawJob)) {
      return { roleId: entry.id, score: 1, reason: "alias" };
    }
  }

  const jobTokens = new Set([...tokenize(normalizedJob), ...tokenize(rawJob)]);
  if (jobTokens.size === 0) return null;

  let best: RoleMatch | null = null;

  for (const entry of index) {
    if (entry.tokens.size === 0) continue;
    // Needs at least two distinctive words of its own to be matchable by overlap.
    if (entry.distinctiveTokens.size < 2) continue;

    let sharedDistinctive = 0;
    let weighted = 0;
    for (const token of entry.tokens) {
      if (!jobTokens.has(token)) continue;
      if (entry.distinctiveTokens.has(token)) {
        sharedDistinctive += 1;
        weighted += 1;
      } else {
        weighted += 0.25;
      }
    }

    if (sharedDistinctive < 2) continue;
    const score = weighted / entry.tokens.size;
    if (score >= minScore && (!best || score > best.score)) {
      best = { roleId: entry.id, score: Math.min(score, 1), reason: "tokens" };
    }
  }

  return best;
}
