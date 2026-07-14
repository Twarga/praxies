"""Reusable recording recovery fixtures for M1 tests.

Each fixture factory creates a session-directory tree so recovery tests
can verify exact behaviors without depending on real MediaRecorder output.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def write_meta(
    session_dir: Path,
    *,
    session_id: str,
    status: str = "recording",
    save_mode: str = "full",
    duration_seconds: float = 0,
    file_size_bytes: int = 0,
    language: str = "en",
    error: str | None = None,
) -> dict[str, Any]:
    meta = {
        "id": session_id,
        "created_at": "2026-07-12T10:00:00+00:00",
        "language": language,
        "title": "Test recording",
        "title_source": "default",
        "duration_seconds": duration_seconds,
        "file_size_bytes": file_size_bytes,
        "status": status,
        "save_mode": save_mode,
        "source": "webcam",
        "video_filename": "video.webm",
        "error": error,
        "read": False,
        "processing": {
            "transcribe_started_at": None,
            "transcribe_finished_at": None,
            "analyze_started_at": None,
            "analyze_finished_at": None,
            "model_used": None,
            "progress_label": None,
            "progress_percent": 0,
            "terminal_lines": [],
            "attempts": 0,
        },
        "retention": {
            "video_kept_until": None,
            "compressed": False,
        },
        "practice": {
            "assignment_completed": False,
            "assignment_completed_at": None,
            "previous_goal": "",
            "previous_goal_source_session_id": None,
            "previous_goal_result": "unmarked",
            "previous_goal_note": "",
        },
    }
    session_dir.mkdir(parents=True, exist_ok=True)
    meta_path = session_dir / "meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return meta


def write_chunk_manifest(
    session_dir: Path,
    *,
    session_id: str,
    chunks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    manifest = {
        "session_id": session_id,
        "created_at": "2026-07-12T10:00:00+00:00",
        "updated_at": "2026-07-12T10:02:00+00:00",
        "chunks": chunks or [],
    }
    (session_dir / "chunk_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )
    return manifest


def write_chunk_file(chunks_dir: Path, chunk_index: int, size_bytes: int = 1024) -> Path:
    chunks_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = chunks_dir / f"chunk-{chunk_index:06d}.webm"
    chunk_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * max(0, size_bytes - 4))
    return chunk_path


def write_valid_webm_chunks(chunks_dir: Path) -> list[Path]:
    """Create one valid WebM stream and split it like MediaRecorder timeslices."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return [
            write_chunk_file(chunks_dir, 0, size_bytes=5000),
            write_chunk_file(chunks_dir, 1, size_bytes=4000),
        ]

    chunks_dir.mkdir(parents=True, exist_ok=True)
    source = chunks_dir / "fixture-source.webm"
    result = subprocess.run(
        [
            ffmpeg,
            "-f", "lavfi", "-i", "color=c=black:s=160x120:r=10:d=1",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-shortest", "-c:v", "libvpx", "-c:a", "libvorbis",
            "-y", str(source),
        ],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return [
            write_chunk_file(chunks_dir, 0, size_bytes=5000),
            write_chunk_file(chunks_dir, 1, size_bytes=4000),
        ]

    payload = source.read_bytes()
    source.unlink(missing_ok=True)
    split_at = max(1, len(payload) // 2)
    paths = [chunks_dir / "chunk-000000.webm", chunks_dir / "chunk-000001.webm"]
    paths[0].write_bytes(payload[:split_at])
    paths[1].write_bytes(payload[split_at:])
    return paths


def fixture_complete_two_chunk_session(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_complete",
    status: str = "saved",
    video_filename: str | None = "video.webm",
) -> Path:
    """Two chunks, video assembled, meta.status=saved."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_paths = write_valid_webm_chunks(chunks_dir)
    chunk_sizes = [path.stat().st_size for path in chunk_paths]

    write_chunk_manifest(
        session_dir,
        session_id=session_id,
        chunks=[
            {
                "chunk_index": 0,
                "filename": chunk_paths[0].name,
                "path": str(chunk_paths[0]),
                "size_bytes": chunk_sizes[0],
                "uploaded_at": "2026-07-12T10:00:05+00:00",
            },
            {
                "chunk_index": 1,
                "filename": chunk_paths[1].name,
                "path": str(chunk_paths[1]),
                "size_bytes": chunk_sizes[1],
                "uploaded_at": "2026-07-12T10:01:55+00:00",
            },
        ],
    )

    total_size = sum(chunk_sizes)

    write_meta(
        session_dir,
        session_id=session_id,
        status=status,
        save_mode="full",
        duration_seconds=120,
        file_size_bytes=total_size,
    )

    if video_filename:
        video_path = session_dir / video_filename
        video_path.write_bytes(b"".join(path.read_bytes() for path in chunk_paths))

    return session_dir


def fixture_missing_chunk(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_missing_chunk",
) -> Path:
    """Manifest references a chunk file that does not exist on disk."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_0 = write_chunk_file(chunks_dir, 0, size_bytes=5000)

    write_chunk_manifest(
        session_dir,
        session_id=session_id,
        chunks=[
            {
                "chunk_index": 0,
                "filename": chunk_0.name,
                "path": str(chunk_0),
                "size_bytes": 5000,
                "uploaded_at": "2026-07-12T10:00:05+00:00",
            },
            {
                "chunk_index": 1,
                "filename": "chunk-000001.webm",
                "path": str(chunks_dir / "chunk-000001.webm"),
                "size_bytes": 3000,
                "uploaded_at": "2026-07-12T10:01:00+00:00",
            },
        ],
    )

    write_meta(
        session_dir,
        session_id=session_id,
        status="recording",
        save_mode="full",
        duration_seconds=0,
        file_size_bytes=0,
    )

    video_path = session_dir / "video.webm"
    video_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 3000)

    return session_dir


def fixture_duplicated_chunk_manifest(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_duplicated_chunk",
) -> Path:
    """Manifest lists the same chunk index twice — simulates a buggy upload."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_0_a = write_chunk_file(chunks_dir, 0, size_bytes=5000)
    chunk_0_b = write_chunk_file(chunks_dir, 0, size_bytes=6000)
    chunk_0_b_name = chunk_0_b.name

    chunk_1 = write_chunk_file(chunks_dir, 1, size_bytes=4000)

    write_chunk_manifest(
        session_dir,
        session_id=session_id,
        chunks=[
            {
                "chunk_index": 0,
                "filename": chunk_0_a.name,
                "path": str(chunk_0_a),
                "size_bytes": 5000,
                "uploaded_at": "2026-07-12T10:00:05+00:00",
            },
            {
                "chunk_index": 0,
                "filename": chunk_0_b_name,
                "path": str(chunk_0_b),
                "size_bytes": 6000,
                "uploaded_at": "2026-07-12T10:00:10+00:00",
            },
        ],
    )

    write_meta(
        session_dir,
        session_id=session_id,
        status="recording",
        save_mode="full",
        duration_seconds=60,
        file_size_bytes=5000,
    )

    video_path = session_dir / "video.webm"
    video_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 4000)

    return session_dir


def fixture_truncated_video(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_truncated",
) -> Path:
    """Video.webm exists but is much smaller than the sum of chunk sizes."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_0 = write_chunk_file(chunks_dir, 0, size_bytes=5000)
    chunk_1 = write_chunk_file(chunks_dir, 1, size_bytes=4000)

    write_chunk_manifest(
        session_dir,
        session_id=session_id,
        chunks=[
            {
                "chunk_index": 0,
                "filename": chunk_0.name,
                "path": str(chunk_0),
                "size_bytes": 5000,
                "uploaded_at": "2026-07-12T10:00:05+00:00",
            },
            {
                "chunk_index": 1,
                "filename": chunk_1.name,
                "path": str(chunk_1),
                "size_bytes": 4000,
                "uploaded_at": "2026-07-12T10:01:55+00:00",
            },
        ],
    )

    total_chunk_size = 5000 + 4000

    write_meta(
        session_dir,
        session_id=session_id,
        status="saved",
        save_mode="full",
        duration_seconds=60,
        file_size_bytes=total_chunk_size,
    )

    video_path = session_dir / "video.webm"
    video_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 3000)

    return session_dir


def fixture_incomplete_manifest(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_incomplete_manifest",
) -> Path:
    """chunk_manifest.json exists but has an incomplete shape (missing chunks key)."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_0 = write_chunk_file(chunks_dir, 0, size_bytes=5000)

    manifest = {
        "session_id": session_id,
        "created_at": "2026-07-12T10:00:00+00:00",
    }

    (session_dir / "chunk_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )

    write_meta(
        session_dir,
        session_id=session_id,
        status="recording",
        save_mode="full",
        duration_seconds=0,
        file_size_bytes=0,
    )

    return session_dir


def fixture_corrupt_manifest_json(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_corrupt_manifest",
) -> Path:
    """chunk_manifest.json is not valid JSON."""
    session_dir = journal_dir / session_id
    chunks_dir = session_dir / "_chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    write_chunk_file(chunks_dir, 0, size_bytes=5000)

    (session_dir / "chunk_manifest.json").write_text("not valid json {{{", encoding="utf-8")

    write_meta(
        session_dir,
        session_id=session_id,
        status="recording",
        save_mode="full",
        duration_seconds=0,
        file_size_bytes=0,
    )

    return session_dir


def fixture_no_chunks_recording(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_no_chunks",
) -> Path:
    """Session started but no chunks were ever uploaded."""
    session_dir = journal_dir / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    write_meta(
        session_dir,
        session_id=session_id,
        status="recording",
        save_mode="full",
        duration_seconds=0,
        file_size_bytes=0,
    )

    return session_dir


def fixture_stuck_transcribing(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_stuck_transcribing",
) -> Path:
    """Session interrupted during transcription — status is transcribing, no transcript files."""
    session_dir = journal_dir / session_id
    _dir = session_dir
    _dir.mkdir(parents=True, exist_ok=True)

    write_meta(
        session_dir,
        session_id=session_id,
        status="transcribing",
        save_mode="full",
        duration_seconds=120,
        file_size_bytes=9000,
    )

    video_path = session_dir / "video.webm"
    video_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 8000)

    return session_dir


def fixture_stuck_analyzing(
    journal_dir: Path,
    *,
    session_id: str = "2026-07-12_en_stuck_analyzing",
) -> Path:
    """Session interrupted during analysis — transcript exists, status is analyzing."""
    session_dir = journal_dir / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    write_meta(
        session_dir,
        session_id=session_id,
        status="analyzing",
        save_mode="full",
        duration_seconds=120,
        file_size_bytes=9000,
    )

    video_path = session_dir / "video.webm"
    video_path.write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 8000)

    transcript = [
        {"start_seconds": 0.0, "end_seconds": 5.0, "text": "Hello, this is a test."},
        {"start_seconds": 5.0, "end_seconds": 10.0, "text": "I am practicing my speaking."},
    ]
    (session_dir / "transcript.json").write_text(
        json.dumps(transcript, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )

    return session_dir
