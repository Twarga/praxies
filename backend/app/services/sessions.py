from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import re
import shutil
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


def get_session_dir(config: ConfigModel, session_id: str) -> Path:
    return resolve_journal_dir(config) / session_id


def load_session_bundle(config: ConfigModel, session_id: str) -> dict[str, object] | None:
    session_dir = get_session_dir(config, session_id)
    meta_path = session_dir / "meta.json"

    if not meta_path.exists():
        return None

    meta = MetaModel.model_validate(read_json_file(meta_path))
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
