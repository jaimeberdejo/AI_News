# Phase 13: Demo Auth Simplification - Research

**Researched:** 2026-04-07
**Domain:** Supabase Auth (email/password), Next.js Server Actions, React form UI
**Confidence:** HIGH

## Summary

The registration flow currently lives in two places: the `/auth/login` page (a full-page sign-in-only screen) and the `AuthBottomSheet` component (a slide-up sheet triggered from the video feed for guest-gated social actions). Both surfaces only offer Google OAuth and have no email+password registration path. Demo users who lack or don't want to use a Google account are blocked at this step.

The critical insight is that `actions.ts` already contains a fully functional `signUp(formData)` Server Action (written in Phase 7 as `AUTH-01`) that calls `supabase.auth.signUp` with email+password and returns a "check your email" confirmation message. The Server Action is already wired to `/auth/confirm` via `emailRedirectTo`. The backend infrastructure — Supabase email signUp, the `handle_new_user` trigger that auto-creates a `profiles` row, and the confirm route — all exist and are tested. Nothing new needs to be built at the database or API layer.

The task for Phase 13 is exclusively a **UI change**: replace the Google OAuth button on the registration surface(s) with an email + password + confirm-password form, while leaving Google OAuth available as the sign-in path for existing users. The scope is intentionally narrow — the `/auth/login` page (where profile navigation lands) is the primary target. The `AuthBottomSheet` guest gate may also benefit from a registration tab, but that is a secondary concern.

**Primary recommendation:** Add a tabbed or dual-mode UI to `/auth/login` — "Sign In" tab (Google OAuth, existing) and "Register" tab (email + password + confirm-password form calling the existing `signUp` action). Use the already-established inline style pattern (no Tailwind classes), match the dark-background aesthetic of `update-password/page.tsx`, and validate passwords match client-side before calling the Server Action.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.97.0 | `signUp()` Server Action already calls this | Already installed, `signUp` action already implemented |
| @supabase/ssr | ^0.9.0 | Cookie-based SSR sessions | Already installed, required by middleware pattern |
| next | 16.1.6 | Server Actions, App Router | Already installed |
| react | 19.2.3 | Client Component form state | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | No new dependencies needed | Everything required is already present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline styles (project pattern) | Tailwind CSS classes | Project uses inline styles throughout all auth pages — stay consistent |
| Tab switch UI (sign-in vs register) | Separate /auth/register route | Separate route adds navigation complexity; tab switch keeps one URL, feels simpler for demo |
| Server Action (existing pattern) | Route Handler | Server Actions already used for all auth mutations — stay consistent |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/app/auth/
├── login/
│   └── page.tsx          # MODIFY: add Register tab with email+password form
├── actions.ts            # NO CHANGE: signUp() already exists
├── confirm/route.ts      # NO CHANGE: handles email verification link
├── callback/route.ts     # NO CHANGE: handles OAuth callback
├── update-password/      # NO CHANGE
└── auth-error/           # NO CHANGE
frontend/components/
└── AuthBottomSheet.tsx   # OPTIONAL: add "Create account" link/tab for guests
```

### Pattern 1: Tab-Switch Registration UI on /auth/login

**What:** Convert the login page from a single Google-OAuth-only screen to a two-tab screen — "Sign in" (Google OAuth) and "Create account" (email + password + confirm-password form). Tabs are local React state (no router push).

**When to use:** Any time two distinct auth modes share the same page context.

**Example:**
```tsx
// Source: update-password/page.tsx (project pattern) + actions.ts (existing signUp)
'use client'

import { useState } from 'react'
import { signInWithGoogle, signUp } from '@/app/auth/actions'

type Tab = 'signin' | 'register'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('register')  // default to register for demo UX
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    try {
      const result = await signUp(formData)
      setSuccess(result.message)  // "Check your email to confirm your account."
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  // ... render tabs + form
}
```

### Pattern 2: Client-Side Validation Before Server Action

**What:** Validate passwords match and meet minimum length on the client before invoking the Server Action. Mirrors the pattern already used in `update-password/page.tsx`.

**When to use:** Any form with a confirm-password field.

```tsx
// Source: frontend/app/auth/update-password/page.tsx (lines 18-28) — identical pattern
if (password.length < 8) {
  setError('Password must be at least 8 characters.')
  return
}
if (password !== confirm) {
  setError('Passwords do not match.')
  return
}
```

### Pattern 3: Post-Registration Success State (No Redirect)

**What:** After a successful `signUp()` call, show a "Check your email" message in-page rather than redirecting. The `signUp` Server Action already returns `{ message: string }` for this purpose.

**When to use:** Email+password signup with confirmation flow — user must click email link before session exists.

```tsx
if (success) {
  return (
    <div style={{ color: 'white', textAlign: 'center', padding: '32px 24px' }}>
      <p style={{ fontSize: '1rem', fontWeight: 600 }}>{success}</p>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: 8 }}>
        Check your inbox and click the link to activate your account.
      </p>
    </div>
  )
}
```

### Pattern 4: Input Field Styling (Project Standard)

**What:** Dark-background input fields matching the existing `update-password/page.tsx` design. No Tailwind class names — pure inline styles.

```tsx
// Source: frontend/app/auth/update-password/page.tsx (lines 86-104)
<input
  type="email"
  name="email"
  required
  style={{
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    color: '#ffffff',
    padding: '12px 16px',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  }}
/>
```

### Anti-Patterns to Avoid

- **Calling `signUp` without client-side password validation:** The Server Action will surface a Supabase error for mismatched passwords, but the error message is less user-friendly than a local check. Always validate client-side first.
- **Using `window.location.href` for registration redirect:** Registration does NOT need a redirect — the `signUp` action returns a message. Only `signInWithGoogle` requires `window.location.href` (iOS PWA reason, not applicable here).
- **Removing Google OAuth from the sign-in tab:** The goal is to simplify REGISTRATION. Existing users sign in via Google. Keep Google OAuth on the sign-in tab unchanged.
- **Using Tailwind classes:** All existing auth pages use inline styles. Mixing in Tailwind breaks visual consistency.
- **Creating a new `/auth/register` route:** Adds navigation complexity. One URL with two tabs is simpler for demo context.
- **Modifying `actions.ts`:** The `signUp` Server Action is already correct and tested. Do not touch it.
- **Touching `middleware.ts` or supabase client config:** The session handling, cookie plumbing, and `handle_new_user` trigger already handle email signups correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email+password registration API | Custom route handler | `signUp()` in `actions.ts` (already exists) | Already implemented, tested, wired to `/auth/confirm` |
| Email confirmation flow | Custom token verification | `/auth/confirm/route.ts` (already exists) | Already handles `token_hash` + `verifyOtp` |
| Profile row creation on signup | INSERT in signup action | `handle_new_user` DB trigger (already exists) | Trigger fires automatically on every `auth.users` insert, including email signups |
| Password confirmation validation | Library | Inline comparison (< 5 lines) | Already established pattern in `update-password/page.tsx` |

**Key insight:** The entire backend for email+password registration was built in Phase 7. Phase 13 is a pure UI task — the only code that needs to be written is a modified `/auth/login/page.tsx`.

## Common Pitfalls

### Pitfall 1: Email Confirmation Requirement
**What goes wrong:** Developer assumes that after `signUp()` the user is immediately signed in and redirects to `/`. The user sees no session.
**Why it happens:** Supabase email signups require email confirmation by default. The `signUp` action correctly returns `{ message }` instead of redirecting — but the UI must display that message rather than expecting a session.
**How to avoid:** Show the `result.message` string ("Check your email to confirm your account.") in a success state. Do not redirect. Do not call `redirect('/')` after `signUp`.
**Warning signs:** User registers, page redirects to `/`, user appears as guest — they never clicked the confirmation email.

### Pitfall 2: Stripping Google OAuth from Both Tabs
**What goes wrong:** Developer removes Google OAuth entirely from the login page, breaking sign-in for existing users who registered via Google.
**Why it happens:** Misreading the requirement. The goal is to replace REGISTRATION with email+password, not to remove Google OAuth entirely.
**How to avoid:** Keep the Google OAuth button on the "Sign in" tab. Only the "Create account" tab is new. Existing `/auth/login` Google sign-in flow must remain untouched.
**Warning signs:** `signInWithGoogle('/profile')` call removed from `LoginPage`.

### Pitfall 3: AuthBottomSheet Missing Registration Path
**What goes wrong:** Guest users tap a social action (like, bookmark, comment), see the bottom sheet, hit "Continue with Google" which is the only option, and are still blocked from registering without Google.
**Why it happens:** `AuthBottomSheet` also only has Google OAuth — it's a second registration surface.
**How to avoid:** Consider whether `AuthBottomSheet` also needs a "Create account" path. Options: (a) add a small "Create account" link below the Google button that navigates to `/auth/login?tab=register`, or (b) embed a full mini-register form. Option (a) is minimal and safe.
**Warning signs:** Demo users can register from `/auth/login` but not from the in-feed social action gate.

### Pitfall 4: Supabase `email_confirm` Setting
**What goes wrong:** Users register, never receive a confirmation email, and cannot sign in.
**Why it happens:** The Supabase project's "Confirm email" setting in Authentication > Providers > Email controls this. If enabled (default), users must click a link.
**How to avoid:** For a demo context, consider disabling "Confirm email" in the Supabase dashboard so demo users can register and immediately sign in without an email verification step. This is a Supabase project setting, not a code change.
**Warning signs:** User registers, sees "Check your email" message, cannot find an email, gives up.

### Pitfall 5: `profiles` Row Missing Display Name
**What goes wrong:** After email signup, the user's profile page shows no display name.
**Why it happens:** The `handle_new_user` trigger populates `display_name` from `new.raw_user_meta_data ->> 'full_name'`. Google OAuth sets this via OAuth claims. Email signups do NOT set `full_name` in metadata unless explicitly passed via `options.data` in the `signUp` call.
**How to avoid:** Either (a) accept that email-signup users have a null display_name and show a fallback in the profile UI (already handled as `?? 'Anonymous'` in CommentSheet), or (b) optionally add a `display_name` field to the registration form and pass it as `options: { data: { full_name: value } }` in the `signUp` action.
**Warning signs:** Profile page shows blank where name should appear for email-signup users.

## Code Examples

### Existing signUp Server Action (DO NOT MODIFY)
```typescript
// Source: frontend/app/auth/actions.ts (lines 8-26)
export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) throw new Error(error.message)
  return { message: 'Check your email to confirm your account.' }
}
```

### Existing Update-Password Form Pattern (REFERENCE for new form styling)
```tsx
// Source: frontend/app/auth/update-password/page.tsx
// Pattern: controlled form, client-side validation, catch Server Action errors
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setError(null)
  const formData = new FormData(e.currentTarget)
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
  if (password !== confirm) { setError('Passwords do not match.'); return }

  setPending(true)
  try {
    await updatePassword(formData)
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Something went wrong.')
    setPending(false)
  }
}
```

### Existing Google Sign-In Pattern (KEEP ON SIGN-IN TAB)
```tsx
// Source: frontend/app/auth/login/page.tsx (lines 9-18)
// MUST use window.location.href — window.open() is broken in iOS PWA standalone mode
async function handleSignIn() {
  if (signing) return
  setSigning(true)
  try {
    const { url } = await signInWithGoogle('/profile')
    window.location.href = url
  } catch {
    setSigning(false)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single Google-only login page | Tab-switched sign-in + register page | Phase 13 | Demo users can create accounts without Google |
| `window.open()` for OAuth | `window.location.href` for OAuth | Phase 7 | Required for iOS PWA standalone mode — do not regress |
| Direct `redirect()` after signUp | Return `{ message }`, show in UI | Phase 7 (existing) | Email confirmation flow — user must click email link |

**Deprecated/outdated:**
- None — all existing patterns remain valid. Phase 13 adds UI, not replaces infrastructure.

## Open Questions

1. **Should email confirmation be disabled for demo mode?**
   - What we know: Supabase has a project-level "Confirm email" toggle under Authentication > Providers > Email. If disabled, users are signed in immediately after `signUp` and no email is needed.
   - What's unclear: Whether the project wants the frictionless path (disable confirmation) or the secure path (keep confirmation). Disabling confirmation means the `signUp` action would need to `redirect('/')` instead of returning a message.
   - Recommendation: For demo purposes, disabling email confirmation is the lowest-friction path. This is a Supabase dashboard setting change + a small code change to `signUp` (redirect instead of return message). The planner should include this as an optional task or ask the user.

2. **Should `AuthBottomSheet` also get a registration path?**
   - What we know: Guests who hit the social action gate see only Google OAuth. If they want to register via email, they'd need to navigate away.
   - What's unclear: How often demo users trigger social actions before registering.
   - Recommendation: Minimally, add a "Create account with email" link below the Google button in `AuthBottomSheet` that navigates to `/auth/login` (which will now have the Register tab). This is a one-line addition.

3. **Should the registration form include a display name field?**
   - What we know: `handle_new_user` trigger reads `raw_user_meta_data ->> 'full_name'` for the profile display_name. Email signups don't set this automatically.
   - What's unclear: Whether the product wants email-signup users to have a display name on day one.
   - Recommendation: Keep it simple — omit the display name field from registration. Email-signup users will have null display_name initially (shown as "Anonymous" in existing fallbacks). They can set it via the Profile page edit flow.

## Sources

### Primary (HIGH confidence)
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/app/auth/actions.ts` — `signUp` Server Action confirmed implemented (AUTH-01)
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/app/auth/login/page.tsx` — current login page (Google-only)
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/app/auth/update-password/page.tsx` — reference for form+validation pattern
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/app/auth/confirm/route.ts` — email confirm route confirmed working
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/supabase/migrations/20260323000001_add_profiles_and_auth.sql` — `handle_new_user` trigger confirmed
- `/Users/jaimeberdejosanchez/projects/AutoNews_AI/frontend/components/AuthBottomSheet.tsx` — second auth surface identified

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` `[Phase 07-02]` decisions — confirmed `signUp` was built in Phase 7 as AUTH-01, trigger safety, SECURITY DEFINER pattern

### Tertiary (LOW confidence)
- None — all findings are directly from codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — existing patterns fully understood from direct code inspection
- Pitfalls: HIGH — derived from reading actual code + established Phase 7 decisions

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable — no fast-moving dependencies)
