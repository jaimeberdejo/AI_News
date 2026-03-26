# Phase 12: Mobile UI - Research

**Researched:** 2026-03-26
**Domain:** React/Next.js mobile layout, CSS overlay patterns, iOS safe area, PWA video thumbnails
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Video layout:**
- Video fills the entire viewport (100vh) — full-screen, no info panel below
- Title and "Read article" link always visible, overlaid at bottom-left with a subtle gradient behind them for readability
- Edition nav (← Anterior / Hoy 12:46 / Siguiente →) stays overlaid at the top, just below the category tab bar
- Progress dots move from top-center to a vertical column on the right edge of the video (Instagram Stories-style)
- Mute button stays at top-right corner

**Social buttons:**
- Like, bookmark, comment move to a right-side vertical stack overlaid on the video (TikTok-style)
- Count displayed below each icon
- No creator avatar slot — content is AI-generated, rail starts directly with like button
- Order: like → bookmark → comment (top to bottom)

**Category navigation:**
- Replace floating Finance/Tech pills with a horizontally scrollable tab bar in a solid bar above the video
- Active category indicated by underline
- Design must scale to many categories — users scroll the tab bar left/right to access more
- Scroll position per category is preserved when switching (existing tabScrollState behaviour extended to new tab bar)
- Video starts below the category bar — no overlap

**Tab bar:**
- Keep 2 tabs: Home + Profile
- Opaque dark background (no transparency or blur)
- Active tab: filled icon + white label. Inactive: outline icon + gray label
- Fix safe area handling so icons and labels are never cut off on iPhone notch/home indicator

**Profile page:**
- Fix both thumbnail loading AND grid filling the full screen
- Thumbnails: pipeline generates a thumbnail image at upload time, stores URL in DB, served from Supabase Storage — grid uses `<img>` instead of `<video>` for reliability on iOS
- Layout: traditional scrollable page (not full-screen video context)
- Header (avatar, name, edit button) scrolls away on scroll; Liked/Saved tab bar sticks to top
- Content area must clear the floating bottom tab bar (paddingBottom)

### Claude's Discretion

- Gradient opacity/height behind bottom overlay text
- Exact spacing of right-rail action buttons
- Animation/transition when switching categories
- Thumbnail generation timing in the pipeline (at assembly or upload step)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope

</user_constraints>

---

## Summary

Phase 12 is a pure UI overhaul — no new backend features, no new API routes, no new database tables beyond one column addition (`thumbnail_url` on `videos`). The work splits into three independent workstreams: (1) the `VideoItem`/`VideoFeed` full-screen TikTok layout, (2) the category tab bar redesign in `VideoFeed`, and (3) the `ProfilePage`/`VideoGrid` thumbnail and layout fixes.

The current architecture uses CSS scroll-snap with `100dvh` snap items, inline React styles, and no UI component library. All layout work stays inside existing components. The biggest structural change is converting `VideoItem` from a flex column (video above, info panel below) to a full-screen video with absolutely-positioned overlays. The category tab bar becomes a separate sticky element that occupies real vertical space above the scroll container (unlike the current gradient-backed overlay), which requires adjusting the `feed-container` and `feed-item` CSS to leave room.

The profile grid thumbnail issue has two parts: iOS Safari does not reliably load `<video>` poster frames from remote MP4s on first load (well-known PWA limitation), so the fix is to generate a static JPEG thumbnail in the pipeline with FFmpeg (`-ss 0.5 -vframes 1`) and store its URL in a new `thumbnail_url` column. VideoGrid then renders `<img>` instead of `<video>` — simpler, faster, no video decode overhead in the grid.

**Primary recommendation:** Implement in three sequential plans: (1) VideoItem full-screen layout + right-rail social buttons, (2) category tab bar redesign + VideoFeed overlay reorganisation, (3) ProfilePage sticky tab bar + VideoGrid thumbnail fix + pipeline thumbnail generation.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework | Already used |
| React | 19.2.3 | UI components | Already used |
| Tailwind CSS | ^4.2.1 | Utility CSS | Already used (globals.css imports it) |
| @supabase/supabase-js | ^2.97.0 | Storage public URLs | Already used |

### Supporting (already available)

| Tool | Where | Purpose | When to Use |
|------|-------|---------|-------------|
| FFmpeg (`ffprobe`/`ffmpeg`) | Pipeline | Extract JPEG thumbnail frame | At video assembly step |
| Supabase Storage | `videos` bucket | Host thumbnail JPEGs | Same bucket as videos |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FFmpeg thumbnail extraction | Sharp (Node) | FFmpeg already present in pipeline; no new dependency needed |
| Inline styles (current pattern) | Tailwind classes | Project mixes both; inline styles for layout, globals.css for scroll; keep consistent with existing pattern |
| New `thumbnails` storage bucket | Same `videos` bucket subfolder | Simpler; no new bucket; path: `editions/{folder}/{position}_thumb.jpg` |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Component Structure (unchanged — modify existing files)

```
frontend/
├── components/
│   ├── VideoItem.tsx        ← Full-screen layout, right-rail social, bottom overlay
│   ├── VideoFeed.tsx        ← Category tab bar (solid, scrollable), feed layout
│   ├── TabBar.tsx           ← Safe area fix
│   ├── VideoGrid.tsx        ← <img> thumbnails instead of <video>
│   └── ProfilePage.tsx      ← Sticky inner tab bar, paddingBottom fix
├── app/globals.css          ← feed-container height adjustment (subtract tab bar height)
pipeline/
├── video.py                 ← Add extract_thumbnail() function
├── storage.py               ← upload_thumbnail(), add thumbnail_url to publish_edition()
├── models.py                ← Add thumbnail_url to VideoResult
supabase/migrations/
└── XXXXXXXX_add_thumbnail_url.sql  ← ALTER TABLE videos ADD COLUMN thumbnail_url text
```

### Pattern 1: Full-Screen Video with Absolute Overlays (TikTok Pattern)

**What:** `VideoItem` becomes a single `position: relative; height: 100dvh` container. The `<video>` fills it absolutely (`inset: 0`). All UI elements (title, social buttons, edition nav, progress dots) are positioned absolutely on top.

**Current state:** VideoItem is a flex column: `{flex: '1 1 0'}` video + `{flex: '0 0 auto'}` info panel. The info panel is ~130px tall, so video only gets `~100dvh - 130px`.

**Target state:**
```tsx
// VideoItem — root becomes full viewport, video fills it
<div style={{ position: 'relative', height: '100dvh', overflow: 'hidden', background: '#000' }}>
  <video style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

  {/* Bottom overlay — title + link */}
  <div style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: '72px',   // leave room for right-rail
    padding: '16px 16px calc(env(safe-area-inset-bottom) + 56px + 16px) 16px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
    zIndex: 10,
  }}>
    <p>{video.headline}</p>
    <a href={video.source_url}>Leer artículo completo</a>
  </div>

  {/* Right-rail social buttons */}
  <div style={{
    position: 'absolute',
    right: '12px',
    bottom: 'calc(env(safe-area-inset-bottom) + 56px + 80px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    zIndex: 10,
  }}>
    {/* Like → Bookmark → Comment */}
  </div>
</div>
```

**Key insight:** The `feed-item` CSS class already sets `height: 100dvh; overflow: hidden`. VideoItem just needs to stop using flex-column layout and switch to absolute positioning.

### Pattern 2: Solid Scrollable Category Tab Bar

**What:** A fixed-height bar at the top of the viewport (below `env(safe-area-inset-top)`) that scrolls horizontally. The video feed starts below it.

**Current state:** Category pills float over the video with a gradient background overlay. The feed-container starts at `top: 0`.

**Target state:**
```
┌─────────────────────────────────┐
│  safe-area-inset-top            │ ← env()
├─────────────────────────────────┤
│  Category tab bar (44px)        │ ← solid #000 background, horizontal scroll
├─────────────────────────────────┤
│  Video feed (100dvh - tabH - safeTop) │ ← scroll container
└─────────────────────────────────┘
```

The VideoFeed wrapper changes to a flex column. The feed-container height becomes `calc(100dvh - 44px - env(safe-area-inset-top))` instead of `100dvh`. The scroll-snap math stays the same because each `feed-item` also changes to match.

**Scroll preservation:** The existing `tabScrollState` ref in VideoFeed already stores `{ activeIndex, scrollTop }` per category. No logic change needed — only the category switching UI changes from pill buttons to underline tabs.

**Scrollable tab implementation:**
```tsx
<div style={{
  overflowX: 'auto',
  scrollbarWidth: 'none',    // Firefox
  WebkitOverflowScrolling: 'touch',
  display: 'flex',
  gap: 0,
}}>
  {categories.map(cat => (
    <button key={cat} style={{
      flexShrink: 0,
      padding: '10px 16px',
      borderBottom: cat === category ? '2px solid white' : '2px solid transparent',
      color: cat === category ? 'white' : '#888',
      fontWeight: cat === category ? 600 : 400,
      background: 'none',
      border: 'none',
      borderBottom: ...,
    }}>
      {CATEGORY_LABELS[cat]}
    </button>
  ))}
</div>
```

**Note:** The `Category` type and `CATEGORY_LABELS` in VideoFeed are currently limited to `'finance' | 'tech'`. Expanding to more categories only requires updating these — no structural change.

### Pattern 3: Right-Rail Vertical Progress Dots (Instagram Stories-style)

**What:** Instead of horizontal dots at top-center, render a vertical column of dots on the right edge of the video, above the social rail.

**Current:** Dots are at `left: 50%; transform: translateX(-50%)` in VideoFeed, absolutely positioned.
**Target:** Move to `right: 12px` in VideoFeed, change `flexDirection` from `row` to `column`, change dot orientation (width/height swap).

```tsx
// Progress dots — vertical column, right edge
<div style={{
  position: 'absolute',
  right: '12px',
  top: 'calc(env(safe-area-inset-top) + 44px + 16px)',  // below tab bar
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignItems: 'center',
  pointerEvents: 'none',
}}>
  {videos.map((_, idx) => (
    <div key={idx} style={{
      width: '3px',
      height: idx === activeIndex ? '20px' : '6px',  // active = taller
      borderRadius: '2px',
      background: idx === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
      transition: 'height 0.25s ease, background 0.25s ease',
    }} />
  ))}
</div>
```

### Pattern 4: Safe-Area-Correct Tab Bar

**What:** The current TabBar sets `height: 56px` but only applies `paddingBottom: env(safe-area-inset-bottom)`. On iPhones with a home indicator, the safe area inset is 34px, making the total tappable height only 56px but total element height 90px. The icons/labels render in the 56px zone and appear cut off if the browser clips to 56px.

**Fix:** The total height should account for safe area:
```tsx
<div style={{
  position: 'fixed',
  bottom: 0,
  height: 'calc(56px + env(safe-area-inset-bottom))',
  paddingBottom: 'env(safe-area-inset-bottom)',
  background: '#000',
  // ...
}}>
```
This ensures the tab bar always has 56px of tap area above the safe area.

### Pattern 5: ProfilePage Sticky Inner Tab Bar

**What:** The header (avatar, name) should scroll away. The Liked/Saved tabs should stick to the top. The content grid below should extend to fill the full width/screen width.

**Current:** ProfilePage is a single `overflowY: auto` div. The tab bar is inline with no `position: sticky`.

**Fix — sticky inner tab bar:**
```tsx
// The Liked/Saved tab bar sticks below the category bar equivalent (safe-area-top)
<div style={{
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: '#000',
  display: 'flex',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}}>
  {/* Liked / Saved buttons */}
</div>
```

**Grid fill issue:** `VideoGrid` currently has no explicit `width` or `min-height` on the container. When few videos are present, the empty space below isn't filled. Fix: ensure the grid container or ProfilePage content area uses `minHeight: '100%'` or `flex: 1`.

### Pattern 6: Thumbnail Generation in Pipeline

**What:** Extract a single JPEG frame from the assembled MP4 and upload it to Supabase Storage.

**FFmpeg command:**
```bash
ffmpeg -i story_{position}.mp4 -ss 0.5 -vframes 1 -q:v 2 story_{position}_thumb.jpg
```
- `-ss 0.5` — seek to 0.5s (avoids black first frame common in b-roll)
- `-vframes 1` — extract exactly one frame
- `-q:v 2` — JPEG quality 2 (scale: 2=best, 31=worst); produces ~30-80KB files

**Storage path:** `editions/{folder}/{position}_thumb.jpg` — same bucket (`videos`) as the MP4.

**DB change required:** Add `thumbnail_url text` column to `videos` table.

```sql
-- Migration
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
```

**Pipeline integration point:** Extract thumbnail inside `assemble()` in `video.py` (or as a separate call in `run.py` after `assemble()`). Extract after the final encode pass so the thumbnail reflects the actual output.

**VideoResult model update:**
```python
@dataclass
class VideoResult:
    story_id: str
    position: int
    status: str
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None  # NEW
    error: Optional[str] = None
```

**API response:** `thumbnail_url` needs to be included in the Supabase select query in `/api/today/route.ts` and the `Video` TypeScript interface in `useEdition.ts`.

**VideoGrid change:** Replace `<video src={video.video_url} preload="metadata">` with `<img src={video.thumbnail_url ?? ''} loading="lazy">`. If `thumbnail_url` is null (existing videos without thumbnails), show the `#111` placeholder background.

### Anti-Patterns to Avoid

- **Don't change scroll-snap logic:** The `Math.round(scrollTop / clientHeight)` index tracking is battle-tested. The full-screen video change keeps each `feed-item` at exactly `100dvh`, so the math stays correct.
- **Don't use IntersectionObserver:** Project decision (Phase 6 comment in VideoFeed) — scroll event is more reliable for scroll-snap feeds.
- **Don't touch socialState logic:** Social mutations and the `processingLike/processingBookmark` debounce are unchanged — only the *rendering position* of social buttons moves.
- **Don't use `height: 100vh` on tab bar child items:** Use `100dvh` consistently — `100vh` breaks on iOS Safari when the address bar is visible.
- **Don't hardcode tab bar height in VideoItem paddingBottom:** VideoItem won't know about the category tab bar height. Pass the bottom safe space as a prop, or use CSS env vars + a CSS variable for tab bar height.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS safe area values | JS measurement | `env(safe-area-inset-bottom/top)` CSS | Browser provides correct values; JS reads stale values before layout |
| Horizontal scroll without scrollbar | Custom drag handler | CSS `overflow-x: auto; scrollbar-width: none` | Native scroll handles momentum, pull, touch |
| JPEG thumbnail from video | Canvas `drawImage` on `<video>` | FFmpeg `-vframes 1` in pipeline | Canvas approach requires video to fully load on server; FFmpeg is synchronous and already in pipeline |
| Sticky header in scrollable container | `position: fixed` with JS offset | `position: sticky; top: 0` | Sticky is scoped to scroll container; no JS needed |

---

## Common Pitfalls

### Pitfall 1: feed-container height mismatch after adding solid tab bar
**What goes wrong:** Adding a 44px solid category tab bar above the feed without adjusting `feed-container` height makes each snap item slightly taller than the viewport, causing the snap points to misalign.
**Why it happens:** `.feed-item { height: 100dvh }` but the scroll container starts at `top: 44px`, so the visible portion is `100dvh - 44px`. Scroll-snap still snaps to multiples of `100dvh` not multiples of `100dvh - 44px`.
**How to avoid:** Set `.feed-container` and `.feed-item` height to `calc(100dvh - 44px - env(safe-area-inset-top))`. The category tab bar height must be a CSS variable or constant shared between the CSS class and the React component rendering it.
**Warning signs:** After scrolling, active video is not fully visible at top; partial previous video visible at bottom.

### Pitfall 2: Bottom overlay paddingBottom off-by-one layers
**What goes wrong:** The bottom overlay in VideoItem must clear both the floating TabBar (`56px + safe-area-inset-bottom`) AND add breathing room for text. Using only `paddingBottom: 80px` hardcode may under-clear on iPhone 14 Pro (34px home indicator + 56px TabBar = 90px minimum).
**Why it happens:** Safe area is device-specific (0 on iPhone SE, 34px on iPhone 14+).
**How to avoid:** Use `calc(env(safe-area-inset-bottom) + 56px + 16px)` for bottom padding in overlays above the tab bar.

### Pitfall 3: Right-rail buttons hidden behind CommentSheet z-index
**What goes wrong:** The right-rail social buttons at `zIndex: 10` will be occluded by CommentSheet (rendered at the feed level with high z-index). This is correct behavior — the sheet should cover the buttons.
**Why it happens:** The sheet is positioned above the video.
**How to avoid:** This is intentional; verify CommentSheet z-index (currently not explicitly set) is higher than the right-rail z-index. If not, CommentSheet may appear behind buttons.

### Pitfall 4: iOS Safari `<video preload="metadata">` black thumbnail on first render
**What goes wrong:** iOS Safari PWA does not load video poster/first frame from `preload="metadata"` reliably in scroll containers. The `<video>` tag shows a black box until tapped.
**Why it happens:** iOS defers video decode in PWA standalone mode to conserve battery. This is the reason thumbnails appear black — a known iOS behavior since iOS 14.
**How to avoid:** The user's decision (locked) is correct — serve static JPEG thumbnails from pipeline; use `<img>` in VideoGrid. No workaround exists for the `<video>` approach on iOS PWA.

### Pitfall 5: `tabScrollState` type needs updating for expanded category list
**What goes wrong:** `tabScrollState` is typed as `Record<Category, ...>` where `Category = 'finance' | 'tech'`. Initialised with explicit keys. Switching to dynamic categories (if ever expanded to Sports, Science, etc.) requires updating both the type and the initialiser.
**Why it happens:** TypeScript Record type enforces all keys present at init.
**How to avoid:** For Phase 12, categories stay as `'finance' | 'tech'` — no type change needed. If expanding categories later, change to `Partial<Record<Category, ...>>` with default on access.

### Pitfall 6: Pipeline thumbnail extraction adds time per video
**What goes wrong:** FFmpeg thumbnail extraction (~0.2s per video) adds ~1s to a 5-video pipeline run. If the pipeline is run on a time-sensitive cron, this accumulates.
**Why it happens:** Additional FFmpeg subprocess per story.
**How to avoid:** Thumbnail extraction is negligible vs. video encode time (~20-60s per story). It is fine to add after the final encode. Document that pipeline timing is not materially affected.

### Pitfall 7: `thumbnail_url` null for existing videos in DB
**What goes wrong:** All existing videos in the DB have no `thumbnail_url`. VideoGrid will show blank/placeholder tiles for all profile grid videos unless handled.
**Why it happens:** Column is new; backfill is not feasible for Pexels b-roll based videos.
**How to avoid:** VideoGrid must gracefully handle `thumbnail_url: null` by rendering a `#111` background placeholder div. Do not use the video_url as a fallback (defeats the purpose). Add a subtle headline overlay on the placeholder to provide context.

---

## Code Examples

### Thumbnail extraction in `video.py`

```python
def extract_thumbnail(mp4_path: Path, tmp_dir: Path, position: int) -> Path:
    """
    Extract a single JPEG frame at 0.5s from assembled MP4.
    Returns path to JPEG thumbnail.
    """
    thumb_path = tmp_dir / f"story_{position}_thumb.jpg"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(mp4_path),
        "-ss", "0.5",
        "-vframes", "1",
        "-q:v", "2",
        str(thumb_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Thumbnail extraction failed:\n{result.stderr[-1000:]}")
    return thumb_path
```

### Upload thumbnail in `storage.py`

```python
def upload_thumbnail(local_path: Path, edition_id: str, position: int, edition_date: str, category: str = "finance") -> str:
    db = get_db()
    folder = f"{category}-{edition_date}-{edition_id[:8]}"
    storage_path = f"editions/{folder}/{position}_thumb.jpg"
    with open(local_path, "rb") as f:
        db.storage.from_(BUCKET).upload(
            storage_path,
            f,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
    url = db.storage.from_(BUCKET).get_public_url(storage_path)
    return url
```

### VideoGrid with thumbnail fallback

```tsx
// In VideoGrid — thumbnail-first, placeholder fallback
{videos.map(video => (
  <div key={video.id} onClick={() => router.push(`/?videoId=${video.id}`)}
    style={{ position: 'relative', aspectRatio: '1', cursor: 'pointer', overflow: 'hidden', background: '#111' }}
  >
    {video.thumbnail_url ? (
      <img
        src={video.thumbnail_url}
        alt={video.headline}
        loading="lazy"
        style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
      />
    ) : (
      // Placeholder for pre-thumbnail videos
      <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'flex-end' }}>
        <p style={{ padding: '6px', fontSize: '0.65rem', color: '#555', lineHeight: 1.2 }}>{video.headline}</p>
      </div>
    )}
  </div>
))}
```

### CSS for feed layout with solid category bar

```css
/* globals.css — tab bar height as CSS custom property */
:root {
  --category-bar-height: 44px;
}

.feed-container {
  /* subtract safe-area-top and category bar from full viewport height */
  height: calc(100dvh - env(safe-area-inset-top) - var(--category-bar-height));
  /* existing scroll-snap properties unchanged */
}

.feed-item {
  height: calc(100dvh - env(safe-area-inset-top) - var(--category-bar-height));
  /* existing snap properties unchanged */
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `100vh` for full-screen mobile | `100dvh` (dynamic viewport height) | Prevents layout shift when iOS Safari address bar hides/shows |
| `video preload="metadata"` for grid thumbnails | Static JPEG via FFmpeg + `<img>` | Reliable iOS PWA rendering; 10x smaller payload per grid cell |
| Overlay tabs with gradient | Solid opaque scrollable tab bar | Clearer visual hierarchy; scales to N categories |

---

## Open Questions

1. **Category expansion — when does `tabScrollState` need to be typed dynamically?**
   - What we know: Phase 12 stays with `finance | tech`. The tab bar is designed to scroll, so more categories can be added visually.
   - What's unclear: If categories are added post-Phase-12, `tabScrollState` type will need updating. Not a Phase 12 concern.
   - Recommendation: Add a comment in VideoFeed noting the type constraint.

2. **Thumbnail backfill for existing videos**
   - What we know: Existing videos have `thumbnail_url = null`. VideoGrid will show placeholders.
   - What's unclear: Is a backfill script needed, or is placeholder UX acceptable?
   - Recommendation: Placeholder UX is acceptable for Phase 12. The pipeline will generate thumbnails for all new videos going forward. Add a note in the plan to document the null-handling behavior.

3. **Right-rail button spacing on small screens (iPhone SE, 375px wide)**
   - What we know: iPhone SE is 375px × 667px. Right rail at 12px from right edge with 44px icon area leaves ~319px for video content at left.
   - What's unclear: Whether the bottom overlay title text (left side) will overflow into the right-rail zone.
   - Recommendation: Set `right: '72px'` on the bottom overlay to give the right rail clear space. Test at 375px width.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `VideoItem.tsx`, `VideoFeed.tsx`, `TabBar.tsx`, `ProfilePage.tsx`, `VideoGrid.tsx`, `globals.css` — current implementation baseline
- `useEdition.ts` — Video TypeScript interface, API data shape
- `pipeline/video.py`, `pipeline/storage.py`, `pipeline/run.py`, `pipeline/models.py` — pipeline architecture for thumbnail integration
- `supabase/migrations/20260224000000_initial_schema.sql` — current DB schema
- `app/api/today/route.ts` — API query shape, confirms `thumbnail_url` must be added to select

### Secondary (MEDIUM confidence)
- iOS Safari PWA video decode behavior: widely documented behavior (MDN, WebKit bug reports, StackOverflow) — `<video preload="metadata">` does not load poster frames reliably in iOS standalone mode; static images are the accepted solution
- CSS `env(safe-area-inset-*)`: W3C spec, supported in all modern browsers including iOS Safari — HIGH confidence
- CSS `position: sticky` in overflow containers: standard CSS behavior, well-supported — HIGH confidence

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns use existing tools
- Architecture: HIGH — based on direct code inspection; patterns derived from existing code structure
- Pitfalls: HIGH for iOS/CSS issues (well-documented), MEDIUM for spacing specifics (device-dependent)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain — no fast-moving dependencies)
