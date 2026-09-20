import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface WorkingNomadsJob {
  url?: string;
  title?: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  tags?: string;
  location?: string;
  pub_date?: string;
}

/**
 * Working Nomads' exposed jobs feed. It returns the whole board in one response,
 * so the cap is applied client-side.
 */
export const workingNomadsSource: JobSource = {
  key: "workingnomads",
  name: "Working Nomads",
  homepage: "https://www.workingnomads.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const rows = await ctx.fetchJson<WorkingNomadsJob[]>("https://www.workingnomads.com/api/exposed_jobs/");
    if (!Array.isArray(rows)) return [];

    const jobs: RawJob[] = [];
    for (const row of rows) {
      if (jobs.length >= ctx.maxJobs) break;
      if (!row.title || !row.url || !row.company_name) continue;

      const description = toPlainText(row.description ?? "");
      const salary = parseSalary(description);

      jobs.push({
        // The feed has no id field; the numeric job path is stable.
        externalId: idFromUrl(row.url),
        url: row.url,
        title: row.title,
        company: row.company_name,
        location: row.location?.trim() || "Remote",
        isRemote: true,
        description,
        postedAt: parseDate(row.pub_date),
        salaryMin: salary?.min,
        salaryMax: salary?.max,
        salaryCurrency: salary?.currency,
        salaryPeriod: salary?.period,
      });
    }

    return jobs;
  },
};

function idFromUrl(url: string): string {
  const match = /\/job\/[^/]+\/(\d+)/.exec(url) ?? /\/(\d+)\/?$/.exec(url);
  return match?.[1] ?? url;
}
