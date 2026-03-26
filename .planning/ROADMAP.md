# Roadmap: FinFeed

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-26) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Multi-Category** — Phases 5-6 (shipped 2026-03-10) — [Archive](milestones/v1.1-ROADMAP.md)
- 🔄 **v1.2 Social + Accounts** — Phases 7-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Pipeline (5/5 plans) — completed 2026-02-25
- [x] Phase 3: Frontend (4/4 plans) — completed 2026-02-25
- [x] Phase 4: Ship (3/3 plans) — completed 2026-02-26

See full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Multi-Category (Phases 5-6) — SHIPPED 2026-03-10</summary>

- [x] Phase 5: Tech Pipeline (2/2 plans) — completed 2026-03-10
- [x] Phase 6: Category UI (1/1 plan) — completed 2026-03-10

See full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 Social + Accounts (Phases 7-11)

- [x] **Phase 7: Auth Infrastructure** — Supabase SSR plumbing, DB schema, Google OAuth + email/password end-to-end
- [x] **Phase 8: Auth UI + iOS Validation** — Login page, AuthModal bottom sheet, guest browsing confirmed, real-device iOS PWA test gate
- [x] **Phase 9: Social Interactions** — Likes, bookmarks schema + API routes + feed overlay UI (completed 2026-03-26)
- [ ] **Phase 10: Comments** — Comment sheet, posting with moderation, author display
- [ ] **Phase 11: Profile Page** — Display name, avatar, liked and saved tabs

## Phase Details

### Phase 7: Auth Infrastructure
**Goal**: Session management is working end-to-end so every downstream feature can trust auth state
**Depends on**: Nothing (first v1.2 phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A new user can create an account with email and password and land on the feed still signed in
  2. An existing user can sign in with email/password and their session survives a browser refresh and PWA close/reopen
  3. A user can sign in with Google OAuth and land back on the feed with an active session
  4. A user can reset a forgotten password via an email link and sign back in with the new password
  5. The `profiles` row is automatically created on first sign-in (no manual step); the existing `/api/today` feed path is completely unaffected
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — @supabase/ssr install + SSR client factories + middleware with static-asset matcher
- [x] 07-02-PLAN.md — profiles DB migration + auth route handlers (callback, confirm) + Server Actions
- [x] 07-03-PLAN.md — external service config (Resend SMTP, Google OAuth, Supabase dashboard) + smoke test

### Phase 8: Auth UI + iOS Validation
**Goal**: Users can browse freely as guests and are prompted to sign in only when they attempt a social action, with the entire flow confirmed working on a real iOS device
**Depends on**: Phase 7
**Requirements**: AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. A guest user can open the app, scroll through all videos, and watch every video without any sign-in prompt appearing
  2. A guest user who taps a like, bookmark, or comment button sees a non-blocking bottom sheet prompting sign-in, and can dismiss it to keep watching
  3. Google OAuth sign-in from the bottom sheet completes successfully on a real iPhone with the PWA installed to the home screen (Add to Home Screen)
  4. After signing in via the bottom sheet, the user is returned to the same video they were watching
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — useAuth hook, AuthBottomSheet component, signInWithGoogle returnPath support
- [x] 08-02-PLAN.md — social buttons in VideoItem, AuthBottomSheet wired into VideoFeed, scroll restoration, Suspense boundary
- [x] 08-03-PLAN.md — /auth/auth-error page, /auth/update-password page, iOS PWA real-device validation

### Phase 9: Social Interactions
**Goal**: Signed-in users can like and bookmark videos, guests can see like counts, and all social state is persisted correctly with RLS enforced
**Depends on**: Phase 8
**Requirements**: SOCL-01, SOCL-02, SOCL-03, SOCL-04
**Success Criteria** (what must be TRUE):
  1. A signed-in user can tap the like button to like a video; tapping it again unlikes it; the optimistic count updates instantly and persists on refresh
  2. A guest user can see the like count on every video without signing in
  3. A signed-in user can bookmark a video and remove the bookmark; bookmark state is accurate after refresh
  4. Social mutations return 401 for unauthenticated requests; like and bookmark state is scoped per user (one user's likes are invisible to another's)
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — DB migration: video_likes, video_bookmarks, like_count column + trigger, feed API like_count
- [ ] 09-02-PLAN.md — Route Handlers: /api/social/like, /api/social/bookmark, /api/social/state
- [ ] 09-03-PLAN.md — Frontend wiring: VideoItem props, VideoFeed optimistic state + mutations

### Phase 10: Comments
**Goal**: Signed-in users can post and delete comments on videos; all moderation minimums are enforced; guests can read comments freely
**Depends on**: Phase 9
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04
**Success Criteria** (what must be TRUE):
  1. A guest user can open the comment sheet on any video and read all comments without signing in
  2. A signed-in user can post a comment and see it appear immediately; the author display name and avatar are shown correctly
  3. A signed-in user can delete their own comment; they cannot delete another user's comment
  4. Posting more than one comment within 30 seconds is rejected with an informative message; comments over 500 characters cannot be submitted
**Plans**: 3 plans

Plans:
- [ ] 10-01-PLAN.md — DB migration: video_comments table, RLS, comment_count column + trigger, Video interface + feed API
- [ ] 10-02-PLAN.md — Route Handlers: GET+POST /api/comments, DELETE /api/comments/[id]
- [ ] 10-03-PLAN.md — CommentSheet component + VideoFeed/VideoItem wiring + end-to-end verification

### Phase 11: Profile Page
**Goal**: Signed-in users have a profile page showing their identity and a complete view of their liked and saved videos
**Depends on**: Phase 10
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):
  1. A signed-in user can navigate to their profile, see their display name, and edit it; the updated name is reflected everywhere (comments, header) after save
  2. A signed-in user can upload a profile photo; the avatar appears in their profile header and on their comments
  3. A signed-in user can view the Liked tab and see all videos they have liked, in reverse chronological order; an empty state is shown when none exist
  4. A signed-in user can view the Saved tab and see all their bookmarked videos; tapping one navigates to that video in the feed
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Pipeline | v1.0 | 5/5 | Complete | 2026-02-25 |
| 3. Frontend | v1.0 | 4/4 | Complete | 2026-02-25 |
| 4. Ship | v1.0 | 3/3 | Complete | 2026-02-26 |
| 5. Tech Pipeline | v1.1 | 2/2 | Complete | 2026-03-10 |
| 6. Category UI | v1.1 | 1/1 | Complete | 2026-03-10 |
| 7. Auth Infrastructure | v1.2 | 3/3 | Complete | 2026-03-24 |
| 8. Auth UI + iOS Validation | v1.2 | 3/3 | Complete | 2026-03-24 |
| 9. Social Interactions | 3/3 | Complete   | 2026-03-26 | - |
| 10. Comments | 1/3 | In Progress|  | - |
| 11. Profile Page | v1.2 | 0/? | Not started | - |
