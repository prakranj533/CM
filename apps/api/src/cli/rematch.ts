import { prisma } from "../db.js";
import { rematchJobs } from "../ingest/run.js";
import { syncRoleAliases } from "../ingest/roleIndex.js";

/**
 * Re-classify stored postings against the current alias map and matcher, without
 * touching the network. Use after editing src/ingest/aliases.ts.
 *
 *   npm run rematch -w @career-maps/api
 */
async function main(): Promise<void> {
  await syncRoleAliases();
  await rematchJobs();

  const rows = await prisma.jobPosting.groupBy({
    by: ["roleId", "matchReason"],
    where: { roleId: { not: null } },
    _count: { _all: true },
  });
  const roles = await prisma.role.findMany({
    where: { id: { in: rows.map((row) => row.roleId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  });
  const names = new Map(roles.map((role) => [role.id, role.name]));

  const unmatched = await prisma.jobPosting.count({ where: { roleId: null } });
  console.log("\nrole                          via      postings");
  for (const row of rows.sort((a, b) => b._count._all - a._count._all)) {
    const name = (names.get(row.roleId ?? "") ?? "?").slice(0, 28).padEnd(30);
    console.log(`${name}${(row.matchReason ?? "-").padEnd(9)}${row._count._all}`);
  }
  console.log(`\n${unmatched} postings remain unmatched (still browsable on the jobs board)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
