from __future__ import annotations

from io import BytesIO
from urllib.error import HTTPError

import pytest

from app.services.openrouter_catalog import OpenRouterCatalogError, fetch_openrouter_models


class _FakeResponse(BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


def test_fetch_openrouter_models_parses_and_sorts(monkeypatch):
    payload = b"""
    {
      "data": [
        {
          "id": "zeta/model",
          "name": "Zeta",
          "description": "last",
          "context_length": 8192,
          "created": 123,
          "architecture": {
            "modality": "text->text",
            "output_modalities": ["text"]
          },
          "supported_parameters": ["temperature"]
        },
        {
          "id": "alpha/model",
          "name": "Alpha",
          "description": "first",
          "context_length": "4096",
          "created": "456",
          "architecture": {
            "modality": "text->text",
            "output_modalities": ["text"]
          },
          "supported_parameters": ["max_tokens"]
        }
      ]
    }
    """

    monkeypatch.setattr(
        "app.services.openrouter_catalog.urlopen",
        lambda request, timeout: _FakeResponse(payload),
    )

    models = fetch_openrouter_models()

    assert [model["id"] for model in models] == ["alpha/model", "zeta/model"]
    assert models[0]["context_length"] == 4096
    assert models[0]["created"] == 456
    assert models[1]["output_modalities"] == ["text"]


def test_fetch_openrouter_models_rejects_invalid_payload(monkeypatch):
    monkeypatch.setattr(
        "app.services.openrouter_catalog.urlopen",
        lambda request, timeout: _FakeResponse(b'{"data": "bad"}'),
    )

    with pytest.raises(OpenRouterCatalogError, match="data array"):
        fetch_openrouter_models()


def test_fetch_openrouter_models_surfaces_http_error(monkeypatch):
    error = HTTPError(
        url="https://openrouter.ai/api/v1/models",
        code=429,
        msg="Too Many Requests",
        hdrs=None,
        fp=_FakeResponse(b'{"error":"rate limit"}'),
    )

    def raise_error(request, timeout):
        raise error

    monkeypatch.setattr("app.services.openrouter_catalog.urlopen", raise_error)

    with pytest.raises(OpenRouterCatalogError, match="HTTP 429: rate limit"):
        fetch_openrouter_models()
