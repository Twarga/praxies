from __future__ import annotations

import json
import re
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any

from app.models import ConfigModel, WeeklyRollupModel
from app.services.config import ensure_journal_dir
from app.services.json_io import read_json_file, write_json_file
from app.services.llm_client import LiteLLMOpenRouterClient
from app.services.sessions import discover_session_dirs, get_session_analysis_path, load_session_meta


WEEKLY_ROLLUP_DEFAULT_WEEKDAY = "sunday"
WEEK_KEY_PATTERN = re.compile(r"^\d{4}-W\d{2}$")
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
    _validate_week_key(week)
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


def generate_weekly_rollup(
    config: ConfigModel,
    *,
    client: LiteLLMOpenRouterClient,
    now: datetime | None = None,
    force: bool = False,
) -> WeeklyRollupModel | None:
    reference = now or datetime.now().astimezone()
    if not force and not is_weekly_rollup_due(config, now=reference):
        return None

    week = get_completed_week_key(reference)
    sessions = _load_week_sessions(config, week=week, reference=reference)
    metadata = _build_weekly_rollup_metadata(week=week, sessions=sessions, generated_at=reference)

    if not sessions:
        rollup = WeeklyRollupModel(
            **metadata,
            summary_prose="No analyzed sessions were available for this completed week.",
            improvements=[],
            still_breaking=[],
            focus_for_next_week="Record at least one full analyzed session.",
        )
        write_json_file(get_weekly_rollup_path(config, week), rollup.model_dump(mode="json"))
        return rollup

    response_text = client.complete_json(
        config=config,
        system_prompt=build_weekly_rollup_system_prompt(),
        user_message=build_weekly_rollup_user_message(week=week, sessions=sessions),
        temperature=0.3,
        max_tokens=2500,
    )
    rollup = parse_weekly_rollup_response(response_text, metadata=metadata)
    write_json_file(get_weekly_rollup_path(config, week), rollup.model_dump(mode="json"))
    return rollup


def load_weekly_rollup(config: ConfigModel, week: str) -> WeeklyRollupModel | None:
    path = get_weekly_rollup_path(config, week)
    if not path.exists():
        return None

    return WeeklyRollupModel.model_validate(read_json_file(path))


def build_weekly_rollup_system_prompt() -> str:
    return "\n".join(
        [
            "You summarize one completed week of speaking-practice journal analyses.",
            "Return ONLY valid JSON. No markdown, no code fences, no preamble.",
            "The JSON must contain these prose fields:",
            "- summary_prose: 2-4 direct sentences on the week.",
            "- improvements: 2-5 concrete improvements observed.",
            "- still_breaking: 0-5 recurring issues still hurting performance.",
            "- focus_for_next_week: one specific focus for the next week.",
        ]
    )


def build_weekly_rollup_user_message(*, week: str, sessions: list[dict[str, Any]]) -> str:
    payload = {
        "week": week,
        "sessions": sessions,
        "required_response_shape": {
            "summary_prose": "string",
            "improvements": ["string"],
            "still_breaking": ["string"],
            "focus_for_next_week": "string",
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def parse_weekly_rollup_response(response_text: str, *, metadata: dict[str, Any]) -> WeeklyRollupModel:
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise ValueError("Weekly rollup response is not valid JSON.") from error

    if not isinstance(payload, dict):
        raise ValueError("Weekly rollup response must be a JSON object.")

    merged_payload = {
        **metadata,
        "summary_prose": str(payload.get("summary_prose") or "").strip(),
        "improvements": [str(item).strip() for item in payload.get("improvements") or [] if str(item).strip()],
        "still_breaking": [str(item).strip() for item in payload.get("still_breaking") or [] if str(item).strip()],
        "focus_for_next_week": str(payload.get("focus_for_next_week") or "").strip(),
    }
    return WeeklyRollupModel.model_validate(merged_payload)


def _load_week_sessions(config: ConfigModel, *, week: str, reference: datetime) -> list[dict[str, Any]]:
    sessions: list[dict[str, Any]] = []

    for session_dir in discover_session_dirs(config):
        try:
            meta = load_session_meta(config, session_dir.name)
        except Exception:
            continue

        created_at = _parse_session_datetime(meta.created_at, reference)
        if get_iso_week_key(created_at) != week:
            continue

        analysis_path = get_session_analysis_path(config, meta.id)
        if not analysis_path.exists():
            continue

        analysis = read_json_file(analysis_path)
        sessions.append(
            {
                "id": meta.id,
                "created_at": meta.created_at,
                "language": meta.language,
                "title": meta.title,
                "duration_seconds": meta.duration_seconds,
                "analysis": {
                    "prose_verdict": analysis.get("prose_verdict"),
                    "session_summary": analysis.get("session_summary"),
                    "fluency_score": (analysis.get("grammar_and_language") or {}).get("fluency_score"),
                    "recurring_patterns_hit": analysis.get("recurring_patterns_hit") or [],
                    "actionable_improvements": analysis.get("actionable_improvements") or [],
                },
            }
        )

    return sorted(sessions, key=lambda item: str(item["created_at"]))


def _build_weekly_rollup_metadata(
    *,
    week: str,
    sessions: list[dict[str, Any]],
    generated_at: datetime,
) -> dict[str, Any]:
    return {
        "week": week,
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "session_count": len(sessions),
        "total_seconds": sum(float(session["duration_seconds"]) for session in sessions),
        "languages_used": sorted({str(session["language"]) for session in sessions}),
    }


def _parse_session_datetime(value: str, reference: datetime) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=reference.tzinfo)
    return parsed.astimezone(reference.tzinfo)


def _validate_week_key(week: str) -> None:
    if not WEEK_KEY_PATTERN.match(week):
        raise ValueError("Invalid weekly rollup week key.")


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
