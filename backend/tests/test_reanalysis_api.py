from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.sessions import create_session, load_session_meta, update_session_meta, write_session_transcript_json


def test_reanalyze_rejects_session_without_transcript(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    meta = create_session(config, language="en", title="no transcript")
    update_session_meta(config, meta.id, updates={"status": "ready"})

    with TestClient(main_module.app) as client:
        response = client.post(f"/api/sessions/{meta.id}/reanalyze")

    assert response.status_code == 400
    assert response.json()["detail"] == "Session has no transcript segments to re-analyze."


def test_reanalyze_queues_existing_transcript(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    scheduled: list[str] = []

    async def fake_reanalyze(session_id: str) -> None:
        scheduled.append(session_id)

    monkeypatch.setattr(main_module, "reanalyze_session_with_latest_prompt", fake_reanalyze)

    meta = create_session(config, language="en", title="existing transcript")
    write_session_transcript_json(
        config,
        meta.id,
        [
            SimpleNamespace(start=0.0, end=2.0, text="This is a useful calibration transcript."),
        ],
    )
    update_session_meta(config, meta.id, updates={"status": "ready", "duration_seconds": 2.0})

    with TestClient(main_module.app) as client:
        response = client.post(f"/api/sessions/{meta.id}/reanalyze")

    assert response.status_code == 200
    assert response.json() == {"session_id": meta.id, "status": "analyzing", "enqueued": True}
    updated = load_session_meta(config, meta.id)
    assert updated.status == "analyzing"
    assert updated.processing.progress_label == "Re-analysis queued"
