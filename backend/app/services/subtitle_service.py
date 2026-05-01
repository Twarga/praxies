from __future__ import annotations

import asyncio
import json
from pathlib import Path
import subprocess
import textwrap
from typing import Any

from app.models import ConfigModel
from app.services.llm_client import LiteLLMOpenRouterClient
from app.services.prompt_builder import (
    build_subtitle_translation_system_prompt,
    build_subtitle_translation_user_message,
)
from app.services.sessions import (
    get_session_dir,
    get_session_subtitle_path,
    get_session_subtitle_segments_path,
    get_session_subtitled_video_path,
    get_session_video_path,
)
from app.services.json_io import read_json_file, write_json_file


TRANSLATION_CHUNK_SIZE = 40


def normalize_subtitle_segments(transcript_segments: list[dict[str, object]] | None) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for index, segment in enumerate(transcript_segments or []):
        text = str(segment.get("text", "")).strip()
        if not text:
            continue

        start_seconds = max(0.0, float(segment.get("start_seconds", 0.0) or 0.0))
        end_seconds = max(start_seconds + 0.25, float(segment.get("end_seconds", start_seconds + 2.0) or 0.0))
        normalized.append(
            {
                "index": index,
                "start_seconds": start_seconds,
                "end_seconds": end_seconds,
                "text": text,
            }
        )

    return normalized


def write_subtitle_files(
    config: ConfigModel,
    session_id: str,
    *,
    language: str,
    segments: list[dict[str, object]],
) -> dict[str, str]:
    normalized = normalize_subtitle_segments(segments)
    segments_path = get_session_subtitle_segments_path(config, session_id, language)
    srt_path = get_session_subtitle_path(config, session_id, language, "srt")
    vtt_path = get_session_subtitle_path(config, session_id, language, "vtt")

    write_json_file(segments_path, normalized)
    srt_path.write_text(render_srt(normalized), encoding="utf-8")
    vtt_path.write_text(render_vtt(normalized), encoding="utf-8")

    return {
        "segments": segments_path.name,
        "srt": srt_path.name,
        "vtt": vtt_path.name,
    }


def load_subtitle_segments(config: ConfigModel, session_id: str, language: str) -> list[dict[str, object]] | None:
    segments_path = get_session_subtitle_segments_path(config, session_id, language)
    if not segments_path.exists():
        return None

    return read_json_file(segments_path)


def render_srt(segments: list[dict[str, object]]) -> str:
    blocks: list[str] = []
    for output_index, segment in enumerate(segments, start=1):
        text = _format_subtitle_text(str(segment["text"]))
        blocks.append(
            "\n".join(
                [
                    str(output_index),
                    f"{_format_srt_timestamp(float(segment['start_seconds']))} --> "
                    f"{_format_srt_timestamp(float(segment['end_seconds']))}",
                    text,
                ]
            )
        )

    return "\n\n".join(blocks) + ("\n" if blocks else "")


def render_vtt(segments: list[dict[str, object]]) -> str:
    blocks = ["WEBVTT", ""]
    for segment in segments:
        text = _format_subtitle_text(str(segment["text"])).replace("-->", "->")
        blocks.append(
            "\n".join(
                [
                    f"{_format_vtt_timestamp(float(segment['start_seconds']))} --> "
                    f"{_format_vtt_timestamp(float(segment['end_seconds']))}",
                    text,
                ]
            )
        )
        blocks.append("")

    return "\n".join(blocks)


def translate_subtitle_segments(
    *,
    client: LiteLLMOpenRouterClient,
    config: ConfigModel,
    source_language: str,
    target_language: str,
    segments: list[dict[str, object]],
) -> list[dict[str, object]]:
    if source_language == target_language:
        return normalize_subtitle_segments(segments)

    normalized = normalize_subtitle_segments(segments)
    translated_by_index: dict[int, str] = {}

    for start in range(0, len(normalized), TRANSLATION_CHUNK_SIZE):
        chunk = normalized[start : start + TRANSLATION_CHUNK_SIZE]
        response_text = client.complete_json(
            config=config,
            system_prompt=build_subtitle_translation_system_prompt(
                source_language=source_language,
                target_language=target_language,
            ),
            user_message=build_subtitle_translation_user_message(chunk),
            temperature=0.2,
            max_tokens=5000,
        )
        translated_by_index.update(_parse_translation_response(response_text, chunk))

    translated_segments: list[dict[str, object]] = []
    for segment in normalized:
        segment_index = int(segment["index"])
        translated_text = translated_by_index.get(segment_index)
        if not translated_text:
            raise ValueError(f"Translation response missed segment {segment_index}.")

        translated_segments.append({**segment, "text": translated_text})

    return translated_segments


async def export_burned_subtitle_video(config: ConfigModel, session_id: str, *, language: str) -> Path:
    video_path = get_session_video_path(config, session_id)
    if video_path is None:
        raise FileNotFoundError(session_id)

    subtitle_path = get_session_subtitle_path(config, session_id, language, "srt")
    if not subtitle_path.exists():
        raise FileNotFoundError(subtitle_path.name)

    output_path = get_session_subtitled_video_path(config, session_id, language)
    filter_arg = f"subtitles={subtitle_path.name}"
    command = [
        "ffmpeg",
        "-i",
        str(video_path),
        "-vf",
        filter_arg,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-y",
        str(output_path),
    ]

    result = await asyncio.to_thread(
        subprocess.run,
        command,
        cwd=str(get_session_dir(config, session_id)),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg subtitle export failed.")

    return output_path


def _parse_translation_response(response_text: str, source_segments: list[dict[str, object]]) -> dict[int, str]:
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise ValueError("Translation response is not valid JSON.") from error

    response_segments = payload.get("segments") if isinstance(payload, dict) else None
    if not isinstance(response_segments, list):
        raise ValueError("Translation response must include a segments array.")

    expected_indices = {int(segment["index"]) for segment in source_segments}
    translated: dict[int, str] = {}
    for item in response_segments:
        if not isinstance(item, dict):
            continue
        index = item.get("index")
        text = str(item.get("text", "")).strip()
        if not isinstance(index, int) or index not in expected_indices or not text:
            continue
        translated[index] = text

    if expected_indices - set(translated):
        missing = sorted(expected_indices - set(translated))
        raise ValueError(f"Translation response missed segments: {missing}.")

    return translated


def _format_subtitle_text(text: str) -> str:
    lines = textwrap.wrap(" ".join(text.split()), width=42)
    return "\n".join(lines[:2] or [""])


def _format_srt_timestamp(total_seconds: float) -> str:
    hours, minutes, seconds, millis = _split_timestamp(total_seconds)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def _format_vtt_timestamp(total_seconds: float) -> str:
    hours, minutes, seconds, millis = _split_timestamp(total_seconds)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def _split_timestamp(total_seconds: float) -> tuple[int, int, int, int]:
    safe = max(0.0, total_seconds)
    total_millis = round(safe * 1000)
    millis = total_millis % 1000
    total_seconds_int = total_millis // 1000
    seconds = total_seconds_int % 60
    total_minutes = total_seconds_int // 60
    minutes = total_minutes % 60
    hours = total_minutes // 60
    return hours, minutes, seconds, millis
