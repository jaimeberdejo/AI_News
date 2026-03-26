---
phase: 11-profile-page
plan: 01
subsystem: api
tags: [supabase, storage, rls, next.js, route-handlers, profiles]

# Dependency graph
requires:
  - phase: 07-auth-infrastructure
    provides: profiles table, SSR Supabase client, getUser() auth pattern
  - phase: 09-social-interactions
    provides: video_likes and video_bookmarks tables for join queries

provides:
  - Supabase Storage avatars bucket with 4 RLS policies (upload/read/update/delete)
  - GET /api/profile — returns { profile: { display_name, avatar_url } } for auth users
  - PATCH /api/profile — validates and persists display_name (1-50 chars) and avatar_url
  - GET /api/profile/liked — returns flat video array with likedAt from video_likes join
  - GET /api/profile/saved — returns flat video array with savedAt from video_bookmarks join

affects: [11-02-profile-ui, future avatar upload feature]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSR createClient + getUser() for all profile routes (no deprecated getSession())
    - Supabase embedded join syntax for video_likes/video_bookmarks + videos
    - storage.foldername(name)[1] for user-scoped storage RLS policies
    - Whitelist-only PATCH: explicit field extraction prevents mass-assignment

key-files:
  created:
    - frontend/supabase/migrations/20260326000002_add_avatars_bucket.sql
    - frontend/app/api/profile/route.ts
    - frontend/app/api/profile/liked/route.ts
    - frontend/app/api/profile/saved/route.ts
  modified: []

key-decisions:
  - "storage.foldername(name)[1] extracts first path segment from {user_id}/avatar.jpg — scopes upload to own folder without storing user_id separately"
  - "PATCH whitelists display_name and avatar_url explicitly — no spread of request body to prevent mass-assignment"
  - "row.videos cast through unknown in liked/saved routes — Supabase embedded join returns ambiguous TS type (object vs array); cast required for TypeScript correctness"
  - "video_likes/video_bookmarks join uses Supabase embedded syntax (.select('created_at, videos(...)')) — FK from video_id to public.videos.id enables automatic join inference"

patterns-established:
  - "Profile API: GET+PATCH in single route.ts file following bookmark route pattern"
  - "Embedded join flatten: filter null rows, spread row.videos, add timestamp field"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 11 Plan 01: Profile API Summary

**Supabase Storage avatars bucket + three Route Handlers backing profile read/update, liked videos, and saved videos using SSR Supabase client with embedded join queries**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-26T11:47:45Z
- **Completed:** 2026-03-26T11:49:33Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Avatars Storage bucket provisioned with 4 RLS policies: user-scoped upload via storage.foldername, public read, own update/delete
- GET /api/profile returns { profile: { display_name, avatar_url } }; PATCH validates display_name (1-50 chars, trimmed) and persists updates
- GET /api/profile/liked and /api/profile/saved return flat video arrays from embedded Supabase joins, reverse chronological, 401 for guests

## Task Commits

Each task was committed atomically:

1. **Task 1: Avatars Storage bucket migration** - `88d06c5` (feat)
2. **Task 2: Profile API route — GET and PATCH** - `f31b06d` (feat)
3. **Task 3: Profile liked + saved API routes** - `14f8fae` (feat)

## Files Created/Modified
- `frontend/supabase/migrations/20260326000002_add_avatars_bucket.sql` - avatars bucket INSERT + 4 RLS policies
- `frontend/app/api/profile/route.ts` - GET (fetch profile) and PATCH (update profile) handlers
- `frontend/app/api/profile/liked/route.ts` - GET liked videos via video_likes embedded join
- `frontend/app/api/profile/saved/route.ts` - GET bookmarked videos via video_bookmarks embedded join

## Decisions Made
- Cast `row.videos` through `unknown` in liked/saved routes — Supabase infers embedded join type as `{ id: any; headline: any; video_url: any; }[]` (array) even though it returns an object at runtime; TypeScript requires `as unknown as` to bridge the type gap
- PATCH uses explicit field whitelisting (not spread of body) — prevents mass-assignment vulnerabilities

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in liked/saved route Supabase embedded join cast**
- **Found during:** Task 3 (Profile liked + saved API routes)
- **Issue:** `row.videos as { id: string; headline: string; video_url: string }` failed TS2352 — Supabase infers the embedded join type as an array, not a plain object
- **Fix:** Changed cast to `row.videos as unknown as { ... }` to bridge incompatible TS types without changing runtime behavior
- **Files modified:** frontend/app/api/profile/liked/route.ts, frontend/app/api/profile/saved/route.ts
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** `14f8fae` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Required for TypeScript correctness; no behavioral change.

## Issues Encountered
None beyond the TypeScript type fix documented above.

## User Setup Required
**Manual Supabase step required:** Run the avatars bucket migration against the Supabase project:
```
supabase db push
```
Or apply `frontend/supabase/migrations/20260326000002_add_avatars_bucket.sql` via Supabase Dashboard SQL editor.

## Next Phase Readiness
- All three API routes are live and TypeScript-clean
- Plan 02 (Profile UI) can fetch from /api/profile, /api/profile/liked, /api/profile/saved
- Avatar upload UI will need the avatars bucket (provisioned by this migration)
- No blockers

---
*Phase: 11-profile-page*
*Completed: 2026-03-26*
