from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.settings import PATHS
from app.models import ConfigModel


@dataclass(frozen=True)
class WhisperRuntimeConfig:
    model_name: str
    compute_type: str
    device: str
    download_root: str


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

    @staticmethod
    def _load_default_model_factory() -> Any:
        from faster_whisper import WhisperModel

        return WhisperModel
