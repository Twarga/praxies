"""Report v3 analysis prompt and validation.

Produces the new coaching report format: verdict, previous-goal result,
one strength, one priority improvement, evidence, practice, next goal.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from math import floor
from typing import Any

from app.models.schemas import AnalysisModelV3
from app.services.coaching_context import build_coaching_context, build_previous_goal_prompt_block
from app.services.recurring_patterns import RecurringPatternsModel
from app.services.config import ConfigModel
from app.services.coaching_repository import get_active_goals


REPORT_V3_SCHEMA_EXAMPLE = {
    "schema_version": 3,
    "language": "en",
    "report": {
        "verdict": "You named the real problem in the middle, but the session ended before you chose an action.",
        "previous_goal": {
            "goal_id": None,
            "result": "partially_followed",
            "summary": "The goal was to start with a concrete example. You gave a vague reference but did not ground the session in a specific scene.",
            "evidence": [
                {
                    "timestamp_seconds": 18,
                    "quote": "Like I said last time, I wanted to focus more.",
                    "explanation": "References the goal but stays abstract — no concrete scene appears."
                }
            ],
        },
        "strength": {
            "title": "Plain language when the thought becomes simple",
            "explanation": "Your clearest sentence used everyday words and a direct verb. That is the register to use more often.",
            "evidence": {
                "timestamp_seconds": 142,
                "quote": "I have not shipped it because I keep redesigning the same part."
            },
        },
        "priority_improvement": {
            "title": "End with one verifiable action",
            "explanation": "The session closes with more reflection instead of a decision. Without a next move, the next recording starts from the same place.",
            "replacement_behavior": "Before you stop recording, say: 'The one thing I will do before my next session is...' and name it.",
        },
        "evidence_moments": [
            {
                "timestamp_seconds": 142,
                "quote": "I have not shipped it because I keep redesigning the same part.",
                "explanation": "Strongest moment — names the blocker in plain language.",
            },
            {
                "timestamp_seconds": 218,
                "quote": "I think I need to just pick one approach.",
                "explanation": "Identifies the solution but stays in planning language — no decision.",
            },
        ],
        "practice": {
            "title": "One-decision close",
            "instructions": "In your next recording, end by naming the single decision you commit to before the next session. No lists, no hedging, no 'I think'.",
            "success_criteria": [
                "One decision is named in the final 20 seconds",
                "No hedging language (should, maybe, I think, probably)",
                "Decision can be checked before the next session",
            ],
        },
        "next_goal": {
            "goal_id": "",
            "text": "End every session with one verifiable action, not a reflection.",
            "success_criteria": [
                "Action is named",
                "Action can be checked tomorrow",
                "No 'I should' or 'I need to think'",
            ],
        },
    },
    "details": {
        "scorecard": {
            "clarity": {"score": 6, "evidence": "Middle section was the clearest.", "practice_focus": "Tighten the first 30 seconds."},
        },
        "language": {},
        "patterns": [],
    },
}


def build_analysis_prompt_v3(
    config: ConfigModel,
    *,
    session_id: str,
    language: str,
    transcript_segments: list[dict[str, object]],
    recurring_patterns: RecurringPatternsModel | None = None,
    now: date | datetime | None = None,
) -> str:
    """Build the v3 analysis system prompt with previous-goal evaluation."""

    context = build_coaching_context(config, session_id=session_id, language=language)
    previous_goal_block = build_previous_goal_prompt_block(context)
    active_goals = get_active_goals(config)

    language_full_name = _language_name(language)

    sections = [
        config.personal_context.strip(),
    ]

    if previous_goal_block:
        sections.append(previous_goal_block)

    if active_goals:
        sections.append(
            "ACTIVE USER GOALS (these can run in parallel):\n"
            + "\n".join(
                f"- [{goal.category}] {goal.text}" + (
                    f" | success: {', '.join(goal.success_criteria)}" if goal.success_criteria else ""
                )
                for goal in active_goals
            )
        )

    if recurring_patterns and recurring_patterns.patterns:
        sections.append("KNOWN RECURRING PATTERNS:\n" + "\n".join(
            f"- {pattern.name}: {pattern.description}"
            for pattern in recurring_patterns.patterns
        ))

    sections.append("\n".join([
        "You are analyzing a single video journal session. Your job is to produce",
        "one clear verdict, one strength, one priority improvement, at most three",
        "evidence moments, one practice exercise, and one measurable next goal.",
        "",
        "Respond ONLY with valid JSON. No markdown, no code fences, no preamble.",
        f"All prose fields must be in {language_full_name}.",
        "",
        "Schema:",
        _format_report_v3_schema(),
        "",
        "RULES:",
        "- The verdict is 2-3 sentences read first. Make it specific, not generic.",
        "- Evaluate the previous goal only against its stated success criteria.",
        "  If the transcript does not contain enough evidence, mark it uncertain.",
        "- The strength names one behavior the user should do more of.",
        "  Give one transcript quote as evidence.",
        "- The priority improvement names the single most useful correction.",
        "  Explain why it matters and what to do instead.",
        "- Evidence moments: at most 3 timestamped quotes with explanations.",
        "  Each claim must cite the transcript. Do not invent quotes.",
        "- The practice exercise is one thing to do before the next session.",
        "  Give clear instructions and measurable success criteria.",
        "- The next goal is one measurable behavior for the next recording.",
        "  It should be verifiable — someone should be able to check it.",
        "- If the transcript is too short or a test, say so plainly.",
        "  Do not invent depth. Coach on how to make the next one analyzable.",
        "- A technical product update, an experiment, or a normal check-in is a valid journal topic.",
        "  Do not ask for a more personal topic just because the session is about Praxis itself.",
        "- Use the active goals only when the transcript actually relates to them. Do not force",
        "  every report into a language drill or a personal-reflection frame.",
        "- Use plain language. Avoid generic encouragement.",
        "- Do not diagnose personality or mental health.",
        f"- Write in {language_full_name}.",
    ]))

    sections.append("Return ONLY VALID JSON matching the schema above.")
    return "\n\n".join(sections)


def build_transcript_user_message_v3(
    transcript_segments: list[dict[str, object]] | None,
) -> str:
    lines = ["TRANSCRIPT:", "---"]
    for segment in transcript_segments or []:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start = float(segment.get("start_seconds", 0.0) or 0.0)
        lines.append(f"{_format_timestamp(start)} {text}")
    lines.append("---")
    return "\n".join(lines)


def validate_report_v3(payload: dict[str, Any]) -> AnalysisModelV3:
    try:
        return AnalysisModelV3.model_validate(payload)
    except Exception as error:
        raise ValueError(f"Report v3 validation failed: {error}") from error


def parse_report_v3_response(response_text: str) -> AnalysisModelV3:
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise ValueError("Analysis response is not valid JSON.") from error

    if not isinstance(payload, dict):
        raise ValueError("Analysis response must be a JSON object.")

    return validate_report_v3(payload)


def _language_name(code: str) -> str:
    return {"en": "english", "fr": "french", "es": "spanish"}.get(code, code)


def _format_timestamp(total_seconds: float) -> str:
    safe = max(0, floor(total_seconds))
    hours = safe // 3600
    minutes = (safe % 3600) // 60
    seconds = safe % 60
    if hours > 0:
        return f"[{hours:02d}:{minutes:02d}:{seconds:02d}]"
    return f"[{minutes:02d}:{seconds:02d}]"


def _format_report_v3_schema() -> str:
    AnalysisModelV3.model_validate(REPORT_V3_SCHEMA_EXAMPLE)
    return json.dumps(REPORT_V3_SCHEMA_EXAMPLE, indent=2, ensure_ascii=False)
