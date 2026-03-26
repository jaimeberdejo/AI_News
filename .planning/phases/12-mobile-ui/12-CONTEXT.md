# Phase 12: Mobile UI - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the mobile layout to be TikTok-style: full-screen video with overlaid UI, right-rail social actions, scalable horizontal category tabs, and a polished fixed tab bar. Also fix the profile page (black thumbnails, grid not filling screen, content clipped behind tab bar). No new features — this phase is a UI overhaul of existing functionality.

</domain>

<decisions>
## Implementation Decisions

### Video layout
- Video fills the entire viewport (100vh) — full-screen, no info panel below
- Title and "Read article" link always visible, overlaid at bottom-left with a subtle gradient behind them for readability
- Edition nav (← Anterior / Hoy 12:46 / Siguiente →) stays overlaid at the top, just below the category tab bar
- Progress dots move from top-center to a vertical column on the right edge of the video (Instagram Stories-style)
- Mute button stays at top-right corner

### Social buttons
- Like, bookmark, comment move to a right-side vertical stack overlaid on the video (TikTok-style)
- Count displayed below each icon
- No creator avatar slot — content is AI-generated, rail starts directly with like button
- Order: like → bookmark → comment (top to bottom)

### Category navigation
- Replace floating Finance/Tech pills with a horizontally scrollable tab bar in a solid bar above the video
- Active category indicated by underline
- Design must scale to many categories (Finance, Tech, Sports, Science, Politics…) — users scroll the tab bar left/right to access more
- Scroll position per category is preserved when switching (existing tabScrollState behaviour extended to new tab bar)
- Video starts below the category bar — no overlap

### Tab bar
- Keep 2 tabs: Home + Profile
- Opaque dark background (no transparency or blur)
- Active tab: filled icon + white label. Inactive: outline icon + gray label
- Fix safe area handling so icons and labels are never cut off on iPhone notch/home indicator

### Profile page
- Fix both thumbnail loading AND grid filling the full screen
- Thumbnails: pipeline generates a thumbnail image at upload time, stores URL in DB, served from Supabase Storage — grid uses `<img>` instead of `<video>` for reliability on iOS
- Layout: traditional scrollable page (not full-screen video context)
- Header (avatar, name, edit button) scrolls away on scroll; Liked/Saved tab bar sticks to top
- Content area must clear the floating bottom tab bar (paddingBottom)

### Claude's Discretion
- Gradient opacity/height behind bottom overlay text
- Exact spacing of right-rail action buttons
- Animation/transition when switching categories
- Thumbnail generation timing in the pipeline (at assembly or upload step)

</decisions>

<specifics>
## Specific Ideas

- Reference: TikTok's "For You / Following" scrollable top tab bar — same pattern for Finance/Tech/Sports
- Reference: TikTok right-rail action column (like, comment, share) — same vertical layout
- The two screenshots provided show: video not filling screen, tab bar icons cut off, profile grid with black thumbnails and large empty space below grid. All three must be resolved.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-mobile-ui*
*Context gathered: 2026-03-26*
