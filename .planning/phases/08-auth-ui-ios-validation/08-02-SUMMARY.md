---
phase: 08-auth-ui-ios-validation
plan: 02
subsystem: auth, ui
tags: [react, next.js, supabase, social-buttons, bottom-sheet, scroll-restoration, suspense]

# Dependency graph
requires:
  - phase: 08-01-PLAN.md
    provides: useAuth hook, AuthBottomSheet component, signInWithGoogle with returnPath
  - phase: 06-category-ui
    provides: VideoItem pure layout component with onEnded/videoRef props
provides:
  - Social action buttons (like, bookmark, comment) rendered in VideoItem info panel
  - AuthBottomSheet wired into VideoFeed with sheet state and auth check
  - Scroll restoration after OAuth return via ?videoIndex= URL param
  - Suspense boundary in page.tsx for useSearchParams compatibility
affects: [09-social-mutations, 10-comments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth gate via onSocialAction callback: VideoItem stays pure, VideoFeed owns all auth logic"
    - "Scroll restoration via useEffect([videos.length]): runs once after data loads, cleans URL"
    - "AuthBottomSheet rendered once at VideoFeed level (not inside VideoItem) — single controlled instance"
    - "authLoading debounce in handleSocialAction prevents sheet flash on mount for signed-in users"

key-files:
  created: []
  modified:
    - frontend/components/VideoItem.tsx
    - frontend/components/VideoFeed.tsx
    - frontend/app/page.tsx

key-decisions:
  - "Social buttons in VideoItem are pure stubs — onSocialAction callback is the only connection to VideoFeed (Phase 9 adds real mutations)"
  - "videos.length dep in scroll restoration useEffect is intentional — waits for data, avoids double-fire from stable router/searchParams refs"
  - "Suspense fallback={null} in page.tsx avoids visible loading flash (page is server-rendered before Suspense boundary activates)"

patterns-established:
  - "Social action prop pattern: VideoItem.onSocialAction is a pure callback — state and auth logic in VideoFeed"
  - "URL cleanup after OAuth: router.replace('/', { scroll: false }) always called to prevent dirty URLs"

requirements-completed: [AUTH-06, AUTH-07]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 8 Plan 02: Auth UI Feed Integration Summary

**Social buttons wired into VideoItem, AuthBottomSheet controlled by VideoFeed, scroll restoration reads ?videoIndex= and cleans URL on OAuth return**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-24T09:44:42Z
- **Completed:** 2026-03-24T09:47:15Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- VideoItem now renders three social action buttons (like, bookmark, comment) in the info panel — visible to all users including guests
- VideoFeed wires up AuthBottomSheet: guest tapping any social button triggers the sheet with contextual headline ("Sign in to like this", etc.)
- Scroll restoration useEffect reads `?videoIndex=N` after OAuth return, scrolls the feed to the exact video, then calls `router.replace('/', { scroll: false })` to clean the URL
- page.tsx wrapped VideoFeed in `<Suspense fallback={null}>` required by Next.js App Router for useSearchParams compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Add social action buttons to VideoItem** - `4a7ff11` (feat)
2. **Task 2: Wire AuthBottomSheet into VideoFeed + scroll restoration** - `57a8de5` (feat)
3. **Task 3: Add Suspense boundary to page.tsx** - `1e87986` (feat)

## Files Created/Modified
- `frontend/components/VideoItem.tsx` - Added `onSocialAction` prop and three stub social action buttons in info panel below article link
- `frontend/components/VideoFeed.tsx` - Added useAuth, useSearchParams, useRouter hooks; sheetAction state; handleSocialAction; scroll restoration useEffect; AuthBottomSheet render
- `frontend/app/page.tsx` - Wrapped VideoFeed in Suspense boundary

## Decisions Made
- Social buttons in VideoItem are pure stubs — the `onSocialAction` callback is the only connection to VideoFeed. Real mutations (likes, bookmarks) are Phase 9 work.
- `videos.length` used as sole dependency in scroll restoration useEffect (not `searchParams` or `router`) — intentional to prevent double-fire since those are stable refs.
- `router.replace('/', { scroll: false })` is called unconditionally when `?videoIndex=` is found, even if the index was out of range, ensuring URL is always cleaned.
- `fallback={null}` in Suspense boundary avoids visible loading flash since the page is already server-rendered before Suspense activates client-side.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Guest browsing and sign-in prompt experience complete: guest sees feed immediately, taps a social button, sheet slides up, OAuth flow navigates back to the exact video
- Phase 9 (social mutations) can now wire real like/bookmark/comment handlers into VideoFeed's `handleSocialAction` for signed-in users
- iOS PWA validation still pending (Phase 8 Plan 3) — must test OAuth flow in real iPhone PWA before Phase 8 closes

---
*Phase: 08-auth-ui-ios-validation*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: frontend/components/VideoItem.tsx
- FOUND: frontend/components/VideoFeed.tsx
- FOUND: frontend/app/page.tsx
- FOUND: .planning/phases/08-auth-ui-ios-validation/08-02-SUMMARY.md
- FOUND commit 4a7ff11: feat(08-02): add social action buttons to VideoItem
- FOUND commit 57a8de5: feat(08-02): wire AuthBottomSheet and scroll restoration into VideoFeed
- FOUND commit 1e87986: feat(08-02): wrap VideoFeed in Suspense boundary in page.tsx
