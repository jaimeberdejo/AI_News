"""
Shared dataclasses used throughout the FinFeed pipeline.

All pipeline modules (ingest, script, tts, video) import from here to ensure
consistent data contracts between stages.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Article:
    """A news article fetched from an RSS feed."""
    title: str
    summary: str
    url: str
    published: str = ""


@dataclass
class Story:
    """A processed story ready for TTS and video generation.

    position must be 1–5 to match the `videos.position BETWEEN 1 AND 5`
    DB constraint. db_video_id is set after the DB insert in script.py.
    """
    position: int           # 1-5 (matches videos.position DB constraint)
    headline: str
    script_text: str
    source_url: str
    db_video_id: Optional[str] = None   # set after DB insert in script.py


@dataclass
class VideoResult:
    """The outcome of video rendering for a single story."""
    story_id: str           # videos.id UUID
    position: int
    status: str             # 'ready' or 'failed'
    video_url: Optional[str] = None
    error: Optional[str] = None
    thumbnail_url: Optional[str] = None
