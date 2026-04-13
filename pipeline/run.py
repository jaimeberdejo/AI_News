"""
AI News Pipeline — Entry point
Run with: python -m pipeline.run [category]

Category argument:
  finance  (default) — Yahoo Finance + CNBC feeds, financial influencer tone
  tech               — TechCrunch + Hacker News + Ars Technica feeds, tech journalist tone

Examples:
  python -m pipeline.run
  python -m pipeline.run finance
  python -m pipeline.run tech

Prerequisites:
  - FFmpeg installed: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)
  - Python deps: pip install -r requirements.txt
  - .env at repo root with: SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY,
    OPENAI_API_KEY, PEXELS_API_KEY
"""
import logging
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from pipeline.db import get_db
from pipeline import ingest, script, audio, video, storage
from pipeline.models import VideoResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(module)s] %(message)s",
)
logger = logging.getLogger(__name__)


def run() -> None:
    # Read category from CLI argument (default: 'finance')
    category = sys.argv[1] if len(sys.argv) > 1 else "finance"
    if category not in ("finance", "tech"):
        raise ValueError(f"Unknown category '{category}'. Must be 'finance' or 'tech'.")

    logger.info("=== Pipeline starting for category: %s ===", category)

    # Startup check: FFmpeg must be available
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "FFmpeg not installed. Run: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
        )

    db = get_db()
    edition_date = str(date.today())

    # AUTO-03: Insert pipeline_runs audit record at start
    run_result = db.table("pipeline_runs").insert({"status": "running"}).execute()
    if not run_result.data:
        raise RuntimeError("Failed to create pipeline_runs audit record — DB insert returned no rows.")
    run_id = run_result.data[0]["id"]
    steps_log: list[dict] = [{"step": "start", "category": category}]
    error_log: list[dict] = []
    edition_id: str | None = None
    final_status = "failed"

    try:
        # Stage 1: Ingest articles from category-specific RSS feeds
        logger.info("=== Stage 1: RSS Ingestion ===")
        articles = ingest.fetch_and_deduplicate(category)
        steps_log.append({"step": "ingest", "article_count": len(articles)})
        logger.info("Fetched %d deduplicated articles", len(articles))

        if not articles:
            logger.warning("No new articles found — skipping pipeline run.")
            db.table("pipeline_runs").update({
                "status": "complete",
                "finished_at": "now()",
                "steps_log": steps_log,
                "error_log": error_log,
            }).eq("id", run_id).execute()
            return

        # Stage 2: Story selection + script writing + DB video row inserts
        logger.info("=== Stage 2: Story Selection + Script Writing ===")
        edition_id, stories = script.select_and_write(articles, category)

        db.table("pipeline_runs").update({"edition_id": edition_id}).eq("id", run_id).execute()
        steps_log.append({"step": "script", "story_count": len(stories), "edition_id": edition_id})
        logger.info("Selected %d stories for edition %s", len(stories), edition_date)

        # Stage 3: Per-story assembly with error isolation (AUTO-02)
        logger.info("=== Stage 3: Per-Story Assembly ===")
        results: list[VideoResult] = []

        for story in stories:
            tmp_dir = Path(tempfile.mkdtemp(prefix=f"ai_news_story{story.position}_"))
            try:
                logger.info("--- Story %d: %s ---", story.position, story.headline[:50])

                # Audio: TTS + Whisper alignment + ASS
                mp3_path, ass_path = audio.generate(story, tmp_dir)

                # Video: Pexels b-roll download
                broll_path = video.download_broll(story.headline, tmp_dir)

                # Video: FFmpeg assembly
                mp4_path = video.assemble(broll_path, mp3_path, ass_path, tmp_dir, story.position)

                # Extract thumbnail (Phase 12: static JPEG for iOS PWA grid)
                thumb_url: str | None = None
                try:
                    thumb_path = video.extract_thumbnail(mp4_path, tmp_dir, story.position)
                    thumb_url = storage.upload_thumbnail(thumb_path, edition_id, story.position, edition_date, category)
                except Exception as thumb_err:
                    logger.warning("Thumbnail extraction failed for position %d: %s", story.position, thumb_err)
                    # Non-fatal: video publishes without thumbnail; VideoGrid shows placeholder

                # Upload to Supabase Storage
                url = storage.upload_video(mp4_path, edition_id, story.position, edition_date, category)

                results.append(VideoResult(
                    story_id=story.db_video_id,
                    position=story.position,
                    status="ready",
                    video_url=url,
                    thumbnail_url=thumb_url,
                ))
                logger.info("Story %d complete: %s", story.position, url)

            except Exception as e:
                logger.exception("Story %d FAILED: %s", story.position, e)
                error_log.append({
                    "story_position": story.position,
                    "headline": story.headline[:80],
                    "error": str(e),
                })
                results.append(VideoResult(
                    story_id=story.db_video_id,
                    position=story.position,
                    status="failed",
                    error=str(e),
                ))
            finally:
                # Clean up temp files regardless of success/failure
                shutil.rmtree(tmp_dir, ignore_errors=True)

        steps_log.append({
            "step": "assembly",
            "ready": sum(1 for r in results if r.status == "ready"),
            "failed": sum(1 for r in results if r.status == "failed"),
        })

        # Stage 4: Publish edition
        logger.info("=== Stage 4: Publishing Edition ===")
        storage.publish_edition(edition_id, edition_date, results)

        # Stage 5: 7-day cleanup
        logger.info("=== Stage 5: Cleanup Old Editions ===")
        storage.cleanup_old_editions(days=7)
        steps_log.append({"step": "cleanup", "status": "done"})

        # Determine final pipeline status
        failed_count = sum(1 for r in results if r.status == "failed")
        final_status = "partial" if failed_count > 0 else "complete"
        logger.info(
            "Pipeline %s: %d ready, %d failed",
            final_status,
            len(results) - failed_count,
            failed_count,
        )

    except Exception as e:
        final_status = "failed"
        error_log.append({"step": "pipeline", "error": str(e)})
        logger.exception("Pipeline FAILED at top level: %s", e)

    # AUTO-03: Update pipeline_runs with final status
    db.table("pipeline_runs").update({
        "status": final_status,
        "finished_at": "now()",
        "steps_log": steps_log,
        "error_log": error_log,
    }).eq("id", run_id).execute()


if __name__ == "__main__":
    run()
