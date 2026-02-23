# Feature Landscape

**Domain:** Finite vertical video news feed PWA (financial news, AI-generated)
**Project:** FinFeed
**Researched:** 2026-02-23
**Confidence note:** Network tools unavailable; findings from training data (cutoff Aug 2025). Browser policy sections marked HIGH where documented in official specs. UX patterns marked MEDIUM based on established app behavior.

---

## Table Stakes

Features users expect from a vertical video feed. Missing any of these = users leave immediately.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| Muted autoplay on first load | Every vertical video app does this; it's the only option browsers allow without gesture | Low | HIGH | Required by browser policy — no workaround exists |
| Tap-to-unmute with visual indicator | Speaker icon with X (muted state) is universal convention — users know this pattern | Low | HIGH | Must persist unmute across swipes in same session |
| Vertical snap scroll | TikTok/Reels established this as the interaction model — swiping triggers instant snap to next card | Medium | HIGH | Use CSS `scroll-snap-type: y mandatory` on container |
| Full-screen video (no letterboxing) | Videos should fill the viewport top to bottom — 9:16 aspect ratio | Low | HIGH | `object-fit: cover` on 9:16 video; design videos at 1080x1920 |
| Progress bar / time indicator | Users need to know where they are in a 30–45s clip | Low | MEDIUM | Thin bar at bottom or top of video frame |
| Video card count indicator | "2 of 5" — users need to know how many videos remain in a finite feed | Low | MEDIUM | Critical for finite feed UX — sets expectations |
| "You're up to date" end state | Without this, users think the app is broken when scrolling ends | Low | HIGH | Core product promise — must be polished |
| Smooth swipe transition | Jarring transitions signal low quality — animation must be 60fps | Medium | HIGH | Hardware-accelerated CSS transforms only; no JS-driven scroll |
| No loading spinner on swipe | Videos must be preloaded before they're needed | Medium | HIGH | Preload at minimum next 1 video while current plays |
| Playback resumes on return | If user leaves app and returns, video resumes where they left | Low | MEDIUM | Page Visibility API + `video.currentTime` save |

---

## Browser Autoplay Policies (Critical — Read Before Building)

This section documents what browsers actually allow in 2026. Getting this wrong means silent failures or broken UX.

### Chrome (Desktop + Android) — Confidence: HIGH

Chrome uses a **Media Engagement Index (MEI)** per origin:
- Muted autoplay: **Always allowed** — `video.muted = true; video.play()` works without user gesture
- Unmuted autoplay: **Requires user gesture** OR high MEI score for the site
- MEI is built over time by real users playing audio/video — a new PWA has MEI=0
- **Practical rule:** Always start muted. First tap anywhere = user gesture = allow unmute

Chrome Android behaves identically to Chrome Desktop for autoplay purposes.

### Safari iOS — Confidence: HIGH

Safari iOS is the most restrictive browser for autoplay:
- Muted autoplay: **Allowed** (introduced in iOS 10) — `video.muted = true; video.play()` works
- Unmuted autoplay: **Blocked unconditionally** without user gesture
- `playsinline` attribute: **Required** on iOS — without it, video opens fullscreen player
- PWA (added to home screen): **Same policy applies** — no special unlock from home screen install
- Critical: `video.play()` returns a Promise. On Safari, if autoplay is blocked, the Promise rejects. **Must handle the rejection** or you get uncaught Promise errors.

```html
<!-- Required attributes for iOS compatibility -->
<video
  muted
  playsinline
  webkit-playsinline
  autoplay
  preload="metadata"
>
```

### Safari iOS — The `webkit-playsinline` Detail — Confidence: MEDIUM

Older iOS versions (pre-iOS 10) required `webkit-playsinline` attribute. iOS 10+ uses `playsinline`. Include both for safety on older devices.

### First-Tap-to-Unmute Pattern — Confidence: HIGH

The industry-standard approach used by TikTok, Instagram Reels, and YouTube Shorts:

1. App loads: First video autoplays **muted** (`video.muted = true`)
2. User sees muted indicator (speaker icon with slash)
3. User taps video (or taps muted icon) → `video.muted = false` called inside tap event handler
4. This tap IS a user gesture → browser allows unmute
5. Store unmute preference in `sessionStorage` or a JS variable
6. Every subsequent video starts with `video.muted = false` (since gesture already occurred)

**The mistake to avoid:** Calling `video.muted = false` outside a user gesture handler. It will be silently ignored on iOS and throw on Chrome with low MEI.

### Chrome iOS — Confidence: MEDIUM

Chrome on iOS uses **WebKit** (not Blink) due to Apple App Store rules — therefore Chrome iOS has the **same autoplay restrictions as Safari iOS**. There is no difference in behavior between Chrome iOS and Safari iOS for video autoplay.

---

## PWA-Specific Features

What makes a video PWA feel native rather than feeling like a website.

| Feature | Why It Matters | Implementation | Confidence |
|---------|---------------|----------------|------------|
| `display: standalone` in manifest | Removes browser chrome — no address bar, no nav buttons — app feels native | Web App Manifest `display` field | HIGH |
| `theme-color` meta tag | Status bar color matches app — eliminates "website" feel on Android | `<meta name="theme-color" content="#000000">` | HIGH |
| Splash screen (PWA manifest) | Eliminates white flash on launch from home screen | `icons` array in manifest at multiple sizes | HIGH |
| `orientation: portrait` in manifest | Locks to portrait — video is portrait-only | Web App Manifest `orientation` field | HIGH |
| Service Worker for asset caching | App shell loads instantly even on slow connections | Cache JS/CSS/icons at install; videos fetched fresh | HIGH |
| `preload="metadata"` on non-active videos | Fetches video duration/dimensions without downloading full video | HTML video attribute | HIGH |
| Video URL preloading via fetch() | Pull video bytes before user swipes to it — eliminates loading delay | Service Worker or JS `fetch()` into memory/cache | MEDIUM |
| Offline fallback page | If user has no connection, show "Connect to load today's stories" vs broken page | Service Worker fetch handler with cache-first for shell | MEDIUM |

### Service Worker Video Caching Strategy — Confidence: MEDIUM

**Recommended: Network-first with prefetch, NOT cache-first for videos**

Why not cache-first for videos: Videos are large (5–20MB each). Caching all 5 videos = 25–100MB Service Worker cache. This causes:
- iOS Safari: 50MB Service Worker cache limit — exceeded immediately
- Storage eviction: Browser will evict under memory pressure
- Stale content: Cached video from yesterday served instead of today's

**Correct approach for a daily-refreshing feed:**
1. Cache the app shell (HTML, JS, CSS, icons) — these change rarely
2. Prefetch videos into JS memory (ArrayBuffer or Blob URL) — not into SW cache
3. Use `<link rel="preload" as="video" href="...">` for next video
4. Or manually `fetch()` next video URL and create `URL.createObjectURL()` for the video `src`

---

## Video Player UX Patterns — Table Stakes

| Pattern | Description | Why Required | Confidence |
|---------|-------------|--------------|------------|
| Snap-to-fill on swipe | Each swipe snaps to exactly the next full-screen video | No other interaction model is acceptable for vertical video | HIGH |
| No partial video visible | Never show half of previous video — 1 video fills screen 100% | Partial visibility implies "swipe more" — confuses finite feed | MEDIUM |
| Current video pauses on swipe | As user initiates swipe away, pause current video | Prevents audio from continuing while next video loads | HIGH |
| Next video plays immediately on snap | Zero gap between snap completion and playback start | Preloading is required to achieve this | HIGH |
| Swipe up = next, swipe down = previous | Universal convention from TikTok/Reels | Reversing this would be disorienting | HIGH |
| Swipe down on first video = nothing (or bounce) | No content above first video — clear boundary | Shows users they're at the start | MEDIUM |
| Swipe up on last video = end state | "You're up to date" screen | Core to finite feed promise | HIGH |
| Touch/pointer events only (no scroll wheel UX) | Vertical video is a touch-first interaction | Desktop users can swipe by click-drag or arrow keys | MEDIUM |

---

## "Finite Feed" UX — End State Patterns

Apps that have a definitive "done" state are rare. Examples and what works:

### What Works

| Pattern | Example | Why It Works |
|---------|---------|--------------|
| Celebratory "You're done" card | BeReal's "you're all caught up", Wordle completion | Positive reinforcement — makes finishing feel good |
| Show time until next content | "Next update in 6h 23m" | Gives users a reason to return, sets expectations |
| Minimal animation on end card | Subtle motion (confetti, checkmark animation) | Makes the moment feel earned without being annoying |
| Clear visual differentiation | End card looks nothing like a video card | User must know they've reached the end, not a loading failure |
| Show today's story count | "You watched all 5 stories today" | Reinforces the finite promise, feels like completion |

### What Does Not Work

| Pattern | Why It Fails |
|---------|-------------|
| Just stopping scroll / blank screen | Looks like a bug — users shake phone, hard-refresh |
| "Load more" button at the end | Breaks the finite promise — infinite scroll trap |
| Auto-looping back to start | Disorienting; betrays the "you're done" promise |
| Redirect to external news site | Breaks app context; feels like a bait-and-switch |
| Showing related articles/links | Turns finite app into an infinite content portal |

### Confidence: MEDIUM (based on observed app behavior patterns, no official UX research cited)

---

## Video Prefetching Strategies — Confidence: MEDIUM

### How Many Videos to Preload

| Strategy | Videos Preloaded | Memory Cost | Network Cost | Recommendation |
|----------|-----------------|-------------|--------------|----------------|
| None | 0 | 0 | 0 | Never — users see spinner on every swipe |
| Next 1 only | 1 | ~5–20MB | Low | Minimum viable — acceptable for slow connections |
| Next 2 | 2 | ~10–40MB | Medium | Recommended for FinFeed (5 total videos = safe) |
| All remaining | Up to 4 | ~20–80MB | High | Feasible for 5-video feed; aggressive for low-memory devices |

**FinFeed recommendation: Preload next 2 videos on app load, since the total feed is only 5 videos and users will watch all of them.**

### Intersection Observer Pattern

```javascript
// Standard pattern: preload video when previous video is 80% visible
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0.8) {
        const nextVideo = getNextVideoElement(entry.target);
        if (nextVideo && !nextVideo.src) {
          nextVideo.src = nextVideo.dataset.src; // lazy-load src
        }
      }
    });
  },
  { threshold: 0.8 }
);
```

### Memory Management

- On a 5-video finite feed, memory is not a concern — all 5 can stay in DOM
- Remove `src` from videos the user has already passed (previous videos) to free memory
- Set `video.src = ''` + `video.load()` to fully release video memory
- Do NOT remove videos from DOM (causes layout shift) — just clear their src

---

## Differentiators

Features that set FinFeed apart. Not expected, but valued if present.

| Feature | Value Proposition | Complexity | Priority for v1 | Confidence |
|---------|-------------------|------------|-----------------|------------|
| Subtitle/transcript toggle | Accessibility; users watching silently (commute); users with hearing impairment | Medium | HIGH — generate from TTS script | MEDIUM |
| "Next update" countdown on end card | Creates habit loop — gives users a reason to return at a specific time | Low | HIGH — trivial to implement | MEDIUM |
| Share button on each video (Web Share API) | Native share sheet — lets users send video link to friends/colleagues | Low | MEDIUM | MEDIUM |
| Swipe-to-skip without watching | Some stories don't interest the user — penalizing them to watch defeats the purpose | Low | HIGH — let users swipe freely | HIGH |
| Keyboard navigation (arrow keys) | Desktop users — left/right or up/down arrow keys to navigate | Low | LOW | MEDIUM |
| "Already watched" state on reload | If user returns same day, already-watched videos show as seen | Medium | MEDIUM — use localStorage | MEDIUM |

### Subtitle Toggle — FinFeed-Specific Advantage — Confidence: HIGH

FinFeed generates scripts via LLM and audio via TTS. The subtitle text is already available as a byproduct of the pipeline. Displaying synced subtitles is a near-zero-cost differentiator:
- WebVTT cue files can be generated from the timestamped TTS output
- Financial news content is dense — subtitles dramatically improve comprehension
- Many users watch short-form video on mute by default (public transport, office)

---

## Anti-Features

Features to explicitly NOT build — they undermine the finite feed promise or add complexity with no v1 value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Infinite scroll / "load more" | Directly destroys the core product promise | Hard-stop at 5 videos per day |
| User comments / reactions | Social features require moderation, auth, backend complexity | Not needed for validation |
| Algorithm-based feed personalization | Requires user data, auth, training data — massive scope increase | Curated editorial feed for all users |
| Push notifications | Requires service worker permission UX, server-side sending, opt-in flow | Deep link URL the user can bookmark |
| Related articles / links | Turns finite digest into an infinite content portal | Keep users in the video feed only |
| "Save for later" playlist | Implies the feed is a discovery tool — it's a finite daily digest | The feed IS the saved content |
| Native share button that copies video file | Video files are 5–20MB — mobile share of binary is poor UX | Share the URL to the day's feed |
| Auto-loop feed from start | After end card, looping back destroys "you're done" moment | Show end card; offer "watch again" only on user explicit tap |
| Dark patterns to extend session | Skip "you're up to date" card, add "one more story", autoplay unrelated content | FinFeed's USP is knowing when you're done |
| Landscape mode | Vertical video content is portrait-only — landscape breaks the layout | Lock orientation to portrait |
| Like / bookmark per video | Requires backend storage, implies returning to saved content later | Not needed in v1 |

---

## Financial News App Feature Expectations — Confidence: MEDIUM

What users of financial news apps specifically expect (Bloomberg, MarketWatch, Yahoo Finance, Robinhood app patterns):

| Feature | Financial-Specific Reason | FinFeed Approach |
|---------|--------------------------|-----------------|
| Credibility signals | Finance = high-stakes decisions — sources matter | Show "based on [Reuters/Yahoo Finance] reports" in end card or subtitle |
| Timestamps | "Is this today's news?" anxiety is high in finance | "Today's briefing — [date]" visible on first load |
| Market context | Users want to know if a story is pre/post-market | Pipeline can tag stories with market timing |
| Clear action (what should I do?) | Financial users want takeaways, not just events | "Financial influencer" script tone addresses this |
| Disclaimer/not financial advice | Legal protection; user trust | Small persistent footer or end-card text |

---

## Feature Dependencies

```
Muted autoplay → Tap-to-unmute pattern (must exist before unmute works)
TTS audio track → Subtitle/transcript toggle (subtitles are free if script exists)
Video count indicator → End state card (users need to know position before they know they've finished)
Service Worker → App shell caching → Offline fallback
Preloading (next 2 videos) → Zero-delay swipe (prerequisite)
PWA manifest → Standalone display → Home screen install (full native feel)
```

---

## MVP Recommendation

### Must Build for Launch

1. Muted autoplay with tap-to-unmute (with stored session preference)
2. Vertical snap-scroll with CSS scroll-snap
3. Progress bar within each video
4. "N of 5" card position indicator
5. Polished "You're up to date" end card with next-update countdown
6. Preload next 2 videos on load
7. Subtitles toggle (since script text is free from pipeline)
8. PWA manifest: standalone, portrait, dark theme-color, icons
9. Not-financial-advice disclaimer

### Defer Post-Validation

- Share button (Web Share API) — add in v1.1 if users are sharing organically anyway
- "Already watched" state — localStorage-based, add when returning users are observed
- Keyboard navigation — desktop UX, low priority vs mobile
- Offline fallback — nice to have, not needed for validation

### Explicitly Excluded (Anti-Features)

- Anything that creates infinite scroll behavior
- Social features (comments, likes)
- Personalization
- Push notifications

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Chrome autoplay policy (MEI, muted always allowed) | Training data from Chrome developer docs | HIGH |
| Safari iOS muted autoplay allowed since iOS 10 | Training data from WebKit release notes | HIGH |
| `playsinline` required on iOS | Training data from Apple/WebKit documentation | HIGH |
| Chrome iOS = WebKit = same as Safari iOS | Training data from Apple App Store review guidelines | HIGH |
| CSS scroll-snap vertical snap behavior | Training data from MDN Web Docs | HIGH |
| Service Worker 50MB cache limit on iOS | Training data from WebKit storage documentation | MEDIUM |
| Intersection Observer for lazy video load | Training data from MDN / industry pattern | HIGH |
| Finite feed UX patterns (BeReal, Wordle) | Training data from observed app behavior | MEDIUM |
| Financial news user expectations | Training data from Bloomberg/Robinhood/MarketWatch UX patterns | MEDIUM |

**Network tools were unavailable during this research session. All findings are from training data (cutoff Aug 2025). Browser policies in particular should be verified against current Chrome and WebKit release notes before implementation. The core autoplay rules (muted always works, unmuted requires gesture) have been stable for 5+ years and are unlikely to have changed.**
