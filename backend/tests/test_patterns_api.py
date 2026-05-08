from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.models import RecurringPatternsModel
from app.services.recurring_patterns import get_patterns_file_path, save_recurring_patterns


def test_get_patterns_returns_saved_language_patterns(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    save_recurring_patterns(
        config,
        RecurringPatternsModel(
            language="en",
            updated_at="2026-05-01T10:00:00+00:00",
            patterns=[
                {
                    "name": "weak endings",
                    "description": "The session trails off instead of ending cleanly.",
                    "count": 3,
                    "first_seen": "2026-04-20",
                    "last_seen": "2026-04-30",
                    "recent_sessions": ["session-a"],
                }
            ],
        ),
    )

    with TestClient(main_module.app) as client:
        response = client.get("/api/patterns/en")

    assert response.status_code == 200
    payload = response.json()
    assert payload["language"] == "en"
    assert payload["patterns"][0]["name"] == "weak endings"
    assert payload["patterns"][0]["confirmed"] is False


def test_get_patterns_bootstraps_empty_pattern_file(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/patterns/fr")

    assert response.status_code == 200
    assert response.json()["patterns"] == []
    assert get_patterns_file_path(config, "fr").exists()


def test_get_patterns_rejects_unsupported_language(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/patterns/ar")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported recurring pattern language."


def test_post_pattern_calibration_updates_pattern_file(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    save_recurring_patterns(
        config,
        RecurringPatternsModel(
            language="en",
            updated_at="2026-05-01T10:00:00+00:00",
            patterns=[
                {
                    "name": "weak endings",
                    "description": "The session trails off instead of ending cleanly.",
                    "count": 3,
                    "first_seen": "2026-04-20",
                    "last_seen": "2026-04-30",
                    "recent_sessions": ["session-a"],
                }
            ],
        ),
    )

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/patterns/en/calibrate",
            json={
                "action": "rename",
                "pattern_name": "weak endings",
                "target_name": "soft ending",
                "target_description": "The session trails off before the final point lands.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["patterns"][0]["name"] == "soft ending"
    assert payload["patterns"][0]["confirmed"] is True


def test_post_pattern_calibration_rejects_missing_pattern(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/patterns/en/calibrate",
            json={"action": "dismiss", "pattern_name": "missing"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Pattern not found."
