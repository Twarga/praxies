"""Transcription model download queue and lifecycle management."""

from __future__ import annotations

import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from app.core.settings import PATHS
from app.transcription.faster_whisper_engine import FASTER_WHISPER_MODELS


DownloadProgressCallback = Callable[[dict[str, Any]], None]

DOWNLOAD_STATES = {
    "not_installed": "not_installed",
    "queued": "queued",
    "downloading": "downloading",
    "paused": "paused",
    "verifying": "verifying",
    "testing": "testing",
    "ready": "ready",
    "failed": "failed",
}


class ModelDownloadJob:
    def __init__(self, model_id: str, engine_id: str, destination: Path) -> None:
        self.model_id = model_id
        self.engine_id = engine_id
        self.destination = destination
        self.state = "queued"
        self.total_bytes: int = 0
        self.downloaded_bytes: int = 0
        self.started_at: str | None = None
        self.finished_at: str | None = None
        self.error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "engine_id": self.engine_id,
            "state": self.state,
            "total_bytes": self.total_bytes,
            "downloaded_bytes": self.downloaded_bytes,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
        }


def get_model_dir(model_id: str) -> Path:
    return PATHS.whisper_cache_dir / f"models--{model_id}"


def verify_model_files(model_id: str, model_path: Path) -> dict[str, Any]:
    if not model_path.exists():
        return {"ok": False, "reason": "Model directory does not exist."}

    files = list(model_path.rglob("*"))
    total_size = sum(f.stat().st_size for f in files if f.is_file())

    return {
        "ok": total_size > 0,
        "file_count": len([f for f in files if f.is_file()]),
        "total_size_bytes": total_size,
        "path": str(model_path),
        "verified_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def verify_model_checksum(model_path: Path, expected_hash: str | None = None) -> bool:
    if expected_hash is None:
        return True

    files = sorted(model_path.rglob("*"))
    hasher = hashlib.sha256()
    for f in files:
        if f.is_file():
            hasher.update(f.read_bytes())

    return hasher.hexdigest() == expected_hash


def check_model_smoke_test(model_id: str, model_path: Path) -> dict[str, Any]:
    from pathlib import Path as _Path
    import tempfile
    import wave

    smoke_path = _Path(tempfile.mktemp(suffix=".wav"))
    try:
        sample_rate = 16000
        duration = 0.5
        frame_count = max(1, int(sample_rate * duration))
        silence = b"\x00\x00" * frame_count
        with wave.open(str(smoke_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(silence)

        from app.transcription.faster_whisper_engine import FasterWhisperEngine
        engine = FasterWhisperEngine()
        segments = engine.transcribe(model_id, model_path, smoke_path, language="en")

        return {
            "ok": True,
            "segment_count": len(segments),
            "model_id": model_id,
            "tested_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        }
    except Exception as error:
        return {
            "ok": False,
            "error": str(error),
            "model_id": model_id,
        }
    finally:
        smoke_path.unlink(missing_ok=True)


def activate_model(model_id: str, model_path: Path) -> dict[str, Any]:
    verification = verify_model_files(model_id, model_path)
    if not verification["ok"]:
        return {"ok": False, "reason": "Model verification failed before activation.", "verification": verification}

    return {
        "ok": True,
        "model_id": model_id,
        "activated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "model_path": str(model_path),
    }


def rollback_activation(model_id: str, previous_model_id: str) -> dict[str, Any]:
    return {
        "ok": True,
        "rolled_back_to": previous_model_id,
        "failed_model": model_id,
        "message": f"Activation of {model_id} failed. Restored {previous_model_id}.",
    }


def check_removal_safe(model_id: str, active_model_id: str) -> dict[str, Any]:
    if model_id == active_model_id:
        model_dir = get_model_dir(model_id)
        alternatives = [
            m.model_id for m in FASTER_WHISPER_MODELS
            if m.model_id != model_id and get_model_dir(m.model_id).exists()
        ]
        return {
            "ok": False,
            "reason": "Cannot remove the currently active model without an alternative installed.",
            "alternatives": alternatives,
        }
    return {"ok": True}


def remove_model(model_id: str, model_path: Path) -> dict[str, Any]:
    if not model_path.exists():
        return {"ok": False, "reason": "Model directory does not exist."}

    total_size = sum(f.stat().st_size for f in model_path.rglob("*") if f.is_file())

    shutil.rmtree(model_path)
    return {
        "ok": True,
        "model_id": model_id,
        "reclaimed_bytes": total_size,
        "removed_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def relocate_cache(
    current_path: Path,
    new_path: Path,
    *,
    model_id: str,
) -> dict[str, Any]:
    if not current_path.exists():
        return {"ok": False, "reason": "Source cache path does not exist."}

    new_path.parent.mkdir(parents=True, exist_ok=True)

    shutil.copytree(current_path, new_path, dirs_exist_ok=True)

    new_verification = verify_model_files(model_id, new_path)
    if not new_verification["ok"]:
        shutil.rmtree(new_path, ignore_errors=True)
        return {"ok": False, "reason": "Relocated model failed verification. Source preserved."}

    return {
        "ok": True,
        "old_path": str(current_path),
        "new_path": str(new_path),
        "model_id": model_id,
        "message": "Model relocated and verified. Remove the old location manually.",
    }


def estimate_model_size(model_id: str) -> dict[str, Any]:
    model = next((m for m in FASTER_WHISPER_MODELS if m.model_id == model_id), None)
    if model is None:
        return {"ok": False, "reason": f"Unknown model: {model_id}"}

    return {
        "ok": True,
        "model_id": model_id,
        "estimated_disk_gb": model.estimated_disk_gb,
        "estimated_ram_gb": model.estimated_ram_gb,
        "estimated_bytes": int(model.estimated_disk_gb * 1024**3),
    }
