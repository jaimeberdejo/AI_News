---
phase: 02-pipeline
plan: 05
subsystem: pipeline
tags: [supabase-storage, python, ffmpeg, pipeline-orchestration, cleanup, audit-log]

# Dependency graph
requires:
  - phase: 02-pipeline
    provides: ingest.py (RSS fetch+dedup), script.py (Groq selection+scripting), audio.py (TTS+Whisper+ASS), video.py (Pexels b-roll+FFmpeg)
  - phase: 01-foundation
    provides: Supabase project, videos bucket, editions/videos/pipeline_runs DB schema
provides:
  - "pipeline/storage.py — upload_video(), publish_edition(), cleanup_old_editions() against Supabase 'videos' bucket"
  - "pipeline/run.py — end-to-end orchestrator with per-story error isolation, deduplication, and audit logging"
  - "Confirmed end-to-end pipeline: 5 stories, 5 MP4s uploaded, edition published=published, pipeline_runs=complete"
affects: [03-api, 04-frontend, 05-scheduler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-story try/except error isolation — one story failure does not abort remaining stories (AUTO-02)"
    - "pipeline_runs audit row: insert with status=running at start, PATCH to complete/partial/failed at end (AUTO-03)"
    - "Edition dedup guard in script.py raises RuntimeError on published re-run, handled as clean skip in run.py"
    - "7-day storage cleanup: query editions.lt(cutoff).not_deleted → list()+remove() Supabase Storage → mark DB deleted (VIDEO-04)"

key-files:
  created:
    - pipeline/storage.py
    - pipeline/run.py
  modified:
    - pipeline/video.py (bug fix: subtitles= filter, ffprobe duration)

key-decisions:
  - "upload_video() uses upsert=true — handles re-uploads on partial re-runs without 409 conflict errors"
  - "publish_edition() sets edition status to 'partial' if any story failed, 'published' if all ready"
  - "cleanup_old_editions() uses lt(cutoff)+not_deleted guard — idempotent, safe to run on every pipeline invocation"
  - "ffmpeg subtitles= filter instead of ass= — required for ffmpeg-full build with libass on macOS"
  - "ffprobe probe + -t flag instead of -shortest — -shortest hangs indefinitely with MP3 input in ffmpeg-full"

patterns-established:
  - "Pipeline entry point: python -m pipeline.run invokes run() via __main__ block"
  - "Temp dir per story: tempfile.mkdtemp() + shutil.rmtree(ignore_errors=True) in finally block"
  - "Modular stage logging: === Stage N: Name === banners for clean log parsing"

requirements-completed: [VIDEO-04, AUTO-02, AUTO-03]

# Metrics
duration: ~45min (including human verification of end-to-end run)
completed: 2026-02-25
---

# Phase 2 Plan 5: Pipeline Integration Summary

**Full pipeline wired end-to-end: 5 financial news stories scripted by Groq, TTS+Whisper audio, Pexels b-roll, FFmpeg MP4 assembly, uploaded to Supabase Storage with burned-in subtitles — edition published as 'published' in 2m 46s**

## Performance

- **Duration:** ~45 min (including end-to-end run + verification)
- **Started:** 2026-02-25T09:00:00Z
- **Completed:** 2026-02-25T09:10:42Z
- **Tasks:** 3 (2 auto, 1 checkpoint:human-verify — approved)
- **Files modified:** 3 (storage.py created, run.py created, video.py bug-fixed)

## Accomplishments

- Created `pipeline/storage.py` with upload_video(), publish_edition(), and cleanup_old_editions() targeting the 'videos' Supabase Storage bucket
- Created `pipeline/run.py` as the `python -m pipeline.run` entry point, wiring all 5 pipeline stages with per-story error isolation (AUTO-02), deduplication, and pipeline_runs audit logging (AUTO-03)
- Verified end-to-end: 5 stories assembled into 5 MP4s uploaded to Supabase CDN, playable in browser with visible subtitles and audible financial audio
- Deduplication confirmed: second run on same day logs "Edition for 2026-02-25 already published. Skipping re-run." and exits cleanly in under 2 seconds
- 7-day cleanup logic (VIDEO-04) implemented and verified idempotent
- Two bugs in pipeline/video.py fixed during verification (committed separately as efdd1a1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/storage.py** - `1a002d7` (feat)
2. **Task 2: Create pipeline/run.py** - `1017986` (feat)
3. **Task 3: End-to-end pipeline verification** - Approved by human; verification checks confirmed in post-approval session

**Bug fixes during verification:** `efdd1a1` (fix — pipeline/video.py: subtitles= filter + ffprobe duration)

## Files Created/Modified

- `pipeline/storage.py` — Supabase Storage upload, edition DB publish (published/partial), 7-day storage+DB cleanup
- `pipeline/run.py` — Full orchestrator: RSS ingest → Groq selection → per-story audio+video+upload loop → publish → cleanup → audit update
- `pipeline/video.py` — Bug-fixed: `subtitles=` filter (libass compatibility), `ffprobe` probe + `-t` flag (MP3 hang fix)

## Decisions Made

- **upsert=true in upload_video():** Handles re-uploads on partial re-runs without 409 conflict errors. Safe idempotent behavior.
- **subtitles= filter instead of ass=:** ffmpeg-full build on macOS requires `subtitles=` for libass; `ass=` produces "filter not found" error
- **ffprobe probe + -t flag instead of -shortest:** `-shortest` hangs indefinitely when MP3 input has no fixed-length stream in ffmpeg-full; probing audio duration and passing `-t` explicitly resolves the hang
- **partial vs published edition status:** If any story fails, edition is published as 'partial' so the frontend can still serve the successful stories rather than hiding the whole edition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed subtitles= filter for libass FFmpeg assembly**
- **Found during:** Task 3 (end-to-end verification run)
- **Issue:** `ass=` filter not found in ffmpeg-full build; subtitle burning silently skipped
- **Fix:** Changed to `subtitles=` filter which maps to libass in ffmpeg-full
- **Files modified:** pipeline/video.py
- **Verification:** MP4s uploaded to Supabase play with visible burned-in subtitles in browser
- **Committed in:** efdd1a1 (separate fix commit during verification)

**2. [Rule 1 - Bug] Fixed MP3 duration hang with ffprobe + -t flag**
- **Found during:** Task 3 (end-to-end verification run)
- **Issue:** `-shortest` flag causes ffmpeg to hang indefinitely when audio input is MP3; process never terminates
- **Fix:** Probe exact audio duration with `ffprobe -v quiet -show_entries format=duration`, pass as `-t {duration}` to ffmpeg
- **Files modified:** pipeline/video.py
- **Verification:** All 5 stories assembled without hang; pipeline completed in 2m 46s total
- **Committed in:** efdd1a1 (separate fix commit during verification)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug, both in pipeline/video.py)
**Impact on plan:** Both fixes essential for correct MP4 assembly. No scope creep. Video pipeline now robust against libass filter naming and MP3 stream termination edge cases.

## Issues Encountered

- First pipeline run (00:37 UTC) left a `running` status pipeline_run row (likely a test run that was interrupted before the end-of-run PATCH). The 09:01 run succeeded with status=complete and correct finished_at. The orphaned row has no impact on pipeline logic.

## User Setup Required

None — all external service configuration (PEXELS_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, SUPABASE keys, ffmpeg) was completed prior to this plan.

## Next Phase Readiness

- Phase 2 complete: all 5 pipeline plans executed, end-to-end pipeline verified
- `python -m pipeline.run` is the production entry point — ready to be wired into GitHub Actions cron
- Phase 3 (API) is unblocked: /api/today endpoint can now query editions+videos tables populated by this pipeline
- Phase 4 (Frontend) is unblocked: MP4 CDN URLs in videos.video_url are publicly accessible

---
*Phase: 02-pipeline*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: pipeline/storage.py
- FOUND: pipeline/run.py
- FOUND: .planning/phases/02-pipeline/02-05-SUMMARY.md
- FOUND: commit 1a002d7 (feat: storage.py)
- FOUND: commit 1017986 (feat: run.py)
- FOUND: commit efdd1a1 (fix: video.py bugs)
- Edition status=published confirmed in Supabase
- Deduplication confirmed (second run exits cleanly in <2s)
- pipeline_runs row status=complete with non-null finished_at confirmed
