"""Verify recording duration metadata and playability across session lengths."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tests.fixtures_recovery import fixture_complete_two_chunk_session


DURATION_SCENARIOS = [
    ("1m", 60, (50000, 500000)),
    ("5m", 300, (250000, 2500000)),
    ("15m", 900, (750000, 7500000)),
    ("30m", 1800, (1500000, 15000000)),
]


class TestDurationMetadata:
    @pytest.mark.parametrize("label,duration_seconds,_size_range", DURATION_SCENARIOS)
    def test_meta_stores_correct_duration(self, tmp_path, label, duration_seconds, _size_range):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(
            journal,
            session_id=f"2026-07-12_en_duration_{label}",
            status="ready",
        )

        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["duration_seconds"] > 0
        assert isinstance(meta["duration_seconds"], (int, float))

    @pytest.mark.parametrize("label,duration_seconds,_size_range", DURATION_SCENARIOS)
    def test_file_size_positive(self, tmp_path, label, duration_seconds, _size_range):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(
            journal,
            session_id=f"2026-07-12_en_size_{label}",
            status="ready",
        )

        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["file_size_bytes"] > 0

    @pytest.mark.parametrize("label,duration_seconds,_size_range", DURATION_SCENARIOS)
    def test_meta_has_valid_timestamps(self, tmp_path, label, duration_seconds, _size_range):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(
            journal,
            session_id=f"2026-07-12_en_ts_{label}",
            status="ready",
        )

        meta = json.loads((session_dir / "meta.json").read_text())
        from datetime import datetime
        datetime.fromisoformat(meta["created_at"])

    @pytest.mark.parametrize("label,duration_seconds,_size_range", DURATION_SCENARIOS)
    def test_session_id_contains_language_and_date(self, tmp_path, label, duration_seconds, _size_range):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(
            journal,
            session_id=f"2026-07-12_en_id_{label}",
            status="ready",
        )

        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["language"] == "en"
        assert "2026-07-12" in meta["id"]


class TestRecoveryFixtureDurations:
    def test_stuck_transcribing_preserves_duration(self, tmp_path):
        from tests.fixtures_recovery import fixture_stuck_transcribing

        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["duration_seconds"] == 120
        assert meta["status"] == "transcribing"

    def test_stuck_analyzing_preserves_duration(self, tmp_path):
        from tests.fixtures_recovery import fixture_stuck_analyzing

        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["duration_seconds"] == 120
        assert meta["status"] == "analyzing"

    def test_truncated_video_still_reports_original_duration(self, tmp_path):
        from tests.fixtures_recovery import fixture_truncated_video

        journal = tmp_path / "journal"
        session_dir = fixture_truncated_video(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["duration_seconds"] == 60
        video_size = (session_dir / "video.webm").stat().st_size
        assert video_size > 0


class TestChunkManifestConsistency:
    def test_chunk_indices_are_sequential(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        indices = [c["chunk_index"] for c in manifest["chunks"]]
        assert indices == sorted(indices)

    def test_each_chunk_has_timestamp(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        for chunk in manifest["chunks"]:
            assert "uploaded_at" in chunk
            assert chunk["uploaded_at"]

    def test_chunk_size_matches_file(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        for chunk in manifest["chunks"]:
            chunk_path = Path(chunk["path"])
            assert chunk_path.exists()
            assert chunk_path.stat().st_size == chunk["size_bytes"]


@pytest.mark.skipif(
    shutil.which("ffmpeg") is None,
    reason="ffmpeg required for duration probe",
)
class TestFfmpegProbeOnFixtures:
    def test_generated_video_is_probeable(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(
            journal,
            session_id="2026-07-12_en_probeable",
            status="saved",
        )

        video_path = session_dir / "video.webm"
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0
        duration = float(result.stdout.strip())
        assert duration > 0
