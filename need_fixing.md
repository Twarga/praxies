# Praxis — Things to Fix Before Phase 6

Audit date: 2026-04-25.
Source of truth for the audit: `TASKS.md`, `IMPLEMENTATION_PLAN.md`, the running backend on `127.0.0.1:8000`, and the on-disk `~/.config/praxis/config.json` + `~/TwargaJournal/`.

Do these in the listed order. Don't tick a phase gate in `TASKS.md` until the corresponding fix below is verified on a real recording.

---

## P0 — actually broken right now

### 1. `personal_context` on disk is empty
- **Symptom:** `/home/twarga/.config/praxis/config.json` has `"personal_context": ""` (length 0). Default is 901 chars.
- **Why it matters:** every LLM analysis prompt currently goes out with **no persona / no feedback-style guidance**. Spec/T014 + GATE-1 require the exact default text on first launch, and require it to keep working forever.
- **Root cause:** `PersonalContextEditor` (`frontend/src/App.jsx:1097-1139`) autosaves on every keystroke after 1 second. If the textarea was cleared, the empty string was persisted.
- **Fix:**
  - Backend: in `backend/app/services/config.py` `_normalize_legacy_config_payload`, if `personal_context.strip() == ""`, replace with `DEFAULT_PERSONAL_CONTEXT`.
  - Frontend: in `PersonalContextEditor`, refuse to autosave when `draftValue.trim() === ""` (or substitute the default).
  - Quick recovery for current state: PATCH `/api/config` with the default text once, or delete `~/.config/praxis/config.json` to re-bootstrap.

### 2. Stuck-state recovery on backend startup
- **Symptom on disk:** `2026-04-25_en_untitled-2` is `status: "queued"`, `2026-04-25_en_untitled` is `status: "saved"` — neither is in any in-memory queue, so they will never advance.
- **Why it matters:** the `processing_queue` is in-memory only. Every backend restart loses the queue, but `meta.json` still says `queued` / `transcribing` / `analyzing`. T142 only covers `recording`.
- **Fix:** in `backend/app/main.py` `lifespan` startup, after `processing_queue.start()`:
  1. Walk every session via `discover_session_dirs(load_config())`.
  2. For each meta in `{recording, saved, queued, transcribing, analyzing}`:
     - If `recording` and `video.webm` is missing → mark `failed` with `"interrupted before finalize"`.
     - If `saved` and `video.webm` exists → set status to `queued` and re-enqueue.
     - If `queued | transcribing | analyzing` → reset to `queued`, clear `processing.*_started_at` for the in-flight stage, re-enqueue.
  3. `rebuild_index(config)` once at the end.

### 3. Whisper transcription blocks the FastAPI event loop
- **Symptom:** while a session is transcribing, every other API call stalls (gallery, settings, etc.).
- **Why:** `process_session` in `backend/app/main.py:55-159` calls `whisper_service.transcribe(...)` synchronously inside an async function. Same problem with `subprocess.run(...)` calls in `backend/app/services/sessions.py:355-409` (`assemble_session_video`, `extract_session_audio`, `extract_session_thumbnail`, `probe_session_video`).
- **Fix:** wrap blocking calls in `await asyncio.to_thread(...)`. Example:
  ```python
  segments, info = await asyncio.to_thread(
      whisper_service.transcribe, str(audio_path), config, language=session_meta.language
  )
  ```
  For ffmpeg/ffprobe, switch to `asyncio.create_subprocess_exec` or wrap each `subprocess.run` call in `asyncio.to_thread`.

### 4. `analysis_raw.txt` is dropped on the LLM auto-path
- **Symptom:** when the LLM returns malformed JSON twice in a row, the response text is thrown away. Spec/T093 requires it on disk.
- **Why:** `parse_and_validate_analysis_response` raises before any persistence. Today, raw is written only on the manual `import-analysis` path (`backend/app/main.py:436`).
- **Fix:** capture the last raw response inside `run_analysis_with_retries` (return tuple `(analysis, last_raw)` or stash on the exception). In the worker, on `AnalysisRetryExhaustedError` or `AnalysisValidationError`, call `write_session_analysis_raw(config, session_id, last_raw)` before updating meta.

### 5. `POST /api/config/test-openrouter` doesn't reach 401/402 mapping
- **Symptom:** invalid OpenRouter key returns a generic 502 instead of 401/402.
- **Why:** the handler only catches `OpenRouterClientError` (raised only when key is missing or content is empty) and `JSONDecodeError`. LiteLLM wraps auth errors in a different exception class.
- **Fix:** in `backend/app/main.py:220-246`, also catch `litellm.exceptions.AuthenticationError` (→ 401) and `litellm.exceptions.OpenAIError` (→ 502 with detail). Verify by `grep -r "AuthenticationError" venv/lib/python*/site-packages/litellm/` to find the right import.

---

## P1 — wrong / fragile

### 6. Phase gates 0–5 are unticked
- All underlying tasks T001–T102 are checked, but **GATE-0 / 1 / 2 / 3 / 4 / 5 are red** in `TASKS.md`.
- **Fix:** after P0 above, manually run gate checks against real recordings. Tick the gate only after a 2-minute recording produces a valid `video.webm`, transcript, and `analysis.json` end-to-end.

### 7. T103 is the only un-ticked Phase 5 task
- "Today banner for skipped analysis / invalid key / exhausted credits / malformed response."
- Without it, the user has no surface for the failure modes from #1, #4, and #5.
- **Fix:** in `frontend/src/App.jsx` `TodayPage`, surface a banner above the digest card when `index.sessions[0].status` is `needs_attention` or `failed`, with a deep link to the session-detail page.

### 8. `useEffect` dep on the recorder object thrashes listeners
- **File:** `frontend/src/App.jsx:1599-1658`.
- The `recorder` object reference changes every render, so the keyboard-shortcut effect tears down + re-attaches on every render of `RecordPage`.
- **Fix:** depend on `recorder.state`, `recorder.sessionId` and primitive values. Wrap shortcut callbacks in `useCallback`. Or use the React 19 `useEffectEvent` pattern.

### 9. `PATCH /api/config` leaks Pydantic validation errors as raw 500
- **File:** `backend/app/main.py:214-217`.
- **Fix:** wrap `update_config(payload)` in try/except `ValidationError` → 400 with `error.errors()`.

### 10. No tests anywhere
- `backend/tests/` is empty. Q001–Q009 are all open. The "highest-risk engineering spike" (chunk → final WebM) has zero coverage.
- **Fix (minimum viable):** add `backend/tests/test_session_lifecycle.py` covering `create_session` → `store_session_chunk` × 2 → `assemble_session_video` → `probe_session_video` → `delete_session_dir`. Use `pytest` with a `tmp_path` fixture and a stub config.

---

## P2 — cleanup / polish

- **`ConfigModel` has no `app_version`** — add one for future migrations.
- **LLM model field in Settings is free-text** — consider a curated dropdown with the OpenRouter models you actually intend to support, plus an "other" escape hatch.
- **`scripts/dev.sh run` uses `--reload`** — fork-reload kills the in-memory `processing_queue` on every save. Either drop `--reload`, or make the recovery scan from #2 idempotent enough that reload doesn't corrupt state.
- **`App.jsx` is 1,851 lines.** Split per-page into `frontend/src/pages/` (the empty folder is already there) before Phase 6 lands.
- **`aiofiles` referenced in plan but not in `pyproject.toml`.** Decide: drop the plan note, or add the dep.

---

## Phase 7 — pre-distribution (do AFTER P0/P1, BEFORE shipping)

### 11. Whisper model manager in Settings
- **Why:** today the Whisper model is hardcoded (`large-v3-turbo`) and auto-downloads silently the first time `whisper_service.transcribe(...)` is called. End users won't have a `~/.cache/whisper/` and won't know what's happening. Shipping the model in the AppImage would make the installer ~2 GB.
- **Goal:** ship the app with NO model bundled. Let the user pick + download via Settings UI on first launch.

- **Backend — 4 new endpoints in `backend/app/main.py` (or a new `backend/app/routes/whisper.py`):**
  ```
  GET    /api/whisper/models               → list with {name, size_mb, quality, speed, installed, active, recommended}
  POST   /api/whisper/models/{name}/download   → start background download
  GET    /api/whisper/models/{name}/progress   → {bytes_downloaded, bytes_total, percent, status}
  POST   /api/whisper/models/{name}/activate   → write {whisper.model: name} to ~/.config/praxis/config.json
  DELETE /api/whisper/models/{name}            → remove cached folder
  ```
- **Backend — model registry:** static list of supported models (tiny, base, small, medium, large-v3-turbo, large-v3) with size + quality/speed scores + HF repo id. Mark `large-v3-turbo` as `recommended: True`.
- **Backend — installed-model detection:** scan `~/.cache/whisper/` for `models--*--faster-whisper-{name}` folders.
- **Backend — download with progress:** use `huggingface_hub.snapshot_download` with a custom `tqdm_class` that writes progress into a shared dict keyed by model name. Endpoint reads from that dict. (SSE is nicer than polling but polling every 1s is fine for an MVP.)
- **Backend — concurrency rule:** only one download at a time. Reject second download with 409.

- **Frontend — `WhisperModelsPanel` component** in the Settings page (next to AI / Personal Context):
  - Fetch `/api/whisper/models` on mount + after every action.
  - One card per model: name, size, ★ quality, ★ speed, status badge (`Not installed` / `Downloading 47%` / `Installed` / `Active`).
  - Buttons: `Download` / `Use this` / `Delete`. Disable `Download` on other rows while one is downloading.
  - Poll `/progress` every 1s while a download is active.
  - First-launch banner on `TodayPage` if no model is installed: *"Pick a Whisper model to start recording."* with a deep link to Settings.

- **Config:** add `whisper.model` field to `ConfigModel` (already exists? verify). Default to whatever is installed; if nothing installed, `null` and the recorder UI must refuse to start a session.

- **Acceptance:** fresh machine with empty `~/.cache/whisper/` → install AppImage → open app → Today page shows banner → Settings → click Download on `large-v3-turbo` → progress bar → done → record session → transcribes successfully.

### 12. Bundle FFmpeg in the AppImage
- **Symptom:** `backend/app/services/sessions.py` calls `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` directly. End users may not have FFmpeg installed.
- **Fix:** embed static FFmpeg binaries inside the AppImage (e.g. in `frontend/electron/resources/ffmpeg/`). Add a config field `ffmpeg.binary_path` that defaults to the bundled binary, fall back to `which ffmpeg` for dev. Update `sessions.py` to read the path from config.

### 13. Bundle Python runtime in the AppImage
- **Symptom:** Electron currently spawns `.venv/bin/python` from the repo. End users won't have `.venv/`.
- **Fix:** use `python-build-standalone` (Astral's prebuilt portable Pythons) or `pyinstaller` to embed Python + the `faster-whisper` / `litellm` / `fastapi` site-packages inside the AppImage. Update `frontend/electron/backend-launcher.js` to point at the bundled interpreter when running packaged.

### 14. First-launch onboarding flow
- After #11 ships, end users land on a blank app with no key, no model, no personal context. Need a 3-step onboarding wizard: (1) paste OpenRouter key + test, (2) pick + download Whisper model, (3) confirm/edit personal context. Block the recorder until all three are green.

---

## Recommended fix order

1. P0 #1 (personal_context) — 5 min.
2. P0 #2 (startup recovery scan) — 30 min.
3. P0 #3 (asyncio.to_thread wrappers) — 20 min.
4. P0 #4 (persist analysis_raw.txt) — 20 min.
5. P0 #5 (test-openrouter mapping) — 15 min.
6. P1 #6 (run GATE-0 → GATE-5 by hand, tick them honestly) — 1 hour.
7. P1 #7 (T103 Today banner) — 30 min.
8. P1 #8 (recorder useEffect dep) — 15 min.
9. P1 #9 (PATCH config error handling) — 5 min.
10. P1 #10 (one integration test for session lifecycle) — 45 min.
11. Then start Phase 6.

Total: ~half a day to be honestly green on Phases 0–5 before adding new surface area.

Items 11–14 (Phase 7 pre-distribution) come AFTER Phase 6 is done. Don't let an AI build the Whisper model picker before the P0 bugs are fixed — it's distribution polish, not a blocker.
