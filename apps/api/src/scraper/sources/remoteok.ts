import { parseDate, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface RemoteOkRow {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  salary_min?: number | string;
  salary_max?: number | string;
  date?: string;
  url?: string;
  apply_url?: string;
  legal?: string;
}

/**
 * RemoteOK publishes its board as JSON for exactly this purpose. The first row of
 * the array is a legal/attribution notice rather than a job, so it is skipped.
 */
export const remoteOkSource: JobSource = {
  key: "remoteok",
  name: "RemoteOK",
  homepage: "https://remoteok.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const rows = await ctx.fetchJson<RemoteOkRow[]>("https://remoteok.com/api");
    if (!Array.isArray(rows)) return [];

    const jobs: RawJob[] = [];
    for (const row of rows) {
      if (jobs.length >= ctx.maxJobs) break;
      if (row.legal || !row.position || !row.company) continue;

      const url = row.url ?? row.apply_url;
      const externalId = String(row.id ?? row.slug ?? "");
      if (!url || !externalId) continue;

      // Tags are deliberately NOT folded into the description. Posters here
      // tag broadly for reach ("golang, java, ios, …" on a non-engineering role),
      // and appending them made the skill extractor attribute skills the advert
      // never asked for. The description is the honest signal.
      const body = toPlainText(row.description ?? "");
      const salaryFromText = parseSalary(body);
      const min = numeric(row.salary_min) ?? salaryFromText?.min;
      const max = numeric(row.salary_max) ?? salaryFromText?.max;

      jobs.push({
        externalId,
        url,
        title: row.position,
        company: row.company,
        location: row.location?.trim() || "Remote",
        isRemote: true,
        description: body,
        postedAt: parseDate(row.date),
        salaryMin: min,
        salaryMax: max,
        salaryCurrency: min ? (salaryFromText?.currency ?? "USD") : undefined,
        salaryPeriod: min ? (salaryFromText?.period ?? "year") : undefined,
      });
    }

    return jobs;
  },
};

function numeric(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
