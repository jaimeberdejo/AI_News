# FinFeed

## What This Is

FinFeed is a mobile-first PWA that delivers a finite set of AI-generated financial news videos per day. Users swipe vertically through a curated feed (TikTok/Stories-style) and see a "You're up to date" screen when they're done. All video content is generated automatically by a batch AI pipeline — no human editors.

The core insight: TikTok has trained a generation to consume information through vertical short-form video. FinFeed applies that learned behaviour to something genuinely informative and useful — news that matters — rather than entertainment optimised for maximum time-on-app.

v1 ships with financial news. v2+ will expand to additional categories (technology, sports, politics, science).

## Core Value

A finite, curated daily briefing in vertical video format — users always know when they're done. No infinite scroll, no algorithmic rabbit holes. Just today's most important stories, consumed in the format people already know how to use.

## Current Milestone: v1.1 Multi-Category

**Goal:** Expand FinFeed from finance-only to a two-category app (Finance + Tech) with a tab bar for switching.

**Target features:**
- Tech news pipeline: automated daily video generation for the technology category
- Tab bar UI: Finance | Tech switcher in the PWA frontend
- Category-aware API and DB queries

## Requirements

### Validated

- ✓ Pipeline ingests financial news from free RSS feeds (Yahoo Finance, CNBC) 1-2x/day — v1.0
- ✓ LLM (Groq/Llama 3.3) selects the most important stories and writes 30–45s scripts in "financial influencer" tone — v1.0
- ✓ TTS (OpenAI tts-1, voice: onyx) converts scripts to audio — v1.0
- ✓ FFmpeg assembles video: stock b-roll background + audio + synchronized burned-in ASS subtitles — v1.0
- ✓ Generated videos stored and served via Supabase Storage (public bucket, 7-day retention) — v1.0
- ✓ PWA frontend displays daily feed with vertical snap-scroll — v1.0
- ✓ First video autoplays muted; tap-to-unmute persists audio across session (iOS Safari compliant) — v1.0
- ✓ Frontend preloads next 2 videos to eliminate buffering on swipe — v1.0
- ✓ "You're up to date" end state shown after last video — v1.0
- ✓ No user authentication required (open access for v1) — v1.0
- ✓ Pipeline runs automatically via GitHub Actions cron 2x/day — v1.0
- ✓ Per-story error isolation — if 1 story fails, remaining stories still publish as "partial" — v1.0
- ✓ 7-day automatic video cleanup on each pipeline run — v1.0
- ✓ PWA installable — web manifest, apple-touch-icon, standalone display mode — v1.0

### Active

- [ ] Tech news pipeline runs daily via GitHub Actions, producing a full tech edition (TECH-01)
- [ ] Pipeline uses tech-focused RSS feeds and appropriate LLM tone for technology news (TECH-02)
- [ ] Tab bar (Finance | Tech) at top of PWA — user switches category without page reload (TECH-03)
- [ ] Each category shows its own daily feed with independent edition navigation (TECH-04)

### Out of Scope (v1.1)

- Hallucination guard (QUAL-01) — deferred to v1.2+
- LLM upgrade (QUAL-02) — deferred to v1.2+; Groq free tier sufficient at current volume
- TTS upgrade (QUAL-03) — deferred to v1.2+; cost not justified until scale
- Premium b-roll (QUAL-04) — deferred to v1.2+; Pexels free tier adequate
- Push notifications (PUSH-01) — deferred to v1.2+
- User accounts / authentication — open access sufficient for validation; v1.2+
- Sports, politics, science categories — v1.1 adds tech only; expand in v1.2+
- Native mobile app — PWA web-first only
- Multiple languages — English only
- Personalized feeds — one curated feed per category for all users
- Monetization / subscriptions — validation phase only
- Social features (comments, likes) — not core to finite feed value proposition
- Infinite scroll — defeats the core "finite" product promise

## Context

- **Shipped:** v1.0 MVP (2026-02-26) — live at https://autonews-ai.vercel.app
- **Codebase:** ~1,970 LOC Python + TypeScript (96 files)
- **Tech stack:** Python pipeline (Groq + OpenAI TTS + faster-whisper + FFmpeg + Pexels), Supabase (Postgres + Storage), Next.js 16 App Router, Vercel, GitHub Actions
- **Pipeline runtime:** ~4m40s on GitHub Actions (first warm-cache run)
- **Cost at v1.0:** ~$0.50–2/month (Groq free, OpenAI TTS minimal, Supabase free, Vercel free, GitHub Actions free)
- **Key open question:** Is the finite feed concept strong enough to retain users? — validate before v2 investment
- **Known limitation:** Android device validation deferred (iOS confirmed, Android not tested)

## Constraints

- **Cost (v1):** Pipeline must run for ~$1–5/month total
- **Cost (future):** Higher-tier APIs unlock at scale — OpenAI TTS HD, ElevenLabs, premium stock footage, dedicated infrastructure
- **Stack:** Python pipeline (Groq + OpenAI TTS + FFmpeg), Supabase (Postgres + Storage), Vercel frontend
- **Pipeline:** Batch processing only — no real-time generation
- **News sources:** Free RSS feeds only in v1 (Yahoo Finance, CNBC public feeds)
- **Video rendering:** FFmpeg-based (no paid video APIs in v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Finite feed (variable count, not fixed) | Core differentiator — users know when they're done | ✓ Good — ships intact |
| Financial news as first category | High-value information, clear audience, good RSS coverage | ✓ Good — pipeline works cleanly |
| Multi-category architecture from day 1 | v1 ships one category but schema and pipeline must not hardcode "finance" | ✓ Good — DB has `category` field, pipeline is parameterized |
| GitHub Actions as pipeline runner | Free tier (2,000 min/mo) handles batch jobs, no server needed | ✓ Good — 4m40s per run, well within limits |
| Groq (Llama 3.3) for LLM | Free tier, fast inference, good quality for script writing | ✓ Good — free tier sufficient at MVP volume |
| OpenAI TTS (tts-1, voice: onyx) | Best quality/cost ratio at ~$0.50/mo for this volume | ✓ Good — deep voice suits financial news tone |
| FFmpeg for video assembly (subprocess, not ffmpeg-python) | Free, battle-tested; ffmpeg-python has known ASS filter bug on macOS | ✓ Good — reliable, no third-party API dependency |
| Supabase for DB + storage | Free tier covers MVP needs, Postgres + file storage in one | ✓ Good — CORS, public bucket, and 7-day retention all work |
| No auth in v1 | Minimize friction for validation, add auth if product shows traction | ✓ Good — aligns with validation goal |
| faster-whisper tiny.en for word alignment | OpenAI TTS returns no timestamps; tiny.en CPU/int8 fast enough on GitHub Actions | ✓ Good — 75 MB model cached, ~15–30s per story |
| 7-day video retention policy | Supabase free tier 1 GB storage exhausted in ~10 days without it | ✓ Good — keeps storage under control |
| Public GitHub Actions repo | Unlimited free minutes (critical cost lever) | ✓ Good — no billing exposure |
| Pexels API for b-roll (free tier) | Free stock footage with "stock market" fallback | ⚠️ Revisit — free tier quality varies; upgrade to premium at scale |
| editions UNIQUE constraint dropped (multi-edition per day) | Allows multiple pipeline runs per day for partial recovery | ✓ Good — each edition has its own UUID |

---
*Last updated: 2026-03-10 after v1.1 milestone started*
