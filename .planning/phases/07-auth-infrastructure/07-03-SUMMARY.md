---
phase: 07-auth-infrastructure
plan: 03
subsystem: auth
tags: [supabase, resend, smtp, google-oauth, google-cloud, oauth2, redirect-urls]

# Dependency graph
requires:
  - phase: 07-01
    provides: middleware + createClient() SSR factories
  - phase: 07-02
    provides: auth routes (/auth/callback, /auth/confirm) and Server Actions that consume external service config
provides:
  - Resend custom SMTP configured in Supabase — bypasses 3 email/hr free-tier rate limit
  - Google OAuth provider enabled in Supabase with Client ID + Client Secret
  - Redirect URLs registered for localhost, production, and Vercel preview wildcard
  - End-to-end smoke test passed — all five auth flows verified working
affects:
  - 08-auth-ui
  - 09-social
  - 10-comments

# Tech tracking
tech-stack:
  added:
    - Resend (external SMTP relay — smtp.resend.com:587)
    - Google Cloud OAuth 2.0 (external OAuth provider)
  patterns:
    - Supabase custom SMTP via Resend API key as SMTP password (username "resend", host smtp.resend.com, port 587)
    - Google OAuth credentials (Client ID + Secret) entered in Supabase Dashboard — not in codebase
    - Supabase redirect URLs use wildcard pattern https://*-autonews-ai.vercel.app/** to cover preview deploys

key-files:
  created: []
  modified: []

key-decisions:
  - "Resend chosen for custom SMTP — free tier 3,000 emails/month vs Supabase free-tier 3 OTP emails/hour; replaces blocker from 07-02"
  - "Google Cloud project scoped to FinFeed/AutoNews with External user type and test users added for development phase"
  - "Three redirect URL patterns registered: localhost wildcard, production URL, Vercel preview wildcard — covers all deployment environments"

patterns-established:
  - "External service config pattern: OAuth credentials stored only in provider dashboards, never committed to repo"

requirements-completed: [AUTH-04]

# Metrics
duration: human-action (no code execution time)
completed: 2026-03-24
---

# Phase 7 Plan 03: External Service Configuration and Smoke Test Summary

**Resend custom SMTP and Google OAuth configured in Supabase, with Google Cloud OAuth credentials created — all five end-to-end auth flows verified passing in the smoke test**

## Performance

- **Duration:** Human-action plan — no automated execution time
- **Started:** 2026-03-24
- **Completed:** 2026-03-24
- **Tasks:** 3 (all checkpoint:human-action / checkpoint:human-verify)
- **Files modified:** 0 (external dashboard configuration only)

## Accomplishments
- Resend account created, API key generated, and custom SMTP configured in Supabase Authentication → SMTP Settings — replaces the 3 OTP emails/hour free-tier rate limit that was a documented blocker since plan 07-02
- Google Cloud OAuth 2.0 Client ID and Client Secret created for FinFeed project, pasted into Supabase Authentication → Providers → Google, enabling the signInWithGoogle Server Action from plan 07-02
- Redirect URLs registered in Supabase URL Configuration covering all three deployment environments (localhost, production, Vercel preview wildcard); Site URL set to https://autonews-ai.vercel.app
- End-to-end smoke test passed: email sign-up, profile auto-creation trigger, Google OAuth redirect flow, session persistence across hard refresh, and existing feed regression all verified

## Task Commits

This plan contained no code changes — all tasks were external dashboard configuration.

No per-task commits were created.

## Files Created/Modified

None — this plan was exclusively external service configuration in third-party dashboards:
- Supabase Dashboard: Authentication → SMTP Settings (Resend config)
- Supabase Dashboard: Authentication → Providers → Google (OAuth credentials)
- Supabase Dashboard: Authentication → URL Configuration (redirect URLs + Site URL)
- Google Cloud Console: APIs & Services → Credentials → OAuth 2.0 Client ID

## Decisions Made
- **Resend over SendGrid** — both were listed as options; Resend's 3,000/month free tier and simpler API key SMTP setup favored for this stage
- **External user type for Google Cloud OAuth consent screen** — required for use outside the Google Workspace org; test users added to allow development-phase login before app verification
- **Wildcard redirect URL patterns** — `https://*-autonews-ai.vercel.app/**` covers all Vercel preview deploy URLs without requiring per-deployment URL registration

## Deviations from Plan

None - plan executed exactly as written. All tasks were human-action checkpoints; no automated code execution occurred.

## Issues Encountered

None — all three external service configurations completed successfully and the smoke test passed on first attempt.

## User Setup Required

All configuration in this plan was user setup. The following services are now configured:

**Resend (smtp.resend.com)**
- Custom SMTP enabled in Supabase Authentication → SMTP Settings
- Host: smtp.resend.com, Port: 587, Username: resend
- Sender: configured with Resend API key as password

**Google Cloud Console**
- OAuth 2.0 Client ID created for FinFeed Web application
- Authorized JavaScript origins: localhost + autonews-ai.vercel.app
- Authorized redirect URI: Supabase project auth callback URL

**Supabase**
- Google provider enabled with Client ID + Client Secret
- Redirect URLs: localhost wildcard, production, Vercel preview wildcard
- Site URL: https://autonews-ai.vercel.app

## Next Phase Readiness
- Phase 7 auth infrastructure is complete — all code (07-01, 07-02) and external services (07-03) are in place
- Phase 8 auth UI can be built with confidence that all auth flows work end-to-end
- Blockers resolved:
  - Supabase email rate limit — RESOLVED (Resend custom SMTP now active)
  - Google OAuth not configured — RESOLVED (provider enabled, credentials set)
- Remaining concern (carried forward): iOS PWA OAuth must be tested on a real device before Phase 9 social features build on top of auth

---
*Phase: 07-auth-infrastructure*
*Completed: 2026-03-24*
