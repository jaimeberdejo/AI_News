---
phase: 09-social-interactions
plan: 01
subsystem: database
tags: [supabase, postgres, rls, sql, typescript]

# Dependency graph
requires:
  - phase: 07-auth-infrastructure
    provides: "auth.users table and RLS pattern with SECURITY DEFINER trigger functions"
  - phase: 08-auth-ui-ios-validation
    provides: "Video TypeScript interface in useEdition.ts used by VideoItem social stubs"
provides:
  - "video_likes table with RLS (anon read, auth insert/delete)"
  - "video_bookmarks table with RLS (auth-only, private)"
  - "videos.like_count column with DB trigger keeping it in sync"
  - "Video TypeScript interface extended with like_count: number"
  - "/api/today and /api/editions/[id] returning like_count per video"
affects:
  - 09-social-interactions
  - 10-comments

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalized count maintained by AFTER INSERT OR DELETE trigger with GREATEST(count - 1, 0) guard"
    - "SECURITY DEFINER + SET search_path = '' on trigger function (CVE search-path injection protection)"
    - "Anon RLS SELECT policy on video_likes allows guest visibility of like counts"
    - "Private bookmarks: no anon SELECT policy on video_bookmarks"

key-files:
  created:
    - frontend/supabase/migrations/20260325000001_add_social_tables.sql
  modified:
    - frontend/hooks/useEdition.ts
    - frontend/app/api/today/route.ts
    - frontend/app/api/editions/[id]/route.ts

key-decisions:
  - "like_count is denormalized onto videos table (not computed at query time) — consistent with optimistic UI plan; trigger keeps it accurate"
  - "video_likes RLS allows anon SELECT so guests see counts on first render without a second request (SOCL-02)"
  - "video_bookmarks RLS has no anon SELECT — bookmarks are private by design (SOCL-03)"
  - "Trigger uses GREATEST(like_count - 1, 0) to prevent negative counts on race conditions"

patterns-established:
  - "Feed API selects: always include like_count in videos(...) select to avoid N+1 count queries"
  - "Trigger function pattern: SECURITY DEFINER + SET search_path = '' (same as handle_new_user in phase 07)"

requirements-completed: [SOCL-02, SOCL-03]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 9 Plan 01: Social Interactions Schema Summary

**Supabase schema for video likes and bookmarks with RLS, denormalized like_count trigger, and feed API extended to return like_count per video**

## Performance

- **Duration:** ~2 min (continuation agent — Task 3 only; Tasks 1-2 completed by previous agent)
- **Started:** 2026-03-25T00:54:22Z
- **Completed:** 2026-03-25T00:55:14Z
- **Tasks:** 3 (1 migration file, 1 human checkpoint, 1 type/API update)
- **Files modified:** 4

## Accomplishments

- Created complete social schema migration: `video_likes`, `video_bookmarks` tables with full RLS policies
- Added `videos.like_count` integer column with AFTER INSERT/DELETE trigger keeping it in sync
- Extended `Video` TypeScript interface with `like_count: number` field
- Updated both feed APIs (`/api/today` and `/api/editions/[id]`) to include `like_count` in video selects
- TypeScript compilation passes with no errors after type change

## Task Commits

Each task was committed atomically:

1. **Task 1: Write social tables migration** - `31b6f7e` (feat)
2. **Task 2: Apply migration to Supabase** - (human applied — no code commit)
3. **Task 3: Add like_count to Video type and feed API selects** - `3e0793b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/supabase/migrations/20260325000001_add_social_tables.sql` - Full social schema: video_likes, video_bookmarks, like_count column, update_video_like_count trigger function and on_like_change trigger
- `frontend/hooks/useEdition.ts` - Added `like_count: number` to Video interface
- `frontend/app/api/today/route.ts` - Added `like_count` to videos select
- `frontend/app/api/editions/[id]/route.ts` - Added `like_count` to videos select

## Decisions Made

- `like_count` is denormalized on `videos` (not computed at query time) — consistent with optimistic UI plan, trigger keeps it accurate without app-layer round-trips
- `video_likes` has anon RLS SELECT so guests see counts on first render (SOCL-02 requirement)
- `video_bookmarks` has no anon SELECT — private by design (SOCL-03 requirement)
- Trigger uses `GREATEST(like_count - 1, 0)` to prevent negative counts under race conditions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all three steps (migration creation, migration application, type/API update) completed without problems.

## User Setup Required

None — migration was applied directly to Supabase during execution (Task 2 human checkpoint).

## Next Phase Readiness

- Schema foundation is complete — `video_likes`, `video_bookmarks`, and `videos.like_count` all exist in Supabase
- Feed APIs now return `like_count` on every video — guests see counts on first render without additional requests
- Phase 9 Plan 02 can proceed: implement social mutation Route Handlers (`/api/social/like`, `/api/social/bookmark`) and connect the VideoItem stub buttons

---
*Phase: 09-social-interactions*
*Completed: 2026-03-25*
