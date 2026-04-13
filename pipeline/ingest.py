"""
RSS ingestion module for the AI News pipeline.

Fetches articles from category-specific RSS feeds, then deduplicates
against source_urls already processed today in the DB for the same category.

Note: FFmpeg is a system binary, not a pip package.
Install with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)
"""
import feedparser
from datetime import date

from pipeline.db import get_db
from pipeline.models import Article

# Reuters RSS has been dead since 2020 — Yahoo Finance + CNBC only (per research)
FINANCE_FEEDS = [
    "https://finance.yahoo.com/news/rssindex",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
]

TECH_FEEDS = [
    "https://feeds.feedburner.com/TechCrunch",
    "https://hnrss.org/frontpage",
    "https://feeds.arstechnica.com/arstechnica/index",
]

FEEDS_BY_CATEGORY = {"finance": FINANCE_FEEDS, "tech": TECH_FEEDS}


def fetch_and_deduplicate(category: str = "finance") -> list[Article]:
    """Fetch articles from category-specific RSS feeds and remove duplicates.

    Two deduplication passes are applied:
    1. In-process: skips duplicate URLs seen across overlapping RSS feeds.
    2. DB check: filters out source_urls already stored in today's videos rows
       for the same category, preventing re-processing on same-day pipeline re-runs.

    Args:
        category: 'finance' or 'tech'. Selects the appropriate feed list and
                  scopes DB dedup to editions of the same category.

    Returns a list of unique Article objects not yet in the DB for today's category.
    """
    feeds = FEEDS_BY_CATEGORY.get(category, FINANCE_FEEDS)

    all_articles: list[Article] = []
    seen_urls: set[str] = set()

    for feed_url in feeds:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries:
            url = entry.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            # Truncate summary to 1000 chars to keep Groq prompt tokens manageable
            article = Article(
                title=entry.get("title", "").strip(),
                summary=entry.get("summary", entry.get("description", ""))[:1000].strip(),
                url=url,
                published=entry.get("published", ""),
            )
            if article.title:  # skip entries with no title
                all_articles.append(article)

    if not all_articles:
        return []

    # Deduplicate against today's already-processed source_urls in the DB,
    # scoped to the same category to avoid cross-category deduplication.
    db = get_db()

    # Get today's edition IDs for this category
    today_editions = (
        db.table("editions")
        .select("id")
        .gte("created_at", str(date.today()))
        .eq("category", category)
        .execute()
    )
    edition_ids = [row["id"] for row in today_editions.data]

    if not edition_ids:
        # No editions yet for this category today — no dedup needed
        return all_articles

    existing = (
        db.table("videos")
        .select("source_url")
        .in_("edition_id", edition_ids)
        .execute()
    )
    today_urls = {row["source_url"] for row in existing.data if row["source_url"]}

    return [a for a in all_articles if a.url not in today_urls]
