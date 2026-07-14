"""Local dogfood log for the 30-day trial.

Stores one JSONL entry per session in <journal>/_dogfood/entries.jsonl.
Contains application version, timing data, non-secret labels,
error codes, and optional user check-in answers.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.settings import APP_VERSION
from app.services.config import ensure_journal_dir


def get_dogfood_dir(config: Any) -> Path:
    root = Path(config.journal_folder).expanduser().resolve()
    return root / "_dogfood"


def get_dogfood_log_path(config: Any) -> Path:
    return get_dogfood_dir(config) / "entries.jsonl"


def log_dogfood_entry(config: Any, entry: dict[str, Any]) -> Path:
    """Append one entry to the dogfood log."""
    path = get_dogfood_log_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)

    entry.setdefault("app_version", APP_VERSION)
    entry.setdefault("timestamp", datetime.now().astimezone().isoformat(timespec="seconds"))

    line = json.dumps(entry, ensure_ascii=False) + "\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(line)

    return path


def log_session_processed(
    config: Any,
    *,
    session_id: str,
    language: str,
    duration_seconds: float,
    transcription_engine: str = "",
    transcription_model: str = "",
    provider_id: str = "",
    model_id: str = "",
    processing_seconds: float = 0,
    status: str = "ready",
    error_code: str = "",
) -> None:
    log_dogfood_entry(config, {
        "event": "session_processed",
        "session_id": session_id,
        "language": language,
        "duration_seconds": duration_seconds,
        "transcription_engine": transcription_engine,
        "transcription_model": transcription_model,
        "provider_id": provider_id,
        "model_id": model_id,
        "processing_seconds": processing_seconds,
        "status": status,
        "error_code": error_code,
    })


def log_checkin(
    config: Any,
    *,
    session_id: str,
    understandable: bool | None = None,
    correction_accurate: bool | None = None,
    will_practice: bool | None = None,
    friction_notes: str = "",
) -> None:
    log_dogfood_entry(config, {
        "event": "checkin",
        "session_id": session_id,
        "understandable": understandable,
        "correction_accurate": correction_accurate,
        "will_practice": will_practice,
        "friction_notes": friction_notes[:500],
    })


def load_dogfood_entries(config: Any) -> list[dict[str, Any]]:
    path = get_dogfood_log_path(config)
    if not path.exists():
        return []

    entries = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass

    return entries


def get_weekly_summary(config: Any) -> dict[str, Any]:
    entries = load_dogfood_entries(config)
    sessions = [e for e in entries if e.get("event") == "session_processed"]
    checkins = [e for e in entries if e.get("event") == "checkin"]

    error_codes: dict[str, int] = {}
    for s in sessions:
        code = s.get("error_code", "")
        if code:
            error_codes[code] = error_codes.get(code, 0) + 1

    understandable_count = sum(1 for c in checkins if c.get("understandable") is True)
    accurate_count = sum(1 for c in checkins if c.get("correction_accurate") is True)
    practice_count = sum(1 for c in checkins if c.get("will_practice") is True)

    return {
        "total_entries": len(entries),
        "sessions": len(sessions),
        "checkins": len(checkins),
        "error_codes": error_codes,
        "ratings": {
            "understandable": f"{understandable_count}/{max(len(checkins), 1)}",
            "accurate": f"{accurate_count}/{max(len(checkins), 1)}",
            "will_practice": f"{practice_count}/{max(len(checkins), 1)}",
        },
        "friction_tags": _extract_friction_tags(checkins),
    }


def _extract_friction_tags(checkins: list[dict[str, Any]]) -> list[str]:
    tags = []
    for c in checkins:
        notes = c.get("friction_notes", "")
        if notes:
            tags.append(notes[:80])
    return tags[-20:]
