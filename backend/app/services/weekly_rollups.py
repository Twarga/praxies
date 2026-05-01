from __future__ import annotations

from datetime import datetime, time, timedelta
from pathlib import Path

from app.models import ConfigModel
from app.services.config import ensure_journal_dir


WEEKLY_ROLLUP_DEFAULT_WEEKDAY = "sunday"
WEEKDAY_INDEXES = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def get_weekly_rollups_dir(config: ConfigModel) -> Path:
    return ensure_journal_dir(config) / "_weekly"


def get_weekly_rollup_path(config: ConfigModel, week: str) -> Path:
    return get_weekly_rollups_dir(config) / f"{week}.json"


def get_iso_week_key(value: datetime) -> str:
    iso_year, iso_week, _weekday = value.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def get_completed_week_key(now: datetime) -> str:
    previous_week = now - timedelta(days=7)
    return get_iso_week_key(previous_week)


def is_weekly_rollup_due(config: ConfigModel, *, now: datetime | None = None) -> bool:
    reference = now or datetime.now().astimezone()
    due_weekday, due_time = _parse_weekly_rollup_time(config.telegram.weekly_rollup_time)
    if reference.weekday() != due_weekday:
        return False
    if reference.time().replace(tzinfo=None) < due_time:
        return False

    return not get_weekly_rollup_path(config, get_completed_week_key(reference)).exists()


def _parse_weekly_rollup_time(value: str) -> tuple[int, time]:
    parts = value.strip().lower().split()
    if len(parts) != 2:
        return WEEKDAY_INDEXES[WEEKLY_ROLLUP_DEFAULT_WEEKDAY], time(20, 0)

    weekday = WEEKDAY_INDEXES.get(parts[0], WEEKDAY_INDEXES[WEEKLY_ROLLUP_DEFAULT_WEEKDAY])
    try:
        hour_text, minute_text = parts[1].split(":", 1)
        due_time = time(int(hour_text), int(minute_text))
    except ValueError:
        due_time = time(20, 0)

    return weekday, due_time
