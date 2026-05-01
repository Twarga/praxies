from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.settings import APP_VERSION


OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key"
OPENROUTER_TIMEOUT_SECONDS = 20


class OpenRouterStatusError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def fetch_openrouter_key_status(api_key: str) -> dict[str, Any]:
    if not api_key.strip():
        raise OpenRouterStatusError("OpenRouter API key is missing.", status_code=400)

    request = Request(
        OPENROUTER_KEY_URL,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": f"Praxis/{APP_VERSION}",
        },
    )

    try:
        with urlopen(request, timeout=OPENROUTER_TIMEOUT_SECONDS) as response:
            payload = json.load(response)
    except HTTPError as error:
        detail = _read_http_error_detail(error)
        status_code = error.code if isinstance(error.code, int) else 502
        raise OpenRouterStatusError(detail, status_code=status_code) from error
    except URLError as error:
        raise OpenRouterStatusError(f"OpenRouter status request failed: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise OpenRouterStatusError("OpenRouter status request returned invalid JSON.") from error

    data = payload.get("data")
    if not isinstance(data, dict):
        raise OpenRouterStatusError("OpenRouter status response did not include key data.")

    return {
        "label": str(data.get("label") or "OpenRouter key"),
        "limit_remaining": _coerce_number(data.get("limit_remaining")),
        "usage": _coerce_number(data.get("usage")),
        "is_free_tier": bool(data.get("is_free_tier")),
    }


def _coerce_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _read_http_error_detail(error: HTTPError) -> str:
    try:
        payload = json.loads(error.read().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return error.reason or "OpenRouter request failed."

    if not isinstance(payload, dict):
        return error.reason or "OpenRouter request failed."

    detail = payload.get("error") or payload.get("message") or payload.get("detail")
    if isinstance(detail, dict):
        detail = detail.get("message") or detail.get("metadata") or detail
    if isinstance(detail, str) and detail.strip():
        return detail.strip()

    return error.reason or "OpenRouter request failed."
