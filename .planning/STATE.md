# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A finite, curated daily financial briefing — users always know when they're done.
**Current focus:** Phase 2 - Pipeline

## Current Position

Phase: 2 of 7 (Pipeline)
Plan: 4 of 5 in current phase
Status: In progress — Phase 2 plan 4 of 5 complete
Last activity: 2026-02-24 — Completed 02-04-PLAN.md (Pexels b-roll download and FFmpeg video assembly)

Progress: [██████░░░░] 43%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~11 min
- Total execution time: ~66 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |
| 02-pipeline | 4 | ~4 min | ~1 min |

**Recent Trend:**
- Last 5 plans: ~16 min avg
- Trend: fast execution for well-specified plans

*Updated after each plan completion*
| Phase 02-pipeline P03 | 2 | 1 tasks | 1 files |

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
- [02-02]: Edition deduplication via SELECT-then-INSERT raises RuntimeError on published re-run — prevents duplicate video rows
- [02-02]: Groq story index clamped to [:5] in code — belt-and-suspenders on top of videos.position BETWEEN 1 AND 5 DB constraint
- [02-02]: Out-of-range Groq index logged as warning and skipped (not raised) — partial results better than full failure
- [02-04]: subprocess.run for FFmpeg (not ffmpeg-python) — plan pre-decided; avoids known ASS filter bug on macOS
- [02-04]: scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280 — plain scale distorts non-9:16 portrait clips
- [02-04]: Warn-and-continue (not hard-error) if still >10 MB after CRF 32 — high-motion b-roll cannot always hit 10 MB
- [Phase 02-pipeline]: [02-03]: voice=onyx for TTS — deep male voice suits financial news tone
- [Phase 02-pipeline]: [02-03]: faster-whisper tiny.en device=cpu compute_type=int8 — CPU-only, quantized for speed on GitHub Actions
- [Phase 02-pipeline]: [02-03]: 3-word subtitle chunks — balances readability with synchronization timing
- [Phase 02-pipeline]: [02-03]: Module-level _whisper singleton — avoids 75 MB re-download on every story; one download per process

### Pending Todos

None yet.

### Blockers/Concerns

- iOS Safari tap-to-unmute must be tested on a real iPhone (not Simulator) during Phase 6 — synchronous gesture handler only manifests on real device
- Verify Groq free tier rate limits at console.groq.com/docs/rate-limits before Phase 2 implementation
- Video file size target (10 MB at 720p CRF 28) needs empirical validation during Phase 3 — if clips are 20 MB, storage math changes

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 02-04-PLAN.md — pipeline/video.py created with download_broll() and assemble(); Pexels portrait HD b-roll download with stock market fallback; FFmpeg 720x1280 assembly with burned-in ASS subtitles; 10 MB CRF 32 re-encode fallback. User setup pending: PEXELS_API_KEY and brew install ffmpeg.
Resume file: None
