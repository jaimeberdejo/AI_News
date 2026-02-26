# FinFeed

A mobile-first Progressive Web App that delivers a finite set of AI-generated financial news videos twice a day. Users swipe vertically through a curated feed — when the last video ends, a "You're up to date" card appears. No infinite scroll, no algorithmic rabbit holes. Just today's briefing.

**Live:** https://autonews-ai.vercel.app

---

## How It Works

A GitHub Actions cron job runs at **6am and 6pm UTC** every day. It:

1. Fetches articles from Yahoo Finance and CNBC RSS feeds
2. Uses **Groq (Llama 3.3 70B)** to select 3–5 most important stories and write a 150–170 word script for each
3. Generates narration audio via **OpenAI TTS**, then aligns word-level timestamps with **faster-whisper** to burn animated subtitles
4. Downloads portrait b-roll from **Pexels**, assembles a 720×1280 MP4 with **FFmpeg**
5. Uploads each video to **Supabase Storage** and publishes the edition to the database

The **Next.js frontend** on Vercel reads from Supabase and serves the feed. Each edition is independent — the morning and evening runs each produce their own edition. Users can swipe between editions via a navigation bar.

---

## Stack

| Layer | Technology |
|---|---|
| Pipeline | Python 3.11 |
| LLM | Groq (Llama 3.3 70B) — story selection + script writing |
| TTS | OpenAI `tts-1` |
| Subtitles | faster-whisper `tiny.en` + FFmpeg ASS burn-in |
| B-roll | Pexels API |
| Video assembly | FFmpeg |
| Database | Supabase (PostgreSQL + Storage) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Automation | GitHub Actions |
| Deployment | Vercel |

**Cost target:** $1–5/month (all free tiers).

---

## Project Structure

```
AutoNews_AI/
├── pipeline/               # Python batch pipeline
│   ├── run.py              # entry point — python -m pipeline.run
│   ├── ingest.py           # RSS ingestion + deduplication
│   ├── script.py           # LLM story selection + script writing
│   ├── audio.py            # TTS narration + faster-whisper subtitles
│   ├── video.py            # Pexels b-roll + FFmpeg assembly
│   ├── storage.py          # Supabase upload, publish, 7-day cleanup
│   ├── db.py               # Supabase singleton client
│   └── models.py           # Article, Story, VideoResult dataclasses
│
├── frontend/               # Next.js PWA
│   ├── app/
│   │   ├── page.tsx        # server component, fetches /api/today
│   │   ├── layout.tsx      # root layout, PWA metadata
│   │   ├── globals.css     # scroll-snap feed layout
│   │   ├── manifest.ts     # PWA web manifest
│   │   └── api/
│   │       ├── today/      # GET latest edition + all editions metadata
│   │       └── editions/   # GET edition by UUID
│   ├── components/
│   │   ├── VideoFeed.tsx   # scroll tracking, play/pause, edition nav, mute
│   │   ├── VideoItem.tsx   # single video + headline + source link
│   │   ├── MuteButton.tsx  # floating mute/unmute toggle
│   │   └── EndCard.tsx     # "You're up to date" / archive end screen
│   ├── hooks/
│   │   └── useEdition.ts   # TypeScript types (Video, Edition, EditionMeta)
│   └── lib/
│       └── supabase.ts     # anon-key client for route handlers
│
├── supabase/
│   └── migrations/         # 3 applied migrations (schema, multi-edition, RLS)
│
├── scripts/
│   ├── setup_bucket.py     # one-time: create Supabase videos storage bucket
│   └── verify_infra.py     # validate infra requirements
│
├── .github/
│   └── workflows/
│       └── pipeline.yml    # cron automation (6am + 6pm UTC)
│
├── .env.example            # all required env vars documented
└── requirements.txt        # Python dependencies
```

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- FFmpeg — `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux)
- A [Supabase](https://supabase.com) project
- API keys for [Groq](https://console.groq.com), [OpenAI](https://platform.openai.com), and [Pexels](https://www.pexels.com/api/new/)

---

## Setup

### 1. Clone and configure environment

```bash
git clone https://github.com/jaimeberdejo/AutoNews_AI.git
cd AutoNews_AI
cp .env.example .env
```

Fill in `.env`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon/public key — safe to expose
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJ...                  # service_role key — keep secret

# Used by Next.js server component to self-fetch (must be the public URL, not localhost)
NEXT_PUBLIC_APP_URL=http://localhost:3000    # change to Vercel URL in production

# Pipeline APIs
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...
PEXELS_API_KEY=...
```

### 2. Set up Supabase

Apply the database migrations:

```bash
supabase db push --linked
```

Create the storage bucket (one-time):

```bash
pip install -r requirements.txt
python scripts/setup_bucket.py
```

### 3. Run the pipeline

```bash
python -m pipeline.run
```

This will ingest RSS feeds, generate videos, and publish an edition to Supabase. Expect 3–8 minutes depending on the number of stories.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. If the pipeline ran successfully, you should see today's videos.

---

## Deployment

### GitHub Actions (pipeline automation)

1. Fork or push the repo to GitHub
2. Go to **Settings → Secrets and variables → Actions** and add these repository secrets:

   | Secret | Where to get it |
   |---|---|
   | `SUPABASE_URL` | Supabase Dashboard → Settings → API |
   | `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role |
   | `GROQ_API_KEY` | console.groq.com → API Keys |
   | `OPENAI_API_KEY` | platform.openai.com → API Keys |
   | `PEXELS_API_KEY` | pexels.com/api/new/ |

3. The workflow at `.github/workflows/pipeline.yml` will run automatically at **6am and 6pm UTC** every day. You can also trigger it manually from the **Actions** tab.

### Vercel (frontend)

1. Go to [vercel.com/new](https://vercel.com/new) → Import `AutoNews_AI`
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to **Next.js**
4. Add these environment variables under **Project Settings → Environment Variables**:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://yourproject.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL (e.g. `https://yourapp.vercel.app`) |

5. Redeploy. Future pushes to `master` auto-deploy.

---

## Database Schema

### `editions`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `edition_date` | date | Non-unique — morning + evening runs create separate editions |
| `status` | text | `pending` → `publishing` → `published` / `partial` / `failed` |
| `published_at` | timestamptz | Set when status transitions to published/partial |

### `videos`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `edition_id` | UUID FK | |
| `position` | int | 1–5, unique per edition |
| `headline` | text | Story headline |
| `script_text` | text | Full narration script |
| `source_url` | text | Original article link |
| `video_url` | text | Supabase Storage CDN URL |
| `duration` | numeric | Video length in seconds |
| `status` | text | `generating` → `uploading` → `ready` / `failed` |

### `pipeline_runs`
Audit log for every pipeline execution. Stores per-stage counts in `steps_log` (JSONB) and per-story failures in `error_log` (JSONB).

**Row Level Security:** The anon key can read `published` and `partial` editions and their videos. It has no access to `pipeline_runs`. The service key (pipeline only) bypasses RLS entirely.

---

## Architecture Notes

**iOS-safe mute:** iOS Safari requires `.muted` to be set synchronously inside the user-gesture call stack. The app uses a module-level `globalMuted` variable (not React state) so mute toggles are written directly to video element properties without any async React re-render in between.

**Scroll-event index tracking:** Uses `Math.round(scrollTop / clientHeight)` on the `scroll` event rather than IntersectionObserver. More reliable for scroll-snap layouts where each item is exactly one viewport tall.

**Per-story error isolation:** Each story runs in its own `try/except` block with its own temp directory. A single failure (b-roll download, TTS timeout, FFmpeg error) does not abort the remaining stories. The edition publishes as `partial` with whatever stories succeeded.

**`#t=0.001` URL fragment:** Each `<video src>` is appended with `#t=0.001` to force iOS Safari to render the first frame as a poster image instead of showing a black placeholder.

**Two-key Supabase pattern:** Frontend uses the anon key (safe to expose, embedded in JavaScript). Pipeline uses the service key (bypasses RLS, only ever in GitHub Actions secrets or `.env`).

---

## Environment Variables Reference

| Variable | Used by | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend + Pipeline | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Yes |
| `NEXT_PUBLIC_APP_URL` | Frontend (server component self-fetch) | Yes in production |
| `SUPABASE_URL` | Pipeline | Yes |
| `SUPABASE_SERVICE_KEY` | Pipeline | Yes |
| `GROQ_API_KEY` | Pipeline | Yes |
| `OPENAI_API_KEY` | Pipeline | Yes |
| `PEXELS_API_KEY` | Pipeline | Yes |
