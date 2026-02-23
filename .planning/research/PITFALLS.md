# Domain Pitfalls: FinFeed (AI Video Pipeline + PWA)

**Domain:** AI video generation pipeline + mobile-first PWA (financial news)
**Researched:** 2026-02-23
**Confidence:** MEDIUM — training knowledge (cutoff Aug 2025) on all 10 areas; external verification tools unavailable during this session

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or complete MVP failure.

---

### Pitfall 1: iOS Safari Autoplay — Muted-Then-Unmute Race Condition

**What goes wrong:** Developers assume `video.muted = true` + `video.play()` always works on iOS Safari. It does — but only under strict conditions. The common failure is calling `video.play()` before the DOM is ready, or calling it outside a user gesture context when trying to unmute. The tap-to-unmute pattern in PROJECT.md ("first video autoplays muted; tap-to-unmute persists audio across session") hits a specific iOS bug: once you unmute a video programmatically (`video.muted = false`) outside of a direct user gesture handler on that exact video element, Safari resets it to muted and the play() promise rejects silently.

**Why it happens:**
- iOS Safari's autoplay policy: muted autoplay is allowed, but unmuting requires a direct user gesture (touchend/click) on the video element itself or a `play()` call chained directly inside the event handler synchronously.
- Developers unmute in a timeout, in a promise `.then()`, or in a gesture handler on a *different* element (e.g., an overlay div). Safari treats all of these as "not a user gesture" and silently re-mutes.
- The preload-next-video pattern exacerbates this: if you call `play()` on a preloaded video that isn't visible, iOS suspends it. When the user swipes to it, calling `play()` again may fail because there's no fresh gesture.

**Consequences:** Users hear no audio after tapping unmute. The bug is invisible on desktop Chrome (which is permissive). Developers don't catch it until testing on a real iOS device.

**Prevention:**
```javascript
// WRONG — unmuting in a promise chain breaks iOS
video.addEventListener('click', async () => {
  video.muted = false;
  await video.play(); // May reject on iOS
});

// CORRECT — synchronous unmute + play inside the gesture handler
video.addEventListener('click', () => {
  video.muted = false;
  const p = video.play();
  if (p !== undefined) {
    p.catch(() => {
      // Autoplay was prevented — show play button UI
      video.muted = true;
    });
  }
});
```

For preloading: preload the `<video>` element and set `preload="auto"` but do NOT call `play()` on non-visible videos. Call `play()` only after the snap-scroll animation ends and the video is fully in the viewport.

**Detection (warning signs):**
- Works fine in Chrome desktop/Android but fails on iPhone
- Audio works on first video but not on videos 2-5 after swiping
- `video.paused` is true even though `play()` was called

**Phase that should address this:** PWA frontend build phase. Must test on real iOS device (not simulator) before shipping. Add an iOS-specific integration test or manual checklist item.

---

### Pitfall 2: TTS Timestamp Assumption — OpenAI TTS Returns No Word Timestamps

**What goes wrong:** The single most common architectural mistake for this type of project. Developers assume TTS APIs return word-level timestamps (like AWS Polly's Speech Marks or Azure's viseme stream). OpenAI `tts-1` and `tts-1-hd` return only an audio file (MP3/Opus/AAC/FLAC/WAV/PCM). No timestamps. No alignment data. Nothing.

**Why it happens:** AWS Polly, Azure TTS, Google Cloud TTS, and ElevenLabs all offer timestamp/boundary data. OpenAI is the exception. Developers who have used any other TTS provider expect this feature. The OpenAI docs don't prominently warn about the omission — they just don't mention timestamps.

**Consequences:** Without timestamps, subtitle sync is impossible if you try to generate it from the API. Developers hit this wall after building the TTS step and having to rearchitect subtitle generation. Common bad fix: hardcode subtitle timing based on word count / estimated speech rate — this drifts badly for financial terms (e.g., "quantitative easing" takes longer than its character count suggests).

**The correct approach — forced alignment:**
Use Whisper (the open-source speech recognition model) to align the generated audio back to the script text:

```python
# Step 1: Generate audio with OpenAI TTS
audio_bytes = openai.audio.speech.create(
    model="tts-1",
    voice="onyx",
    input=script_text
)

# Step 2: Run Whisper on the generated audio to get word timestamps
import whisper
model = whisper.load_model("base")  # "base" is fast enough for pipeline
result = model.transcribe(
    audio_file_path,
    word_timestamps=True,
    language="en"
)
# result["segments"][i]["words"] contains [{word, start, end}]
```

Whisper with `word_timestamps=True` is accurate to ~50ms on clean TTS audio. This approach adds ~10-20 seconds to pipeline runtime using `whisper-base` on CPU (GitHub Actions). Use `whisper-base` not `whisper-large` — the latter is too slow for a batch pipeline and the audio is clean synthetic speech.

**Detection (warning signs):**
- Subtitle text appears out of sync at the 10-15 second mark
- Financial terms ("Fed funds rate") cause subtitles to lag behind audio
- Subtitle timing is correct at video start but drifts toward the end

**Phase that should address this:** Pipeline build phase, specifically the TTS + subtitle generation step. Design the pipeline to include the Whisper alignment step from day one — retrofitting it after burning subtitles into 5 videos per day is painful.

---

### Pitfall 3: FFmpeg Subtitle Burning — Font Not Embedded, Encoding Failures

**What goes wrong:** Four common FFmpeg subtitle mistakes in this pipeline:

**3a. Font not available in GitHub Actions runner**
The `subtitles` filter in FFmpeg uses fonts from the host system. GitHub Actions uses Ubuntu runners. If the script specifies `FontName=Roboto` in the ASS subtitle file but Roboto isn't installed, FFmpeg silently falls back to DejaVu Sans or another system font — no error, just wrong font. This causes visual inconsistency across environments.

**Prevention:** Bundle fonts in the repo and pass them to FFmpeg explicitly:
```bash
# Install font in CI runner
- name: Install fonts
  run: |
    mkdir -p ~/.fonts
    cp ./assets/fonts/Roboto-Bold.ttf ~/.fonts/
    fc-cache -fv

# OR pass fontsdir to FFmpeg subtitles filter
ffmpeg -i input.mp4 \
  -vf "subtitles=subtitles.ass:fontsdir=/repo/assets/fonts" \
  output.mp4
```

**3b. ASS subtitle encoding — UTF-8 BOM breaks FFmpeg**
If the ASS file is saved with a UTF-8 BOM (common when generated by Python on Windows or by certain libraries), FFmpeg fails to parse it on Linux. Always write ASS files with `encoding='utf-8'` (not `'utf-8-sig'`) in Python.

**3c. SRT timing drift when audio length doesn't match script estimate**
If you generate SRT timing based on estimated word rate and the actual TTS audio is 10% longer, every subtitle after the midpoint drifts. See Pitfall 2 — use Whisper alignment, don't estimate timing.

**3d. `libass` not compiled in GitHub Actions FFmpeg**
The default `ffmpeg` package on Ubuntu (`apt-get install ffmpeg`) is compiled with libass. However, if the pipeline uses a custom ffmpeg binary or a specific version via action, libass may not be included. The `subtitles` filter silently fails or produces an error about missing filter.

**Prevention:** Verify at pipeline start:
```bash
ffmpeg -filters 2>/dev/null | grep subtitles
# Must show: ... subtitles  V->V  Render text subtitles onto input video.
```

**Detection (warning signs):**
- Subtitles render in wrong font on CI but correct locally
- ASS file parses fine locally but fails on Ubuntu runner
- Subtitle text appears but is incorrectly timed

**Phase that should address this:** Pipeline build phase. Add an FFmpeg validation step that checks for libass and font availability before the main render loop.

---

### Pitfall 4: GitHub Actions — Disk Space Exhaustion and Timeout

**What goes wrong:** GitHub Actions free tier hosted runners (ubuntu-latest) have 14 GB of SSD disk space. A pipeline processing 5 videos per run, each with b-roll (300-500MB MP4) plus intermediate files, can easily exhaust disk space mid-run.

**Specific limits (as of mid-2025):**
- Job timeout: 6 hours maximum (free tier)
- Artifact storage: 500 MB per artifact, 2 GB total per repo (free tier, 90-day retention)
- Disk space: ~14 GB on ubuntu-latest
- Concurrent jobs: 20 (free tier)

**What happens when disk is full:** FFmpeg exits with a cryptic error ("No space left on device") mid-render. The pipeline doesn't fail gracefully — it leaves corrupted output files and may not clean up intermediate files.

**Why it happens:** Developers download 5 b-roll clips (each 2-4 minutes of 1080p footage) without cleaning up as they go. Plus the tts audio files, the intermediate video files (video without audio, video with audio before subtitle burn), and the final outputs.

**Prevention:**
```yaml
# Clean up intermediate files immediately after each video
- name: Process videos
  run: |
    for i in 1 2 3 4 5; do
      python pipeline.py --story $i
      # Delete b-roll and intermediate files immediately
      rm -f /tmp/broll_$i.mp4 /tmp/raw_$i.mp4 /tmp/audio_$i.mp3
    done
```

Use streaming downloads for b-roll (pipe directly into FFmpeg instead of saving to disk):
```bash
# Instead of: wget broll.mp4 && ffmpeg -i broll.mp4 ...
# Do: ffmpeg -i "$(python get_broll_url.py)" -i audio.mp3 ...
```

For artifacts: upload final videos directly to Supabase Storage from the runner — don't use GitHub Actions artifacts for video files. 500 MB limit per artifact means a single 1080p video may exceed it.

**Detection (warning signs):**
- CI job fails at video 3 or 4 but not video 1 or 2
- Error logs mention "No space left on device" or FFmpeg exits with code 1
- `df -h` shows less than 2 GB free mid-job

**Phase that should address this:** Pipeline infrastructure phase. Add disk space monitoring early in the job and aggressive cleanup. Set per-job file size targets (each video output < 50 MB for 30-45 second clips at reasonable quality).

---

### Pitfall 5: Groq Free Tier — Rate Limits Kill the Pipeline Mid-Run

**What goes wrong:** Groq free tier rate limits are aggressive and vary by model. For Llama 3.3 (70B), as of 2025 the limits are approximately:
- 30 requests per minute
- 14,400 tokens per minute (TPM)
- 1,000 requests per day (RPD)

The pipeline runs 1-2x per day and sends approximately 5 LLM calls (one per story script). This is well within RPD limits. However: the script generation prompt includes the news article text (potentially 500-1000 tokens input) plus generates a 30-45 second script (~150-200 words = ~200-250 tokens output). Multiply by 5 stories = ~6,000-7,000 tokens total. This is safe on a single run.

**The real risk: Error handling when Groq is unavailable.** Groq free tier has occasional outages (it's a free, rate-limited service). If story 3's script generation fails with a 503 or rate limit error and the pipeline has no retry logic, the entire run fails — 0 videos get uploaded for the day.

**Consequences:** Users see yesterday's videos instead of today's. No alerting. Pipeline silently fails.

**Prevention:**
```python
import time
from groq import Groq, RateLimitError, APIError

def generate_script(story_text, retries=3, backoff=30):
    for attempt in range(retries):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[...],
                max_tokens=400,
            )
            return response.choices[0].message.content
        except RateLimitError:
            if attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))
            else:
                raise
        except APIError as e:
            if e.status_code >= 500 and attempt < retries - 1:
                time.sleep(backoff)
            else:
                raise
```

Also: if one story fails after retries, generate 4 videos instead of 5 — don't abort the whole run.

**Detection (warning signs):**
- Pipeline fails consistently at the same story position
- Groq returns HTTP 429 (rate limit) or 503 (service unavailable)
- No videos uploaded despite GitHub Actions job appearing to start

**Phase that should address this:** Pipeline reliability phase. Implement retry + partial-failure logic before first deployment.

---

## Moderate Pitfalls

---

### Pitfall 6: Pipeline Partial Failure — All-Or-Nothing Anti-Pattern

**What goes wrong:** A pipeline that treats 5 videos as an atomic unit fails completely if any one story encounters an error. This is the most common pipeline design mistake for batch jobs.

**Why it happens:** Developers write sequential Python scripts without per-item error isolation:
```python
# BAD — one failure kills everything
for story in stories:
    audio = generate_tts(story)      # story 3 TTS fails
    video = assemble_video(audio)    # never reached
    upload(video)                    # never reached
```

**Prevention:** Wrap each story in a try/except, track successes and failures, upload whatever completed:
```python
results = []
for i, story in enumerate(stories):
    try:
        audio = generate_tts(story)
        video = assemble_video(audio)
        url = upload_to_supabase(video)
        results.append({"story": i, "status": "ok", "url": url})
    except Exception as e:
        results.append({"story": i, "status": "failed", "error": str(e)})
        continue  # Keep going

# Write results manifest — even if only 3/5 succeeded
save_manifest_to_supabase(results)
```

The frontend reads the manifest and displays however many videos succeeded (minimum: show "fewer videos today" state rather than nothing).

**Detection (warning signs):**
- Any single failure results in zero videos for the day
- No per-story progress logging in pipeline output
- No manifest/results file in Supabase after a failed run

**Phase that should address this:** Pipeline build phase, from the start. Design for partial success.

---

### Pitfall 7: Supabase Storage — CORS, Public URLs, and Free Tier Bandwidth

**What goes wrong:** Three distinct Supabase Storage issues:

**7a. CORS misconfiguration for video streaming**
Supabase Storage public buckets don't have wildcard CORS by default. When the PWA (served from Vercel) tries to fetch a video from Supabase Storage, browsers block it as a cross-origin request. The video element may appear to load (no network error) but stalls at 0% because preflight OPTIONS requests fail silently on range requests.

**Prevention:** Set CORS in Supabase dashboard → Storage → Policies. Add the Vercel domain explicitly, or use `*` for public content:
```json
{
  "AllowedOrigins": ["https://yourapp.vercel.app", "http://localhost:3000"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"]
}
```

The `Content-Range` and `Accept-Ranges` headers are critical — without them, the browser video player cannot do range requests, causing the entire video to buffer before playing.

**7b. Public URL format changes**
Supabase changed the public URL format between projects. The pattern is:
`https://<project-id>.supabase.co/storage/v1/object/public/<bucket>/<path>`

Don't hardcode URL formats — use the Supabase client SDK's `getPublicUrl()` method to get the URL.

**7c. Free tier bandwidth**
Supabase free tier includes 1 GB storage and 2 GB egress bandwidth per month. At 5 videos/day × ~20 MB per video × 30 days = 3 GB storage/month. You will exceed free tier storage. Options: compress videos aggressively (target < 10 MB per 30-45s clip at 720p), or accept the $25/month Supabase Pro plan.

**Detection (warning signs):**
- Video plays locally with direct URL but not in PWA
- Network tab shows `net::ERR_FAILED` on OPTIONS preflight
- Storage dashboard shows approaching 1 GB limit

**Phase that should address this:** Infrastructure setup phase. Configure CORS before writing any frontend video code. Target video file size in FFmpeg encoding settings.

---

### Pitfall 8: PWA Service Worker + Video — Range Request Failures

**What goes wrong:** Developers add a service worker for PWA installability and cache video files. The service worker intercepts all fetch requests including the range requests browsers use for video streaming. If the service worker doesn't properly handle range requests, it returns the full response with status 200 instead of 206 (Partial Content), which causes:
- Safari to refuse to play the video
- Chrome to buffer the entire file before starting playback
- Memory usage to spike (entire video file loaded into memory)

**Why it happens:** The default service worker `cache.match()` ignores request headers. A range request for bytes 0-100000 and a range request for bytes 100001-200000 both match the same cache entry, but the response must be the correct byte range.

**The correct approach:** Do NOT cache video files in the service worker. Cache the app shell (HTML, CSS, JS) but let video requests pass through to the network with proper range request support:

```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pass video requests directly to network — don't cache
  if (url.pathname.includes('/storage/v1/object/') ||
      event.request.destination === 'video') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache app shell normally
  event.respondWith(cacheFirst(event.request));
});
```

**Detection (warning signs):**
- Videos play in regular browser tab but not when installed as PWA
- First load works, subsequent loads (from cache) fail or buffer fully
- Memory usage climbs with each video view (never freed)

**Phase that should address this:** PWA frontend phase. Add the video exclusion to the service worker from the start — retrofitting service worker logic is error-prone.

---

### Pitfall 9: LLM Hallucinations in Financial Scripts

**What goes wrong:** Llama 3.3 (and all LLMs) will confidently fabricate specific financial data points: exact stock prices, percentage changes, earnings figures, specific CEO quotes, and interest rate decisions. In a financial news context, this is not just a product quality issue — it exposes the product to reputational and potentially legal risk.

**Why it happens:** The LLM is prompted to write a "financial influencer" script based on a news article. It extrapolates from partial information, fills gaps with plausible-sounding numbers, and sometimes ignores the source text entirely when generating a compelling narrative.

**Common fabrications:**
- "Apple stock rose 3.7% to $198.42" (wrong price/percentage)
- "Fed raised rates by 25 basis points to 5.5%" (outdated or wrong)
- "CEO Elon Musk said..." (wrong CEO or fabricated quote)

**Prevention — prompt engineering:**
```
System prompt rules (enforce strictly):
1. You MUST only include specific numbers (prices, percentages, dates) that appear
   VERBATIM in the source article provided. Do not calculate, estimate, or extrapolate.
2. If the article does not include a specific figure, describe the trend generally
   without numbers: "stocks rose" not "stocks rose 2.4%".
3. Do not attribute quotes to any person unless the exact quote appears in the source.
4. Do not reference events not covered in the source article.
```

Also: use a structured output format and validate it:
```python
# After script generation, check for suspicious patterns
import re
def validate_script(script, source_article):
    # Extract all percentages and prices from script
    script_numbers = re.findall(r'\d+\.?\d*%|\$\d+\.?\d*', script)
    # Verify each appears in source article
    for num in script_numbers:
        if num not in source_article:
            raise ValueError(f"Hallucinated figure: {num}")
```

**Detection (warning signs):**
- Script contains specific stock prices not mentioned in source article
- Script quotes executives with statements not in the source
- Same story run twice produces different specific numbers

**Phase that should address this:** Pipeline build phase, specifically prompt engineering and script validation. This is non-negotiable for a financial product.

---

### Pitfall 10: RSS Feed Reliability — Malformed Feeds and Duplicate Stories

**What goes wrong:** Financial RSS feeds (Yahoo Finance, Reuters) are inconsistent:
- Feed URLs change without warning (Yahoo Finance has changed its RSS URLs multiple times)
- Feeds return malformed XML intermittently (unclosed tags, encoding issues)
- The same story appears in multiple feeds (e.g., Reuters publishes, Yahoo Finance syndicates)
- Feeds return 200 OK with error HTML instead of XML during outages
- Story published timestamps are unreliable (some use UTC, some use publisher local time)

**Why it happens:** RSS is a legacy protocol with no enforced schema. Financial news aggregators often syndicate the same AP/Reuters wire stories across multiple feeds.

**Consequences:** Duplicate stories in the same daily batch (5 videos about the same topic), or zero stories when feeds are down, or pipeline crash on malformed XML.

**Prevention:**
```python
import feedparser
import hashlib

def fetch_and_deduplicate(feed_urls):
    seen = set()
    stories = []

    for url in feed_urls:
        try:
            feed = feedparser.parse(url)
            if feed.bozo:  # feedparser flag for malformed feed
                continue   # Skip malformed, don't crash
            for entry in feed.entries:
                # Deduplicate by title fingerprint
                key = hashlib.md5(entry.title.lower().encode()).hexdigest()
                if key not in seen:
                    seen.add(key)
                    stories.append(entry)
        except Exception:
            continue  # One feed down doesn't kill the run

    return stories
```

For URL changes: don't hardcode feed URLs — store them in a config file or Supabase table that can be updated without redeploying.

**Detection (warning signs):**
- Multiple videos in same batch cover the same story
- Pipeline fails with XML parse errors
- `feedparser` `bozo` attribute is True (indicates parse error)

**Phase that should address this:** Pipeline build phase, specifically the RSS ingestion step. Test with all target feeds and handle the malformed-feed case from day one.

---

## Minor Pitfalls

---

### Pitfall 11: Video Preloading Memory Leak on Mobile

**What goes wrong:** Preloading 2-3 videos simultaneously on mobile by setting `preload="auto"` on all of them can exhaust mobile browser memory (iOS Safari limits page memory to ~200-400 MB depending on device). When memory pressure occurs, Safari unloads video data, causing buffering on swipe — exactly the problem preloading was meant to solve.

**Prevention:** Preload the next video only (not 2-3 ahead). Use `preload="metadata"` for videos 3+ to get duration without loading media data. Release the previous video's source after the user passes it:
```javascript
function onSwipeComplete(newIndex) {
  // Release previous video memory
  if (newIndex > 0) {
    videos[newIndex - 1].src = '';
    videos[newIndex - 1].load();
  }
  // Preload only the next one
  if (newIndex + 1 < videos.length) {
    videos[newIndex + 1].preload = 'auto';
  }
}
```

**Phase that should address this:** PWA frontend phase.

---

### Pitfall 12: B-Roll Licensing — Pexels/Pixabay API Rate Limits

**What goes wrong:** Pexels API free tier allows 200 requests/hour and 20,000 requests/month. Pixabay allows 100 requests/minute. The pipeline searches for relevant b-roll per story — 5 searches per run × 2 runs/day = 300 searches/month. This is safely within limits. However: if the search query returns no results (e.g., obscure financial instrument), the pipeline needs a fallback generic financial b-roll, not a crash.

**Prevention:** Always have 3-5 generic financial b-roll clips in `/assets/fallback/` as a last resort. The Pexels search should fall back to a generic "finance" query before falling back to local assets.

**Phase that should address this:** Pipeline build phase.

---

### Pitfall 13: Whisper on GitHub Actions — Model Download Latency

**What goes wrong:** If using `openai-whisper` Python library for forced alignment (see Pitfall 2), the first run downloads the Whisper model (~74 MB for base, ~461 MB for small, ~1.42 GB for medium). On GitHub Actions, this adds 30-60 seconds per run and counts against disk space.

**Prevention:** Cache the Whisper model directory in GitHub Actions:
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/whisper
    key: whisper-base-${{ runner.os }}
```

Alternatively, use `faster-whisper` (CTranslate2 backend) which is faster and uses less memory.

**Phase that should address this:** Pipeline infrastructure phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| TTS integration | Assuming OpenAI TTS returns timestamps (Pitfall 2) | Design Whisper alignment step from day one |
| FFmpeg subtitle burning | Font not available on CI runner (Pitfall 3) | Bundle fonts in repo, verify libass at pipeline start |
| GitHub Actions setup | Disk exhaustion on 5-video run (Pitfall 4) | Stream b-roll, cleanup after each video, target <15 MB/video |
| Groq integration | Silent failures on free tier (Pitfall 5) | Retry with backoff, partial success handling |
| Pipeline reliability | All-or-nothing failure (Pitfall 6) | Per-story try/except, results manifest |
| Supabase Storage setup | CORS blocking video in PWA (Pitfall 7) | Configure CORS + range request headers before frontend work |
| PWA service worker | Video range request failures (Pitfall 8) | Exclude video URLs from service worker cache |
| Script generation | LLM hallucinating financial figures (Pitfall 9) | Prompt constraints + figure validation regex |
| RSS ingestion | Malformed feeds crashing pipeline (Pitfall 10) | feedparser.bozo check, per-feed try/except |
| iOS video autoplay | Muted-then-unmute race condition (Pitfall 1) | Synchronous unmute in gesture handler, test on real device |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| iOS Safari autoplay behavior | HIGH | Well-documented WebKit policy, stable since iOS 10 |
| OpenAI TTS — no timestamps | HIGH | Confirmed absence in API docs through Aug 2025 |
| Whisper forced alignment approach | HIGH | Standard pattern, well-established in the field |
| GitHub Actions limits | MEDIUM | Limits may have changed post-Aug 2025; verify at project start |
| Groq free tier limits | MEDIUM | Free tier limits change frequently; verify current limits at groq.com |
| Supabase Storage CORS | HIGH | Standard Supabase behavior, unlikely to change |
| Supabase free tier bandwidth | MEDIUM | 2 GB egress was the limit as of Aug 2025; verify current |
| PWA service worker video | HIGH | Range request behavior is browser-standard, stable |
| LLM hallucination patterns | HIGH | General LLM behavior, not version-specific |
| RSS feed reliability | HIGH | RSS protocol limitations are structural, not version-specific |

---

## Sources

All findings based on training data (knowledge cutoff August 2025). External verification tools were unavailable during this research session.

- WebKit autoplay policy: https://webkit.org/blog/6784/new-video-policies-for-ios/ (policy, stable since iOS 10)
- OpenAI TTS API: https://platform.openai.com/docs/guides/text-to-speech (no timestamp data)
- Whisper word timestamps: https://github.com/openai/whisper (word_timestamps parameter)
- GitHub Actions usage limits: https://docs.github.com/en/actions/administering-github-actions/usage-limits-billing-and-administration
- Supabase Storage CORS: https://supabase.com/docs/guides/storage/cdn/fundamentals
- feedparser library: https://feedparser.readthedocs.io/en/latest/bozo.html (bozo flag)
- faster-whisper: https://github.com/SYSTRAN/faster-whisper

**Verification recommended before implementation:**
- Groq current rate limits: https://console.groq.com/docs/rate-limits
- Supabase current free tier limits: https://supabase.com/pricing
- GitHub Actions current disk space: https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners
