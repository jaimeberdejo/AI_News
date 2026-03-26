---
phase: 10-comments
verified: 2026-03-26T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Guest reads comments without sign-in prompt blocking the sheet"
    expected: "CommentSheet slides up showing comment list (or empty state 'No comments yet. Be the first!'). Input area shows 'Sign in to comment'. No auth gate prevents viewing."
    why_human: "Cannot verify guest-visible UI behavior or bottom-sheet animation programmatically."
  - test: "Signed-in user posts a comment with optimistic UI"
    expected: "Comment appears immediately with user's display name. On refresh, comment persists and comment_count in VideoItem increments by 1."
    why_human: "Requires live Supabase interaction to verify optimistic replacement and server-side DB write."
  - test: "Signed-in user deletes only their own comment"
    expected: "Trash icon visible only on own comments. Clicking removes comment from list optimistically. Other users' comments show no trash icon."
    why_human: "Ownership conditional rendering requires two authenticated sessions to fully verify."
  - test: "30-second rate limit triggers correct error message"
    expected: "Submitting a second comment within 30 seconds shows 'Please wait 30 seconds between comments.' in red. This applies cross-video (posting on video A then video B within 30s is also blocked)."
    why_human: "Cross-video rate limit behavior requires live API calls with timing."
  - test: "500-character cap is enforced in textarea"
    expected: "Textarea stops accepting characters at 500. Counter shows '500/500' in red."
    why_human: "maxLength enforcement and counter color change are visual/interactive behaviors."
  - test: "CommentSheet scroll does not trigger video feed scroll (no accidental video skip)"
    expected: "Scrolling within the comment list does not advance to the next video."
    why_human: "Scroll propagation behavior must be verified on an actual device or browser (mobile touch events)."
---

# Phase 10: Comments Verification Report

**Phase Goal:** Implement a full comment system — users can read, post, and delete comments on videos; guests can read; comment counts update live on the feed.
**Verified:** 2026-03-26
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | video_comments table exists with RLS: guests can SELECT, authenticated users can INSERT (own rows) and DELETE (own rows) | VERIFIED | `20260326000001_add_comments.sql` contains all three RLS policies with correct roles (`anon` + `authenticated` for SELECT; `authenticated` only for INSERT/DELETE) and `auth.uid() = user_id` checks |
| 2 | comment_count column exists on videos table and stays in sync via trigger (INSERT increments, DELETE decrements with GREATEST floor) | VERIFIED | Migration adds `ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;` and creates `update_video_comment_count()` AFTER INSERT OR DELETE trigger with `GREATEST(comment_count - 1, 0)` guard |
| 3 | Video TypeScript interface includes comment_count: number | VERIFIED | `frontend/hooks/useEdition.ts` line 13: `comment_count: number // denormalized count maintained by DB trigger` |
| 4 | Feed API /api/today returns comment_count for each video | VERIFIED | `frontend/app/api/today/route.ts` line 40: `comment_count` present in Supabase select string |
| 5 | GET /api/comments?videoId=uuid returns comment list with nested profiles (display_name, avatar_url) accessible by guests | VERIFIED | `route.ts` uses anon client, selects `profiles ( display_name, avatar_url )`, no auth check on GET path |
| 6 | POST /api/comments returns 401 for guests, 400 for invalid body, 429 on rate limit, 201 on success | VERIFIED | `route.ts`: `getUser()` → 401 if no user; body/length validation → 400; `maybeSingle()` rate-limit check with no `video_id` filter → 429; `.single()` insert with profiles join → 201 |
| 7 | DELETE /api/comments/[id] returns 401 for guests, 404 if not owned, 200 on success | VERIFIED | `[id]/route.ts`: `getUser()` → 401; `await params` (Next.js 15+ pattern); `.eq('user_id', user.id)` defense-in-depth; `if (!data)` → 404; success → `{ deleted: true }` 200 |
| 8 | Rate limit is per-user cross-video: posting on video A then video B within 30s is blocked | VERIFIED | Rate-limit query in `route.ts` has NO `video_id` filter — only `.eq('user_id', user.id).gte('created_at', thirtySecondsAgo)` |
| 9 | Tapping the comment button opens CommentSheet for that video | VERIFIED | `VideoFeed.tsx` line 268: `if (action === 'comment') setCommentVideoId(videoId)` in `handleSocialAction`; `CommentSheet` rendered at line 535 with `isOpen={commentVideoId !== null}` |
| 10 | CommentSheet fetches lazily on open and shows full comment list with author + avatar + timestamp | VERIFIED | `CommentSheet.tsx`: `useEffect` keyed `[isOpen, videoId]`; fetches `/api/comments?videoId=...`; renders avatar circle with first letter, `display_name` fallback to `'Anonymous'`, `formatRelativeTime()` for timestamp, comment body |
| 11 | comment_count in VideoItem displays the live count from video data (not hardcoded 0) | VERIFIED | `VideoFeed.tsx` line 505: `commentCount={video.comment_count}` prop passed; `VideoItem.tsx` line 205: `{commentCount ?? 0}` rendered |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/supabase/migrations/20260326000001_add_comments.sql` | video_comments table, RLS policies, comment_count column, trigger | VERIFIED | 67 lines; contains table DDL, 2 indexes, 3 RLS policies, SECURITY DEFINER trigger function, AFTER INSERT OR DELETE trigger |
| `frontend/hooks/useEdition.ts` | Video interface with comment_count | VERIFIED | `comment_count: number` present at line 13 |
| `frontend/app/api/today/route.ts` | Feed API returning comment_count | VERIFIED | `comment_count` in Supabase select at line 40 |
| `frontend/app/api/comments/route.ts` | GET (public) + POST (auth-gated) exports | VERIFIED | Exports `GET` (anon client, profiles join) and `POST` (SSR client, rate limit, 201 response); 81 lines of substantive logic |
| `frontend/app/api/comments/[id]/route.ts` | DELETE (auth-gated, owner-only) export | VERIFIED | Exports `DELETE`; params awaited; `.eq('user_id', user.id)` present; 404 on not-found |
| `frontend/components/CommentSheet.tsx` | Bottom sheet with comment list, delete per own, text input, guest prompt | VERIFIED | 475 lines; all behaviors implemented: lazy fetch, optimistic POST with temp-id replacement, optimistic DELETE with restore, `isOwn` delete gate, 500-char textarea with live counter, guest prompt, `onTouchMove`/`onWheel` stopPropagation |
| `frontend/components/VideoFeed.tsx` | commentVideoId state, handleComment wired, CommentSheet rendered | VERIFIED | `commentVideoId` state at line 57; `setCommentVideoId(videoId)` at line 268; CommentSheet rendered at lines 535–540; `commentCount={video.comment_count}` at line 505 |
| `frontend/components/VideoItem.tsx` | commentCount prop replacing hardcoded 0 | VERIFIED | `commentCount?: number` in interface at line 17; `{commentCount ?? 0}` in JSX at line 205 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `migrations/20260326000001_add_comments.sql` | `public.videos` | `ALTER TABLE ADD COLUMN comment_count + trigger` | VERIFIED | `ADD COLUMN comment_count` present; trigger updates `public.videos SET comment_count` |
| `frontend/hooks/useEdition.ts` | `frontend/app/api/today/route.ts` | `Video interface comment_count field` | VERIFIED | Interface has `comment_count: number`; API select includes `comment_count` |
| `frontend/components/VideoFeed.tsx` | `frontend/components/CommentSheet.tsx` | `isOpen={commentVideoId !== null}, videoId={commentVideoId}, onClose` | VERIFIED | All three props wired at lines 536–539 |
| `frontend/components/CommentSheet.tsx` | `/api/comments` | `fetch('/api/comments?videoId=...')` on open; `fetch('/api/comments', {method:'POST'})` on submit | VERIFIED | Fetch in `useEffect` at line 55; POST fetch at line 88 |
| `frontend/components/VideoFeed.tsx` | `frontend/components/VideoItem.tsx` | `commentCount={video.comment_count}` prop | VERIFIED | Line 505 in VideoFeed.tsx map render |
| `frontend/app/api/comments/route.ts` | `public.video_comments` | anon client select with profiles join | VERIFIED | `.from('video_comments').select(...)` with `profiles ( display_name, avatar_url )` |
| `frontend/app/api/comments/route.ts` | `supabase.auth.getUser()` | SSR cookie client for POST auth gate | VERIFIED | `import { createClient } from '@/lib/supabase/server'`; `getUser()` called at POST entry |
| `frontend/app/api/comments/[id]/route.ts` | `public.video_comments` | DELETE with `.eq('user_id'...)` defense-in-depth | VERIFIED | `.eq('user_id', user.id)` present at line 22 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMM-01 | 10-01, 10-02, 10-03 | User can post a flat comment on a video (no nested replies) | SATISFIED | POST /api/comments inserts flat row; CommentSheet renders flat list with no nesting |
| COMM-02 | 10-01, 10-02, 10-03 | User can delete their own comment | SATISFIED | DELETE /api/comments/[id] with ownership check; CommentSheet renders delete button only for `comment.user_id === currentUserId` |
| COMM-03 | 10-01, 10-02, 10-03 | Comment shows author display name and avatar | SATISFIED | GET returns `profiles ( display_name, avatar_url )`; CommentSheet renders avatar circle with first letter and `display_name ?? 'Anonymous'` |
| COMM-04 | 10-01, 10-02, 10-03 | Comments are rate-limited (max 1 per 30s) and capped at 500 characters | SATISFIED | Rate-limit query cross-video (no video_id filter) returns 429; textarea `maxLength={500}`; DB-level `CHECK (char_length(body) <= 500)` as defense-in-depth |

All four COMM requirements are satisfied. No orphaned requirements found — REQUIREMENTS.md maps COMM-01 through COMM-04 exclusively to Phase 10, and all three plans claim them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CommentSheet.tsx` | 418 | `placeholder="Add a comment..."` | Info | HTML textarea `placeholder` attribute — legitimate UX, not a stub |

No blockers, no warnings. The single flagged match is the textarea's placeholder text, which is correct and intentional.

### Commit Verification

All six documented commits verified in git history:

| Commit | Description |
|--------|-------------|
| `cc47560` | feat(10-01): create comments migration |
| `2cdee4f` | feat(10-01): add comment_count to Video interface and feed API |
| `48b9c4d` | feat(10-02): create GET + POST /api/comments route handler |
| `5106418` | feat(10-02): create DELETE /api/comments/[id] route handler |
| `5c16b34` | feat(10-03): create CommentSheet component |
| `1e78333` | feat(10-03): wire CommentSheet into VideoFeed and VideoItem |

### Human Verification Required

All six automated verification layers pass. The items below require a live browser session to confirm end-to-end behavior.

#### 1. Guest Reads Comments Freely

**Test:** Sign out (or open incognito). Tap the comment button on any video.
**Expected:** CommentSheet slides up. Comment list (or empty state) is visible. Input area shows "Sign in to comment" — no blocking auth gate.
**Why human:** Bottom-sheet animation and guest-path rendering are visual/interactive behaviors that cannot be verified by static analysis.

#### 2. Signed-In User Posts with Optimistic UI

**Test:** Sign in. Tap comment on a video. Type a comment and submit.
**Expected:** Comment appears immediately with your display name (optimistic). On page refresh, comment persists and the count in VideoItem incremented.
**Why human:** Requires live Supabase write and optimistic temp-id replacement to observe.

#### 3. Delete Button Visible Only on Own Comments

**Test:** Open a sheet with at least two comments from different users.
**Expected:** Your comments show a trash icon. Other users' comments do not.
**Why human:** Requires two authenticated sessions (or pre-existing multi-user data) to verify the ownership conditional.

#### 4. Cross-Video Rate Limit Enforces 30-Second Window

**Test:** Post a comment on video A. Immediately tap comment on video B and attempt to post.
**Expected:** Error message "Please wait 30 seconds between comments." appears in red.
**Why human:** Cross-video timing behavior requires live API calls with sub-30-second timing.

#### 5. 500-Character Cap in Textarea

**Test:** Paste or type 501+ characters into the comment input.
**Expected:** Textarea refuses input beyond 500 characters. Counter shows "500/500" in red.
**Why human:** `maxLength` enforcement and counter color transition are visual/interactive.

#### 6. Scroll Isolation (No Accidental Video Skip)

**Test:** Open CommentSheet on a video. Scroll up and down within the comment list.
**Expected:** The video feed does not scroll to the next video. The sheet stays open on the same video.
**Why human:** `onTouchMove` / `onWheel` stopPropagation behavior requires a mobile device or DevTools touch emulation to verify.

### Summary

All 11 observable truths are programmatically verified. All 8 artifacts exist and contain substantive implementations (no stubs, no placeholders). All 8 key links are wired. All 4 COMM requirements are satisfied. All 6 documented commits are present in git history. No blockers or warnings found.

The phase goal — "users can read, post, and delete comments on videos; guests can read; comment counts update live on the feed" — is fully implemented in code. The remaining 6 items are end-to-end behavioral checks that require a live browser session and cannot be verified by static analysis.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
