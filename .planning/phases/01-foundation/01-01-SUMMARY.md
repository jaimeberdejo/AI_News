---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [supabase, postgres, nextjs, typescript, python, rls, migration]

# Dependency graph
requires: []
provides:
  - Supabase migration SQL with editions, videos, pipeline_runs tables + RLS policies
  - Python pipeline package with singleton service-key Supabase client (pipeline/db.py)
  - Next.js App Router frontend scaffold with @supabase/supabase-js@2.97.0
  - GET /api/today route returning latest published edition with videos
  - .env.example documenting all 7 required environment variables
affects: [02-pipeline, 03-video, 04-frontend-ui, 05-automation, 06-mobile]

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js@2.97.0 (Next.js frontend)"
    - "next@16.1.6 with App Router"
    - "react@19.2.3"
    - "typescript@^5"
    - "python-dotenv (pipeline, via find_dotenv)"
    - "supabase-py (pipeline db client)"
  patterns:
    - "Singleton pattern for pipeline Supabase client (_client global in db.py)"
    - "200-with-null response pattern for /api/today when no edition exists"
    - "Two-key Supabase env var strategy: NEXT_PUBLIC_SUPABASE_URL for Next.js, SUPABASE_URL for Python pipeline"
    - "Anon key in route handlers (public-read RLS), service key only in Python pipeline"

key-files:
  created:
    - supabase/migrations/20260224000000_initial_schema.sql
    - pipeline/__init__.py
    - pipeline/db.py
    - frontend/lib/supabase.ts
    - frontend/app/api/today/route.ts
    - .env.example
  modified: []

key-decisions:
  - "SUPABASE_URL (non-prefixed) for Python pipeline, NEXT_PUBLIC_SUPABASE_URL for Next.js — same value, different var name avoids NEXT_PUBLIC_ in server-side Python"
  - "Singleton pattern for pipeline db.py (_client global) — avoids connection overhead on repeated calls within a pipeline run"
  - "200-with-null vs 404 for /api/today — always return 200 so frontend never shows error state during pipeline window"
  - "@supabase/supabase-js (not @supabase/ssr) — project has no user auth sessions, vanilla client is sufficient"
  - "RLS: anon can read all published editions and all videos (true policy) — public-access app, no user accounts in v1"
  - "One-per-day editions with UNIQUE constraint on edition_date — MVP simplicity; no morning/evening editions"
  - "Hard delete for 7-day video retention — MVP simplicity, no soft-delete complexity"

patterns-established:
  - "Route handler Supabase client: instantiate inside handler (not module-level) to ensure env vars available at request time"
  - "Service key never in Next.js route handlers — use anon key for public-read endpoints, RLS enforces access"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Supabase Postgres schema (3 tables + RLS), Python service-key pipeline client, and Next.js App Router scaffold with /api/today route — all local artifacts, no credentials required**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T09:06:44Z
- **Completed:** 2026-02-24T09:09:23Z
- **Tasks:** 2
- **Files modified:** 23 (6 hand-crafted + 17 scaffolded by create-next-app)

## Accomplishments

- Supabase migration SQL with editions, videos, pipeline_runs tables; all indexes, RLS enabled on all 3 tables, 2 anon SELECT policies
- Python pipeline package with singleton Supabase service-key client using find_dotenv() for env traversal
- Next.js App Router scaffold (next@16.1.6, react@19.2.3) with @supabase/supabase-js@2.97.0 installed
- GET /api/today route handler returning { edition: data } or { edition: null } with videos sorted by position
- .env.example documenting all 7 required keys with inline security annotations
- TypeScript compiles with no errors (verified via npx tsc --noEmit)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo scaffold — .env.example, pipeline package, and Supabase migration** - `0dc238d` (feat)
2. **Task 2: Scaffold Next.js frontend with @supabase/supabase-js and /api/today route handler** - `8742956` (feat)

**Plan metadata:** _(docs commit, pending)_

## Files Created/Modified

- `supabase/migrations/20260224000000_initial_schema.sql` - Full DDL: editions, videos, pipeline_runs; indexes, RLS, 2 anon policies
- `pipeline/__init__.py` - Empty file marking pipeline/ as a Python package
- `pipeline/db.py` - Singleton service-key Supabase client; find_dotenv() traversal; exports get_db()
- `.env.example` - Documents 7 required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY, OPENAI_API_KEY, PEXELS_API_KEY
- `frontend/lib/supabase.ts` - Anon-key Supabase createClient for server components; exports supabase
- `frontend/app/api/today/route.ts` - GET /api/today; queries editions with videos join; returns { edition: null } on empty state
- `frontend/package.json` - next@16.1.6, @supabase/supabase-js@^2.97.0, react@19.2.3
- `frontend/tsconfig.json` - App Router TypeScript config with "@/*" path alias

## Decisions Made

- **Two-key env var strategy:** Python pipeline uses `SUPABASE_URL` (not `NEXT_PUBLIC_SUPABASE_URL`) — the `NEXT_PUBLIC_` prefix is a Next.js build-time convention for browser exposure. The pipeline is pure Python and should use unprefixed vars. Same value, but different var name avoids confusion and keeps the distinction clear.
- **Singleton db.py pattern:** `_client` global avoids creating a new Supabase connection on every function call within a single pipeline run. Correct for a batch pipeline that calls get_db() across multiple pipeline steps.
- **200-with-null for /api/today:** Returns `{ edition: null }` instead of 404 when no published edition exists. This prevents the frontend from showing an error state during the pipeline execution window (e.g., midnight to 6am). The frontend can show a "check back later" message instead of a broken page.
- **@supabase/supabase-js not @supabase/ssr:** This project has no user authentication sessions. The SSR package is specifically for managing per-user auth cookies. Plain createClient is correct here — all reads are public via RLS anon key.
- **Exact @supabase/supabase-js version installed:** 2.97.0

## Deviations from Plan

None — plan executed exactly as written.

The plan's note to add both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL` to `.env.example` was explicitly included in the task spec, not a deviation.

## Issues Encountered

None — all files created successfully on first attempt. `create-next-app@16.1.6` bootstrapped with `--yes` flag (non-interactive). TypeScript compiled cleanly.

## User Setup Required

None — no external service configuration required at this stage. All files are local artifacts only.

The following steps are required before the pipeline or frontend can connect to Supabase (Phase 1 Plan 02):
1. Create a Supabase project at supabase.com
2. Copy `.env.example` to `.env` and fill in real credentials
3. Run `supabase db push --linked` to apply the migration

## Next Phase Readiness

- All local scaffolding complete — migration SQL, Python client, Next.js route handler exist and TypeScript-valid
- Phase 1 Plan 02 (Supabase infrastructure: create project, apply migration, configure storage) can begin immediately
- No blockers — all files created, no credentials required until Plan 02

---
*Phase: 01-foundation*
*Completed: 2026-02-24*

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.
- supabase/migrations/20260224000000_initial_schema.sql: FOUND
- pipeline/db.py: FOUND
- pipeline/__init__.py: FOUND
- .env.example: FOUND
- frontend/lib/supabase.ts: FOUND
- frontend/app/api/today/route.ts: FOUND
- .planning/phases/01-foundation/01-01-SUMMARY.md: FOUND
- Commit 0dc238d: FOUND
- Commit 8742956: FOUND
