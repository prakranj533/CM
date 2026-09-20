import { fetchJson, fetchText } from "./http.js";
import { renderHtml } from "./browser.js";
import { adzunaSource } from "./sources/adzuna.js";
import { ashbySource } from "./sources/ashby.js";
import { greenhouseSource } from "./sources/greenhouse.js";
import { himalayasSource } from "./sources/himalayas.js";
import { jobicySource } from "./sources/jobicy.js";
import { leverSource } from "./sources/lever.js";
import { remoteOkSource } from "./sources/remoteok.js";
import { remotiveSource } from "./sources/remotive.js";
import { weWorkRemotelySource } from "./sources/weworkremotely.js";
import { workingNomadsSource } from "./sources/workingnomads.js";
import { env } from "../env.js";
import type { JobSource, ScrapeContext } from "./types.js";

/**
 * Adding a site means writing one adapter and listing it here. Nothing else in
 * the ingest pipeline needs to change.
 *
 * Sources deliberately NOT included, so the reasoning isn't relitigated:
 *   - LinkedIn / Indeed / Glassdoor / Naukri: scraping breaches their terms and
 *     they actively block crawlers.
 *   - Jooble: sits behind a Cloudflare challenge.
 *   - Arbeitnow: verified zero Indian postings and German-language descriptions,
 *     which would pollute skill extraction for this audience.
 *   - NCS (ncs.gov.in): JavaScript single-page app with no documented public API.
 *   - SmartRecruiters: its robots.txt is "User-agent: * / Disallow: /" (only
 *     LinkedInBot is granted /v1/companies/), so despite being the richest
 *     keyless India source we must not crawl it.
 */
export const SOURCES: JobSource[] = [
  // India coverage
  adzunaSource,
  ashbySource,
  greenhouseSource,
  leverSource,
  // Remote-first boards (open to Indian applicants, global demand signal)
  weWorkRemotelySource,
  remoteOkSource,
  remotiveSource,
  himalayasSource,
  jobicySource,
  workingNomadsSource,
];

export function getSource(key: string): JobSource | undefined {
  return SOURCES.find((source) => source.key === key);
}

export function createScrapeContext(sourceKey: string, log: (message: string) => void): ScrapeContext {
  return {
    fetchText: (url) => fetchText(url),
    fetchJson: (url) => fetchJson(url),
    renderHtml: (url) => renderHtml(url),
    maxJobs: env.SCRAPER_MAX_JOBS_PER_SOURCE,
    maxPages: env.SCRAPER_MAX_PAGES,
    log: (message) => log(`[${sourceKey}] ${message}`),
  };
}
