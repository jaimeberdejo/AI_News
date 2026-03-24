# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** A finite, curated daily briefing — users always know when they're done.
**Current focus:** v1.2 Social + Accounts — Phase 8: Auth UI + iOS Validation

## Current Position

Phase: 8 of 11 (Auth UI + iOS Validation)
Plan: 2/3 in current phase
Status: In Progress
Last activity: 2026-03-24 — Phase 8 Plan 2 complete (social buttons in VideoItem, AuthBottomSheet wired into VideoFeed, scroll restoration, Suspense boundary)

Progress: [██████░░░░] 55% (6/11 phases complete — v1.0 + v1.1 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 14 (v1.0) + 3 (v1.1) = 17 total
- Average duration: ~11 min (v1.0), ~14 min (v1.1 plans avg)
- Total execution time: ~117 min (v1.0), ~39 min (v1.1)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | ~62 min | ~31 min |
| 02-pipeline | 5 | ~49 min | ~10 min |
| 03-frontend | 4 | ~10 min | ~2.5 min |
| 04-ship | 3 | ~2 min | ~1 min |
| 05-tech-pipeline | 2 | ~4 min | ~2 min |
| 06-category-ui | 1 | ~35 min | ~35 min |
| 07-auth-infrastructure | 3/3 | ~17 min | ~8.5 min |
| 08-auth-ui-ios-validation | 2/3 | ~5 min | ~2.5 min |

**Recent Trend:**
- Phase 6 took longer due to human verification checkpoint and post-checkpoint bug fixes
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.2 arch]: @supabase/ssr required for cookie-based sessions — existing lib/supabase.ts anon singleton preserved unchanged
- [v1.2 arch]: Social mutations via dedicated Route Handlers (/api/social/*) — Python pipeline stays auth-unaware
- [v1.2 arch]: Apple Sign In deferred to v1.3 — 6-month key rotation ops burden not justified at current scale
- [v1.2 arch]: Optimistic UI for likes/bookmarks — Supabase Realtime deferred (200 concurrent connection limit on free tier)
- [v1.2 arch]: Comments must ship with moderation minimums (rate limit + length cap) — never ship without both
- [Phase 06-01]: currentEdition?.id in play/pause useEffect deps — prevents stale closure on category switch at index 0
- [Phase 06-01]: Feed container always mounted — keeps feedRef stable through empty state transitions
- [Phase 07-02]: signInWithGoogle returns { url } not redirect() — iOS PWA standalone mode requires window.location.href assignment by Client Component
- [Phase 07-02]: handle_new_user trigger uses ON CONFLICT DO NOTHING safety valve — prevents full signup rollback on duplicate trigger fire
- [Phase 07-02]: SECURITY DEFINER + SET search_path = '' on trigger function — prevents search-path injection
- [Phase 07-03]: Resend chosen for custom SMTP — 3,000 emails/month free tier replaces Supabase 3 OTP/hr rate limit
- [Phase 07-03]: Google Cloud OAuth consent screen set to External user type — required for use outside Google Workspace; test users added for development phase
- [Phase 07-03]: Supabase redirect URLs use wildcard pattern for Vercel previews — covers all preview deploy URLs without per-deployment registration
- [Phase 08-01]: useAuth uses getUser() not getSession() — server-validated auth state for guest-vs-signed-in gate decision
- [Phase 08-01]: AuthBottomSheet calls signInWithGoogle internally (not via prop) — simpler call site in VideoFeed
- [Phase 08-01]: signInWithGoogle returnPath defaults to '/' — backward compatible; encodes ?next= in OAuth redirectTo for video position preservation
- [Phase 08-02]: Social buttons in VideoItem are pure stubs — onSocialAction callback is the only connection to VideoFeed (Phase 9 adds real mutations)
- [Phase 08-02]: videos.length dep in scroll restoration useEffect is intentional — avoids double-fire from stable router/searchParams refs
- [Phase 08-02]: router.replace called unconditionally when ?videoIndex= found — always cleans URL regardless of index validity
- [Phase 08-02]: Suspense fallback={null} in page.tsx avoids visible loading flash (page already server-rendered before Suspense activates)

### Pending Todos

None.

### Blockers/Concerns

- [Phase 8]: iOS PWA OAuth context isolation — must test on real iPhone with PWA installed before Phase 8 closes; recovery cost is HIGH if auth is broken and social phases are already built on top of it
- [Phase 7 - RESOLVED]: Supabase free tier email rate limit — RESOLVED via Resend custom SMTP configured in plan 07-03
- [CVE-2025-29927]: RESOLVED in Phase 07-01 — middleware.ts created with static-asset matcher, closing bypass vector

## Session Continuity

Last session: 2026-03-24
Stopped at: Completed 08-02-PLAN.md — social buttons in VideoItem, AuthBottomSheet wired into VideoFeed, scroll restoration, Suspense boundary. Phase 8 Plan 2 done.
Resume file: None
