import { prisma } from "../db.js";
import { pruneStaleJobs, runIngest } from "../ingest/run.js";
import { closeBrowser } from "../scraper/browser.js";
import { SOURCES } from "../scraper/registry.js";

/**
 * Run one ingestion pass from the terminal — the same code path the daily
 * scheduler uses.
 *
 *   npm run ingest                       # every source
 *   npm run ingest -- remoteok lever     # only the named sources
 *   npm run ingest -- --list             # show available sources
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    for (const source of SOURCES) console.log(`${source.key.padEnd(16)} ${source.kind.padEnd(6)} ${source.name}`);
    return;
  }

  const sourceKeys = args.filter((arg) => !arg.startsWith("--"));
  const summary = await runIngest({
    ...(sourceKeys.length ? { sourceKeys } : {}),
    log: (message) => console.log(message),
  });

  const pruned = await pruneStaleJobs();
  if (pruned > 0) console.log(`removed ${pruned} postings not seen recently`);

  console.log("\nsource            status    found   new  matched");
  for (const result of summary.results) {
    console.log(
      `${result.source.padEnd(18)}${result.status.padEnd(10)}${String(result.found).padStart(5)}${String(result.created).padStart(6)}${String(result.matched).padStart(9)}`,
    );
    if (result.message) console.log(`  └─ ${result.message}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  });
