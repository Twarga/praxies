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
        "volume_summary": _build_volume_summary(
            entries,
            trend_range=normalized_range,
            start_date=start_date,
            end_date=reference.date(),
            reference=reference,
        ),
        "fluency_by_language": _build_fluency_by_language(entries, reference),
        "pattern_hits_by_language": _build_pattern_hits_by_language(entries),
        "filler_words_by_language": _build_filler_words_by_language(entries),
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


def _build_volume_summary(
    entries: list[tuple[MetaModel, dict[str, Any]]],
    *,
    trend_range: str,
    start_date: date | None,
    end_date: date,
    reference: datetime,
) -> dict[str, Any]:
    total_seconds = sum(float(meta.duration_seconds) for meta, _analysis in entries)
    active_dates = {
        _parse_session_datetime(meta.created_at, reference).date().isoformat()
        for meta, _analysis in entries
    }

    return {
        "range": trend_range,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat(),
        "sessions": len(entries),
        "hours": round(total_seconds / 3600, 2),
        "total_seconds": total_seconds,
        "active_days": len(active_dates),
        "by_language": {
            "en": sum(1 for meta, _analysis in entries if meta.language == "en"),
            "fr": sum(1 for meta, _analysis in entries if meta.language == "fr"),
            "es": sum(1 for meta, _analysis in entries if meta.language == "es"),
        },
    }


def _build_filler_words_by_language(
    entries: list[tuple[MetaModel, dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, dict[str, int]] = {"en": {}, "fr": {}, "es": {}}

    for meta, analysis in entries:
        language = meta.language
        grammar = analysis.get("grammar_and_language") or {}
        filler_words = grammar.get("filler_words") or {}
        if not isinstance(filler_words, dict):
            continue

        for word, count in filler_words.items():
            normalized_word = " ".join(str(word).split())
            if not normalized_word:
                continue
            numeric_count = int(count) if isinstance(count, int | float) else 0
            if numeric_count <= 0:
                continue

            key = normalized_word.casefold()
            grouped[language][key] = grouped[language].get(key, 0) + numeric_count

    return {
        language: [
            {"word": word, "count": count}
            for word, count in sorted(
                words.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ]
        for language, words in grouped.items()
    }


def _build_fluency_by_language(
    entries: list[tuple[MetaModel, dict[str, Any]]],
    reference: datetime,
) -> dict[str, list[dict[str, Any]]]:
    series: dict[str, list[dict[str, Any]]] = {"en": [], "fr": [], "es": []}

    for meta, analysis in entries:
        language = meta.language
        grammar = analysis.get("grammar_and_language") or {}
        score = grammar.get("fluency_score")
        if not isinstance(score, int | float):
            continue

        series[language].append(
            {
                "date": _parse_session_datetime(meta.created_at, reference).date().isoformat(),
                "session_id": meta.id,
                "score": int(score),
            }
        )

    return series


def _build_pattern_hits_by_language(
    entries: list[tuple[MetaModel, dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, dict[str, dict[str, Any]]] = {"en": {}, "fr": {}, "es": {}}
    split_index = len(entries) // 2

    for entry_index, (meta, analysis) in enumerate(entries):
        language = meta.language
        period_key = "recent_count" if entry_index >= split_index else "previous_count"
        for hit in analysis.get("recurring_patterns_hit") or []:
            name = " ".join(str(hit).split())
            if not name:
                continue

            key = name.casefold()
            entry = grouped[language].setdefault(
                key,
                {
                    "name": name,
                    "count": 0,
                    "previous_count": 0,
                    "recent_count": 0,
                    "recent_sessions": [],
                },
            )
            entry["count"] += 1
            entry[period_key] += 1
            if meta.id not in entry["recent_sessions"]:
                entry["recent_sessions"].append(meta.id)

    return {
        language: sorted(
            [
                {
                    "name": pattern["name"],
                    "count": pattern["count"],
                    "trend": _label_pattern_trend(
                        previous_count=int(pattern["previous_count"]),
                        recent_count=int(pattern["recent_count"]),
                    ),
                    "recent_sessions": pattern["recent_sessions"],
                }
                for pattern in patterns.values()
            ],
            key=lambda item: (-int(item["count"]), str(item["name"]).casefold()),
        )
        for language, patterns in grouped.items()
    }


def _label_pattern_trend(*, previous_count: int, recent_count: int) -> str:
    if previous_count == 0 and recent_count > 0:
        return "new"
    if recent_count > previous_count:
        return "trending ↑"
    if recent_count < previous_count:
        return "trending ↓"
    return "stable —"


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
