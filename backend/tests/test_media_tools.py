from __future__ import annotations

from pathlib import Path

from app.core.settings import build_app_paths
from app.services import media_tools
from app.services.media_tools import resolve_media_binary


def test_build_app_paths_uses_explicit_whisper_cache(monkeypatch, tmp_path):
    cache_dir = tmp_path / "seeded-whisper"
    cache_dir.mkdir()
    monkeypatch.setenv("PRAXIS_WHISPER_CACHE_DIR", str(cache_dir))

    paths = build_app_paths(tmp_path / "home")

    assert paths.whisper_cache_dir == cache_dir.resolve()


def test_build_app_paths_uses_bundled_whisper_cache_when_present(monkeypatch, tmp_path):
    resources = tmp_path / "resources"
    bundled_cache = resources / "whisper"
    bundled_cache.mkdir(parents=True)
    monkeypatch.delenv("PRAXIS_WHISPER_CACHE_DIR", raising=False)
    monkeypatch.setenv("PRAXIS_RESOURCES_PATH", str(resources))

    paths = build_app_paths(tmp_path / "home")

    assert paths.whisper_cache_dir == bundled_cache.resolve()


def test_resolve_media_binary_prefers_env_override(monkeypatch, tmp_path):
    ffmpeg_path = tmp_path / "ffmpeg"
    ffmpeg_path.write_text("#!/bin/sh\n", encoding="utf-8")
    monkeypatch.setenv("PRAXIS_FFMPEG_BIN", str(ffmpeg_path))

    assert resolve_media_binary("ffmpeg") == str(ffmpeg_path)


def test_resolve_media_binary_falls_back_to_name(monkeypatch):
    monkeypatch.delenv("PRAXIS_FFMPEG_BIN", raising=False)
    monkeypatch.setattr(Path, "exists", lambda _self: False)

    assert resolve_media_binary("ffmpeg") == "ffmpeg"


def test_bundled_binary_candidates_include_dev_resources():
    candidates = media_tools._bundled_binary_candidates("ffmpeg")

    assert any(
        str(candidate).endswith("frontend/electron/resources/ffmpeg/ffmpeg")
        for candidate in candidates
    )
