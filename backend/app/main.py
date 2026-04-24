from typing import Any

from fastapi import FastAPI

from app.core.settings import APP_VERSION
from app.services.config import dump_config_for_api, load_config, update_config


app = FastAPI(title="Praxies Backend", version=APP_VERSION)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
async def get_config() -> dict[str, object]:
    return dump_config_for_api(load_config())


@app.patch("/api/config")
async def patch_config(payload: dict[str, Any]) -> dict[str, object]:
    updated = update_config(payload)
    return dump_config_for_api(updated)
