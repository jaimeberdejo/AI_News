# Phase 2: Pipeline - Research

**Researched:** 2026-02-24
**Domain:** Python batch pipeline — RSS ingestion, LLM scripting, TTS audio, Whisper alignment, FFmpeg video assembly, Supabase Storage upload
**Confidence:** HIGH (core stack fully verified via Context7 and official docs); MEDIUM (FFmpeg ASS subtitle generation patterns, RSS feed availability); LOW (Reuters RSS feeds — confirmed dead)

---

## Summary

Phase 2 builds the full Python batch pipeline: `python -m pipeline.run` ingests financial news RSS articles, selects stories via Groq Llama 3.3, generates TTS audio via OpenAI, aligns word-level timestamps via faster-whisper, assembles MP4 videos via FFmpeg subprocess, and uploads them to Supabase Storage. The pipeline must isolate per-story errors so a single failure does not abort the run, and must delete editions older than 7 days on each run.

The most technically complex parts are: (1) generating correct ASS subtitle files from faster-whisper word timestamps and burning them into video with FFmpeg, (2) ensuring b-roll duration matches audio duration via FFmpeg `-stream_loop`, and (3) the overall pipeline orchestration pattern (run record, per-story try/except, partial vs complete edition status). The rest of the stack is well-documented and straightforward to use via official Python clients.

One critical discovery: **Reuters RSS feeds have been dead since June 2020**. The REQUIREMENTS.md says "Yahoo Finance and Reuters RSS feeds" but Reuters cannot be used. Yahoo Finance (`https://finance.yahoo.com/news/rssindex`) and CNBC (`https://www.cnbc.com/id/10000664/device/rss/rss.html`) are the confirmed active replacements.

**Primary recommendation:** Use feedparser 6.x for RSS, Groq Python SDK for LLM scripting with `response_format={"type": "json_object"}`, OpenAI Python SDK for TTS streaming to file, faster-whisper tiny.en with `word_timestamps=True` for alignment, hand-craft ASS files from word timestamps (no external library needed), and FFmpeg subprocess for all video operations. Use Supabase Python SDK for upload and storage cleanup.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INGEST-01 | Pipeline fetches articles from Yahoo Finance and Reuters RSS feeds | feedparser 6.x handles both; Reuters feeds are dead — use Yahoo Finance + CNBC as dual sources |
| INGEST-02 | Pipeline deduplicates articles across runs (same story not reprocessed) | Store article URL hash or source_url in `videos` table; check before processing |
| SCRIPT-01 | LLM (Groq Llama 3.3) selects most important financial stories (variable count) | Groq Python SDK, `llama-3.3-70b-versatile`, `response_format={"type":"json_object"}` |
| SCRIPT-02 | LLM writes 30–45 second script per story in "financial influencer" tone | Same Groq client, separate prompt per selected story; 30-45s ≈ 75-115 words at 150 wpm |
| SCRIPT-03 | Each script stored in DB with source article reference before audio generation | Insert into `videos` table with `script_text` and `source_url` before TTS call |
| AUDIO-01 | OpenAI TTS (tts-1) converts each script to MP3 | `client.audio.speech.with_streaming_response.create(model="tts-1", voice=..., input=...)` |
| AUDIO-02 | faster-whisper (tiny.en) runs forced alignment on each audio to produce word-level timestamps | `WhisperModel("tiny.en").transcribe(audio_path, word_timestamps=True)` |
| AUDIO-03 | Word-level timestamps converted to ASS subtitle file for FFmpeg burning | Hand-craft ASS from `word.start`, `word.end`, `word.word` — no extra library needed |
| VIDEO-01 | Download relevant Pexels b-roll clip per story | Pexels API `GET /videos/search?query=...&orientation=portrait&size=medium` + requests download |
| VIDEO-02 | FFmpeg assembles video: b-roll + audio + burned subtitles → MP4 | `ffmpeg -stream_loop -1 -i broll.mp4 -i audio.mp3 -vf "ass=subs.ass,scale=720:1280" -crf 28` |
| VIDEO-03 | Output video ≤10 MB at 720p, CRF 28 | Verified: CRF 28 at 720p is ~5-6% of source; 30-45s TTS + static b-roll stays well under 10 MB |
| VIDEO-04 | Videos older than 7 days deleted from Supabase Storage on each pipeline run | `supabase.storage.from_("editions").list(path=date_prefix)` + `remove([paths])` |
| AUTO-02 | If 1 story fails, remaining stories still complete and publish | Per-story try/except in a loop; accumulate results; set edition status to `partial` if any failed |
| AUTO-03 | Each pipeline run records status (running/complete/partial/failed) in DB | Insert `pipeline_runs` row at start; update `finished_at` + `status` at end |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| feedparser | 6.0.12 | RSS/Atom feed parsing | De-facto Python RSS standard; handles malformed feeds gracefully |
| groq | latest (0.x) | Groq API client — LLM inference | Official SDK; OpenAI-compatible interface; HIGH source reputation |
| openai | v1.x | TTS audio generation | Official SDK; streaming response to file avoids memory buffering |
| faster-whisper | 1.x | Word-level timestamps from audio | Reimplements Whisper with CTranslate2; 4x faster; built-in word timestamps |
| requests | 2.x | Pexels video download (HTTP GET) | Standard HTTP; no wrapper library needed for simple file download |
| supabase | 2.x | DB writes and storage upload/delete | Already in project (Phase 1) |
| python-dotenv | 1.x | .env loading | Already in project (Phase 1) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| hashlib (stdlib) | stdlib | Article URL deduplication hash | SHA-256 of source_url → stored in DB or checked against existing records |
| pathlib (stdlib) | stdlib | Temp file path management | Use `pathlib.Path` for all temp audio/video file paths |
| tempfile (stdlib) | stdlib | Temp directory per story | `tempfile.mkdtemp()` for isolated per-story workspace, delete on completion |
| subprocess (stdlib) | stdlib | FFmpeg invocation | `subprocess.run([...], check=True)` — no ffmpeg-python wrapper needed |
| logging (stdlib) | stdlib | Pipeline audit logging | Python's `logging` module; structured log messages stored to `steps_log` jsonb |
| datetime (stdlib) | stdlib | 7-day retention date arithmetic | `datetime.date.today() - timedelta(days=7)` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| feedparser | httpx + xml.etree | feedparser handles malformed RSS/Atom/RDF; not worth hand-rolling |
| faster-whisper tiny.en | WhisperX | WhisperX uses wav2vec2 for forced alignment (better accuracy) but adds heavy PyTorch deps; tiny.en built-in timestamps are sufficient for subtitle synchronization at this quality level |
| subprocess FFmpeg | ffmpeg-python | ffmpeg-python has a known bug with ASS subtitle filter paths on macOS; raw subprocess is more debuggable |
| Pexels requests download | pexels-python | No official Python client; raw requests + JSON parsing is 5 lines |
| Hand-crafted ASS | ass.py library | ASS format is simple enough to generate manually for basic subtitle burns; avoids a dependency |

**Installation:**
```bash
pip install feedparser groq openai faster-whisper requests supabase python-dotenv
# FFmpeg via Homebrew (not pip — it's a system binary):
brew install ffmpeg
```

---

## Architecture Patterns

### Recommended Project Structure

```
pipeline/
├── __init__.py          # (exists)
├── db.py                # (exists) — Supabase singleton client
├── run.py               # Entry point: python -m pipeline.run
├── ingest.py            # INGEST-01/02: fetch RSS, deduplicate, return Article list
├── script.py            # SCRIPT-01/02/03: Groq story selection + script writing
├── audio.py             # AUDIO-01/02/03: TTS generation + Whisper alignment + ASS file
├── video.py             # VIDEO-01/02/03: Pexels download + FFmpeg assembly
├── storage.py           # VIDEO-04 + upload: Supabase Storage upload + cleanup
└── models.py            # Dataclasses: Article, Story, VideoResult
```

### Pattern 1: Pipeline Orchestrator with Per-Story Error Isolation

**What:** `run.py` coordinates all stages in sequence. Each story is processed in a try/except block. Failures are logged and accumulated; the pipeline continues to the next story.

**When to use:** Whenever `AUTO-02` requires partial success — failing one story must not abort the edition.

```python
# Source: gsd-phase-researcher synthesis (pattern from STATE.md decisions)
import logging
from pipeline.db import get_db
from pipeline import ingest, script, audio, video, storage

def run():
    db = get_db()
    run_record = db.table("pipeline_runs").insert({"status": "running"}).execute().data[0]
    run_id = run_record["id"]
    steps_log = []
    error_log = []

    try:
        # Stage 1: Ingest
        articles = ingest.fetch_and_deduplicate()
        steps_log.append({"step": "ingest", "article_count": len(articles)})

        # Stage 2: Story selection + script writing (creates DB video rows)
        edition_id, stories = script.select_and_write(articles)
        steps_log.append({"step": "script", "story_count": len(stories)})

        # Stage 3: Per-story assembly with error isolation
        results = []
        for story in stories:
            try:
                audio_path, ass_path = audio.generate(story)
                broll_path = video.download_broll(story.headline)
                mp4_path = video.assemble(broll_path, audio_path, ass_path)
                url = storage.upload(mp4_path, edition_id, story.position)
                results.append({"story_id": story.id, "status": "ready", "url": url})
            except Exception as e:
                error_log.append({"story_id": story.id, "error": str(e)})
                logging.exception("Story %s failed", story.id)

        # Stage 4: Publish edition
        all_ok = len(error_log) == 0
        edition_status = "published" if all_ok else "partial"
        storage.publish_edition(edition_id, results, edition_status)

        # Stage 5: 7-day cleanup
        storage.cleanup_old_editions(days=7)

        final_status = "complete" if all_ok else "partial"

    except Exception as e:
        final_status = "failed"
        error_log.append({"step": "pipeline", "error": str(e)})
        logging.exception("Pipeline failed")

    db.table("pipeline_runs").update({
        "status": final_status,
        "finished_at": "now()",
        "steps_log": steps_log,
        "error_log": error_log,
    }).eq("id", run_id).execute()
```

### Pattern 2: RSS Ingestion with Deduplication

**What:** Fetch from multiple feeds, normalize to Article objects, filter against existing `videos.source_url` values.

```python
# Source: feedparser 6.x docs + gsd-phase-researcher synthesis
import feedparser
import hashlib

FEEDS = [
    "https://finance.yahoo.com/news/rssindex",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",  # Finance
]

def fetch_and_deduplicate() -> list[Article]:
    all_articles = []
    for url in FEEDS:
        feed = feedparser.parse(url)
        for entry in feed.entries:
            article = Article(
                title=entry.get("title", ""),
                summary=entry.get("summary", ""),
                url=entry.get("link", ""),
                published=entry.get("published", ""),
            )
            all_articles.append(article)

    # Deduplicate: filter URLs already in the DB today
    db = get_db()
    today_urls = {
        v["source_url"]
        for v in db.table("videos")
            .select("source_url")
            .gte("created_at", str(date.today()))
            .execute().data
    }
    return [a for a in all_articles if a.url not in today_urls]
```

### Pattern 3: Groq JSON Story Selection

**What:** Send all article titles/summaries to Groq in one call with `response_format={"type": "json_object"}`. Returns a list of selected stories with positions.

```python
# Source: Context7 /groq/groq-python — Chat Completions with JSON Mode
from groq import Groq
import json

client = Groq()

def select_stories(articles: list[Article]) -> list[dict]:
    articles_text = "\n".join(
        f"{i+1}. {a.title}: {a.summary[:200]}" for i, a in enumerate(articles)
    )
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": (
                "You are a financial news editor. Select the 3-7 most important, "
                "distinct financial stories from the list below. Output JSON: "
                '{"stories": [{"index": 0, "reason": "..."}]}'
            )},
            {"role": "user", "content": articles_text},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return json.loads(response.choices[0].message.content)["stories"]
```

### Pattern 4: OpenAI TTS to MP3 File

**What:** Stream TTS response directly to a file — avoids loading full audio into memory.

```python
# Source: Context7 /openai/openai-python — Perform Text-to-Speech
from pathlib import Path
from openai import OpenAI

client = OpenAI()

def generate_audio(script_text: str, output_path: Path) -> None:
    with client.audio.speech.with_streaming_response.create(
        model="tts-1",
        voice="onyx",          # deep male voice suits financial news tone
        input=script_text,
        response_format="mp3",
    ) as response:
        response.stream_to_file(output_path)
```

### Pattern 5: faster-whisper Word Timestamps

**What:** Transcribe the generated MP3 to extract per-word start/end times. `word_timestamps=True` returns `word.start`, `word.end`, `word.word` on each segment's words.

```python
# Source: Context7 /systran/faster-whisper — Get Word-Level Timestamps
from faster_whisper import WhisperModel

_model: WhisperModel | None = None

def get_word_timestamps(audio_path: str) -> list[dict]:
    global _model
    if _model is None:
        _model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    segments, _ = _model.transcribe(audio_path, word_timestamps=True, language="en")
    words = []
    for segment in segments:
        for word in segment.words:
            words.append({
                "word": word.word.strip(),
                "start": word.start,
                "end": word.end,
            })
    return words
```

**Important:** `model.transcribe()` returns a generator — must call `list(segments)` or iterate fully before the model is released.

### Pattern 6: ASS Subtitle File Generation

**What:** Convert word-level timestamps to a minimal ASS file. ASS is a text format; no library needed for basic subtitle burns.

```python
# Source: ASS specification + gsd-phase-researcher synthesis
# http://www.tcax.org/docs/ass-specs.htm

ASS_HEADER = """\
[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Alignment, MarginV
Style: Default,Arial,52,&H00FFFFFF,1,2,120

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def _ts(seconds: float) -> str:
    """Convert float seconds to ASS timestamp H:MM:SS.cs"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def write_ass(words: list[dict], output_path: str) -> None:
    """
    Write one Dialogue line per word (karaoke-style subtitle).
    Alignment=2 is bottom-center.
    """
    lines = [ASS_HEADER]
    # Group words into ~3-word chunks for readability
    chunk = []
    chunks = []
    for w in words:
        chunk.append(w)
        if len(chunk) == 3:
            chunks.append(chunk)
            chunk = []
    if chunk:
        chunks.append(chunk)

    for group in chunks:
        start = group[0]["start"]
        end = group[-1]["end"]
        text = " ".join(w["word"] for w in group)
        lines.append(
            f"Dialogue: 0,{_ts(start)},{_ts(end)},Default,,0,0,0,,{text}"
        )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
```

### Pattern 7: Pexels Video Download

**What:** Search by keyword, filter for portrait orientation and HD quality, download the first suitable mp4 link via requests.

```python
# Source: Context7 /websites/pexels_api — Search for Videos
import requests

PEXELS_BASE = "https://api.pexels.com/videos/search"

def download_broll(keyword: str, output_path: str, api_key: str) -> None:
    """Download first portrait HD video result for keyword. Fallback: 'stock market'."""
    for query in [keyword, "stock market"]:
        resp = requests.get(
            PEXELS_BASE,
            headers={"Authorization": api_key},
            params={
                "query": query,
                "orientation": "portrait",
                "size": "medium",   # Full HD (1080p) — will be scaled down by FFmpeg
                "per_page": 5,
            },
            timeout=15,
        )
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
        for video in videos:
            # Prefer HD portrait files
            for vf in video.get("video_files", []):
                if vf.get("quality") == "hd" and vf.get("height", 0) > vf.get("width", 0):
                    r = requests.get(vf["link"], stream=True, timeout=60)
                    r.raise_for_status()
                    with open(output_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024 * 64):
                            f.write(chunk)
                    return
    raise RuntimeError(f"No suitable Pexels b-roll found for: {keyword}")
```

### Pattern 8: FFmpeg Video Assembly via subprocess

**What:** Loop b-roll to match audio duration, burn ASS subtitles, scale to 720x1280, encode at CRF 28.

```python
# Source: WebSearch synthesis — verified FFmpeg flags
import subprocess

def assemble_video(broll_path: str, audio_path: str, ass_path: str, output_path: str) -> None:
    """
    -stream_loop -1     : loop b-roll indefinitely
    -shortest           : stop when audio ends
    -vf scale+ass       : scale to 720x1280 (9:16 portrait) and burn subtitles
    -crf 28             : target ≤10 MB file size
    -movflags faststart : progressive web playback
    """
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1",
        "-i", broll_path,
        "-i", audio_path,
        "-vf", f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,ass={ass_path}",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-shortest",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr}")
```

### Pattern 9: Supabase Storage Upload + Public URL

**What:** Upload MP4 bytes to `editions/{edition_date}/{slug}.mp4`, retrieve public URL.

```python
# Source: Context7 /supabase/supabase-py — Upload Files + Get Public URL
BUCKET = "editions"

def upload_video(db, local_path: str, edition_date: str, slug: str) -> str:
    storage_path = f"{edition_date}/{slug}.mp4"
    with open(local_path, "rb") as f:
        db.storage.from_(BUCKET).upload(
            storage_path,
            f,
            {"content-type": "video/mp4", "upsert": "true"},
        )
    return db.storage.from_(BUCKET).get_public_url(storage_path)
```

### Pattern 10: 7-Day Storage Cleanup

**What:** List all edition date prefixes older than 7 days. For each, list files and batch-delete. Then update DB records.

```python
# Source: Context7 /supabase/supabase-py — List Storage Files + Remove
from datetime import date, timedelta

def cleanup_old_editions(db, days: int = 7) -> None:
    cutoff = date.today() - timedelta(days=days)

    # Find old edition_dates in DB
    old_editions = db.table("editions") \
        .select("id, edition_date") \
        .lt("edition_date", str(cutoff)) \
        .execute().data

    for edition in old_editions:
        edition_date = edition["edition_date"]
        # List files under this date prefix
        files = db.storage.from_(BUCKET).list(path=edition_date)
        if files:
            paths = [f"{edition_date}/{f['name']}" for f in files]
            db.storage.from_(BUCKET).remove(paths)

        # Mark edition as deleted
        db.table("editions").update({"status": "deleted"}).eq("id", edition["id"]).execute()
```

### Anti-Patterns to Avoid

- **Broad exception catching without logging:** Using `except Exception: pass` silently swallows failures. Always log with `logging.exception()` and append to `error_log`.
- **Loading full TTS audio into memory:** OpenAI returns the full audio as bytes. Use `with_streaming_response.create()` + `stream_to_file()` instead of `.create()` directly.
- **ffmpeg-python for ASS subtitles on macOS:** The `ffmpeg-python` wrapper has a known open issue with ASS filter path handling. Use raw `subprocess.run()` instead.
- **Not materializing faster-whisper generator:** `model.transcribe()` returns a generator. If you don't iterate it fully before the model is released, you get an empty result. Call `list(segments)` or iterate within the function scope.
- **One FFmpeg call per story without temp isolation:** Each story should use its own `tempfile.mkdtemp()` workspace so partial failures don't leave orphaned files from other stories.
- **Uploading before DB record exists:** SCRIPT-03 requires the video row to exist in the DB before TTS is called. Insert the row with `status='generating'` first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS parsing | Custom XML/HTTP parser | feedparser 6.x | Handles malformed XML, redirects, conditional GET, Atom/RSS/RDF |
| LLM API client | Raw httpx | groq Python SDK | Type safety, retries, error classes built in |
| TTS streaming | Raw httpx streaming | OpenAI Python SDK `with_streaming_response` | Handles chunked transfer, retry, correct headers |
| Audio transcription | PyTorch Whisper | faster-whisper with `word_timestamps=True` | 4x faster, no GPU required, word timestamps built in |
| Video file manipulation | MoviePy | FFmpeg subprocess | MoviePy 2.x has breaking changes (STATE.md decision); FFmpeg more debuggable |
| Subtitle burning | Custom overlay | FFmpeg `ass=` filter | libass handles font rendering, positioning, timing correctly |
| HTTP file download | urllib | requests with `stream=True` | Clean chunked download, proper error handling |

**Key insight:** The pipeline's value is in orchestration logic, not in reimplementing media processing. Every media operation should go through a battle-tested binary or SDK.

---

## Common Pitfalls

### Pitfall 1: Reuters RSS Feeds Are Dead

**What goes wrong:** REQUIREMENTS.md references Reuters RSS feeds. These have been non-functional since June 2020.
**Why it happens:** Reuters stopped providing official RSS in 2020; third-party generators exist but are unreliable.
**How to avoid:** Use Yahoo Finance (`https://finance.yahoo.com/news/rssindex`) and CNBC finance (`https://www.cnbc.com/id/10000664/device/rss/rss.html`) as the two feed sources. Update REQUIREMENTS.md if needed.
**Warning signs:** feedparser returns empty `entries` list for the Reuters URL.

### Pitfall 2: Groq Free Tier Rate Limits Hit During Development

**What goes wrong:** Groq's free tier for `llama-3.3-70b-versatile` allows 30 RPM, 12K TPM, 1000 RPD. Two Groq calls per story (select + write) × 5 stories = 10 calls per run. Well within RPM, but script-writing prompts can be token-heavy.
**Why it happens:** Verbose system prompts + long article summaries can push tokens > 1K per call.
**How to avoid:** Keep article summaries trimmed to 200 chars in the prompt. Keep system prompts concise. Monitor token usage in response.usage.
**Warning signs:** `groq.RateLimitError` exception during script generation.

### Pitfall 3: FFmpeg Not Installed — Silent Import Success, Runtime Failure

**What goes wrong:** All Python imports succeed, but `subprocess.run(["ffmpeg", ...])` raises `FileNotFoundError` at runtime.
**Why it happens:** FFmpeg is a system binary, not a Python package. It is not installed on the dev machine yet (confirmed: `ffmpeg not found` in the environment).
**How to avoid:** `brew install ffmpeg` before running Phase 2 tests. Add FFmpeg availability check to the pipeline's startup validation.
**Warning signs:** `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'` in subprocess call.

### Pitfall 4: faster-whisper Model Download on First Run

**What goes wrong:** `WhisperModel("tiny.en")` downloads ~75 MB on first instantiation. This silently blocks the pipeline for 30-60 seconds with no output.
**Why it happens:** CTranslate2 downloads model weights from Hugging Face on first use.
**How to avoid:** Warm up the model in a separate setup step. Document this in the plan. Cache singleton `_model` at module level so it only downloads once per process.
**Warning signs:** Long pause during first pipeline test with no log output.

### Pitfall 5: ASS Subtitle Path With Spaces in FFmpeg Filter

**What goes wrong:** `ffmpeg -vf "ass=/path/with spaces/subs.ass"` fails on macOS with a filter parse error.
**Why it happens:** FFmpeg's filtergraph parser treats `:` and space as special characters in filter argument strings.
**How to avoid:** Use `tempfile.mkdtemp()` in `/tmp/` (no spaces). Alternatively, escape colons and spaces: `ass='/tmp/story_0/subs.ass'` (single-quotes inside double-quoted filter string works on macOS).
**Warning signs:** FFmpeg stderr contains `Error initializing filter 'ass'` or `No such file or directory`.

### Pitfall 6: B-Roll Video Aspect Ratio Mismatch

**What goes wrong:** Pexels portrait videos have varying aspect ratios (9:16, 4:5, 3:4). Passing a non-9:16 clip directly to FFmpeg scale=720:1280 distorts the video.
**Why it happens:** FFmpeg `scale=W:H` stretches to fill; it does not preserve aspect ratio by default.
**How to avoid:** Use the combined filter: `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280`. This scales up to fill, then center-crops to exact dimensions.
**Warning signs:** Output video looks stretched or squashed.

### Pitfall 7: Edition Created Multiple Times on Re-Run

**What goes wrong:** Running the pipeline twice on the same day creates two editions with the same `edition_date`, violating the UNIQUE constraint (or creating a duplicate if constraint is not enforced in logic).
**Why it happens:** `INSERT INTO editions (edition_date) ...` without checking for existence.
**How to avoid:** Use `upsert` with `on_conflict=edition_date` or check if today's edition already exists with `status='published'` before starting. If already published, skip the run with a log message.
**Warning signs:** Supabase returns `409 Conflict` on the editions insert, or duplicate video rows appear.

### Pitfall 8: Video File Size Exceeds 10 MB

**What goes wrong:** CRF 28 at 720p produces a file > 10 MB for a 45-second clip.
**Why it happens:** CRF is a quality target, not a size target. High-motion b-roll clips encode larger at CRF 28 than static/low-motion clips.
**How to avoid:** After FFmpeg encodes, check file size. If > 10 MB, re-encode with `-crf 32`. Pexels b-roll for financial news is typically low-motion (charts, offices, trading floors), so CRF 28 should be safe. Empirically validate in the first test run.
**Warning signs:** `os.path.getsize(output_path) > 10 * 1024 * 1024` after assembly.

---

## Code Examples

Verified patterns from official sources:

### Groq JSON Mode (story selection)
```python
# Source: Context7 /groq/groq-python — Chat Completions with JSON Mode
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[...],
    response_format={"type": "json_object"},
    temperature=0.2,
)
result = json.loads(response.choices[0].message.content)
```

### OpenAI TTS streaming to file
```python
# Source: Context7 /openai/openai-python — Perform Text-to-Speech
with client.audio.speech.with_streaming_response.create(
    model="tts-1",
    voice="onyx",
    input=script_text,
) as response:
    response.stream_to_file(Path("output.mp3"))
```

### faster-whisper word timestamps
```python
# Source: Context7 /systran/faster-whisper — Get Word-Level Timestamps
model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
segments, _ = model.transcribe("audio.mp3", word_timestamps=True)
for segment in segments:
    for word in segment.words:
        print(f"[{word.start:.2f} -> {word.end:.2f}] {word.word}")
```

### Pexels video search (portrait, HD)
```python
# Source: Context7 /websites/pexels_api — Search for Videos
resp = requests.get(
    "https://api.pexels.com/videos/search",
    headers={"Authorization": PEXELS_API_KEY},
    params={"query": "stock market", "orientation": "portrait", "size": "medium", "per_page": 5},
)
video_file_link = resp.json()["videos"][0]["video_files"][0]["link"]
```

### Supabase Storage upload + public URL
```python
# Source: Context7 /supabase/supabase-py — Upload + Get Public URL
with open(local_path, "rb") as f:
    supabase.storage.from_("editions").upload(
        f"{edition_date}/{slug}.mp4", f, {"content-type": "video/mp4", "upsert": "true"}
    )
url = supabase.storage.from_("editions").get_public_url(f"{edition_date}/{slug}.mp4")
```

### Supabase Storage list + delete
```python
# Source: Context7 /supabase/supabase-py — Move, Copy, and Delete Storage Files
files = supabase.storage.from_("editions").list(path=edition_date)
paths = [f"{edition_date}/{f['name']}" for f in files]
supabase.storage.from_("editions").remove(paths)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MoviePy for video assembly | FFmpeg subprocess directly | 2024 (MoviePy 2.x breaking changes) | Already in STATE.md decisions — do not use MoviePy |
| Reuters RSS feeds | Yahoo Finance + CNBC RSS | June 2020 | Reuters feeds are dead; REQUIREMENTS.md needs update |
| OpenAI Whisper (PyTorch) for alignment | faster-whisper (CTranslate2) | 2023+ | 4x faster, lower memory, built-in word timestamps, no GPU needed |
| Fixed 5-video editions | Variable count per news day | Phase 1 decision | Pipeline must handle 3-7 stories, not hardcoded 5 |

**Deprecated/outdated:**
- Reuters RSS: Dead since June 2020. Any URL under `feeds.reuters.com` or `reuters.com/tools/rss` returns 404 or empty.
- MoviePy: 2.x has breaking API changes that make video pipeline use unreliable (STATE.md).
- ffmpeg-python wrapper: Known ASS filter bug on macOS; use subprocess directly.

---

## Open Questions

1. **Reuters replacement confirmation**
   - What we know: Reuters RSS dead since 2020; Yahoo Finance and CNBC are active
   - What's unclear: Are Yahoo Finance RSS entries complete enough (title + summary) for LLM story selection, or are summaries truncated to just headlines?
   - Recommendation: Test feedparser output against both URLs before committing; MarketWatch is a third option if needed

2. **CRF 28 empirical file size**
   - What we know: CRF 28 at 720p produces ~5-6% of source size for low-motion content; STATE.md flags this as needing empirical validation
   - What's unclear: Pexels portrait HD clips tend to be 1080x1920; downscaling to 720x1280 + low-motion content should stay < 10 MB for 45s, but needs a test
   - Recommendation: In plan 02-04, include an explicit "encode one test video and check file size" verification step

3. **faster-whisper tiny.en timestamp accuracy for subtitle sync**
   - What we know: tiny.en is the fastest/smallest model; word timestamps are built-in (not separately aligned like WhisperX)
   - What's unclear: For synthetic TTS audio (very clean, no background noise), tiny.en timestamps may be sufficient; for real speech they can drift
   - Recommendation: In plan 02-03, include a verification step: play the assembled video and check that subtitle text is synchronized to speech within ~0.5 seconds

4. **Groq token usage per run**
   - What we know: Free tier is 12K TPM, 1K RPD. Two calls per story (select + write) × 5-7 stories = 10-14 calls/run, plus the selection call
   - What's unclear: Token counts depend on prompt design; script-writing prompts may use 800-1500 tokens each
   - Recommendation: Start with a single selection + all scripts in one Groq call if possible, to minimize API calls and total token usage

---

## Sources

### Primary (HIGH confidence)
- `/groq/groq-python` via Context7 — chat completions, JSON mode, Llama 3.3 model ID
- `/systran/faster-whisper` via Context7 — `word_timestamps=True`, segment/word object structure
- `/openai/openai-python` via Context7 — `audio.speech.with_streaming_response.create`, TTS parameters
- `/supabase/supabase-py` via Context7 — `storage.from_().upload()`, `list()`, `remove()`, `get_public_url()`
- `/websites/pexels_api` via Context7 — `/videos/search` endpoint, response structure, `video_files` array
- `https://console.groq.com/docs/rate-limits` (WebFetch) — Llama 3.3 free tier: 30 RPM, 12K TPM, 1K RPD

### Secondary (MEDIUM confidence)
- WebSearch: FFmpeg `ass=` filter burn-in, `subprocess.run()` pattern, `-stream_loop -1 -shortest` for b-roll looping
- WebSearch: ASS subtitle format specification (tcax.org) — verified structure used in Pattern 6
- WebSearch: feedparser 6.0.12 on PyPI — RSS parsing standard
- WebSearch: Yahoo Finance RSS `https://finance.yahoo.com/news/rssindex` — active feed confirmed
- WebSearch: CNBC finance RSS `https://www.cnbc.com/id/10000664/device/rss/rss.html` — active feed confirmed

### Tertiary (LOW confidence)
- WebSearch: Reuters RSS dead since June 2020 — multiple sources agree but not verified against official Reuters statement (no official docs exist for something discontinued)
- WebSearch: CRF 28 at 720p ≈ 12 MB for 5-minute video → extrapolated to ~1.8 MB for 45s — needs empirical validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via Context7 official docs
- Architecture: HIGH — patterns derived directly from verified API examples
- Pitfalls: MEDIUM/HIGH — FFmpeg + Supabase pitfalls verified; Groq rate limits verified; file size pitfall is empirical extrapolation
- RSS feed URLs: MEDIUM — Yahoo Finance confirmed via multiple sources; CNBC URL confirmed via direct WebSearch; Reuters confirmed dead

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable APIs; RSS feed availability could change)
