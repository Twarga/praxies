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


def _validate_language(language: str) -> None:
    if language not in SUPPORTED_PATTERN_LANGUAGES:
        raise ValueError("Unsupported recurring pattern language.")
