from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.services.sse import ServerSentEvent


def test_get_events_streams_sse_events(config, monkeypatch):
    class FakeBroadcaster:
        async def subscribe(self):
            yield ServerSentEvent(event="index.changed", data={"reason": "test"})

    monkeypatch.setattr(main_module, "sse_broadcaster", FakeBroadcaster())
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/api/events")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text == 'event: index.changed\ndata: {"reason": "test"}\n\n'
