"""Log redaction for secrets, tokens, and credentials.

Redacts known patterns before strings reach logs, diagnostics,
or support bundles. Applies to backend logs, Electron logs,
API responses in diagnostics, and test output.
"""

from __future__ import annotations

import re


SECRET_PATTERNS: list[tuple[str, str, str]] = [
    (r"sk-or-v1-[A-Za-z0-9._-]+", "****", "OpenRouter API key"),
    (r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", "Bearer ****", "Bearer token"),
    (r"api_key[\"'=:\s]+([A-Za-z0-9\-._]{8,})", "api_key=****", "API key parameter"),
    (r"Authorization:\s*Bearer\s+[A-Za-z0-9\-._~+/]+=*", "Authorization: Bearer ****", "Authorization header"),
    (r"([a-zA-Z0-9_]+)_(api_)?key[\"'=:\s]+([A-Za-z0-9\-._]{8,})", "****_key=****", "Generic key assignment"),
    (r'"auth_profile_id":\s*"[^"]*"', '"auth_profile_id": "redacted"', "Auth profile ID"),
    (r"oauth2_token\W+[A-Za-z0-9\-._]+", "oauth2_token=****", "OAuth token"),
]

COMPILED_PATTERNS = [(re.compile(pattern), replacement, label) for pattern, replacement, label in SECRET_PATTERNS]


def redact(text: str) -> str:
    """Apply all redaction patterns. Returns redacted text."""
    result = text
    for pattern, replacement, _label in COMPILED_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def redact_dict(payload: dict[str, object]) -> dict[str, object]:
    """Recursively redact string values in a dict."""
    result: dict[str, object] = {}
    for key, value in payload.items():
        normalized_key = key.lower().replace("-", "_")
        if isinstance(value, str) and any(marker in normalized_key for marker in ("api_key", "token", "secret", "password")):
            result[key] = "****"
        elif isinstance(value, str):
            result[key] = redact(value)
        elif isinstance(value, dict):
            result[key] = redact_dict(value)
        elif isinstance(value, list):
            result[key] = [
                redact(item) if isinstance(item, str)
                else redact_dict(item) if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            result[key] = value
    return result


def contains_secrets(text: str) -> bool:
    """Check if text likely contains unredacted secrets. For testing."""
    for pattern, _replacement, _label in COMPILED_PATTERNS:
        if pattern.search(text):
            return True
    return False
