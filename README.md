# Ireland Data Analytics Job Radar

Production-grade Next.js app focused on one goal: **help a data analytics job seeker in Ireland get hired fast**.

The system prioritizes daily action, not passive browsing:
- newest relevant jobs first
- highest-priority apply-now opportunities
- unreviewed jobs and status tracking
- resilient multi-source ingestion with graceful degradation
- CV-fit labeling based on your profile (instead of relying only on raw score)

## Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Cron scheduler
- Docker + docker-compose
- Vitest

## Core Product Capabilities

### Aggregation and Adapter Isolation
Adapters implemented in:
- `src/adapters/linkedin.ts`
- `src/adapters/jobsireland.ts`
- `src/adapters/glassdoor.ts`
- `src/adapters/irishjobs.ts`
- `src/adapters/indeed.ts`

Each adapter supports:
- `live`, `mock`, `off` modes
- normalized output contract
- health status + error reporting
- fallback to mock (optional)

If a provider fails, the scan still completes and other sources remain operational.

### Eligibility-First Ranking Engine
Implemented in:
- `src/services/scoring-engine.ts`
- `src/services/keyword-matcher.ts`

Outputs:
- `title_match_score`
- `skills_match_score`
- `recency_score`
- `seniority_fit_score`
- `eligibility_score`
- `urgency_score`
- `final_score`
- explainable reason strings

Match levels:
- `APPLY_NOW`
- `STRONG_MATCH`
- `GOOD_MATCH`
- `STRETCH`
- `LOW_MATCH`
- `EXCLUDE`

### Deduplication
Implemented in `src/services/deduplication-engine.ts`.

Signals:
- apply URL equality
- normalized company + location
- title token similarity
- posted date proximity

Canonical record preserved with all source references.

### Daily Action Dashboard
Homepage (`/`) surfaces:
- New Today
- New Since Last Visit
- Apply Now
- Strong Matches
- Unreviewed
- failing providers

`/jobs` defaults to a freshness-first view (`Past 7 days`, minimum priority `0`) with quick filters for:
- past 24 hours
- past 3 days
- past 7 days
- since 1 Mar 2026

Collapse of same-title/company multi-location postings is **off by default** and can be explicitly enabled in filters.
The list and detail pages show **CV Fit** (`CV_MATCH`, `GOOD_MATCH`, `LESS_MATCH`, `LOW_MATCH`, `EXCLUDE`) with explainable reasons.

### Job Tracking
Per-job state:
- `new`, `reviewing`, `saved`, `applied`, `interview`, `rejected`, `closed`, `dismissed`, `snoozed`

Actions are available in lists and detail view.

### Source Health + Observability
Tables:
- `ScanRun`
- `ScanRunSourceResult`
- `Source`

Route: `/sources`

Shows latest scan outcomes, fetched/parsed counts, duplicates, and errors per source.

## Routes

### Pages
- `/` dashboard
- `/jobs` all jobs + filters + table/card toggle
- `/jobs/[id]` job detail + match reasoning
- `/saved`
- `/applied`
- `/settings`
- `/sources`

### API
- `POST /api/refresh` trigger scan
- `GET /api/jobs` filtered jobs
- `PATCH /api/jobs/[id]/state` update job status
- `GET /api/stats` dashboard stats + last-visit cookie handling
- `GET /api/sources/status` source health
- `GET/PUT /api/settings` settings persistence
- `GET /api/roles` currently scanned role keywords + CV target roles

## Project Structure

```text
app/
  api/
  jobs/
  saved/
  applied/
  settings/
  sources/
components/
prisma/
  schema.prisma
  migrations/
  seed.ts
src/
  adapters/
  config/
  lib/
  mock/
  scripts/
  services/
tests/
```

## Local Setup

1. Copy env file:
```bash
cp .env.example .env
```

2. Install dependencies:
```bash
npm install
```

3. (Recommended for persistence) Run PostgreSQL (docker):
```bash
docker compose up -d db
```

4. Prisma generate + migrate:
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Seed demo data and run initial scan:
```bash
npm run prisma:seed
```

6. Start app:
```bash
npm run dev
```

Open: `http://localhost:3000`

If `/jobs` fails due a bad Next dev cache, run:
```bash
npm run dev:recover
```

### Live Ingestion Notes
- Providers default to `live` mode in `.env.example`.
- `Indeed` uses its RSS endpoint directly.
- `LinkedIn`, `IrishJobs`, and `Glassdoor` default to Bing RSS domain-scoped search feeds when explicit feed URLs are not configured.
- `JobsIreland` uses compliant HTML parsing from public listings.
- Optional: set `LINKEDIN_COOKIE` to your own LinkedIn `li_at` cookie value (or full cookie string) for better coverage when guest endpoints are limited.
- When live providers are blocked/rate-limited, scan backfill can add mock coverage per provider (`PROVIDER_BACKFILL_MIN_JOBS`) so the board remains broad and useful.
- If PostgreSQL is unavailable, scans still run in no-DB fallback mode and populate in-memory live results for the current process.
- For durable history across restarts, run PostgreSQL and Prisma migrations.

### LinkedIn Deep Scan Mode (Keyword-by-Keyword)
The LinkedIn adapter supports an exhaustive strategy for broad coverage:
- scans keywords one by one
- paginates deeply per keyword
- stops each keyword only after consecutive empty pages
- respects `MIN_POSTED_AT` (for example `2026-02-09`)

Recommended config:
```env
LINKEDIN_SCAN_STRATEGY=exhaustive
LINKEDIN_MAX_KEYWORDS=0
LINKEDIN_MAX_PAGES_PER_KEYWORD=18
LINKEDIN_STOP_AFTER_EMPTY_PAGES=2
LINKEDIN_MAX_TOTAL_REQUESTS=1400
LINKEDIN_REQUEST_DELAY_MS=550
LINKEDIN_KEYWORD_DELAY_MS=900
LINKEDIN_USE_BING_SUPPLEMENT=true
PROVIDER_FETCH_TIMEOUT_MS=900000
```

Tuning notes:
- `LINKEDIN_MAX_KEYWORDS=0` means use the full keyword universe.
- Increase `LINKEDIN_MAX_PAGES_PER_KEYWORD` and `LINKEDIN_MAX_TOTAL_REQUESTS` for broader scans (slower runtime).
- If rate limiting increases, raise delay values.
- For exhaustive scans with many keywords/pages, set `PROVIDER_FETCH_TIMEOUT_MS=900000`.

### Performance Targets and CSV Export
Each scan now evaluates minimum daily targets:
- `DAILY_TARGET_FETCHED` (default `600`)
- `DAILY_TARGET_PARSED` (default `300`)
- `DAILY_TARGET_LINKEDIN_VISIBLE` (default `220`, based on non-excluded LinkedIn jobs from last 7 days)

If a run is below target, the scan is marked as underperforming with per-source pipeline drop-off diagnostics.

Automatic CSV export on every scan:
- `CSV_EXPORT_ENABLED=true`
- `CSV_EXPORT_DIR=exports`
- output includes `APPLY_NOW` + `STRONG_MATCH` roles and writes `priority-jobs-latest.csv`.

## Scheduler

Run background scan scheduler:
```bash
npm run scheduler
```

Cron expression configured by `SCAN_CRON`.

## Cloud Deployment (Always-On)

This repo now includes a Render blueprint at `render.yaml` that creates:
- managed PostgreSQL database
- web app (free plan compatible)

### Deploy Steps (Render)

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select your repo and deploy `render.yaml`.
4. After first deploy, set secrets in Render for `ireland-job-radar-web`:
   - `LINKEDIN_COOKIE` (your `li_at` value)
   - optional notification vars (`WEBHOOK_URLS`, `SMTP_*`, `DIGEST_EMAIL_TO`)
5. Redeploy web service once secrets are set.
6. Open your live URL and test:
   - `/api/health`
   - `/api/refresh`
   - `/jobs`

Optional helper to publish quickly from this folder:
```bash
bash scripts/publish-to-github.sh <your-github-repo-url>
```

Notes:
- Free web services on Render sleep on idle and can cold-start on the next request.
- Free Render Postgres instances expire after 30 days unless upgraded.
- `NEXT_PUBLIC_APP_URL` is preset to the Render service hostname in `render.yaml`; update it if you rename the service.

### Free Continuous Scans (GitHub Actions)

For free-plan refresh every 6 hours, this repo includes:
- `.github/workflows/scan-refresh.yml`

Set GitHub repo secret:
- `RENDER_APP_URL` = your live Render URL (for example `https://ireland-job-radar-web.onrender.com`)

The workflow triggers:
- `POST /api/refresh` every 6 hours
- manual run via **Actions** -> **Scan Refresh** -> **Run workflow**

## Provider Modes

Set per source in `.env`:
- `mock`: deterministic sample dataset (Ireland-only jobs from Jan 1, 2026 onward)
- `live`: use configured feed/endpoint
- `off`: provider disabled

Example:
```env
PROVIDER_INDEED_MODE=live
INDEED_FEED_URL=https://ie.indeed.com/rss?q=data+analyst&l=Ireland
```

## Tests

```bash
npm run test
```

Coverage focus:
- scoring logic
- keyword matching
- deduplication
- classification behavior

## Docker

Run full stack:
```bash
docker compose up --build
```

Persistent PostgreSQL data is stored in the `pg_data` Docker volume.

## Notes on Compliance and Reliability

- No unsafe scraping hacks are required for baseline functionality.
- Provider adapters are isolated and failure-tolerant.
- Mock mode ensures the app remains usable even when live ingestion is unavailable.
- Ranking favors broad capture + action-first triage so opportunities are not missed.
