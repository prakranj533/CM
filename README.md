# Career Maps

Explore careers as a map, plan a route between two stages, and see the skills employers
are actually asking for right now.

The career pathway data is **curated** (a maintained sheet of stages and transitions).
The job market data is **collected daily** from public job sources, with skills extracted
from each posting and aggregated per role.

![stack](https://img.shields.io/badge/Vue-3-42b883) ![stack](https://img.shields.io/badge/Fastify-4-black) ![stack](https://img.shields.io/badge/Prisma-5-2d3748)

---

## Quick start

Requires **Node 20+** (developed on 22).

```bash
npm install
npm run setup      # build core, create the SQLite DB, import the career graph
npm run dev        # API on :4000, web on :5173
```

Open <http://localhost:5173>.

At this point the map works but the jobs board is empty. To collect real postings:

```bash
npm run ingest                 # every source
npm run ingest -- remoteok     # just one
npm run ingest -- --list       # show available sources
```

---

## Repository layout

```
packages/core/        Framework-free domain logic (TypeScript, unit tested)
  pathfinder.ts       Enumerate routes, fastest route, reachability, subgraphs
  skills.ts           Skill taxonomy + extraction from job descriptions
  match.ts            Match scraped job titles to career stages
  centrality.ts       Betweenness centrality (Brandes)
  legacy.ts           Import the v1 nodeMap.json, detect cycles
  data/nodeMap.json   The curated career graph (214 stages, 258 transitions)

apps/api/             Fastify + Prisma (SQLite by default)
  prisma/schema.prisma
  src/scraper/        robots-aware HTTP, optional Playwright, one file per source
  src/ingest/         Orchestration, role aliases, skill/demand aggregation
  src/routes/         graph, roles, paths, jobs, auth, me, admin/status
  src/cli/            seed, ingest, rematch
  src/scheduler.ts    Daily cron

apps/web/             Vue 3 + Vite + Vuetify 3
  src/components/CareerGraph.vue   D3 force-directed map (zoom, focus, path highlight)
  src/views/          Explore, Role, PathFinder, Jobs, Roadmaps, SignIn, Data

legacy/               The original Vue 2 app, kept for reference (see legacy/README.md)
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web with hot reload |
| `npm run setup` | Build core, `prisma db push`, import the career graph |
| `npm run db:seed` | Re-import the graph (safe to re-run; refuses cyclic data) |
| `npm run ingest` | Collect jobs now (same code path as the daily job) |
| `npm run rematch -w @career-maps/api` | Re-extract skills + re-match roles offline, no scraping |
| `npm test` | Core unit tests (`node --test`) |
| `npm run typecheck` | Typecheck all three packages |
| `npm run build` | Production build of everything |

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env`. Everything has a working default
except OAuth and the admin token. Notable settings:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Switch `provider` in `schema.prisma` to `postgresql` for a hosted DB |
| `INGEST_CRON` | `15 3 * * *` | Daily collection. Empty string disables it |
| `INGEST_ON_BOOT` | `false` | Run one collection immediately on server start |
| `SCRAPER_DELAY_MS` | `1200` | Politeness delay per host (robots.txt `Crawl-delay` wins if larger) |
| `SCRAPER_RESPECT_ROBOTS` | `true` | Leave enabled |
| `GREENHOUSE_BOARDS` / `LEVER_BOARDS` | a few examples | Company boards to pull |
| `ADMIN_TOKEN` | empty | Required by `POST /api/admin/ingest`; empty disables the endpoint |
| `GOOGLE_CLIENT_ID` / `SECRET` | empty | Google sign-in appears in the UI once both are set |
| `SESSION_SECRET` | dev value | **Change in production** (`openssl rand -hex 32`) |

---

## How job collection works

Sources live in `apps/api/src/scraper/sources/`, one file each, behind a single
`JobSource` interface. Adding a site means writing one adapter and listing it in
`registry.ts`.

Current sources:

| Source | Kind | Notes |
| --- | --- | --- |
| We Work Remotely | `html` | Real DOM scraping: category pages, then each posting page |
| RemoteOK | `board` | Its published JSON feed |
| Greenhouse | `board` | Per-company boards via the documented boards API |
| Lever | `board` | Per-company postings endpoint |

Every request goes through `scraper/http.ts`, which checks `robots.txt`, rate-limits per
host, honours `Crawl-delay`, times out, and retries `429`/`5xx` with backoff.
`scraper/browser.ts` can render JS-heavy pages with Playwright — an optional dependency,
loaded lazily, with a clear error if it isn't installed.

Each source is isolated: if one changes its markup or goes down, that adapter is recorded
as failed in `IngestRun` and the rest still run. `/data` in the UI shows exactly what ran.

> **Scope note.** LinkedIn, Indeed and Glassdoor are deliberately not targeted — they
> forbid scraping and actively block it, so an adapter for them would be both legally
> risky and permanently broken. The sources above are public feeds or sites whose
> `robots.txt` permits the crawl.

### Why most postings aren't linked to a career stage

The curated graph speaks in qualification language ("12th Science", "Software Job (IT)");
postings use industry titles ("Staff Software Engineer"). Weak matching is actively
harmful — an early version attributed TypeScript and Go to "LIC Agent", which corrupts
that stage's "skills in demand" figures.

So matching is strict and auditable. A posting links to a stage only via a curated alias,
an exact name match, or strong multi-word overlap; every link records *why*
(`matchReason`). Unmatched postings stay fully browsable on the jobs board.

**The aliases are where the quality comes from.** They live in
`apps/api/src/ingest/aliases.ts`. After editing:

```bash
npm run rematch -w @career-maps/api    # reclassifies stored postings, no re-scraping
```

---

## Updating the career graph

The curated sheet is still the source of truth. Export it to `nodeMap.json` (see
`legacy/README.md` for the CSV → JSON step), then:

```bash
npm run db:seed -w @career-maps/api -- ./path/to/nodeMap.json
```

The importer refuses cyclic data, so a loop in the sheet is now caught rather than
silently breaking duration maths.

Stage ids are **slugs derived from names**, not random UUIDs. The v1 pipeline minted new
UUIDs on every import, so links and saved data broke on each refresh.

---

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/graph`, `/api/graph/hubs` | Whole map; stages ranked by centrality |
| `GET /api/roles`, `/api/roles/:slug` | Directory; full stage detail + market view |
| `GET /api/paths?from=&to=` | Every route, the fastest one, and the induced subgraph |
| `GET /api/paths/reachable/:slug` | Valid destinations from a stage |
| `GET /api/jobs`, `/api/jobs/:id` | Filterable board; single posting |
| `GET /api/skills/trending` | Skills by posting count |
| `GET /api/status` | Sources, recent runs, totals, schedule |
| `POST /api/auth/register|login|logout`, `GET /api/auth/me` | Sessions (httpOnly cookie) |
| `GET /api/auth/google` | Google OAuth, when configured |
| `GET|POST|DELETE /api/me/roadmaps` | Saved routes (auth required) |
| `POST /api/admin/ingest` | Trigger collection (`x-admin-token` header) |

## Deployment notes

- Run `npm run build`, then serve `apps/web/dist` as static files and `apps/api` with
  `npm start -w @career-maps/api`.
- The daily cron only fires while the API process is alive — run it as a long-lived
  service, not a serverless function. Alternatively disable `INGEST_CRON` and call
  `npm run ingest` from an external scheduler.
- Set `SESSION_SECRET`, and `WEB_ORIGIN` to the deployed frontend origin (CORS +
  OAuth redirects depend on it).
- SQLite is fine for a single instance; move to Postgres before running more than one.
