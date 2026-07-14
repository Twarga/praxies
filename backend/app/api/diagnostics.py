"""Diagnostics API endpoints.

Health checks, retest, redacted support bundle, index repair,
journal verification, and stuck-session recovery.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.services.config import load_config
from app.services.diagnostics import run_all_checks, run_health_check
from app.services.index import rebuild_index
from app.services.sessions import discover_session_dirs, load_session_meta

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.get("/health")
async def get_health() -> dict[str, object]:
    config = load_config()
    return run_health_check(config)


@router.get("/checks")
async def get_checks() -> dict[str, object]:
    config = load_config()
    checks = run_all_checks(config)
    all_ok = all(c["ok"] for c in checks)
    return {
        "ok": all_ok,
        "checks": checks,
    }


@router.post("/retest")
async def post_retest() -> dict[str, object]:
    config = load_config()
    checks = run_all_checks(config)
    all_ok = all(c["ok"] for c in checks)
    return {
        "ok": all_ok,
        "checks": checks,
    }


@router.get("/support-bundle")
async def get_support_bundle() -> dict[str, object]:
    config = load_config()
    checks = run_all_checks(config)

    journal = Path(config.journal_folder).expanduser().resolve()
    session_count = 0
    stuck_count = 0
    statuses: dict[str, int] = {}

    for session_dir in discover_session_dirs(config):
        try:
            meta = load_session_meta(config, session_dir.name)
            session_count += 1
            status = meta.status
            statuses[status] = statuses.get(status, 0) + 1
            if status in {"failed", "needs_attention"}:
                stuck_count += 1
        except Exception:
            pass

    return {
        "app_version": config.app_version,
        "schema_version": config.schema_version,
        "journal_path": str(journal),
        "backend_log_path": str(__import__("app.core.settings", fromlist=["PATHS"]).PATHS.backend_log_file),
        "config_path": str(__import__("app.core.settings", fromlist=["PATHS"]).PATHS.config_file),
        "session_count": session_count,
        "stuck_sessions": stuck_count,
        "session_statuses": statuses,
        "checks": checks,
        "credential_store_available": any(
            c["name"] == "credential store" and c["ok"] for c in checks
        ),
        "redacted": True,
    }


@router.post("/reset-onboarding")
async def post_reset_onboarding() -> dict[str, object]:
    from app.services.config import update_config
    update_config({"setup_completed": False})
    return {"ok": True, "message": "Onboarding will reopen. Journal data was not changed."}


@router.post("/repair-index")
async def post_repair_index() -> dict[str, object]:
    config = load_config()
    try:
        index = rebuild_index(config)
        return {
            "ok": True,
            "sessions": len(index.sessions),
            "message": f"Index rebuilt with {len(index.sessions)} sessions.",
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from None


@router.post("/repair/{session_id}")
async def post_repair_session(session_id: str) -> dict[str, object]:
    config = load_config()
    try:
        meta = load_session_meta(config, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    repairable = {"failed", "needs_attention"}
    if meta.status not in repairable:
        return {
            "ok": False,
            "session_id": session_id,
            "message": f"Session status '{meta.status}' does not support repair.",
        }

    return {
        "ok": True,
        "session_id": session_id,
        "status": meta.status,
        "error": meta.error,
        "message": "Use POST /api/sessions/{id}/retry to re-queue processing.",
    }
