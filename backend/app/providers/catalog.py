"""Provider catalog — normalization, caching, and management.

Orders model sources by priority:
1. Authenticated provider catalog
2. Official public catalog
3. Supplemental metadata
4. Last valid local cache
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.settings import PATHS
from app.models.schemas import ProviderModelInfo


def normalize_model_entry(
    raw: dict[str, Any],
    *,
    provider_id: str,
    source: str = "provider_authenticated_catalog",
) -> ProviderModelInfo:
    return ProviderModelInfo(
        id=str(raw.get("id", "")),
        display_name=str(raw.get("name", raw.get("display_name", ""))),
        provider_id=provider_id,
        context_window=int(raw.get("context_length", raw.get("context_window", 0))) or None,
        input_modalities=_normalize_modalities(raw.get("input_modalities", raw.get("modalities", ["text"]))),
        output_modalities=_normalize_modalities(raw.get("output_modalities", ["text"])),
        supports_structured_output=_infer_structured_output(raw),
        availability=_infer_availability(raw),
        pricing=raw.get("pricing") if isinstance(raw.get("pricing"), dict) else None,
        source=source,
        fetched_at=datetime.now().astimezone().isoformat(timespec="seconds"),
    )


def normalize_model_catalog(
    raw_models: list[dict[str, Any]],
    *,
    provider_id: str,
    source: str = "provider_authenticated_catalog",
) -> list[ProviderModelInfo]:
    return [normalize_model_entry(m, provider_id=provider_id, source=source) for m in raw_models]


def get_catalog_cache_path(connection_id: str) -> Path:
    return PATHS.cache_dir / "providers" / connection_id / "models.json"


def read_catalog_cache(connection_id: str) -> list[ProviderModelInfo] | None:
    path = get_catalog_cache_path(connection_id)
    if not path.exists():
        return None

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            return [ProviderModelInfo.model_validate(m) for m in payload if isinstance(m, dict)]
    except Exception:
        pass

    return None


def write_catalog_cache(connection_id: str, models: list[ProviderModelInfo]) -> Path:
    path = get_catalog_cache_path(connection_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [m.model_dump(mode="json") for m in models]
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def catalog_is_stale(
    connection_id: str,
    *,
    max_age_minutes: int = 60,
) -> bool:
    path = get_catalog_cache_path(connection_id)
    if not path.exists():
        return True

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list) and len(payload) > 0:
            first = payload[0]
            fetched_at = first.get("fetched_at", "")
            if fetched_at:
                then = datetime.fromisoformat(fetched_at)
                age = (datetime.now().astimezone() - then).total_seconds() / 60
                return age > max_age_minutes
    except Exception:
        pass

    return True


def find_model_in_catalog(
    models: list[ProviderModelInfo],
    model_id: str,
) -> ProviderModelInfo | None:
    for model in models:
        if model.id == model_id:
            return model
    return None


def mark_model_unavailable(
    models: list[ProviderModelInfo],
    model_id: str,
) -> list[ProviderModelInfo]:
    for model in models:
        if model.id == model_id:
            model.availability = "unavailable"
    return models


def _normalize_modalities(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(m) for m in raw]
    if isinstance(raw, str):
        return [raw]
    return ["text"]


def _infer_structured_output(raw: dict[str, Any]) -> str:
    if raw.get("supports_structured_output") is True:
        return "verified"
    if raw.get("supports_structured_output") is False:
        return "failed"
    return "unknown"


def _infer_availability(raw: dict[str, Any]) -> str:
    status = str(raw.get("status", raw.get("availability", "available"))).lower()
    if status in {"available", "active"}:
        return "available"
    if status in {"deprecated", "legacy"}:
        return "deprecated"
    if status in {"unavailable", "offline", "disabled"}:
        return "unavailable"
    return "available"
