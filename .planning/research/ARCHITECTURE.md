# Architecture Research

**Domain:** Auth + Social features integration into brownfield Next.js App Router + Supabase PWA
**Researched:** 2026-03-23
**Confidence:** HIGH (official Supabase docs + existing codebase inspection)

> **Scope note:** This document covers the v1.2 auth + social milestone architecture. It extends the
> original pipeline/frontend architecture (preserved conceptually) with Supabase Auth, profiles,
> likes, bookmarks, comments, and avatar storage. The existing public feed path is explicitly
> kept unchanged.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE (middleware.ts)  — NEW                    │
│  Every request → refresh auth token via @supabase/ssr cookie refresh          │
│  Protected routes (/profile) → redirect to /login if getUser() returns null   │
│  Public routes (/, /api/today) → pass through; user may or may not exist      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌────────────────┐   ┌───────────────────┐   ┌──────────────────────────┐
│ Server         │   │ Client            │   │ API Route Handlers       │
│ Components     │   │ Components        │   │                          │
│                │   │                   │   │ EXISTING (unchanged):    │
│ page.tsx       │   │ VideoFeed         │   │   /api/today             │
│ (modified:     │   │ (modified:        │   │   /api/editions/[id]     │
│  pass user     │   │  user prop +      │   │                          │
│  prop down)    │   │  SocialOverlay)   │   │ NEW:                     │
│                │   │                   │   │   /auth/callback         │
│ profile/       │   │ VideoItem         │   │   /api/social/like       │
│ page.tsx (NEW) │   │ (modified:        │   │   /api/social/bookmark   │
│                │   │  SocialOverlay    │   │   /api/social/comments   │
│ login/         │   │  slot added)      │   │                          │
│ page.tsx (NEW) │   │                   │   │ Uses createServerClient  │
│                │   │ SocialOverlay(NEW)│   │ + getUser() for social   │
│ Uses           │   │ AuthModal (NEW)   │   │ route handlers           │
│ createServer   │   │ ProfileView (NEW) │   │                          │
│ Client()       │   │                   │   │                          │
│                │   │ Uses createBrowser│   │                          │
│                │   │ Client()          │   │                          │
└───────┬────────┘   └────────┬──────────┘   └────────────┬─────────────┘
        │                     │                            │
        └─────────────────────┴────────────────────────────┘
                              │
        ┌─────────────────────▼──────────────────────────────┐
        │              SUPABASE (free tier)                   │
        │                                                     │
        │  Auth          Postgres (RLS)     Storage           │
        │  ──────────    ──────────────     ────────────────  │
        │  Google OAuth  editions (keep)    videos/ (keep)    │
        │  Apple OAuth   videos (keep)      avatars/ (NEW)    │
        │  Email/Pass    pipeline_runs(keep)                  │
        │                profiles (NEW)                       │
        │                likes (NEW)                          │
        │                bookmarks (NEW)                      │
        │                comments (NEW)                       │
        └─────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|---------------|--------|
| `middleware.ts` | Refresh auth tokens via `@supabase/ssr` on every request; redirect `/profile` to `/login` when no session | NEW |
| `lib/supabase/server.ts` | `createServerClient()` factory using `next/headers` cookies — for Server Components, route handlers | NEW |
| `lib/supabase/client.ts` | `createBrowserClient()` for Client Components (browser only) | NEW |
| `lib/supabase/middleware.ts` | `updateSession()` helper called by `middleware.ts` | NEW |
| `lib/supabase.ts` | Existing anon-key singleton — keep unchanged for `/api/today` and `/api/editions/[id]` | KEEP |
| `app/auth/callback/route.ts` | Handle OAuth code exchange after Google/Apple redirect; set session cookie | NEW |
| `app/login/page.tsx` | Google OAuth button; email/password form; Apple deferred | NEW |
| `app/profile/page.tsx` | Server component — reads user + profile + like/bookmark counts; protected route | NEW |
| `components/SocialOverlay.tsx` | Like/bookmark/comment buttons overlaid on the video area | NEW |
| `components/AuthModal.tsx` | Bottom sheet prompting sign-in when guest taps a social action | NEW |
| `components/ProfileView.tsx` | Avatar, display name, like count, bookmark count | NEW |
| `hooks/useAuth.ts` | `onAuthStateChange` subscription; exposes `user: User \| null` and `loading: boolean` | NEW |
| `hooks/useSocial.ts` | Like/bookmark/comment mutations; optimistic state per `videoId` | NEW |
| `app/page.tsx` | Pass `user` as prop to `VideoFeed` (server-side `getUser()`) | MODIFIED |
| `components/VideoFeed.tsx` | Accept `user` prop; pass down to `VideoItem` — no change to scroll/play logic | MODIFIED |
| `components/VideoItem.tsx` | Add `SocialOverlay` as absolute-positioned child inside the video div | MODIFIED |

---

## Recommended Project Structure

```
frontend/
├── middleware.ts                      # NEW — token refresh + /profile protection
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts              # NEW — OAuth code exchange
│   ├── login/
│   │   └── page.tsx                  # NEW — Google/email sign-in UI
│   ├── profile/
│   │   └── page.tsx                  # NEW — protected server component
│   ├── api/
│   │   ├── today/route.ts            # KEEP unchanged (anon client)
│   │   ├── editions/[id]/route.ts    # KEEP unchanged (anon client)
│   │   └── social/
│   │       ├── like/route.ts         # NEW — POST/DELETE toggle like
│   │       ├── bookmark/route.ts     # NEW — POST/DELETE toggle bookmark
│   │       └── comments/route.ts     # NEW — GET list, POST add comment
│   ├── layout.tsx                    # MODIFIED — add AuthProvider if needed
│   └── page.tsx                      # MODIFIED — fetch user, pass to VideoFeed
├── components/
│   ├── VideoFeed.tsx                 # MODIFIED — accept user prop
│   ├── VideoItem.tsx                 # MODIFIED — add SocialOverlay slot
│   ├── SocialOverlay.tsx             # NEW — like/bookmark/comment buttons
│   ├── AuthModal.tsx                 # NEW — guest sign-in prompt
│   ├── ProfileView.tsx               # NEW — profile display
│   ├── EndCard.tsx                   # KEEP unchanged
│   └── MuteButton.tsx                # KEEP unchanged
├── hooks/
│   ├── useEdition.ts                 # KEEP unchanged
│   ├── useVideoPlayer.ts             # KEEP unchanged
│   ├── useAuth.ts                    # NEW — session state
│   └── useSocial.ts                  # NEW — social action mutations
└── lib/
    ├── supabase.ts                   # KEEP — anon singleton for existing API routes
    └── supabase/
        ├── client.ts                 # NEW — createBrowserClient()
        ├── server.ts                 # NEW — createServerClient()
        └── middleware.ts             # NEW — updateSession() helper
```

### Structure Rationale

- **`lib/supabase.ts` kept unchanged:** The existing anon-key singleton serves `/api/today` and `/api/editions/[id]`. These routes do not need user sessions. Adding auth must not break the existing read path.
- **`lib/supabase/` subdirectory:** Auth-aware clients live separately to prevent accidentally using the wrong client type. `server.ts` uses `next/headers` cookies; `client.ts` uses browser cookie storage. Never mix them.
- **`app/api/social/` sub-group:** Social mutations are explicit API routes rather than inline Server Actions, keeping them testable and keeping the Python pipeline completely auth-unaware.
- **`middleware.ts` at `frontend/` root:** Required location by Next.js — must be at project root, not inside `app/`.

---

## Architectural Patterns

### Pattern 1: Optional Auth — Feed is Public, Social Requires Auth

**What:** The entire video feed is accessible without login. Social actions (like, bookmark, comment) require authentication. A guest tapping a social button sees `AuthModal`. After sign-in the action completes.

**When to use:** Mandatory for FinFeed's validation-phase goal. Removing friction for watching maximizes the reach sample; requiring auth for social signals keeps data meaningful.

**Trade-offs:** User state (`user | null`) must propagate through the component tree. RLS must correctly handle both anon (read) and authenticated (read + write own rows) cases.

**Middleware pattern:**
```typescript
// frontend/middleware.ts
import { updateSession } from './lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

const PROTECTED = ['/profile', '/settings']

export async function middleware(request: NextRequest) {
  // updateSession refreshes the cookie — required by @supabase/ssr
  const response = await updateSession(request)

  // UX redirect only — RLS is the real security
  if (PROTECTED.some(p => request.nextUrl.pathname.startsWith(p))) {
    const { data: { user } } = await /* supabase from updateSession */ .auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Pattern 2: @supabase/ssr Dual-Client — Server vs Browser

**What:** Two separate client factories. `createServerClient` reads/writes cookies via `next/headers` (server components, route handlers). `createBrowserClient` uses browser cookie storage (client components only).

**When to use:** Mandatory whenever Supabase Auth sessions need to persist across the server/client boundary in Next.js App Router. The existing `@supabase/supabase-js` singleton without cookie support cannot maintain sessions.

**Trade-offs:** Slightly more boilerplate. The existing `lib/supabase.ts` singleton remains valid for the anon public read path and must not be replaced there.

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )
}

// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 3: Profiles Table + Trigger (Auth → Public Schema Sync)

**What:** `public.profiles` row is auto-created on first sign-up via a PostgreSQL trigger on `auth.users INSERT`. The app reads profiles from the public schema; it never reads `auth.users` directly (blocked by RLS).

**When to use:** Standard Supabase pattern. Required because `auth.users` is not accessible via the anon or authenticated roles.

**Trade-offs:** Trigger failure blocks signup — test with all three OAuth providers. `SECURITY DEFINER` on the function bypasses RLS so the trigger can insert without an existing RLS policy for the insert.

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Note on Apple Sign In: Apple's identity token does not include `full_name`. The fallback to `split_part(email, '@', 1)` handles this gracefully.

---

## Data Flow

### Flow 1: Guest Watching Feed (Existing Path — Unchanged)

```
User opens PWA (no session)
    ↓
middleware.ts → updateSession() → no session cookie → pass through (not a protected route)
    ↓
app/page.tsx (Server Component)
    → createServerClient().auth.getUser() → user = null
    → fetch /api/today (uses anon client, no change)
    → VideoFeed initialEdition={edition} user={null}
    ↓
VideoFeed renders videos with user=null
    → SocialOverlay shows locked/guest state icons
    → No social API calls made
```

### Flow 2: Authenticated Like Action

```
User (signed in) taps Like button on VideoItem
    ↓
SocialOverlay → useSocial.toggleLike(videoId)
    ↓
Optimistic update: flip liked=true locally; increment likeCount
    ↓
POST /api/social/like  { video_id: "uuid" }
    ↓
Route Handler:
    → createClient() from lib/supabase/server.ts (reads session cookie)
    → supabase.auth.getUser() → validates token with Supabase Auth server
    → if no user: return 401
    → INSERT INTO likes (user_id, video_id)
      ON CONFLICT (user_id, video_id) DO NOTHING
      — or DELETE if currently liked (toggle)
    ↓
200 OK → confirm optimistic state
4xx → revert optimistic state, show error toast
```

### Flow 3: Guest Taps Like (Auth Gate)

```
Guest taps Like
    ↓
SocialOverlay → useSocial.toggleLike(videoId)
    ↓
useAuth.user === null → show AuthModal (no API call made)
    ↓
User taps "Continue with Google" in AuthModal
    ↓
createBrowserClient().auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/callback` }
})
    ↓
Browser → Google consent screen
    ↓
Google → https://[project].supabase.co/auth/v1/callback
    ↓
Supabase → /auth/callback?code=abc123
    ↓
app/auth/callback/route.ts
    → exchangeCodeForSession(code) → session cookie set
    → (first login): on_auth_user_created trigger fires → profiles row created
    ↓
NextResponse.redirect('/') — user is now signed in
    ↓
VideoFeed re-renders with user set → pending like completes (optional: via URL param)
```

### Flow 4: Profile Page Load

```
User navigates to /profile
    ↓
middleware.ts → getUser() → user exists → pass through
    ↓
app/profile/page.tsx (Server Component)
    → createServerClient().auth.getUser() → user
    → SELECT * FROM profiles WHERE id = user.id
    → SELECT COUNT(*) FROM likes WHERE user_id = user.id (or denormalized count)
    → SELECT COUNT(*) FROM bookmarks WHERE user_id = user.id
    ↓
Render ProfileView with server-fetched data (no client fetch needed)
```

### State Management

```
useAuth hook (Client Component, mounted in layout or VideoFeed)
    ↓ createBrowserClient().auth.getUser() on mount
    ↓ createBrowserClient().auth.onAuthStateChange() subscription
    → user: User | null
    → loading: boolean
    Passed as prop: VideoFeed → VideoItem → SocialOverlay

useSocial(videoId) hook (per VideoItem)
    ↓ on mount: GET /api/social/like?video_id=X (if user != null)
    → liked: boolean (false for guests)
    → bookmarked: boolean
    → likeCount: number (public, visible to guests too)
    Mutations: POST/DELETE /api/social/like|bookmark
    Strategy: optimistic update → API call → revert on error
```

---

## DB Schema Changes

### New Tables (migration file)

```sql
-- profiles: one row per auth user, auto-created by trigger
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- likes: per-user per-video
CREATE TABLE public.likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

-- bookmarks: same structure as likes
CREATE TABLE public.bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

-- comments: text per video, ordered by created_at
CREATE TABLE public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_likes_video    ON public.likes(video_id);
CREATE INDEX idx_bookmarks_user ON public.bookmarks(user_id);
CREATE INDEX idx_comments_video ON public.comments(video_id, created_at DESC);
```

### RLS Policies

```sql
-- profiles: public read, owner update
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles are publicly readable"
  ON public.profiles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- likes: authenticated only, own rows
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own likes"
  ON public.likes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "users can insert own likes"
  ON public.likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own likes"
  ON public.likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- bookmarks: same three policies as likes
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
-- (insert/select/delete policies mirroring likes)

-- comments: public read, authenticated insert/delete own
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments are publicly readable"
  ON public.comments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "authenticated users can comment"
  ON public.comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete own comments"
  ON public.comments FOR DELETE TO authenticated USING (user_id = auth.uid());
```

### Storage: Avatars Bucket

A private `avatars` bucket, completely separate from the existing `videos` bucket. Path convention: `avatars/{user_id}/avatar.{ext}`. Profiles store the resulting public URL in `profiles.avatar_url`.

```sql
-- Create bucket (Supabase dashboard or migration)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false);

-- Users manage only their own folder
CREATE POLICY "users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatar URLs readable publicly (for displaying in comments etc.)
CREATE POLICY "avatars are publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');
```

Note: `public = false` on the bucket with a public SELECT policy gives URL-based read access without an open directory listing. Signed URLs are not required for avatar display.

---

## Integration Points

### New vs. Existing Code

| File | Change | Notes |
|------|--------|-------|
| `lib/supabase.ts` | KEEP | Serves `/api/today` and `/api/editions/[id]` — anon key, no sessions needed |
| `app/api/today/route.ts` | KEEP | No auth context needed for reading editions |
| `app/api/editions/[id]/route.ts` | KEEP | Same — public read |
| `frontend/package.json` | ADD `@supabase/ssr` | Required for cookie-based session management |
| `app/page.tsx` | MODIFY | Call `createServerClient().auth.getUser()` server-side; pass `user` to `VideoFeed` |
| `app/layout.tsx` | OPTIONAL MODIFY | Add `AuthProvider` context if useAuth needs to be available app-wide |
| `components/VideoFeed.tsx` | MODIFY | Accept `user: User \| null` prop; pass to `VideoItem`; no change to scroll/play/tab logic |
| `components/VideoItem.tsx` | MODIFY | Add `<SocialOverlay>` as absolute child inside the video container div |
| Python pipeline | KEEP UNCHANGED | Pipeline uses service_role key, bypasses RLS, has no auth context — stays completely isolated |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth | `signInWithOAuth({ provider: 'google' })` → redirect flow | Easiest provider. Configure in Supabase dashboard + Google Cloud Console. No key rotation. Ship first. |
| Apple Sign In | `signInWithOAuth({ provider: 'apple' })` → redirect flow | Requires Apple Developer account ($99/yr). Secret key must be regenerated every 6 months — calendar reminder required. Domain verification + Services ID setup needed. Defer to phase 2 of auth work. |
| Email/Password | `supabase.auth.signUp()` + `signInWithPassword()` | Simple to add but requires email confirmation flow and forgotten-password UI. Include as tertiary option after Google. |
| Supabase Auth | `@supabase/ssr` cookie-based sessions | Session in HTTP-only cookie. Middleware refreshes on every request. Always call `getUser()` server-side — never `getSession()`. |
| Supabase Storage (avatars) | Private `avatars` bucket; path `{user_id}/avatar.ext` | Separate from existing `videos` bucket. Upload via `createBrowserClient().storage` from client component. Store resulting public URL in `profiles.avatar_url`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `middleware.ts` ↔ Server Components | Cookies (HTTP) | Middleware refreshes cookie; Server Component reads the refreshed session |
| Server Components ↔ Route Handlers | HTTP fetch + cookies | Both use `createServerClient()` from `lib/supabase/server.ts` |
| Client Components ↔ `/api/social/*` | HTTP fetch (JSON) | Mutations go through Next.js route handlers, not directly to Supabase client |
| Client Components ↔ Supabase Auth | `createBrowserClient()` | Auth state subscription (`onAuthStateChange`) only — data reads go through API routes |
| Python pipeline ↔ Supabase | `service_role` key (bypasses RLS) | Completely unchanged. Pipeline writes editions/videos. No auth middleware touches it. |

---

## Build Order

Dependencies drive this sequence. Auth infrastructure must exist before social features can use it.

### Phase A: Auth Infrastructure (no social UI)

1. Install `@supabase/ssr` (`npm install @supabase/ssr`)
2. Create `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
3. Create `frontend/middleware.ts` (token refresh only — no route protection yet)
4. Create `app/auth/callback/route.ts` (OAuth code exchange)
5. Write migration: `public.profiles` table + `handle_new_user` trigger
6. Enable Google OAuth in Supabase Auth dashboard + Google Cloud Console
7. **Verify checkpoint:** Sign in with Google → `/auth/callback` → session cookie set → `getUser()` returns user → `profiles` row created automatically

### Phase B: Auth UI

8. Create `app/login/page.tsx` (Google button minimum; Apple button deferred)
9. Create `hooks/useAuth.ts` (`onAuthStateChange`, exposes `user`)
10. Create `components/AuthModal.tsx` (bottom sheet with "Continue with Google")
11. Add route protection for `/profile` to `middleware.ts`
12. Modify `app/page.tsx` to call `getUser()` and pass `user` to `VideoFeed`
13. **Verify checkpoint:** Guest feed works; login flow works; session persists across page reload

### Phase C: Social Schema + API Routes

14. Write migration: `likes`, `bookmarks`, `comments` tables + all RLS policies
15. Create `app/api/social/like/route.ts` (POST to like, DELETE to unlike; uses `getUser()`)
16. Create `app/api/social/bookmark/route.ts`
17. Create `app/api/social/comments/route.ts` (GET paginated + POST)
18. **Verify checkpoint:** Authenticated request creates like row; unauthenticated request returns 401; user cannot like another user's row

### Phase D: Social UI

19. Create `components/SocialOverlay.tsx` (like/bookmark/comment icon buttons)
20. Create `hooks/useSocial.ts` (optimistic mutation pattern)
21. Modify `components/VideoItem.tsx` to include `SocialOverlay` as absolute child
22. Modify `components/VideoFeed.tsx` to propagate `user` prop to `VideoItem`
23. **Verify checkpoint:** Like toggles with optimistic update; guest tap shows `AuthModal`; comment count visible to all

### Phase E: Profile Page + Avatars

24. Write migration: `avatars` storage bucket + storage RLS policies
25. Create `app/profile/page.tsx` (server component; protected route)
26. Create `components/ProfileView.tsx`
27. Add avatar upload flow to profile page
28. **Verify checkpoint:** Profile only reachable when signed in; avatar upload writes to `avatars/{user_id}/`; `profiles.avatar_url` updates

### Phase F: Apple Sign In (separate, optional)

29. Configure Apple Developer account: App ID + Services ID + Signing Key + domain verification
30. Add Apple to Supabase Auth providers; configure redirect URL
31. Add Apple button to `login/page.tsx` and `AuthModal`
32. Set recurring 6-month calendar reminder for key rotation
33. **Verify checkpoint:** Apple sign-in works on iOS Safari PWA; profile created on first sign-in

---

## Anti-Patterns

### Anti-Pattern 1: Using `getSession()` Server-Side

**What people do:** Call `supabase.auth.getSession()` in middleware, Server Components, or route handlers.

**Why it's wrong:** `getSession()` reads the JWT from the cookie without re-validating it with the Supabase Auth server. The session could be expired, revoked, or crafted. The official docs explicitly warn against this. CVE-2025-29927 demonstrated that middleware session checks can be bypassed.

**Do this instead:** Always use `supabase.auth.getUser()` in server code — it calls the Supabase Auth server to validate. In client components, `getSession()` is acceptable because the JWT is already in a trusted browser context.

### Anti-Pattern 2: Replacing the Existing Anon Client Everywhere

**What people do:** Replace `lib/supabase.ts` with `lib/supabase/server.ts` across all API routes, including `/api/today`.

**Why it's wrong:** `/api/today` and `/api/editions/[id]` do not need user sessions. Forcing them through the SSR client adds cookie overhead and complexity for no benefit. More importantly — these routes work today and the migration should not touch them.

**Do this instead:** Keep `lib/supabase.ts` for the existing public API routes. Use `lib/supabase/server.ts` only in new routes and components that need user context.

### Anti-Pattern 3: Relying on Middleware as the Only Auth Guard

**What people do:** Only check auth in `middleware.ts` and assume protected routes are safe.

**Why it's wrong:** Middleware is an UX layer, not a security layer. The real security is RLS at the database: `auth.uid()` in every policy ensures that even a direct API call with a manipulated session gets nothing. Each social route handler must call `getUser()` independently before any mutation.

**Do this instead:** Middleware redirects for UX. Route handlers call `getUser()` and return 401 if no user. RLS ensures the DB rejects unauthorized operations even if both of the above fail.

### Anti-Pattern 4: Lifting All Social State into VideoFeed

**What people do:** Add `liked[]`, `bookmarked[]`, `likeCount[]` arrays to `VideoFeed` state, parallel to the `videos` array.

**Why it's wrong:** `VideoFeed` is already complex — it owns scroll tracking, play/pause, edition switching, and tab switching. Adding social state to it increases coupling. Every like toggle would re-render the entire feed including all video elements.

**Do this instead:** `SocialOverlay` fetches and owns its social state via `useSocial(videoId)`. State is co-located with the component that displays it. `VideoFeed` only passes `user` down — it has no opinion about social state.

### Anti-Pattern 5: Implementing Apple Sign In in the Same Phase as Google

**What people do:** Build Google + Apple together in one pass.

**Why it's wrong:** Apple OAuth requires a paid Developer account, a 6-month mandatory secret key rotation, domain verification, and a Services ID that must be configured separately from the App ID. If Apple sign-in breaks (most likely: missed key rotation), it blocks all iOS sign-in. Getting it wrong produces cryptic OAuth errors.

**Do this instead:** Ship Google OAuth first. Validate the auth infrastructure works end-to-end across the full social feature set. Add Apple Sign In as a follow-on phase with explicit reminder setup for key rotation.

### Anti-Pattern 6: Storing Avatar Files in the Videos Bucket

**What people do:** Reuse the existing `videos` storage bucket for user avatars.

**Why it's wrong:** The `videos` bucket is public and has no user-scoped RLS. User avatar data would be accessible to anyone with a URL pattern. Cleanup policies intended for video files would interfere with avatar storage.

**Do this instead:** Create a separate `avatars` bucket with its own RLS policies scoped to `auth.uid()`. Keep infrastructure boundaries clear: `videos/` = pipeline content, `avatars/` = user content.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Current schema covers all needs. No changes. Free tier handles it. |
| 1k–10k users | Add denormalized `like_count` column to `videos` table updated by trigger — avoid per-video `COUNT(*)` queries on every feed load. |
| 10k+ users | Supabase free tier compute limits become a concern. Upgrade to Pro ($25/mo). Consider Upstash Redis for social count caching to reduce DB load. |

### Scaling Priorities

1. **First bottleneck:** `SELECT COUNT(*) FROM likes WHERE video_id = $1` runs on every feed load for every video. Resolve with a `like_count` integer column on `videos`, updated by INSERT/DELETE trigger. Do not add prematurely — only when query metrics show it.
2. **Second bottleneck:** Supabase free tier has a 60-connection limit (pooled). Resolved by upgrading to Pro or enabling Supabase's built-in PgBouncer connection pooler.

---

## Sources

- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official
- [User Management (Profiles Table + Trigger) | Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data) — HIGH confidence, official
- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control) — HIGH confidence, official
- [Login with Apple | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) — HIGH confidence, official; Apple key rotation requirement confirmed
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google) — HIGH confidence, official
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official
- [How to protect routes using @supabase/ssr? · Discussion #21468](https://github.com/orgs/supabase/discussions/21468) — MEDIUM confidence, community
- Existing codebase: `frontend/lib/supabase.ts`, `frontend/app/api/today/route.ts`, `frontend/components/VideoFeed.tsx`, `frontend/components/VideoItem.tsx`, `supabase/migrations/` — HIGH confidence, source of truth for existing boundaries

---
*Architecture research for: FinFeed Auth + Social integration (brownfield Next.js App Router + Supabase)*
*Researched: 2026-03-23*
