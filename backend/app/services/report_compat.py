"""Report compatibility mapper: v2 → v3.

Maps existing AnalysisModel (v2) reports into the AnalysisModelV3
presentation format without altering stored files.
"""

from __future__ import annotations

from typing import Any


def map_v2_to_v3(v2_payload: dict[str, Any]) -> dict[str, Any]:
    """Convert a v2 analysis.json into the v3 report shape for the UI."""
    coaching = v2_payload.get("coaching_report") or {}

    verdict = (
        coaching.get("headline")
        or coaching.get("opening_read")
        or v2_payload.get("prose_verdict")
        or "This older report does not include a coaching verdict."
    )

    practice = coaching.get("practice_assignment") or {}

    evidence_moments = []
    for moment in coaching.get("moment_feedback") or []:
        evidence_moments.append({
            "timestamp_seconds": float(moment.get("timestamp_seconds", 0)),
            "quote": moment.get("transcript_quote", ""),
            "explanation": moment.get("coaching_note", ""),
        })

    scorecard = {}
    for metric, data in (v2_payload.get("scorecard") or {}).items():
        scorecard[metric] = {
            "score": data.get("score", 0),
            "evidence": data.get("evidence", ""),
            "practice_focus": data.get("practice_focus", ""),
        }

    return {
        "schema_version": 3,
        "language": v2_payload.get("language", "en"),
        "report": {
            "verdict": verdict,
            "previous_goal": {
                "goal_id": None,
                "result": "not_applicable",
                "summary": "",
                "evidence": [],
            },
            "strength": {
                "title": _first_lesson(coaching, "title", "What you did well"),
                "explanation": _first_lesson(coaching, "what_happened", ""),
                "evidence": _best_moment_evidence(coaching),
            },
            "priority_improvement": {
                "title": coaching.get("what_held_back", "Priority improvement"),
                "explanation": _first_lesson(coaching, "why_it_matters", ""),
                "replacement_behavior": coaching.get("practice_assignment", {}).get("behavioral_action", ""),
            },
            "evidence_moments": evidence_moments[:3],
            "practice": {
                "title": practice.get("reflection_question", "Practice exercise"),
                "instructions": practice.get("speaking_drill", practice.get("behavioral_action", "")),
                "success_criteria": _build_success_criteria(practice),
            },
            "next_goal": {
                "goal_id": "",
                "text": practice.get("next_session_goal", v2_payload.get("actionable_improvements", [""])[0]),
                "success_criteria": [],
            },
        },
        "details": {
            "scorecard": scorecard,
            "language": {
                "errors": v2_payload.get("grammar_and_language", {}).get("errors", []),
                "filler_words": v2_payload.get("grammar_and_language", {}).get("filler_words", {}),
            },
            "patterns": v2_payload.get("recurring_patterns_hit", []),
            "v2_map": True,
        },
    }


def _first_lesson(coaching: dict[str, Any], field: str, default: str) -> str:
    lessons = coaching.get("top_lessons") or []
    if lessons:
        return lessons[0].get(field, default)
    return default


def _best_moment_evidence(coaching: dict[str, Any]) -> dict[str, Any] | None:
    best = coaching.get("best_moment") or {}
    if best.get("transcript_quote"):
        return {
            "timestamp_seconds": best.get("timestamp_seconds", 0),
            "quote": best.get("transcript_quote", ""),
        }
    return None


def _build_success_criteria(practice: dict[str, Any]) -> list[str]:
    criteria = []
    for field in ["next_session_goal", "reflection_question", "speaking_drill"]:
        value = practice.get(field, "").strip()
        if value:
            criteria.append(value[:120])
            if len(criteria) >= 3:
                break
    return criteria
