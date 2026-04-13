"""
Supabase Storage operations for the FinFeed pipeline.

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


def _edition_folder(edition_id: str, edition_date: str, category: str) -> str:
    return f"editions/{category}-{edition_date}-{edition_id[:8]}"


def upload_video(local_path: Path, edition_id: str, position: int, edition_date: str, category: str = "finance") -> str:
    """
    Upload MP4 to Supabase Storage at editions/{category}-{date}-{short_id}/{position}.mp4.
    Returns the public CDN URL.
    Uses upsert=true to handle re-uploads on partial re-runs.
    """
    db = get_db()
    storage_path = f"{_edition_folder(edition_id, edition_date, category)}/{position}.mp4"
    with open(local_path, "rb") as f:
        db.storage.from_(BUCKET).upload(
            storage_path,
            f,
            {"content-type": "video/mp4", "upsert": "true"},
        )
    url = db.storage.from_(BUCKET).get_public_url(storage_path)
    logger.info("Uploaded %s → %s", local_path.name, url)
    return url


def upload_thumbnail(local_path: Path, edition_id: str, position: int, edition_date: str, category: str = "finance") -> str:
    """
    Upload JPEG thumbnail to Supabase Storage at editions/{folder}/{position}_thumb.jpg.
    Returns the public CDN URL.
    """
    db = get_db()
    storage_path = f"{_edition_folder(edition_id, edition_date, category)}/{position}_thumb.jpg"
    with open(local_path, "rb") as f:
        db.storage.from_(BUCKET).upload(
            storage_path,
            f,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
    url = db.storage.from_(BUCKET).get_public_url(storage_path)
    logger.info("Uploaded thumbnail %s → %s", local_path.name, url)
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
            update_data = {"video_url": result.video_url, "status": "ready"}
            if result.thumbnail_url:
                update_data["thumbnail_url"] = result.thumbnail_url
            db.table("videos").update(update_data).eq("id", result.story_id).execute()
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

    Derives the storage folder from the actual video_url in the DB so it
    handles both the old path format ({date}-{shortid}/) and the current
    format (editions/{category}-{date}-{shortid}/).
    """
    db = get_db()
    cutoff = str(date.today() - timedelta(days=days))

    old_editions = (
        db.table("editions")
        .select("id, edition_date, category")
        .lt("edition_date", cutoff)
        .not_.eq("status", "deleted")
        .execute()
        .data
    )

    if not old_editions:
        logger.info("Cleanup: no editions older than %d days found.", days)
        return

    # Batch-fetch one video_url per old edition in a single query (avoids N+1)
    edition_ids = [e["id"] for e in old_editions]
    url_rows = (
        db.table("videos")
        .select("edition_id, video_url")
        .in_("edition_id", edition_ids)
        .not_.is_("video_url", "null")
        .execute()
        .data
    )
    # Keep only the first URL per edition
    url_by_edition: dict[str, str] = {}
    for row in url_rows:
        eid = row["edition_id"]
        if eid not in url_by_edition and row.get("video_url"):
            url_by_edition[eid] = row["video_url"]

    for edition in old_editions:
        ed_date = edition['edition_date']

        # Derive storage folder from the actual video_url stored in the DB.
        # This handles old path format ({date}-{shortid}/) and current format
        # (editions/{category}-{date}-{shortid}/) without hardcoding either.
        storage_prefix = None
        url = url_by_edition.get(edition["id"])
        if url:
            # URL format: .../storage/v1/object/public/{bucket}/{path}/{file}
            # Extract everything after /public/{bucket}/ up to the last slash
            marker = f"/public/{BUCKET}/"
            idx = url.find(marker)
            if idx != -1:
                path_in_bucket = url[idx + len(marker):]
                storage_prefix = path_in_bucket.rsplit("/", 1)[0]

        if not storage_prefix:
            # Fallback to current naming convention
            ed_category = edition.get('category', 'finance')
            storage_prefix = f"editions/{ed_category}-{ed_date}-{edition['id'][:8]}"

        storage_ok = False
        try:
            files = db.storage.from_(BUCKET).list(path=storage_prefix)
            if files:
                paths = [f"{storage_prefix}/{f['name']}" for f in files]
                db.storage.from_(BUCKET).remove(paths)
                logger.info(
                    "Deleted %d files from storage: %s", len(paths), storage_prefix
                )
            else:
                logger.info("Cleanup: no files found at %s", storage_prefix)
            storage_ok = True
        except Exception as e:
            logger.warning("Storage cleanup failed for %s: %s", ed_date, e)

        if storage_ok:
            db.table("editions").update({"status": "deleted"}).eq("id", edition["id"]).execute()
            logger.info("Marked edition %s as deleted", ed_date)
        else:
            logger.warning("Skipping DB deletion for %s — storage cleanup failed", ed_date)
