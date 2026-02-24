# FinFeed

## What This Is

FinFeed is a mobile-first PWA that delivers a finite set of AI-generated news videos per day. Users swipe vertically through a curated feed (TikTok/Stories-style) and see a "You're up to date" screen when they're done. All video content is generated automatically by a batch AI pipeline — no human editors.

The core insight: TikTok has trained a generation to consume information through vertical short-form video. FinFeed applies that learned behaviour to something genuinely informative and useful — news that matters — rather than entertainment optimised for maximum time-on-app.

v1 focuses on financial news. Future versions will expand to additional categories (technology, sports, politics, science).

## Core Value

A finite, curated daily briefing in vertical video format — users always know when they're done. No infinite scroll, no algorithmic rabbit holes. Just today's most important stories, consumed in the format people already know how to use.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pipeline ingests financial news from free RSS feeds (Yahoo Finance, Reuters) 1-2x/day
- [ ] LLM (Groq/Llama 3.3) selects the most important stories (variable count per day) and writes 30–45s scripts in "financial influencer" tone
- [ ] TTS (OpenAI tts-1) converts scripts to audio
- [ ] FFmpeg assembles video: stock b-roll background + audio + synchronized subtitles
- [ ] Generated videos stored and served via Supabase
- [ ] PWA frontend displays daily feed with vertical snap-scroll
- [ ] First video autoplays muted; tap-to-unmute persists audio across session
- [ ] Frontend preloads first 2–3 videos to eliminate buffering on swipe
- [ ] "You're up to date" end state shown after last video
- [ ] No user authentication required (open access for v1)

### Out of Scope (v1)

- User accounts / authentication — open access for validation; planned for v2+
- Multiple news categories — financial news only for v1; architecture must not block adding categories later
- Personalization / topic preferences — one curated feed per category for all users
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

- **Cost (v1)**: Pipeline must run for ~$1–5/month total (Groq free, OpenAI TTS ~$0.50/mo, Supabase free, Vercel free, GitHub Actions free)
- **Cost (future)**: Higher-tier APIs unlock at scale — OpenAI TTS HD voices, ElevenLabs for more expressive narration, premium stock footage APIs, dedicated infrastructure
- **Stack**: Python pipeline (Groq + OpenAI TTS + FFmpeg), Supabase (Postgres + Storage), Vercel frontend
- **Pipeline**: Batch processing only — no real-time generation
- **News sources**: Free RSS feeds only (Yahoo Finance, Reuters public feeds) — no paid APIs in v1
- **Video rendering**: FFmpeg-based (no paid video APIs in v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Finite feed (variable count, not fixed) | Core differentiator — users know when they're done; count varies by news day | — Pending |
| Financial news as first category | High-value information, clear audience, good RSS coverage | — Pending |
| Multi-category architecture from day 1 | v1 ships one category, but DB schema and pipeline must not hardcode "finance" | — Pending |
| GitHub Actions as pipeline runner | Free tier (2,000 min/mo) handles batch jobs, no server needed | — Pending |
| Groq (Llama 3.3) for LLM | Free tier, fast inference, good quality for script writing; upgrade path to GPT-4o/Claude at scale | — Pending |
| OpenAI TTS (tts-1) for voice | Best quality/cost ratio at ~$0.50/mo for this volume; upgrade to tts-1-hd or ElevenLabs if quality matters at scale | — Pending |
| FFmpeg for video assembly | Free, battle-tested, no external API dependency | — Pending |
| Supabase for DB + storage | Free tier covers MVP needs, Postgres + file storage in one | — Pending |
| No auth in v1 | Minimize friction for validation, add auth if product shows traction | — Pending |

---
*Last updated: 2026-02-24*
