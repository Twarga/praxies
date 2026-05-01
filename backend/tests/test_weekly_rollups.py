from __future__ import annotations

from datetime import datetime, timezone

from app.services.json_io import write_json_file
from app.services.weekly_rollups import (
    get_completed_week_key,
    get_weekly_rollup_path,
    is_weekly_rollup_due,
)


def test_weekly_rollup_not_due_before_configured_sunday_time(config):
    assert (
        is_weekly_rollup_due(
            config,
            now=datetime(2026, 5, 3, 19, 59, tzinfo=timezone.utc),
        )
        is False
    )


def test_weekly_rollup_due_after_configured_sunday_time(config):
    assert (
        is_weekly_rollup_due(
            config,
            now=datetime(2026, 5, 3, 20, 0, tzinfo=timezone.utc),
        )
        is True
    )


def test_weekly_rollup_not_due_on_other_weekdays(config):
    assert (
        is_weekly_rollup_due(
            config,
            now=datetime(2026, 5, 4, 20, 0, tzinfo=timezone.utc),
        )
        is False
    )


def test_weekly_rollup_not_due_when_completed_week_file_exists(config):
    now = datetime(2026, 5, 3, 20, 0, tzinfo=timezone.utc)
    rollup_path = get_weekly_rollup_path(config, get_completed_week_key(now))
    write_json_file(
        rollup_path,
        {
            "week": get_completed_week_key(now),
            "generated_at": now.isoformat(),
            "session_count": 0,
            "total_seconds": 0,
            "languages_used": [],
            "summary_prose": "",
            "improvements": [],
            "still_breaking": [],
            "focus_for_next_week": "",
        },
    )

    assert is_weekly_rollup_due(config, now=now) is False


def test_weekly_rollup_uses_custom_configured_time(config):
    custom_config = config.model_copy(
        update={
            "telegram": config.telegram.model_copy(update={"weekly_rollup_time": "friday 18:30"})
        }
    )

    assert (
        is_weekly_rollup_due(
            custom_config,
            now=datetime(2026, 5, 1, 18, 29, tzinfo=timezone.utc),
        )
        is False
    )
    assert (
        is_weekly_rollup_due(
            custom_config,
            now=datetime(2026, 5, 1, 18, 30, tzinfo=timezone.utc),
        )
        is True
    )


def test_completed_week_key_targets_previous_iso_week():
    assert get_completed_week_key(datetime(2026, 5, 3, 20, 0, tzinfo=timezone.utc)) == "2026-W17"
