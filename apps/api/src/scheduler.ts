import cron from "node-cron";
import type { FastifyInstance } from "fastify";
import { pruneSessions } from "./auth/session.js";
import { env } from "./env.js";
import { pruneStaleJobs, runIngest } from "./ingest/run.js";
import { captureDailySnapshot } from "./ingest/snapshots.js";
import { invalidatePathCache } from "./routes/paths.js";

let inFlight = false;

/**
 * Daily refresh. Guarded by `inFlight` because a slow run must never overlap the
 * next tick — two concurrent passes would double-write the same postings.
 */
export async function refreshEverything(log: (message: string) => void): Promise<void> {
  if (inFlight) {
    log("skipping scheduled ingest: previous run still in progress");
    return;
  }
  inFlight = true;
  try {
    await runIngest({ log });
    // Snapshot before pruning, so the day's stock reflects what was actually
    // found rather than what survived housekeeping.
    await captureDailySnapshot({ log });
    const pruned = await pruneStaleJobs();
    const sessions = await pruneSessions();
    invalidatePathCache();
    log(`housekeeping: removed ${pruned} stale postings and ${sessions} expired sessions`);
  } catch (error) {
    log(`scheduled ingest failed: ${(error as Error).message}`);
  } finally {
    inFlight = false;
  }
}

export function startScheduler(app: FastifyInstance): void {
  const log = (message: string): void => app.log.info(message);

  if (!env.INGEST_CRON) {
    app.log.info("INGEST_CRON is empty — daily job ingestion is disabled");
  } else if (!cron.validate(env.INGEST_CRON)) {
    app.log.error(`INGEST_CRON "${env.INGEST_CRON}" is not a valid cron expression; scheduler not started`);
  } else {
    cron.schedule(env.INGEST_CRON, () => {
      void refreshEverything(log);
    });
    app.log.info(`daily job ingestion scheduled (${env.INGEST_CRON})`);
  }

  if (env.INGEST_ON_BOOT) {
    app.log.info("INGEST_ON_BOOT=true — running an ingest now");
    void refreshEverything(log);
  }
}
