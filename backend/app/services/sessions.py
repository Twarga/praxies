from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import re
import unicodedata

from app.models import ConfigModel
from app.services.config import resolve_journal_dir


def generate_session_slug(title: str | None, existing_slugs: set[str] | None = None) -> str:
    source = (title or "").strip()
    normalized = unicodedata.normalize("NFKD", source)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = slug or "untitled"

    if not existing_slugs:
        return slug

    existing = {value.lower() for value in existing_slugs}
    if slug not in existing:
        return slug

    suffix = 2
    while f"{slug}-{suffix}" in existing:
        suffix += 1

    return f"{slug}-{suffix}"


def generate_session_id(session_date: date | datetime | str, language: str, slug: str) -> str:
    if isinstance(session_date, datetime):
        date_part = session_date.date().isoformat()
    elif isinstance(session_date, date):
        date_part = session_date.isoformat()
    else:
        date_part = session_date

    return f"{date_part}_{language}_{slug}"


def discover_session_dirs(config: ConfigModel) -> list[Path]:
    journal_dir = resolve_journal_dir(config)
    if not journal_dir.exists():
        return []

    return sorted(
        [
            entry.resolve()
            for entry in journal_dir.iterdir()
            if entry.is_dir() and not entry.name.startswith("_")
        ]
    )
