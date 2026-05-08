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
    payload = response.json()
    assert payload["session_id"] == meta.id
    assert payload["status"] == "analyzing"
    assert payload["enqueued"] is True
    assert payload["model"] == "OpenRouter / google/gemini-2.5-flash-lite"
    updated = load_session_meta(config, meta.id)
    assert updated.status == "analyzing"
    assert updated.processing.progress_label == "Re-analysis queued"


def test_reanalyze_accepts_llm_override(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    config.llm.provider_api_keys["opencode_go"] = "opencode-test"
    config.llm.provider_models["opencode_go"] = "deepseek-v4-flash"

    scheduled: list[tuple[str, dict[str, str] | None]] = []

    async def fake_reanalyze(session_id: str, llm_override: dict[str, str] | None = None) -> None:
        scheduled.append((session_id, llm_override))

    monkeypatch.setattr(main_module, "reanalyze_session_with_latest_prompt", fake_reanalyze)

    meta = create_session(config, language="en", title="override transcript")
    write_session_transcript_json(
        config,
        meta.id,
        [
            SimpleNamespace(start=0.0, end=2.0, text="Analyze this with a selected provider."),
        ],
    )
    update_session_meta(config, meta.id, updates={"status": "ready", "duration_seconds": 2.0})

    with TestClient(main_module.app) as client:
        response = client.post(
            f"/api/sessions/{meta.id}/reanalyze",
            json={"llm": {"provider": "opencode_go", "model": "deepseek-v4-flash"}},
        )

    assert response.status_code == 200
    assert response.json()["model"] == "OpenCode Go / deepseek-v4-flash"
    assert scheduled == [(meta.id, {"provider": "opencode_go", "model": "deepseek-v4-flash"})]
    updated = load_session_meta(config, meta.id)
    assert updated.processing.model_used == "OpenCode Go / deepseek-v4-flash"
