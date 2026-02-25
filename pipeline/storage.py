"""
Supabase Storage operations for the AutoNews_AI pipeline.

Provides:
    upload_video()        — upload MP4 to videos bucket, returns public CDN URL
    publish_edition()     — update DB records and set edition status
    cleanup_old_editions() — VIDEO-04: delete editions older than N days
"""
import logging
from datetime import date, timedelta
from pathlib import Path

from pipeline.db import get_db
from pipeline.models import VideoResult

logger = logging.getLogger(__name__)

BUCKET = "videos"    # created in Phase 1 as 'videos' bucket


def upload_video(local_path: Path, edition_id: str, position: int) -> str:
    """
    Upload MP4 to Supabase Storage at editions/{edition_id}/{position}.mp4.
    Returns the public CDN URL.
    Uses upsert=true to handle re-uploads on partial re-runs.
    """
    db = get_db()
    storage_path = f"editions/{edition_id}/{position}.mp4"
    with open(local_path, "rb") as f:
        db.storage.from_(BUCKET).upload(
            storage_path,
            f,
            {"content-type": "video/mp4", "upsert": "true"},
        )
    url = db.storage.from_(BUCKET).get_public_url(storage_path)
    logger.info("Uploaded %s → %s", local_path.name, url)
    return url


def publish_edition(
    edition_id: str,
    edition_date: str,
    results: list[VideoResult],
) -> None:
    """
    Update each video row with its URL and status.
    Update edition status to 'published' or 'partial'.
    Set edition.published_at to now().
    """
    db = get_db()
    any_failed = False

    for result in results:
        if result.status == "ready" and result.video_url:
            db.table("videos").update({
                "video_url": result.video_url,
                "status": "ready",
            }).eq("id", result.story_id).execute()
        else:
            db.table("videos").update({
                "status": "failed",
            }).eq("id", result.story_id).execute()
            any_failed = True

    edition_status = "partial" if any_failed else "published"
    db.table("editions").update({
        "status": edition_status,
        "published_at": "now()",
    }).eq("id", edition_id).execute()
    logger.info(
        "Edition %s published as '%s' (%d results)",
        edition_id[:8],
        edition_status,
        len(results),
    )


def cleanup_old_editions(days: int = 7) -> None:
    """
    VIDEO-04: Delete editions older than `days` from Supabase Storage
    and mark DB records as deleted.
    """
    db = get_db()
    cutoff = str(date.today() - timedelta(days=days))

    old_editions = (
        db.table("editions")
        .select("id, edition_date")
        .lt("edition_date", cutoff)
        .not_.eq("status", "deleted")
        .execute()
        .data
    )

    if not old_editions:
        logger.info("Cleanup: no editions older than %d days found.", days)
        return

    for edition in old_editions:
        storage_prefix = f"editions/{edition['id']}"
        try:
            files = db.storage.from_(BUCKET).list(path=storage_prefix)
            if files:
                paths = [f"{storage_prefix}/{f['name']}" for f in files]
                db.storage.from_(BUCKET).remove(paths)
                logger.info(
                    "Deleted %d files from storage: %s", len(paths), storage_prefix
                )
        except Exception as e:
            logger.warning("Storage cleanup failed for %s: %s", edition_date, e)

        db.table("editions").update({"status": "deleted"}).eq("id", edition["id"]).execute()
        logger.info("Marked edition %s as deleted", edition_date)
