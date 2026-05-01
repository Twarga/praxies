from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.sessions import create_session

from .test_digest import _write_ready_analysis


def test_get_trends_returns_range_payload(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    session = create_session(
        config,
        language="en",
        title="trend session",
        created_at=datetime.now(timezone.utc),
    )
    _write_ready_analysis(config, session.id)

    with TestClient(main_module.app) as client:
        response = client.get("/api/trends?range=30d")

    assert response.status_code == 200
    payload = response.json()
    assert payload["range"] == "30d"
    assert payload["sessions"][0]["id"] == session.id


def test_get_trends_rejects_unsupported_range(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/trends?range=365d")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported trends range."
