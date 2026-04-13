"""
Groq-powered story selection and script writing for AI News pipeline.

select_and_write(articles, category) performs three steps:
  1. Create today's edition row in Supabase with the given category.
  2. Call Groq Llama 3.3 to select 3-5 most important stories.
  3. For each selected story: write a script in the category-appropriate tone,
     then insert a video row with status='generating' BEFORE any TTS call
     (SCRIPT-03 requirement).

Returns (edition_id: str, stories: list[Story]).
"""
import json
import logging
from datetime import date

from groq import Groq

from pipeline.db import get_db
from pipeline.models import Article, Story

logger = logging.getLogger(__name__)

_groq: Groq | None = None


def _get_groq() -> Groq:
    """Return a singleton Groq client. Reads GROQ_API_KEY from environment."""
    global _groq
    if _groq is None:
        _groq = Groq()  # reads GROQ_API_KEY from env automatically
    return _groq


def _create_edition(db, category: str = "finance") -> str:
    """Create a new edition row for today and return its UUID.

    Each pipeline run creates its own edition — multiple editions per day
    are supported (e.g. morning + evening runs, or finance + tech).

    Args:
        db: Supabase client.
        category: 'finance' or 'tech' — stored in the editions.category column.
    """
    today = str(date.today())
    result = db.table("editions").insert({
        "edition_date": today,
        "status": "pending",
        "category": category,
    }).execute()
    edition_id = result.data[0]["id"]
    logger.info("Created new edition %s for %s (category: %s)", edition_id, today, category)
    return edition_id


def _select_stories(articles: list[Article], category: str = "finance") -> list[dict]:
    """Call Groq to select 3-5 most important distinct stories for the given category.

    Returns a list of dicts with keys: index (1-based), reason.
    Result is clamped to at most 5 entries to respect the videos.position
    CHECK (position BETWEEN 1 AND 5) constraint.

    Args:
        articles: List of Article objects to select from.
        category: 'finance' or 'tech' — determines the Groq system prompt.
    """
    articles_text = "\n".join(
        f"{i + 1}. {a.title}: {a.summary[:200]}"
        for i, a in enumerate(articles)
    )
    client = _get_groq()

    if category == "tech":
        system_prompt = (
            "You are a tech news editor. Select the 3 to 5 most important, "
            "distinct tech stories from the list. Prioritize stories about product launches, "
            "major company news, security issues, and AI/developer ecosystem news. "
            'Output ONLY valid JSON: {"stories": [{"index": 1, "reason": "brief reason"}]} '
            "where index is the 1-based article number. Select exactly 3 to 5 stories."
        )
    else:
        system_prompt = (
            "You are a financial news editor. Select the 3 to 5 most important, "
            "distinct financial stories from the list. Prioritize stories with market impact. "
            'Output ONLY valid JSON: {"stories": [{"index": 1, "reason": "brief reason"}]} '
            "where index is the 1-based article number. Select exactly 3 to 5 stories."
        )

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": articles_text},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                timeout=30.0,
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            stories = data.get("stories", [])
            break
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            logger.warning("Groq story selection parse error (attempt %d/3): %s", attempt + 1, e)
            last_exc = e
            stories = []
            break
        except Exception as e:
            logger.warning("Groq story selection error (attempt %d/3): %s", attempt + 1, e)
            last_exc = e
            if attempt == 2:
                raise RuntimeError(f"Groq story selection failed after 3 attempts: {e}") from e
    else:
        stories = []

    if len(stories) < 3:
        logger.warning(
            "Groq selected fewer than 3 stories (%d). Proceeding with available stories.",
            len(stories),
        )

    # Never exceed 5 — enforced by videos.position BETWEEN 1 AND 5 DB constraint
    return stories[:5]


def _write_script(article: Article, category: str = "finance") -> str:
    """Call Groq to write a 45-60 second script for one article in category tone.

    Finance tone: energetic financial influencer (75-115 words, 150 wpm).
    Tech tone: clear, direct tech journalist (150-170 words, longer target).

    Args:
        article: The Article to write a script for.
        category: 'finance' or 'tech' — selects the appropriate system prompt.
    """
    client = _get_groq()

    if category == "tech":
        system_prompt = (
            "You are a sharp tech news narrator. Write a script for a 45-60 second "
            "short-form video in a clear, direct, and informed tone — like a trusted tech journalist "
            "explaining a story to a curious audience. "
            "You MUST write between 150 and 170 words — count carefully before responding. "
            "Lead with the key development. Use short sentences. Explain why it matters. "
            "No hashtags, no emojis, no calls-to-action. Return ONLY the script text."
        )
    else:
        system_prompt = (
            "You are a dynamic financial news narrator. Write a script for a 45-60 second "
            "short-form video in an energetic, direct 'financial influencer' tone. "
            "You MUST write between 150 and 170 words — count carefully before responding. "
            "Lead with the key fact. Use short sentences. Build tension, then resolve. "
            "No hashtags, no emojis, no calls-to-action. Return ONLY the script text."
        )

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Headline: {article.title}\n\nSummary: {article.summary}",
                    },
                ],
                temperature=0.7,
                max_tokens=300,
                timeout=30.0,
            )
            break
        except Exception as e:
            logger.warning("Groq script write error (attempt %d/3): %s", attempt + 1, e)
            if attempt == 2:
                raise RuntimeError(f"Groq script write failed after 3 attempts: {e}") from e
    script_text = response.choices[0].message.content.strip()
    word_count = len(script_text.split())
    if not (150 <= word_count <= 170):
        logger.warning(
            "Script word count out of range: %d words (target 150-170) for '%s'",
            word_count,
            article.title[:50],
        )
    return script_text


def select_and_write(articles: list[Article], category: str = "finance") -> tuple[str, list[Story]]:
    """Select 3-5 stories via Groq and write a video script for each.

    Steps:
      1. Create today's edition in Supabase with the given category.
      2. Call Groq to select 3-5 most important stories from `articles`.
      3. For each selected story:
           a. Write a script via Groq in the category-appropriate tone.
           b. Insert a video row with status='generating' BEFORE any TTS call.
              (SCRIPT-03: ensures failures are traceable in the DB.)

    Args:
        articles: List of Article objects from pipeline/ingest.py.
        category: 'finance' or 'tech' — controls feed selection, prompts, and
                  the category field stored in the editions row.

    Returns:
        (edition_id, stories) where edition_id is the Supabase UUID and
        stories is a list of Story dataclasses with db_video_id set.

    Raises:
        RuntimeError: If articles is empty or no stories are selected.
    """
    if not articles:
        raise RuntimeError("No articles to select from — ingest returned empty list.")

    # Select stories BEFORE creating the edition row so a Groq failure doesn't
    # leave an orphaned 'pending' edition with no videos in the DB.
    selected = _select_stories(articles, category)
    if not selected:
        raise RuntimeError("Groq story selection returned no stories.")

    db = get_db()
    edition_id = _create_edition(db, category)
    logger.info("Edition ID: %s (category: %s)", edition_id, category)

    stories: list[Story] = []
    for position, sel in enumerate(selected, start=1):
        article_index = sel["index"] - 1  # convert 1-based to 0-based
        if article_index < 0 or article_index >= len(articles):
            logger.warning(
                "Groq returned out-of-range index %d (have %d articles), skipping",
                sel["index"],
                len(articles),
            )
            continue

        article = articles[article_index]
        script_text = _write_script(article, category)
        logger.info("Script written for position %d: %s", position, article.title[:50])

        # SCRIPT-03: insert the video row BEFORE any TTS call so failures are traceable
        result = db.table("videos").insert({
            "edition_id": edition_id,
            "position": position,
            "headline": article.title,
            "script_text": script_text,
            "source_url": article.url,
            "status": "generating",
        }).execute()
        video_id = result.data[0]["id"]

        stories.append(Story(
            position=position,
            headline=article.title,
            script_text=script_text,
            source_url=article.url,
            db_video_id=video_id,
        ))

    return edition_id, stories
