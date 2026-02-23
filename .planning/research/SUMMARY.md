# Project Research Summary

**Project:** FinFeed — AI Video Pipeline + PWA Financial News App
**Domain:** AI-generated vertical video pipeline + mobile-first PWA (financial news)
**Researched:** 2026-02-23
**Confidence:** MEDIUM (most free-tier limits need verification; core architecture is HIGH)

## Executive Summary

FinFeed is a daily-refresh, finite vertical video feed for financial news, where all content is AI-generated via a batch pipeline before any user ever opens the app. The right mental model is a two-system product: a GitHub Actions cron job that runs 1-2x/day to produce 5 MP4 videos and publish their metadata, and a Next.js PWA that consumes pre-published video URLs and delivers a TikTok-style scroll experience. The architecture is intentionally simple — no real-time processing, no dynamic video generation, no on-demand compute — which is the correct tradeoff for a zero-server-cost MVP at this scale.

The recommended stack is ultra-cheap and well-validated: Groq (Llama 3.3 70B) for script generation at essentially $0, OpenAI TTS `tts-1` for audio at ~$1.35-$2/month, `faster-whisper` for forced subtitle alignment (free, runs on GitHub Actions), FFmpeg via subprocess for video assembly, Pexels API for free b-roll, Supabase for both Postgres and file storage, and Next.js 15 on Vercel for the PWA. The total monthly cost lands at approximately $1.35-$2, all driven by TTS character volume. The pipeline runs on public GitHub Actions repos (unlimited free minutes), which is the critical cost lever.

The top risks are browser-specific and operational. iOS Safari's autoplay policy requires strict synchronous unmute-in-gesture-handler patterns — getting this wrong produces silent audio failures that only manifest on real iOS devices. OpenAI TTS does not return word-level timestamps, making forced alignment via Whisper a mandatory architectural step that must be designed in from day one, not retrofitted. Supabase Storage's 1 GB free tier and 2 GB egress limit require an aggressive 7-day video retention policy and compressed video targets (~10-15 MB per clip), or they will be breached in the first two weeks. These three issues — iOS audio, subtitle alignment, and storage limits — are the make-or-break risks for a successful MVP.

---

## Key Findings

### Recommended Stack

The pipeline is entirely Python-based, running as a single GitHub Actions job with sequential steps. The frontend is Next.js 15 (App Router) deployed to Vercel. The two systems communicate only through Supabase: the pipeline writes to Postgres and Storage using a service key; the frontend reads via a Next.js API route using the anon key with RLS-enforced read-only access to published editions.

**Core technologies:**

- **Groq API (Llama 3.3 70B):** Script generation — free tier, ~200 tok/s inference, sufficient quality for 30-45s financial news scripts
- **OpenAI TTS `tts-1`:** Audio generation — $15/1M chars = ~$1.35-$2/month at 5 videos/day; simpler than GCP TTS with comparable quality
- **faster-whisper (`tiny.en` model):** Forced subtitle alignment — mandatory because OpenAI TTS returns no timestamps; 4x faster than original Whisper, fits in GitHub Actions 7 GB RAM
- **FFmpeg (subprocess, not MoviePy):** Video assembly — MoviePy 2.x has breaking changes and is unnecessary abstraction; direct FFmpeg subprocess is 10-20 lines of Python
- **Pexels API:** Free b-roll — 200 req/hour, 20K req/month; pipeline uses ~300 requests/month
- **GitHub Actions (public repo):** Pipeline runner — unlimited minutes on public repos; 2-core, 7 GB RAM sufficient for `tiny.en` Whisper + FFmpeg; ~6 min per run
- **Supabase (Postgres + Storage):** Single backend — DB + file storage in one integration; free tier requires 7-day video deletion policy
- **Next.js 15:** PWA frontend — App Router, Client Components for interaction-heavy scroll UX, Vercel native deployment
- **Vercel (Hobby):** Frontend hosting — free tier, CDN, zero config for Next.js

**Critical version notes:**
- `faster-whisper >= 1.0.3` (not `openai-whisper` — slower, more RAM)
- `openai >= 1.30.0` for TTS streaming support
- `supabase >= 2.4.0` for Storage SDK

### Expected Features

**Must have (table stakes):**
- Muted autoplay on first load — required by all browsers; no workaround
- Tap-to-unmute with visual muted indicator — stored per session, not per-video
- Vertical snap scroll — CSS `scroll-snap-type: y mandatory`; 60fps hardware-accelerated
- Full-screen video (9:16 aspect ratio, `object-fit: cover`) — no letterboxing
- "N of 5" card position indicator — critical for finite feed UX
- "You're up to date" end card with countdown to next update — core product promise
- Preloading (next 2 videos) — prerequisite for zero-delay swipe
- `playsinline` attribute — required for iOS or video opens fullscreen player
- PWA manifest: standalone, portrait, dark theme-color, icons — makes app feel native

**Should have (differentiators in v1):**
- Synchronized subtitles toggle — near-zero cost since script text is already a pipeline byproduct; high value for commuters watching on mute; financial news density benefits from text
- Disclaimer footer ("not financial advice") — legal protection, finance-specific user expectation
- Source credibility signal ("based on Reuters/Yahoo Finance reports") — reduces user anxiety about AI-generated content

**Defer to v1.1+:**
- Web Share API button — add when organic sharing is observed
- "Already watched" state (localStorage) — add when returning-user behavior is measured
- Offline fallback page — nice to have, not needed for validation
- Keyboard navigation — desktop UX, low priority vs. mobile core

**Explicitly excluded (anti-features):**
- Infinite scroll, "load more" — destroys the finite feed promise
- Social features (comments, likes, reactions) — requires moderation, auth, backend complexity
- Personalization / algorithmic feed — massive scope increase
- Push notifications — complex, not needed for validation
- Landscape mode — portrait-only vertical video content

### Architecture Approach

The architecture is a strict write-ahead batch system: all videos are pre-generated before users arrive. The pipeline is a single Python orchestrator (`pipeline/run.py`) with 7 sequential steps, each writing state to Postgres so re-runs are idempotent. The frontend never proxies video through Vercel — it only serves the Next.js HTML/JS/CSS shell, with video files streamed directly from Supabase Storage's CDN-backed public URLs. The Next.js API route (`/api/today`) wraps the Supabase query server-side, keeping the service key off the browser and enabling future Vercel edge caching of the metadata response.

**Major components:**

1. **GitHub Actions Batch Runner** — cron at 6am + 6pm UTC; single job, sequential steps; timeout-minutes: 30
2. **Pipeline Orchestrator (`pipeline/run.py`)** — 7 steps: fetch → script → tts → broll → assemble → upload → publish; state in Postgres; per-story try/except for partial success
3. **Supabase Postgres** — source of truth for editions, videos, pipeline_runs tables; RLS enforces read-only published editions for anon key
4. **Supabase Storage (bucket: `videos`)** — MP4 files at `editions/{date}/story-{n}.mp4`; 7-day retention enforced by pipeline cleanup step
5. **Next.js API Route (`/api/today`)** — server-side Supabase query; returns edition metadata + 5 video URLs; enables edge caching
6. **SwipeableFeed Component** — CSS scroll-snap vertical feed; IntersectionObserver for preload; synchronous unmute in gesture handler; video src release on swipe-past

**Database schema (3 tables):**
- `editions` — one record per daily run (status, dates, pipeline_run ref)
- `videos` — 5 records per edition (position, script_text, video_url, duration, status)
- `pipeline_runs` — audit log with steps_log JSONB and error_log JSONB

### Critical Pitfalls

1. **iOS Safari autoplay unmute race condition** — Calling `video.muted = false` outside a synchronous gesture handler silently fails on iOS. The unmute call and `play()` call must both happen synchronously inside the `click`/`touchend` handler on the video element itself (not a wrapper div). The `play()` promise must be `.catch()`-ed. This only manifests on real iOS devices, not Chrome desktop or simulators.

2. **OpenAI TTS returns no word timestamps** — Unlike AWS Polly, Azure TTS, and Google Cloud TTS, OpenAI TTS returns only audio bytes. Subtitle sync cannot be derived from the API response. The correct fix is mandatory from day one: generate audio, run `faster-whisper` on it with `word_timestamps=True`, extract per-word timestamps, generate ASS/SRT subtitles from those timestamps, burn with FFmpeg. Estimating timing from character count drifts badly for financial terminology.

3. **Supabase free tier storage exhaustion in ~10 days** — 5 videos × 15-20 MB each = 75-100 MB per edition. At 1 GB free storage, the bucket fills in 10 days without a deletion policy. The pipeline MUST include a cleanup step that deletes editions older than 7 days before generating new content. Additionally, video file targets should be 720p, H.264 CRF 28, AAC 128kbps (~10-15 MB/clip), not 1080p which produces ~20 MB/clip.

4. **Service worker intercepting video range requests** — A PWA service worker that caches video files will intercept range requests and return status 200 instead of 206 (Partial Content), causing Safari to refuse playback and Chrome to buffer entire files. Videos must be explicitly excluded from service worker caching: pass all requests to `*.supabase.co/storage/v1/object/` directly to the network.

5. **LLM hallucination of specific financial figures** — Llama 3.3 will confidently fabricate stock prices, percentages, and executive quotes that were never in the source article. For a financial product this is a reputational and legal risk. The system prompt must explicitly prohibit numbers not verbatim in the source, and a post-generation validation step should regex-check all percentages and dollar amounts against the source article text.

6. **GitHub Actions disk space exhaustion mid-run** — Downloading full b-roll clips (300-500 MB each) without cleanup can exhaust the 14 GB runner disk by video 3-4 of 5. B-roll clips and intermediate files must be deleted immediately after each video completes assembly.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and pitfall phases from PITFALLS.md, the build order is non-negotiable: the pipeline must produce real video files before the frontend can be meaningfully tested. The suggested phases follow this hard dependency chain.

### Phase 1: Data Foundation (Supabase Setup)

**Rationale:** Every other component depends on Supabase. The pipeline writes to it; the frontend reads from it. This must exist and be tested before any other work starts.
**Delivers:** Working Supabase project with migrations applied, RLS policies active, Python service key connectivity verified, anon key read-only access verified
**Addresses:** Pitfall 7 (CORS must be configured before any frontend video work), Pitfall 3 (anti-pattern: anon key for writes)
**Key tasks:** Create editions/videos/pipeline_runs schema, apply RLS policies, configure Storage bucket CORS with `Content-Range` and `Accept-Ranges` headers, verify `getPublicUrl()` pattern in Python SDK
**Research flag:** Standard Supabase patterns — skip research-phase. Verify current free tier limits (1 GB storage, 2 GB egress) at supabase.com/pricing before launch.

### Phase 2: Pipeline — Script Generation (RSS + LLM + TTS)

**Rationale:** Script and audio quality can be validated independently of video. This is the cheapest step to iterate on and the one with the most domain-specific risk (LLM hallucination).
**Delivers:** Working RSS ingestion with deduplication, 5 LLM-generated scripts per run saved to DB, 5 MP3 audio files generated and locally inspectable, forced Whisper alignment producing word-level timestamps
**Uses:** `feedparser`, `groq` SDK (Llama 3.3 70B), `openai` TTS (`tts-1`), `faster-whisper` with `word_timestamps=True`
**Avoids:** Pitfall 2 (TTS timestamp assumption — Whisper must be integrated here, not later), Pitfall 5 (Groq retry logic), Pitfall 9 (hallucination validation regex), Pitfall 10 (feedparser bozo check, per-feed try/except)
**Research flag:** Skip research-phase. Well-documented stack. The only uncertainty is Groq free tier rate limits — verify at console.groq.com/docs/rate-limits before implementation.

### Phase 3: Pipeline — Video Assembly (FFmpeg + B-Roll)

**Rationale:** Video quality, file size, and subtitle rendering are the hardest aspects to tune. This phase requires the most iteration and must be validated before automating.
**Delivers:** Working FFmpeg assembly producing 720p MP4 at 10-15 MB per 30-45s clip, ASS subtitle burning with bundled fonts, b-roll download from Pexels with fallback generic clips, disk cleanup after each video
**Uses:** FFmpeg (subprocess, not MoviePy), Pexels API, `httpx`, bundled font assets for CI consistency
**Avoids:** Pitfall 3 (bundle fonts in repo, check libass availability), Pitfall 4 (stream or cleanup b-roll immediately, target <15 MB/video), Pitfall 12 (fallback b-roll for zero-result searches)
**Research flag:** Skip research-phase for FFmpeg patterns. Consider research-phase for ASS subtitle format and karaoke tag syntax if word-level highlighting is implemented.

### Phase 4: Pipeline — Upload, Publish, and Cleanup

**Rationale:** This phase completes the pipeline and produces the first publicly accessible video URLs. Cannot start the frontend until this works end-to-end.
**Delivers:** MP4 files in Supabase Storage with public CDN URLs, edition marked `published` in Postgres, editions older than 7 days deleted on each run, full pipeline runnable locally via `python -m pipeline.run`
**Uses:** `supabase-py` Storage SDK, `getPublicUrl()` for URL generation, cleanup step in pipeline
**Avoids:** Pitfall 5 (storage exhaustion — 7-day retention is the fix), Pitfall 3 (anti-pattern: storing videos in GitHub artifacts)
**Research flag:** Skip research-phase. Standard upload/publish patterns.

### Phase 5: GitHub Actions Automation

**Rationale:** After the pipeline runs reliably locally, automating it in CI is low-risk. Public repo = unlimited free minutes — this is the critical cost lever. Must be done before Phase 7 deployment validation.
**Delivers:** Cron-triggered workflow at 6am + 6pm UTC, GitHub Secrets configured for all API keys, Python dependency caching with `actions/cache` (saves 2-3 min/run), Whisper model caching (~74 MB), 30-minute job timeout
**Avoids:** Pitfall 4 (add disk space monitoring early), Pitfall 13 (Whisper model caching)
**Research flag:** Skip research-phase. GitHub Actions YAML patterns are well-documented.

### Phase 6: PWA Frontend

**Rationale:** Can be scaffolded with mock data in parallel with Phase 4, but CANNOT be meaningfully tested until real video files exist. Video file size, CDN streaming behavior, and load latency are core UX issues that only appear with real videos on real mobile devices.
**Delivers:** Next.js 15 App Router PWA with vertical snap scroll, muted autoplay, tap-to-unmute (synchronous, gesture-handler pattern), `playsinline` on all video elements, preload next 2 videos via IntersectionObserver, "N of 5" indicator, "You're up to date" end card with countdown, subtitle toggle (WebVTT from Whisper timestamps), PWA manifest (standalone, portrait), service worker caching app shell only (video requests bypass to network)
**Avoids:** Pitfall 1 (iOS Safari synchronous unmute — must test on real device), Pitfall 8 (service worker video bypass), Pitfall 11 (memory management: clear src on past videos)
**Research flag:** Skip research-phase for core patterns (scroll-snap, IntersectionObserver, video preloading are well-documented). Consider research-phase for WebVTT generation from Whisper timestamp format if subtitle toggle is in scope for v1.

### Phase 7: Deployment and Validation

**Rationale:** Final phase verifies end-to-end on real infrastructure with real users. Requires Phase 5 (automated pipeline running) and Phase 6 (PWA deployed to Vercel).
**Delivers:** Vercel deployment, custom domain (optional), PWA installability tested on iOS and Android, first real user session with real video, monitoring of Supabase storage usage
**Avoids:** Pitfall 1 (test tap-to-unmute on iPhone SE and iPhone 14 Pro minimum), Pitfall 7 (verify CORS headers in production Vercel domain)
**Research flag:** Skip research-phase. Standard Vercel deploy process.

### Phase Ordering Rationale

- Phase 1 before all others: Supabase is the shared infrastructure both systems depend on. CORS must be configured before any frontend video work is attempted.
- Phase 2 before Phase 3: Script quality can be validated cheaply (audio playback) before investing in FFmpeg integration. LLM hallucination risk is highest here and cheap to address.
- Phase 3 before Phase 4: Cannot upload videos until they exist.
- Phase 4 before Phase 6 full testing: Frontend needs real CDN video URLs to validate preloading, streaming behavior, and file size UX impact.
- Phase 5 parallel with early Phase 6: GitHub Actions automation can proceed once the pipeline runs once locally. Frontend scaffolding with mock data can proceed from Phase 4 completion.
- Phase 7 last: Both automated pipeline and deployed frontend must exist before validation is meaningful.

### Research Flags

**Phases likely needing `/gsd:research-phase` during planning:**
- None of the phases require deep research-phase invocation. The entire stack is well-documented and the research files are comprehensive.
- The one exception: if **word-level karaoke-style subtitle highlighting** (ASS `{\k}` tags) is added to Phase 6, a targeted research step on ASS format karaoke tags and their FFmpeg rendering is worthwhile.

**Phases with standard patterns (skip research-phase):**
- All 7 phases — documented stack, established patterns, clear precedent. The research files have already answered the non-obvious questions.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core technology choices (FFmpeg subprocess, faster-whisper, Next.js 15, Vercel) are HIGH. Free tier limits (Groq, Supabase, Pexels) are MEDIUM — must verify at project start. MoviePy avoidance is HIGH (documented breaking changes). |
| Features | HIGH | Browser autoplay policies (muted always works, unmuted needs gesture, playsinline required on iOS) are stable since iOS 10 and unlikely to change. Scroll-snap, IntersectionObserver, PWA manifest patterns are web standards. Finite feed UX patterns are MEDIUM (observed behavior, no formal UX research). |
| Architecture | HIGH | Pipeline structure (sequential steps, Postgres checkpoints, idempotency by edition_date), RLS patterns, video serving (direct CDN URLs, never through Vercel), and API contract are all well-established patterns. Supabase CDN behavior details are MEDIUM — verify Cloudflare CDN cache behavior. |
| Pitfalls | HIGH | iOS Safari autoplay behavior, OpenAI TTS timestamp absence, and service worker range request failures are HIGH (documented, stable behaviors). Groq/Supabase free tier limits are MEDIUM (verify current values). LLM hallucination patterns are HIGH (general LLM behavior, not version-specific). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Free tier limits:** Verify Groq rate limits (console.groq.com/docs/rate-limits), Supabase storage/egress (supabase.com/pricing), Pexels rate limits (pexels.com/api/documentation), and GitHub Actions disk space at project start. These are the primary MEDIUM-confidence items that could affect phase planning.
- **Supabase bandwidth cliff:** At 2 GB egress/month (free tier), the product supports only ~26 complete user sessions before hitting limits. This is acceptable for validation but must be monitored. Plan Cloudflare R2 migration as the first infrastructure upgrade if validation succeeds. This is not a blocker for Phase 1-7 but should be documented as a known scaling gate.
- **iOS testing environment:** The most dangerous pitfall (autoplay race condition) only manifests on real iOS devices. Ensure a real iPhone is available for testing during Phase 6, not just iOS Simulator. This is an operational gap, not a research gap.
- **Video quality vs. size balance:** The 10-15 MB per clip target at 720p needs empirical validation during Phase 3. If FFmpeg CRF 28 at 720p produces 20 MB clips, the storage math changes and either quality or the retention policy needs adjustment.

---

## Sources

### Primary (HIGH confidence)

- faster-whisper GitHub (https://github.com/SYSTRAN/faster-whisper) — word_timestamps=True, model size/speed benchmarks
- GitHub Actions billing docs (https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions) — public repo unlimited minutes
- WebKit autoplay policy (https://webkit.org/blog/6784/new-video-policies-for-ios/) — muted autoplay, gesture requirement for unmute
- MDN Web Docs — CSS scroll-snap, IntersectionObserver, video playsinline, Web App Manifest
- Next.js 15 docs (https://nextjs.org/docs) — App Router, Client Components
- MoviePy 2.0 migration notes (https://zulko.github.io/moviepy/getting_started/updating_to_v2.html) — breaking changes documented
- Supabase RLS docs (https://supabase.com/docs/guides/auth/row-level-security) — standard patterns
- feedparser docs (https://feedparser.readthedocs.io/en/latest/bozo.html) — bozo flag behavior

### Secondary (MEDIUM confidence — verify before implementation)

- OpenAI TTS pricing (https://platform.openai.com/api/pricing) — $15/1M chars for tts-1
- Groq rate limits (https://console.groq.com/docs/rate-limits) — free tier limits
- Supabase pricing (https://supabase.com/pricing) — 1 GB storage, 2 GB egress free tier
- Pexels API docs (https://www.pexels.com/api/documentation/) — 200 req/hour, 20K req/month
- Vercel pricing (https://vercel.com/pricing) — 100 GB bandwidth free tier
- Supabase Storage CDN behavior (https://supabase.com/docs/guides/storage/cdn/fundamentals) — Cloudflare CDN backing

---

*Research completed: 2026-02-23*
*Ready for roadmap: yes*
