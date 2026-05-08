from __future__ import annotations

import os
import shutil
from pathlib import Path


def resolve_media_binary(name: str) -> str:
    env_name = f"PRAXIS_{name.upper()}_BIN"
    env_value = os.environ.get(env_name)
    if env_value:
        return env_value

    for candidate in _bundled_binary_candidates(name):
        if candidate.exists():
            return str(candidate)

    return name


def media_binary_available(name: str) -> bool:
    resolved = resolve_media_binary(name)
    if Path(resolved).exists():
        return True
    return shutil.which(resolved) is not None


def _bundled_binary_candidates(name: str) -> list[Path]:
    services_path = Path(__file__).resolve()
    backend_root = services_path.parents[2]
    project_root = backend_root.parent
    packaged_resources_path = services_path.parents[3]
    executable_name = f"{name}.exe" if os.name == "nt" else name

    return [
        packaged_resources_path / "ffmpeg" / executable_name,
        project_root / "frontend" / "electron" / "resources" / "ffmpeg" / executable_name,
    ]
