import { env } from "../../env.js";
import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";
import { perBoardBudget, prettifyBoard, splitList } from "./shared.js";

interface AshbyJob {
  id: string;
  title?: string;
  department?: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string } | string>;
  employmentType?: string;
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
}

/**
 * Ashby's public job-board API, the same endpoint Ashby-hosted career pages call.
 * Useful for India coverage: several India-headquartered companies use it.
 */
export const ashbySource: JobSource = {
  key: "ashby",
  name: "Ashby company boards",
  homepage: "https://jobs.ashbyhq.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const boards = splitList(env.ASHBY_BOARDS);
    const jobs: RawJob[] = [];

    for (const board of boards) {
      if (jobs.length >= ctx.maxJobs) break;
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`;

      let payload: { jobs?: AshbyJob[] };
      try {
        payload = await ctx.fetchJson<{ jobs?: AshbyJob[] }>(url);
      } catch (error) {
        ctx.log(`ashby board "${board}" failed: ${(error as Error).message}`);
        continue;
      }

      const budget = perBoardBudget(ctx.maxJobs, boards.length);
      let taken = 0;

      for (const job of payload.jobs ?? []) {
        if (taken >= budget || jobs.length >= ctx.maxJobs) break;
        // isListed=false means the posting is unpublished or internal-only.
        if (job.isListed === false) continue;
        const link = job.jobUrl ?? job.applyUrl;
        if (!job.title || !link) continue;

        const description = job.descriptionPlain?.trim()
          ? job.descriptionPlain
          : toPlainText(job.descriptionHtml ?? "");
        const salary = parseSalary(`${job.title}\n${description}`);
        const location = [job.location, ...extraLocations(job.secondaryLocations)].filter(Boolean).join(" · ");

        jobs.push({
          externalId: `${board}:${job.id}`,
          url: link,
          title: job.title,
          company: prettifyBoard(board),
          location: location || undefined,
          isRemote: job.isRemote === true || /remote/i.test(job.workplaceType ?? ""),
          description,
          postedAt: parseDate(job.publishedAt),
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

function extraLocations(values: AshbyJob["secondaryLocations"]): string[] {
  if (!values?.length) return [];
  return values
    .map((entry) => (typeof entry === "string" ? entry : entry.location))
    .filter((entry): entry is string => Boolean(entry));
}
