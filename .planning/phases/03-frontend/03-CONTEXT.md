# Phase 3: Frontend - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Next.js PWA delivers today's videos in a finite vertical scroll feed — muted autoplay, tap-to-unmute persisting across videos, preloading, "You're up to date" end card, and PWA installability. Creating videos, pipeline automation, and deployment are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Feed chrome & visual design
- Screen fill: Claude's discretion — full-bleed or safe-area-respecting, pick what's right for a mobile video feed PWA
- Progress indicator: Progress dots overlaid on screen — 5 dots, filled dot = current video
- Subtitles: Always shown — burned into the video by the pipeline (no frontend rendering needed)
- Headline overlay: Story headline shown as a text overlay at the bottom of the video

### Tap-to-unmute UX
- Prompt location: Top corner icon (small mute icon, minimal — like TikTok)
- After unmute: Icon fades to subtle in the corner; becomes prominent again when user taps the screen
- Persistence: Unmuted state persists for all subsequent videos in the session; resets to muted on app reopen
- Visual feedback on unmute: Claude's discretion

### End card design
- Visual style: Minimal — dark screen, "You're up to date" message, approximate time estimate (no ticking timer)
- Time estimate: Human-readable approximation — "Check back tonight" or "Check back tomorrow morning" (not a countdown timer)
- Action: "Watch again" replay button — restarts feed from video 1 without reloading the page
- New edition detection: If a new edition is available when user reaches end card, silently auto-refresh the feed

### Loading & empty states
- Initial load: Claude's discretion — pick the right pattern for a Next.js PWA (prefer fast first paint)
- No videos today: Claude's discretion — pick sensible fallback (e.g., show most recent available edition)
- Single video failure mid-feed: Skip silently, auto-advance to next video — no error shown to user
- Offline behavior: Claude's discretion — follow the roadmap's app-shell-only service worker spec

### Claude's Discretion
- Screen fill approach (full-bleed vs safe-area-respecting)
- Visual feedback animation when unmuting
- Initial load state/skeleton implementation
- Fallback when today's edition is unavailable
- Offline error handling
- Icon styling and exact positioning

</decisions>

<specifics>
## Specific Ideas

- Progress dots should feel like story dots (Instagram Stories style) — small, subtle, overlaid
- Mute icon should be corner-positioned and unobtrusive, not a prominent CTA
- End card message should be human and casual: "You're up to date" + "Check back tonight" — not formal or dashboard-like
- "Watch again" should restart in-place (no page reload) and feel smooth

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-frontend*
*Context gathered: 2026-02-25*
