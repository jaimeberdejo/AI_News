# Phase 10: Comments - Research

**Researched:** 2026-03-26
**Domain:** Supabase RLS + PostgreSQL schema + Next.js Route Handlers + React bottom sheet UI + rate limiting
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMM-01 | User can post a flat comment on a video (no nested replies) | `video_comments` table with `(user_id, video_id, body, created_at)`; Route Handler POST /api/comments with auth gate; VideoFeed adds optimistic comment to local list on success |
| COMM-02 | User can delete their own comment | Route Handler DELETE /api/comments/[id] with RLS `auth.uid() = user_id`; UI shows delete button only on comments owned by current user |
| COMM-03 | Comment shows author display name and avatar | JOIN `profiles` on `user_id`; `profiles` already has `display_name` and `avatar_url`; anon SELECT policy on profiles already exists ("profiles are viewable by everyone") |
| COMM-04 | Comments are rate-limited (max 1 per 30s) and capped at 500 characters | Rate limit enforced in Route Handler by querying last comment timestamp for user; body length validated in Route Handler before insert; client-side textarea enforces `maxLength={500}` |
</phase_requirements>

---

## Summary

Phase 10 adds a comment system to FinFeed. The data layer is a new `video_comments` table keyed on `(user_id, video_id)` with a text body column, protected by RLS: comments are readable by everyone (guests can read freely — success criterion 1), but inserts and deletes are restricted to authenticated users who own the row. Author display is solved by joining `profiles` at query time — the `profiles` table already exists from Phase 7 with `display_name` and `avatar_url` columns, and its `"profiles are viewable by everyone"` SELECT policy was explicitly designed for comment display (noted in the Phase 7 migration comment).

The UI layer adds a `CommentSheet` bottom sheet component that slides up when a user taps the comment button on a video. This follows the identical pattern as `AuthBottomSheet` (fixed-position panel, dark overlay, `transform: translateY` transition, `env(safe-area-inset-bottom)` safe area padding). `VideoFeed` controls sheet open/close state and passes the active `videoId` down. The comment count displayed in `VideoItem`'s comment button needs a `comment_count` prop (similar to `likeCount`), or it can be fetched with comments — a denormalized count column is recommended for consistency with the like_count pattern already in place.

Rate limiting (COMM-04) is enforced server-side in the POST Route Handler: before inserting, query for the user's most recent comment on any video within the last 30 seconds. If one exists, return 429 with an informative message. The 500-character cap is enforced both client-side (`maxLength` on the textarea) and server-side (body length check before insert). Never ship without both checks — per STATE.md locked decision: "Comments must ship with moderation minimums (rate limit + length cap) — never ship without both."

**Primary recommendation:** One Supabase migration (video_comments table + comment_count trigger), two Route Handlers (/api/comments GET+POST, /api/comments/[id] DELETE), a new CommentSheet component, and VideoFeed/VideoItem wiring. No new libraries needed.

---

## Key Questions Answered

### 1. Where does profile data (display name, avatar) come from?

The `profiles` table was created in Phase 7 (`frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql`). It has:
- `id uuid` — mirrors `auth.users(id)`
- `display_name text` — user's chosen display name (editable in Phase 11)
- `avatar_url text` — URL to profile photo (editable in Phase 11)

The migration comment on the SELECT policy says: "All users (including anonymous) can read profiles (needed for comment display in Phase 10)". This policy already exists and does not need to be created.

The comments GET endpoint must JOIN profiles to return display_name and avatar_url alongside each comment.

Source: `frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql` lines 16-20.

### 2. How does Supabase handle JOINs in the client library?

Supabase JS client supports foreign key-based joins using the embedded resource syntax:

```typescript
const { data } = await supabase
  .from('video_comments')
  .select(`
    id,
    body,
    created_at,
    user_id,
    profiles ( display_name, avatar_url )
  `)
  .eq('video_id', videoId)
  .order('created_at', { ascending: true })
```

This works when a foreign key relationship exists on the table. Since `video_comments.user_id` references `auth.users(id)`, the join to `profiles` requires using the `profiles!user_id` hint or a direct FK from `video_comments.user_id` to `profiles.id`. Since `profiles.id` references `auth.users(id)` transitively, in practice you should either add a direct FK `video_comments.user_id REFERENCES public.profiles(id)` or use Supabase's relationship join hint.

Recommended approach: add `REFERENCES public.profiles(id)` on `video_comments.user_id` so Supabase auto-detects the relationship. This is safe because `profiles.id` and `auth.users.id` are the same UUID — inserting a comment requires a valid auth user who already has a profile row (trigger guarantees this).

### 3. Rate limiting pattern without Redis

Since the project has no Redis or external rate-limit service, rate limiting is implemented directly in PostgreSQL via a timestamp query:

```typescript
// In POST /api/comments
const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
const { data: recent } = await supabase
  .from('video_comments')
  .select('id')
  .eq('user_id', user.id)
  .gte('created_at', thirtySecondsAgo)
  .limit(1)
  .maybeSingle()

if (recent) {
  return NextResponse.json(
    { error: 'Please wait 30 seconds between comments.' },
    { status: 429 }
  )
}
```

This query is fast with an index on `(user_id, created_at)`. The index should be included in the migration.

### 4. Should comment_count be denormalized?

Yes — consistent with the `like_count` pattern from Phase 9. A denormalized `comment_count integer DEFAULT 0` column on `videos` maintained by an AFTER INSERT/DELETE trigger on `video_comments` means:
- The feed API (`/api/today`) already returns `comment_count` on first render without an extra query
- VideoItem can display the count immediately without waiting for the CommentSheet to load

The `Video` TypeScript interface will need `comment_count: number` added (same as `like_count` was added in Phase 9 Plan 01).

### 5. What is the established bottom sheet pattern?

`AuthBottomSheet` provides the complete pattern:
- Fixed position overlay + panel
- `transform: translateY(0)` open / `translateY(100%)` closed
- `transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'`
- `paddingBottom: 'env(safe-area-inset-bottom)'` for iOS safe area
- Drag handle pill at top
- Dark overlay with `pointer-events: none` when closed
- `zIndex: 100` (overlay) / `zIndex: 101` (panel) — matches existing hierarchy

`CommentSheet` should follow the same pattern. It will be a taller sheet (e.g. `height: '75vh'` or `height: '80vh'`) to allow comfortable reading and input, with a scrollable comment list and a fixed input area at the bottom.

### 6. What is the migration location?

Phase 7 established `frontend/supabase/migrations/` as the v1.2 social features migration home. The Phase 9 migration is at `frontend/supabase/migrations/20260325000001_add_social_tables.sql`. The Phase 10 migration should follow the same convention with a new timestamp: `frontend/supabase/migrations/20260326000001_add_comments.sql`.

Apply: `cd /Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend && supabase db push` OR Dashboard SQL Editor.

### 7. Where does the comment action wire into VideoFeed?

`VideoFeed.tsx` line 266 already has `// 'comment': Phase 10 — no-op for now`. The `handleSocialAction` function dispatches to `handleLike` or `handleBookmark` for signed-in users; the comment branch is a stub. Phase 10 wires up a real `handleComment(videoId)` that opens a `CommentSheet` (not the `AuthBottomSheet`). The `isGuest` branch already correctly intercepts the tap and shows `AuthBottomSheet` with action label 'comment'.

### 8. Delete authorization — how to verify ownership?

`RLS policy USING (auth.uid() = user_id)` on DELETE is the established project pattern. The Route Handler for DELETE should also check ownership explicitly (defense in depth), but RLS is the primary enforcement. The UI should only render the delete button on comments where `comment.user_id === user?.id`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 (installed) | DB queries for comments + profiles join | Already in project |
| `@supabase/ssr` | ^0.9.0 (installed) | Auth-aware server client in Route Handlers | Required to read user identity from cookies |
| Next.js Route Handlers | built-in | Comment POST/DELETE/GET endpoints | Established project pattern for auth-aware API |
| React inline styles | built-in | CommentSheet UI | Established project UI pattern (no Tailwind in components) |

### No New Libraries Required

All tools are in place. Phase 10 is pure schema + API + UI wiring with existing dependencies. No date formatting library needed — same `toLocaleTimeString` / `toLocaleDateString` pattern used in VideoItem is sufficient.

**Installation:** none needed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── supabase/migrations/
│   └── 20260326000001_add_comments.sql     # NEW — video_comments table, RLS, trigger
├── app/api/
│   └── comments/
│       ├── route.ts                         # NEW — GET (list) + POST (create with rate limit)
│       └── [id]/
│           └── route.ts                     # NEW — DELETE (own comment only)
├── components/
│   ├── CommentSheet.tsx                     # NEW — bottom sheet with comment list + input
│   ├── VideoFeed.tsx                        # MODIFIED — comment sheet state, handleComment
│   └── VideoItem.tsx                        # MODIFIED — commentCount prop, filled icon when sheet open
├── hooks/
│   └── useEdition.ts                        # MODIFIED — add comment_count to Video interface
```

### Pattern 1: Comments Table Schema

```sql
-- frontend/supabase/migrations/20260326000001_add_comments.sql

-- Add comment_count to videos (consistent with like_count from Phase 9)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- video_comments: one row per comment
CREATE TABLE IF NOT EXISTS public.video_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) <= 500 AND char_length(body) > 0),
  created_at timestamptz DEFAULT now()
);

-- Index for fetching comments by video (primary read pattern)
CREATE INDEX IF NOT EXISTS idx_video_comments_video    ON public.video_comments(video_id, created_at);
-- Index for rate limiting query (user's recent comments)
CREATE INDEX IF NOT EXISTS idx_video_comments_user_ts  ON public.video_comments(user_id, created_at DESC);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

-- Guests and signed-in users can read all comments (COMM-01: guests read freely)
CREATE POLICY "anyone can read comments"
  ON public.video_comments FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only signed-in users can insert their own comments
CREATE POLICY "users can insert own comments"
  ON public.video_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own comments (COMM-02)
CREATE POLICY "users can delete own comments"
  ON public.video_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to maintain comment_count on videos
CREATE OR REPLACE FUNCTION public.update_video_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comment_count = comment_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change ON public.video_comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_video_comment_count();
```

**Note on FK choice:** `user_id REFERENCES public.profiles(id)` (not `auth.users(id)`) enables Supabase's embedded resource join syntax (`profiles ( display_name, avatar_url )`) without a join hint. Since `profiles.id = auth.users.id` and the `handle_new_user` trigger guarantees a profiles row exists for every auth user, this is safe.

### Pattern 2: Comments GET + POST Route Handler

```typescript
// frontend/app/api/comments/route.ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// GET /api/comments?videoId=<uuid>
// Public — guests can read (no auth required)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  // Use anon client — comments are publicly readable, no auth needed
  const anonClient = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: comments, error } = await anonClient
    .from('video_comments')
    .select(`
      id,
      body,
      created_at,
      user_id,
      profiles ( display_name, avatar_url )
    `)
    .eq('video_id', videoId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: comments ?? [] })
}

// POST /api/comments
// Requires auth. Enforces rate limit (1 per 30s) and body length <= 500 chars.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const videoId: string | undefined = body?.videoId
  const text: string | undefined = body?.body

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  if (!text || text.trim().length === 0) return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
  if (text.length > 500) return NextResponse.json({ error: 'Comment cannot exceed 500 characters.' }, { status: 400 })

  // Rate limit: max 1 comment per 30 seconds across all videos
  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
  const { data: recent } = await supabase
    .from('video_comments')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', thirtySecondsAgo)
    .limit(1)
    .maybeSingle()

  if (recent) {
    return NextResponse.json(
      { error: 'Please wait 30 seconds between comments.' },
      { status: 429 }
    )
  }

  const { data: comment, error } = await supabase
    .from('video_comments')
    .insert({ video_id: videoId, user_id: user.id, body: text.trim() })
    .select(`
      id,
      body,
      created_at,
      user_id,
      profiles ( display_name, avatar_url )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment }, { status: 201 })
}
```

### Pattern 3: Comment DELETE Route Handler

```typescript
// frontend/app/api/comments/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // RLS enforces auth.uid() = user_id — this delete will silently do nothing if user
  // doesn't own the comment. Return 404 in that case for clear client feedback.
  const { data, error } = await supabase
    .from('video_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)  // defense-in-depth; RLS also enforces this
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
```

**Note on Next.js 15+ params:** In Next.js 15+ (this project uses 16.1.6), dynamic route `params` is a Promise and must be awaited. Source: existing project code pattern (check `/api/editions/[id]/route.ts`).

### Pattern 4: CommentSheet Component Structure

```typescript
// frontend/components/CommentSheet.tsx
'use client'

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

interface CommentSheetProps {
  isOpen: boolean
  videoId: string | null
  currentUserId: string | null  // null = guest
  onClose: () => void
}

// Sheet structure:
// - Fixed overlay (same as AuthBottomSheet)
// - Fixed panel: height ~75vh, border-radius 20px 20px 0 0
//   - Drag handle pill (dismisses on click)
//   - Header: "Comments" label + comment count
//   - Scrollable comment list (overflow-y: auto, flex: 1)
//     - Each comment: avatar circle + display name + time + body
//     - Delete button (trash icon) shown only if comment.user_id === currentUserId
//   - Input area (fixed at bottom of sheet, above safe-area):
//     - textarea: maxLength={500}, placeholder, char count display
//     - Submit button: disabled when empty or submitting or rate-limited
//   - For guests: show "Sign in to comment" prompt instead of input area
```

### Pattern 5: VideoFeed Comment Wiring

The existing `handleSocialAction` in VideoFeed already routes `'comment'` to `AuthBottomSheet` for guests. For signed-in users, Phase 10 replaces the no-op with opening the `CommentSheet`:

```typescript
// In VideoFeed.tsx — add alongside sheetAction state
const [commentVideoId, setCommentVideoId] = useState<string | null>(null)

function handleSocialAction(action: 'like' | 'bookmark' | 'comment', videoId: string) {
  if (authLoading) return
  if (isGuest) {
    setSheetAction(action)  // shows AuthBottomSheet for all actions including comment
    return
  }
  if (action === 'like') handleLike(videoId)
  if (action === 'bookmark') handleBookmark(videoId)
  if (action === 'comment') setCommentVideoId(videoId)  // opens CommentSheet
}
```

The `CommentSheet` is rendered at the VideoFeed level (same as `AuthBottomSheet`):

```typescript
<CommentSheet
  isOpen={commentVideoId !== null}
  videoId={commentVideoId}
  currentUserId={user?.id ?? null}
  onClose={() => setCommentVideoId(null)}
/>
```

### Pattern 6: VideoItem comment_count prop

```typescript
// VideoItem.tsx — add to interface
interface VideoItemProps {
  // ... existing props ...
  commentCount?: number   // NEW in Phase 10
}

// Comment button (replace hardcoded 0):
<button onClick={(e) => { e.stopPropagation(); onSocialAction?.('comment', video.id) }}>
  <svg .../>
  {commentCount ?? 0}
</button>
```

### Anti-Patterns to Avoid

- **Fetching comments on every VideoItem render:** Comments load lazily when the sheet opens — NOT on video render. Loading all comments for all videos in the feed would be N×API calls on page load.
- **Skipping server-side rate limit:** Client-side `setTimeout` debounce is not a rate limit. The 30-second check MUST happen in the Route Handler before insert.
- **Using `auth.users` FK instead of `profiles` FK:** If `user_id REFERENCES auth.users(id)`, the Supabase JS embedded join `profiles ( ... )` will not auto-resolve. Use `REFERENCES public.profiles(id)` to enable clean join syntax.
- **Not returning the new comment from POST:** The POST handler should return the inserted comment row with profile data so the frontend can add it optimistically to the list without refetching.
- **Reusing AuthBottomSheet for comment input:** AuthBottomSheet is for guest sign-in only. CommentSheet is a new component with its own layout (comment list + input area).
- **Showing delete button for all comments:** Delete button must only render when `comment.user_id === user?.id`. Never rely solely on RLS for this — show/hide in the UI too.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Author name/avatar in comments | Manual JOIN or second query | Supabase embedded resource join `profiles ( display_name, avatar_url )` | Single query; auto-resolved via FK relationship; returns nested object |
| Rate limiting | Redis, sliding window counter | PostgreSQL timestamp query on `video_comments(user_id, created_at)` | No new infra; query is fast with index; consistent with project's no-external-services approach |
| Comment count per video | COUNT query on every feed load | Denormalized `comment_count` + DB trigger | Consistent with `like_count` pattern from Phase 9; O(1) read vs O(n) count |
| Auth check in Route Handler | JWT parsing | `supabase.auth.getUser()` via server client | Already established project pattern |
| Bottom sheet animation | CSS animation library | `transform: translateY` + CSS transition | Identical to `AuthBottomSheet` pattern; already proven on iOS PWA |

---

## Common Pitfalls

### Pitfall 1: Wrong Supabase Client for Comment Mutations

**What goes wrong:** POST /api/comments returns 401 for signed-in users.
**Why it happens:** Using the anon singleton (`lib/supabase.ts`) instead of the SSR cookie client. The anon client cannot read HttpOnly session cookies.
**How to avoid:** Always `import { createClient } from '@/lib/supabase/server'` in mutation Route Handlers. Only the GET endpoint (public read) can use the anon client.
**Warning signs:** `user` is always null in the Route Handler despite the frontend user being signed in.

### Pitfall 2: params Not Awaited in DELETE Route

**What goes wrong:** TypeScript error or runtime error in `/api/comments/[id]/route.ts`.
**Why it happens:** In Next.js 15+, dynamic segment `params` is a `Promise<{ id: string }>` and must be awaited before accessing properties.
**How to avoid:** `const { id } = await params` — see the code example above. Verify by checking how `/api/editions/[id]/route.ts` handles it in this project.
**Warning signs:** TypeScript: `Property 'id' does not exist on type 'Promise<...>'`.

### Pitfall 3: CommentSheet Open Blocks Video Interaction

**What goes wrong:** Scrolling the comment list scrolls the underlying video feed.
**Why it happens:** Touch events propagate through the sheet to the feed scroll container.
**How to avoid:** `e.stopPropagation()` on the sheet's scroll container. The overlay div already captures clicks (same as AuthBottomSheet). Ensure the scrollable comment list uses `overflow-y: auto` with an explicit `max-height` or `flex: 1` within the panel.
**Warning signs:** Comment list scroll causes the video feed to jump to the next video.

### Pitfall 4: Rate Limit Not Enforced Across Videos

**What goes wrong:** User posts comment on video A, then immediately posts on video B — rate limit bypassed.
**Why it happens:** Rate limit query filters by `video_id` instead of just `user_id`.
**How to avoid:** The rate limit query must NOT include a `video_id` filter — only `user_id` and `created_at`. Rate limit is per-user, not per-video.
**Warning signs:** Users can post more than one comment in 30 seconds by switching between videos.

### Pitfall 5: Optimistic Comment Not Matching Server Response Shape

**What goes wrong:** Comment appears immediately in list but then disappears or duplicates on re-fetch.
**Why it happens:** Optimistic comment object shape doesn't match what the server returns (e.g., `profiles` field missing or differently structured).
**How to avoid:** POST returns the full inserted row with profile join. Use the server-returned comment to replace the optimistic one after success. On failure, remove the optimistic comment and show an error.
**Warning signs:** Console errors about missing `profiles.display_name` on the optimistic comment object.

### Pitfall 6: FK to auth.users Breaks Supabase JS Join

**What goes wrong:** `profiles ( display_name, avatar_url )` in the Supabase select returns null for all comments.
**Why it happens:** `user_id REFERENCES auth.users(id)` — Supabase JS sees the FK to `auth.users` but cannot join to `public.profiles` without an explicit hint.
**How to avoid:** Define `user_id REFERENCES public.profiles(id)` in the migration. This creates a direct FK that Supabase JS auto-detects for the join.
**Warning signs:** Supabase returns `{ profiles: null }` on every comment row despite profiles existing.

### Pitfall 7: comment_count Migration Not Applied Before Feed API Changes

**What goes wrong:** `/api/today` returns an error or the `comment_count` field is undefined.
**Why it happens:** `comment_count` column doesn't exist yet because migration hasn't been pushed to Supabase.
**How to avoid:** Always apply the migration (human checkpoint) before wiring the API. Add `comment_count` to the feed API selects only after migration is confirmed.
**Warning signs:** `column "comment_count" does not exist` error in Supabase logs.

---

## Code Examples

### Complete Migration

```sql
-- Source: project pattern from frontend/supabase/migrations/20260325000001_add_social_tables.sql
-- frontend/supabase/migrations/20260326000001_add_comments.sql

-- ============================================================
-- Add comment_count column to videos
-- ============================================================
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- video_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) <= 500 AND char_length(body) > 0),
  created_at timestamptz DEFAULT now()
);

-- Primary read: comments for a video, ordered by time
CREATE INDEX IF NOT EXISTS idx_video_comments_video ON public.video_comments(video_id, created_at);
-- Rate limit query: recent comments by user
CREATE INDEX IF NOT EXISTS idx_video_comments_user_ts ON public.video_comments(user_id, created_at DESC);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

-- COMM-01: guests can read comments freely
CREATE POLICY "anyone can read comments"
  ON public.video_comments FOR SELECT
  TO authenticated, anon
  USING (true);

-- Signed-in users can insert their own comments
CREATE POLICY "users can insert own comments"
  ON public.video_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- COMM-02: users can only delete their own comments
CREATE POLICY "users can delete own comments"
  ON public.video_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Trigger to maintain comment_count on videos
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_video_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comment_count = comment_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change ON public.video_comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_video_comment_count();
```

### Rate Limit Check in Route Handler

```typescript
// Source: project pattern — timestamp query with index on (user_id, created_at)
const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
const { data: recent } = await supabase
  .from('video_comments')
  .select('id')
  .eq('user_id', user.id)
  .gte('created_at', thirtySecondsAgo)
  .limit(1)
  .maybeSingle()

if (recent) {
  return NextResponse.json(
    { error: 'Please wait 30 seconds between comments.' },
    { status: 429 }
  )
}
```

### Supabase Join for Comment Author

```typescript
// Source: Supabase JS embedded resource syntax — works when FK is to public.profiles
const { data: comments } = await anonClient
  .from('video_comments')
  .select(`
    id,
    body,
    created_at,
    user_id,
    profiles ( display_name, avatar_url )
  `)
  .eq('video_id', videoId)
  .order('created_at', { ascending: true })
```

### Client-Side Character Count Display

```typescript
// In CommentSheet — show remaining characters
const [body, setBody] = useState('')
const remaining = 500 - body.length

// In JSX:
<textarea
  value={body}
  onChange={e => setBody(e.target.value)}
  maxLength={500}
  placeholder="Add a comment..."
/>
<span style={{ color: remaining < 50 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
  {remaining}
</span>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nested/threaded comments | Flat comments only | Decided in REQUIREMENTS.md Out of Scope | Simpler schema, better mobile UX |
| External rate limiting (Redis) | PostgreSQL timestamp query | Architecture decision (no external services) | Rate limit enforced in DB layer; no new infrastructure |
| Realtime comment updates | Load on sheet open + optimistic add | Consistent with Realtime-deferred decision (STATE.md) | No WebSocket connections; simpler |

**Decided and locked:**
- Nested replies: out of scope (REQUIREMENTS.md: "Anti-pattern on mobile — flat comments are simpler and better UX")
- Comment moderation dashboard: out of scope (REQUIREMENTS.md: "Low-volume app; rate limiting + length cap sufficient for v1.2")
- Realtime: not used (STATE.md: Supabase free tier 200 concurrent connections)

---

## Open Questions

1. **Display name fallback when profiles.display_name is null**
   - What we know: `profiles.display_name` can be null (Phase 11 adds editing; at Phase 10 launch, Google OAuth users have their name from `raw_user_meta_data ->> 'full_name'` populated by the trigger, but email/password users may have null).
   - What's unclear: What should show when display_name is null — email prefix, "Anonymous", or user's email?
   - Recommendation: Fall back to `"User"` or the email username prefix. Keep it simple — Phase 11 adds proper profile editing. Display name is low-stakes at this stage. Use `profiles?.display_name ?? 'User'` in CommentSheet.

2. **Avatar display when profiles.avatar_url is null**
   - What we know: Email/password users won't have an avatar_url. Google OAuth users will (populated from `raw_user_meta_data ->> 'avatar_url'`).
   - Recommendation: Show an initials circle when avatar_url is null (first letter of display_name or 'U'). This is a UI detail the planner can decide — keep it simple.

3. **Comment count in VideoItem for the initial render**
   - What we know: Adding `comment_count` to the feed API selects (same as `like_count`) means it arrives on first render. VideoItem already has the `likeCount` prop pattern.
   - Recommendation: Add `comment_count` to feed API selects and `Video` interface in Plan 10-01 (same task as the migration). VideoFeed does not need to manage `commentCount` state separately — it reads from `video.comment_count` directly (since comment count doesn't need optimistic update in the VideoItem; the sheet handles its own list).

---

## Plan Breakdown Recommendation

Phase 10 naturally splits into 3 plans:

**Plan 10-01: Database Migration**
- Write `frontend/supabase/migrations/20260326000001_add_comments.sql`
- Add `comment_count` to `videos`, create `video_comments` with RLS, trigger
- Human checkpoint: apply migration
- Update `Video` interface in `useEdition.ts` to add `comment_count: number`
- Add `comment_count` to `videos(...)` select in `/api/today` and `/api/editions/[id]`

**Plan 10-02: Route Handlers**
- Create `/api/comments/route.ts` — GET (list with profiles join, anon client) + POST (auth required, rate limit, length check)
- Create `/api/comments/[id]/route.ts` — DELETE (auth required, ownership via `.eq('user_id', user.id)` + RLS)

**Plan 10-03: CommentSheet UI + VideoFeed/VideoItem Wiring**
- Create `CommentSheet.tsx` — bottom sheet matching AuthBottomSheet pattern; scrollable list; fixed input area; delete button per owned comment; guest prompt instead of input
- Update `VideoItem.tsx` — add `commentCount` prop
- Update `VideoFeed.tsx` — add `commentVideoId` state, open CommentSheet on comment action for signed-in users, pass `commentCount` to VideoItem from `video.comment_count`

---

## Sources

### Primary (HIGH confidence)

- `frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql` — profiles table schema, RLS policies, SECURITY DEFINER trigger pattern, explicit Phase 10 comment in "profiles are viewable by everyone" policy
- `frontend/supabase/migrations/20260325000001_add_social_tables.sql` — like_count + trigger pattern, video_likes/bookmarks RLS pattern
- `frontend/app/api/social/like/route.ts` — Route Handler auth pattern (createClient, getUser, 401, insert/delete)
- `frontend/app/api/social/state/route.ts` — anon client for public reads, SSR client for per-user state
- `frontend/components/AuthBottomSheet.tsx` — bottom sheet UI pattern (transform, transition, zIndex, safe-area)
- `frontend/components/VideoFeed.tsx` — handleSocialAction stub, sheetAction state, Phase 10 comment stub at line 266
- `frontend/components/VideoItem.tsx` — onSocialAction callback signature, social button layout
- `.planning/STATE.md` — locked decisions: rate limit + length cap required, Route Handlers for social, Realtime deferred
- `.planning/REQUIREMENTS.md` — COMM-01 through COMM-04 definitions, out-of-scope items

### Secondary (MEDIUM confidence)

- Supabase JS embedded resource join syntax — consistent with Supabase documentation patterns for FK relationships
- PostgreSQL timestamp-based rate limiting — standard pattern for low-volume apps without Redis

### Tertiary (LOW confidence)

- None — all critical claims grounded in existing project code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools confirmed present in package.json
- Architecture: HIGH — migration, RLS, Route Handler, bottom sheet patterns all directly observed in existing code
- Pitfalls: HIGH — wrong Supabase client and params async pitfalls are directly observable from code; others are logical consequences of the architecture

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days — stable stack, no fast-moving dependencies)
