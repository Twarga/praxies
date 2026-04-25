from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from app.models import AnalysisModel
from app.services.llm_client import LiteLLMOpenRouterClient


class AnalysisValidationError(ValueError):
    pass


class AnalysisRetryExhaustedError(RuntimeError):
    pass


class AnalysisNeedsAttentionError(RuntimeError):
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


def run_analysis_with_retries(
    *,
    client: LiteLLMOpenRouterClient,
    config,
    system_prompt: str,
    user_message: str,
    sleep_fn: Callable[[float], None] | None = None,
    network_retry_limit: int = 3,
) -> AnalysisModel:
    sleep = sleep_fn or (lambda _seconds: None)
    malformed_retry_used = False
    timeout_attempts = 0
    server_error_attempts = 0
    rate_limit_attempts = 0
    network_attempts = 0
    current_system_prompt = system_prompt

    while True:
        try:
            response_text = client.analyze_session(
                config=config,
                system_prompt=current_system_prompt,
                user_message=user_message,
            )
            return parse_and_validate_analysis_response(response_text)
        except AnalysisValidationError as error:
            if malformed_retry_used:
                raise AnalysisRetryExhaustedError("Analysis response remained malformed after retry.") from error

            malformed_retry_used = True
            current_system_prompt = (
                f"{system_prompt}\n\n"
                "Retry requirement: respond ONLY with valid JSON, nothing else."
            )
            continue
        except Exception as error:  # noqa: BLE001
            status_code = _extract_status_code(error)
            message = str(error).lower()

            if status_code == 401:
                raise AnalysisNeedsAttentionError("API key invalid.") from error

            if status_code == 402:
                raise AnalysisNeedsAttentionError("Credits exhausted.") from error

            if _is_timeout_error(error, message):
                if timeout_attempts >= 2:
                    raise AnalysisRetryExhaustedError("Analysis timed out after retries.") from error
                sleep([2, 5][timeout_attempts])
                timeout_attempts += 1
                continue

            if status_code == 429:
                if rate_limit_attempts >= 3:
                    raise AnalysisRetryExhaustedError("Analysis hit rate limits after retries.") from error
                sleep([30, 120, 600][rate_limit_attempts])
                rate_limit_attempts += 1
                continue

            if status_code == 500:
                if server_error_attempts >= 2:
                    raise AnalysisRetryExhaustedError("Analysis failed with server errors after retries.") from error
                sleep([2, 5][server_error_attempts])
                server_error_attempts += 1
                continue

            if _is_network_error(error, message):
                if network_attempts >= network_retry_limit:
                    raise AnalysisRetryExhaustedError("Analysis failed with network errors after retries.") from error
                sleep(60)
                network_attempts += 1
                continue

            raise


def _extract_status_code(error: Exception) -> int | None:
    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int):
        return status_code

    response = getattr(error, "response", None)
    response_status = getattr(response, "status_code", None)
    if isinstance(response_status, int):
        return response_status

    return None


def _is_timeout_error(error: Exception, message: str) -> bool:
    return isinstance(error, TimeoutError) or "timeout" in message or "timed out" in message


def _is_network_error(error: Exception, message: str) -> bool:
    if isinstance(error, (ConnectionError, OSError)):
        return True

    network_markers = [
        "network",
        "connection reset",
        "connection aborted",
        "connection refused",
        "temporary failure in name resolution",
        "name or service not known",
    ]
    return any(marker in message for marker in network_markers)
