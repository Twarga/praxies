from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from app.models import AnalysisModel


class AnalysisValidationError(ValueError):
    pass


def validate_analysis_payload(payload: dict[str, Any]) -> AnalysisModel:
    try:
        return AnalysisModel.model_validate(payload)
    except ValidationError as error:
        raise AnalysisValidationError(str(error)) from error


def parse_and_validate_analysis_response(response_text: str) -> AnalysisModel:
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise AnalysisValidationError("Analysis response is not valid JSON.") from error

    if not isinstance(payload, dict):
        raise AnalysisValidationError("Analysis response must be a JSON object.")

    return validate_analysis_payload(payload)
