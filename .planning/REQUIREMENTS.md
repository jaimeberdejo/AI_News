# Requirements: FinFeed

**Defined:** 2026-03-23
**Core Value:** A finite, curated daily briefing in vertical video format — users always know when they're done.

## v1.2 Requirements

Requirements for the Social + Accounts milestone. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User can sign in with existing email/password account
- [x] **AUTH-03**: User can reset password via email link
- [x] **AUTH-04**: User can sign in with Google OAuth
- [x] **AUTH-05**: User session persists across browser refresh and PWA close/reopen
- [x] **AUTH-06**: Guest users can browse the full feed without signing in
- [x] **AUTH-07**: Tapping a social action (like/comment/bookmark) as a guest shows a sign-in bottom sheet

### Social Interactions

- [x] **SOCL-01**: User can like a video (tap to like; tap again to unlike)
- [x] **SOCL-02**: Like count is visible to all users including guests
- [x] **SOCL-03**: User can bookmark a video to save for later
- [x] **SOCL-04**: User can remove a bookmark

### Comments

- [ ] **COMM-01**: User can post a flat comment on a video (no nested replies)
- [ ] **COMM-02**: User can delete their own comment
- [ ] **COMM-03**: Comment shows author display name and avatar
- [ ] **COMM-04**: Comments are rate-limited (max 1 per 30s) and capped at 500 characters

### Profile

- [ ] **PROF-01**: User can set a display name (editable after signup)
- [ ] **PROF-02**: User can upload a profile photo (avatar)
- [ ] **PROF-03**: User can view all their liked videos in a profile tab
- [ ] **PROF-04**: User can view all their saved/bookmarked videos in a profile tab

## Future Requirements (v1.3+)

### Authentication

- **AUTH-F01**: Apple Sign In — deferred; requires Apple Developer account ($99/yr) + 6-month key rotation ops task
- **AUTH-F02**: Email OTP (6-digit code) as iOS PWA standalone fallback — deferred; AUTH-01 email/password covers the immediate need

### Social

- **SOCL-F01**: User can reply to comments (one level of nesting) — deferred; flat comments first
- **SOCL-F02**: User can report a comment — deferred; low-volume app doesn't need this at launch

### Notifications

- **NOTF-01**: User receives in-app notification when someone comments on a video they liked
- **NOTF-02**: Push notifications for new daily edition

### Profile

- **PROF-F01**: Watch history — auto-logged list of videos watched; deferred to v1.3+
- **PROF-F02**: User can follow other users — not in scope for FinFeed's finite feed model

## Out of Scope (v1.2)

| Feature | Reason |
|---------|--------|
| Apple Sign In | Requires Apple Developer account + 6-month key rotation; defer to v1.3 |
| Nested/threaded comments | Anti-pattern on mobile — flat comments are simpler and better UX |
| Watch history | Not selected for v1.2 scope |
| Following other users | Not aligned with FinFeed's curated finite feed model |
| Realtime like counts | Supabase free tier: 200 concurrent connections; optimistic UI is sufficient |
| Comment moderation dashboard | Low-volume app; rate limiting + length cap sufficient for v1.2 |
| Monetization | Validation phase only |
| Native mobile app | PWA web-first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 7 | Complete |
| AUTH-02 | Phase 7 | Complete |
| AUTH-03 | Phase 7 | Complete |
| AUTH-04 | Phase 7 | Complete |
| AUTH-05 | Phase 7 | Complete |
| AUTH-06 | Phase 8 | Complete |
| AUTH-07 | Phase 8 | Complete |
| SOCL-01 | Phase 9 | Complete |
| SOCL-02 | Phase 9 | Complete |
| SOCL-03 | Phase 9 | Complete |
| SOCL-04 | Phase 9 | Complete |
| COMM-01 | Phase 10 | Pending |
| COMM-02 | Phase 10 | Pending |
| COMM-03 | Phase 10 | Pending |
| COMM-04 | Phase 10 | Pending |
| PROF-01 | Phase 11 | Pending |
| PROF-02 | Phase 11 | Pending |
| PROF-03 | Phase 11 | Pending |
| PROF-04 | Phase 11 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 — traceability filled after roadmap creation*
