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

## Coming soon

- Session gallery with searchable history
- Trends and recurring pattern tracking
- External LLM fallback workflow
- LAN phone upload
- Weekly rollups
- AppImage distribution for Linux

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

Early development. Planning is in place and implementation is starting from the core recording and storage pipeline outward.

## Development

Prerequisites:

- [uv](https://docs.astral.sh/uv/) (manages Python and backend deps)
- Node.js 20+
- npm
- FFmpeg

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
