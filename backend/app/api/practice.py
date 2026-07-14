"""Practice API — current goal, history, complete assignment, activate goal."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.coaching_repository import (
    complete_assignment,
    create_goal,
    get_active_goal,
    get_active_goals,
    get_assignment_history,
    get_current_assignment,
    get_goal_history,
)
from app.services.config import load_config

router = APIRouter(prefix="/api/practice", tags=["practice"])


class CreateGoalPayload(BaseModel):
    text: str = Field(min_length=3, max_length=240)
    category: str = Field(default="journal", max_length=48)
    success_criteria: list[str] = Field(default_factory=list, max_length=4)

    @field_validator("text", "category")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


@router.get("/current")
async def get_practice_current() -> dict[str, object]:
    config = load_config()
    goal = get_active_goal(config)
    goals = get_active_goals(config)
    assignment = get_current_assignment(config)

    return {
        "active_goal": goal.model_dump(mode="json") if goal else None,
        "active_goals": [item.model_dump(mode="json") for item in goals],
        "current_assignment": assignment.model_dump(mode="json") if assignment else None,
    }


@router.post("/goals")
async def post_practice_goal(payload: CreateGoalPayload) -> dict[str, object]:
    config = load_config()
    goal = create_goal(
        config,
        text=payload.text,
        category=payload.category,
        success_criteria=[item.strip() for item in payload.success_criteria if item.strip()],
        source_session_id="manual",
    )
    return {"goal": goal.model_dump(mode="json")}


@router.get("/history")
async def get_practice_history() -> dict[str, object]:
    config = load_config()
    goals = get_goal_history(config)
    assignments = get_assignment_history(config)

    return {
        "goals": [g.model_dump(mode="json") for g in goals],
        "assignments": [a.model_dump(mode="json") for a in assignments],
    }


@router.patch("/assignments/{assignment_id}")
async def patch_assignment(assignment_id: str) -> dict[str, object]:
    config = load_config()
    assignment = complete_assignment(config, assignment_id)

    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    return {
        "assignment": assignment.model_dump(mode="json"),
        "message": "Assignment marked complete.",
    }
