"""Runtime diagnostics service.

Inspects backend, journal, disk, media tools, devices, keyring,
transcription runtime, active model, provider, and last successful
operations. Returns structured status with codes, summaries, details,
and suggested actions.
"""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any


DiagResult = dict[str, Any]


def _check(name: str, ok: bool, summary: str = "", detail: str = "", action: str = "") -> DiagResult:
    return {
        "name": name,
        "ok": ok,
        "summary": summary,
        "detail": detail,
        "action": action,
    }


def _format_time_ago(iso_timestamp: str | None) -> str:
    if not iso_timestamp:
        return "never"
    try:
        then = datetime.fromisoformat(iso_timestamp)
        delta = datetime.now().astimezone() - then
        minutes = int(delta.total_seconds() / 60)
        if minutes < 1:
            return "just now"
        if minutes < 60:
            return f"{minutes} min ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        return f"{hours // 24}d ago"
    except Exception:
        return "unknown"


def check_journal(config: Any) -> DiagResult:
    journal = Path(config.journal_folder).expanduser().resolve()
    if not journal.exists():
        return _check(
            "journal folder",
            ok=False,
            summary="Journal folder does not exist.",
            detail=str(journal),
            action="Create the journal folder or choose a different path in Settings.",
        )
    if not journal.is_dir():
        return _check(
            "journal folder",
            ok=False,
            summary="Journal path is not a directory.",
            detail=str(journal),
            action="Choose a valid directory in Settings.",
        )

    index_path = journal / "_index.json"
    index_exists = index_path.exists()
    try:
        test_file = journal / ".praxis-diag-test"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        writable = True
    except Exception:
        writable = False

    sessions = sum(1 for child in journal.iterdir() if child.is_dir() and (child / "meta.json").exists())

    return _check(
        "journal folder",
        ok=writable,
        summary=f"Journal is {'ready' if writable else 'not writable'} with {sessions} sessions.",
        detail=str(journal),
        action=(
            None if writable
            else "Check filesystem permissions on the journal folder."
        ),
    )


def check_disk(journal_path: str) -> DiagResult:
    path = Path(journal_path).expanduser().resolve()
    try:
        usage = shutil.disk_usage(path)
        free_gb = round(usage.free / (1024**3), 1)
        warning = free_gb < 5
        return _check(
            "free disk space",
            ok=not warning,
            summary=f"{free_gb} GB free on journal filesystem.",
            detail=str(path),
            action=(
                "Free up disk space or move the journal to a larger volume."
                if warning else None
            ),
        )
    except Exception as error:
        return _check(
            "free disk space",
            ok=False,
            summary="Could not check disk space.",
            detail=str(error),
            action="Verify the journal folder is accessible.",
        )


def check_media_tools() -> DiagResult:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    ok = bool(ffmpeg and ffprobe)
    return _check(
        "ffmpeg / ffprobe",
        ok=ok,
        summary=(
            f"ffmpeg {'found' if ffmpeg else 'missing'}, "
            f"ffprobe {'found' if ffprobe else 'missing'}."
        ),
        detail=f"ffmpeg={ffmpeg or 'N/A'}, ffprobe={ffprobe or 'N/A'}",
        action="Install ffmpeg and ffprobe, or check the bundled resources path."
        if not ok else None,
    )


def check_transcription_runtime() -> DiagResult:
    try:
        import faster_whisper  # noqa: F401
        return _check(
            "whisper runtime",
            ok=True,
            summary="faster-whisper is importable.",
            detail="faster-whisper Python package found.",
        )
    except ImportError:
        return _check(
            "whisper runtime",
            ok=False,
            summary="faster-whisper is not installed.",
            detail="Import failed.",
            action="Install faster-whisper or verify the bundled runtime.",
        )


def check_credential_store() -> DiagResult:
    try:
        from app.storage.secrets import _keyring_available
        if _keyring_available():
            return _check(
                "credential store", ok=True,
                summary="Linux Secret Service is available.",
                detail="Credentials use the unlocked desktop keyring.",
            )
        from cryptography.fernet import Fernet  # noqa: F401
        from app.core.settings import PATHS
        PATHS.config_dir.mkdir(parents=True, exist_ok=True)
        return _check(
            "credential store", ok=True,
            summary="Encrypted local credential store is available.",
            detail="Desktop keyring is unavailable; Praxis will use its permission-restricted Fernet store.",
            action="Unlock Linux Secret Service to prefer the desktop keyring." if __import__("os").environ.get("DBUS_SESSION_BUS_ADDRESS") else "A desktop keyring was not detected; encrypted local fallback is active.",
        )
    except Exception as error:
        return _check(
            "credential store",
            ok=False,
            summary="No secure credential store is available.",
            detail=str(error),
            action="Check that the Praxis configuration directory is writable.",
        )


def check_active_transcription_model(config: Any) -> DiagResult:
    from app.transcription import get_default_engine
    from app.transcription.downloads import get_model_dir
    model_id = str(config.whisper.model)
    engine = get_default_engine()
    if engine is None:
        return _check("active transcription model", False, "No transcription engine is registered.", model_id, "Restart Praxis or repair the bundled runtime.")
    verification = engine.verify(model_id, get_model_dir(model_id))
    ok = bool(verification.get("ok"))
    return _check(
        "active transcription model", ok,
        f"{model_id} is {'installed and verified' if ok else 'not fully installed'}.",
        str(verification.get("path", get_model_dir(model_id))),
        "Download and activate a verified model in Transcription Settings." if not ok else "",
    )


def check_active_provider() -> DiagResult:
    from app.providers.state import get_active_connection_id, get_connection
    connection_id = get_active_connection_id()
    connection = get_connection(connection_id) if connection_id else None
    model_id = str((connection or {}).get("selected_model_id") or "")
    ok = bool(connection and connection.get("enabled", True) and model_id)
    return _check(
        "active AI provider", ok,
        f"{connection.get('display_name') or connection.get('provider_id')} · {model_id}" if ok else "No active provider and model are selected.",
        connection_id or "No active connection",
        "Connect, test, and activate a provider model in AI Settings." if not ok else "",
    )


def check_backend_runtime() -> DiagResult:
    from app.core.settings import APP_VERSION
    return _check("backend runtime", True, f"Praxis backend {APP_VERSION} is responding.", "FastAPI diagnostics executed in-process.")


def check_recent_operations(config: Any) -> DiagResult:
    from app.services.sessions import discover_session_dirs, load_session_meta
    metas = []
    for session_dir in discover_session_dirs(config):
        try: metas.append(load_session_meta(config, session_dir.name))
        except Exception: continue
    metas.sort(key=lambda item: item.created_at, reverse=True)
    recorded = next((item for item in metas if item.status != "recording"), None)
    transcribed = next((item for item in metas if item.status in {"ready", "analyzing", "needs_attention"}), None)
    reported = next((item for item in metas if item.status == "ready" and item.save_mode == "full"), None)
    if not metas:
        return _check("recent operations", True, "No sessions yet; baseline recording will establish operation history.", "Recording: never · Transcription: never · Report: never")
    ok = recorded is not None
    return _check(
        "recent operations", ok,
        f"Latest recording {recorded.created_at if recorded else 'never'}; report {reported.created_at if reported else 'never'}.",
        f"recording={recorded.id if recorded else 'never'}, transcription={transcribed.id if transcribed else 'never'}, report={reported.id if reported else 'never'}",
        "Open a failed session or use its Retry action." if not ok else "",
    )
def run_all_checks(config: Any) -> list[DiagResult]:
    return [
        check_backend_runtime(),
        check_journal(config),
        check_disk(config.journal_folder),
        check_media_tools(),
        check_transcription_runtime(),
        check_active_transcription_model(config),
        check_credential_store(),
        check_active_provider(),
        check_recent_operations(config),
    ]


def run_health_check(config: Any) -> dict[str, Any]:
    checks = run_all_checks(config)
    all_ok = all(c["ok"] for c in checks)
    return {
        "ok": all_ok,
        "checked_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "checks": checks,
        "action": "No issues found." if all_ok else "Some checks failed. See individual items for actions.",
    }
