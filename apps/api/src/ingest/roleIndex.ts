import { buildRoleIndex, type RoleIndexEntry } from "@career-maps/core";
import { allRoles, saveRoles } from "../store.js";
import { ROLE_ALIASES } from "./aliases.js";

/** Load roles plus their curated aliases and build the matcher index. */
export async function loadRoleIndex(): Promise<RoleIndexEntry[]> {
  const roles = await allRoles();
  return buildRoleIndex(roles.map((role) => ({ id: role.id, name: role.name, aliases: role.aliases ?? [] })));
}

/**
 * Write the curated alias map into the database, replacing whatever was there.
 * Aliases are keyed by slug, and unknown slugs are reported rather than ignored so
 * a typo in aliases.ts cannot silently disable matching for a role.
 */
export async function syncRoleAliases(log: (message: string) => void = console.log): Promise<void> {
  const roles = await allRoles();
  const bySlug = new Map(roles.map((role) => [role.slug, role]));
  const slugs = Object.keys(ROLE_ALIASES);
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) log(`warning: aliases reference unknown role slugs: ${missing.join(", ")}`);
  const aliasesById = new Map(roles.map((role) => [role.id, ROLE_ALIASES[role.slug] ?? []]));
  await saveRoles(roles.map((role) => ({ ...role, aliases: aliasesById.get(role.id) ?? [] })), true);
  log(`synced ${slugs.length - missing.length} curated role aliases`);
}
