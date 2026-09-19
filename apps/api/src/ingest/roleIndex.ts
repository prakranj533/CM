import { buildRoleIndex, type RoleIndexEntry } from "@career-maps/core";
import { prisma } from "../db.js";
import { ROLE_ALIASES } from "./aliases.js";

/** Load roles plus their curated aliases and build the matcher index. */
export async function loadRoleIndex(): Promise<RoleIndexEntry[]> {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, aliases: { select: { alias: true } } },
  });

  return buildRoleIndex(
    roles.map((role) => ({
      id: role.id,
      name: role.name,
      aliases: role.aliases.map((entry) => entry.alias),
    })),
  );
}

/**
 * Write the curated alias map into the database, replacing whatever was there.
 * Aliases are keyed by slug, and unknown slugs are reported rather than ignored so
 * a typo in aliases.ts cannot silently disable matching for a role.
 */
export async function syncRoleAliases(log: (message: string) => void = console.log): Promise<void> {
  const slugs = Object.keys(ROLE_ALIASES);
  const roles = await prisma.role.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(roles.map((role) => [role.slug, role.id]));

  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) log(`warning: aliases reference unknown role slugs: ${missing.join(", ")}`);

  await prisma.roleAlias.deleteMany({});

  let count = 0;
  for (const [slug, aliases] of Object.entries(ROLE_ALIASES)) {
    const roleId = bySlug.get(slug);
    if (!roleId) continue;
    for (const alias of aliases) {
      await prisma.roleAlias.create({ data: { roleId, alias } });
      count += 1;
    }
  }
  log(`synced ${count} role aliases across ${slugs.length - missing.length} roles`);
}
