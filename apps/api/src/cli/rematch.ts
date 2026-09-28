import { allJobs, allRoles } from "../store.js";
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
  const [jobs, roles] = await Promise.all([allJobs(), allRoles()]);
  const names = new Map(roles.map((role) => [role.id, role.name]));
  const groups = new Map<string, { roleId: string; reason: string | null; count: number }>();

  for (const job of jobs) {
    if (!job.roleId) continue;
    const key = `${job.roleId}\u0000${job.matchReason ?? ""}`;
    const group = groups.get(key) ?? { roleId: job.roleId, reason: job.matchReason, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }

  console.log("\nrole                          via      postings");
  for (const row of [...groups.values()].sort((a, b) => b.count - a.count)) {
    const name = (names.get(row.roleId) ?? "?").slice(0, 28).padEnd(30);
    console.log(`${name}${(row.reason ?? "-").padEnd(9)}${row.count}`);
  }
  const unmatched = jobs.filter((job) => !job.roleId).length;
  console.log(`\n${unmatched} postings remain unmatched (still browsable on the jobs board)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
