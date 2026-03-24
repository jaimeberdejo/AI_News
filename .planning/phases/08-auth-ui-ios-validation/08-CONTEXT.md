# Phase 8: Auth UI + iOS Validation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the sign-in bottom sheet that appears only when a guest taps a social action (like, bookmark, comment). Guests browse freely with zero friction. Validate the full flow on a real iOS device with PWA installed. Creating the actual social action functionality (likes, bookmarks) is Phase 9 — this phase only handles the auth prompt surface and iOS confirmation.

</domain>

<decisions>
## Implementation Decisions

### Bottom Sheet Design
- Slides up over the video with a semi-transparent dark overlay behind it
- Half-screen height (~50% of viewport)
- Drag handle (pill) at the top — swipe down or tap overlay to dismiss
- Contextual headline that changes based on the action tapped (e.g. "Sign in to like this", "Sign in to bookmark")
- No supporting copy or value prop — just the headline and the sign-in button

### Sign-in Options
- Google only — single "Continue with Google" button
- Official Google branding (white button with Google logo)
- No email/password form in this phase

### Post-auth Return Behavior
- After sign-in, sheet closes and user returns to exactly the same video they were watching
- No automatic action completion — user taps the social button again (now signed in)
- No toast or visual feedback — silent success, signed-in state speaks for itself

### Guest Experience
- Social action buttons (like, bookmark, comment) are fully visible to guests
- Tapping any social button triggers the sign-in bottom sheet
- Zero other prompts — no banners, no nudges, no engagement-gated prompts
- Like counts and social counts are visible to guests (feels alive)

### Claude's Discretion
- Exact overlay opacity and animation timing
- Sheet corner radius and shadow
- Spacing and typography inside the sheet
- How the "same video" scroll position is preserved across the OAuth redirect

</decisions>

<specifics>
## Specific Ideas

- The prompt must feel non-blocking — user can always dismiss and keep watching
- iOS PWA compatibility is a hard requirement: OAuth must use `window.location.href` (not `window.open`) per the pattern established in Phase 7 Server Actions

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-auth-ui-ios-validation*
*Context gathered: 2026-03-24*
