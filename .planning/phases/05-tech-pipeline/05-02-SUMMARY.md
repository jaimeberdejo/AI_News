---
phase: 05-tech-pipeline
plan: 02
subsystem: infra
tags: [github-actions, ci-cd, yaml, pipeline, parallel-jobs]

# Dependency graph
requires:
  - phase: 05-tech-pipeline
    plan: 01
    provides: Category-parameterized pipeline accepting finance/tech CLI argument
provides:
  - Two independent GitHub Actions jobs (finance-pipeline, tech-pipeline) running in parallel on the same 6am EST schedule
  - Failure isolation: a failure in one pipeline job does not block the other
affects:
  - 06-category-ui (tech edition now generated daily via automated CI — frontend can rely on editions in Supabase)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Independent parallel jobs pattern in GitHub Actions — no needs: dependency, same setup steps, different CLI arg

key-files:
  created: []
  modified:
    - .github/workflows/pipeline.yml

key-decisions:
  - "Two independent jobs (no needs:) chosen over sequential jobs — a finance failure must not block tech edition generation"
  - "Job setup steps duplicated verbatim (no reusable workflow) — simplicity over DRY for a two-job workflow"
  - "Both jobs run python -m pipeline.run {category} — leverages 05-01 category parameterization directly"

patterns-established:
  - "Independent parallel jobs pattern: same trigger, same setup, different CLI arg — extensible to sports/science in v1.2+"

requirements-completed:
  - TECH-01

# Metrics
duration: 1min
completed: 2026-03-10
---

# Phase 5 Plan 02: Independent Tech Pipeline GitHub Actions Job Summary

**Two independent GitHub Actions jobs (finance-pipeline + tech-pipeline) running in parallel on the 6am EST schedule, with full failure isolation via no cross-job needs: dependency**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-10T08:28:46Z
- **Completed:** 2026-03-10T08:29:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `.github/workflows/pipeline.yml` updated from a single `run-pipeline` job to two independent parallel jobs
- `finance-pipeline` job runs `python -m pipeline.run finance` — behavior identical to v1.0 (no regression)
- `tech-pipeline` job runs `python -m pipeline.run tech` — generates tech editions daily in Supabase
- Both jobs have identical setup steps: checkout, Python 3.11, pip cache, HuggingFace cache, ffmpeg, pip install
- Both jobs use all 5 secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY, OPENAI_API_KEY, PEXELS_API_KEY)
- Neither job has a `needs:` field — a failure in finance does not prevent tech from running, and vice versa

## Task Commits

Each task was committed atomically:

1. **Task 1: Add independent tech-pipeline job to GitHub Actions workflow** - `a5ae0d7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `.github/workflows/pipeline.yml` - Replaced single run-pipeline job with finance-pipeline and tech-pipeline independent parallel jobs

## Decisions Made
- Two independent jobs with no `needs:` dependency chosen — Phase 5 success criterion #4 requires that a failure in one pipeline does not block the other; independent jobs are the minimal correct implementation
- Job setup steps duplicated verbatim rather than using a reusable workflow — two jobs is the natural stopping point; over-engineering with reusable workflows adds complexity without value at this scale
- Both jobs leverage `python -m pipeline.run {category}` directly, building on the 05-01 category parameterization without any additional abstraction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The workflow changes take effect on the next scheduled run (6am EST) or can be triggered immediately via GitHub Actions `workflow_dispatch`.

## Next Phase Readiness
- Finance pipeline: `finance-pipeline` job runs `python -m pipeline.run finance` (backward compatible with v1.0 behavior)
- Tech pipeline: `tech-pipeline` job runs `python -m pipeline.run tech` daily, producing tech editions in Supabase
- Phase 6 (Category UI) can now rely on both finance and tech editions being available in Supabase each morning
- The `/api/today` endpoint still needs a `category` query param before Phase 6 can wire up the category tabs

## Self-Check: PASSED

- .github/workflows/pipeline.yml: FOUND
- a5ae0d7 (Task 1 commit): FOUND

---
*Phase: 05-tech-pipeline*
*Completed: 2026-03-10*
