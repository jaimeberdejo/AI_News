---
phase: 07-auth-infrastructure
plan: 02
subsystem: auth
tags: [supabase, nextjs, server-actions, oauth, google, email-otp, rls, postgres, pkce]

# Dependency graph
requires:
  - phase: 07-01
    provides: createClient() SSR Supabase factories (server.ts, browser.ts, middleware.ts)
provides:
  - profiles table with RLS policies and auto-create trigger (SQL migration)
  - GET /auth/callback — exchanges OAuth PKCE code for session
  - GET /auth/confirm — verifies email OTP tokens for signup and password reset
  - Server Actions: signUp, signIn, signOut, resetPassword, updatePassword, signInWithGoogle
affects:
  - 07-03
  - 08-auth-ui
  - 09-social
  - 10-comments

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Actions call createClient() from lib/supabase/server.ts — never the anon singleton
    - signInWithGoogle returns { url } to caller instead of redirecting server-side (iOS PWA standalone compat)
    - Supabase PKCE flow via exchangeCodeForSession in /auth/callback
    - Email OTP verification via verifyOtp in /auth/confirm (handles both signup + password reset)
    - handle_new_user trigger uses SECURITY DEFINER + empty search_path to prevent injection

key-files:
  created:
    - frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql
    - frontend/app/auth/callback/route.ts
    - frontend/app/auth/confirm/route.ts
    - frontend/app/auth/actions.ts
  modified: []

key-decisions:
  - "signInWithGoogle returns { url } not redirect() — required for iOS PWA standalone mode (window.open broken in that context)"
  - "handle_new_user trigger has ON CONFLICT DO NOTHING safety valve — prevents full signup rollback if trigger fires twice"
  - "SECURITY DEFINER + SET search_path = '' on trigger function — prevents search-path injection attack vector"

patterns-established:
  - "Auth Server Actions pattern: 'use server' at top, createClient() per action, throw new Error(error.message) on failure"
  - "OAuth redirect pattern: Server Action returns URL, Client Component does window.location.href assignment"
  - "Email confirm route handles both signup and password reset via token_hash + type query params"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-03-23
---

# Phase 7 Plan 02: Auth Routes and Server Actions Summary

**Supabase auth surface built: profiles table with RLS + auto-create trigger, PKCE OAuth callback, email OTP confirm route, and six Server Actions covering the full AUTH-01 through AUTH-04 flow**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23T00:00:00Z
- **Completed:** 2026-03-23
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- SQL migration for `public.profiles` table with two RLS policies (read-all, update-own) and `on_auth_user_created` trigger that auto-creates a profile row on every Supabase signup
- Two GET route handlers wiring Supabase redirects into the Next.js app: `/auth/callback` (OAuth PKCE code exchange) and `/auth/confirm` (email OTP for signup + password reset)
- Six Server Actions in `app/auth/actions.ts` providing the full auth API for Phase 8 UI: signUp, signIn, signOut, resetPassword, updatePassword, signInWithGoogle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create profiles migration SQL** - `ce5d4fe` (feat)
2. **Task 2: Create auth route handlers (OAuth callback + email confirm)** - `d5d716a` (feat)
3. **Task 3: Create auth Server Actions** - `45477b0` (feat)

## Files Created/Modified
- `frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql` - profiles table DDL, two RLS policies, handle_new_user trigger function, on_auth_user_created trigger
- `frontend/app/auth/callback/route.ts` - GET handler, exchanges PKCE code for session via exchangeCodeForSession, redirects to `next` param or `/auth/auth-error`
- `frontend/app/auth/confirm/route.ts` - GET handler, verifies email OTP via verifyOtp (handles signup confirm and password reset recovery tokens)
- `frontend/app/auth/actions.ts` - 'use server' module with all six Server Actions

## Decisions Made
- **signInWithGoogle returns { url }** instead of calling redirect() — iOS PWA standalone mode breaks when a Server Action calls redirect() to an external OAuth URL; the Client Component must assign window.location.href
- **ON CONFLICT DO NOTHING in handle_new_user** — if the trigger fires more than once (e.g., edge condition during PKCE), without this safety valve the INSERT would raise a unique constraint error and roll back the entire signup transaction
- **SECURITY DEFINER + SET search_path = ''** on the trigger function — prevents an attacker from manipulating search_path to redirect the INSERT to a shadow table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**The SQL migration must be applied to the Supabase project before Phase 8 auth UI can be tested end-to-end.** Two options:

1. Supabase Dashboard — Database → SQL Editor → New query → paste migration file contents → Run
2. CLI — `cd frontend && supabase db push` (requires `supabase login` first)

After applying: confirm `profiles` table visible in Table Editor, `handle_new_user` function visible under Database → Functions, `on_auth_user_created` trigger visible under Database → Triggers.

## Next Phase Readiness
- All auth Server Actions ready for Phase 8 UI to import and wire into login/signup/reset forms
- Route handlers registered and will receive Supabase redirects once Google OAuth is configured in Supabase Dashboard
- Blocker still active: Supabase email OTP rate limit (3/hr on free tier) — configure custom SMTP (Resend or SendGrid) before Phase 7 ships to production
- Blocker still active: iOS PWA OAuth must be tested on real device before Phase 9 social features build on top

---
*Phase: 07-auth-infrastructure*
*Completed: 2026-03-23*
