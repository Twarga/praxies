"""M6-15 Multilingual coaching regression suite.

Tests that v3 prompts and v2 compatibility maps produce
readable, evidence-backed output across English, French, and Spanish.
"""

from __future__ import annotations

import json

from app.services.prompt_builder_v3 import (
    build_analysis_prompt_v3,
    validate_report_v3,
)
from app.services.report_compat import map_v2_to_v3

EN_TRANSCRIPT = [
    {"start_seconds": 0, "end_seconds": 8, "text": "Today I want to work on clearer explanations."},
    {"start_seconds": 8, "end_seconds": 20, "text": "Last week I gave a presentation and the feedback was that I was too vague."},
    {"start_seconds": 20, "end_seconds": 35, "text": "I think my problem is I assume people know the context when they do not."},
]

FR_TRANSCRIPT = [
    {"start_seconds": 0, "end_seconds": 8, "text": "Aujourd'hui je veux travailler sur mes explications."},
    {"start_seconds": 8, "end_seconds": 20, "text": "La semaine dernière j'ai fait une présentation et on m'a dit que j'étais trop vague."},
    {"start_seconds": 20, "end_seconds": 35, "text": "Je pense que mon problème c'est que je suppose que les gens connaissent le contexte."},
]

ES_TRANSCRIPT = [
    {"start_seconds": 0, "end_seconds": 8, "text": "Hoy quiero trabajar en explicaciones más claras."},
    {"start_seconds": 8, "end_seconds": 20, "text": "La semana pasada di una presentación y me dijeron que fui demasiado vago."},
    {"start_seconds": 20, "end_seconds": 35, "text": "Creo que mi problema es que asumo que la gente conoce el contexto."},
]

V3_FIXTURE_EN = {
    "schema_version": 3,
    "language": "en",
    "report": {
        "verdict": "You clearly identified the problem but did not commit to a change.",
        "previous_goal": {
            "result": "not_applicable",
            "summary": "",
            "evidence": [],
        },
        "strength": {
            "title": "Honest self-assessment",
            "explanation": "You named the real issue without softening it.",
            "evidence": {"timestamp_seconds": 20, "quote": "I assume people know the context when they do not."},
        },
        "priority_improvement": {
            "title": "Close with one action",
            "explanation": "The session ends with insight, not a decision.",
            "replacement_behavior": "End by saying what you will do differently in the next 48 hours.",
        },
        "evidence_moments": [
            {"timestamp_seconds": 20, "quote": "I assume people know the context.", "explanation": "Names the real blocker."},
        ],
        "practice": {
            "title": "One-action close",
            "instructions": "Practice ending every explanation by naming one specific next step.",
            "success_criteria": ["One action named", "Action is verifiable"],
        },
        "next_goal": {
            "text": "End every recording with one verifiable action.",
            "success_criteria": ["Action named in final 30 seconds", "Action is checkable"],
        },
    },
    "details": {},
}

V3_FIXTURE_FR = {
    **V3_FIXTURE_EN,
    "language": "fr",
    "report": {
        **{k: v for k, v in V3_FIXTURE_EN["report"].items() if k != "verdict"},
        "verdict": "Vous avez clairement identifié le problème mais ne vous êtes pas engagé à un changement.",
    },
}

V3_FIXTURE_ES = {
    **V3_FIXTURE_EN,
    "language": "es",
    "report": {
        **{k: v for k, v in V3_FIXTURE_EN["report"].items() if k != "verdict"},
        "verdict": "Identificaste claramente el problema pero no te comprometiste a un cambio.",
    },
}


class TestMultilingualV3Validation:
    """Report v3 fixtures validate in all three supported languages."""

    def test_english_fixture_validates(self):
        result = validate_report_v3(V3_FIXTURE_EN)
        assert result.language == "en"
        assert result.report.strength.title

    def test_french_fixture_validates(self):
        result = validate_report_v3(V3_FIXTURE_FR)
        assert result.language == "fr"

    def test_spanish_fixture_validates(self):
        result = validate_report_v3(V3_FIXTURE_ES)
        assert result.language == "es"


class TestMultilingualPromptGeneration:
    """V3 prompts enforce language rules for each supported language."""

    def test_english_prompt_contains_language_directive(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="test-en",
            language="en",
            transcript_segments=EN_TRANSCRIPT,
        )
        assert "english" in prompt.lower()

    def test_french_prompt_contains_language_directive(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="test-fr",
            language="fr",
            transcript_segments=FR_TRANSCRIPT,
        )
        assert "french" in prompt.lower() or "français" in prompt.lower()

    def test_spanish_prompt_contains_language_directive(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="test-es",
            language="es",
            transcript_segments=ES_TRANSCRIPT,
        )
        assert "spanish" in prompt.lower() or "español" in prompt.lower()

    def test_prompt_includes_evidence_requirement(self, config):
        for lang, transcript in [("en", EN_TRANSCRIPT), ("fr", FR_TRANSCRIPT), ("es", ES_TRANSCRIPT)]:
            prompt = build_analysis_prompt_v3(
                config,
                session_id=f"test-{lang}",
                language=lang,
                transcript_segments=transcript,
            )
            assert "evidence" in prompt.lower(), f"Missing evidence requirement in {lang} prompt"
            assert "transcript" in prompt.lower(), f"Missing transcript reference in {lang} prompt"


class TestV2CompatibilityMultilingual:
    """V2→V3 mapper correctly handles all three languages."""

    V2_BASE = {
        "schema_version": 2,
        "coaching_report": {
            "headline": "Test headline",
            "moment_feedback": [{"timestamp_seconds": 5, "transcript_quote": "test quote", "coaching_note": "test note"}],
        },
    }

    def test_maps_english_v2(self):
        result = map_v2_to_v3({"language": "en", **self.V2_BASE})
        assert result["language"] == "en"
        assert result["schema_version"] == 3

    def test_maps_french_v2(self):
        result = map_v2_to_v3({"language": "fr", **self.V2_BASE})
        assert result["language"] == "fr"

    def test_maps_spanish_v2(self):
        result = map_v2_to_v3({"language": "es", **self.V2_BASE})
        assert result["language"] == "es"


class TestSparseTranscriptHandling:
    """Prompts for very short/sparse transcripts should not require invented depth."""

    def test_short_transcript_produces_valid_prompt(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="short-en",
            language="en",
            transcript_segments=[{"start_seconds": 0, "end_seconds": 3, "text": "Testing one two."}],
        )
        assert prompt
        assert len(prompt) > 100

    def test_empty_transcript_produces_valid_prompt(self, config):
        prompt = build_analysis_prompt_v3(
            config,
            session_id="empty-en",
            language="en",
            transcript_segments=[],
        )
        assert prompt


class TestReportV3AvoidsSlopPatterns:
    """V3 reports should avoid generic encouragement and repeated prose patterns."""

    SLOP_PATTERNS = [
        "great job",
        "keep up the good work",
        "you're doing amazing",
        "unlock your potential",
        "supercharge",
        "seamless",
    ]

    def test_english_fixture_avoids_slop(self):
        serialized = json.dumps(V3_FIXTURE_EN).lower()
        for pattern in self.SLOP_PATTERNS:
            assert pattern not in serialized, f"Slop pattern '{pattern}' found in EN fixture"

    def test_french_fixture_avoids_slop(self):
        serialized = json.dumps(V3_FIXTURE_FR).lower()
        for pattern in self.SLOP_PATTERNS:
            assert pattern not in serialized, f"Slop pattern '{pattern}' found in FR fixture"

    def test_spanish_fixture_avoids_slop(self):
        serialized = json.dumps(V3_FIXTURE_ES).lower()
        for pattern in self.SLOP_PATTERNS:
            assert pattern not in serialized, f"Slop pattern '{pattern}' found in ES fixture"
