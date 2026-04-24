from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata

from fastapi import UploadFile

from app.models import ConfigModel, MetaModel
from app.services.config import ensure_journal_dir, resolve_journal_dir
from app.services.json_io import read_json_file, write_json_file


def generate_session_slug(title: str | None, existing_slugs: set[str] | None = None) -> str:
    source = (title or "").strip()
    normalized = unicodedata.normalize("NFKD", source)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = slug or "untitled"

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

    slug = generate_session_slug(title, existing_slugs=existing_slugs)
    session_id = generate_session_id(created_at_value, language, slug)
    session_dir = journal_dir / session_id
    session_dir.mkdir(parents=True, exist_ok=False)

    normalized_title = (title or "").strip()
    meta = MetaModel(
        id=session_id,
        created_at=created_at_value.isoformat(),
        language=language,
        title=normalized_title or "untitled",
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


def assemble_session_video(config: ConfigModel, session_id: str) -> Path:
    manifest = load_session_chunk_manifest(config, session_id)
    if not manifest["chunks"]:
        raise ValueError("No uploaded chunks found.")

    chunk_paths: list[Path] = []
    for entry in manifest["chunks"]:
        chunk_path = Path(entry["path"])
        if not chunk_path.exists():
            raise FileNotFoundError(f"Missing chunk file: {chunk_path}")
        chunk_paths.append(chunk_path)

    concat_list_path = get_session_concat_list_path(config, session_id)
    concat_list_path.write_text(
        "".join(_ffmpeg_concat_line(chunk_path) for chunk_path in chunk_paths),
        encoding="utf-8",
    )

    output_path = get_session_dir(config, session_id) / "video.webm"
    command = [
        "ffmpeg",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_list_path),
        "-c",
        "copy",
        "-y",
        str(output_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg concat failed.")

    return output_path


def probe_session_video(video_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffprobe validation failed.")

    try:
        duration_seconds = float(result.stdout.strip())
    except ValueError as error:
        raise RuntimeError("ffprobe did not return a valid duration.") from error

    if duration_seconds <= 0:
        raise RuntimeError("Assembled video is not playable.")

    return duration_seconds


def validate_session_video(video_path: Path) -> None:
    probe_session_video(video_path)


def resolve_final_save_mode(meta: MetaModel, requested_save_mode: str | None = None) -> str:
    if meta.language == "tmz":
        return "video_only"

    return requested_save_mode or meta.save_mode


def finalize_session(
    config: ConfigModel,
    session_id: str,
    *,
    title: str | None = None,
    save_mode: str | None = None,
) -> MetaModel:
    meta = load_session_meta(config, session_id)
    video_path = assemble_session_video(config, session_id)
    duration_seconds = probe_session_video(video_path)
    file_size_bytes = video_path.stat().st_size
    final_save_mode = resolve_final_save_mode(meta, save_mode)
    final_status = "video_only" if final_save_mode == "video_only" else "saved"

    normalized_title = (title or "").strip()
    next_title = normalized_title or meta.title or "untitled"
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
    write_json_file(get_session_dir(config, session_id) / "meta.json", updated_meta.model_dump(mode="json"))
    return updated_meta


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


def load_session_bundle(config: ConfigModel, session_id: str) -> dict[str, object] | None:
    session_dir = get_session_dir(config, session_id)
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        return None
    transcript_text_path = session_dir / "transcript.txt"
    transcript_json_path = session_dir / "transcript.json"
    analysis_path = session_dir / "analysis.json"

    transcript_text = None
    if transcript_text_path.exists():
        transcript_text = transcript_text_path.read_text(encoding="utf-8")

    transcript = None
    if transcript_json_path.exists():
        transcript = read_json_file(transcript_json_path)

    analysis = None
    if analysis_path.exists():
        analysis = read_json_file(analysis_path)

    return {
        "meta": meta.model_dump(mode="json"),
        "transcript_text": transcript_text,
        "transcript": transcript,
        "analysis": analysis,
    }


def delete_session_dir(config: ConfigModel, session_id: str) -> bool:
    session_dir = get_session_dir(config, session_id)
    if not session_dir.exists():
        return False

    shutil.rmtree(session_dir)
    return True
