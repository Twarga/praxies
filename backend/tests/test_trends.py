from __future__ import annotations

from datetime import datetime, timezone

from app.services.sessions import create_session
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
