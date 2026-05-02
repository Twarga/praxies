from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.models import ConfigModel, MetaModel
from app.services.sessions import discover_session_dirs, get_session_video_path, load_session_meta


RETENTION_INTERVAL_SECONDS = 24 * 60 * 60
RETENTION_SKIP_STATUSES = {"recording", "saved", "queued", "transcribing", "analyzing"}


def get_retention_deadline(meta: MetaModel, retention_days: int) -> datetime | None:
    if retention_days <= 0:
        return None

    return datetime.fromisoformat(meta.created_at) + timedelta(days=retention_days)


def is_retention_due(
    config: ConfigModel,
    meta: MetaModel,
    *,
    now: datetime | None = None,
) -> bool:
    if meta.retention.compressed:
        return False
    if meta.status in RETENTION_SKIP_STATUSES:
        return False
    if not meta.video_filename:
        return False
    if get_session_video_path(config, meta.id) is None:
        return False

    deadline = get_retention_deadline(meta, config.retention_days)
    if deadline is None:
        return False

    reference = now or datetime.now().astimezone()
    if deadline.tzinfo is None and reference.tzinfo is not None:
        deadline = deadline.replace(tzinfo=reference.tzinfo)

    return deadline <= reference


def scan_retention_due_sessions(
    config: ConfigModel,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    checked = 0
    due_session_ids: list[str] = []

    for session_dir in discover_session_dirs(config):
        try:
            meta = load_session_meta(config, session_dir.name)
        except Exception:
            continue

        checked += 1
        if is_retention_due(config, meta, now=now):
            due_session_ids.append(meta.id)

    return {
        "checked": checked,
        "due": len(due_session_ids),
        "due_session_ids": due_session_ids,
        "retention_days": config.retention_days,
        "checked_at": (now or datetime.now().astimezone()).isoformat(timespec="seconds"),
    }
