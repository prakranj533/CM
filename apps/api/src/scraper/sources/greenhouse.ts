import { env } from "../../env.js";
import { decodeEscapedHtmlToText, parseDate } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  content?: string;
  location?: { name?: string };
  offices?: Array<{ name?: string }>;
}

/**
 * Greenhouse exposes every customer's board at a documented JSON endpoint, which
 * is how company career pages render themselves. Add or remove companies with the
 * GREENHOUSE_BOARDS env var.
 */
export const greenhouseSource: JobSource = {
  key: "greenhouse",
  name: "Greenhouse company boards",
  homepage: "https://boards.greenhouse.io",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const boards = splitList(env.GREENHOUSE_BOARDS);
    const jobs: RawJob[] = [];

    for (const board of boards) {
      if (jobs.length >= ctx.maxJobs) break;
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;

      let payload: { jobs?: GreenhouseJob[] };
      try {
        payload = await ctx.fetchJson<{ jobs?: GreenhouseJob[] }>(url);
      } catch (error) {
        // One misspelled or closed board must not abort the others.
        ctx.log(`greenhouse board "${board}" failed: ${(error as Error).message}`);
        continue;
      }

      const perBoard = Math.max(1, Math.floor(ctx.maxJobs / Math.max(boards.length, 1)));
      let taken = 0;

      for (const job of payload.jobs ?? []) {
        if (taken >= perBoard || jobs.length >= ctx.maxJobs) break;
        if (!job.title || !job.absolute_url) continue;

        const description = decodeEscapedHtmlToText(job.content ?? "");
        const salary = parseSalary(`${job.title}\n${description}`);
        const location = job.location?.name ?? job.offices?.[0]?.name;

        jobs.push({
          externalId: `${board}:${job.id}`,
          url: job.absolute_url,
          title: job.title,
          company: prettifyBoard(board),
          location,
          isRemote: /remote/i.test(location ?? "") || /remote/i.test(job.title),
          description,
          postedAt: parseDate(job.updated_at),
          salaryMin: salary?.min,
          salaryMax: salary?.max,
          salaryCurrency: salary?.currency,
          salaryPeriod: salary?.period,
        });
        taken += 1;
      }
    }

    return jobs;
  },
};

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function prettifyBoard(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
