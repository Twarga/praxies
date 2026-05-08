from __future__ import annotations

from app.services.config import dump_config_for_api, load_config, update_config
from app.services.json_io import write_json_file


def test_load_config_migrates_openrouter_to_llm(app_paths):
    write_json_file(
        app_paths.config_file,
        {
            "schema_version": 1,
            "app_version": "old",
            "journal_folder": str(app_paths.journal_dir),
            "language_default": "en",
            "video_quality": "720p",
            "retention_days": 30,
            "openrouter": {"api_key": "sk-or-test", "default_model": "anthropic/claude-test"},
            "whisper": {"model": "large-v3-turbo", "compute_type": "int8", "device": "cpu"},
            "directness": "direct",
            "personal_context": "test context",
            "phone_upload_enabled": False,
            "ready_sound_enabled": True,
            "setup_completed": True,
            "theme": "bronze-dark",
            "telegram": {
                "enabled": False,
                "bot_token": "",
                "chat_id": "",
                "daily_digest_time": "08:00",
                "weekly_rollup_time": "sunday 20:00",
            },
        },
    )

    config = load_config(app_paths)

    assert config.llm.provider == "openrouter"
    assert config.llm.api_key == "sk-or-test"
    assert config.llm.model == "anthropic/claude-test"


def test_openrouter_patch_syncs_active_llm_config(config, app_paths):
    write_json_file(app_paths.config_file, config.model_dump(mode="json"))

    updated = update_config(
        {"openrouter": {"api_key": "sk-or-next", "default_model": "openai/gpt-test"}},
        app_paths,
    )

    assert updated.llm.provider == "openrouter"
    assert updated.llm.api_key == "sk-or-next"
    assert updated.llm.model == "openai/gpt-test"


def test_llm_patch_syncs_openrouter_when_openrouter_is_active(config, app_paths):
    write_json_file(app_paths.config_file, config.model_dump(mode="json"))

    updated = update_config(
        {"llm": {"provider": "openrouter", "api_key": "sk-or-next", "model": "openai/gpt-test"}},
        app_paths,
    )

    assert updated.openrouter.api_key == "sk-or-next"
    assert updated.openrouter.default_model == "openai/gpt-test"


def test_dump_config_masks_active_llm_key(config):
    config.llm.api_key = "abcdef123456"

    payload = dump_config_for_api(config)

    assert payload["llm"]["api_key"] == "abcdef••••••••••••"
    assert payload["llm"]["configured"] is True
