from __future__ import annotations

from datetime import datetime, timezone
import json

from app.services.json_io import read_json_file
from app.services.json_io import write_json_file
from app.services.sessions import create_session, update_session_meta, write_session_analysis
from app.services.weekly_rollups import (
    generate_weekly_rollup,
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


def test_generate_weekly_rollup_writes_completed_week_file(config):
    now = datetime(2026, 5, 3, 20, 0, tzinfo=timezone.utc)
    included = create_session(
        config,
        language="en",
        title="included",
        created_at=datetime(2026, 4, 22, 9, 0, tzinfo=timezone.utc),
    )
    ignored = create_session(
        config,
        language="en",
        title="ignored",
        created_at=datetime(2026, 4, 30, 9, 0, tzinfo=timezone.utc),
    )
    _write_weekly_test_analysis(config, included.id, language="en", duration_seconds=600)
    _write_weekly_test_analysis(config, ignored.id, language="en", duration_seconds=900)
    client = _FakeWeeklyClient()

    rollup = generate_weekly_rollup(config, client=client, now=now)

    assert rollup is not None
    assert rollup.week == "2026-W17"
    assert rollup.session_count == 1
    assert rollup.total_seconds == 600
    assert rollup.languages_used == ["en"]
    assert rollup.summary_prose == "A focused week with clearer openings."
    assert client.user_message
    assert included.id in client.user_message
    assert ignored.id not in client.user_message

    saved = read_json_file(get_weekly_rollup_path(config, "2026-W17"))
    assert saved["week"] == "2026-W17"
    assert saved["focus_for_next_week"] == "End each session with one direct close."


def test_generate_weekly_rollup_returns_none_when_not_due(config):
    client = _FakeWeeklyClient()

    rollup = generate_weekly_rollup(
        config,
        client=client,
        now=datetime(2026, 5, 3, 19, 59, tzinfo=timezone.utc),
    )

    assert rollup is None
    assert client.user_message == ""


def test_generate_weekly_rollup_writes_empty_rollup_without_llm(config):
    now = datetime(2026, 5, 3, 20, 0, tzinfo=timezone.utc)
    client = _FakeWeeklyClient()

    rollup = generate_weekly_rollup(config, client=client, now=now)

    assert rollup is not None
    assert rollup.week == "2026-W17"
    assert rollup.session_count == 0
    assert rollup.summary_prose == "No analyzed sessions were available for this completed week."
    assert client.user_message == ""


class _FakeWeeklyClient:
    def __init__(self) -> None:
        self.system_prompt = ""
        self.user_message = ""

    def complete_json(self, **kwargs):
        self.system_prompt = kwargs["system_prompt"]
        self.user_message = kwargs["user_message"]
        return json.dumps(
            {
                "summary_prose": "A focused week with clearer openings.",
                "improvements": ["Cleaner opening structure."],
                "still_breaking": ["Conclusions remain soft."],
                "focus_for_next_week": "End each session with one direct close.",
            }
        )


def _write_weekly_test_analysis(
    config,
    session_id: str,
    *,
    language: str,
    duration_seconds: float,
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
            "recurring_patterns_hit": ["soft conclusions"],
            "actionable_improvements": ["Land the final sentence."],
        },
    )
