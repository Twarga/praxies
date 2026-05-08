from __future__ import annotations

import asyncio
from typing import Any
from datetime import date, datetime
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata

from fastapi import UploadFile

from app.models import ConfigModel, MetaModel, MetaProcessingTerminalLineModel
from app.services.analysis_service import validate_analysis_payload
from app.services.config import ensure_journal_dir, resolve_journal_dir
from app.services.json_io import read_json_file, write_json_file
from app.services.media_tools import resolve_media_binary


TRUNCATED_VIDEO_SIZE_RATIO = 1.15
MAX_PROCESSING_TERMINAL_LINES = 40
SUPPORTED_SUBTITLE_FORMATS = {"srt", "vtt"}


def generate_session_slug(title: str | None, existing_slugs: set[str] | None = None, fallback_slug: str = "take") -> str:
    source = (title or "").strip()
    normalized = unicodedata.normalize("NFKD", source)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = slug or fallback_slug

    if not existing_slugs:
        return slug

    existing = {value.lower() for value in existing_slugs}
    if slug not in existing:
        return slug

    suffix = 2
    while f"{slug}-{suffix}" in existing:
        suffix += 1

    return f"{slug}-{suffix}"


def generate_session_id(session_date: date | datetime | str, language: str, slug: str) -> str:
    if isinstance(session_date, datetime):
        date_part = session_date.date().isoformat()
    elif isinstance(session_date, date):
        date_part = session_date.isoformat()
    else:
        date_part = session_date

    return f"{date_part}_{language}_{slug}"


def discover_session_dirs(config: ConfigModel) -> list[Path]:
    journal_dir = resolve_journal_dir(config)
    if not journal_dir.exists():
        return []

    return sorted(
        [
            entry.resolve()
            for entry in journal_dir.iterdir()
            if entry.is_dir() and not entry.name.startswith("_")
        ]
    )


def create_session(
    config: ConfigModel,
    language: str,
    title: str | None = None,
    save_mode: str | None = None,
    created_at: datetime | None = None,
) -> MetaModel:
    journal_dir = ensure_journal_dir(config)
    created_at_value = created_at or datetime.now().astimezone()
    date_prefix = created_at_value.date().isoformat()
    session_prefix = f"{date_prefix}_{language}_"
    existing_slugs = {
        session_dir.name[len(session_prefix) :]
        for session_dir in discover_session_dirs(config)
        if session_dir.name.startswith(session_prefix)
    }

    slug = generate_session_slug(title, existing_slugs=existing_slugs, fallback_slug="take")
    session_id = generate_session_id(created_at_value, language, slug)
    session_dir = journal_dir / session_id
    session_dir.mkdir(parents=True, exist_ok=False)

    normalized_title = (title or "").strip()
    formatted_time = created_at_value.strftime("%I:%M %p").lstrip("0")
    default_title = f"Take at {formatted_time}"
    meta = MetaModel(
        id=session_id,
        created_at=created_at_value.isoformat(),
        language=language,
        title=normalized_title or default_title,
        title_source="user" if normalized_title else "default",
        duration_seconds=0,
        file_size_bytes=0,
        status="recording",
        save_mode=save_mode or "full",
        source="webcam",
        video_filename="video.webm",
        error=None,
        read=False,
        processing={},
        retention={
            "video_kept_until": None,
            "compressed": False,
        },
    )
    write_json_file(session_dir / "meta.json", meta.model_dump(mode="json"))
    return meta


def get_session_chunks_dir(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "_chunks"


def get_session_chunk_manifest_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "chunk_manifest.json"


def load_session_chunk_manifest(config: ConfigModel, session_id: str) -> dict[str, object]:
    manifest_path = get_session_chunk_manifest_path(config, session_id)
    if not manifest_path.exists():
        return {
            "session_id": session_id,
            "created_at": None,
            "updated_at": None,
            "chunks": [],
        }

    return read_json_file(manifest_path)


def load_session_meta(config: ConfigModel, session_id: str) -> MetaModel:
    meta_path = get_session_dir(config, session_id) / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(session_id)

    return MetaModel.model_validate(read_json_file(meta_path))


def save_session_meta(config: ConfigModel, meta: MetaModel) -> MetaModel:
    write_json_file(get_session_dir(config, meta.id) / "meta.json", meta.model_dump(mode="json"))
    return meta


def update_session_meta(
    config: ConfigModel,
    session_id: str,
    *,
    updates: dict[str, Any] | None = None,
    processing_updates: dict[str, Any] | None = None,
) -> MetaModel:
    meta = load_session_meta(config, session_id)
    next_updates = dict(updates or {})

    if processing_updates:
        next_updates["processing"] = meta.processing.model_copy(update=processing_updates)

    updated_meta = meta.model_copy(update=next_updates)
    return save_session_meta(config, updated_meta)


def append_session_processing_event(
    config: ConfigModel,
    session_id: str,
    *,
    message: str,
    level: str = "info",
    progress_label: str | None = None,
    progress_percent: int | None = None,
    model_used: str | None = None,
    reset_terminal: bool = False,
) -> MetaModel:
    meta = load_session_meta(config, session_id)
    terminal_lines = [] if reset_terminal else list(meta.processing.terminal_lines)
    terminal_lines.append(
        MetaProcessingTerminalLineModel(
            created_at=datetime.now().astimezone().isoformat(),
            level=level,
            message=message,
        )
    )
    terminal_lines = terminal_lines[-MAX_PROCESSING_TERMINAL_LINES:]

    processing_updates: dict[str, Any] = {"terminal_lines": terminal_lines}
    if progress_label is not None:
        processing_updates["progress_label"] = progress_label
    if progress_percent is not None:
        processing_updates["progress_percent"] = progress_percent
    if model_used is not None:
        processing_updates["model_used"] = model_used

    return update_session_meta(config, session_id, processing_updates=processing_updates)


def write_session_chunk_manifest(
    config: ConfigModel,
    session_id: str,
    *,
    chunk_index: int,
    chunk_path: Path,
    chunk_size_bytes: int,
    recorded_at: datetime | None = None,
) -> dict[str, object]:
    now = (recorded_at or datetime.now().astimezone()).isoformat()
    manifest = load_session_chunk_manifest(config, session_id)
    chunks = [entry for entry in manifest["chunks"] if entry["chunk_index"] != chunk_index]
    chunks.append(
        {
            "chunk_index": chunk_index,
            "filename": chunk_path.name,
            "path": str(chunk_path),
            "size_bytes": chunk_size_bytes,
            "uploaded_at": now,
        }
    )
    chunks.sort(key=lambda entry: entry["chunk_index"])

    created_at = manifest["created_at"] or now
    next_manifest = {
        "session_id": session_id,
        "created_at": created_at,
        "updated_at": now,
        "chunks": chunks,
    }
    write_json_file(get_session_chunk_manifest_path(config, session_id), next_manifest)
    return next_manifest


def get_session_concat_list_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_chunks_dir(config, session_id) / "concat-list.txt"


def _ffmpeg_concat_line(path: Path) -> str:
    escaped = str(path.resolve()).replace("'", "'\\''")
    return f"file '{escaped}'\n"


def get_session_audio_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "audio.wav"


def get_session_transcript_text_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "transcript.txt"


def get_session_transcript_json_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "transcript.json"


def get_session_analysis_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "analysis.json"


def get_session_analysis_raw_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "analysis_raw.txt"


def get_session_waveform_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "waveform.json"


def get_session_subtitle_segments_path(config: ConfigModel, session_id: str, language: str) -> Path:
    return get_session_dir(config, session_id) / f"subtitles.{language}.json"


def get_session_subtitle_path(config: ConfigModel, session_id: str, language: str, subtitle_format: str) -> Path:
    if subtitle_format not in SUPPORTED_SUBTITLE_FORMATS:
        raise ValueError("Unsupported subtitle format.")
    return get_session_dir(config, session_id) / f"subtitles.{language}.{subtitle_format}"


def get_session_subtitled_video_path(config: ConfigModel, session_id: str, language: str) -> Path:
    return get_session_dir(config, session_id) / f"video_subtitled_{language}.mp4"


def get_session_thumbnail_output_path(config: ConfigModel, session_id: str) -> Path:
    return get_session_dir(config, session_id) / "thumbnail.jpg"


def write_session_transcript_text(config: ConfigModel, session_id: str, segments: list[Any]) -> Path:
    transcript_path = get_session_transcript_text_path(config, session_id)
    lines = [
        text
        for segment in segments
        for text in [str(getattr(segment, "text", "")).strip()]
        if text
    ]
    transcript_text = "\n".join(lines)
    transcript_path.write_text(f"{transcript_text}\n" if transcript_text else "", encoding="utf-8")
    return transcript_path


def write_session_transcript_json(config: ConfigModel, session_id: str, segments: list[Any]) -> Path:
    transcript_path = get_session_transcript_json_path(config, session_id)
    payload = [
        {
            "start_seconds": float(getattr(segment, "start", 0.0) or 0.0),
            "end_seconds": float(getattr(segment, "end", 0.0) or 0.0),
            "text": text,
        }
        for segment in segments
        for text in [str(getattr(segment, "text", "")).strip()]
        if text
    ]
    write_json_file(transcript_path, payload)
    return transcript_path


def infer_duration_from_transcript_segments(segments: list[Any]) -> float:
    duration_seconds = 0.0

    for segment in segments:
        if isinstance(segment, dict):
            raw_end = segment.get("end_seconds", segment.get("end", 0.0))
        else:
            raw_end = getattr(segment, "end_seconds", getattr(segment, "end", 0.0))

        try:
            end_seconds = float(raw_end or 0.0)
        except (TypeError, ValueError):
            continue

        duration_seconds = max(duration_seconds, end_seconds)

    return duration_seconds


def infer_session_duration_from_transcript(config: ConfigModel, session_id: str) -> float:
    transcript_path = get_session_transcript_json_path(config, session_id)
    if not transcript_path.exists():
        return 0.0

    payload = read_json_file(transcript_path)
    if isinstance(payload, dict):
        segments = payload.get("segments") or payload.get("transcript") or []
    elif isinstance(payload, list):
        segments = payload
    else:
        segments = []

    return infer_duration_from_transcript_segments(segments)


def repair_session_duration_from_transcript(config: ConfigModel, session_id: str) -> MetaModel:
    meta = load_session_meta(config, session_id)
    inferred_duration = infer_session_duration_from_transcript(config, session_id)

    if inferred_duration > float(meta.duration_seconds or 0.0) + 0.5:
        return update_session_meta(
            config,
            session_id,
            updates={"duration_seconds": inferred_duration},
        )

    return meta


def write_session_analysis(config: ConfigModel, session_id: str, payload: dict[str, Any]) -> Path:
    analysis = validate_analysis_payload(payload)
    analysis_path = get_session_analysis_path(config, session_id)
    write_json_file(analysis_path, analysis.model_dump(mode="json"))
    return analysis_path


def write_session_analysis_raw(config: ConfigModel, session_id: str, response_text: str) -> Path:
    raw_path = get_session_analysis_raw_path(config, session_id)
    raw_path.write_text(response_text, encoding="utf-8")
    return raw_path


def write_session_waveform(config: ConfigModel, session_id: str, bins: list[float]) -> Path:
    waveform_path = get_session_waveform_path(config, session_id)
    write_json_file(waveform_path, bins)
    return waveform_path


def load_session_transcript_payload(config: ConfigModel, session_id: str) -> dict[str, object | None]:
    transcript_text_path = get_session_transcript_text_path(config, session_id)
    transcript_json_path = get_session_transcript_json_path(config, session_id)

    transcript_text = None
    if transcript_text_path.exists():
        transcript_text = transcript_text_path.read_text(encoding="utf-8")

    transcript = None
    if transcript_json_path.exists():
        transcript = read_json_file(transcript_json_path)

    return {
        "transcript_text": transcript_text,
        "transcript": transcript,
    }


def load_session_waveform_payload(config: ConfigModel, session_id: str) -> list[float] | None:
    waveform_path = get_session_waveform_path(config, session_id)
    if not waveform_path.exists():
        return None

    return read_json_file(waveform_path)


def load_session_subtitle_segments(config: ConfigModel, session_id: str, language: str) -> list[dict[str, object]] | None:
    segments_path = get_session_subtitle_segments_path(config, session_id, language)
    if not segments_path.exists():
        return None

    return read_json_file(segments_path)


def list_session_subtitle_tracks(config: ConfigModel, session_id: str) -> list[dict[str, object]]:
    session_dir = get_session_dir(config, session_id)
    if not session_dir.exists():
        return []

    tracks: list[dict[str, object]] = []
    for vtt_path in sorted(session_dir.glob("subtitles.*.vtt")):
        parts = vtt_path.name.split(".")
        if len(parts) != 3:
            continue
        language = parts[1]
        tracks.append(
            {
                "language": language,
                "vtt_filename": vtt_path.name,
                "srt_filename": f"subtitles.{language}.srt",
            }
        )

    return tracks


def list_session_subtitled_exports(config: ConfigModel, session_id: str) -> list[dict[str, object]]:
    session_dir = get_session_dir(config, session_id)
    if not session_dir.exists():
        return []

    exports: list[dict[str, object]] = []
    for video_path in sorted(session_dir.glob("video_subtitled_*.mp4")):
        language = video_path.stem.removeprefix("video_subtitled_")
        exports.append(
            {
                "language": language,
                "filename": video_path.name,
                "size_bytes": video_path.stat().st_size,
            }
        )

    return exports


async def store_session_chunk(
    config: ConfigModel,
    session_id: str,
    chunk_index: int,
    upload: UploadFile,
) -> tuple[Path, dict[str, object]]:
    session_dir = get_session_dir(config, session_id)
    meta_path = session_dir / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(session_id)

    chunks_dir = get_session_chunks_dir(config, session_id)
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_path = chunks_dir / f"chunk-{chunk_index:06d}.webm"
    with chunk_path.open("wb") as chunk_file:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            chunk_file.write(chunk)

    await upload.close()
    manifest = write_session_chunk_manifest(
        config,
        session_id,
        chunk_index=chunk_index,
        chunk_path=chunk_path,
        chunk_size_bytes=chunk_path.stat().st_size,
    )
    return chunk_path, manifest


async def assemble_session_video(config: ConfigModel, session_id: str) -> Path:
    manifest = load_session_chunk_manifest(config, session_id)
    if not manifest["chunks"]:
        raise ValueError("No uploaded chunks found.")

    chunk_paths: list[Path] = []
    for entry in manifest["chunks"]:
        chunk_path = Path(entry["path"])
        if not chunk_path.exists():
            raise FileNotFoundError(f"Missing chunk file: {chunk_path}")
        chunk_paths.append(chunk_path)

    output_path = get_session_dir(config, session_id) / "video.webm"

    if len(chunk_paths) == 1:
        # Single chunk — just copy directly, no re-encode needed.
        shutil.copy2(chunk_paths[0], output_path)
    else:
        # MediaRecorder with a timeslice produces continuation Matroska clusters,
        # NOT standalone WebM files. Only chunk 0 has a valid header; the rest are
        # raw cluster data. Concatenating the raw bytes reconstructs the original
        # stream, then we remux with ffmpeg to get a proper container with correct
        # duration metadata. This is zero-quality-loss.
        raw_path = get_session_chunks_dir(config, session_id) / "raw_joined.webm"
        with raw_path.open("wb") as out_file:
            for chunk_path in chunk_paths:
                out_file.write(chunk_path.read_bytes())

        command = [
            resolve_media_binary("ffmpeg"),
            "-i", str(raw_path),
            "-c", "copy",
            "-y",
            str(output_path),
        ]
        result = await asyncio.to_thread(
            subprocess.run, command, capture_output=True, text=True, check=False
        )
        # Clean up the raw joined file regardless of outcome.
        raw_path.unlink(missing_ok=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "ffmpeg remux failed.")

    return output_path


def should_repair_session_video(
    meta: MetaModel,
    manifest: dict[str, object],
    video_path: Path | None = None,
) -> bool:
    if meta.status == "recording":
        return False

    chunk_entries = [
        entry
        for entry in manifest.get("chunks", [])
        if isinstance(entry, dict)
    ]
    if len(chunk_entries) < 2:
        return False

    chunk_sizes = [int(entry.get("size_bytes") or 0) for entry in chunk_entries]
    first_chunk_size = chunk_sizes[0]
    total_chunk_size = sum(chunk_sizes)
    if first_chunk_size <= 0 or total_chunk_size <= first_chunk_size:
        return False

    current_size = 0
    if video_path is not None and video_path.exists():
        current_size = video_path.stat().st_size
    elif meta.file_size_bytes > 0:
        current_size = meta.file_size_bytes

    if current_size <= 0:
        return True

    return current_size <= int(first_chunk_size * TRUNCATED_VIDEO_SIZE_RATIO)


async def repair_session_video_if_needed(config: ConfigModel, session_id: str) -> bool:
    meta = load_session_meta(config, session_id)
    manifest = load_session_chunk_manifest(config, session_id)
    video_path = get_session_video_path(config, session_id)

    if not should_repair_session_video(meta, manifest, video_path):
        return False

    repaired_video_path = await assemble_session_video(config, session_id)
    duration_seconds = await probe_session_video(repaired_video_path)
    updated_meta = meta.model_copy(
        update={
            "duration_seconds": duration_seconds,
            "file_size_bytes": repaired_video_path.stat().st_size,
            "video_filename": repaired_video_path.name,
        }
    )
    save_session_meta(config, updated_meta)
    return True


async def extract_session_audio(config: ConfigModel, session_id: str) -> Path:
    video_path = get_session_video_path(config, session_id)
    if video_path is None:
        raise FileNotFoundError(session_id)

    audio_path = get_session_audio_path(config, session_id)
    command = [
        resolve_media_binary("ffmpeg"),
        "-i",
        str(video_path),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-y",
        str(audio_path),
    ]
    result = await asyncio.to_thread(subprocess.run, command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg audio extraction failed.")

    return audio_path


async def extract_session_thumbnail(config: ConfigModel, session_id: str) -> Path:
    video_path = get_session_video_path(config, session_id)
    if video_path is None:
        raise FileNotFoundError(session_id)

    duration_seconds = await probe_session_video(video_path)
    midpoint_seconds = max(duration_seconds / 2, 0)
    thumbnail_path = get_session_thumbnail_output_path(config, session_id)
    command = [
        resolve_media_binary("ffmpeg"),
        "-ss",
        f"{midpoint_seconds:.3f}",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        "-q:v",
        "3",
        "-y",
        str(thumbnail_path),
    ]
    result = await asyncio.to_thread(subprocess.run, command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg thumbnail extraction failed.")

    return thumbnail_path


async def probe_session_video(video_path: Path) -> float:
    command = [
        resolve_media_binary("ffprobe"),
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = await asyncio.to_thread(subprocess.run, command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffprobe validation failed.")

    try:
        raw_val = result.stdout.strip()
        if raw_val == "N/A":
            duration_seconds = 0.0
        else:
            duration_seconds = float(raw_val)
    except ValueError as error:
        raise RuntimeError("ffprobe did not return a valid duration.") from error

    if duration_seconds < 0:
        raise RuntimeError("Assembled video is not playable.")

    return duration_seconds


async def validate_session_video(video_path: Path) -> None:
    await probe_session_video(video_path)


def should_skip_processing_pipeline(meta: MetaModel) -> bool:
    return meta.save_mode == "video_only" or meta.status == "video_only"


def resolve_final_save_mode(meta: MetaModel, requested_save_mode: str | None = None) -> str:
    return requested_save_mode or meta.save_mode


async def finalize_session(
    config: ConfigModel,
    session_id: str,
    *,
    title: str | None = None,
    save_mode: str | None = None,
    duration_seconds_hint: float | None = None,
) -> MetaModel:
    meta = load_session_meta(config, session_id)
    video_path = await assemble_session_video(config, session_id)
    duration_seconds = await probe_session_video(video_path)
    if duration_seconds <= 0 and duration_seconds_hint and duration_seconds_hint > 0:
        duration_seconds = float(duration_seconds_hint)
    file_size_bytes = video_path.stat().st_size
    final_save_mode = resolve_final_save_mode(meta, save_mode)
    final_status = "video_only" if final_save_mode == "video_only" else "saved"

    normalized_title = (title or "").strip()
    next_title = normalized_title or meta.title
    next_title_source = "user" if normalized_title else meta.title_source
    updated_meta = meta.model_copy(
        update={
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size_bytes,
            "title": next_title,
            "title_source": next_title_source,
            "save_mode": final_save_mode,
            "status": final_status,
        }
    )
    saved_meta = save_session_meta(config, updated_meta)
    try:
        await extract_session_thumbnail(config, session_id)
    except Exception:
        # Thumbnail generation is helpful for gallery UX but should not block save.
        pass
    return saved_meta


def get_session_dir(config: ConfigModel, session_id: str) -> Path:
    return resolve_journal_dir(config) / session_id


def get_session_video_path(config: ConfigModel, session_id: str) -> Path | None:
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        return None

    video_filename = meta.video_filename or "video.webm"
    video_path = get_session_dir(config, session_id) / video_filename
    if not video_path.exists():
        return None

    return video_path


def get_session_thumbnail_path(config: ConfigModel, session_id: str) -> Path | None:
    try:
        load_session_meta(config, session_id)
    except FileNotFoundError:
        return None

    thumbnail_path = get_session_dir(config, session_id) / "thumbnail.jpg"
    if not thumbnail_path.exists():
        return None

    return thumbnail_path


def load_session_bundle(config: ConfigModel, session_id: str) -> dict[str, object] | None:
    session_dir = get_session_dir(config, session_id)
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        return None
    analysis_path = session_dir / "analysis.json"
    analysis_raw_path = get_session_analysis_raw_path(config, session_id)
    transcript_payload = load_session_transcript_payload(config, session_id)
    waveform = load_session_waveform_payload(config, session_id)

    analysis = None
    if analysis_path.exists():
        analysis = read_json_file(analysis_path)

    analysis_raw_text = None
    if analysis_raw_path.exists():
        analysis_raw_text = analysis_raw_path.read_text(encoding="utf-8")

    return {
        "meta": meta.model_dump(mode="json"),
        "practice_context": find_previous_session_goal(config, session_id),
        "transcript_text": transcript_payload["transcript_text"],
        "transcript": transcript_payload["transcript"],
        "waveform": waveform,
        "subtitles": list_session_subtitle_tracks(config, session_id),
        "subtitled_exports": list_session_subtitled_exports(config, session_id),
        "analysis": analysis,
        "analysis_raw_text": analysis_raw_text,
    }


def find_previous_session_goal(config: ConfigModel, session_id: str) -> dict[str, object] | None:
    try:
        current_meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        return None

    current_created_at = _parse_session_sort_datetime(current_meta.created_at)
    previous_metas: list[MetaModel] = []
    for session_dir in discover_session_dirs(config):
        if session_dir.name == session_id:
            continue
        try:
            meta = load_session_meta(config, session_dir.name)
        except FileNotFoundError:
            continue
        if _parse_session_sort_datetime(meta.created_at) < current_created_at:
            previous_metas.append(meta)

    previous_metas.sort(key=lambda meta: _parse_session_sort_datetime(meta.created_at), reverse=True)

    for meta in previous_metas:
        analysis_path = get_session_analysis_path(config, meta.id)
        if not analysis_path.exists():
            continue
        analysis = read_json_file(analysis_path)
        assignment = ((analysis.get("coaching_report") or {}).get("practice_assignment") or {})
        next_goal = str(assignment.get("next_session_goal") or "").strip()
        if next_goal:
            return {
                "source_session_id": meta.id,
                "source_title": meta.title,
                "source_created_at": meta.created_at,
                "goal": next_goal,
                "source_completed": meta.practice.assignment_completed,
            }

    return None


def _parse_session_sort_datetime(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return datetime.min


def mark_session_read(config: ConfigModel, session_id: str) -> MetaModel | None:
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        return None

    if meta.read:
        return meta

    updated_meta = meta.model_copy(update={"read": True})
    return save_session_meta(config, updated_meta)


def delete_session_dir(config: ConfigModel, session_id: str) -> bool:
    session_dir = get_session_dir(config, session_id)
    if not session_dir.exists():
        return False

    shutil.rmtree(session_dir)
    return True
