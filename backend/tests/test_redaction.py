"""Log redaction tests."""

from __future__ import annotations

from app.services.redaction import contains_secrets, redact, redact_dict


class TestRedaction:
    def test_redacts_openrouter_key(self):
        text = "Error with key sk-or-v1-deadbeef1234567890abcdef"
        result = redact(text)
        assert "sk-or-v1-deadbeef" not in result
        assert "****" in result

    def test_redacts_bearer_token(self):
        text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123"
        result = redact(text)
        assert "eyJhbGci" not in result
        assert "Bearer ****" in result

    def test_redacts_api_key_assignment(self):
        text = 'curl -H "api_key=abc123def4567890"'
        result = redact(text)
        assert "api_key=****" in result.lower()

    def test_redacts_authorization_header(self):
        text = "Authorization: Bearer sk-ant-1234567890abcdef"
        result = redact(text)
        assert "sk-ant" not in result
        assert "Authorization: Bearer ****" in result

    def test_passes_through_safe_text(self):
        text = "Session 2026-07-12_en_take processed in 3.2 seconds."
        result = redact(text)
        assert result == text

    def test_redaction_is_idempotent(self):
        text = "key: sk-or-v1-abc123"
        once = redact(text)
        twice = redact(once)
        assert once == twice

    def test_does_not_redact_model_ids(self):
        text = "Model deepseek-v4-flash returned valid JSON."
        result = redact(text)
        assert "deepseek-v4-flash" in result


class TestRedactDict:
    def test_redacts_nested_secrets(self):
        payload = {
            "config": {
                "api_key": "sk-or-v1-secret-key-12345",
            },
            "model": "google/gemini-2.5-flash-lite",
        }
        result = redact_dict(payload)
        assert "sk-or-v1-" not in str(result)
        assert "google/gemini-2.5-flash-lite" in str(result)

    def test_redacts_list_of_strings(self):
        payload = {
            "errors": [
                "timeout",
                "unauthorized with key sk-or-v1-badkey",
            ],
        }
        result = redact_dict(payload)
        assert "sk-or-v1-badkey" not in str(result)

    def test_preserves_non_string_values(self):
        payload = {"count": 42, "active": True, "ratio": 0.95}
        result = redact_dict(payload)
        assert result == payload


class TestContainsSecrets:
    def test_detects_openrouter_key(self):
        assert contains_secrets("Key: sk-or-v1-abc123def456")

    def test_detects_bearer_token(self):
        assert contains_secrets("Authorization: Bearer abc.def.ghi")

    def test_does_not_trigger_on_normal_text(self):
        assert not contains_secrets("Session processed successfully.")
        assert not contains_secrets("Model: deepseek-v4-flash, Provider: opencode_go")
