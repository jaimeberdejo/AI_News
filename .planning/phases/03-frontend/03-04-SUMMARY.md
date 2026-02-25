---
phase: 03-frontend
plan: "04"
subsystem: ui
tags: [nextjs, pwa, manifest, ios, typescript]

# Dependency graph
requires:
  - phase: 03-03
    provides: Complete feed UX (VideoFeed, VideoItem, useVideoPlayer, MuteButton, EndCard, progress dots, iOS-safe unmute)

provides:
  - Next.js manifest.ts generating /manifest.webmanifest with name FinFeed, display standalone, portrait orientation
  - 192x192 PNG icon at /icon-192x192.png (purpose: any)
  - 512x512 PNG icon at /icon-512x512.png (purpose: maskable for Android adaptive icons)
  - appleWebApp metadata in layout.tsx (capable: true, statusBarStyle: black-translucent)
  - PWA installability on iOS Safari via Add to Home Screen

affects:
  - 04-pwa (service worker, offline caching)
  - 06-testing (PWA installability tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js App Router manifest.ts: MetadataRoute.Manifest generates /manifest.webmanifest without any plugin"
    - "sharp (Next.js transitive dep) for one-time icon generation via SVG → PNG"

key-files:
  created:
    - frontend/app/manifest.ts
    - frontend/public/icon-192x192.png
    - frontend/public/icon-512x512.png
  modified:
    - frontend/app/layout.tsx

key-decisions:
  - "Next.js MetadataRoute.Manifest used instead of next-pwa or static JSON — native App Router approach, no plugin overhead"
  - "sharp (already a Next.js transitive dep) used for icon generation — avoids adding new dependencies for placeholder icons"
  - "purpose: maskable on 512x512 icon — enables Android adaptive icon masking; 192x192 uses purpose: any"
  - "appleWebApp.statusBarStyle: black-translucent — status bar overlays content (correct for full-screen dark video UI)"

patterns-established:
  - "PWA manifest pattern: app/manifest.ts returns MetadataRoute.Manifest; Next.js auto-exposes /manifest.webmanifest"

requirements-completed:
  - PWA-01

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 3 Plan 4: PWA Manifest and Installability Summary

**Next.js MetadataRoute.Manifest generating /manifest.webmanifest (display: standalone) with 192x192 and 512x512 PNG icons and iOS appleWebApp metadata for Add to Home Screen installability**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T18:39:01Z
- **Completed:** 2026-02-25T18:42:00Z
- **Tasks:** 1 of 2 (Task 2 is human verification checkpoint — awaiting user approval)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `manifest.ts` uses `MetadataRoute.Manifest` — Next.js App Router natively generates `/manifest.webmanifest` with correct JSON (name, short_name, start_url, display: standalone, background_color, theme_color, orientation, icons)
- `layout.tsx` updated with `appleWebApp.capable: true` and `appleWebApp.statusBarStyle: 'black-translucent'` + manifest link — enables iOS standalone mode
- `icon-192x192.png` and `icon-512x512.png` generated using sharp (Next.js transitive dep) from SVG source — black background with white F lettermark
- Build passes 0 TypeScript errors; `/manifest.webmanifest` confirmed in `.next` static build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create manifest.ts, update layout.tsx with appleWebApp metadata, generate placeholder icons** - `6e79c95` (feat)
2. **Task 2: Verify complete Phase 3 feed and PWA installability** - PENDING (checkpoint awaiting human verification)

## Files Created/Modified

- `frontend/app/manifest.ts` — Next.js MetadataRoute.Manifest returning FinFeed PWA configuration
- `frontend/app/layout.tsx` — added manifest link, appleWebApp.capable, appleWebApp.statusBarStyle
- `frontend/public/icon-192x192.png` — 192x192 black PNG with white F (purpose: any)
- `frontend/public/icon-512x512.png` — 512x512 black PNG with white F (purpose: maskable)

## Decisions Made

- Used `MetadataRoute.Manifest` (native Next.js) instead of `next-pwa` — no plugin overhead, native App Router approach
- Used `sharp` (already installed as Next.js transitive dep) for icon generation — avoids new dependencies for placeholder icons
- `purpose: 'maskable'` on 512x512, `purpose: 'any'` on 192x192 — standard PWA manifest pattern for Android adaptive icons
- `statusBarStyle: 'black-translucent'` in appleWebApp — status bar overlays app content (correct for full-screen dark video UI)

## Deviations from Plan

None - plan executed exactly as written. `sharp` was the first-priority approach (confirmed available in node_modules) so the ffmpeg fallback was not needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PWA manifest and icons in place
- iOS appleWebApp metadata set — Add to Home Screen available on iOS Safari
- Awaiting human verification checkpoint (Task 2) to confirm complete Phase 3 UX: autoplay, unmute, scroll snap, preloading, progress dots, headline, end card, and PWA installability
- After checkpoint approval, Phase 3 (all 6 requirements: PLAY-01 through PLAY-05 + PWA-01) will be complete

---
*Phase: 03-frontend*
*Completed: 2026-02-25*

## Self-Check: PASSED

Files verified:
- frontend/app/manifest.ts: FOUND
- frontend/app/layout.tsx: FOUND (modified)
- frontend/public/icon-192x192.png: FOUND (192x192 PNG)
- frontend/public/icon-512x512.png: FOUND (512x512 PNG)

Commit verified:
- 6e79c95: FOUND in git history
