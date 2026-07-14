"""Provider adapter base class and protocol.

Each adapter must implement: authenticate, fetch_models, test_model,
generate, and optional fetch_usage / refresh_auth.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import asyncio
from typing import Any

import httpx

from app.models.schemas import ProviderModelInfo


class ProviderAdapter(ABC):
    provider_id: str
    display_name: str
    base_url: str = ""

    @abstractmethod
    def auth_methods(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def authenticate(self, credentials: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    async def fetch_models(self, credentials: dict[str, Any]) -> list[ProviderModelInfo]:
        ...

    @abstractmethod
    async def test_model(
        self,
        credentials: dict[str, Any],
        model_id: str,
    ) -> dict[str, Any]:
        ...

    @abstractmethod
    async def generate(
        self,
        credentials: dict[str, Any],
        model_id: str,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.4,
        max_tokens: int = 4000,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ...

    async def fetch_usage(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        return None

    async def refresh_auth(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        return None


class OpenRouterAdapter(ProviderAdapter):
    provider_id = "openrouter"
    display_name = "OpenRouter"
    base_url = "https://openrouter.ai/api/v1"

    def auth_methods(self) -> list[dict[str, Any]]:
        return [{"type": "api_key", "label": "API key", "required": True}]

    async def authenticate(self, credentials: dict[str, Any]) -> dict[str, Any]:
        api_key = credentials.get("api_key", "")
        if not api_key:
            raise ValueError("OpenRouter API key is required.")
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        response.raise_for_status()
        return {"authenticated": True, "provider_id": self.provider_id}

    async def fetch_models(self, credentials: dict[str, Any]) -> list[ProviderModelInfo]:
        try:
            from app.services.openrouter_catalog import fetch_openrouter_models
            raw = await asyncio.to_thread(fetch_openrouter_models)
            from app.providers.catalog import normalize_model_catalog
            return normalize_model_catalog(raw, provider_id=self.provider_id)
        except Exception as error:
            raise RuntimeError(f"Failed to fetch OpenRouter models: {error}") from error

    async def test_model(
        self,
        credentials: dict[str, Any],
        model_id: str,
    ) -> dict[str, Any]:
        response = await self.generate(
            credentials,
            model_id,
            [{"role": "user", "content": 'Return only this JSON: {"ok":true}'}],
            temperature=0,
            max_tokens=32,
            response_format={"type": "json_object"},
        )
        import json
        payload = json.loads(response["content"])
        return {
            "model_id": model_id,
            "provider_id": self.provider_id,
            "authentication_ok": True,
            "routing_ok": True,
            "json_valid": isinstance(payload, dict),
            "required_fields_present": payload.get("ok") is True,
        }

    async def generate(
        self,
        credentials: dict[str, Any],
        model_id: str,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.4,
        max_tokens: int = 4000,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        api_key = credentials.get("api_key", "")
        if not api_key:
            raise ValueError("OpenRouter API key is required.")
        payload: dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        response.raise_for_status()
        data = response.json()
        return {"content": data["choices"][0]["message"]["content"], "model": data.get("model", model_id)}

    async def fetch_usage(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        try:
            from app.services.openrouter_status import fetch_openrouter_key_status
            return fetch_openrouter_key_status(credentials.get("api_key", ""))
        except Exception:
            return None


class OpenAICompatibleAdapter(ProviderAdapter):
    provider_id = "openai_compatible"
    display_name = "OpenAI-compatible"

    def __init__(self, *, provider_id: str | None = None, display_name: str | None = None, base_url: str = "") -> None:
        if provider_id:
            self.provider_id = provider_id
        if display_name:
            self.display_name = display_name
        self.base_url = base_url.rstrip("/")

    def auth_methods(self) -> list[dict[str, Any]]:
        return [{"type": "api_key", "label": "API key", "required": True}]

    def _headers(self, credentials: dict[str, Any]) -> dict[str, str]:
        api_key = str(credentials.get("api_key", ""))
        return {"Authorization": f"Bearer {api_key}"} if api_key else {}

    def _base_url(self, credentials: dict[str, Any]) -> str:
        value = str(credentials.get("base_url") or self.base_url).rstrip("/")
        if not value:
            raise ValueError("Provider base URL is required.")
        return value

    async def authenticate(self, credentials: dict[str, Any]) -> dict[str, Any]:
        await self.fetch_models(credentials)
        return {"authenticated": True, "provider_id": self.provider_id}

    async def fetch_models(self, credentials: dict[str, Any]) -> list[ProviderModelInfo]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"{self._base_url(credentials)}/models", headers=self._headers(credentials))
        response.raise_for_status()
        data = response.json()
        raw = data.get("data", data.get("models", data if isinstance(data, list) else []))
        if not isinstance(raw, list):
            raise RuntimeError("Provider model endpoint did not return a model list.")
        from app.providers.catalog import normalize_model_catalog
        return normalize_model_catalog(raw, provider_id=self.provider_id)

    async def test_model(self, credentials: dict[str, Any], model_id: str) -> dict[str, Any]:
        response = await self.generate(
            credentials, model_id,
            [{"role": "user", "content": 'Return only this JSON: {"ok":true}'}],
            temperature=0, max_tokens=32,
            response_format={"type": "json_object"},
        )
        import json
        payload = json.loads(response["content"])
        return {
            "model_id": model_id,
            "provider_id": self.provider_id,
            "authentication_ok": True,
            "routing_ok": True,
            "json_valid": isinstance(payload, dict),
            "required_fields_present": payload.get("ok") is True,
        }

    async def generate(
        self, credentials: dict[str, Any], model_id: str, messages: list[dict[str, str]],
        *, temperature: float = 0.4, max_tokens: int = 4000,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model_id, "messages": messages,
            "temperature": temperature, "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self._base_url(credentials)}/chat/completions",
                headers=self._headers(credentials), json=payload,
            )
        response.raise_for_status()
        data = response.json()
        return {"content": data["choices"][0]["message"]["content"], "model": data.get("model", model_id)}


class OllamaAdapter(OpenAICompatibleAdapter):
    provider_id = "ollama"
    display_name = "Ollama"

    def __init__(self) -> None:
        super().__init__(base_url="http://127.0.0.1:11434/v1")


class LMStudioAdapter(OpenAICompatibleAdapter):
    provider_id = "lm_studio"
    display_name = "LM Studio"

    def __init__(self) -> None:
        super().__init__(base_url="http://127.0.0.1:1234/v1")


ADAPTERS: dict[str, ProviderAdapter] = {
    "openrouter": OpenRouterAdapter(),
    "opencode_zen": OpenAICompatibleAdapter(
        provider_id="opencode_zen", display_name="OpenCode Zen",
        base_url="https://opencode.ai/zen/v1",
    ),
    "opencode_go": OpenAICompatibleAdapter(
        provider_id="opencode_go", display_name="OpenCode Go",
        base_url="https://opencode.ai/zen/go/v1",
    ),
    "openai_compatible": OpenAICompatibleAdapter(),
    "ollama": OllamaAdapter(),
    "lm_studio": LMStudioAdapter(),
}


def get_adapter(provider_id: str) -> ProviderAdapter | None:
    return ADAPTERS.get(provider_id)
