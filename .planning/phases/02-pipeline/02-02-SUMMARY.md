---
phase: 02-pipeline
plan: 02
subsystem: api
tags: [groq, llm, llama, supabase, pipeline, script-writing]

# Dependency graph
requires:
  - phase: 02-01
    provides: pipeline/models.py (Article, Story dataclasses), pipeline/db.py (get_db singleton), requirements.txt with groq>=0.9.0
  - phase: 01-02
    provides: Supabase editions and videos tables with status/constraint schema
provides:
  - pipeline/script.py — select_and_write(articles) -> tuple[str, list[Story]]
  - Groq Llama 3.3 story selection (3-5 stories per run)
  - Per-story script writing (75-115 words, financial influencer tone)
  - Edition upsert and video row DB insertion before TTS (SCRIPT-03 safety)
affects: [02-03-tts, 02-04-video, 02-05-orchestrator]

# Tech tracking
tech-stack:
  added: [groq 1.0.0 (installed)]
  patterns:
    - Groq singleton client initialized lazily from GROQ_API_KEY env var
    - response_format json_object for deterministic Groq story selection output
    - SCRIPT-03 pattern: DB video row inserted with status='generating' before any TTS call
    - Edition deduplication via SELECT-then-INSERT (raises RuntimeError if already published)

key-files:
  created: [pipeline/script.py]
  modified: []

key-decisions:
  - "Edition deduplication via SELECT-then-INSERT raises RuntimeError on published re-run — prevents duplicate video rows"
  - "Groq story index clamped to [:5] in code — belt-and-suspenders on top of videos.position BETWEEN 1 AND 5 DB constraint"
  - "Out-of-range Groq index logged as warning and skipped (not raised) — partial results better than full failure"

patterns-established:
  - "SCRIPT-03: insert DB video row with status='generating' BEFORE calling TTS — failures traceable in DB"
  - "Groq response_format json_object: parse with json.loads, extract stories key, clamp to 5"
  - "Lazy Groq client singleton: _get_groq() global — avoids repeated initialization on multi-story runs"

requirements-completed: [SCRIPT-01, SCRIPT-02, SCRIPT-03]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 2 Plan 02: Script Writing Summary

**Groq Llama 3.3 story selector and financial influencer script writer with DB video row insertion before TTS (SCRIPT-03)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T23:27:44Z
- **Completed:** 2026-02-24T23:29:03Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- `pipeline/script.py` created with `select_and_write(articles) -> tuple[str, list[Story]]`
- Groq Llama 3.3 story selection: picks 3-5 most impactful financial stories from ingested articles using json_object response format
- Per-story script writing: 75-115 words, energetic financial influencer tone, 30-45 second target duration
- SCRIPT-03 safety: video row inserted into Supabase with `status='generating'` before any TTS call, ensuring traceability on failure
- Edition deduplication: raises `RuntimeError` if today's edition is already `'published'`, preventing re-run row duplication

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/script.py** - `3f19bef` (feat)

**Plan metadata:** _(see final commit)_

## Files Created/Modified

- `pipeline/script.py` — Groq-powered story selection and script writing; exports `select_and_write()`

## Decisions Made

- Edition deduplication uses SELECT-then-INSERT (not SQL UPSERT): if a non-published edition exists for today it is reused; if published, RuntimeError is raised. This is simpler than ON CONFLICT given the need to also check status.
- Groq index out-of-range is a warning + skip (not a hard error) — partial story sets are preferable to a full pipeline abort.
- `groq` package was already in `requirements.txt` from plan 02-01 but not installed in the local environment — installed via `pip install groq>=0.9.0` as part of this task (Rule 3: blocking issue auto-fixed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed groq package not present in environment**
- **Found during:** Task 1 (before creating script.py)
- **Issue:** `groq` was in `requirements.txt` but not installed; `import groq` would fail
- **Fix:** Ran `pip install "groq>=0.9.0"` — installed groq 1.0.0
- **Files modified:** None (runtime environment only)
- **Verification:** `import groq; print('groq', groq.__version__)` printed `groq 1.0.0`
- **Committed in:** N/A (pip install, not a code change)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing pip package)
**Impact on plan:** Auto-fix was necessary for import verification to pass. No scope creep.

## Issues Encountered

- `GROQ_API_KEY` exists in `.env` with an empty value. The `Groq()` client reads this lazily (on first `_get_groq()` call), so imports verify cleanly. A real key is required before running the pipeline end-to-end. The plan's `user_setup` spec documents this requirement.

## User Setup Required

A real `GROQ_API_KEY` is needed at `.env`:

```
GROQ_API_KEY=gsk_...
```

Obtain from: https://console.groq.com/keys

Verify with:
```bash
python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); assert os.environ.get('GROQ_API_KEY'), 'GROQ_API_KEY missing'"
```

## Next Phase Readiness

- `pipeline/script.py` exports `select_and_write()` — ready for 02-03 (TTS) to call it as the upstream stage
- 02-03 will call `select_and_write()` and pass the returned `list[Story]` to TTS generation
- Real `GROQ_API_KEY` must be configured before end-to-end pipeline testing

---
*Phase: 02-pipeline*
*Completed: 2026-02-24*
