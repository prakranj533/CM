import { addDays, growthFor, startOfUtcDay, type GrowthResult, type SeriesPoint } from "@career-maps/core";
import { allJobs, findJobs, findSnapshot, jobPostDatesAfter, querySnapshots, saveSnapshot } from "../store.js";

type Logger = (message: string) => void;

export type Dimension = "total" | "skill" | "role" | "source";

/**
 * Why backfilled rows never feed a trend
 * --------------------------------------
 * Job boards only expose postings that are still open, so reconstructing history
 * from JobPosting.postedAt sees progressively fewer adverts the further back you
 * look — not because fewer were published, but because old ones expired and were
 * removed. In the first real corpus that bias produced ~19 postings/week two
 * months back versus ~200 in the current week, which would read as explosive
 * growth and be entirely an artefact.
 *
 * So backfilled rows describe one honest thing — "when were the postings that are
 * open right now first published", i.e. the age profile of the board — and are
 * excluded from every growth calculation. Growth comes only from `origin: "live"`
 * captures, which compare like with like because each was measured the same way.
 */
const LIVE = "live";
const BACKFILL = "backfill";

/**
 * Record today's demand: how many postings are open (stock) and how many were
 * published today (flow), broken down by skill, role and source.
 */
export async function captureDailySnapshot(options: { day?: Date; log?: Logger } = {}): Promise<{ rows: number }> {
  const log = options.log ?? (() => undefined);
  const day = startOfUtcDay(options.day ?? new Date());
  const nextDay = addDays(day, 1);
  const [activeJobs, allJobs] = await Promise.all([findJobs({ lastSeenAfter: day }), findJobs({ postedAfter: day })]);
  const createdJobs = allJobs.filter((job) => job.postedAt && job.postedAt < nextDay);
  const rows: Array<{ dimension: Dimension; key: string; created: number; active: number }> = [
    { dimension: "total", key: "all", created: createdJobs.length, active: activeJobs.length },
  ];
  appendGroups(rows, "source", activeJobs, createdJobs, (job) => job.sourceKey);
  appendGroups(rows, "role", activeJobs, createdJobs, (job) => job.roleId);
  rows.push(...snapshotSkills(activeJobs, createdJobs));

  for (const row of rows) {
    await saveSnapshot({ id: "", day, ...row, origin: LIVE });
  }

  log(`snapshot ${day.toISOString().slice(0, 10)}: ${activeJobs.length} open, ${createdJobs.length} published today, ${rows.length} rows`);
  return { rows: rows.length };
}

function appendGroups(
  rows: Array<{ dimension: Dimension; key: string; created: number; active: number }>,
  dimension: "source" | "role",
  activeJobs: Awaited<ReturnType<typeof findJobs>>,
  createdJobs: Awaited<ReturnType<typeof findJobs>>,
  keyOf: (job: (typeof activeJobs)[number]) => string | null,
): void {
  const active = new Map<string, number>();
  const created = new Map<string, number>();
  for (const job of activeJobs) {
    const key = keyOf(job);
    if (key) active.set(key, (active.get(key) ?? 0) + 1);
  }
  for (const job of createdJobs) {
    const key = keyOf(job);
    if (key) created.set(key, (created.get(key) ?? 0) + 1);
  }
  for (const [key, count] of active) rows.push({ dimension, key, created: created.get(key) ?? 0, active: count });
}

function snapshotSkills(
  activeJobs: Awaited<ReturnType<typeof findJobs>>,
  createdJobs: Awaited<ReturnType<typeof findJobs>>,
): Array<{ dimension: Dimension; key: string; created: number; active: number }> {
  const active = new Map<string, number>();
  const created = new Map<string, number>();
  for (const job of activeJobs) for (const skill of new Set(job.skills.map((entry) => entry.name))) active.set(skill, (active.get(skill) ?? 0) + 1);
  for (const job of createdJobs) for (const skill of new Set(job.skills.map((entry) => entry.name))) created.set(skill, (created.get(skill) ?? 0) + 1);
  return [...active.entries()].map(([key, count]) => ({ dimension: "skill", key, created: created.get(key) ?? 0, active: count }));
}

/**
 * Reconstruct, per day, how many currently-open postings were published then.
 *
 * Read this as the age profile of the board, never as "jobs created that day" —
 * see the note at the top of this file.
 */
export async function backfillFromPostedAt(
  options: { days?: number; log?: Logger } = {},
): Promise<{ days: number; rows: number; postingsWithoutDate: number }> {
  const log = options.log ?? (() => undefined);
  const days = options.days ?? 120;
  const today = startOfUtcDay(new Date());
  const from = addDays(today, -days);
  const [all, dated] = await Promise.all([allJobs(), findJobs({ postedAfter: from })]);
  const postings = dated.filter((posting) => posting.postedAt && posting.postedAt < today);
  const postingsWithoutDate = all.filter((posting) => !posting.postedAt).length;

  const tally = new Map<Dimension, Map<string, Map<number, number>>>();
  const bump = (dimension: Dimension, key: string, dayMs: number): void => {
    const byKey = tally.get(dimension) ?? new Map<string, Map<number, number>>();
    const series = byKey.get(key) ?? new Map<number, number>();
    series.set(dayMs, (series.get(dayMs) ?? 0) + 1);
    byKey.set(key, series);
    tally.set(dimension, byKey);
  };

  for (const posting of postings) {
    if (!posting.postedAt) continue;
    const dayMs = startOfUtcDay(posting.postedAt).getTime();
    bump("total", "all", dayMs);
    bump("source", posting.sourceKey, dayMs);
    if (posting.roleId) bump("role", posting.roleId, dayMs);
    for (const skill of new Set(posting.skills.map((entry) => entry.name))) bump("skill", skill, dayMs);
  }

  let rows = 0;
  const daysTouched = new Set<number>();
  for (const [dimension, byKey] of tally) {
    for (const [key, series] of byKey) {
      for (const [dayMs, created] of series) {
        daysTouched.add(dayMs);
        const day = new Date(dayMs);
        const existing = await findSnapshot(day, dimension, key);
        if (existing && existing.origin === LIVE) continue;
        await saveSnapshot({ id: "", day, dimension, key, created, active: null, origin: BACKFILL });
        rows += 1;
      }
    }
  }

  log(
    `backfilled ${rows} rows across ${daysTouched.size} days from postedAt` +
      (postingsWithoutDate ? ` (${postingsWithoutDate} postings had no publish date and were skipped)` : ""),
  );
  return { days: daysTouched.size, rows, postingsWithoutDate };
}

/** Daily series for one key. `liveOnly` is the default because trends require it. */
export async function getSeries(
  dimension: Dimension,
  key: string,
  options: { days?: number; liveOnly?: boolean } = {},
): Promise<SeriesPoint[]> {
  const days = options.days ?? 120;
  const from = addDays(startOfUtcDay(new Date()), -days);
  const rows = await querySnapshots({ dimension, key, from, ...(options.liveOnly === false ? {} : { origin: LIVE }) });
  return rows.map((row) => ({ day: row.day, created: row.created }));
}

/** How many distinct days of live capture exist — i.e. can we talk about trends yet? */
export async function liveHistoryDays(): Promise<number> {
  const rows = await querySnapshots({ dimension: "total", origin: LIVE });
  return new Set(rows.map((row) => row.day.toISOString())).size;
}

export interface Mover extends GrowthResult {
  key: string;
}

/**
 * Rank keys by growth over live history.
 *
 * Returns an empty list rather than a misleading one when there is not yet enough
 * live history to cover both comparison windows.
 */
export async function topMovers(
  dimension: Dimension,
  options: { windowDays?: number; limit?: number; minSample?: number } = {},
): Promise<{ movers: Mover[]; liveDays: number; daysNeeded: number; ready: boolean }> {
  const windowDays = options.windowDays ?? 28;
  const limit = options.limit ?? 20;
  const liveDays = await liveHistoryDays();
  const daysNeeded = windowDays * 2;
  if (liveDays < daysNeeded) return { movers: [], liveDays, daysNeeded, ready: false };

  const from = addDays(startOfUtcDay(new Date()), -daysNeeded);
  const rows = await querySnapshots({ dimension, origin: LIVE, from });
  const byKey = new Map<string, SeriesPoint[]>();
  for (const row of rows) {
    const series = byKey.get(row.key) ?? [];
    series.push({ day: row.day, created: row.created });
    byKey.set(row.key, series);
  }

  const movers: Mover[] = [];
  for (const [key, series] of byKey) {
    const growth = growthFor(series, {
      windowDays,
      ...(options.minSample === undefined ? {} : { minSample: options.minSample }),
    });
    if (growth.insufficientData) continue;
    movers.push({ key, ...growth });
  }
  movers.sort((a, b) => (b.changePct ?? Number.POSITIVE_INFINITY) - (a.changePct ?? Number.POSITIVE_INFINITY));
  return { movers: movers.slice(0, limit), liveDays, daysNeeded, ready: true };
}

/**
 * Age profile of postings that are open right now, by week.
 * Honest to show today; explicitly not a growth series.
 */
export async function publicationAgeProfile(weeks = 12): Promise<Array<{ weekStart: string; postings: number }>> {
  const today = startOfUtcDay(new Date());
  const from = addDays(today, -weeks * 7);
  const postings = await jobPostDatesAfter(from);
  const buckets = new Map<string, number>();
  for (const posting of postings) {
    if (!posting.postedAt) continue;
    const day = startOfUtcDay(posting.postedAt);
    const weekStart = addDays(day, -day.getUTCDay());
    const key = weekStart.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([weekStart, postings2]) => ({ weekStart, postings: postings2 }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
