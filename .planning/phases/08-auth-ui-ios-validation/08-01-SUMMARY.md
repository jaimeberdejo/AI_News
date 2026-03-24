---
phase: 08-auth-ui-ios-validation
plan: 01
subsystem: auth
tags: [react, supabase, oauth, ios-pwa, bottom-sheet, typescript]

# Dependency graph
requires:
  - phase: 07-auth-infrastructure
    provides: signInWithGoogle Server Action returning { url }, /auth/callback route with ?next= param, createBrowserClient in lib/supabase/client.ts

provides:
  - useAuth hook with { user, isGuest, loading } shape for client-side auth state detection
  - AuthBottomSheet component — slide-up sheet with Google sign-in, official branding, iOS-safe OAuth
  - signInWithGoogle updated signature with returnPath param and ?next= encoding

affects:
  - 08-02-feed-integration
  - 08-03-ios-validation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useAuth hook uses getUser() (not getSession()) for server-validated auth state on mount"
    - "useAuth subscribes to onAuthStateChange for live post-OAuth session updates"
    - "undefined initial state distinguishes loading from confirmed-guest (null)"
    - "Bottom sheet via inline styles + CSS transform/transition (no component library)"
    - "iOS PWA OAuth: window.location.href only — window.open() is broken in WKWebView standalone"
    - "returnPath encoded as ?next= through OAuth redirectTo so callback preserves video position"

key-files:
  created:
    - frontend/hooks/useAuth.ts
    - frontend/components/AuthBottomSheet.tsx
  modified:
    - frontend/app/auth/actions.ts

key-decisions:
  - "useAuth uses getUser() not getSession() — getUser() validates with Supabase server; getSession() trusts stale local storage"
  - "AuthBottomSheet is self-contained: calls signInWithGoogle internally, not via prop — simpler call site in VideoFeed"
  - "signInWithGoogle returnPath defaulted to '/' for backward compatibility — no callers broke"

patterns-established:
  - "Pattern: useAuth hook — call in any Client Component needing auth state without blocking render"
  - "Pattern: AuthBottomSheet — render once in VideoFeed, control via sheetAction state"

requirements-completed:
  - AUTH-06
  - AUTH-07

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 8 Plan 01: Auth State Hook + Bottom Sheet Component Summary

**useAuth hook (getUser + onAuthStateChange), AuthBottomSheet component (iOS-safe Google sign-in with slide-up overlay), and signInWithGoogle extended with returnPath for video position preservation across OAuth redirect**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T10:40:15Z
- **Completed:** 2026-03-24T10:42:10Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `useAuth` hook detects client-side auth state without blocking the feed render — exposes `{ user, isGuest, loading }` with proper undefined/null/User semantics
- `AuthBottomSheet` component: fixed overlay + slide-up panel with drag handle, contextual headline ("Sign in to {actionLabel}"), and official Google G button — all inline styles matching project convention
- `signInWithGoogle` Server Action updated to accept `returnPath` param (backward compatible default `/`) and encodes it as `?next=<encoded>` in the OAuth `redirectTo` URL

## Task Commits

1. **Task 1: Create useAuth hook** - `f1f6842` (feat)
2. **Task 2: Create AuthBottomSheet component** - `340e35d` (feat)
3. **Task 3: Update signInWithGoogle to accept returnPath** - `ed70cb2` (feat)

## Files Created/Modified

- `frontend/hooks/useAuth.ts` - Client-side auth state hook; exports `useAuth()` with `{ user, isGuest, loading }`
- `frontend/components/AuthBottomSheet.tsx` - Bottom sheet UI with Google sign-in; self-contained, uses `window.location.href` for iOS PWA compatibility
- `frontend/app/auth/actions.ts` - `signInWithGoogle` signature updated to `(returnPath: string = '/')`, `redirectTo` now includes `?next=<encoded>`

## Decisions Made

- `useAuth` uses `getUser()` not `getSession()` — `getUser()` validates with Supabase server on each call, whereas `getSession()` reads potentially stale local storage. For the guest-vs-signed-in gate decision, server validation is the right call.
- `AuthBottomSheet` calls `signInWithGoogle` internally (not via an `onSignIn` prop) — keeps the call site in VideoFeed simple; just pass `returnPath`.
- `signInWithGoogle` default `returnPath = '/'` preserves full backward compatibility; no existing callers needed to change.

## Deviations from Plan

None — plan executed exactly as written. The TypeScript error that appeared after Task 2 (before Task 3) was expected and resolved by Task 3, as designed.

## Issues Encountered

None — all three tasks compiled cleanly after completing the full set.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `useAuth` and `AuthBottomSheet` are ready for Plan 02 to wire into `VideoFeed.tsx` — add `useAuth()` call, social action buttons on `VideoItem`, sheet trigger logic, and scroll restoration from `?videoIndex=` param
- No blockers; all three exported artifacts compile with zero TypeScript errors

## Self-Check: PASSED

All created files found on disk. All task commits verified in git log.

---
*Phase: 08-auth-ui-ios-validation*
*Completed: 2026-03-24*
