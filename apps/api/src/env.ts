import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  /// Signs session cookies. Generate with: openssl rand -hex 32
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me"),
  SESSION_TTL_DAYS: z.coerce.number().default(30),

  // Scraping behaviour. Deliberately conservative defaults: identify ourselves,
  // stay under a request per second per host, and cap how much we pull.
  SCRAPER_USER_AGENT: z
    .string()
    .default("CareerMapsBot/1.0 (+https://github.com/lifelonglearningindia/career-maps; respects robots.txt)"),
  SCRAPER_DELAY_MS: z.coerce.number().default(1200),
  SCRAPER_TIMEOUT_MS: z.coerce.number().default(20000),
  SCRAPER_MAX_PAGES: z.coerce.number().default(3),
  SCRAPER_MAX_JOBS_PER_SOURCE: z.coerce.number().default(200),
  SCRAPER_RESPECT_ROBOTS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /// Comma-separated Greenhouse/Lever board slugs to pull, e.g. "stripe,figma".
  /// A slug is the company id in its careers URL; unknown slugs are skipped with a
  /// warning, so verify new ones before relying on them.
  GREENHOUSE_BOARDS: z.string().default("stripe,figma,discord,duolingo"),
  LEVER_BOARDS: z.string().default("gopuff"),

  /// Daily schedule in cron syntax (default 03:15 server time). Empty disables it.
  INGEST_CRON: z.string().default("15 3 * * *"),
  INGEST_ON_BOOT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /// Required by POST /api/admin/ingest. Empty disables the endpoint.
  ADMIN_TOKEN: z.string().default(""),

  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const googleOAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const isProduction = env.NODE_ENV === "production";
