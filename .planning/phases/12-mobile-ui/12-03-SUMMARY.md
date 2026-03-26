---
phase: 12-mobile-ui
plan: "03"
subsystem: pipeline-thumbnail + frontend-profile-layout
tags: [pipeline, ffmpeg, thumbnail, ios-pwa, profile, layout, sticky]
dependency_graph:
  requires: [12-02-PLAN.md]
  provides: [thumbnail_url in DB, static JPEG thumbnails in VideoGrid, sticky ProfilePage tab bar]
  affects: [pipeline/video.py, pipeline/storage.py, pipeline/run.py, VideoGrid.tsx, ProfilePage.tsx]
tech_stack:
  added: []
  patterns:
    - FFmpeg -ss 0.5 -vframes 1 JPEG extraction for video thumbnails
    - Non-fatal try/except wrapping for pipeline enhancement steps
    - position:sticky inner tab bar pattern within scrollable container
    - calc(env(safe-area-inset-bottom) + 56px + 16px) for TabBar-aware paddingBottom
    - img + placeholder pattern replacing video preload="metadata" for iOS PWA compatibility
key_files:
  created:
    - supabase/migrations/20260326000000_add_thumbnail_url.sql
  modified:
    - pipeline/models.py
    - pipeline/video.py
    - pipeline/storage.py
    - pipeline/run.py
    - frontend/hooks/useEdition.ts
    - frontend/app/api/today/route.ts
    - frontend/components/VideoGrid.tsx
    - frontend/components/ProfilePage.tsx
decisions:
  - "[Phase 12-03]: extract_thumbnail uses -ss 0.5 to skip common black first frame from b-roll; 0.5s offset is safe for all assembled videos"
  - "[Phase 12-03]: thumbnail upload is non-fatal — pipeline still publishes video even if FFmpeg thumbnail extraction fails"
  - "[Phase 12-03]: GridVideo.thumbnail_url is optional (?) so existing callers (profile liked/saved routes) don't need to provide it; VideoGrid shows placeholder for null/undefined"
  - "[Phase 12-03]: ProfilePage paddingBottom updated from hardcoded 80px to calc(env(safe-area-inset-bottom) + 56px + 16px) for safe-area-correct TabBar clearance on iPhone 14+"
metrics:
  duration: "~3 min"
  completed: "2026-03-26"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 8
  files_created: 1
---

# Phase 12 Plan 03: Thumbnail Pipeline + ProfilePage Layout Summary

**One-liner:** FFmpeg JPEG thumbnail extraction at 0.5s per assembled MP4, uploaded to Supabase Storage and stored in `thumbnail_url` DB column; VideoGrid switches from `<video preload="metadata">` to `<img>` with placeholder for iOS PWA reliability; ProfilePage Liked/Saved tab bar made sticky with safe-area-correct paddingBottom.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | DB migration + pipeline thumbnail generation | bf14621 | Complete |
| 2 | Frontend thumbnail integration + ProfilePage layout fixes | d010d40 | Complete |
| 3 | Human verification — full Phase 12 mobile UI check | — | Awaiting checkpoint |

## Pipeline Changes

**`supabase/migrations/20260326000000_add_thumbnail_url.sql`** — Adds `thumbnail_url text` column to `videos` table using `IF NOT EXISTS`. Pending manual `supabase db push` or SQL editor apply.

**`pipeline/models.py`** — `VideoResult` dataclass gains `thumbnail_url: Optional[str] = None` after `error` field.

**`pipeline/video.py`** — New `extract_thumbnail(mp4_path, tmp_dir, position)` function: runs `ffmpeg -y -i {mp4} -ss 0.5 -vframes 1 -q:v 2 {thumb.jpg}`, raises `RuntimeError` on non-zero exit.

**`pipeline/storage.py`** — New `upload_thumbnail(local_path, edition_id, position, edition_date, category)` function: uploads JPEG to `editions/{category}-{date}-{id[:8]}/{position}_thumb.jpg` in the `videos` bucket, returns public CDN URL. `publish_edition()` updated to conditionally include `thumbnail_url` in the video row update when `result.thumbnail_url` is truthy.

**`pipeline/run.py`** — After `video.assemble()`, wraps `extract_thumbnail` + `upload_thumbnail` in a non-fatal `try/except`. Sets `thumb_url` on `VideoResult`. A thumbnail failure logs a warning and the pipeline continues normally.

## DB Migration Status

**Pending** — Migration file created at `supabase/migrations/20260326000000_add_thumbnail_url.sql`. Must be applied to production before new pipeline runs. Apply via:
- `supabase db push` (CLI), or
- Copy SQL into Supabase Dashboard → SQL Editor → Run

## Frontend Changes

**`frontend/hooks/useEdition.ts`** — `Video` interface gains `thumbnail_url: string | null`.

**`frontend/app/api/today/route.ts`** — `thumbnail_url` added to the embedded `videos (...)` select list.

**`frontend/components/VideoGrid.tsx`** — `GridVideo` interface gains `thumbnail_url?: string | null`. The video tile render replaces `<video preload="metadata">` with: `<img src={thumbnail_url}>` when `thumbnail_url` is truthy, or a `#1a1a1a` placeholder `<div>` with dim headline text when null/undefined.

**`frontend/components/ProfilePage.tsx`** — Three layout fixes:
1. Liked/Saved tab bar: added `position: 'sticky'`, `top: 0`, `zIndex: 50`, `background: '#000'` — tab bar sticks as user scrolls past the profile header
2. Outer scrollable container `paddingBottom` updated from `'80px'` to `'calc(env(safe-area-inset-bottom) + 56px + 16px)'` — safe-area-correct for iPhone 14+ notch/home-indicator
3. Grid already fills full width — no restrictive `maxWidth` or horizontal padding on the tab content wrapper

## Human Checkpoint Results

Task 3 is a `checkpoint:human-verify`. The 19-point UI verification checklist is awaiting human execution on device. See checkpoint message below.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2.

## Self-Check

### Files exist:
- `supabase/migrations/20260326000000_add_thumbnail_url.sql` — created
- `pipeline/models.py` — thumbnail_url field added
- `pipeline/video.py` — extract_thumbnail function appended
- `pipeline/storage.py` — upload_thumbnail added, publish_edition updated
- `pipeline/run.py` — thumbnail try/except block inserted
- `frontend/hooks/useEdition.ts` — thumbnail_url in Video interface
- `frontend/app/api/today/route.ts` — thumbnail_url in select
- `frontend/components/VideoGrid.tsx` — img + placeholder pattern
- `frontend/components/ProfilePage.tsx` — sticky tab bar + paddingBottom calc

### Python import check: PASSED (`from pipeline.models import VideoResult; from pipeline.video import extract_thumbnail; from pipeline.storage import upload_thumbnail`)
### TypeScript check: PASSED (`npx tsc --noEmit` → 0 errors)
### Commits: bf14621, d010d40

## Self-Check: PASSED
