from __future__ import annotations

import asyncio

import pytest

from app.services.sse import SSEBroadcaster, ServerSentEvent


def test_server_sent_event_formats_json_payload():
    event = ServerSentEvent(event="session.status", data={"session_id": "abc", "status": "ready"})

    assert event.format() == 'event: session.status\ndata: {"session_id": "abc", "status": "ready"}\n\n'


@pytest.mark.asyncio
async def test_sse_broadcaster_publishes_to_all_listeners():
    broadcaster = SSEBroadcaster()
    listener_a = broadcaster.subscribe()
    listener_b = broadcaster.subscribe()
    pending_a = asyncio.create_task(listener_a.__anext__())
    pending_b = asyncio.create_task(listener_b.__anext__())
    await asyncio.sleep(0)

    assert await broadcaster.listener_count() == 2

    await broadcaster.publish("index.changed", {"version": 1})

    event_a = await pending_a
    event_b = await pending_b

    assert event_a.event == "index.changed"
    assert event_a.data == {"version": 1}
    assert event_b.event == "index.changed"
    assert event_b.data == {"version": 1}

    await listener_a.aclose()
    await listener_b.aclose()


@pytest.mark.asyncio
async def test_sse_broadcaster_removes_listener_on_close():
    broadcaster = SSEBroadcaster()
    listener = broadcaster.subscribe()
    pending = asyncio.create_task(listener.__anext__())
    await asyncio.sleep(0)

    assert await broadcaster.listener_count() == 1

    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending

    assert await broadcaster.listener_count() == 0
