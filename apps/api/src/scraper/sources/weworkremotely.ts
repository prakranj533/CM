import { absoluteUrl, cheerio, toPlainText } from "../html.js";
import { parseSalary } from "../salary.js";
import type { JobSource, RawJob, ScrapeContext } from "../types.js";

const BASE = "https://weworkremotely.com";

const CATEGORIES = [
  "/categories/remote-programming-jobs",
  "/categories/remote-design-jobs",
  "/categories/remote-product-jobs",
  "/categories/remote-devops-sysadmin-jobs",
  "/categories/remote-business-exec-management-jobs",
];

/**
 * Genuine HTML scraper: walks category listing pages, then each posting page.
 *
 * Listing markup changes every so often, so selectors are layered with fallbacks
 * and the adapter reports when a page parses to zero rows instead of failing
 * silently — that is the signal the CSS needs updating.
 */
export const weWorkRemotelySource: JobSource = {
  key: "weworkremotely",
  name: "We Work Remotely",
  homepage: BASE,
  kind: "html",

  async collect(ctx: ScrapeContext): Promise<RawJob[]> {
    const seen = new Set<string>();
    const listings: Array<{ url: string; title: string; company: string; location?: string }> = [];

    for (const category of CATEGORIES.slice(0, ctx.maxPages)) {
      if (listings.length >= ctx.maxJobs) break;
      const listingUrl = `${BASE}${category}`;
      let html: string;
      try {
        html = await ctx.fetchText(listingUrl);
      } catch (error) {
        ctx.log(`listing failed ${listingUrl}: ${(error as Error).message}`);
        continue;
      }

      const rows = parseListing(html, ctx);
      if (rows.length === 0) ctx.log(`no rows parsed from ${listingUrl} — selectors may be stale`);

      for (const row of rows) {
        if (seen.has(row.url) || listings.length >= ctx.maxJobs) continue;
        seen.add(row.url);
        listings.push(row);
      }
    }

    const jobs: RawJob[] = [];
    for (const listing of listings) {
      try {
        const detailHtml = await ctx.fetchText(listing.url);
        jobs.push(buildJob(listing, detailHtml));
      } catch (error) {
        ctx.log(`detail failed ${listing.url}: ${(error as Error).message}`);
      }
    }

    return jobs;
  },
};

function parseListing(
  html: string,
  ctx: ScrapeContext,
): Array<{ url: string; title: string; company: string; location?: string }> {
  const $ = cheerio.load(html);
  const rows: Array<{ url: string; title: string; company: string; location?: string }> = [];

  $('li a[href*="/remote-jobs/"], article a[href*="/remote-jobs/"]').each((_index, element) => {
    if (rows.length >= ctx.maxJobs) return;
    const anchor = $(element);
    const url = absoluteUrl(BASE, anchor.attr("href"));
    if (!url || !/\/remote-jobs\/[^/]+$/.test(new URL(url).pathname)) return;

    const title = text(anchor.find(".title").first()) || text(anchor.find("h3, h4").first());
    const company = text(anchor.find(".company").first()) || text(anchor.find("[class*=company]").first());
    const location = text(anchor.find(".region, .location").first());
    if (!title || !company) return;

    rows.push({ url, title, company, ...(location ? { location } : {}) });
  });

  return rows;
}

function buildJob(
  listing: { url: string; title: string; company: string; location?: string },
  detailHtml: string,
): RawJob {
  const $ = cheerio.load(detailHtml);
  const container = $(".listing-container, #job-listing-show, .lis-container__job__content__description").first();
  const description = toPlainText((container.length ? container.html() : $("body").html()) ?? "");
  const salary = parseSalary(`${listing.title}\n${description}`);
  const postedAt = $("time[datetime]").first().attr("datetime");

  return {
    externalId: new URL(listing.url).pathname.replace(/^\/remote-jobs\//, ""),
    url: listing.url,
    title: listing.title,
    company: listing.company,
    location: listing.location ?? "Remote",
    isRemote: true,
    description,
    postedAt: postedAt ? new Date(postedAt) : undefined,
    salaryMin: salary?.min,
    salaryMax: salary?.max,
    salaryCurrency: salary?.currency,
    salaryPeriod: salary?.period,
  };
}

function text(node: ReturnType<ReturnType<typeof cheerio.load>>): string {
  return node.text().replace(/\s+/g, " ").trim();
}
