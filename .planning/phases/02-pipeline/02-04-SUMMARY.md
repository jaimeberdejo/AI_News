---
phase: 02-pipeline
plan: 04
subsystem: video
tags: [pexels, ffmpeg, subprocess, requests, video-assembly, ass-subtitles, b-roll]

# Dependency graph
requires:
  - phase: 02-pipeline
    provides: pipeline/models.py — Story dataclass with position field used by assemble()
provides:
  - pipeline/video.py with download_broll(keyword, tmp_dir) and assemble(broll_path, audio_path, ass_path, tmp_dir, position)
  - Pexels portrait HD b-roll download with stock market fallback
  - FFmpeg subprocess assembly at 720x1280 with burned-in ASS subtitles
  - 10 MB file size enforcement via CRF 28 -> CRF 32 re-encode fallback
affects: [02-05-run, 03-player, phase-testing]

# Tech tracking
tech-stack:
  added: [requests (already installed), ffmpeg (system binary — brew install ffmpeg required)]
  patterns: [subprocess.run for FFmpeg (not ffmpeg-python wrapper), scale+crop before ass filter to prevent distortion, CRF-based size control with fallback re-encode]

key-files:
  created: [pipeline/video.py]
  modified: []

key-decisions:
  - "subprocess.run for FFmpeg (not ffmpeg-python) — plan pre-decided this; ffmpeg-python has known ASS filter bug on macOS"
  - "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280 — plain scale distorts non-9:16 clips"
  - "ASS path uses forward slashes and relies on /tmp/ (no spaces) for FFmpeg filtergraph parser safety"
  - "CRF 28 first pass; warn-and-continue (not error) if still >10 MB after CRF 32 — high-motion b-roll can't always hit 10 MB"
  - "PEXELS_API_KEY already scaffolded in .env (empty) — user must populate before plan 05 runtime"
  - "FFmpeg not installed on dev machine — user must run brew install ffmpeg before plan 05 end-to-end test"

patterns-established:
  - "B-roll download: try primary keyword, fall back to 'stock market' — ensures content always available"
  - "FFmpeg gate: _check_ffmpeg() called at assemble() start, not at import time — graceful deferred failure"
  - "Stream-loop pattern: -stream_loop -1 with -shortest loops b-roll to match audio length exactly"
  - "-movflags +faststart: always set for progressive web playback compatibility"

requirements-completed: [VIDEO-01, VIDEO-02, VIDEO-03]

# Metrics
duration: 1min
completed: 2026-02-24
---

# Phase 2 Plan 04: Video Pipeline Summary

**Pexels portrait HD b-roll download with FFmpeg 720x1280 assembly, burned-in ASS subtitles, and automatic CRF 32 re-encode if output exceeds 10 MB**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-24T23:27:53Z
- **Completed:** 2026-02-24T23:29:08Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments
- `download_broll()`: fetches first portrait HD clip from Pexels API for a keyword, falls back to "stock market" if no portrait HD result found
- `assemble()`: drives FFmpeg subprocess with scale/crop/ass filter chain, loops b-roll with -stream_loop -1 -shortest, outputs 720x1280 MP4 with burned-in subtitles
- VIDEO-03 enforced: checks file size after CRF 28 encode; auto re-encodes at CRF 32 if > 10 MB; logs warning-and-continues if still over (high-motion clips)
- `_check_ffmpeg()`: validates FFmpeg binary at assemble() call time, raises RuntimeError with brew/apt install instructions if missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/video.py — Pexels b-roll download and FFmpeg video assembly** - `b10470f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `pipeline/video.py` — Pexels b-roll download (`download_broll`) and FFmpeg video assembly (`assemble`) with 10 MB size enforcement

## Decisions Made
- subprocess.run for FFmpeg (not ffmpeg-python) — plan pre-decided; avoids known ASS filter bug on macOS
- scale+crop pattern prevents distortion of non-9:16 portrait clips from Pexels
- Warn-and-continue (not hard-error) if still >10 MB after CRF 32 — high-motion b-roll cannot always hit 10 MB
- PEXELS_API_KEY already in .env scaffold (empty) — user action required before plan 05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**User setup pending (not blocking this plan):**
- PEXELS_API_KEY is in .env but empty — user must get API key from https://www.pexels.com/api/ and populate .env before plan 05 runs
- FFmpeg not installed on dev machine — user must run `brew install ffmpeg` before plan 05 end-to-end integration test

Both are documented as `user_setup` in the plan frontmatter and are expected gates before plan 05.

## User Setup Required

Two items must be completed before plan 05 (end-to-end integration) can run:

1. **Pexels API key:** Get from https://www.pexels.com/api/ and set `PEXELS_API_KEY=<your-key>` in `.env`
2. **FFmpeg:** Install with `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)

Verification commands:
```bash
python3 -c "import os; from dotenv import load_dotenv, find_dotenv; load_dotenv(find_dotenv()); print('Pexels key:', bool(os.environ.get('PEXELS_API_KEY')))"
ffmpeg -version 2>&1 | head -1
```

## Next Phase Readiness
- `pipeline/video.py` is complete and imports cleanly
- All three VIDEO requirements (VIDEO-01, VIDEO-02, VIDEO-03) are implemented and verified in source
- Ready for use in `run.py` (plan 05) once user setup items are completed
- FFmpeg binary absence is a known gate — _check_ffmpeg() will raise a clear RuntimeError with install instructions at runtime

---
*Phase: 02-pipeline*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: pipeline/video.py
- FOUND: .planning/phases/02-pipeline/02-04-SUMMARY.md
- FOUND: commit b10470f (feat(02-04): create pipeline/video.py)
