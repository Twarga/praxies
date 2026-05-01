from __future__ import annotations

import json
from datetime import date, datetime
from math import floor

from app.models import AnalysisModel, ConfigModel, RecurringPatternsModel


LANGUAGE_FULL_NAMES = {
    "en": "english",
    "fr": "french",
    "es": "spanish",
    "ar": "arabic",
}

ANALYSIS_SCHEMA_EXAMPLE = {
    "schema_version": 1,
    "language": "en",
    "prose_verdict": "Strong central idea, weak close.",
    "session_summary": "A short summary of the session.",
    "main_topics": ["topic one", "topic two"],
    "grammar_and_language": {
        "errors": [
            {
                "said": "I was very to do",
                "correct": "I was very reluctant to do",
                "type": "word choice",
                "timestamp_seconds": 842.5,
            }
        ],
        "fluency_score": 7,
        "vocabulary_level": "C1",
        "filler_words": {
            "like": 12,
            "uh": 8,
            "you know": 4,
        },
    },
    "speaking_quality": {
        "clarity": 7,
        "pace": "slightly fast mid-section",
        "structure": "strong open, trailed off at end",
        "executive_presence_notes": "opening confident, conclusion weakens position",
    },
    "ideas_and_reasoning": {
        "strong_points": [
            "protagonist's unnamed feeling as eternal recurrence — original, hold onto it"
        ],
        "weak_points": [
            "did not address Nietzsche's ambivalence about eternal recurrence"
        ],
        "logical_flaws": [],
        "factual_errors": [
            "claimed Nietzsche was an existentialist; he predates the movement by 40 years"
        ],
        "philosophical_pushback": "Your read needs a stronger counterpoint.",
    },
    "recurring_patterns_hit": [
        "weak conclusions (5th time in last 10)",
        "factual claim without citation (3rd time)",
    ],
    "actionable_improvements": [
        "prep one closing sentence before stopping",
        "replace weak phrasing with active vocabulary",
    ],
}


def build_recurring_patterns_prompt_block(
    recurring_patterns: RecurringPatternsModel | None,
    *,
    now: date | datetime | None = None,
) -> str | None:
    if recurring_patterns is None or not recurring_patterns.patterns:
        return None

    reference_date = _coerce_reference_date(now or datetime.now().astimezone())
    lines = [
        "The user has these recurring patterns in this language. Reference them by",
        "name in recurring_patterns_hit if they appear in this session:",
        "",
    ]

    for pattern in recurring_patterns.patterns:
        last_seen_date = date.fromisoformat(pattern.last_seen)
        lines.append(
            f"- {pattern.name} — {pattern.description} "
            f"(seen {pattern.count} times, last {_format_days_ago(reference_date, last_seen_date)})"
        )

    return "\n".join(lines)


def build_analysis_system_prompt(
    config: ConfigModel,
    *,
    language: str,
    recurring_patterns: RecurringPatternsModel | None = None,
    now: date | datetime | None = None,
) -> str:
    language_full_name = LANGUAGE_FULL_NAMES[language]
    recurring_block = build_recurring_patterns_prompt_block(recurring_patterns, now=now)
    sections = [config.personal_context.strip()]

    if recurring_block:
        sections.append(recurring_block)

    sections.append(
        "\n".join(
            [
                "You are analyzing a single video journaling session. Respond ONLY with",
                "valid JSON matching the schema below. All prose fields must be in the",
                f"session's language ({language}). No markdown, no code fences, no",
                "preamble, no explanation — just the JSON object.",
                "",
                "Schema:",
                _format_analysis_schema_example(),
                "",
                "Requirements:",
                "- Follow the feedback style in the personal context above strictly.",
                "- Use the recurring patterns provided. If the user hits one again, name",
                "  it in recurring_patterns_hit exactly as given. Do not invent new",
                "  pattern names when an existing one fits.",
                "- Keep prose_verdict to 1–3 sentences. It is read first, alone, at the",
                "  top of a card.",
                "- actionable_improvements should be 2–4 concrete, specific items.",
                "- Fluency score 0–10, honest calibration. A native speaker is 9–10.",
                "- If there are zero errors in a category, return an empty array — never",
                "  omit the field.",
                "- factual_errors is for verifiable claims. logical_flaws is for reasoning",
                "  gaps. weak_points is for arguments that could be stronger.",
                f"- Respond in {language_full_name} for all prose fields.",
            ]
        )
    )

    return "\n\n".join(sections)


def build_transcript_user_message(transcript_segments: list[dict[str, object]] | None) -> str:
    lines = ["TRANSCRIPT:", "---"]

    for segment in transcript_segments or []:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start_seconds = float(segment.get("start_seconds", 0.0) or 0.0)
        lines.append(f"{_format_transcript_timestamp(start_seconds)} {text}")

    lines.append("---")
    return "\n".join(lines)


def build_subtitle_translation_system_prompt(*, source_language: str, target_language: str) -> str:
    source_name = LANGUAGE_FULL_NAMES[source_language]
    target_name = LANGUAGE_FULL_NAMES[target_language]
    return "\n".join(
        [
            "You translate timed subtitle segments for a video export.",
            f"Translate from {source_name} to {target_name}.",
            "Preserve meaning and tone, but keep each translated subtitle concise enough",
            "to fit into the original timing. Do not add explanations.",
            "Return ONLY valid JSON with this exact shape:",
            '{"segments":[{"index":0,"text":"translated subtitle text"}]}',
        ]
    )


def build_subtitle_translation_user_message(segments: list[dict[str, object]]) -> str:
    payload = {
        "segments": [
            {
                "index": int(segment["index"]),
                "text": str(segment["text"]),
            }
            for segment in segments
        ]
    }
    return json.dumps(payload, ensure_ascii=False)


def build_analysis_export_prompt(
    config: ConfigModel,
    *,
    language: str,
    transcript_segments: list[dict[str, object]] | None,
    recurring_patterns: RecurringPatternsModel | None = None,
    now: date | datetime | None = None,
) -> str:
    language_full_name = LANGUAGE_FULL_NAMES[language]
    recurring_block = build_recurring_patterns_prompt_block(recurring_patterns, now=now) or "None yet."
    transcript_block = build_transcript_user_message(transcript_segments).replace("TRANSCRIPT:\n", "", 1)

    return "\n\n".join(
        [
            "=== CONTEXT ===",
            config.personal_context.strip(),
            "=== RECURRING PATTERNS ===",
            recurring_block,
            "=== SCHEMA ===",
            _format_analysis_schema_example(),
            "=== TRANSCRIPT ===",
            transcript_block,
            "=== INSTRUCTIONS ===",
            f"Respond in {language_full_name}. Return ONLY the JSON object.",
        ]
    )


def _coerce_reference_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        return value.date()
    return value


def _format_analysis_schema_example() -> str:
    AnalysisModel.model_validate(ANALYSIS_SCHEMA_EXAMPLE)
    return json.dumps(ANALYSIS_SCHEMA_EXAMPLE, indent=2, ensure_ascii=False)


def _format_transcript_timestamp(total_seconds: float) -> str:
    safe_seconds = max(0, floor(total_seconds))
    hours = safe_seconds // 3600
    minutes = (safe_seconds % 3600) // 60
    seconds = safe_seconds % 60

    if hours > 0:
        return f"[{hours:02d}:{minutes:02d}:{seconds:02d}]"

    return f"[{minutes:02d}:{seconds:02d}]"


def _format_days_ago(reference_date: date, last_seen_date: date) -> str:
    delta_days = max(0, (reference_date - last_seen_date).days)
    if delta_days == 0:
        return "today"
    if delta_days == 1:
        return "1 day ago"
    if delta_days < 7:
        return f"{delta_days} days ago"
    if delta_days < 14:
        return "1 week ago"
    weeks = round(delta_days / 7)
    return f"{weeks} weeks ago"
