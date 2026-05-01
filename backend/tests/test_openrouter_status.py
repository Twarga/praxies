from __future__ import annotations

from io import BytesIO
from urllib.error import HTTPError

import pytest

from app.services.openrouter_status import OpenRouterStatusError, fetch_openrouter_key_status


class _FakeResponse(BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


def test_fetch_openrouter_key_status_parses_payload(monkeypatch):
    payload = b"""
    {
      "data": {
        "label": "Main key",
        "limit_remaining": 12.5,
        "usage": 3.75,
        "is_free_tier": false
      }
    }
    """

    monkeypatch.setattr(
        "app.services.openrouter_status.urlopen",
        lambda request, timeout: _FakeResponse(payload),
    )

    status = fetch_openrouter_key_status("sk-or-v1-test")

    assert status["label"] == "Main key"
    assert status["limit_remaining"] == 12.5
    assert status["usage"] == 3.75
    assert status["is_free_tier"] is False


def test_fetch_openrouter_key_status_requires_key():
    with pytest.raises(OpenRouterStatusError, match="missing"):
        fetch_openrouter_key_status("")


def test_fetch_openrouter_key_status_surfaces_http_error(monkeypatch):
    error = HTTPError(
        url="https://openrouter.ai/api/v1/key",
        code=401,
        msg="Unauthorized",
        hdrs=None,
        fp=_FakeResponse(b'{"error":"API key invalid."}'),
    )

    def raise_error(request, timeout):
        raise error

    monkeypatch.setattr("app.services.openrouter_status.urlopen", raise_error)

    with pytest.raises(OpenRouterStatusError, match="API key invalid."):
        fetch_openrouter_key_status("sk-or-v1-test")
