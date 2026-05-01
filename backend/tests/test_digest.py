from __future__ import annotations

from datetime import datetime, timezone

from app.services.digest import select_today_digest_session
from app.services.sessions import create_session, update_session_meta, write_session_analysis


def _write_ready_analysis(config, session_id: str, *, language: str = "en") -> None:
    update_session_meta(config, session_id, updates={"status": "ready", "duration_seconds": 180})
    write_session_analysis(
        config,
        session_id,
        {
            "schema_version": 1,
            "language": language,
            "prose_verdict": "Useful practice session.",
            "session_summary": "The speaker practiced one clear idea.",
            "main_topics": ["practice"],
            "grammar_and_language": {
                "errors": [],
                "fluency_score": 7,
                "vocabulary_level": "B2",
                "filler_words": {},
            },
            "speaking_quality": {
                "clarity": 7,
                "pace": "steady",
                "structure": "clear",
                "executive_presence_notes": "direct",
            },
            "ideas_and_reasoning": {
                "strong_points": ["Clear point."],
                "weak_points": [],
                "logical_flaws": [],
                "factual_errors": [],
                "philosophical_pushback": "",
            },
            "recurring_patterns_hit": [],
            "actionable_improvements": ["Land the final sentence."],
        },
    )


def test_today_digest_prefers_latest_analyzed_session_from_yesterday(config):
    old_session = create_session(
        config,
        language="en",
        title="old",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    yesterday_morning = create_session(
        config,
        language="en",
        title="yesterday morning",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    yesterday_evening = create_session(
        config,
        language="en",
        title="yesterday evening",
        created_at=datetime(2026, 4, 30, 20, 0, tzinfo=timezone.utc),
    )
    today_session = create_session(
        config,
        language="en",
        title="today",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    for meta in [old_session, yesterday_morning, yesterday_evening, today_session]:
        _write_ready_analysis(config, meta.id)

    digest = select_today_digest_session(
        config,
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert digest is not None
    assert digest["session"]["id"] == yesterday_evening.id
    assert digest["digest_date"] == "2026-04-30"
    assert digest["selection"] == "yesterday"


def test_today_digest_falls_back_to_latest_previous_analyzed_session(config):
    older = create_session(
        config,
        language="en",
        title="older",
        created_at=datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc),
    )
    latest_previous = create_session(
        config,
        language="en",
        title="latest previous",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )
    today_session = create_session(
        config,
        language="en",
        title="today",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    for meta in [older, latest_previous, today_session]:
        _write_ready_analysis(config, meta.id)

    digest = select_today_digest_session(
        config,
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert digest is not None
    assert digest["session"]["id"] == latest_previous.id
    assert digest["selection"] == "latest_previous"


def test_today_digest_uses_today_only_when_no_previous_analyzed_session(config):
    today_session = create_session(
        config,
        language="en",
        title="today",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )
    ignored_unanalyzed = create_session(
        config,
        language="en",
        title="ignored",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )

    _write_ready_analysis(config, today_session.id)
    update_session_meta(config, ignored_unanalyzed.id, updates={"status": "ready", "duration_seconds": 180})

    digest = select_today_digest_session(
        config,
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert digest is not None
    assert digest["session"]["id"] == today_session.id
    assert digest["selection"] == "today"
