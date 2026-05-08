# Praxis

<p align="center">
  <img src="./logo.png" alt="Praxis logo" width="180" />
</p>

<p align="center">
  A focused desktop journal for recording thoughts, transcribing them, and turning them into structured feedback over time.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-Desktop-1f1f1f?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-Frontend-1f1f1f?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-Build-1f1f1f?style=flat-square&logo=vite&logoColor=646CFF" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-UI-1f1f1f?style=flat-square&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-1f1f1f?style=flat-square&logo=fastapi&logoColor=00C7B7" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.12+-1f1f1f?style=flat-square&logo=python&logoColor=FFD43B" alt="Python" />
  <img src="https://img.shields.io/badge/Whisper-Transcription-1f1f1f?style=flat-square" alt="Whisper" />
  <img src="https://img.shields.io/badge/LiteLLM-LLM%20routing-1f1f1f?style=flat-square" alt="LiteLLM" />
  <img src="https://img.shields.io/badge/OpenRouter-Models-1f1f1f?style=flat-square" alt="OpenRouter" />
  <img src="https://img.shields.io/badge/FFmpeg-Media-1f1f1f?style=flat-square&logo=ffmpeg&logoColor=5CB85C" alt="FFmpeg" />
  <img src="https://img.shields.io/badge/Linux-Arch%20%2B%20Wayland-1f1f1f?style=flat-square&logo=linux&logoColor=white" alt="Linux" />
</p>

## What it is

Praxis is an AI-assisted video journaling app for desktop. Record a session, transcribe it with Whisper, analyze it with an LLM, and review how your speaking, ideas, and habits evolve over time.

## Core workflow

1. Record from webcam and microphone
2. Transcribe locally with Whisper
3. Generate structured analysis and feedback
4. Review sessions in a private desktop archive
5. Track patterns, fluency, and momentum over time

## Features

- Session gallery with month grouping, language filter, and thumbnails
- Trends page with fluency charts, recurring patterns, and filler-word tracking
- External LLM fallback workflow (export prompt, paste analysis)
- LAN phone upload with QR code
- Weekly rollups
- Subtitle generation, translation, and burned-in MP4 export
- Real-time processing status via SSE
- Crash recovery and retention compression

## Tech stack

- Electron
- React
- Vite
- Tailwind CSS
- FastAPI
- Python
- faster-whisper
- LiteLLM
- OpenRouter
- FFmpeg

## Status

Core pipeline complete: recording, upload, local transcription, multi-provider
LLM analysis, coaching reports, Stats, subtitles, phone upload, SSE live
updates, crash recovery, retention, first-run onboarding, and Linux AppImage
packaging are implemented. Current release notes are in
[`docs/RELEASE_NOTES_0.1.0.md`](docs/RELEASE_NOTES_0.1.0.md).

## Development

Prerequisites:

- [uv](https://docs.astral.sh/uv/) (manages Python and backend deps)
- Node.js 20+
- npm
- FFmpeg

Development dependency setup:

```bash
uv sync
cd frontend
npm install
```

Backend setup (run once):

```bash
uv sync
```

This creates `.venv/` at the repo root with Python 3.13 and all backend deps from `pyproject.toml`.

Frontend setup (run once):

```bash
cd frontend
npm install
```

Local startup — frontend dev server:

```bash
cd frontend
npm run dev
```

In another terminal — backend:

```bash
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Then launch Electron:

```bash
cd frontend
npm run electron:dev
```

One-terminal dev runner:

```bash
./scripts/dev.sh run
```

## Packaging

Build and verify the Linux AppImage release:

```bash
./scripts/release-linux.sh
```

The release script prepares bundled resources, runs backend tests, builds the
AppImage, smoke-tests launch, and writes:

- `frontend/release/Praxis-{version}.AppImage`
- `frontend/release/Praxis-{version}.AppImage.sha256`

For a faster local packaging check:

```bash
SKIP_TESTS=1 SKIP_SMOKE=1 ./scripts/release-linux.sh
```

Install the built AppImage locally:

```bash
./scripts/install.sh
```

The installer makes the AppImage executable, copies it to
`~/.local/share/praxis`, creates `~/.local/bin/praxis`, writes a desktop entry,
and reports config, log, and Whisper cache paths. To inspect without installing:

```bash
./scripts/install.sh --check-only
```

### Sway keybind (optional)

Add to `~/.config/sway/config`:

```
bindsym $mod+Shift+p exec /path/to/Praxis-0.1.0.AppImage
```
