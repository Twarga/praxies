from __future__ import annotations

import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.models import ConfigModel, MetaModel
from app.services.sessions import (
    append_session_processing_event,
    discover_session_dirs,
    get_session_chunks_dir,
    get_session_dir,
    get_session_video_path,
    load_session_meta,
    update_session_meta,
)


RETENTION_INTERVAL_SECONDS = 24 * 60 * 60
RETENTION_SKIP_STATUSES = {"recording", "saved", "queued", "transcribing", "analyzing"}
RETAINED_AUDIO_FILENAME = "audio_retained.ogg"


def get_retained_audio_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / RETAINED_AUDIO_FILENAME


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


def compress_session_to_audio_only(
    config: ConfigModel,
    session_id: str,
    *,
    now: datetime | None = None,
) -> MetaModel:
    meta = load_session_meta(config, session_id)
    if not is_retention_due(config, meta, now=now):
        return meta

    video_path = get_session_video_path(config, session_id)
    if video_path is None:
        raise FileNotFoundError(session_id)

    retained_audio_path = get_retained_audio_path(config, session_id)
    command = [
        "ffmpeg",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "libopus",
        "-b:a",
        "48k",
        "-y",
        str(retained_audio_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg retention audio compression failed.")
    if not retained_audio_path.exists() or retained_audio_path.stat().st_size <= 0:
        raise RuntimeError("ffmpeg retention audio compression produced an empty file.")

    deadline = get_retention_deadline(meta, config.retention_days)
    video_path.unlink(missing_ok=True)
    shutil.rmtree(get_session_chunks_dir(config, session_id), ignore_errors=True)

    retention = meta.retention.model_copy(
        update={
            "compressed": True,
            "video_kept_until": deadline.isoformat() if deadline else None,
        }
    )
    update_session_meta(
        config,
        session_id,
        updates={
            "video_filename": None,
            "file_size_bytes": retained_audio_path.stat().st_size,
            "retention": retention,
        },
    )
    return append_session_processing_event(
        config,
        session_id,
        message="Retention compressed expired video to an audio-only archive.",
        level="success",
        progress_label="Retention compressed",
        progress_percent=100,
    )


def run_retention_pass(
    config: ConfigModel,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    summary = scan_retention_due_sessions(config, now=now)
    compressed_session_ids: list[str] = []
    errors: list[dict[str, str]] = []

    for session_id in summary["due_session_ids"]:
        try:
            compress_session_to_audio_only(config, session_id, now=now)
            compressed_session_ids.append(session_id)
        except Exception as error:
            errors.append({"session_id": session_id, "error": str(error)})

    return {
        **summary,
        "compressed": len(compressed_session_ids),
        "compressed_session_ids": compressed_session_ids,
        "errors": errors,
    }
