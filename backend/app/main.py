from typing import Any, Literal

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core.settings import APP_VERSION
from app.services.config import dump_config_for_api, load_config, update_config
from app.services.index import list_sessions, load_or_rebuild_index, rebuild_index
from app.services.sessions import create_session, delete_session_dir, load_session_bundle, store_session_chunk


app = FastAPI(title="Praxies Backend", version=APP_VERSION)


class CreateSessionPayload(BaseModel):
    language: Literal["en", "fr", "es", "tmz"]
    title: str | None = None
    save_mode: Literal["full", "transcribe_only", "video_only"] | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
async def get_config() -> dict[str, object]:
    return dump_config_for_api(load_config())


@app.patch("/api/config")
async def patch_config(payload: dict[str, Any]) -> dict[str, object]:
    updated = update_config(payload)
    return dump_config_for_api(updated)


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


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, object]:
    session = load_session_bundle(load_config(), session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    return session


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, object]:
    config = load_config()
    deleted = delete_session_dir(config, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")

    rebuild_index(config)
    return {"deleted": True, "id": session_id}
