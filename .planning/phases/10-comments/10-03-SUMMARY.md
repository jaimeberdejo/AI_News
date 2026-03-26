---
phase: 10-comments
plan: 03
subsystem: ui
tags: [react, typescript, next.js, bottom-sheet, optimistic-ui, comments]

# Dependency graph
requires:
  - phase: 10-02
    provides: GET/POST /api/comments and DELETE /api/comments/[id] route handlers
provides:
  - CommentSheet component: bottom sheet with comment list, post, delete, guest prompt
  - VideoFeed: commentVideoId state wired to CommentSheet open/close
  - VideoItem: real comment_count displayed via commentCount prop
affects: [phase-11-final]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Bottom sheet with slide animation matching AuthBottomSheet (cubic-bezier transform + opacity overlay)
    - Lazy load on open: useEffect keyed [isOpen, videoId] — no fetch on every video render
    - Optimistic comment with temp id replaced by server response on success; removed on failure
    - Optimistic delete with local state removal, restore on API error
    - onTouchMove/onWheel stopPropagation on scroll container prevents video feed scroll
    - Guest detection via currentUserId === null renders static "Sign in to comment" text

key-files:
  created:
    - frontend/components/CommentSheet.tsx
  modified:
    - frontend/components/VideoFeed.tsx
    - frontend/components/VideoItem.tsx

key-decisions:
  - "CommentSheet receives currentUserId as prop (not useAuth internally) — VideoFeed already owns auth state; prop threading avoids duplicate hook calls"
  - "Optimistic delete restores full comments array on failure — simpler than re-fetching; acceptable given low comment volume"
  - "commentVideoId state separate from sheetAction — clean separation: sheetAction drives AuthBottomSheet (guest gate), commentVideoId drives CommentSheet (signed-in flow)"
  - "formatRelativeTime utility inline in component — simple arithmetic, no library needed for this use case"

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-04]

# Metrics
duration: ~19min (including human verification checkpoint)
completed: 2026-03-26
---

# Phase 10 Plan 03: Comments UI Summary

**CommentSheet bottom sheet component with lazy loading, optimistic post/delete, guest prompt, and live comment_count in VideoItem**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T11:05:09Z
- **Completed:** 2026-03-26T11:07:16Z
- **Tasks:** 3 of 3 complete (Task 3 checkpoint:human-verify — approved by user)
- **Files modified:** 3

## Accomplishments

- Created `frontend/components/CommentSheet.tsx`: 75vh bottom sheet with slide animation matching AuthBottomSheet; lazy loads comments via GET /api/comments on open; optimistic POST with temp id replaced by server response; optimistic DELETE with restore on error; delete button conditionally rendered only for own comments (`comment.user_id === currentUserId`); 500-char textarea with live counter; rate limit and server errors shown in red; onTouchMove/onWheel stopPropagation prevents video feed scroll; guest prompt shows "Sign in to comment" instead of textarea
- Updated `frontend/components/VideoFeed.tsx`: added `commentVideoId` state, wired comment action in `handleSocialAction` to `setCommentVideoId(videoId)`, added `CommentSheet` alongside `AuthBottomSheet`, passed `commentCount={video.comment_count}` to VideoItem
- Updated `frontend/components/VideoItem.tsx`: added `commentCount?: number` to props interface, replaced hardcoded `0` with `{commentCount ?? 0}` in comment button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CommentSheet component** - `5c16b34` (feat)
2. **Task 2: Wire CommentSheet into VideoFeed and VideoItem** - `1e78333` (feat)
3. **Task 3: End-to-end verification** - checkpoint:human-verify (approved — "it works")

## Files Created/Modified

- `frontend/components/CommentSheet.tsx` — bottom sheet with comment list, optimistic post/delete, 500-char cap, guest prompt, scroll isolation
- `frontend/components/VideoFeed.tsx` — commentVideoId state, comment action dispatch, CommentSheet render, commentCount prop
- `frontend/components/VideoItem.tsx` — commentCount prop, live count display

## Decisions Made

- CommentSheet receives `currentUserId` as prop rather than calling `useAuth()` internally — VideoFeed already owns auth state; avoids duplicate hook calls and keeps the component pure/testable
- Separate `commentVideoId` state from `sheetAction` — `sheetAction` drives the AuthBottomSheet guest gate (also handles comment action for guests), `commentVideoId` drives CommentSheet for signed-in users; clean separation of concerns
- `formatRelativeTime` utility inline in component — simple arithmetic (seconds/minutes/hours/days), no library dependency needed
- Optimistic delete restores full saved array on failure rather than re-fetching — simpler recovery for low-volume comment lists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Data issue (not a code bug):** Pre-existing auth users created before the handle_new_user trigger (Phase 07-02) had no corresponding profiles row. This caused comment POST to fail for those users (FK constraint violation on video_comments.user_id → profiles). Fix: one-time SQL backfill in Supabase dashboard to insert missing profile rows for pre-existing auth users. No code change required — the trigger correctly handles all new users going forward.

## Self-Check: PASSED

- `frontend/components/CommentSheet.tsx` — file exists, exports `CommentSheet`
- `frontend/components/VideoFeed.tsx` — commentVideoId state present, CommentSheet imported and rendered, commentCount prop passed
- `frontend/components/VideoItem.tsx` — commentCount prop in interface, `{commentCount ?? 0}` in JSX
- Commits `5c16b34` and `1e78333` verified in git log
- TypeScript compiles without errors (npx tsc --noEmit returned no output)
- Human verification passed: all 4 Phase 10 criteria confirmed working end-to-end

## Next Phase Readiness

- Phase 10 (Comments) complete — all 4 criteria verified end-to-end by user
- comment_count, like_count, and bookmark counts are all live and accurate
- Phase 11 (polish/final) can begin; no blockers
