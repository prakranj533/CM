import { env } from "../env.js";
import { crawlDelayMs, isAllowed } from "./robots.js";
import { RobotsDisallowedError } from "./types.js";

/** Timestamp of the last request per host, so we serialize politely per domain. */
const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait out the politeness window for a host. Honours a robots.txt Crawl-delay
 * when the site declares one larger than our default.
 */
async function throttle(url: string): Promise<void> {
  const { host } = new URL(url);
  const declared = await crawlDelayMs(url);
  const delay = Math.max(env.SCRAPER_DELAY_MS, declared ?? 0);
  const previous = lastRequestAt.get(host);
  if (previous !== undefined) {
    const elapsed = Date.now() - previous;
    if (elapsed < delay) await sleep(delay - elapsed);
  }
  lastRequestAt.set(host, Date.now());
}

export interface FetchOptions {
  /** Number of additional attempts after the first failure. */
  retries?: number;
  accept?: string;
}

/**
 * Polite GET: robots-checked, rate-limited per host, timed out, and retried with
 * backoff on 429/5xx. Every scraper request goes through here.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  if (!(await isAllowed(url))) throw new RobotsDisallowedError(url);

  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await throttle(url);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": env.SCRAPER_USER_AGENT,
          accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(env.SCRAPER_TIMEOUT_MS),
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1);
        lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
        if (attempt < retries) {
          await sleep(backoff);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      // A disallow is final; retrying cannot change the answer.
      if (error instanceof RobotsDisallowedError) throw error;
      if (attempt >= retries) break;
      await sleep(1500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const body = await fetchText(url, { ...options, accept: options.accept ?? "application/json,*/*;q=0.8" });
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Response from ${url} was not valid JSON`);
  }
}
