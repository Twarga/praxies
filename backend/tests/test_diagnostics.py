"""Diagnostics service tests."""

from __future__ import annotations

from pathlib import Path

from app.services.diagnostics import (
    check_credential_store,
    check_disk,
    check_journal,
    check_media_tools,
    check_transcription_runtime,
    run_all_checks,
    run_health_check,
)
from fastapi.testclient import TestClient
from app.main import app
from app.services.config import update_config


class TestJournalCheck:
    def test_existing_journal_passes(self, config):
        journal = Path(config.journal_folder)
        journal.mkdir(parents=True, exist_ok=True)
        (journal / "_index.json").write_text("{}")
        result = check_journal(config)
        assert result["ok"] is True
        assert "sessions" in result["summary"].lower()

    def test_missing_journal_fails(self, config):
        config.journal_folder = "/nonexistent/journal/folder/xyz"
        result = check_journal(config)
        assert result["ok"] is False
        assert result["action"] is not None

    def test_non_directory_journal_fails(self, tmp_path):
        file_path = tmp_path / "not-a-dir"
        file_path.write_text("hello")
        result = check_journal(type("FakeConfig", (), {"journal_folder": str(file_path)})())
        assert result["ok"] is False


class TestDiskCheck:
    def test_tmp_has_space(self):
        result = check_disk("/tmp")
        assert result["ok"] is True
        assert "GB" in result["summary"]

    def test_returns_error_on_bad_path(self):
        result = check_disk("/nonexistent/path/xyz")
        assert result["ok"] is False


class TestMediaToolsCheck:
    def test_ffmpeg_detected(self):
        import shutil
        if shutil.which("ffmpeg"):
            result = check_media_tools()
            assert result["ok"] is True


class TestTranscriptionRuntimeCheck:
    def test_faster_whisper_available(self):
        result = check_transcription_runtime()
        assert result["ok"] is True or result["action"] is not None

    def test_result_has_required_fields(self):
        result = check_transcription_runtime()
        for field in ["name", "ok", "summary", "detail", "action"]:
            assert field in result


class TestCredentialStoreCheck:
    def test_has_required_fields(self):
        result = check_credential_store()
        for field in ["name", "ok", "summary", "detail", "action"]:
            assert field in result


class TestFullDiagnostics:
    def test_returns_all_checks(self, config):
        results = run_all_checks(config)
        assert len(results) == 9

    def test_every_check_has_required_shape(self, config):
        for result in run_all_checks(config):
            assert isinstance(result["name"], str)
            assert isinstance(result["ok"], bool)
            assert isinstance(result["summary"], str)

    def test_health_check_aggregates(self, config):
        health = run_health_check(config)
        assert isinstance(health["ok"], bool)
        assert health["checked_at"]
        assert isinstance(health["checks"], list)
        assert "action" in health

    def test_reset_onboarding_preserves_journal(self, config):
        journal = Path(config.journal_folder)
        journal.mkdir(parents=True, exist_ok=True)
        marker = journal / "keep.txt"
        marker.write_text("keep", encoding="utf-8")
        update_config({"setup_completed": True})
        response = TestClient(app).post("/api/diagnostics/reset-onboarding")
        assert response.status_code == 200
        assert marker.read_text(encoding="utf-8") == "keep"
