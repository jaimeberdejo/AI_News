# Phase 8: Auth UI + iOS Validation - Research

**Researched:** 2026-03-24
**Domain:** React bottom sheet UI, Supabase auth state on client, iOS PWA OAuth redirect, Next.js 16 App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bottom Sheet Design**
- Slides up over the video with a semi-transparent dark overlay behind it
- Half-screen height (~50% of viewport)
- Drag handle (pill) at the top — swipe down or tap overlay to dismiss
- Contextual headline that changes based on the action tapped (e.g. "Sign in to like this", "Sign in to bookmark")
- No supporting copy or value prop — just the headline and the sign-in button

**Sign-in Options**
- Google only — single "Continue with Google" button
- Official Google branding (white button with Google logo)
- No email/password form in this phase

**Post-auth Return Behavior**
- After sign-in, sheet closes and user returns to exactly the same video they were watching
- No automatic action completion — user taps the social button again (now signed in)
- No toast or visual feedback — silent success, signed-in state speaks for itself

**Guest Experience**
- Social action buttons (like, bookmark, comment) are fully visible to guests
- Tapping any social button triggers the sign-in bottom sheet
- Zero other prompts — no banners, no nudges, no engagement-gated prompts
- Like counts and social counts are visible to guests (feels alive)

**iOS PWA Compatibility**
- OAuth must use `window.location.href` (not `window.open`) per the pattern established in Phase 7 Server Actions

### Claude's Discretion
- Exact overlay opacity and animation timing
- Sheet corner radius and shadow
- Spacing and typography inside the sheet
- How the "same video" scroll position is preserved across the OAuth redirect

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-06 | Guest users can browse the full feed without signing in | No auth check in feed path; Server Component reads session but does NOT gate content; VideoFeed renders unconditionally |
| AUTH-07 | Tapping a social action (like/comment/bookmark) as a guest shows a sign-in bottom sheet | Bottom sheet component controlled by React state; social action buttons pass action type to trigger; guest detection via `createBrowserClient` + `getUser()` |
</phase_requirements>

---

## Summary

Phase 8 has three distinct technical problems: (1) detecting guest vs. authenticated state on the client without blocking the feed, (2) building a bottom sheet UI component from scratch (no external library — project uses zero component libraries), and (3) preserving the active video scroll position across a full OAuth redirect cycle so the user returns to exactly where they left off.

The existing `signInWithGoogle()` Server Action already returns `{ url }` without calling `redirect()` server-side — this is the critical iOS PWA compatibility decision from Phase 7. The bottom sheet Client Component calls this action and does `window.location.href = url`. The OAuth callback at `/auth/callback/route.ts` already exists and works. The remaining gap is: passing a `?next=/` param through the OAuth flow so the callback redirects back to the exact video position, and reading client-side auth state to know whether to show the sheet.

The "same video" scroll preservation problem has a clean solution: encode the active `videoIndex` as a URL hash fragment or query parameter in the `redirectTo` URL passed to `signInWithGoogle()`. The `/auth/callback` route already reads a `next` param and redirects to it. On return, the Client Component reads the URL param and restores `scrollTop` to `index * clientHeight`. No session storage or localStorage needed.

**Primary recommendation:** Build the bottom sheet as a zero-dependency React Client Component using inline styles (matching the project's existing pattern). Detect auth state with `createBrowserClient().getUser()` called once on mount in a `useAuthStore` hook. Preserve video position via `?videoIndex=N` in the OAuth `redirectTo` URL, read with `useSearchParams` on return.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (built-in) | 19.2.3 | Bottom sheet state (open/closed, action type) | Already in project |
| `@supabase/ssr` `createBrowserClient` | ^0.9.0 | Client-side auth state check (`getUser()`) | Already installed; the correct SSR-aware browser client |
| Next.js `useSearchParams` | 16.1.6 | Read `?videoIndex=` on OAuth return | Built-in, no install |
| CSS `transform: translateY` + `transition` | — | Bottom sheet slide-up animation | No library; project uses inline styles throughout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` `useRouter` | 16.1.6 | Remove `?videoIndex` from URL after restoring position (clean URL) | After scroll restoration on OAuth return |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom bottom sheet (inline styles) | `@radix-ui/react-dialog` or `vaul` | External libs add bundle weight; project uses zero component libs; custom sheet is ~60 lines |
| `?videoIndex=N` in redirectTo | `sessionStorage` | sessionStorage is wiped in iOS PWA standalone mode after OAuth redirect; URL param survives |
| `localStorage` for video index | URL param | localStorage persists but is asynchronous and requires an explicit cleanup step |

**Installation:** No new packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── components/
│   ├── AuthBottomSheet.tsx     # NEW — bottom sheet UI + Google sign-in trigger
│   └── VideoFeed.tsx           # MODIFIED — add guest state, social buttons, sheet trigger
├── hooks/
│   └── useAuth.ts              # NEW — browser-side auth state (isGuest, user)
└── app/
    └── auth/
        └── callback/
            └── route.ts        # EXISTING — already handles ?next= param
```

### Pattern 1: Client-Side Auth State (useAuth hook)

**What:** A custom hook that calls `createBrowserClient().getUser()` once on mount and exposes `{ user, isGuest, loading }`. Used by VideoFeed to decide whether to show the bottom sheet or allow social actions.

**When to use:** Any Client Component that needs to gate behavior on auth state without blocking the feed render.

**Example:**
```typescript
// Source: pattern from Supabase docs + lib/supabase/client.ts
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<null | object>(undefined as any) // undefined = loading

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
    // Listen for auth state changes (e.g., after OAuth return to same page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    isGuest: user === null,
    loading: user === undefined,
  }
}
```

**Key:** `onAuthStateChange` handles the case where the user returns from OAuth and the page is the same SPA instance. `getUser()` handles the initial load. The `SIGNED_IN` event fires after the callback route redirects back to `/`.

### Pattern 2: Bottom Sheet Component

**What:** A `'use client'` component that receives `isOpen`, `onClose`, `actionLabel` (e.g. "like this"), and an `onSignIn` callback. Renders a fixed overlay + sliding panel.

**When to use:** Rendered once inside `VideoFeed`, controlled by a single `sheetAction` state (`null` = closed, `'like' | 'bookmark' | 'comment'` = open with contextual headline).

**Example (structure):**
```typescript
// Source: inline styles pattern consistent with existing VideoFeed.tsx + VideoItem.tsx
'use client'

interface AuthBottomSheetProps {
  isOpen: boolean
  actionLabel: string  // "like this" | "bookmark this" | "comment"
  onClose: () => void
  onSignIn: () => void
}

export function AuthBottomSheet({ isOpen, actionLabel, onClose, onSignIn }: AuthBottomSheetProps) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '430px',
          margin: '0 auto',
          height: '50vh',
          background: '#1a1a1a',
          borderRadius: '20px 20px 0 0',
          zIndex: 101,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        {/* Headline: `Sign in to ${actionLabel}` */}
        {/* Google button */}
      </div>
    </>
  )
}
```

**Key notes:**
- `cubic-bezier(0.32, 0.72, 0, 1)` is the standard iOS-style spring curve for bottom sheets
- `maxWidth: '430px'` + `margin: '0 auto'` matches the feed container geometry
- `paddingBottom: 'env(safe-area-inset-bottom)'` required for iPhone home-bar clearance

### Pattern 3: Video Position Preservation Across OAuth Redirect

**What:** Encode `activeIndex` into the OAuth `redirectTo` URL so the callback route returns the user to the right video. On return, read with `useSearchParams` and restore scroll.

**Flow:**
1. User taps social button while at `activeIndex = 3`
2. Sheet opens; user taps "Continue with Google"
3. Client calls `signInWithGoogle()` Server Action
4. **The Server Action already accepts `redirectTo`** — but currently hardcodes `/auth/callback`. Need to pass `?next=/?videoIndex=3` through the OAuth `redirectTo` param.
5. `/auth/callback/route.ts` already reads `next` and redirects to it.
6. On return to `/?videoIndex=3`, VideoFeed reads `useSearchParams().get('videoIndex')`, calls `feedRef.current.scrollTop = index * feedRef.current.clientHeight`, then replaces URL to remove the param.

**Required change to `signInWithGoogle`:**
```typescript
// Pass the return path to the Server Action
export async function signInWithGoogle(returnPath: string = '/'): Promise<{ url: string }> {
  // ...
  redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
  // ...
}
```

**Client call site:**
```typescript
const { url } = await signInWithGoogle(`/?videoIndex=${activeIndex}`)
window.location.href = url
```

**On return:**
```typescript
// In VideoFeed useEffect, after videos load
const searchParams = useSearchParams()
const returnIndex = searchParams.get('videoIndex')
if (returnIndex !== null && feedRef.current) {
  const idx = parseInt(returnIndex, 10)
  feedRef.current.scrollTop = idx * feedRef.current.clientHeight
  setActiveIndex(idx)
  router.replace('/', { scroll: false }) // clean URL
}
```

**Confidence:** HIGH — `/auth/callback/route.ts` already implements `next` param handling. `useSearchParams` is standard Next.js 16. `sessionStorage` is explicitly ruled out because iOS PWA standalone context loses storage state on OAuth redirect.

### Pattern 4: Social Buttons on VideoItem (stub)

**What:** Like, bookmark, and comment buttons in VideoItem's info panel. In Phase 8 they are stubs — no actual social functionality, just enough to trigger the auth sheet. Phase 9 wires them to real mutations.

**What to build:** Three icon buttons in the info panel area. Each calls an `onSocialAction` prop with action type. VideoFeed intercepts, checks `isGuest`, shows sheet if guest, no-ops or calls stub handler if signed in.

**Anti-pattern to avoid:** Do NOT gate the button render on auth state. Buttons are always visible (per locked decision). Only the tap handler checks auth.

### Anti-Patterns to Avoid

- **`window.open()` for OAuth:** Broken in iOS PWA standalone. Always use `window.location.href = url`.
- **`sessionStorage` for video position:** iOS PWA OAuth redirect clears session storage. Use URL params.
- **Calling `getSession()` instead of `getUser()`:** `getSession()` reads from local storage and can return stale data; `getUser()` makes a network request to validate with Supabase. For security-gated decisions, use `getUser()`. For display-only state (like showing/hiding the sheet), `getSession()` is acceptable but `getUser()` is safer.
- **Blocking feed render on auth state:** `useAuth` starts as `loading` (undefined user). VideoFeed renders the feed immediately. Social buttons are always visible. The auth check only fires when a button is tapped.
- **Putting the bottom sheet inside VideoItem:** It should live in VideoFeed (one instance) — VideoItem is a pure layout component with no hooks (existing architecture constraint from Phase 6).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state subscription | Custom cookie-reading logic | `createBrowserClient().auth.onAuthStateChange()` | Handles token refresh, cross-tab sync, session expiry automatically |
| iOS PWA OAuth | `window.open` popup approach | `window.location.href` redirect | Popups are blocked/broken in WKWebView/PWA standalone |
| Video position on OAuth return | Complex state machine | `?videoIndex=N` URL param via existing `next` param mechanism | Callback route already handles `next`; zero new infrastructure |

**Key insight:** The hard problems (session management, OAuth PKCE, cookie refresh) are already solved by Phase 7. Phase 8 is entirely UI + a small data-passing extension to the existing flow.

---

## Common Pitfalls

### Pitfall 1: iOS PWA Standalone — `window.open` Silently Fails
**What goes wrong:** `window.open(url)` returns `null` in iOS PWA standalone mode. The OAuth flow never starts. No error is thrown.
**Why it happens:** WKWebView in standalone PWA mode blocks `window.open` for navigation to external origins.
**How to avoid:** Always use `window.location.href = url` for OAuth initiation. This is already established as a project decision from Phase 7 (`signInWithGoogle` returns `{ url }` not a redirect).
**Warning signs:** OAuth works in Safari but not when "Add to Home Screen" PWA is used.

### Pitfall 2: `getUser()` Async — Sheet Shows Briefly on Load
**What goes wrong:** `useAuth` starts with `loading: true`. If a social button is tapped before `getUser()` resolves, the tap handler doesn't know if the user is a guest.
**Why it happens:** Network call takes 100–300ms.
**How to avoid:** Disable social button tap handler while `loading === true` (use `loading` state to debounce). Or: treat `loading` as guest for the purposes of showing the sheet — worst case is a guest who completes OAuth sees the sheet close immediately after auth state resolves.
**Warning signs:** Quick tap on social button immediately after page load triggers the sheet even when signed in.

### Pitfall 3: `onAuthStateChange` SIGNED_IN Fires on Every Tab Focus
**What goes wrong:** Per Supabase docs, `SIGNED_IN` fires each time a session is re-established, including on tab refocus. If VideoFeed responds to this by closing the sheet, it could close unexpectedly.
**Why it happens:** Supabase emits cross-tab auth events.
**How to avoid:** Only respond to `SIGNED_IN` when the sheet is open (`sheetAction !== null`). Close the sheet and clear `?videoIndex=` param only on `SIGNED_IN` during an active sign-in flow.

### Pitfall 4: Bottom Sheet `maxWidth` Mismatch
**What goes wrong:** The bottom sheet is full-width on desktop, extending past the 430px video feed width.
**Why it happens:** Forgetting the feed container's `maxWidth: '430px'` + `margin: '0 auto'` constraint.
**How to avoid:** Apply `maxWidth: '430px'` + `margin: '0 auto'` on the sheet panel itself (same values as VideoFeed's outer container).

### Pitfall 5: `?videoIndex=` Param Leaks into URL After Return
**What goes wrong:** User returns from OAuth to `/?videoIndex=3`. URL stays dirty in the browser history.
**Why it happens:** Forgetting to clean up the URL param after reading it.
**How to avoid:** After scroll restoration, call `router.replace('/', { scroll: false })` to remove the param without triggering a scroll jump.

### Pitfall 6: Social Buttons Break VideoItem's Pure Layout Contract
**What goes wrong:** Adding `onSocialAction` callbacks with hooks inside VideoItem creates stale closure / IntersectionObserver issues (same class of bug that was fixed in Phase 6).
**Why it happens:** VideoItem is intentionally hook-free — play/pause is driven by VideoFeed's scroll effect.
**How to avoid:** Social buttons live in VideoItem as pure prop callbacks (`onSocialAction?: (action: 'like' | 'bookmark' | 'comment') => void`). All state and logic stays in VideoFeed.

---

## Code Examples

### Google Sign-In Button (Official Branding)
```typescript
// Source: Google Brand Guidelines — white button with Google logo SVG
// Official Google colors: background #fff, border #dadce0, text #3c4043
<button
  onClick={onSignIn}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    border: '1px solid #dadce0',
    borderRadius: '4px',
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#3c4043',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    width: '100%',
    justifyContent: 'center',
  }}
>
  {/* Google 'G' SVG logo */}
  Continue with Google
</button>
```

### onAuthStateChange with Cleanup
```typescript
// Source: Supabase JS docs (context7 /websites/supabase)
useEffect(() => {
  const supabase = createClient()
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null)
    if (event === 'SIGNED_IN' && sheetOpenRef.current) {
      // close sheet after successful OAuth return
      setSheetAction(null)
    }
  })
  return () => subscription.unsubscribe()
}, [])
```

### Passing `?next=` Through OAuth Redirect
```typescript
// Extends existing signInWithGoogle Server Action — add returnPath parameter
// Source: existing app/auth/actions.ts + Supabase OAuth callback pattern
export async function signInWithGoogle(returnPath: string = '/'): Promise<{ url: string }> {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
    },
  })

  if (error || !data.url) throw new Error(error?.message ?? 'OAuth URL missing')
  return { url: data.url }
}
```

### Scroll Restoration on OAuth Return
```typescript
// In VideoFeed useEffect — runs after videos array is populated
// Source: existing feedRef + scrollTop pattern from VideoFeed.tsx
const searchParams = useSearchParams()
const router = useRouter()

useEffect(() => {
  const idx = searchParams.get('videoIndex')
  if (idx !== null && feedRef.current && videos.length > 0) {
    const target = parseInt(idx, 10)
    if (!isNaN(target) && target < videos.length) {
      feedRef.current.scrollTop = target * feedRef.current.clientHeight
      setActiveIndex(target)
    }
    router.replace('/', { scroll: false })
  }
}, [videos.length]) // run once after videos load
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.open()` for OAuth | `window.location.href` redirect | iOS 16+ WKWebView in standalone mode | Hard requirement for iOS PWA |
| `getSession()` for auth check | `getUser()` for security-sensitive checks | Supabase v2 | `getUser()` validates with server; `getSession()` trusts local storage |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Deprecated ~2024 | `@supabase/ssr` is the current standard — already in this project |

---

## Open Questions

1. **`useSearchParams` in VideoFeed requires Suspense boundary**
   - What we know: Next.js 16 requires a `<Suspense>` wrapper for components using `useSearchParams` in statically rendered routes (to avoid full-page client render)
   - What's unclear: `page.tsx` (Home) is a Server Component. VideoFeed is a Client Component. The requirement to wrap with Suspense applies if VideoFeed is statically rendered — but since `page.tsx` fetches data with `cache: 'no-store'`, this page is already dynamically rendered.
   - Recommendation: Add a `<Suspense fallback={null}>` wrapper around VideoFeed in `page.tsx` as a precaution. It adds no user-visible cost.

2. **Auth error page `/auth/auth-error`**
   - What we know: `app/auth/callback/route.ts` already redirects to `/auth/auth-error` on failed OAuth exchange. This page doesn't exist yet.
   - What's unclear: Phase 7 noted this is Phase 8's responsibility (comment in the route file).
   - Recommendation: Create a minimal `/auth/auth-error/page.tsx` in Phase 8 — a simple "Sign-in failed" screen with a retry link back to `/`.

3. **Swipe-to-dismiss gesture on bottom sheet**
   - What we know: The locked decision says "swipe down to dismiss." Pure CSS/pointer events can implement this with `pointermove` + `pointerup`.
   - What's unclear: Touch gesture handling on the drag handle vs. sheet body — need to decide whether to implement full drag gesture or tap-handle-to-dismiss only.
   - Recommendation: For Phase 8, implement tap-overlay-to-dismiss and a close button on the handle. Drag gesture is optional enhancement within Claude's discretion — adds ~40 lines but improves feel significantly on iOS.

---

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js/v16.1.6` (Context7) — `useSearchParams`, Server/Client Component patterns, OAuth callback handler
- `/websites/supabase` (Context7) — `onAuthStateChange` event reference, `getUser` vs `getSession` semantics
- `frontend/app/auth/actions.ts` (project file) — existing `signInWithGoogle` Server Action signature
- `frontend/app/auth/callback/route.ts` (project file) — existing `?next=` param handling
- `frontend/components/VideoFeed.tsx` (project file) — existing `feedRef`, `scrollTop`, `activeIndex` patterns

### Secondary (MEDIUM confidence)
- Supabase docs on `SIGNED_IN` event behavior across tabs — verified via Context7
- Google Brand Guidelines (official branding colors) — consistent with widely-documented white button spec

### Tertiary (LOW confidence)
- iOS PWA `sessionStorage` behavior during OAuth redirect — known community pattern but not formally documented by Apple; consistent with `window.open` restriction and WKWebView standalone mode behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already in project
- Architecture: HIGH — patterns derived directly from existing codebase + verified Context7 docs
- Pitfalls: HIGH (iOS PWA) / MEDIUM (subtle scroll restoration edge cases) — iOS PWA `window.open` behavior is well-established; sessionStorage wipe is LOW (community-sourced) but cross-referenced with known WKWebView constraints

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable APIs — `@supabase/ssr`, Next.js 16, no fast-moving dependencies)
