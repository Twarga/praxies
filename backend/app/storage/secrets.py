"""Linux Secret Service storage for provider credentials.

Wraps the secretstorage / libsecret D-Bus API.
Falls back to a simple encrypted file if the keyring is unavailable,
so development and headless environments still function.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.settings import PATHS

COLLECTION_LABEL = "praxis"
FALLBACK_FILE = PATHS.config_dir / "secrets.json"
FALLBACK_KEY_FILE = PATHS.config_dir / "secrets.key"


def _keyring_available() -> bool:
    try:
        import secretstorage
        connection = secretstorage.dbus_init()
        collection = secretstorage.get_default_collection(connection)
        return collection is not None and not collection.is_locked()
    except Exception:
        return False


def _encrypt_simple(value: str, key: bytes | None = None) -> str:
    from cryptography.fernet import Fernet
    import base64
    key_bytes = key or _machine_key()
    return Fernet(base64.urlsafe_b64encode(key_bytes)).encrypt(value.encode("utf-8")).decode("ascii")


def _decrypt_simple(encoded: str, key: bytes | None = None) -> str:
    from cryptography.fernet import Fernet
    import base64
    key_bytes = key or _machine_key()
    return Fernet(base64.urlsafe_b64encode(key_bytes)).decrypt(encoded.encode("ascii")).decode("utf-8")


def _machine_key() -> bytes:
    """Return a random per-user key protected by restrictive file permissions."""
    if FALLBACK_KEY_FILE.exists():
        key = FALLBACK_KEY_FILE.read_bytes()
        if len(key) == 32:
            return key
    FALLBACK_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    key = os.urandom(32)
    descriptor = os.open(FALLBACK_KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(descriptor, key)
    finally:
        os.close(descriptor)
    return key


def _read_fallback_store() -> dict[str, Any]:
    if not FALLBACK_FILE.exists():
        return {"secrets": {}}
    try:
        return json.loads(FALLBACK_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"secrets": {}}


def _write_fallback_store(store: dict[str, Any]) -> None:
    FALLBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(store, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    descriptor = os.open(FALLBACK_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(descriptor, payload)
    finally:
        os.close(descriptor)


def store_secret(
    secret_value: str,
    *,
    provider_id: str = "",
    account_label: str = "",
    auth_type: str = "api_key",
    import_source: str = "",
) -> str:
    """Store a secret. Returns the secret ID for config reference."""
    secret_id = str(uuid.uuid4())

    if _keyring_available():
        return _store_keyring(secret_id, secret_value, provider_id, account_label)

    return _store_fallback(secret_id, secret_value, provider_id, account_label, auth_type, import_source)


def read_secret(secret_id: str) -> str | None:
    if _keyring_available():
        return _read_keyring(secret_id)

    return _read_fallback(secret_id)


def delete_secret(secret_id: str) -> bool:
    if _keyring_available():
        return _delete_keyring(secret_id)

    return _delete_fallback(secret_id)


def list_secrets() -> list[dict[str, Any]]:
    if _keyring_available():
        return _list_keyring()

    return _list_fallback()


def _store_keyring(secret_id: str, value: str, provider_id: str, account_label: str) -> str:
    import secretstorage

    connection = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(connection)

    attributes = {
        "application": "praxis",
        "secret_id": secret_id,
        "provider_id": provider_id,
    }
    label = f"Praxis: {provider_id}" if provider_id else f"Praxis secret {secret_id[:8]}"

    item = collection.create_item(
        label=label,
        attributes=attributes,
        secret=value.encode("utf-8"),
        replace=True,
    )

    return secret_id


def _read_keyring(secret_id: str) -> str | None:
    import secretstorage

    connection = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(connection)

    for item in collection.get_all_items():
        attrs = item.get_attributes()
        if attrs.get("secret_id") == secret_id:
            return item.get_secret().decode("utf-8")

    return None


def _delete_keyring(secret_id: str) -> bool:
    import secretstorage

    connection = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(connection)

    for item in collection.get_all_items():
        if item.get_attributes().get("secret_id") == secret_id:
            item.delete()
            return True

    return False


def _list_keyring() -> list[dict[str, Any]]:
    import secretstorage

    connection = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(connection)

    results = []
    for item in collection.get_all_items():
        attrs = item.get_attributes()
        if attrs.get("application") == "praxis":
            results.append({
                "secret_id": attrs.get("secret_id", "unknown"),
                "provider_id": attrs.get("provider_id", ""),
                "label": item.get_label(),
            })

    return results


def _store_fallback(
    secret_id: str,
    value: str,
    provider_id: str,
    account_label: str,
    auth_type: str,
    import_source: str,
) -> str:
    store = _read_fallback_store()
    store["secrets"][secret_id] = {
        "value": _encrypt_simple(value),
        "provider_id": provider_id,
        "account_label": account_label,
        "auth_type": auth_type,
        "import_source": import_source,
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    _write_fallback_store(store)
    return secret_id


def _read_fallback(secret_id: str) -> str | None:
    store = _read_fallback_store()
    entry = store.get("secrets", {}).get(secret_id)
    if not entry:
        return None
    try:
        return _decrypt_simple(entry["value"])
    except Exception:
        # One-time compatibility for the pre-Fernet development store.
        import base64
        machine_id = Path("/etc/machine-id")
        if not machine_id.exists():
            return None
        key = machine_id.read_text().strip()[:32].encode("utf-8")
        encrypted = base64.b64decode(entry["value"])
        return bytes(value ^ key[index % len(key)] for index, value in enumerate(encrypted)).decode("utf-8")


def _delete_fallback(secret_id: str) -> bool:
    store = _read_fallback_store()
    if secret_id not in store.get("secrets", {}):
        return False
    del store["secrets"][secret_id]
    _write_fallback_store(store)
    return True


def _list_fallback() -> list[dict[str, Any]]:
    store = _read_fallback_store()
    return [
        {
            "secret_id": sid,
            "provider_id": entry.get("provider_id", ""),
            "account_label": entry.get("account_label", ""),
            "auth_type": entry.get("auth_type", ""),
            "import_source": entry.get("import_source", ""),
            "created_at": entry.get("created_at", ""),
        }
        for sid, entry in store.get("secrets", {}).items()
    ]
