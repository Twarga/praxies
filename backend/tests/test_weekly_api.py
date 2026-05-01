from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.json_io import write_json_file
from app.services.weekly_rollups import get_weekly_rollup_path


def test_get_weekly_rollup_returns_saved_rollup(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    write_json_file(
        get_weekly_rollup_path(config, "2026-W17"),
        {
            "week": "2026-W17",
            "generated_at": "2026-05-03T20:00:00+00:00",
            "session_count": 2,
            "total_seconds": 1200,
            "languages_used": ["en"],
            "summary_prose": "Good week.",
            "improvements": ["Cleaner openings."],
            "still_breaking": ["Soft closes."],
            "focus_for_next_week": "Close directly.",
        },
    )

    with TestClient(main_module.app) as client:
        response = client.get("/api/weekly/2026-W17")

    assert response.status_code == 200
    payload = response.json()
    assert payload["week"] == "2026-W17"
    assert payload["summary_prose"] == "Good week."


def test_get_weekly_rollup_returns_404_when_missing(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/weekly/2026-W17")

    assert response.status_code == 404
    assert response.json()["detail"] == "Weekly rollup not found."


def test_get_weekly_rollup_rejects_invalid_week_key(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/weekly/not-a-week")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid weekly rollup week key."
