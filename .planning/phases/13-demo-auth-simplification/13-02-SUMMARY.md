---
phase: 13-demo-auth-simplification
plan: 02
subsystem: auth
tags: [supabase, next.js, react, registration, email-auth]

# Dependency graph
requires:
  - phase: 13-01
    provides: tabbed /auth/login page with register tab as default, signUp redirect to '/'
  - phase: 08-01
    provides: AuthBottomSheet component with Google OAuth gate for guest social actions
provides:
  - "Create account link in AuthBottomSheet below Google button navigating to /auth/login"
  - "Supabase email confirmation disabled — new registrations create session immediately"
  - "Full frictionless demo registration path: guest → AuthBottomSheet → /auth/login (register tab) → authenticated"
affects: [auth, registration, demo-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain <a href> anchor for cross-page navigation in AuthBottomSheet (no next/link import)"
    - "Supabase Auth > Email provider 'Confirm email' toggle OFF for demo flows"

key-files:
  created: []
  modified:
    - frontend/components/AuthBottomSheet.tsx

key-decisions:
  - "Plain <a href='/auth/login'> anchor over next/link — AuthBottomSheet doesn't import next/link; full-page navigation preferred for auth routes"
  - "Supabase 'Confirm email' toggle disabled project-wide — demo users get immediate session after signUp; note: re-enabling requires updating signUp action to return { message } instead of redirect('/')"

patterns-established:
  - "Auth surface completeness: every guest-gate surface (bottom sheet + navbar) exposes both OAuth and email registration paths"

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-04-07
---

# Phase 13 Plan 02: Demo Auth Simplification Summary

**"Create account" link added to AuthBottomSheet and Supabase email confirmation disabled — completes the frictionless demo registration path from video feed social action gate to authenticated user**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-07
- **Completed:** 2026-04-07
- **Tasks:** 2
- **Files modified:** 1 (+ Supabase dashboard configuration)

## Accomplishments
- Added "Create account" plain anchor link below the Google button in AuthBottomSheet, navigating to /auth/login (which defaults to the Register tab from Plan 01)
- Disabled Supabase "Confirm email" toggle — new email registrations now get an immediate session, making redirect('/') in the signUp action land the user as fully authenticated
- Closed the second registration surface gap: guests hitting social action gate (like/bookmark/comment) now have an email registration path in addition to Google OAuth

## Task Commits

Each task was committed atomically:

1. **Task 1: Add "Create account" link to AuthBottomSheet** - `832be83` (feat)
2. **Task 2: Disable email confirmation in Supabase dashboard** - human action (no code commit)

**Plan metadata:** `(docs commit — see below)`

## Files Created/Modified
- `frontend/components/AuthBottomSheet.tsx` - Added `<a href="/auth/login">Create account</a>` anchor below Google sign-in button with muted white styling

## Decisions Made
- Used a plain `<a href>` anchor rather than Next.js `<Link>` — AuthBottomSheet does not import next/link and the auth login route benefits from full-page navigation; keeps the pattern consistent with existing `window.location.href` usage in the same component
- Supabase "Confirm email" disabled at project level — demo-appropriate trade-off; if re-enabled in the future the signUp Server Action must be updated to return `{ message }` instead of calling `redirect('/')`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
**External service configuration completed by human during plan execution:**
- Supabase dashboard: Authentication > Providers > Email > "Confirm email" toggle set to OFF and saved
- This is required for the signUp `redirect('/')` flow to land users as authenticated (not guest)

## Next Phase Readiness
- Phase 13 complete — full demo registration flow is operational: guest → social action gate → AuthBottomSheet → "Create account" → /auth/login (Register tab) → authenticated user at '/'
- Google OAuth path in AuthBottomSheet is unchanged and continues to work
- No blockers for next phase

---
*Phase: 13-demo-auth-simplification*
*Completed: 2026-04-07*
