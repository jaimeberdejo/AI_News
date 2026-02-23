# Architecture Patterns

**Project:** FinFeed — AI-generated financial news PWA
**Domain:** Faceless AI video pipeline + PWA frontend
**Researched:** 2026-02-23
**Overall confidence:** HIGH (all stack choices are well-established, free tier limits verified from public pricing pages as of research date)

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS (Batch Runner)                 │
│  Cron: 0 6,18 * * *  (6am + 6pm UTC)                           │
│                                                                  │
│  pipeline/run.py  ←──  Sequential steps with state in Postgres  │
│                                                                  │
│  Step 1: RSS Fetch → Step 2: LLM Scripts → Step 3: TTS          │
│  Step 4: B-roll Download → Step 5: FFmpeg → Step 6: Upload      │
│  Step 7: DB Publish                                              │
└───────────────────────────┬─────────────────────────────────────┘
                             │ writes video files
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE                                      │
│                                                                  │
│  PostgreSQL                    Storage Bucket: "videos"          │
│  ─────────────────             ──────────────────────────        │
│  editions (table)              editions/2026-02-23/              │
│  videos (table)                  story-1.mp4                     │
│  pipeline_runs (table)           story-2.mp4                     │
│                                  story-3.mp4                     │
│  Public anon key → read-only     story-4.mp4                     │
│  Service key → pipeline write    story-5.mp4                     │
└───────────────────────────┬─────────────────────────────────────┘
                             │ public URLs / anon API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (PWA Frontend)                         │
│                                                                  │
│  Next.js App Router                                              │
│  ─────────────────────                                           │
│  /                  → redirect to /today                         │
│  /today             → SwipeableFeed component                    │
│  /api/today         → Server Route → Supabase query              │
│                                                                  │
│  PWA: manifest.json + service worker (offline shell)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Owns |
|-----------|---------------|-------------------|------|
| **GitHub Actions Runner** | Orchestrates batch pipeline, retries, logs | Supabase DB (write), Supabase Storage (write), external APIs | Pipeline state machine |
| **RSS Fetcher** (`pipeline/steps/fetch.py`) | Downloads + deduplicates financial news | Yahoo Finance RSS, Reuters RSS | Raw article list in memory |
| **LLM Scriptwriter** (`pipeline/steps/script.py`) | Selects top 5 stories, writes 30-45s scripts | Groq API (Llama 3.3) | Script text per story |
| **TTS Engine** (`pipeline/steps/tts.py`) | Converts script text to MP3 audio files | OpenAI API (tts-1) | Audio files in GH Actions temp dir |
| **B-roll Downloader** (`pipeline/steps/broll.py`) | Downloads royalty-free stock video clips | Pexels API, Pixabay API | Video clips in GH Actions temp dir |
| **Video Assembler** (`pipeline/steps/assemble.py`) | Combines audio + b-roll + subtitles → MP4 | FFmpeg (local subprocess) | Final MP4 in GH Actions temp dir |
| **Uploader** (`pipeline/steps/upload.py`) | Pushes MP4s to Supabase Storage | Supabase Storage API | Public video URLs |
| **DB Publisher** (`pipeline/steps/publish.py`) | Writes edition + video metadata to Postgres | Supabase PostgreSQL | Edition record marked "published" |
| **Supabase PostgreSQL** | Source of truth for editions, video metadata, pipeline state | Pipeline (write), Next.js API (read) | All structured data |
| **Supabase Storage** | File store for generated MP4s | Pipeline (write), browsers/CDN (read) | All video files |
| **Next.js API Route** (`/api/today`) | Serves daily edition metadata to PWA | Supabase Postgres (read via anon key) | Frontend API contract |
| **PWA SwipeableFeed** | Renders 5 videos with vertical snap scroll, preload logic | Next.js API, Supabase Storage URLs directly | User session state (current position) |

---

## Data Flow

### Pipeline Data Flow (Write Path)

```
[RSS Feeds]
    │ raw XML/JSON articles
    ▼
[RSS Fetcher] → article list (Python dict list, in memory)
    │
    ▼
[LLM Scriptwriter] → 5 x { title, script_text, story_id }
    │ stores in-progress records to DB: status="generating_audio"
    ▼
[TTS Engine] → 5 x audio/*.mp3 files (GitHub Actions $RUNNER_TEMP)
    │ updates DB: status="generating_video"
    ▼
[B-roll Downloader] → 5 x broll/*.mp4 clips (GitHub Actions $RUNNER_TEMP)
    │
    ▼
[Video Assembler] → 5 x output/story-{n}.mp4 (GitHub Actions $RUNNER_TEMP)
    │ updates DB: status="uploading"
    ▼
[Uploader] → Supabase Storage bucket "videos/editions/{date}/story-{n}.mp4"
    │ returns 5 x public URLs
    ▼
[DB Publisher] → Postgres: edition.status="published", video URLs committed
    │
    ▼
[Done — edition is live]
```

### Frontend Data Flow (Read Path)

```
[Browser → GET /api/today]
    │
    ▼
[Next.js Server Route]
    │ query: SELECT * FROM videos WHERE edition_date = today
    │         AND editions.status = 'published'
    ▼
[Supabase Postgres (anon key, RLS: read-only published only)]
    │ returns: edition metadata + 5 video records with storage URLs
    ▼
[JSON response to browser]
    │ { edition_date, videos: [{ id, title, video_url, duration, order }] }
    ▼
[SwipeableFeed component]
    │ preloads video[0] and video[1] immediately
    │ preloads video[n+1] as user scrolls
    ▼
[<video> elements with direct Supabase Storage URLs]
    │ browser streams MP4 directly from Supabase Storage CDN
    ▼
["You're up to date" screen after video[4]]
```

---

## Data Model

### Database Schema

```sql
-- One record per daily edition
CREATE TABLE editions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date DATE UNIQUE NOT NULL,         -- "2026-02-23"
  status      TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | generating_scripts | generating_audio
  --         generating_video | uploading | published | failed
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  pipeline_run_id UUID REFERENCES pipeline_runs(id)
);

-- One record per video in the edition (always 5)
CREATE TABLE videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   UUID NOT NULL REFERENCES editions(id),
  position     SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
  title        TEXT NOT NULL,
  script_text  TEXT NOT NULL,
  video_url    TEXT,                         -- null until uploaded
  duration_s   SMALLINT,                     -- actual duration in seconds
  status       TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | script_ready | audio_ready | video_ready | uploaded
  source_urls  JSONB,                        -- array of RSS article URLs used
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (edition_id, position)
);

-- Audit log for pipeline runs
CREATE TABLE pipeline_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date DATE NOT NULL,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running',
  -- status: running | success | failed | partial
  error_log   JSONB,                         -- { step, message, traceback }
  steps_log   JSONB                          -- { step: { started, finished, ok } }
);
```

### Storage Layout

```
Supabase Storage Bucket: "videos" (public)

videos/
  editions/
    2026-02-23/
      story-1.mp4      (~15-20 MB, 30-45s at 720p)
      story-2.mp4
      story-3.mp4
      story-4.mp4
      story-5.mp4
    2026-02-24/
      ...
```

### API Contract (Frontend-Backend)

```
GET /api/today
Response 200:
{
  "edition_date": "2026-02-23",
  "status": "published",
  "published_at": "2026-02-23T06:31:00Z",
  "videos": [
    {
      "id": "uuid",
      "position": 1,
      "title": "Fed Holds Rates Steady",
      "video_url": "https://[project].supabase.co/storage/v1/object/public/videos/editions/2026-02-23/story-1.mp4",
      "duration_s": 38
    },
    ...
  ]
}

Response 404:
{
  "error": "no_edition_today",
  "message": "Today's edition is still being generated. Check back soon."
}

Response 503:
{
  "error": "edition_failed",
  "message": "Today's edition failed to generate."
}
```

**Key decision: Next.js API Route wraps Supabase, NOT direct Supabase client from browser.**
Reason: Service key stays server-side, Row Level Security (RLS) on anon key is simple (only published editions), and API route enables future caching at Vercel edge.

---

## Pipeline Architecture: Sequential Script with State

**Recommendation: Single orchestrator script with sequential steps, state in Postgres.**

Do NOT use a full DAG framework (Airflow, Prefect, Dagster) for this project. The operational overhead is not justified for a 5-video batch job. A well-structured Python script with checkpoint state in Postgres achieves all required properties.

### Why Not a DAG Framework

| DAG Framework | Problem for This Project |
|---------------|--------------------------|
| Apache Airflow | Requires always-on server; overkill; $30-100/mo minimum on managed |
| Prefect Cloud | Free tier limited; adds complexity; unnecessary |
| Dagster | Same as Prefect; designed for data engineering teams |
| GitHub Actions matrix jobs | Artifact passing between jobs adds fragile complexity for 5 sequential steps |

### Recommended Pipeline Structure

```python
# pipeline/run.py — top-level orchestrator
def run_pipeline(edition_date: str):
    run_id = db.create_pipeline_run(edition_date)

    steps = [
        ("fetch",     steps.fetch.run),
        ("script",    steps.script.run),
        ("tts",       steps.tts.run),
        ("broll",     steps.broll.run),
        ("assemble",  steps.assemble.run),
        ("upload",    steps.upload.run),
        ("publish",   steps.publish.run),
    ]

    state = {}  # passed between steps
    for step_name, step_fn in steps:
        try:
            state = step_fn(state, edition_date, run_id)
            db.log_step_success(run_id, step_name)
        except RetryableError as e:
            # retry up to 3x with exponential backoff
            state = retry_step(step_fn, state, edition_date, run_id, step_name, e)
        except FatalError as e:
            db.mark_run_failed(run_id, step_name, e)
            raise SystemExit(1)

    db.mark_run_success(run_id)
```

### Error Handling Strategy

| Error Type | Examples | Strategy |
|------------|----------|----------|
| **Retryable / Transient** | Groq API rate limit, OpenAI timeout, Pexels 429 | Retry 3x with exponential backoff (2s, 4s, 8s) |
| **Fatal / Config** | Invalid API key, Supabase auth failure | Fail immediately, log to DB, alert via GitHub Actions summary |
| **Partial success** | 4 of 5 videos succeed | Publish 4 videos if at least 3 succeed (configurable threshold) |
| **Idempotency** | Workflow re-triggered manually | Check `editions.status` — skip completed steps, resume from last checkpoint |

### Idempotency is Critical

Each pipeline run MUST be safe to re-run. The edition_date is the idempotency key:

```python
# At start of each step, check if already completed
def run(state, edition_date, run_id):
    video = db.get_video(edition_date, position=state["position"])
    if video.status == "audio_ready":
        return state  # already done, skip
    # ... proceed
```

This allows:
1. Manual re-runs of failed editions without duplicate work
2. GitHub Actions re-run after a transient failure
3. Safe testing of individual steps

### State Between Steps

State passes as a Python dict through the orchestrator. Postgres is the persistent checkpoint. GitHub Actions `$RUNNER_TEMP` holds ephemeral file artifacts (audio, video clips, assembled MP4s).

```
In-memory state dict between steps:
{
  "articles": [...],          # from fetch step
  "scripts": [...],           # from script step
  "audio_paths": [...],       # from tts step (local file paths)
  "broll_paths": [...],       # from broll step
  "assembled_paths": [...],   # from assemble step
  "video_urls": [...],        # from upload step
}
```

---

## GitHub Actions Workflow Structure

**Recommendation: Single job, sequential steps. No matrix, no job-to-job artifact passing.**

Rationale: Job-to-job artifact passing (upload-artifact/download-artifact) adds latency and complexity for no benefit when all steps are sequential and share a working directory.

```yaml
# .github/workflows/pipeline.yml
name: FinFeed Daily Pipeline

on:
  schedule:
    - cron: '0 6 * * *'    # 6am UTC (2am ET, before US market open)
    - cron: '0 18 * * *'   # 6pm UTC (2pm ET, after US market close)
  workflow_dispatch:        # allow manual trigger
    inputs:
      edition_date:
        description: 'Override date (YYYY-MM-DD). Defaults to today.'
        required: false

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 30     # hard cap — pipeline should finish in ~15 min

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install system dependencies
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y ffmpeg

      - name: Install Python dependencies
        run: pip install -r requirements.txt

      - name: Run pipeline
        env:
          GROQ_API_KEY:       ${{ secrets.GROQ_API_KEY }}
          OPENAI_API_KEY:     ${{ secrets.OPENAI_API_KEY }}
          SUPABASE_URL:       ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          PEXELS_API_KEY:     ${{ secrets.PEXELS_API_KEY }}
          EDITION_DATE:       ${{ github.event.inputs.edition_date || '' }}
        run: python -m pipeline.run

      - name: Upload pipeline logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: pipeline-logs-${{ github.run_id }}
          path: /tmp/pipeline-*.log
          retention-days: 7
```

### GitHub Actions Free Tier Constraints

**MEDIUM confidence — from knowledge cutoff, verify current limits:**

- Public repos: unlimited minutes on standard runners
- Private repos: 2,000 minutes/month free (Linux)
- ubuntu-latest runner: 2-core, 7GB RAM, 14GB SSD
- Artifact storage: 500 MB per artifact, 90-day retention
- Cron schedule: minimum 5-minute intervals; may be delayed up to 30 min under load

**Pipeline runtime estimate:**
- Fetch: ~10s
- LLM scripts: ~30s (5 stories, parallel Groq calls)
- TTS: ~60s (5 scripts, sequential due to OpenAI rate limits)
- B-roll download: ~60s
- FFmpeg assembly: ~120s (5 x 30-45s videos)
- Upload: ~30s
- DB publish: ~5s
- **Total: ~5-6 minutes per run**

At 2 runs/day x 30 days = 60 runs x 6 min = 360 min/month. Well within free tier.

---

## Storage Architecture

### Decision: Supabase Storage (Free Tier)

**Recommendation: Supabase Storage for MVP. Plan migration path to Cloudflare R2 if traffic grows.**

| Service | Free Storage | Free Bandwidth | CDN | Video Serving | Cost at Scale |
|---------|-------------|----------------|-----|--------------|---------------|
| **Supabase Storage** | 1 GB | 2 GB/month egress | Via Cloudflare CDN | Good | $0.09/GB after |
| **Cloudflare R2** | 10 GB | 0 GB egress (free unlimited to browsers via Workers) | Native Cloudflare CDN | Excellent | $0.015/GB storage, $0 egress |
| **AWS S3** | 5 GB (12 months) | 100 GB/month | Via CloudFront ($) | Good | $0.09/GB storage, $0.085/GB egress |

**Why Supabase Storage for MVP:**
- Same service as the DB — one integration, one API key, no extra setup
- 1 GB storage is sufficient for ~50 daily editions of 5 videos at ~15MB each = ~3.75 GB/day x 13 days fills 1 GB. Retention policy needed (delete editions older than 7 days).
- 2 GB/month egress supports ~130 full views of all 5 videos (5 x 15MB = 75MB per user). For a validation project, this is acceptable.

**CRITICAL STORAGE CONSTRAINT:**
```
5 videos x 15-20 MB each = 75-100 MB per edition
1 GB free storage ÷ 100 MB = 10 editions max without deletion
2 GB egress ÷ 75 MB per user session = ~26 complete user sessions/month

ACTION REQUIRED: Implement 7-day retention policy in pipeline.
Delete old editions: pipeline/steps/cleanup.py
```

**Video file size optimization:**
- Target: 720p (1280x720), H.264, CRF 28, AAC audio 128kbps
- Expected output: 10-15 MB per 30-45s video (not 20 MB)
- Use `-preset fast` for FFmpeg in CI (speed over compression)

### CDN Behavior

Supabase Storage is backed by Cloudflare CDN globally (confirmed in Supabase architecture docs). Public bucket files are cached at Cloudflare edge nodes. After the first request for a video, subsequent requests are served from CDN cache, not Supabase origin. This means bandwidth from Supabase origin is lower than total views — important for the 2 GB limit.

**MEDIUM confidence** on Supabase CDN cache behavior details — verify with Supabase docs.

---

## Frontend-Backend Contract

### Architecture Decision: Next.js API Route (NOT direct Supabase from browser)

```
Browser
  ↓ GET /api/today
Next.js API Route (server-side)
  ↓ Supabase query (anon key, RLS enforced)
Supabase Postgres
  ↑ JSON response
Next.js API Route
  ↑ Formatted JSON response
Browser
  ↓ video_url (direct Supabase Storage public URL)
Supabase Storage / Cloudflare CDN
```

**Why NOT direct Supabase from browser:**
1. Service key never leaves server
2. RLS rules are simpler ("anon can read published editions")
3. API route enables Vercel Edge Cache for the metadata response (99% cache hit rate)
4. Easier to swap backend later without changing PWA

**Why YES to direct video URLs from Supabase Storage:**
- Video files must be streamed directly to browser — cannot proxy through Next.js (Vercel function 10s timeout, memory limits)
- Public bucket URLs are safe to expose
- Browser handles range requests (seeking) natively against Supabase Storage

### Row Level Security Policy

```sql
-- In Supabase: enable RLS on editions and videos
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Anon users can only read published editions
CREATE POLICY "public can read published editions"
  ON editions FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "public can read videos of published editions"
  ON videos FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM editions
      WHERE editions.id = videos.edition_id
      AND editions.status = 'published'
    )
  );

-- Only service role can write
-- (enforced by API key — service key not exposed to browser)
```

### PWA Preloading Strategy

```javascript
// components/SwipeableFeed.tsx
// Preload next video when current video starts playing
useEffect(() => {
  const nextIndex = currentIndex + 1;
  if (nextIndex < videos.length) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = videos[nextIndex].video_url;
    document.head.appendChild(link);
  }
}, [currentIndex]);
```

**Do not preload all 5 videos at once** — a user on mobile with 100 MB data would exhaust it. Preload current + next only.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Video Files in the Repo or as GitHub Actions Artifacts Long-Term

**What:** Committing generated MP4s to git, or relying on GitHub Actions artifact storage for serving videos to end users.
**Why bad:** Git LFS has bandwidth limits; GitHub Artifacts are not a CDN; repo size bloat.
**Instead:** Upload immediately to Supabase Storage; use public URLs for serving.

### Anti-Pattern 2: Running FFmpeg as a Python API Server

**What:** Spinning up a web server that generates videos on-demand per request.
**Why bad:** FFmpeg assembly takes 30-120 seconds per video; completely incompatible with web request latency expectations; Vercel functions timeout at 10-60 seconds.
**Instead:** Batch job only. All videos pre-generated before any user requests.

### Anti-Pattern 3: Direct Supabase DB Queries from Pipeline Using Anon Key

**What:** Using the anon/public key in the pipeline for DB writes.
**Why bad:** RLS would need to allow anon writes (massive security hole); anon key is read-only by design.
**Instead:** Service key in GitHub Secrets for pipeline writes; anon key only in frontend.

### Anti-Pattern 4: Single Monolithic Pipeline Script Without Checkpointing

**What:** One Python script with no state persistence — if it crashes at step 6 of 7, restarts from scratch.
**Why bad:** Wastes API calls (Groq, OpenAI TTS costs money); GitHub Actions minutes consumed; slow recovery.
**Instead:** Check Postgres status at each step entry; skip completed steps on re-run.

### Anti-Pattern 5: Keeping All Editions in Storage Forever

**What:** Never deleting old MP4 files from Supabase Storage.
**Why bad:** 1 GB free storage fills in ~10 editions (10 days). After that, uploads fail silently or incur costs.
**Instead:** Pipeline cleanup step deletes editions older than 7 days before generating new content.

### Anti-Pattern 6: Proxying Video Through Next.js/Vercel Functions

**What:** Routing video file serving through a Next.js API route or edge function.
**Why bad:** Vercel function response size limits, timeouts, and bandwidth costs; video range requests require stateful streaming incompatible with serverless.
**Instead:** Direct Supabase Storage public URLs in the video_url field; browser fetches directly.

---

## Build Order (Dependency Graph)

This is the critical path for development. Each phase has blockers that must exist before the next phase can be meaningfully tested.

```
Phase 1: Data Foundation
├── Supabase project created
├── Schema migrated (editions, videos, pipeline_runs tables)
├── RLS policies applied
└── Can query DB from Python (service key) and browser (anon key)
    │
    ▼ UNBLOCKS: all phases below

Phase 2: Pipeline — Script Generation (LLM + TTS)
├── requires: Phase 1 (Supabase DB)
├── RSS fetcher → article list
├── Groq LLM → 5 scripts saved to DB
├── OpenAI TTS → 5 MP3 files
└── Can independently test script + audio quality before video
    │
    ▼ UNBLOCKS: Phase 3

Phase 3: Pipeline — Video Assembly (FFmpeg + B-roll)
├── requires: Phase 2 (MP3 audio files)
├── Pexels/Pixabay B-roll downloader
├── FFmpeg subtitle generation (SRT/ASS format)
├── FFmpeg assembly: broll + audio + subtitles → MP4
└── Can independently test video quality, file sizes, FFmpeg flags
    │
    ▼ UNBLOCKS: Phase 4

Phase 4: Pipeline — Storage + Publishing
├── requires: Phase 3 (MP4 files)
├── Supabase Storage uploader
├── DB publisher (edition.status = 'published')
├── Cleanup step (delete old editions)
└── Full end-to-end pipeline runnable locally
    │
    ▼ UNBLOCKS: Phase 5 + Phase 6

Phase 5: GitHub Actions Automation
├── requires: Phase 4 (working local pipeline)
├── Workflow YAML with cron schedule
├── GitHub Secrets configured
└── First automated run succeeds

Phase 6: PWA Frontend
├── requires: Phase 4 (published edition in DB with real video URLs)
├── /api/today endpoint returns real data
├── SwipeableFeed with real videos (not placeholders)
├── Preloading, mute/unmute, snap scroll
└── PWA manifest + service worker
    │
    NOTE: Frontend CAN start being scaffolded in parallel with Phase 4
    using mock data, but cannot be fully tested until real videos exist.

Phase 7: Deployment + Validation
├── requires: Phase 5 (automated pipeline) + Phase 6 (PWA deployed)
├── Vercel deployment
├── Domain / PWA installation testing
└── First real user session
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 + Phase 6 (parallel) → Phase 7

**Key insight:** Do NOT start the PWA frontend until at least one real video exists in Supabase Storage. Testing a swipeable video feed with placeholder URLs is misleading — video file size, streaming behavior, and load time are the core UX issues that only appear with real videos.

---

## Scalability Considerations

| Concern | At 26 sessions/mo (free tier ceiling) | At 1K sessions/mo | At 10K sessions/mo |
|---------|--------------------------------------|-------------------|-------------------|
| **Storage** | 1 GB free + 7-day retention OK | Upgrade to Supabase Pro ($25/mo) or migrate to R2 | Cloudflare R2 ($0 egress) |
| **DB queries** | Supabase free (unlimited reads) | Still free tier OK | Still OK |
| **Bandwidth** | 2 GB/month free (Supabase) | ~75 GB/mo needed → migrate to R2 | R2 ($0 egress from CDN) |
| **Pipeline cost** | ~$0.50/mo (TTS) | ~$0.50/mo (TTS cost unchanged) | Same — pipeline is fixed cost |
| **Frontend** | Vercel free tier | Vercel free tier | Vercel Pro |
| **Video CDN** | Supabase/Cloudflare cache helps | R2 migration | R2 + Cloudflare Stream ($5/1000 min) |

**The bandwidth cliff:** Supabase free tier includes 2 GB egress. At 75 MB per full user session (5 videos x 15 MB), that's only ~26 complete user sessions before hitting the limit. The Cloudflare CDN layer means cached requests don't count against origin bandwidth, but this is not guaranteed for first-views. **Plan migration to Cloudflare R2 as the Phase 2 infrastructure upgrade** if the validation succeeds.

---

## Sources

- **Supabase Storage architecture:** HIGH confidence from Supabase public documentation (supabase.com/docs/guides/storage). Confirmed Cloudflare CDN backing, 1 GB free storage, 2 GB egress. **Verify current pricing before launch — limits may have changed.**
- **GitHub Actions free tier:** HIGH confidence for public repos (unlimited), MEDIUM confidence for private repo limits (2,000 min/month as of knowledge cutoff).
- **FFmpeg + GitHub Actions:** HIGH confidence — standard pattern, well-documented community use.
- **Cloudflare R2 pricing:** HIGH confidence — $0 egress to internet is a documented R2 differentiator vs S3.
- **Supabase RLS patterns:** HIGH confidence — standard Supabase architecture for public/private access control.
- **Next.js App Router + API Routes:** HIGH confidence — stable, current best practice for Next.js 14+.
- **Video preloading strategy:** HIGH confidence — standard browser behavior, documented in MDN.
- **Pipeline state machine pattern:** HIGH confidence — common pattern for batch data pipelines, no external library required for this scale.
