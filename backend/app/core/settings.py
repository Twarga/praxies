from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


APP_NAME = "twarga-journal"
APP_VERSION = "0.1.0"
DEFAULT_JOURNAL_DIRNAME = "TwargaJournal"
DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_BACKEND_PORT = 8000


@dataclass(frozen=True)
class AppPaths:
    home: Path
    config_dir: Path
    cache_dir: Path
    journal_dir: Path
    config_file: Path
    backend_log_file: Path
    runtime_socket: Path
    whisper_cache_dir: Path


def build_app_paths(home: Path | None = None) -> AppPaths:
    resolved_home = (home or Path.home()).expanduser().resolve()
    config_dir = resolved_home / ".config" / APP_NAME
    cache_dir = resolved_home / ".cache" / APP_NAME
    journal_dir = resolved_home / DEFAULT_JOURNAL_DIRNAME

    return AppPaths(
        home=resolved_home,
        config_dir=config_dir,
        cache_dir=cache_dir,
        journal_dir=journal_dir,
        config_file=config_dir / "config.json",
        backend_log_file=cache_dir / "backend.log",
        runtime_socket=cache_dir / "runtime.sock",
        whisper_cache_dir=resolved_home / ".cache" / "whisper",
    )


PATHS = build_app_paths()
