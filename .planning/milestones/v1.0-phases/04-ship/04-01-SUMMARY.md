---
phase: "04-ship"
plan: "01"
subsystem: "ci-cd"
tags: ["github-actions", "automation", "cron", "secrets", "caching"]
dependency_graph:
  requires: []
  provides: ["AUTO-01", "github-actions-workflow"]
  affects: ["pipeline.run", ".env.example"]
tech_stack:
  added: ["GitHub Actions (ubuntu-latest)", "actions/cache@v4", "actions/setup-python@v5"]
  patterns: ["step-level secrets injection", "pip cache with restore-keys fallback", "static HuggingFace model cache key"]
key_files:
  created:
    - ".github/workflows/pipeline.yml"
  modified:
    - ".env.example"
decisions:
  - "timeout-minutes: 45 not 30 — first cold-cache run estimated 20-28 min; 45 gives headroom to tighten after measuring"
  - "HuggingFace cache key is static (huggingface-faster-whisper-tiny-en-v1) — model weights are deterministic"
  - "Secrets in env: block on Run pipeline step ONLY — not at job/workflow level, not as CLI args"
  - "actions/cache@v4 (not v3) — v3 deprecated Feb 2025, v4 required for new cache backend"
  - "apt-get update -qq quiet flag — suppresses verbose mirror output that clutters CI logs"
metrics:
  duration_seconds: 70
  completed_date: "2026-02-26"
  tasks_completed: 2
  files_changed: 2
---

# Phase 04 Plan 01: GitHub Actions Cron Workflow Summary

**One-liner:** Dual-cron GitHub Actions workflow (6am/6pm UTC) with step-level secrets injection, pip and HuggingFace model caches, FFmpeg install, and 45-minute timeout.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create GitHub Actions pipeline workflow | f928936 | `.github/workflows/pipeline.yml` (created) |
| 2 | Add GitHub repository secrets to .env.example | 8b5061f | `.env.example` (appended) |

## What Was Built

`.github/workflows/pipeline.yml` — a single 51-line workflow file that:

- Triggers on dual cron schedule: `0 6 * * *` (6am UTC) and `0 18 * * *` (6pm UTC), plus `workflow_dispatch` for manual testing
- Runs on `ubuntu-latest` with Python 3.11
- Caches `~/.cache/pip` keyed on `hashFiles('requirements.txt')` with `restore-keys` fallback for partial hits
- Caches `~/.cache/huggingface` with static key `huggingface-faster-whisper-tiny-en-v1` — model weights are deterministic
- Installs FFmpeg via `sudo apt-get install -y ffmpeg` with `-qq` quiet flag
- Injects all 5 pipeline secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `PEXELS_API_KEY`) via `env:` block on the `Run pipeline` step only — never at job or workflow level
- Enforces `timeout-minutes: 45` to prevent indefinite runs

`.env.example` — appended a "GitHub Actions: Repository Secrets" section documenting where to obtain each of the 5 required secrets for the repository settings.

## Decisions Made

1. **45-minute timeout (not 30):** Research estimated first cold-cache run at 20-28 min. 45 gives headroom. Tighten to 30 after measuring real run times.
2. **Static HuggingFace cache key:** Model weights for `faster-whisper tiny.en` are deterministic — a static key avoids unnecessary cache busting.
3. **Step-level secrets only:** Secrets injected at job or workflow level appear in runner environment dumps; step-level scope minimizes exposure surface.
4. **actions/cache@v4:** v3 deprecated February 2025 per GitHub Actions docs. v4 required for the new cache backend service.

## Deviations from Plan

None — plan executed exactly as written.

**Note on YAML verification:** PyYAML parses the `on:` key as boolean `True` (YAML 1.1 spec treats `on` as truthy). The plan's verification script used `data['on']` which raises `KeyError`. Ran an equivalent verification using `data.get(True)` which confirmed all structural requirements. GitHub Actions itself handles the `on:` key correctly — this is a PyYAML quirk only.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `.github/workflows/pipeline.yml` | FOUND |
| `.env.example` (modified) | FOUND |
| `04-01-SUMMARY.md` | FOUND |
| Commit f928936 (pipeline.yml) | FOUND |
| Commit 8b5061f (.env.example) | FOUND |
