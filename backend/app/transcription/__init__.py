"""Transcription engine interface and registry."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from app.models.schemas import (
    HardwareInfo,
    TranscriptionBenchmarkResult,
    TranscriptionEngineInfo,
    TranscriptionModelInfo,
)


class TranscriptionEngine(ABC):
    engine_id: str
    display_name: str

    @abstractmethod
    def inspect_runtime(self) -> TranscriptionEngineInfo:
        ...

    @abstractmethod
    async def fetch_catalog(self) -> list[TranscriptionModelInfo]:
        ...

    @abstractmethod
    async def download(
        self,
        model_id: str,
        destination: Path,
        progress_callback: Any = None,
    ) -> Path:
        ...

    @abstractmethod
    def verify(self, model_id: str, model_path: Path) -> dict[str, Any]:
        ...

    @abstractmethod
    def benchmark(
        self,
        model_id: str,
        model_path: Path,
        sample_audio: Path,
    ) -> TranscriptionBenchmarkResult:
        ...

    @abstractmethod
    def transcribe(
        self,
        model_id: str,
        model_path: Path,
        audio_path: Path,
        *,
        language: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
    ) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    def remove(self, model_id: str, model_path: Path) -> bool:
        ...


ENGINE_REGISTRY: dict[str, TranscriptionEngine] = {}


def register_engine(engine: TranscriptionEngine) -> None:
    ENGINE_REGISTRY[engine.engine_id] = engine


def get_engine(engine_id: str) -> TranscriptionEngine | None:
    return ENGINE_REGISTRY.get(engine_id)


def list_engines() -> list[TranscriptionEngineInfo]:
    return [e.inspect_runtime() for e in ENGINE_REGISTRY.values()]


def get_default_engine() -> TranscriptionEngine | None:
    for eid in ["faster_whisper"]:
        if eid in ENGINE_REGISTRY:
            return ENGINE_REGISTRY[eid]
    return next(iter(ENGINE_REGISTRY.values()), None)


# The API is imported during application startup, so register the built-in
# engine here rather than relying on an unrelated processing path to do it.
# Without this, the runtime endpoint could inspect hardware while the catalog
# endpoint returned "Engine not found" and left first-run setup empty.
from app.transcription.faster_whisper_engine import FasterWhisperEngine

register_engine(FasterWhisperEngine())
