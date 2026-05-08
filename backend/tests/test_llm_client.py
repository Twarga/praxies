from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.llm_client import LlmClientError, LiteLLMClient, OPENCODE_GO_BASE_URL


def _response(content: str = '{"ok": true}'):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def test_openrouter_request_uses_legacy_config_when_llm_key_is_empty(config):
    captured = {}

    def completion(**kwargs):
        captured.update(kwargs)
        return _response()

    config.openrouter.api_key = "sk-or-test"
    config.llm.api_key = ""
    client = LiteLLMClient(completion_fn=completion)

    assert client.complete_json(config=config, system_prompt="system", user_message="user") == '{"ok": true}'
    assert captured["model"] == "openrouter/google/gemini-2.5-flash-lite"
    assert captured["api_key"] == "sk-or-test"
    assert captured["response_format"] == {"type": "json_object"}


def test_opencode_go_request_uses_openai_compatible_endpoint(config):
    captured = {}

    def completion(**kwargs):
        captured.update(kwargs)
        return _response()

    config.llm.provider = "opencode_go"
    config.llm.api_key = "opencode-test"
    config.llm.model = "glm-5.1"
    client = LiteLLMClient(completion_fn=completion)

    client.complete_json(config=config, system_prompt="system", user_message="user")

    assert captured["model"] == "openai/glm-5.1"
    assert captured["api_base"] == OPENCODE_GO_BASE_URL
    assert captured["api_key"] == "opencode-test"


def test_openai_compatible_requires_base_url(config):
    config.llm.provider = "openai_compatible"
    config.llm.api_key = "test-key"
    config.llm.base_url = ""
    client = LiteLLMClient(completion_fn=lambda **_kwargs: _response())

    with pytest.raises(LlmClientError, match="base URL is missing"):
        client.complete_json(config=config, system_prompt="system", user_message="user")


def test_retries_without_response_format_when_provider_rejects_it(config):
    calls = []

    def completion(**kwargs):
        calls.append(kwargs)
        if "response_format" in kwargs:
            raise RuntimeError("response_format unsupported")
        return _response()

    config.openrouter.api_key = "sk-or-test"
    client = LiteLLMClient(completion_fn=completion)

    client.complete_json(config=config, system_prompt="system", user_message="user")

    assert len(calls) == 2
    assert "response_format" in calls[0]
    assert "response_format" not in calls[1]


def test_openai_compatible_retries_without_response_format_when_content_is_empty(config):
    calls = []

    def completion(**kwargs):
        calls.append(kwargs)
        if "response_format" in kwargs:
            return _response("")
        return _response()

    config.llm.provider = "opencode_go"
    config.llm.api_key = "opencode-test"
    config.llm.model = "deepseek-v4-pro"
    client = LiteLLMClient(completion_fn=completion)

    assert client.complete_json(config=config, system_prompt="system", user_message="user") == '{"ok": true}'
    assert len(calls) == 2
    assert "response_format" in calls[0]
    assert "response_format" not in calls[1]
