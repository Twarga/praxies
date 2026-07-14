"""Provider registry.

Returns capabilities so the UI renders fields from provider behavior
rather than `if provider === ...` branches.
"""

from __future__ import annotations

from app.models.schemas import ProviderAdapterInfo, ProviderAuthMethod, ProviderCapabilities


REGISTRY: dict[str, ProviderAdapterInfo] = {
    "openrouter": ProviderAdapterInfo(
        provider_id="openrouter",
        display_name="OpenRouter",
        auth_methods=[
            ProviderAuthMethod(type="api_key", label="API key", required=True),
        ],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
            supports_usage_endpoint=True,
        ),
        requires_base_url=False,
        available=True,
    ),
    "opencode_go": ProviderAdapterInfo(
        provider_id="opencode_go",
        display_name="OpenCode Go",
        auth_methods=[
            ProviderAuthMethod(type="api_key", label="API key", required=True),
        ],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
            supports_structured_output=True,
        ),
        requires_base_url=False,
        available=True,
    ),
    "opencode_zen": ProviderAdapterInfo(
        provider_id="opencode_zen",
        display_name="OpenCode Zen",
        auth_methods=[
            ProviderAuthMethod(type="api_key", label="API key or credit key", required=True),
        ],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
            supports_usage_endpoint=True,
        ),
        requires_base_url=False,
        available=True,
    ),
    "openai_compatible": ProviderAdapterInfo(
        provider_id="openai_compatible",
        display_name="OpenAI-compatible",
        auth_methods=[
            ProviderAuthMethod(type="api_key", label="API key", required=True),
        ],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
        ),
        requires_base_url=True,
        available=True,
    ),
    "ollama": ProviderAdapterInfo(
        provider_id="ollama",
        display_name="Ollama",
        auth_methods=[],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
            supports_structured_output=True,
        ),
        requires_base_url=True,
        available=True,
    ),
    "lm_studio": ProviderAdapterInfo(
        provider_id="lm_studio",
        display_name="LM Studio",
        auth_methods=[],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
        ),
        requires_base_url=True,
        available=True,
    ),
    "litellm_proxy": ProviderAdapterInfo(
        provider_id="litellm_proxy",
        display_name="LiteLLM proxy",
        auth_methods=[],
        capabilities=ProviderCapabilities(
            supports_catalog_endpoint=True,
        ),
        requires_base_url=True,
        available=True,
    ),
}


def get_provider(provider_id: str) -> ProviderAdapterInfo | None:
    return REGISTRY.get(provider_id)


def list_providers() -> list[ProviderAdapterInfo]:
    return list(REGISTRY.values())


def provider_exists(provider_id: str) -> bool:
    return provider_id in REGISTRY


def validate_provider_id(provider_id: str) -> bool:
    """Return True if the provider_id is registered. Used instead of Literal checks."""
    return provider_id in REGISTRY


def list_available_providers() -> list[ProviderAdapterInfo]:
    return [p for p in REGISTRY.values() if p.available]
