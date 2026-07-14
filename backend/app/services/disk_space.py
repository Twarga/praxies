"""Low disk space estimation and protection.

Estimates required space before operations that could exhaust the disk
and warns or blocks unsafe work without deleting existing artifacts.
"""

from __future__ import annotations

from pathlib import Path
import shutil


def free_disk_bytes(path: Path) -> int:
    """Return available bytes on the filesystem containing `path`."""
    usage = shutil.disk_usage(path)
    return usage.free


def estimate_recording_finalization_bytes(
    chunk_total_bytes: int,
    *,
    overhead_factor: float = 2.0,
    safety_margin_bytes: int = 100 * 1024 * 1024,
) -> int:
    """Estimate bytes needed to finalize a recording.

    Returns total estimated temporary + final storage needed.
    Uses overhead_factor to account for temp files and safety_margin
    so the operation never collides with 0-free-bytes.
    """
    return int(chunk_total_bytes * overhead_factor) + safety_margin_bytes


def estimate_model_download_bytes(
    model_size_bytes: int,
    *,
    overhead_factor: float = 1.3,
    safety_margin_bytes: int = 200 * 1024 * 1024,
) -> int:
    """Estimate bytes needed to download and verify a transcription model."""
    return int(model_size_bytes * overhead_factor) + safety_margin_bytes


def has_sufficient_space(
    path: Path,
    required_bytes: int,
) -> bool:
    """Return True if `path`'s filesystem has at least `required_bytes` free."""
    return free_disk_bytes(path) >= required_bytes


def check_space_or_warn(
    path: Path,
    required_bytes: int,
    operation_label: str,
) -> dict[str, object]:
    """Return a structured result suitable for API/diagnostics consumption."""
    available = free_disk_bytes(path)
    sufficient = available >= required_bytes

    return {
        "ok": sufficient,
        "path": str(path),
        "available_bytes": available,
        "required_bytes": required_bytes,
        "deficit_bytes": max(0, required_bytes - available),
        "operation": operation_label,
        "warning": None if sufficient else (
            f"Only {_format_bytes(available)} free. "
            f"{operation_label} needs at least {_format_bytes(required_bytes)}."
        ),
    }


def _format_bytes(total_bytes: int) -> str:
    if total_bytes >= 1024 * 1024 * 1024:
        return f"{total_bytes / (1024**3):.1f} GB"
    if total_bytes >= 1024 * 1024:
        return f"{total_bytes / (1024**2):.1f} MB"
    if total_bytes >= 1024:
        return f"{total_bytes / 1024:.1f} KB"
    return f"{total_bytes} B"
