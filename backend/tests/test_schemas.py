from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import (
    AnalysisMomentFeedbackModel,
    ConfigModel,
    IndexModel,
    MetaModel,
    PatternCalibrationRequestModel,
    RecurringPatternsModel,
    WeeklyRollupModel,
)


def test_config_model_applies_llm_defaults(config):
    payload = config.model_dump(mode="json")
    payload.pop("llm", None)

    loaded = ConfigModel.model_validate(payload)

    assert loaded.llm.provider == "openrouter"
    assert loaded.llm.model == "google/gemini-2.5-flash-lite"
    assert loaded.setup_completed is True


def test_meta_model_defaults_practice_and_processing(config):
    meta = MetaModel.model_validate(
        {
            "id": "2026-05-08_en_test",
            "created_at": "2026-05-08T10:00:00+00:00",
            "language": "en",
            "title": "test",
            "title_source": "user",
            "duration_seconds": 180,
            "file_size_bytes": 1024,
            "status": "ready",
            "save_mode": "full",
            "source": "webcam",
            "read": False,
            "processing": {},
            "retention": {},
        }
    )

    assert meta.practice.assignment_completed is False
    assert meta.practice.previous_goal_result == "unmarked"
    assert meta.processing.progress_percent == 0
    assert meta.retention.compressed is False


def test_index_model_rejects_negative_totals():
    with pytest.raises(ValidationError):
        IndexModel.model_validate(
            {
                "generated_at": "2026-05-08T10:00:00+00:00",
                "sessions": [],
                "streak": {"current": 0, "longest": 0, "last_active_date": None, "last_reset_date": None},
                "totals": {"sessions": 1, "total_seconds": -5, "by_language": {"en": 1, "fr": 0, "es": 0}},
            }
        )


def test_recurring_patterns_model_defaults_confirmed_flag():
    patterns = RecurringPatternsModel.model_validate(
        {
            "language": "en",
            "updated_at": "2026-05-08T10:00:00+00:00",
            "patterns": [
                {
                    "name": "weak close",
                    "description": "Ends without a final decision.",
                    "count": 2,
                    "first_seen": "2026-05-01",
                    "last_seen": "2026-05-07",
                    "recent_sessions": ["a", "b"],
                }
            ],
        }
    )

    assert patterns.patterns[0].confirmed is False


def test_weekly_rollup_model_requires_focus_string():
    with pytest.raises(ValidationError):
        WeeklyRollupModel.model_validate(
            {
                "week": "2026-W18",
                "generated_at": "2026-05-08T10:00:00+00:00",
                "session_count": 2,
                "total_seconds": 400,
                "languages_used": ["en"],
                "summary_prose": "summary",
                "improvements": [],
                "still_breaking": [],
                "focus_for_next_week": None,
            }
        )


def test_analysis_moment_feedback_normalizes_kind_aliases():
    moment = AnalysisMomentFeedbackModel.model_validate(
        {
            "timestamp_seconds": 12,
            "label": "Strong line",
            "transcript_quote": "I should say it directly.",
            "coaching_note": "Direct and useful.",
            "kind": "good moment",
        }
    )

    assert moment.kind == "strength"


def test_pattern_calibration_request_rejects_unknown_action():
    with pytest.raises(ValidationError):
        PatternCalibrationRequestModel.model_validate(
            {
                "action": "archive",
                "pattern_name": "weak close",
            }
        )
