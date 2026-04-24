from fastapi import FastAPI

from app.core.settings import APP_VERSION
from app.services.config import load_config


app = FastAPI(title="Praxies Backend", version=APP_VERSION)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
async def get_config() -> dict[str, object]:
    return load_config().model_dump(mode="json")
