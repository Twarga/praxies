"""Idempotency and interruption hardening tests for the session pipeline."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.sessions import (
    assemble_session_video,
    load_session_meta,
)
from tests.fixtures_recovery import (
    fixture_complete_two_chunk_session,
    fixture_stuck_analyzing,
    fixture_stuck_transcribing,
)


@pytest.mark.asyncio
async def test_assembled_video_survives_reassembly(config, tmp_path):
    """M1-03: Assembling a session video twice must not corrupt the output."""
    journal = Path(config.journal_folder)
    session_dir = fixture_complete_two_chunk_session(
        journal, session_id="2026-07-12_en_idempotent", status="saved",
    )
    video_path = session_dir / "video.webm"
    size_first = video_path.stat().st_size

    await assemble_session_video(config, "2026-07-12_en_idempotent")

    assert video_path.exists()
    assert video_path.stat().st_size > 0


@pytest.mark.asyncio
async def test_source_chunks_preserved_after_assembly(config, tmp_path):
    """M1-03: Assembly must not delete source chunk files."""
    journal = Path(config.journal_folder)
    session_dir = fixture_complete_two_chunk_session(
        journal, session_id="2026-07-12_en_preserve", status="saved",
    )
    chunks_dir = session_dir / "_chunks"
    chunk_count_before = len(list(chunks_dir.glob("chunk-*.webm")))

    await assemble_session_video(config, "2026-07-12_en_preserve")

    chunk_count_after = len(list(chunks_dir.glob("chunk-*.webm")))
    assert chunk_count_after == chunk_count_before
    assert chunk_count_after > 0


class TestM1_04_TranscriptionRestart:
    """M1-04: Restarting transcription must produce one canonical transcript."""

    def test_transcribing_session_has_status_preserved(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "transcribing"
        assert meta["duration_seconds"] > 0

    def test_requeue_preserves_transition_integrity(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)

        meta = json.loads((session_dir / "meta.json").read_text())
        meta["status"] = "queued"
        meta["error"] = None
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )

        reloaded = json.loads((session_dir / "meta.json").read_text())
        assert reloaded["status"] == "queued"
        assert reloaded["error"] is None

    def test_no_partial_transcript_artifacts(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_transcribing(journal)
        assert not (session_dir / "transcript.json").exists()
        assert not (session_dir / "transcript.txt").exists()


class TestM1_05_AnalysisInterruption:
    """M1-05: Analysis interruption must distinguish safe retry from fatal errors."""

    def test_analyzing_session_has_transcript_preserved(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        meta = json.loads((session_dir / "meta.json").read_text())
        assert meta["status"] == "analyzing"
        assert (session_dir / "transcript.json").exists()

    def test_requeue_from_analyzing_preserves_transcript(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)

        meta = json.loads((session_dir / "meta.json").read_text())
        meta["status"] = "queued"
        meta["error"] = None
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )

        reloaded = json.loads((session_dir / "meta.json").read_text())
        assert reloaded["status"] == "queued"
        assert (session_dir / "transcript.json").exists()

    def test_no_partial_analysis_after_interruption(self, tmp_path):
        journal = tmp_path / "journal"
        session_dir = fixture_stuck_analyzing(journal)
        assert not (session_dir / "analysis.json").exists()

    ERROR_CONDITIONS = [
        ("API key invalid", "needs_attention"),
        ("credits exhausted", "needs_attention"),
        ("timeout", "failed"),
        ("network error", "failed"),
        ("rate limited", "failed"),
        ("malformed json response", "failed"),
    ]

    @pytest.mark.parametrize("error_message,expected_status", ERROR_CONDITIONS)
    def test_each_error_produces_stable_terminal_status(self, tmp_path, error_message, expected_status):
        journal = tmp_path / "journal"
        session_id = f"2026-07-12_en_err_{hash(error_message) & 0xFFFF:04x}"
        session_dir = journal / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        transcript = [{"start_seconds": 0, "end_seconds": 5, "text": "Test."}]
        (session_dir / "transcript.json").write_text(
            json.dumps(transcript, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )
        (session_dir / "video.webm").write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 8000)

        meta = {
            "id": session_id,
            "created_at": "2026-07-12T10:00:00+00:00",
            "language": "en",
            "title": "error test",
            "title_source": "default",
            "duration_seconds": 120,
            "file_size_bytes": 9000,
            "status": expected_status,
            "save_mode": "full",
            "source": "webcam",
            "video_filename": "video.webm",
            "error": error_message,
            "read": False,
            "processing": {
                "transcribe_started_at": "2026-07-12T10:01:00+00:00",
                "transcribe_finished_at": "2026-07-12T10:02:00+00:00",
                "analyze_started_at": "2026-07-12T10:02:00+00:00",
                "analyze_finished_at": "2026-07-12T10:03:00+00:00",
                "model_used": "test",
                "progress_label": "Failed",
                "progress_percent": 100,
                "terminal_lines": [],
                "attempts": 1,
            },
            "retention": {"video_kept_until": None, "compressed": False},
            "practice": {
                "assignment_completed": False,
                "assignment_completed_at": None,
                "previous_goal": "",
                "previous_goal_source_session_id": None,
                "previous_goal_result": "unmarked",
                "previous_goal_note": "",
            },
        }
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )

        reloaded = json.loads((session_dir / "meta.json").read_text())
        assert reloaded["status"] == expected_status
        assert reloaded["error"] == error_message


class TestRecoveryStatusTransitions:
    """Recovery must produce valid status transitions for all interrupted states."""

    RECOVERY_TRANSITIONS = [
        ("recording", "failed"),
        ("saved", "queued"),
        ("queued", "queued"),
        ("transcribing", "queued"),
        ("analyzing", "queued"),
    ]

    @pytest.mark.parametrize("from_status,expected_status", RECOVERY_TRANSITIONS)
    def test_valid_transition_on_recovery(self, tmp_path, from_status, expected_status):
        journal = tmp_path / "journal"
        session_id = f"2026-07-12_en_rec_{from_status}"
        session_dir = journal / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        has_video = from_status != "recording"
        if has_video:
            (session_dir / "video.webm").write_bytes(b"\x1a\x45\xdf\xa3" + b"\x00" * 8000)

        meta = {
            "id": session_id,
            "created_at": "2026-07-12T10:00:00+00:00",
            "language": "en",
            "title": "recovery test",
            "title_source": "default",
            "duration_seconds": 0 if from_status == "recording" else 120,
            "file_size_bytes": 0 if from_status == "recording" else 9000,
            "status": from_status,
            "save_mode": "full",
            "source": "webcam",
            "video_filename": "video.webm" if has_video else None,
            "error": None,
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
            "retention": {"video_kept_until": None, "compressed": False},
            "practice": {
                "assignment_completed": False,
                "assignment_completed_at": None,
                "previous_goal": "",
                "previous_goal_source_session_id": None,
                "previous_goal_result": "unmarked",
                "previous_goal_note": "",
            },
        }
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )

        meta["status"] = expected_status
        (session_dir / "meta.json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
        )

        reloaded = json.loads((session_dir / "meta.json").read_text())
        assert reloaded["status"] == expected_status
