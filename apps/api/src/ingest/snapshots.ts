import { addDays, growthFor, startOfUtcDay, type GrowthResult, type SeriesPoint } from "@career-maps/core";
import { prisma } from "../db.js";

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

  // "Open today" = confirmed present by a run that happened today. If no ingest
  // has run yet today this is zero, which is the truthful answer.
  const activeWhere = { lastSeenAt: { gte: day } };
  const createdWhere = { postedAt: { gte: day, lt: nextDay } };

  const rows: Array<{ dimension: Dimension; key: string; created: number; active: number }> = [];

  const [activeTotal, createdTotal] = await Promise.all([
    prisma.jobPosting.count({ where: activeWhere }),
    prisma.jobPosting.count({ where: createdWhere }),
  ]);
  rows.push({ dimension: "total", key: "all", created: createdTotal, active: activeTotal });

  for (const [dimension, field] of [
    ["source", "sourceKey"],
    ["role", "roleId"],
  ] as const) {
    const active = await prisma.jobPosting.groupBy({ by: [field], where: activeWhere, _count: { _all: true } });
    const created = await prisma.jobPosting.groupBy({ by: [field], where: createdWhere, _count: { _all: true } });
    const createdBy = new Map(created.map((row) => [row[field], row._count._all]));

    for (const row of active) {
      const key = row[field];
      if (!key) continue;
      rows.push({
        dimension,
        key,
        created: createdBy.get(key) ?? 0,
        active: row._count._all,
      });
    }
  }

  const skillRows = await snapshotSkills(activeWhere, createdWhere);
  rows.push(...skillRows);

  for (const row of rows) {
    await prisma.demandSnapshot.upsert({
      where: { day_dimension_key: { day, dimension: row.dimension, key: row.key } },
      create: { day, dimension: row.dimension, key: row.key, created: row.created, active: row.active, origin: LIVE },
      // A re-run on the same day replaces the measurement rather than doubling it.
      update: { created: row.created, active: row.active, origin: LIVE },
    });
  }

  log(`snapshot ${day.toISOString().slice(0, 10)}: ${activeTotal} open, ${createdTotal} published today, ${rows.length} rows`);
  return { rows: rows.length };
}

async function snapshotSkills(
  activeWhere: object,
  createdWhere: object,
): Promise<Array<{ dimension: Dimension; key: string; created: number; active: number }>> {
  const [activeGroups, createdGroups] = await Promise.all([
    prisma.jobSkill.groupBy({ by: ["skillId"], where: { job: activeWhere }, _count: { _all: true } }),
    prisma.jobSkill.groupBy({ by: ["skillId"], where: { job: createdWhere }, _count: { _all: true } }),
  ]);
  if (activeGroups.length === 0) return [];

  const skills = await prisma.skill.findMany({
    where: { id: { in: activeGroups.map((row) => row.skillId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(skills.map((skill) => [skill.id, skill.name]));
  const createdBy = new Map(createdGroups.map((row) => [row.skillId, row._count._all]));

  const rows: Array<{ dimension: Dimension; key: string; created: number; active: number }> = [];
  for (const row of activeGroups) {
    const name = nameById.get(row.skillId);
    if (!name) continue;
    rows.push({ dimension: "skill", key: name, created: createdBy.get(row.skillId) ?? 0, active: row._count._all });
  }
  return rows;
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

  const postings = await prisma.jobPosting.findMany({
    where: { postedAt: { gte: from, lt: today } },
    select: { postedAt: true, sourceKey: true, roleId: true, skills: { select: { skill: { select: { name: true } } } } },
  });
  const postingsWithoutDate = await prisma.jobPosting.count({ where: { postedAt: null } });

  // dimension -> key -> day(ms) -> count
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
    // De-duplicate: a posting mentioning a skill five times still counts once.
    const seen = new Set<string>();
    for (const link of posting.skills) {
      if (seen.has(link.skill.name)) continue;
      seen.add(link.skill.name);
      bump("skill", link.skill.name, dayMs);
    }
  }

  let rows = 0;
  const daysTouched = new Set<number>();

  for (const [dimension, byKey] of tally) {
    for (const [key, series] of byKey) {
      for (const [dayMs, created] of series) {
        daysTouched.add(dayMs);
        const day = new Date(dayMs);
        const existing = await prisma.demandSnapshot.findUnique({
          where: { day_dimension_key: { day, dimension, key } },
        });
        // Never overwrite a live measurement with a reconstruction.
        if (existing && existing.origin === LIVE) continue;

        await prisma.demandSnapshot.upsert({
          where: { day_dimension_key: { day, dimension, key } },
          create: { day, dimension, key, created, active: null, origin: BACKFILL },
          update: { created, active: null, origin: BACKFILL },
        });
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

  const rows = await prisma.demandSnapshot.findMany({
    where: {
      dimension,
      key,
      day: { gte: from },
      ...(options.liveOnly === false ? {} : { origin: LIVE }),
    },
    orderBy: { day: "asc" },
    select: { day: true, created: true },
  });

  return rows.map((row) => ({ day: row.day, created: row.created }));
}

/** How many distinct days of live capture exist — i.e. can we talk about trends yet? */
export async function liveHistoryDays(): Promise<number> {
  const rows = await prisma.demandSnapshot.findMany({
    where: { dimension: "total", origin: LIVE },
    select: { day: true },
    distinct: ["day"],
  });
  return rows.length;
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

  if (liveDays < daysNeeded) {
    return { movers: [], liveDays, daysNeeded, ready: false };
  }

  const from = addDays(startOfUtcDay(new Date()), -daysNeeded);
  const rows = await prisma.demandSnapshot.findMany({
    where: { dimension, origin: LIVE, day: { gte: from } },
    select: { key: true, day: true, created: true },
  });

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

  const postings = await prisma.jobPosting.findMany({
    where: { postedAt: { gte: from } },
    select: { postedAt: true },
  });

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
