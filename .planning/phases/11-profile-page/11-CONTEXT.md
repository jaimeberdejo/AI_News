# Phase 11: Profile Page - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed-in user's profile screen: view and edit their identity (display name, avatar photo) and browse their liked and saved videos in two tabs. Profile is a primary tab in the bottom navigation. Auth flows and social actions (liking, saving) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Profile header layout
- Compact single-row header: avatar + display name + pencil edit icon — leaves maximum space for tab content
- No stats in the header (liked/saved counts not shown — visible by browsing tabs)
- Profile page lives in the bottom tab bar as a primary tab (always accessible)
- Signed-out users see a sign-in prompt screen: avatar placeholder + "Sign in to view your profile" + sign-in button (not an automatic redirect)

### Avatar upload flow
- Tapping the avatar directly triggers the photo picker (no separate button)
- Show a square crop UI before upload so user can position their photo
- Store uploaded avatar in a Supabase Storage "avatars" bucket; save public URL to profiles.avatar_url
- Fallback when no photo: first letter of display name on a colored background (same pattern as CommentSheet)

### Liked/Saved tabs layout
- 3-column thumbnail grid, reverse chronological order
- Both tabs use the same grid component — same layout, just different data source
- Tapping a thumbnail navigates to the home feed tab scrolled to that video (no standalone player)
- Empty state: icon (heart/bookmark) + message ("No liked videos yet") + "Start watching" CTA button that navigates to the feed

### Edit display name flow
- Tapping the pencil icon opens a bottom sheet with a text field pre-filled with current name + Cancel and Save buttons
- 50-character limit with counter shown near the limit
- Save button disabled if name is blank — non-empty required
- Optimistic update: profile header shows new name immediately on save; comments and other surfaces reflect it on next fetch (no manual refresh needed)

### Claude's Discretion
- Exact avatar circle size and spacing in the compact header
- Loading skeleton while profile data fetches
- Error state if save fails (network error)
- Exact color for the initial-letter avatar fallback

</decisions>

<specifics>
## Specific Ideas

- Avatar fallback: initial letter on colored background — same pattern already implemented in CommentSheet
- Tap-to-navigate from grid thumbnail should scroll the main feed to that specific video (not just open the feed from the top)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-profile-page*
*Context gathered: 2026-03-26*
