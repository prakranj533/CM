import robotsParserImport from "robots-parser";
import { env } from "../env.js";

/**
 * robots-parser is CommonJS (`module.exports = fn`) but its .d.ts uses
 * `export default`, so under NodeNext resolution TypeScript binds the namespace
 * rather than the callable. The interop is correct at runtime; re-type it here.
 */
interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
}

const robotsParser = robotsParserImport as unknown as (url: string, contents: string) => Robot;

const cache = new Map<string, Promise<Robot | null>>();

/**
 * Fetch and cache robots.txt per origin.
 *
 * A missing or erroring robots.txt is treated as "no rules" (allow), which is the
 * conventional reading; a 5xx would ideally mean "disallow everything", but that
 * would make a flaky host silently halt all ingestion, so we log and continue.
 */
function loadRobots(origin: string): Promise<Robot | null> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const pending = (async (): Promise<Robot | null> => {
    const url = `${origin}/robots.txt`;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": env.SCRAPER_USER_AGENT },
        signal: AbortSignal.timeout(env.SCRAPER_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return robotsParser(url, await response.text());
    } catch {
      return null;
    }
  })();

  cache.set(origin, pending);
  return pending;
}

export async function isAllowed(url: string): Promise<boolean> {
  if (!env.SCRAPER_RESPECT_ROBOTS) return true;
  const { origin } = new URL(url);
  const robots = await loadRobots(origin);
  if (!robots) return true;
  return robots.isAllowed(url, env.SCRAPER_USER_AGENT) ?? true;
}

/** Crawl-delay declared by the host, if any, in milliseconds. */
export async function crawlDelayMs(url: string): Promise<number | null> {
  if (!env.SCRAPER_RESPECT_ROBOTS) return null;
  const { origin } = new URL(url);
  const robots = await loadRobots(origin);
  const delay = robots?.getCrawlDelay(env.SCRAPER_USER_AGENT);
  return typeof delay === "number" ? delay * 1000 : null;
}

export function clearRobotsCache(): void {
  cache.clear();
}
