from __future__ import annotations

import pytest

from app.models import RecurringPatternsModel
from app.services.json_io import read_json_file
from app.services.recurring_patterns import (
    get_patterns_file_path,
    load_recurring_patterns,
    save_recurring_patterns,
)


def test_load_recurring_patterns_bootstraps_empty_file(config):
    patterns = load_recurring_patterns(config, "en")
    path = get_patterns_file_path(config, "en")

    assert patterns.language == "en"
    assert patterns.patterns == []
    assert path.exists()
    assert read_json_file(path)["language"] == "en"


def test_save_and_load_recurring_patterns(config):
    payload = RecurringPatternsModel(
        language="fr",
        updated_at="2026-05-01T12:00:00+00:00",
        patterns=[
            {
                "name": "weak close",
                "description": "Ends without a decisive final sentence.",
                "count": 2,
                "first_seen": "2026-04-29",
                "last_seen": "2026-05-01",
                "recent_sessions": ["2026-05-01_fr_take"],
            }
        ],
    )

    save_recurring_patterns(config, payload)
    loaded = load_recurring_patterns(config, "fr")

    assert loaded == payload


def test_load_recurring_patterns_rejects_language_mismatch(config):
    path = get_patterns_file_path(config, "es")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        """
{
  "language": "en",
  "updated_at": "2026-05-01T12:00:00+00:00",
  "patterns": []
}
""".strip()
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="language does not match"):
        load_recurring_patterns(config, "es")


def test_recurring_patterns_reject_unsupported_language(config):
    with pytest.raises(ValueError, match="Unsupported"):
        load_recurring_patterns(config, "ar")
