# Feature Research

**Domain:** Auth, Social (likes, comments, bookmarks), and Profile for a mobile-first vertical video feed PWA
**Project:** FinFeed v1.2 milestone
**Researched:** 2026-03-23
**Confidence:** MEDIUM (web-verified for patterns; Supabase/Next.js auth integration HIGH based on official docs)

---

## Context: What Is Already Built

FinFeed v1.1 ships with:
- Vertical snap-scroll video feed (TikTok-style), Finance + Tech categories
- Finite daily editions (5 stories/category), "You're up to date" end state
- AI-generated content; no user accounts; fully open/anonymous access
- Stack: Next.js 16 App Router, Supabase (Postgres + Storage), Vercel

This milestone adds: **user accounts**, **optional auth** (guests can watch), **likes**, **per-video comments**, **bookmarks/save**, and a **profile page**.

The original FEATURES.md covered v1.0 video feed UX. This document covers the social layer only.

---

## Feature Categories

1. [Authentication](#1-authentication)
2. [Likes](#2-likes)
3. [Comments](#3-comments)
4. [Bookmarks / Save](#4-bookmarks--save)
5. [Profile Page](#5-profile-page)

---

## 1. Authentication

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google Sign-In | Industry default SSO; frictionless; no password to forget | LOW | Supabase has first-class Google OAuth support — `@supabase/ssr` + `signInWithOAuth({provider: 'google'})`. Requires Google Cloud Console OAuth2 credential. |
| Apple Sign-In | **Mandatory** when Google login is offered — Apple App Store Review Guideline 4.8 requires it | MEDIUM | Supabase supports Apple OAuth. Apple requires a `.p8` signing key that expires and must be rotated every 6 months. For a web/PWA, the OAuth flow (not native SDK) is the right path. |
| Email + password | Users who don't want SSO; lower trust environments | LOW | Supabase Auth handles this natively. Requires email confirmation flow (Route Handler to exchange token). |
| "Sign in" prompt on social action | Users expect to be prompted when tapping Like/Comment without being logged in — not silently blocked | LOW | Bottom sheet modal is the correct pattern for mobile; blocking navigation is wrong. |
| Persistent session | User stays logged in after closing and reopening the app | LOW | Supabase cookie-based sessions via `@supabase/ssr` persist across page loads and are compatible with Next.js App Router SSR. |
| Sign out | Basic expectation; must be reachable from profile | LOW | `supabase.auth.signOut()` — trivial. |
| Password reset (email) | Required for email/password path | LOW | Supabase handles full email reset flow out of the box. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Passkeys / biometric login | Emerging standard (WebAuthn); users can sign in with Face ID / fingerprint instead of password | HIGH | Supabase supports passkeys as of 2025. Overkill for v1.2; defer to v1.3+. |
| "Continue as guest" persistent state | Carry any in-session bookmarks into account on sign-up | MEDIUM | Requires guest→auth migration logic. Nice UX but non-trivial. Defer. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Username + handle creation on signup | "Feel like a real social network" | Friction at signup kills conversion; this is a news app, not Twitter | Use display name from Google/Apple profile; let users edit later in profile settings |
| Mandatory signup before viewing | "We need to know our users" | Destroys the core open-access product promise; the feed works without login | Soft gate: guests browse freely, social actions trigger sign-in prompt |
| Magic link / passwordless email only | "Simpler" | Magic links rely on email deliverability; users forget to check email; UX feels unfinished without SSO | Offer SSO (Google + Apple) as primary, email/password as secondary |
| Email verification blocking the UI | "We need verified emails" | Blocks users from immediately using the app after email signup | Send verification email in background; allow use immediately; prompt to verify later |
| GitHub OAuth | "We already have Supabase so it's easy" | FinFeed users are not developers; GitHub login is confusing/irrelevant | Google + Apple covers >95% of mobile users |

### Optional Auth (Soft Gate) — Critical UX Pattern

The product promise is "anyone can watch." Auth is only needed for social interactions. The correct pattern — used by YouTube, Pinterest, and news apps — is:

1. **Guest browsing:** Full feed access with no login prompt on entry.
2. **Social action triggers prompt:** User taps Like/Comment/Bookmark → bottom sheet slides up: "Sign in to [like this / save for later / join the conversation]" with Google, Apple, and Email options.
3. **Non-blocking prompt:** Dismissing the prompt returns user to the video (does not block navigation).
4. **One-tap sign-in from prompt:** Bottom sheet shows all 3 auth options inline — user never navigates away from the feed.
5. **After sign-in, action completes:** If user tapped Like then signed in, the Like is immediately applied.
6. **No prompt on first open:** Never ask for login unprompted on cold launch.

**Bottom sheet vs modal dialog:** Bottom sheets are preferred on mobile because they don't cover the full screen, feel native on iOS and Android, and are easily dismissible (swipe down). A full-screen modal for auth is aggressive and jarring.

---

## 2. Likes

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Like button on each video | Universal social signal; TikTok/Reels trained this expectation | LOW | Heart icon, right-side vertical action bar (TikTok layout). |
| Like count displayed | Users want to see community signal | LOW | Show aggregate count below heart icon. |
| Toggle (like / unlike) | Tapping again removes the like | LOW | Idempotent upsert/delete on `likes` table. |
| Optimistic UI update | Heart fills instantly on tap, count increments before server confirms | LOW | `useOptimistic` (React 19 / Next.js) or local state update before async call. Revert on error. |
| Liked state persists across sessions | If user liked a video yesterday, heart is still filled today | LOW | Requires auth + DB lookup on feed load. Load liked video IDs for current user in the feed query. |
| Soft gate for unauthenticated users | Tap Like without login → sign-in prompt appears | LOW | Check `session` state on tap; if null, show auth bottom sheet. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Like animation (heart burst) | Micro-interaction makes the action feel rewarding | LOW | CSS animation on tap (scale + color transition). TikTok uses this. High value, low cost. |
| "Friends liked this" indicator | Social proof — seeing known people liked a video increases engagement | HIGH | Requires friend graph; major scope expansion. Defer to v2. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time like count updates (Supabase Realtime broadcast) | "Show live likes like TikTok" | Supabase Realtime adds WebSocket connection overhead; for a finite 5-video feed, stale count by minutes is fine | Fetch like counts on load; update optimistically on user's own like; skip live broadcast |
| Dislike / downvote | "Balance the signal" | Dislike buttons create toxicity and anxiety; YouTube removed public dislike counts for this reason | No downvote; like-only system |
| Like leaderboard / trending by likes | "Surface best content" | All content is finite and curated — there's no infinite pool to surface from | Finite feed IS the curation; likes are personal history only |

---

## 3. Comments

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Comment count on video | Users want to know if discussion exists | LOW | Show count below comment icon in action bar. |
| Comment sheet / drawer | Tap comment icon → slide-up sheet showing comments for this video | MEDIUM | Full-height bottom sheet. Does not navigate away from video (video keeps playing or pauses beneath). |
| Post a comment (text) | Core social interaction | LOW | Single text input + submit. Requires auth. |
| See all comments for a video | Flat list, newest-first | LOW | Paginated fetch from `comments` table WHERE `video_id`. |
| Delete own comment | User control | LOW | Only the comment author can delete. |
| Soft gate (auth required to post) | Can read comments as guest; posting requires login | LOW | Unauthenticated users see all comments but see "Sign in to comment" in place of the input box. |
| Timestamp on each comment | "When was this posted?" | LOW | Relative time ("2 hours ago") using `date-fns` or `Intl.RelativeTimeFormat`. |
| Display name + avatar on comment | Attribution | LOW | Pull from auth profile (Google/Apple provide name + avatar URL). |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Comment reactions (like a comment) | Lightweight upvote without threading | MEDIUM | `comment_likes` table; simpler than nested replies. Defer to v1.3. |
| Pinned comment from author | FinFeed (as editorial voice) can pin a context comment | LOW | `is_pinned` boolean column; show pinned comment at top. Only admin can pin. Low complexity, adds editorial value. |
| Real-time comment updates | New comments appear without refresh | MEDIUM | Supabase Realtime on `comments` table. Only enable Realtime on this table (not likes). Worth doing for comments because it makes the sheet feel live. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Nested/threaded replies | "Reply to specific comment like Reddit" | Threading on mobile pushes content off-screen; indentation breaks; moderating a tree is complex | Flat comments only; users can @mention in their text |
| Infinite comment threads | "Let conversations grow" | Goes against FinFeed's anti-infinite-scroll ethos; moderation scales poorly | Show first 20 comments, "View all X comments" load more. Keep threads bounded. |
| Emoji reactions per-comment | "Express without typing" | Adds DB complexity (reactions table), UI density, and moderation surface | Stick to text + comment likes only |
| Real-time typing indicators | "Live chat feel" | This is a news comments section, not a chat room | No typing indicators |
| Edit comment | "Fix typos" | Editable content creates moderation confusion (original meaning vs edited) | Delete + re-post is sufficient |
| Comment notifications (push) | "Know when someone replies" | Push notification infrastructure is a separate milestone (deferred in PROJECT.md) | No notifications in v1.2; "your comments" visible in profile |

### Comment Moderation Minimums

Without basic moderation, comment spam will kill the feature within days. These are not optional:

| Minimum | Complexity | Implementation |
|---------|------------|----------------|
| Rate limit per user (1 comment per 60 seconds) | LOW | Check last comment timestamp in DB before insert |
| Max comment length (500 chars) | LOW | Client + server validation |
| Basic profanity filter (block list) | LOW | Simple string match on a blocklist before insert |
| Report comment button | LOW | `reported_comments` table; admin reviews via Supabase Studio |
| Admin delete any comment | LOW | Server-side check: if user is admin role, allow delete regardless of author |

---

## 4. Bookmarks / Save

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Save/bookmark button on video | Standard "watch later" / "save" pattern (Instagram, YouTube, TikTok) | LOW | Bookmark icon in right-side action bar. |
| Toggle (save / unsave) | Tapping again removes the bookmark | LOW | Same idempotent upsert/delete pattern as likes. |
| Saved state persists | Bookmark icon filled if user has saved this video | LOW | Same pattern as liked state — load saved video IDs on feed render. |
| Saved videos list (in profile) | Users expect to find saved content in their profile | LOW | Query `bookmarks` table WHERE `user_id` for profile page. |
| Soft gate (auth required) | Tap Bookmark without login → sign-in prompt | LOW | Same pattern as likes gate. |
| Optimistic UI update | Bookmark fills instantly on tap | LOW | Same pattern as likes. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Save with category/collection | User can organize saved videos ("Finance", "Tech", custom) | HIGH | Collection model — significant scope increase. Defer to v2. |
| "You saved X videos this week" summary | Engagement metric for the user | LOW | Simple count in profile page. Nice-to-have. |
| Share a saved video | Send a specific video link to a friend | LOW | Web Share API (`navigator.share`) with the video's permalink. Already tagged as a differentiator in original FEATURES.md. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Offline video download | "Watch saved videos without internet" | Video storage on device is large; service worker cache for videos has a 50MB iOS limit; legal issues with downloaded content | Saved list shows URLs; videos stream on demand |
| "Recommended based on saves" | Personalization | Requires ML pipeline; against the "curated editorial" product promise | The editorial feed IS the curation |
| Public saved lists | "Share my watchlist" | Privacy concern; adds follower/social graph complexity | Saved list is private to the user only |

---

## 5. Profile Page

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Avatar / profile photo | Visual identity; pulled from Google/Apple on first sign-in | LOW | Display `user.user_metadata.avatar_url` from Supabase auth. Let user upload custom avatar later. |
| Display name | Identity; pulled from Google/Apple on first sign-in | LOW | `user.user_metadata.full_name` from Supabase auth. |
| Liked videos list | "My activity" — users want to revisit liked content | LOW | Query `likes` table JOIN `videos` WHERE `user_id`. |
| Saved videos list | Primary reason to have a profile; the "watch later" list | LOW | Query `bookmarks` table JOIN `videos` WHERE `user_id`. |
| Sign out button | Essential; must be easy to find | LOW | `supabase.auth.signOut()`. |
| Empty states for liked/saved | New users see a clear prompt (e.g., "Tap the heart on any video to like it") | LOW | Required to avoid confusion on a freshly created account. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Edit display name / avatar | User customization | LOW | Update `profiles` table + Supabase Storage for custom avatar. |
| "X videos watched" count | Engagement milestone; lightweight gamification | LOW | Increment a `videos_watched` counter in the `profiles` table on each video view. |
| "Joined [date]" | Transparency; community warmth | LOW | `created_at` from Supabase auth. |
| View my comments history | Transparency; accountability | MEDIUM | Query `comments` WHERE `user_id`, paginated list. |
| Account deletion | Privacy/regulatory compliance (GDPR) | MEDIUM | Delete user + cascade-delete all their data. Supabase Admin API required for full auth user deletion. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Public profile / follow other users | "Build community" | Requires follower graph, feed personalization, privacy settings — entirely different product scope | FinFeed is a broadcast product; no social graph needed |
| Content creator profiles | "Let users upload their own videos" | Goes against the AI-curated editorial model entirely | FinFeed is editorial only; no UGC |
| Notification settings page | "Let users control alerts" | Push notifications are out of scope for this milestone (PROJECT.md marks them deferred) | No notification settings until push milestone |
| Achievement badges | "Gamify engagement" | Adds complexity; FinFeed's USP is intentional brevity — gamification conflicts | Simple watch count is sufficient signal |

### Profile Page Layout (Recommended)

Mobile-first profile page minimal layout for a video news app:

```
[Avatar] [Display name]
         [Joined March 2026]

[Tabs]
  Saved (N)  |  Liked (N)  |  Comments (N)
  ─────────────────────────────────────────
  [Video thumbnail grid — 2 columns]
  [Empty state if none]

[Settings / Sign Out]  ← bottom, low prominence
```

- Video thumbnail grid (2-column) for saved/liked, NOT a list — thumbnails are visual and scannable.
- Tabs are bottom-aligned with counts — let users know what they have before tapping.
- Settings/Sign Out at the bottom in a low-visual-weight row — destructive or administrative actions should not compete with content.

---

## Feature Dependencies

```
[Google Sign-In]
    └── requires ──> Supabase Auth configured (Google OAuth provider)

[Apple Sign-In]
    └── requires ──> Supabase Auth (Apple OAuth provider)
    └── requires ──> Apple Developer account + .p8 signing key
    └── NOTE ───> Mandatory if Google Sign-In is offered (App Store Guideline 4.8)

[Email + Password Auth]
    └── requires ──> Supabase Auth (email provider)
    └── requires ──> Confirmation email Route Handler (Next.js App Router)

[Auth Session (any provider)]
    └── enables ──> [Likes]
    └── enables ──> [Comments: posting]
    └── enables ──> [Bookmarks]
    └── enables ──> [Profile Page]

[Likes]
    └── requires ──> Auth session OR soft-gate prompt
    └── requires ──> `likes` table (video_id, user_id, created_at)
    └── enables ──> [Profile: Liked videos list]

[Bookmarks]
    └── requires ──> Auth session OR soft-gate prompt
    └── requires ──> `bookmarks` table (video_id, user_id, created_at)
    └── enables ──> [Profile: Saved videos list]

[Comments: reading]
    └── requires ──> `comments` table (id, video_id, user_id, body, created_at)
    └── no auth required (guests can read)

[Comments: posting]
    └── requires ──> Auth session OR soft-gate prompt
    └── requires ──> `comments` table
    └── requires ──> Basic moderation (rate limit + length cap)
    └── enables ──> [Profile: Comments history]

[Profile Page]
    └── requires ──> Auth session
    └── requires ──> `profiles` table (user_id, display_name, avatar_url)
    └── requires ──> [Likes] data for Liked tab
    └── requires ──> [Bookmarks] data for Saved tab

[Soft Gate (auth prompt)]
    └── requires ──> Auth system configured
    └── used by ──> [Likes], [Comments: posting], [Bookmarks]
    └── must NOT block ──> Video feed browsing
```

### Dependency Notes

- **Apple Sign-In requires Google Sign-In to be offered first** (or either offered alone): Apple's mandatory requirement only triggers when a third-party social login exists. If email/password only, Apple Sign-In is not required. Since we are building Google SSO, Apple MUST also be included.
- **Comments reading has no auth dependency:** Guests see all comments. Only posting requires auth. This is the correct soft-gate pattern.
- **Likes and Bookmarks both require the same soft-gate pattern:** Standardize the auth prompt into a single reusable component called `<AuthPromptSheet>` to avoid duplicating the sheet across three action handlers.
- **Profile Page requires Likes and Bookmarks to be built first:** Otherwise the Liked/Saved tabs are empty and the page provides no value. Build auth → likes → bookmarks → profile in that order.

---

## MVP Definition

### Launch With (this milestone — v1.2)

- [ ] Google Sign-In — primary SSO path, highest adoption
- [ ] Apple Sign-In — mandatory per App Store rules once Google exists
- [ ] Email + password — fallback for users without Google/Apple
- [ ] Persistent session (cookie-based, App Router compatible)
- [ ] `<AuthPromptSheet>` — reusable bottom sheet component for soft gates
- [ ] Like button + like count on each video, optimistic update, soft gate
- [ ] Bookmark/save button on each video, optimistic update, soft gate
- [ ] Comment sheet per video (read free, post requires auth), flat list, newest-first
- [ ] Basic comment moderation (rate limit, length cap, profanity filter, report)
- [ ] Profile page: avatar, name, Saved tab, Liked tab, Sign Out
- [ ] Empty states for all social features (new users, no content yet states)

### Add After Validation (v1.x)

- [ ] Like animation (heart burst micro-interaction) — add once likes are working; low complexity, high polish
- [ ] Pinned editorial comment on videos — add if editorial team wants to add context to stories
- [ ] Real-time comment updates (Supabase Realtime) — add if comment sheets show active discussion
- [ ] Edit display name / custom avatar — add once profile page ships and users ask for it
- [ ] Account deletion (GDPR) — add before marketing/growth pushes; required for any EU users
- [ ] Comments history tab on profile — add if users request it

### Future Consideration (v2+)

- [ ] Passkeys / biometric login — WebAuthn support; defer until passkey adoption is mainstream
- [ ] Guest-to-auth bookmark migration — carry in-session saves into account on signup
- [ ] Comment reactions (like a comment) — valid engagement feature but adds scope
- [ ] Collections / saved video folders — organizing saved content
- [ ] Push notifications for comments — when push milestone is tackled
- [ ] "Friends liked this" social proof — requires a social graph

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google Sign-In | HIGH | LOW | P1 |
| Apple Sign-In | HIGH (mandatory) | MEDIUM | P1 |
| Email + password | MEDIUM | LOW | P1 |
| Soft gate (`<AuthPromptSheet>`) | HIGH | LOW | P1 |
| Persistent session | HIGH | LOW | P1 |
| Like button + count | HIGH | LOW | P1 |
| Like: optimistic update + animation | MEDIUM | LOW | P1 |
| Bookmark / save | HIGH | LOW | P1 |
| Comment sheet (read) | HIGH | LOW | P1 |
| Comment sheet (post, auth gated) | HIGH | LOW | P1 |
| Comment moderation minimums | HIGH | LOW | P1 |
| Profile: Saved + Liked tabs | HIGH | LOW | P1 |
| Profile: Sign out | HIGH | LOW | P1 |
| Empty states | MEDIUM | LOW | P1 |
| Like animation (burst) | MEDIUM | LOW | P2 |
| Pinned editorial comment | MEDIUM | LOW | P2 |
| Real-time comment updates | MEDIUM | MEDIUM | P2 |
| Account deletion | MEDIUM | MEDIUM | P2 |
| Edit display name / avatar | LOW | LOW | P2 |
| Passkeys | LOW | HIGH | P3 |
| Comment reactions | LOW | MEDIUM | P3 |
| Collections / saved folders | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add in v1.2.x iteration
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | TikTok | YouTube Shorts | Instagram Reels | FinFeed Approach |
|---------|--------|----------------|-----------------|-----------------|
| Auth required to view | No | No | No (partially) | No — guests browse freely |
| Auth prompt on like | Yes — immediate modal | Yes — bottom prompt | Yes — inline prompt | Bottom sheet, non-blocking, dismissible |
| Like button position | Right-side vertical bar | Right-side vertical bar | Right-side vertical bar | Right-side vertical bar (follow convention) |
| Comment threads | Flat + 1-level reply | Nested threads (2025 experiment) | Flat | Flat only — no threading |
| Comment visibility | Public | Public | Public | Public (read by guests) |
| Bookmark/Save | Yes (Collections) | Yes (Watch Later) | Yes (Collections) | Simple save, no collections in v1.2 |
| Profile: liked content | Hidden by default | Visible | Hidden by default | Visible (FinFeed users want their history) |
| Profile: followers/following | Yes | Yes | Yes | No social graph — not a creator platform |

**Key insight:** TikTok, YouTube, and Instagram all treat auth as a soft gate — guests browse freely, prompted only on social actions. FinFeed must match this pattern. Mandating login before viewing would be a regression from v1.1's open access and would destroy the "try before committing" experience that is core to the product.

---

## Supabase Schema (Minimal — for Planning)

```sql
-- profiles: one row per authenticated user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- likes: one row per (user, video) pair
create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  video_id uuid references videos(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, video_id)
);

-- bookmarks: same pattern as likes
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  video_id uuid references videos(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, video_id)
);

-- comments: flat, per-video
create table comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null check (char_length(body) <= 500),
  is_pinned boolean default false,
  created_at timestamptz default now()
);
```

**RLS is required on all four tables.** Without Row Level Security, authenticated users can read/write other users' data. Enable RLS + write policies:
- `profiles`: users can only update their own row; all can read.
- `likes` + `bookmarks`: users can only insert/delete their own rows; all can read (for like counts).
- `comments`: all can read; authenticated users can insert; users can only delete their own (admins can delete any).

---

## Sources

- [Supabase Auth quickstart for Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs) — HIGH confidence (official docs)
- [Supabase server-side auth for Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence (official docs)
- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google) — HIGH confidence (official docs)
- [Supabase Apple OAuth](https://supabase.com/docs/guides/auth/social-login/auth-apple) — HIGH confidence (official docs, note: .p8 key rotation every 6 months)
- [Apple Sign-in with Apple requirements](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) — HIGH confidence; mandatory if third-party SSO offered
- [Apple App Store Guideline 4.8 — mandatory Apple sign-in](https://workos.com/blog/apple-app-store-authentication-sign-in-with-apple-2025) — HIGH confidence
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — HIGH confidence (official docs)
- [NN/G Bottom Sheet UX guidelines](https://www.nngroup.com/articles/bottom-sheet/) — HIGH confidence (established UX research org)
- [Coding Horror — Web Discussions: Flat by Design](https://blog.codinghorror.com/web-discussions-flat-by-design/) — MEDIUM confidence; well-known industry argument against nested threading
- [TikTok UI analysis — right-side action bar](https://www.linkedin.com/pulse/why-tiktoks-ui-amazing-uxui-analysis-series-part-1-mesai-memoria) — MEDIUM confidence (industry analysis)
- [YouTube experimenting with comment threading (2025)](https://betanews.com/2025/07/23/youtube-is-experimenting-with-comment-threading/) — MEDIUM confidence; confirms flat is still dominant
- [Supabase useOptimistic pattern](https://dev.to/lra8dev/building-real-time-magic-supabase-subscriptions-in-nextjs-15-2kmp) — MEDIUM confidence; pattern well-established in Next.js 15+
- [Authgear login UX guide 2025](https://www.authgear.com/post/login-signup-ux-guide) — MEDIUM confidence; guest access pattern confirmed

---
*Feature research for: FinFeed v1.2 — Auth, Social, and Profile*
*Researched: 2026-03-23*
