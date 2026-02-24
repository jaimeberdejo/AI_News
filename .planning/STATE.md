# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A finite, curated daily financial briefing — users always know when they're done.
**Current focus:** Phase 2 - Pipeline

## Current Position

Phase: 2 of 7 (Pipeline)
Plan: 0 of 5 in current phase (Phase 1 complete, Phase 2 not started)
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-02-24 — Completed 01-02-PLAN.md (Phase 1 complete)

Progress: [██░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~31 min
- Total execution time: ~1 hour

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |

**Recent Trend:**
- Last 5 plans: ~31 min avg
- Trend: baseline

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

### Pending Todos

None yet.

### Blockers/Concerns

- iOS Safari tap-to-unmute must be tested on a real iPhone (not Simulator) during Phase 6 — synchronous gesture handler only manifests on real device
- Verify Groq free tier rate limits at console.groq.com/docs/rate-limits before Phase 2 implementation
- Video file size target (10 MB at 720p CRF 28) needs empirical validation during Phase 3 — if clips are 20 MB, storage math changes

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 01-02-PLAN.md — Supabase migration applied, storage bucket created, all 7 infra checks pass. Phase 1 complete.
Resume file: None
