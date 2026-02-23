# Roadmap: FinFeed

## Overview

FinFeed is built in two distinct systems: a Python batch pipeline that generates 5 AI-produced financial news videos per day, and a Next.js PWA that delivers those videos in a finite vertical scroll feed. The roadmap is structured for a solo developer shipping an MVP first: foundation, then the full pipeline running locally end-to-end, then the frontend, then automation and deployment. The goal is something simple and functional before adding sophistication.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Supabase schema, storage, and API contract are live and verified
- [ ] **Phase 2: Pipeline** - Full pipeline runs locally end-to-end: RSS ingestion → scripts → TTS → Whisper alignment → FFmpeg video assembly → Supabase upload → published edition with 7-day cleanup
- [ ] **Phase 3: Frontend** - Next.js PWA delivers the finite vertical video feed with muted autoplay, tap-to-unmute, preloading, end card, and PWA installability
- [ ] **Phase 4: Ship** - GitHub Actions cron automates the pipeline, Vercel deploys the frontend, and the full user journey is validated on real devices

## Phase Details

### Phase 1: Foundation
**Goal**: The Supabase infrastructure is live — schema migrated, storage configured, and both the pipeline service key and frontend anon key can interact with it correctly
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Running `python -c "from db import client; print(client.table('editions').select('*').execute())"` returns an empty result set without errors
  2. A test MP4 uploaded via the service key is publicly accessible via its Supabase Storage CDN URL in a browser
  3. CORS headers on the storage bucket allow the frontend domain to fetch video files with range requests (206 Partial Content)
  4. The `/api/today` endpoint returns a valid JSON response (empty or with mock data) without a 4xx or 5xx error
**Plans**: TBD

Plans:
- [ ] 01-01: Supabase schema, RLS, and storage bucket setup
- [ ] 01-02: API endpoint scaffold and connectivity verification

### Phase 2: Pipeline
**Goal**: Running `python -m pipeline.run` locally completes the entire pipeline — from fetching RSS articles to 5 published MP4 URLs in Supabase Storage — in a single command, with per-story error isolation and 7-day cleanup
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, SCRIPT-01, SCRIPT-02, SCRIPT-03, AUDIO-01, AUDIO-02, AUDIO-03, VIDEO-01, VIDEO-02, VIDEO-03, VIDEO-04, AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. Running `python -m pipeline.run` locally completes without error and produces 5 publicly accessible MP4 URLs in Supabase Storage
  2. Each output MP4 plays with visible subtitles synchronized to speech, is 10 MB or smaller at 720p, and has audible financial news content
  3. Re-running the pipeline on the same day does not create duplicate articles or editions (deduplication works)
  4. If one story fails during assembly, the remaining stories still upload and the edition publishes as `partial` — the pipeline does not abort
  5. After a successful run, any editions older than 7 days are deleted from Supabase Storage and their DB records updated
**Plans**: TBD

Plans:
- [ ] 02-01: RSS ingestion and deduplication
- [ ] 02-02: LLM script selection and writing (Groq Llama 3.3)
- [ ] 02-03: TTS audio generation and Whisper forced alignment
- [ ] 02-04: Pexels b-roll download with fallback and FFmpeg video assembly
- [ ] 02-05: Supabase Storage upload, edition publish, error isolation, audit logging, and 7-day cleanup

### Phase 3: Frontend
**Goal**: The Next.js PWA delivers today's 5 videos in a finite vertical scroll feed — muted autoplay, tap-to-unmute that persists across videos, preloading, "You're up to date" end card, and PWA installability from a real device
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PWA-01
**Success Criteria** (what must be TRUE):
  1. Opening the app on an iPhone loads the first video muted and autoplaying within 2 seconds, with a "Tap to listen" prompt visible
  2. Tapping the mute prompt on iOS Safari unmutes audio successfully (no silent failure); all subsequent videos in the session play with audio
  3. Swiping to the next video plays it immediately without a buffering pause (next 2 videos preloaded)
  4. After swiping past the 5th video, the "You're up to date" screen appears with a countdown timer to the next edition
  5. The app can be added to the iOS home screen and launches in standalone mode with the correct icon and splash screen
**Plans**: TBD

Plans:
- [ ] 03-01: Next.js App Router scaffold with Supabase data fetching and mock video data
- [ ] 03-02: SwipeableFeed component — vertical snap scroll, muted autoplay, playsinline
- [ ] 03-03: Tap-to-unmute (iOS-safe synchronous handler), preloading, and end card
- [ ] 03-04: PWA manifest, service worker (app shell only, video bypass), icons

### Phase 4: Ship
**Goal**: FinFeed is live at a public URL, the pipeline runs automatically via GitHub Actions twice daily, and the full user journey works on real iOS and Android devices without developer intervention
**Depends on**: Phase 3
**Requirements**: AUTO-01
**Success Criteria** (what must be TRUE):
  1. The GitHub Actions workflow triggers automatically at 6am and 6pm UTC and completes within 30 minutes, with all secrets stored securely and never appearing in logs
  2. A user on an iPhone can open the public Vercel URL, watch all 5 videos with audio, and see the "You're up to date" screen — no developer steps required
  3. The next day, the pipeline runs automatically and the user sees 5 new videos without any manual trigger
  4. The Vercel deployment serves the app with no CORS errors when streaming video from Supabase Storage
**Plans**: TBD

Plans:
- [ ] 04-01: GitHub Actions workflow with cron, secrets, and dependency caching
- [ ] 04-02: Vercel deployment, environment variable configuration, and CORS production verification
- [ ] 04-03: End-to-end validation on real iOS and Android devices

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Pipeline | 0/5 | Not started | - |
| 3. Frontend | 0/4 | Not started | - |
| 4. Ship | 0/3 | Not started | - |
