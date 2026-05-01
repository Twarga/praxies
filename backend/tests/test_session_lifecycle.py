from __future__ import annotations

import shutil
import subprocess
from io import BytesIO
from pathlib import Path

import pytest
from starlette.datastructures import UploadFile

from app.services.sessions import (
    assemble_session_video,
    create_session,
    delete_session_dir,
    get_session_dir,
    get_session_video_path,
    probe_session_video,
    should_repair_session_video,
    store_session_chunk,
)
from app.services.subtitle_service import export_burned_subtitle_video, write_subtitle_files


pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe required for session lifecycle test",
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


@pytest.mark.asyncio
async def test_session_lifecycle(config, tmp_path):
    meta = create_session(config, language="en", title="lifecycle test")
    assert meta.status == "recording"
    assert get_session_dir(config, meta.id).exists()

    chunk_a_bytes = _generate_webm_chunk(tmp_path / "src_a.webm", duration_seconds=1)
    chunk_b_bytes = _generate_webm_chunk(tmp_path / "src_b.webm", duration_seconds=1)

    upload_a = UploadFile(filename="chunk-0.webm", file=BytesIO(chunk_a_bytes))
    chunk_a_path, manifest_a = await store_session_chunk(config, meta.id, 0, upload_a)
    assert chunk_a_path.exists()
    assert len(manifest_a["chunks"]) == 1

    upload_b = UploadFile(filename="chunk-1.webm", file=BytesIO(chunk_b_bytes))
    chunk_b_path, manifest_b = await store_session_chunk(config, meta.id, 1, upload_b)
    assert chunk_b_path.exists()
    assert len(manifest_b["chunks"]) == 2

    video_path = await assemble_session_video(config, meta.id)
    assert video_path.exists()
    assert video_path.stat().st_size > 0

    duration = await probe_session_video(video_path)
    assert duration > 0

    resolved_video = get_session_video_path(config, meta.id)
    assert resolved_video == video_path

    deleted = delete_session_dir(config, meta.id)
    assert deleted is True
    assert not get_session_dir(config, meta.id).exists()


@pytest.mark.asyncio
async def test_probe_rejects_invalid_video(tmp_path):
    bad_path = tmp_path / "broken.webm"
    bad_path.write_bytes(b"not a real video")

    with pytest.raises(RuntimeError):
        await probe_session_video(bad_path)


def test_delete_returns_false_for_unknown(config):
    assert delete_session_dir(config, "does-not-exist") is False


def test_should_repair_session_video_when_output_only_matches_first_chunk(config, tmp_path):
    meta = create_session(config, language="en", title="repair check").model_copy(
        update={"status": "ready", "file_size_bytes": 100}
    )
    video_path = tmp_path / "video.webm"
    video_path.write_bytes(b"x" * 100)
    manifest = {
        "chunks": [
            {"chunk_index": 0, "size_bytes": 100},
            {"chunk_index": 1, "size_bytes": 240},
        ]
    }

    assert should_repair_session_video(meta, manifest, video_path) is True


def test_should_not_repair_session_video_when_output_is_already_larger(config, tmp_path):
    meta = create_session(config, language="en", title="repair check 2").model_copy(
        update={"status": "ready", "file_size_bytes": 360}
    )
    video_path = tmp_path / "video.webm"
    video_path.write_bytes(b"x" * 360)
    manifest = {
        "chunks": [
            {"chunk_index": 0, "size_bytes": 100},
            {"chunk_index": 1, "size_bytes": 240},
        ]
    }

    assert should_repair_session_video(meta, manifest, video_path) is False


@pytest.mark.asyncio
async def test_export_burned_subtitle_video(config, tmp_path):
    meta = create_session(config, language="en", title="subtitle export")
    video_bytes = _generate_webm_chunk(tmp_path / "subtitle_src.webm", duration_seconds=1)

    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(video_bytes))
    await store_session_chunk(config, meta.id, 0, upload)
    await assemble_session_video(config, meta.id)
    write_subtitle_files(
        config,
        meta.id,
        language="en",
        segments=[
            {
                "start_seconds": 0.0,
                "end_seconds": 0.8,
                "text": "Subtitle export test.",
            }
        ],
    )

    exported_path = await export_burned_subtitle_video(config, meta.id, language="en")

    assert exported_path.name == "video_subtitled_en.mp4"
    assert exported_path.exists()
    assert exported_path.stat().st_size > 0
