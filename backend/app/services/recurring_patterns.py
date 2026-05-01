from __future__ import annotations

from datetime import datetime
from pathlib import Path

from app.models import ConfigModel, RecurringPatternsModel
from app.services.config import ensure_journal_dir
from app.services.json_io import read_json_file, write_json_file


SUPPORTED_PATTERN_LANGUAGES = {"en", "fr", "es"}


def get_patterns_dir(config: ConfigModel) -> Path:
    return ensure_journal_dir(config) / "_patterns"


def get_patterns_file_path(config: ConfigModel, language: str) -> Path:
    _validate_language(language)
    return get_patterns_dir(config) / f"{language}.json"


def build_empty_recurring_patterns(language: str, *, now: datetime | None = None) -> RecurringPatternsModel:
    _validate_language(language)
    return RecurringPatternsModel(
        language=language,
        updated_at=(now or datetime.now().astimezone()).isoformat(timespec="seconds"),
        patterns=[],
    )


def load_recurring_patterns(config: ConfigModel, language: str) -> RecurringPatternsModel:
    path = get_patterns_file_path(config, language)
    if not path.exists():
        return save_recurring_patterns(config, build_empty_recurring_patterns(language))

    patterns = RecurringPatternsModel.model_validate(read_json_file(path))
    if patterns.language != language:
        raise ValueError("Recurring pattern language does not match requested language.")
    return patterns


def save_recurring_patterns(config: ConfigModel, patterns: RecurringPatternsModel) -> RecurringPatternsModel:
    _validate_language(patterns.language)
    path = get_patterns_file_path(config, patterns.language)
    write_json_file(path, patterns.model_dump(mode="json"))
    return patterns


def merge_recurring_pattern_hits(
    config: ConfigModel,
    *,
    language: str,
    session_id: str,
    hits: list[str] | None,
    now: datetime | None = None,
) -> RecurringPatternsModel:
    patterns = load_recurring_patterns(config, language)
    updated = merge_recurring_patterns(patterns, session_id=session_id, hits=hits, now=now)
    return save_recurring_patterns(config, updated)


def merge_recurring_patterns(
    patterns: RecurringPatternsModel,
    *,
    session_id: str,
    hits: list[str] | None,
    now: datetime | None = None,
) -> RecurringPatternsModel:
    _validate_language(patterns.language)
    normalized_hits = _dedupe_hits(hits)
    if not normalized_hits:
        return patterns

    reference = now or datetime.now().astimezone()
    reference_date = reference.date().isoformat()
    updated_at = reference.isoformat(timespec="seconds")
    entries = [entry.model_dump(mode="json") for entry in patterns.patterns]
    by_name = {str(entry["name"]).casefold(): entry for entry in entries}

    for hit in normalized_hits:
        key = hit.casefold()
        existing = by_name.get(key)
        if existing is None:
            entry = {
                "name": hit,
                "description": hit,
                "count": 1,
                "first_seen": reference_date,
                "last_seen": reference_date,
                "recent_sessions": [session_id],
            }
            entries.append(entry)
            by_name[key] = entry
            continue

        if session_id not in existing["recent_sessions"]:
            existing["count"] = int(existing["count"]) + 1
            existing["recent_sessions"].append(session_id)
        existing["last_seen"] = reference_date

    return RecurringPatternsModel(
        language=patterns.language,
        updated_at=updated_at,
        patterns=entries,
    )


def _validate_language(language: str) -> None:
    if language not in SUPPORTED_PATTERN_LANGUAGES:
        raise ValueError("Unsupported recurring pattern language.")


def _dedupe_hits(hits: list[str] | None) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for hit in hits or []:
        normalized = " ".join(str(hit).split())
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return deduped
