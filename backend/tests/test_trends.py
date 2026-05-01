from __future__ import annotations

from datetime import datetime, timezone

from app.services.sessions import create_session, update_session_meta, write_session_analysis
from app.services.trends import build_trends_payload

from .test_digest import _write_ready_analysis


def test_build_trends_payload_filters_by_range(config):
    old_session = create_session(
        config,
        language="en",
        title="old",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    recent_session = create_session(
        config,
        language="en",
        title="recent",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )

    _write_ready_analysis(config, old_session.id)
    _write_ready_analysis(config, recent_session.id)

    payload = build_trends_payload(
        config,
        trend_range="7d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["range"] == "7d"
    assert payload["start_date"] == "2026-04-25"
    assert [session["id"] for session in payload["sessions"]] == [recent_session.id]


def test_build_trends_payload_all_includes_all_analyzed_sessions(config):
    old_session = create_session(
        config,
        language="en",
        title="old",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    recent_session = create_session(
        config,
        language="en",
        title="recent",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )

    _write_ready_analysis(config, old_session.id)
    _write_ready_analysis(config, recent_session.id)

    payload = build_trends_payload(
        config,
        trend_range="all",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["start_date"] is None
    assert [session["id"] for session in payload["sessions"]] == [old_session.id, recent_session.id]


def test_build_trends_payload_rejects_unsupported_range(config):
    try:
        build_trends_payload(config, trend_range="365d")
    except ValueError as error:
        assert str(error) == "Unsupported trends range."
    else:
        raise AssertionError("Expected unsupported range to raise.")


def test_build_trends_payload_groups_fluency_scores_by_language(config):
    english = create_session(
        config,
        language="en",
        title="english",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    french = create_session(
        config,
        language="fr",
        title="french",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(config, english.id, language="en", fluency_score=6)
    _write_analysis_with_score(config, french.id, language="fr", fluency_score=8)

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["fluency_by_language"]["en"] == [
        {"date": "2026-04-28", "session_id": english.id, "score": 6}
    ]
    assert payload["fluency_by_language"]["fr"] == [
        {"date": "2026-04-29", "session_id": french.id, "score": 8}
    ]
    assert payload["fluency_by_language"]["es"] == []


def test_build_trends_payload_aggregates_pattern_hits_by_language(config):
    first = create_session(
        config,
        language="en",
        title="first",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    second = create_session(
        config,
        language="en",
        title="second",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )
    french = create_session(
        config,
        language="fr",
        title="french",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(
        config,
        first.id,
        language="en",
        fluency_score=6,
        pattern_hits=["Weak endings", "filler drift"],
    )
    _write_analysis_with_score(
        config,
        second.id,
        language="en",
        fluency_score=7,
        pattern_hits=["weak endings"],
    )
    _write_analysis_with_score(
        config,
        french.id,
        language="fr",
        fluency_score=8,
        pattern_hits=["accord hésitant"],
    )

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["pattern_hits_by_language"]["en"] == [
        {
            "name": "Weak endings",
            "count": 2,
            "trend": "stable —",
            "recent_sessions": [first.id, second.id],
        },
        {
            "name": "filler drift",
            "count": 1,
            "trend": "trending ↓",
            "recent_sessions": [first.id],
        },
    ]
    assert payload["pattern_hits_by_language"]["fr"] == [
        {
            "name": "accord hésitant",
            "count": 1,
            "trend": "new",
            "recent_sessions": [french.id],
        }
    ]
    assert payload["pattern_hits_by_language"]["es"] == []


def test_build_trends_payload_labels_stable_pattern_trends(config):
    first = create_session(
        config,
        language="en",
        title="first",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    second = create_session(
        config,
        language="en",
        title="second",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(
        config,
        first.id,
        language="en",
        fluency_score=6,
        pattern_hits=["flat close"],
    )
    _write_analysis_with_score(
        config,
        second.id,
        language="en",
        fluency_score=7,
        pattern_hits=["flat close"],
    )

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["pattern_hits_by_language"]["en"] == [
        {
            "name": "flat close",
            "count": 2,
            "trend": "stable —",
            "recent_sessions": [first.id, second.id],
        }
    ]


def test_build_trends_payload_labels_upward_pattern_trends(config):
    first = create_session(
        config,
        language="en",
        title="first",
        created_at=datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc),
    )
    second = create_session(
        config,
        language="en",
        title="second",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    third = create_session(
        config,
        language="en",
        title="third",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )
    fourth = create_session(
        config,
        language="en",
        title="fourth",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(config, first.id, language="en", fluency_score=6, pattern_hits=["weak endings"])
    _write_analysis_with_score(config, second.id, language="en", fluency_score=7, pattern_hits=[])
    _write_analysis_with_score(config, third.id, language="en", fluency_score=7, pattern_hits=["weak endings"])
    _write_analysis_with_score(config, fourth.id, language="en", fluency_score=7, pattern_hits=["weak endings"])

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["pattern_hits_by_language"]["en"][0] == {
        "name": "weak endings",
        "count": 3,
        "trend": "trending ↑",
        "recent_sessions": [first.id, third.id, fourth.id],
    }


def test_build_trends_payload_aggregates_filler_words_by_language(config):
    english = create_session(
        config,
        language="en",
        title="english",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    english_later = create_session(
        config,
        language="en",
        title="english later",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )
    french = create_session(
        config,
        language="fr",
        title="french",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(
        config,
        english.id,
        language="en",
        fluency_score=6,
        filler_words={"Like": 3, "uh": 2, "empty": 0},
    )
    _write_analysis_with_score(
        config,
        english_later.id,
        language="en",
        fluency_score=7,
        filler_words={"like": 4, "you know": 1},
    )
    _write_analysis_with_score(
        config,
        french.id,
        language="fr",
        fluency_score=8,
        filler_words={"euh": 5},
    )

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["filler_words_by_language"]["en"] == [
        {"word": "like", "count": 7},
        {"word": "uh", "count": 2},
        {"word": "you know", "count": 1},
    ]
    assert payload["filler_words_by_language"]["fr"] == [{"word": "euh", "count": 5}]
    assert payload["filler_words_by_language"]["es"] == []


def test_build_trends_payload_calculates_volume_summary(config):
    english = create_session(
        config,
        language="en",
        title="english",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    english_same_day = create_session(
        config,
        language="en",
        title="english same day",
        created_at=datetime(2026, 4, 28, 20, 0, tzinfo=timezone.utc),
    )
    french = create_session(
        config,
        language="fr",
        title="french",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    old = create_session(
        config,
        language="es",
        title="old",
        created_at=datetime(2026, 3, 15, 9, 0, tzinfo=timezone.utc),
    )

    _write_analysis_with_score(config, english.id, language="en", fluency_score=6, duration_seconds=1800)
    _write_analysis_with_score(config, english_same_day.id, language="en", fluency_score=7, duration_seconds=900)
    _write_analysis_with_score(config, french.id, language="fr", fluency_score=8, duration_seconds=2700)
    _write_analysis_with_score(config, old.id, language="es", fluency_score=5, duration_seconds=3600)

    payload = build_trends_payload(
        config,
        trend_range="30d",
        now=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
    )

    assert payload["volume_summary"] == {
        "range": "30d",
        "start_date": "2026-04-02",
        "end_date": "2026-05-01",
        "sessions": 3,
        "hours": 1.5,
        "total_seconds": 5400.0,
        "active_days": 2,
        "by_language": {"en": 2, "fr": 1, "es": 0},
    }


def _write_analysis_with_score(
    config,
    session_id: str,
    *,
    language: str,
    fluency_score: int,
    pattern_hits: list[str] | None = None,
    filler_words: dict[str, int] | None = None,
    duration_seconds: float = 180,
) -> None:
    update_session_meta(config, session_id, updates={"status": "ready", "duration_seconds": duration_seconds})
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
                "fluency_score": fluency_score,
                "vocabulary_level": "B2",
                "filler_words": filler_words or {},
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
            "recurring_patterns_hit": pattern_hits or [],
            "actionable_improvements": ["Land the final sentence."],
        },
    )
