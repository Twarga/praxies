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
    "schema_version": 2,
    "language": "en",
    "prose_verdict": "You found the real issue, but you stopped before turning it into a decision.",
    "session_summary": "The session moved from a vague work concern into a clearer admission that the user is avoiding a specific conversation. The useful part was not the topic itself, but the shift from describing pressure to naming the avoided action.",
    "main_topics": ["topic one", "topic two"],
    "coaching_report": {
        "headline": "You became clearer when you named the avoided action.",
        "opening_read": (
            "You started by circling the problem from a distance, then became much more useful "
            "when you named the exact conversation you are avoiding. That shift matters because "
            "your thinking gets sharper when the session moves from mood to evidence. Next time, "
            "make that move earlier: name the concrete person, decision, or scene in the first two minutes."
        ),
        "what_improved": (
            "Compared with a vague journal entry, this session had a stronger middle. You gave "
            "one concrete example and used it to explain why the issue keeps repeating."
        ),
        "what_held_back": (
            "The ending stayed too abstract. You identified the pressure, but you did not choose "
            "the next action, so the reflection ended with insight instead of practice."
        ),
        "best_moment": {
            "timestamp_seconds": 192.0,
            "label": "The real issue became specific",
            "transcript_quote": "I think I just do not want to tell him directly.",
            "coaching_note": (
                "This is the strongest moment because the sentence names the avoided action. "
                "When you speak this plainly, the report can coach behavior instead of only summarizing feelings."
            ),
            "kind": "insight",
        },
        "top_lessons": [
            {
                "title": "Specific scenes create better self-knowledge.",
                "what_happened": "The session improved when you moved from general pressure to one concrete conversation.",
                "why_it_matters": "A journal entry becomes useful when it gives you a scene you can replay and change.",
                "next_move": "In the next recording, give one concrete example before you explain the emotion.",
            },
            {
                "title": "Insight needs a closing action.",
                "what_happened": "You understood the pattern, but did not decide what to do after the session.",
                "why_it_matters": "Without an action, the same insight can repeat in future recordings without changing behavior.",
                "next_move": "End with one sentence that starts with: Before my next session, I will...",
            },
            {
                "title": "Your language gets stronger when the thought is simple.",
                "what_happened": "Your clearest sentence used plain words and a direct verb.",
                "why_it_matters": "Cleaner thinking makes language practice more natural and easier to correct.",
                "next_move": "Rewrite one complicated sentence into a shorter sentence with one verb and one object.",
            },
        ],
        "moment_feedback": [
            {
                "timestamp_seconds": 42.0,
                "label": "Vague opening",
                "transcript_quote": "It is kind of complicated and stressful.",
                "coaching_note": "This is understandable, but it gives you little to improve. Add the concrete scene sooner.",
                "kind": "breakdown",
            },
            {
                "timestamp_seconds": 192.0,
                "label": "Strong insight",
                "transcript_quote": "I think I just do not want to tell him directly.",
                "coaching_note": "This sentence is useful because it names the avoided action in plain language.",
                "kind": "insight",
            },
            {
                "timestamp_seconds": 311.0,
                "label": "Weak close",
                "transcript_quote": "So yes, I need to think about it more.",
                "coaching_note": "This ending delays action. Replace it with a small decision you can verify tomorrow.",
                "kind": "practice_cue",
            },
        ],
        "behavioral_patterns": [
            {
                "name": "abstract pressure before concrete scene",
                "evidence": "The first minute describes stress without naming a person, decision, or example.",
                "impact": "The session becomes harder to coach because the problem stays too general.",
                "correction": "Use the first two minutes to answer: what happened, who was involved, what did I avoid?",
            }
        ],
        "practice_assignment": {
            "reflection_question": "What am I avoiding saying plainly?",
            "speaking_drill": "Record a two-minute answer with one concrete example and no setup longer than 20 seconds.",
            "behavioral_action": "Write the first sentence of the conversation you are avoiding.",
            "next_session_goal": "For every major claim, give one concrete example from the last 48 hours.",
        },
    },
    "scorecard": {
        "clarity": {
            "score": 7,
            "evidence": "The middle section explains the real issue in plain language.",
            "practice_focus": "Name the concrete scene earlier.",
        },
        "structure": {
            "score": 6,
            "evidence": "The session has a clear middle but no decisive close.",
            "practice_focus": "End with one action sentence.",
        },
        "reflection_depth": {
            "score": 8,
            "evidence": "The user moved from surface stress to the avoided conversation.",
            "practice_focus": "Ask one more why after the first insight.",
        },
        "emotional_awareness": {
            "score": 7,
            "evidence": "The user noticed avoidance rather than only describing pressure.",
            "practice_focus": "Name the feeling and the action it blocks.",
        },
        "specificity": {
            "score": 5,
            "evidence": "Only one concrete example appears.",
            "practice_focus": "Give one timestamped scene for each major claim.",
        },
        "actionability": {
            "score": 4,
            "evidence": "The session ends with more thinking instead of a chosen next step.",
            "practice_focus": "Close with a behavior that can be done before tomorrow.",
        },
        "language_fluency": {
            "score": 7,
            "evidence": "The user is understandable and mostly natural, with some hesitant phrasing.",
            "practice_focus": "Practice shorter sentences with direct verbs.",
        },
    },
    "language_coach": {
        "strongest_sentence": "I think I just do not want to tell him directly.",
        "main_language_gap": "The user sometimes uses vague setup phrases instead of direct verbs.",
        "rewrite_drills": [
            {
                "timestamp_seconds": 42.0,
                "original": "It is kind of complicated and stressful.",
                "improved": "I feel stressed because I have not told him the decision yet.",
                "explanation": "The improved sentence names the feeling, cause, and action.",
            }
        ],
    },
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
    "recurring_patterns_hit": ["weak conclusions", "factual claim without citation"],
    "actionable_improvements": [
        "End the next session with one action sentence.",
        "Give one concrete example before explaining the emotion.",
        "Rewrite one vague sentence into a direct sentence.",
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
                "You are analyzing a single video journaling session for a user who wants",
                "to improve their self-reflection, speaking, and language. This app is",
                "not a summarizer. It is a personal video coach. Your job is to turn the",
                "transcript into a readable lesson, a practice loop, and concrete next",
                "actions. Respond ONLY with valid JSON matching the schema below. All",
                f"prose fields must be in the session's language ({language}). No markdown,",
                "no code fences, no preamble, no explanation outside the JSON object.",
                "",
                "Schema:",
                _format_analysis_schema_example(),
                "",
                "Requirements:",
                "- Follow the feedback style in the personal context above strictly.",
                "- Write in a clear teaching style: plain explanations, concrete examples,",
                "  and short readable paragraphs. Do not produce tiny generic bullet",
                "  fragments. The user should learn something from reading the report.",
                "- coaching_report.opening_read should feel like a thoughtful coach reading",
                "  the session back to the user. It should not be a compressed summary.",
                "- If the transcript is only a technical test, sign-off, counting, or too",
                "  short for real reflection, say that plainly. Do not invent emotional",
                "  depth or big lessons. The useful lesson should be about how to make",
                "  the next recording analyzable: choose one topic, speak for at least",
                "  two minutes, give one concrete example, and close with one action.",
                "- coaching_report.top_lessons must contain exactly 3 lessons. Each lesson",
                "  needs what happened, why it matters, and the next move.",
                "- coaching_report.moment_feedback should contain 3-5 timestamped moments",
                "  from the transcript. Include the quote, the coaching note, and the",
                "  reason the moment matters.",
                "- scorecard metric evidence must cite behavior from this session. practice_focus",
                "  must be a concrete drill or observation target for the next recording.",
                "- language_coach should teach the language, not only mark errors. Include",
                "  natural rewrites that the user can practice aloud.",
                "- Use the recurring patterns provided. If the user hits one again, name",
                "  it in recurring_patterns_hit exactly as given. Do not invent new",
                "  pattern names when an existing one fits.",
                "- behavioral_patterns may include new behavior patterns observed in this",
                "  session, such as avoiding specifics, weak endings, repeated worries,",
                "  strong insight without action, or abstract language.",
                "- Keep prose_verdict to 1–3 sentences. It is read first, alone, at the",
                "  top of a card.",
                "- actionable_improvements should be 2–4 concrete, specific items and should",
                "  mirror the practice assignment.",
                "- Fluency score 0–10, honest calibration. A native speaker is 9–10.",
                "- If there are zero errors in a category, return an empty array — never",
                "  omit the field.",
                "- factual_errors is for verifiable claims. logical_flaws is for reasoning",
                "  gaps. weak_points is for arguments that could be stronger.",
                "- Do not diagnose the user or make medical claims. Stay in coaching,",
                "  communication, reflection, and language-learning territory.",
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
            (
                f"Respond in {language_full_name}. Return ONLY the JSON object. "
                "Do not summarize mechanically: produce a readable coaching report with "
                "three lessons, timestamped moments, a concrete practice assignment, and "
                "language rewrites the user can practice aloud."
            ),
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
