---
phase: 04-ship
plan: "02"
subsystem: infra
tags: [vercel, nextjs, deployment, supabase, images]

# Dependency graph
requires:
  - phase: 03-frontend
    provides: Next.js app built and tested locally
  - phase: 04-01
    provides: GitHub Actions workflow triggering pipeline on push
provides:
  - Next.js config with Supabase Storage remotePatterns for Image optimization
  - Local production build verified clean (no TypeScript errors)
  - Vercel deployment pending human dashboard setup (Task 2 checkpoint)
affects: [04-03, device-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [Next.js images.remotePatterns for Supabase Storage CDN]

key-files:
  created: []
  modified:
    - frontend/next.config.ts

key-decisions:
  - "Supabase Storage remotePatterns uses /storage/v1/object/public/** wildcard — covers all bucket paths without listing each bucket individually"
  - "No output: 'export' in config — static export mode is incompatible with Vercel serverless API routes (/api/today, /api/editions/[id])"
  - "NEXT_PUBLIC_APP_URL must be set to Vercel production URL (not localhost) — page.tsx Server Component fetches /api/today via absolute URL during SSR on Vercel's servers"

patterns-established:
  - "Vercel deployments use Root Directory: frontend — repo root is not the Next.js project root"

requirements-completed: [AUTO-01]

# Metrics
duration: ~5min (Task 1 complete; Task 2 pending human action)
completed: 2026-02-26
---

# Phase 4 Plan 02: Vercel Deployment Summary

**Next.js config updated with Supabase Storage remotePatterns and local build verified clean; Vercel dashboard deployment pending user setup**

## Performance

- **Duration:** ~5 min (Task 1 complete)
- **Started:** 2026-02-26T09:40:00Z
- **Completed:** 2026-02-26 (Task 2 pending checkpoint)
- **Tasks:** 1/2 complete (Task 2 is a human-action checkpoint)
- **Files modified:** 1

## Accomplishments
- Added `images.remotePatterns` for `yfryhktlkbemzyequgds.supabase.co` to `frontend/next.config.ts`
- Confirmed no `output: 'export'` present — serverless API routes remain compatible
- Local `npm run build` passes cleanly: all routes compile, no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify and fix Next.js config for production** - `0e914b0` (chore)
2. **Task 2: Deploy to Vercel via dashboard** - PENDING (human-action checkpoint)

## Files Created/Modified
- `frontend/next.config.ts` - Added images.remotePatterns for Supabase Storage; enables Next.js Image optimization for CDN assets

## Decisions Made
- Supabase remotePatterns wildcard `pathname: '/storage/v1/object/public/**'` covers all public buckets without enumerating each path individually
- `output: 'export'` was NOT present in the original config (correct) — static export would break `/api/today` and `/api/editions/[id]` serverless routes
- `NEXT_PUBLIC_APP_URL` must point to the Vercel production URL, not localhost, because `page.tsx` is a Server Component that fetches `/api/today` via absolute URL during SSR on Vercel's servers

## Deviations from Plan

None — plan executed exactly as written. `next.config.ts` had empty config object; Supabase remotePatterns block was added as specified.

## User Setup Required

**Vercel deployment requires manual dashboard configuration.** Task 2 is a checkpoint:human-action gate.

Steps required:
1. Go to https://vercel.com/new → Import Git Repository → `AutoNews_AI`
2. Set **Root Directory** to `frontend` (critical — without this, Vercel builds from repo root)
3. Framework auto-detects as Next.js
4. Click Deploy (first deploy may load with no data — expected before env vars are set)
5. Note the production URL (e.g. `https://auto-news-ai-[hash].vercel.app`)
6. Project Settings → Environment Variables → add for **Production**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://yfryhktlkbemzyequgds.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(from Supabase Dashboard → Settings → API → anon/public)*
   - `NEXT_PUBLIC_APP_URL` = *(production Vercel URL from step 5)*
7. Deployments → Redeploy with env vars active
8. Verify app loads at production URL without CORS errors

## Issues Encountered
None

## Next Phase Readiness
- Task 1 complete: `next.config.ts` is production-ready
- Task 2 blocked on Vercel dashboard login and GitHub repo import (no pre-existing auth token)
- Once Task 2 complete, Plan 04-03 (real-device validation) can proceed

---
*Phase: 04-ship*
*Completed: 2026-02-26 (partial — Task 2 pending)*
