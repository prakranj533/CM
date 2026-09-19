import { fetchJson, fetchText } from "./http.js";
import { renderHtml } from "./browser.js";
import { greenhouseSource } from "./sources/greenhouse.js";
import { leverSource } from "./sources/lever.js";
import { remoteOkSource } from "./sources/remoteok.js";
import { weWorkRemotelySource } from "./sources/weworkremotely.js";
import { env } from "../env.js";
import type { JobSource, ScrapeContext } from "./types.js";

/**
 * Adding a site means writing one adapter and listing it here. Nothing else in
 * the ingest pipeline needs to change.
 */
export const SOURCES: JobSource[] = [weWorkRemotelySource, remoteOkSource, greenhouseSource, leverSource];

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
