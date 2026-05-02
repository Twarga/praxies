from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.services.index import get_index_file_path
from app.services.sessions import create_session


class FakeBroadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, object]]] = []

    async def publish(self, event: str, data: dict[str, object] | None = None) -> None:
        self.events.append((event, data or {}))


@pytest.mark.asyncio
async def test_emit_session_status_also_emits_ready_event(config, monkeypatch):
    broadcaster = FakeBroadcaster()
    monkeypatch.setattr(main_module, "sse_broadcaster", broadcaster)
    meta = create_session(config, language="en", title="ready").model_copy(
        update={"status": "ready", "duration_seconds": 180}
    )

    await main_module.emit_session_status(meta)

    assert broadcaster.events == [
        (
            "session.status",
            {
                "session_id": meta.id,
                "status": "ready",
                "save_mode": "full",
                "error": None,
            },
        ),
        (
            "session.ready",
            {
                "session_id": meta.id,
                "status": "ready",
                "save_mode": "full",
                "error": None,
            },
        ),
    ]


@pytest.mark.asyncio
async def test_rebuild_index_and_emit_publishes_index_changed(config, monkeypatch):
    broadcaster = FakeBroadcaster()
    monkeypatch.setattr(main_module, "sse_broadcaster", broadcaster)

    await main_module.rebuild_index_and_emit(config, "test.reason")

    assert get_index_file_path(config).exists()
    assert broadcaster.events == [("index.changed", {"reason": "test.reason"})]


def test_patch_config_emits_config_changed(config, monkeypatch):
    broadcaster = FakeBroadcaster()
    monkeypatch.setattr(main_module, "sse_broadcaster", broadcaster)
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    monkeypatch.setattr(main_module, "update_config", lambda _payload: config)

    with TestClient(main_module.app) as client:
        response = client.patch("/api/config", json={"theme": "bronze-dark"})

    assert response.status_code == 200
    assert broadcaster.events == [("config.changed", {})]
