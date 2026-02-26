# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A finite, curated daily financial briefing — users always know when they're done.
**Current focus:** Planning next milestone (v1.1)

## Current Position

Milestone: v1.0 MVP — COMPLETE (shipped 2026-02-26)
Status: All 4 phases complete (14/14 plans). Production live at https://autonews-ai.vercel.app. Cron active at 6am/5pm EST from master.
Last activity: 2026-02-26 — v1.0 milestone archived. Next: /gsd:new-milestone to define v1.1.

Progress: [██████████████] 87%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~11 min
- Total execution time: ~117 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |
| 02-pipeline | 5 | ~49 min | ~10 min |
| 03-frontend | 4 | ~10 min | ~2.5 min |
| 04-ship | 1 | ~2 min | ~2 min |

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
- [03-fix]: videoRefOverride must be passed into useVideoPlayer hook as externalVideoRef — IntersectionObserver must reference the same element as the <video> ref; without this, play/pause calls fire on null and only the first video autoplays
- [03-fix]: Tailwind utility classes (absolute, inset-0, object-cover) replaced with inline styles on video element — guarantees rendering regardless of Tailwind v4 content scanning
- [03-fix]: feed-container max-width: 430px + margin: 0 auto moved to outer VideoFeed wrapper (position: relative) — allows MuteButton and overlays to use position: absolute within the column instead of position: fixed (which was viewport-relative and leaked outside the column on desktop)
- [03-UX]: Video layout changed from full-screen to flex column: video section (flex: 1, object-cover) + info panel (auto height, bg #111) — info panel shows date/time, headline (2-line clamp), "Leer artículo completo →" link
- [03-UX]: formatDateTime in VideoItem outputs "Hoy · HH:MM" / "Ayer · HH:MM" / full date — uses es-ES locale, derived from edition.published_at
- [03-UX]: Edition navigation bar added to VideoFeed top — only rendered when allEditions.length > 1; shows ← Anterior / [timestamp] / Siguiente → buttons; disabled at boundaries
- [03-UX]: Edition switching fetches /api/editions/{id} client-side, resets activeIndex and scroll to top — no page reload needed
- [03-API]: /api/today now returns all_editions metadata (id, published_at, edition_date) alongside the full latest edition — single request at page load provides everything needed for the nav bar
- [03-API]: New /api/editions/[id] endpoint — returns specific published edition with sorted videos; 404 if not found or not published
- [03-schema]: editions table UNIQUE constraint on edition_date was dropped (migration 20260225) — allows multiple pipeline runs per day, each creating its own edition row identified by UUID
- [03-UX]: MuteButton uses no positional CSS itself — positioned by absolute wrapper in VideoFeed; removes viewport-relative drift on desktop
- [Phase 04-ship]: next.config.ts remotePatterns wildcard /storage/v1/object/public/** covers all Supabase Storage buckets; NEXT_PUBLIC_APP_URL must be Vercel production URL (not localhost) for SSR fetch in page.tsx Server Component
- [04-01]: timeout-minutes: 45 not 30 — first cold-cache run estimated 20-28 min; tighten to 30 after measuring real runs
- [04-01]: HuggingFace cache key is static (huggingface-faster-whisper-tiny-en-v1) — model weights are deterministic, no need for content-based key
- [04-01]: Secrets in env: block on Run pipeline step ONLY — not at job/workflow level to minimize exposure surface
- [04-01]: actions/cache@v4 (not v3) — v3 deprecated Feb 2025, v4 required for new cache backend service
- [04-02]: NEXT_PUBLIC_APP_URL set to https://autonews-ai.vercel.app (not localhost) — page.tsx Server Component fetches /api/today via absolute URL during SSR on Vercel servers
- [04-02]: Root Directory set to frontend in Vercel dashboard — without this, Vercel builds from repo root and fails to detect Next.js framework
- [04-02]: remotePatterns wildcard /storage/v1/object/public/** covers all Supabase Storage buckets without enumerating each bucket individually
- [Phase 04-ship]: find_dotenv() must NOT use raise_error_if_not_found=True on GitHub Actions — .env absent, secrets come from env: block in workflow
- [Phase 04-ship]: GitHub Actions first warm-cache run: 4m40s — 45-minute timeout is very conservative; tighten to 15 minutes after a few more observed runs
- [Phase 04-ship]: iOS real-device validation passed (tap-to-unmute critical path) — the known Phase 1 blocker confirmed resolved on real iPhone hardware; Android deferred, not a blocker for v1

### Pending Todos

None yet.

### Blockers/Concerns

- Verify Groq free tier rate limits at console.groq.com/docs/rate-limits before scheduling
- Video file size target (10 MB at 720p CRF 28) empirically validated: clips produced ~3-8 MB, within budget

## Session Continuity

Last session: 2026-02-26
Stopped at: Phase 04 Plan 03 complete. GitHub Actions pipeline validated (4m40s first run, 5 stories). Real iOS device testing approved — tap-to-unmute working on real hardware. Phase 4 ship complete. Production: https://autonews-ai.vercel.app. Cron: 6am/6pm UTC from master.
Resume file: None
