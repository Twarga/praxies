from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.sessions import create_session

from .test_digest import _write_ready_analysis


def test_get_today_digest_returns_selected_digest(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    selected = create_session(
        config,
        language="en",
        title="selected digest",
        created_at=datetime(2026, 4, 30, 20, 0, tzinfo=timezone.utc),
    )
    _write_ready_analysis(config, selected.id)

    with TestClient(main_module.app) as client:
        response = client.get("/api/digest/today")

    assert response.status_code == 200
    payload = response.json()
    assert payload["digest"]["session"]["id"] == selected.id
    assert payload["digest"]["analysis"]["prose_verdict"] == "Useful practice session."


def test_get_today_digest_returns_null_when_no_analyzed_session(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/digest/today")

    assert response.status_code == 200
    assert response.json() == {"digest": None}
