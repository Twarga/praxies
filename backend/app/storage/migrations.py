"""Configuration and session migration framework.

Migrations are idempotent, ordered, and create backups before writing.
A failed migration leaves the original file usable.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from app.services.json_io import overwrite_json_file, read_json_file


class MigrationError(RuntimeError):
    pass


class MigrationBackupError(MigrationError):
    pass


def backup_file(path: Path) -> Path:
    """Create a timestamped backup of a file. Raises if backup fails."""
    if not path.exists():
        raise FileNotFoundError(f"Cannot back up missing file: {path}")

    timestamp = datetime.now().astimezone().strftime("%Y%m%dT%H%M%S")
    backup_path = path.with_suffix(f"{path.suffix}.bak-{timestamp}")

    try:
        backup_path.write_bytes(path.read_bytes())
    except OSError as error:
        raise MigrationBackupError(f"Backup failed for {path}: {error}") from error

    return backup_path


def readback_validates(path: Path, expected_keys: set[str] | None = None) -> bool:
    """Verify a JSON file can be read back and contains expected shape."""
    try:
        payload = read_json_file(path)
    except Exception:
        return False

    if not isinstance(payload, dict):
        return False

    if expected_keys is not None and not expected_keys.issubset(payload.keys()):
        return False

    return True


def detect_config_version(payload: dict[str, Any]) -> int:
    return int(payload.get("schema_version", 1))


def run_config_migrations(payload: dict[str, Any]) -> dict[str, Any]:
    """Apply all config migrations in order. Returns the final payload."""
    current_version = detect_config_version(payload)
    migrated = dict(payload)

    while current_version < 2:
        migrated = _migrate_config_v1_to_v2(migrated)
        current_version = 2

    return migrated


def migrate_config_file(config_path: Path) -> dict[str, Any]:
    """Read, back up, migrate, and write a config file. Returns the migrated payload."""
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    payload = read_json_file(config_path)
    version = detect_config_version(payload)

    if version >= 2:
        return payload

    backup_file(config_path)
    migrated = run_config_migrations(payload)

    overwrite_json_file(config_path, migrated)

    if not readback_validates(config_path, expected_keys={"schema_version", "journal_folder", "transcription"}):
        raise MigrationError(f"Config migration write failed readback validation: {config_path}")

    return migrated


def _migrate_config_v1_to_v2(payload: dict[str, Any]) -> dict[str, Any]:
    """Migrate config from v1 (embedded keys, closed providers) to v2 (connections, secret refs)."""
    migrated: dict[str, Any] = {
        "schema_version": 2,
        "app_version": payload.get("app_version", "0.1.0"),
        "journal_folder": payload.get("journal_folder", ""),
        "language_default": payload.get("language_default", "en"),
        "video_quality": payload.get("video_quality", "720p"),
        "retention_days": int(payload.get("retention_days", 30)),
        "active_provider_connection_id": None,
        "provider_connections": {},
        "transcription": _migrate_whisper_v1_to_v2(payload),
        "directness": payload.get("directness", "direct"),
        "personal_context": payload.get("personal_context", ""),
        "phone_upload_enabled": bool(payload.get("phone_upload_enabled", False)),
        "ready_sound_enabled": bool(payload.get("ready_sound_enabled", True)),
        "setup_completed": bool(payload.get("setup_completed", False)),
        "theme": payload.get("theme", "graphite-studio"),
        "telegram": payload.get("telegram", {
            "enabled": False,
            "bot_token": "",
            "chat_id": "",
            "daily_digest_time": "08:00",
            "weekly_rollup_time": "sunday 20:00",
        }),
    }

    v1_openrouter = payload.get("openrouter") or {}
    v1_llm = payload.get("llm") or {}
    v1_provider = (v1_llm.get("provider") or "openrouter").strip()
    v1_provider_api_keys = dict(v1_llm.get("provider_api_keys") or {})

    if v1_openrouter.get("api_key"):
        v1_provider_api_keys.setdefault("openrouter", v1_openrouter["api_key"])
    if v1_llm.get("api_key") and v1_provider not in v1_provider_api_keys:
        v1_provider_api_keys[v1_provider] = v1_llm["api_key"]

    for provider_id, api_key in v1_provider_api_keys.items():
        if not api_key or not api_key.strip():
            continue

        conn_id = f"migrated-{provider_id}"
        migrated["provider_connections"][conn_id] = {
            "provider_id": provider_id,
            "display_name": f"Migrated {provider_id}",
            "auth_profile_id": "",
            "selected_model_id": v1_llm.get("provider_models", {}).get(provider_id, v1_llm.get("model", "")),
            "base_url": v1_llm.get("provider_base_urls", {}).get(provider_id, v1_llm.get("base_url", "")),
            "catalog_updated_at": None,
            "enabled": True,
        }
        if provider_id == v1_provider:
            migrated["active_provider_connection_id"] = conn_id

    return migrated


def _migrate_whisper_v1_to_v2(payload: dict[str, Any]) -> dict[str, Any]:
    v1_whisper = payload.get("whisper") or {}
    return {
        "engine_id": "faster_whisper",
        "model_id": v1_whisper.get("model", "large-v3-turbo"),
        "cache_folder": str(Path.home() / ".cache" / "whisper"),
        "device": v1_whisper.get("device", "cpu"),
        "compute_type": v1_whisper.get("compute_type", "int8"),
    }


def get_migration_summary(config_path: Path) -> dict[str, object]:
    """Report on current migration state without modifying files."""
    if not config_path.exists():
        return {"exists": False, "version": None, "needs_migration": False}

    try:
        payload = read_json_file(config_path)
    except Exception:
        return {"exists": True, "version": None, "needs_migration": False, "readable": False}

    version = detect_config_version(payload)
    return {
        "exists": True,
        "version": version,
        "needs_migration": version < 2,
        "readable": True,
    }
