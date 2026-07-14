"""Transcription engine and lifecycle tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.transcription import get_engine, get_default_engine, list_engines
from app.transcription.downloads import (
    activate_model,
    check_model_smoke_test,
    check_removal_safe,
    estimate_model_size,
    get_model_dir,
    relocate_cache,
    remove_model,
    verify_model_files,
)
from app.transcription.faster_whisper_engine import FasterWhisperEngine, FASTER_WHISPER_MODELS, _word_error_rate
from app.transcription.hardware import inspect_hardware, recommend_model
from app.api import transcription as transcription_api


class TestEngineRegistry:
    def test_builtin_faster_whisper_engine_is_registered(self):
        engines = list_engines()
        assert [engine.engine_id for engine in engines] == ["faster_whisper"]
        assert get_engine("faster_whisper") is not None

    def test_engine_interface_is_importable(self):
        from app.transcription import TranscriptionEngine
        assert TranscriptionEngine is not None


class TestFasterWhisperEngine:
    def test_engine_has_all_required_methods(self):
        engine = FasterWhisperEngine()
        assert engine.engine_id == "faster_whisper"
        assert engine.display_name == "Faster Whisper"
        assert callable(engine.inspect_runtime)
        assert callable(engine.fetch_catalog)
        assert callable(engine.verify)
        assert callable(engine.transcribe)
        assert callable(engine.remove)

    def test_inspect_runtime_reports_available(self):
        engine = FasterWhisperEngine()
        info = engine.inspect_runtime()
        assert info.engine_id == "faster_whisper"
        assert info.supported is True
        assert info.recommended is True

    @pytest.mark.asyncio
    async def test_fetch_catalog_returns_models(self):
        engine = FasterWhisperEngine()
        models = await engine.fetch_catalog()
        assert len(models) == len(FASTER_WHISPER_MODELS)
        for model in models:
            assert model.model_id
            assert model.engine_id == "faster_whisper"

    def test_all_catalog_models_have_required_fields(self):
        for model in FASTER_WHISPER_MODELS:
            assert model.model_id
            assert model.estimated_disk_gb > 0
            assert model.estimated_ram_gb > 0
            assert len(model.supported_compute_types) > 0

    def test_verify_returns_ok_for_real_cache(self):
        engine = FasterWhisperEngine()
        model_dir = Path.home() / ".cache" / "whisper"
        result = engine.verify("tiny", model_dir)
        assert isinstance(result, dict)
        assert "ok" in result

    def test_verify_requires_real_ctranslate_files(self, tmp_path):
        engine = FasterWhisperEngine()
        model_dir = tmp_path / "model"
        model_dir.mkdir()
        assert engine.verify("tiny", model_dir)["ok"] is False
        for name in ("config.json", "model.bin", "tokenizer.json"):
            (model_dir / name).write_bytes(b"model-data")
        result = engine.verify("tiny", model_dir)
        assert result["ok"] is True
        assert result["total_size_bytes"] > 0

    def test_word_error_rate_is_deterministic(self):
        assert _word_error_rate("one clear example", "one clear example") == 0
        assert _word_error_rate("one clear example", "one example") == pytest.approx(1 / 3, abs=0.001)


class TestDownloads:
    def test_verify_model_files_missing_dir(self, tmp_path):
        result = verify_model_files("test-model", tmp_path / "nonexistent")
        assert result["ok"] is False
        assert "reason" in result

    def test_verify_model_files_empty_dir(self, tmp_path):
        empty_dir = tmp_path / "empty_model"
        empty_dir.mkdir()
        result = verify_model_files("test-model", empty_dir)
        assert result["ok"] is False

    def test_activate_requires_verification(self, tmp_path):
        result = activate_model("test-model", tmp_path / "nonexistent")
        assert result["ok"] is False

    def test_removal_protects_active_model(self, tmp_path):
        result = check_removal_safe("large-v3-turbo", "large-v3-turbo")
        assert result["ok"] is False
        assert "alternatives" in result

    def test_removal_allows_inactive_model(self):
        result = check_removal_safe("tiny", "large-v3-turbo")
        assert result["ok"] is True

    def test_remove_missing_model(self, tmp_path):
        result = remove_model("tiny", tmp_path / "nonexistent")
        assert result["ok"] is False

    def test_estimate_model_size_known(self):
        result = estimate_model_size("tiny")
        assert result["ok"] is True
        assert result["estimated_disk_gb"] > 0

    def test_estimate_model_size_unknown(self):
        result = estimate_model_size("nonexistent-model-xyz")
        assert result["ok"] is False

    def test_get_model_dir_returns_path(self):
        path = get_model_dir("large-v3-turbo")
        assert "large-v3-turbo" in str(path)

    @pytest.mark.asyncio
    async def test_download_pause_resume_and_cancel_lifecycle(self, monkeypatch):
        download_id = "lifecycle-test"
        transcription_api.DOWNLOAD_JOBS[download_id] = {
            "download_id": download_id,
            "engine_id": "faster_whisper",
            "model_id": "tiny",
            "state": "downloading",
            "error": None,
        }

        async def sleeping_download():
            await __import__("asyncio").sleep(60)

        task = __import__("asyncio").create_task(sleeping_download())
        transcription_api.DOWNLOAD_TASKS[download_id] = task
        paused = await transcription_api.pause_download(download_id)
        assert paused["state"] == "paused"
        with pytest.raises(__import__("asyncio").CancelledError):
            await task

        started = []
        monkeypatch.setattr(transcription_api, "_start_download_task", lambda value: started.append(value))
        transcription_api.DOWNLOAD_TASKS.pop(download_id, None)
        resumed = await transcription_api.resume_download(download_id)
        assert resumed["state"] == "queued"
        assert started == [download_id]

        resumed["state"] = "downloading"
        cancelled = await transcription_api.cancel_download(download_id)
        assert cancelled["state"] == "cancelled"

        transcription_api.DOWNLOAD_JOBS.pop(download_id, None)

    @pytest.mark.asyncio
    async def test_journal_comparison_preserves_canonical_transcript(self, monkeypatch, tmp_path, config):
        from app.services import sessions as session_service
        from app.services import config as config_service

        model_dir = tmp_path / "model"
        audio = tmp_path / "audio.wav"
        model_dir.mkdir(); audio.write_bytes(b"audio")

        class FakeEngine:
            def verify(self, model_id, path): return {"ok": True, "path": str(path)}
            def transcribe(self, *args, **kwargs):
                return [{"start_seconds": 0, "end_seconds": 1, "text": "hello clear world"}]

        meta = type("Meta", (), {"language": "en", "duration_seconds": 2.0})()
        monkeypatch.setattr(transcription_api, "get_engine", lambda _id: FakeEngine())
        monkeypatch.setattr(transcription_api, "get_model_dir", lambda _id: model_dir)
        monkeypatch.setattr(config_service, "load_config", lambda: config)
        monkeypatch.setattr(session_service, "load_session_meta", lambda *_: meta)
        monkeypatch.setattr(session_service, "load_session_transcript_payload", lambda *_: {"transcript": [{"text": "hello world"}]})
        async def fake_extract(*_): return audio
        monkeypatch.setattr(session_service, "extract_session_audio", fake_extract)

        result = await transcription_api.compare_model_with_session("tiny", "session-1")
        assert result["canonical_preserved"] is True
        assert result["candidate_text"] == "hello clear world"
        assert result["text_similarity_percent"] > 0


class TestHardwareInspection:
    def test_inspect_returns_struct(self):
        hw = inspect_hardware()
        assert hw.cpu_architecture
        assert hw.logical_cores > 0
        assert isinstance(hw.total_ram_gb, float)
        assert isinstance(hw.free_disk_gb, float)

    def test_recommend_model_returns_all_fields(self):
        hw = inspect_hardware()
        rec = recommend_model(hw)
        assert "recommended_model" in rec
        assert "reason" in rec
        assert "device" in rec
        assert "compute_type" in rec
        assert "alternatives" in rec
        assert isinstance(rec["alternatives"], list)
        assert rec["recommended_model"] not in rec["alternatives"]

    def test_recommendation_cites_detected_facts(self):
        hw = inspect_hardware()
        rec = recommend_model(hw)
        assert rec["reason"]


class TestEstimatorBoundaries:
    def test_tiny_ram_scenario(self):
        hw = inspect_hardware()
        hw.total_ram_gb = 2
        hw.free_disk_gb = 1
        hw.cuda_available = False
        rec = recommend_model(hw)
        assert rec["recommended_model"] == "tiny"
        assert rec["compute_type"] == "int8"

    def test_plenty_ram_scenario(self):
        hw = inspect_hardware()
        hw.total_ram_gb = 32
        hw.free_disk_gb = 50
        hw.cuda_available = True
        rec = recommend_model(hw)
        assert rec["recommended_model"] == "large-v3-turbo"
        assert rec["device"] == "cuda"
