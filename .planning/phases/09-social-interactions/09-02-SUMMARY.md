---
phase: 09-social-interactions
plan: 02
subsystem: api
tags: [nextjs, supabase, route-handlers, rls, typescript, social]

# Dependency graph
requires:
  - phase: 09-social-interactions
    plan: 01
    provides: "video_likes, video_bookmarks tables with RLS, videos.like_count column and trigger"
  - phase: 07-auth-infrastructure
    provides: "lib/supabase/server.ts SSR cookie client (createClient)"
provides:
  - "POST /api/social/like — auth-gated toggle-like handler"
  - "POST /api/social/bookmark — auth-gated toggle-bookmark handler"
  - "GET /api/social/state — batch social state (likeCounts + per-user likes/bookmarks)"
affects:
  - 09-social-interactions
  - 10-comments

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-client pattern in state handler: anon client for public data (likeCounts), SSR cookie client for per-user state"
    - "Check-then-act toggle: SELECT maybeSingle() then INSERT or DELETE (Supabase lacks ON CONFLICT DO DELETE)"
    - "Auth gate pattern: createClient() + getUser() at top of handler, return 401 if !user"

key-files:
  created:
    - frontend/app/api/social/like/route.ts
    - frontend/app/api/social/bookmark/route.ts
    - frontend/app/api/social/state/route.ts
  modified: []

key-decisions:
  - "Two-client pattern in GET /api/social/state: anon client for likeCounts (public RLS), SSR client for per-user state — guests always receive like counts"
  - "Check-then-act toggle pattern (SELECT maybeSingle → INSERT or DELETE) chosen because Supabase Postgres does not support ON CONFLICT DO DELETE"

patterns-established:
  - "Social mutation handlers always import createClient from @/lib/supabase/server — never the anon singleton"
  - "Toggle handlers return {liked: bool} or {bookmarked: bool} immediately — no DB round-trip after mutation"

requirements-completed: [SOCL-01, SOCL-04]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 9 Plan 02: Social Interactions Route Handlers Summary

**Three Next.js Route Handlers providing auth-gated like/bookmark toggles and batch social state reads using SSR Supabase cookie client**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-25T00:57:27Z
- **Completed:** 2026-03-25T00:58:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `POST /api/social/like` — auth-gated, check-then-toggle on `video_likes` table, returns `{liked: bool}`
- Created `POST /api/social/bookmark` — auth-gated, check-then-toggle on `video_bookmarks` table, returns `{bookmarked: bool}`
- Created `GET /api/social/state` — two-client pattern: anon client for public `likeCounts`, SSR client for per-user `likes` and `bookmarks` arrays
- TypeScript compiles with no errors across all three handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create like and bookmark Route Handlers** - `b9ead57` (feat)
2. **Task 2: Create social state Route Handler** - `3fd48e2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/app/api/social/like/route.ts` - POST toggle-like handler with 401 guard and check-then-act toggle on video_likes
- `frontend/app/api/social/bookmark/route.ts` - POST toggle-bookmark handler with 401 guard and check-then-act toggle on video_bookmarks
- `frontend/app/api/social/state/route.ts` - GET batch social state: likeCounts (anon client), likes/bookmarks (SSR client, empty for guests)

## Decisions Made

- Two-client pattern in `GET /api/social/state`: anon client reads `videos.like_count` (covered by existing anon RLS SELECT on videos) while SSR client reads per-user state. Guests always receive like counts without authentication.
- Check-then-act toggle (SELECT `maybeSingle()` then INSERT or DELETE) because Supabase/PostgreSQL doesn't support `ON CONFLICT DO DELETE` in standard SQL.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all three handlers created and TypeScript-verified without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full social API is complete: like/bookmark mutations are auth-gated and toggle correctly; state endpoint serves both guests and signed-in users
- Phase 9 Plan 03 can proceed: wire the VideoItem stub buttons to these API handlers with optimistic UI updates
- All three handlers pass TypeScript compilation — ready for integration

## Self-Check: PASSED

- FOUND: frontend/app/api/social/like/route.ts
- FOUND: frontend/app/api/social/bookmark/route.ts
- FOUND: frontend/app/api/social/state/route.ts
- FOUND: .planning/phases/09-social-interactions/09-02-SUMMARY.md
- FOUND: commit b9ead57
- FOUND: commit 3fd48e2

---
*Phase: 09-social-interactions*
*Completed: 2026-03-25*
