import { extractSkills, detectSeniority, matchRole, type RoleIndexEntry } from "@career-maps/core";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { closeBrowser } from "../scraper/browser.js";
import { createScrapeContext, getSource, SOURCES } from "../scraper/registry.js";
import { RobotsDisallowedError, type JobSource, type RawJob } from "../scraper/types.js";
import { loadRoleIndex } from "./roleIndex.js";

export interface SourceResult {
  source: string;
  status: "ok" | "error" | "skipped";
  found: number;
  created: number;
  updated: number;
  matched: number;
  message?: string;
}

export interface IngestSummary {
  startedAt: Date;
  finishedAt: Date;
  results: SourceResult[];
}

type Logger = (message: string) => void;

/** How long a posting can go unseen before we stop counting it as current. */
const STALE_AFTER_DAYS = 45;
/** Window used when aggregating "what this role requires now". */
const DEMAND_WINDOW_DAYS = 60;

/**
 * One ingestion pass: pull every enabled source, normalize postings, extract
 * skills, link them to career-graph roles, then recompute per-role demand.
 *
 * Each source is isolated — a site changing its markup or going down degrades that
 * one adapter and is recorded in IngestRun, rather than failing the whole job.
 */
export async function runIngest(options: { sourceKeys?: string[]; log?: Logger } = {}): Promise<IngestSummary> {
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = new Date();

  const selected: JobSource[] = options.sourceKeys?.length
    ? options.sourceKeys.map((key) => {
        const source = getSource(key);
        if (!source) throw new Error(`Unknown source "${key}". Known: ${SOURCES.map((s) => s.key).join(", ")}`);
        return source;
      })
    : SOURCES;

  await ensureSourceRows(selected);

  const roleIndex = await loadRoleIndex();
  const skillCache = new Map<string, string>();
  const results: SourceResult[] = [];

  for (const source of selected) {
    const row = await prisma.source.findUnique({ where: { key: source.key } });
    if (row && !row.enabled) {
      results.push({ source: source.key, status: "skipped", found: 0, created: 0, updated: 0, matched: 0 });
      continue;
    }

    const run = await prisma.ingestRun.create({ data: { sourceKey: source.key, status: "running" } });
    const result: SourceResult = { source: source.key, status: "ok", found: 0, created: 0, updated: 0, matched: 0 };

    try {
      log(`[${source.key}] collecting…`);
      const rawJobs = await source.collect(createScrapeContext(source.key, log));
      result.found = rawJobs.length;

      for (const raw of rawJobs) {
        try {
          const outcome = await persistJob(source.key, raw, roleIndex, skillCache);
          if (outcome.created) result.created += 1;
          else result.updated += 1;
          if (outcome.matched) result.matched += 1;
        } catch (error) {
          log(`[${source.key}] could not store ${raw.url}: ${(error as Error).message}`);
        }
      }

      log(`[${source.key}] ${result.found} found, ${result.created} new, ${result.matched} matched to roles`);
    } catch (error) {
      result.status = "error";
      result.message =
        error instanceof RobotsDisallowedError
          ? `blocked by robots.txt: ${error.message}`
          : (error as Error).message;
      log(`[${source.key}] FAILED: ${result.message}`);
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        status: result.status,
        finishedAt: new Date(),
        jobsFound: result.found,
        jobsNew: result.created,
        jobsMatched: result.matched,
        message: result.message ?? null,
      },
    });
    await prisma.source.update({ where: { key: source.key }, data: { lastRunAt: new Date() } });

    results.push(result);
  }

  await closeBrowser();
  await recomputeRoleDemand();

  const summary: IngestSummary = { startedAt, finishedAt: new Date(), results };
  const total = results.reduce((sum, r) => sum + r.created, 0);
  log(`ingest finished: ${total} new postings across ${results.length} source(s)`);
  return summary;
}

async function ensureSourceRows(sources: JobSource[]): Promise<void> {
  for (const source of sources) {
    await prisma.source.upsert({
      where: { key: source.key },
      create: { key: source.key, name: source.name, homepage: source.homepage, kind: source.kind },
      update: { name: source.name, homepage: source.homepage, kind: source.kind },
    });
  }
}

async function persistJob(
  sourceKey: string,
  raw: RawJob,
  roleIndex: RoleIndexEntry[],
  skillCache: Map<string, string>,
): Promise<{ created: boolean; matched: boolean }> {
  const match = matchRole(raw.title, roleIndex);
  const seniority = detectSeniority(raw.title);
  const now = new Date();

  const data = {
    sourceKey,
    externalId: raw.externalId,
    url: raw.url,
    title: raw.title.trim().slice(0, 300),
    company: raw.company.trim().slice(0, 200),
    location: raw.location?.trim().slice(0, 200) ?? null,
    isRemote: raw.isRemote ?? false,
    description: raw.description.slice(0, 40000),
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    salaryCurrency: raw.salaryCurrency ?? null,
    salaryPeriod: raw.salaryPeriod ?? null,
    seniority,
    postedAt: raw.postedAt ?? null,
    roleId: match?.roleId ?? null,
    matchScore: match?.score ?? 0,
    matchReason: match?.reason ?? null,
    lastSeenAt: now,
  };

  const existing = await prisma.jobPosting.findUnique({
    where: { sourceKey_externalId: { sourceKey, externalId: raw.externalId } },
    select: { id: true },
  });

  const job = existing
    ? await prisma.jobPosting.update({ where: { id: existing.id }, data })
    : await prisma.jobPosting.create({ data: { ...data, firstSeenAt: now } });

  // Skills are re-derived on every pass so taxonomy improvements apply to the
  // whole corpus, not only to newly discovered postings.
  await syncJobSkills(job.id, `${raw.title}\n${raw.description}`, skillCache);

  return { created: !existing, matched: Boolean(match) };
}

/** Replace a posting's extracted skills from its text. */
async function syncJobSkills(jobId: string, text: string, skillCache: Map<string, string>): Promise<number> {
  const skills = extractSkills(text);
  await prisma.jobSkill.deleteMany({ where: { jobId } });
  for (const skill of skills) {
    const skillId = await resolveSkillId(skill.name, skill.category, skillCache);
    await prisma.jobSkill.create({ data: { jobId, skillId, mentions: skill.hits } });
  }
  return skills.length;
}

async function resolveSkillId(name: string, category: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const skill = await prisma.skill.upsert({
    where: { name },
    create: { name, category },
    update: { category },
  });
  cache.set(name, skill.id);
  return skill.id;
}

/**
 * Roll postings up into "what this role requires today".
 *
 * demand = share of the role's recent postings that mention the skill, which is
 * comparable across roles regardless of how many openings each one has.
 */
export async function recomputeRoleDemand(): Promise<void> {
  const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const roleIds = (
    await prisma.jobPosting.findMany({
      where: { roleId: { not: null }, lastSeenAt: { gte: since } },
      select: { roleId: true },
      distinct: ["roleId"],
    })
  )
    .map((row) => row.roleId)
    .filter((id): id is string => Boolean(id));

  for (const roleId of roleIds) {
    const jobs = await prisma.jobPosting.findMany({
      where: { roleId, lastSeenAt: { gte: since } },
      select: { id: true, skills: { select: { skillId: true, mentions: true } } },
    });
    if (jobs.length === 0) continue;

    const totals = new Map<string, { postings: number; mentions: number }>();
    for (const job of jobs) {
      for (const link of job.skills) {
        const entry = totals.get(link.skillId) ?? { postings: 0, mentions: 0 };
        entry.postings += 1;
        entry.mentions += link.mentions;
        totals.set(link.skillId, entry);
      }
    }

    await prisma.roleSkill.deleteMany({ where: { roleId, origin: "jobs" } });
    for (const [skillId, entry] of totals) {
      await prisma.roleSkill.create({
        data: {
          roleId,
          skillId,
          origin: "jobs",
          demand: entry.postings / jobs.length,
          mentions: entry.mentions,
        },
      });
    }
  }
}

/**
 * Reprocess postings already in the database: re-extract skills with the current
 * taxonomy and re-apply title→role matching, then rebuild demand.
 *
 * Runs entirely offline, so tuning the taxonomy or aliases can be validated
 * against the real corpus in seconds instead of re-scraping every source.
 */
export async function rematchJobs(
  log: Logger = console.log,
): Promise<{ total: number; matched: number; changed: number }> {
  const roleIndex = await loadRoleIndex();
  const skillCache = new Map<string, string>();
  const jobs = await prisma.jobPosting.findMany({
    select: { id: true, title: true, description: true, roleId: true, matchReason: true },
  });

  let matched = 0;
  let changed = 0;

  for (const job of jobs) {
    await syncJobSkills(job.id, `${job.title}\n${job.description}`, skillCache);

    const match = matchRole(job.title, roleIndex);
    if (match) matched += 1;
    // Compare the reason too: a posting can keep its role while the evidence for
    // it changes (e.g. an alias was added that now explains an overlap match).
    if ((match?.roleId ?? null) === job.roleId && (match?.reason ?? null) === job.matchReason) continue;
    await prisma.jobPosting.update({
      where: { id: job.id },
      data: {
        roleId: match?.roleId ?? null,
        matchScore: match?.score ?? 0,
        matchReason: match?.reason ?? null,
      },
    });
    changed += 1;
  }

  await recomputeRoleDemand();
  log(`reprocessed ${jobs.length} postings: skills re-extracted, ${matched} matched to roles, ${changed} changed`);
  return { total: jobs.length, matched, changed };
}

/** Drop postings no source has confirmed for a while, keeping the board current. */
export async function pruneStaleJobs(days = STALE_AFTER_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobPosting.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  return count;
}

export function ingestEnabledSourceKeys(): string[] {
  return SOURCES.map((source) => source.key);
}
