from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from app.models import ConfigModel, PatternCalibrationRequestModel, RecurringPatternsModel
from app.services.config import ensure_journal_dir
from app.services.json_io import read_json_file, write_json_file


SUPPORTED_PATTERN_LANGUAGES = {"en", "fr", "es"}
PATTERN_CLEANUP_INTERVAL = 10
PATTERN_DECAY_AFTER_DAYS = 30
MAX_RECURRING_PATTERNS = 15


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


def calibrate_recurring_patterns(
    config: ConfigModel,
    *,
    language: str,
    calibration: PatternCalibrationRequestModel,
    now: datetime | None = None,
) -> RecurringPatternsModel:
    patterns = load_recurring_patterns(config, language)
    updated = apply_pattern_calibration(patterns, calibration=calibration, now=now)
    return save_recurring_patterns(config, updated)


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


def cleanup_recurring_patterns_if_due(
    config: ConfigModel,
    *,
    language: str,
    completed_analysis_count: int,
    now: datetime | None = None,
) -> RecurringPatternsModel:
    patterns = load_recurring_patterns(config, language)
    updated = cleanup_recurring_patterns(
        patterns,
        completed_analysis_count=completed_analysis_count,
        now=now,
    )
    if updated == patterns:
        return patterns
    return save_recurring_patterns(config, updated)


def cleanup_recurring_patterns(
    patterns: RecurringPatternsModel,
    *,
    completed_analysis_count: int,
    now: datetime | None = None,
) -> RecurringPatternsModel:
    _validate_language(patterns.language)
    if completed_analysis_count <= 0 or completed_analysis_count % PATTERN_CLEANUP_INTERVAL != 0:
        capped = _cap_pattern_entries([entry.model_dump(mode="json") for entry in patterns.patterns])
        if len(capped) == len(patterns.patterns):
            return patterns
        return RecurringPatternsModel(
            language=patterns.language,
            updated_at=(now or datetime.now().astimezone()).isoformat(timespec="seconds"),
            patterns=capped,
        )

    reference = now or datetime.now().astimezone()
    reference_date = reference.date()
    cleaned: list[dict[str, object]] = []

    for pattern in patterns.patterns:
        entry = pattern.model_dump(mode="json")
        days_since_seen = (reference_date - date.fromisoformat(pattern.last_seen)).days
        count = int(entry["count"])

        if days_since_seen >= PATTERN_DECAY_AFTER_DAYS:
            count = max(1, count - 1)

        entry["count"] = count
        cleaned.append(entry)

    return RecurringPatternsModel(
        language=patterns.language,
        updated_at=reference.isoformat(timespec="seconds"),
        patterns=_cap_pattern_entries(cleaned),
    )


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
                "confirmed": False,
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
        patterns=_cap_pattern_entries(entries),
    )


def apply_pattern_calibration(
    patterns: RecurringPatternsModel,
    *,
    calibration: PatternCalibrationRequestModel | dict[str, object],
    now: datetime | None = None,
) -> RecurringPatternsModel:
    _validate_language(patterns.language)
    calibration = PatternCalibrationRequestModel.model_validate(calibration)
    source_name = " ".join(calibration.pattern_name.split())
    if not source_name:
        raise ValueError("Pattern name is required.")

    entries = [entry.model_dump(mode="json") for entry in patterns.patterns]
    source_index = _find_pattern_index(entries, source_name)
    if source_index is None:
        raise ValueError("Pattern not found.")

    updated_at = (now or datetime.now().astimezone()).isoformat(timespec="seconds")
    action = calibration.action

    if action == "confirm":
        entries[source_index]["confirmed"] = True
    elif action == "dismiss":
        entries.pop(source_index)
    elif action in {"rename", "merge"}:
        target_name = " ".join(calibration.target_name.split())
        target_description = " ".join(calibration.target_description.split())
        if not target_name:
            raise ValueError("Target name is required.")

        source_entry = entries[source_index]
        target_index = _find_pattern_index(entries, target_name)

        if action == "rename" and (target_index is None or target_index == source_index):
            source_entry["name"] = target_name
            if target_description:
                source_entry["description"] = target_description
            source_entry["confirmed"] = True
        else:
            if target_index is None:
                entries.append(
                    {
                        "name": target_name,
                        "description": target_description or source_entry["description"] or target_name,
                        "count": 0,
                        "first_seen": source_entry["first_seen"],
                        "last_seen": source_entry["last_seen"],
                        "recent_sessions": [],
                        "confirmed": True,
                    }
                )
                target_index = len(entries) - 1

            if target_index == source_index:
                entries[source_index]["name"] = target_name
                if target_description:
                    entries[source_index]["description"] = target_description
                entries[source_index]["confirmed"] = True
            else:
                merged = _merge_pattern_entries(entries[target_index], source_entry)
                merged["name"] = target_name
                if target_description:
                    merged["description"] = target_description
                merged["confirmed"] = True
                entries[target_index] = merged
                entries.pop(source_index)
    else:
        raise ValueError("Unsupported calibration action.")

    return RecurringPatternsModel(
        language=patterns.language,
        updated_at=updated_at,
        patterns=_cap_pattern_entries(entries),
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


def _find_pattern_index(entries: list[dict[str, object]], name: str) -> int | None:
    normalized_name = name.casefold()
    for index, entry in enumerate(entries):
        if str(entry["name"]).casefold() == normalized_name:
            return index
    return None


def _merge_pattern_entries(target: dict[str, object], source: dict[str, object]) -> dict[str, object]:
    recent_sessions = list(
        dict.fromkeys([*list(target["recent_sessions"]), *list(source["recent_sessions"])])
    )
    return {
        "name": target["name"],
        "description": target["description"] or source["description"],
        "count": int(target["count"]) + int(source["count"]),
        "first_seen": min(str(target["first_seen"]), str(source["first_seen"])),
        "last_seen": max(str(target["last_seen"]), str(source["last_seen"])),
        "recent_sessions": recent_sessions[-8:],
        "confirmed": bool(target.get("confirmed")) or bool(source.get("confirmed")),
    }


def _cap_pattern_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    if len(entries) <= MAX_RECURRING_PATTERNS:
        return entries

    return sorted(
        entries,
        key=lambda entry: (
            -int(entry["count"]),
            -date.fromisoformat(str(entry["last_seen"])).toordinal(),
            str(entry["name"]).casefold(),
        ),
    )[:MAX_RECURRING_PATTERNS]
