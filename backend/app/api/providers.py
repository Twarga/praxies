"""Provider connections, live catalogs, model selection, and compatibility tests."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CreateProviderConnectionRequest,
    UpdateProviderConnectionRequest,
    TestProviderModelRequest,
)
from app.providers.adapters import get_adapter
from app.providers.catalog import read_catalog_cache, write_catalog_cache
from app.providers.registry import get_provider, list_available_providers
from app.providers.state import (
    delete_connection,
    get_active_connection_id,
    get_connection,
    list_connections,
    set_active_connection_id,
    set_connection,
)
from app.storage.secrets import delete_secret, read_secret, store_secret

router = APIRouter(prefix="/api/providers", tags=["providers"])


def _public_connection(connection_id: str, connection: dict[str, Any]) -> dict[str, Any]:
    selected_model_id = str(connection.get("selected_model_id", ""))
    return {
        "id": connection_id,
        "provider_id": connection.get("provider_id", ""),
        "display_name": connection.get("display_name", ""),
        "selected_model_id": selected_model_id,
        "base_url": connection.get("base_url", ""),
        "catalog_updated_at": connection.get("catalog_updated_at"),
        "enabled": connection.get("enabled", True),
        "active": connection_id == get_active_connection_id(),
        "verified": bool(selected_model_id and connection.get("verified_model_id") == selected_model_id),
        "configured": bool(connection.get("auth_profile_id") or connection.get("provider_id") in {"ollama", "lm_studio"}),
    }


def _credentials(connection: dict[str, Any]) -> dict[str, Any]:
    result = {"base_url": connection.get("base_url", "")}
    secret_id = str(connection.get("auth_profile_id", ""))
    if secret_id:
        secret = read_secret(secret_id)
        if secret is None:
            raise HTTPException(status_code=409, detail="AUTH_EXPIRED: Stored credential is unavailable.")
        result["api_key"] = secret
    return result


@router.get("")
async def get_all_providers() -> list[dict[str, object]]:
    return [provider.model_dump(mode="json") for provider in list_available_providers()]


@router.get("/connections")
async def get_connections() -> list[dict[str, Any]]:
    return [_public_connection(cid, value) for cid, value in list_connections().items()]


@router.post("/connections")
async def create_connection(payload: CreateProviderConnectionRequest) -> dict[str, Any]:
    provider_id = payload.provider_id.strip()
    provider = get_provider(provider_id)
    adapter = get_adapter(provider_id)
    if provider is None or adapter is None:
        raise HTTPException(status_code=400, detail="Unsupported provider.")

    api_key = payload.api_key.strip()
    base_url = payload.base_url.strip()
    credentials = {"api_key": api_key, "base_url": base_url}
    try:
        await adapter.authenticate(credentials)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"AUTH_FAILED: {error}") from error

    secret_id = ""
    if api_key:
        secret_id = store_secret(
            api_key,
            provider_id=provider_id,
            account_label=payload.display_name or provider.display_name,
        )
    connection_id = str(uuid.uuid4())
    connection = {
        "provider_id": provider_id,
        "display_name": payload.display_name or provider.display_name,
        "auth_profile_id": secret_id,
        "selected_model_id": "",
        "base_url": base_url,
        "catalog_updated_at": None,
        "enabled": True,
    }
    set_connection(connection_id, connection)
    return _public_connection(connection_id, connection)


@router.get("/connections/{connection_id}/models")
async def get_connection_models(connection_id: str) -> dict[str, Any]:
    connection = get_connection(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    cached = read_catalog_cache(connection_id)
    if cached is None:
        return await refresh_connection_models(connection_id)
    return {"connection_id": connection_id, "models": [m.model_dump(mode="json") for m in cached], "cached": True}


@router.post("/connections/{connection_id}/refresh-models")
async def refresh_connection_models(connection_id: str) -> dict[str, Any]:
    connection = get_connection(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    adapter = get_adapter(str(connection.get("provider_id", "")))
    if adapter is None:
        raise HTTPException(status_code=400, detail="Provider adapter is unavailable.")
    try:
        models = await adapter.fetch_models(_credentials(connection))
    except Exception as error:
        cached = read_catalog_cache(connection_id)
        if cached:
            return {
                "connection_id": connection_id,
                "models": [m.model_dump(mode="json") for m in cached],
                "cached": True,
                "stale": True,
                "refresh_error": str(error),
            }
        raise HTTPException(status_code=502, detail=f"CATALOG_UNAVAILABLE: {error}") from error
    write_catalog_cache(connection_id, models)
    connection["catalog_updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    set_connection(connection_id, connection)
    return {"connection_id": connection_id, "models": [m.model_dump(mode="json") for m in models], "cached": False}


@router.patch("/connections/{connection_id}")
async def update_connection(connection_id: str, payload: UpdateProviderConnectionRequest) -> dict[str, Any]:
    connection = get_connection(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    if payload.selected_model_id is not None:
        model_id = payload.selected_model_id
        cached = read_catalog_cache(connection_id) or []
        if model_id and all(model.id != model_id for model in cached):
            raise HTTPException(status_code=409, detail="MODEL_NOT_IN_CATALOG: Refresh and choose an available model.")
        if model_id != connection.get("selected_model_id"):
            connection["verified_model_id"] = ""
        connection["selected_model_id"] = model_id
    if payload.display_name is not None:
        connection["display_name"] = payload.display_name
    set_connection(connection_id, connection)
    if payload.active is True:
        model_id = str(connection.get("selected_model_id") or "")
        if not model_id:
            raise HTTPException(status_code=409, detail="MODEL_NOT_SELECTED: Choose a provider model first.")
        if connection.get("verified_model_id") != model_id:
            raise HTTPException(status_code=409, detail="MODEL_NOT_VERIFIED: Test the selected model before activating it.")
        set_active_connection_id(connection_id)
    return _public_connection(connection_id, connection)


@router.post("/connections/{connection_id}/test")
async def test_connection_model(connection_id: str, payload: TestProviderModelRequest | None = None) -> dict[str, Any]:
    connection = get_connection(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    model_id = (payload.model_id if payload else "") or str(connection.get("selected_model_id") or "")
    if not model_id:
        raise HTTPException(status_code=400, detail="MODEL_NOT_SELECTED: Select a catalog model first.")
    adapter = get_adapter(str(connection.get("provider_id", "")))
    if adapter is None:
        raise HTTPException(status_code=400, detail="Provider adapter is unavailable.")
    try:
        result = await adapter.test_model(_credentials(connection), model_id)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"MODEL_TEST_FAILED: {error}") from error
    connection["selected_model_id"] = model_id
    connection["verified_model_id"] = model_id
    connection["last_tested_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    set_connection(connection_id, connection)
    return {**result, "verified": True}


@router.delete("/connections/{connection_id}")
async def remove_connection(connection_id: str) -> dict[str, Any]:
    connection = get_connection(connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    secret_id = str(connection.get("auth_profile_id", ""))
    if secret_id:
        delete_secret(secret_id)
    delete_connection(connection_id)
    return {"deleted": True, "connection_id": connection_id}


@router.get("/{provider_id}")
async def get_provider_detail(provider_id: str) -> dict[str, object]:
    provider = get_provider(provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found.")
    return provider.model_dump(mode="json")
