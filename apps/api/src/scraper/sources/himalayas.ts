import { toPlainText } from "../html.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface HimalayasJob {
  title?: string;
  companyName?: string;
  description?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  currency?: string | null;
  locationRestrictions?: string[];
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
}

/** Himalayas' public jobs API. Salary comes structured, so no text parsing needed. */
export const himalayasSource: JobSource = {
  key: "himalayas",
  name: "Himalayas",
  homepage: "https://himalayas.app",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const jobs: RawJob[] = [];
    const seen = new Set<string>();
    // The API returns 20 per request regardless of a larger `limit`, but `offset`
    // pages through a board of >100k, so maxJobs (not maxPages) is the real bound.
    const pageSize = 20;
    const maxRequests = Math.min(Math.ceil(ctx.maxJobs / pageSize), 50);

    for (let page = 0; page < maxRequests; page += 1) {
      if (jobs.length >= ctx.maxJobs) break;

      let payload: { jobs?: HimalayasJob[] };
      try {
        payload = await ctx.fetchJson<{ jobs?: HimalayasJob[] }>(
          `https://himalayas.app/jobs/api?limit=${pageSize}&offset=${page * pageSize}`,
        );
      } catch (error) {
        ctx.log(`page ${page} failed: ${(error as Error).message}`);
        break;
      }

      const rows = payload.jobs ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        if (jobs.length >= ctx.maxJobs) break;
        const url = row.applicationLink ?? row.guid;
        if (!row.title || !row.companyName || !url) continue;
        // The board reorders as new jobs arrive, so paging can repeat a posting.
        const externalId = slugFromUrl(url);
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        jobs.push({
          externalId,
          url,
          title: row.title,
          company: row.companyName,
          location: row.locationRestrictions?.length ? row.locationRestrictions.join(", ") : "Remote",
          isRemote: true,
          description: toPlainText(row.description ?? ""),
          // pubDate is unix seconds, not milliseconds.
          postedAt: row.pubDate ? new Date(row.pubDate * 1000) : undefined,
          salaryMin: row.minSalary ?? undefined,
          salaryMax: row.maxSalary ?? undefined,
          salaryCurrency: row.minSalary ? (row.currency ?? "USD") : undefined,
          salaryPeriod: row.minSalary ? normalizePeriod(row.salaryPeriod) : undefined,
        });
      }
    }

    return jobs;
  },
};

function normalizePeriod(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const lowered = value.toLowerCase();
  if (lowered.startsWith("ann") || lowered === "year" || lowered === "yearly") return "year";
  if (lowered.startsWith("month")) return "month";
  if (lowered.startsWith("hour")) return "hour";
  if (lowered.startsWith("day") || lowered.startsWith("dai")) return "day";
  return undefined;
}

function slugFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, "") || url;
  } catch {
    return url;
  }
}
