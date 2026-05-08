from __future__ import annotations

from datetime import datetime, timezone

from app.services.index import rebuild_index
from app.services.json_io import write_json_file
from app.services.sessions import create_session, get_session_transcript_json_path, update_session_meta


def test_streak_uses_strict_two_minute_minimum(config):
    short = create_session(
        config,
        language="en",
        title="short",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    earlier = create_session(
        config,
        language="en",
        title="earlier",
        created_at=datetime(2026, 4, 29, 9, 0, tzinfo=timezone.utc),
    )
    latest = create_session(
        config,
        language="en",
        title="latest",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    update_session_meta(config, short.id, updates={"status": "ready", "duration_seconds": 119.9})
    update_session_meta(config, earlier.id, updates={"status": "ready", "duration_seconds": 180})
    update_session_meta(config, latest.id, updates={"status": "ready", "duration_seconds": 120})

    index = rebuild_index(config, now=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc))

    assert index.streak.current == 1
    assert index.streak.longest == 1
    assert index.streak.last_active_date == "2026-05-01"


def test_video_only_session_counts_for_streak_when_duration_qualifies(config):
    first = create_session(
        config,
        language="en",
        title="first",
        save_mode="video_only",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    second = create_session(
        config,
        language="en",
        title="second",
        save_mode="video_only",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    update_session_meta(config, first.id, updates={"status": "ready", "duration_seconds": 120})
    update_session_meta(config, second.id, updates={"status": "ready", "duration_seconds": 180})

    index = rebuild_index(config, now=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc))

    assert index.streak.current == 2
    assert index.streak.longest == 2
    assert index.streak.last_active_date == "2026-05-01"


def test_streak_tracks_longest_run_and_current_run_separately(config):
    first = create_session(
        config,
        language="en",
        title="first",
        created_at=datetime(2026, 4, 26, 9, 0, tzinfo=timezone.utc),
    )
    second = create_session(
        config,
        language="en",
        title="second",
        created_at=datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc),
    )
    third = create_session(
        config,
        language="en",
        title="third",
        created_at=datetime(2026, 4, 28, 9, 0, tzinfo=timezone.utc),
    )
    latest = create_session(
        config,
        language="en",
        title="latest",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    for session_id in (first.id, second.id, third.id, latest.id):
        update_session_meta(config, session_id, updates={"status": "ready", "duration_seconds": 180})

    index = rebuild_index(config, now=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc))

    assert index.streak.current == 1
    assert index.streak.longest == 3
    assert index.streak.last_active_date == "2026-05-01"
    assert index.streak.last_reset_date == "2026-04-30"


def test_multiple_qualifying_sessions_on_same_day_count_as_one_streak_day(config):
    morning = create_session(
        config,
        language="en",
        title="morning",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    evening = create_session(
        config,
        language="en",
        title="evening",
        created_at=datetime(2026, 4, 30, 18, 0, tzinfo=timezone.utc),
    )
    latest = create_session(
        config,
        language="en",
        title="latest",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )

    for session_id in (morning.id, evening.id, latest.id):
        update_session_meta(config, session_id, updates={"status": "ready", "duration_seconds": 180})

    index = rebuild_index(config, now=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc))

    assert index.streak.current == 2
    assert index.streak.longest == 2
    assert index.streak.last_active_date == "2026-05-01"


def test_rebuild_repairs_zero_duration_from_transcript_timestamps(config):
    session = create_session(
        config,
        language="en",
        title="transcribed",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )
    update_session_meta(config, session.id, updates={"status": "ready", "duration_seconds": 0})
    write_json_file(
        get_session_transcript_json_path(config, session.id),
        [
            {"start_seconds": 0, "end_seconds": 55, "text": "first"},
            {"start_seconds": 55, "end_seconds": 181.4, "text": "second"},
        ],
    )

    index = rebuild_index(config, now=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc))

    indexed_session = next(item for item in index.sessions if item.id == session.id)
    assert indexed_session.duration_seconds == 181.4
    assert index.streak.current == 1
    assert index.streak.last_active_date == "2026-05-01"
