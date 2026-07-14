"""Transcription management API."""

from __future__ import annotations

from typing import Any
import asyncio
import os
import uuid
from time import perf_counter
from difflib import SequenceMatcher

from fastapi import APIRouter, HTTPException

from app.transcription import get_engine, get_default_engine, list_engines
from app.transcription.hardware import inspect_hardware, recommend_model
from app.transcription.downloads import get_model_dir, remove_model, verify_model_files

router = APIRouter(prefix="/api/transcription", tags=["transcription"])
DOWNLOAD_JOBS: dict[str, dict[str, Any]] = {}
DOWNLOAD_TASKS: dict[str, asyncio.Task[None]] = {}


async def _run_download(download_id: str, engine_id: str, model_id: str) -> None:
    job = DOWNLOAD_JOBS[download_id]
    engine = get_engine(engine_id)
    if engine is None:
        job.update(state="failed", error="Engine unavailable.")
        return
    job.update(state="downloading")
    try:
        path = await engine.download(model_id, get_model_dir(model_id))
        job.update(state="verifying")
        verification = engine.verify(model_id, path)
        if not verification.get("ok"):
            raise RuntimeError(str(verification.get("reason") or verification.get("error") or "Verification failed."))
        job.update(state="ready", path=str(path), verification=verification)
    except asyncio.CancelledError:
        # Hugging Face/faster-whisper keeps completed cache chunks, so a resumed
        # job continues from the durable cache instead of deleting partial data.
        if job.get("state") != "cancelled":
            job.update(state="paused", error=None)
        raise
    except Exception as error:
        job.update(state="failed", error=str(error))
    finally:
        DOWNLOAD_TASKS.pop(download_id, None)


def _start_download_task(download_id: str) -> None:
    job = DOWNLOAD_JOBS[download_id]
    task = asyncio.create_task(_run_download(download_id, str(job["engine_id"]), str(job["model_id"])))
    DOWNLOAD_TASKS[download_id] = task


@router.get("/runtime")
async def get_runtime() -> dict[str, object]:
    engines = list_engines()
    hardware = inspect_hardware()
    recommendation = recommend_model(hardware)

    return {
        "engines": [e.model_dump(mode="json") for e in engines],
        "hardware": hardware.model_dump(mode="json"),
        "recommendation": recommendation,
    }


@router.get("/engines")
async def get_engines() -> list[dict[str, object]]:
    return [e.model_dump(mode="json") for e in list_engines()]


@router.get("/models")
async def get_models(engine_id: str = "faster_whisper") -> dict[str, object]:
    engine = get_engine(engine_id)
    if not engine:
        raise HTTPException(status_code=404, detail=f"Engine not found: {engine_id}")

    models = await engine.fetch_catalog()
    return {
        "engine_id": engine_id,
        "models": [
            {
                **m.model_dump(mode="json"),
                "installed": engine.verify(m.model_id, get_model_dir(m.model_id)).get("ok", False),
            }
            for m in models
        ],
    }


@router.post("/models/{model_id}/download")
async def download_model(model_id: str, engine_id: str = "faster_whisper") -> dict[str, object]:
    if get_engine(engine_id) is None:
        raise HTTPException(status_code=404, detail="Engine not found.")
    download_id = str(uuid.uuid4())
    DOWNLOAD_JOBS[download_id] = {"download_id": download_id, "engine_id": engine_id, "model_id": model_id, "state": "queued", "error": None}
    _start_download_task(download_id)
    return DOWNLOAD_JOBS[download_id]


@router.get("/downloads/{download_id}")
async def get_download(download_id: str) -> dict[str, object]:
    job = DOWNLOAD_JOBS.get(download_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Download not found.")
    return job


@router.post("/downloads/{download_id}/pause")
async def pause_download(download_id: str) -> dict[str, object]:
    job = DOWNLOAD_JOBS.get(download_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Download not found.")
    if job.get("state") not in {"queued", "downloading"}:
        raise HTTPException(status_code=409, detail=f"Cannot pause a {job.get('state')} download.")
    job.update(state="paused", error=None)
    task = DOWNLOAD_TASKS.get(download_id)
    if task and not task.done():
        task.cancel()
    return job


@router.post("/downloads/{download_id}/resume")
async def resume_download(download_id: str) -> dict[str, object]:
    job = DOWNLOAD_JOBS.get(download_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Download not found.")
    if job.get("state") not in {"paused", "failed"}:
        raise HTTPException(status_code=409, detail=f"Cannot resume a {job.get('state')} download.")
    task = DOWNLOAD_TASKS.get(download_id)
    if task and not task.done():
        raise HTTPException(status_code=409, detail="Download is still stopping; retry in a moment.")
    job.update(state="queued", error=None)
    _start_download_task(download_id)
    return job


@router.delete("/downloads/{download_id}")
async def cancel_download(download_id: str) -> dict[str, object]:
    job = DOWNLOAD_JOBS.get(download_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Download not found.")
    task = DOWNLOAD_TASKS.get(download_id)
    if task and not task.done():
        task.cancel()
    job.update(state="cancelled", error=None)
    return job


@router.patch("/active")
async def set_active_model(payload: dict[str, Any]) -> dict[str, object]:
    model_id = str(payload.get("model_id", ""))
    if not model_id:
        raise HTTPException(status_code=400, detail="model_id is required.")
    engine_id = str(payload.get("engine_id", "faster_whisper"))
    engine = get_engine(engine_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Engine not found.")
    verification = engine.verify(model_id, get_model_dir(model_id))
    if not verification.get("ok"):
        raise HTTPException(status_code=400, detail={"message": "Model is not fully installed or verified.", "verification": verification})
    from app.services.config import update_config
    updated = update_config({"whisper": {"model": model_id}})
    return {"model_id": updated.whisper.model, "active": True, "verification": verification}


@router.delete("/models/{model_id}")
async def delete_model(model_id: str) -> dict[str, object]:
    from app.services.config import load_config
    active_model = load_config().whisper.model
    if model_id == active_model:
        raise HTTPException(status_code=409, detail="Choose another installed model before removing the active model.")
    result = remove_model(model_id, get_model_dir(model_id))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("reason", "Removal failed."))
    return result


@router.post("/models/{model_id}/verify")
async def verify_model(model_id: str, engine_id: str = "faster_whisper") -> dict[str, object]:
    engine = get_engine(engine_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Engine not found.")

    from pathlib import Path
    import os
    from app.core.settings import PATHS

    model_path = PATHS.whisper_cache_dir / f"models--{model_id}"
    result = engine.verify(model_id, model_path)

    return result


@router.post("/models/{model_id}/benchmark")
async def benchmark_model(model_id: str, engine_id: str = "faster_whisper") -> dict[str, object]:
    engine = get_engine(engine_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Engine not found.")

    from pathlib import Path
    from app.core.settings import PATHS

    model_path = PATHS.whisper_cache_dir / f"models--{model_id}"
    resources = Path(os.environ.get("PRAXIS_RESOURCES_PATH", "")) if os.environ.get("PRAXIS_RESOURCES_PATH") else None
    bundled_dir = resources / "benchmark" if resources else Path(__file__).resolve().parents[3] / "assets" / "benchmark"
    sample_path = bundled_dir / "sample.wav"

    if not sample_path.exists():
        return {
            "ok": False,
            "model_id": model_id,
            "message": "The bundled licensed benchmark clip is missing from this installation.",
        }

    result = engine.benchmark(model_id, model_path, sample_path)
    return result.model_dump(mode="json")


@router.get("/hardware")
async def get_hardware_info() -> dict[str, object]:
    hardware = inspect_hardware()
    recommendation = recommend_model(hardware)
    return {
        "hardware": hardware.model_dump(mode="json"),
        "recommendation": recommendation,
    }


@router.get("/comparison-sessions")
async def get_comparison_sessions() -> dict[str, object]:
    from app.services.config import load_config
    from app.services.index import list_sessions
    config = load_config()
    sessions = [item for item in list_sessions(config, limit=50) if item.get("status") == "ready"]
    return {"sessions": [
        {"id": item["id"], "title": item.get("title") or item["id"], "created_at": item["created_at"], "duration_seconds": item["duration_seconds"]}
        for item in sessions if item.get("save_mode") != "video_only"
    ][:20]}


@router.post("/models/{model_id}/compare/{session_id}")
async def compare_model_with_session(model_id: str, session_id: str, engine_id: str = "faster_whisper") -> dict[str, object]:
    """Transcribe an existing journal audio track without replacing canonical files."""
    from app.services.config import load_config
    from app.services.sessions import extract_session_audio, load_session_meta, load_session_transcript_payload
    engine = get_engine(engine_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Engine not found.")
    model_path = get_model_dir(model_id)
    verification = engine.verify(model_id, model_path)
    if not verification.get("ok"):
        raise HTTPException(status_code=400, detail="Install and verify this model first.")
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
        canonical = load_session_transcript_payload(config, session_id).get("transcript", [])
        audio_path = await extract_session_audio(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Journal session not found.") from None
    started = perf_counter()
    candidate = await asyncio.to_thread(
        engine.transcribe, model_id, model_path, audio_path,
        language=meta.language, device=config.whisper.device, compute_type=config.whisper.compute_type,
    )
    elapsed = perf_counter() - started
    canonical_text = " ".join(str(item.get("text", "")) for item in canonical).strip()
    candidate_text = " ".join(str(item.get("text", "")) for item in candidate).strip()
    similarity = SequenceMatcher(None, canonical_text.casefold(), candidate_text.casefold()).ratio() if canonical_text else 0.0
    return {
        "model_id": model_id, "session_id": session_id, "canonical_preserved": True,
        "processing_seconds": round(elapsed, 2),
        "real_time_factor": round(elapsed / max(float(meta.duration_seconds or 0), 0.1), 2),
        "text_similarity_percent": round(similarity * 100, 1),
        "candidate_segment_count": len(candidate), "candidate_text": candidate_text,
    }
