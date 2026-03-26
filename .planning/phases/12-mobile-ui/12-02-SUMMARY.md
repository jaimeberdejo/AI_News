---
phase: 12-mobile-ui
plan: 02
subsystem: frontend-ui
tags: [mobile, category-bar, css-variables, scroll-snap, progress-dots, flex-layout]
dependency_graph:
  requires: [12-01-PLAN.md]
  provides: [solid-category-tab-bar, correct-snap-heights, vertical-progress-dots]
  affects: [frontend/components/VideoFeed.tsx, frontend/app/globals.css]
tech_stack:
  added: []
  patterns: [CSS custom properties, flex column layout, CSS calc with env() and var()]
key_files:
  created: []
  modified:
    - frontend/app/globals.css
    - frontend/components/VideoFeed.tsx
decisions:
  - "[12-02]: --category-bar-height: 44px CSS variable in :root — single source of truth for both feed-container and feed-item height calc"
  - "[12-02]: Tab bar as real flex child (not absolutely positioned) — occupies physical space so feed-container starts below it without overlap"
  - "[12-02]: Progress dots right:12px top:16px vertical column — clears top-center for edition nav; top is relative to feed-container not viewport"
  - "[12-02]: Mute button top:12px (was calc(safe-area + 90px)) — simple value relative to feed-container top edge now that tab bar is a real flex child"
metrics:
  duration: 92s
  completed: 2026-03-26
  tasks_completed: 2
  files_modified: 2
---

# Phase 12 Plan 02: Solid Category Tab Bar + Vertical Progress Dots Summary

Replaced the floating gradient-backed category pill buttons with a solid opaque horizontally-scrollable tab bar that occupies real vertical space above the video feed. Updated feed heights via a CSS variable so scroll-snap math remains correct. Moved progress dots from horizontal top-center to a vertical right-edge column.

## CSS Variable Approach (globals.css)

Added `:root { --category-bar-height: 44px; }` as the single source of truth for the category bar height. Both `.feed-container` and `.feed-item` heights were updated from `100dvh` to `calc(100dvh - env(safe-area-inset-top) - var(--category-bar-height))`. This is the critical invariant: if both values match, scroll-snap index tracking via `Math.round(scrollTop / clientHeight)` remains correct.

## VideoFeed Structural Changes

**Flex column layout:** The outer wrapper gained `display: flex; flexDirection: column`. This makes the tab bar and feed-container real siblings in the document flow rather than overlapping positioned elements.

**Solid tab bar:** Replaced the gradient overlay with a `flexShrink: 0` flex child. Height is `calc(44px + env(safe-area-inset-top))` — accommodates iPhone notch/Dynamic Island. Background is solid `#000`. Active tab has `2px solid white` bottom border; inactive tabs show `#888` text with transparent border. Tab bar scrolls horizontally via `overflowX: auto` with scrollbar hidden in both Firefox (`scrollbarWidth: none`) and WebKit (`<style>` tag with `::-webkit-scrollbar { display: none }`). The `tabScrollState` ref and `switchCategory` logic are untouched.

**Edition nav bar:** `paddingTop` reduced from `calc(env(safe-area-inset-top) + 50px)` to `8px`. The tab bar now physically occupies the top space so no safe-area offset is needed for the edition nav overlay.

**Vertical progress dots:** Replaced horizontal dots (left:50%, transform translateX(-50%), width-based active indicator) with a vertical column at `right: 12px, top: 16px`. Active dot is `width: 3px, height: 20px`; inactive is `width: 3px, height: 6px`. Transition is on `height` instead of `width`. The `top: 16px` is relative to the feed-container top (below the solid tab bar in the flex column), so no safe-area offset is needed.

**Mute button:** Simplified from `calc(env(safe-area-inset-top) + 90px)` to `top: '12px'` — relative to feed-container top.

**feed-container:** Added `style={{ flex: 1 }}` so it fills all remaining height in the flex column. The CSS class still controls scroll behavior and the snap height calc.

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Compilation

`npx tsc --noEmit` exits with 0 errors.

## Self-Check: PASSED

Files verified:
- FOUND: frontend/app/globals.css (3 matches for category-bar-height: :root, .feed-container, .feed-item)
- FOUND: frontend/components/VideoFeed.tsx (solid tab bar, vertical dots, flex layout, mute top:12px, feed-container flex:1)

Commits verified:
- 1656bb2: feat(12-02): add --category-bar-height CSS variable and update feed heights
- 9a94a12: feat(12-02): solid tab bar, vertical progress dots, flex column layout
