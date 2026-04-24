from __future__ import annotations

import json
from pathlib import Path

from app.core.settings import PATHS, AppPaths
from app.models import ConfigModel


def build_default_config(paths: AppPaths = PATHS) -> ConfigModel:
    return ConfigModel(
        schema_version=1,
        journal_folder=str(paths.journal_dir),
        language_default="en",
        video_quality="720p",
        retention_days=30,
        openrouter={
            "api_key": "",
            "default_model": "google/gemini-2.5-flash-lite",
        },
        whisper={
            "model": "large-v3-turbo",
            "compute_type": "int8",
            "device": "cpu",
        },
        directness="direct",
        personal_context="",
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


def write_config(config: ConfigModel, config_file: Path) -> None:
    config_file.parent.mkdir(parents=True, exist_ok=True)
    config_file.write_text(
        json.dumps(config.model_dump(mode="json"), indent=2) + "\n",
        encoding="utf-8",
    )


def load_config(paths: AppPaths = PATHS) -> ConfigModel:
    if not paths.config_file.exists():
        default_config = build_default_config(paths)
        write_config(default_config, paths.config_file)
        return default_config

    raw = paths.config_file.read_text(encoding="utf-8")
    return ConfigModel.model_validate_json(raw)
