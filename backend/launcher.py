"""Frozen Linux backend entry point used by the Electron release."""

import os


def main() -> None:
    import uvicorn
    from app.main import app
    port = int(os.environ.get("PRAXIES_BACKEND_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
