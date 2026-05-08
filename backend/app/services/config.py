from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from app.core.settings import APP_VERSION, PATHS, AppPaths
from app.models import ConfigModel
from app.services.json_io import read_json_file, write_json_file
from app.services.network import build_upload_url, detect_lan_ip


DEFAULT_PERSONAL_CONTEXT = """You are giving feedback on a private video journaling session.
The user is using Praxis to improve speaking quality, language fluency,
thinking clarity, and executive presence over time. Assume the user wants
precision, not comfort, and values correction over praise.

Feedback style — direct, no softening:
- Call out factual errors specifically. Name what the user got wrong and point to
  a source.
- Call out logical flaws and weak arguments. Don't hedge.
- Name strengths only when they are specifically what the user should do more of.
  No filler praise.
- When the user falls into the "plan without ship" pattern, name it.
- Call out grammar and language errors in the target language, with the
  correction.
- Track recurring patterns and reference them by name when the user repeats them.
- Do not be cruel. Do not be gentle. Be accurate and useful.

Respond in the language of the session.
"""

LEGACY_DEFAULT_PERSONAL_CONTEXT = """You are giving feedback to Twarga, a 22-year-old solo founder from Morocco.
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
        app_version=APP_VERSION,
        journal_folder=str(paths.journal_dir),
        language_default="en",
        video_quality="720p",
        retention_days=30,
        openrouter={
            "api_key": "",
            "default_model": "google/gemini-2.5-flash-lite",
        },
        llm={
            "provider": "openrouter",
            "api_key": "",
            "model": "google/gemini-2.5-flash-lite",
            "base_url": "",
            "provider_api_keys": {},
            "provider_models": {
                "openrouter": "google/gemini-2.5-flash-lite",
                "opencode_go": "deepseek-v4-flash",
            },
            "provider_base_urls": {},
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
        setup_completed=False,
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
        if paths.legacy_config_file.exists():
            legacy_payload = _normalize_legacy_config_payload(read_json_file(paths.legacy_config_file))
            migrated_config = ConfigModel.model_validate(legacy_payload)
            write_config(migrated_config, paths.config_file)
            return migrated_config

        default_config = build_default_config(paths)
        write_config(default_config, paths.config_file)
        return default_config

    raw_payload = read_json_file(paths.config_file)
    payload = _normalize_legacy_config_payload(raw_payload)
    config = ConfigModel.model_validate(payload)
    if payload != raw_payload or payload != config.model_dump(mode="json"):
        write_config(config, paths.config_file)
    return config


def mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""

    if len(api_key) <= 6:
        return "•" * len(api_key)

    return f"{api_key[:6]}{'•' * 12}"


def dump_config_for_api(
    config: ConfigModel,
    paths: AppPaths = PATHS,
    *,
    upload_port: int | None = None,
) -> dict[str, object]:
    payload = config.model_dump(mode="json")
    lan_ip = detect_lan_ip()
    payload["openrouter"]["api_key"] = mask_api_key(config.openrouter.api_key)
    payload["openrouter"]["configured"] = bool(config.openrouter.api_key)
    active_api_key = _resolve_provider_api_key(config, config.llm.provider)
    payload["llm"]["api_key"] = mask_api_key(active_api_key)
    payload["llm"]["configured"] = bool(active_api_key) or config.llm.provider == "litellm_proxy"
    payload["llm"]["provider_api_keys"] = {
        provider: mask_api_key(key)
        for provider, key in config.llm.provider_api_keys.items()
        if key
    }
    payload["llm"]["provider_configured"] = {
        "openrouter": bool(config.openrouter.api_key or config.llm.provider_api_keys.get("openrouter")),
        "opencode_go": bool(config.llm.provider_api_keys.get("opencode_go")),
        "openai_compatible": bool(config.llm.provider_api_keys.get("openai_compatible")),
        "litellm_proxy": True,
    }
    payload["app_version"] = APP_VERSION
    payload["config_path"] = str(paths.config_file)
    payload["logs_path"] = str(paths.backend_log_file)
    payload["phone_upload_lan_ip"] = lan_ip
    payload["phone_upload_url"] = (
        build_upload_url(lan_ip, upload_port) if config.phone_upload_enabled else None
    )
    return payload


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _normalize_legacy_config_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(payload)
    supported_languages = {"en", "fr", "es"}
    if normalized.get("language_default") not in supported_languages:
        normalized["language_default"] = "en"
    if normalized.get("personal_context", "").strip() == LEGACY_DEFAULT_PERSONAL_CONTEXT.strip():
        normalized["personal_context"] = DEFAULT_PERSONAL_CONTEXT
    if normalized.get("personal_context", "").strip() == "":
        normalized["personal_context"] = DEFAULT_PERSONAL_CONTEXT
    if "llm" not in normalized:
        openrouter = normalized.get("openrouter") or {}
        normalized["llm"] = {
            "provider": "openrouter",
            "api_key": openrouter.get("api_key", ""),
            "model": openrouter.get("default_model", "google/gemini-2.5-flash-lite"),
            "base_url": "",
            "provider_api_keys": {},
            "provider_models": {},
            "provider_base_urls": {},
        }
    llm = normalized.get("llm") or {}
    provider = llm.get("provider", "openrouter")
    provider_api_keys = dict(llm.get("provider_api_keys") or {})
    provider_models = dict(llm.get("provider_models") or {})
    provider_base_urls = dict(llm.get("provider_base_urls") or {})
    openrouter = normalized.get("openrouter") or {}
    if openrouter.get("api_key"):
        provider_api_keys.setdefault("openrouter", openrouter["api_key"])
    if openrouter.get("default_model"):
        provider_models.setdefault("openrouter", openrouter["default_model"])
    if llm.get("api_key"):
        provider_api_keys.setdefault(provider, llm["api_key"])
    if llm.get("model"):
        provider_models.setdefault(provider, llm["model"])
    if llm.get("base_url"):
        provider_base_urls.setdefault(provider, llm["base_url"])
    llm["provider_api_keys"] = provider_api_keys
    llm["provider_models"] = provider_models
    llm["provider_base_urls"] = provider_base_urls
    llm["api_key"] = _resolve_provider_api_key_from_payload(normalized, provider)
    llm["model"] = provider_models.get(provider, llm.get("model", ""))
    llm["base_url"] = provider_base_urls.get(provider, llm.get("base_url", ""))
    normalized["llm"] = llm
    normalized["app_version"] = APP_VERSION
    return normalized


def update_config(patch: dict[str, Any], paths: AppPaths = PATHS) -> ConfigModel:
    current = load_config(paths)
    normalized_patch = _normalize_config_patch(patch, current)
    merged_payload = _deep_merge(current.model_dump(mode="json"), normalized_patch)
    updated = ConfigModel.model_validate(merged_payload)
    write_config(updated, paths.config_file)
    return updated


def _normalize_config_patch(patch: dict[str, Any], current: ConfigModel) -> dict[str, Any]:
    normalized = deepcopy(patch)
    llm_patch = normalized.get("llm")
    openrouter_patch = normalized.get("openrouter")

    if isinstance(openrouter_patch, dict) and "llm" not in normalized and current.llm.provider == "openrouter":
        normalized["llm"] = {
            "provider": "openrouter",
            "api_key": openrouter_patch.get("api_key", current.llm.api_key),
            "model": openrouter_patch.get("default_model", current.llm.model),
            "base_url": current.llm.base_url,
        }

    if isinstance(llm_patch, dict):
        provider = llm_patch.get("provider", current.llm.provider)
        provider_api_keys = dict(current.llm.provider_api_keys)
        provider_models = dict(current.llm.provider_models)
        provider_base_urls = dict(current.llm.provider_base_urls)
        if current.openrouter.api_key:
            provider_api_keys["openrouter"] = current.openrouter.api_key
        if current.openrouter.default_model:
            provider_models["openrouter"] = current.openrouter.default_model
        provider_api_keys.update(llm_patch.get("provider_api_keys") or {})
        provider_models.update(llm_patch.get("provider_models") or {})
        provider_base_urls.update(llm_patch.get("provider_base_urls") or {})
        if "api_key" in llm_patch:
            provider_api_keys[provider] = llm_patch["api_key"]
        if "model" in llm_patch:
            provider_models[provider] = llm_patch["model"]
        if "base_url" in llm_patch:
            provider_base_urls[provider] = llm_patch["base_url"]
        llm_patch["provider_api_keys"] = provider_api_keys
        llm_patch["provider_models"] = provider_models
        llm_patch["provider_base_urls"] = provider_base_urls
        if "api_key" not in llm_patch:
            llm_patch["api_key"] = provider_api_keys.get(provider, "")
        if "model" not in llm_patch:
            llm_patch["model"] = provider_models.get(provider, "")
        if "base_url" not in llm_patch:
            llm_patch["base_url"] = provider_base_urls.get(provider, "")
        if provider == "openrouter":
            normalized.setdefault("openrouter", {})
            if "api_key" in llm_patch:
                normalized["openrouter"]["api_key"] = llm_patch["api_key"]
            if "model" in llm_patch:
                normalized["openrouter"]["default_model"] = llm_patch["model"]

    return normalized


def _resolve_provider_api_key(config: ConfigModel, provider: str) -> str:
    if provider == "openrouter":
        return (
            config.llm.provider_api_keys.get("openrouter")
            or config.openrouter.api_key
            or (config.llm.api_key if config.llm.provider == "openrouter" else "")
        )
    return config.llm.provider_api_keys.get(provider) or (
        config.llm.api_key if config.llm.provider == provider else ""
    )


def _resolve_provider_api_key_from_payload(payload: dict[str, Any], provider: str) -> str:
    llm = payload.get("llm") or {}
    provider_api_keys = llm.get("provider_api_keys") or {}
    if provider == "openrouter":
        openrouter = payload.get("openrouter") or {}
        return provider_api_keys.get("openrouter") or openrouter.get("api_key", "")
    return provider_api_keys.get(provider) or (llm.get("api_key", "") if llm.get("provider") == provider else "")


def resolve_journal_dir(config: ConfigModel) -> Path:
    return Path(config.journal_folder).expanduser().resolve()


def ensure_journal_dir(config: ConfigModel) -> Path:
    journal_dir = resolve_journal_dir(config)
    journal_dir.mkdir(parents=True, exist_ok=True)
    return journal_dir
