# FinFeed

## What This Is

FinFeed is a mobile-first PWA that delivers a finite set of AI-generated news videos per day across multiple categories (Finance and Tech). Users swipe vertically through a curated feed (TikTok/Stories-style), sign in to like, comment, and bookmark videos, and manage their identity through a profile page. All video content is generated automatically by a batch AI pipeline — no human editors.

The core insight: TikTok has trained a generation to consume information through vertical short-form video. FinFeed applies that learned behaviour to something genuinely informative and useful — news that matters — rather than entertainment optimised for maximum time-on-app.

## Core Value

A finite, curated daily briefing in vertical video format — users always know when they're done. No infinite scroll, no algorithmic rabbit holes. Just today's most important stories, consumed in the format people already know how to use.

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
- ✓ Tech news pipeline runs daily via GitHub Actions, producing a full tech edition — v1.1 (TECH-01)
- ✓ Pipeline uses tech-focused RSS feeds (TechCrunch, HN, Ars Technica) with tech journalist LLM tone — v1.1 (TECH-02, TECH-03)
- ✓ Finance/Tech tab bar at top of PWA — category switch without page reload, per-tab scroll memory — v1.1 (CATUI-01, CATUI-02, CATUI-03)
- ✓ User can sign up / sign in with Google OAuth or email+password; session persists across refresh — v1.2 (AUTH-01–05)
- ✓ Guest users browse freely; social actions prompt sign-in via bottom sheet — v1.2 (AUTH-06–07)
- ✓ User can like/unlike videos; like count visible to guests — v1.2 (SOCL-01–02)
- ✓ User can bookmark and remove bookmarks on videos — v1.2 (SOCL-03–04)
- ✓ User can post flat comments on videos; rate-limited (30s) + 500-char cap — v1.2 (COMM-01–04)
- ✓ Profile page with display name, avatar, liked videos tab, saved videos tab — v1.2 (PROF-01–04)
- ✓ Full-screen TikTok-style video layout with right-rail social buttons — v1.2 (MOB-01–02)
- ✓ Solid scrollable category tab bar, vertical progress dots, safe-area-correct TabBar — v1.2 (MOB-03–05)
- ✓ Pipeline generates JPEG thumbnails; VideoGrid uses static `<img>` for iOS PWA — v1.2 (MOB-06–07)

### Active

- [ ] Re-enable email confirmation for production (currently disabled for demo; requires `signUp` action change + Supabase toggle)
- [ ] Cross-edition video navigation (tap in profile → navigate to any edition's video)
- [ ] Android device validation — deferred since v1.1; iOS confirmed, Android untested

### Out of Scope

- Hallucination guard (QUAL-01) — deferred to v1.3+; cost not justified until scale
- LLM upgrade (QUAL-02) — deferred; Groq free tier sufficient at current volume
- TTS upgrade (QUAL-03) — deferred; cost not justified until scale
- Premium b-roll (QUAL-04) — deferred; Pexels free tier adequate
- Push notifications (PUSH-01) — deferred to v1.3+
- Apple Sign In — requires Apple Developer account ($99/yr) + 6-month key rotation; defer to v1.3
- Nested/threaded comments — anti-pattern on mobile; flat comments are simpler and better UX
- Watch history — not selected for v1.2/v1.3 scope
- Following other users — not aligned with FinFeed's curated finite feed model
- Real-time like counts — Supabase free tier: 200 concurrent connections; optimistic UI sufficient
- Sports, politics, science categories — expand after v1.2 validation
- Native mobile app — PWA web-first only
- Multiple languages — English only
- Personalized feeds — one curated feed per category for all users
- Monetization / subscriptions — validation phase only
- Infinite scroll — defeats the core "finite" product promise

## Context

- **Shipped:** v1.3 Demo Prep (2026-04-13) — live at https://autonews-ai.vercel.app
- **Codebase:** ~6,207 LOC Python + TypeScript
- **Tech stack:** Python pipeline (Groq + OpenAI TTS + faster-whisper + FFmpeg + Pexels), Supabase (Postgres + Storage + Auth), Next.js 16 App Router, Vercel, GitHub Actions
- **Pipeline runtime:** ~4m40s on GitHub Actions per category (finance + tech run in parallel)
- **Cost at v1.3:** ~$0.50–2/month (Groq free, OpenAI TTS minimal, Supabase free, Vercel free, GitHub Actions free, Resend 3k emails/mo free)
- **Auth:** Google OAuth + email/password via Supabase Auth; Resend custom SMTP; email confirmation disabled for demo
- **Known tech debt:**
  - `signUp redirect('/')` + Supabase "Confirm email" OFF is a demo-only configuration — must revert before targeting real users at scale
  - Pre-existing users (before trigger deploy) needed a one-time profiles backfill SQL
  - Comment count does not update in real-time — requires feed refresh
  - `?videoId=` cross-edition navigation falls back to top of feed (deferred to v1.4)
  - VideoGrid uses `preload=metadata` for thumbnails — switch to `poster` attribute if CDN provides them

## Constraints

- **Cost (v1):** Pipeline must run for ~$1–5/month total
- **Cost (future):** Higher-tier APIs unlock at scale — OpenAI TTS HD, ElevenLabs, premium stock footage, dedicated infrastructure
- **Stack:** Python pipeline (Groq + OpenAI TTS + FFmpeg), Supabase (Postgres + Storage + Auth), Vercel frontend
- **Pipeline:** Batch processing only — no real-time generation
- **News sources:** Free RSS feeds only (Yahoo Finance, CNBC, TechCrunch, Hacker News, Ars Technica)
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
| FEEDS_BY_CATEGORY dict pattern | Extensible routing to new categories via dict lookup, not if/else | ✓ Good — clean extension point for v1.2+ categories |
| Two independent GitHub Actions jobs (no needs:) | Finance failure must not block tech edition generation | ✓ Good — TECH-01 success criterion #4 satisfied |
| tabScrollState as useRef (not useState) | Scroll position is imperative state — no re-render needed on save/restore | ✓ Good — no extra renders on tab switch |
| currentEdition?.id in play/pause useEffect deps | activeIndex alone doesn't re-fire when switching categories at index 0 | ✓ Good — found during human verification, fixed pre-approval |
| Empty state inside feed-container (not early return) | Early return unmounts feedRef, breaking scroll listener on empty → populated transition | ✓ Good — feedRef stable through all state transitions |
| @supabase/ssr with getAll/setAll cookie adapter | Required for ssr 0.2+; singular get/set deprecated; PKCE + session refresh work correctly | ✓ Good — clean session management across SSR/client |
| CVE-2025-29927-safe middleware matcher | Static-asset exclusion prevents 9+ auth calls per page load and closes bypass vector | ✓ Good — standard pattern now in all new projects |
| signInWithGoogle returns { url } not redirect() | iOS PWA standalone mode breaks when Server Action calls redirect() to external OAuth URL | ✓ Good — confirmed on real device in Phase 8 |
| handle_new_user trigger with SECURITY DEFINER + search_path='' | Prevents search-path injection; ON CONFLICT DO NOTHING prevents rollback on duplicate | ✓ Good — production-safe, no issues in smoke test |
| Resend for custom SMTP | 3,000 emails/month free vs Supabase 3 OTP/hour; unblocks auth for real users | ✓ Good — configured in 07-03, no rate limit issues |
| Soft-gated auth (guest-first) | Guests browse freely; social actions prompt sign-in — max reach, min friction | ✓ Good — AUTH-06/07 confirmed on real device |
| Denormalized like_count + DB trigger | Avoids N+1 count queries; GREATEST(count-1, 0) guards against negative counts | ✓ Good — consistent with comment_count pattern in Phase 10 |
| video_likes has anon RLS SELECT; video_bookmarks does not | Like counts are public (social signal); bookmarks are private by design | ✓ Good — SOCL-02/03 requirements explicitly captured this |
| video_comments FK to profiles (not auth.users) | Enables Supabase embedded join syntax for fetching comments with author data | ✓ Good — profiles join works cleanly in CommentSheet |
| Comments rate-limit 30s via two-index query | (video_id, created_at) for feed; (user_id, created_at DESC) for rate limit check | ✓ Good — COMM-04 satisfied with O(log n) query |
| storage.foldername(name)[1] for avatars RLS | User-scoped upload policy without storing user_id separately — path encodes ownership | ✓ Good — upload/read/update/delete all work correctly |
| Phase 12 grouped into v1.2 milestone | Mobile UI shipped in same sprint as social; natural milestone boundary | ✓ Good — all 6 phases shipped together |
| `signUp` calls `redirect('/')` (no email confirmation) | Demo UX: users land in app immediately after registration; re-enabling confirmation requires reverting this action | ⚠️ Revisit — demo-only config; must revert before real user scale |
| Default `/auth/login` tab is `register` | Optimise for demo UX where new participants register first | ✓ Good — reduces friction in user-testing sessions |
| Plain `<a href>` in AuthBottomSheet (not next/link) | Consistent with existing `window.location.href` pattern in same file; full-page nav preferred for auth routes | ✓ Good — no new import, pattern stays consistent |
| Supabase "Confirm email" disabled project-wide | Demo trade-off — immediate session on signup; avoids email round-trip friction for demo participants | ⚠️ Revisit — must re-enable for real users; noted in tech debt |

---
*Last updated: 2026-04-13 after v1.3 milestone*
