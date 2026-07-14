"""Secret storage tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.storage.secrets import (
    delete_secret,
    list_secrets,
    read_secret,
    store_secret,
    _decrypt_simple,
    _encrypt_simple,
    _machine_key,
)


class TestSecretEncryption:
    def test_roundtrip_encrypt_decrypt(self):
        original = "sk-or-v1-deadbeef123456"
        encrypted = _encrypt_simple(original)
        decrypted = _decrypt_simple(encrypted)
        assert decrypted == original
        assert encrypted != original

    def test_different_values_produce_different_ciphertexts(self):
        a = _encrypt_simple("hello")
        b = _encrypt_simple("world")
        assert a != b

    def test_machine_key_is_stable(self):
        key1 = _machine_key()
        key2 = _machine_key()
        assert key1 == key2
        assert len(key1) == 32

    def test_encrypt_empty_string(self):
        encrypted = _encrypt_simple("")
        decrypted = _decrypt_simple(encrypted)
        assert decrypted == ""


class TestSecretLifecycle:
    def test_store_and_read(self, monkeypatch):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        secret_id = store_secret(
            "test-secret-value-123",
            provider_id="openrouter",
            account_label="test@example.com",
        )
        assert secret_id
        assert len(secret_id) > 20

        value = read_secret(secret_id)
        assert value == "test-secret-value-123"

    def test_read_nonexistent(self, monkeypatch):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        assert read_secret("nonexistent-id") is None

    def test_delete_removes_secret(self, monkeypatch):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        secret_id = store_secret("to-delete", provider_id="test")
        assert read_secret(secret_id) is not None

        deleted = delete_secret(secret_id)
        assert deleted is True
        assert read_secret(secret_id) is None

    def test_delete_nonexistent_returns_false(self, monkeypatch):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        assert delete_secret("never-stored") is False

    def test_list_secrets_returns_metadata(self, monkeypatch):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        sid = store_secret("list-test", provider_id="openrouter", account_label="list@test.com")
        secrets = list_secrets()
        assert any(s["secret_id"] == sid for s in secrets)

    def test_secrets_never_returned_in_plaintext_on_disk(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "app.storage.secrets._keyring_available",
            lambda: False,
        )
        import app.storage.secrets as secrets_mod
        original = secrets_mod.FALLBACK_FILE
        secrets_mod.FALLBACK_FILE = tmp_path / "secrets.json"

        try:
            store_secret("sk-sensitive-data-999", provider_id="test")
            raw = secrets_mod.FALLBACK_FILE.read_text()
            assert "sk-sensitive-data-999" not in raw
        finally:
            secrets_mod.FALLBACK_FILE = original
