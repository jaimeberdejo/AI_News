# Technology Stack — Auth + Social Features (v1.2 Additions)

**Project:** FinFeed — Auth + Social Layer
**Researched:** 2026-03-23
**Confidence:** HIGH (Supabase Auth patterns), MEDIUM (Apple OAuth specifics)
**Scope:** What to ADD to the existing Next.js 16 / Supabase / Vercel stack for authentication and social features (likes, comments, bookmarks, profiles). The existing pipeline stack (Groq, TTS, FFmpeg, etc.) is not changed.

---

## Existing Stack (Unchanged)

The following is already shipped and requires no modification:

| Layer | Current | Notes |
|-------|---------|-------|
| Frontend framework | Next.js 16.1.6, React 19.2.3 | App Router, Tailwind 4, TypeScript |
| Supabase client | `@supabase/supabase-js` ^2.97.0 | Anon key, no auth sessions today |
| Database | Supabase Postgres | `editions`, `videos`, `pipeline_runs` tables; RLS enabled |
| Storage | Supabase Storage | `videos` bucket, public, 7-day retention |
| Deployment | Vercel (Hobby) | Zero-config Next.js deploy |
| CI/Pipeline | GitHub Actions | Python, FFmpeg, Groq, OpenAI TTS |

**The current `lib/supabase.ts` uses `createClient` from `@supabase/supabase-js` directly — no session management. This must be replaced with `@supabase/ssr` patterns when auth is added.**

---

## New Stack Additions

### 1. Supabase Auth (Server-Side Sessions)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/ssr` | `^0.9.0` | Cookie-based auth sessions in Next.js App Router | Required to use Supabase Auth with Server Components and middleware. The older `@supabase/auth-helpers-nextjs` is deprecated — `@supabase/ssr` is the current replacement. `createBrowserClient` for Client Components; `createServerClient` for Server Components, Server Actions, Route Handlers, and middleware. |

**Why `@supabase/ssr` and not the base `supabase-js` client alone:**
- Next.js Server Components cannot write cookies. `@supabase/ssr` provides a proxy pattern via `middleware.ts` that refreshes expired Auth tokens and writes the session cookie on every request.
- Without it, users get logged out on page refresh because the session token isn't persisted server-side.
- `@supabase/supabase-js` (already installed at ^2.97.0) remains — `@supabase/ssr` wraps it.

**Auth methods to enable (Supabase Dashboard configuration, no extra packages):**
- Google OAuth — configure in Supabase Dashboard → Authentication → Providers → Google; add credentials from Google Cloud Console (OAuth 2.0 Client ID, Web application type)
- Apple OAuth — configure in Supabase Dashboard → Authentication → Providers → Apple; requires Apple Developer account: App ID, Services ID (as client_id), .p8 signing key. **Rotate the .p8 secret key every 6 months — Apple requires this for the OAuth flow.**
- Email/password — enabled by default in Supabase Auth; no extra config

**New files required in the Next.js app:**
- `middleware.ts` (project root, next to `package.json`) — refreshes Auth tokens on every request
- `lib/supabase/server.ts` — `createServerClient` factory (for Server Components, Actions, Route Handlers)
- `lib/supabase/client.ts` — `createBrowserClient` factory (for Client Components)
- `app/auth/callback/route.ts` — Route Handler that exchanges the OAuth code for a session: `supabase.auth.exchangeCodeForSession(code)`
- `app/(auth)/login/page.tsx` — Login UI (Google button, Apple button, email/password form)
- `app/(auth)/signup/page.tsx` — Signup UI (email/password + OAuth)

**Security rule: always use `supabase.auth.getUser()` (not `getSession()`) in server code.** `getUser()` validates the JWT against Supabase Auth server on every call. `getSession()` trusts the cookie without revalidation — it can be spoofed.

---

### 2. Form Validation for Auth Forms

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | `^7.54.0` | Client-side form state management for login/signup forms | Email/password forms with instant field validation feedback |
| `zod` | `^3.24.0` | Schema validation shared between client and server | Define email format, password requirements once; use on both client (zodResolver) and server (Server Action validation) |
| `@hookform/resolvers` | `^4.1.0` | Bridge between react-hook-form and zod | Required to use `zodResolver` with react-hook-form |

**Rationale:** For OAuth-only flows (Google + Apple), these are unnecessary — users click a button, no form. But email/password signup/login requires form state, error display, and server-side validation. `react-hook-form` + `zod` is the 2025/2026 standard pattern for Next.js App Router forms with Server Actions. `zod` v3 is stable and widely used; v4 beta exists but do not use for production.

**If you ship OAuth-only (Google + Apple, no email/password) in the first iteration:** skip these three libraries entirely. Add them only when email/password is needed.

---

### 3. User Profiles + Avatar Upload

No new packages required. The existing `@supabase/supabase-js` client handles:
- `supabase.storage.from('avatars').upload(...)` — avatar upload to a new `avatars` Storage bucket
- `supabase.from('profiles').upsert(...)` — profile data writes

**New DB migration required:**
```sql
-- profiles: one row per auth.users entry
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username    text UNIQUE,
  display_name text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "profiles are public"
  ON profiles FOR SELECT TO anon, authenticated
  USING (true);

-- Only the user can write their own profile
CREATE POLICY "users manage own profile"
  ON profiles FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**New Supabase Storage bucket required:**
- Bucket name: `avatars`
- Visibility: public (avatars are displayable in comments/likes without auth)
- Max file size: 2MB recommended (enforce at upload in the UI)
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- Path pattern: `{user_id}/avatar.{ext}` — deterministic path enables upsert-style updates (overwrite the same file)

**No image processing library needed:** Supabase Storage supports image transformation via the `/render/image/` endpoint (free tier: up to 50 MB/month transforms). Use `?width=200&height=200` query params when displaying avatars — this avoids shipping `sharp` or similar to the frontend.

---

### 4. Social Tables (Likes, Comments, Bookmarks)

No new packages required. Pure Supabase Postgres + RLS.

**New DB migrations required:**

```sql
-- likes: one per user per video (unique constraint prevents duplicate likes)
CREATE TABLE likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes are public"     ON likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users insert own likes" ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own likes" ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comments: text per user per video, soft-delete not needed at MVP
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments are public"       ON comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users insert own comments" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own comments" ON comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own comments" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- bookmarks: one per user per video
CREATE TABLE bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own bookmarks"   ON bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own bookmarks" ON bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own bookmarks" ON bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

**Index additions for performance:**

```sql
CREATE INDEX idx_likes_video     ON likes(video_id);
CREATE INDEX idx_likes_user      ON likes(user_id);
CREATE INDEX idx_comments_video  ON comments(video_id, created_at DESC);
CREATE INDEX idx_bookmarks_user  ON bookmarks(user_id, created_at DESC);
```

**Like counts:** Use a Postgres view or a stored aggregate. For MVP, a simple `SELECT COUNT(*) FROM likes WHERE video_id = $1` per video is acceptable at low volume. If counts become slow, add a `like_count` denormalized column to `videos` updated via a trigger.

---

### 5. Realtime (Optional — Defer to Later)

Supabase Realtime is included in the existing `@supabase/supabase-js` client — no new packages needed to enable it. However, **do not add realtime like counts in the first iteration.** Reasons:

- Free tier: 200 concurrent connections, 2M messages/month. For a PWA where each video view opens a realtime subscription, 200 concurrent users simultaneously viewing would hit the connection limit.
- Complexity cost: realtime subscriptions must be cleaned up on component unmount; incorrect cleanup causes connection leaks.
- For MVP: fetch like/comment counts on page load, update optimistically on the client after the user interacts. No realtime needed until social density justifies it (likely never needed at this scale).

---

## Installation (New Packages Only)

```bash
# Required: Supabase SSR client for auth session management
npm install @supabase/ssr

# Required only if shipping email/password auth forms:
npm install react-hook-form zod @hookform/resolvers
```

**Total addition: 1 package required, 3 optional (form validation).**

The existing `@supabase/supabase-js` ^2.97.0 is already installed and requires no version bump — `@supabase/ssr` 0.9.0 is compatible with `@supabase/supabase-js` v2.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth session management | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Deprecated — no new bug fixes or features |
| Auth session management | `@supabase/ssr` | NextAuth.js / Auth.js | Adds a second auth system when Supabase Auth is already in the stack; doubles the auth surface area; no advantage |
| Auth session management | `@supabase/ssr` | Clerk | Paid at scale, replaces Supabase Auth entirely, unnecessary migration |
| Form validation | react-hook-form + zod | Formik | react-hook-form is the current standard; Formik is older, more re-renders |
| Avatar image processing | Supabase Storage transforms | `sharp` in Next.js | Supabase handles transforms at the CDN level; no server-side image processing needed |
| Like counts | DB query on load | Supabase Realtime | Too many concurrent connections on free tier; optimistic UI is sufficient at MVP scale |
| Profile storage | Supabase `profiles` table | Custom users API | Unnecessary — Supabase `auth.users` + `profiles` join is the documented pattern |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated package, no new features or bug fixes. Old docs reference it heavily — ignore those | `@supabase/ssr` |
| NextAuth.js / Auth.js | Supabase Auth is already the auth provider. Adding NextAuth creates two competing session systems with no benefit | Supabase Auth + `@supabase/ssr` |
| Separate profile microservice | The existing Supabase Postgres is sufficient; a separate service adds ops burden | `profiles` table in Supabase |
| `multer` or `formidable` for avatar uploads | Next.js 16 App Router handles file uploads natively via FormData + Route Handlers or Server Actions; no upload middleware needed | Native `FormData` + `supabase.storage.from('avatars').upload()` |
| Redis / external session store | Supabase Auth manages sessions via signed JWTs in cookies; no external store needed | Cookie-based sessions via `@supabase/ssr` |
| `uuid` package for generating IDs | Supabase Postgres uses `gen_random_uuid()` natively in the DB; frontend never needs to generate UUIDs | `DEFAULT gen_random_uuid()` in schema |
| shadcn/ui or Radix UI | The existing app uses Tailwind CSS directly; adding a component library is a scope expansion, not a requirement for auth + social | Tailwind CSS (already installed) |

---

## Stack Patterns by Scenario

**If shipping Google OAuth only (no email/password) in first iteration:**
- Add: `@supabase/ssr` only
- Skip: `react-hook-form`, `zod`, `@hookform/resolvers`
- Auth flow: button click → `supabase.auth.signInWithOAuth({ provider: 'google' })` → Supabase redirect → `app/auth/callback/route.ts` exchanges code for session → redirect to `/`

**If shipping email/password as well:**
- Add all packages in the Installation section above
- Server Actions handle form submission — never send passwords to a client-side handler
- Use `zod` to validate email format + password strength in the Server Action before calling `supabase.auth.signUp()`

**If PWA is installed to iOS home screen (standalone mode):**
- Known issue: OAuth redirects in iOS Safari standalone mode can lose the callback. Mitigation: configure `redirectTo` in `signInWithOAuth()` to use the exact production URL (not localhost). Set this URL explicitly in `NEXT_PUBLIC_SITE_URL` env var; do not rely on `window.location.origin` which behaves differently in standalone mode.
- Use email OTP (6-digit code, not magic link) as fallback auth method for users who experience redirect failures. Magic link emails open in the system browser (Safari), not the standalone PWA, breaking the session handoff. OTP codes work because the user manually copies the code into the PWA.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@supabase/ssr` ^0.9.0 | `@supabase/supabase-js` ^2.x | SSR package wraps supabase-js; existing ^2.97.0 install is compatible |
| `@supabase/ssr` ^0.9.0 | Next.js 13+ App Router | Designed specifically for Next.js App Router middleware + Server Components |
| `react-hook-form` ^7.54.0 | React 19.2.3 | v7.x supports React 19; no breaking changes |
| `zod` ^3.24.0 | TypeScript ^5 | Zod v3 requires TypeScript 4.5+; existing TypeScript ^5 is compatible |
| `@hookform/resolvers` ^4.1.0 | `react-hook-form` ^7.x, `zod` ^3.x | v4.x of resolvers is the current version matching these deps |

---

## Free Tier Impact Assessment

| Resource | Current Usage | Post-Auth Estimate | Risk |
|----------|---------------|--------------------|------|
| Supabase Auth MAUs | 0 | 50,000 MAU limit (free tier) | LOW — FinFeed is early stage; 50K MAUs is generous headroom |
| Supabase DB storage | ~500MB | +minimal (profiles + social tables are rows, not files) | LOW |
| Supabase Storage | 1GB (videos) | +`avatars` bucket (2MB × N users) | LOW at MVP scale |
| Supabase Realtime connections | 0 (not used) | 0 (not adding realtime) | NONE |
| Vercel serverless functions | Low | +auth callback route, +profile API routes | LOW — these are fast, small functions |

Adding auth and social features stays within Supabase free tier at MVP scale. The 50,000 MAU limit on auth is the most generous constraint of all.

---

## Sources

- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` package, middleware pattern, createServerClient/createBrowserClient — HIGH confidence (official docs)
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — Cookie handling patterns — HIGH confidence (official docs)
- [Build a User Management App with Next.js | Supabase Docs](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs) — profiles table schema, avatars storage bucket pattern — HIGH confidence (official docs)
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google) — Google OAuth redirect URL configuration — HIGH confidence (official docs)
- [Login with Apple | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) — Apple OAuth requirements, .p8 key rotation — MEDIUM confidence (official docs, but Apple Developer setup is Apple-controlled and can change)
- [@supabase/ssr npm package](https://www.npmjs.com/package/@supabase/ssr) — Version 0.9.0 confirmed as latest (published within days of 2026-03-23) — HIGH confidence
- [Realtime Pricing | Supabase Docs](https://supabase.com/docs/guides/realtime/pricing) — 200 concurrent connections, 2M messages/month on free tier — HIGH confidence (official docs)
- [Supabase Pricing](https://supabase.com/pricing) — 50,000 MAU auth limit, 1GB storage, 500MB DB on free tier — MEDIUM confidence (pricing pages change; verify before milestone)
- [Passwordless email logins | Supabase Docs](https://supabase.com/docs/guides/auth/auth-email-passwordless) — OTP vs magic link tradeoffs, PWA redirect behavior — HIGH confidence (official docs)

---

*Stack research for: FinFeed Auth + Social Features (v1.2 additions)*
*Researched: 2026-03-23*
*Note: The original STACK.md covered the pipeline stack (LLM, TTS, FFmpeg, GitHub Actions). This document covers only NEW additions for authentication and social features. Both documents apply to the full FinFeed stack.*
