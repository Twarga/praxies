from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import re
import unicodedata

from app.models import ConfigModel, MetaModel
from app.services.config import resolve_journal_dir
from app.services.json_io import read_json_file


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


def get_session_dir(config: ConfigModel, session_id: str) -> Path:
    return resolve_journal_dir(config) / session_id


def load_session_bundle(config: ConfigModel, session_id: str) -> dict[str, object] | None:
    session_dir = get_session_dir(config, session_id)
    meta_path = session_dir / "meta.json"

    if not meta_path.exists():
        return None

    meta = MetaModel.model_validate(read_json_file(meta_path))
    transcript_text_path = session_dir / "transcript.txt"
    transcript_json_path = session_dir / "transcript.json"
    analysis_path = session_dir / "analysis.json"

    transcript_text = None
    if transcript_text_path.exists():
        transcript_text = transcript_text_path.read_text(encoding="utf-8")

    transcript = None
    if transcript_json_path.exists():
        transcript = read_json_file(transcript_json_path)

    analysis = None
    if analysis_path.exists():
        analysis = read_json_file(analysis_path)

    return {
        "meta": meta.model_dump(mode="json"),
        "transcript_text": transcript_text,
        "transcript": transcript,
        "analysis": analysis,
    }
