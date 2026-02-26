---
phase: 02-pipeline
plan: "01"
subsystem: pipeline
tags: [feedparser, dataclasses, rss, supabase, deduplication]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: pipeline/db.py singleton Supabase client used by ingest.py for deduplication

provides:
  - pipeline/models.py with Article, Story, VideoResult dataclasses
  - pipeline/ingest.py with fetch_and_deduplicate() using Yahoo Finance + CNBC RSS feeds
  - requirements.txt with all Python pipeline dependencies pinned

affects:
  - 02-02 (script.py) — imports Article from pipeline.models, calls fetch_and_deduplicate
  - 02-03 (tts.py) — imports Story from pipeline.models
  - 02-04 (video.py) — imports Story, VideoResult from pipeline.models
  - 02-05 (run.py) — orchestrates all modules, imports from pipeline.models

# Tech tracking
tech-stack:
  added: [feedparser==6.0.12]
  patterns:
    - "Shared dataclasses in pipeline/models.py — single source of truth for inter-module contracts"
    - "Two-pass deduplication: in-process set for cross-feed, then DB check for same-day re-runs"
    - "summary[:500] truncation to keep Groq prompt tokens manageable"

key-files:
  created:
    - pipeline/models.py
    - pipeline/ingest.py
    - requirements.txt
  modified: []

key-decisions:
  - "Yahoo Finance + CNBC only (no Reuters — Reuters RSS dead since 2020, per research)"
  - "stdlib dataclasses only in models.py — no pydantic, no extra deps for data contracts"
  - "DB dedup scans videos.source_url with gte(created_at, today) — catches same-day pipeline re-runs"
  - "feedparser==6.0.12 pinned exactly; other pipeline deps use >= for flexibility"
  - "FFmpeg system binary note in requirements.txt — brew/apt, not pip"

patterns-established:
  - "models.py as sole import target for data types — all pipeline modules import from here"
  - "requirements.txt created once in plan 02-01 — no subsequent plan modifies it"

requirements-completed: [INGEST-01, INGEST-02]

# Metrics
duration: 1min
completed: 2026-02-24
---

# Phase 2 Plan 01: Pipeline Models and RSS Ingest Summary

**feedparser-based RSS ingestion from Yahoo Finance + CNBC with two-pass deduplication, and shared Article/Story/VideoResult dataclasses as pipeline-wide data contracts**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-24T23:24:29Z
- **Completed:** 2026-02-24T23:25:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- pipeline/models.py provides Article, Story, VideoResult dataclasses used by all pipeline stages (plans 02-05)
- pipeline/ingest.py implements fetch_and_deduplicate() with feedparser for Yahoo Finance + CNBC, in-process URL dedup, and DB-backed same-day dedup against videos.source_url
- requirements.txt created with all 7 pipeline Python dependencies — no subsequent plan needs to touch it

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/models.py with Article, Story, VideoResult dataclasses** - `ed42864` (feat)
2. **Task 2: Create pipeline/ingest.py with RSS fetch and deduplication, update requirements.txt** - `d6d994a` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `pipeline/models.py` - Article, Story, VideoResult dataclasses (stdlib only, no extra deps)
- `pipeline/ingest.py` - fetch_and_deduplicate() using feedparser with Yahoo Finance + CNBC feeds
- `requirements.txt` - All pipeline Python deps: feedparser, groq, openai, faster-whisper, requests, supabase, python-dotenv

## Decisions Made

- Yahoo Finance + CNBC only (Reuters RSS is dead since 2020 per research) — no point adding a broken feed
- stdlib dataclasses in models.py — pydantic is overkill for simple pipeline contracts between local functions
- DB dedup uses `.gte("created_at", str(date.today()))` to catch same-day re-runs without pulling all-time history
- feedparser==6.0.12 pinned exactly for reproducibility; pipeline runtime deps use `>=` for security patch flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — feedparser installed cleanly, all imports pass, both verification checks pass.

## User Setup Required

None - no external service configuration required beyond what Phase 1 established (.env with SUPABASE_URL + SUPABASE_SERVICE_KEY).

## Next Phase Readiness

- pipeline/models.py is ready — plans 02, 03, 04 can now run in parallel importing from pipeline.models
- pipeline/ingest.py is ready — plan 02 (script.py) can call fetch_and_deduplicate() directly
- requirements.txt complete — no subsequent pipeline plan needs to add dependencies
- Pending: feedparser not yet installed in CI/CD environment — `pip install -r requirements.txt` needed in GitHub Actions workflow (Phase 5)

---
*Phase: 02-pipeline*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: pipeline/models.py
- FOUND: pipeline/ingest.py
- FOUND: requirements.txt
- FOUND: .planning/phases/02-pipeline/02-01-SUMMARY.md
- FOUND commit: ed42864 (Task 1)
- FOUND commit: d6d994a (Task 2)
