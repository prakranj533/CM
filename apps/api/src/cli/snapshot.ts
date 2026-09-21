import { prisma } from "../db.js";
import {
  backfillFromPostedAt,
  captureDailySnapshot,
  liveHistoryDays,
  publicationAgeProfile,
} from "../ingest/snapshots.js";

/**
 * Record today's demand snapshot, or reconstruct the board's age profile.
 *
 *   npm run snapshot -w @career-maps/api              # capture today
 *   npm run snapshot -w @career-maps/api -- --backfill
 *   npm run snapshot -w @career-maps/api -- --status
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--backfill")) {
    await backfillFromPostedAt({ log: console.log });
  } else if (!args.includes("--status")) {
    await captureDailySnapshot({ log: console.log });
  }

  const liveDays = await liveHistoryDays();
  const profile = await publicationAgeProfile(12);

  console.log(`\nlive capture days recorded: ${liveDays}`);
  if (liveDays < 56) {
    console.log(
      `28-day trend comparisons need 56 days of live capture — ${56 - liveDays} more daily runs to go.`,
    );
  }

  if (profile.length) {
    console.log("\npublication dates of postings currently open (NOT a growth series —");
    console.log("expired postings are invisible, so older weeks are always understated):");
    const max = Math.max(...profile.map((row) => row.postings));
    for (const row of profile) {
      const bar = "#".repeat(Math.max(1, Math.round((row.postings / max) * 48)));
      console.log(`  ${row.weekStart}  ${bar} ${row.postings}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
