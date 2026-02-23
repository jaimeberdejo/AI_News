# Requirements: FinFeed

**Defined:** 2026-02-23
**Core Value:** A finite, curated daily financial briefing — users always know when they're done.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Supabase Postgres schema exists with tables for editions, videos, and pipeline_runs
- [ ] **INFRA-02**: Supabase Storage bucket configured with public read access and CORS headers allowing the frontend domain
- [ ] **INFRA-03**: API endpoint returns today's edition with video metadata (URL, title, duration, order) as JSON

### Pipeline — Ingestion

- [ ] **INGEST-01**: Pipeline fetches articles from Yahoo Finance and Reuters RSS feeds
- [ ] **INGEST-02**: Pipeline deduplicates articles across runs (same story not reprocessed)

### Pipeline — Script

- [ ] **SCRIPT-01**: LLM (Groq Llama 3.3) selects the 5 most important financial stories from ingested articles
- [ ] **SCRIPT-02**: LLM writes a 30–45 second script per story in a dynamic "financial influencer" tone
- [ ] **SCRIPT-03**: Each script is stored in the DB with its source article reference before audio generation begins

### Pipeline — Audio & Subtitles

- [ ] **AUDIO-01**: OpenAI TTS (tts-1) converts each script to an MP3 audio file
- [ ] **AUDIO-02**: faster-whisper (tiny.en) runs forced alignment on each audio file to produce word-level timestamps
- [ ] **AUDIO-03**: Word-level timestamps are converted to a subtitle file (ASS format) for FFmpeg burning

### Pipeline — Video Assembly

- [ ] **VIDEO-01**: Pipeline downloads a relevant stock b-roll clip from Pexels API for each story
- [ ] **VIDEO-02**: FFmpeg assembles each video: b-roll background + audio track + burned-in subtitles → MP4
- [ ] **VIDEO-03**: Output video targets ≤10MB file size (720p, CRF 28) to stay within Supabase bandwidth limits
- [ ] **VIDEO-04**: Videos older than 7 days are automatically deleted from Supabase Storage on each pipeline run

### Pipeline — Automation

- [ ] **AUTO-01**: GitHub Actions cron job runs the pipeline automatically 1–2x per day
- [ ] **AUTO-02**: Each story is processed in isolation — if 1 story fails, the remaining stories still complete and publish
- [ ] **AUTO-03**: Each pipeline run records its status (running / complete / partial / failed) in the DB

### Frontend — Player

- [ ] **PLAY-01**: PWA displays today's 5 videos in a vertical snap-scroll feed (one video per screen)
- [ ] **PLAY-02**: First video autoplays muted on page load; a visible "Tap to listen" prompt is shown
- [ ] **PLAY-03**: Tapping the unmute prompt unmutes audio inside a synchronous event handler (iOS Safari compliant); audio stays unmuted for all subsequent videos in the session
- [ ] **PLAY-04**: Player preloads the next 2 videos in the background while current video plays
- [ ] **PLAY-05**: After the last video ends, a "You're up to date" end card is displayed with a countdown timer to the next edition

### Frontend — PWA

- [ ] **PWA-01**: App has a web manifest enabling "Add to Home Screen" with icon, splash screen, and standalone display mode

## v2 Requirements

### Quality

- **QUAL-01**: Regex validator checks every number and percentage in LLM scripts against source article text (hallucination prevention)

### Player UX

- **PLAY-06**: Progress indicator shows which video of 5 the user is currently watching
- **PLAY-07**: Share button allows user to share a story link

### Infrastructure

- **INFRA-04**: Migrate video storage to Cloudflare R2 ($0 egress) once Supabase bandwidth limit is reached

### Distribution

- **PUSH-01**: Push notifications alert subscribers when a new daily edition is published
- **AUTH-01**: Optional user accounts to track watch history and notification preferences

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication (v1) | Open access required — minimize friction for validation |
| Native mobile app | PWA web-first; build native only after traction confirmed |
| Multiple languages | English only for v1; translation adds pipeline complexity |
| Personalized feeds | One curated feed for all users — personalization is anti-finite |
| Monetization / subscriptions | Validation phase; add only after product-market fit |
| Social features (comments, likes) | Not core to the finite feed value proposition |
| Infinite scroll / more than 5 videos | Defeats the core "finite" product promise |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INGEST-01 | Phase 2 | Pending |
| INGEST-02 | Phase 2 | Pending |
| SCRIPT-01 | Phase 2 | Pending |
| SCRIPT-02 | Phase 2 | Pending |
| SCRIPT-03 | Phase 2 | Pending |
| AUDIO-01 | Phase 2 | Pending |
| AUDIO-02 | Phase 2 | Pending |
| AUDIO-03 | Phase 2 | Pending |
| VIDEO-01 | Phase 3 | Pending |
| VIDEO-02 | Phase 3 | Pending |
| VIDEO-03 | Phase 3 | Pending |
| VIDEO-04 | Phase 4 | Pending |
| AUTO-01 | Phase 5 | Pending |
| AUTO-02 | Phase 5 | Pending |
| AUTO-03 | Phase 5 | Pending |
| PLAY-01 | Phase 6 | Pending |
| PLAY-02 | Phase 6 | Pending |
| PLAY-03 | Phase 6 | Pending |
| PLAY-04 | Phase 6 | Pending |
| PLAY-05 | Phase 6 | Pending |
| PWA-01 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after initial definition*
