"""Provider state persistence.

Stored separately from main config until full v2 migration.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.settings import PATHS
from app.services.json_io import read_json_file, write_json_file

PROVIDER_STATE_PATH = PATHS.config_dir / "providers.json"


def load_provider_state() -> dict[str, Any]:
    if not PROVIDER_STATE_PATH.exists():
        return {
            "connections": {},
            "active_connection_id": None,
        }
    return read_json_file(PROVIDER_STATE_PATH)


def save_provider_state(state: dict[str, Any]) -> Path:
    return write_json_file(PROVIDER_STATE_PATH, state)


def get_connection(connection_id: str) -> dict[str, Any] | None:
    state = load_provider_state()
    return state.get("connections", {}).get(connection_id)


def list_connections() -> dict[str, Any]:
    return load_provider_state().get("connections", {})


def set_connection(connection_id: str, data: dict[str, Any]) -> dict[str, Any]:
    state = load_provider_state()
    state.setdefault("connections", {})[connection_id] = data
    save_provider_state(state)
    return data


def delete_connection(connection_id: str) -> bool:
    state = load_provider_state()
    if connection_id not in state.get("connections", {}):
        return False
    del state["connections"][connection_id]
    if state.get("active_connection_id") == connection_id:
        state["active_connection_id"] = None
    save_provider_state(state)
    return True


def get_active_connection_id() -> str | None:
    state = load_provider_state()
    connections = state.get("connections", {})
    active_id = state.get("active_connection_id")
    active = connections.get(active_id) if active_id else None
    if active and active.get("enabled", True) and active.get("selected_model_id"):
        return active_id

    fallback_id = next(
        (
            connection_id
            for connection_id, connection in connections.items()
            if connection.get("enabled", True) and connection.get("selected_model_id")
        ),
        None,
    )
    if fallback_id != active_id:
        state["active_connection_id"] = fallback_id
        save_provider_state(state)
    return fallback_id


def set_active_connection_id(connection_id: str | None) -> None:
    state = load_provider_state()
    state["active_connection_id"] = connection_id
    save_provider_state(state)
