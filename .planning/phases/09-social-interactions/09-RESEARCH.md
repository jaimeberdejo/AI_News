# Phase 9: Social Interactions - Research

**Researched:** 2026-03-25
**Domain:** Supabase RLS + PostgreSQL schema + Next.js Route Handlers + React optimistic state
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SOCL-01 | User can like a video (tap to like; tap again to unlike) | `video_likes` table with UNIQUE(user_id, video_id); Route Handler POST /api/social/like does upsert/delete; optimistic toggle in VideoFeed |
| SOCL-02 | Like count is visible to all users including guests | `like_count` column on `videos` maintained by trigger, OR aggregate query in feed API; anon SELECT policy on `video_likes` allows public read |
| SOCL-03 | User can bookmark a video to save for later | `video_bookmarks` table with UNIQUE(user_id, video_id); Route Handler POST /api/social/bookmark does upsert/delete |
| SOCL-04 | User can remove a bookmark | Same Route Handler as SOCL-03 — tap again to toggle off; bookmark state accurate after refresh |
</phase_requirements>

---

## Summary

Phase 9 adds likes and bookmarks to FinFeed. The data layer is two new Supabase tables (`video_likes`, `video_bookmarks`) keyed on `(user_id, video_id)` UUID pairs, protected by RLS policies: likes are readable by everyone (guest like counts), bookmarks are readable only by the owning user. Mutations are gated to `auth.uid() = user_id`. The API layer uses Next.js Route Handlers at `/api/social/like` and `/api/social/bookmark`, following the project's established pattern of `createClient()` from `lib/supabase/server.ts` for auth-aware server-side access. The existing `/api/today` Route Handler uses the anon singleton — that is preserved unchanged; like counts are fetched separately on the client after auth state resolves.

The UI layer modifies `VideoItem` to accept live `likeCount`, `isLiked`, and `isBookmarked` props (replacing the current hardcoded `0`), and `VideoFeed` owns all social state: an optimistic state map `socialState: Record<string, { likeCount: number; isLiked: boolean; isBookmarked: boolean }>` keyed by `video.id`. When a signed-in user taps like or bookmark, VideoFeed updates the optimistic map immediately (instant UI feedback) then calls the Route Handler. On failure the optimistic change is rolled back. Social state for signed-in users is loaded in a single client-side fetch after `useAuth()` resolves, so guests never wait for it.

**Primary recommendation:** Two new Supabase migrations, two Route Handlers, an optimistic social state map in VideoFeed, and prop-driven state in VideoItem. No library additions needed — all tools are already installed.

---

## Key Questions Answered

### 1. What uniquely identifies a video?

The primary key is `videos.id` (UUID). There is no slug. The foreign key in `video_likes` and `video_bookmarks` is `video_id uuid REFERENCES videos(id) ON DELETE CASCADE`.

Source: `supabase/migrations/20260224000000_initial_schema.sql` — `videos.id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.

The `Video` TypeScript interface in `frontend/hooks/useEdition.ts` exposes `id: string` — this is the value used everywhere in the feed.

### 2. How is feed data currently fetched?

Feed data is fetched **server-side in `page.tsx`** via `getEditionData()` → `fetch('/api/today')`. The result is passed as `initialEdition` to `VideoFeed`. Category switches and edition navigation are client-side `fetch('/api/today?category=...')` and `fetch('/api/editions/[id]')` calls inside `VideoFeed`. Both existing API routes use the anon Supabase singleton (`createClient` from `@supabase/supabase-js`) — they are **auth-unaware** by design.

**Implication for Phase 9:** Like counts and the user's own like/bookmark state CANNOT be added to the existing feed API without switching it to an auth-aware client. That would break the clean separation. Instead:
- `like_count` is either a denormalized column updated by trigger, or fetched via a separate lightweight endpoint
- User's own like/bookmark state is fetched client-side in a `useEffect` after `useAuth()` resolves (confirmed signed in), so guests never trigger it

### 3. Migration pattern used in this project

Two migration directories exist:
- `/supabase/migrations/` — original v1.0/v1.1 migrations (applied to Supabase via `supabase db push --linked`)
- `/frontend/supabase/migrations/` — added in Phase 7 for auth (`20260323000001_add_profiles_and_auth.sql`)

The Phase 7 summary shows the migration file was at `frontend/supabase/migrations/...` and was applied via `supabase db push` or Dashboard SQL Editor. Phase 9 should use the same `frontend/supabase/migrations/` location with a new timestamp-prefixed file.

Apply command: `cd frontend && supabase db push` OR Dashboard SQL Editor.

### 4. Correct RLS policy pattern

Pattern established in `20260323000001_add_profiles_and_auth.sql`:
- Readable by all: `TO authenticated, anon USING (true)`
- Writable by owner only: `TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- No anon writes: omit an INSERT/UPDATE/DELETE policy for `anon`

For Phase 9:
- `video_likes` SELECT: open to `anon` (SOCL-02: guests see like counts)
- `video_likes` INSERT/DELETE: `TO authenticated USING (auth.uid() = user_id)`
- `video_bookmarks` SELECT: `TO authenticated USING (auth.uid() = user_id)` — private
- `video_bookmarks` INSERT/DELETE: `TO authenticated USING (auth.uid() = user_id)`

### 5. Server-side vs client-side social state fetch

**Client-side, after auth resolves.** Rationale:
- The feed is server-rendered with `initialEdition` — adding per-user social state would require making `page.tsx` auth-aware, which means using `createClient()` from `lib/supabase/server.ts` in `page.tsx`, adding auth context to a page that currently has none
- Guests visit the page more than signed-in users at this stage — keeping the server render auth-free is correct
- `useAuth()` already runs in `VideoFeed` and resolves within ~200ms; social state can load in the same `useEffect` that fires when `user` becomes defined

Fetch strategy: one batch request to a new `/api/social/state?videoIds=...` endpoint (or direct Supabase query from client) that returns `{ likes: string[], bookmarks: string[] }` for the current user and a list of video IDs, plus `likeCounts: Record<string, number>`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 (already installed) | DB queries for Route Handlers | Already in project |
| `@supabase/ssr` | ^0.9.0 (already installed) | Auth-aware server client in Route Handlers | Required to read user identity from cookies |
| Next.js Route Handlers | built-in | Social mutation endpoints | Established project pattern for auth-aware API (per STATE.md: "Social mutations via dedicated Route Handlers /api/social/*") |

### No New Libraries Required

All tools are in place. Phase 9 is pure schema + API + UI wiring with existing dependencies.

**Installation:** none needed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── supabase/migrations/
│   └── 20260325000001_add_social_tables.sql    # NEW — likes + bookmarks tables, RLS
├── app/api/social/
│   ├── like/
│   │   └── route.ts                             # NEW — POST toggle like
│   ├── bookmark/
│   │   └── route.ts                             # NEW — POST toggle bookmark
│   └── state/
│       └── route.ts                             # NEW — GET user's social state for a set of videoIds
├── components/
│   ├── VideoFeed.tsx                            # MODIFIED — socialState map, load state, optimistic updates
│   └── VideoItem.tsx                            # MODIFIED — accepts likeCount/isLiked/isBookmarked props
```

### Pattern 1: Social Tables Schema

**What:** Two tables, both using `(user_id, video_id)` composite unique constraint. Likes get a `like_count` denormalized column on `videos` for cheap public reads, updated by a DB trigger.

```sql
-- Source: project pattern from 20260323000001_add_profiles_and_auth.sql + initial_schema.sql

-- video_likes: one row per user-video like
CREATE TABLE public.video_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

-- Likes are public reads (SOCL-02: guests see like counts)
CREATE POLICY "anyone can read likes"
  ON public.video_likes FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only authenticated users can insert their own likes
CREATE POLICY "users can insert own likes"
  ON public.video_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
CREATE POLICY "users can delete own likes"
  ON public.video_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- video_bookmarks: one row per user-video bookmark
CREATE TABLE public.video_bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.video_bookmarks ENABLE ROW LEVEL SECURITY;

-- Bookmarks are PRIVATE: only the owner can read their own
CREATE POLICY "users can read own bookmarks"
  ON public.video_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own bookmarks"
  ON public.video_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own bookmarks"
  ON public.video_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

**Like count strategy — denormalized column + trigger (recommended over aggregate query):**
```sql
-- Add like_count to videos table
ALTER TABLE public.videos ADD COLUMN like_count integer NOT NULL DEFAULT 0;

-- Trigger function to keep like_count in sync
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();
```

Denormalized count means guests get `like_count` from the same `videos` select already done in `/api/today` — no second query needed for SOCL-02.

### Pattern 2: Route Handler for Social Mutations

**What:** Each mutation endpoint reads auth from cookies via `createClient()` from `lib/supabase/server.ts`, returns 401 for unauthenticated, does toggle logic via INSERT ... ON CONFLICT DELETE / conditional delete.

```typescript
// Source: project pattern from frontend/app/auth/actions.ts + Supabase docs
// frontend/app/api/social/like/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { videoId } = await req.json()
  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Check if like exists
  const { data: existing } = await supabase
    .from('video_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle()

  if (existing) {
    // Unlike: delete
    await supabase.from('video_likes').delete()
      .eq('user_id', user.id)
      .eq('video_id', videoId)
    return NextResponse.json({ liked: false })
  } else {
    // Like: insert
    await supabase.from('video_likes').insert({ user_id: user.id, video_id: videoId })
    return NextResponse.json({ liked: true })
  }
}
```

**Important:** Use `createClient()` from `lib/supabase/server.ts` (the SSR cookie-reading client), NOT the anon singleton from `lib/supabase.ts`. The anon singleton cannot read the user's session cookies.

### Pattern 3: Social State Fetch Endpoint

```typescript
// frontend/app/api/social/state/route.ts
// GET /api/social/state?videoIds=uuid1,uuid2,...
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ids = (searchParams.get('videoIds') ?? '').split(',').filter(Boolean)

  if (!ids.length) return NextResponse.json({ likes: [], bookmarks: [], likeCounts: {} })

  // likeCounts are public — use anon client for this part
  const { createClient: createSupabase } = await import('@supabase/supabase-js')
  const anonClient = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: videos } = await anonClient
    .from('videos')
    .select('id, like_count')
    .in('id', ids)

  const likeCounts: Record<string, number> = {}
  videos?.forEach((v: { id: string; like_count: number }) => {
    likeCounts[v.id] = v.like_count
  })

  // Per-user state requires auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ likes: [], bookmarks: [], likeCounts })
  }

  const [{ data: likeRows }, { data: bookmarkRows }] = await Promise.all([
    supabase.from('video_likes').select('video_id').eq('user_id', user.id).in('video_id', ids),
    supabase.from('video_bookmarks').select('video_id').eq('user_id', user.id).in('video_id', ids),
  ])

  return NextResponse.json({
    likes: likeRows?.map((r: { video_id: string }) => r.video_id) ?? [],
    bookmarks: bookmarkRows?.map((r: { video_id: string }) => r.video_id) ?? [],
    likeCounts,
  })
}
```

### Pattern 4: Optimistic Social State in VideoFeed

**What:** `VideoFeed` maintains a `socialState` map. On user action: update map optimistically → call Route Handler → roll back on error.

```typescript
// In VideoFeed.tsx
type SocialState = { likeCount: number; isLiked: boolean; isBookmarked: boolean }
const [socialState, setSocialState] = useState<Record<string, SocialState>>({})

// Load after auth resolves
useEffect(() => {
  if (!user || videos.length === 0) return
  const ids = videos.map(v => v.id).join(',')
  fetch(`/api/social/state?videoIds=${ids}`)
    .then(r => r.json())
    .then(data => {
      const map: Record<string, SocialState> = {}
      videos.forEach(v => {
        map[v.id] = {
          likeCount: data.likeCounts?.[v.id] ?? 0,
          isLiked: data.likes?.includes(v.id) ?? false,
          isBookmarked: data.bookmarks?.includes(v.id) ?? false,
        }
      })
      setSocialState(map)
    })
}, [user, videos]) // re-fetch when user changes (sign in / sign out)

// Optimistic like toggle
async function handleLike(videoId: string) {
  const prev = socialState[videoId] ?? { likeCount: 0, isLiked: false, isBookmarked: false }
  const optimistic: SocialState = {
    ...prev,
    isLiked: !prev.isLiked,
    likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
  }
  setSocialState(s => ({ ...s, [videoId]: optimistic }))

  const res = await fetch('/api/social/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId }),
  })
  if (!res.ok) {
    // Roll back
    setSocialState(s => ({ ...s, [videoId]: prev }))
  }
}
```

### Pattern 5: Updated handleSocialAction in VideoFeed

```typescript
// Replaces the current no-op for signed-in users
function handleSocialAction(action: 'like' | 'bookmark' | 'comment', videoId: string) {
  if (authLoading) return
  if (isGuest) {
    setSheetAction(action)
    return
  }
  // Signed in
  if (action === 'like') handleLike(videoId)
  if (action === 'bookmark') handleBookmark(videoId)
  // comment: Phase 10
}
```

VideoItem's `onSocialAction` signature must be updated to pass `videoId`:
```typescript
// VideoItem.tsx — update callback signature
onSocialAction?: (action: 'like' | 'bookmark' | 'comment', videoId: string) => void

// Call site:
onClick={(e) => { e.stopPropagation(); onSocialAction?.('like', video.id) }}
```

### Pattern 6: VideoItem Props Update

```typescript
interface VideoItemProps {
  video: Video
  onEnded?: () => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
  editionPublishedAt?: string | null
  onSocialAction?: (action: 'like' | 'bookmark' | 'comment', videoId: string) => void
  // NEW in Phase 9:
  likeCount?: number
  isLiked?: boolean
  isBookmarked?: boolean
}
```

Display in like button: `{likeCount ?? 0}` instead of hardcoded `0`. Heart SVG fill changes when `isLiked` is true. Bookmark SVG fill changes when `isBookmarked` is true.

### Anti-Patterns to Avoid

- **Using the anon singleton for mutation endpoints:** `lib/supabase.ts` has no cookie reader — `getUser()` will always return null. Always use `createClient()` from `lib/supabase/server.ts` in Route Handlers that need auth.
- **Fetching social state server-side in page.tsx:** Makes the server render auth-dependent, adds latency for all users (including guests). Client-side fetch after auth resolves is the correct pattern.
- **Aggregate COUNT query on every feed request:** `SELECT COUNT(*) FROM video_likes WHERE video_id = $1` per video on every page load is N+1. Use the denormalized `like_count` column maintained by trigger instead.
- **Not rolling back on optimistic failure:** The success criteria requires state to persist on refresh. If the server call fails, the count must revert.
- **Calling Route Handlers from server components:** Social state endpoints need cookie access. They must be called client-side (from `useEffect` or event handlers in Client Components).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Like count accuracy | Custom count logic | Denormalized `like_count` + DB trigger | DB triggers are atomic; no race condition between concurrent likes; trigger is AFTER INSERT/DELETE so it's always consistent |
| Auth check in Route Handler | JWT parsing | `supabase.auth.getUser()` via server client | Server client reads HttpOnly cookie and validates with Supabase server; parsing JWT manually is insecure and misses refresh |
| Optimistic UI | Complex state machine | Simple `prev` / rollback pattern | Only two outcomes: success (no change needed) or failure (restore `prev`); keep it flat |
| Toggle logic | Complex upsert | Check-then-insert or check-then-delete | Supabase does not support `ON CONFLICT DO DELETE`; the check-then-act two-step is reliable given the UNIQUE constraint |

---

## Common Pitfalls

### Pitfall 1: Using Wrong Supabase Client in Route Handlers

**What goes wrong:** `supabase.auth.getUser()` returns null even for signed-in users. Route Handler returns 401 to authenticated users.
**Why it happens:** The anon singleton (`lib/supabase.ts` or direct `createClient` from `@supabase/supabase-js`) does not read HttpOnly session cookies — it only knows about the anon key.
**How to avoid:** Always `import { createClient } from '@/lib/supabase/server'` in Route Handlers that need auth. The SSR client reads cookies from the incoming request.
**Warning signs:** `user` is always null in the Route Handler despite the frontend user being signed in.

### Pitfall 2: Like Count Drift After Rollback

**What goes wrong:** User taps like, optimistic +1 shows. Server returns error, rollback fires. But a second tap happened before rollback, causing the count to drift.
**Why it happens:** Concurrent rapid taps create overlapping async operations.
**How to avoid:** Debounce the action handler with a `processing` flag per video: if a like is in-flight, ignore the second tap.

```typescript
const [processingLike, setProcessingLike] = useState<Set<string>>(new Set())

async function handleLike(videoId: string) {
  if (processingLike.has(videoId)) return
  setProcessingLike(s => new Set(s).add(videoId))
  // ... do the optimistic update + fetch
  setProcessingLike(s => { const n = new Set(s); n.delete(videoId); return n })
}
```

### Pitfall 3: Social State Not Refreshing After Sign-In

**What goes wrong:** User signs in via AuthBottomSheet. Feed still shows isLiked=false and empty bookmark state.
**Why it happens:** The `useEffect` that loads social state depends on `[user, videos]`. If `user` reference changes but the effect deps are stale or the dependency isn't `user` directly, the fetch doesn't re-run.
**How to avoid:** Use `user?.id` as the dep (string, stable identity) rather than `user` (object, new reference on each render).

```typescript
useEffect(() => {
  if (!user?.id || videos.length === 0) return
  // fetch social state
}, [user?.id, videos.length]) // user.id is stable string; videos.length triggers after edition switch
```

### Pitfall 4: like_count on videos Not Updated Because Migration Not Applied

**What goes wrong:** `like_count` column does not exist; feed API returns null or error on the select.
**Why it happens:** Two migration locations exist (`supabase/migrations/` and `frontend/supabase/migrations/`). If the new migration is put in the wrong folder or not pushed, the column is absent.
**How to avoid:** Confirm migration location — Phase 7 used `frontend/supabase/migrations/`. Write the social migration there. Apply via `cd frontend && supabase db push` or Dashboard SQL Editor. Verify in Table Editor before testing the frontend.
**Warning signs:** Supabase returns `column "like_count" does not exist` error in the API route.

### Pitfall 5: Videos Table Anon RLS Allows Count Read But Not Like Count Column

**What goes wrong:** The existing `"anon can read videos"` policy with `USING (true)` covers all columns. Adding `like_count` does NOT require a new RLS policy — it's already covered. But if someone creates a column-level policy (Supabase does not support column-level RLS directly), they may create confusion.
**Why it happens:** Trying to over-restrict column reads.
**How to avoid:** No new RLS policies needed on `videos` for `like_count`. The existing `"anon can read videos"` policy covers new columns automatically.

### Pitfall 6: `onSocialAction` Callback Signature Change Breaks VideoFeed

**What goes wrong:** VideoItem's `onSocialAction` is updated to pass `videoId` as second arg, but VideoFeed's `handleSocialAction` still has the old `(action)` signature — TypeScript error blocks compilation.
**Why it happens:** Interface and implementation change must be made atomically.
**How to avoid:** Update VideoItem's interface, implementation, and VideoFeed's handler in the same task. TypeScript will catch mismatches before runtime.

---

## Code Examples

### Complete Migration File

```sql
-- Source: project pattern from frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql
-- frontend/supabase/migrations/20260325000001_add_social_tables.sql

-- ============================================================
-- Add like_count column to videos
-- ============================================================
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- video_likes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_likes_video ON public.video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user  ON public.video_likes(user_id);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read likes"
  ON public.video_likes FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "users can insert own likes"
  ON public.video_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own likes"
  ON public.video_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- video_bookmarks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_bookmarks_user ON public.video_bookmarks(user_id);

ALTER TABLE public.video_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own bookmarks"
  ON public.video_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own bookmarks"
  ON public.video_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own bookmarks"
  ON public.video_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Trigger to maintain like_count on videos
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();
```

### Route Handler Auth Check Pattern

```typescript
// Source: lib/supabase/server.ts pattern established in Phase 7
// frontend/app/api/social/like/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ... mutation logic
}
```

### VideoItem Social Props (additions only)

```typescript
// frontend/components/VideoItem.tsx — prop additions
interface VideoItemProps {
  // ... existing props unchanged ...
  onSocialAction?: (action: 'like' | 'bookmark' | 'comment', videoId: string) => void
  likeCount?: number       // NEW
  isLiked?: boolean        // NEW
  isBookmarked?: boolean   // NEW
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Realtime like counts via WebSocket | Optimistic UI + denormalized count | Decided in STATE.md (Supabase free tier 200 concurrent) | No Supabase Realtime subscription needed; simpler, cheaper |
| Aggregate COUNT query per request | Denormalized `like_count` column + trigger | Standard practice 2023+ | O(1) read vs O(n rows) COUNT; critical for feed performance |
| User social state server-side | Client-side fetch after auth resolves | Phase 9 design decision | Keeps feed server render auth-free; correct separation of concerns |

**Decided and locked in STATE.md:**
- Realtime like counts: deferred — optimistic UI is sufficient (Supabase free tier 200 concurrent connections)
- Social mutations: via dedicated Route Handlers at `/api/social/*` — Python pipeline stays auth-unaware

---

## Open Questions

1. **`/api/today` does not yet return `like_count`**
   - What we know: The `like_count` column will be on `videos` after migration. The existing `/api/today` select already queries all `videos` columns implicitly via `videos ( id, position, headline, source_url, video_url, duration )` — but the column list is explicit, so `like_count` won't appear unless added.
   - What's unclear: Does the planner want to add `like_count` to the feed API response (so guests get counts on initial page load without a second request), or fetch via `/api/social/state`?
   - Recommendation: Add `like_count` to the `videos(...)` select in `/api/today` and `/api/editions/[id]` so it's available on first render. This removes the need for a separate count fetch for guests. The `Video` TypeScript type should also gain `like_count: number`. This is a minor change to two existing API routes — low risk.

2. **`/api/social/state` vs direct client Supabase query**
   - What we know: The browser client (`createBrowserClient`) can query `video_likes` directly with the user's session. This would avoid a Round-trip via a Route Handler.
   - What's unclear: Whether a direct client query is the right pattern given the project uses Route Handlers for all social mutations.
   - Recommendation: Use a Route Handler for consistency with the established pattern (`/api/social/state`). Direct client queries would require the browser client to have the session (it does), but Route Handlers keep the query logic server-side and consistent with the mutation endpoints.

3. **`Video` type update and `like_count` in useEdition**
   - What we know: `useEdition.ts` defines `interface Video { id, position, headline, video_url, duration, source_url }`. Adding `like_count` here requires touching both the interface and the `/api/today` return.
   - Recommendation: Add `like_count: number` to the `Video` interface in `useEdition.ts` when updating the API. Initialize to 0 if absent (for backward compat with older edition data).

---

## Plan Breakdown Recommendation

Phase 9 naturally splits into 3 plans:

**Plan 09-01: Database Migration**
- Write `frontend/supabase/migrations/20260325000001_add_social_tables.sql`
- Add `like_count` to `videos`, create `video_likes` and `video_bookmarks` with RLS and trigger
- Apply migration (user step: `supabase db push` or Dashboard SQL Editor)
- Update `Video` type in `useEdition.ts` to include `like_count`
- Update `videos(...)` select in `/api/today` and `/api/editions/[id]` to include `like_count`

**Plan 09-02: Route Handlers**
- Create `/api/social/like/route.ts` — POST toggle like
- Create `/api/social/bookmark/route.ts` — POST toggle bookmark
- Create `/api/social/state/route.ts` — GET user social state for list of videoIds
- All three use `createClient()` from `lib/supabase/server.ts`

**Plan 09-03: Frontend Wiring**
- Update `VideoItem.tsx` — add `likeCount`, `isLiked`, `isBookmarked` props; update `onSocialAction` signature to pass `videoId`; render filled/unfilled icons based on state
- Update `VideoFeed.tsx` — add `socialState` map; add `useEffect` to load social state after auth resolves; add `handleLike` and `handleBookmark` with optimistic update + rollback; update `handleSocialAction` to call real handlers for signed-in users

---

## Sources

### Primary (HIGH confidence)

- `frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql` — RLS policy patterns, SECURITY DEFINER trigger pattern
- `supabase/migrations/20260224000000_initial_schema.sql` — `videos.id` UUID PK confirmed, existing RLS patterns
- `frontend/app/auth/actions.ts` — Server Action pattern (createClient from server.ts, getUser(), throw on error)
- `frontend/lib/supabase/server.ts` — SSR client factory (confirmed exists and works)
- `frontend/components/VideoFeed.tsx` — current handleSocialAction stub, useAuth integration, feed data flow
- `frontend/components/VideoItem.tsx` — current onSocialAction signature, stub social buttons
- `frontend/app/api/today/route.ts` — feed API is auth-unaware anon singleton; explicit column select
- `frontend/app/page.tsx` — server-rendered initial feed, VideoFeed receives initialEdition prop
- `.planning/STATE.md` — locked decisions: Route Handlers for social, optimistic UI, Realtime deferred

### Secondary (MEDIUM confidence)

- Supabase documentation pattern for denormalized counts + triggers — standard PostgreSQL best practice, consistent with profiles trigger in Phase 7

### Tertiary (LOW confidence)

- None — all critical claims are grounded in existing project code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools confirmed present
- Architecture: HIGH — migration pattern, RLS pattern, Route Handler pattern all directly observed in existing code
- Pitfalls: HIGH — wrong Supabase client pitfall is directly observable from code; others are logical consequences of the architecture

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days — Supabase and @supabase/ssr are stable for this scope)
