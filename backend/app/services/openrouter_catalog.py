from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.settings import APP_VERSION


OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
OPENROUTER_TIMEOUT_SECONDS = 20


class OpenRouterCatalogError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def fetch_openrouter_models() -> list[dict[str, Any]]:
    """Fetch the full live OpenRouter model catalog."""
    payload = _fetch_json(OPENROUTER_MODELS_URL)

    data = payload.get("data")
    if not isinstance(data, list):
        raise OpenRouterCatalogError("OpenRouter model catalog response did not include a valid data array.")

    models = [_normalize_model(item) for item in data if isinstance(item, dict)]
    models = [model for model in models if model is not None]
    models.sort(key=lambda model: model["id"])
    return models


def _fetch_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": f"Praxis/{APP_VERSION}",
        },
    )

    try:
        with urlopen(request, timeout=OPENROUTER_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except HTTPError as error:
        detail = _read_http_error_detail(error)
        raise OpenRouterCatalogError(
            f"OpenRouter model catalog request failed with HTTP {error.code}: {detail}",
            status_code=error.code,
        ) from error
    except URLError as error:
        raise OpenRouterCatalogError(
            f"OpenRouter model catalog request failed: {error.reason}"
        ) from error
    except json.JSONDecodeError as error:
        raise OpenRouterCatalogError("OpenRouter model catalog returned invalid JSON.") from error


def _normalize_model(payload: dict[str, Any]) -> dict[str, Any] | None:
    model_id = str(payload.get("id") or "").strip()
    if not model_id:
        return None

    architecture = payload.get("architecture")
    pricing = payload.get("pricing")
    top_provider = payload.get("top_provider")
    supported_parameters = payload.get("supported_parameters")

    return {
        "id": model_id,
        "name": str(payload.get("name") or model_id),
        "canonical_slug": str(payload.get("canonical_slug") or model_id),
        "description": str(payload.get("description") or ""),
        "context_length": _coerce_int(payload.get("context_length")),
        "created": _coerce_int(payload.get("created")),
        "modality": str(architecture.get("modality") or "") if isinstance(architecture, dict) else "",
        "output_modalities": _coerce_str_list(
            architecture.get("output_modalities") if isinstance(architecture, dict) else None
        ),
        "supported_parameters": _coerce_str_list(supported_parameters),
        "pricing": pricing if isinstance(pricing, dict) else {},
        "top_provider": top_provider if isinstance(top_provider, dict) else {},
    }


def _coerce_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _coerce_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None]


def _read_http_error_detail(error: HTTPError) -> str:
    try:
        payload = json.loads(error.read().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return error.reason or "unknown error"

    detail = payload.get("error") or payload.get("message") or payload.get("detail")
    if isinstance(detail, str) and detail.strip():
        return detail.strip()

    return error.reason or "unknown error"
