from __future__ import annotations

from typing import Any

from app.models import ConfigModel


class OpenRouterClientError(RuntimeError):
    pass


class LiteLLMOpenRouterClient:
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
        if not config.openrouter.api_key:
            raise OpenRouterClientError("OpenRouter API key is missing.")

        completion = self._get_completion_fn()
        response = completion(
            model=f"openrouter/{model_id or config.openrouter.default_model}",
            api_key=config.openrouter.api_key,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = self._extract_response_content(response)
        if not content:
            raise OpenRouterClientError("LLM response did not contain any message content.")

        return content

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
