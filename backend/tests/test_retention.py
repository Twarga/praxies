from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

import app.main as main_module
from app.models import ConfigModel
from app.services.retention import get_retention_deadline, is_retention_due, scan_retention_due_sessions
from app.services.sessions import create_session, update_session_meta


def test_retention_scan_finds_expired_video_sessions(config: ConfigModel):
    expired = create_session(
        config,
        language="en",
        title="expired",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    active = create_session(
        config,
        language="en",
        title="active",
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
    )
    recording = create_session(
        config,
        language="en",
        title="recording",
        created_at=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
    )

    update_session_meta(config, expired.id, updates={"status": "ready", "duration_seconds": 180})
    update_session_meta(config, active.id, updates={"status": "ready", "duration_seconds": 180})
    for session_id in (expired.id, active.id, recording.id):
        (Path(config.journal_folder) / session_id / "video.webm").write_bytes(b"video")

    summary = scan_retention_due_sessions(
        config,
        now=datetime(2026, 5, 2, 12, 0, tzinfo=timezone.utc),
    )

    assert summary["checked"] == 3
    assert summary["due"] == 1
    assert summary["due_session_ids"] == [expired.id]


def test_retention_deadline_and_due_skip_compressed(config: ConfigModel):
    session = create_session(
        config,
        language="en",
        title="compressed",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    meta = update_session_meta(
        config,
        session.id,
        updates={
            "status": "ready",
            "retention": session.retention.model_copy(update={"compressed": True}),
        },
    )

    assert get_retention_deadline(meta, 30).isoformat() == "2026-05-01T09:00:00+00:00"
    assert is_retention_due(config, meta, now=datetime(2026, 5, 2, 12, 0, tzinfo=timezone.utc)) is False


@pytest.mark.asyncio
async def test_run_retention_check_once_uses_current_config(config: ConfigModel, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    summary = await main_module.run_retention_check_once()

    assert summary["checked"] == 0
    assert summary["due"] == 0
