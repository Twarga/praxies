from __future__ import annotations

from typing import Any
import asyncio

from app.models import ConfigModel


OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1"


class LlmClientError(RuntimeError):
    pass


OpenRouterClientError = LlmClientError


def get_active_llm_model(config: ConfigModel) -> str:
    if config.llm.provider == "openrouter" and not config.llm.model:
        return config.openrouter.default_model
    return config.llm.provider_models.get(config.llm.provider) or config.llm.model


def get_active_llm_label(config: ConfigModel) -> str:
    provider_labels = {
        "openrouter": "OpenRouter",
        "opencode_go": "OpenCode Go",
        "openai_compatible": "OpenAI-compatible",
        "litellm_proxy": "LiteLLM proxy",
    }
    provider = provider_labels.get(config.llm.provider, config.llm.provider)
    model = get_active_llm_model(config)
    return f"{provider} / {model}" if model else provider


def get_llm_provider_options() -> dict[str, object]:
    return {
        "providers": [
            {
                "id": "openrouter",
                "label": "OpenRouter",
                "description": "OpenRouter account and model catalog.",
                "requires_base_url": False,
            },
            {
                "id": "opencode_go",
                "label": "OpenCode Go",
                "description": "OpenCode Go subscription endpoint using an OpenAI-compatible API.",
                "requires_base_url": False,
                "base_url": OPENCODE_GO_BASE_URL,
            },
            {
                "id": "openai_compatible",
                "label": "OpenAI-compatible",
                "description": "Any API that supports /v1/chat/completions.",
                "requires_base_url": True,
            },
            {
                "id": "litellm_proxy",
                "label": "LiteLLM proxy",
                "description": "A self-hosted LiteLLM proxy endpoint.",
                "requires_base_url": True,
            },
        ],
    }


class LiteLLMClient:
    def __init__(self, completion_fn: Any | None = None) -> None:
        self._completion_fn = completion_fn

    def analyze_session(
        self,
        *,
        config: ConfigModel,
        system_prompt: str,
        user_message: str,
        model_id: str | None = None,
    ) -> str:
        return self.complete_json(
            config=config,
            system_prompt=system_prompt,
            user_message=user_message,
            model_id=model_id,
            temperature=0.4,
            max_tokens=4000,
        )

    def complete_json(
        self,
        *,
        config: ConfigModel,
        system_prompt: str,
        user_message: str,
        model_id: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> str:
        managed_content = self._complete_with_provider_connection(
            system_prompt=system_prompt,
            user_message=user_message,
            model_id=model_id,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if managed_content is not None:
            return managed_content

        completion = self._get_completion_fn()
        request = self._build_request(
            config=config,
            model_id=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        try:
            response = completion(response_format={"type": "json_object"}, **request)
            content = self._extract_response_content(response)
        except Exception as error:  # noqa: BLE001
            if not _looks_like_response_format_error(error):
                raise
            response = completion(**request)
            content = self._extract_response_content(response)
        if not content and config.llm.provider != "openrouter":
            response = completion(**request)
            content = self._extract_response_content(response)
        if not content:
            raise LlmClientError("LLM response did not contain any message content.")

        return content

    def _complete_with_provider_connection(
        self, *, system_prompt: str, user_message: str, model_id: str | None,
        temperature: float, max_tokens: int,
    ) -> str | None:
        """Use the active v2 provider connection when one is configured."""
        from app.providers.adapters import get_adapter
        from app.providers.state import get_active_connection_id, get_connection
        from app.storage.secrets import read_secret

        connection_id = get_active_connection_id()
        if not connection_id:
            return None
        connection = get_connection(connection_id)
        if not connection:
            return None
        adapter = get_adapter(str(connection.get("provider_id", "")))
        selected_model = model_id or str(connection.get("selected_model_id", ""))
        if adapter is None or not selected_model:
            raise LlmClientError("Active provider connection or model is unavailable.")
        credentials = {"base_url": connection.get("base_url", "")}
        secret_id = str(connection.get("auth_profile_id", ""))
        if secret_id:
            secret = read_secret(secret_id)
            if secret is None:
                raise LlmClientError("Stored provider credential is unavailable.")
            credentials["api_key"] = secret
        result = asyncio.run(adapter.generate(
            credentials,
            selected_model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        ))
        content = str(result.get("content", ""))
        if not content:
            raise LlmClientError("Provider response did not contain message content.")
        return content

    def _build_request(
        self,
        *,
        config: ConfigModel,
        model_id: str | None,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        provider = config.llm.provider
        selected_model = model_id or get_active_llm_model(config)
        api_key = config.llm.provider_api_keys.get(provider) or config.llm.api_key
        api_base = (config.llm.provider_base_urls.get(provider) or config.llm.base_url).strip().rstrip("/")

        if provider == "openrouter":
            selected_model = selected_model or config.openrouter.default_model
            api_key = config.llm.provider_api_keys.get("openrouter") or config.openrouter.api_key
            if not api_key:
                raise LlmClientError("OpenRouter API key is missing.")
            model = f"openrouter/{selected_model}"
        elif provider == "opencode_go":
            if not api_key:
                raise LlmClientError("OpenCode Go API key is missing.")
            if not selected_model:
                raise LlmClientError("No model selected for OpenCode Go.")
            model = f"openai/{selected_model}"
            api_base = OPENCODE_GO_BASE_URL
        elif provider == "openai_compatible":
            if not api_key:
                raise LlmClientError("OpenAI-compatible API key is missing.")
            if not api_base:
                raise LlmClientError("OpenAI-compatible base URL is missing.")
            model = f"openai/{selected_model}"
        elif provider == "litellm_proxy":
            if not api_base:
                raise LlmClientError("LiteLLM proxy base URL is missing.")
            model = selected_model
        else:
            raise LlmClientError(f"Unsupported LLM provider: {provider}.")

        request: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if api_key:
            request["api_key"] = api_key
        if api_base:
            request["api_base"] = api_base
        return request

    def _get_completion_fn(self) -> Any:
        if self._completion_fn is not None:
            return self._completion_fn

        from litellm import completion

        return completion

    @staticmethod
    def _extract_response_content(response: Any) -> str:
        choices = getattr(response, "choices", None)
        if not choices:
            return ""

        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        if message is None and isinstance(first_choice, dict):
            message = first_choice.get("message")

        if isinstance(message, dict):
            return str(message.get("content", "") or "")

        return str(getattr(message, "content", "") or "")


def _looks_like_response_format_error(error: Exception) -> bool:
    message = str(error).lower()
    return "response_format" in message and (
        "unsupported" in message
        or "not support" in message
        or "invalid" in message
        or "unknown" in message
    )


LiteLLMOpenRouterClient = LiteLLMClient
