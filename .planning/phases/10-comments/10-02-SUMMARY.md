---
phase: 10-comments
plan: 02
subsystem: api
tags: [next.js, supabase, route-handler, rate-limiting, typescript]

# Dependency graph
requires:
  - phase: 10-01
    provides: video_comments table with RLS, (user_id, created_at DESC) index for rate limit, profiles FK for embedded join
provides:
  - GET /api/comments?videoId=<uuid> — public comment list with profiles join
  - POST /api/comments — auth-gated comment creation with rate limit and length validation
  - DELETE /api/comments/[id] — auth-gated owner-only comment deletion
affects: [10-03-comments-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-client pattern: anon client for public GET (guests can read without auth), SSR cookie client for auth-gated POST/DELETE
    - Cross-video per-user rate limit enforced server-side via timestamp query with no video_id filter (COMM-04)
    - Defense-in-depth ownership check: .eq('user_id', user.id) on DELETE query in addition to RLS enforcement
    - Next.js 15+ params-as-Promise pattern: const { id } = await params in dynamic route handler

key-files:
  created:
    - frontend/app/api/comments/route.ts
    - frontend/app/api/comments/[id]/route.ts
  modified: []

key-decisions:
  - "Two-client pattern for GET: anon client ensures guests always receive comments without cookie overhead — mirrors /api/social/state GET pattern"
  - "Rate limit query filters only user_id + created_at (no video_id) — enforces COMM-04 cross-video per-user 30s constraint as spec'd"
  - "DELETE returns 404 (not 403) for non-owner — consistent with project error pattern; covers both not-found and unauthorized cases with one status code"
  - "params awaited in DELETE handler — Next.js 15+ dynamic route params are Promises; matches existing /api/editions/[id]/route.ts convention"

# Metrics
duration: ~2min
completed: 2026-03-26
---

# Phase 10 Plan 02: Comments API Route Handlers Summary

**Two Next.js Route Handlers exposing the comment data layer: public GET list with profiles join, auth-gated POST with cross-video rate limiting, auth-gated owner-only DELETE**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T11:02:02Z
- **Completed:** 2026-03-26T11:03:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `frontend/app/api/comments/route.ts` with GET (public, anon client, profiles join) and POST (SSR auth gate, body validation, cross-video rate limit, insert returning profiles join, 201)
- Created `frontend/app/api/comments/[id]/route.ts` with DELETE (SSR auth gate, params awaited, dual ownership check via user_id eq + RLS, 404 on not-found/not-owner)
- TypeScript compiles cleanly with both files present

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET + POST /api/comments** - `48b9c4d` (feat)
2. **Task 2: Create DELETE /api/comments/[id]** - `5106418` (feat)

## Files Created/Modified

- `frontend/app/api/comments/route.ts` — GET (public, anon client, video_comments + profiles join) + POST (auth-gated, rate limit, length validation, insert returning comment)
- `frontend/app/api/comments/[id]/route.ts` — DELETE (auth-gated, params awaited, user_id defense-in-depth, 404 on not-found/not-owner)

## Decisions Made

- Two-client pattern for GET: anon client so guests always receive comments without cookie overhead — mirrors `/api/social/state` pattern established in Phase 9-02
- Rate limit query has no `video_id` filter: enforces COMM-04 cross-video per-user 30-second constraint (posting on video A then video B within 30s is blocked)
- DELETE returns 404 (not 403) for non-owner: consistent project error pattern, covers both "doesn't exist" and "not owner" in one response code
- `params` awaited in DELETE handler: Next.js 15+ dynamic route params are Promises (established pattern in project)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `frontend/app/api/comments/route.ts` — file exists, exports GET and POST
- `frontend/app/api/comments/[id]/route.ts` — file exists, exports DELETE
- Commits `48b9c4d` and `5106418` verified in git log
- TypeScript compiles without errors

## Next Phase Readiness

- GET /api/comments is ready for CommentSheet to call on open
- POST /api/comments is ready for CommentSheet submit handler
- DELETE /api/comments/[id] is ready for CommentSheet delete button handler
- Phase 10-03 (Comments UI) can begin immediately — no blockers
