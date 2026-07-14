"""Bounded coaching context and previous-goal integration.

Builds the context package sent to the LLM before analysis:
coach profile, active goal, previous exercise completion,
confirmed patterns, compact trends, and the new transcript.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.models.schemas import ConfigModel, GoalModel, PracticeAssignmentModel, RecurringPatternsModel
from app.services.coaching_repository import (
    get_active_goal,
    get_current_assignment,
    load_coach_profile,
)
from app.services.recurring_patterns import load_recurring_patterns
from app.services.sessions import load_session_meta
from app.services.trends import build_trends_payload


def build_coaching_context(
    config: ConfigModel,
    *,
    session_id: str,
    language: str,
) -> dict[str, Any]:
    """Assemble the bounded context package for this analysis session."""

    try:
        profile = load_coach_profile(config)
    except Exception:
        profile = None

    active_goal = get_active_goal(config)

    current_assignment = get_current_assignment(config)

    previous_goal_context = _build_previous_goal_block(config, session_id, active_goal)

    try:
        recurring_patterns = load_recurring_patterns(config, language)
    except Exception:
        recurring_patterns = None

    try:
        trends = build_trends_payload(config, trend_range="7d")
    except Exception:
        trends = None

    return {
        "profile": {
            "objective": profile.objective if profile else "",
            "language_focus": profile.language_focus if profile else [],
        },
        "active_goal": {
            "goal_id": active_goal.goal_id if active_goal else None,
            "text": active_goal.text if active_goal else "",
            "success_criteria": active_goal.success_criteria if active_goal else [],
            "source_session_id": active_goal.source_session_id if active_goal else None,
        },
        "previous_assignment": {
            "assignment_id": current_assignment.assignment_id if current_assignment else None,
            "title": current_assignment.title if current_assignment else "",
            "completed": current_assignment.completed if current_assignment else None,
        },
        "previous_goal": previous_goal_context,
        "recurring_patterns": (
            recurring_patterns.model_dump(mode="json")
            if recurring_patterns else None
        ),
        "recent_trends": _compact_trend_summary(trends),
    }


def _build_previous_goal_block(
    config: ConfigModel,
    session_id: str,
    active_goal: GoalModel | None,
) -> dict[str, Any] | None:
    if not active_goal:
        return None

    result: dict[str, Any] = {
        "goal_id": active_goal.goal_id,
        "text": active_goal.text,
        "success_criteria": active_goal.success_criteria,
        "source_session_id": active_goal.source_session_id,
        "status": active_goal.status,
    }

    if active_goal.source_session_id:
        try:
            source_meta = load_session_meta(config, active_goal.source_session_id)
            result["source_session_title"] = source_meta.title
            result["source_session_language"] = source_meta.language
        except Exception:
            pass

    return result


def _compact_trend_summary(trends: dict[str, Any] | None) -> str:
    if not trends:
        return "No recent trend data available."

    volume = trends.get("volume_summary") or {}
    sessions = volume.get("sessions", 0)
    hours = volume.get("hours", 0)
    active_days = volume.get("active_days", 0)

    parts = [f"Last 7 days: {sessions} sessions, {hours} hours recorded over {active_days} active days."]

    dimensions = trends.get("scorecard_dimensions") or []
    improving = [d for d in dimensions if d.get("trend") == "improving"]
    slipping = [d for d in dimensions if d.get("trend") == "slipping"]

    if improving:
        labels = [d["label"] for d in improving[:2]]
        parts.append(f"Improving: {', '.join(labels)}.")
    if slipping:
        labels = [d["label"] for d in slipping[:2]]
        parts.append(f"Slipping: {', '.join(labels)}.")

    return " ".join(parts)


def build_previous_goal_prompt_block(context: dict[str, Any]) -> str:
    """Generate the 'previous goal evaluation' block of the analysis prompt."""

    active_goal = context.get("active_goal") or {}
    previous_goal = context.get("previous_goal")

    if not active_goal.get("text"):
        return ""

    lines = [
        "PREVIOUS GOAL (from the last session):",
        f"Goal: \"{active_goal['text']}\"",
    ]

    if active_goal.get("success_criteria"):
        lines.append(f"Success criteria: {', '.join(active_goal['success_criteria'])}")

    completion = context.get("previous_assignment") or {}
    if completion.get("completed") is True:
        lines.append("Previous exercise: completed.")
    elif completion.get("completed") is False:
        lines.append("Previous exercise: not completed.")
    else:
        lines.append("Previous exercise: none assigned.")

    lines.extend([
        "",
        "In your report.previous_goal field:",
        "- Evaluate whether the user met this goal based on transcript evidence.",
        "- Mark the result as: followed, partially_followed, missed, or uncertain.",
        "- If uncertain (not enough evidence in this transcript), say so plainly.",
        "- Do not fabricate evidence. Cite specific timestamps and quotes.",
        "",
        "If this is the first session (no previous goal), set result to 'not_applicable'.",
    ])

    return "\n".join(lines)
