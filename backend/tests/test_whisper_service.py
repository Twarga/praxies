from __future__ import annotations

from types import SimpleNamespace

from app.services.whisper_service import WhisperService


class _FakeWhisperModel:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def transcribe(self, audio_path: str, **kwargs):
        self.calls.append((audio_path, kwargs))
        segments = [SimpleNamespace(start=0.0, end=0.4, text="ok")]
        info = SimpleNamespace(language=kwargs.get("language"))
        return segments, info


def test_run_smoke_test_loads_real_transcribe_path(config):
    fake_model = _FakeWhisperModel()
    service = WhisperService(model_factory=lambda *args, **kwargs: fake_model)

    result = service.run_smoke_test(config)

    assert result.engine == "faster-whisper"
    assert result.model == config.whisper.model
    assert result.device == config.whisper.device
    assert result.compute_type == config.whisper.compute_type
    assert result.segment_count == 1
    assert result.detected_language == config.language_default
    assert result.model_cached is False
    assert result.model_load_seconds >= 0
    assert result.transcribe_seconds >= 0
    assert len(fake_model.calls) == 1
    assert fake_model.calls[0][1]["language"] == config.language_default
    assert fake_model.calls[0][1]["vad_filter"] is False
    assert fake_model.calls[0][1]["beam_size"] == 1
