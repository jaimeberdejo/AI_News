# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** A finite, curated daily briefing — users always know when they're done.
**Current focus:** v1.2 Social + Accounts — Phase 10: Comments

## Current Position

Phase: 10 of 11 (Comments)
Plan: 3/3 in current phase — Awaiting Human Verification
Status: Phase 10 Plan 3 Tasks Complete (checkpoint:human-verify pending)
Last activity: 2026-03-26 — Phase 10 Plan 3 tasks complete (CommentSheet UI + VideoFeed/VideoItem wiring); awaiting end-to-end human verification

Progress: [████████░░] 73% (8/11 phases complete — v1.0 + v1.1 + Phase 8 + Phase 9 done; Phase 10 in progress)

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
| 09-social-interactions | 3/3 | ~4 min | ~2 min |
| 10-comments | 3/3 | ~19 min | ~6.3 min |

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
- [Phase 08-03]: auth-error is a pure Server Component — no interactivity needed for a static OAuth error fallback page
- [Phase 08-03]: update-password validates passwords match client-side before calling Server Action — avoids unnecessary round-trip on obvious input errors
- [Phase 08-03]: iOS PWA checkpoint passed — Google OAuth via window.location.href (full-page navigation) confirmed working on real iPhone in standalone mode; Phase 8 blocker resolved
- [Phase 09-01]: like_count denormalized on videos table maintained by AFTER INSERT OR DELETE trigger — consistent with optimistic UI plan; avoids N+1 count queries on feed load
- [Phase 09-01]: video_likes has anon RLS SELECT (guests see counts on first render); video_bookmarks has no anon SELECT (private by design)
- [Phase 09-01]: Trigger uses GREATEST(like_count - 1, 0) to prevent negative counts under race conditions
- [Phase 09-02]: Two-client pattern in GET /api/social/state — anon client for public likeCounts, SSR client for per-user state; guests always receive like counts
- [Phase 09-02]: Check-then-act toggle pattern (SELECT maybeSingle → INSERT or DELETE) — Supabase/PostgreSQL does not support ON CONFLICT DO DELETE
- [Phase 09-03]: onSocialAction signature extended to (action, videoId) atomically — interface + destructure + all 3 call sites updated in one edit; TypeScript catches mismatch at compile time
- [Phase 09-03]: socialState seeded from video.like_count on fetch error — guests see counts even when /api/social/state is unreachable
- [Phase 09-03]: processingLike/processingBookmark as Set<string> per-video debounce — rapid double-taps on one video do not block other videos
- [Phase 09-03]: Social state useEffect deps [user?.id, videos.length] — avoids object reference instability while re-triggering on auth change or edition switch
- [Phase 10-01]: comment_count denormalized on videos table maintained by AFTER INSERT OR DELETE trigger — consistent with like_count pattern; avoids N+1 count queries on feed load
- [Phase 10-01]: video_comments FK references profiles (not auth.users) — enables Supabase embedded join syntax for fetching comments with author data
- [Phase 10-01]: Two indexes: (video_id, created_at) for comment feed queries; (user_id, created_at DESC) for rate limit enforcement in Phase 10-02
- [Phase 10-01]: RLS grants anon + authenticated SELECT on video_comments (comments are public); authenticated-only INSERT/DELETE with auth.uid() check
- [Phase 10-02]: Two-client pattern for GET /api/comments — anon client so guests always receive comments without cookie overhead; SSR client for auth-gated POST/DELETE
- [Phase 10-02]: Rate limit query filters only user_id + created_at (no video_id filter) — cross-video per-user 30s enforcement (COMM-04)
- [Phase 10-02]: DELETE /api/comments/[id] returns 404 (not 403) for non-owner — consistent project error pattern covering both not-found and unauthorized cases
- [Phase 10-03]: CommentSheet receives currentUserId as prop (not useAuth internally) — VideoFeed already owns auth state; avoids duplicate hook calls
- [Phase 10-03]: Separate commentVideoId state from sheetAction — sheetAction drives AuthBottomSheet guest gate, commentVideoId drives CommentSheet for signed-in users; clean separation of concerns
- [Phase 10-03]: formatRelativeTime inline utility — simple arithmetic, no library dependency needed for relative time formatting

### Pending Todos

None.

### Blockers/Concerns

- [Phase 8 - RESOLVED]: iOS PWA OAuth context isolation — RESOLVED in plan 08-03; all 4 test scenarios passed on real iPhone PWA; Google OAuth via window.location.href confirmed working in standalone mode
- [Phase 7 - RESOLVED]: Supabase free tier email rate limit — RESOLVED via Resend custom SMTP configured in plan 07-03
- [CVE-2025-29927]: RESOLVED in Phase 07-01 — middleware.ts created with static-asset matcher, closing bypass vector

## Session Continuity

Last session: 2026-03-26
Stopped at: 10-03 checkpoint:human-verify — CommentSheet UI tasks complete (Tasks 1+2 committed); awaiting end-to-end verification of full Phase 10 comment system.
Resume file: None
