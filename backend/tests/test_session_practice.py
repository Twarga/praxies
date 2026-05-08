from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.sessions import create_session, load_session_bundle, load_session_meta, update_session_meta, write_session_analysis


def test_session_bundle_includes_previous_practice_goal(config):
    previous = create_session(
        config,
        language="en",
        title="previous",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )
    current = create_session(
        config,
        language="en",
        title="current",
        created_at=datetime(2026, 5, 2, 9, 0, tzinfo=timezone.utc),
    )
    _write_analysis_with_goal(config, previous.id, "Give one concrete example for each claim.")
    update_session_meta(config, current.id, updates={"status": "ready", "duration_seconds": 180})

    bundle = load_session_bundle(config, current.id)

    assert bundle is not None
    assert bundle["practice_context"] == {
        "source_session_id": previous.id,
        "source_title": "previous",
        "source_created_at": previous.created_at,
        "goal": "Give one concrete example for each claim.",
        "source_completed": False,
    }


def test_patch_session_practice_tracks_completion_and_previous_goal_result(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    meta = create_session(
        config,
        language="en",
        title="practice tracking",
        created_at=datetime(2026, 5, 2, 9, 0, tzinfo=timezone.utc),
    )

    with TestClient(main_module.app) as client:
        response = client.patch(
            f"/api/sessions/{meta.id}/practice",
            json={
                "assignment_completed": True,
                "previous_goal": "Name the fear plainly.",
                "previous_goal_source_session_id": "2026-05-01_en_previous",
                "previous_goal_result": "partially_followed",
                "previous_goal_note": "I named it, but only near the end.",
            },
        )

    assert response.status_code == 200
    payload = response.json()["practice"]
    assert payload["assignment_completed"] is True
    assert payload["assignment_completed_at"]
    assert payload["previous_goal"] == "Name the fear plainly."
    assert payload["previous_goal_result"] == "partially_followed"

    updated = load_session_meta(config, meta.id)
    assert updated.practice.assignment_completed is True
    assert updated.practice.previous_goal_note == "I named it, but only near the end."


def _write_analysis_with_goal(config, session_id: str, goal: str) -> None:
    update_session_meta(config, session_id, updates={"status": "ready", "duration_seconds": 180})
    write_session_analysis(
        config,
        session_id,
        {
            "schema_version": 2,
            "language": "en",
            "prose_verdict": "Useful practice session.",
            "session_summary": "The speaker practiced one clear idea.",
            "main_topics": ["practice"],
            "coaching_report": {
                "headline": "Use examples earlier.",
                "practice_assignment": {
                    "reflection_question": "What am I avoiding saying plainly?",
                    "speaking_drill": "Speak for two minutes with one example.",
                    "behavioral_action": "Write the next concrete step.",
                    "next_session_goal": goal,
                },
            },
            "scorecard": {},
            "language_coach": {},
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
