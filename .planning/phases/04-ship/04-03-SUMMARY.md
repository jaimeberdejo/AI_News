---
phase: 04-ship
plan: "03"
subsystem: infra
tags: [github-actions, cicd, pipeline, ios, android, pwa, real-device, validation]

# Dependency graph
requires:
  - phase: 04-ship/04-01
    provides: GitHub Actions pipeline.yml workflow file committed to master
  - phase: 04-ship/04-02
    provides: Live Vercel deployment at https://autonews-ai.vercel.app
provides:
  - GitHub Actions workflow verified working — 5-story edition published end-to-end
  - All 5 repository secrets stored and verified (values never leak in logs)
  - pipeline/db.py fixed — silent dotenv load compatible with GitHub Actions env injection
  - Real device validation results (Task 2 — awaiting user)
affects: [cron-automation, future-pipeline-runs, device-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "load_dotenv(find_dotenv()) without raise_error_if_not_found — required for GitHub Actions compatibility where env vars come from secrets, not .env file"
    - "gh secret set from .env values — sets all pipeline secrets in one pass"

key-files:
  created: []
  modified:
    - pipeline/db.py

key-decisions:
  - "find_dotenv(raise_error_if_not_found=True) must be False on GitHub Actions — .env file absent, secrets injected via env: block in workflow; os.environ lookups still work"
  - "First warm-cache run: 4m40s total (pip cache hit, HuggingFace cache miss on first run but hit on second) — 45-minute timeout is very conservative; can be tightened to 15 minutes"
  - "5/5 stories succeeded on first clean run — no partial edition fallback triggered"

requirements-completed: [AUTO-01]

# Metrics
duration: ~25min (Task 1 complete; Task 2 awaiting real-device test)
completed: 2026-02-26
---

# Phase 4 Plan 03: CI/CD Validation and Device Testing Summary

**GitHub Actions pipeline validated end-to-end on first successful run: 5 stories published to Supabase Storage in 4m40s; real-device iOS/Android validation pending user**

## Performance

- **Duration:** ~25 min (Task 1 complete; Task 2 is a checkpoint awaiting user)
- **Started:** 2026-02-26T10:31:09Z
- **Completed:** 2026-02-26 (Task 1); Task 2 pending
- **Tasks:** 1/2 complete (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- All 5 GitHub repository secrets set via `gh secret set` and confirmed visible via `gh secret list`
- `pipeline.yml` workflow confirmed on default branch (master) — cron fires from master
- Manual `workflow_dispatch` run triggered; run 22438695136 completed in 4m40s with status **success**
- Edition `6cc7df10` published as `'published'` with 5 videos to Supabase Storage
- No raw secret values visible in run logs — all appear as `***` (GitHub masking working)
- Auto-fixed `pipeline/db.py` bug: `find_dotenv(raise_error_if_not_found=True)` crashed on GitHub Actions (no `.env` file in runner); changed to silent `find_dotenv()` — env vars flow from workflow `env:` block

## Task Commits

Each automated task was committed atomically:

1. **Task 1: Add GitHub repository secrets and trigger manual workflow run**
   - Secrets set via `gh secret set` (no code commit needed for this step)
   - Auto-fix commit: `0f955b3` — `fix(04-ship): remove raise_error_if_not_found in pipeline/db.py`
2. **Task 2: Real device validation on iOS and Android** — checkpoint:human-verify (pending)

## Files Created/Modified

- `pipeline/db.py` — Removed `raise_error_if_not_found=True` from `find_dotenv()` call; GitHub Actions injects env vars via `env:` block, no `.env` file present

## GitHub Actions Run Details

| Run | ID | Trigger | Result | Duration |
|-----|-----|---------|--------|----------|
| First attempt | 22438348520 | workflow_dispatch | failure — OSError: File not found (.env) | 58s |
| Second attempt (after fix) | 22438695136 | workflow_dispatch | **success** | 4m40s |

**Pipeline output (run 22438695136):**
- 5 stories processed, 0 failed
- Edition `6cc7df10-1c8e-4b70-b8d2-08d79b7df058` published (`published_at: 2026-02-26T10:51:00Z`)
- Cleanup: no editions older than 7 days found
- Cron schedule: 6am UTC and 6pm UTC daily (on `master` branch — confirmed default)

## Secrets Security Verification

```
gh run view --log | grep -iE "(SUPABASE_URL|SERVICE_KEY|GROQ_API|OPENAI_API|PEXELS_API)=" | head -20
```
Output: empty (no matches) — all secret values appear as `***` in workflow logs. No leakage.

## Decisions Made

- `find_dotenv(raise_error_if_not_found=True)` removed — GitHub Actions never has a `.env` file; the workflow's `env:` block injects secrets directly as OS environment variables which `os.environ["KEY"]` reads correctly
- First warm-cache run measured at 4m40s — the 45-minute `timeout-minutes` is very conservative; consider tightening to 15 minutes after a few more observed runs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pipeline/db.py crash on GitHub Actions: raise_error_if_not_found=True**
- **Found during:** Task 1 (first workflow_dispatch run, run 22438348520)
- **Issue:** `find_dotenv(raise_error_if_not_found=True)` raises `OSError: File not found` when no `.env` exists. GitHub Actions runner has no `.env` file — secrets are injected via the `env:` block in `pipeline.yml`. All other pipeline files already used `find_dotenv()` without this flag.
- **Fix:** Changed `load_dotenv(find_dotenv(raise_error_if_not_found=True))` to `load_dotenv(find_dotenv())` with explanatory comment
- **Files modified:** `pipeline/db.py`
- **Verification:** Re-triggered `workflow_dispatch`; run 22438695136 passed all steps, pipeline published 5-story edition
- **Committed in:** `0f955b3`

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Fix was essential for the workflow to run at all. No scope creep.

## Real Device Validation (Task 2 — Pending)

**Status:** Awaiting human checkpoint. User must test the following on a real iPhone:

**A. Basic load**
1. Open https://autonews-ai.vercel.app in Safari on iPhone
2. Expected: First video starts playing (muted) within 2 seconds
3. Expected: "Tap to listen" prompt visible

**B. Mute/unmute (iOS critical path)**
1. Tap the mute button
2. Expected: Audio plays — no silent failure
3. Swipe to next video — audio persists

**C. Scroll through all 5 videos**
1. Swipe through all videos
2. Expected: No buffering pause
3. Expected: "You're up to date" end card after last video

**D. PWA install**
1. Safari Share button → "Add to Home Screen"
2. Expected: Standalone mode (no browser URL bar)

**E. Android (if available)**
Steps A-C on Chrome for Android.

## Issues Encountered

First workflow run failed immediately (58s) due to `OSError: File not found` in `pipeline/db.py`. Auto-fixed per Rule 1 (bug). Second run succeeded.

## Next Phase Readiness

- GitHub Actions cron automation verified working — will fire at 6am and 6pm UTC daily from `master`
- Production Vercel URL serving live content at https://autonews-ai.vercel.app
- All secrets stored securely, no leakage confirmed
- Phase 4 complete pending real-device iOS validation (Task 2 checkpoint)

---
*Phase: 04-ship*
*Completed: 2026-02-26 (partial — Task 2 pending device testing)*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-ship/04-03-SUMMARY.md`
- FOUND: `pipeline/db.py`
- FOUND: commit `0f955b3` (fix — db.py raise_error_if_not_found removed)
