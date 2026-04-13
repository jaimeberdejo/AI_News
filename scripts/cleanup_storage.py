"""
One-time cleanup script to purge orphaned storage folders from the videos bucket.

Handles both old-format root-level folders ({date}-{shortid}/)
and current-format folders (editions/{category}-{date}-{shortid}/).

Run with:
  python -m scripts.cleanup_storage            # dry-run (safe, shows what would be deleted)
  python -m scripts.cleanup_storage --delete   # actually delete
"""
import logging
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

from pipeline.db import get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

BUCKET = "videos"
DRY_RUN = "--delete" not in sys.argv


def list_all(db, prefix: str) -> list[str]:
    """List all file paths under a given storage prefix (handles pagination)."""
    paths = []
    offset = 0
    limit = 100
    while True:
        items = db.storage.from_(BUCKET).list(
            path=prefix,
            options={"limit": limit, "offset": offset},
        )
        if not items:
            break
        for item in items:
            name = item.get("name", "")
            if not name:
                continue
            # If item is a folder (no extension), recurse
            if "." not in name:
                paths.extend(list_all(db, f"{prefix}/{name}"))
            else:
                paths.append(f"{prefix}/{name}")
        if len(items) < limit:
            break
        offset += limit
    return paths


def delete_folder(db, prefix: str, dry_run: bool) -> int:
    """Delete all files under prefix. Returns number of files deleted."""
    paths = list_all(db, prefix)
    if not paths:
        logger.info("  No files found under %s", prefix)
        return 0
    logger.info("  Found %d file(s) under %s", len(paths), prefix)
    for p in paths:
        logger.info("    %s", p)
    if not dry_run:
        db.storage.from_(BUCKET).remove(paths)
        logger.info("  Deleted %d file(s)", len(paths))
    return len(paths)


def main():
    if DRY_RUN:
        logger.info("DRY RUN — pass --delete to actually remove files")

    db = get_db()
    cutoff = str(date.today() - timedelta(days=7))
    total_files = 0
    total_folders = 0

    # --- Pass 1: Root-level old-format folders ({date}-{shortid}) ---
    logger.info("=== Scanning root-level folders (old format) ===")
    root_items = db.storage.from_(BUCKET).list(path="")
    for item in root_items or []:
        name = item.get("name", "")
        # Old format: YYYY-MM-DD-xxxxxxxx  (date prefix, then 8-char hex)
        parts = name.split("-")
        if len(parts) >= 4 and len(parts[0]) == 4 and parts[0].isdigit():
            folder_date = f"{parts[0]}-{parts[1]}-{parts[2]}"
            if folder_date < cutoff:
                logger.info("Folder to delete: %s (date %s)", name, folder_date)
                count = delete_folder(db, name, DRY_RUN)
                total_files += count
                total_folders += 1
            else:
                logger.info("Keeping (recent): %s", name)

    # --- Pass 2: editions/ subfolder ---
    logger.info("=== Scanning editions/ subfolder ===")
    editions_items = db.storage.from_(BUCKET).list(
        path="editions", options={"limit": 500, "offset": 0}
    )
    for item in editions_items or []:
        name = item.get("name", "")
        parts = name.split("-")
        # Old format: {date}-{shortid}  → parts[0..2] = YYYY, MM, DD
        # New format: {category}-{date}-{shortid}  → parts[1..3] = YYYY, MM, DD
        folder_date = None
        if len(parts) >= 4 and len(parts[0]) == 4 and parts[0].isdigit():
            # Old format: YYYY-MM-DD-shortid
            folder_date = f"{parts[0]}-{parts[1]}-{parts[2]}"
        elif len(parts) >= 5 and len(parts[1]) == 4 and parts[1].isdigit():
            # New format: category-YYYY-MM-DD-shortid
            folder_date = f"{parts[1]}-{parts[2]}-{parts[3]}"

        if folder_date is None:
            logger.info("Skipping unrecognized folder: editions/%s", name)
            continue

        if folder_date < cutoff:
            full_prefix = f"editions/{name}"
            logger.info("Folder to delete: %s (date %s)", full_prefix, folder_date)
            count = delete_folder(db, full_prefix, DRY_RUN)
            total_files += count
            total_folders += 1
        else:
            logger.info("Keeping (recent): editions/%s", name)

    logger.info(
        "=== %s complete: %d folder(s), %d file(s) ===",
        "DRY RUN" if DRY_RUN else "DELETE",
        total_folders,
        total_files,
    )
    if DRY_RUN and total_folders > 0:
        logger.info("Run with --delete to actually remove these files.")


if __name__ == "__main__":
    main()
