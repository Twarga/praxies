from __future__ import annotations

import json
from copy import deepcopy

from app.services.analysis_service import parse_and_validate_analysis_response
from app.services.prompt_builder import ANALYSIS_SCHEMA_EXAMPLE


def _analysis_payload(**updates):
    payload = deepcopy(ANALYSIS_SCHEMA_EXAMPLE)
    payload.update(updates)
    return payload


def test_strong_coaching_report_fixture_validates():
    analysis = parse_and_validate_analysis_response(json.dumps(_analysis_payload()))

    assert analysis.schema_version == 2
    assert analysis.coaching_report.top_lessons[0].next_move
    assert analysis.coaching_report.practice_assignment.next_session_goal
    assert analysis.coaching_report.moment_feedback[0].transcript_quote


def test_short_test_recording_report_fixture_validates():
    payload = _analysis_payload(
        prose_verdict="This was a setup test, not a reflective journal session.",
        session_summary="The user checked whether recording, transcription, and analysis work on the new machine.",
    )
    payload["coaching_report"]["headline"] = "Make the next recording analyzable."
    payload["coaching_report"]["opening_read"] = (
        "This recording is useful as a technical test, but it is too short to coach deeply. "
        "The next session should focus on one topic, one concrete example, and one action."
    )
    payload["coaching_report"]["top_lessons"][0]["title"] = "A test recording needs a clear next real session."
    payload["coaching_report"]["practice_assignment"]["speaking_drill"] = (
        "Record two minutes about one real decision, with one example from the last 48 hours."
    )

    analysis = parse_and_validate_analysis_response(json.dumps(payload))

    assert analysis.coaching_report.headline == "Make the next recording analyzable."
    assert "two minutes" in analysis.coaching_report.practice_assignment.speaking_drill


def test_malformed_but_recoverable_moment_kind_fixture_validates():
    payload = _analysis_payload()
    payload["coaching_report"]["best_moment"]["kind"] = "technical_note"
    payload["coaching_report"]["moment_feedback"][0]["kind"] = "technical_observation"

    analysis = parse_and_validate_analysis_response(json.dumps(payload))

    assert analysis.coaching_report.best_moment.kind == "insight"
    assert analysis.coaching_report.moment_feedback[0].kind == "insight"


def test_multilingual_french_report_fixture_validates():
    payload = _analysis_payload(language="fr")
    payload["prose_verdict"] = "Tu as trouvé le vrai sujet, mais tu n'as pas terminé par une action."
    payload["session_summary"] = "La session passe d'une inquiétude générale à une décision plus concrète."
    payload["coaching_report"]["headline"] = "Ta pensée devient plus claire quand tu donnes un exemple précis."
    payload["coaching_report"]["practice_assignment"]["next_session_goal"] = (
        "Commencer par un exemple concret avant d'expliquer l'émotion."
    )
    payload["language_coach"]["main_language_gap"] = (
        "Les phrases sont compréhensibles, mais certaines restent trop longues."
    )

    analysis = parse_and_validate_analysis_response(json.dumps(payload, ensure_ascii=False))

    assert analysis.language == "fr"
    assert "exemple précis" in analysis.coaching_report.headline
    assert "phrases" in analysis.language_coach.main_language_gap
