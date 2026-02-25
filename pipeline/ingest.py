"""
RSS ingestion module for the AutoNews_AI pipeline.

Fetches articles from Yahoo Finance and CNBC RSS feeds, then deduplicates
against source_urls already processed today in the DB.

Note: FFmpeg is a system binary, not a pip package.
Install with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)
"""
import feedparser
from datetime import date

from pipeline.db import get_db
from pipeline.models import Article

# Reuters RSS has been dead since 2020 — Yahoo Finance + CNBC only (per research)
FEEDS = [
    "https://finance.yahoo.com/news/rssindex",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
]


def fetch_and_deduplicate() -> list[Article]:
    """Fetch articles from all RSS feeds and remove duplicates.

    Two deduplication passes are applied:
    1. In-process: skips duplicate URLs seen across overlapping RSS feeds.
    2. DB check: filters out source_urls already stored in today's videos rows,
       preventing re-processing on same-day pipeline re-runs.

    Returns a list of unique Article objects not yet in the DB for today.
    """
    all_articles: list[Article] = []
    seen_urls: set[str] = set()

    for feed_url in FEEDS:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries:
            url = entry.get("link", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            # Truncate summary to 500 chars to keep Groq prompt tokens manageable
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

    # Deduplicate against today's already-processed source_urls in the DB
    db = get_db()
    existing = (
        db.table("videos")
        .select("source_url")
        .gte("created_at", str(date.today()))
        .execute()
    )
    today_urls = {row["source_url"] for row in existing.data if row["source_url"]}

    return [a for a in all_articles if a.url not in today_urls]
