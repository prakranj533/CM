import { parseDate, toPlainText } from "../html.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

const SITEMAP_INDEX = "https://apna.co/api/sitemap-index.xml";

/**
 * Slugs of postings for the careers students ask counsellors about most —
 * surfaced first so a capped run still collects them rather than a random
 * slice of India's largest blue/grey-collar board.
 */
const PRIORITY_PATTERNS = [
  /doctor|physician|medical|nurse|nursing|dentist|pharmac|hospital|clinic/i,
  /police|army|defen[cs]e|military|fauji/i,
  /engineer|engineering|technician|mechanic|electrician|civil/i,
  /teacher|teaching|tutor|faculty|school|educator|trainer/i,
  /scientist|research|laboratory|lab-/i,
  /business|sales|marketing|manager|accountant|finance|executive/i,
  /government|govt|ias|upsc|mpsc|clerk|sarkari/i,
];

interface ApnaJobPosting {
  "@type"?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string;
  jobLocationType?: string;
  url?: string;
  industry?: string;
  occupationalCategory?: string;
  identifier?: { value?: string | number };
  hiringOrganization?: { name?: string } | string;
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string; streetAddress?: string } }
    | Array<{ address?: { addressLocality?: string; addressRegion?: string } }>;
  baseSalary?: {
    currency?: string;
    value?: { minValue?: number | string; maxValue?: number | string; unitText?: string } | number | string;
  };
}

/**
 * apna.co — India's largest job platform for entry-level and skilled work
 * (delivery to civil engineers). No public search API, but it publishes a
 * crawler sitemap of active listings and every job page embeds schema.org
 * JobPosting JSON-LD with the full advert, so extraction stays clean.
 *
 * Cost note: one request per posting, so a run is bounded by maxJobs (200 ≈
 * ~4 min at the polite delay). Keyword-prioritised so aspiration careers land
 * inside that budget.
 */
export const apnaSource: JobSource = {
  key: "apna",
  name: "apna",
  homepage: "https://apna.co",
  kind: "html",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const urls = await jobUrls(ctx);
    if (urls.length === 0) {
      ctx.log("sitemap yielded no job URLs — index layout may have changed");
      return [];
    }

    const jobs: RawJob[] = [];
    let failures = 0;
    for (const url of urls) {
      if (jobs.length >= ctx.maxJobs) break;
      try {
        const job = parseJobPosting(await ctx.fetchText(url), url);
        if (job) jobs.push(job);
        else ctx.log(`no JobPosting data at ${url}`);
      } catch (error) {
        failures += 1;
        if (failures <= 5 || failures % 25 === 0) ctx.log(`failed ${url}: ${(error as Error).message}`);
      }
    }

    if (jobs.length === 0) ctx.log("no postings parsed — page structure looks stale");
    return jobs;
  },
};

/**
 * Walk the published sitemap index down to the listing sitemaps. Active (apna's
 * own) listings come before external partner ones, and within each group
 * keyword-matched URLs jump the queue.
 */
async function jobUrls(ctx: ScrapeContext): Promise<string[]> {
  const index = await ctx.fetchText(SITEMAP_INDEX);
  // The index links a second-level index which links the per-page listing files.
  const nested = extractLocs(index).filter((url) => url.includes("job-listing-sitemap"));
  const sitemaps: string[] = [];
  for (const url of nested) {
    sitemaps.push(...(url.endsWith(".xml") && /active|external/.test(url) ? [url] : extractLocs(await ctx.fetchText(url))));
  }
  const active = sitemaps.filter((url) => url.includes("active-job-listings"));
  const external = sitemaps.filter((url) => !url.includes("active-job-listings"));

  const urls: string[] = [];
  for (const sitemap of [...active, ...external].slice(0, Math.max(1, ctx.maxPages))) {
    try {
      urls.push(...extractLocs(await ctx.fetchText(sitemap)).filter((url) => url.includes("/job/")));
    } catch (error) {
      ctx.log(`sitemap ${sitemap} failed: ${(error as Error).message}`);
    }
  }

  const scored = urls.map((url) => ({ url, hit: PRIORITY_PATTERNS.some((pattern) => pattern.test(url)) }));
  return scored.filter((s) => s.hit).map((s) => s.url).concat(scored.filter((s) => !s.hit).map((s) => s.url));
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]!);
}

function parseJobPosting(html: string, url: string): RawJob | null {
  const blocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    let posting: ApnaJobPosting;
    try {
      posting = JSON.parse(block[1]!) as ApnaJobPosting;
    } catch {
      continue;
    }
    if (posting["@type"] !== "JobPosting" || !posting.title) continue;

    const company =
      typeof posting.hiringOrganization === "string" ? posting.hiringOrganization : posting.hiringOrganization?.name;
    const location = locationText(posting.jobLocation);
    const salary = salaryParts(posting.baseSalary);
    const remote =
      posting.jobLocationType === "TELECOMMUTE" ||
      /remote|work from home|wfh/i.test(`${posting.title} ${location}`);

    return {
      externalId: String(posting.identifier?.value ?? url.replace(/.*-(\d+)\/?$/, "$1")),
      url: posting.url ?? url,
      title: posting.title,
      company: company?.trim() || "Unknown",
      location: location || undefined,
      isRemote: remote,
      description: toPlainText(posting.description ?? ""),
      postedAt: parseDate(posting.datePosted),
      salaryMin: salary?.min,
      salaryMax: salary?.max,
      salaryCurrency: salary?.currency,
      salaryPeriod: salary?.period,
    };
  }
  return null;
}

function locationText(jobLocation: ApnaJobPosting["jobLocation"]): string {
  const place = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  const address = place?.address;
  return [address?.addressLocality, address?.addressRegion].filter(Boolean).join(", ");
}

function salaryParts(
  baseSalary: ApnaJobPosting["baseSalary"],
): { min: number; max: number; currency: string; period: string } | undefined {
  const value = baseSalary?.value;
  if (!value || typeof value !== "object") return undefined;
  const min = Number(value.minValue);
  const max = Number(value.maxValue);
  if (!Number.isFinite(min) || min <= 0) return undefined;
  const period = { month: "month", year: "year", week: "week", day: "day", hour: "hour" }[
    (value.unitText ?? "").toLowerCase()
  ];
  if (!period) return undefined;
  return { min, max: Number.isFinite(max) ? max : min, currency: baseSalary?.currency ?? "INR", period };
}
