from __future__ import annotations

import pytest

from app.core.settings import APP_VERSION, AppPaths
from app.models import ConfigModel


@pytest.fixture
def app_paths(tmp_path) -> AppPaths:
    home = tmp_path / "home"
    config_dir = home / ".config" / "praxis"
    cache_dir = home / ".cache" / "praxis"
    journal_dir = home / "PraxisJournal"
    legacy_config_dir = home / ".config" / "twarga-journal"
    legacy_cache_dir = home / ".cache" / "twarga-journal"
    legacy_journal_dir = home / "TwargaJournal"

    config_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    journal_dir.mkdir(parents=True, exist_ok=True)

    return AppPaths(
        home=home,
        config_dir=config_dir,
        cache_dir=cache_dir,
        journal_dir=journal_dir,
        config_file=config_dir / "config.json",
        backend_log_file=cache_dir / "backend.log",
        runtime_socket=cache_dir / "runtime.sock",
        whisper_cache_dir=home / ".cache" / "whisper",
        legacy_config_dir=legacy_config_dir,
        legacy_cache_dir=legacy_cache_dir,
        legacy_journal_dir=legacy_journal_dir,
        legacy_config_file=legacy_config_dir / "config.json",
    )


@pytest.fixture
def config(app_paths: AppPaths) -> ConfigModel:
    return ConfigModel(
        schema_version=1,
        app_version=APP_VERSION,
        journal_folder=str(app_paths.journal_dir),
        language_default="en",
        video_quality="720p",
        retention_days=30,
        openrouter={"api_key": "", "default_model": "google/gemini-2.5-flash-lite"},
        whisper={"model": "large-v3-turbo", "compute_type": "int8", "device": "cpu"},
        directness="direct",
        personal_context="test context",
        phone_upload_enabled=False,
        ready_sound_enabled=True,
        theme="bronze-dark",
        telegram={
            "enabled": False,
            "bot_token": "",
            "chat_id": "",
            "daily_digest_time": "08:00",
            "weekly_rollup_time": "sunday 20:00",
        },
    )
