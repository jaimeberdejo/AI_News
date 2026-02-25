# Phase 3: Frontend - Research

**Researched:** 2026-02-25
**Domain:** Next.js 16 PWA, iOS Safari video autoplay/unmute, CSS scroll snap, vertical video feed
**Confidence:** HIGH (core stack verified via Context7 + official docs); MEDIUM (iOS preloading workarounds)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Feed chrome & visual design**
- Screen fill: Claude's discretion — full-bleed or safe-area-respecting, pick what's right for a mobile video feed PWA
- Progress indicator: Progress dots overlaid on screen — 5 dots, filled dot = current video
- Subtitles: Always shown — burned into the video by the pipeline (no frontend rendering needed)
- Headline overlay: Story headline shown as a text overlay at the bottom of the video

**Tap-to-unmute UX**
- Prompt location: Top corner icon (small mute icon, minimal — like TikTok)
- After unmute: Icon fades to subtle in the corner; becomes prominent again when user taps the screen
- Persistence: Unmuted state persists for all subsequent videos in the session; resets to muted on app reopen
- Visual feedback on unmute: Claude's discretion

**End card design**
- Visual style: Minimal — dark screen, "You're up to date" message, approximate time estimate (no ticking timer)
- Time estimate: Human-readable approximation — "Check back tonight" or "Check back tomorrow morning" (not a countdown timer)
- Action: "Watch again" replay button — restarts feed from video 1 without reloading the page
- New edition detection: If a new edition is available when user reaches end card, silently auto-refresh the feed

**Loading & empty states**
- Initial load: Claude's discretion — pick the right pattern for a Next.js PWA (prefer fast first paint)
- No videos today: Claude's discretion — pick sensible fallback (e.g., show most recent available edition)
- Single video failure mid-feed: Skip silently, auto-advance to next video — no error shown to user
- Offline behavior: Claude's discretion — follow the roadmap's app-shell-only service worker spec

### Claude's Discretion
- Screen fill approach (full-bleed vs safe-area-respecting)
- Visual feedback animation when unmuting
- Initial load state/skeleton implementation
- Fallback when today's edition is unavailable
- Offline error handling
- Icon styling and exact positioning

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | PWA displays today's 5 videos in a vertical snap-scroll feed (one video per screen) | CSS scroll-snap-type: y mandatory + 100dvh snap items; IntersectionObserver for play/pause |
| PLAY-02 | First video autoplays muted on page load; a visible "Tap to listen" prompt is shown | `<video autoplay muted playsinline>` + corner icon overlay component; poster="#t=0.001" hack for first frame |
| PLAY-03 | Tapping the unmute prompt unmutes audio inside a synchronous event handler (iOS Safari compliant); audio stays unmuted for all subsequent videos in the session | onClick sets `videoRef.current.muted = false` synchronously; session-level state (React context or module var) |
| PLAY-04 | Player preloads the next 2 videos in the background while current video plays | Render next 2 videos as hidden/off-screen `<video muted preload="auto">` elements; iOS will preload while they are in DOM and muted |
| PLAY-05 | After the last video ends, a "You're up to date" end card is displayed with a countdown timer to the next edition (per REQUIREMENTS.md) — CONTEXT.md overrides: human-readable time estimate + "Watch again" button | `onEnded` event on last video triggers end card; time-of-day logic for "Check back tonight/tomorrow morning"; re-index state to 0 for replay |
| PWA-01 | App has a web manifest enabling "Add to Home Screen" with icon, splash screen, and standalone display mode | Next.js 16 built-in: `app/manifest.ts` returning `MetadataRoute.Manifest`; `appleWebApp` metadata in layout.tsx |
</phase_requirements>

---

## Summary

Phase 3 builds the vertical scroll video feed PWA on top of an already-scaffolded Next.js 16 App Router project (`frontend/`). The project has `@supabase/supabase-js` installed, a working `/api/today` route, and a blank `page.tsx`. No CSS framework is installed yet — this phase adds it.

The most technically sensitive area is iOS Safari video behavior. iOS has strict rules: (1) autoplay only works when `muted`, `autoplay`, and `playsinline` are all present; (2) unmuting must happen in a synchronous `click`/`touchend` handler — any async path (Promise chain, setTimeout, await) will cause iOS to pause the video when `muted = false` is set; (3) iOS ignores `preload="auto"` entirely unless the video is muted and visible (or has been played via user gesture). The preloading strategy must account for this: render the next 2 videos as muted hidden DOM elements so iOS begins buffering them while they are technically "visible" to the browser.

PWA installability (PWA-01) is straightforward in Next.js 16 — the framework natively supports `app/manifest.ts` for the web app manifest and `appleWebApp` metadata in `layout.tsx` for iOS-specific tags. The `next-pwa` package is deprecated; offline support should use Serwist if needed, but for v1 an app-shell-only service worker (cache JS/CSS, not videos) is sufficient and simpler.

**Primary recommendation:** Use plain CSS scroll snap (no library), a custom `useVideoPlayer` hook with `IntersectionObserver`, and Next.js native PWA support. No third-party video player library is needed for 5 short MP4 files.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 (already installed) | App Router framework, API routes, manifest, metadata | Already scaffolded; v16 built-in PWA manifest support |
| React | 19.2.3 (already installed) | UI components, hooks | Already installed |
| @supabase/supabase-js | ^2.97.0 (already installed) | Fetch edition + video metadata | Already installed and configured |
| Tailwind CSS | ^4.x | Utility CSS for mobile-first layout | Zero custom CSS overhead; v4 compatible with Next.js 16 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| serwist | ^9.x | Service worker / offline app shell | Only for offline caching of app shell assets; skip if offline not required for v1 |
| @serwist/next | ^9.x | Serwist integration for Next.js | Companion to serwist — requires `--webpack` build flag (Turbopack incompatible) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain CSS scroll snap | react-vertical-feed npm package | Package has 0 star count variants; plain CSS + IntersectionObserver is more controllable and has zero dependencies |
| Tailwind CSS | CSS Modules (already in project) | CSS Modules already exist (page.module.css) but Tailwind is faster for responsive mobile-first layout |
| Serwist | Manual service worker | Manual SW is simpler for app-shell-only but Serwist handles precaching, versioning, and update logic correctly |
| Next.js built-in manifest.ts | next-pwa package | next-pwa is DEPRECATED; Next.js 16 natively generates manifest; no external package needed |

**Installation:**
```bash
# From frontend/ directory
npm install tailwindcss @tailwindcss/postcss postcss
# If offline service worker required:
npm install @serwist/next && npm install -D serwist
```

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/
│   ├── manifest.ts          # PWA manifest (MetadataRoute.Manifest)
│   ├── layout.tsx           # Metadata, viewport, appleWebApp tags
│   ├── page.tsx             # Feed page — fetches edition, renders VideoFeed
│   ├── globals.css          # Global reset + scroll-snap container styles
│   └── api/today/route.ts   # (existing) Edition + video data endpoint
├── components/
│   ├── VideoFeed.tsx        # Scroll container + maps videos to VideoItem
│   ├── VideoItem.tsx        # Single video: <video>, headline overlay, progress dots
│   ├── MuteButton.tsx       # Corner mute/unmute icon — receives global muted state
│   └── EndCard.tsx          # "You're up to date" screen with time message + replay
├── hooks/
│   ├── useVideoPlayer.ts    # IntersectionObserver play/pause + preload management
│   └── useEdition.ts        # Fetches /api/today, handles null edition fallback
├── public/
│   ├── sw.js                # (optional) App-shell service worker
│   ├── icon-192x192.png     # Required for PWA manifest
│   └── icon-512x512.png     # Required for PWA manifest
└── tailwind.config.ts       # Tailwind config
```

### Pattern 1: Vertical Scroll Snap Feed (CSS only, no library)

**What:** The outermost container is a full-screen scroll container with `scroll-snap-type: y mandatory`. Each child fills 100% height with `scroll-snap-align: start`. No JS scrolling required.

**When to use:** Always — the scroll behavior is pure CSS. JS only controls play/pause, not scrolling.

**Example:**
```css
/* globals.css */
.feed-container {
  height: 100dvh;           /* dvh = dynamic viewport height, correct on mobile */
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;  /* iOS momentum scrolling */
}

.feed-item {
  height: 100dvh;
  scroll-snap-align: start;
  position: relative;
  overflow: hidden;
}
```

**100dvh vs 100vh:** Use `100dvh` (dynamic viewport height). `100vh` on iOS is the height when the Safari toolbar is collapsed — on load, it produces a layout taller than the actual screen. `dvh` updates dynamically as the toolbar appears/disappears. Supported in iOS 15.4+ (Safari 15.4).

### Pattern 2: IntersectionObserver for Play/Pause

**What:** Each `VideoItem` creates an IntersectionObserver on its container. When intersection ratio crosses 0.7 (70% visible), the video plays; below that, it pauses.

**When to use:** Replaces scroll event listeners which are costly. The only way to reliably know which video is "active" without counting scroll position.

**Example:**
```typescript
// Source: Context7 + web.dev IntersectionObserver docs
import { useEffect, useRef, useCallback } from 'react'

export function useVideoPlayer(isMuted: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.muted = isMuted
          video.play().catch(() => {/* autoplay blocked */})
        } else {
          video.pause()
        }
      },
      { threshold: 0.7 }
    )
    observer.observe(container)
    return () => observer.unobserve(container)
  }, [isMuted])

  return { containerRef, videoRef }
}
```

### Pattern 3: Unmute — Synchronous in Click Handler (iOS Critical)

**What:** iOS Safari requires that `video.muted = false` be called synchronously within a `click` or `touchend` event handler. Any async path (await, Promise.then, setState + useEffect) breaks this constraint and iOS pauses the video.

**When to use:** The MuteButton `onClick` handler. Session-level muted state should be stored in a React Context or module-level variable — NOT in async storage.

**Example:**
```typescript
// MuteButton.tsx — CRITICAL: synchronous, no await
function MuteButton({ isMuted, onToggle }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    // This entire block runs synchronously in the click event
    // Do NOT use async/await here
    onToggle()  // updates module-level or context muted state
    // Parent VideoFeed immediately sets all video elements' .muted property
  }
  return <button onClick={handleClick}>...</button>
}
```

**Session persistence:** Store muted state in a module-level variable (not localStorage — reading localStorage is async in practice under some frameworks) or React Context initialized from `sessionStorage` read synchronously in the event handler.

### Pattern 4: Preloading Next 2 Videos

**What:** iOS ignores `preload="auto"` for off-screen invisible videos. The workaround is to render the next 2 video elements as `visibility: hidden` (not `display: none` — display:none removes them from layout consideration) with `muted preload="auto"`. Because they are in the DOM and muted, iOS begins buffering.

**Important caveat:** iOS has a documented behavior: "video autoplay elements will only begin playing when visible on-screen." For *preloading* (not autoplaying), rendering hidden muted elements works for buffering purposes even when not playing. However, iOS may restrict this on low-power mode. The strategy is best-effort — it works well on normal power mode.

**Example:**
```tsx
// VideoFeed.tsx
{videos.map((video, idx) => {
  const isPreload = idx === activeIndex + 1 || idx === activeIndex + 2
  const isActive = idx === activeIndex

  return (
    <div
      key={video.id}
      style={{
        visibility: isPreload && !isActive ? 'hidden' : 'visible',
        position: isPreload && !isActive ? 'absolute' : 'relative',
        // Keep in DOM for buffering, remove from layout flow
      }}
    >
      <video
        ref={isPreload ? preloadRefs[idx] : undefined}
        src={video.video_url}
        muted
        preload="auto"
        playsInline
      />
    </div>
  )
})}
```

### Pattern 5: PWA Manifest — Next.js 16 Built-In

**What:** Next.js 16 App Router generates the `manifest.webmanifest` from `app/manifest.ts`. No external package needed.

**Example:**
```typescript
// Source: Context7 — /vercel/next.js PWA guide
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinFeed',
    short_name: 'FinFeed',
    description: 'Your daily financial briefing in 5 videos',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

### Pattern 6: iOS PWA Metadata in layout.tsx

**What:** iOS Safari does not support the `beforeinstallprompt` event — users must manually tap Share → "Add to Home Screen". The `appleWebApp` metadata ensures correct standalone behavior once installed.

**Example:**
```typescript
// Source: Context7 — /vercel/next.js generate-metadata
// app/layout.tsx
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'FinFeed',
  description: 'Your daily financial briefing',
  appleWebApp: {
    capable: true,
    title: 'FinFeed',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',  // Required for safe-area-inset on iPhone notch
}
```

### Anti-Patterns to Avoid

- **`display: none` for preload elements:** Removes element from rendering pipeline; browser (especially iOS) will not buffer the video source. Use `visibility: hidden` or absolute-positioned off-screen instead.
- **`100vh` for scroll container height:** On iOS, viewport height on page load includes the address bar height. Use `100dvh` to get the correct dynamic viewport height.
- **Async unmute:** Any `await` before `video.muted = false` breaks iOS's user-gesture requirement. The muted property assignment must be in the direct call stack of the click/touch event.
- **Setting `muted = false` on all future videos in a useEffect:** This runs outside a user gesture. Only the currently playing video can be unmuted synchronously. Future videos can be initialized with `muted = false` only if set before they play (setting it as a prop before play is triggered by IntersectionObserver is fine, since IntersectionObserver fires on scroll, not async).
- **Using `next-pwa` package:** Deprecated. Use Next.js built-in `manifest.ts` + Serwist for SW if needed.
- **`scroll-behavior: smooth` on the feed container:** Conflicts with `scroll-snap-type: mandatory`. Mandatory snap provides its own smooth-enough behavior; adding smooth scrolling makes navigation feel sluggish.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web app manifest | Custom `manifest.json` in public/ + manual `<link>` tag | `app/manifest.ts` with `MetadataRoute.Manifest` | Next.js generates the file, handles MIME type, and auto-links it in `<head>` |
| iOS meta tags | Manual `<meta>` tags in `<head>` | `metadata.appleWebApp` in `layout.tsx` | Next.js generates correct `apple-mobile-web-app-*` tags with proper escaping |
| Scroll detection for active video | `scroll` event listener + position math | `IntersectionObserver` with threshold | Scroll events are main-thread-blocking; IntersectionObserver runs off main thread |
| Viewport height calculation | JS to measure window.innerHeight | `100dvh` CSS unit | dvh accounts for dynamic toolbar collapse/expand; JS measurement requires a resize listener |

**Key insight:** The HTML5 video API and CSS scroll snap provide everything needed for this feature set. Third-party video players (Video.js, Plyr, etc.) add 50-200KB of JS for features not needed here (custom controls, adaptive streaming, analytics).

---

## Common Pitfalls

### Pitfall 1: iOS Safari Silently Pauses on Async Unmute

**What goes wrong:** User taps unmute, video appears to unmute (icon changes) but audio is silent. Video keeps playing muted.

**Why it happens:** `video.muted = false` was called inside a Promise callback, `async` function after an `await`, or in a `setTimeout`. iOS Safari treats this as outside the user gesture context and immediately re-mutes the video or pauses it.

**How to avoid:** The unmute must happen in the synchronous body of the `onClick` or `onTouchEnd` handler — zero async boundaries between the tap and the `video.muted = false` assignment.

**Warning signs:** Testing in Chrome Desktop shows no issue (Chrome is permissive). The bug only manifests on a real iPhone in Safari.

### Pitfall 2: Video Poster is Black on iOS Until Play

**What goes wrong:** Before the first video plays, the `<video>` element shows a black rectangle instead of the first frame.

**Why it happens:** iOS Safari does not decode the first frame unless a `poster` attribute is provided or `#t=0.001` is appended to the video URL.

**How to avoid:** Either provide an explicit `poster` URL from the video metadata (pipeline can generate a thumbnail), or append `#t=0.001` to the `src` value. The `#t=0.001` fragment tells the browser to seek to 0.001s and decode that frame as the poster.

**Example:**
```tsx
<video
  src={`${video.video_url}#t=0.001`}
  autoPlay
  muted
  playsInline
  preload="auto"
/>
```

### Pitfall 3: Preload Attribute Ignored on iOS

**What goes wrong:** Next 2 videos buffer fine in Chrome but show spinner on scroll on iPhone.

**Why it happens:** iOS Safari ignores `preload="auto"` for elements that are not currently playing. The constraint is that iOS only buffers muted elements that are visible OR actively playing.

**How to avoid:** Keep preload elements in the DOM and muted. Render them with `visibility: hidden` (not `display: none`). Critically: iOS will buffer more aggressively for visible (even if transparent) elements. Consider rendering preload items as 1px × 1px absolutely positioned elements in the top-left corner — they are technically "on screen."

**Warning signs:** Buffering works in Chrome DevTools mobile emulation but fails on real device.

### Pitfall 4: Safe Area Inset Missing for iPhone Notch

**What goes wrong:** Video and overlays (progress dots, mute icon) are obscured by the iPhone notch/dynamic island or home indicator.

**Why it happens:** Without `viewport-fit=cover` and `env(safe-area-inset-*)` CSS, the browser clips content to the "safe" rectangle, but elements positioned to `top: 0` or `bottom: 0` fall under the notch.

**How to avoid:** Set `viewport-fit: cover` in the viewport export (Next.js supports this as `viewportFit: 'cover'` in the `Viewport` type). Then use `padding-top: env(safe-area-inset-top)` on the overlay container.

**Example:**
```css
.progress-dots {
  top: calc(env(safe-area-inset-top) + 8px);
}

.mute-button {
  top: calc(env(safe-area-inset-top) + 12px);
}
```

### Pitfall 5: 'use client' Boundary for Video Interactions

**What goes wrong:** The feed page tries to use `useRef`, `useEffect`, or event handlers but gets a server component error.

**Why it happens:** Next.js App Router defaults all components to Server Components. Video playback logic requires browser APIs.

**How to avoid:** Mark any component using browser APIs with `'use client'` at the top. Keep `page.tsx` as a Server Component that only fetches data (via `useEdition` server-side or in the component body), then passes data to a `'use client'` `VideoFeed` component.

**Recommended split:**
```
page.tsx (Server Component) → fetches edition data → passes to VideoFeed
VideoFeed.tsx ('use client') → all interactive video logic
```

### Pitfall 6: Edition Fetch Timing (Pipeline Window)

**What goes wrong:** User opens app during pipeline run. `/api/today` returns `{ edition: null }`. App shows empty/broken state.

**Why it happens:** The pipeline may take 5-10 minutes to run. There is a window where no published edition exists for today.

**How to avoid:** The API already returns `{ edition: null }` (not 404). The frontend should fall back to the most recent available edition. The `useEdition` hook should query for the most recent edition, not just today's.

---

## Code Examples

Verified patterns from official sources:

### Video Element (All Required iOS Attributes)
```tsx
// Every <video> in the feed must have these four attributes
<video
  ref={videoRef}
  src={`${video.video_url}#t=0.001`}  // #t=0.001 forces first-frame poster on iOS
  autoPlay
  muted                                 // Required for autoplay; unmuted via JS on user tap
  playsInline                           // Required: prevents fullscreen takeover on iOS
  preload="auto"
  loop={false}
  onEnded={onEnded}
  className="w-full h-full object-cover"
/>
```

### Synchronous Unmute Handler
```typescript
// This MUST be synchronous — no async, no await, no Promise
const handleUnmuteClick = (e: React.MouseEvent | React.TouchEvent) => {
  e.stopPropagation()
  setSessionMuted(false)                    // React state for UI
  // Immediately update ALL video refs in the same sync tick
  videoRefs.forEach(ref => {
    if (ref.current) ref.current.muted = false
  })
}
```

### Next.js Manifest (app/manifest.ts)
```typescript
// Source: Context7 /vercel/next.js + official nextjs.org/docs/app/guides/progressive-web-apps
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinFeed',
    short_name: 'FinFeed',
    description: 'Your daily financial briefing in 5 videos',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

### CSS Scroll Snap Container
```css
/* globals.css */
html, body {
  margin: 0;
  padding: 0;
  background: #000;
}

.feed-container {
  width: 100%;
  height: 100dvh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.feed-item {
  width: 100%;
  height: 100dvh;
  scroll-snap-align: start;
  scroll-snap-stop: always;  /* prevents fast-swipe skipping items */
  position: relative;
  overflow: hidden;
  background: #000;
}
```

### End Card Time Estimate Logic
```typescript
// Returns human-readable next-edition estimate based on time of day
function getNextEditionMessage(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Check back this morning'
  if (hour < 12) return 'Check back this afternoon'
  if (hour < 18) return 'Check back tonight'
  return 'Check back tomorrow morning'
}
```

### iOS Apple Web App Metadata
```typescript
// Source: Context7 /vercel/next.js generate-metadata
// app/layout.tsx
export const metadata: Metadata = {
  title: 'FinFeed',
  description: 'Your daily financial briefing',
  appleWebApp: {
    capable: true,
    title: 'FinFeed',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` package for service workers | Native `app/manifest.ts` + Serwist for SW | Next.js 13+ App Router | next-pwa is deprecated; no external package needed for basic PWA |
| `100vh` for full-screen mobile layouts | `100dvh` (dynamic viewport height) | Safari 15.4 / 2022 | Fixes the iOS toolbar height bug permanently |
| `scroll` event listeners for active video detection | `IntersectionObserver` | Broadly supported since ~2018 | Off-main-thread, no jank, clean cleanup |
| `window.scrollTo()` for snap-scroll navigation | Pure CSS `scroll-snap-type: y mandatory` | Well-supported 2020+ | No JS needed for scroll behavior |
| `next-pwa` webpack plugin | Serwist (`@serwist/next`) | 2023-2024 | next-pwa unmaintained; Serwist is the community-endorsed successor |

**Deprecated/outdated:**
- `next-pwa`: Last commit 2022, actively deprecated — do not use.
- `scroll-snap-points-x/y`: Old webkit prefixed properties — use `scroll-snap-type` and `scroll-snap-align` instead.
- `webkit-playsinline` attribute: Old iOS 9 attribute — `playsinline` (no prefix) is correct since iOS 10.

---

## Open Questions

1. **Preloading reliability on iOS Low Power Mode**
   - What we know: iOS restricts background video buffering in Low Power Mode; muted off-screen video elements may not buffer.
   - What's unclear: Whether `visibility: hidden` vs absolute 1px element makes a meaningful difference.
   - Recommendation: Implement best-effort preloading with `visibility: hidden`; accept that Low Power Mode may cause occasional buffering pauses. Document as known limitation.

2. **`scroll-snap-stop: always` behavior on iOS 16 vs 17**
   - What we know: `scroll-snap-stop: always` prevents swipe-skipping items. Supported in Safari 15+.
   - What's unclear: Whether fast-swipe skip behavior differs between iOS 16 and 17 in practice.
   - Recommendation: Include `scroll-snap-stop: always` on each item. Test on real device.

3. **Serwist Turbopack compatibility**
   - What we know: `@serwist/next` requires webpack; Next.js 16 defaults to Turbopack in `next dev`.
   - What's unclear: Whether Turbopack quick guide for Serwist is stable as of 2026-02.
   - Recommendation: If offline support is needed, use `next dev --webpack` in development and confirm build works. For v1, skip the service worker entirely — no offline support required by v1 requirements.

4. **Session muted state: React Context vs module variable**
   - What we know: Both approaches can store session-level state. Module variable is synchronously accessible in click handlers (no React re-render latency). Context requires that the consumer component re-renders before the new value is accessible.
   - What's unclear: Whether React 19's synchronous state updates (via new concurrent features) make Context safe in this click handler pattern.
   - Recommendation: Use a module-level variable (not React state) for the `globalMuted` flag that is read directly in the IntersectionObserver callback when starting video playback. Use React state only for rendering the mute icon UI.

---

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js` (Context7) — manifest.ts, appleWebApp metadata, viewport export, PWA guide
- `https://nextjs.org/docs/app/guides/progressive-web-apps` — Official Next.js 16.1.6 PWA guide (verified 2026-02-24)
- `https://webkit.org/blog/6784/new-video-policies-for-ios/` — WebKit official iOS video policy (user gesture = `touchend`/`click`/`keydown` synchronous handlers)
- `https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay` — MDN Autoplay guide

### Secondary (MEDIUM confidence)
- `https://web.dev/fast-playback-with-preload/` — Video preload techniques; `<link rel="preload">` not widely supported for video
- `https://blog.logrocket.com/build-custom-tiktok-autoplay-react-hook-intersection-observer/` — IntersectionObserver TikTok hook pattern, verified against MDN spec
- `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type` — CSS scroll-snap-type MDN reference
- `https://serwist.pages.dev/docs/next/getting-started` — Serwist Next.js setup (official Serwist docs)

### Tertiary (LOW confidence)
- WebSearch results on iOS preloading behavior with `visibility: hidden` — multiple sources agree but no Apple official confirmation
- WebSearch results on `scroll-snap-stop: always` iOS behavior — anecdotal reports, not verified on specific iOS versions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js 16 built-in manifest verified via Context7 + official docs; Tailwind v4 standard; no deprecated packages
- Architecture: HIGH — CSS scroll snap, IntersectionObserver, iOS video attributes all verified via official sources
- Pitfalls: HIGH (iOS async unmute, playsinline requirement) — verified via WebKit official blog; MEDIUM (preload visibility: hidden workaround) — WebSearch + multiple community sources

**Research date:** 2026-02-25
**Valid until:** 2026-05-25 (stable web platform features; iOS Safari video policy unlikely to change)
