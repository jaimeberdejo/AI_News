# Project Research Summary

**Project:** FinFeed — Auth + Social Features (v1.2 milestone)
**Domain:** Auth + Social layer addition to brownfield mobile-first vertical video feed PWA
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

FinFeed v1.1 ships a complete AI-generated vertical video feed (Next.js 16 App Router, Supabase Postgres + Storage, Vercel) with no user accounts and fully anonymous access. The v1.2 milestone adds authentication and a social layer — likes, comments, bookmarks, and profiles — on top of the existing stack without touching the Python pipeline. The core challenge is adding auth as a soft gate, not a hard wall: guests must continue watching freely, and social actions (like, bookmark, comment) prompt sign-in only when tapped. This "optional auth" pattern is used by TikTok, YouTube, and Pinterest, and is non-negotiable for preserving the product's open-access promise.

The recommended approach is surgical and additive: install `@supabase/ssr` (one new package), wire up a cookie-based session middleware, and add four new Postgres tables (`profiles`, `likes`, `bookmarks`, `comments`) each with Row Level Security. Google OAuth ships first, Apple Sign In ships as a follow-on phase due to its 6-month mandatory key rotation requirement, and email/password is included as a tertiary option. All social mutations route through dedicated Next.js API Route Handlers (`/api/social/like`, `/api/social/bookmark`, `/api/social/comments`) rather than direct Supabase client calls, keeping the Python pipeline completely auth-unaware. The existing `lib/supabase.ts` anon singleton is preserved unchanged for the public feed path.

The critical risks in this milestone are iOS-specific: OAuth redirect flows inside an installed PWA (Add to Home Screen) on iOS Safari break because Apple's standalone context does not share session state with the OAuth provider's browser window. The mitigation is to offer email OTP as an alternative auth path and to use the synchronous `window.open()` technique before any async auth call. A secondary risk is security misconfiguration — using `getSession()` instead of `getUser()` in server code, or enabling RLS without policies — both of which cause silent failures that appear correct during development (Supabase SQL Editor bypasses RLS, masking the issue). Every write endpoint must call `getUser()`, every new table must have its RLS policies written in the same migration that creates it, and middleware must include a proper request matcher to avoid running on static assets.

---

## Key Findings

### Recommended Stack

The existing stack requires only one new npm package: `@supabase/ssr ^0.9.0`. This package provides cookie-based session management for Next.js App Router's Server Components and middleware — without it, sessions do not persist across page reloads. The deprecated `@supabase/auth-helpers-nextjs` must not be used (no new bug fixes or features). If email/password forms are included, three additional form validation packages are needed (`react-hook-form ^7.54.0`, `zod ^3.24.0`, `@hookform/resolvers ^4.1.0`), but these can be skipped if OAuth-only is shipped first.

No image processing library is needed for avatars — Supabase Storage handles image transforms via URL query params (`?width=200&height=200`) at the CDN level. No Redis or external session store is needed. Supabase Realtime is deferred: the free tier allows 200 concurrent connections, and with a finite 5-video feed, stale like counts are acceptable. Optimistic UI updates cover the social feedback loop at MVP scale.

**Core technologies:**
- `@supabase/ssr ^0.9.0`: Cookie-based auth sessions for Next.js App Router — required because `supabase-js` alone cannot persist sessions across Server Components
- `@supabase/supabase-js ^2.97.0` (existing): Remains unchanged; `@supabase/ssr` wraps it
- Google OAuth (Supabase dashboard config): Primary SSO path, no key rotation, ships first
- Apple OAuth (Supabase + Apple Developer): Mandatory per App Store Guideline 4.8 once Google exists; `.p8` key must be rotated every 6 months — calendar reminder required
- Supabase Postgres RLS: Enforces data isolation for all social tables at the DB layer
- `react-hook-form ^7.54.0` + `zod ^3.24.0` + `@hookform/resolvers ^4.1.0` (conditional): Only if email/password forms are included

### Expected Features

The v1.2 feature set is well-scoped and fully achievable within the existing infrastructure budget (Supabase free tier, Vercel Hobby). The dependency order is fixed: auth must exist before any social feature can function. Profile page is last because it depends on likes and bookmarks being built first.

**Must have (table stakes):**
- Google Sign-In — primary SSO, industry default, highest mobile adoption
- Apple Sign-In — mandatory per App Store Guideline 4.8 whenever a third-party SSO exists
- Email + password — fallback for users without Google/Apple
- Persistent cookie-based session — users stay logged in across app restarts
- `<AuthPromptSheet>` bottom sheet — reusable soft gate component for all three social actions
- Like button + count on every video, with optimistic update, soft gate for guests
- Bookmark/save button on every video, with optimistic update, soft gate for guests
- Comment sheet per video — read free (guests included), post requires auth; flat list, newest-first
- Basic comment moderation — rate limit (1 comment/60s), length cap (500 chars), profanity filter, report button
- Profile page — avatar, display name, Saved tab, Liked tab, sign-out
- Empty states for all social features (new users, no-content states)

**Should have (competitive):**
- Like animation (heart burst micro-interaction) — high impact, low cost; add after likes are working
- Pinned editorial comment — allows the FinFeed editorial voice to add context to stories
- Real-time comment updates (Supabase Realtime) — worth enabling for comments if discussion density justifies it; skip for likes
- Account deletion (GDPR compliance) — required before any EU-facing growth push
- Edit display name / custom avatar upload — user customization, low complexity

**Defer (v2+):**
- Passkeys / biometric login (WebAuthn — high complexity, low current adoption)
- Guest-to-auth bookmark migration (carry in-session saves into account on signup)
- Comment reactions / like a comment
- Saved video collections / folders
- Push notifications for comments
- "Friends liked this" social proof (requires social graph)
- Public profiles / follow graph (out of scope — FinFeed is a broadcast product, not a creator platform)

### Architecture Approach

The architecture is additive and brownfield-safe. The existing `lib/supabase.ts` anon singleton is preserved and continues to serve `/api/today` and `/api/editions/[id]` unchanged. A new `lib/supabase/` subdirectory contains the auth-aware clients: `server.ts` (createServerClient, for Server Components and Route Handlers) and `client.ts` (createBrowserClient, for Client Components). A `middleware.ts` at the project root refreshes the auth token on every non-static request and redirects `/profile` to `/login` when no session exists. Social state is co-located in a `useSocial(videoId)` hook per VideoItem — it is not lifted into VideoFeed, which already owns scroll tracking, edition switching, and category tab logic. The Python pipeline is completely unchanged and auth-unaware.

**Major components:**
1. `middleware.ts` — Token refresh on every request (with static-asset matcher); UX redirect for protected routes; NOT the security layer (RLS is)
2. `lib/supabase/server.ts` + `lib/supabase/client.ts` — Dual-client factory pattern; server creates per-request (never singleton); browser uses cookie storage
3. `app/auth/callback/route.ts` — OAuth code exchange; sets session cookie; triggers `on_auth_user_created` trigger on first login to create a `profiles` row
4. `components/SocialOverlay.tsx` + `hooks/useSocial.ts` — Co-located social state per video; optimistic mutations; guest gate without lifting state into VideoFeed
5. `components/AuthModal.tsx` — Reusable bottom sheet auth prompt for all three soft-gated actions; standardized `<AuthPromptSheet>` avoids duplicating the sheet across like, bookmark, and comment handlers
6. `/api/social/like`, `/api/social/bookmark`, `/api/social/comments` — Explicit Route Handlers for mutations; each calls `getUser()` independently before any DB write; returns 401 for unauthenticated requests
7. Postgres schema: `profiles` (trigger-created on auth.users INSERT), `likes`, `bookmarks`, `comments` — all with RLS; indexes on `video_id` and `user_id` in the same migration as table creation

### Critical Pitfalls

1. **iOS PWA OAuth redirect breaks standalone context** — OAuth providers open outside the PWA's standalone scope; session writes to Safari's context, not the app's; user returns to home screen icon and is still logged out. Mitigation: ship email OTP as the primary auth path for iOS; use synchronous `window.open()` before any async auth call; test on a real iPhone with PWA installed before any auth feature ships. This is the highest recovery cost pitfall in the milestone.

2. **`getSession()` used in server-side write paths** — reads the JWT cookie without revalidating against the Supabase Auth server; expired or spoofed cookies bypass the auth check. Mitigation: use `getUser()` in every Route Handler that performs a write; grep the codebase for `getSession` in server files before each social phase ships.

3. **RLS enabled on tables without policies — silent empty results** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with no policies causes all queries to return zero rows with no error. The Supabase SQL Editor (superuser) bypasses RLS and masks this during development. Mitigation: write RLS policies in the same migration that creates each table; test through the client SDK with a real user token.

4. **Middleware running on every request + CVE-2025-29927** — without a `matcher`, the auth middleware fires on every static asset (9+ Supabase network calls per page load); CVE-2025-29927 (CVSS 9.1, March 2025) allows middleware bypass via header spoofing, meaning middleware alone is not a security gate. Mitigation: add matcher excluding `_next/static`, `_next/image`, and image file extensions; enforce auth at the data access layer (`getUser()` in each Route Handler).

5. **Apple OAuth secret expires silently every 6 months** — the `.p8`-based client secret required for Apple Sign In web OAuth stops working on day 183 with no notification. Mitigation: set a recurring calendar reminder at setup for 5.5 months; store the `.p8` file in a password manager; document rotation in the ops runbook before going live with Apple auth.

---

## Implications for Roadmap

The dependency chain is clear and dictates phase order: auth infrastructure before auth UI before social schema before social UI before profile. Apple OAuth is deferred to a separate phase because it requires external setup (Apple Developer account), has an ongoing ops burden (key rotation), and its failure mode on iOS Safari PWA makes it unsafe to develop in parallel with core auth infrastructure validation.

### Phase 1: Auth Infrastructure
**Rationale:** Everything downstream depends on working sessions. Building and verifying auth plumbing in isolation — before any social UI — lets the team confirm sessions persist on iOS PWA before any social feature is built on a potentially broken auth foundation.
**Delivers:** `@supabase/ssr` installed; `lib/supabase/server.ts` + `client.ts` + `middleware.ts`; `middleware.ts` at project root with correct static-asset matcher; `app/auth/callback/route.ts`; `profiles` table + `on_auth_user_created` trigger; Google OAuth configured end-to-end; email/password configured.
**Addresses:** Persistent session, Google Sign-In, email/password, Vercel preview URL OAuth
**Avoids:** CVE-2025-29927 (middleware matcher required), `getSession()` security hole, accidentally breaking existing feed by touching `lib/supabase.ts`, Vercel preview URL OAuth failures
**Research flag:** Standard patterns — skip `/gsd:research-phase` (official Supabase docs cover this end-to-end)

### Phase 2: Auth UI + iOS PWA Validation
**Rationale:** The iOS PWA OAuth pitfall must be explicitly validated before social features are built. If the auth foundation is verified on desktop only and social features ship, rearchitecting auth mid-milestone is costly. This phase forces that validation checkpoint.
**Delivers:** `app/login/page.tsx`; `useAuth` hook; `<AuthModal>` bottom sheet; route protection for `/profile`; iOS PWA OAuth tested on real iPhone; email OTP confirmed as functional fallback.
**Addresses:** Soft gate UX pattern (bottom sheet, non-blocking, dismissible), iOS PWA auth reliability
**Avoids:** iOS PWA OAuth context switch pitfall (highest recovery cost — must be solved before social UI is built on top of auth)
**Research flag:** No `/gsd:research-phase` needed, but a real-device iOS testing checkpoint is mandatory before this phase closes

### Phase 3: Social Schema + API Routes
**Rationale:** Data model and API surface are a dependency for UI components. Building schema and route handlers as an isolated phase makes them independently testable and keeps the Python pipeline auth-unaware.
**Delivers:** `likes`, `bookmarks`, `comments` DB migrations with RLS policies and indexes in the same migration file; `/api/social/like`, `/api/social/bookmark`, `/api/social/comments` Route Handlers; each handler calls `getUser()` before writes; 401 returned for unauthenticated mutations; like counts publicly readable by guests.
**Addresses:** Like, bookmark, and comment persistence; like count visibility to guests; comment reading without auth
**Avoids:** RLS-without-policies silent deny, missing indexes on `video_id`/`user_id`, `getSession()` in write paths, accidentally enabling RLS on existing `videos`/`editions` tables
**Research flag:** Standard patterns — skip `/gsd:research-phase`

### Phase 4: Social UI (Feed Integration)
**Rationale:** UI wires up to the verified API and schema. Social state is co-located in `useSocial(videoId)` per VideoItem, not in VideoFeed, to avoid re-rendering the entire feed on each like toggle.
**Delivers:** `SocialOverlay.tsx` (like/bookmark/comment buttons as absolute overlay on each video); `useSocial` hook with optimistic mutations and revert on error; `VideoItem.tsx` modified to include overlay; `VideoFeed.tsx` accepts and propagates `user` prop; guest tapping a social action sees `<AuthModal>`; like count visible to all users.
**Addresses:** Like button + count, bookmark/save, comment count, optimistic UI updates, soft gate, empty states
**Avoids:** Lifting social state into VideoFeed (couples it to existing scroll/play/tab logic), Supabase Realtime like counts on free tier
**Research flag:** Standard patterns — skip `/gsd:research-phase`

### Phase 5: Comments Feature
**Rationale:** Comments are the most complex social feature — they require a comment sheet UI, posting with moderation, pagination, and author profile display. Isolated phase ensures moderation minimums ship with the feature and are not skipped.
**Delivers:** Comment sheet bottom drawer per video; flat comment list (newest-first, paginated 20/page with cursor-based pagination); comment posting (auth required); PostgREST embedded select for author profiles (no N+1); rate limit (1/60s), length cap (500 chars), profanity filter, report button; "Sign in to comment" shown to guests.
**Addresses:** Comment read (guest-accessible), comment post (auth required), moderation minimums, display name + avatar on each comment
**Avoids:** N+1 comment + author queries, unbounded comment fetch, threading complexity
**Research flag:** Skip `/gsd:research-phase` for core patterns; profanity blocklist source (e.g., `bad-words` npm package) needs brief identification during phase planning

### Phase 6: Profile Page
**Rationale:** Profile depends on likes and bookmarks being complete; otherwise its tabs are empty and the page provides no value. Building it last means it can display real user data from day one.
**Delivers:** `app/profile/page.tsx` (server component, protected route); `ProfileView.tsx`; Saved tab (bookmarks); Liked tab (liked videos); display name + avatar (from OAuth metadata initially); Sign Out; empty states for new users.
**Addresses:** Profile page, liked videos list, saved videos list, sign-out, empty states
**Avoids:** Profile page built before social data exists; public profile / social graph scope creep
**Research flag:** Standard patterns — skip `/gsd:research-phase`

### Phase 7: Apple Sign In
**Rationale:** Mandatory per App Store Guideline 4.8 once Google Sign-In exists. Deferred to its own phase because it requires Apple Developer account setup ($99/yr), domain verification, Services ID configuration, and ongoing 6-month key rotation. The iOS PWA auth behavior is already understood from Phase 2.
**Delivers:** Apple OAuth configured in Supabase + Apple Developer console; Apple button in `login/page.tsx` and `<AuthModal>`; 6-month key rotation runbook written; calendar reminder set.
**Addresses:** Apple Sign-In (mandatory before any App Store distribution)
**Avoids:** Apple secret expiry without a rotation process; building Apple auth before the iOS PWA auth context is understood
**Research flag:** Needs `/gsd:research-phase` during planning — Apple Developer console configuration steps are Apple-controlled and change with policy updates; verify current Services ID + `.p8` key setup flow before estimating

### Phase Ordering Rationale

- Auth infrastructure must precede all social features — there is no shortcut to this dependency chain.
- iOS PWA testing is an explicit phase gate (Phase 2) rather than a QA item because the recovery cost if auth is wrong is HIGH; it would require rearchitecting the auth modal approach, breaking phases 4–6 built on top of it.
- Social schema (Phase 3) precedes social UI (Phase 4) to keep the API surface independently testable and to enforce the `getUser()` security pattern before any UI is wired up.
- Comments (Phase 5) is separated from likes/bookmarks (Phase 4) because comments carry unique complexity: moderation requirements, N+1 query risk, and pagination are each non-trivial.
- Profile (Phase 6) is last because it is a consumer of data produced by Phases 3–5.
- Apple Sign In (Phase 7) is final because it requires external account setup, has ongoing ops obligations, and is blocked on understanding the iOS PWA auth behavior validated in Phase 2.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 7 (Apple Sign In):** Apple Developer console configuration steps change with Apple policy updates; brief `/gsd:research-phase` recommended to verify current Services ID + `.p8` key setup flow before planning Apple auth work.
- **Phase 5 (Comments moderation):** Profanity blocklist source needs identification; at MVP scale an in-process blocklist is sufficient but the package/list source should be confirmed before implementation starts.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auth Infrastructure):** Covered end-to-end by official Supabase `@supabase/ssr` + Next.js App Router docs.
- **Phase 3 (Social Schema):** Standard Postgres + RLS patterns; fully documented in Supabase official docs.
- **Phase 4 (Social UI):** Optimistic update and soft-gate patterns are well-established in the Next.js community.
- **Phase 6 (Profile Page):** Server Component + Supabase query patterns are fully documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions documented in official Supabase `@supabase/ssr` docs; versions confirmed; alternatives considered and rejected with clear rationale; existing stack boundaries verified by direct codebase inspection |
| Features | HIGH | Feature set consistent across official docs, competitor analysis (TikTok/YouTube/Instagram), and established UX research (NN/g bottom sheet guidelines); Apple Sign-In mandatory requirement confirmed via App Store Guideline 4.8 |
| Architecture | HIGH | Based on official Supabase Next.js App Router integration docs + direct codebase inspection of existing files; existing boundaries (`lib/supabase.ts`, `/api/today`, `/api/editions/[id]`) verified safe to preserve |
| Pitfalls | HIGH | iOS PWA OAuth pitfall confirmed by multiple independent community sources (Supabase GitHub discussions, pocketbase discussions, Safari issues tracker); CVE-2025-29927 confirmed via OffSec advisory (CVSS 9.1); RLS silent-deny behavior confirmed in official Supabase docs |

**Overall confidence:** HIGH

### Gaps to Address

- **iOS OTP email deliverability:** Supabase free tier email delivery has a 3 emails/hour rate limit. If users frequently request OTPs, this limit will be hit. Configure a custom SMTP provider (Resend, SendGrid) before Phase 1 ships to production.
- **Apple Developer account availability:** Phase 7 requires a paid Apple Developer account ($99/yr). Verify account availability before roadmap estimates for Phase 7 are committed.
- **Comment moderation blocklist source:** The research specifies a simple string-match approach but does not identify a specific open-source blocklist. Identify a package (e.g., `bad-words` npm package) during Phase 5 planning.
- **Vercel Hobby plan function invocation limits:** Adding 3 new Route Handlers (`/api/social/*`) plus the auth callback route increases Vercel function count. Verify Hobby plan function invocation limits are not a constraint at expected traffic volume.

---

## Sources

### Primary (HIGH confidence)
- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` package, middleware pattern, createServerClient/createBrowserClient
- [Creating a Supabase client for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — cookie handling patterns
- [User Management (Profiles Table + Trigger) — Supabase Docs](https://supabase.com/docs/guides/auth/managing-user-data) — profiles schema, `on_auth_user_created` trigger
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policies, deny-all default without policies
- [Storage Access Control — Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control) — `storage.foldername()` policy pattern for user-scoped avatar paths
- [Login with Google — Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google) — OAuth redirect URL configuration
- [Login with Apple — Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) — Apple OAuth requirements, .p8 key rotation requirement
- [Passwordless email logins — Supabase Docs](https://supabase.com/docs/guides/auth/auth-email-passwordless) — OTP vs magic link tradeoffs for iOS PWA
- [Apple App Store Guideline 4.8](https://workos.com/blog/apple-app-store-authentication-sign-in-with-apple-2025) — mandatory when third-party SSO is offered
- [CVE-2025-29927 — Next.js middleware bypass](https://www.offsec.com/blog/cve-2025-29927/) — CVSS 9.1, March 2025; middleware cannot be sole auth gate
- [NN/G Bottom Sheet UX guidelines](https://www.nngroup.com/articles/bottom-sheet/) — non-blocking auth prompt pattern for mobile
- Existing codebase: `frontend/lib/supabase.ts`, `frontend/app/api/today/route.ts`, `frontend/components/VideoFeed.tsx`, `frontend/components/VideoItem.tsx` — boundary verification for additive approach

### Secondary (MEDIUM confidence)
- [iOS PWA OAuth/session isolation — pocketbase discussions](https://github.com/pocketbase/pocketbase/discussions/2429) — iOS standalone context does not share session with Safari browser context
- [iOS PWA Supabase auth — Supabase GitHub discussions](https://github.com/orgs/supabase/discussions/12227) — Add to Home Screen auth failure confirmed by multiple community reports
- [Supabase middleware performance — GitHub discussions](https://github.com/orgs/supabase/discussions/20905) — 9+ invocations per page load without matcher confirmed
- [Google OAuth + Vercel preview URLs — Vercel community](https://community.vercel.com/t/google-oauth-redirect-url-with-vercel-preview-urls-supabase/6345) — Supabase wildcard redirect URL workaround for preview deployments
- [Supabase Pricing](https://supabase.com/pricing) — 50,000 MAU auth limit, 200 Realtime concurrent connections (verify at project start; pricing pages change)
- [Authgear login UX guide 2025](https://www.authgear.com/post/login-signup-ux-guide) — guest access soft gate pattern confirmed across multiple products

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
