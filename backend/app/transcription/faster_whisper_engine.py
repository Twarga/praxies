"""Faster Whisper engine adapter.

Wraps the existing WhisperService behind the TranscriptionEngine interface
so processing code depends on the contract, not the implementation.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from app.models.schemas import (
    HardwareInfo,
    TranscriptionBenchmarkResult,
    TranscriptionEngineInfo,
    TranscriptionModelInfo,
)
from app.services.config import load_config as _load_config
from app.services.whisper_service import WhisperService
from app.transcription import TranscriptionEngine

FASTER_WHISPER_MODELS = [
    TranscriptionModelInfo(
        model_id="tiny",
        engine_id="faster_whisper",
        display_name="tiny",
        languages=["multilingual"],
        estimated_disk_gb=0.15,
        estimated_ram_gb=1,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
    TranscriptionModelInfo(
        model_id="base",
        engine_id="faster_whisper",
        display_name="base",
        languages=["multilingual"],
        estimated_disk_gb=0.3,
        estimated_ram_gb=1,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
    TranscriptionModelInfo(
        model_id="small",
        engine_id="faster_whisper",
        display_name="small",
        languages=["multilingual"],
        estimated_disk_gb=1,
        estimated_ram_gb=2,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
    TranscriptionModelInfo(
        model_id="medium",
        engine_id="faster_whisper",
        display_name="medium",
        languages=["multilingual"],
        estimated_disk_gb=3,
        estimated_ram_gb=5,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
    TranscriptionModelInfo(
        model_id="large-v3",
        engine_id="faster_whisper",
        display_name="large-v3",
        languages=["multilingual"],
        estimated_disk_gb=6,
        estimated_ram_gb=10,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
    TranscriptionModelInfo(
        model_id="large-v3-turbo",
        engine_id="faster_whisper",
        display_name="large-v3-turbo",
        languages=["multilingual"],
        estimated_disk_gb=3,
        estimated_ram_gb=6,
        supported_compute_types=["int8", "float16"],
        compatible=True,
    ),
]


class FasterWhisperEngine(TranscriptionEngine):
    engine_id = "faster_whisper"
    display_name = "Faster Whisper"

    def __init__(self) -> None:
        self._service = WhisperService()

    def inspect_runtime(self) -> TranscriptionEngineInfo:
        try:
            import faster_whisper
            version = getattr(faster_whisper, "__version__", "installed")
        except ImportError:
            version = "not installed"

        return TranscriptionEngineInfo(
            engine_id=self.engine_id,
            display_name=self.display_name,
            available=True,
            runtime_version=version,
            supported=True,
            recommended=True,
        )

    async def fetch_catalog(self) -> list[TranscriptionModelInfo]:
        return list(FASTER_WHISPER_MODELS)

    async def download(
        self,
        model_id: str,
        destination: Path,
        progress_callback: Any = None,
    ) -> Path:
        destination.mkdir(parents=True, exist_ok=True)
        # download_model writes the actual CTranslate2 files into output_dir;
        # run it off the event loop because Hugging Face I/O is blocking.
        import asyncio
        from faster_whisper.utils import download_model
        path = await asyncio.to_thread(download_model, model_id, output_dir=str(destination))
        return Path(path)

    def verify(self, model_id: str, model_path: Path) -> dict[str, Any]:
        required = ["config.json", "model.bin", "tokenizer.json"]
        missing = [name for name in required if not (model_path / name).is_file()]
        total_bytes = sum(path.stat().st_size for path in model_path.rglob("*") if path.is_file()) if model_path.exists() else 0
        return {
            "ok": not missing and total_bytes > 0,
            "model_id": model_id,
            "path": str(model_path),
            "missing_files": missing,
            "total_size_bytes": total_bytes,
            "verified_at": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"),
        }

    def benchmark(
        self,
        model_id: str,
        model_path: Path,
        sample_audio: Path,
    ) -> TranscriptionBenchmarkResult:
        start = time.perf_counter()
        config = _load_config()
        config.whisper.model = str(model_path)
        segments, info = self._service.transcribe(
            str(sample_audio),
            config,
            language="en",
            vad_filter=False,
            beam_size=1,
        )
        elapsed = time.perf_counter() - start
        segment_list = list(segments)
        transcript_text = " ".join(str(getattr(segment, "text", "")).strip() for segment in segment_list).strip()
        reference_path = sample_audio.with_name("reference.txt")
        reference_text = reference_path.read_text(encoding="utf-8").strip() if reference_path.exists() else ""
        audio_duration = float(info.duration if hasattr(info, "duration") else 1.0)

        return TranscriptionBenchmarkResult(
            model_id=model_id,
            engine_id=self.engine_id,
            audio_duration_seconds=audio_duration,
            processing_seconds=round(elapsed, 2),
            real_time_factor=round(elapsed / max(audio_duration, 0.1), 2),
            detected_language=getattr(info, "language", None),
            device="cpu",
            compute_type="int8",
            transcript_text=transcript_text,
            reference_text=reference_text,
            word_error_rate=_word_error_rate(reference_text, transcript_text) if reference_text else None,
            timestamp=__import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"),
        )

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
        config = _load_config()
        config.whisper.model = str(model_path)
        segments, _info = self._service.transcribe(
            str(audio_path),
            config,
            language=language or config.language_default,
        )
        segment_list = list(segments)
        return [
            {
                "start_seconds": float(getattr(s, "start", 0.0) or 0.0),
                "end_seconds": float(getattr(s, "end", 0.0) or 0.0),
                "text": str(getattr(s, "text", "")).strip(),
            }
            for s in segment_list
            if str(getattr(s, "text", "")).strip()
        ]

    def remove(self, model_id: str, model_path: Path) -> bool:
        import shutil
        if model_path.exists():
            shutil.rmtree(model_path)
            return True
        return False


def _word_error_rate(reference: str, hypothesis: str) -> float:
    reference_words = reference.casefold().split()
    hypothesis_words = hypothesis.casefold().split()
    if not reference_words:
        return 0.0
    previous = list(range(len(hypothesis_words) + 1))
    for row, expected in enumerate(reference_words, start=1):
        current = [row]
        for column, actual in enumerate(hypothesis_words, start=1):
            current.append(min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (expected != actual)))
        previous = current
    return round(previous[-1] / len(reference_words), 3)
