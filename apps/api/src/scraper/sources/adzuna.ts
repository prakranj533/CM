import { env } from "../../env.js";
import { parseDate, toPlainText } from "../html.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

interface AdzunaResult {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_is_predicted?: string;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

const RESULTS_PER_PAGE = 50;

/**
 * Adzuna's official jobs API — the one source here with genuine, high-volume Indian
 * coverage (set ADZUNA_COUNTRY=in) plus structured salaries.
 *
 * Requires free credentials from https://developer.adzuna.com. Without them the
 * adapter reports a clear, actionable message instead of failing obscurely.
 *
 * Caveat worth knowing: Adzuna returns a *truncated* description snippet, not the
 * full advert, so skill extraction from this source is much sparser than from the
 * boards. It is valuable for volume, location and salary signal rather than for
 * detailed requirements.
 */
export const adzunaSource: JobSource = {
  key: "adzuna",
  name: "Adzuna",
  homepage: "https://www.adzuna.com",
  kind: "board",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      throw new Error(
        "Adzuna needs credentials. Get a free key at https://developer.adzuna.com and set ADZUNA_APP_ID and ADZUNA_APP_KEY in apps/api/.env",
      );
    }

    const country = env.ADZUNA_COUNTRY.toLowerCase();
    const jobs: RawJob[] = [];
    const pages = Math.max(1, Math.min(ctx.maxPages, Math.ceil(ctx.maxJobs / RESULTS_PER_PAGE)));

    for (let page = 1; page <= pages; page += 1) {
      if (jobs.length >= ctx.maxJobs) break;

      const params = new URLSearchParams({
        app_id: env.ADZUNA_APP_ID,
        app_key: env.ADZUNA_APP_KEY,
        results_per_page: String(RESULTS_PER_PAGE),
        "content-type": "application/json",
      });
      if (env.ADZUNA_QUERY) params.set("what", env.ADZUNA_QUERY);

      const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}?${params.toString()}`;

      let payload: { results?: AdzunaResult[]; count?: number };
      try {
        payload = await ctx.fetchJson<{ results?: AdzunaResult[]; count?: number }>(url);
      } catch (error) {
        const message = (error as Error).message;
        // A 401 here means the keys are wrong, which no amount of retrying fixes.
        if (message.includes("401")) {
          throw new Error(`Adzuna rejected the credentials (AUTH_FAIL). Check ADZUNA_APP_ID / ADZUNA_APP_KEY.`);
        }
        ctx.log(`adzuna page ${page} failed: ${message}`);
        break;
      }

      const results = payload.results ?? [];
      if (results.length === 0) break;

      for (const row of results) {
        if (jobs.length >= ctx.maxJobs) break;
        if (!row.title || !row.redirect_url) continue;

        const location = row.location?.display_name ?? row.location?.area?.join(", ");
        // salary_is_predicted="1" means Adzuna estimated it rather than the advert
        // stating it, so we drop it instead of presenting a guess as fact.
        const predicted = row.salary_is_predicted === "1";

        jobs.push({
          externalId: String(row.id ?? row.redirect_url),
          url: row.redirect_url,
          title: row.title,
          company: row.company?.display_name?.trim() || "Unknown",
          location,
          isRemote: /remote|work from home|wfh/i.test(`${row.title} ${row.description ?? ""} ${location ?? ""}`),
          description: toPlainText(row.description ?? ""),
          postedAt: parseDate(row.created),
          salaryMin: predicted ? undefined : (row.salary_min ?? undefined),
          salaryMax: predicted ? undefined : (row.salary_max ?? undefined),
          salaryCurrency: predicted ? undefined : currencyFor(country),
          salaryPeriod: predicted || !row.salary_min ? undefined : "year",
        });
      }
    }

    return jobs;
  },
};

/** Adzuna reports salaries in the country's own currency without labelling it. */
function currencyFor(country: string): string {
  const map: Record<string, string> = {
    in: "INR",
    gb: "GBP",
    us: "USD",
    ca: "CAD",
    au: "AUD",
    de: "EUR",
    fr: "EUR",
    nl: "EUR",
    at: "EUR",
    it: "EUR",
    es: "EUR",
    sg: "SGD",
    nz: "NZD",
    za: "ZAR",
    br: "BRL",
    mx: "MXN",
    pl: "PLN",
    ru: "RUB",
  };
  return map[country] ?? "USD";
}
