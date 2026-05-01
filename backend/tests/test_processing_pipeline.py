from __future__ import annotations

import json
import shutil
from io import BytesIO
from types import SimpleNamespace

import pytest
from starlette.datastructures import UploadFile

import app.main as main_module
from app.models import RecurringPatternsModel
from app.services.json_io import read_json_file
from app.services.recurring_patterns import save_recurring_patterns
from app.services.sessions import (
    create_session,
    finalize_session,
    get_session_analysis_path,
    get_session_subtitle_path,
    get_session_transcript_json_path,
    get_session_transcript_text_path,
    get_session_waveform_path,
    load_session_bundle,
    load_session_meta,
    store_session_chunk,
)

from .test_session_lifecycle import _generate_webm_chunk


pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg/ffprobe required for processing pipeline test",
)


class _FakeWhisperService:
    def get_model(self, config):
        return object()

    def transcribe(self, audio_path, config, **kwargs):
        segments = [
            SimpleNamespace(start=0.0, end=1.1, text="Hello there."),
            SimpleNamespace(start=1.1, end=2.7, text="This is a real pipeline test."),
        ]
        return segments, {"language": kwargs.get("language", "en")}


class _FakeLlmClient:
    def __init__(self):
        self.system_prompt = ""

    def analyze_session(self, **kwargs):
        self.system_prompt = kwargs["system_prompt"]
        return json.dumps(
            {
                "schema_version": 1,
                "language": "en",
                "prose_verdict": "Clear speaking, solid structure, useful content.",
                "session_summary": "The speaker records a short practice session and stays coherent throughout.",
                "main_topics": ["pipeline verification", "speaking practice"],
                "grammar_and_language": {
                    "errors": [],
                    "fluency_score": 8,
                    "vocabulary_level": "B2",
                    "filler_words": {"like": 0, "uh": 0, "you know": 0},
                },
                "speaking_quality": {
                    "clarity": 8,
                    "pace": "steady",
                    "structure": "clean beginning, middle, and end",
                    "executive_presence_notes": "calm and direct",
                },
                "ideas_and_reasoning": {
                    "strong_points": ["The point is easy to follow."],
                    "weak_points": [],
                    "logical_flaws": [],
                    "factual_errors": [],
                    "philosophical_pushback": "Push one level deeper on why the pipeline matters.",
                },
                "recurring_patterns_hit": [],
                "actionable_improvements": ["Add one stronger closing sentence next time."],
            }
        )


@pytest.mark.asyncio
async def test_process_session_writes_transcript_analysis_waveform_and_progress(config, tmp_path, monkeypatch):
    fake_llm_client = _FakeLlmClient()
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    monkeypatch.setattr(main_module, "whisper_service", _FakeWhisperService())
    monkeypatch.setattr(main_module, "llm_client", fake_llm_client)

    meta = create_session(config, language="en", title="pipeline test")
    save_recurring_patterns(
        config,
        RecurringPatternsModel(
            language="en",
            updated_at="2026-05-01T10:00:00+00:00",
            patterns=[
                {
                    "name": "weak endings",
                    "description": "The session trails off instead of landing a clear final point.",
                    "count": 4,
                    "first_seen": "2026-04-01",
                    "last_seen": "2026-04-28",
                    "recent_sessions": ["previous-session"],
                }
            ],
        ),
    )
    video_bytes = _generate_webm_chunk(tmp_path / "pipeline.webm", duration_seconds=2)

    upload = UploadFile(filename="chunk-0.webm", file=BytesIO(video_bytes))
    await store_session_chunk(config, meta.id, 0, upload)
    await finalize_session(config, meta.id, title="pipeline test", save_mode="full")

    await main_module.process_session(meta.id)

    updated_meta = load_session_meta(config, meta.id)
    transcript_text_path = get_session_transcript_text_path(config, meta.id)
    transcript_json_path = get_session_transcript_json_path(config, meta.id)
    analysis_path = get_session_analysis_path(config, meta.id)
    subtitle_vtt_path = get_session_subtitle_path(config, meta.id, "en", "vtt")
    subtitle_srt_path = get_session_subtitle_path(config, meta.id, "en", "srt")
    waveform_path = get_session_waveform_path(config, meta.id)
    session_bundle = load_session_bundle(config, meta.id)

    assert updated_meta.status == "ready"
    assert transcript_text_path.exists()
    assert transcript_json_path.exists()
    assert analysis_path.exists()
    assert subtitle_vtt_path.exists()
    assert subtitle_srt_path.exists()
    assert waveform_path.exists()

    transcript_text = transcript_text_path.read_text(encoding="utf-8")
    transcript_json = read_json_file(transcript_json_path)
    analysis = read_json_file(analysis_path)
    waveform = read_json_file(waveform_path)

    assert "Hello there." in transcript_text
    assert len(transcript_json) == 2
    assert analysis["language"] == "en"
    assert analysis["actionable_improvements"] == ["Add one stronger closing sentence next time."]
    assert len(waveform) == 72
    assert max(waveform) > 0
    assert updated_meta.processing.progress_percent == 100
    assert updated_meta.processing.progress_label == "Analysis ready"
    assert len(updated_meta.processing.terminal_lines) >= 5
    assert "weak endings" in fake_llm_client.system_prompt
    assert "The session trails off instead of landing a clear final point." in fake_llm_client.system_prompt
    assert session_bundle["waveform"] == waveform
    assert session_bundle["subtitles"] == [
        {
            "language": "en",
            "vtt_filename": "subtitles.en.vtt",
            "srt_filename": "subtitles.en.srt",
        }
    ]
