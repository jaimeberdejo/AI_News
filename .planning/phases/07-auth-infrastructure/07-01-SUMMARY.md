---
phase: 07-auth-infrastructure
plan: 01
subsystem: auth
tags: [supabase, ssr, cookies, middleware, nextjs, typescript]

# Dependency graph
requires: []
provides:
  - "@supabase/ssr installed for cookie-based session management"
  - "frontend/lib/supabase/server.ts — per-request createClient() for Server Components / Route Handlers / Server Actions"
  - "frontend/lib/supabase/client.ts — browser singleton createClient() for Client Components"
  - "frontend/lib/supabase/middleware.ts — updateSession() helper with getUser() token refresh"
  - "frontend/middleware.ts — root Next.js middleware with CVE-2025-29927-safe static-asset matcher"
affects:
  - 07-auth-infrastructure
  - 08-auth-ui
  - 09-social-features
  - 10-user-accounts
  - 11-comments

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr ^0.9.0"
  patterns:
    - "getAll/setAll cookie adapter pattern (required for @supabase/ssr 0.2+)"
    - "per-request server client via await cookies() in async factory"
    - "browser singleton via createBrowserClient (multiple calls return same instance)"
    - "session refresh via supabase.auth.getUser() in middleware on every non-static request"

key-files:
  created:
    - frontend/lib/supabase/server.ts
    - frontend/lib/supabase/client.ts
    - frontend/lib/supabase/middleware.ts
    - frontend/middleware.ts
  modified:
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "getAll/setAll cookie adapter used (not deprecated singular get/set)"
  - "Static-asset matcher included in middleware.ts to prevent 9+ auth calls per page load and close CVE-2025-29927"
  - "Original frontend/lib/supabase.ts anon singleton preserved byte-for-byte — existing /api/today feed unaffected"

patterns-established:
  - "Server-side auth: import createClient from '@/lib/supabase/server' (async)"
  - "Client-side auth: import createClient from '@/lib/supabase/client' (sync)"
  - "Middleware refresh: updateSession() called on every non-static request"

requirements-completed: [AUTH-05]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 7 Plan 01: Auth Infrastructure Summary

**@supabase/ssr SSR session plumbing wired with three client factories (server, browser, middleware) and CVE-2025-29927-safe root middleware**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T20:26:27Z
- **Completed:** 2026-03-23T20:28:07Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Installed @supabase/ssr ^0.9.0 as the SSR session package
- Created three client factories using the required getAll/setAll cookie adapter pattern
- Created root middleware.ts with static-asset matcher, preventing excessive Supabase auth calls and closing CVE-2025-29927 middleware-bypass vector

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @supabase/ssr** - `c096109` (chore)
2. **Task 2: Create SSR client factories (server, browser, middleware)** - `404cc0e` (feat)
3. **Task 3: Create root middleware.ts with static-asset matcher** - `1fd72ab` (feat)

## Files Created/Modified

- `frontend/package.json` - Added @supabase/ssr ^0.9.0 dependency
- `frontend/package-lock.json` - Lock file updated
- `frontend/lib/supabase/server.ts` - Per-request server factory using createServerClient + await cookies()
- `frontend/lib/supabase/client.ts` - Browser singleton factory using createBrowserClient
- `frontend/lib/supabase/middleware.ts` - updateSession() with getAll/setAll adapters and mandatory getUser() refresh
- `frontend/middleware.ts` - Root Next.js middleware calling updateSession with static-asset exclusion matcher

## Decisions Made

- Used getAll/setAll cookie adapter pattern (singular get/set removed in @supabase/ssr 0.2+)
- Static-asset matcher pattern excludes _next/static, _next/image, favicon.ico, and common image extensions to close CVE-2025-29927 and prevent auth request flood
- Preserved frontend/lib/supabase.ts anon singleton unchanged — existing feed at /api/today continues working

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (Supabase project and env vars already configured from prior phases.)

## Next Phase Readiness

- SSR session infrastructure complete; all downstream auth features (sign-up, sign-in, OAuth, password reset) can now correctly persist cookies
- Ready for Phase 7 Plan 02 (auth UI: sign-up/sign-in forms)
- Reminder: Configure custom SMTP (Resend/SendGrid) before production to avoid Supabase free tier 3 OTP/hour rate limit

---
*Phase: 07-auth-infrastructure*
*Completed: 2026-03-23*
