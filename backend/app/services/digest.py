from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from app.models import ConfigModel, MetaModel
from app.services.json_io import read_json_file
from app.services.sessions import discover_session_dirs, get_session_analysis_path, load_session_meta


def select_today_digest_session(
    config: ConfigModel,
    *,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    reference = now or datetime.now().astimezone()
    today = reference.date()
    yesterday = today - timedelta(days=1)
    candidates: list[tuple[int, float, MetaModel, dict[str, Any], date]] = []

    for session_dir in discover_session_dirs(config):
        try:
            meta = load_session_meta(config, session_dir.name)
        except Exception:
            continue

        if meta.status != "ready":
            continue

        analysis_path = get_session_analysis_path(config, meta.id)
        if not analysis_path.exists():
            continue

        created_at = _parse_session_datetime(meta.created_at, reference)
        session_date = created_at.date()
        if session_date > today:
            continue

        if session_date == yesterday:
            priority = 0
        elif session_date < yesterday:
            priority = 1
        else:
            priority = 2

        candidates.append((priority, -created_at.timestamp(), meta, read_json_file(analysis_path), session_date))

    if not candidates:
        return None

    priority, _sort_time, meta, analysis, session_date = sorted(candidates, key=lambda item: (item[0], item[1]))[0]
    return {
        "session": meta.model_dump(mode="json"),
        "analysis": analysis,
        "digest_date": session_date.isoformat(),
        "selection": _selection_name(priority),
    }


def _parse_session_datetime(value: str, reference: datetime) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=reference.tzinfo)
    return parsed.astimezone(reference.tzinfo)


def _selection_name(priority: int) -> str:
    if priority == 0:
        return "yesterday"
    if priority == 1:
        return "latest_previous"
    return "today"
