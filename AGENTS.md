# Notes for agents working in this repo

## Layout

npm workspaces monorepo. `packages/core` (domain logic, unit tested) →
`apps/api` (Fastify + Prisma) → `apps/web` (Vue 3 + Vite + Vuetify 3).
`legacy/` holds the original Vue 2 app for reference; it is not part of the workspace
build and is not expected to run.

## Verification

Run these before declaring work done. All are quiet on success.

```bash
npm test               # core unit tests (node --test over compiled dist)
npm run typecheck      # tsc/vue-tsc across core, api, web
npm run build          # production build of all three
```

`npm test` runs against `packages/core/dist`, so **build core first** if you changed it:

```bash
npm run build -w @career-maps/core && npm test -w @career-maps/core
```

End-to-end smoke test:

```bash
npm run dev
curl -s http://localhost:5173/api/health          # via the Vite proxy
curl -s http://127.0.0.1:4000/api/graph           # direct
```

## Environment quirks (Windows / Node 22)

- **`prisma generate` fails while the API is running.** The dev server holds the query
  engine DLL. Stop `npm run dev` (and check for orphaned `node.exe` processes) before
  `npm run db:push`.
- **`tsx watch` and Vite leave orphaned processes** after a killed shell, which then lock
  files (`EBUSY`/`EPERM` on directory renames). Inspect with
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` and check `CommandLine`
  before killing anything — don't blanket-kill `node.exe`, the IDE runs some.
- **The legacy app cannot build on Node 17+** without help: it uses webpack 4 (md4 hashing,
  removed in OpenSSL 3) and `node-sass@4` (no prebuilt binary, needs Python 2).
  `legacy/vue.config.js` shims md4 → md5; `node-sass` was dropped in favour of the
  `sass` package already present.

## Conventions

- TypeScript everywhere, `strict` plus `noUncheckedIndexedAccess`. Prefer fixing types
  over `any`; where a dependency's shipped types are wrong (`robots-parser`,
  `@fastify/oauth2`) there is a narrow cast with a comment explaining why.
- ESM with explicit `.js` extensions in API imports (`moduleResolution: NodeNext`).
- Domain logic belongs in `packages/core` so it can be unit tested; `apps/api` should be
  glue (DB access, HTTP) around it.
- Comments explain *why*, not *what*. Don't add narration.
- SQLite has no enums/arrays: string columns plus JSON-in-text (`skillsJson`, `pathJson`).
- Prisma on SQLite does **not** support `mode: "insensitive"`. `contains` is already
  case-insensitive for ASCII there — adding `mode` throws at runtime.

## Data-quality rules that are easy to break

These were all real bugs; there are regression tests for each in `packages/core`.

- **Don't loosen `matchRole`.** A wrong job→stage link silently corrupts that stage's
  skill-demand stats. Unmatched is the correct outcome when evidence is weak. Roles with
  one distinctive word ("Finance") must only match exactly or via alias.
- **`normalizeTitle` vs `normalizeRoleName` are not interchangeable.** The first strips
  seniority words ("entry", "associate", "lead"); using it on curated role names turns
  "Data Entry Operator" into "data operator", which then matches any posting mentioning
  "data".
- **Skill aliases must be unambiguous.** Removed because they produced false positives:
  `hr` (matches "$90-$170/hr"), `automation` for PLC & SCADA (matches "test automation").
  Skills whose name is an ordinary English word (`Go`, `R`) set `aliasesOnly: true` and
  match only explicit spellings like "golang".
- After changing the taxonomy or aliases, reprocess stored data instead of re-scraping:
  `npm run rematch -w @career-maps/api`.

## Occupation catalog

- `npm run catalog` imports India's official NCO-2015 catalogue from the Directorate General of Employment search pages.
- Imported planning edges use `origin="catalog"`; graph seeding only replaces `origin="curated"` edges.
- NCO codes align with ISCO and drive the family/subfamily/specialty map levels. Keep the full NCO code in `Role.catalogCode`.
- Keep general preparation milestones between school stages and imported careers. Do not connect professional occupations directly to 12th standard or invent occupation-specific Indian entrance tests without a verified source.
- Salaries are stored in their source currency. Convert only for display/aggregation, label non-INR conversions as indicative, and never overwrite the original currency fields.

## Scraper rules

- Every HTTP request goes through `scraper/http.ts` (robots check, per-host rate limit,
  timeout, backoff). Don't call `fetch` directly from an adapter.
- Do not add adapters for LinkedIn, Indeed or Glassdoor — their terms forbid it and they
  block crawlers.
- Adapters must degrade, not throw: one dead company board or changed selector should log
  and continue. If a listing page parses to zero rows, log that the selectors look stale.
- Company board slugs go dead as firms switch ATS vendors. Verify before adding:
  `curl "https://api.lever.co/v0/postings/<slug>?mode=json"`. Most Indian companies use
  their own portals or Naukri, so per-company ATS boards yield very little India data —
  don't spend long there.
- **Check `robots.txt` before writing an adapter**, not after. SmartRecruiters looked
  ideal (Freshworks: 136 postings, 35 in India) but disallows all crawlers bar
  LinkedInBot; the adapter was written and then deleted.
- **Never fold a board's `tags` into the description.** Posters tag broadly for reach, so
  tags inject skills the advert never mentions. Descriptions only.
- Prefer sources that publish full descriptions. Adzuna returns truncated snippets, so it
  is a volume/salary/location signal rather than a skills signal.

## Brand

Palette is sampled from `apps/web/public/logo.png`: green `#056839`, amber `#FCB040`.
Defined once in `apps/web/src/plugins/vuetify.ts` (exported as `brand`) and mirrored as
CSS custom properties in `src/styles/main.scss`. Amber is a fill/highlight colour only —
it fails contrast as text on white.
