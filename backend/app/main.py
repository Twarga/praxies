import asyncio
import json
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response, StreamingResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.settings import APP_VERSION, PATHS
from app.models import ConfigModel
from app.services.analysis_service import (
    AnalysisNeedsAttentionError,
    AnalysisRetryExhaustedError,
    AnalysisValidationError,
    parse_and_validate_analysis_response,
    run_analysis_with_retries,
)
from app.services.config import dump_config_for_api, load_config, update_config
from app.services.digest import select_today_digest_session
from app.services.index import list_sessions, load_or_rebuild_index, rebuild_index
from app.services.llm_client import (
    LiteLLMClient,
    LlmClientError,
    get_active_llm_label,
    get_llm_provider_options,
)
from app.services.media_tools import resolve_media_binary
from app.services.openrouter_catalog import OpenRouterCatalogError, fetch_openrouter_models
from app.services.openrouter_status import OpenRouterStatusError, fetch_openrouter_key_status
from app.services.processing_queue import SessionProcessingQueue
from app.services.prompt_builder import (
    build_analysis_export_prompt,
    build_analysis_system_prompt,
    build_transcript_user_message,
)
from app.services.recurring_patterns import load_recurring_patterns
from app.services.retention import RETENTION_INTERVAL_SECONDS, run_retention_pass
from app.services.sessions import (
    append_session_processing_event,
    create_session,
    delete_session_dir,
    discover_session_dirs,
    extract_session_audio,
    extract_session_thumbnail,
    finalize_session,
    get_session_dir,
    repair_session_video_if_needed,
    load_session_meta,
    load_session_bundle,
    mark_session_read,
    probe_session_video,
    repair_session_duration_from_transcript,
    store_session_chunk,
    get_session_thumbnail_path,
    get_session_subtitle_path,
    get_session_subtitled_video_path,
    update_session_meta,
    get_session_video_path,
    load_session_transcript_payload,
    should_skip_processing_pipeline,
    write_session_analysis,
    write_session_analysis_raw,
    write_session_transcript_json,
    write_session_transcript_text,
    write_session_waveform,
)
from app.services.sse import SSEBroadcaster
from app.services.subtitle_service import (
    export_burned_subtitle_video,
    load_subtitle_segments,
    translate_subtitle_segments,
    write_subtitle_files,
)
from app.services.trends import build_trends_payload
from app.services.waveform_service import build_waveform_bins
from app.services.weekly_rollups import load_weekly_rollup
from app.services.whisper_service import WhisperService


whisper_service = WhisperService()
llm_client = LiteLLMClient()
sse_broadcaster = SSEBroadcaster()
retention_task: asyncio.Task | None = None


async def run_retention_check_once() -> dict[str, object]:
    config = load_config()
    summary = await asyncio.to_thread(run_retention_pass, config)
    if summary.get("compressed"):
        await rebuild_index_and_emit(config, "retention.compressed")
    return summary


async def _retention_loop(interval_seconds: int = RETENTION_INTERVAL_SECONDS) -> None:
    while True:
        try:
            await run_retention_check_once()
        except Exception:
            pass
        await asyncio.sleep(interval_seconds)


async def process_session(session_id: str) -> None:
    config = load_config()
    session_meta = load_session_meta(config, session_id)
    try:
        if should_skip_processing_pipeline(session_meta):
            await emit_session_status(session_meta)
            await rebuild_index_and_emit(config, "session.skip_processing")
            return

        started_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "transcribing", "error": None},
            processing_updates={
                "transcribe_started_at": started_at,
                "transcribe_finished_at": None,
                "analyze_started_at": None,
                "analyze_finished_at": None,
                "model_used": config.whisper.model,
                "progress_label": "Loading Whisper runtime",
                "progress_percent": 8,
                "terminal_lines": [],
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Booting Whisper model `{config.whisper.model}` on {config.whisper.device}.",
            progress_label="Loading Whisper runtime",
            progress_percent=8,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.status")

        whisper_service.get_model(config)
        append_session_processing_event(
            config,
            session_id,
            message="Whisper model ready. Extracting audio track and preparing preview assets.",
            progress_label="Preparing media",
            progress_percent=18,
            model_used=config.whisper.model,
        )

        audio_path = await extract_session_audio(config, session_id)
        waveform_bins = await asyncio.to_thread(build_waveform_bins, audio_path)
        write_session_waveform(config, session_id, waveform_bins)
        append_session_processing_event(
            config,
            session_id,
            message=f"Built real waveform with {len(waveform_bins)} bins from the captured audio.",
            progress_label="Preparing media",
            progress_percent=28,
        )

        await extract_session_thumbnail(config, session_id)
        append_session_processing_event(
            config,
            session_id,
            message="Thumbnail extracted. Running transcription now.",
            progress_label="Transcribing speech",
            progress_percent=36,
        )
        segments, _info = await asyncio.to_thread(
            whisper_service.transcribe, str(audio_path), config, language=session_meta.language
        )
        segment_list = list(segments)
        write_session_transcript_text(config, session_id, segment_list)
        write_session_transcript_json(config, session_id, segment_list)
        repair_session_duration_from_transcript(config, session_id)
        transcript_payload = load_session_transcript_payload(config, session_id)
        write_subtitle_files(
            config,
            session_id,
            language=session_meta.language,
            segments=transcript_payload["transcript"],
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Transcription finished with {len(segment_list)} timestamped segments and subtitles.",
            level="success",
            progress_label="Transcript saved",
            progress_percent=58,
        )

        transcribe_finished_at = datetime_now_iso()
        session_meta = load_session_meta(config, session_id)
        if session_meta.save_mode == "transcribe_only":
            update_session_meta(
                config,
                session_id,
                updates={"status": "ready", "error": None},
                processing_updates={
                    "transcribe_finished_at": transcribe_finished_at,
                    "progress_label": "Transcript ready",
                    "progress_percent": 100,
                },
            )
            append_session_processing_event(
                config,
                session_id,
                message="Session completed in transcript-only mode.",
                level="success",
                progress_label="Transcript ready",
                progress_percent=100,
            )
            await emit_session_status_from_id(config, session_id)
            await rebuild_index_and_emit(config, "session.ready")
            return

        analyze_started_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "analyzing", "error": None},
            processing_updates={
                "transcribe_finished_at": transcribe_finished_at,
                "analyze_started_at": analyze_started_at,
                "model_used": get_active_llm_label(config),
                "progress_label": "Sending transcript to AI analysis",
                "progress_percent": 68,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Transcript queued for AI analysis with `{get_active_llm_label(config)}`.",
            progress_label="AI analysis running",
            progress_percent=72,
            model_used=get_active_llm_label(config),
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.status")

        recurring_patterns = load_recurring_patterns(config, session_meta.language)
        analysis, last_raw = await asyncio.to_thread(
            run_analysis_with_retries,
            client=llm_client,
            config=config,
            system_prompt=build_analysis_system_prompt(
                config,
                language=session_meta.language,
                recurring_patterns=recurring_patterns,
            ),
            user_message=build_transcript_user_message(transcript_payload["transcript"]),
        )
        write_session_analysis(config, session_id, analysis.model_dump(mode="json"))
        if last_raw:
            write_session_analysis_raw(config, session_id, last_raw)

        analyze_finished_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "ready", "error": None},
            processing_updates={
                "analyze_finished_at": analyze_finished_at,
                "progress_label": "Analysis ready",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message="Analysis saved successfully. Session is ready to review.",
            level="success",
            progress_label="Analysis ready",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.ready")
    except (AnalysisNeedsAttentionError, LlmClientError) as error:
        finished_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "needs_attention", "error": str(error)},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Needs attention",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="warning",
            progress_label="Needs attention",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.needs_attention")
    except AnalysisRetryExhaustedError as error:
        finished_at = datetime_now_iso()
        if error.last_raw:
            write_session_analysis_raw(config, session_id, error.last_raw)
        update_session_meta(
            config,
            session_id,
            updates={"status": "failed", "error": str(error)},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Analysis failed",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="error",
            progress_label="Analysis failed",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.failed")
    except Exception as error:
        failed_at = datetime_now_iso()
        current_meta = load_session_meta(config, session_id)
        processing_updates: dict[str, str] = {}
        if current_meta.status == "transcribing":
            processing_updates["transcribe_finished_at"] = failed_at
        elif current_meta.status == "analyzing":
            processing_updates["analyze_finished_at"] = failed_at

        update_session_meta(
            config,
            session_id,
            updates={"status": "failed", "error": str(error)},
            processing_updates={
                **processing_updates,
                "progress_label": "Processing failed",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="error",
            progress_label="Processing failed",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.failed")


def datetime_now_iso() -> str:
    from datetime import datetime

    return datetime.now().astimezone().isoformat()


def parse_and_validate_test_llm_response(response_text: str) -> None:
    payload = json.loads(response_text)
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        raise ValueError("LLM test response did not return the expected JSON payload.")


def validate_journal_folder_path(journal_folder: str) -> dict[str, object]:
    path = Path(journal_folder).expanduser()
    exists_before = path.exists()
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / ".praxis-write-test"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
    except Exception as error:  # noqa: BLE001
        return {
            "ok": False,
            "path": str(path),
            "exists": exists_before,
            "writable": False,
            "session_count": 0,
            "index_exists": False,
            "error": str(error),
        }

    session_count = sum(
        1
        for child in path.iterdir()
        if child.is_dir() and (child / "meta.json").exists()
    )
    return {
        "ok": True,
        "path": str(path),
        "exists": True,
        "writable": True,
        "session_count": session_count,
        "index_exists": (path / "_index.json").exists(),
        "error": None,
    }


def get_whisper_cache_status(config: ConfigModel) -> dict[str, object]:
    cache_dir = PATHS.whisper_cache_dir
    model_name = config.whisper.model
    model_token = model_name.casefold().replace("_", "-")
    files: list[Path] = []
    if cache_dir.exists():
        files = [path for path in cache_dir.rglob("*") if path.is_file()]
    matching_files = [
        path
        for path in files
        if model_token in str(path.relative_to(cache_dir)).casefold().replace("_", "-")
    ]
    total_bytes = sum(path.stat().st_size for path in files)
    return {
        "cache_dir": str(cache_dir),
        "model": model_name,
        "cache_exists": cache_dir.exists(),
        "model_likely_cached": bool(matching_files),
        "file_count": len(files),
        "matching_file_count": len(matching_files),
        "size_bytes": total_bytes,
    }


def build_config_with_llm_override(
    config: ConfigModel,
    llm_override: dict[str, str] | None,
) -> ConfigModel:
    if not llm_override:
        return config

    provider = llm_override.get("provider") or config.llm.provider
    provider_api_keys = dict(config.llm.provider_api_keys)
    provider_models = dict(config.llm.provider_models)
    provider_base_urls = dict(config.llm.provider_base_urls)
    if config.openrouter.api_key:
        provider_api_keys["openrouter"] = config.openrouter.api_key
    if config.openrouter.default_model:
        provider_models["openrouter"] = config.openrouter.default_model

    if llm_override.get("api_key"):
        provider_api_keys[provider] = llm_override["api_key"]
    if llm_override.get("model"):
        provider_models[provider] = llm_override["model"]
    if "base_url" in llm_override:
        provider_base_urls[provider] = llm_override.get("base_url", "")

    next_llm = config.llm.model_copy(
        update={
            "provider": provider,
            "api_key": provider_api_keys.get(provider, ""),
            "model": provider_models.get(provider, ""),
            "base_url": provider_base_urls.get(provider, ""),
            "provider_api_keys": provider_api_keys,
            "provider_models": provider_models,
            "provider_base_urls": provider_base_urls,
        }
    )
    return config.model_copy(update={"llm": next_llm})


async def emit_config_changed() -> None:
    await sse_broadcaster.publish("config.changed", {})


async def emit_index_changed(reason: str) -> None:
    await sse_broadcaster.publish("index.changed", {"reason": reason})


async def emit_session_status_from_id(config, session_id: str) -> None:
    meta = load_session_meta(config, session_id)
    await emit_session_status(meta)


async def emit_session_status(meta) -> None:
    payload = {
        "session_id": meta.id,
        "status": meta.status,
        "save_mode": meta.save_mode,
        "error": meta.error,
    }
    await sse_broadcaster.publish("session.status", payload)
    if meta.status == "ready":
        await sse_broadcaster.publish("session.ready", payload)


async def rebuild_index_and_emit(config, reason: str) -> None:
    rebuild_index(config)
    await emit_index_changed(reason)


processing_queue = SessionProcessingQueue(worker=process_session)


async def reanalyze_session_with_latest_prompt(
    session_id: str,
    llm_override: dict[str, str] | None = None,
) -> None:
    config = build_config_with_llm_override(load_config(), llm_override)
    try:
        session_meta = load_session_meta(config, session_id)
        transcript_payload = load_session_transcript_payload(config, session_id)
        transcript_segments = transcript_payload.get("transcript") or []
        if not transcript_segments:
            raise ValueError("Session has no transcript segments to analyze.")

        analyze_started_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "analyzing", "error": None},
            processing_updates={
                "analyze_started_at": analyze_started_at,
                "analyze_finished_at": None,
                "model_used": get_active_llm_label(config),
                "progress_label": "Re-analyzing with latest coaching prompt",
                "progress_percent": 68,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Re-analysis started with `{get_active_llm_label(config)}` and the latest coaching prompt.",
            progress_label="AI re-analysis running",
            progress_percent=72,
            model_used=get_active_llm_label(config),
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.reanalyze.status")

        recurring_patterns = load_recurring_patterns(config, session_meta.language)
        analysis, last_raw = await asyncio.to_thread(
            run_analysis_with_retries,
            client=llm_client,
            config=config,
            system_prompt=build_analysis_system_prompt(
                config,
                language=session_meta.language,
                recurring_patterns=recurring_patterns,
            ),
            user_message=build_transcript_user_message(transcript_segments),
        )
        write_session_analysis(config, session_id, analysis.model_dump(mode="json"))
        if last_raw:
            write_session_analysis_raw(config, session_id, last_raw)

        finished_at = datetime_now_iso()
        updated_meta = update_session_meta(
            config,
            session_id,
            updates={"status": "ready", "error": None},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Re-analysis ready",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Re-analysis saved successfully with `{get_active_llm_label(config)}`.",
            level="success",
            progress_label="Re-analysis ready",
            progress_percent=100,
        )
        await emit_session_status(updated_meta)
        await rebuild_index_and_emit(config, "session.reanalyze.ready")
    except (AnalysisNeedsAttentionError, LlmClientError) as error:
        finished_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "needs_attention", "error": str(error)},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Re-analysis needs attention",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="warning",
            progress_label="Re-analysis needs attention",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.reanalyze.needs_attention")
    except AnalysisRetryExhaustedError as error:
        finished_at = datetime_now_iso()
        if error.last_raw:
            write_session_analysis_raw(config, session_id, error.last_raw)
        update_session_meta(
            config,
            session_id,
            updates={"status": "failed", "error": str(error)},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Re-analysis failed",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="error",
            progress_label="Re-analysis failed",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.reanalyze.failed")
    except Exception as error:
        finished_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "failed", "error": str(error)},
            processing_updates={
                "analyze_finished_at": finished_at,
                "progress_label": "Re-analysis failed",
                "progress_percent": 100,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=str(error),
            level="error",
            progress_label="Re-analysis failed",
            progress_percent=100,
        )
        await emit_session_status_from_id(config, session_id)
        await rebuild_index_and_emit(config, "session.reanalyze.failed")


async def _recover_stuck_sessions() -> None:
    config = load_config()
    session_dirs = discover_session_dirs(config)
    recovered = False

    for session_dir in session_dirs:
        session_id = session_dir.name
        try:
            meta = load_session_meta(config, session_id)
        except Exception:
            continue

        try:
            repaired = await repair_session_video_if_needed(config, session_id)
        except Exception:
            repaired = False

        if repaired:
            recovered = True
            meta = load_session_meta(config, session_id)

        if meta.status == "recording":
            try:
                recovered_meta = await finalize_session(
                    config,
                    session_id,
                    save_mode="video_only",
                )
            except Exception as error:
                recovery_error = str(error).strip()
                failure_reason = (
                    "interrupted before finalize"
                    if isinstance(error, ValueError) and "No uploaded chunks" in recovery_error
                    else "corrupt unfinished recording"
                )
                log_detail = recovery_error or failure_reason
                update_session_meta(
                    config,
                    session_id,
                    updates={"status": "failed", "error": failure_reason},
                    processing_updates={
                        "progress_label": "Startup recovery failed",
                        "progress_percent": 100,
                    },
                )
                append_session_processing_event(
                    config,
                    session_id,
                    message=f"Startup recovery failed: {log_detail}",
                    level="error",
                    progress_label="Startup recovery failed",
                    progress_percent=100,
                )
                recovered = True
            else:
                append_session_processing_event(
                    config,
                    session_id,
                    message="Startup recovery assembled an unfinished recording and saved it for review.",
                    level="warning",
                    progress_label="Recovered for review",
                    progress_percent=100,
                )
                recovered = True
        elif meta.status == "saved":
            video_path = get_session_video_path(config, session_id)
            if video_path is not None:
                update_session_meta(
                    config,
                    session_id,
                    updates={"status": "queued", "error": None},
                    processing_updates={
                        "progress_label": "Recovered and re-queued",
                        "progress_percent": 2,
                    },
                )
                append_session_processing_event(
                    config,
                    session_id,
                    message="Recovered saved session after restart and placed it back in the queue.",
                    progress_label="Recovered and re-queued",
                    progress_percent=2,
                )
                await processing_queue.enqueue(session_id)
                recovered = True
        elif meta.status in {"queued", "transcribing", "analyzing"}:
            processing_updates: dict[str, Any] = {}
            if meta.status == "transcribing":
                processing_updates["transcribe_started_at"] = None
            elif meta.status == "analyzing":
                processing_updates["analyze_started_at"] = None

            update_session_meta(
                config,
                session_id,
                updates={"status": "queued", "error": None},
                processing_updates={
                    **processing_updates,
                    "progress_label": "Recovered and re-queued",
                    "progress_percent": 2,
                },
            )
            append_session_processing_event(
                config,
                session_id,
                message=f"Recovered interrupted `{meta.status}` job after restart and re-queued it.",
                progress_label="Recovered and re-queued",
                progress_percent=2,
            )
            await processing_queue.enqueue(session_id)
            recovered = True

    if recovered:
        await rebuild_index_and_emit(config, "startup.recovery")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global retention_task
    await processing_queue.start()
    await _recover_stuck_sessions()
    retention_task = asyncio.create_task(_retention_loop(), name="daily-retention-task")
    try:
        yield
    finally:
        if retention_task:
            retention_task.cancel()
            try:
                await retention_task
            except asyncio.CancelledError:
                pass
            retention_task = None
        await processing_queue.stop()


app = FastAPI(title="Praxis Backend", version=APP_VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null"],
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost):\d+$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionPayload(BaseModel):
    language: Literal["en", "fr", "es"]
    title: str | None = None
    save_mode: Literal["full", "transcribe_only", "video_only"] | None = None


class FinalizeSessionPayload(BaseModel):
    title: str | None = None
    save_mode: Literal["full", "transcribe_only", "video_only"]
    duration_seconds: float | None = Field(default=None, ge=0)


class ImportAnalysisPayload(BaseModel):
    response_text: str


class ValidateJournalFolderPayload(BaseModel):
    journal_folder: str

    @field_validator("journal_folder", mode="before")
    @classmethod
    def normalize_journal_folder(cls, value: object) -> str:
        return str(value or "").strip()


class UpdatePracticePayload(BaseModel):
    assignment_completed: bool | None = None
    previous_goal: str | None = None
    previous_goal_source_session_id: str | None = None
    previous_goal_result: Literal["unmarked", "followed", "partially_followed", "missed"] | None = None
    previous_goal_note: str | None = None

    @field_validator("previous_goal", "previous_goal_source_session_id", "previous_goal_note", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> str | None:
        if value is None:
            return None
        return str(value).strip()


class ReanalyzeLlmOverridePayload(BaseModel):
    provider: Literal["openrouter", "opencode_go", "openai_compatible", "litellm_proxy"] | None = None
    model: str | None = None
    base_url: str | None = None

    @field_validator("provider", mode="before")
    @classmethod
    def normalize_provider(cls, value: object) -> str | None:
        provider = str(value or "").strip()
        return provider or None

    @field_validator("model", "base_url", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> str | None:
        text = str(value or "").strip()
        return text or None


class ReanalyzeSessionPayload(BaseModel):
    llm: ReanalyzeLlmOverridePayload | None = None


SUPPORTED_SUBTITLE_LANGUAGES = {"en", "fr", "es", "ar"}


class ExportSubtitledVideoPayload(BaseModel):
    target_language: str

    @field_validator("target_language", mode="before")
    @classmethod
    def normalize_target_language(cls, value: object) -> str:
        language = str(value or "").strip().lower()
        if language not in SUPPORTED_SUBTITLE_LANGUAGES:
            raise ValueError("Unsupported subtitle language.")
        return language


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def get_request_port(request: Request) -> int | None:
    if request.url.port:
        return request.url.port
    if request.url.scheme == "https":
        return 443
    if request.url.scheme == "http":
        return 80
    return None


def render_upload_form() -> str:
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Praxis phone upload</title>
    <style>
      :root { color-scheme: dark; background: #0f1012; color: #f5f5f0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      main { width: min(100%, 520px); border: 1px solid #2a2c31; background: #151619; padding: 22px; }
      h1 { margin: 0 0 8px; font-size: 16px; letter-spacing: .16em; text-transform: uppercase; }
      p { margin: 0 0 22px; color: #a8a8a8; font-size: 12px; line-height: 1.55; }
      label { display: block; margin-top: 14px; color: #a8a8a8; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; }
      input, select, button { width: 100%; box-sizing: border-box; margin-top: 7px; border: 1px solid #2a2c31; background: #0f1012; color: #f5f5f0; padding: 12px; font: inherit; }
      button { margin-top: 20px; background: #f5f5f0; color: #0f1012; border-color: #f5f5f0; font-weight: 700; text-transform: uppercase; letter-spacing: .16em; }
      .hint { margin-top: 14px; color: #777; font-size: 11px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Praxis Upload</h1>
      <p>Send a recording from your phone to this Praxis journal. Keep this device on the same Wi-Fi network.</p>
      <form method="post" action="/upload" enctype="multipart/form-data">
        <label for="file">Video file</label>
        <input id="file" name="file" type="file" accept="video/*,audio/*" required>
        <label for="language">Language</label>
        <select id="language" name="language">
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="es">Spanish</option>
        </select>
        <label for="title">Title</label>
        <input id="title" name="title" type="text" maxlength="120" placeholder="Optional">
        <label for="save_mode">Processing</label>
        <select id="save_mode" name="save_mode">
          <option value="full">Save and process</option>
          <option value="transcribe_only">Transcribe only</option>
          <option value="video_only">Video only</option>
        </select>
        <button type="submit">Upload</button>
      </form>
      <div class="hint">Uploads stay local on your machine.</div>
    </main>
  </body>
</html>
"""


@app.get("/upload")
async def get_upload_form() -> HTMLResponse:
    config = load_config()
    if not config.phone_upload_enabled:
        return HTMLResponse(
            "<!doctype html><title>Praxis upload disabled</title><p>Phone upload is disabled in Praxis settings.</p>",
            status_code=403,
        )
    return HTMLResponse(render_upload_form())


@app.post("/upload")
async def post_upload(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("en"),
    title: str = Form(""),
    save_mode: str = Form("full"),
) -> HTMLResponse:
    config = load_config()
    if not config.phone_upload_enabled:
        return HTMLResponse(
            "<!doctype html><title>Praxis upload disabled</title><p>Phone upload is disabled in Praxis settings.</p>",
            status_code=403,
        )

    if save_mode not in {"full", "transcribe_only", "video_only"}:
        save_mode = "full"
    if language not in {"en", "fr", "es"}:
        language = "en"

    meta = create_session(config, language=language, title=title or None, save_mode=save_mode)
    session_id = meta.id
    session_dir = get_session_dir(config, session_id)

    temp_path = session_dir / "upload_temp"
    try:
        with temp_path.open("wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
    except Exception:
        delete_session_dir(config, session_id)
        return HTMLResponse(
            "<!doctype html><title>Upload failed</title><p>Failed to read uploaded file.</p>",
            status_code=400,
        )

    video_path = session_dir / "video.webm"
    command = [
        resolve_media_binary("ffmpeg"),
        "-i", str(temp_path),
        "-c", "copy",
        "-movflags", "+faststart",
        "-y",
        str(video_path),
    ]
    result = await asyncio.to_thread(subprocess.run, command, capture_output=True, text=True, check=False)
    temp_path.unlink(missing_ok=True)

    if result.returncode != 0 or not video_path.exists():
        delete_session_dir(config, session_id)
        return HTMLResponse(
            "<!doctype html><title>Upload failed</title><p>Video processing failed. The file may be in an unsupported format.</p>",
            status_code=400,
        )

    try:
        duration_seconds = await probe_session_video(video_path)
    except Exception:
        duration_seconds = 0.0

    file_size_bytes = video_path.stat().st_size
    final_status = "video_only" if save_mode == "video_only" else "saved"

    update_session_meta(
        config,
        session_id,
        updates={
            "status": final_status,
            "duration_seconds": duration_seconds,
            "file_size_bytes": file_size_bytes,
            "source": "upload",
        },
    )

    try:
        await extract_session_thumbnail(config, session_id)
    except Exception:
        pass

    await rebuild_index_and_emit(config, "session.uploaded")

    if save_mode != "video_only":
        await processing_queue.enqueue(session_id)
        await emit_session_status_from_id(config, session_id)

    return HTMLResponse("""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Praxis — Upload complete</title>
    <style>
      :root { color-scheme: dark; background: #0f1012; color: #f5f5f0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      main { width: min(100%, 520px); border: 1px solid #2a2c31; background: #151619; padding: 22px; text-align: center; }
      h1 { margin: 0 0 8px; font-size: 16px; letter-spacing: .16em; text-transform: uppercase; color: #c9a87c; }
      p { margin: 0 0 22px; color: #a8a8a8; font-size: 12px; line-height: 1.55; }
      a { color: #c9a87c; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Upload complete</h1>
      <p>Your session has been saved to Praxis.</p>
      <p><a href="/upload">Upload another</a></p>
    </main>
  </body>
</html>
""")


@app.get("/api/config")
async def get_config(request: Request) -> dict[str, object]:
    return dump_config_for_api(load_config(), upload_port=get_request_port(request))


@app.get("/api/openrouter/models")
async def get_openrouter_models() -> list[dict[str, object]]:
    try:
        return fetch_openrouter_models()
    except OpenRouterCatalogError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None


@app.get("/api/llm/providers")
async def get_llm_providers() -> dict[str, object]:
    return get_llm_provider_options()


@app.get("/api/setup/status")
async def get_setup_status() -> dict[str, object]:
    config = load_config()
    journal_status = validate_journal_folder_path(config.journal_folder)
    whisper_status = get_whisper_cache_status(config)
    return {
        "setup_completed": config.setup_completed,
        "journal": journal_status,
        "whisper": whisper_status,
    }


@app.post("/api/setup/validate-journal")
async def post_validate_journal_folder(payload: ValidateJournalFolderPayload) -> dict[str, object]:
    if not payload.journal_folder:
        raise HTTPException(status_code=400, detail="Journal folder is required.")
    return validate_journal_folder_path(payload.journal_folder)


@app.post("/api/setup/activate-journal")
async def post_activate_journal_folder(
    request: Request,
    payload: ValidateJournalFolderPayload,
) -> dict[str, object]:
    if not payload.journal_folder:
        raise HTTPException(status_code=400, detail="Journal folder is required.")

    journal_status = validate_journal_folder_path(payload.journal_folder)
    if not journal_status["ok"]:
        raise HTTPException(status_code=400, detail=journal_status["error"] or "Journal folder is not writable.")

    updated = update_config({"journal_folder": payload.journal_folder})
    rebuilt_index = rebuild_index(updated)
    await emit_config_changed()
    await emit_index_changed("setup.journal_activated")
    return {
        "ok": True,
        "journal": validate_journal_folder_path(updated.journal_folder),
        "index": rebuilt_index.model_dump(mode="json"),
        "config": dump_config_for_api(updated, upload_port=get_request_port(request)),
    }


@app.patch("/api/config")
async def patch_config(request: Request, payload: dict[str, Any]) -> dict[str, object]:
    try:
        updated = update_config(payload)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=error.errors()) from None
    await emit_config_changed()
    return dump_config_for_api(updated, upload_port=get_request_port(request))


@app.post("/api/config/test-openrouter")
async def post_test_openrouter() -> dict[str, object]:
    config = load_config()

    try:
        status = fetch_openrouter_key_status(config.openrouter.api_key)
    except OpenRouterStatusError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None

    return {
        "ok": True,
        "model": get_active_llm_label(config),
        "label": status["label"],
        "limit_remaining": status["limit_remaining"],
        "usage": status["usage"],
        "is_free_tier": status["is_free_tier"],
    }


@app.post("/api/config/test-llm")
async def post_test_llm() -> dict[str, object]:
    config = load_config()

    try:
        response_text = await asyncio.to_thread(
            llm_client.complete_json,
            config=config,
            system_prompt="Return only valid JSON.",
            user_message='Return this exact JSON object: {"ok": true}',
            temperature=0,
            max_tokens=50,
        )
        parse_and_validate_test_llm_response(response_text)
    except LlmClientError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from None

    return {
        "ok": True,
        "provider": config.llm.provider,
        "model": get_active_llm_label(config),
    }


@app.post("/api/config/test-whisper")
async def post_test_whisper() -> dict[str, object]:
    config = load_config()

    try:
        result = await asyncio.to_thread(whisper_service.run_smoke_test, config)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(error)) from None

    return {
        "ok": True,
        "engine": result.engine,
        "model": result.model,
        "device": result.device,
        "compute_type": result.compute_type,
        "model_cached": result.model_cached,
        "model_load_seconds": result.model_load_seconds,
        "transcribe_seconds": result.transcribe_seconds,
        "segment_count": result.segment_count,
        "detected_language": result.detected_language,
    }


@app.post("/api/sessions")
async def post_session(payload: CreateSessionPayload) -> dict[str, str]:
    meta = create_session(
        load_config(),
        language=payload.language,
        title=payload.title,
        save_mode=payload.save_mode,
    )
    return {"session_id": meta.id}


@app.post("/api/sessions/{session_id}/chunk")
async def post_session_chunk(
    session_id: str,
    file: UploadFile = File(...),
    x_chunk_index: int = Header(..., alias="X-Chunk-Index"),
) -> dict[str, object]:
    try:
        chunk_path, manifest = await store_session_chunk(load_config(), session_id, x_chunk_index, file)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    return {
        "ok": True,
        "chunk_index": x_chunk_index,
        "path": str(chunk_path),
        "chunks_received": len(manifest["chunks"]),
    }


@app.post("/api/sessions/{session_id}/finalize")
async def post_session_finalize(session_id: str, payload: FinalizeSessionPayload) -> dict[str, object]:
    config = load_config()
    try:
        meta = await finalize_session(
            config,
            session_id,
            title=payload.title,
            save_mode=payload.save_mode,
            duration_seconds_hint=payload.duration_seconds,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None

    if not should_skip_processing_pipeline(meta):
        meta = update_session_meta(
            config,
            session_id,
            updates={"status": "queued", "error": None},
            processing_updates={
                "progress_label": "Queued for processing",
                "progress_percent": 2,
                "terminal_lines": [],
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message="Upload finalized. Waiting for the local pipeline to start.",
            progress_label="Queued for processing",
            progress_percent=2,
        )
        await processing_queue.enqueue(session_id)

    await emit_session_status(meta)
    await rebuild_index_and_emit(config, "session.finalize")
    return {"session_id": meta.id, "status": meta.status, "save_mode": meta.save_mode}


@app.get("/api/index")
async def get_index() -> dict[str, object]:
    return load_or_rebuild_index(load_config()).model_dump(mode="json")


@app.get("/api/sessions")
async def get_sessions(
    lang: str | None = None,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    limit: int | None = Query(default=None, ge=1),
) -> list[dict[str, object]]:
    return list_sessions(load_config(), lang=lang, date_from=from_date, date_to=to_date, limit=limit)


@app.get("/api/patterns/{language}")
async def get_patterns(language: str) -> dict[str, object]:
    normalized_language = language.strip().lower()
    try:
        patterns = load_recurring_patterns(load_config(), normalized_language)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None

    return patterns.model_dump(mode="json")


@app.get("/api/digest/today")
async def get_today_digest() -> dict[str, object]:
    return {"digest": select_today_digest_session(load_config())}


@app.get("/api/trends")
async def get_trends(range: str = Query(default="30d")) -> dict[str, object]:  # noqa: A002
    try:
        return build_trends_payload(load_config(), trend_range=range)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None


@app.get("/api/weekly/{week}")
async def get_weekly_rollup(week: str) -> dict[str, object]:
    try:
        rollup = load_weekly_rollup(load_config(), week)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None

    if rollup is None:
        raise HTTPException(status_code=404, detail="Weekly rollup not found.") from None

    return rollup.model_dump(mode="json")


@app.get("/api/events")
async def get_events() -> StreamingResponse:
    async def event_stream():
        async for event in sse_broadcaster.subscribe():
            yield event.format()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, object]:
    session = load_session_bundle(load_config(), session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    return session


@app.get("/api/sessions/{session_id}/export-prompt")
async def get_session_export_prompt(session_id: str) -> PlainTextResponse:
    config = load_config()
    session = load_session_bundle(config, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    transcript_segments = session.get("transcript")
    if not transcript_segments:
        raise HTTPException(status_code=400, detail="Transcript not available yet.")

    meta = load_session_meta(config, session_id)
    recurring_patterns = load_recurring_patterns(config, meta.language)
    prompt_text = build_analysis_export_prompt(
        config,
        language=meta.language,
        transcript_segments=transcript_segments,
        recurring_patterns=recurring_patterns,
    )
    return PlainTextResponse(prompt_text)


@app.get("/api/sessions/{session_id}/export-transcript")
async def get_session_export_transcript(session_id: str) -> PlainTextResponse:
    config = load_config()
    session = load_session_bundle(config, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    transcript_segments = session.get("transcript")
    if not transcript_segments:
        raise HTTPException(status_code=400, detail="Transcript not available yet.")

    transcript_text = build_transcript_user_message(transcript_segments)
    transcript_lines = transcript_text.splitlines()[2:-1]
    return PlainTextResponse("\n".join(transcript_lines))


@app.get("/api/sessions/{session_id}/subtitles/{language}.{subtitle_format}")
async def get_session_subtitle(session_id: str, language: str, subtitle_format: str) -> PlainTextResponse:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if language not in SUPPORTED_SUBTITLE_LANGUAGES or subtitle_format not in {"srt", "vtt"}:
        raise HTTPException(status_code=400, detail="Unsupported subtitle language or format.") from None

    subtitle_path = get_session_subtitle_path(config, session_id, language, subtitle_format)
    if not subtitle_path.exists() and language == meta.language:
        transcript_payload = load_session_transcript_payload(config, session_id)
        transcript_segments = transcript_payload["transcript"]
        if not transcript_segments:
            raise HTTPException(status_code=400, detail="Transcript not available yet.") from None
        write_subtitle_files(config, session_id, language=language, segments=transcript_segments)

    if not subtitle_path.exists():
        raise HTTPException(status_code=404, detail="Subtitle track not found.") from None

    media_type = "text/vtt" if subtitle_format == "vtt" else "application/x-subrip"
    return PlainTextResponse(subtitle_path.read_text(encoding="utf-8"), media_type=media_type)


@app.post("/api/sessions/{session_id}/export-subtitled-video")
async def post_session_export_subtitled_video(
    session_id: str,
    payload: ExportSubtitledVideoPayload,
) -> dict[str, object]:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    transcript_payload = load_session_transcript_payload(config, session_id)
    transcript_segments = transcript_payload["transcript"]
    if not transcript_segments:
        raise HTTPException(status_code=400, detail="Transcript not available yet.") from None

    if get_session_video_path(config, session_id) is None:
        raise HTTPException(status_code=404, detail="Session video not found.") from None

    try:
        write_subtitle_files(config, session_id, language=meta.language, segments=transcript_segments)
        target_segments = load_subtitle_segments(config, session_id, payload.target_language)
        if target_segments is None:
            target_segments = translate_subtitle_segments(
                client=llm_client,
                config=config,
                source_language=meta.language,
                target_language=payload.target_language,
                segments=transcript_segments,
            )
            write_subtitle_files(
                config,
                session_id,
                language=payload.target_language,
                segments=target_segments,
            )

        output_path = await export_burned_subtitle_video(
            config,
            session_id,
            language=payload.target_language,
        )
    except LlmClientError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None

    return {
        "ok": True,
        "session_id": session_id,
        "language": payload.target_language,
        "filename": output_path.name,
        "path": str(output_path),
        "url": f"/api/sessions/{session_id}/exports/{output_path.name}",
    }


@app.get("/api/sessions/{session_id}/video")
async def get_session_video(session_id: str) -> FileResponse:
    video_path = get_session_video_path(load_config(), session_id)
    if video_path is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    return FileResponse(video_path, media_type="video/webm", filename=video_path.name)


@app.get("/api/sessions/{session_id}/exports/{filename}")
async def get_session_exported_video(session_id: str, filename: str) -> FileResponse:
    config = load_config()
    try:
        load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if not filename.startswith("video_subtitled_") or not filename.endswith(".mp4"):
        raise HTTPException(status_code=400, detail="Unsupported export file.") from None

    language = filename.removeprefix("video_subtitled_").removesuffix(".mp4")
    video_path = get_session_subtitled_video_path(config, session_id, language)
    if video_path.name != filename or not video_path.exists():
        raise HTTPException(status_code=404, detail="Exported video not found.") from None

    return FileResponse(video_path, media_type="video/mp4", filename=video_path.name)


@app.get("/api/sessions/{session_id}/thumbnail")
async def get_session_thumbnail(session_id: str) -> Response:
    config = load_config()
    session = load_session_bundle(config, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    thumbnail_path = get_session_thumbnail_path(config, session_id)
    if thumbnail_path is None:
        return Response(status_code=204)

    return FileResponse(thumbnail_path, media_type="image/jpeg", filename=thumbnail_path.name)


@app.post("/api/sessions/{session_id}/mark-read")
async def post_session_mark_read(session_id: str) -> dict[str, object]:
    config = load_config()
    meta = mark_session_read(config, session_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    await rebuild_index_and_emit(config, "session.mark_read")
    return {"id": meta.id, "read": meta.read}


@app.patch("/api/sessions/{session_id}/practice")
async def patch_session_practice(
    session_id: str,
    payload: UpdatePracticePayload,
) -> dict[str, object]:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    practice_updates: dict[str, object] = {}
    if payload.assignment_completed is not None:
        practice_updates["assignment_completed"] = payload.assignment_completed
        practice_updates["assignment_completed_at"] = (
            datetime.now().astimezone().isoformat() if payload.assignment_completed else None
        )
    if payload.previous_goal is not None:
        practice_updates["previous_goal"] = payload.previous_goal
    if payload.previous_goal_source_session_id is not None:
        practice_updates["previous_goal_source_session_id"] = (
            payload.previous_goal_source_session_id or None
        )
    if payload.previous_goal_result is not None:
        practice_updates["previous_goal_result"] = payload.previous_goal_result
    if payload.previous_goal_note is not None:
        practice_updates["previous_goal_note"] = payload.previous_goal_note

    updated_meta = update_session_meta(
        config,
        session_id,
        updates={"practice": meta.practice.model_copy(update=practice_updates)},
    )
    await emit_session_status(updated_meta)
    await rebuild_index_and_emit(config, "session.practice")
    return {"session_id": updated_meta.id, "practice": updated_meta.practice.model_dump(mode="json")}


@app.post("/api/sessions/{session_id}/retry")
async def post_session_retry(session_id: str) -> dict[str, object]:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if should_skip_processing_pipeline(meta):
        raise HTTPException(status_code=400, detail="Session does not support retry.") from None

    if meta.status in {"queued", "transcribing", "analyzing"}:
        await rebuild_index_and_emit(config, "session.retry.noop")
        return {"session_id": meta.id, "status": meta.status, "enqueued": False}

    queued_meta = update_session_meta(
        config,
        session_id,
        updates={"status": "queued", "error": None},
        processing_updates={
            "attempts": meta.processing.attempts + 1,
            "progress_label": "Retry queued",
            "progress_percent": 2,
        },
    )
    append_session_processing_event(
        config,
        session_id,
        message=f"Retry requested. Starting attempt {queued_meta.processing.attempts}.",
        progress_label="Retry queued",
        progress_percent=2,
    )
    enqueued = await processing_queue.enqueue(session_id)
    await emit_session_status(queued_meta)
    await rebuild_index_and_emit(config, "session.retry")
    return {"session_id": queued_meta.id, "status": queued_meta.status, "enqueued": enqueued}


@app.post("/api/sessions/{session_id}/reanalyze")
async def post_session_reanalyze(
    session_id: str,
    payload: ReanalyzeSessionPayload | None = None,
) -> dict[str, object]:
    config = load_config()
    llm_override = payload.llm.model_dump(exclude_none=True) if payload and payload.llm else None
    analysis_config = build_config_with_llm_override(config, llm_override)
    analysis_model_label = get_active_llm_label(analysis_config)
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if should_skip_processing_pipeline(meta):
        raise HTTPException(status_code=400, detail="Session does not support analysis.") from None
    if meta.status in {"queued", "transcribing", "analyzing"}:
        raise HTTPException(status_code=409, detail="Session is already processing.") from None

    try:
        transcript_payload = load_session_transcript_payload(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="Session has no transcript to re-analyze.") from None

    if not transcript_payload.get("transcript"):
        raise HTTPException(status_code=400, detail="Session has no transcript segments to re-analyze.") from None

    queued_meta = update_session_meta(
        config,
        session_id,
        updates={"status": "analyzing", "error": None},
        processing_updates={
            "attempts": meta.processing.attempts + 1,
            "model_used": analysis_model_label,
            "progress_label": "Re-analysis queued",
            "progress_percent": 65,
        },
    )
    append_session_processing_event(
        config,
        session_id,
        message=f"Re-analysis requested with `{analysis_model_label}`. Starting attempt {queued_meta.processing.attempts}.",
        progress_label="Re-analysis queued",
        progress_percent=65,
        model_used=analysis_model_label,
    )
    if llm_override:
        asyncio.create_task(reanalyze_session_with_latest_prompt(session_id, llm_override))
    else:
        asyncio.create_task(reanalyze_session_with_latest_prompt(session_id))
    await emit_session_status(queued_meta)
    await rebuild_index_and_emit(config, "session.reanalyze")
    return {
        "session_id": queued_meta.id,
        "status": queued_meta.status,
        "enqueued": True,
        "model": analysis_model_label,
    }


@app.post("/api/sessions/{session_id}/import-analysis")
async def post_session_import_analysis(session_id: str, payload: ImportAnalysisPayload) -> dict[str, object]:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if should_skip_processing_pipeline(meta):
        raise HTTPException(status_code=400, detail="Session does not support analysis import.") from None

    try:
        parsed_analysis = parse_and_validate_analysis_response(payload.response_text)
    except AnalysisValidationError as error:
        write_session_analysis_raw(config, session_id, payload.response_text)
        raise HTTPException(status_code=400, detail=str(error)) from None

    if parsed_analysis.language != meta.language:
        write_session_analysis_raw(config, session_id, payload.response_text)
        raise HTTPException(status_code=400, detail="Imported analysis language does not match the session.") from None

    write_session_analysis(config, session_id, parsed_analysis.model_dump(mode="json"))
    finished_at = datetime_now_iso()
    updated_meta = update_session_meta(
        config,
        session_id,
        updates={"status": "ready", "error": None},
        processing_updates={"analyze_finished_at": finished_at},
    )
    await emit_session_status(updated_meta)
    await rebuild_index_and_emit(config, "session.import_analysis")
    return {"session_id": updated_meta.id, "status": updated_meta.status}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, object]:
    config = load_config()
    deleted = delete_session_dir(config, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")

    await rebuild_index_and_emit(config, "session.delete")
    return {"deleted": True, "id": session_id}
