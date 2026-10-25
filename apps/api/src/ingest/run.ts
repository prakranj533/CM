import { randomUUID } from "node:crypto";
import { extractSkills, detectSeniority, isIndiaLocation, matchRole, type RoleIndexEntry } from "@career-maps/core";
import { allJobs, allRoles, deleteJobs, findJobs, jobById, jobIdForExternal, saveJob, saveIngestRun, saveRoles, sourceByKey, searchTokens, upsertSource } from "../store.js";
import type { IngestRunRecord, JobRecord, RoleRecord } from "../firestore.js";
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
  const [roleIndex, roles] = await Promise.all([loadRoleIndex(), allRoles()]);
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const results: SourceResult[] = [];

  for (const source of selected) {
    const row = await sourceByKey(source.key);
    if (row && !row.enabled) {
      results.push({ source: source.key, status: "skipped", found: 0, created: 0, updated: 0, matched: 0 });
      continue;
    }

    const run: IngestRunRecord = {
      id: randomUUID(),
      sourceKey: source.key,
      startedAt: new Date(),
      finishedAt: null,
      status: "running",
      jobsFound: 0,
      jobsNew: 0,
      jobsMatched: 0,
      message: null,
    };
    await saveIngestRun(run);
    const result: SourceResult = { source: source.key, status: "ok", found: 0, created: 0, updated: 0, matched: 0 };

    try {
      log(`[${source.key}] collecting…`);
      const rawJobs = await source.collect(createScrapeContext(source.key, log));
      result.found = rawJobs.length;

      for (const raw of rawJobs) {
        try {
          const outcome = await persistJob(source.key, raw, roleIndex, rolesById);
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

    await saveIngestRun({
      ...run,
      status: result.status,
      finishedAt: new Date(),
      jobsFound: result.found,
      jobsNew: result.created,
      jobsMatched: result.matched,
      message: result.message ?? null,
    });
    const latestSource = await sourceByKey(source.key);
    if (latestSource) await upsertSource({ ...latestSource, lastRunAt: new Date() });
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
    const existing = await sourceByKey(source.key);
    await upsertSource({
      key: source.key,
      name: source.name,
      homepage: source.homepage,
      kind: source.kind,
      enabled: existing?.enabled ?? true,
      lastRunAt: existing?.lastRunAt ?? null,
    });
  }
}

async function persistJob(
  sourceKey: string,
  raw: RawJob,
  roleIndex: RoleIndexEntry[],
  rolesById: Map<string, RoleRecord>,
): Promise<{ created: boolean; matched: boolean }> {
  const match = matchRole(raw.title, roleIndex);
  const matchedRole = match ? rolesById.get(match.roleId) : undefined;
  const now = new Date();
  const id = jobIdForExternal(sourceKey, raw.externalId);
  const existing = await jobById(id);
  const skills = extractSkills(`${raw.title}\n${raw.description}`).map((skill) => ({
    name: skill.name,
    category: skill.category,
    mentions: skill.hits,
  }));
  const title = raw.title.trim().slice(0, 300);
  const company = raw.company.trim().slice(0, 200);
  const description = raw.description.slice(0, 40000);
  const job: JobRecord = {
    id,
    sourceKey,
    externalId: raw.externalId,
    url: raw.url,
    title,
    company,
    location: raw.location?.trim().slice(0, 200) ?? null,
    isRemote: raw.isRemote ?? false,
    inIndia: isIndiaLocation(raw.location),
    description,
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    salaryCurrency: raw.salaryCurrency ?? null,
    salaryPeriod: raw.salaryPeriod ?? null,
    seniority: detectSeniority(raw.title),
    postedAt: raw.postedAt ?? null,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    roleId: match?.roleId ?? null,
    roleSlug: matchedRole?.slug ?? null,
    roleName: matchedRole?.name ?? null,
    matchScore: match?.score ?? 0,
    matchReason: match?.reason ?? null,
    skills,
    skillNames: skills.map((skill) => skill.name),
    searchTokens: searchTokens(`${title} ${company} ${description}`),
  };

  const created = await saveJob(job);
  return { created, matched: Boolean(match) };
}

/**
 * Roll postings up into "what this role requires today".
 *
 * demand = share of the role's recent postings that mention the skill, which is
 * comparable across roles regardless of how many openings each one has.
 */
export async function recomputeRoleDemand(): Promise<void> {
  const now = new Date();
  const demandSince = new Date(now.getTime() - DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const currentSince = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const [roles, jobs] = await Promise.all([allRoles(), findJobs({ lastSeenAfter: demandSince })]);
  const currentJobs = jobs.filter((job) => job.lastSeenAt >= currentSince);
  const demandJobs = jobs.filter((job) => job.lastSeenAt >= demandSince && job.roleId);
  const jobsByRole = new Map<string, JobRecord[]>();
  const openingsByRole = new Map<string, number>();

  for (const job of currentJobs) {
    if (job.roleId) openingsByRole.set(job.roleId, (openingsByRole.get(job.roleId) ?? 0) + 1);
  }
  for (const job of demandJobs) {
    if (!job.roleId) continue;
    const list = jobsByRole.get(job.roleId) ?? [];
    list.push(job);
    jobsByRole.set(job.roleId, list);
  }

  const updated = roles.map((role) => {
    const roleJobs = jobsByRole.get(role.id) ?? [];
    const totals = new Map<string, { category: string; postings: number; mentions: number }>();
    for (const job of roleJobs) {
      for (const skill of job.skills) {
        const entry = totals.get(skill.name) ?? { category: skill.category, postings: 0, mentions: 0 };
        entry.postings += 1;
        entry.mentions += skill.mentions;
        totals.set(skill.name, entry);
      }
    }
    const marketSkills = [...totals.entries()].map(([name, value]) => ({
      name,
      category: value.category,
      origin: "jobs" as const,
      demand: roleJobs.length ? value.postings / roleJobs.length : 0,
      mentions: value.mentions,
    }));
    return {
      ...role,
      openingCount: openingsByRole.get(role.id) ?? 0,
      skills: [...role.skills.filter((skill) => skill.origin === "graph"), ...marketSkills],
    };
  });
  await saveRoles(updated, true);
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
  const roles = new Map((await allRoles()).map((role) => [role.id, role]));
  const jobs = await allJobs();
  let matched = 0;
  let changed = 0;

  for (const job of jobs) {
    const skills = extractSkills(`${job.title}\n${job.description}`).map((skill) => ({ name: skill.name, category: skill.category, mentions: skill.hits }));
    const match = matchRole(job.title, roleIndex);
    const role = match ? roles.get(match.roleId) : undefined;
    if (match) matched += 1;
    if ((match?.roleId ?? null) !== job.roleId || (match?.reason ?? null) !== job.matchReason) changed += 1;
    await saveJob({
      ...job,
      inIndia: isIndiaLocation(job.location),
      roleId: match?.roleId ?? null,
      roleSlug: role?.slug ?? null,
      roleName: role?.name ?? null,
      matchScore: match?.score ?? 0,
      matchReason: match?.reason ?? null,
      skills,
      skillNames: skills.map((skill) => skill.name),
      searchTokens: searchTokens(`${job.title} ${job.company} ${job.description}`),
    });
  }

  await recomputeRoleDemand();
  log(`reprocessed ${jobs.length} postings: skills re-extracted, ${matched} matched to roles, ${changed} changed`);
  return { total: jobs.length, matched, changed };
}

/** Drop postings no source has confirmed for a while, keeping the board current. */
export async function pruneStaleJobs(days = STALE_AFTER_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stale = await findJobs({ lastSeenBefore: cutoff });
  await deleteJobs(stale);
  await recomputeRoleDemand();
  return stale.length;
}

export function ingestEnabledSourceKeys(): string[] {
  return SOURCES.map((source) => source.key);
}
