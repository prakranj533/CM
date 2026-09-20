import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface RemotiveJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

/**
 * Remotive publishes its board as JSON for public use.
 *
 * `tags` is deliberately ignored: some posters list every language they have ever
 * touched (".Net, C, C#, C++, golang, java, ios, …" on a single posting), which
 * would inject skills the role does not actually require. The HTML description is
 * the trustworthy signal.
 */
export const remotiveSource: JobSource = {
  key: "remotive",
  name: "Remotive",
  homepage: "https://remotive.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const limit = Math.min(ctx.maxJobs, 100);
    const payload = await ctx.fetchJson<{ jobs?: RemotiveJob[] }>(
      `https://remotive.com/api/remote-jobs?limit=${limit}`,
    );

    const jobs: RawJob[] = [];
    for (const row of payload.jobs ?? []) {
      if (jobs.length >= ctx.maxJobs) break;
      if (!row.title || !row.url || !row.company_name) continue;

      const description = toPlainText(row.description ?? "");
      // `salary` is free text when present ("$60k - $80k", "competitive", "").
      const salary = parseSalary(`${row.salary ?? ""}\n${description}`);

      jobs.push({
        externalId: String(row.id ?? row.url),
        url: row.url,
        title: row.title,
        company: row.company_name,
        location: row.candidate_required_location?.trim() || "Remote",
        isRemote: true,
        description,
        postedAt: parseDate(row.publication_date),
        salaryMin: salary?.min,
        salaryMax: salary?.max,
        salaryCurrency: salary?.currency,
        salaryPeriod: salary?.period,
      });
    }

    return jobs;
  },
};
