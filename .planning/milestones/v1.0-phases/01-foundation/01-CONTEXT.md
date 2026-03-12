# Phase 1: Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the Supabase infrastructure — Postgres schema, storage bucket configuration, and the API endpoint that both the pipeline and frontend will use. This phase delivers the data foundation that all subsequent phases depend on. Pipeline logic and frontend UI are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Repo Structure
- Monorepo: single FinFeed repository containing both pipeline and frontend
- Directory layout: `/pipeline/` for Python, `/frontend/` for Next.js
- Python pipeline structure: Claude's discretion (package structure recommended for a multi-step pipeline)
- Shared `.env` at repo root — loaded by both pipeline (python-dotenv) and Next.js (auto-loaded)
- `.env.example` at repo root with all required keys documented

### DB Schema
- **editions table**: One edition per calendar day. Claude decides whether to support multiple runs per day (e.g. morning/evening) or keep it simple with date as unique key.
- **videos table**: Each video record stores: `position` (1-5), `headline` (story title), `script_text` (full LLM script), `source_url` (original article), `video_url` (Supabase Storage CDN URL), `edition_id` (FK)
- **pipeline_runs table**: Both edition-level status AND per-video status tracking
  - Edition-level: `pending / publishing / published / partial / failed`
  - Per-video: `pending / generating / uploading / ready / failed`
- Cleanup strategy for 7-day retention: Claude's discretion (simple hard delete is fine for MVP)

### Environment Strategy
- **Single Supabase project** — dev and prod share the same project for MVP speed
- All API keys (Supabase, Groq, OpenAI, Pexels) stored as environment variables only — never hardcoded
- Keys read via `os.environ` in pipeline (works with `.env` locally and GitHub Actions Secrets in CI)
- RLS policy: Public read with service-key write — anyone can read editions/videos (no auth for v1), only the pipeline service key can insert/update/delete. This matches the open-access MVP design.

### API Contract
- **Next.js API route** at `/api/today` (server-side, keeps service key off the client)
- Returns: the most recent published edition with its 5 video records — always return latest even if it's yesterday's (Claude's call: better UX than empty state during pipeline window)
- Video URLs: Direct Supabase Storage public CDN URLs (no signed URLs — public bucket, no expiry complexity)
- No API versioning — just `/api/today` for MVP

### Claude's Discretion
- Python pipeline internal package structure
- Whether editions support one-per-day or multiple-per-day (recommend: one per day for MVP simplicity)
- Hard delete vs soft delete for 7-day cleanup (recommend: hard delete for MVP)
- RLS exact policy syntax
- Supabase Storage bucket name and folder structure
- Exact JSON response shape for `/api/today` (beyond: edition metadata + array of 5 video objects)

</decisions>

<specifics>
## Specific Ideas

- The `.env` at repo root is the single source of truth for all credentials — no per-project env files
- The API route at `/api/today` should always return something (latest edition) so the frontend never shows an empty state due to pipeline timing
- RLS should be set up correctly from day one — "public read, service-key write" is the right policy for an open-access app without user accounts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-24*
