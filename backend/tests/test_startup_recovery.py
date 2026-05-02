from __future__ import annotations

import shutil
from io import BytesIO

import pytest
from starlette.datastructures import UploadFile

import app.main as main_module
from app.services.index import load_or_rebuild_index
from app.services.sessions import create_session, load_session_meta, store_session_chunk

from .test_session_lifecycle import _generate_webm_chunk


@pytest.mark.asyncio
async def test_startup_recovery_marks_stuck_recording_failed(config, monkeypatch):
    meta = create_session(config, language="en", title="stuck recording")
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    await main_module._recover_stuck_sessions()

    recovered = load_session_meta(config, meta.id)
    index = load_or_rebuild_index(config)
    indexed = next(session for session in index.sessions if session.id == meta.id)

    assert recovered.status == "failed"
    assert recovered.error == "interrupted before finalize"
    assert recovered.processing.progress_label == "Startup recovery failed"
    assert recovered.processing.progress_percent == 100
    assert recovered.processing.terminal_lines[-1].level == "error"
    assert "No uploaded chunks found" in recovered.processing.terminal_lines[-1].message
    assert indexed.status == "failed"


@pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe required for startup recovery video assembly test",
)
@pytest.mark.asyncio
async def test_startup_recovery_recovers_playable_recording_for_review(config, tmp_path, monkeypatch):
    meta = create_session(config, language="en", title="recoverable recording")
    video_bytes = _generate_webm_chunk(tmp_path / "recoverable.webm", duration_seconds=2)
    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(video_bytes))
    await store_session_chunk(config, meta.id, 0, upload)
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    await main_module._recover_stuck_sessions()

    recovered = load_session_meta(config, meta.id)
    index = load_or_rebuild_index(config)
    indexed = next(session for session in index.sessions if session.id == meta.id)

    assert recovered.status == "video_only"
    assert recovered.save_mode == "video_only"
    assert recovered.error is None
    assert recovered.duration_seconds > 0
    assert recovered.file_size_bytes > 0
    assert recovered.processing.progress_label == "Recovered for review"
    assert recovered.processing.progress_percent == 100
    assert recovered.processing.terminal_lines[-1].level == "warning"
    assert indexed.status == "video_only"


@pytest.mark.asyncio
async def test_startup_recovery_marks_corrupt_unfinished_recording_failed(config, monkeypatch):
    meta = create_session(config, language="en", title="corrupt recording")
    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(b"not a playable webm"))
    await store_session_chunk(config, meta.id, 0, upload)
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    await main_module._recover_stuck_sessions()

    recovered = load_session_meta(config, meta.id)
    index = load_or_rebuild_index(config)
    indexed = next(session for session in index.sessions if session.id == meta.id)

    assert recovered.status == "failed"
    assert recovered.error == "corrupt unfinished recording"
    assert recovered.processing.progress_label == "Startup recovery failed"
    assert recovered.processing.progress_percent == 100
    assert recovered.processing.terminal_lines[-1].level == "error"
    assert "Startup recovery failed:" in recovered.processing.terminal_lines[-1].message
    assert indexed.status == "failed"
