# Pitfalls Research: Auth + Social Features on Existing Next.js + Supabase PWA

**Domain:** Adding Supabase Auth (Google/Apple OAuth + email) and social features (likes, comments, bookmarks) to a brownfield Next.js 16 App Router PWA already using Supabase for storage/data.
**Researched:** 2026-03-23
**Confidence:** HIGH — verified against Supabase official docs, GitHub issue tracker, and known CVEs. iOS Safari PWA pitfalls confirmed by multiple independent community sources.

> **Scope note:** FinFeed v1.0/v1.1 pitfalls (pipeline, FFmpeg, TTS, Groq, RSS) are documented in a prior research pass. This document focuses exclusively on the auth and social feature addition milestone.

---

## Critical Pitfalls

---

### Pitfall 1: iOS Safari PWA — OAuth Redirect Breaks the Standalone Context

**What goes wrong:**
When FinFeed is installed as a PWA on iOS (Add to Home Screen), every OAuth flow — Google or Apple — opens a new browser window outside the standalone app. The OAuth provider redirects back to your callback URL, but iOS drops the navigation into Safari (full browser), not back into the installed PWA. The user is now in Safari, authenticated, but the PWA instance never receives the session. The user returns to the home screen icon, opens the PWA, and is still logged out. This is a **complete auth failure** on the most common platform for this app.

**Why it happens:**
iOS enforces strict scope rules for standalone PWAs. When a PWA's navigation leaves its declared scope (which happens during an OAuth redirect to `accounts.google.com` or `appleid.apple.com`), iOS opens Safari for the out-of-scope URL. The session cookie, localStorage, and service worker are **not shared** between the Safari browser context and the installed PWA context. The auth callback writes the session into Safari's context, not the PWA's.

Additionally, `window.open()` calls inside `async` functions on iOS PWA are silently blocked. Since Supabase's `signInWithOAuth()` is async-aware, it triggers the popup block. The window either never opens or opens disconnected from the PWA's context.

**How to avoid:**
Use one of these three approaches (in recommended order):

1. **Email OTP / Magic Link (recommended for FinFeed's audience):** The magic link flow keeps the user inside the PWA for the entire auth journey. Supabase sends an email with a link; the user taps it from their email app, and the deep link returns to the PWA scope if configured correctly with universal links. Verified working in Supabase community discussions.

2. **Server-side PKCE with redirect (not popup):** Configure `signInWithOAuth` to use `redirectTo` pointing to your callback route rather than opening a popup. The redirect flow is less broken than the popup flow, but the scope-switch issue still applies on iOS. Mitigate by making the redirect callback page minimal and immediately redirecting back to the PWA scope URL after exchanging the code. Add the callback URL to the PWA manifest scope if possible.

3. **Pre-open window synchronously before calling async auth:**
   ```typescript
   // Open the window synchronously before any await — iOS allows this
   const authWindow = window.open('', '_blank');
   const { data } = await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/auth/callback`,
       skipBrowserRedirect: true,
     },
   });
   if (authWindow && data.url) {
     authWindow.location.href = data.url;
   }
   ```

Do NOT implement OAuth as the only auth option if iOS PWA is a primary target. Always offer email as a fallback.

**Warning signs:**
- QA on desktop Chrome passes, but testers on iPhone report "always logged out" after Google sign-in
- Network logs show the OAuth callback URL receiving the code but `supabase.auth.getSession()` returning null in the app
- Users report being prompted to log in again every time they open the app icon

**Phase to address:** Auth foundation phase (first auth phase). This must be resolved before shipping any auth feature — building social features on a broken auth foundation is wasted work.

---

### Pitfall 2: Supabase Middleware Running on Every Request — Performance and CVE Risk

**What goes wrong:**
The standard Supabase SSR setup for Next.js App Router requires a `middleware.ts` that calls `supabase.auth.getUser()` on every request to refresh the session token. Without a proper `matcher` config, this middleware runs on every static asset request (`_next/static`, images, favicons), triggering a Supabase Auth network call for each. Community reports show this causing 9+ middleware invocations per page load.

A separate but related issue: **CVE-2025-29927** (CVSS 9.1, disclosed March 2025) allows attackers to bypass Next.js middleware entirely by spoofing the `x-middleware-subrequest` header. This means if your auth check lives **only** in middleware, it can be bypassed trivially on unpatched Next.js versions.

**Why it happens:**
The default Supabase Next.js quickstart template omits the `matcher` config. New integrations copy-paste the template verbatim. The CVE risk exists because developers assume middleware is sufficient for auth enforcement — it is not.

**How to avoid:**
Add a matcher that excludes static assets:
```typescript
// middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

Never use middleware as the sole auth gate. Always verify the session at the data access point (in Server Components using `supabase.auth.getClaims()`, or in API routes before returning data). Middleware is for session refresh and redirect logic only.

Upgrade Next.js to >= 15.2.3 (or 14.2.25 for v14, 13.5.9 for v13) to patch CVE-2025-29927. FinFeed uses Next.js 16, so verify the version ships with the fix.

**Warning signs:**
- Vercel function invocation counts are unexpectedly high
- Page loads are slow — network waterfall shows multiple auth calls before any content
- Middleware runs on `.png` or `.js` requests (visible in server logs)

**Phase to address:** Auth foundation phase. The matcher must be set up before any load testing or production traffic.

---

### Pitfall 3: Trusting `getSession()` in Server Code Instead of `getClaims()` / `getUser()`

**What goes wrong:**
`supabase.auth.getSession()` inside Server Components, Route Handlers, or middleware reads the session from cookies without revalidating the JWT signature against the Supabase Auth server. This means a spoofed or expired cookie can pass as a valid session. For FinFeed's social write operations (POST a like, POST a comment), this is a security hole — an attacker could write likes/comments as any `user_id` if the Route Handler trusts `getSession()`.

**Why it happens:**
`getSession()` is the familiar, simple API. The Supabase docs note this limitation but it's easy to miss in quickstarts and third-party tutorials.

**How to avoid:**
In any server-side code that gates a write operation, use `getClaims()` (which validates the JWT signature) or `getUser()` (which makes a server-to-server validation call):
```typescript
// Route Handler for POST /api/likes
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  // Use getClaims() for performance, getUser() for strictest security
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // user.id is now verified — safe to use in DB write
}
```

**Warning signs:**
- Route Handlers that read `session.user.id` from `getSession()` without a secondary verification step
- Auth middleware that passes `session` from cookies directly to downstream components without re-verification

**Phase to address:** Auth foundation phase, and enforced during every social feature phase (every write endpoint must be audited).

---

### Pitfall 4: RLS Enabled on Social Tables but Missing Policies — Silent Empty Results

**What goes wrong:**
Enabling RLS on `likes`, `comments`, or `bookmarks` tables with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` without immediately adding policies causes all queries to return zero rows — no error, no warning, just empty. If the frontend shows an empty likes count, developers assume the feature isn't working, not that RLS is silently filtering everything. This is especially dangerous during development when you test with the Supabase Dashboard SQL editor, which runs as the `postgres` superuser and **bypasses RLS entirely**, making the feature appear to work.

**Why it happens:**
Supabase's RLS model defaults to deny-all when enabled without policies. The SQL editor's superuser context masks this during development. Developers don't notice until they test through the actual client SDK with a real user token.

**How to avoid:**
Always add at minimum a permissive read policy when enabling RLS:
```sql
-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Public read (for like counts visible to all users including guests)
CREATE POLICY "likes_read_public"
  ON public.likes FOR SELECT
  USING (true);

-- Authenticated write only
CREATE POLICY "likes_insert_authenticated"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);
```

**Never test RLS through the Supabase Dashboard SQL editor.** Use the client SDK with a real user session, or use the RLS testing helper in the dashboard ("Test policies as role: authenticated").

**Warning signs:**
- Social feature appears to work in SQL editor but returns empty in the app
- Like counts are 0 even after inserting test rows manually
- No errors in logs — just empty arrays from the Supabase client

**Phase to address:** Every phase that creates a social table. The RLS policy must be written in the same migration that creates the table — never defer it.

---

### Pitfall 5: RLS Policy Missing Index — Count Queries at Scale Become Table Scans

**What goes wrong:**
A `likes` table with an RLS policy like `auth.uid() = user_id` performs well at 100 rows. At 100,000 rows, every `SELECT COUNT(*) FROM likes WHERE video_id = $1` triggers a sequential table scan because PostgreSQL evaluates the RLS policy as a row-level filter, not a WHERE clause — unless the column used in the policy is indexed. The Supabase free tier Postgres instance is single-core; a table scan on a 100k-row table can take seconds.

**Why it happens:**
Developers write RLS policies without thinking about the query plan. The RLS policy is invisible at the application layer — it appears to be a simple `SELECT COUNT(*)`, but the actual query plan includes the policy predicate.

**How to avoid:**
Add composite indexes on every column referenced in RLS policies AND in common query filters:
```sql
-- For likes table: index on both columns used in policies and queries
CREATE INDEX idx_likes_video_id ON public.likes (video_id);
CREATE INDEX idx_likes_user_id ON public.likes (user_id);
-- Composite for "did this user like this video?" check
CREATE INDEX idx_likes_user_video ON public.likes (user_id, video_id);

-- For comments table
CREATE INDEX idx_comments_video_id ON public.comments (video_id);
CREATE INDEX idx_comments_created_at ON public.comments (created_at DESC);
```

Also: wrap `auth.uid()` in a security definer function to prevent re-evaluation per row:
```sql
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
$$;
```
(Supabase handles this internally, but verify with `EXPLAIN ANALYZE` if policies feel slow.)

**Warning signs:**
- Supabase dashboard shows slow queries on social tables
- Like counts take 1-2 seconds to load when the video has many interactions
- `EXPLAIN ANALYZE` shows `Seq Scan` instead of `Index Scan` on the likes table

**Phase to address:** Social data model phase (when tables are created). Add indexes in the same migration — retrofitting them on a live table with data requires `CREATE INDEX CONCURRENTLY` to avoid locking.

---

### Pitfall 6: Supabase Storage Avatar Upload — RLS Policy Misconfigured for User-Scoped Paths

**What goes wrong:**
Allowing authenticated users to upload avatars to Supabase Storage requires an RLS policy on `storage.objects` that restricts each user to their own path prefix (e.g., `avatars/{user_id}/avatar.jpg`). The most common mistake is writing a policy that checks the bucket name but not the path, allowing any authenticated user to overwrite any other user's avatar.

A second common mistake: the service role key is used in a Next.js Route Handler to upload avatars server-side, but the RLS policy's metadata timing check fires before the insert completes, causing a 403 even with a valid service role.

**Why it happens:**
Storage RLS is on `storage.objects`, not on a regular table. The path structure (`name` column in `storage.objects`) must be part of the policy. Developers who are comfortable with table RLS don't realize Storage has its own policy syntax.

**How to avoid:**
```sql
-- Allow authenticated users to upload to their own folder only
CREATE POLICY "avatar_upload_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public reads from avatars bucket
CREATE POLICY "avatar_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow users to update/delete their own avatar
CREATE POLICY "avatar_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING ((storage.foldername(name))[1] = auth.uid()::text);
```

For client-side uploads (preferred for avatars): use the Supabase client SDK directly from the browser with the user's session — no server Route Handler needed. The SDK sends the JWT automatically and the `storage.foldername` check validates the path.

**Warning signs:**
- Any authenticated user can see other users' uploaded files but shouldn't be able to overwrite them — but they can
- Upload succeeds in Supabase dashboard but returns 403 from the client SDK
- Error message: "new row violates row-level security policy for table objects"

**Phase to address:** User profile / avatar phase.

---

### Pitfall 7: Apple Sign In — 6-Month Secret Key Expiry Causes Silent Auth Failure

**What goes wrong:**
Apple OAuth for web (as opposed to native iOS apps) requires a client secret generated from a `.p8` private key file. Apple requires this secret to be **regenerated every 6 months**. When the secret expires, Sign in with Apple returns a cryptic "unknown client" error to users. The app's Google OAuth continues working, creating a confusing half-broken state.

**Why it happens:**
This is a mandatory Apple developer requirement that is not surfaced by Supabase or any monitoring. There is no expiry notification — the secret silently stops working on the 183rd day.

**How to avoid:**
- Set a recurring calendar reminder at key generation time: "Regenerate Apple OAuth secret — FinFeed" every 5.5 months (ahead of the 6-month deadline)
- Store the `.p8` file in a secure location (1Password, AWS Secrets Manager) — you need it for every rotation
- After rotation, update `SUPABASE_AUTH_APPLE_SECRET` in Supabase dashboard immediately
- Consider implementing a health check endpoint that calls Apple's token validation endpoint to detect expiry before users do

This pitfall only applies to the web OAuth flow. If FinFeed later adds native iOS/Android via Capacitor, the native flow has a different setup that does not require 6-month rotation.

**Warning signs:**
- Sign in with Apple stops working for all users at once
- Supabase Auth logs show "invalid_client" or "unknown client" from Apple
- Google sign-in still works but Apple does not

**Phase to address:** Apple OAuth setup phase. Document the rotation requirement immediately in the project's ops runbook.

---

### Pitfall 8: Vercel Preview Deployments Break OAuth Redirect URLs

**What goes wrong:**
Google OAuth and Supabase both require explicit redirect URL whitelisting. Vercel generates a unique URL for every preview deployment (`https://finfeed-abc123-username.vercel.app`). These URLs are not whitelisted in Google Cloud Console (which doesn't support wildcards in Authorized JavaScript Origins) or in Supabase's Redirect URL allow-list. Result: OAuth fails silently on every preview deployment, making it impossible to test auth flows before merging to production.

**Why it happens:**
Developers configure OAuth for production only and forget that preview URLs are unique per deployment. Google Cloud Console explicitly rejects wildcards in origins.

**How to avoid:**
Use a dynamic site URL helper for redirect construction:
```typescript
// utils/get-url.ts
export function getURL() {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??         // Production only
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??        // Preview deployments
    'http://localhost:3000/';
  url = url.startsWith('http') ? url : `https://${url}`;
  url = url.endsWith('/') ? url : `${url}/`;
  return url;
}
```

In Supabase dashboard, add `https://*.vercel.app/**` as an allowed redirect URL (Supabase supports wildcards).

In Google Cloud Console, add your production domain and localhost. For previews, you'll need to test auth on a branch with a stable custom domain, or use the Supabase dashboard to manually test the OAuth flow.

Do NOT set `NEXT_PUBLIC_SITE_URL` in Vercel's preview environment settings — let it fall through to `NEXT_PUBLIC_VERCEL_URL`, which Vercel sets automatically per deployment.

**Warning signs:**
- Auth works in production and localhost but not on preview URLs
- Google returns "redirect_uri_mismatch" error
- Supabase returns "Redirect URL not allowed"

**Phase to address:** Auth foundation phase (environment setup).

---

## Moderate Pitfalls

---

### Pitfall 9: Transitioning from Open Access to Optional Auth — Existing RLS-Free Tables Break

**What goes wrong:**
FinFeed's current `videos` and `editions` tables were created without RLS enabled (open access was intentional for v1). When auth is added and `@supabase/ssr` middleware is wired up, the middleware calls `supabase.auth.getUser()` which sets the auth context on the request. This does not break existing open-access tables — as long as RLS remains disabled on them. The risk is accidentally enabling RLS on these tables without policies, which instantly breaks the entire feed for all users.

**Why it happens:**
The Supabase dashboard has a one-click "Enable RLS" button on each table. Developers enabling RLS for social tables may reflexively enable it on all tables, or a migration script may target all tables.

**How to avoid:**
- Keep RLS **disabled** on `videos`, `editions`, and any other read-only public tables — they serve anonymous users and enabling RLS without policies returns empty results
- Only enable RLS on the new social tables: `likes`, `comments`, `bookmarks`, `profiles`
- If you want to enable RLS on `videos`/`editions` for future rate-limiting or access control, add a public read policy at the same time:
  ```sql
  ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "videos_public_read" ON public.videos FOR SELECT USING (true);
  ```
- Add a migration test that verifies the feed returns > 0 rows after every schema change

**Warning signs:**
- The feed shows 0 videos after a schema migration
- No error in the console — just an empty state
- Works in the Supabase SQL editor (superuser bypasses RLS) but not in the app

**Phase to address:** Auth foundation phase — the migration checklist must include "do not enable RLS on videos/editions without a public read policy."

---

### Pitfall 10: Anonymous User Caching in Next.js Static Pages

**What goes wrong:**
If any page uses ISR (Incremental Static Regeneration) or is statically generated while Supabase anonymous sessions are active, Next.js can cache the page response with a user-specific `Set-Cookie` header. Users who receive a cached page may get another user's anonymous session token baked into their response, appearing as a different anonymous user or hitting stale social data.

**Why it happens:**
Next.js static generation evaluates pages at build time or on a revalidation timer. If the page calls Supabase during generation and an anonymous session exists in the request, that session leaks into the cached response.

**How to avoid:**
- Mark any page that accesses Supabase Auth or social data as dynamic: `export const dynamic = 'force-dynamic'`
- Supabase's official guidance: "The Supabase team has received reports of user metadata being cached across unique anonymous users as a result of Next.js static page rendering. For the best user experience, utilize dynamic page rendering."
- FinFeed's feed page already needs to be dynamic (daily content changes), so this is likely not a practical risk — but verify after adding auth middleware

**Warning signs:**
- Users see like/bookmark states from another session
- `Set-Cookie` header appears in responses served from Vercel's CDN edge cache

**Phase to address:** Auth foundation phase (review page rendering modes).

---

### Pitfall 11: Comment Threads — N+1 Queries and Missing Pagination

**What goes wrong:**
A naive comments implementation fetches all comments for a video, then for each comment fetches its replies, then for each reply fetches its author profile. This is the classic N+1 query pattern. At 50 comments per video with 3 replies each, this is 1 + 50 + 150 + 200 = 401 queries per page load. Supabase's PostgREST client supports nested selects, but developers often implement the nested fetch in application code instead.

A second issue: no pagination on comments. Loading all 500 comments for a viral video in a single query blocks rendering and saturates the Supabase free tier connection pool.

**Why it happens:**
`supabase.from('comments').select('*')` is simple and works at 10 comments. Developers don't add pagination or joins until performance is visibly broken.

**How to avoid:**
Use PostgREST's embedded resource pattern to fetch comments with authors in a single query:
```typescript
const { data: comments } = await supabase
  .from('comments')
  .select(`
    id,
    content,
    created_at,
    parent_id,
    profiles (
      id,
      username,
      avatar_url
    )
  `)
  .eq('video_id', videoId)
  .is('parent_id', null)          // Top-level only first
  .order('created_at', { ascending: false })
  .range(0, 19);                   // 20 per page
```

Implement cursor-based pagination from day one — offset pagination (`LIMIT 20 OFFSET 100`) degrades with table size; cursor pagination does not.

For nested comments (replies), fetch the first 3 replies per comment only, with a "load more" option. Do not recursively fetch replies at page load time.

**Warning signs:**
- Comment section loads in 3+ seconds
- Network tab shows dozens of sequential requests to `/rest/v1/comments`
- Supabase dashboard shows "Query count" spiking when comment section is opened

**Phase to address:** Comments feature phase. Set pagination limits before shipping.

---

### Pitfall 12: `auth.uid()` in RLS Policies Without Stable Security Definer Function

**What goes wrong:**
PostgreSQL evaluates `auth.uid()` on every row in a table scan when used directly in an RLS policy. On large tables (>10k rows), this adds measurable overhead because the JWT claim extraction runs per-row rather than once per query.

**Why it happens:**
Standard RLS policy documentation uses `auth.uid()` inline, which is correct but not optimally performant. The optimization is a PostgreSQL-specific detail that most documentation omits.

**How to avoid:**
Supabase wraps `auth.uid()` in a `STABLE` function internally for most cases, but verify your policies use the recommended pattern. For policies that call `auth.uid()` multiple times, extract it:
```sql
-- More efficient than calling auth.uid() twice in one policy
CREATE POLICY "likes_own_delete"
  ON public.likes FOR DELETE
  USING (user_id = auth.uid());
-- Only one auth.uid() call per policy clause — acceptable
```

Use Supabase's built-in Performance Advisor (dashboard → Database → Advisors) to detect "multiple permissive policies" and "missing RLS indexes" automatically.

**Warning signs:**
- `EXPLAIN ANALYZE` on social queries shows `InitPlan` for `auth.uid()` called multiple times
- Performance Advisor flags "unindexed foreign keys" on social tables

**Phase to address:** Social data model phase (when writing initial migrations).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Supabase client instance (not per-request on server) | Simpler code | Session leakage between users in SSR context | Never — always create per-request server client |
| Using `getSession()` instead of `getUser()` for server-side auth checks | One fewer network call | Spoofed cookies bypass auth gates on write endpoints | Only for non-sensitive read operations |
| Disabling RLS on social tables "temporarily" during dev | Faster iteration | Forgetting to re-enable before shipping; accidental public data access | Never |
| Storing user.id in comment/like rows without RLS | Simple SQL | Any user can write as any user_id | Never |
| Skipping the Apple secret rotation reminder | Nothing now | Sign in with Apple breaks silently in 6 months | Never |
| No pagination on comments from day one | Simpler frontend | Refactor needed as soon as any video gets >50 comments | Only if comments are hidden behind a "load comments" tap |
| No index on `likes.video_id` | Faster to ship | Table scan on every like count query | Never — add index in the same migration |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth + Next.js App Router | Using `@supabase/auth-helpers-nextjs` (deprecated) | Use `@supabase/ssr` — the helpers package is deprecated as of 2024 |
| Supabase Auth + Next.js middleware | No `matcher` — runs on every static asset | Add matcher to exclude `_next/static`, `_next/image`, images |
| Google OAuth + Vercel | Hardcoding production redirect URL | Use dynamic URL helper; add Supabase wildcard `https://*.vercel.app/**` |
| Apple OAuth (web) | No 6-month rotation process | Calendar reminder + documented runbook |
| iOS PWA + OAuth redirect | Using popup/async `window.open` | Synchronous pre-open window or email OTP instead |
| Supabase Storage + avatars | Uploading through server Route Handler with service role | Upload directly from browser client with user JWT |
| RLS + SQL Editor testing | Testing policies in Dashboard SQL editor (bypasses RLS) | Test through client SDK with real user credentials |
| `@supabase/ssr` server client | Creating one client at module level (singleton) | Create fresh client per request using `cookies()` from `next/headers` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No middleware matcher | 9+ Supabase auth calls per page load; Vercel function cost spike | Add matcher excluding static assets | Immediately on any traffic |
| No index on `likes.video_id` | Like counts slow to load | `CREATE INDEX idx_likes_video_id ON likes(video_id)` | ~10k rows |
| N+1 comment + author queries | Comment section loads in 3-5s | PostgREST embedded select with `profiles(...)` | ~50 comments per video |
| Unbounded comment query | Loading all 500+ comments at once | `LIMIT 20` + cursor pagination | ~100 comments per video |
| `getUser()` in middleware without caching | Every navigation triggers Supabase Auth server call | JWT local validation in middleware, `getUser()` only in data handlers | High traffic / slow networks |
| ISR-cached pages with auth context | Users share session tokens | `export const dynamic = 'force-dynamic'` on authed pages | First user to trigger ISR revalidation |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `getSession()` for write endpoint auth | Spoofed cookie allows writing likes/comments as any user | Use `getUser()` or `getClaims()` on all write endpoints |
| RLS policy allows any authenticated user to insert with arbitrary `user_id` | User A can like videos "as" User B | `WITH CHECK (auth.uid() = user_id)` on every INSERT policy |
| Avatar storage path not user-scoped | Users overwrite each other's avatars | `storage.foldername(name)[1] = auth.uid()::text` in storage policy |
| No RLS on `bookmarks` table | Any user can see any user's bookmarks | RLS with `USING (auth.uid() = user_id)` on SELECT |
| Middleware as sole auth gate | CVE-2025-29927 allows bypass via header spoofing | Verify auth at data access layer; upgrade to Next.js >=15.2.3 |
| NEXT_PUBLIC_ prefix on secret keys | Supabase service role key exposed in client bundle | Service role key must NOT use NEXT_PUBLIC_ prefix; server-only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Interrupting feed playback with auth modal | User loses current video scroll position and playback state | Use a non-blocking bottom sheet for auth prompt; preserve video state behind the modal |
| Forcing login before showing like counts | Feed feels broken/empty to guests | Show aggregate counts to all users; gate the "like" tap action only |
| Redirecting to login page instead of soft gate | High drop-off on first social action | Use an inline modal/sheet prompt, not a full-page redirect |
| iOS Safari PWA OAuth requiring full Safari context switch | Users think app is broken; many abandon after the Safari detour | Offer email OTP as primary auth; make OAuth secondary with clear UX warning |
| No feedback after auth on social action intent | User logs in but the like they intended to make is lost | Store intent pre-auth; complete the action immediately after auth callback |
| Username required at signup interrupts the flow | Signup friction; users abandon | Defer username/profile setup; use email prefix as default display name |

---

## "Looks Done But Isn't" Checklist

- [ ] **Middleware matcher:** Verify `_next/static` and image paths are excluded — run a page load and count Supabase auth calls in the network tab (should be 1, not 9+)
- [ ] **iOS PWA auth:** Test the full OAuth flow by adding the app to iPhone home screen and attempting Google sign-in — desktop testing is not sufficient
- [ ] **RLS silent deny:** After enabling RLS on any table, verify data is still accessible through the client SDK with a real user token — not through the SQL editor
- [ ] **Apple secret expiry:** Confirm a calendar reminder exists for 5.5 months from Apple credential setup date
- [ ] **Like count visibility:** Confirm like counts are visible to logged-out guests (public read policy exists on `likes`)
- [ ] **Write endpoint auth:** Every `POST`/`DELETE` Route Handler that modifies social data calls `getUser()` — not `getSession()`
- [ ] **Avatar path isolation:** Test that User A cannot overwrite User B's avatar by uploading to `avatars/{user_b_id}/avatar.jpg` — should return 403
- [ ] **Video feed still works after auth migration:** After adding `@supabase/ssr` middleware, the feed must load without a session (guests must see videos)
- [ ] **Preview deploy OAuth:** Confirm Supabase redirect allow-list includes `https://*.vercel.app/**` before any auth PR merges

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS enabled without policies — feed shows 0 videos | LOW | `ALTER TABLE videos DISABLE ROW LEVEL SECURITY;` or add public read policy immediately |
| Apple OAuth stops working (expired secret) | LOW | Regenerate secret from `.p8` file, update Supabase dashboard — 15-minute fix if `.p8` is on hand |
| Social tables missing indexes — slow queries | LOW | `CREATE INDEX CONCURRENTLY` — runs without locking table; takes minutes on small tables |
| iOS PWA auth broken — OAuth flow wrong from start | HIGH | Must rearchitect to email OTP or server-side PKCE; may require changing how auth modal works |
| `getSession()` used throughout — security hole | MEDIUM | Grep for `getSession` in server files; replace with `getUser()` in write endpoints — mechanical but requires testing |
| No pagination on comments — viral video breaks | MEDIUM | Add `LIMIT`/cursor to query + "load more" UI — requires DB index + frontend change |
| Service role key exposed in client bundle | HIGH | Rotate key immediately in Supabase dashboard; audit git history; add secret scanning CI check |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| iOS PWA OAuth redirect breaks standalone context (P1) | Auth foundation — before any OAuth button ships | Test on real iPhone with PWA installed; email OTP as fallback |
| Middleware on every request + CVE-2025-29927 (P2) | Auth foundation — middleware setup | Count network tab auth calls per page load; confirm Next.js version |
| `getSession()` used in server write paths (P3) | Auth foundation + every social feature phase | Grep codebase for `getSession` in server files before each phase ships |
| RLS enabled without policies (P4) | Social data model phase — every table creation | Test each table through SDK with real user after migration runs |
| RLS missing indexes — scale queries (P5) | Social data model phase — schema migration | `EXPLAIN ANALYZE` on like count + comment list queries |
| Avatar storage path not user-scoped (P6) | User profile phase | Attempt cross-user overwrite test in CI |
| Apple secret expiry (P7) | Apple OAuth setup phase | Calendar reminder + runbook entry |
| Vercel preview URLs break OAuth (P8) | Auth foundation — environment config | Test auth flow on first preview deployment |
| Accidentally enabling RLS on public tables (P9) | Auth foundation — migration checklist | Feed smoke test after every schema migration |
| Anonymous user caching in static pages (P10) | Auth foundation — page rendering audit | Check `dynamic` export on all pages that access auth context |
| Comment N+1 + no pagination (P11) | Comments feature phase | Load test with 50+ seeded comments; check network tab for sequential requests |
| Missing `auth.uid()` index optimization (P12) | Social data model phase | Supabase Performance Advisor after creating social tables |

---

## Sources

- Supabase SSR + Next.js App Router official guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase anonymous sign-ins (soft gate pattern): https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Apple Sign In with Supabase (6-month rotation): https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase RLS official docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- CVE-2025-29927 Next.js middleware bypass: https://www.offsec.com/blog/cve-2025-29927/ (CVSS 9.1, March 2025)
- iOS PWA OAuth/session isolation: https://github.com/pocketbase/pocketbase/discussions/2429
- iOS PWA Supabase auth (Add to Home Screen): https://github.com/orgs/supabase/discussions/12227
- Supabase middleware performance (getUser lag): https://github.com/orgs/supabase/discussions/20905
- Google OAuth + Vercel preview URLs: https://community.vercel.com/t/google-oauth-redirect-url-with-vercel-preview-urls-supabase/6345
- Supabase gotrue-js OAuth Safari issue: https://github.com/supabase/gotrue-js/issues/292
- PWA iOS limitations guide: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide

---
*Pitfalls research for: Adding Supabase Auth + Social features to FinFeed (brownfield Next.js 16 App Router + Supabase PWA)*
*Researched: 2026-03-23*
