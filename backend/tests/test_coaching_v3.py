"""Coaching context, v3 prompt, and report compatibility tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.coaching_context import (
    build_coaching_context,
    build_previous_goal_prompt_block,
)
from app.services.prompt_builder_v3 import (
    REPORT_V3_SCHEMA_EXAMPLE,
    build_analysis_prompt_v3,
    build_transcript_user_message_v3,
    parse_report_v3_response,
    validate_report_v3,
)
from app.services.report_compat import map_v2_to_v3


SAMPLE_TRANSCRIPT = [
    {"start_seconds": 0.0, "end_seconds": 10.0, "text": "I am testing the recording pipeline."},
    {"start_seconds": 10.0, "end_seconds": 22.0, "text": "The audio quality seems fine and the camera is working."},
    {"start_seconds": 22.0, "end_seconds": 35.0, "text": "Today I want to practice clearer explanations of technical ideas."},
]


SAMPLE_V2_ANALYSIS = {
    "schema_version": 2,
    "language": "en",
    "prose_verdict": "You started strong but lost specificity mid-session.",
    "session_summary": "The session explored communication challenges with clear early examples that faded to abstraction.",
    "main_topics": ["communication", "feedback"],
    "coaching_report": {
        "headline": "Your examples were strongest when they named real people.",
        "opening_read": "You began with a concrete story about a coworker. That was the clearest part. After minute two, you moved to general principles and lost the thread.",
        "what_improved": "You gave one strong, specific example early in the session.",
        "what_held_back": "The second half stayed in abstract advice mode.",
        "best_moment": {
            "timestamp_seconds": 42,
            "label": "Strong example",
            "transcript_quote": "Last week Sarah asked for feedback and I gave her three vague comments instead of one clear note.",
            "coaching_note": "This is useful because it names a real person and a real mistake.",
        },
        "top_lessons": [
            {"title": "Real people make better examples", "what_happened": "Your strongest moment used a real name.", "why_it_matters": "Specific examples are coachable; general ones are not.", "next_move": "Name one real person in each session."},
        ],
        "moment_feedback": [
            {"timestamp_seconds": 42, "label": "Good", "transcript_quote": "I gave her three vague comments.", "coaching_note": "Good self-awareness."},
            {"timestamp_seconds": 98, "label": "Weak", "transcript_quote": "Communication is really important in teams.", "coaching_note": "Generic — no example."},
        ],
        "practice_assignment": {
            "reflection_question": "Who would get clearer feedback from you this week?",
            "speaking_drill": "Name one person and one specific piece of feedback you owe them.",
            "behavioral_action": "Write the first sentence of that feedback now.",
            "next_session_goal": "Anchor every major claim to a real person and a real situation.",
        },
    },
    "scorecard": {
        "clarity": {"score": 6, "evidence": "Strong early example.", "practice_focus": "Maintain specificity past minute two."},
    },
    "grammar_and_language": {"errors": [], "fluency_score": 7, "vocabulary_level": "B2", "filler_words": {"like": 4, "um": 3}},
    "speaking_quality": {"clarity": 6, "pace": "steady", "structure": "strong open, weak close", "executive_presence_notes": "Good when anchored to examples."},
    "ideas_and_reasoning": {"strong_points": ["Self-aware about feedback quality"], "weak_points": ["Drifted to abstraction"], "logical_flaws": [], "factual_errors": [], "philosophical_pushback": ""},
    "recurring_patterns_hit": ["abstract before concrete"],
    "actionable_improvements": ["Name real people in examples.", "End with one decision."],
}


class TestCoachingContext:
    def test_builds_context_for_new_session(self, config):
        context = build_coaching_context(config, session_id="2026-07-12_en_test", language="en")
        assert "profile" in context
        assert "active_goal" in context
        assert "previous_assignment" in context
        assert "previous_goal" in context
        assert "recent_trends" in context

    def test_previous_goal_is_none_for_first_session(self, config):
        context = build_coaching_context(config, session_id="2026-07-12_en_first", language="en")
        assert context["previous_goal"] is None
        assert context["active_goal"]["text"] == ""

    def test_previous_goal_prompt_block_empty_when_no_goal(self):
        context = {"active_goal": {"text": ""}, "previous_goal": None, "previous_assignment": {}}
        block = build_previous_goal_prompt_block(context)
        assert block == ""

    def test_previous_goal_prompt_block_includes_criteria(self):
        context = {
            "active_goal": {
                "text": "Start with a concrete example.",
                "success_criteria": ["Example is named", "Example is from last 48 hours"],
            },
            "previous_goal": {},
            "previous_assignment": {"completed": True},
        }
        block = build_previous_goal_prompt_block(context)
        assert "concrete example" in block
        assert "success criteria" in block.lower()
        assert "completed" in block


class TestPromptBuilderV3:
    def test_builds_prompt_for_english(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="2026-07-12_en_v3",
            language="en",
            transcript_segments=SAMPLE_TRANSCRIPT,
        )
        assert "personal context" not in prompt.lower() or "test context" in prompt.lower()
        assert "evidence" in prompt.lower()
        assert "VALID JSON" in prompt

    def test_builds_prompt_for_french(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="2026-07-12_fr_v3",
            language="fr",
            transcript_segments=SAMPLE_TRANSCRIPT,
        )
        assert "french" in prompt.lower() or "français" in prompt.lower()

    def test_prompt_includes_previous_goal_when_active(self, config):
        from app.services.coaching_repository import create_goal
        create_goal(config, text="Speak more clearly.", source_session_id="test-1")

        prompt = build_analysis_prompt_v3(
            config,
            session_id="2026-07-12_en_v3b",
            language="en",
            transcript_segments=SAMPLE_TRANSCRIPT,
        )
        assert "PREVIOUS GOAL" in prompt

    def test_prompt_keeps_parallel_goals_and_validates_technical_journals(self, config):
        from app.services.coaching_repository import create_goal
        create_goal(config, text="Use one concrete example in French.", source_session_id="one", category="language")
        create_goal(config, text="Explain the Praxis test result clearly.", source_session_id="two", category="project")

        prompt = build_analysis_prompt_v3(
            config,
            session_id="2026-07-12_en_parallel",
            language="en",
            transcript_segments=SAMPLE_TRANSCRIPT,
        )

        assert "ACTIVE USER GOALS" in prompt
        assert "concrete example in French" in prompt
        assert "Praxis test result" in prompt
        assert "technical product update" in prompt

    def test_schema_example_validates(self):
        from app.models import AnalysisModelV3
        validated = AnalysisModelV3.model_validate(REPORT_V3_SCHEMA_EXAMPLE)
        assert validated.schema_version == 3
        assert validated.report.verdict
        assert validated.report.strength.title
        assert validated.report.priority_improvement.title
        assert len(validated.report.evidence_moments) == 2
        assert validated.report.practice.success_criteria

    def test_transcript_user_message_formats_correctly(self):
        msg = build_transcript_user_message_v3(SAMPLE_TRANSCRIPT)
        assert "TRANSCRIPT" in msg
        assert "[00:00]" in msg
        assert "recording pipeline" in msg

    def test_parse_valid_response(self):
        response = json.dumps(REPORT_V3_SCHEMA_EXAMPLE)
        parsed = parse_report_v3_response(response)
        assert parsed.schema_version == 3
        assert parsed.language == "en"

    def test_parse_rejects_non_json(self):
        with pytest.raises(ValueError, match="not valid JSON"):
            parse_report_v3_response("not json")

    def test_validate_rejects_missing_language(self):
        bad = {"schema_version": 3}
        with pytest.raises(ValueError):
            validate_report_v3(bad)


class TestReportCompatibility:
    def test_maps_v2_to_v3_shape(self):
        result = map_v2_to_v3(SAMPLE_V2_ANALYSIS)
        assert result["schema_version"] == 3
        assert result["report"]["verdict"]
        assert result["report"]["strength"]["title"]
        assert result["report"]["priority_improvement"]["title"]
        assert len(result["report"]["evidence_moments"]) == 2
        assert result["report"]["practice"]["title"]
        assert result["details"]["v2_map"] is True

    def test_verdict_maps_from_headline(self):
        result = map_v2_to_v3(SAMPLE_V2_ANALYSIS)
        assert "real people" in result["report"]["verdict"].lower()

    def test_evidence_preserves_timestamps(self):
        result = map_v2_to_v3(SAMPLE_V2_ANALYSIS)
        moments = result["report"]["evidence_moments"]
        assert moments[0]["timestamp_seconds"] == 42
        assert "vague" in moments[0]["quote"]

    def test_scorecard_preserved_in_details(self):
        result = map_v2_to_v3(SAMPLE_V2_ANALYSIS)
        assert "clarity" in result["details"]["scorecard"]

    def test_empty_v2_still_produces_v3_shape(self):
        result = map_v2_to_v3({"schema_version": 2, "language": "en", "coaching_report": {}})
        assert result["schema_version"] == 3
        assert result["report"]["verdict"]
        assert result["report"]["evidence_moments"] == []

    def test_missing_coaching_report_does_not_break(self):
        result = map_v2_to_v3({"schema_version": 2, "language": "fr"})
        assert result["schema_version"] == 3
        assert result["language"] == "fr"
