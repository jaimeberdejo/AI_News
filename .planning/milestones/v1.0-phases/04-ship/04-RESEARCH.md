# Phase 4: Ship - Research

**Researched:** 2026-02-26
**Domain:** GitHub Actions CI/CD, Vercel deployment, real-device validation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | GitHub Actions cron job runs the pipeline automatically 1–2x per day | Schedule event with POSIX cron, ubuntu-latest runner with FFmpeg install, pip caching, all secrets stored as repository secrets and passed via `env:` |
</phase_requirements>

---

## Summary

Phase 4 has three distinct tracks: (1) a GitHub Actions workflow that runs the Python pipeline on a schedule, (2) a Vercel deployment of the Next.js frontend connected to the existing GitHub repo, and (3) real-device validation on iOS and Android. These tracks are mostly independent and can be implemented in parallel, but validation (track 3) requires both tracks 1 and 2 to be live first.

The GitHub Actions workflow is the most technically involved part of this phase. The pipeline requires five external secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY, OPENAI_API_KEY, PEXELS_API_KEY), system-level FFmpeg installed via `apt-get`, Python dependencies cached by `actions/cache`, and the faster-whisper model weights cached at `~/.cache/huggingface/` to stay within the 30-minute window. Without the HuggingFace model cache, the `tiny.en` model download alone adds ~3–5 minutes on first run.

Vercel deployment is straightforward for a Next.js App Router project: connect the GitHub repo, configure `frontend/` as the Root Directory, and set three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`). Vercel auto-deploys on every push to `main`. Supabase Storage CORS is a wildcard by default (`Access-Control-Allow-Origin: *`), meaning CORS verification for video streaming is confirming this is already working correctly — no configuration change is needed.

**Primary recommendation:** Write the GitHub Actions workflow first (it has the most moving parts), deploy Vercel immediately after (fast and low-risk), then validate on devices against the live URL.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `actions/checkout` | v4 | Check out repo code in runner | Official GH action, required first step |
| `actions/setup-python` | v5 | Install Python on ubuntu-latest | Official GH action, handles PATH |
| `actions/cache` | v4 | Cache pip + HuggingFace model | Official GH action, v4 required (v3 deprecated Feb 2025) |
| `ubuntu-latest` runner | (latest) | Pipeline execution environment | FFmpeg available via apt, Python available via setup-python |
| `apt-get install ffmpeg` | system | FFmpeg for video assembly | ubuntu-latest provides apt; `ffmpeg` package is current stable |
| Vercel (dashboard/CLI) | latest | Frontend deployment | Native Next.js platform, zero-config, free hobby tier |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `FedericoCarboni/setup-ffmpeg` | v3 | FFmpeg via action (alternative) | Only if `apt-get` proves too slow; apt is simpler and sufficient |
| Vercel CLI | latest | Manual prod deploys / debugging | Run locally for `vercel env pull`; not needed in CI (dashboard integration handles it) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `apt-get install ffmpeg` | `FedericoCarboni/setup-ffmpeg@v3` | Marketplace action adds version pinning and caching; apt is simpler and fine for our use case |
| Vercel GitHub integration (auto-deploy) | Vercel CLI in GitHub Actions | GitHub integration is zero-config and sufficient; CLI approach is needed only for GHES or custom build steps |
| Repository secrets | GitHub Environments with approval gates | Environments add reviewer gates — useful for production gating, but adds friction for a solo developer |

**Installation:**
```bash
# No npm install needed — all Actions use uses: syntax
# Vercel CLI (optional, for local debugging):
npm install -g vercel
```

---

## Architecture Patterns

### Recommended Project Structure

```
.github/
└── workflows/
    └── pipeline.yml        # Cron-triggered pipeline workflow
frontend/                   # Root Directory for Vercel project
    app/
    package.json
    next.config.ts (or .js)
pipeline/
    run.py
requirements.txt
.env.example
```

### Pattern 1: GitHub Actions Cron Pipeline Workflow

**What:** A single workflow file that runs the Python pipeline on a schedule, installs system deps, caches pip + HuggingFace model weights, and exposes API keys as environment variables.

**When to use:** Any time the pipeline needs to run without manual intervention.

**Example:**
```yaml
# Source: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
# Source: https://github.com/actions/cache/blob/main/examples.md

name: FinFeed Pipeline

on:
  schedule:
    - cron: '0 6 * * *'    # 6am UTC daily
    - cron: '0 18 * * *'   # 6pm UTC daily
  workflow_dispatch:         # Manual trigger for testing

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Cache pip dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-

      - name: Cache HuggingFace model (faster-whisper tiny.en)
        uses: actions/cache@v4
        with:
          path: ~/.cache/huggingface
          key: huggingface-faster-whisper-tiny-en-v1

      - name: Install system dependencies
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y ffmpeg

      - name: Install Python dependencies
        run: pip install -r requirements.txt

      - name: Run pipeline
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
        run: python -m pipeline.run
```

**Key decisions baked in:**
- `workflow_dispatch` added alongside `schedule` — enables manual trigger for testing before cron fires
- `timeout-minutes: 30` — enforces the success criterion; job fails rather than running indefinitely
- `apt-get update -qq` — `-qq` suppresses verbose output that would clutter logs
- Secrets passed via `env:` on the step, NOT as `--env` CLI args — prevents exposure in process listings
- HuggingFace cache key is static (no hash) because the model weights don't change between runs

### Pattern 2: Vercel Deployment via GitHub Integration

**What:** Connect the GitHub repo to a new Vercel project with `frontend/` as Root Directory. Vercel auto-deploys on every push to `main`.

**When to use:** All Next.js projects deployed to Vercel. No CI workflow needed — GitHub integration handles it natively.

**Steps (one-time setup):**
```
1. vercel.com/new → Import Git Repository → select FinFeed repo
2. Root Directory: frontend
3. Framework: Next.js (auto-detected)
4. Environment Variables: add all three (see below)
5. Deploy
```

**Environment variables to set in Vercel dashboard (Production):**
```
NEXT_PUBLIC_SUPABASE_URL       = https://yfryhktlkbemzyequgds.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key from Supabase dashboard>
NEXT_PUBLIC_APP_URL            = https://<your-project>.vercel.app   (update after first deploy)
```

**Critical:** `NEXT_PUBLIC_APP_URL` must be the production Vercel URL, not `localhost:3000`. The server-side fetch in `page.tsx` uses this to call `/api/today` during SSR.

### Pattern 3: Secrets Management

**What:** Repository secrets stored in GitHub, referenced in workflow with `${{ secrets.NAME }}`, injected into the step via `env:`.

**Security rules to follow:**
- NEVER pass secrets as CLI arguments (visible in `ps` output)
- NEVER print secrets with `echo` — even masked output risks partial leakage
- Use `env:` at the step level (not workflow/job level) to minimize scope
- Structured data (JSON blobs) confuses GitHub's automatic masking — keep secrets as flat strings

```yaml
# CORRECT — env at step level
- name: Run pipeline
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: python -m pipeline.run

# WRONG — secret in run command
- name: Run pipeline
  run: OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }} python -m pipeline.run
```

### Anti-Patterns to Avoid

- **Hardcoding `NEXT_PUBLIC_APP_URL=http://localhost:3000` in Vercel:** The SSR fetch in `page.tsx` hits this URL at build time on Vercel's servers, which can't reach localhost. Set it to the production Vercel URL.
- **No `workflow_dispatch` trigger:** Without it, you cannot manually trigger the workflow to verify it works before waiting for the cron window.
- **`apt-get install ffmpeg` without `sudo`:** GitHub Actions runner is not root by default; `sudo` is required.
- **Caching pip without a restore-keys fallback:** A cache miss with no restore-keys means every requirements.txt change starts from zero. The fallback `${{ runner.os }}-pip-` restores the closest previous cache.
- **No `timeout-minutes`:** If ffmpeg hangs or Pexels rate-limits, a workflow can run for hours burning free minutes. Always set a timeout.
- **Scheduling at exactly midnight UTC (00:00):** GitHub Actions docs explicitly warn this time suffers maximum delay due to high load. The project's target of 6am/6pm UTC is ideal — low contention.
- **Not verifying the workflow runs on `main` branch:** Scheduled workflows only trigger if the workflow file exists on the default branch. Push to `main` before expecting cron to work.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Python version management | Custom pyenv setup steps | `actions/setup-python@v5` | Handles PATH, caching hint, all architectures |
| Pip dependency caching | Manual tar/restore scripts | `actions/cache@v4` with `~/.cache/pip` path | Cache invalidation, atomic save/restore, race condition handling |
| FFmpeg installation | Download and compile from source | `sudo apt-get install ffmpeg` | ubuntu-latest has a recent FFmpeg in apt; compiling takes 10+ minutes |
| Secret injection | `.env` files committed or echoed in setup | `env:` block on step | GitHub masks secrets automatically; committed files leak to logs |
| Vercel deployment CI | Custom `vercel deploy` in GitHub Actions | Vercel GitHub integration | Native integration auto-deploys on push to `main`; no token management needed |

**Key insight:** The GitHub Actions built-in actions (`checkout`, `setup-python`, `cache`) handle all the cross-platform edge cases (cache eviction, partial cache hits, PATH manipulation) that hand-rolled scripts miss.

---

## Common Pitfalls

### Pitfall 1: faster-whisper model download on every run (blows 30-minute budget)
**What goes wrong:** The tiny.en model (~75 MB) downloads on first import. Without caching `~/.cache/huggingface/`, every pipeline run re-downloads it.
**Why it happens:** faster-whisper uses HuggingFace Hub, which caches in the home directory. GitHub Actions runner home directory is ephemeral.
**How to avoid:** Add a second `actions/cache@v4` step targeting `~/.cache/huggingface` with a static cache key (model weights are deterministic).
**Warning signs:** First run takes 5+ extra minutes; subsequent runs without caching take just as long.

### Pitfall 2: `NEXT_PUBLIC_APP_URL` set to localhost in Vercel production
**What goes wrong:** `page.tsx` is a Server Component that fetches `/api/today` using the absolute URL from `NEXT_PUBLIC_APP_URL`. In production, this hits `http://localhost:3000` which doesn't exist on Vercel's build servers — SSR fails, page renders with no content.
**Why it happens:** The local `.env.local` has `localhost:3000`; developers forget to update the Vercel dashboard variable after the first deploy.
**How to avoid:** Set `NEXT_PUBLIC_APP_URL` to `https://<project>.vercel.app` in Vercel's Production environment variables immediately after the first deploy URL is known.
**Warning signs:** App loads but shows no videos; network tab shows failed fetch to `http://localhost:3000`.

### Pitfall 3: Cron workflow never triggers because it only exists on non-default branch
**What goes wrong:** Scheduled workflows only trigger when the workflow YAML file is on the repository's default branch (`main`). If the workflow was created on a feature branch and the cron fires before the PR merges, it silently does nothing.
**Why it happens:** GitHub only evaluates `on.schedule` triggers against the default branch.
**How to avoid:** Always merge the workflow YAML to `main` before relying on cron. Test immediately with `workflow_dispatch` after merge.
**Warning signs:** Workflow appears in the Actions tab but has no run history; no runs appear at the scheduled time.

### Pitfall 4: GitHub Actions cron delayed 15–20 minutes (not a bug — known behavior)
**What goes wrong:** The 6am UTC run fires at 6:15–6:20am UTC. This is expected behavior and not a bug.
**Why it happens:** GitHub uses a shared runner pool. At scheduled time, GitHub queues the workflow; actual execution depends on runner availability. High-traffic periods cause delays.
**How to avoid:** Do not set time-sensitive alerts or SLA expectations on exact cron firing times. The 6am/6pm UTC schedule is low-traffic and will be close to on-time most days.
**Warning signs:** Cron appears to be "broken" when actually it's running 15 minutes late.

### Pitfall 5: CORS error from Vercel frontend fetching Supabase Storage video URLs
**What goes wrong:** `<video>` element makes a cross-origin request to `https://yfryhktlkbemzyequgds.supabase.co/storage/...`. If CORS headers are missing, video fails to load.
**Why it happens:** Supabase Storage uses a wildcard `Access-Control-Allow-Origin: *` by default for public buckets. This is correct and should already work. The error most likely indicates either (a) the bucket is not actually public, or (b) a range request (206 Partial Content) is being blocked.
**How to avoid:** Verify bucket is public (Storage → bucket → Public checkbox). Test a video URL directly in browser before blaming CORS. Check for `206 Partial Content` responses — range requests must be supported for video streaming.
**Warning signs:** Videos show error poster in browser dev tools; network tab shows CORS error or 403 on `.mp4` requests.

### Pitfall 6: `apt-get` taking too long and blowing the 30-minute timeout
**What goes wrong:** `apt-get update` on ubuntu-latest occasionally takes 2–3 minutes if mirror is slow.
**Why it happens:** ubuntu-latest package index refresh hits a slow mirror.
**How to avoid:** Use `apt-get update -qq && apt-get install -y ffmpeg` (quiet mode). The `-y` flag prevents interactive prompts. Consider timing this step in the first run; if it consistently exceeds 3 minutes, switch to `FedericoCarboni/setup-ffmpeg@v3`.
**Warning signs:** `Ign` and `Get:` lines fill the log for minutes; step takes over 3 minutes.

---

## Code Examples

Verified patterns from official sources:

### Schedule trigger with dual cron
```yaml
# Source: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
on:
  schedule:
    - cron: '0 6 * * *'   # 6am UTC
    - cron: '0 18 * * *'  # 6pm UTC
  workflow_dispatch:        # REQUIRED for manual testing
```

### Pip cache with restore-keys fallback
```yaml
# Source: https://github.com/actions/cache/blob/main/examples.md
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

### HuggingFace model cache (static key — weights are deterministic)
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/huggingface
    key: huggingface-faster-whisper-tiny-en-v1
```

### Step-level secret injection (correct pattern)
```yaml
# Source: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- name: Run pipeline
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
  run: python -m pipeline.run
```

### FFmpeg install (quiet, non-interactive)
```bash
# In GitHub Actions run: block
sudo apt-get update -qq
sudo apt-get install -y ffmpeg
```

### Vercel — required environment variables (Production)
```
NEXT_PUBLIC_SUPABASE_URL       = https://yfryhktlkbemzyequgds.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
NEXT_PUBLIC_APP_URL            = https://<project>.vercel.app
```
Note: `NEXT_PUBLIC_APP_URL` must be updated to the production URL after first deploy. It is used in the server-side `page.tsx` fetch for SSR.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/cache@v3` | `actions/cache@v4` | Feb 2025 | v3 deprecated; v4 required for new cache backend service |
| `actions/checkout@v3` | `actions/checkout@v4` | late 2023 | v3 still works but v4 is current |
| `actions/setup-python@v4` | `actions/setup-python@v5` | 2024 | v5 is current; v4 still functional |
| Vercel CLI in GitHub Actions | Vercel GitHub integration | N/A | Integration auto-deploys on push; CLI only needed for custom build steps or GHES |

**Deprecated/outdated:**
- `@actions/cache` before v4: deprecated, upgrade required before February 1st 2025 (per official toolkit discussion)
- `github.silent` in `vercel.json`: deprecated, replaced by UI toggle in project settings

---

## Open Questions

1. **Will the 30-minute timeout be achievable on first run (cold cache)?**
   - What we know: pip install is ~60 seconds cached; HuggingFace model is ~75 MB (~2–3 min); FFmpeg apt install is ~1–2 min; pipeline execution on real news day is ~5–15 min (5 videos × 2–3 min each)
   - What's unclear: Total cold-start time has not been measured on ubuntu-latest. First run (no caches populated) could be 20–28 minutes, leaving little margin.
   - Recommendation: Add `timeout-minutes: 45` initially, measure first run time, then tighten to 30 if consistently under. The success criterion is "within 30 minutes" — warm runs will be well under 30 min once caches are populated.

2. **Does the `page.tsx` server-side fetch work correctly in Vercel's serverless environment?**
   - What we know: `NEXT_PUBLIC_APP_URL` drives the absolute URL; the server component fetches `/api/today`
   - What's unclear: On Vercel, Next.js API routes are serverless functions. A server component calling another route in the same deployment should work (same origin), but the absolute URL must match exactly.
   - Recommendation: After first deploy, verify the `/api/today` route returns correct data in the Vercel function logs. Consider switching the server component to call Supabase directly (skipping the HTTP hop) if issues arise.

3. **Supabase Storage CORS — range requests (206 Partial Content) support**
   - What we know: Supabase Storage public buckets use `Access-Control-Allow-Origin: *`. The bucket was configured with CORS in Phase 1. The decision log confirms: "Public bucket (not signed URLs) — public-access app".
   - What's unclear: Whether range request headers (`Range`, `Accept-Ranges`) are properly reflected in CORS preflight responses from Supabase Storage.
   - Recommendation: During validation (Plan 04-03), verify video loads in Safari on iOS (most strict range request behavior). If CORS errors appear on range requests, Supabase support is the escalation path — there is no dashboard CORS config for Storage.

---

## Validation Architecture

Config `workflow.nyquist_validation` is not present in `.planning/config.json` (the key is absent from the `workflow` object), so the standard Nyquist validation section is omitted. Phase 4 validation is manual (real device testing per success criteria) and not automated test coverage.

The success criteria for Phase 4 are inherently end-to-end and manual-only:
- GitHub Actions cron trigger timing — observable in Actions tab, not unit-testable
- iOS Safari tap-to-unmute — requires real hardware (noted as blocker in STATE.md)
- "You're up to date" screen after last video — requires a live published edition

---

## Sources

### Primary (HIGH confidence)
- `/websites/github_en_actions` (Context7) — schedule event syntax, secrets env injection, workflow YAML patterns
- `/actions/cache` (Context7) — pip caching pattern, restore-keys, v4 requirement
- `https://docs.github.com/en/actions/security-guides/encrypted-secrets` — secret injection best practices, env vs CLI
- `https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows` — cron schedule constraints, default branch requirement
- `https://vercel.com/docs/environment-variables` — environment variable scopes, NEXT_PUBLIC behavior
- `https://vercel.com/docs/git/vercel-for-github` — auto-deploy from GitHub, root directory, production branch

### Secondary (MEDIUM confidence)
- WebSearch on GitHub Actions FFmpeg — confirmed `FedericoCarboni/setup-ffmpeg@v3` as marketplace alternative; apt-get is simpler for ubuntu-latest
- WebSearch on GitHub Actions cron delays — confirmed 15–20 min delays at high-load times; 6am/6pm UTC is low-contention
- WebSearch on Supabase Storage CORS — confirmed wildcard `*` default; PostgREST per-origin config exists but is proxy-overridden

### Tertiary (LOW confidence)
- WebSearch on faster-whisper HuggingFace cache path (`~/.cache/huggingface`) — consistent with multiple sources but not verified against official faster-whisper docs. If the model caches elsewhere, the cache step will miss.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core actions verified via Context7 official docs; versions confirmed
- Architecture: HIGH — GitHub Actions workflow pattern confirmed from official examples; Vercel GitHub integration confirmed from official docs
- Pitfalls: MEDIUM-HIGH — cron delay and NEXT_PUBLIC_APP_URL pitfalls verified with official documentation; HuggingFace cache path is MEDIUM (WebSearch only)

**Research date:** 2026-02-26
**Valid until:** 2026-08-26 (stable tooling; GitHub Actions action versions and Vercel integration change slowly)
