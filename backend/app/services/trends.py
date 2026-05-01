from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Literal

from app.models import ConfigModel, MetaModel
from app.services.json_io import read_json_file
from app.services.sessions import discover_session_dirs, get_session_analysis_path, load_session_meta


TrendRange = Literal["7d", "30d", "90d", "all"]
SUPPORTED_TREND_RANGES = {"7d", "30d", "90d", "all"}


def build_trends_payload(
    config: ConfigModel,
    *,
    trend_range: str = "30d",
    now: datetime | None = None,
) -> dict[str, Any]:
    normalized_range = trend_range.strip().lower()
    if normalized_range not in SUPPORTED_TREND_RANGES:
        raise ValueError("Unsupported trends range.")

    reference = now or datetime.now().astimezone()
    start_date = _get_range_start_date(normalized_range, reference)
    entries = _load_trend_entries(config, start_date=start_date, reference=reference)

    return {
        "range": normalized_range,
        "generated_at": reference.isoformat(timespec="seconds"),
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": reference.date().isoformat(),
        "sessions": [
            {
                "id": meta.id,
                "created_at": meta.created_at,
                "language": meta.language,
                "title": meta.title,
                "duration_seconds": meta.duration_seconds,
                "analysis": analysis,
            }
            for meta, analysis in entries
        ],
    }


def _load_trend_entries(
    config: ConfigModel,
    *,
    start_date: date | None,
    reference: datetime,
) -> list[tuple[MetaModel, dict[str, Any]]]:
    entries: list[tuple[MetaModel, dict[str, Any]]] = []

    for session_dir in discover_session_dirs(config):
        try:
            meta = load_session_meta(config, session_dir.name)
        except Exception:
            continue

        session_date = _parse_session_datetime(meta.created_at, reference).date()
        if session_date > reference.date():
            continue
        if start_date is not None and session_date < start_date:
            continue

        analysis_path = get_session_analysis_path(config, meta.id)
        if not analysis_path.exists():
            continue

        entries.append((meta, read_json_file(analysis_path)))

    return sorted(entries, key=lambda item: item[0].created_at)


def _get_range_start_date(trend_range: str, reference: datetime) -> date | None:
    if trend_range == "all":
        return None

    days = int(trend_range.removesuffix("d"))
    return reference.date() - timedelta(days=days - 1)


def _parse_session_datetime(value: str, reference: datetime) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=reference.tzinfo)
    return parsed.astimezone(reference.tzinfo)
