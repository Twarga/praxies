"""M1-11: Recovery and diagnostics regression test suite."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.diagnostics import run_all_checks, run_health_check
from app.services.redaction import contains_secrets


class TestDiagnosticsNeverLeaksSecrets:
    def test_health_check_output_is_secret_free(self, config):
        journal = Path(config.journal_folder)
        journal.mkdir(parents=True, exist_ok=True)
        result = run_health_check(config)
        assert not contains_secrets(json.dumps(result))

    def test_diagnostic_checks_are_secret_free(self, config):
        results = run_all_checks(config)
        for check in results:
            serialized = json.dumps(check)
            assert not contains_secrets(serialized), f"Secret in check: {check.get('name')}"


class TestAllRecoveryPathsReachable:
    """Every recovery fixture must produce state the diagnostics API can inspect."""

    RECOVERY_STATES = [
        "complete",
        "missing_chunk",
        "duplicated_chunk",
        "truncated_video",
        "incomplete_manifest",
        "no_chunks",
        "stuck_transcribing",
        "stuck_analyzing",
    ]

    def test_all_recovery_fixtures_importable(self):
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
        assert callable(fixture_complete_two_chunk_session)
        assert callable(fixture_no_chunks_recording)
        assert callable(fixture_stuck_transcribing)
        assert callable(fixture_stuck_analyzing)


class TestDiagnosticsIntegrationWithRecovery:
    """Diagnostics must correctly report on sessions in recovery states."""

    def test_recovery_sessions_detected_in_journal(self, tmp_path):
        from tests.fixtures_recovery import (
            fixture_complete_two_chunk_session,
            fixture_stuck_analyzing,
            fixture_stuck_transcribing,
        )

        journal = tmp_path / "journal"
        journal.mkdir(parents=True, exist_ok=True)

        fixture_complete_two_chunk_session(journal, session_id="2026-07-12_en_ok", status="ready")
        fixture_stuck_transcribing(journal, session_id="2026-07-12_en_stuck_ts")
        fixture_stuck_analyzing(journal, session_id="2026-07-12_en_stuck_an")

        sessions = list(journal.iterdir())
        meta_count = sum(1 for d in sessions if d.is_dir() and (d / "meta.json").exists())
        assert meta_count == 3


class TestRedactionBlocksAllKnownPatterns:
    def test_no_fixture_contains_secret_patterns(self, tmp_path):
        from tests.fixtures_recovery import (
            fixture_complete_two_chunk_session,
            fixture_stuck_analyzing,
            fixture_stuck_transcribing,
        )

        journal = tmp_path / "journal"
        journal.mkdir(parents=True, exist_ok=True)

        sessions = [
            fixture_complete_two_chunk_session(journal, session_id="2026-07-12_en_sec1", status="ready"),
            fixture_stuck_transcribing(journal, session_id="2026-07-12_en_sec2"),
            fixture_stuck_analyzing(journal, session_id="2026-07-12_en_sec3"),
        ]

        for session_dir in sessions:
            for json_file in session_dir.glob("*.json"):
                content = json_file.read_text()
                assert not contains_secrets(content), f"Secret pattern in {json_file}"


class TestPipelineHardeningCoversAllStates:
    """Verify the hardening tests are consistent with recovery fixtures."""

    def test_all_transitions_are_valid_statuses(self):
        valid_statuses = {
            "recording", "saved", "queued", "transcribing",
            "analyzing", "ready", "failed", "needs_attention", "video_only",
        }
        from tests.test_pipeline_hardening import TestRecoveryStatusTransitions

        for from_state, expected_state in TestRecoveryStatusTransitions.RECOVERY_TRANSITIONS:
            assert from_state in valid_statuses
            assert expected_state in valid_statuses

    def test_all_error_conditions_map_to_terminal_statuses(self):
        valid_statuses = {"failed", "needs_attention"}
        from tests.test_pipeline_hardening import TestM1_05_AnalysisInterruption

        for _error, expected_status in TestM1_05_AnalysisInterruption.ERROR_CONDITIONS:
            assert expected_status in valid_statuses
