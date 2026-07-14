"""Migration framework tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.storage.migrations import (
    MigrationError,
    backup_file,
    detect_config_version,
    get_migration_summary,
    migrate_config_file,
    readback_validates,
    run_config_migrations,
)


V1_CONFIG_DEFAULT = {
    "schema_version": 1,
    "app_version": "0.1.0",
    "journal_folder": "/tmp/test-journal",
    "language_default": "en",
    "video_quality": "720p",
    "retention_days": 30,
    "openrouter": {
        "api_key": "sk-or-v1-deadbeef1234",
        "default_model": "google/gemini-2.5-flash-lite",
    },
    "llm": {
        "provider": "openrouter",
        "api_key": "sk-or-v1-deadbeef1234",
        "model": "google/gemini-2.5-flash-lite",
        "base_url": "",
        "provider_api_keys": {},
        "provider_models": {},
        "provider_base_urls": {},
    },
    "whisper": {
        "model": "large-v3-turbo",
        "compute_type": "int8",
        "device": "cpu",
    },
    "directness": "direct",
    "personal_context": "Test context",
    "phone_upload_enabled": False,
    "ready_sound_enabled": True,
    "setup_completed": True,
    "theme": "graphite-studio",
    "telegram": {
        "enabled": False,
        "bot_token": "",
        "chat_id": "",
        "daily_digest_time": "08:00",
        "weekly_rollup_time": "sunday 20:00",
    },
}


V1_CONFIG_OPENCODE_GO = {
    **V1_CONFIG_DEFAULT,
    "llm": {
        "provider": "opencode_go",
        "api_key": "",
        "model": "deepseek-v4-flash",
        "base_url": "",
        "provider_api_keys": {"opencode_go": "oc-go-key-12345"},
        "provider_models": {"opencode_go": "deepseek-v4-flash"},
        "provider_base_urls": {},
    },
}


V1_CONFIG_MULTI_PROVIDER = {
    **V1_CONFIG_DEFAULT,
    "llm": {
        "provider": "openrouter",
        "api_key": "sk-or-v1-abc",
        "model": "google/gemini-2.5-flash-lite",
        "base_url": "",
        "provider_api_keys": {
            "openrouter": "sk-or-v1-abc",
            "opencode_go": "oc-go-key-67890",
            "openai_compatible": "",
        },
        "provider_models": {
            "openrouter": "google/gemini-2.5-flash-lite",
            "opencode_go": "deepseek-v4-pro",
        },
        "provider_base_urls": {},
    },
}


def _write_fixture(tmp_path: Path, payload: dict) -> Path:
    path = tmp_path / "config.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


class TestVersionDetection:
    def test_detects_v1(self):
        assert detect_config_version({"schema_version": 1}) == 1

    def test_detects_v2(self):
        assert detect_config_version({"schema_version": 2}) == 2

    def test_defaults_to_v1_when_missing(self):
        assert detect_config_version({}) == 1


class TestConfigMigrationV1ToV2:
    def test_migrates_openrouter_config(self):
        result = run_config_migrations(V1_CONFIG_DEFAULT)
        assert result["schema_version"] == 2
        assert "openrouter" not in result
        assert "llm" not in result
        assert result["transcription"]["engine_id"] == "faster_whisper"
        assert result["transcription"]["model_id"] == "large-v3-turbo"
        assert len(result["provider_connections"]) == 1
        conn = list(result["provider_connections"].values())[0]
        assert conn["provider_id"] == "openrouter"
        assert "api_key" not in conn
        assert result["active_provider_connection_id"] is not None

    def test_migrates_opencode_go_config(self):
        result = run_config_migrations(V1_CONFIG_OPENCODE_GO)
        assert result["schema_version"] == 2
        conn = list(result["provider_connections"].values())[0]
        assert conn["provider_id"] == "opencode_go"
        assert conn["selected_model_id"] == "deepseek-v4-flash"

    def test_migrates_multi_provider_config(self):
        result = run_config_migrations(V1_CONFIG_MULTI_PROVIDER)
        connections = result["provider_connections"]
        assert len(connections) == 2
        assert any(c["provider_id"] == "openrouter" for c in connections.values())
        assert any(c["provider_id"] == "opencode_go" for c in connections.values())
        assert result["active_provider_connection_id"] is not None

    def test_idempotent(self):
        first = run_config_migrations(V1_CONFIG_DEFAULT)
        second = run_config_migrations(first)
        assert second == first

    def test_no_secrets_in_output(self):
        result = run_config_migrations(V1_CONFIG_DEFAULT)
        result_str = json.dumps(result)
        assert "sk-or-v1-deadbeef1234" not in result_str
        assert "oc-go-key-12345" not in result_str

    def test_missing_optional_fields(self):
        minimal = {"schema_version": 1, "journal_folder": "/tmp/j"}
        result = run_config_migrations(minimal)
        assert result["schema_version"] == 2
        assert result["journal_folder"] == "/tmp/j"
        assert result["transcription"]["engine_id"] == "faster_whisper"


class TestFileMigration:
    def test_creates_backup_before_migration(self, tmp_path):
        config_path = _write_fixture(tmp_path, V1_CONFIG_DEFAULT)
        migrated = migrate_config_file(config_path)
        assert migrated["schema_version"] == 2
        backups = list(config_path.parent.glob("config.json.bak-*"))
        assert len(backups) == 1

    def test_idempotent_file_migration(self, tmp_path):
        config_path = _write_fixture(tmp_path, V1_CONFIG_DEFAULT)
        first = migrate_config_file(config_path)
        second = migrate_config_file(config_path)
        assert second == first
        backups = list(config_path.parent.glob("config.json.bak-*"))
        assert len(backups) == 1

    def test_no_migration_needed_for_v2(self, tmp_path):
        v2 = run_config_migrations(V1_CONFIG_DEFAULT)
        _write_fixture(tmp_path, v2)
        config_path = tmp_path / "config.json"
        result = migrate_config_file(config_path)
        assert result["schema_version"] == 2

    def test_raises_on_missing_file(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            migrate_config_file(tmp_path / "nonexistent.json")

    def test_backup_preserves_original_content(self, tmp_path):
        config_path = _write_fixture(tmp_path, V1_CONFIG_DEFAULT)
        original = config_path.read_text()
        migrate_config_file(config_path)
        backups = list(config_path.parent.glob("config.json.bak-*"))
        assert backups[0].read_text() == original


class TestReadbackValidation:
    def test_validates_correct_file(self, tmp_path):
        path = tmp_path / "good.json"
        path.write_text(json.dumps({"schema_version": 2, "journal_folder": "/tmp"}), encoding="utf-8")
        assert readback_validates(path, expected_keys={"schema_version", "journal_folder"})

    def test_fails_on_missing_keys(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text(json.dumps({"schema_version": 2}), encoding="utf-8")
        assert not readback_validates(path, expected_keys={"schema_version", "journal_folder"})

    def test_fails_on_corrupt_json(self, tmp_path):
        path = tmp_path / "corrupt.json"
        path.write_text("not json", encoding="utf-8")
        assert not readback_validates(path)


class TestMigrationSummary:
    def test_reports_needs_migration_for_v1(self, tmp_path):
        config_path = _write_fixture(tmp_path, V1_CONFIG_DEFAULT)
        summary = get_migration_summary(config_path)
        assert summary["exists"] is True
        assert summary["version"] == 1
        assert summary["needs_migration"] is True

    def test_reports_no_migration_for_v2(self, tmp_path):
        v2 = run_config_migrations(V1_CONFIG_DEFAULT)
        config_path = _write_fixture(tmp_path, v2)
        summary = get_migration_summary(config_path)
        assert summary["needs_migration"] is False

    def test_reports_missing(self, tmp_path):
        summary = get_migration_summary(tmp_path / "nonexistent.json")
        assert summary["exists"] is False
        assert summary["needs_migration"] is False
