---
phase: 02-pipeline
plan: 03
subsystem: pipeline
tags: [openai, tts, faster-whisper, whisper, ass-subtitles, audio, ffmpeg]

# Dependency graph
requires:
  - phase: 02-01
    provides: pipeline/models.py with Story dataclass (position, script_text fields)
provides:
  - pipeline/audio.py with generate(story, tmp_dir) -> tuple[Path, Path]
  - OpenAI tts-1 streaming MP3 generation (AUDIO-01)
  - faster-whisper tiny.en word-level timestamp alignment (AUDIO-02)
  - ASS subtitle file generation (3-word chunks, H:MM:SS.cs, bottom-center) (AUDIO-03)
affects: [02-04, 02-05, video-rendering, ffmpeg-filtergraph]

# Tech tracking
tech-stack:
  added: [faster-whisper>=1.0.0, openai>=1.0.0 (already in requirements)]
  patterns:
    - Module-level singleton pattern for expensive model initialization
    - Streaming response pattern for TTS to avoid memory buffering
    - Generator materialization pattern (list() before scope exit)

key-files:
  created: [pipeline/audio.py]
  modified: []

key-decisions:
  - "voice=onyx for TTS — deep male voice suits financial news tone"
  - "faster-whisper tiny.en device=cpu compute_type=int8 — CPU-only, quantized for speed"
  - "3-word subtitle chunks — balances readability with synchronization timing"
  - "Module-level _whisper singleton — avoids 75 MB download on every story; one download per process"

patterns-established:
  - "Singleton pattern: _get_openai() and _get_whisper() lazy-init globals — prevents repeated model loading"
  - "Generator materialization: segments = list(segments_gen) immediately after transcribe() — faster-whisper generator is lazy"
  - "Streaming TTS: with_streaming_response.create() + stream_to_file() — no full audio in memory"
  - "FFmpeg-safe paths: ASS files written to tmp_dir (from tempfile.mkdtemp(), no spaces) — avoids filtergraph parse errors"

requirements-completed: [AUDIO-01, AUDIO-02, AUDIO-03]

# Metrics
duration: ~2min
completed: 2026-02-24
---

# Phase 2 Plan 03: Audio Summary

**OpenAI tts-1 streaming TTS, faster-whisper tiny.en word alignment, and ASS subtitle file generation with 3-word chunks in pipeline/audio.py**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T23:27:47Z
- **Completed:** 2026-02-24T23:29:28Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Created pipeline/audio.py with generate(story, tmp_dir) -> tuple[Path, Path] public API
- AUDIO-01: TTS via OpenAI tts-1 using streaming response to file — no audio loaded into memory
- AUDIO-02: faster-whisper tiny.en alignment with generator materialized via list() before scope exit
- AUDIO-03: ASS subtitle file with correct ASS header (PlayResX/Y 720/1280), H:MM:SS.cs timestamps, 3-word chunks at bottom-center (Alignment=2)
- Module-level singletons for OpenAI and WhisperModel — model downloaded once per process

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/audio.py — TTS generation, Whisper alignment, and ASS subtitle writing** - `397ece3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `pipeline/audio.py` - TTS generation, faster-whisper alignment, ASS subtitle writing; exports generate(story, tmp_dir) -> tuple[Path, Path]

## Decisions Made

- voice=onyx for TTS — deep male voice suits financial news tone
- faster-whisper tiny.en with device="cpu" compute_type="int8" — CPU-only, quantized for speed on GitHub Actions
- 3-word subtitle chunks — balances readability with synchronization accuracy
- Module-level _whisper singleton to avoid 75 MB re-download per story

## Deviations from Plan

None — plan executed exactly as written.

Note: `faster-whisper` was not yet installed (requirements.txt listed it but pip install hadn't been run). Installed it as part of task execution per plan instructions (Rule 3 — dependency install blocked import). Package is now available.

## Issues Encountered

- `OPENAI_API_KEY` is empty in .env — this is expected; key will be provided before live pipeline runs. Import-level verification passes cleanly since the OpenAI client is lazy-initialized.

## User Setup Required

**OPENAI_API_KEY must be set before the pipeline runs.**

To add it:
1. Visit https://platform.openai.com/api-keys
2. Create a new secret key
3. Add to `.env` at repo root: `OPENAI_API_KEY=sk-...`

Verification:
```bash
python3 -c "import os; from dotenv import load_dotenv, find_dotenv; load_dotenv(find_dotenv()); assert os.environ.get('OPENAI_API_KEY'), 'missing'; print('OPENAI_API_KEY present')"
```

## Next Phase Readiness

- pipeline/audio.py is ready — generate(story, tmp_dir) returns (mp3_path, ass_path) for FFmpeg video assembly
- Both paths land in tmp_dir (no spaces) — FFmpeg libass filter can use them directly
- OPENAI_API_KEY must be populated in .env before first pipeline run
- Plan 02-04 (Pexels video fetch) and 02-05 (FFmpeg assembly) can now use audio.py outputs

## Self-Check: PASSED

- FOUND: pipeline/audio.py
- FOUND commit: 397ece3

---
*Phase: 02-pipeline*
*Completed: 2026-02-24*
