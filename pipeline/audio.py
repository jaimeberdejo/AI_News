"""
pipeline/audio.py — TTS audio generation, Whisper word-level alignment, ASS subtitle writing.

Public API
----------
generate(story, tmp_dir) -> tuple[Path, Path]
    Returns (mp3_path, ass_path) — both inside tmp_dir.

Implements:
  AUDIO-01: TTS via OpenAI tts-1 streamed to disk (no memory buffering)
  AUDIO-02: faster-whisper tiny.en word-level timestamp alignment
  AUDIO-03: ASS subtitle file written to tmp_dir (FFmpeg-safe path, no spaces)
"""
import logging
from pathlib import Path
from openai import OpenAI
from faster_whisper import WhisperModel
from pipeline.models import Story

logger = logging.getLogger(__name__)

# Module-level singletons — models downloaded/loaded once per process
_openai: OpenAI | None = None
_whisper: WhisperModel | None = None


def _get_openai() -> OpenAI:
    global _openai
    if _openai is None:
        _openai = OpenAI()  # reads OPENAI_API_KEY from env
    return _openai


def _get_whisper() -> WhisperModel:
    global _whisper
    if _whisper is None:
        logger.info("Loading faster-whisper tiny.en model (first run downloads ~75 MB)...")
        _whisper = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    return _whisper


# ── ASS subtitle generation ──────────────────────────────────────────────────

_ASS_HEADER = """\
[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Alignment, MarginV
Style: Default,Arial,52,&H00FFFFFF,1,2,120

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""


def _ts(seconds: float) -> str:
    """Convert float seconds to ASS H:MM:SS.cs format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _words_to_ass(words: list[dict], output_path: Path) -> None:
    """
    Group words into 3-word chunks, write one Dialogue line per chunk.
    Alignment=2 is bottom-center in ASS spec.
    """
    chunks: list[list[dict]] = []
    chunk: list[dict] = []
    for w in words:
        chunk.append(w)
        if len(chunk) == 3:
            chunks.append(chunk)
            chunk = []
    if chunk:
        chunks.append(chunk)

    lines = [_ASS_HEADER]
    for group in chunks:
        start = group[0]["start"]
        end = group[-1]["end"]
        text = " ".join(w["word"] for w in group).strip()
        if text:
            lines.append(
                f"Dialogue: 0,{_ts(start)},{_ts(end)},Default,,0,0,0,,{text}"
            )

    output_path.write_text("\n".join(lines), encoding="utf-8")


# ── Public API ────────────────────────────────────────────────────────────────

def generate(story: Story, tmp_dir: Path) -> tuple[Path, Path]:
    """
    Generate MP3 audio and ASS subtitle file for a story.

    Parameters
    ----------
    story : Story
        Story dataclass with position and script_text populated.
    tmp_dir : Path
        Temporary directory (from tempfile.mkdtemp()) — must have no spaces
        in path for FFmpeg filtergraph compatibility.

    Returns
    -------
    tuple[Path, Path]
        (mp3_path, ass_path) — both files written inside tmp_dir.
    """
    mp3_path = tmp_dir / f"story_{story.position}.mp3"
    ass_path = tmp_dir / f"story_{story.position}.ass"

    # AUDIO-01: TTS via OpenAI tts-1 streamed to file (no memory buffering)
    logger.info("Generating TTS audio for position %d", story.position)
    client = _get_openai()
    with client.audio.speech.with_streaming_response.create(
        model="tts-1",
        voice="onyx",           # deep male voice suits financial news
        input=story.script_text,
        response_format="mp3",
    ) as response:
        response.stream_to_file(mp3_path)
    logger.info(
        "TTS audio saved: %s (%.1f KB)", mp3_path.name, mp3_path.stat().st_size / 1024
    )

    # AUDIO-02: Whisper word-level timestamps
    logger.info("Running faster-whisper alignment for position %d", story.position)
    model = _get_whisper()
    segments_gen, _ = model.transcribe(
        str(mp3_path),
        word_timestamps=True,
        language="en",
    )
    # CRITICAL: materialize generator before scope exit (lazy — returns empty if not consumed)
    segments = list(segments_gen)
    words: list[dict] = []
    for segment in segments:
        for word in (segment.words or []):
            words.append({
                "word": word.word.strip(),
                "start": word.start,
                "end": word.end,
            })
    logger.info("Whisper produced %d word timestamps", len(words))

    # AUDIO-03: Write ASS subtitle file
    _words_to_ass(words, ass_path)
    logger.info("ASS subtitle file written: %s", ass_path.name)

    return mp3_path, ass_path
