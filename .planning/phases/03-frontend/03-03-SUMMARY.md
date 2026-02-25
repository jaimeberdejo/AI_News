---
phase: 03-frontend
plan: "03"
subsystem: ui
tags: [react, nextjs, ios, video, intersectionobserver, typescript]

# Dependency graph
requires:
  - phase: 03-02
    provides: VideoFeed scroll container, VideoItem with iOS attrs, useVideoPlayer hook, MuteButton

provides:
  - iOS-safe synchronous mute toggle (no async boundary between onClick and video.muted)
  - Module-level globalMuted flag for IntersectionObserver callbacks outside React render cycle
  - isMutedRef pattern in useVideoPlayer for stale-closure-free muted state reads
  - Next 2 video preloading via 1px fixed visibility:hidden DOM elements
  - Progress dots overlay (pill-shaped Instagram Stories style, centered top safe-area)
  - onBecomeActive callback for scroll-based activeIndex tracking
  - Screen-tap MuteButton restore (2s prominent flash on screen tap)
  - EndCard: "You're up to date" + human-readable time estimate + Watch again + silent edition refresh

affects:
  - 04-pwa (service worker, offline caching of preloaded videos)
  - 06-testing (iOS gesture tests need synchronous handler knowledge)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level mutable flag for cross-React-render synchronous state (iOS video unmute)"
    - "isMutedRef pattern: keep useRef in sync with prop so IntersectionObserver callbacks always have current value"
    - "1px fixed visibility:hidden preload elements for iOS video buffering"
    - "onBecomeActive callback from IntersectionObserver for scroll-position tracking without scroll events"

key-files:
  created:
    - frontend/components/EndCard.tsx
  modified:
    - frontend/components/VideoFeed.tsx
    - frontend/components/VideoItem.tsx
    - frontend/components/MuteButton.tsx
    - frontend/hooks/useVideoPlayer.ts
    - frontend/app/page.tsx

key-decisions:
  - "globalMuted as module-level let (not React state) — IntersectionObserver callbacks run outside React's render cycle and cannot reliably read stale closures"
  - "handleMuteToggle is fully synchronous: globalMuted update + forEach .muted = newMuted + setIsMuted all in one onClick call stack — iOS requires this"
  - "isMutedRef pattern in useVideoPlayer replaces isMuted in observer deps — observer created once, reads ref dynamically instead of re-attaching on every mute toggle"
  - "Preload via 1px fixed visibility:hidden (not display:none) — iOS buffers elements it considers on-screen; display:none prevents buffering"
  - "Progress dots use pill-shaped bars (6px inactive, 20px active) not circles — matches Instagram Stories style per CONTEXT.md"
  - "EndCard new-edition detection triggers window.location.reload() — user on end card won't notice; cleanest way to get fresh SSR data"
  - "getNextEditionMessage uses hour-of-day buckets (morning/afternoon/tonight/tomorrow) not a countdown timer — per CONTEXT.md spec"

patterns-established:
  - "iOS video synchronous handler: module-level flag + refs array forEach in onClick, no async boundary"
  - "Preload pattern: next N videos as 1px fixed visibility:hidden elements"
  - "Scroll position tracking via onBecomeActive IntersectionObserver callbacks, not scroll events"

requirements-completed:
  - PLAY-03
  - PLAY-04
  - PLAY-05

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 3 Plan 3: Interactive Feed Layer Summary

**iOS-safe synchronous unmute, next-2-video preloading, progress dots overlay, and EndCard with time estimate + Watch again + silent edition refresh**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T18:33:43Z
- **Completed:** 2026-02-25T18:36:27Z
- **Tasks:** 3
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments

- iOS-safe unmute: `handleMuteToggle` in VideoFeed sets `globalMuted` + all `videoRefs.current.forEach(ref => ref.current.muted = newMuted)` synchronously in one onClick call stack — no async boundary
- `isMutedRef` pattern in `useVideoPlayer` replaces stale closure dep — IntersectionObserver created once, always reads current muted value
- Progress dots (Instagram Stories pill style, 6px inactive / 20px active) centered at top safe-area, update via `onBecomeActive` scroll tracking
- Next 2 videos rendered as 1px fixed `visibility:hidden` elements for iOS buffering
- EndCard with `getNextEditionMessage()` (hour-of-day buckets), Watch again (reset to index 0, scroll to top, no page reload), silent new-edition detection on mount

## Task Commits

Each task was committed atomically:

1. **Task 1: iOS-safe synchronous unmute handler + isMutedRef pattern** - `d3754fa` (feat)
2. **Task 2: Preloading next 2 videos + progress dots + VideoFeed/VideoItem updates** - `8f09898` (feat)
3. **Task 3: EndCard with time estimate + Watch again + silent edition refresh** - `3180ec8` (feat)

## Files Created/Modified

- `frontend/components/VideoFeed.tsx` — module-level `globalMuted`, videoRefs array, `handleMuteToggle` (synchronous), screen-tap restore, progress dots, preloadOnly mapping, EndCard wiring
- `frontend/components/VideoItem.tsx` — `preloadOnly` prop (1px fixed visibility:hidden), `videoRefOverride` prop, `isActive`/`onBecomeActive` props, conditional headline overlay
- `frontend/components/MuteButton.tsx` — `prominent` prop for screen-tap opacity restore
- `frontend/hooks/useVideoPlayer.ts` — `isMutedRef` pattern, `onBecomeActive` callback parameter, empty deps array (observer created once)
- `frontend/components/EndCard.tsx` — created: "You're up to date" screen, `getNextEditionMessage()`, Watch again button, silent edition poll on mount
- `frontend/app/page.tsx` — passes `editionId` to VideoFeed

## Decisions Made

- `globalMuted` as module-level `let` (not React state) — IntersectionObserver callbacks run outside React's render cycle and cannot reliably read stale closures
- `isMutedRef` in `useVideoPlayer` with empty deps — observer created once, reads `isMutedRef.current` dynamically instead of re-attaching on every mute toggle
- Preload via `1px fixed visibility:hidden` (not `display:none`) — iOS buffers elements it considers on-screen; `display:none` prevents buffering
- Progress dots: pill-shaped bars (6px → 20px active) not circles — matches Instagram Stories style per CONTEXT.md
- EndCard new-edition detection triggers `window.location.reload()` — user on end card won't notice; cleanest way to get fresh SSR data
- `getNextEditionMessage` uses hour-of-day buckets not countdown timer — per CONTEXT.md spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript RefObject generic type mismatch**
- **Found during:** Task 1 (TypeScript build check)
- **Issue:** `React.createRef<HTMLVideoElement>()` returns `RefObject<HTMLVideoElement | null>` in newer React types; type annotation used `RefObject<HTMLVideoElement>` causing build failure
- **Fix:** Updated `videoRefs` type to `RefObject<HTMLVideoElement | null>[]` and `videoRefOverride` prop type to match
- **Files modified:** `frontend/components/VideoFeed.tsx`, `frontend/components/VideoItem.tsx`
- **Verification:** Build passes with 0 TypeScript errors
- **Committed in:** `8f09898` (Task 2 commit, part of VideoFeed/VideoItem changes)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Necessary type fix for newer React types. No scope creep.

## Issues Encountered

None beyond the TypeScript type fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Core user journey is complete: vertical feed, play/pause, unmute, progress tracking, end card
- iOS synchronous unmute handler ready; real-device testing deferred to Phase 6 (noted in STATE.md blockers)
- Phase 4 (PWA) can now add manifest, service worker, and offline caching on top of this complete feed

---
*Phase: 03-frontend*
*Completed: 2026-02-25*

## Self-Check: PASSED

All 6 files found on disk. All 3 task commits verified in git history.
