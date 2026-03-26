---
phase: 12-mobile-ui
plan: 01
subsystem: ui
tags: [react, next.js, mobile, ios, safe-area, tiktok-layout, css]

# Dependency graph
requires:
  - phase: 11-profile-page
    provides: VideoItem with social actions, TabBar component
provides:
  - Full-screen video overlay layout for VideoItem (TikTok-style)
  - Right-rail vertical social button column (like/bookmark/comment)
  - TabBar with correct calc(56px + env(safe-area-inset-bottom)) height
affects: [12-mobile-ui future plans, any plan referencing VideoItem or TabBar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Absolute overlay pattern: position:relative root + position:absolute children for full-screen video UX
    - Safe-area calc pattern: calc(56px + env(safe-area-inset-bottom)) for components that must clear notch/home-indicator
    - Right-rail column: flexDirection column, right-anchored, bottom offset clearing TabBar + safe area

key-files:
  created: []
  modified:
    - frontend/components/VideoItem.tsx
    - frontend/components/TabBar.tsx

key-decisions:
  - "VideoItem root div gets position:relative — feed-item CSS class controls snap height, overlay anchoring is separate concern"
  - "Bottom overlay right:72px clears 60px rail width + 12px gutter without hard-coding icon sizes"
  - "Right-rail bottom: calc(env(safe-area-inset-bottom) + 56px + 80px) provides breathing room above TabBar"
  - "Bookmark button has no count (private action) — consistent with Phase 9 design decision"

patterns-established:
  - "Full-screen video overlay: video at inset:0 absolute, overlays at zIndex:10, root position:relative"
  - "Safe-area-aware height: calc(56px + env(safe-area-inset-bottom)) pattern for fixed bars"

requirements-completed: [MOB-01, MOB-02, MOB-04]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 12 Plan 01: Mobile UI Full-Screen Video Layout Summary

**Full-screen TikTok-style VideoItem with right-rail social column and safe-area-correct TabBar height**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T00:12:12Z
- **Completed:** 2026-03-26T00:14:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Converted VideoItem from flex-column (video + info panel below) to full-screen overlay layout — video fills 100dvh with no panel below
- Moved social buttons from horizontal info-panel row to right-rail vertical column (like at top, bookmark middle, comment bottom) with counts below like and comment icons
- Added bottom-left gradient overlay (right:72px clearance) showing date, headline, and "Leer articulo completo" link
- Fixed TabBar height from static `56px` to `calc(56px + env(safe-area-inset-bottom))` so icons are never clipped on iPhone 14+ home indicator devices

## Task Commits

1. **Task 1: Fix TabBar safe-area height** - `baf0df3` (fix)
2. **Task 2: Convert VideoItem to full-screen overlay layout** - `6c40379` (feat)

## Files Created/Modified

- `frontend/components/TabBar.tsx` - Changed height to `calc(56px + env(safe-area-inset-bottom))` to correctly allocate space on notch devices
- `frontend/components/VideoItem.tsx` - Full rewrite: video at inset:0, bottom overlay with gradient, right-rail social column; VideoItemProps interface and all onSocialAction callbacks unchanged

## Decisions Made

- VideoItem root keeps `className="feed-item"` unchanged — CSS class owns scroll-snap and height:100dvh; only `position:relative` was added to anchor overlays
- Right overlay `right: 72px` — generous clearance (60px icon area + 12px gutter) ensures no overlap regardless of font scale
- Right-rail `bottom: calc(env(safe-area-inset-bottom) + 56px + 80px)` — 80px extra breathing room so the column sits comfortably above the TabBar
- Bookmark button intentionally has no count — private action, consistent with Phase 9 architecture decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled clean on both tasks with 0 errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full-screen video layout complete; ready for Phase 12-02 (category tab bar redesign)
- TabBar height fix in place — future overlay bottom-clearing calculations can rely on `calc(env(safe-area-inset-bottom) + 56px + N)` pattern

---
*Phase: 12-mobile-ui*
*Completed: 2026-03-26*
