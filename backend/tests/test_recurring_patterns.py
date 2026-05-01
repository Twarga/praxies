from __future__ import annotations

from datetime import datetime

import pytest

from app.models import RecurringPatternsModel
from app.services.json_io import read_json_file
from app.services.recurring_patterns import (
    get_patterns_file_path,
    load_recurring_patterns,
    merge_recurring_pattern_hits,
    merge_recurring_patterns,
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


def test_merge_recurring_patterns_creates_new_hits(config):
    updated = merge_recurring_pattern_hits(
        config,
        language="en",
        session_id="2026-05-01_en_take",
        hits=["Weak close", "  weak close  ", "", "no concrete example"],
        now=datetime.fromisoformat("2026-05-01T12:00:00+00:00"),
    )

    assert [pattern.name for pattern in updated.patterns] == ["Weak close", "no concrete example"]
    assert updated.patterns[0].count == 1
    assert updated.patterns[0].first_seen == "2026-05-01"
    assert updated.patterns[0].last_seen == "2026-05-01"
    assert updated.patterns[0].recent_sessions == ["2026-05-01_en_take"]


def test_merge_recurring_patterns_matches_names_case_insensitively(config):
    existing = RecurringPatternsModel(
        language="en",
        updated_at="2026-04-30T12:00:00+00:00",
        patterns=[
            {
                "name": "Weak Close",
                "description": "Ends without a decisive final sentence.",
                "count": 2,
                "first_seen": "2026-04-25",
                "last_seen": "2026-04-30",
                "recent_sessions": ["2026-04-25_en_take", "2026-04-30_en_take"],
            }
        ],
    )

    updated = merge_recurring_patterns(
        existing,
        session_id="2026-05-01_en_take",
        hits=["weak close"],
        now=datetime.fromisoformat("2026-05-01T12:00:00+00:00"),
    )

    assert len(updated.patterns) == 1
    assert updated.patterns[0].name == "Weak Close"
    assert updated.patterns[0].description == "Ends without a decisive final sentence."
    assert updated.patterns[0].count == 3
    assert updated.patterns[0].first_seen == "2026-04-25"
    assert updated.patterns[0].last_seen == "2026-05-01"
    assert updated.patterns[0].recent_sessions == [
        "2026-04-25_en_take",
        "2026-04-30_en_take",
        "2026-05-01_en_take",
    ]


def test_merge_recurring_patterns_is_idempotent_for_same_session(config):
    merge_recurring_pattern_hits(
        config,
        language="fr",
        session_id="2026-05-01_fr_take",
        hits=["weak close"],
        now=datetime.fromisoformat("2026-05-01T12:00:00+00:00"),
    )
    updated = merge_recurring_pattern_hits(
        config,
        language="fr",
        session_id="2026-05-01_fr_take",
        hits=["Weak Close"],
        now=datetime.fromisoformat("2026-05-01T12:00:00+00:00"),
    )

    assert len(updated.patterns) == 1
    assert updated.patterns[0].count == 1
    assert updated.patterns[0].recent_sessions == ["2026-05-01_fr_take"]
