# Phase 7: Auth Infrastructure - Research

**Researched:** 2026-03-23
**Domain:** Supabase Auth + @supabase/ssr + Next.js 16 App Router
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign up with email and password | Supabase `signUp()` via Server Action + auth/confirm route for email verification |
| AUTH-02 | User can sign in with existing email/password account | Supabase `signInWithPassword()` via Server Action; session stored in HttpOnly cookies via @supabase/ssr middleware |
| AUTH-03 | User can reset password via email link | `resetPasswordForEmail()` → email → `/auth/confirm?token_hash=&type=recovery` route → `verifyOtp()` → `updateUser()` |
| AUTH-04 | User can sign in with Google OAuth | `signInWithOAuth({ provider: 'google', redirectTo })` using `window.location.href` (not popup) for iOS PWA compat |
| AUTH-05 | User session persists across browser refresh and PWA close/reopen | @supabase/ssr stores tokens in HttpOnly cookies (not localStorage); middleware refreshes on every request |
</phase_requirements>

---

## Summary

Phase 7 adds Supabase Auth end-to-end on a Next.js 16 App Router project that currently has no authentication. The core infrastructure work is installing `@supabase/ssr`, setting up the middleware token-refresh loop, creating server/browser client factory utilities, adding the `profiles` table with an auto-create trigger, wiring up the auth callback route, and configuring custom SMTP (Resend) to bypass Supabase's 2-email/hour free-tier limit.

The project already uses `@supabase/supabase-js` with a plain anon singleton (`lib/supabase.ts`). That singleton MUST be preserved unchanged — `api/today` depends on it for unauthenticated reads. The new `@supabase/ssr` clients (server factory + browser factory) are additive and live in a new `lib/supabase/` folder alongside the existing `lib/supabase.ts`.

The most important risk in this phase is iOS PWA OAuth. Apple's Safari in standalone mode does not support OAuth popup windows and can break redirect-based flows. The confirmed workaround is `window.location.href = url` (never `window.open()`). This is explicitly called out as a Phase 8 test gate — Phase 7 must build the plumbing correctly so Phase 8 can validate it on a real device.

**Primary recommendation:** Install `@supabase/ssr ^0.9.0`, wire middleware with the static-asset matcher (CVE-2025-29927 mitigation), add `profiles` table + trigger as a migration, configure custom SMTP via Resend before any email-based flows are tested in production.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | ^0.9.0 | Cookie-based session management for SSR/App Router | Official Supabase package replacing deprecated `@supabase/auth-helpers-nextjs`; provides `createServerClient` + `createBrowserClient` |
| `@supabase/supabase-js` | ^2.97.0 (already installed) | Auth operations + DB queries | Already in project; works alongside `@supabase/ssr` |
| Next.js middleware | built-in | Token refresh on every request + static-asset bypass | Required for cookie-based session refresh loop |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Resend (SMTP) | Dashboard config only | Transactional email for signup/reset | Required before production — Supabase free tier caps at 2 auth emails/hour |
| Google Cloud OAuth client | Dashboard config only | Google Sign-In credentials | Required for AUTH-04 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` cookies | localStorage tokens | localStorage breaks SSR, doesn't survive service worker context in PWA; NOT suitable |
| Supabase built-in SMTP | Custom SMTP (Resend) | Built-in = 2 emails/hour hard limit; Resend free tier = 3,000/month; always use custom SMTP for production |
| `signInWithOAuth` popup | `window.location.href` redirect | Popup never works in iOS PWA standalone mode; always use redirect |

**Installation:**
```bash
npm install @supabase/ssr
```

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── lib/
│   ├── supabase.ts           # EXISTING — preserve unchanged (anon singleton for /api/today)
│   └── supabase/
│       ├── server.ts         # NEW — createClient() factory for Server Components / Route Handlers / Actions
│       ├── client.ts         # NEW — createClient() factory for Client Components (browser)
│       └── middleware.ts     # NEW — updateSession() helper called by root middleware.ts
├── middleware.ts             # NEW — root Next.js middleware (token refresh + static asset bypass)
└── app/
    └── auth/
        ├── callback/
        │   └── route.ts      # NEW — OAuth code exchange (Google redirect lands here)
        └── confirm/
            └── route.ts      # NEW — email link handler (signup confirm + password reset)
```

**Critical:** `lib/supabase.ts` (the existing anon singleton) is UNTOUCHED. New SSR factories live in `lib/supabase/` subfolder.

### Pattern 1: Middleware Token Refresh Loop

**What:** Every non-static request passes through middleware. Middleware creates a `createServerClient` with cookie read/write adapters, calls `supabase.auth.getUser()` to trigger token refresh, returns response with updated cookies.
**When to use:** Always — this is the foundational pattern that makes cookies work in App Router.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs (adapted)
// frontend/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — DO NOT remove this line
  await supabase.auth.getUser()

  return supabaseResponse
}
```

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// frontend/middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // CVE-2025-29927 mitigation: exclude static assets so middleware cannot be
    // bypassed on asset requests, and avoid 9+ Supabase calls per page load
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 2: Server Client Factory

**What:** Per-request server client that reads/writes cookies. Used in Server Components, Route Handlers, Server Actions.
**When to use:** Any server-side code that needs auth context.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// frontend/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — writes ignored, middleware handles persistence
          }
        },
      },
    }
  )
}
```

### Pattern 3: Browser Client Factory (singleton)

**What:** `createBrowserClient` is a singleton — calling it multiple times returns the same instance. Used in Client Components.
**When to use:** Any `'use client'` component that needs auth operations.

```typescript
// Source: Supabase official docs — createBrowserClient
// frontend/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 4: Auth Callback Route (OAuth + Email Confirm)

**What:** Two route handlers handle the post-auth redirect from Supabase. `/auth/callback` exchanges the OAuth code for a session. `/auth/confirm` verifies email OTP tokens (signup email + password reset).

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// frontend/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-error`)
}
```

```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
// frontend/app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/auth/auth-error', request.url))
}
```

### Pattern 5: Profiles Table + Auto-Create Trigger

**What:** `public.profiles` mirrors `auth.users` with `id` as FK. A PostgreSQL trigger fires AFTER INSERT on `auth.users` and inserts the profile row automatically — no application code required.

```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data
-- frontend/supabase/migrations/YYYYMMDD_add_profiles_and_auth.sql

-- Profiles table
CREATE TABLE public.profiles (
  id           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read all profiles (for comment display), update only their own
CREATE POLICY "profiles are viewable by everyone"
  ON public.profiles FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create trigger: fires on every new auth.users row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Critical caveat:** If the trigger function throws an error, the signup itself fails. Test the migration on a staging project before production.

### Pattern 6: Google OAuth Sign-In (iOS PWA safe)

**What:** `signInWithOAuth` must use `window.location.href` redirect — never `window.open()` (popup). iOS PWA standalone mode does not support popups.
**When to use:** The sign-in button for Google OAuth in any Client Component.

```typescript
// Source: https://supabase.com/docs/guides/auth/social-login/auth-google
// Verified against iOS PWA discussion: https://github.com/orgs/supabase/discussions/12227
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})
// data.url is the Google OAuth URL — redirect to it directly
if (data.url) {
  window.location.href = data.url  // NOT window.open()
}
```

### Anti-Patterns to Avoid

- **Using `getSession()` for auth checks on the server:** `getSession()` reads the cookie unverified. Always use `getUser()` — it validates the JWT against the Supabase server. (Official docs: "never trust `supabase.auth.getSession()` inside Server Components")
- **Using `window.open()` for OAuth:** Broken in iOS PWA standalone mode. Use `window.location.href`.
- **Using singular `get()`/`set()` cookie methods:** Deprecated API. Always use `getAll()` / `setAll()`.
- **Modifying `lib/supabase.ts`:** The existing anon singleton must remain unchanged. `/api/today` is correct and must not be affected.
- **No static-asset matcher on middleware:** Without it, middleware fires on every `_next/static` request, causing 9+ Supabase network calls per page load AND leaving the app vulnerable to CVE-2025-29927 header spoofing.
- **Shipping without custom SMTP:** Supabase free tier = 2 auth emails/hour. Any real user will hit this immediately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh on expiry | Custom refresh interceptor | `@supabase/ssr` middleware loop | Handles race conditions, cookie SameSite/Secure flags, clock skew |
| Session persistence across SSR/CSR | Manual cookie read/write | `createServerClient` / `createBrowserClient` | Handles HttpOnly cookie sync between middleware, Server Components, and Client Components |
| OAuth PKCE code exchange | Manual `fetch` to token endpoint | `/auth/callback` route with `exchangeCodeForSession()` | Supabase SDK handles state verification, CSRF protection |
| Email OTP verification | Manual token decode | `/auth/confirm` route with `verifyOtp()` | Handles expiry, type checking, token_hash format |
| Profile row on signup | Application-level insert in callback | PostgreSQL trigger `on_auth_user_created` | Atomic with signup; no race condition; survives OAuth paths where callback code may not run |

**Key insight:** Supabase Auth has already solved every part of the token/session lifecycle. The job is wiring the plumbing correctly, not building new components.

---

## Common Pitfalls

### Pitfall 1: Middleware Without Static-Asset Matcher

**What goes wrong:** Middleware fires on every `_next/static/*`, `_next/image/*`, and asset request — 9+ Supabase auth network calls per page load. Also: CVE-2025-29927 allows bypassing middleware by spoofing the `x-middleware-subrequest` header.
**Why it happens:** Forgetting the `matcher` config or writing an incomplete regex.
**How to avoid:** Always include the matcher:
```
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```
**Warning signs:** Slow page loads; Supabase dashboard shows excessive auth API calls.

### Pitfall 2: iOS PWA OAuth Popup Failure

**What goes wrong:** Google OAuth popup opens in a new window and never returns the session to the PWA. User is stuck on the sign-in page.
**Why it happens:** iOS Safari in standalone PWA mode prohibits popups from async functions.
**How to avoid:** Use `window.location.href = data.url` after getting the OAuth redirect URL. Never `window.open()`.
**Warning signs:** OAuth works in mobile Safari but fails in the home-screen app.

### Pitfall 3: Trigger Bug Blocks All Signups

**What goes wrong:** A SQL error in `handle_new_user()` causes ALL new user signups to fail with a 500-level error.
**Why it happens:** The trigger runs inside the signup transaction; any throw rolls back the user creation.
**How to avoid:** Test migration on Supabase staging project first. Keep trigger simple — only insert `id`, `display_name`, `avatar_url`. Use `ON CONFLICT DO NOTHING` as a safety valve.
**Warning signs:** `signUp()` returns an error; new rows never appear in `auth.users`.

### Pitfall 4: `getSession()` Used Instead of `getUser()` for Protected Routes

**What goes wrong:** Route appears protected but session can be spoofed via cookie manipulation.
**Why it happens:** `getSession()` reads cookies without server-side JWT validation.
**How to avoid:** Use `supabase.auth.getUser()` in any server-side auth check. Reserve `getSession()` for client-side "is user logged in?" UI hints only.
**Warning signs:** Hard to detect without security testing.

### Pitfall 5: Email Rate Limit Hit in Testing

**What goes wrong:** Signup/reset tests fail after 2 emails with a rate-limit error from Supabase.
**Why it happens:** Supabase free tier SMTP = 2 emails/hour.
**How to avoid:** Configure custom SMTP via Resend BEFORE testing email flows in production. Resend free tier = 3,000 emails/month.
**Warning signs:** Auth email errors that only appear after the first 2 emails in an hour.

### Pitfall 6: Cookie Not Set Because `setAll` Throws in Server Component

**What goes wrong:** Session appears missing on next request even after successful sign-in.
**Why it happens:** Server Components cannot write cookies — `cookieStore.set()` throws. The try/catch in the server factory swallows this intentionally; middleware is supposed to do the write. If middleware is absent or misconfigured, writes are silently lost.
**How to avoid:** Verify middleware is active (check Next.js dev logs for middleware hit). The try/catch in `server.ts` is correct — don't remove it.
**Warning signs:** User signs in successfully but session is gone on next page load.

---

## Code Examples

### Sign-Up with Email/Password (Server Action)

```typescript
// Source: Supabase official docs — signUp
// frontend/app/auth/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  })
  if (error) throw new Error(error.message)
  redirect('/')
}
```

### Sign-In with Email/Password (Server Action)

```typescript
// Source: Supabase official docs — signInWithPassword
export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) throw new Error(error.message)
  redirect('/')
}
```

### Password Reset Request (Server Action)

```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get('email') as string,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/auth/update-password`,
    }
  )
  if (error) throw new Error(error.message)
  // Show "check your email" message
}
```

### Update Password After Reset

```typescript
// Source: https://supabase.com/docs/guides/auth/passwords
export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: formData.get('password') as string,
  })
  if (error) throw new Error(error.message)
  redirect('/')
}
```

### Get Current User (Server Component)

```typescript
// Source: Supabase official docs — getUser
// Always use getUser(), never getSession() on the server
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

### Sign Out

```typescript
// Source: Supabase official docs — signOut
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023–2024 | auth-helpers is deprecated; use @supabase/ssr for all new projects |
| `get()`/`set()` cookie methods | `getAll()`/`setAll()` | @supabase/ssr 0.2+ | Singular methods removed; using them silently breaks session sync |
| `getSession()` for server auth | `getUser()` for server auth | Security advisory 2024 | `getSession()` does not validate JWT; never use for protection |
| `window.open()` for OAuth | `window.location.href` redirect | iOS PWA limitation (ongoing) | Popups never work in iOS standalone PWA mode |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not install.
- Singular `cookies.get()` / `cookies.set()` in `createServerClient` options: Removed in recent versions.

---

## Open Questions

1. **Next.js 16 specific `cookies()` async behavior**
   - What we know: Next.js 15+ made `cookies()` async (returns a Promise); Next.js 16 continues this. The server factory pattern `await cookies()` handles this correctly.
   - What's unclear: Whether Next.js 16.1.6 has any cookie-related breaking changes vs 15.
   - Recommendation: Test server factory locally immediately. If `await cookies()` throws, check if 16.1.6 changed the API — fall back to synchronous `cookies()` with a cast.

2. **Supabase free tier email exact rate limit**
   - What we know: Multiple sources cite "2 emails/hour" for default SMTP; one source says "3 OTP emails/hour" (the STATE.md note). Actual limit may vary.
   - What's unclear: Exact current cap for the Supabase free tier default SMTP.
   - Recommendation: Treat any free-tier email as unreliable for production. Configure Resend custom SMTP as part of Phase 7 — do not skip this step.

3. **Google OAuth callback URL for Vercel preview deployments**
   - What we know: Supabase redirect URLs support wildcard patterns like `https://*-autonews-ai.vercel.app/**`.
   - What's unclear: Whether Vercel preview deployment URLs match that pattern for the current project.
   - Recommendation: Add wildcard pattern to Supabase allowed redirect URLs during setup. Test on a preview deploy before marking Phase 7 done.

---

## Supabase Dashboard Configuration Checklist

These are manual steps that cannot be done via code — the planner must include them as explicit tasks:

1. **Enable Google provider** — Authentication → Providers → Google → enter Client ID + Secret
2. **Add authorized redirect URLs** — Authentication → URL Configuration:
   - `http://localhost:3000/**`
   - `https://autonews-ai.vercel.app/**`
   - `https://*-autonews-ai.vercel.app/**` (Vercel preview deploys)
3. **Configure custom SMTP (Resend)** — Authentication → SMTP Settings
   - Host: `smtp.resend.com`, Port: `587`, Username: `resend`, Password: Resend API key
   - Sender: `noreply@[your-verified-domain]`
4. **Google Cloud Console** — Create OAuth 2.0 client ID:
   - Authorized JavaScript origins: `https://autonews-ai.vercel.app`, `http://localhost:3000`
   - Authorized redirect URIs: `https://[project-id].supabase.co/auth/v1/callback`

---

## Sources

### Primary (HIGH confidence)
- https://supabase.com/docs/guides/auth/server-side/nextjs — Main SSR setup guide for Next.js
- https://supabase.com/docs/guides/auth/managing-user-data — Profiles table + trigger SQL (verbatim)
- https://supabase.com/docs/guides/auth/passwords — Password reset PKCE flow + `/auth/confirm` route (verbatim code)
- https://supabase.com/docs/guides/auth/social-login/auth-google — Google OAuth configuration
- https://supabase.com/docs/guides/auth/server-side/creating-a-client — `createServerClient` / `createBrowserClient` API

### Secondary (MEDIUM confidence)
- https://github.com/orgs/supabase/discussions/12227 — iOS PWA OAuth limitation (window.location.href workaround); multiple community confirmations
- https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass — CVE-2025-29927 details; confirmed by NVD
- https://nvd.nist.gov/vuln/detail/CVE-2025-29927 — CVE official record
- WebSearch synthesis for `createServerClient` middleware pattern with `getAll`/`setAll` — multiple sources consistent

### Tertiary (LOW confidence)
- "2 emails/hour" Supabase free tier limit — cited in multiple community posts but not in current official rate-limits docs verbatim; treat as directionally correct

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/ssr` is the official replacement for auth-helpers; version 0.9.0 from npm search
- Architecture: HIGH — middleware, server factory, browser factory, callback routes are canonical patterns from official Supabase docs
- Pitfalls: HIGH — CVE-2025-29927 is documented; iOS PWA OAuth limitation confirmed in multiple community reports; trigger-blocks-signup confirmed in official docs
- Profiles trigger: HIGH — SQL is verbatim from official managing-user-data guide

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (30 days — @supabase/ssr is still pre-1.0 and actively evolving; re-check if breaking changes land)
