from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


APP_NAME = "praxis"
APP_VERSION = "0.1.0"
LEGACY_APP_NAME = "twarga-journal"
DEFAULT_JOURNAL_DIRNAME = "PraxisJournal"
LEGACY_JOURNAL_DIRNAME = "TwargaJournal"
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
    legacy_config_dir: Path
    legacy_cache_dir: Path
    legacy_journal_dir: Path
    legacy_config_file: Path


def _resolve_whisper_cache_dir(home: Path) -> Path:
    env_cache_dir = os.environ.get("PRAXIS_WHISPER_CACHE_DIR")
    if env_cache_dir:
        return Path(env_cache_dir).expanduser().resolve()

    resources_path = os.environ.get("PRAXIS_RESOURCES_PATH")
    if resources_path:
        bundled_cache_dir = Path(resources_path).expanduser().resolve() / "whisper"
        if bundled_cache_dir.exists():
            return bundled_cache_dir

    return home / ".cache" / "whisper"


def build_app_paths(home: Path | None = None) -> AppPaths:
    resolved_home = (home or Path.home()).expanduser().resolve()
    config_dir = resolved_home / ".config" / APP_NAME
    cache_dir = resolved_home / ".cache" / APP_NAME
    journal_dir = resolved_home / DEFAULT_JOURNAL_DIRNAME
    legacy_config_dir = resolved_home / ".config" / LEGACY_APP_NAME
    legacy_cache_dir = resolved_home / ".cache" / LEGACY_APP_NAME
    legacy_journal_dir = resolved_home / LEGACY_JOURNAL_DIRNAME

    whisper_cache_dir = _resolve_whisper_cache_dir(resolved_home)

    return AppPaths(
        home=resolved_home,
        config_dir=config_dir,
        cache_dir=cache_dir,
        journal_dir=journal_dir,
        config_file=config_dir / "config.json",
        backend_log_file=cache_dir / "backend.log",
        runtime_socket=cache_dir / "runtime.sock",
        whisper_cache_dir=whisper_cache_dir,
        legacy_config_dir=legacy_config_dir,
        legacy_cache_dir=legacy_cache_dir,
        legacy_journal_dir=legacy_journal_dir,
        legacy_config_file=legacy_config_dir / "config.json",
    )


PATHS = build_app_paths()
