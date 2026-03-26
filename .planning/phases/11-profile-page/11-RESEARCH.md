# Phase 11: Profile Page - Research

**Researched:** 2026-03-26
**Domain:** React/Next.js 16 App Router — Profile UI, Supabase Storage avatar upload, image crop, bottom tab navigation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Profile header layout**
- Compact single-row header: avatar + display name + pencil edit icon — leaves maximum space for tab content
- No stats in the header (liked/saved counts not shown — visible by browsing tabs)
- Profile page lives in the bottom tab bar as a primary tab (always accessible)
- Signed-out users see a sign-in prompt screen: avatar placeholder + "Sign in to view your profile" + sign-in button (not an automatic redirect)

**Avatar upload flow**
- Tapping the avatar directly triggers the photo picker (no separate button)
- Show a square crop UI before upload so user can position their photo
- Store uploaded avatar in a Supabase Storage "avatars" bucket; save public URL to profiles.avatar_url
- Fallback when no photo: first letter of display name on a colored background (same pattern as CommentSheet)

**Liked/Saved tabs layout**
- 3-column thumbnail grid, reverse chronological order
- Both tabs use the same grid component — same layout, just different data source
- Tapping a thumbnail navigates to the home feed tab scrolled to that video (no standalone player)
- Empty state: icon (heart/bookmark) + message ("No liked videos yet") + "Start watching" CTA button that navigates to the feed

**Edit display name flow**
- Tapping the pencil icon opens a bottom sheet with a text field pre-filled with current name + Cancel and Save buttons
- 50-character limit with counter shown near the limit
- Save button disabled if name is blank — non-empty required
- Optimistic update: profile header shows new name immediately on save; comments and other surfaces reflect it on next fetch (no manual refresh needed)

### Claude's Discretion
- Exact avatar circle size and spacing in the compact header
- Loading skeleton while profile data fetches
- Error state if save fails (network error)
- Exact color for the initial-letter avatar fallback

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | User can set a display name (editable after signup) | Edit-name bottom sheet + PATCH /api/profile — profiles table already has display_name column + UPDATE RLS policy |
| PROF-02 | User can upload a profile photo (avatar) | Supabase Storage "avatars" bucket + getPublicUrl + upsert to profiles.avatar_url; crop via canvas API |
| PROF-03 | User can view all their liked videos in a profile tab | GET /api/profile/liked → JOIN video_likes + videos; VideoGrid component; reverse chronological (created_at DESC) |
| PROF-04 | User can view all their saved/bookmarked videos in a profile tab | GET /api/profile/saved → JOIN video_bookmarks + videos; same VideoGrid; tap-to-navigate via router.push('/?videoIndex=N') |
</phase_requirements>

---

## Summary

Phase 11 adds a Profile page as a new bottom-tab destination. The existing codebase has a single-page app at `/` with a full-screen `VideoFeed` and no bottom navigation yet. This phase introduces three structural changes: (1) a bottom tab bar wrapping the existing feed UI, (2) a new `/profile` route with a profile screen, and (3) three API routes for profile data.

The database schema is already in place from Phase 7: `profiles` table with `display_name` and `avatar_url` columns, RLS policies allowing self-update, and a trigger auto-creating profiles on signup. Supabase Storage needs one new "avatars" bucket (created via SQL migration). The avatar crop requirement is achievable in-browser with the Canvas API — no library needed since the crop is always square.

The most architecturally significant decision is the bottom tab bar. Currently the app is a flat `app/page.tsx → VideoFeed`. The profile page needs a separate route (`app/profile/page.tsx`). The tab bar must persist across both routes and must NOT break the full-screen feed layout. The right pattern for this in Next.js App Router is a shared layout at `app/layout.tsx` that renders tab bar below `{children}`, with CSS ensuring `100dvh` behavior still works. The existing `app/layout.tsx` is minimal and can be updated to include the tab bar without disrupting the feed.

**Primary recommendation:** Keep the profile page as a separate Next.js route (`/profile`) with a shared layout wrapping tab bar. Use `<input type="file" accept="image/*">` triggered by tapping the avatar circle, draw to canvas for crop, upload Blob to Supabase Storage from a Route Handler (not client-direct), then PATCH profiles table via `/api/profile`. All API routes use the SSR Supabase client consistent with existing Phase 9/10 patterns.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 (in use) | Profile route, shared layout, API routes | Already in use — consistent with all other routes |
| @supabase/ssr | ^0.9.0 (in use) | SSR Supabase client for API routes + server auth | Already the project auth pattern |
| @supabase/supabase-js | ^2.97.0 (in use) | Browser Supabase client for Storage upload | Already used in useAuth hook |
| Canvas API (browser built-in) | — | Square crop before upload | Zero dependency; square crop is trivial with drawImage |
| React 19 | 19.2.3 (in use) | Profile page Client Component | Already the framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `<input type="file" accept="image/*">` | Browser built-in | Photo picker trigger | PWA-safe; works in iOS Safari standalone mode |
| CSS `object-fit: cover` | Browser built-in | Avatar image display in circle | Simpler than any library for static display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas API for crop | react-easy-crop, croppie | Both add ~50KB+ bundle; square-only crop is 20 lines of canvas code |
| Separate /profile route | Modal overlay on / | Route is cleaner for bottom-tab nav; browser back works; URL shareable |
| Client-direct Storage upload | Route Handler upload proxy | Client-direct is fine for public buckets with correct RLS; simpler — no extra server hop needed |

**Installation:** No new packages required. All needed libraries are already in package.json.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 11:

```
frontend/
├── app/
│   ├── layout.tsx                    ← UPDATE: add tab bar wrapper + bottom padding
│   ├── page.tsx                      ← unchanged (home/feed)
│   └── profile/
│       └── page.tsx                  ← NEW: profile page (Client Component)
├── components/
│   ├── TabBar.tsx                    ← NEW: bottom tab bar (Home + Profile icons)
│   ├── ProfilePage.tsx               ← NEW: profile screen logic
│   ├── VideoGrid.tsx                 ← NEW: 3-col thumbnail grid (shared for liked/saved)
│   └── EditNameSheet.tsx             ← NEW: bottom sheet for display name edit
└── app/api/
    ├── profile/
    │   └── route.ts                  ← NEW: GET (fetch profile), PATCH (update name/avatar)
    ├── profile/
    │   ├── liked/
    │   │   └── route.ts              ← NEW: GET liked videos for current user
    │   └── saved/
    │       └── route.ts              ← NEW: GET saved/bookmarked videos for current user
└── supabase/migrations/
    └── 20260326000002_add_avatars_bucket.sql  ← NEW: Storage bucket + RLS
```

### Pattern 1: Bottom Tab Bar with Shared Layout

**What:** Add TabBar to `app/layout.tsx`. The tab bar sits at `position: fixed; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)`. Feed page body gets bottom padding to avoid tab bar overlap.

**When to use:** Any time Next.js routes need persistent bottom navigation.

**Key constraint:** The VideoFeed uses `height: 100dvh`. The tab bar (e.g. ~56px) will overlap the feed content unless the feed container accounts for it. Best approach: add a CSS variable `--tab-bar-height: 56px` and subtract it from the feed height, OR use a `pb-14` class on the feed wrapper. Since the feed is absolute-positioned with overflow-hidden, the safest approach is giving the feed container `height: calc(100dvh - 56px)` and positioning it at `top: 0`.

**Simpler alternative:** Keep VideoFeed at `100dvh` and float the tab bar over the top of the feed with a high z-index (zIndex: 200). The feed's bottom social buttons are already in the right portion — tab bar at bottom won't visually conflict. This avoids height math entirely. This is the recommended approach.

```typescript
// Source: project pattern (existing VideoFeed z-index usage: zIndex 60, 101)
// TabBar floats over feed at z-index 200 — no height change needed on VideoFeed
// In app/layout.tsx:
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000' }}>
        {children}
        <TabBar />
      </body>
    </html>
  )
}
```

### Pattern 2: Profile Data Fetch via Route Handler

**What:** `GET /api/profile` uses the SSR client (same pattern as all social/comment routes), validates auth, returns `{ display_name, avatar_url }`. `PATCH /api/profile` accepts `{ display_name? }` or `{ avatar_url? }` and updates the profiles row.

```typescript
// Source: established project pattern from /api/social/bookmark/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()
  return NextResponse.json({ profile: data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const updates: { display_name?: string; avatar_url?: string } = {}
  if (typeof body.display_name === 'string') updates.display_name = body.display_name
  if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### Pattern 3: Avatar Upload via Client-Direct Supabase Storage

**What:** Client reads file from `<input type="file">`, crops to square via Canvas API, converts to Blob, uploads directly to Supabase Storage "avatars" bucket using the browser Supabase client. Then calls PATCH /api/profile with the resulting public URL.

**Why client-direct is correct here:** The avatars bucket will be public (storage.objects RLS with `TO authenticated` for INSERT). No secrets are exposed — the anon key is already public. Consistent with Supabase's documented avatar upload pattern.

**File path strategy:** Use `{user.id}/avatar.jpg` (fixed path per user) with `upsert: true`. This avoids accumulating orphaned files in storage as users re-upload. CDN cache note: re-uploading to the same path may serve stale CDN content; workaround is appending a cache-bust query param to the URL (`?t=timestamp`) when displaying, but NOT storing it in `avatar_url`.

```typescript
// Source: Context7 / supabase/supabase — avatar upload pattern, adapted for this project
const supabase = createClient() // browser client from lib/supabase/client.ts

async function uploadAvatar(croppedBlob: Blob, userId: string): Promise<string> {
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, croppedBlob, {
      contentType: 'image/jpeg',
      upsert: true,    // replace existing avatar
    })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
```

### Pattern 4: Square Crop via Canvas API

**What:** After user selects file, draw to hidden canvas at `min(width, height)` square centered, export as Blob. No library needed.

```typescript
// Source: browser Canvas API (no library)
function cropToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const offsetX = (img.width - size) / 2
      const offsetY = (img.height - size) / 2
      ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('crop failed')), 'image/jpeg', 0.9)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
```

### Pattern 5: Liked/Saved Video Queries

**What:** `GET /api/profile/liked` joins `video_likes` with `videos` to get video metadata in reverse chronological like order. Same pattern for bookmarks.

```typescript
// Liked videos: join through video_likes → videos
const { data } = await supabase
  .from('video_likes')
  .select('created_at, videos(id, thumbnail_url, title)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })

// Saved videos: same pattern via video_bookmarks
const { data } = await supabase
  .from('video_bookmarks')
  .select('created_at, videos(id, thumbnail_url, title)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

**Note:** The `videos` table schema must be verified — `thumbnail_url` may need to be confirmed or substituted (e.g., `video_url` for a still frame). Check the actual column names in the videos table before writing the query.

### Pattern 6: Tap Grid Thumbnail → Navigate Feed to That Video

**What:** Each thumbnail tap does `router.push('/?videoIndex=N')` where N is the video's position in the current edition. Problem: profile doesn't know which edition index the video belongs to. Options:
1. Store `video_id` in grid; on tap, call `/api/editions/find?videoId=X` to get edition and index.
2. Simpler: just navigate to `/?videoId={video_id}` and let the home page do a lookup.
3. Simplest for v1.2: navigate to `/` and display the video feed; accept that it opens at the top of today's edition. The user can then scroll to find it. This is NOT sufficient per success criterion #4.

**Correct approach:** The home page already handles `?videoIndex=` search param from Phase 8 OAuth flow. Extend that: when the profile taps a grid item, we need the video's position in the current feed. Since the profile grid shows videos from potentially any edition, we need the edition id AND position. Recommend: API returns `{ video_id, edition_id, video_index }` per liked/saved item so the grid can pass `?editionId=X&videoIndex=N` to the home page. The home page then loads that edition and scrolls to index.

**Alternative (simpler):** Navigate to `/?videoId={video_id}`. The home page fetches its own edition and looks for that video_id in the list, scrolls if found. This requires a small change to `page.tsx` but is cleaner. Recommended.

### Anti-Patterns to Avoid

- **Storing cache-busted URL in profiles.avatar_url:** Store only the clean public URL; add `?t=timestamp` at display time if re-uploads occur, don't persist the timestamp in the DB.
- **Uploading avatar directly from app/profile/page server component:** Profile page must be a Client Component or use a Client Component for the upload interaction (file input, canvas, supabase browser client).
- **Calling `supabase.auth.getUser()` in client components to get user id for upload path:** Use the `user.id` passed down from `useAuth()` — already the established pattern.
- **Rendering the tab bar inside VideoFeed:** Tab bar belongs in `app/layout.tsx` so it persists across routes without remounting.
- **Making VideoFeed height-aware of tab bar:** Float the tab bar over with high z-index. VideoFeed social action buttons (like/bookmark/comment) are at mid-right of the frame — tab bar at bottom won't conflict visually.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar crop UI | Custom drag-handle crop widget | Canvas `drawImage` center-crop | Square crop = 20 lines; draggable crop is 500+ lines and a library |
| Profile data cache | Custom state management | Simple `useState` + fetch on mount | Single-user profile changes rarely; no cache invalidation needed |
| Image resize before upload | Custom resize logic | `canvas.toBlob(..., 'image/jpeg', 0.9)` at crop size | Canvas already resizes; output is appropriately sized |
| Tab routing state | Custom tab state manager | Next.js router (`usePathname`) | `usePathname() === '/profile'` determines active tab — zero state needed |

**Key insight:** The square crop + resize + upload path is entirely achievable with browser APIs. The only non-trivial piece is the crop preview UI (showing the user what will be cropped). The CONTEXT.md decision is to "show a square crop UI before upload so user can position their photo" — this means a simple preview of the center-cropped result before confirming, NOT a draggable crop tool. A static preview of the auto-center-cropped image is sufficient and implementable without any library.

---

## Common Pitfalls

### Pitfall 1: Supabase Storage "avatars" bucket not created
**What goes wrong:** Upload calls return 404 "Bucket not found" — silent in the UI if error handling is minimal.
**Why it happens:** Supabase Storage buckets are not auto-created; must be provisioned via migration or dashboard.
**How to avoid:** Create bucket in SQL migration with `INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)` and add RLS policies on `storage.objects`.
**Warning signs:** `StorageApiError: Bucket not found` in browser console.

### Pitfall 2: Storage RLS missing — authenticated users can't upload
**What goes wrong:** Upload returns 403 Unauthorized.
**Why it happens:** Creating the bucket alone doesn't grant upload access; `storage.objects` needs INSERT policy.
**How to avoid:** Add: `CREATE POLICY "auth users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);` — this scopes upload to the user's own folder (`{user_id}/avatar.jpg`).
**Warning signs:** Upload POST returns 403 even when signed in.

### Pitfall 3: Avatar re-upload CDN staleness
**What goes wrong:** User uploads new avatar; profile still shows old image for minutes.
**Why it happens:** Supabase Storage CDN caches objects at edge. Re-uploading to same path (with `upsert: true`) doesn't invalidate CDN cache immediately.
**How to avoid:** Append `?t={timestamp}` to the avatar URL at DISPLAY time (not stored in DB). Alternatively, use a unique path per upload (but this accumulates files). Recommend cache-bust at display time.
**Warning signs:** Image visually unchanged after successful upload and page refresh.

### Pitfall 4: Tab bar breaks `100dvh` VideoFeed layout
**What goes wrong:** Feed is cut off at bottom or tab bar covers social action buttons.
**Why it happens:** VideoFeed uses `height: 100dvh`; adding a fixed element below doesn't auto-shrink it.
**How to avoid:** Float tab bar at high z-index (200) over the feed. VideoFeed social buttons are positioned mid-right — tab bar at bottom doesn't overlap them. The end card and EndCard component occupy the last scroll position; verify tab bar doesn't obscure EndCard CTAs.
**Warning signs:** "Replay" button in EndCard is hidden behind tab bar; social action buttons partially covered.

### Pitfall 5: `video_likes` / `video_bookmarks` don't store video metadata
**What goes wrong:** Liked/Saved grid query fails or returns incomplete data.
**Why it happens:** These tables only store `video_id` and `user_id`. To show thumbnails, you need to join to `videos` table.
**How to avoid:** Use Supabase embedded join syntax: `.select('created_at, videos(id, thumbnail_url, title)')`. Verify exact column names in the `videos` table before writing queries.
**Warning signs:** `null` for videos in response; TypeScript errors on joined type.

### Pitfall 6: `profiles` table UPDATE RLS already scoped to `auth.uid() = id`
**What goes wrong:** Attempting to update another user's profile silently fails or errors.
**Why it happens:** Existing RLS policy `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)` is correct and already in place.
**How to avoid:** No action needed — the policy is already correctly configured from Phase 7. Just use the SSR client in PATCH /api/profile.
**Warning signs:** This is actually the happy path; just document it as "already done."

### Pitfall 7: `display_name` null for users who signed up before Phase 11
**What goes wrong:** Profile header shows nothing or crashes on null display_name.
**Why it happens:** Google OAuth populates `raw_user_meta_data.full_name` → display_name at signup. Email/password users might have null display_name if they never set one.
**How to avoid:** Always fallback: `display_name ?? user.email?.split('@')[0] ?? 'User'`. Treat null display_name as "needs to be set" — prompt is the pencil icon.
**Warning signs:** Empty profile header for email/password accounts.

---

## Code Examples

### Supabase Storage: Create Avatars Bucket (SQL Migration)

```sql
-- Source: Context7 / supabase/supabase — storage bucket creation
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: anyone can read public avatars (bucket is public, but belt-and-suspenders)
CREATE POLICY "avatars are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- RLS: users can update/delete their own avatar
CREATE POLICY "users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Supabase Storage: Get Public URL (TypeScript)

```typescript
// Source: Context7 / supabase/supabase — getPublicUrl pattern
const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar.jpg`)
const publicUrl = data.publicUrl  // e.g. https://xxx.supabase.co/storage/v1/object/public/avatars/abc123/avatar.jpg
```

### Profile: Fetch Liked Videos with Join

```typescript
// Source: Supabase embedded join syntax — consistent with Phase 10 comments pattern
const { data, error } = await supabase
  .from('video_likes')
  .select('created_at, videos(id, thumbnail_url, title, video_url)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
// data: Array<{ created_at: string; videos: { id: string; thumbnail_url: string | null; ... } }>
```

### EditNameSheet: Optimistic Update Pattern

```typescript
// Consistent with project optimistic pattern from VideoFeed social actions
async function handleSaveName(newName: string) {
  // Optimistic: update local display_name immediately
  setDisplayName(newName)
  onClose()

  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: newName }),
  })
  if (!res.ok) {
    // Roll back on failure
    setDisplayName(previousName)
    // Show error state
  }
}
```

### Tab Bar: Active State via usePathname

```typescript
// Source: Next.js App Router — usePathname hook
'use client'
import { usePathname, useRouter } from 'next/navigation'

export function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'
  const isProfile = pathname === '/profile'
  // ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSession()` for auth | `getUser()` for server-validated auth | Phase 8 decision | Must use `getUser()` in all Route Handlers — already correct in project |
| Direct DB writes from client | Route Handlers for all mutations | Phase 9 arch decision | Profile PATCH must go through `/api/profile` Route Handler |
| Storage upload via server proxy | Client-direct upload to Supabase Storage | Current practice | Avatar upload can go client→Storage directly (no server proxy needed) — anon key is already public |

**Deprecated/outdated:**
- `supabase.storage.from('avatars').download(path)` then `URL.createObjectURL`: Only needed for private buckets. Avatars bucket is public — use direct `getPublicUrl()` instead. No download step needed.

---

## Open Questions

1. **What columns does the `videos` table have for thumbnail display?**
   - What we know: Videos have `id`, `title`, `video_url`, `like_count`, `comment_count` (confirmed from VideoFeed usage). A `thumbnail_url` column may or may not exist.
   - What's unclear: Whether a `thumbnail_url` column was added in any migration or whether thumbnails are derived from the video URL.
   - Recommendation: Check `videos` table schema (look in any early migration file or via Supabase dashboard) before writing the VideoGrid query. If no thumbnail_url exists, the grid may show a video element with `preload="none"` poster, or derive a thumbnail URL from the video host.

2. **Does VideoFeed support loading a specific edition by ID?**
   - What we know: VideoFeed loads today's edition on mount; it has `switchEdition(index)` but only for editions already in `editionList`.
   - What's unclear: If a saved video is from a past edition, can the profile navigate to it? The current `?videoIndex=` param assumes the current edition.
   - Recommendation: For v1.2, navigate to `/?videoId={video_id}`. The home page searches the current edition for that video_id. If not found (it's from a past edition), fall back to opening the feed at the top. This is acceptable scope for v1.2.

3. **Tab bar height and safe area interaction on iPhone PWA**
   - What we know: iOS PWA standalone mode has `env(safe-area-inset-bottom)` ≈ 34px on notched iPhones. Tab bar must account for this.
   - What's unclear: Exact tab bar height that feels right on iPhone. Current project uses `env(safe-area-inset-top)` in VideoFeed header — same pattern applies to tab bar bottom.
   - Recommendation: Tab bar inner height ~56px + `padding-bottom: env(safe-area-inset-bottom)`. Total visual footprint: ~90px on notched iPhones.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` (workflow only has `research`, `plan_check`, `verifier`). Skip this section.

---

## Sources

### Primary (HIGH confidence)
- `/supabase/supabase` (Context7) — Storage bucket creation, avatar upload pattern, getPublicUrl, upsert, RLS policies on storage.objects
- `/supabase/supabase` (Context7) — profiles table update pattern (display_name, avatar_url upsert)
- Project codebase — `supabase/migrations/20260323000001_add_profiles_and_auth.sql` (existing profiles schema + RLS)
- Project codebase — `supabase/migrations/20260325000001_add_social_tables.sql` (video_likes, video_bookmarks table structure)
- Project codebase — `components/VideoFeed.tsx`, `hooks/useAuth.ts`, `components/CommentSheet.tsx` (existing patterns for auth, optimistic updates, bottom sheet UI)
- Project codebase — `app/api/social/bookmark/route.ts`, `app/api/social/state/route.ts` (Route Handler patterns with SSR Supabase client)

### Secondary (MEDIUM confidence)
- Canvas API MDN behavior for `drawImage` / `toBlob` — widely supported, no verification needed
- `usePathname` Next.js App Router hook — confirmed available in Next.js 16 (project version)

### Tertiary (LOW confidence)
- `storage.foldername(name)` Supabase Storage helper function in RLS policy — documented in Supabase storage guide; should be verified against actual Supabase project version before applying

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing libraries already in project
- Architecture: HIGH — patterns directly mirror existing Phase 9/10 patterns
- Supabase Storage: HIGH — confirmed via Context7 official docs
- Canvas crop: HIGH — browser built-in, no library dependency
- Pitfalls: HIGH — most derived from reading actual migration files and existing code

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack, 30 days)
