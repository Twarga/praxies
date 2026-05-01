from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path

from pydantic import ValidationError

from app.models import IndexModel, MetaModel
from app.services.config import ensure_journal_dir
from app.services.json_io import read_json_file, write_json_file
from app.services.sessions import discover_session_dirs


def get_index_file_path(config) -> Path:
    return ensure_journal_dir(config) / "_index.json"


def get_index_backup_file_path(config) -> Path:
    return ensure_journal_dir(config) / "_index.json.bak"


def load_meta(session_dir: Path) -> MetaModel | None:
    meta_path = session_dir / "meta.json"
    if not meta_path.exists():
        return None

    try:
        return MetaModel.model_validate(read_json_file(meta_path))
    except ValidationError:
        return None


def _date_from_created_at(created_at: str) -> date:
    return datetime.fromisoformat(created_at).date()


def _build_streak(active_dates: list[date]) -> dict[str, int | str | None]:
    if not active_dates:
        return {
            "current": 0,
            "longest": 0,
            "last_active_date": None,
            "last_reset_date": None,
        }

    unique_dates = sorted(set(active_dates))
    longest = 1
    current_run = 1

    for previous, current in zip(unique_dates, unique_dates[1:]):
        if current == previous + timedelta(days=1):
            current_run += 1
            longest = max(longest, current_run)
        else:
            current_run = 1

    latest = unique_dates[-1]
    current = 1
    cursor = latest
    previous_dates = set(unique_dates[:-1])
    while cursor - timedelta(days=1) in previous_dates:
        cursor -= timedelta(days=1)
        current += 1

    streak_start = latest - timedelta(days=current - 1)
    last_reset = streak_start - timedelta(days=1)

    return {
        "current": current,
        "longest": longest,
        "last_active_date": latest.isoformat(),
        "last_reset_date": last_reset.isoformat() if unique_dates else None,
    }


def rebuild_index(config, now: datetime | None = None) -> IndexModel:
    session_dirs = discover_session_dirs(config)
    metas = [meta for meta in (load_meta(path) for path in session_dirs) if meta is not None]
    metas.sort(key=lambda item: item.created_at, reverse=True)

    active_dates = [_date_from_created_at(meta.created_at) for meta in metas]

    index = IndexModel(
        generated_at=(now or datetime.now().astimezone()).isoformat(timespec="seconds"),
        sessions=[
            {
                "id": meta.id,
                "created_at": meta.created_at,
                "language": meta.language,
                "title": meta.title,
                "duration_seconds": meta.duration_seconds,
                "status": meta.status,
                "save_mode": meta.save_mode,
                "error": meta.error,
                "read": meta.read,
            }
            for meta in metas
        ],
        streak=_build_streak(active_dates),
        totals={
            "sessions": len(metas),
            "total_seconds": sum(meta.duration_seconds for meta in metas),
            "by_language": {
                "en": sum(1 for meta in metas if meta.language == "en"),
                "fr": sum(1 for meta in metas if meta.language == "fr"),
                "es": sum(1 for meta in metas if meta.language == "es"),
            },
        },
    )

    write_json_file(get_index_file_path(config), index.model_dump(mode="json"))
    return index


def load_or_rebuild_index(config, now: datetime | None = None) -> IndexModel:
    index_path = get_index_file_path(config)
    if not index_path.exists():
        return rebuild_index(config, now=now)

    try:
        return IndexModel.model_validate(read_json_file(index_path))
    except Exception:
        backup_path = get_index_backup_file_path(config)
        if backup_path.exists():
            backup_path.unlink()
        index_path.rename(backup_path)
        return rebuild_index(config, now=now)


def list_sessions(
    config,
    *,
    lang: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = None,
) -> list[dict[str, object]]:
    index = load_or_rebuild_index(config)
    sessions = index.sessions

    if lang:
        sessions = [session for session in sessions if session.language == lang]

    if date_from:
        start = date.fromisoformat(date_from)
        sessions = [session for session in sessions if _date_from_created_at(session.created_at) >= start]

    if date_to:
        end = date.fromisoformat(date_to)
        sessions = [session for session in sessions if _date_from_created_at(session.created_at) <= end]

    if limit is not None:
        sessions = sessions[:limit]

    return [session.model_dump(mode="json") for session in sessions]
