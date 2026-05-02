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
    get_session_analysis_path,
    get_session_chunks_dir,
    get_session_dir,
    get_session_thumbnail_path,
    get_session_transcript_json_path,
    get_session_transcript_text_path,
    get_session_video_path,
    load_session_meta,
    store_session_chunk,
    update_session_meta,
    write_session_analysis,
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


def _analysis_payload(language: str = "en") -> dict[str, object]:
    return {
        "schema_version": 1,
        "language": language,
        "prose_verdict": "Useful practice session.",
        "session_summary": "The speaker practiced one clear idea.",
        "main_topics": ["practice"],
        "grammar_and_language": {
            "errors": [],
            "fluency_score": 7,
            "vocabulary_level": "B2",
            "filler_words": {"um": 1},
        },
        "speaking_quality": {
            "clarity": 7,
            "pace": "steady",
            "structure": "clear",
            "executive_presence_notes": "direct",
        },
        "ideas_and_reasoning": {
            "strong_points": ["Clear point."],
            "weak_points": [],
            "logical_flaws": [],
            "factual_errors": [],
            "philosophical_pushback": "",
        },
        "recurring_patterns_hit": ["soft ending"],
        "actionable_improvements": ["Land the final sentence."],
    }


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


@pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe required for retention preservation test",
)
@pytest.mark.asyncio
async def test_retention_compression_keeps_session_artifacts(config: ConfigModel, tmp_path):
    session = create_session(
        config,
        language="en",
        title="artifact retention",
        created_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
    )
    video_bytes = _generate_webm_chunk(tmp_path / "artifact.webm", duration_seconds=2)
    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(video_bytes))
    await store_session_chunk(config, session.id, 0, upload)
    await finalize_session(
        config,
        session.id,
        save_mode="full",
        duration_seconds_hint=2,
    )
    update_session_meta(config, session.id, updates={"status": "ready"})

    transcript_text_path = get_session_transcript_text_path(config, session.id)
    transcript_json_path = get_session_transcript_json_path(config, session.id)
    analysis_path = get_session_analysis_path(config, session.id)
    thumbnail_path = get_session_thumbnail_path(config, session.id)
    meta_path = get_session_dir(config, session.id) / "meta.json"

    transcript_text_path.write_text("Hello retained transcript.\n", encoding="utf-8")
    transcript_json_path.write_text(
        '[{"start_seconds":0.0,"end_seconds":1.5,"text":"Hello retained transcript."}]\n',
        encoding="utf-8",
    )
    write_session_analysis(config, session.id, _analysis_payload("en"))
    before_meta = load_session_meta(config, session.id)

    assert thumbnail_path is not None
    assert meta_path.exists()
    assert transcript_text_path.exists()
    assert transcript_json_path.exists()
    assert analysis_path.exists()

    summary = run_retention_pass(
        config,
        now=datetime(2026, 5, 2, 12, 0, tzinfo=timezone.utc),
    )
    after_meta = load_session_meta(config, session.id)

    assert summary["compressed"] == 1
    assert meta_path.exists()
    assert transcript_text_path.read_text(encoding="utf-8") == "Hello retained transcript.\n"
    assert "Hello retained transcript" in transcript_json_path.read_text(encoding="utf-8")
    assert analysis_path.exists()
    assert '"prose_verdict": "Useful practice session."' in analysis_path.read_text(encoding="utf-8")
    assert thumbnail_path.exists()
    assert after_meta.id == before_meta.id
    assert after_meta.created_at == before_meta.created_at
    assert after_meta.title == before_meta.title
    assert after_meta.retention.compressed is True
