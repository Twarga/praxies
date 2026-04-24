from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from app.core.settings import PATHS, AppPaths
from app.models import ConfigModel
from app.services.json_io import read_json_file, write_json_file


DEFAULT_PERSONAL_CONTEXT = """You are giving feedback to Twarga, a 22-year-old solo founder from Morocco.
He chose the name "Twarga" at 14, inspired by Saharan Tuareg/Amazigh culture,
and identifies as Riffian Amazigh. His long-term vision is a three-brand
empire: TwargaOps (open-source DevOps infrastructure), RSPStudio (adult game
studio), and RSPStories (serialized fiction). Currently RSP funds TwargaOps.
He plans to relocate from Morocco to Brazil (Santa Catarina / Rio Grande do
Sul) and buy his mother a house in Morocco first.

Intellectual interests: Nietzsche, Camus, Adler, Jung, Dostoevsky,
existentialism, classic literature, serious cinema, game design. He has a
documented pattern of deep research and planning cycles without shipping —
he is actively working to break this through execution-first commitments.

He speaks English, French, and Spanish, and is using this journaling tool to
practice all three while developing his speaking, ideas, and executive
presence for his future as a CEO.

Feedback style — direct, no softening:
- Call out factual errors specifically. Name what he got wrong and point to
  a source.
- Call out logical flaws and weak arguments. Don't hedge.
- Name strengths only when they are specifically what he should do more of.
  No filler praise.
- When he falls into the "plan without ship" pattern, name it.
- Call out grammar and language errors in the target language, with the
  correction.
- Track recurring patterns and reference them by name when he repeats them.
- Do not be cruel. Do not be gentle. Be accurate and useful.

Respond in the language of the session.
"""


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
        personal_context=DEFAULT_PERSONAL_CONTEXT,
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
    write_json_file(config_file, config.model_dump(mode="json"))


def load_config(paths: AppPaths = PATHS) -> ConfigModel:
    if not paths.config_file.exists():
        default_config = build_default_config(paths)
        write_config(default_config, paths.config_file)
        return default_config

    return ConfigModel.model_validate(read_json_file(paths.config_file))


def mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""

    if len(api_key) <= 6:
        return "•" * len(api_key)

    return f"{api_key[:6]}{'•' * 12}"


def dump_config_for_api(config: ConfigModel) -> dict[str, object]:
    payload = config.model_dump(mode="json")
    payload["openrouter"]["api_key"] = mask_api_key(config.openrouter.api_key)
    return payload


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def update_config(patch: dict[str, Any], paths: AppPaths = PATHS) -> ConfigModel:
    current = load_config(paths)
    merged_payload = _deep_merge(current.model_dump(mode="json"), patch)
    updated = ConfigModel.model_validate(merged_payload)
    write_config(updated, paths.config_file)
    return updated


def resolve_journal_dir(config: ConfigModel) -> Path:
    return Path(config.journal_folder).expanduser().resolve()


def ensure_journal_dir(config: ConfigModel) -> Path:
    journal_dir = resolve_journal_dir(config)
    journal_dir.mkdir(parents=True, exist_ok=True)
    return journal_dir
