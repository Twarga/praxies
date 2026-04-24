from fastapi import FastAPI

from app.core.settings import APP_VERSION, PATHS


app = FastAPI(title="Praxies Backend", version=APP_VERSION)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
async def get_config() -> dict[str, object]:
    return {
        "schema_version": 1,
        "journal_folder": str(PATHS.journal_dir),
        "language_default": "en",
        "video_quality": "720p",
        "retention_days": 30,
        "openrouter": {
            "api_key": "",
            "default_model": "google/gemini-2.5-flash-lite",
        },
        "whisper": {
            "model": "large-v3-turbo",
            "compute_type": "int8",
            "device": "cpu",
        },
        "directness": "direct",
        "personal_context": "",
        "phone_upload_enabled": False,
        "ready_sound_enabled": True,
        "theme": "bronze-dark",
        "telegram": {
            "enabled": False,
            "bot_token": "",
            "chat_id": "",
            "daily_digest_time": "08:00",
            "weekly_rollup_time": "sunday 20:00",
        },
    }
