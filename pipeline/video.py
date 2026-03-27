"""
B-roll download (Pexels) and FFmpeg video assembly for AInews pipeline.

Public API:
    download_broll(keyword, tmp_dir) -> Path
    assemble(broll_path, audio_path, ass_path, tmp_dir, position) -> Path

Requirements addressed:
    VIDEO-01: Pexels API with portrait+HD filter and 'stock market' fallback
    VIDEO-02: FFmpeg subprocess with scale/crop/ass filter chain, -stream_loop -1 -shortest
    VIDEO-03: 10 MB file size check post-encode; automatic CRF 32 re-encode if exceeded
"""
import logging
import os
import shutil
import subprocess
from pathlib import Path

import requests
from dotenv import load_dotenv, find_dotenv

logger = logging.getLogger(__name__)

load_dotenv(find_dotenv())

PEXELS_BASE = "https://api.pexels.com/videos/search"
MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB (VIDEO-03)


def _check_ffmpeg() -> None:
    """Verify FFmpeg binary is available. Call once at pipeline startup."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "FFmpeg not found. Install with: brew install ffmpeg (macOS) "
            "or apt install ffmpeg (Linux)"
        )


def download_broll(keyword: str, tmp_dir: Path) -> Path:
    """
    Download first portrait HD video from Pexels for keyword.
    Falls back to 'stock market' if no portrait HD result found.
    Returns path to downloaded .mp4 in tmp_dir.

    VIDEO-01: Pexels API /videos/search with orientation=portrait, size=medium.
    """
    api_key = os.environ.get("PEXELS_API_KEY", "")
    if not api_key:
        raise RuntimeError("PEXELS_API_KEY not set in environment")

    output_path = tmp_dir / "broll.mp4"

    for query in [keyword, "stock market"]:
        resp = requests.get(
            PEXELS_BASE,
            headers={"Authorization": api_key},
            params={
                "query": query,
                "orientation": "portrait",
                "size": "medium",   # HD quality from Pexels
                "per_page": 5,
            },
            timeout=15,
        )
        resp.raise_for_status()
        videos = resp.json().get("videos", [])

        for video in videos:
            for vf in video.get("video_files", []):
                # Prefer portrait HD files (height > width ensures portrait)
                h = vf.get("height", 0)
                w = vf.get("width", 0)
                if vf.get("quality") == "hd" and h > w:
                    logger.info("Downloading b-roll: %s (query=%s)", vf["link"][:60], query)
                    r = requests.get(vf["link"], stream=True, timeout=60)
                    r.raise_for_status()
                    with open(output_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=64 * 1024):
                            f.write(chunk)
                    logger.info("B-roll saved: %.1f MB", output_path.stat().st_size / 1024 / 1024)
                    return output_path

    raise RuntimeError(f"No suitable portrait HD b-roll found for keyword: '{keyword}'")


def assemble(
    broll_path: Path,
    audio_path: Path,
    ass_path: Path,
    tmp_dir: Path,
    position: int,
) -> Path:
    """
    Assemble MP4 from b-roll, audio, and ASS subtitles via FFmpeg subprocess.
    Loops b-roll to match audio length. Burns in subtitles. Scales to 720x1280.
    Re-encodes at CRF 32 if output exceeds 10 MB.
    Returns path to output .mp4.

    VIDEO-02: scale=720:1280 with force_original_aspect_ratio=increase + crop to avoid distortion.
              ASS path must be /tmp/-based (no spaces) for FFmpeg filtergraph parser.
              -stream_loop -1 with -shortest loops b-roll to audio length.
    VIDEO-03: File size checked after CRF 28 encode; CRF 32 fallback if > 10 MB.
    """
    _check_ffmpeg()
    output_path = tmp_dir / f"story_{position}.mp4"

    # Probe exact audio duration — MP3 duration estimation is unreliable with -shortest
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ],
        capture_output=True, text=True,
    )
    audio_duration = float(probe.stdout.strip())

    def _run_ffmpeg(crf: int) -> None:
        # ASS path: use forward slashes, ensure no spaces (tmp_dir from mkdtemp is safe)
        ass_str = str(ass_path).replace("\\", "/")
        cmd = [
            "ffmpeg", "-y",
            "-stream_loop", "-1",
            "-i", str(broll_path),
            "-i", str(audio_path),
            "-t", str(audio_duration),
            "-map", "0:v:0",   # always use video from b-roll (ignore b-roll audio if present)
            "-map", "1:a:0",   # always use narration MP3
            "-vf", (
                f"scale=720:1280:force_original_aspect_ratio=increase,"
                f"crop=720:1280,"
                f"subtitles={ass_str}"
            ),
            "-c:v", "libx264",
            "-crf", str(crf),
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error("FFmpeg stderr (CRF %d):\n%s", crf, result.stderr)
            raise RuntimeError(f"FFmpeg failed (CRF {crf}) — see logs for full stderr")

    _run_ffmpeg(crf=28)
    size_bytes = output_path.stat().st_size
    logger.info("Assembled MP4: %.2f MB (CRF 28)", size_bytes / 1024 / 1024)

    # VIDEO-03: re-encode if over 10 MB
    if size_bytes > MAX_FILE_BYTES:
        logger.warning(
            "MP4 exceeds 10 MB (%.2f MB). Re-encoding at CRF 32.",
            size_bytes / 1024 / 1024,
        )
        _run_ffmpeg(crf=32)
        size_bytes = output_path.stat().st_size
        logger.info("Re-encoded MP4: %.2f MB (CRF 32)", size_bytes / 1024 / 1024)
        if size_bytes > MAX_FILE_BYTES:
            logger.warning("Still over 10 MB after CRF 32 — proceeding (high-motion b-roll)")

    return output_path


def extract_thumbnail(mp4_path: Path, tmp_dir: Path, position: int) -> Path:
    """
    Extract a single JPEG frame at 0.5s from assembled MP4.
    Returns path to JPEG thumbnail. Raises RuntimeError on FFmpeg failure.
    Uses -ss 0.5 to skip the common black first frame from b-roll videos.
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
        raise RuntimeError(f"Thumbnail extraction failed for position {position}:\n{result.stderr[-1000:]}")
    return thumb_path
