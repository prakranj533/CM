import { env } from "../env.js";
import { isAllowed } from "./robots.js";
import { RobotsDisallowedError } from "./types.js";

type Browser = {
  newPage(): Promise<Page>;
  close(): Promise<void>;
};
type Page = {
  goto(url: string, options: { waitUntil: "domcontentloaded" | "networkidle"; timeout: number }): Promise<unknown>;
  content(): Promise<string>;
  close(): Promise<void>;
  setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
};

let browserPromise: Promise<Browser> | null = null;

/**
 * Playwright is an optional dependency: most sources are server-rendered and only
 * need plain HTTP, and the browser download is ~300MB. Sources that genuinely need
 * JS execution call ctx.renderHtml(), which lazily boots Chromium here.
 */
async function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;

  browserPromise = (async (): Promise<Browser> => {
    let chromium: { launch(options: { headless: boolean }): Promise<Browser> };
    try {
      ({ chromium } = (await import("playwright")) as unknown as {
        chromium: { launch(options: { headless: boolean }): Promise<Browser> };
      });
    } catch {
      throw new Error(
        "This source needs a real browser. Install it with: npm i -w @career-maps/api playwright && npx playwright install chromium",
      );
    }
    return chromium.launch({ headless: true });
  })();

  return browserPromise;
}

/** Fetch a JS-rendered page and return its post-hydration HTML. */
export async function renderHtml(url: string): Promise<string> {
  if (!(await isAllowed(url))) throw new RobotsDisallowedError(url);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ "user-agent": env.SCRAPER_USER_AGENT, "accept-language": "en" });
    await page.goto(url, { waitUntil: "networkidle", timeout: env.SCRAPER_TIMEOUT_MS });
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => undefined);
}
