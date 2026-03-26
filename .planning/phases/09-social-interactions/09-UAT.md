---
status: testing
phase: 09-social-interactions
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md
started: 2026-03-26T10:00:00Z
updated: 2026-03-26T10:00:00Z
---

## Current Test

number: 2
name: Guest tapping like triggers sign-in sheet
expected: |
  As a guest, tap the heart icon on any video.
  The AuthBottomSheet slides up prompting sign-in.
  The like count does NOT change.
awaiting: user response

## Tests

### 1. Guest sees like counts on feed load
expected: Open the feed without signing in. Every video shows a like count (0 or higher) below the heart icon. No sign-in prompt appears just from loading.
result: pass

### 2. Guest tapping like triggers sign-in sheet
expected: As a guest, tap the heart icon on any video. The AuthBottomSheet slides up prompting sign-in. The like count does NOT change.
result: [pending]

### 3. Guest tapping bookmark triggers sign-in sheet
expected: As a guest, tap the bookmark icon on any video. The AuthBottomSheet slides up prompting sign-in.
result: [pending]

### 4. Signed-in user likes a video
expected: Sign in, then tap the heart on a video. The heart fills red immediately and the like count increments by 1 — no page refresh needed. Refresh the page and the heart is still filled, count still incremented.
result: [pending]

### 5. Unlike a video
expected: Tap the already-red heart on a liked video. The heart unfills immediately and the count decrements by 1. Refresh — the unliked state persists.
result: [pending]

### 6. Bookmark a video
expected: Tap the bookmark icon on any video while signed in. The icon fills yellow immediately. Refresh — the bookmark is still filled.
result: [pending]

### 7. Remove a bookmark
expected: Tap the already-filled bookmark on a bookmarked video. The icon returns to unfilled immediately. Refresh — it stays unbookmarked.
result: [pending]

### 8. Rapid double-tap is debounced
expected: Tap the heart twice quickly on the same video. Only one request fires — the count changes by 1 (not 2), and the final icon state is stable (not flickering).
result: [pending]

### 9. Social state loads after sign-in
expected: Load the feed as a guest (no filled hearts). Sign in via the bottom sheet. Without refreshing, any previously liked videos should show their filled heart state automatically.
result: [pending]

### 10. Per-user isolation
expected: Sign in as User A and like a video. Sign out. Sign in as User B. The heart on that video is unfilled for User B. User B's likes do not affect User A's state.
result: [pending]

## Summary

total: 10
passed: 1
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
