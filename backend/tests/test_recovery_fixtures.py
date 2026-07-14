"""Verify recording recovery fixture shapes and contents."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.fixtures_recovery import (
    fixture_complete_two_chunk_session,
    fixture_corrupt_manifest_json,
    fixture_duplicated_chunk_manifest,
    fixture_incomplete_manifest,
    fixture_missing_chunk,
    fixture_no_chunks_recording,
    fixture_stuck_analyzing,
    fixture_stuck_transcribing,
    fixture_truncated_video,
)


class TestCompleteTwoChunkSession:
    def test_creates_session_dir(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        assert session_dir.exists()
        assert (session_dir / "meta.json").exists()
        assert (session_dir / "chunk_manifest.json").exists()
        assert (session_dir / "video.webm").exists()

    def test_manifest_has_two_chunks(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        assert len(manifest["chunks"]) == 2
        assert manifest["chunks"][0]["chunk_index"] == 0
        assert manifest["chunks"][1]["chunk_index"] == 1

    def test_chunk_files_exist(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        chunks_dir = session_dir / "_chunks"
        assert (chunks_dir / "chunk-000000.webm").exists()
        assert (chunks_dir / "chunk-000001.webm").exists()

    def test_meta_has_correct_status(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal, status="queued")
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "queued"

    def test_video_file_larger_than_single_chunk(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_complete_two_chunk_session(journal)
        video_size = (session_dir / "video.webm").stat().st_size
        chunk_sizes = [5000, 4000]
        assert video_size > min(chunk_sizes)


class TestMissingChunk:
    def test_manifest_references_nonexistent_file(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_missing_chunk(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        chunk_1_path = manifest["chunks"][1]["path"]
        assert not Path(chunk_1_path).exists()
        assert manifest["chunks"][0]["chunk_index"] == 0


class TestDuplicatedChunkManifest:
    def test_two_entries_for_same_index(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_duplicated_chunk_manifest(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        indices = [c["chunk_index"] for c in manifest["chunks"]]
        assert indices.count(0) == 2

    def test_both_files_exist(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_duplicated_chunk_manifest(journal)
        chunks_dir = session_dir / "_chunks"
        chunk_files = list(chunks_dir.glob("chunk-000000*.webm"))
        assert len(chunk_files) >= 1


class TestTruncatedVideo:
    def test_video_smaller_than_chunk_sum(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_truncated_video(journal)
        video_size = (session_dir / "video.webm").stat().st_size
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        total_chunk_size = sum(c["size_bytes"] for c in manifest["chunks"])
        assert video_size < total_chunk_size
        assert video_size > 0
        assert total_chunk_size > 8000

    def test_meta_file_size_matches_chunk_sum(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_truncated_video(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        total_chunk = sum(c["size_bytes"] for c in manifest["chunks"])
        assert meta["file_size_bytes"] == total_chunk


class TestIncompleteManifest:
    def test_missing_chunks_key(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_incomplete_manifest(journal)
        manifest = json.loads((session_dir / "chunk_manifest.json").read_text())
        assert "chunks" not in manifest
        assert manifest["session_id"]


class TestCorruptManifestJson:
    def test_not_valid_json(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_corrupt_manifest_json(journal)
        raw = (session_dir / "chunk_manifest.json").read_text()
        with pytest.raises(json.JSONDecodeError):
            json.loads(raw)


class TestNoChunksRecording:
    def test_no_chunks_dir(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_no_chunks_recording(journal)
        assert not (session_dir / "_chunks").exists()
        assert not (session_dir / "chunk_manifest.json").exists()

    def test_meta_status_recording(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_no_chunks_recording(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "recording"
        assert meta["duration_seconds"] == 0


class TestStuckTranscribing:
    def test_status_is_transcribing(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "transcribing"

    def test_video_exists(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        assert (session_dir / "video.webm").exists()
        assert (session_dir / "video.webm").stat().st_size > 0

    def test_no_transcript_yet(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        assert not (session_dir / "transcript.json").exists()


class TestStuckAnalyzing:
    def test_status_is_analyzing(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "analyzing"

    def test_transcript_exists(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        transcript = json.loads((session_dir / "transcript.json").read_text())
        assert len(transcript) == 2
        assert transcript[0]["text"]

    def test_no_analysis_yet(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        assert not (session_dir / "analysis.json").exists()
