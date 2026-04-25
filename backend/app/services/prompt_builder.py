from __future__ import annotations

from datetime import date, datetime

from app.models import RecurringPatternsModel


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


def _coerce_reference_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        return value.date()
    return value


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
