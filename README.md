# AI News

A mobile-first Progressive Web App that delivers a finite set of AI-generated news videos twice a day across two categories: **Finance** and **Tech**. Users swipe vertically through a curated feed — when the last video ends, a "You're up to date" card appears. No infinite scroll, no algorithmic rabbit holes. Just today's briefing.

**Live:** https://autonews-ai.vercel.app

---

## How It Works

A GitHub Actions cron job runs at **6am and 6pm UTC** every day for each category. It:

1. Fetches articles from RSS feeds (Finance: Yahoo Finance + CNBC; Tech: TechCrunch + Hacker News + Ars Technica)
2. Uses **Groq (Llama 3.3 70B)** to select 3–5 most important stories and write a 150–170 word script for each in category-appropriate tone
3. Generates narration audio via **OpenAI TTS**, then aligns word-level timestamps with **faster-whisper** to burn animated subtitles
4. Downloads portrait b-roll from **Pexels**, assembles a 720×1280 MP4 with **FFmpeg**, and extracts a JPEG thumbnail at 0.5s
5. Uploads each video and thumbnail to **Supabase Storage** and publishes the edition to the database

The **Next.js frontend** on Vercel reads from Supabase and serves the feed. Authenticated users can like, bookmark, and comment on videos. A bottom tab bar navigates between the feed and user profile.

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
| Auth | Supabase Auth (email magic link + password) |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Automation | GitHub Actions |
| Deployment | Vercel |

**Cost target:** $1–5/month (all free tiers).

---

## Project Structure

```
AI News/
├── pipeline/               # Python batch pipeline
│   ├── run.py              # entry point — python -m pipeline.run [finance|tech]
│   ├── ingest.py           # RSS ingestion + deduplication (category-aware feeds)
│   ├── script.py           # LLM story selection + script writing (category tone)
│   ├── audio.py            # TTS narration + faster-whisper subtitles
│   ├── video.py            # Pexels b-roll + FFmpeg assembly + thumbnail extraction
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
│   │   ├── auth/           # magic link + email/password auth flow (Supabase Auth)
│   │   ├── profile/        # user profile page (display name, saved/liked videos)
│   │   └── api/
│   │       ├── today/      # GET latest edition + all editions metadata
│   │       ├── editions/   # GET edition by UUID
│   │       ├── comments/   # GET/POST video comments
│   │       ├── profile/    # GET/PATCH user profile; GET liked/saved videos
│   │       └── social/     # POST like/bookmark toggle; GET social state
│   ├── components/
│   │   ├── VideoFeed.tsx   # scroll tracking, play/pause, edition nav, mute
│   │   ├── VideoItem.tsx   # single video + headline + source link + social actions
│   │   ├── VideoGrid.tsx   # grid view of saved/liked videos with thumbnails
│   │   ├── TabBar.tsx      # bottom nav (Home / Profile)
│   │   ├── ProfilePage.tsx # profile header, sign out, saved/liked tabs
│   │   ├── AuthBottomSheet.tsx  # slide-up auth prompt for unauthenticated actions
│   │   ├── CommentSheet.tsx     # slide-up comment thread per video
│   │   ├── EditNameSheet.tsx    # inline display name editor
│   │   ├── MuteButton.tsx  # floating mute/unmute toggle
│   │   └── EndCard.tsx     # "You're up to date" / archive end screen
│   ├── hooks/
│   │   ├── useEdition.ts   # TypeScript types (Video, Edition, EditionMeta)
│   │   ├── useAuth.ts      # auth state + current user
│   │   └── useVideoPlayer.ts  # play/pause/mute coordination
│   └── lib/
│       ├── supabase.ts     # anon-key client (legacy)
│       └── supabase/
│           ├── client.ts   # browser Supabase client
│           ├── server.ts   # server-side Supabase client (cookie-based session)
│           └── middleware.ts  # session refresh middleware
│
├── supabase/
│   └── migrations/         # 6 applied migrations (schema → auth → social → categories → thumbnails)
│
├── scripts/
│   ├── setup_bucket.py     # one-time: create Supabase videos storage bucket
│   └── verify_infra.py     # validate infra requirements
│
├── .github/
│   └── workflows/
│       └── pipeline.yml    # cron automation (6am + 6pm UTC, finance + tech)
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
git clone https://github.com/jaimeberdejo/AI_News.git
cd ainews
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
# Default (finance)
python -m pipeline.run

# Or specify a category
python -m pipeline.run finance
python -m pipeline.run tech
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

3. The workflow at `.github/workflows/pipeline.yml` will run automatically at **6am and 6pm UTC** every day for both the `finance` and `tech` categories. You can also trigger it manually from the **Actions** tab.

### Vercel (frontend)

1. Go to [vercel.com/new](https://vercel.com/new) → Import `ainews`
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
| `edition_date` | date | Non-unique — multiple editions per day (morning/evening, finance/tech) |
| `category` | text | `finance` or `tech` |
| `status` | text | `pending` → `publishing` → `published` / `partial` / `failed` / `deleted` |
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
| `thumbnail_url` | text | JPEG thumbnail extracted at 0.5s (used by VideoGrid on iOS) |
| `duration` | numeric | Video length in seconds |
| `status` | text | `generating` → `uploading` → `ready` / `failed` |

### `profiles`
One row per authenticated user. Stores `display_name` and `avatar_url`.

### `video_likes` / `video_bookmarks`
Join tables linking `user_id` → `video_id`. Toggle endpoints at `/api/social/like` and `/api/social/bookmark`.

### `video_comments`
Stores per-video comments with `user_id`, `body`, and `created_at`. Publicly readable; write requires auth.

### `pipeline_runs`
Audit log for every pipeline execution. Stores per-stage counts in `steps_log` (JSONB) and per-story failures in `error_log` (JSONB).

**Row Level Security:** The anon key can read `published` and `partial` editions and their videos, and all comments and profiles. It has no access to `pipeline_runs`. The service key (pipeline only) bypasses RLS entirely.

---

## Architecture Notes

**iOS-safe mute:** iOS Safari requires `.muted` to be set synchronously inside the user-gesture call stack. The app uses a module-level `globalMuted` variable (not React state) so mute toggles are written directly to video element properties without any async React re-render in between.

**Scroll-event index tracking:** Uses `Math.round(scrollTop / clientHeight)` on the `scroll` event rather than IntersectionObserver. More reliable for scroll-snap layouts where each item is exactly one viewport tall.

**Per-story error isolation:** Each story runs in its own `try/except` block with its own temp directory. A single failure (b-roll download, TTS timeout, FFmpeg error) does not abort the remaining stories. The edition publishes as `partial` with whatever stories succeeded.

**`#t=0.001` URL fragment:** Each `<video src>` is appended with `#t=0.001` to force iOS Safari to render the first frame as a poster image instead of showing a black placeholder.

**Two-key Supabase pattern:** Frontend uses the anon key (safe to expose, embedded in JavaScript). Pipeline uses the service key (bypasses RLS, only ever in GitHub Actions secrets or `.env`).

**Auth gate for social actions:** Likes, bookmarks, and comments require authentication. Unauthenticated users who tap these actions see a slide-up `AuthBottomSheet` prompting sign-in via magic link or email/password.

**Static thumbnails for VideoGrid:** FFmpeg extracts a JPEG at 0.5s during pipeline assembly. The profile page's saved/liked tab uses `<img>` with these thumbnail URLs instead of `<video>` elements, which avoids iOS PWA memory pressure when rendering a grid.

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
