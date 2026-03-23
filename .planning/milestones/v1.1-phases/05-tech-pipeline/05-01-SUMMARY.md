---
phase: 05-tech-pipeline
plan: 01
subsystem: pipeline
tags: [groq, rss, feedparser, supabase, sql-migration, category-routing]

# Dependency graph
requires:
  - phase: 02-pipeline
    provides: ingest.py, script.py, run.py baseline finance pipeline
provides:
  - Category-parameterized pipeline (finance + tech) via CLI argument
  - SQL migration adding category column to editions table
  - TECH_FEEDS: TechCrunch, Hacker News, Ars Technica RSS feeds
  - Two distinct Groq system prompts: finance influencer vs tech journalist
affects:
  - 05-tech-pipeline (subsequent plans)
  - 06-category-ui (will need category filtering on /api/today endpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FEEDS_BY_CATEGORY dict maps category string to feed list (extensible for future categories)
    - category param threaded through ingest -> script -> run as single source of truth
    - DB dedup scoped by category to prevent cross-category URL suppression

key-files:
  created:
    - supabase/migrations/20260310000000_add_category_to_editions.sql
  modified:
    - pipeline/ingest.py
    - pipeline/script.py
    - pipeline/run.py

key-decisions:
  - "Category validation in run.py raises ValueError immediately — fail fast before any DB/API calls"
  - "DB dedup in ingest.py scoped by editions.category — finance and tech articles can share URLs without suppression"
  - "FEEDS_BY_CATEGORY dict pattern chosen over if/else for extensibility to future categories"
  - "Finance system prompt preserved exactly from v1.0 — zero behavioral regression on existing category"

patterns-established:
  - "Category routing pattern: single CLI arg -> FEEDS_BY_CATEGORY lookup -> category-specific prompts -> category stored in DB"

requirements-completed:
  - TECH-01
  - TECH-02
  - TECH-03

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 5 Plan 01: Tech Pipeline Category Parameterization Summary

**Category-aware pipeline routing: TECH_FEEDS (TechCrunch/HN/Ars Technica) + tech journalist Groq prompts via `python -m pipeline.run tech`, with SQL migration adding category column to editions**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-10T08:23:36Z
- **Completed:** 2026-03-10T08:26:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SQL migration adds `category TEXT NOT NULL DEFAULT 'finance' CHECK (category IN ('finance', 'tech'))` to editions table with index
- `ingest.py` defines FINANCE_FEEDS, TECH_FEEDS, FEEDS_BY_CATEGORY and category-scoped DB deduplication
- `script.py` has two distinct Groq system prompts — finance influencer tone vs tech journalist tone — and inserts category into edition rows
- `run.py` reads category from `sys.argv[1]` (default: 'finance'), validates it, logs at startup, and passes it through all pipeline stages

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration — add category column to editions** - `e094b84` (chore)
2. **Task 2: Parameterize ingest, script, and run for category** - `b84bba7` (feat)

## Files Created/Modified
- `supabase/migrations/20260310000000_add_category_to_editions.sql` - ALTER TABLE editions adding category column with CHECK constraint and index
- `pipeline/ingest.py` - FINANCE_FEEDS, TECH_FEEDS, FEEDS_BY_CATEGORY constants; fetch_and_deduplicate(category) with category-scoped DB dedup
- `pipeline/script.py` - _create_edition, _select_stories, _write_script, select_and_write all accept category param; two distinct Groq prompts
- `pipeline/run.py` - sys.argv[1] category arg, validation, startup log, category passed through all stages

## Decisions Made
- Category validation in run.py raises ValueError immediately — fail fast before any DB/API calls
- DB dedup in ingest.py scoped by editions.category — finance and tech articles can share URLs without cross-category suppression
- FEEDS_BY_CATEGORY dict pattern chosen over if/else for extensibility to future categories (sports, science, etc.)
- Finance system prompt preserved exactly from v1.0 — zero behavioral regression on existing category

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

The migration `20260310000000_add_category_to_editions.sql` must be applied to the Supabase database before running the tech pipeline:

```bash
supabase db push --linked
```

Then run the tech pipeline:
```bash
python -m pipeline.run tech
```

## Next Phase Readiness
- Finance pipeline: `python -m pipeline.run finance` works as before (backward compatible)
- Tech pipeline: `python -m pipeline.run tech` produces tech editions in Supabase
- Phase 6 (Category UI) requires the `/api/today` endpoint to accept a `category` query param to serve the correct edition for each tab

## Self-Check: PASSED

- migration file: FOUND
- pipeline/ingest.py: FOUND
- pipeline/script.py: FOUND
- pipeline/run.py: FOUND
- e094b84 (Task 1 commit): FOUND
- b84bba7 (Task 2 commit): FOUND
- 31dc437 (metadata commit): FOUND

---
*Phase: 05-tech-pipeline*
*Completed: 2026-03-10*
