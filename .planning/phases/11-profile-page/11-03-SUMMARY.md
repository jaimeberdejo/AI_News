---
phase: 11-profile-page
plan: 03
subsystem: ui
tags: [react, supabase, storage, canvas, avatar-upload, navigation, search-params]

# Dependency graph
requires:
  - phase: 11-01
    provides: Supabase Storage avatars bucket, PATCH /api/profile route handler
  - phase: 11-02
    provides: ProfilePage component with avatar circle, hidden file input ref, avatarVersion counter state placeholder
  - phase: 09
    provides: video_likes and video_bookmarks tables enabling liked/saved grid data
provides:
  - Avatar upload flow (tap → file picker → canvas center-crop → Storage upsert → profile PATCH → cache-busted display)
  - ?videoId= navigation from profile grid thumbnails to home feed at correct video
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Canvas API center-crop to square JPEG before upload
    - Supabase Storage upsert (overwrite existing avatar at {user_id}/avatar.jpg)
    - Cache-busting avatar img src with ?t={avatarVersion} timestamp
    - ?videoId= search param lookup by ID in VideoFeed (extends existing ?videoIndex= pattern)

key-files:
  created: []
  modified:
    - frontend/components/ProfilePage.tsx
    - frontend/components/VideoFeed.tsx

key-decisions:
  - "cropToSquare() defined outside component — pure function, no hook deps, keeps component body clean"
  - "Canvas crops to Math.min(width,height) square centered — consistent square avatar regardless of photo aspect ratio"
  - "?videoId= handled in VideoFeed (not page.tsx) — VideoFeed already reads useSearchParams for ?videoIndex=; same pattern extended with ~10 lines"
  - "Video not found in current edition falls back to index 0 — past-edition videos are acceptable to open feed at top per research open question #2"
  - "Tab bar height regression fix: VideoItem paddingBottom extended from calc(safe-area + 14px) to calc(safe-area + 56px + 14px) to clear floating TabBar"

patterns-established:
  - "Avatar cache-bust: increment avatarVersion (Date.now()) after upload; append ?t={avatarVersion} to img src"
  - "File input reset after cancel: set e.target.value = '' on the input ref to allow re-selecting the same file"

requirements-completed: [PROF-02, PROF-03, PROF-04]

# Metrics
duration: ~30min
completed: 2026-03-26
---

# Phase 11 Plan 03: Avatar Upload + Navigation + Human Gate Summary

**Avatar upload via Canvas center-crop to Supabase Storage with cache-busted display, plus ?videoId= scroll-to-video navigation from profile grid thumbnails**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-26
- **Completed:** 2026-03-26
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Complete avatar upload flow: tap avatar circle → hidden file input → Canvas API center-crop to square JPEG → Supabase Storage upsert at `{user_id}/avatar.jpg` → PATCH /api/profile → immediate cache-busted avatar update
- Crop preview modal with circular preview, "Cancel" and "Use This Photo" buttons, upload loading state
- ?videoId= URL parameter handling in VideoFeed — finds video by ID in current edition and scrolls to it, falling back to index 0 if not found
- Human verification checkpoint passed — all 8 verification checks confirmed working
- Post-checkpoint regression fix: VideoItem bottom padding extended to clear floating TabBar (commit 9a2036c)

## Task Commits

Each task was committed atomically:

1. **Task 1: Avatar upload flow in ProfilePage** - `7c9afd7` (feat)
2. **Task 2: ?videoId= navigation in VideoFeed** - `01b3894` (feat)
3. **Task 3: Human verification checkpoint** - approved by user; regression fix committed separately as `9a2036c`

## Files Created/Modified

- `frontend/components/ProfilePage.tsx` - Added cropToSquare() function, handleFileChange, handleConfirmCrop, crop preview modal, avatarVersion cache-busting in avatar img src, isUploading loading state
- `frontend/components/VideoFeed.tsx` - Extended existing ?videoIndex= searchParams handling with ?videoId= branch: findIndex by ID, scroll to index, router.replace('/') cleanup

## Decisions Made

- `cropToSquare()` defined outside the component as a pure function — no hooks needed, cleaner component body
- Canvas crops to `Math.min(img.width, img.height)` square, centered via offset — produces consistent square avatar for any photo orientation
- `?videoId=` handled in VideoFeed (not page.tsx) — VideoFeed already owns `useSearchParams` for the `?videoIndex=` pattern; the `videoId` branch adds ~10 lines with zero new prop drilling
- Video not found in current edition: feed opens at index 0 — acceptable per Phase 11 research open question #2 (past-edition videos)
- Tab bar regression auto-fixed: `paddingBottom` in VideoItem updated from `calc(env(safe-area-inset-bottom) + 14px)` to `calc(env(safe-area-inset-bottom) + 56px + 14px)` — 56px accounts for the floating TabBar height

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tab bar covering like/comment/bookmark buttons in VideoItem**
- **Found during:** Task 3 (human verification checkpoint)
- **Issue:** VideoItem's info panel `paddingBottom` did not account for the 56px TabBar height introduced in Phase 11-02; social action buttons were hidden behind the floating tab bar on mobile
- **Fix:** Changed `paddingBottom` from `calc(env(safe-area-inset-bottom) + 14px)` to `calc(env(safe-area-inset-bottom) + 56px + 14px)` in VideoItem.tsx; fix applied externally by user and committed
- **Files modified:** `frontend/components/VideoItem.tsx`
- **Verification:** Regression check in human verification — like/bookmark/comment buttons confirmed accessible after fix
- **Committed in:** `9a2036c` (fix(11): add tab bar height to VideoItem info panel bottom padding)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was essential for usability — social buttons inaccessible without it. No scope creep.

## Issues Encountered

None — all tasks completed as planned. The regression was found during human verification and fixed before approval.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 (Profile Page) is fully complete — all 4 PROF requirements satisfied
- PROF-01: Display name edit with persistence (Phase 11-02)
- PROF-02: Avatar upload to Supabase Storage with immediate cache-busted update (this plan)
- PROF-03: Liked videos 3-col grid with empty state and tap-to-navigate (Phase 11-02 + this plan)
- PROF-04: Saved videos 3-col grid with empty state and tap-to-navigate (Phase 11-02 + this plan)
- v1.2 Social + Accounts milestone complete — ready for `/gsd:complete-milestone` or next milestone planning

---
*Phase: 11-profile-page*
*Completed: 2026-03-26*
