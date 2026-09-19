/** A posting exactly as it came off a source, before normalization. */
export interface RawJob {
  /** Stable identifier within the source. Used for de-duplication. */
  externalId: string;
  url: string;
  title: string;
  company: string;
  location?: string | undefined;
  isRemote?: boolean | undefined;
  /** Plain text description. HTML should already be stripped. */
  description: string;
  postedAt?: Date | undefined;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  salaryCurrency?: string | undefined;
  salaryPeriod?: string | undefined;
}

export interface ScrapeContext {
  /** GET a URL as text. Rate-limited, retried, and blocked if robots.txt disallows. */
  fetchText(url: string): Promise<string>;
  /** GET and JSON.parse. Same protections as fetchText. */
  fetchJson<T = unknown>(url: string): Promise<T>;
  /**
   * Render a page in a real browser and return the resulting HTML.
   * Requires the optional `playwright` dependency; throws a clear error if absent.
   */
  renderHtml(url: string): Promise<string>;
  /** Hard cap on postings to return; adapters should stop once reached. */
  maxJobs: number;
  /** Hard cap on listing pages to walk. */
  maxPages: number;
  log(message: string): void;
}

export interface JobSource {
  key: string;
  name: string;
  homepage: string;
  /** html = DOM scraping, feed = RSS/Atom, board = documented public JSON board. */
  kind: "html" | "feed" | "board";
  collect(ctx: ScrapeContext): Promise<RawJob[]>;
}

/** Thrown when robots.txt forbids a URL, so the orchestrator can report it distinctly. */
export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows fetching ${url}`);
    this.name = "RobotsDisallowedError";
  }
}
