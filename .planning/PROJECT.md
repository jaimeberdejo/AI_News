# FinFeed

## What This Is

FinFeed is a mobile-first PWA that delivers exactly 5 AI-generated financial news videos per day. Users swipe vertically through a finite feed (TikTok/Stories-style) and see a "You're up to date" screen when they're done. All video content is generated automatically by a batch AI pipeline — no human editors.

## Core Value

A finite, curated daily financial briefing — users always know when they're done, preventing the infinite scroll trap of traditional news feeds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pipeline ingests financial news from free RSS feeds (Yahoo Finance, Reuters) 1-2x/day
- [ ] LLM (Groq/Llama 3.3) selects the 5 most important stories and writes 30–45s scripts in "financial influencer" tone
- [ ] TTS (OpenAI tts-1) converts scripts to audio
- [ ] FFmpeg assembles video: stock b-roll background + audio + synchronized subtitles
- [ ] Generated videos stored and served via Supabase
- [ ] PWA frontend displays daily feed with vertical snap-scroll
- [ ] First video autoplays muted; tap-to-unmute persists audio across session
- [ ] Frontend preloads first 2–3 videos to eliminate buffering on swipe
- [ ] "You're up to date" end state shown after last video
- [ ] No user authentication required (open access)

### Out of Scope

- User accounts / authentication — not needed for v1 validation
- Personalization / topic preferences — one curated feed for all users
- Mobile native app — PWA web-first only
- Monetization / subscriptions — validation phase only
- Multiple languages — English only for v1
- Push notifications — too early, no users yet
- Video sharing / social features — keep it simple

## Context

- Target audience: English-speaking global audience interested in financial news
- Geographic focus: Global markets (US markets, crypto, macro)
- Pipeline runs on GitHub Actions free tier (batch job, 1-2x/day)
- Video style: Stock b-roll footage from Pexels/Pixabay + synchronized subtitles
- This is a validation project — shipping fast matters more than polish

## Constraints

- **Cost**: Pipeline must run for ~$1–5/month total (Groq free, OpenAI TTS ~$0.50/mo, Supabase free, Vercel free, GitHub Actions free)
- **Stack**: Python pipeline (Groq + OpenAI TTS + FFmpeg), Supabase (Postgres + Storage), Vercel frontend
- **Pipeline**: Batch processing only — no real-time generation
- **News sources**: Free RSS feeds only (Yahoo Finance, Reuters public feeds) — no paid APIs
- **Video rendering**: FFmpeg-based (no paid video APIs)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Finite feed (5 videos/day) | Core differentiator — users know when they're done | — Pending |
| GitHub Actions as pipeline runner | Free tier (2,000 min/mo) handles batch jobs, no server needed | — Pending |
| Groq (Llama 3.3) for LLM | Free tier, fast inference, good quality for script writing | — Pending |
| OpenAI TTS (tts-1) for voice | Best quality/cost ratio at ~$0.50/mo for this volume | — Pending |
| FFmpeg for video assembly | Free, battle-tested, no external API dependency | — Pending |
| Supabase for DB + storage | Free tier covers MVP needs, Postgres + file storage in one | — Pending |
| No auth in v1 | Minimize friction for validation, add auth if product shows traction | — Pending |

---
*Last updated: 2026-02-23 after initialization*
