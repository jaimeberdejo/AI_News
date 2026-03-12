---
phase: 04-ship
plan: "02"
subsystem: infra
tags: [vercel, nextjs, deployment, supabase, environment-variables, pwa]

# Dependency graph
requires:
  - phase: 03-frontend
    provides: Next.js PWA app built and verified locally
  - phase: 01-foundation
    provides: Supabase project URL and anon key for environment variables
provides:
  - Live Vercel deployment at https://autonews-ai.vercel.app
  - Next.js config with Supabase Storage remotePatterns for Image optimization
  - Vercel GitHub integration for auto-deploy on main branch push
  - All 3 NEXT_PUBLIC_ environment variables set in Vercel Production
affects: [04-03-device-validation, future-deployments]

# Tech tracking
tech-stack:
  added: [vercel-github-integration]
  patterns: [NEXT_PUBLIC_APP_URL for SSR absolute URL fetch, remotePatterns for Supabase Storage, Vercel dashboard env var configuration]

key-files:
  created: []
  modified:
    - frontend/next.config.ts

key-decisions:
  - "NEXT_PUBLIC_APP_URL set to https://autonews-ai.vercel.app (not localhost) — server component in page.tsx fetches /api/today using this URL during SSR on Vercel servers"
  - "Root Directory set to frontend in Vercel dashboard — without this, Vercel builds from repo root and fails to detect Next.js framework"
  - "remotePatterns wildcard /storage/v1/object/public/** covers all Supabase Storage buckets without needing bucket-specific paths"
  - "No output: 'export' in config — static export mode is incompatible with Vercel serverless API routes (/api/today, /api/editions/[id])"

patterns-established:
  - "Vercel deployments use Root Directory: frontend — repo root is not the Next.js project root"
  - "Vercel production env vars set via dashboard (not .env files) — .env.local used only for local development"

requirements-completed: [AUTO-01]

# Metrics
duration: ~30min (includes human-action checkpoint for Vercel dashboard setup)
completed: 2026-02-26
---

# Phase 4 Plan 02: Vercel Deployment Summary

**FinFeed Next.js PWA deployed and live at https://autonews-ai.vercel.app with Supabase env vars configured, GitHub auto-deploy active, and app loading without errors**

## Performance

- **Duration:** ~30 min (includes human-action checkpoint for Vercel dashboard setup)
- **Started:** 2026-02-26
- **Completed:** 2026-02-26
- **Tasks:** 2/2 complete
- **Files modified:** 1

## Accomplishments

- Next.js config updated with remotePatterns for Supabase Storage hostname (`yfryhktlkbemzyequgds.supabase.co`) covering all buckets under `/storage/v1/object/public/**`
- Confirmed no `output: 'export'` in config — serverless API routes remain functional on Vercel
- FinFeed app deployed to Vercel via GitHub integration — app loaded at https://autonews-ai.vercel.app without errors
- All 3 environment variables configured in Vercel Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
- Vercel GitHub integration active — every push to `main` triggers automatic redeployment

## Task Commits

Each automated task was committed atomically:

1. **Task 1: Verify and fix Next.js config for production** - `0e914b0` (chore)
2. **Task 2: Deploy to Vercel via dashboard** - human-action checkpoint (Vercel dashboard setup by user; no code commit required)

**Checkpoint state commit:** `a33d987` (docs: checkpoint — next.config.ts complete, awaiting Vercel deployment)

## Files Created/Modified

- `frontend/next.config.ts` — Added `images.remotePatterns` for Supabase Storage; enables Next.js Image optimization for CDN assets without blocking

## Decisions Made

- `NEXT_PUBLIC_APP_URL` must be the Vercel production URL (`https://autonews-ai.vercel.app`), NOT localhost — the `page.tsx` Server Component fetches `/api/today` via absolute URL during SSR on Vercel's servers; pointing to localhost silently returns no videos
- Root Directory set to `frontend` in Vercel dashboard — without this setting, Vercel builds from repo root and fails to auto-detect the Next.js framework
- Redeploy triggered after adding env vars — first deploy expected to have no data since variables were not yet set

## Deviations from Plan

None — plan executed exactly as written. Task 1 was a verification (remotePatterns added as specified, no `output: 'export'` found). Task 2 proceeded as a human-action checkpoint per plan design.

## User Setup Completed

Vercel deployment required manual dashboard configuration (human-action checkpoint):

| Step | Action | Outcome |
|------|--------|---------|
| Import repo | https://vercel.com/new → Import FinFeed | Imported successfully |
| Root Directory | Set to `frontend` | Next.js framework auto-detected |
| First deploy | Click Deploy | Deployed (no data before env vars) |
| Env vars | Added 3 NEXT_PUBLIC_ variables to Production | Configured |
| Redeploy | Triggered after env var setup | App live with correct config |

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yfryhktlkbemzyequgds.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon/public key from Supabase)* |
| `NEXT_PUBLIC_APP_URL` | `https://autonews-ai.vercel.app` |

## Issues Encountered

None. App loaded at https://autonews-ai.vercel.app without errors after env vars were configured and a redeploy was triggered.

## Next Phase Readiness

- Production deployment live and stable at https://autonews-ai.vercel.app
- Auto-deploy from `main` branch active — no further deploy configuration needed
- Ready for Plan 04-03: real-device validation (iOS Safari, Android Chrome, PWA install test)
- Reminder: iOS Safari tap-to-unmute must be tested on real iPhone (not Simulator) — synchronous gesture handler only manifests on real device

---
*Phase: 04-ship*
*Completed: 2026-02-26*
