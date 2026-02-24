# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A finite, curated daily financial briefing — users always know when they're done.
**Current focus:** Phase 2 - Pipeline

## Current Position

Phase: 2 of 7 (Pipeline)
Plan: 1 of 5 in current phase
Status: In progress — Phase 2 plan 1 of 5 complete
Last activity: 2026-02-24 — Completed 02-01-PLAN.md (pipeline models and RSS ingest)

Progress: [███░░░░░░░] 21%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~21 min
- Total execution time: ~63 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |
| 02-pipeline | 1 | ~1 min | ~1 min |

**Recent Trend:**
- Last 5 plans: ~21 min avg
- Trend: fast execution for well-specified plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: FFmpeg subprocess (not MoviePy) — MoviePy 2.x has breaking changes
- [Setup]: faster-whisper tiny.en for forced alignment — OpenAI TTS returns no timestamps
- [Setup]: 7-day video retention policy — Supabase free tier 1 GB storage exhausted in ~10 days without it
- [Setup]: Public GitHub Actions repo — unlimited free minutes (critical cost lever)
- [Setup]: No auth in v1 — minimize friction for validation
- [01-01]: SUPABASE_URL (non-prefixed) for Python pipeline, NEXT_PUBLIC_SUPABASE_URL for Next.js — avoids NEXT_PUBLIC_ in server-side Python
- [01-01]: Singleton pattern for pipeline db.py (_client global) — avoids connection overhead on repeated calls
- [01-01]: 200-with-null for /api/today instead of 404 — prevents error state during pipeline window
- [01-01]: @supabase/supabase-js (not @supabase/ssr) — no user auth sessions, vanilla client sufficient
- [01-01]: One-per-day editions with UNIQUE constraint on edition_date — MVP simplicity
- [01-02]: Storage bucket path convention editions/{edition_date}/{slug}.mp4 — enables date-based cleanup for 7-day retention
- [01-02]: Public bucket (not signed URLs) — public-access app, signed URLs add latency with no auth benefit
- [01-02]: 15 MB bucket-level file size limit — belt-and-suspenders on top of pipeline code limit
- [01-02]: video/mp4 MIME restriction at bucket level — prevents wrong-type uploads breaking <video> element
- [01-02]: frontend/.env.local for Next.js (NEXT_PUBLIC_ vars), .env at repo root for Python — matches each system's loading conventions
- [02-01]: Yahoo Finance + CNBC RSS only (Reuters dead since 2020) — no broken feeds in FEEDS list
- [02-01]: stdlib dataclasses only in pipeline/models.py — pydantic overkill for local inter-module contracts
- [02-01]: DB dedup with gte(created_at, today) — catches same-day pipeline re-runs without full history scan
- [02-01]: requirements.txt created once in plan 02-01 — no subsequent pipeline plan modifies it

### Pending Todos

None yet.

### Blockers/Concerns

- iOS Safari tap-to-unmute must be tested on a real iPhone (not Simulator) during Phase 6 — synchronous gesture handler only manifests on real device
- Verify Groq free tier rate limits at console.groq.com/docs/rate-limits before Phase 2 implementation
- Video file size target (10 MB at 720p CRF 28) needs empirical validation during Phase 3 — if clips are 20 MB, storage math changes

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 02-01-PLAN.md — pipeline/models.py and pipeline/ingest.py created, requirements.txt with all pipeline deps, all imports verified.
Resume file: None
