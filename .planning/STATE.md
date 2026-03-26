# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** A finite, curated daily briefing — users always know when they're done.
**Current focus:** v1.3 Mobile UI — Phase 12: Mobile UI Overhaul

## Current Position

Phase: 12 of 12 (Mobile UI)
Plan: 3/3 in current phase — Awaiting Human Checkpoint
Status: Phase 12 Plan 3 Tasks 1-2 Complete — Thumbnail pipeline (FFmpeg JPEG, Supabase upload, DB write), VideoGrid img+placeholder, ProfilePage sticky tab bar + safe-area paddingBottom (MOB-06, MOB-07); Task 3 checkpoint awaiting human verification
Last activity: 2026-03-26 — Phase 12 Plan 3 executed; DB migration, 4 pipeline files, 4 frontend files; TypeScript clean

Progress: [██████████] 100% (12 phases started, 3/3 plans in Phase 12 complete)

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
| 11-profile-page | 3/3 | ~35 min | ~11.7 min |

**Recent Trend:**
- Phase 6 took longer due to human verification checkpoint and post-checkpoint bug fixes
- Trend: Stable
| Phase 10-comments P03 | 19 | 3 tasks | 3 files |
| Phase 11-profile P01 | 2 | 3 tasks | 4 files |
| Phase 11-profile P02 | 3 | 4 tasks | 6 files |
| Phase 11 P03 | 30min | 3 tasks | 2 files |
| Phase 12-mobile-ui P01 | 2 | 2 tasks | 2 files |
| Phase 12-mobile-ui P02 | 2 | 2 tasks | 2 files |
| Phase 12-mobile-ui P03 | 3 | 2 tasks (auto) | 9 files |

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
- [Phase 11-01]: storage.foldername(name)[1] extracts first path segment from {user_id}/avatar.jpg — scopes upload RLS to user's own folder
- [Phase 11-01]: PATCH /api/profile uses explicit field whitelist (not body spread) — prevents mass-assignment vulnerabilities
- [Phase 11-01]: row.videos cast through unknown in liked/saved routes — Supabase embedded join infers ambiguous TS type; cast through unknown required without changing runtime behavior
- [Phase 11-01]: video_likes/video_bookmarks use Supabase embedded join syntax (.select('created_at, videos(...)')) — FK from video_id to public.videos.id enables automatic join inference
- [Phase 11-02]: TabBar z-index 200; EditNameSheet z-index 300/301 to float above TabBar when open
- [Phase 11-02]: paddingBottom: 80px on ProfilePage content areas clears floating TabBar height + safe area
- [Phase 11-02]: Liked videos fetched eagerly on mount; saved videos fetched lazily on first tab switch — avoids double-fetch on initial load
- [Phase 11-02]: avatarVersion counter state in ProfilePage for cache-busting avatar URL after upload (Plan 03 wires actual upload)
- [Phase 11]: cropToSquare() defined outside component as pure function; Canvas crops to Math.min(width,height) square for consistent avatar shape regardless of photo orientation
- [Phase 11]: ?videoId= handled in VideoFeed (not page.tsx) — extends existing ?videoIndex= searchParams pattern with ~10 lines, no new prop drilling; video not found falls back to index 0
- [Phase 11]: VideoItem paddingBottom extended to calc(safe-area + 56px + 14px) — 56px TabBar height must be included to prevent social buttons being hidden behind floating tab bar
- [Phase 12-mobile-ui]: VideoItem root position:relative — feed-item CSS owns snap height, overlays anchor to root
- [Phase 12-mobile-ui]: TabBar height calc(56px + env(safe-area-inset-bottom)) — safe-area-correct pattern for fixed bars on iPhone 14+
- [Phase 12-02]: --category-bar-height: 44px CSS variable in :root — single source of truth; both feed-container and feed-item use same calc() so snap math is correct
- [Phase 12-02]: Tab bar as real flex child (not absolute) — occupies physical space so feed-container starts below it with no overlap and no safe-area offset needed
- [Phase 12-02]: Progress dots vertical column right:12px top:16px — top is relative to feed-container (below tab bar), no safe-area offset needed
- [Phase 12-03]: extract_thumbnail uses -ss 0.5 to skip common black first frame from b-roll; 0.5s offset is safe for all assembled videos
- [Phase 12-03]: thumbnail upload is non-fatal — pipeline still publishes video even if FFmpeg thumbnail extraction fails
- [Phase 12-03]: GridVideo.thumbnail_url is optional (?) so existing callers don't need to provide it; VideoGrid shows placeholder for null/undefined
- [Phase 12-03]: ProfilePage paddingBottom updated from 80px to calc(env(safe-area-inset-bottom) + 56px + 16px) for safe-area-correct TabBar clearance on iPhone 14+

### Pending Todos

None.

### Blockers/Concerns

- [Phase 8 - RESOLVED]: iOS PWA OAuth context isolation — RESOLVED in plan 08-03; all 4 test scenarios passed on real iPhone PWA; Google OAuth via window.location.href confirmed working in standalone mode
- [Phase 7 - RESOLVED]: Supabase free tier email rate limit — RESOLVED via Resend custom SMTP configured in plan 07-03
- [CVE-2025-29927]: RESOLVED in Phase 07-01 — middleware.ts created with static-asset matcher, closing bypass vector

## Session Continuity

Last session: 2026-03-26
Stopped at: 12-03 Task 3 checkpoint — awaiting human verification of Phase 12 mobile UI (19-point checklist); thumbnail pipeline and ProfilePage layout fixes committed
Resume file: None
