---
phase: 13-demo-auth-simplification
plan: 01
subsystem: auth
tags: [supabase, nextjs, react, server-actions, forms]

# Dependency graph
requires:
  - phase: 07-auth-infrastructure
    provides: signInWithGoogle action, createClient server helper, auth actions pattern
  - phase: 08-auth-ui-ios-validation
    provides: window.location.href OAuth pattern, iOS PWA fix
provides:
  - Tabbed /auth/login page with Sign In (Google) and Register (email/password) tabs
  - signUp Server Action that redirects to '/' on success (no email confirmation gate)
affects: [13-02-PLAN, demo-flow, auth-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Client-side password validation before calling Server Action (length + match checks)
    - Tab switcher with inline pill-button styles, state-driven active/inactive styling
    - signUp calls redirect('/') — requires Supabase dashboard "Confirm email" disabled (Plan 02)

key-files:
  created: []
  modified:
    - frontend/app/auth/actions.ts
    - frontend/app/auth/login/page.tsx

key-decisions:
  - "signUp calls redirect('/') not return { message } — demo users land in app immediately after registration"
  - "Default tab is 'register' (not 'signin') — optimises for demo UX where new users register first"
  - "No display name field in registration form — email-signup users get null display_name; existing 'Anonymous' fallbacks apply"
  - "emailRedirectTo preserved in signUp even though confirmation is disabled — acts as fallback if confirmation is re-enabled"
  - "Google OAuth handler untouched (window.location.href, signInWithGoogle('/profile')) — iOS PWA fix preserved"

patterns-established:
  - "Client-side validation before Server Action: validate then setPending(true), catch errors from action to display inline"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-04-07
---

# Phase 13 Plan 01: Demo Auth Simplification Summary

**Tabbed /auth/login page with email/password Register tab and signUp action that redirects directly to '/' — removes email confirmation gate for demo users**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-07T17:22:07Z
- **Completed:** 2026-04-07T17:23:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- signUp Server Action now calls `redirect('/')` on success instead of returning a "check your email" message
- /auth/login converted from single-purpose Google button to two-tab UI (Sign in / Create account)
- Register tab validates passwords client-side (8+ chars, matching confirm) before calling Server Action
- Google OAuth tab completely preserved including iOS PWA window.location.href fix
- TypeScript compilation and Next.js production build both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify signUp action to redirect to '/' on success** - `e4c5827` (feat)
2. **Task 2: Convert /auth/login page to tabbed Sign In + Register UI** - `471b5a6` (feat)

## Files Created/Modified
- `frontend/app/auth/actions.ts` - signUp function now calls redirect('/') instead of returning check-email message
- `frontend/app/auth/login/page.tsx` - Rewritten as two-tab Client Component; Register tab defaults active for demo UX

## Decisions Made
- Default tab is `register` (not `signin`) so demo users land directly on registration — avoids confusion for new users
- No display name field per plan decision — existing "Anonymous" fallbacks handle null display_name
- `emailRedirectTo` kept in signUp as a fallback even though email confirmation will be disabled in Supabase dashboard (Plan 02)
- Google OAuth handler is byte-for-byte identical to original — no regression risk on iOS PWA flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None for this plan. Plan 02 requires disabling "Confirm email" in the Supabase dashboard — that is the required companion step for `redirect('/')` to land the user with an active session.

## Next Phase Readiness
- Actions.ts and login page ready; full demo flow requires Plan 02 (disable Supabase email confirmation in dashboard)
- Without Plan 02, signUp will succeed but Supabase returns a session-less response and redirect('/') lands the user as a guest

---
*Phase: 13-demo-auth-simplification*
*Completed: 2026-04-07*

## Self-Check: PASSED

- FOUND: frontend/app/auth/actions.ts
- FOUND: frontend/app/auth/login/page.tsx
- FOUND: .planning/phases/13-demo-auth-simplification/13-01-SUMMARY.md
- FOUND commit: e4c5827 (Task 1)
- FOUND commit: 471b5a6 (Task 2)
