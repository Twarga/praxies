# Handoff to the Next AI

If you're an AI agent picking up this project: read this first.

## State of the world (2026-04-25)

- **Repo:** `/home/twarga/praxis`. Linux/Arch. User home: `/home/twarga`.
- **Backend:** FastAPI in `backend/app/`. Boots cleanly under `.venv/bin/python -m uvicorn app.main:app`.
- **Frontend:** Vite + React 19 in `frontend/`. Builds cleanly via `vite build`.
- **Electron:** in `frontend/electron/`. Default Python is `.venv/bin/python` via `backend-launcher.js`.
- **Python env:** managed by **uv**, not pip. `pyproject.toml` is the source of truth. `uv.lock` is committed. Run `uv sync` to reproduce. `.venv/` is the runtime.
- **Old `venv/` directory may still exist** at the repo root — it's stale, can be deleted.

## What is DONE — don't redo

- Repo scaffold, FastAPI boot, Vite + React shell, Electron wiring (Phases 0–5 of `TASKS.md` are checked).
- Migration from pip+venv to uv+pyproject.toml. **Don't switch back.**
- All API endpoints in `backend/app/main.py` exist and respond (verified by hitting them).
- `.gitignore` already blocks `.venv/`, `venv/`, `__pycache__/`, `.env`, `.env.*` (with `!.env.example` allowlisted).

## What is BROKEN — fix these in order

The full audit is in `need_fixing.md`. Summary of P0 items:

1. **`personal_context` is empty in `~/.config/praxis/config.json`.** Spec requires the default 901-char text. Restore it AND make `PersonalContextEditor` (`frontend/src/App.jsx:1097-1139`) refuse to save blank.
2. **No startup recovery for stuck sessions.** Implement scan in `backend/app/main.py` `lifespan`. Cover statuses `recording`, `saved`, `queued`, `transcribing`, `analyzing`. There are real stuck sessions in `~/TwargaJournal/` to test against.
3. **Whisper transcription blocks the event loop.** Wrap blocking calls in `asyncio.to_thread`. Files: `backend/app/main.py:55-159` (`process_session`) and `backend/app/services/sessions.py:355-409` (ffmpeg/ffprobe subprocesses).
4. **`analysis_raw.txt` is dropped on the auto LLM path.** Capture last raw response in `run_analysis_with_retries` (`backend/app/services/analysis_service.py`) and persist before raising.
5. **`POST /api/config/test-openrouter`** doesn't map litellm 401/402 errors. Fix in `backend/app/main.py:220-246`.

After P0 is done, run gates GATE-0 through GATE-5 manually with a real recording before ticking them.

## Important rules

- **Don't add features.** The user wants Phases 0–5 actually working, not Phase 6+ scope creep.
- **Don't switch package managers.** Stay on uv. Don't add `requirements.txt` back.
- **Don't break the OpenRouter key flow.** Key lives in `~/.config/praxis/config.json`, set via Settings UI. Don't read from `.env` unless explicitly asked.
- **Don't touch `App.jsx` for refactoring.** It's 1,851 lines and overdue for a split — but that's not a P0. Leave it until phase 6.
- **Run the backend before claiming a fix works.** `cd /home/twarga/praxis && ./.venv/bin/python -m uvicorn backend.app.main:app --reload --port 8000` (or use `./scripts/dev.sh run`).

## Useful commands

```bash
# fresh dep install
uv sync

# backend only
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# full dev (backend + frontend + electron)
./scripts/dev.sh run

# frontend build smoke
cd frontend && npx vite build

# backend import smoke
PYTHONPATH=backend ./.venv/bin/python -c "from app.main import app; print('ok')"
```

## Files the user cares about

- `TASKS.md` — phase plan + checklist. Tick honestly.
- `IMPLEMENTATION_PLAN.md` — architecture + sprint plan. Don't deviate.
- `need_fixing.md` — concrete fix list with file:line.
- `~/.config/praxis/config.json` — runtime config (outside repo).
- `~/TwargaJournal/` — saved sessions (outside repo). Has real test data including stuck sessions.

## Test environment

- OpenRouter key the user provided in chat (`sk-or-v1-4274...`) **was leaked and must be rotated**. Do not write it to disk. Have the user paste a fresh key via Settings UI.
- Whisper `large-v3-turbo` model is being downloaded to `~/.cache/whisper/`. Should be present before you start testing transcription.
- `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` are installed.
- Hardware is strong: Ryzen AI 9 365, 22 GB RAM, 65 GB disk free.

Good luck. Don't break what works.
