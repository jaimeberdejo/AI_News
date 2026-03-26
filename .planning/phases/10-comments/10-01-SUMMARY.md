---
phase: 10-comments
plan: 01
subsystem: database
tags: [supabase, postgres, rls, trigger, typescript]

# Dependency graph
requires:
  - phase: 09-social-interactions
    provides: like_count pattern — denormalized count with AFTER INSERT OR DELETE trigger; SECURITY DEFINER trigger convention
provides:
  - video_comments table with RLS (anon/authenticated SELECT, authenticated INSERT/DELETE)
  - comment_count column on videos maintained by DB trigger
  - Video TypeScript interface with comment_count field
  - /api/today feed API returning comment_count per video
affects: [10-02-comments-api, 10-03-comments-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Denormalized comment_count on videos maintained by AFTER INSERT OR DELETE trigger (mirrors like_count pattern from Phase 9)
    - FK to profiles (not auth.users) on video_comments to enable Supabase embedded join syntax
    - SECURITY DEFINER SET search_path = '' on trigger function (established project security pattern)
    - GREATEST(count - 1, 0) guard prevents negative counts under race conditions

key-files:
  created:
    - frontend/supabase/migrations/20260326000001_add_comments.sql
  modified:
    - frontend/hooks/useEdition.ts
    - frontend/app/api/today/route.ts

key-decisions:
  - "comment_count denormalized on videos table maintained by AFTER INSERT OR DELETE trigger — consistent with like_count pattern; avoids N+1 count queries on feed load"
  - "video_comments FK references profiles (not auth.users) — enables Supabase embedded join syntax for fetching comments with author display name/avatar"
  - "Two indexes: (video_id, created_at) for comment feed queries; (user_id, created_at DESC) for rate limit enforcement in Phase 10-02"
  - "RLS: anon + authenticated SELECT (comments are public); authenticated-only INSERT/DELETE with auth.uid() check"

patterns-established:
  - "Pattern 1: Denormalized count column + AFTER trigger — same as like_count in Phase 9; consistent data model for social counters"
  - "Pattern 2: GREATEST(count - 1, 0) in decrement trigger — prevents negative counts under concurrent deletes"

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-04]

# Metrics
duration: ~15min
completed: 2026-03-26
---

# Phase 10 Plan 01: Comments Data Foundation Summary

**video_comments table with RLS + comment_count trigger on videos, plus TypeScript interface and feed API updated to expose comment_count**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-26T10:45:00Z
- **Completed:** 2026-03-26T10:59:28Z
- **Tasks:** 3 (Task 2 was a human-action checkpoint)
- **Files modified:** 3

## Accomplishments
- Created `video_comments` table with two indexes, three RLS policies, and a SECURITY DEFINER trigger function that maintains `comment_count` on the `videos` table
- Applied migration to Supabase via `supabase db push` (human action — Task 2 checkpoint)
- Added `comment_count: number` to the Video TypeScript interface and to the `/api/today` Supabase select query; TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create comments migration** - `cc47560` (feat)
2. **Task 2: Apply migration to Supabase** - checkpoint (human action, no code commit)
3. **Task 3: Add comment_count to Video interface and feed API** - `2cdee4f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/supabase/migrations/20260326000001_add_comments.sql` - video_comments table, RLS policies, comment_count column, update_video_comment_count trigger
- `frontend/hooks/useEdition.ts` - Added `comment_count: number` to Video interface
- `frontend/app/api/today/route.ts` - Added `comment_count` to Supabase select string

## Decisions Made
- video_comments FK references `profiles` not `auth.users` — enables Supabase embedded join syntax for fetching comments with author data in Phase 10-02
- Two composite indexes chosen: `(video_id, created_at)` for the comment feed, `(user_id, created_at DESC)` for rate limit query (last 5 comments in 60s check)
- RLS grants anon SELECT on video_comments (comments are public, consistent with like counts); bookmarks remain private (no anon SELECT)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Task 2 (Apply migration) produced a NOTICE: `trigger "on_comment_change" does not exist, skipping` — this is expected. The `DROP TRIGGER IF EXISTS` safety guard fires a notice on first run when no prior trigger exists. The migration applied cleanly.

## User Setup Required

None - migration applied in Task 2 (human-confirmed via `supabase db push`).

## Next Phase Readiness
- video_comments table and RLS are live in Supabase
- comment_count column is on videos table and stays in sync via trigger
- Video interface and feed API are updated — Phase 10-02 (Comments API) can begin immediately
- No blockers

---
*Phase: 10-comments*
*Completed: 2026-03-26*
