"""Provider registry and catalog tests."""

from __future__ import annotations

from app.providers.registry import (
    get_provider,
    list_available_providers,
    list_providers,
    provider_exists,
    validate_provider_id,
)
from app.providers.catalog import (
    catalog_is_stale,
    find_model_in_catalog,
    normalize_model_catalog,
    normalize_model_entry,
    read_catalog_cache,
    write_catalog_cache,
)


class TestRegistry:
    def test_lists_all_providers(self):
        providers = list_providers()
        assert len(providers) >= 7

    def test_known_providers_exist(self):
        for pid in ["openrouter", "opencode_go", "opencode_zen", "openai_compatible", "ollama", "lm_studio", "litellm_proxy"]:
            assert provider_exists(pid), f"Missing provider: {pid}"
            assert get_provider(pid) is not None

    def test_unknown_provider_returns_none(self):
        assert get_provider("nonexistent") is None

    def test_validate_rejects_unknown(self):
        assert not validate_provider_id("random_string_123")

    def test_validate_accepts_registered(self):
        assert validate_provider_id("openrouter")

    def test_every_provider_has_display_name(self):
        for provider in list_providers():
            assert provider.display_name
            assert provider.provider_id

    def test_available_providers_all_enabled(self):
        available = list_available_providers()
        assert all(p.available for p in available)

    def test_auth_methods_have_type_and_label(self):
        for provider in list_providers():
            for method in provider.auth_methods:
                assert method.type
                assert method.label


class TestCatalogNormalization:
    RAW_ENTRY = {
        "id": "openai/gpt-5.1-mini",
        "name": "GPT-5.1 Mini",
        "context_length": 128000,
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"],
        "pricing": {"prompt": "0.15", "completion": "0.60"},
    }

    def test_normalizes_basic_entry(self):
        model = normalize_model_entry(self.RAW_ENTRY, provider_id="openrouter")
        assert model.id == "openai/gpt-5.1-mini"
        assert model.display_name == "GPT-5.1 Mini"
        assert model.context_window == 128000
        assert model.provider_id == "openrouter"
        assert model.source == "provider_authenticated_catalog"
        assert model.fetched_at

    def test_missing_fields_stay_unknown(self):
        model = normalize_model_entry({"id": "test-model"}, provider_id="test")
        assert model.context_window is None
        assert model.supports_structured_output == "unknown"
        assert model.availability == "available"

    def test_does_not_invent_pricing(self):
        model = normalize_model_entry({"id": "test-model"}, provider_id="test")
        assert model.pricing is None

    def test_normalizes_bulk_catalog(self):
        raw = [{"id": "a"}, {"id": "b", "name": "B"}]
        models = normalize_model_catalog(raw, provider_id="test")
        assert len(models) == 2
        assert models[0].provider_id == "test"


class TestCatalogCache:
    def test_write_and_read_roundtrip(self, tmp_path):
        import app.providers.catalog as catalog_mod
        original = catalog_mod.get_catalog_cache_path
        catalog_mod.get_catalog_cache_path = lambda cid: tmp_path / f"{cid}.json"

        try:
            models = normalize_model_catalog(
                [{"id": "m1"}, {"id": "m2"}],
                provider_id="test",
            )
            write_catalog_cache("conn-1", models)
            cached = read_catalog_cache("conn-1")
            assert cached is not None
            assert len(cached) == 2
            assert cached[0].id == "m1"
        finally:
            catalog_mod.get_catalog_cache_path = original

    def test_stale_detection_with_no_cache(self, tmp_path):
        import app.providers.catalog as catalog_mod
        original = catalog_mod.get_catalog_cache_path
        catalog_mod.get_catalog_cache_path = lambda cid: tmp_path / f"{cid}.json"
        try:
            assert catalog_is_stale("nonexistent")
        finally:
            catalog_mod.get_catalog_cache_path = original

    def test_empty_cache_returns_none(self, tmp_path):
        import app.providers.catalog as catalog_mod
        original = catalog_mod.get_catalog_cache_path
        catalog_mod.get_catalog_cache_path = lambda cid: tmp_path / f"{cid}.json"
        try:
            result = read_catalog_cache("empty")
            assert result is None
        finally:
            catalog_mod.get_catalog_cache_path = original


class TestFindModel:
    def test_finds_existing_model(self):
        models = normalize_model_catalog(
            [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}],
            provider_id="test",
        )
        found = find_model_in_catalog(models, "m2")
        assert found is not None
        assert found.id == "m2"

    def test_returns_none_for_missing(self):
        models = normalize_model_catalog([{"id": "m1"}], provider_id="test")
        assert find_model_in_catalog(models, "missing") is None
