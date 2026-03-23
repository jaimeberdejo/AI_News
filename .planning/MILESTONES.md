# Milestones

## v1.0 MVP (Shipped: 2026-02-26)

**Phases completed:** 4 phases, 14 plans
**Timeline:** 2026-02-23 → 2026-02-26 (3 days)
**Files:** 96 files changed, ~21,600 insertions
**LOC:** ~1,970 Python/TypeScript
**Production:** https://autonews-ai.vercel.app

**Key accomplishments:**
- Supabase infrastructure live — Postgres schema (editions/videos/pipeline_runs), public storage bucket with 7-day retention, Python pipeline client, Next.js /api/today + /api/editions/[id] endpoints
- Full AI video pipeline end-to-end — RSS ingestion (Yahoo Finance/CNBC) → Groq Llama 3.3 script selection → OpenAI TTS audio → faster-whisper word-level alignment → Pexels b-roll download → FFmpeg video assembly with burned-in ASS subtitles → Supabase Storage upload, per-story error isolation, 7-day cleanup
- iOS-first PWA vertical video feed — muted autoplay, iOS Safari-compliant tap-to-unmute (synchronous event handler), next-2-video preloading, progress dots, edition navigation bar, "You're up to date" end card with countdown
- GitHub Actions cron automation live (6am + 5pm EST), Vercel deployment at autonews-ai.vercel.app, real iOS device validation passed on all critical paths (basic load, tap-to-unmute, scroll + end card)

**Archive:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---

## v1.1 Multi-Category (Shipped: 2026-03-10)

**Phases completed:** 2 phases, 3 plans
**Timeline:** 2026-03-10 (~53 min total execution)
**Files:** 13 files changed, +883 / -89 lines
**Git range:** `b84bba7` → `6103040`

**Key accomplishments:**
- `FEEDS_BY_CATEGORY` dict pattern + SQL migration adding `category` column to editions — extensible routing to future categories (sports, science, etc.) with zero regression on finance pipeline
- Two distinct Groq system prompts: finance influencer tone (preserved from v1.0) vs tech journalist tone — tech RSS feeds (TechCrunch, Hacker News, Ars Technica) as source
- Two independent parallel GitHub Actions jobs (`finance-pipeline` + `tech-pipeline`) — failure in one does not block the other
- Finance/Tech pill tab bar in `VideoFeed.tsx` — correct zIndex stacking (tab bar 60 > edition nav 50 > dots/mute 40), always rendered per CATUI-01
- Per-tab scroll memory via `tabScrollState useRef` — O(1) save/restore without triggering re-renders
- Post-human-verify bug fixes: `currentEdition?.id` dep for reliable play/pause on category switch; always-mounted feed container for stable `feedRef` through empty state transitions

**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

---

