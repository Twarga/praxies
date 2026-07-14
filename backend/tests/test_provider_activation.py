"""Provider activation invariants and recovery behavior."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import providers as providers_api
from app.models.schemas import TestProviderModelRequest as ProviderModelTestRequest
from app.models.schemas import CreateProviderConnectionRequest
from app.models.schemas import UpdateProviderConnectionRequest
from app.providers import state as provider_state


def test_invalid_active_pointer_falls_back_to_configured_connection(tmp_path, monkeypatch):
    state_path = tmp_path / "providers.json"
    state_path.write_text(json.dumps({
        "active_connection_id": "zen-without-model",
        "connections": {
            "working-go": {
                "provider_id": "opencode_go",
                "selected_model_id": "deepseek-v4-flash",
                "enabled": True,
            },
            "zen-without-model": {
                "provider_id": "opencode_zen",
                "selected_model_id": "",
                "enabled": True,
            },
        },
    }))
    monkeypatch.setattr(provider_state, "PROVIDER_STATE_PATH", state_path)

    assert provider_state.get_active_connection_id() == "working-go"
    assert json.loads(state_path.read_text())["active_connection_id"] == "working-go"


def test_new_connection_does_not_replace_active_provider(monkeypatch):
    saved = {}

    class FakeAdapter:
        async def authenticate(self, _credentials):
            return {"authenticated": True}

    monkeypatch.setattr(providers_api, "get_provider", lambda _provider_id: SimpleNamespace(display_name="OpenCode Zen"))
    monkeypatch.setattr(providers_api, "get_adapter", lambda _provider_id: FakeAdapter())
    monkeypatch.setattr(providers_api, "store_secret", lambda *_args, **_kwargs: "secret-id")
    monkeypatch.setattr(providers_api, "set_connection", lambda connection_id, value: saved.update({connection_id: value}))
    monkeypatch.setattr(providers_api, "get_active_connection_id", lambda: "working-go")
    monkeypatch.setattr(providers_api, "set_active_connection_id", lambda _connection_id: pytest.fail("unverified connection replaced the active provider"))

    result = asyncio.run(providers_api.create_connection(CreateProviderConnectionRequest(
        provider_id="opencode_zen",
        api_key="test-key",
    )))

    assert result["provider_id"] == "opencode_zen"
    assert result["active"] is False
    assert next(iter(saved.values()))["selected_model_id"] == ""


def test_external_credential_reuse_routes_are_not_registered():
    from app.main import app

    paths = {route.path for route in app.routes}
    assert "/api/providers/detected-credentials" not in paths
    assert "/api/providers/import-preview" not in paths
    assert "/api/providers/import" not in paths


def test_unverified_model_cannot_be_activated(monkeypatch):
    connection = {
        "provider_id": "opencode_zen",
        "selected_model_id": "claude-sonnet-4-6",
        "verified_model_id": "",
        "enabled": True,
    }
    monkeypatch.setattr(providers_api, "get_connection", lambda _connection_id: connection)
    monkeypatch.setattr(providers_api, "set_connection", lambda *_args: None)
    monkeypatch.setattr(providers_api, "set_active_connection_id", lambda _connection_id: pytest.fail("unverified connection activated"))

    with pytest.raises(HTTPException) as error:
        asyncio.run(providers_api.update_connection("zen", UpdateProviderConnectionRequest(active=True)))

    assert error.value.status_code == 409
    assert "MODEL_NOT_VERIFIED" in str(error.value.detail)


def test_successful_model_test_records_verification(monkeypatch):
    connection = {
        "provider_id": "opencode_zen",
        "selected_model_id": "claude-sonnet-4-6",
        "auth_profile_id": "",
        "base_url": "",
        "enabled": True,
    }
    saved = {}

    class FakeAdapter:
        async def test_model(self, _credentials, model_id):
            return {"model_id": model_id, "routing_ok": True}

    monkeypatch.setattr(providers_api, "get_connection", lambda _connection_id: connection)
    monkeypatch.setattr(providers_api, "get_adapter", lambda _provider_id: FakeAdapter())
    monkeypatch.setattr(providers_api, "set_connection", lambda connection_id, value: saved.update({connection_id: dict(value)}))

    result = asyncio.run(providers_api.test_connection_model(
        "zen",
        ProviderModelTestRequest(model_id="claude-sonnet-4-6"),
    ))

    assert result["verified"] is True
    assert saved["zen"]["verified_model_id"] == "claude-sonnet-4-6"
