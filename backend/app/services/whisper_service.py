from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
import time
from typing import Any
import wave

from app.core.settings import PATHS
from app.models import ConfigModel


@dataclass(frozen=True)
class WhisperRuntimeConfig:
    model_name: str
    compute_type: str
    device: str
    download_root: str


@dataclass(frozen=True)
class WhisperSmokeTestResult:
    engine: str
    model: str
    device: str
    compute_type: str
    model_cached: bool
    model_load_seconds: float
    transcribe_seconds: float
    segment_count: int
    detected_language: str | None


def build_whisper_runtime_config(config: ConfigModel) -> WhisperRuntimeConfig:
    return WhisperRuntimeConfig(
        model_name=config.whisper.model,
        compute_type=config.whisper.compute_type,
        device=config.whisper.device,
        download_root=str(PATHS.whisper_cache_dir),
    )


class WhisperService:
    def __init__(self, model_factory: Any | None = None) -> None:
        self._model_factory = model_factory
        self._model_cache: dict[WhisperRuntimeConfig, Any] = {}

    def get_model(self, config: ConfigModel) -> Any:
        runtime_config = build_whisper_runtime_config(config)
        if runtime_config not in self._model_cache:
            self._model_cache[runtime_config] = self._create_model(runtime_config)
        return self._model_cache[runtime_config]

    def transcribe(self, audio_path: str, config: ConfigModel, **kwargs: Any) -> tuple[Any, Any]:
        model = self.get_model(config)
        return model.transcribe(audio_path, **kwargs)

    def _create_model(self, runtime_config: WhisperRuntimeConfig) -> Any:
        model_factory = self._model_factory or self._load_default_model_factory()
        return model_factory(
            runtime_config.model_name,
            device=runtime_config.device,
            compute_type=runtime_config.compute_type,
            download_root=runtime_config.download_root,
        )

    def run_smoke_test(self, config: ConfigModel) -> WhisperSmokeTestResult:
        runtime_config = build_whisper_runtime_config(config)
        model_cached = runtime_config in self._model_cache

        model_load_started = time.perf_counter()
        self.get_model(config)
        model_load_seconds = round(time.perf_counter() - model_load_started, 2)

        with NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = Path(temp_file.name)

        try:
            _write_silence_wav(temp_path)
            transcribe_started = time.perf_counter()
            segments, info = self.transcribe(
                str(temp_path),
                config,
                language=config.language_default,
                vad_filter=False,
                beam_size=1,
            )
            segment_list = list(segments)
            transcribe_seconds = round(time.perf_counter() - transcribe_started, 2)
        finally:
            temp_path.unlink(missing_ok=True)

        return WhisperSmokeTestResult(
            engine="faster-whisper",
            model=runtime_config.model_name,
            device=runtime_config.device,
            compute_type=runtime_config.compute_type,
            model_cached=model_cached,
            model_load_seconds=model_load_seconds,
            transcribe_seconds=transcribe_seconds,
            segment_count=len(segment_list),
            detected_language=getattr(info, "language", None),
        )

    @staticmethod
    def _load_default_model_factory() -> Any:
        from faster_whisper import WhisperModel

        return WhisperModel


def _write_silence_wav(path: Path, *, sample_rate: int = 16000, duration_seconds: float = 0.5) -> None:
    frame_count = max(1, int(sample_rate * duration_seconds))
    silence = b"\x00\x00" * frame_count

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(silence)
