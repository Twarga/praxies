# Praxis Project Handoff Rapport

**Generated:** 2026-05-01  
**Author:** AI Assistant (for handover to next AI)  
**User:** Twarga

---
search for the best models localy or not on the cloud cheap and extreamly god top notch ,  but also cheap and hostable on all devices and also teh new ones 2025-2026 SOTA , not gpt 2 , or llama 2 old generation
## 1. Executive Summary

### What is Praxis?

Praxis (formerly "Twarga Journal") is an **AI-assisted video journaling desktop application** for Linux. Users record short video sessions from their webcam, which are then automatically transcribed with OpenAI's Whisper and analyzed with an LLM (via OpenRouter) to generate structured feedback. Over time, the app tracks recurring patterns, fluency trends, and maintains streaks to encourage consistent journaling habits.

**Target Users:** Language learners, self-improvement enthusiasts, people who want to reflect on their speaking habits and thought patterns.

**Platform:** Linux (Arch Linux + Sway), Desktop app (Electron)

---

## 2. Project Overview

### Core Features Implemented

| Feature | Status | Notes |
|--------|--------|-------|
| Video recording (webcam + mic) | ✅ Done | Chunked upload, pause/resume, review |
| Session persistence | ✅ Done | `video.webm` assembly, ffmpeg validation |
| Whisper transcription | ✅ Done | `faster-whisper` on CPU |
| LLM analysis | ✅ Done | OpenRouter JSON responses |
| Recurring patterns | ✅ Done | Per-language, merge/decay/cap |
| Today digest | ✅ Done | Yesterday-first selection |
| Streak tracking | ✅ Done | 2-minute minimum rule |
| Subtitle generation | ✅ Done | SRT/WebVTT, translation |
| Burned-in MP4 export | ✅ Done | FFmpeg subtitle burn |
| Trends API | ⚠️ Partial | Fluency + patterns, no filler words |
| Gallery + Session Detail | ✅ Done | Month grouping, language filter |
| Settings UI | ✅ Done | Config persistence |

### Phases Completed

| Phase | Description | Completion |
|-------|-------------|------------|
| Phase 0 | Bootstrap | ✅ Done |
| Phase 1 | Config, Storage, Index | ✅ Done |
| Phase 2 | Recording Flow | ✅ Done |
| Phase 3 | Gallery + Detail | ✅ Done |
| Phase 4 | Whisper Pipeline | ✅ Done |
| Phase 5 | LLM Analysis | ✅ Done |
| Phase 6 | Patterns, Digest, Streaks | ✅ Done |
| Phase 7 | Trends | ⚠️ Partial (API exists, no UI) |
| Phase 8 | SSE, Recovery, Retention | ❌ Not started |
| Phase 9 | Packaging | ❌ Not started |

### Extra Work (Outside Original Backlog)

- Subtitle generation (SRT/WebVTT)
- Subtitle translation (en, fr, es, ar)
- Burned-in MP4 export
- Waveform extraction + display
- Processing terminal/progress lines

---

## 3. Technical Architecture

### Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                             │
│  Electron (desktop shell)                               │
│  ├── main.js (process management)                        │
│  ├── preload.js (IPC bridge)                          │
│  └── backend-launcher.js (spawns Python)               │
│                                                      │
│  Vite + React 19                                      │
│  ├── Tailwind CSS (styling)                            │
│  ├── Recharts (trends charts)                         │
│  └── App.jsx (~1850 lines, all routes)                │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP :8000
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                    │
│                                                      │
│  Routes (`backend/app/main.py`)                           │
│  ├── /api/config (GET/PATCH)                        │
│  ├── /api/sessions (GET/POST/DELETE)               │
│  ├── /api/sessions/{id}/chunk                     │
│  ├── /api/sessions/{id}/finalize                   │
│  ├── /api/sessions/{id}/video                     │
│  ├── /api/sessions/{id}/thumbnail                  │
│  ├── /api/sessions/{id}/export-prompt             │
│  ├── /api/sessions/{id}/export-transcript          │
│  ├── /api/sessions/{id}/import-analysis           │
│  ├── /api/sessions/{id}/mark-read                 │
│  ├── /api/index (GET)                             │
│  ├── /api/patterns/{lang} (GET)                   │
│  ├── /api/digest/today (GET)                      │
│  ├── /api/trends (GET)                            │
│  ├── /api/whisper/models (GET)                     │
│  ├── /api/config/test-openrouter (POST)                 │
│  └── /api/events (SSE - not implemented)          │
│                                                      │
│  Services (`backend/app/services/`)                  │
│  ├── config.py (config read/write)                │
│  ├── sessions.py (chunk assembly, ffmpeg)       │
│  ├── whisper_service.py (transcription)          │
│  ├── llm_client.py (OpenRouter calls)             │
│  ├── recurring_patterns.py (pattern tracking)   │
│  ├── trends.py (aggregation)                     │
│  ├── subtitle_service.py (SRT/WebVTT)            │
│  ├── waveform_service.py (audio analysis)          │
│  ├── processing_queue.py (async worker)           │
│  ├── sessions.py (file I/O, index)                │
│  ├── json_io.py (safe read/write)               │
│  └── openrouter_catalog.py (model listing)       │
│                                                      │
│  Models (`backend/app/models/`)                   │
│  └── schemas.py (Pydantic models)                  │
│                                                      │
│  Core (`backend/app/core/`)                       │
│  └── settings.py (config defaults)               │
└─────────────────────────────────────────────────────────┘
```

### Directory Layout

```
praxis/
├── backend/
│   ├── app/
│   │   ├── api/          # (not used, routes in main.py)
│   │   ├── core/         # settings.py
│   │   ├── models/       # schemas.py
│   │   ├── services/    # all business logic
│   │   ├── main.py      # FastAPI app + routes
│   │   └── __init__.py
│   ├── tests/           # pytest tests
│   └── pyproject.toml   # Python deps (uv)
├── frontend/
│   ├── electron/        # main.js, preload.js, backend-launcher.js
│   ├── src/
│   │   ├── App.jsx     # all React components
│   │   └── index.css   # Tailwind + custom styles
│   ├── public/
│   └── package.json
├── scripts/
│   └── dev.sh          # one-terminal dev runner
├── docs/               # specs and redesign docs
├── TASKS.md            # phase checklist
├── IMPLEMENTATION_PLAN.md  # architecture plan
├── need_fixing.md      # current bugs (P0-P2)
├── HANDOFF.md          # quick handoff notes
└── README.md
```

### Data Storage

| Location | Contents |
|----------|----------|
| `~/.config/praxis/config.json` | User config (API key, models, personal context) |
| `~/TwargaJournal/` | All sessions |
| `~/TwargaJournal/_index.json` | Session index (fast lookup) |
| `~/TwargaJournal/_weekly/` | Weekly rollup files |
| `~/TwargaJournal/{session_id}/` | Per-session: `meta.json`, `video.webm`, `transcript.txt`, `transcript.json`, `analysis.json`, `analysis_raw.txt`, `thumb.jpg`, `waveform.json`, `subtitles/{lang}.json` |

---

## 4. Current Progress (Per Phase Gate)

### Phase 0 — Bootstrap
- [x] `uvicorn` starts locally
- [x] Backend health/config check before frontend load
- [ ] Electron opens window (MANUAL QA)

### Phase 1 — Config, Storage, Index
- [x] First launch creates valid config
- [ ] Today shows first-launch prose (UI differs from spec)
- [x] Settings reads/writes real config

### Phase 2 — Recording Flow
- [ ] 2-minute recording saves successfully (MANUAL QA)
- [ ] `video.webm` plays in review (MANUAL QA)
- [ ] Pause/resume produces usable final (MANUAL QA)

### Phase 3 — Gallery + Detail
- [ ] Gallery renders sessions (MANUAL QA)
- [ ] Session Detail streams video (MANUAL QA)
- [ ] Language filtering works (MANUAL QA)

### Phase 4 — Whisper Pipeline
- [ ] English transcribes to English (MANUAL QA)
- [ ] French transcribes to French (MANUAL QA)
- [ ] Thumbnails appear (MANUAL QA)

### Phase 5 — LLM Analysis
- [ ] Ready sessions produce valid `analysis.json` (needs manual verification)
- [ ] French analysis prose is French (needs manual verification)
- [ ] Bad API key → `needs_attention` (needs test)

### Phase 6 — Patterns, Digest, Streaks
- [x] Sessions <2 min don't increment streak
- [x] Digest selects correct session
- [x] Pattern hits show and persist

### Phase 7 — Trends
- [ ] Trends renders for all ranges (no UI yet)
- [ ] Filler words degrade gracefully (not implemented)
- [ ] Weekly rollups generate (not implemented)

---

## 5. Known Issues (P0 Priority)

From `need_fixing.md`:

### P0 — Actually Broken

1. **`personal_context` on disk is empty**
   - Symptom: `~/.config/praxis/config.json` has `"personal_context": ""`
   - Impact: Every LLM analysis prompt has NO persona/feedback guidance
   - Fix: Backend normalizes empty to default; frontend refuses to save blank

2. **No startup recovery for stuck sessions**
   - Symptom: Sessions stuck at `queued`, `transcribing`, `analyzing` after backend restart
   - Impact: Processing never resumes
   - Fix: Implement recovery scan in `lifespan` startup

3. **Whisper transcription blocks FastAPI event loop**
   - Symptom: All API calls stall while transcribing
   - Impact: UI freezes
   - Fix: Wrap blocking calls in `asyncio.to_thread()`

4. **`analysis_raw.txt` dropped on LLM failure**
   - Symptom: Malformed JSON responses are discarded
   - Impact: No debugging info for failed analysis
   - Fix: Capture last raw response before raising

5. **`POST /api/config/test-openrouter` doesn't map 401/402**
   - Symptom: Invalid key returns 502 instead of 401/402
   - Impact: Wrong error handling
   - Fix: Catch litellm `AuthenticationError`

### P1 — Wrong / Fragile

6. All Phase gates 0–5 are unticked (need MANUAL QA)
7. T103 Today banner not implemented
8. Recorder `useEffect` dependency thrashes listeners
9. `PATCH /api/config` leaks 500 errors
10. No tests (now has partial coverage)

---

## 6. What's Been Tested

### Automated Tests (17 passing)

```
backend/tests/
├── test_openrouter_status.py    # OpenRouter API helpers
├── test_openrouter_catalog.py  # Model listing
├── test_whisper_service.py     # Whisper smoke path
├── test_session_lifecycle.py    # Create/chunk/finalize/delete
├── test_digest.py             # Digest selection
├── test_digest_api.py         # Digest API
├��─ test_patterns_api.py      # Patterns API
├── test_trends.py            # Trends aggregation
├── test_trends_api.py       # Trends API
├── test_index.py            # Index rebuild
├── test_recurring_patterns.py # Pattern merge/decay
├── test_processing_pipeline.py # Full pipeline with fakes
├── test_subtitle_service.py # Subtitle generation
└── conftest.py               # Fixtures
```

### Manual QA Needed

- Camera permission denied flow
- 2-minute recording save + replay
- Pause/resume produces valid output
- Real Whisper transcription (English + French)
- Real OpenRouter analysis
- Bad API key → needs_attention flow
- Phone upload on LAN

---

## 7. User Context

- **Platform:** Linux/Arch with Sway window manager
- **Hardware:** Ryzen AI 9 365, 22 GB RAM, 65 GB disk free
- **Journal folder:** `~/TwargaJournal/`
- **Config folder:** `~/.config/praxis/`
- **OpenRouter key:** User provided in chat (LEAKED - must be rotated)
- **Whisper model:** `large-v3-turbo` downloading to `~/.cache/whisper/`
- **FFmpeg:** `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` installed

---

## 8. Package Manager

**USE uv (NOT pip)**

- `pyproject.toml` is source of truth
- `uv.lock` is committed
- `.venv/` is the runtime (created by `uv sync`)
- Run `uv sync` to install deps
- Don't add `requirements.txt` back

---

## 9. Commands to Run

```bash
# Fresh dependency install
uv sync

# Backend only (from repo root)
.venv/bin/python -m uvicorn backend.app.main:app --reload --port 8000

# Or use dev script (backend + frontend + electron)
./scripts/dev.sh run

# Frontend build smoke
cd frontend && npx vite build

# Run tests
uv run pytest

# Import smoke
PYTHONPATH=backend .venv/bin/python -c "from backend.app.main import app; print('ok')"
```

---

## 10. Files to Know

| File | Purpose |
|------|---------|
| `TASKS.md` | Phase plan + checklist (source of truth) |
| `IMPLEMENTATION_PLAN.md` | Architecture + sprint plan |
| `need_fixing.md` | Concrete bug fixes with file:line |
| `HANDOFF.md` | Quick reference for next AI |
| `~/.config/praxis/config.json` | Runtime config (outside repo) |
| `~/TwargaJournal/` | Saved sessions (outside repo) |

---

## 11. What the Next AI Should Do

### Priority 1: Fix P0 Bugs (in order)

1. Fix `personal_context` empty state
2. Add startup recovery for stuck sessions
3. Wrap Whisper/ffmpeg in `asyncio.to_thread()`
4. Persist `analysis_raw.txt` on LLM failure
5. Fix `test-openrouter` error mapping

### Priority 2: Run Manual QA

After fixing P0 bugs, run through the phase gates with real recordings:
- Record 2-minute English session
- Verify transcribe + analyze + streak works
- Verify French analysis is in French
- Verify bad API key → needs_attention

### Priority 3: Continue Development

Then continue with:
- Trends page UI
- SSE for live updates
- Phone upload
- Packaging (AppImage)

---

## 12. DON'Ts

- ❌ Don't add features outside original scope
- ❌ Don't switch from uv to pip
- ❌ Don't read OpenRouter key from `.env` (it's in config.json)
- ❌ Don't touch `App.jsx` for refactoring (not a priority)
- ❌ Don't break the existing API endpoints

---

## 13. Summary for Uninformed Reader

**What is this app?**  
Praxis is a personal video journal app where you record short videos of yourself thinking out loud. The app automatically transcribes what you said (using Whisper AI), then analyzes your speaking patterns and habits (using OpenRouter LLM), and shows you trends over time to help you improve.

**Why does it exist?**  
The user (Twarga) wanted a private, local-first tool for self-reflection. Most journaling apps are cloud-based or don't include AI analysis. This runs entirely on the user's machine (except the LLM call which goes to OpenRouter).

**What's done?**  
The core recording → transcription → analysis pipeline works. Gallery, session detail, settings, streaks, digest, and recurring patterns are all implemented. Trends API exists but has no UI yet.

**What's broken?**  
The LLM analysis prompts are empty because `personal_context` wasn't saved. Sessions stuck in "processing" never recover after a restart. The UI freezes while transcribing. No tests exist.

**What's next?**  
Fix those bugs, run manual tests with real recordings, add the Trends page UI, then package for distribution as an AppImage.

---

*End of rapport.*