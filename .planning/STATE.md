# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A finite, curated daily financial briefing — users always know when they're done.
**Current focus:** Phase 3 - Frontend (Plan 3 complete)

## Current Position

Phase: 3 of 7 (Frontend) — IN PROGRESS
Plan: 3 of 4 complete
Status: Plan 03-03 complete — iOS-safe synchronous unmute, next-2-video preloading, progress dots, EndCard with time estimate + Watch again + silent edition refresh
Last activity: 2026-02-25 — Completed 03-03-PLAN.md (globalMuted module-level flag, isMutedRef pattern, preload via 1px visibility:hidden, progress dots, EndCard component)

Progress: [█████████░] 65%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: ~12 min
- Total execution time: ~116 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |
| 02-pipeline | 5 | ~49 min | ~10 min |
| 03-frontend | 3 | ~7 min | ~2 min |

**Recent Trend:**
- Last 5 plans: ~10 min avg (pipeline plans well-specified)
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
- [02-02]: Edition deduplication via SELECT-then-INSERT raises RuntimeError on published re-run — prevents duplicate video rows
- [02-02]: Groq story index clamped to [:5] in code — belt-and-suspenders on top of videos.position BETWEEN 1 AND 5 DB constraint
- [02-02]: Out-of-range Groq index logged as warning and skipped (not raised) — partial results better than full failure
- [02-04]: subprocess.run for FFmpeg (not ffmpeg-python) — plan pre-decided; avoids known ASS filter bug on macOS
- [02-04]: scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280 — plain scale distorts non-9:16 portrait clips
- [02-04]: Warn-and-continue (not hard-error) if still >10 MB after CRF 32 — high-motion b-roll cannot always hit 10 MB
- [02-03]: voice=onyx for TTS — deep male voice suits financial news tone
- [02-03]: faster-whisper tiny.en device=cpu compute_type=int8 — CPU-only, quantized for speed on GitHub Actions
- [02-03]: 3-word subtitle chunks — balances readability with synchronization timing
- [02-03]: Module-level _whisper singleton — avoids 75 MB re-download on every story; one download per process
- [02-05]: upload_video() upsert=true — handles re-uploads on partial re-runs without 409 errors
- [02-05]: subtitles= filter instead of ass= — ffmpeg-full libass requires subtitles= filter name
- [02-05]: ffprobe probe + -t flag instead of -shortest — -shortest hangs indefinitely with MP3 in ffmpeg-full
- [02-05]: Edition published as 'partial' if any story fails — frontend can still serve successful stories
- [03-01]: Tailwind v4 uses @tailwindcss/postcss plugin (not tailwindcss) — v4 changed postcss integration
- [03-01]: useEdition hook marked 'use client'; page.tsx is Server Component (no 'use client') — correct SSR/client boundary
- [03-01]: page.tsx fetches /api/today via NEXT_PUBLIC_APP_URL absolute URL — required for server-side fetch in Next.js
- [03-01]: scroll-snap-stop: always on .feed-item — prevents fast-swipe skipping items (Safari 15+)
- [03-01]: No Geist fonts in layout.tsx — unnecessary weight for full-screen video PWA
- [03-02]: VideoItem keeps 'muted' JSX prop + useVideoPlayer sets video.muted on intersection — two-layer muted sync
- [03-02]: isMuted in useEffect deps — observer re-attaches with current muted value on toggle
- [03-02]: threshold: 0.7 on IntersectionObserver — 70% visibility before play, standard for vertical feed
- [03-02]: MuteButton uses inline styles for fixed positioning — avoids Tailwind purge risks with dynamic z-index
- [03-02]: showEndCard placeholder in VideoFeed — minimal end state, replaced in Plan 03
- [03-03]: globalMuted as module-level let (not React state) — IntersectionObserver callbacks run outside React's render cycle; stale closures unreliable
- [03-03]: isMutedRef pattern in useVideoPlayer with empty deps — observer created once, reads ref dynamically instead of re-attaching on every mute toggle
- [03-03]: Preload via 1px fixed visibility:hidden (not display:none) — iOS buffers elements it considers on-screen; display:none prevents buffering
- [03-03]: Progress dots use pill-shaped bars (6px → 20px active) — Instagram Stories style per CONTEXT.md
- [03-03]: EndCard new-edition detection triggers window.location.reload() — user on end card won't notice; cleanest way to get fresh SSR data
- [03-03]: getNextEditionMessage uses hour-of-day buckets (morning/afternoon/tonight/tomorrow morning) not countdown timer
- [Phase 03-04]: Next.js MetadataRoute.Manifest (native App Router) used for PWA manifest — no plugin needed, /manifest.webmanifest auto-generated
- [Phase 03-04]: appleWebApp.statusBarStyle: black-translucent — status bar overlays content for full-screen dark video UI

### Pending Todos

None yet.

### Blockers/Concerns

- iOS Safari tap-to-unmute must be tested on a real iPhone (not Simulator) during Phase 6 — synchronous gesture handler only manifests on real device
- Verify Groq free tier rate limits at console.groq.com/docs/rate-limits before scheduling
- Video file size target (10 MB at 720p CRF 28) empirically validated: clips produced ~3-8 MB, within budget

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 03-03-PLAN.md — iOS-safe synchronous unmute (globalMuted module-level flag, isMutedRef, handleMuteToggle synchronous forEach), preloading next 2 videos (1px fixed visibility:hidden), progress dots overlay, EndCard with Watch again + silent edition refresh.
Resume file: None
