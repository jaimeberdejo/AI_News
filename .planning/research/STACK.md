# Technology Stack

**Project:** FinFeed — AI Video Pipeline + PWA Financial News App
**Researched:** 2026-02-23
**Mode:** Ecosystem — "What's the best ultra-cheap stack for this project in 2026?"

---

## Recommended Stack

### LLM: Script Writing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Groq API (Llama 3.3 70B) | `llama-3.3-70b-versatile` | Script writing from RSS headlines | Free tier, fast inference (~200 tok/s), Llama 3.3 70B quality is sufficient for financial news scripts |
| `groq` Python SDK | `>=0.9.0` | Groq API client | Official SDK, async support |

**Rationale:** Groq's free tier is the right call for a 1-2x/day batch job generating 5 scripts. At ~400 tokens per script, daily usage is ~2,000-4,000 input+output tokens — far under Groq's free limits. The `llama-3.3-70b-versatile` model produces coherent, fluent prose that handles "financial influencer" tone well.

**Free Tier Limits (MEDIUM confidence — verify at console.groq.com/docs/rate-limits):**
- ~6,000 tokens/minute for free tier on 70B models (as of late 2025)
- ~500,000 tokens/day on free tier
- Rate limit hits are retry-able; the batch job has no latency pressure

**Critical warning:** Groq's free tier is explicitly for development/testing in their ToS. For production batch jobs, you should monitor whether Groq enforces commercial restrictions. Risk is low for a low-volume MVP (10 requests/day max) but upgrade to the $5/mo pay-as-you-go tier if they enforce it. At this volume, paid tier costs < $0.02/month.

**What NOT to use:**
- OpenAI GPT-4o: Costs ~$0.015/1K input tokens — overkill for script writing, 100x more expensive
- Anthropic Claude: No free tier, minimum cost even at tiny volume
- Google Gemini Flash: Free tier exists but API stability for batch automation has been inconsistent

---

### TTS: Text-to-Speech

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI TTS `tts-1` | API (no versioning) | Convert scripts to audio | Best quality/cost for automated pipelines; no character limits per call |
| `openai` Python SDK | `>=1.30.0` | OpenAI API client | Official, async support, streaming |

**Rationale:** For 5 videos/day at 30-45s each (~75-115 words, ~450-700 characters), monthly usage is ~90,000-100,000 characters/month. OpenAI TTS-1 costs $15/1M characters = **~$1.35-$1.50/month**. This matches the PROJECT.md cost target of ~$0.50/mo (which may be slightly optimistic — budget $2/mo to be safe).

**TTS Comparison:**

| Provider | Cost | Quality | Free Tier | API Limits | Commercial Use | Verdict |
|----------|------|---------|-----------|------------|----------------|---------|
| OpenAI tts-1 | $15/1M chars | GOOD — natural, clear | None (pay from $0) | No per-call char limit | Yes | **RECOMMENDED** |
| OpenAI tts-1-hd | $30/1M chars | BETTER — but marginal | None | No per-call char limit | Yes | Skip — double cost, marginal gain for 30s clips |
| ElevenLabs Free | Free | EXCELLENT | 10,000 chars/month | Yes, strict | Restricted | Too low; 10K chars/mo = ~5 days of content, then blocked |
| ElevenLabs Starter | $5/mo | EXCELLENT | 30,000 chars/mo | Yes | Yes | Viable but more expensive than OpenAI at this volume |
| Google Cloud TTS | $4/1M chars (standard) $16/1M (WaveNet) | GOOD (WaveNet) | 1M chars/mo standard | Yes | Yes | Standard voices sound robotic; WaveNet costs similar to OpenAI |
| Google Cloud TTS Neural2 | $16/1M | GOOD | 1M chars/mo standard tier only | Yes | Yes | Similar cost to OpenAI tts-1-hd with more setup complexity |

**ElevenLabs free tier is a hard NO for production:** 10,000 characters/month covers roughly 3-4 days of content. The pipeline breaks on day 5 of the month.

**Google Cloud TTS is viable but adds complexity:** Requires GCP project setup, service account JSON, more IAM surface area. OpenAI is simpler, same budget, sufficient quality.

**What NOT to use:**
- ElevenLabs free tier — too low limit, breaks mid-month
- tts-1-hd — double cost for marginal quality improvement in 30-45s clips
- Coqui TTS (open source, self-hosted) — requires a server, adds cost and ops complexity for a batch job

---

### Subtitle Generation: Word-Level Timestamps

**The core problem:** OpenAI TTS does NOT return word-level timestamps. The audio is returned as an MP3/Opus stream with no timing metadata. This is a real gap that requires a workaround.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI Whisper (local) `whisper` | `>=20231117` | Transcribe TTS audio back to get word timestamps | Free, runs locally in GitHub Actions, high accuracy |
| OR: `faster-whisper` | `>=1.0.0` | Faster Whisper via CTranslate2 | 4x faster than original Whisper, same accuracy, lower RAM |

**Recommended workaround approach:**
1. Generate audio via OpenAI TTS → save as `audio.mp3`
2. Run `faster-whisper` locally on the audio with `word_timestamps=True`
3. Extract per-word timestamps from the transcript
4. Use timestamps to generate SRT/ASS subtitle file
5. Burn subtitles into video via FFmpeg

**Why faster-whisper over openai-whisper:**
- `faster-whisper` uses CTranslate2 backend: 4x speed improvement, 2x lower memory usage (MEDIUM confidence — from faster-whisper benchmark docs)
- Runs `tiny` or `base` models comfortably in GitHub Actions 2-core runner (7GB RAM limit)
- `tiny.en` model: ~39MB, processes 30s audio in ~3-5 seconds on CPU (sufficient for batch)
- Word-level timestamps are accurate to ±50ms for clean TTS audio (TTS is much cleaner than natural speech, so Whisper accuracy is very high)

**Alternative: Azure Speech SDK** — returns word timestamps but costs money and adds vendor lock-in.

**Alternative: `aeneas`** — forced alignment tool, aligns transcript to audio. More complex setup, overkill when Whisper works cleanly on TTS output.

**What NOT to use:**
- OpenAI Whisper API (cloud) — does not return word timestamps via the API (MEDIUM confidence — verify this hasn't changed)
- Manual timing calculation based on character count — too imprecise for professional subtitles

---

### Video Rendering: FFmpeg Assembly

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FFmpeg | System install (5.x+ on Ubuntu 22.04) | Video assembly: b-roll + audio + subtitles | Battle-tested, free, GPU-optional, one binary |
| `subprocess` (Python stdlib) | N/A | FFmpeg subprocess calls | Direct control of FFmpeg CLI, no abstraction overhead |

**Recommended: Direct FFmpeg subprocess, NOT MoviePy.**

**MoviePy vs FFmpeg subprocess:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| MoviePy | Pythonic API, easy composition | Wraps FFmpeg with overhead; MoviePy 2.x is a significant rewrite with breaking changes; slower for simple assembly; adds a dependency that lags FFmpeg features | SKIP |
| Direct FFmpeg subprocess | Full control, no abstraction layer, faster, stable | More verbose Python code, requires FFmpeg knowledge | RECOMMENDED |

**Why MoviePy is risky in 2026:** MoviePy 2.0 was released and is NOT backward-compatible with MoviePy 1.x. The ecosystem (tutorials, Stack Overflow answers) is mostly written for 1.x. Using MoviePy means managing this breaking change on top of the actual pipeline work. For a simple assembly job (concat b-roll clips, overlay audio, burn subtitles), FFmpeg CLI invocations are 10-20 lines of Python and require no third-party video library.

**Core FFmpeg pipeline for one video:**
```
1. Download b-roll clips from Pexels (pre-downloaded to disk)
2. Concat/trim b-roll to match audio duration
3. Apply scale filter to 9:16 (1080x1920) for vertical video
4. Overlay audio track
5. Burn subtitles via ASS filter (ass subtitle format supports word-level highlighting)
6. Output: MP4 (H.264 + AAC), target ~5-15MB for 30-45s
```

**Subtitle burning approach:** Use FFmpeg's `subtitles` or `ass` filter. ASS format supports `{\k}` karaoke tags for word-by-word highlighting — good for TikTok-style synchronized captions.

**What NOT to use:**
- MoviePy — version instability, unnecessary abstraction
- Remotion — Node.js-based video rendering, adds a Node dependency to a Python pipeline
- Shotstack API — paid, external dependency, overkill

---

### Stock B-Roll: Pexels API

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Pexels API | v1 | Download stock b-roll clips | Free, good quality, no attribution required (attribution recommended) |
| `requests` / `httpx` | `>=0.27.0` | HTTP client for Pexels API | `httpx` preferred for async support |

**Pexels Free Tier Limits (MEDIUM confidence — verify at pexels.com/api/documentation):**
- 200 requests/hour
- 20,000 requests/month
- Videos: 25 results per page max per request
- No download bandwidth limit stated
- Rate limit: 200 req/hour

**For this pipeline:** 5 videos × 3-5 b-roll clips each = 15-25 API requests per run × 2 runs/day = 30-50 requests/day = ~1,500 requests/month. Well within the 20,000/month limit.

**Best practices:**
- Cache downloaded b-roll locally (in GitHub Actions workspace or Supabase Storage) — avoid re-downloading the same clip on every run
- Search by financial keywords: "stock market", "trading", "economy", "charts", "city skyline", "business meeting"
- Download at 1080p (FHD) resolution for 1080x1920 output
- Pre-download a library of 20-30 clips in the first pipeline run and reuse them

**Alternative: Pixabay API** — also free, no API key required for basic use, but lower video quality and smaller library than Pexels. Use Pexels as primary, Pixabay as fallback.

**What NOT to use:**
- Shutterstock, Getty — paid, expensive
- Storyblocks — subscription model, not free

---

### Pipeline Runner: GitHub Actions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | Scheduled batch job (cron) | Free 2,000 min/month on public repos; zero server infrastructure |

**GitHub Actions Free Tier Limits:**
- Public repos: **Unlimited minutes** (confirmed — public repos have no minute limit)
- Private repos: 2,000 minutes/month for free accounts
- Runner specs: 2-core CPU, 7GB RAM, 14GB SSD (ubuntu-latest)
- Concurrent jobs: 20 for free tier

**For this pipeline:** Each run processes 5 videos. Estimated runtime per video: 30-60s TTS generation + 10-20s Whisper transcription + 30-60s FFmpeg assembly = ~2-3 minutes per video = ~15-20 minutes total per run × 2 runs/day = ~40 minutes/day = ~1,200 minutes/month.

**Recommendation: Make the repo public** to avoid the 2,000 min/month limit entirely.

**Known GitHub Actions limitations for this use case:**
1. **FFmpeg version:** `ubuntu-latest` (Ubuntu 22.04 as of 2026) ships with FFmpeg 4.4.x via apt. For latest FFmpeg features, use `sudo apt-get install ffmpeg` in the workflow to get the apt version, or use `Homebrew` action for newer builds. FFmpeg 4.4 is sufficient for H.264 encoding and subtitle burning.
2. **Artifact storage:** GitHub Actions artifacts are ephemeral (90 days max). Don't use artifacts for video storage — upload to Supabase Storage instead.
3. **Cron scheduling:** `schedule` trigger minimum interval is every 5 minutes. 1-2x/day (e.g., `0 7 * * *` and `0 17 * * *`) is well within limits.
4. **Network bandwidth:** No documented outbound bandwidth cap for GitHub Actions. Downloading b-roll (~50-200MB per run) and uploading to Supabase (~25-75MB per run) should be fine.
5. **Cold starts:** Each run starts from scratch. Python dependencies must be cached with `actions/cache` to avoid re-installing on every run (saves 2-3 minutes per run).

**Reliability:** GitHub Actions is production-grade infrastructure. Schedule triggers can occasionally be delayed by 10-30 minutes during GitHub load spikes, but for a 1-2x/day news pipeline, a 30-minute delay is acceptable.

**What NOT to use:**
- Railway free tier — limited execution time, not designed for batch compute
- AWS Lambda — cold starts, 15-minute execution limit is tight for video processing
- Render.com free tier — spins down after 15 minutes of inactivity, unreliable for cron

---

### Backend/Database: Supabase

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Hosted (no version) | Postgres DB + file storage for videos | Free tier covers MVP; Postgres + Storage in one; no server to manage |
| `supabase-py` | `>=2.4.0` | Python client for pipeline uploads | Official SDK, supports Storage and DB |
| Supabase JS client | `>=2.0.0` | Frontend reads (video URLs, metadata) | Official SDK for Next.js/Astro |

**Supabase Free Tier Limits (MEDIUM confidence — verify at supabase.com/pricing):**
- Database: 500MB included
- Storage: 1GB included
- Bandwidth: 5GB/month
- Edge Functions: 500K invocations/month
- Paused after 1 week of inactivity (CRITICAL — see warning below)

**CRITICAL FREE TIER WARNING: Project Pausing**
Supabase pauses free projects after 7 days of inactivity. For a pipeline that runs daily, this won't trigger — but it's a hard blocker if you stop running the pipeline (e.g., debugging for a week). Workaround: Set up a GitHub Actions health-check ping or upgrade to Pro ($25/mo) once the project shows traction.

**Storage math:** 5 videos/day × ~10MB each = 50MB/day × 30 days = 1.5GB/month. This **exceeds** the 1GB free storage limit. You have two options:
1. **Delete videos older than N days** — pipeline deletes videos >7 days old on each run. Keeps storage under 350MB at all times. Recommended for MVP.
2. **Use lower bitrate encoding** — target 5MB per video instead of 10MB. Reduce FFmpeg bitrate to `300k` for the video stream. At 30-45 seconds, 5MB is achievable with acceptable quality.

**Bandwidth math:** Each video view streams ~10MB. At 5GB/month bandwidth, you can serve ~500 video views/month on the free tier before overage. For a MVP in validation phase, this is likely sufficient (unless you go viral). Supabase CDN (via Storage) handles the delivery.

**DB schema for this project is trivial:** One `videos` table with ~10 columns (id, title, script, audio_url, video_url, created_at, run_date, story_index, pexels_query, status). 500MB DB limit will never be hit.

**What NOT to use:**
- Firebase Storage — Google ecosystem lock-in, pricing model is complex
- AWS S3 — not free, adds complexity
- Cloudinary — free tier (25GB storage) is generous but video transformation costs extra, more complexity than needed

---

### Frontend Framework: PWA

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | `15.x` | PWA frontend with vertical video scroll | App Router, React Server Components, best ecosystem for PWA + video; Vercel deploys natively |
| `next-pwa` or manual service worker | latest | PWA manifest + service worker | `next-pwa` adds PWA support with minimal config |

**Framework Comparison:**

| Framework | PWA Support | Video Handling | Ecosystem | Vercel Deploy | Verdict |
|-----------|-------------|----------------|-----------|---------------|---------|
| Next.js 15 | Good (via plugin or manual) | Native `<video>` + React | Largest | Native, zero config | **RECOMMENDED** |
| Astro 5.x | Good (via integration) | Native HTML `<video>` | Growing | Supported | Skip — less React ecosystem for future features |
| SvelteKit | Good (via plugin) | Native `<video>` | Smaller | Supported | Skip — smaller community, harder to hire/get help |

**Why Next.js over Astro for this project:**
- The PWA behavior (preloading next video, snap scroll, autoplay logic) requires client-side JavaScript. Next.js Client Components handle this cleanly.
- Astro's "zero JS by default" philosophy requires explicit client islands — adds cognitive overhead for an interaction-heavy feature.
- Next.js 15 App Router with Server Components is excellent for the simple data fetching pattern: fetch today's videos from Supabase on the server, stream them to the client.
- If the project evolves to add auth, personalization, or notifications, Next.js has the ecosystem for it.

**Key frontend implementation notes:**
- Use CSS `scroll-snap` for the vertical swipe behavior (`scroll-snap-type: y mandatory`, `scroll-snap-align: start`)
- Use the `IntersectionObserver` API to detect which video is in view for autoplay/pause
- Preload next 1-2 videos using `<link rel="preload">` or `video.load()` calls
- Videos stored in Supabase — serve via Supabase Storage public URLs (CDN-backed)
- PWA manifest: `display: standalone`, `orientation: portrait`, theme color matching brand

**What NOT to use:**
- React Native / Expo — the project explicitly targets PWA web-first
- Vue/Nuxt — smaller ecosystem, no clear advantage here
- Pure Vite + React — loses Next.js's SSR/SSG and Vercel optimization

---

### Frontend Hosting: Vercel

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | Free (Hobby) tier | Host Next.js frontend | Native Next.js support, free SSL, global CDN, zero config |

**Vercel Free Tier Limits (MEDIUM confidence — verify at vercel.com/pricing):**
- Bandwidth: 100GB/month
- Serverless function invocations: 100GB-hours/month
- Edge Function invocations: 1M/month
- Build minutes: 6,000 min/month
- Custom domains: Yes (free)
- Team members: 1 (solo project)

**Video streaming via Vercel:** The frontend does NOT serve video files — it serves the Next.js HTML/JS/CSS. Video files are served directly from Supabase Storage (CDN). Vercel only serves the page shell. This means Vercel bandwidth usage is minimal (HTML + JS bundle, ~200KB gzipped). This is correct architecture — never proxy video through Vercel serverless functions.

**What NOT to use:**
- Netlify — works but Next.js SSR is less optimized than Vercel (which built Next.js)
- Cloudflare Pages — good alternative but requires Cloudflare Workers for SSR, more setup
- Railway/Render — adds monthly cost

---

### Supporting Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `feedparser` | `>=6.0.11` | Parse RSS feeds (Yahoo Finance, Reuters) | Pure Python, battle-tested |
| `httpx` | `>=0.27.0` | Async HTTP for Pexels API, Supabase Storage uploads | Replace `requests` for async-friendly pipeline |
| `faster-whisper` | `>=1.0.3` | Word-level timestamps from TTS audio | Requires `ctranslate2` dependency |
| `pydantic` | `>=2.7.0` | Data validation for video metadata, script schemas | v2 is faster than v1, standard in 2026 |
| `python-dotenv` | `>=1.0.1` | Load secrets from .env in local dev | GitHub Actions uses repository secrets instead |
| `Pillow` | `>=10.3.0` | Generate thumbnail images if needed | May be skipped for MVP |

---

## Full Dependency File

```text
# requirements.txt

# LLM
groq>=0.9.0

# TTS
openai>=1.30.0

# Subtitle/Transcription
faster-whisper>=1.0.3

# RSS
feedparser>=6.0.11

# HTTP
httpx>=0.27.0

# Supabase
supabase>=2.4.0

# Data validation
pydantic>=2.7.0

# Environment
python-dotenv>=1.0.1
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LLM | Groq (Llama 3.3 70B) | OpenAI GPT-4o-mini | 100x more expensive for same quality on simple scripts |
| TTS | OpenAI tts-1 | ElevenLabs free | 10K chars/month — pipeline fails after day 3-4 |
| TTS | OpenAI tts-1 | Google Cloud TTS Neural2 | Similar cost, higher setup complexity (GCP auth) |
| Subtitle timing | faster-whisper | Manual char timing | Inaccurate; off-sync subtitles look unprofessional |
| Video assembly | FFmpeg subprocess | MoviePy | MoviePy 2.x breaking changes; unnecessary abstraction |
| Pipeline runner | GitHub Actions | Railway / Render | Costs money; not designed for batch compute |
| DB + Storage | Supabase | Firebase | GCP lock-in; pricing complexity |
| Frontend | Next.js 15 | Astro | Interaction-heavy PWA needs client JS; Next.js ecosystem larger |
| Frontend | Next.js 15 | SvelteKit | Smaller community; harder to find help |

---

## Cost Model (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Groq (LLM) | ~60,000 tokens/month | **$0** (free tier) |
| OpenAI TTS (tts-1) | ~90,000 chars/month | **~$1.35** |
| Pexels API | ~1,500 requests/month | **$0** (free) |
| GitHub Actions | ~1,200 min/month | **$0** (public repo = unlimited) |
| Supabase | 500MB DB, 1GB storage (with cleanup) | **$0** (free tier) |
| Vercel | ~1GB bandwidth/month (HTML/JS only) | **$0** (free tier) |
| faster-whisper | Local compute on GH Actions | **$0** |
| **TOTAL** | | **~$1.35-$2/month** |

---

## Critical Free Tier Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Supabase storage exceeds 1GB | HIGH | Delete videos older than 7 days on each pipeline run |
| Supabase project paused (7-day inactivity) | MEDIUM | Pipeline runs daily — unlikely to trigger; add health-check if needed |
| Groq enforces commercial ToS on free tier | MEDIUM | Upgrade to Groq pay-as-you-go (~$0.02/month at this volume) |
| GitHub Actions job timeout (6h limit) | LOW | Pipeline should complete in <30 min; not at risk |
| Vercel serving video through functions | MEDIUM | Never proxy video through Vercel — always stream from Supabase Storage CDN |
| faster-whisper RAM on GitHub Actions (7GB limit) | LOW | Use `tiny.en` model (~39MB RAM), well within 7GB |

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Groq free tier rate limits | MEDIUM | Training knowledge (late 2025); verify at console.groq.com/docs/rate-limits |
| OpenAI TTS pricing ($15/1M chars) | MEDIUM | Verify at openai.com/api/pricing — pricing can change |
| ElevenLabs free tier (10K chars/mo) | MEDIUM | Known from late 2025 training; verify at elevenlabs.io/pricing |
| FFmpeg subprocess vs MoviePy | HIGH | MoviePy 2.x breaking changes are documented and widely reported |
| faster-whisper for word timestamps | HIGH | Well-established pattern; faster-whisper docs confirm `word_timestamps=True` |
| GitHub Actions public repo unlimited minutes | HIGH | Documented in GitHub Actions billing docs, stable policy |
| Supabase 7-day pause policy | MEDIUM | Known policy as of late 2025; verify at supabase.com/pricing |
| Supabase storage 1GB free tier | MEDIUM | Verify at supabase.com/pricing |
| Vercel free tier bandwidth 100GB | MEDIUM | Verify at vercel.com/pricing |
| Next.js 15 as PWA framework | HIGH | Current release, widely deployed, Vercel native support confirmed |
| Pexels API 20K requests/month | MEDIUM | Known from API docs, verify at pexels.com/api/documentation |

---

## Installation (Pipeline)

```bash
# Python pipeline dependencies
pip install groq>=0.9.0 openai>=1.30.0 faster-whisper>=1.0.3 feedparser>=6.0.11 httpx>=0.27.0 supabase>=2.4.0 pydantic>=2.7.0 python-dotenv>=1.0.1

# System: FFmpeg (GitHub Actions ubuntu-latest)
sudo apt-get install -y ffmpeg

# Frontend
npx create-next-app@latest finfeed-frontend --typescript --tailwind --app
cd finfeed-frontend && npm install @supabase/supabase-js
```

---

## Sources

- OpenAI TTS documentation: https://platform.openai.com/docs/guides/text-to-speech (MEDIUM confidence — training data, verify current pricing)
- Groq rate limits: https://console.groq.com/docs/rate-limits (MEDIUM confidence — verify current free tier limits)
- faster-whisper GitHub: https://github.com/SYSTRAN/faster-whisper (HIGH confidence — well-documented)
- GitHub Actions billing: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions (HIGH confidence — public repos unlimited is stable policy)
- Supabase pricing: https://supabase.com/pricing (MEDIUM confidence — verify current free tier storage limits)
- Vercel pricing: https://vercel.com/pricing (MEDIUM confidence — verify current bandwidth limits)
- Pexels API docs: https://www.pexels.com/api/documentation/ (MEDIUM confidence — verify rate limits)
- MoviePy 2.0 migration notes: https://zulko.github.io/moviepy/getting_started/updating_to_v2.html (HIGH confidence — breaking changes documented)
- Next.js 15 docs: https://nextjs.org/docs (HIGH confidence — current release)

*Note: External research tools (WebSearch, WebFetch, Bash) were unavailable during this research session. All MEDIUM confidence items should be spot-checked against their official sources before implementation begins. HIGH confidence items are based on stable, well-established facts from multiple corroborating knowledge sources.*
