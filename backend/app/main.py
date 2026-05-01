import asyncio
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel, ValidationError, field_validator

from app.core.settings import APP_VERSION
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
from app.services.llm_client import LiteLLMOpenRouterClient, OpenRouterClientError
from app.services.openrouter_catalog import OpenRouterCatalogError, fetch_openrouter_models
from app.services.openrouter_status import OpenRouterStatusError, fetch_openrouter_key_status
from app.services.processing_queue import SessionProcessingQueue
from app.services.prompt_builder import (
    build_analysis_export_prompt,
    build_analysis_system_prompt,
    build_transcript_user_message,
)
from app.services.recurring_patterns import load_recurring_patterns
from app.services.sessions import (
    append_session_processing_event,
    create_session,
    delete_session_dir,
    discover_session_dirs,
    extract_session_audio,
    extract_session_thumbnail,
    finalize_session,
    repair_session_video_if_needed,
    load_session_meta,
    load_session_bundle,
    mark_session_read,
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
from app.services.subtitle_service import (
    export_burned_subtitle_video,
    load_subtitle_segments,
    translate_subtitle_segments,
    write_subtitle_files,
)
from app.services.trends import build_trends_payload
from app.services.waveform_service import build_waveform_bins
from app.services.whisper_service import WhisperService


whisper_service = WhisperService()
llm_client = LiteLLMOpenRouterClient()


async def process_session(session_id: str) -> None:
    config = load_config()
    session_meta = load_session_meta(config, session_id)
    try:
        if should_skip_processing_pipeline(session_meta):
            rebuild_index(config)
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
        rebuild_index(config)

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
            rebuild_index(config)
            return

        analyze_started_at = datetime_now_iso()
        update_session_meta(
            config,
            session_id,
            updates={"status": "analyzing", "error": None},
            processing_updates={
                "transcribe_finished_at": transcribe_finished_at,
                "analyze_started_at": analyze_started_at,
                "model_used": config.openrouter.default_model,
                "progress_label": "Sending transcript to AI analysis",
                "progress_percent": 68,
            },
        )
        append_session_processing_event(
            config,
            session_id,
            message=f"Transcript queued for AI analysis with `{config.openrouter.default_model}`.",
            progress_label="AI analysis running",
            progress_percent=72,
            model_used=config.openrouter.default_model,
        )
        rebuild_index(config)

        recurring_patterns = load_recurring_patterns(config, session_meta.language)
        analysis, last_raw = run_analysis_with_retries(
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
        rebuild_index(config)
    except (AnalysisNeedsAttentionError, OpenRouterClientError) as error:
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
        rebuild_index(config)
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
        rebuild_index(config)
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
        rebuild_index(config)


def datetime_now_iso() -> str:
    from datetime import datetime

    return datetime.now().astimezone().isoformat()


processing_queue = SessionProcessingQueue(worker=process_session)


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
            video_path = get_session_video_path(config, session_id)
            if video_path is None:
                update_session_meta(
                    config,
                    session_id,
                    updates={"status": "failed", "error": "interrupted before finalize"},
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
        rebuild_index(config)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await processing_queue.start()
    await _recover_stuck_sessions()
    try:
        yield
    finally:
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


class ImportAnalysisPayload(BaseModel):
    response_text: str


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


@app.get("/api/config")
async def get_config() -> dict[str, object]:
    return dump_config_for_api(load_config())


@app.get("/api/openrouter/models")
async def get_openrouter_models() -> list[dict[str, object]]:
    try:
        return fetch_openrouter_models()
    except OpenRouterCatalogError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None


@app.patch("/api/config")
async def patch_config(payload: dict[str, Any]) -> dict[str, object]:
    try:
        updated = update_config(payload)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=error.errors()) from None
    return dump_config_for_api(updated)


@app.post("/api/config/test-openrouter")
async def post_test_openrouter() -> dict[str, object]:
    config = load_config()

    try:
        status = fetch_openrouter_key_status(config.openrouter.api_key)
    except OpenRouterStatusError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None

    return {
        "ok": True,
        "model": config.openrouter.default_model,
        "label": status["label"],
        "limit_remaining": status["limit_remaining"],
        "usage": status["usage"],
        "is_free_tier": status["is_free_tier"],
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

    rebuild_index(config)
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
    except OpenRouterClientError as error:
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

    rebuild_index(config)
    return {"id": meta.id, "read": meta.read}


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
        rebuild_index(config)
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
    rebuild_index(config)
    return {"session_id": queued_meta.id, "status": queued_meta.status, "enqueued": enqueued}


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
    rebuild_index(config)
    return {"session_id": updated_meta.id, "status": updated_meta.status}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, object]:
    config = load_config()
    deleted = delete_session_dir(config, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")

    rebuild_index(config)
    return {"deleted": True, "id": session_id}
