from __future__ import annotations

import shutil
import subprocess
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import pytest
from starlette.datastructures import UploadFile

import app.main as main_module
from app.models import ConfigModel
from app.services.retention import (
    get_retained_audio_path,
    get_retention_deadline,
    is_retention_due,
    run_retention_pass,
    scan_retention_due_sessions,
)
from app.services.sessions import (
    create_session,
    finalize_session,
    get_session_chunks_dir,
    get_session_video_path,
    load_session_meta,
    store_session_chunk,
    update_session_meta,
)


def _generate_webm_chunk(output_path: Path, duration_seconds: int) -> bytes:
    command = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        f"testsrc=duration={duration_seconds}:size=160x120:rate=10",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=440:duration={duration_seconds}",
        "-c:v",
        "libvpx",
        "-c:a",
        "libvorbis",
        "-b:v",
        "100k",
        "-b:a",
        "32k",
        "-y",
        str(output_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return output_path.read_bytes()


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


@pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe required for retention compression test",
)
@pytest.mark.asyncio
async def test_retention_pass_compresses_expired_video_to_audio_only(config: ConfigModel, tmp_path):
    session = create_session(
        config,
        language="en",
        title="expired video",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    video_bytes = _generate_webm_chunk(tmp_path / "expired.webm", duration_seconds=2)
    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(video_bytes))
    await store_session_chunk(config, session.id, 0, upload)
    finalized = await finalize_session(
        config,
        session.id,
        save_mode="video_only",
        duration_seconds_hint=2,
    )

    chunks_dir = get_session_chunks_dir(config, session.id)
    assert finalized.status == "video_only"
    assert chunks_dir.exists()
    assert get_session_video_path(config, session.id) is not None

    summary = run_retention_pass(
        config,
        now=datetime(2026, 5, 2, 12, 0, tzinfo=timezone.utc),
    )
    updated = load_session_meta(config, session.id)
    retained_audio_path = get_retained_audio_path(config, session.id)

    assert summary["checked"] == 1
    assert summary["due"] == 1
    assert summary["compressed"] == 1
    assert summary["compressed_session_ids"] == [session.id]
    assert summary["errors"] == []
    assert updated.retention.compressed is True
    assert updated.retention.video_kept_until == "2026-05-01T09:00:00+00:00"
    assert updated.video_filename is None
    assert updated.file_size_bytes == retained_audio_path.stat().st_size
    assert retained_audio_path.exists()
    assert retained_audio_path.stat().st_size > 0
    assert get_session_video_path(config, session.id) is None
    assert not chunks_dir.exists()
    assert updated.processing.progress_label == "Retention compressed"
    assert any("audio-only archive" in line.message for line in updated.processing.terminal_lines)
