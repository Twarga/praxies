from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable


QueueWorker = Callable[[str], Awaitable[None]]


async def _noop_worker(session_id: str) -> None:
    return None


class SessionProcessingQueue:
    def __init__(self, worker: QueueWorker | None = None) -> None:
        self._worker = worker or _noop_worker
        self._queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._queued_ids: set[str] = set()
        self._active_session_id: str | None = None
        self._runner_task: asyncio.Task[None] | None = None

    @property
    def active_session_id(self) -> str | None:
        return self._active_session_id

    def is_running(self) -> bool:
        return self._runner_task is not None and not self._runner_task.done()

    async def start(self) -> None:
        if self.is_running():
            return

        self._runner_task = asyncio.create_task(self._run(), name="session-processing-queue")

    async def stop(self) -> None:
        if not self.is_running():
            self._runner_task = None
            return

        await self._queue.put(None)
        assert self._runner_task is not None
        await self._runner_task
        self._runner_task = None
        self._active_session_id = None
        self._queued_ids.clear()

    async def enqueue(self, session_id: str) -> bool:
        if session_id == self._active_session_id or session_id in self._queued_ids:
            return False

        self._queued_ids.add(session_id)
        await self._queue.put(session_id)
        return True

    async def wait_until_idle(self) -> None:
        await self._queue.join()

    async def _run(self) -> None:
        while True:
            session_id = await self._queue.get()
            if session_id is None:
                self._queue.task_done()
                break

            self._queued_ids.discard(session_id)
            self._active_session_id = session_id
            try:
                await self._worker(session_id)
            finally:
                self._active_session_id = None
                self._queue.task_done()
