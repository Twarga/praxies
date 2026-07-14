"""Local-only feedback endpoints for the 30-day dogfood trial."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.config import load_config
from app.services.dogfood import get_weekly_summary, log_checkin

router = APIRouter(prefix="/api/dogfood", tags=["dogfood"])


class CheckinPayload(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    understandable: bool | None = None
    correction_accurate: bool | None = None
    will_practice: bool | None = None
    friction_notes: str = Field(default="", max_length=500)


@router.post("/checkins")
async def create_checkin(payload: CheckinPayload) -> dict[str, object]:
    log_checkin(load_config(), **payload.model_dump())
    return {"saved": True, "local_only": True}


@router.get("/weekly-summary")
async def weekly_summary() -> dict[str, object]:
    return get_weekly_summary(load_config())
