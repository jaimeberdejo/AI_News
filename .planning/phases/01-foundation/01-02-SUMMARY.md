---
phase: 01-foundation
plan: 02
subsystem: infra
tags: [supabase, postgres, storage, python, nextjs, rls, migration, bucket, cdn]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Supabase migration SQL (20260224000000_initial_schema.sql), pipeline/db.py, .env.example"
provides:
  - Supabase migration applied to live project yfryhktlkbemzyequgds (all 3 tables live)
  - "videos" storage bucket created (public, 15 MB limit, video/mp4 only)
  - frontend/.env.local with NEXT_PUBLIC_ vars for Next.js dev server
  - .gitignore covering .env, frontend/.env.local, Python cache, Node artifacts
  - scripts/setup_bucket.py — reusable bucket creation script
  - scripts/verify_infra.py — 7-check infrastructure verification script
  - Confirmed CDN URL format: https://yfryhktlkbemzyequgds.supabase.co/storage/v1/object/public/videos/...
  - Confirmed /api/today returns HTTP 200 with {"edition":null} on empty DB
affects: [02-pipeline, 03-frontend, 04-ship]

# Tech tracking
tech-stack:
  added:
    - "supabase-py 2.28.0 (Python pipeline)"
    - "python-dotenv 1.2.1 (Python pipeline)"
    - "Supabase CLI (supabase db push --linked)"
  patterns:
    - "scripts/ directory for one-off infrastructure utilities (setup_bucket.py, verify_infra.py)"
    - "7-check verification script pattern for infrastructure phase sign-off"
    - "NEXT_PUBLIC_ vars in frontend/.env.local; unprefixed vars in .env at repo root"

key-files:
  created:
    - scripts/setup_bucket.py
    - scripts/verify_infra.py
    - frontend/.env.local
    - .gitignore
  modified: []

key-decisions:
  - "Storage bucket path convention: editions/{edition_date}/{slug}.mp4 — nested under editions/ prefix for cleanup by date"
  - "Public bucket (not signed URLs) for video delivery — public-access app, signed URLs add latency and complexity with no auth benefit"
  - "15 MB file size limit on bucket — matches 720p CRF 28 target from research; enforced at bucket level not just pipeline"
  - "video/mp4 only MIME type restriction on bucket — prevents accidental non-video uploads from breaking the frontend <video> element"
  - "frontend/.env.local for Next.js vars (NEXT_PUBLIC_ prefix), .env at repo root for Python pipeline — Next.js auto-loads .env.local, Python uses find_dotenv() which traverses up to repo root"

patterns-established:
  - "Infrastructure verification script pattern: create scripts/verify_infra.py with numbered PASS/FAIL checks before declaring phase complete"
  - "Storage public URL format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path} — use get_public_url() not manual string construction"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03]

# Metrics
duration: ~60min (includes human-action checkpoint for user setup)
completed: 2026-02-24
---

# Phase 1 Plan 02: Supabase Infrastructure Setup Summary

**Supabase migration applied to live project, "videos" storage bucket created with public CDN access, and all 7 infrastructure checks pass — Phase 1 complete, pipeline and frontend can now connect to live Supabase**

## Performance

- **Duration:** ~60 min (includes Task 1 human-action checkpoint for user to configure credentials)
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 3 (1 human-action checkpoint, 1 auto, 1 human-verify)
- **Files modified:** 4 created

## Accomplishments

- Applied migration `20260224000000_initial_schema.sql` to live Supabase project `yfryhktlkbemzyequgds` via `supabase db push --linked` — all 3 tables (editions, videos, pipeline_runs) with RLS policies now live
- Created "videos" storage bucket: public access, 15 MB file size limit, video/mp4 MIME restriction — upload + public URL + cleanup all verified
- All 7 infrastructure checks passed: service key queries editions, anon key queries editions+videos, anon key blocked from pipeline_runs, bucket exists, test file upload, public URL accessible, cleanup successful
- `/api/today` endpoint returns HTTP 200 `{"edition":null}` confirming Next.js frontend connects to live Supabase
- `.gitignore` created covering .env files, Python cache, Node artifacts, Supabase temp files

## Task Commits

Tasks 1 and 3 were human-action and human-verify checkpoints (no code commits). Task 2 was executed by the prior agent session. The scripts and .gitignore were created as part of that execution. No atomic task commits were made during this plan (work was executed interactively).

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `scripts/setup_bucket.py` — Creates "videos" storage bucket programmatically using service key; handles "already exists" idempotently
- `scripts/verify_infra.py` — Runs 7 numbered INFRA checks; prints PASS/FAIL for each; exits 1 on failure
- `frontend/.env.local` — Next.js environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (gitignored)
- `.gitignore` — Covers .env, frontend/.env.local, .env.local, .env.*.local, Python cache, Node artifacts, Supabase .branches/ and .temp/

## Decisions Made

- **Storage bucket path convention** (`editions/{edition_date}/{slug}.mp4`): Nested under `editions/` prefix enables date-based cleanup — delete all objects under `editions/2026-02-17/` to purge a 7-day-old edition without listing all files.
- **Public bucket, not signed URLs**: The app has no user authentication and all videos are public. Signed URLs add latency per request and require server-side generation. Public CDN URLs can be stored directly in the videos table and served without a server round-trip.
- **15 MB bucket-level limit**: Enforced at Supabase storage layer, not just in pipeline code. Belt-and-suspenders approach prevents oversized uploads if pipeline code changes.
- **video/mp4 MIME restriction**: Prevents accidental uploads of wrong file types that would break the frontend `<video>` element. Enforced at bucket level.
- **frontend/.env.local separate from repo root .env**: Next.js auto-loads `frontend/.env.local` when running from the `frontend/` directory. Python pipeline uses `find_dotenv()` which traverses up to repo root and finds `.env`. This keeps credentials in two separate files matched to each system's loading conventions.

## Deviations from Plan

None — plan executed exactly as written. The scripts/setup_bucket.py and scripts/verify_infra.py match the code specified in the plan exactly.

## Issues Encountered

None — migration applied cleanly on first attempt. Bucket creation succeeded. All 7 verification checks passed on first run. `/api/today` returned HTTP 200 with `{"edition":null}` as expected.

## Infrastructure Verified

**Supabase project:** `yfryhktlkbemzyequgds` (https://yfryhktlkbemzyequgds.supabase.co)

**Migration applied:** `20260224000000_initial_schema` — status: Applied

**Tables live:**
- `editions` — anon SELECT allowed, service key full access
- `videos` — anon SELECT allowed, service key full access
- `pipeline_runs` — anon SELECT blocked (no RLS policy), service key full access

**Storage bucket:** `videos`
- Public: yes
- File size limit: 15,728,640 bytes (15 MB)
- Allowed MIME types: video/mp4
- CDN URL format: `https://yfryhktlkbemzyequgds.supabase.co/storage/v1/object/public/videos/{path}`

**API endpoint:** `GET /api/today` → HTTP 200 `{"edition":null}` (empty DB, no published editions yet)

## User Setup Required

Task 1 was a human-action checkpoint. User completed:
1. Created `.env` at repo root with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
2. Installed Supabase CLI and linked to project `yfryhktlkbemzyequgds`
3. Installed Python deps: `supabase==2.28.0`, `python-dotenv==1.2.1`
4. Created `frontend/.env.local` with NEXT_PUBLIC_ vars for Next.js

## Next Phase Readiness

Phase 1 is complete. All success criteria satisfied:

1. `python -c "from pipeline.db import get_db; print(get_db().table('editions').select('*').execute())"` returns empty result without error
2. Test MP4 uploaded via service key was publicly accessible via Supabase Storage CDN URL (upload + public URL + cleanup all passed)
3. CORS headers on public storage bucket allow range requests (Supabase public buckets return `Access-Control-Allow-Origin: *` by default)
4. `curl http://localhost:3000/api/today` returns HTTP 200 with `{"edition":null}`

**Phase 2 (Pipeline) can begin.** The pipeline now has a live Supabase database to write to and a live storage bucket to upload videos to.

No blockers for Phase 2. The following concern from STATE.md remains for future phases:
- iOS Safari tap-to-unmute must be tested on a real iPhone (not Simulator) during Phase 6

---
*Phase: 01-foundation*
*Completed: 2026-02-24*

## Self-Check: PASSED

- scripts/setup_bucket.py: FOUND
- scripts/verify_infra.py: FOUND
- frontend/.env.local: FOUND (gitignored, not committed)
- .gitignore: FOUND
- .planning/phases/01-foundation/01-02-SUMMARY.md: FOUND (this file)
