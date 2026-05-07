from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Literal

from app.models import ConfigModel, MetaModel
from app.services.json_io import read_json_file
from app.services.sessions import discover_session_dirs, get_session_analysis_path, load_session_meta


TrendRange = Literal["7d", "30d", "90d", "all"]
SUPPORTED_TREND_RANGES = {"7d", "30d", "90d", "all"}
SCORECARD_METRICS = [
    "clarity",
    "structure",
    "reflection_depth",
    "emotional_awareness",
    "specificity",
    "actionability",
    "language_fluency",
]
SCORECARD_LABELS = {
    "clarity": "Clarity",
    "structure": "Structure",
    "reflection_depth": "Reflection Depth",
    "emotional_awareness": "Emotional Awareness",
    "specificity": "Specificity",
    "actionability": "Actionability",
    "language_fluency": "Language Fluency",
}


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
    volume_metas = _load_volume_metas(config, start_date=start_date, reference=reference)

    return {
        "range": normalized_range,
        "generated_at": reference.isoformat(timespec="seconds"),
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": reference.date().isoformat(),
        "volume_summary": _build_volume_summary(
            volume_metas,
            trend_range=normalized_range,
            start_date=start_date,
            end_date=reference.date(),
            reference=reference,
        ),
        "analysis_summary": {
            "sessions": len(entries),
            "by_language": {
                "en": sum(1 for meta, _analysis in entries if meta.language == "en"),
                "fr": sum(1 for meta, _analysis in entries if meta.language == "fr"),
                "es": sum(1 for meta, _analysis in entries if meta.language == "es"),
            },
        },
        "fluency_by_language": _build_fluency_by_language(entries, reference),
        "scorecard_by_language": _build_scorecard_by_language(entries, reference),
        "scorecard_dimensions": _build_scorecard_dimensions(entries),
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


def _build_scorecard_by_language(
    entries: list[tuple[MetaModel, dict[str, Any]]],
    reference: datetime,
) -> dict[str, list[dict[str, Any]]]:
    series: dict[str, list[dict[str, Any]]] = {"en": [], "fr": [], "es": []}

    for meta, analysis in entries:
        scores = {
            metric: score
            for metric in SCORECARD_METRICS
            if (score := _extract_scorecard_score(analysis, metric)) is not None
        }
        if not scores:
            continue

        average = round(sum(scores.values()) / len(scores), 1)
        series[meta.language].append(
            {
                "date": _parse_session_datetime(meta.created_at, reference).date().isoformat(),
                "session_id": meta.id,
                "average": average,
                "scores": scores,
            }
        )

    return series


def _build_scorecard_dimensions(
    entries: list[tuple[MetaModel, dict[str, Any]]],
) -> list[dict[str, Any]]:
    dimensions: list[dict[str, Any]] = []
    split_index = len(entries) // 2

    for metric in SCORECARD_METRICS:
        previous_scores: list[int] = []
        recent_scores: list[int] = []

        for entry_index, (_meta, analysis) in enumerate(entries):
            score = _extract_scorecard_score(analysis, metric)
            if score is None:
                continue
            if entry_index >= split_index:
                recent_scores.append(score)
            else:
                previous_scores.append(score)

        scores = previous_scores + recent_scores
        if not scores:
            continue

        average = round(sum(scores) / len(scores), 1)
        latest = recent_scores[-1] if recent_scores else scores[-1]
        previous_average = (
            round(sum(previous_scores) / len(previous_scores), 1)
            if previous_scores
            else None
        )
        recent_average = (
            round(sum(recent_scores) / len(recent_scores), 1)
            if recent_scores
            else None
        )
        dimensions.append(
            {
                "metric": metric,
                "label": SCORECARD_LABELS[metric],
                "average": average,
                "latest": latest,
                "trend": _label_scorecard_trend(previous_average, recent_average),
            }
        )

    return sorted(dimensions, key=lambda item: (float(item["average"]), str(item["label"])))


def _extract_scorecard_score(analysis: dict[str, Any], metric: str) -> int | None:
    scorecard = analysis.get("scorecard") or {}
    metric_payload = scorecard.get(metric) if isinstance(scorecard, dict) else None
    if isinstance(metric_payload, dict):
        score = metric_payload.get("score")
        if isinstance(score, int | float):
            return max(0, min(10, int(score)))

    if metric == "clarity":
        score = (analysis.get("speaking_quality") or {}).get("clarity")
        if isinstance(score, int | float):
            return max(0, min(10, int(score)))

    if metric == "language_fluency":
        score = (analysis.get("grammar_and_language") or {}).get("fluency_score")
        if isinstance(score, int | float):
            return max(0, min(10, int(score)))

    return None


def _label_scorecard_trend(previous_average: float | None, recent_average: float | None) -> str:
    if recent_average is None:
        return "no recent data"
    if previous_average is None:
        return "new baseline"

    delta = recent_average - previous_average
    if delta >= 0.6:
        return "improving"
    if delta <= -0.6:
        return "slipping"
    return "stable"


def _build_volume_summary(
    metas: list[MetaModel],
    *,
    trend_range: str,
    start_date: date | None,
    end_date: date,
    reference: datetime,
) -> dict[str, Any]:
    total_seconds = sum(float(meta.duration_seconds) for meta in metas)
    active_dates = {
        _parse_session_datetime(meta.created_at, reference).date().isoformat()
        for meta in metas
    }

    return {
        "range": trend_range,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat(),
        "sessions": len(metas),
        "hours": round(total_seconds / 3600, 2),
        "total_seconds": total_seconds,
        "active_days": len(active_dates),
        "by_language": {
            "en": sum(1 for meta in metas if meta.language == "en"),
            "fr": sum(1 for meta in metas if meta.language == "fr"),
            "es": sum(1 for meta in metas if meta.language == "es"),
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


def _load_volume_metas(
    config: ConfigModel,
    *,
    start_date: date | None,
    reference: datetime,
) -> list[MetaModel]:
    metas: list[MetaModel] = []

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
        if meta.status == "recording":
            continue

        metas.append(meta)

    return sorted(metas, key=lambda item: item.created_at)


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
