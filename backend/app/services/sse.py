from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ServerSentEvent:
    event: str
    data: dict[str, Any]

    def format(self) -> str:
        return f"event: {self.event}\ndata: {json.dumps(self.data, ensure_ascii=False)}\n\n"


class SSEBroadcaster:
    def __init__(self) -> None:
        self._listeners: set[asyncio.Queue[ServerSentEvent]] = set()
        self._lock = asyncio.Lock()

    async def listener_count(self) -> int:
        async with self._lock:
            return len(self._listeners)

    async def publish(self, event: str, data: dict[str, Any] | None = None) -> None:
        payload = ServerSentEvent(event=event, data=data or {})
        async with self._lock:
            listeners = list(self._listeners)

        for queue in listeners:
            queue.put_nowait(payload)

    async def subscribe(self) -> AsyncIterator[ServerSentEvent]:
        queue: asyncio.Queue[ServerSentEvent] = asyncio.Queue()
        async with self._lock:
            self._listeners.add(queue)

        try:
            while True:
                yield await queue.get()
        finally:
            async with self._lock:
                self._listeners.discard(queue)
