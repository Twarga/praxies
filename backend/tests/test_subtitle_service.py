from __future__ import annotations

import json

from app.main import ExportSubtitledVideoPayload
from app.services.subtitle_service import (
    normalize_subtitle_segments,
    render_srt,
    render_vtt,
    translate_subtitle_segments,
)


def test_export_subtitle_payload_accepts_arabic_language_code():
    payload = ExportSubtitledVideoPayload.model_validate({"target_language": "AR"})

    assert payload.target_language == "ar"


class _FakeTranslationClient:
    def complete_json(self, **kwargs):
        payload = json.loads(kwargs["user_message"])
        return json.dumps(
            {
                "segments": [
                    {
                        "index": segment["index"],
                        "text": f"AR: {segment['text']}",
                    }
                    for segment in payload["segments"]
                ]
            }
        )


def test_render_subtitles_from_transcript_segments():
    segments = normalize_subtitle_segments(
        [
            {"start_seconds": 0, "end_seconds": 1.25, "text": "Hello there."},
            {"start_seconds": 1.25, "end_seconds": 3.5, "text": "This is a subtitle test."},
        ]
    )

    srt = render_srt(segments)
    vtt = render_vtt(segments)

    assert "00:00:00,000 --> 00:00:01,250" in srt
    assert "Hello there." in srt
    assert vtt.startswith("WEBVTT")
    assert "00:00:01.250 --> 00:00:03.500" in vtt


def test_translate_subtitle_segments_preserves_timing(config):
    source = [
        {"start_seconds": 0, "end_seconds": 1.25, "text": "Hello there."},
        {"start_seconds": 1.25, "end_seconds": 3.5, "text": "This is a subtitle test."},
    ]

    translated = translate_subtitle_segments(
        client=_FakeTranslationClient(),
        config=config,
        source_language="en",
        target_language="ar",
        segments=source,
    )

    assert translated == [
        {
            "index": 0,
            "start_seconds": 0.0,
            "end_seconds": 1.25,
            "text": "AR: Hello there.",
        },
        {
            "index": 1,
            "start_seconds": 1.25,
            "end_seconds": 3.5,
            "text": "AR: This is a subtitle test.",
        },
    ]
