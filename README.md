<p align="center">
  <img src="assets/github/praxis-loop.png" width="116" alt="Praxis mark: a continuous coaching loop" />
</p>

<h1 align="center">Praxis</h1>

<p align="center">
  <strong>A private, local-first desktop coach for video journaling, deliberate speaking practice, and useful reflection.</strong>
</p>

<p align="center">
  <a href="https://github.com/Twarga/praxies/blob/main/LICENSE">License</a> ·
  <a href="https://github.com/Twarga/praxies/issues">Issues</a> ·
  <a href="docs/REMAKE_PLAN.md">Product plan</a>
</p>

---

Praxis turns a recording into a coaching loop: record, transcribe locally, review clear evidence-backed feedback, choose the next thing to practise, and come back stronger. Your recordings, transcripts, reports, goals, and progress remain in a journal folder you control.

Only the text needed for analysis is sent to the AI provider you choose. Media is never uploaded by Praxis for analysis.

## What you can do

- Record with a camera and microphone preview, device selection, and advanced capture controls.
- Transcribe locally with Faster-Whisper and verify the installed transcription runtime.
- Connect your own AI provider and model for analysis; credentials live in your system keyring.
- Work across more than one coaching goal at once: journaling, language practice, communication, interview practice, presentation skills, and more.
- Read reports built for action: the main lesson, evidence from the session, and the next practice step—not a wall of metrics.
- Request a fresh analysis from a session whenever your goal or context changes.
- Create single-language or bilingual subtitle tracks, translate them with your chosen model, burn them into an MP4, or export subtitle files separately.
- Keep a local practice history and compare each session against your own baseline.

## Run it locally

Praxis is a Linux-first Electron desktop app with a FastAPI backend.

```bash
git clone https://github.com/Twarga/praxies.git
cd praxies
uv sync --extra dev
cd frontend && npm install && cd ..
./scripts/dev.sh
```

The launcher starts the backend, Vite frontend, and Electron desktop window. Use `./scripts/dev.sh --web` when you only need the browser surface.

Requirements: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js/npm, and the normal desktop dependencies needed by Electron.

### Install the released desktop app

```bash
curl -fsSL https://raw.githubusercontent.com/Twarga/praxies/main/scripts/install.sh | bash
```

The installer downloads the latest Linux AppImage, verifies its SHA-256 checksum,
adds a `praxis` launcher and desktop entry, then starts onboarding. Use
`praxis --check` to verify an existing installation or `scripts/install.sh --uninstall`
to remove only application files.

## How your data is handled

| Data | Where it lives |
| --- | --- |
| Video, audio, transcripts, reports, goals, and exports | A journal directory you choose |
| Provider credentials | Your unlocked desktop keyring |
| Text sent for analysis | Only to the provider and model you explicitly activate |
| Recordings | Never uploaded by Praxis for AI analysis |

## Project map

| Path | Purpose |
| --- | --- |
| [`frontend/`](frontend) | React, Vite, and Electron desktop interface |
| [`backend/`](backend) | FastAPI app, local transcription, analysis, and export services |
| [`docs/`](docs) | Product plans, architecture notes, and design decisions |
| [`scripts/`](scripts) | Installation, development, build, and verification helpers |

## Development and checks

```bash
# Backend tests
.venv/bin/python -m pytest -q

# Frontend tests
cd frontend && npm test

# Production frontend build
cd frontend && npm run build
```

## Roadmap

The active remake plan is tracked in [`docs/REMAKE_PLAN.md`](docs/REMAKE_PLAN.md). The current direction is a calmer desktop workspace, stronger recording controls, multi-goal coaching, readable reports, bilingual subtitle exports, and reliable local-first operation.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a contribution. Please report security issues through the process in [SECURITY.md](SECURITY.md), not through public issue comments.

Praxis is released under the [MIT License](LICENSE).
