# Requirements: FinFeed

**Defined:** 2026-02-23
**Last updated:** 2026-02-24
**Core Value:** A finite, curated daily briefing in vertical video format — users always know when they're done. v1 focuses on financial news; architecture supports multiple categories in future versions.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Supabase Postgres schema exists with tables for editions, videos, and pipeline_runs
- [x] **INFRA-02**: Supabase Storage bucket configured with public read access and CORS headers allowing the frontend domain
- [x] **INFRA-03**: API endpoint returns today's edition with video metadata (URL, title, duration, order) as JSON

### Pipeline — Ingestion

- [x] **INGEST-01**: Pipeline fetches articles from Yahoo Finance and Reuters RSS feeds
- [x] **INGEST-02**: Pipeline deduplicates articles across runs (same story not reprocessed)

### Pipeline — Script

- [x] **SCRIPT-01**: LLM (Groq Llama 3.3) selects the most important financial stories from ingested articles (variable count per edition, not fixed)
- [x] **SCRIPT-02**: LLM writes a 30–45 second script per story in a dynamic "financial influencer" tone
- [x] **SCRIPT-03**: Each script is stored in the DB with its source article reference before audio generation begins

### Pipeline — Audio & Subtitles

- [x] **AUDIO-01**: OpenAI TTS (tts-1) converts each script to an MP3 audio file
- [x] **AUDIO-02**: faster-whisper (tiny.en) runs forced alignment on each audio file to produce word-level timestamps
- [x] **AUDIO-03**: Word-level timestamps are converted to a subtitle file (ASS format) for FFmpeg burning

### Pipeline — Video Assembly

- [ ] **VIDEO-01**: Pipeline downloads a relevant stock b-roll clip from Pexels API for each story
- [ ] **VIDEO-02**: FFmpeg assembles each video: b-roll background + audio track + burned-in subtitles → MP4
- [ ] **VIDEO-03**: Output video targets ≤10MB file size (720p, CRF 28) to stay within Supabase bandwidth limits
- [x] **VIDEO-04**: Videos older than 7 days are automatically deleted from Supabase Storage on each pipeline run

### Pipeline — Automation

- [ ] **AUTO-01**: GitHub Actions cron job runs the pipeline automatically 1–2x per day
- [x] **AUTO-02**: Each story is processed in isolation — if 1 story fails, the remaining stories still complete and publish
- [x] **AUTO-03**: Each pipeline run records its status (running / complete / partial / failed) in the DB

### Frontend — Player

- [x] **PLAY-01**: PWA displays today's 5 videos in a vertical snap-scroll feed (one video per screen)
- [x] **PLAY-02**: First video autoplays muted on page load; a visible "Tap to listen" prompt is shown
- [ ] **PLAY-03**: Tapping the unmute prompt unmutes audio inside a synchronous event handler (iOS Safari compliant); audio stays unmuted for all subsequent videos in the session
- [ ] **PLAY-04**: Player preloads the next 2 videos in the background while current video plays
- [ ] **PLAY-05**: After the last video ends, a "You're up to date" end card is displayed with a countdown timer to the next edition

### Frontend — PWA

- [ ] **PWA-01**: App has a web manifest enabling "Add to Home Screen" with icon, splash screen, and standalone display mode

## v2 Requirements

### Quality

- **QUAL-01**: Regex validator checks every number and percentage in LLM scripts against source article text (hallucination prevention)
- **QUAL-02**: Upgrade LLM to GPT-4o or Claude Sonnet for higher script quality at scale (requires paid API tier)
- **QUAL-03**: Upgrade TTS to OpenAI tts-1-hd or ElevenLabs for more expressive narration (requires paid API tier)
- **QUAL-04**: Replace free Pexels b-roll with premium stock footage API for higher visual quality (requires paid tier)

### Player UX

- **PLAY-06**: Progress indicator shows which video of N the user is currently watching
- **PLAY-07**: Share button allows user to share a story link

### User Accounts

- **AUTH-01**: User registration and login (email or social OAuth) — enables personalisation and history
- **AUTH-02**: Watch history persisted per user — resume where you left off across sessions
- **AUTH-03**: Notification preferences — users opt in to daily briefing alerts

### Multi-Category

- **CAT-01**: Pipeline supports multiple news categories (technology, sports, politics, science) — each with its own RSS sources, prompt tone, and daily edition
- **CAT-02**: Frontend lets users select which categories they follow
- **CAT-03**: Each category has its own finite daily feed, independent of others

### Infrastructure

- **INFRA-04**: Migrate video storage to Cloudflare R2 ($0 egress) once Supabase bandwidth limit is reached

### Distribution

- **PUSH-01**: Push notifications alert subscribers when a new daily edition is published

## Out of Scope (v1)

| Feature | Reason |
|---------|--------|
| User authentication | Open access required — minimize friction for validation; planned for v2 |
| Multiple news categories | Financial news only for v1; multi-category is a v2 requirement (CAT-01–03) |
| Native mobile app | PWA web-first; build native only after traction confirmed |
| Multiple languages | English only for v1; translation adds pipeline complexity |
| Personalized feeds | One curated feed per category — personalization is anti-finite in v1 |
| Monetization / subscriptions | Validation phase; add only after product-market fit |
| Social features (comments, likes) | Not core to the finite feed value proposition |
| Infinite scroll | Defeats the core "finite" product promise |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INGEST-01 | Phase 2 | Complete |
| INGEST-02 | Phase 2 | Complete |
| SCRIPT-01 | Phase 2 | Complete |
| SCRIPT-02 | Phase 2 | Complete |
| SCRIPT-03 | Phase 2 | Complete |
| AUDIO-01 | Phase 2 | Complete |
| AUDIO-02 | Phase 2 | Complete |
| AUDIO-03 | Phase 2 | Complete |
| VIDEO-01 | Phase 2 | Pending |
| VIDEO-02 | Phase 2 | Pending |
| VIDEO-03 | Phase 2 | Pending |
| VIDEO-04 | Phase 2 | Complete |
| AUTO-02 | Phase 2 | Complete |
| AUTO-03 | Phase 2 | Complete |
| AUTO-01 | Phase 4 | Pending |
| PLAY-01 | Phase 3 | Complete |
| PLAY-02 | Phase 3 | Complete |
| PLAY-03 | Phase 3 | Pending |
| PLAY-04 | Phase 3 | Pending |
| PLAY-05 | Phase 3 | Pending |
| PWA-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

**Phase 4 note:** Phase 4 (Ship) contains only AUTO-01 as a new v1 requirement. The remainder of Phase 4 validates that all requirements from Phases 1-3 work together in production (GitHub Actions automation, Vercel deployment, real device testing).

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 — traceability updated for 4-phase MVP roadmap*
