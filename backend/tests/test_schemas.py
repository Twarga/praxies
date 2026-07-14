from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import (
    AnalysisModelV3,
    AnalysisMomentFeedbackModel,
    AnalysisReportV3Model,
    ConfigModel,
    ConfigModelV2,
    ConfigTranscriptionV2Model,
    IndexModel,
    MetaModel,
    PatternCalibrationRequestModel,
    PreviousGoalResultV3Model,
    ProviderConnectionModel,
    RecurringPatternsModel,
    ReportEvidenceMomentV3Model,
    ReportNextGoalV3Model,
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


# ── v2 configuration schema tests ──────────────────────────────────────────

def test_config_v2_rejects_plaintext_api_key():
    """ConfigModelV2 must not accept a plaintext api_key field."""
    with pytest.raises(ValidationError):
        ConfigModelV2.model_validate(
            {
                "journal_folder": "/tmp/test-journal",
                "transcription": {"cache_folder": "/tmp/models"},
                "api_key": "sk-should-not-be-here",
            }
        )


def test_provider_connection_stores_secret_reference():
    connection = ProviderConnectionModel.model_validate(
        {
            "provider_id": "opencode_go",
            "display_name": "My Go account",
            "auth_profile_id": "secret-uuid-abc",
            "selected_model_id": "deepseek-v4-flash",
            "base_url": "https://opencode.ai/zen/go/v1",
            "enabled": True,
        }
    )
    assert connection.provider_id == "opencode_go"
    assert connection.auth_profile_id == "secret-uuid-abc"
    assert "api_key" not in connection.model_dump(mode="json")


def test_config_v2_defaults():
    config = ConfigModelV2.model_validate(
        {
            "journal_folder": "/tmp/test-journal",
            "transcription": {"cache_folder": "/tmp/models"},
        }
    )
    assert config.schema_version == 2
    assert config.language_default == "en"
    assert config.active_provider_connection_id is None
    assert config.provider_connections == {}
    assert config.transcription.engine_id == "faster_whisper"
    assert config.transcription.device == "cpu"
    assert config.telegram.enabled is False


def test_config_v2_provider_connections_no_secrets():
    config = ConfigModelV2.model_validate(
        {
            "journal_folder": "/tmp/test-journal",
            "transcription": {"cache_folder": "/tmp/models"},
            "provider_connections": {
                "conn-1": {
                    "provider_id": "openrouter",
                    "display_name": "My OpenRouter",
                    "auth_profile_id": "sec-ref-1",
                    "selected_model_id": "google/gemini-2.5-flash-lite",
                    "enabled": True,
                }
            },
        }
    )
    assert len(config.provider_connections) == 1
    conn = config.provider_connections["conn-1"]
    assert conn.auth_profile_id == "sec-ref-1"
    assert conn.selected_model_id == "google/gemini-2.5-flash-lite"
    assert "api_key" not in conn.model_dump(mode="json")


def test_config_v2_transcription_handles_missing_cache_folder():
    with pytest.raises(ValidationError):
        ConfigModelV2.model_validate(
            {
                "journal_folder": "/tmp/test-journal",
                "transcription": {"engine_id": "faster_whisper"},
            }
        )


# ── v3 analysis schema tests ───────────────────────────────────────────────

EN_FIXTURE = {
    "schema_version": 3,
    "language": "en",
    "report": {
        "verdict": "You identified the pattern but did not act on it.",
        "previous_goal": {
            "result": "partially_followed",
            "summary": "Goal was to start with a concrete example. You mentioned one but did not anchor the session to it.",
            "evidence": [
                {"timestamp_seconds": 18, "quote": "Like I said last time, I wanted to focus more.", "explanation": "References the goal but never names the specific example."}
            ],
        },
        "strength": {
            "title": "Plain language when describing the problem",
            "explanation": "Your clearest moment put the issue in one direct sentence.",
            "evidence": {"timestamp_seconds": 142, "quote": "I have not shipped the feature because I keep redesigning it."},
        },
        "priority_improvement": {
            "title": "Close with one action",
            "explanation": "The session ends with reflection, not a decision. That makes the next session start from the same place.",
            "replacement_behavior": "End every recording by saying 'Before my next session, I will...' and name one concrete step.",
        },
        "evidence_moments": [
            {"timestamp_seconds": 142, "quote": "I have not shipped the feature because I keep redesigning it.", "explanation": "Strong because it names the real blocker."},
            {"timestamp_seconds": 218, "quote": "I think I need to just pick one approach.", "explanation": "Identifies the solution but stays in planning language."},
        ],
        "practice": {
            "title": "One-decision close",
            "instructions": "In your next recording, end by naming the single decision you will act on before the next session. No hedging, no 'I think', no list.",
            "success_criteria": ["One decision named", "No hedging language", "Decision is verifiable tomorrow"],
        },
        "next_goal": {
            "goal_id": "",
            "text": "End every session with one verifiable action, not a reflection.",
            "success_criteria": ["Action is named", "Action can be checked tomorrow", "No 'I should' or 'I need to think'"],
        },
    },
    "details": {
        "scorecard": {"clarity": {"score": 6, "evidence": "Middle section was clear.", "practice_focus": "Tighten the first 30 seconds."}},
        "language": {"errors": []},
        "patterns": [],
    },
}


def test_report_v3_minimal_validates():
    analysis = AnalysisModelV3.model_validate(EN_FIXTURE)
    assert analysis.schema_version == 3
    assert analysis.report.verdict
    assert analysis.report.strength.title
    assert analysis.report.priority_improvement.title
    assert len(analysis.report.evidence_moments) == 2
    assert analysis.report.practice.success_criteria


def test_report_v3_defaults_for_empty_fields():
    minimal = AnalysisModelV3.model_validate({"schema_version": 3, "language": "fr"})
    assert minimal.report.verdict == ""
    assert minimal.report.previous_goal.result == "not_applicable"
    assert minimal.report.evidence_moments == []
    assert minimal.details == {}


def test_report_v3_rejects_invalid_language():
    with pytest.raises(ValidationError):
        AnalysisModelV3.model_validate({"schema_version": 3, "language": "de"})


def test_report_v3_rejects_invalid_previous_goal_result():
    with pytest.raises(ValidationError):
        PreviousGoalResultV3Model.model_validate({"result": "extreme"})


def test_report_v3_next_goal_has_id_and_criteria():
    goal = ReportNextGoalV3Model.model_validate({
        "goal_id": "g-abc-123",
        "text": "Name the blocker before the third minute.",
        "success_criteria": ["Blocker is named", "Named before 3:00"],
    })
    assert goal.goal_id == "g-abc-123"
    assert len(goal.success_criteria) == 2


def test_report_v3_evidence_moment_defaults():
    moment = ReportEvidenceMomentV3Model.model_validate({"timestamp_seconds": 45.5})
    assert moment.timestamp_seconds == 45.5
    assert moment.quote == ""
    assert moment.explanation == ""
