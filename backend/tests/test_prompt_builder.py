from __future__ import annotations

from datetime import date, datetime, timezone

from app.models import AnalysisModel, RecurringPatternsModel
from app.services.prompt_builder import (
    build_analysis_export_prompt,
    build_analysis_system_prompt,
    build_recurring_patterns_prompt_block,
    build_transcript_user_message,
)


def test_build_recurring_patterns_prompt_block_includes_relative_time():
    block = build_recurring_patterns_prompt_block(
        RecurringPatternsModel(
            language="en",
            updated_at="2026-05-08T10:00:00+00:00",
            patterns=[
                {
                    "name": "weak close",
                    "description": "Ends without a final decision.",
                    "count": 3,
                    "first_seen": "2026-05-01",
                    "last_seen": "2026-05-07",
                    "recent_sessions": ["a", "b"],
                    "confirmed": True,
                }
            ],
        ),
        now=date(2026, 5, 8),
    )

    assert "weak close" in block
    assert "Ends without a final decision." in block
    assert "seen 3 times, last 1 day ago" in block


def test_build_analysis_system_prompt_includes_personal_context_schema_and_language(config):
    prompt = build_analysis_system_prompt(
        config,
        language="fr",
        recurring_patterns=None,
        now=date(2026, 5, 8),
    )

    assert config.personal_context.strip() in prompt
    assert "coaching_report.top_lessons must contain exactly 3 lessons" in prompt
    assert "Respond in french for all prose fields." in prompt
    assert '"schema_version": 2' in prompt
    AnalysisModel.model_validate_json(prompt[prompt.index("{"): prompt.rindex("}") + 1])


def test_build_analysis_system_prompt_includes_recurring_patterns_block(config):
    recurring = RecurringPatternsModel(
        language="en",
        updated_at="2026-05-08T10:00:00+00:00",
        patterns=[
            {
                "name": "plan without ship",
                "description": "Research and planning with no visible deliverable.",
                "count": 4,
                "first_seen": "2026-04-20",
                "last_seen": "2026-05-08",
                "recent_sessions": ["a", "b"],
            }
        ],
    )

    prompt = build_analysis_system_prompt(
        config,
        language="en",
        recurring_patterns=recurring,
        now=date(2026, 5, 8),
    )

    assert "plan without ship" in prompt
    assert "name in recurring_patterns_hit if they appear in this session" in prompt


def test_build_transcript_user_message_formats_timestamps_and_skips_blank_segments():
    message = build_transcript_user_message(
        [
            {"start_seconds": 5, "text": "hello"},
            {"start_seconds": 75, "text": "second line"},
            {"start_seconds": 3605, "text": "long form"},
            {"start_seconds": 12, "text": "   "},
        ]
    )

    assert "[00:05] hello" in message
    assert "[01:15] second line" in message
    assert "[01:00:05] long form" in message
    assert "   " not in message


def test_build_analysis_export_prompt_includes_schema_context_and_transcript(config):
    prompt = build_analysis_export_prompt(
        config,
        language="es",
        transcript_segments=[
            {"start_seconds": 0, "text": "hola"},
            {"start_seconds": 12, "text": "quiero practicar"},
        ],
        recurring_patterns=None,
        now=datetime(2026, 5, 8, 10, 0, tzinfo=timezone.utc),
    )

    assert "=== CONTEXT ===" in prompt
    assert "=== SCHEMA ===" in prompt
    assert "=== TRANSCRIPT ===" in prompt
    assert "[00:00] hola" in prompt
    assert "Respond in spanish." in prompt
