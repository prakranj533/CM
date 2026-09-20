import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface JobicyJob {
  id?: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobLevel?: string;
  jobType?: string[];
  jobDescription?: string;
  jobExcerpt?: string;
  pubDate?: string;
  annualSalaryMin?: number | string | null;
  annualSalaryMax?: number | string | null;
  salaryCurrency?: string | null;
}

/** Jobicy's documented public API (v2). */
export const jobicySource: JobSource = {
  key: "jobicy",
  name: "Jobicy",
  homepage: "https://jobicy.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const count = Math.min(ctx.maxJobs, 50);
    const payload = await ctx.fetchJson<{ jobs?: JobicyJob[] }>(
      `https://jobicy.com/api/v2/remote-jobs?count=${count}`,
    );

    const jobs: RawJob[] = [];
    for (const row of payload.jobs ?? []) {
      if (jobs.length >= ctx.maxJobs) break;
      if (!row.jobTitle || !row.companyName || !row.url) continue;

      const description = toPlainText(row.jobDescription ?? row.jobExcerpt ?? "");
      const min = numeric(row.annualSalaryMin);
      const max = numeric(row.annualSalaryMax);
      const fromText = min ? null : parseSalary(description);

      jobs.push({
        externalId: String(row.id ?? row.url),
        url: row.url,
        title: row.jobTitle,
        company: row.companyName,
        location: row.jobGeo?.replace(/\s+/g, " ").trim() || "Remote",
        isRemote: true,
        description,
        postedAt: parseDate(row.pubDate),
        salaryMin: min ?? fromText?.min,
        salaryMax: max ?? fromText?.max,
        salaryCurrency: min ? (row.salaryCurrency ?? "USD") : fromText?.currency,
        // The API's salary fields are explicitly annual.
        salaryPeriod: min ? "year" : fromText?.period,
      });
    }

    return jobs;
  },
};

function numeric(value: number | string | null | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
