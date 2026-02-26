---
phase: 03-frontend
plan: 02
subsystem: ui
tags: [nextjs, react, typescript, video, intersection-observer, pwa, ios, safari]

# Dependency graph
requires:
  - phase: 03-01
    provides: .feed-container/.feed-item CSS classes, Video/Edition types from useEdition, page.tsx Server Component scaffold
provides:
  - VideoFeed scroll container with isMuted/activeIndex state, CSS scroll-snap feed layout
  - VideoItem with all iOS-required video attributes (autoPlay, muted, playsInline, preload=auto, #t=0.001 fragment)
  - useVideoPlayer IntersectionObserver hook (0.7 threshold) for play/pause per item
  - MuteButton fixed top-right circular icon button with safe-area-inset-top and opacity transition
  - page.tsx updated to render VideoFeed with videos from /api/today
affects:
  - 03-03 (MuteButton sync handler, progress dots, preloading build on this scaffold)
  - 03-04 (PWA manifest references layout established in 03-01, components from this plan)
  - 03-05 (EndCard replaces showEndCard placeholder added here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - IntersectionObserver at 0.7 threshold for video play/pause — no scroll event listeners
    - isMuted in useEffect deps to re-run observer with current muted value on toggle
    - '#t=0.001 fragment on src forces iOS Safari to decode first frame as poster
    - env(safe-area-inset-top/bottom) in inline styles for iPhone notch/home indicator clearance
    - opacity transition on MuteButton: 1.0 (muted/prominent) vs 0.45 (unmuted/subtle)

key-files:
  created:
    - frontend/components/VideoFeed.tsx
    - frontend/components/VideoItem.tsx
    - frontend/components/MuteButton.tsx
    - frontend/hooks/useVideoPlayer.ts
  modified:
    - frontend/app/page.tsx

key-decisions:
  - "VideoItem keeps 'muted' as JSX prop (initial DOM attribute); useVideoPlayer sets video.muted dynamically on intersection — two-layer muted sync"
  - "isMuted in useEffect deps — re-attaches observer with new value when parent toggles mute, ensuring next video starts with correct state"
  - "threshold: 0.7 on IntersectionObserver — video must be 70% visible before playing, standard for vertical feed UX"
  - "MuteButton uses inline styles (not Tailwind) for fixed positioning — avoids Tailwind purge risks with dynamic z-index values"
  - "showEndCard placeholder in VideoFeed — minimal end state for this plan, replaced in Plan 03"

patterns-established:
  - "Client component pattern: 'use client' on all components using refs/state/effects (VideoFeed, VideoItem, MuteButton)"
  - "Hook-per-item pattern: each VideoItem gets its own useVideoPlayer instance with its own containerRef/videoRef/observer"
  - "Prop drilling for isMuted: VideoFeed owns state, passes down to VideoItem, VideoItem passes to useVideoPlayer"

requirements-completed: [PLAY-01, PLAY-02]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 3 Plan 02: Feed Scaffold Summary

**Full-screen snap-scroll video feed with IntersectionObserver-based muted autoplay: VideoFeed container, VideoItem with iOS video attributes (#t=0.001, playsInline), useVideoPlayer hook at 0.7 threshold, and MuteButton corner icon with opacity transition**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-25T18:28:29Z
- **Completed:** 2026-02-25T18:30:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- VideoFeed.tsx and VideoItem.tsx created with 'use client' boundary; VideoFeed owns isMuted/activeIndex state and maps videos to VideoItem components with snap-scroll .feed-container layout
- VideoItem renders video element with all four iOS-required attributes (autoPlay, muted, playsInline, preload="auto") plus #t=0.001 src fragment for first-frame decode on iOS Safari; headline overlay uses env(safe-area-inset-bottom) for home indicator clearance
- useVideoPlayer hook creates per-item IntersectionObserver at 0.7 threshold; isMuted in deps ensures muted state is synced when parent toggles
- MuteButton fixed at top-right with env(safe-area-inset-top), SVG icons for muted/unmuted, opacity 1.0/0.45 transition, and backdrop blur
- page.tsx updated to import VideoFeed and render it with typed videos[] prop; build passes with 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VideoFeed and VideoItem components** - `edf5c15` (feat)
2. **Task 2: Create useVideoPlayer hook and MuteButton component** - `a56a503` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/components/VideoFeed.tsx` - Scroll container: isMuted/activeIndex state, MuteButton + VideoItem rendering, empty state, EndCard placeholder
- `frontend/components/VideoItem.tsx` - Single video screen: iOS video attrs, #t=0.001 fragment, headline overlay with safe-area padding
- `frontend/components/MuteButton.tsx` - Fixed top-right circular button: SVG icons, safe-area-inset-top, opacity transition
- `frontend/hooks/useVideoPlayer.ts` - IntersectionObserver per item at 0.7 threshold, returns containerRef/videoRef
- `frontend/app/page.tsx` - Updated to render VideoFeed with videos prop from /api/today

## Decisions Made

- VideoItem keeps `muted` as JSX prop for initial DOM attribute; useVideoPlayer additionally sets `video.muted = isMuted` dynamically on intersection entry — two-layer muted sync handles both first load and post-toggle scenarios
- `isMuted` placed in `useEffect` deps so the observer re-attaches with the current muted value whenever the parent toggles; the synchronous tap handler (Plan 03) handles the currently-playing video directly
- MuteButton uses inline styles for `position: fixed` and z-index rather than Tailwind classes — avoids Tailwind content scanning edge cases with dynamic values
- `showEndCard` is a minimal boolean flag rendering a "You're up to date" overlay; Plan 03 replaces this with the full EndCard component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VideoFeed and VideoItem scaffold is ready for Plan 03 to add: progress dots, preloading logic, synchronous unmute tap handler (required for iOS Safari), and re-mute-on-tap behavior
- MuteButton is wired to VideoFeed state; Plan 03 adds the ref-based synchronous `.muted` setter for iOS
- EndCard placeholder (`showEndCard`) is the hook point for Plan 03/05 EndCard component
- Build is clean with 0 TypeScript errors; feed scaffold is functional

---
*Phase: 03-frontend*
*Completed: 2026-02-25*

## Self-Check: PASSED

- frontend/components/VideoFeed.tsx: FOUND
- frontend/components/VideoItem.tsx: FOUND
- frontend/components/MuteButton.tsx: FOUND
- frontend/hooks/useVideoPlayer.ts: FOUND
- .planning/phases/03-frontend/03-02-SUMMARY.md: FOUND
- commit edf5c15: FOUND
- commit a56a503: FOUND
