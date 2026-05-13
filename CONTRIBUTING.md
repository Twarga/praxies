# Contributing to Praxis

Thanks for your interest in improving Praxis. This document covers the basics
so you can get a working setup and open a useful pull request.

Praxis is an AI-assisted video journaling desktop app built with Electron,
React, Vite, Tailwind, FastAPI, Python, faster-whisper, and LiteLLM. It is
local-first by design, and that constraint shapes most of the decisions in the
codebase.

## Ways to contribute

- Report a reproducible bug via an [issue](https://github.com/Twarga/praxies/issues/new/choose).
- Propose a feature via an [issue](https://github.com/Twarga/praxies/issues/new/choose)
  before opening a large PR, so the direction can be agreed first.
- Improve documentation in `README.md`, `SCOPE.md`, `docs/`, or the landing
  page in `landing/`.
- Add tests to `backend/tests/` or `frontend/src/test/`.
- Polish the UI or the landing page, keeping the design language defined in
  `docs/UI_REDESIGN_SPEC.md` and `docs/DESIGN.md`.

## Project layout

```text
backend/         FastAPI app, Whisper + LiteLLM integrations, tests
frontend/        Electron shell, React UI, Vite config, packaging
landing/         Static GitHub Pages site (hand-rolled HTML/CSS/JS)
docs/            Product, design, and release notes
scripts/         Dev and release scripts (dev.sh, release-linux.sh, install.sh)
SCOPE.md         Current product direction and non-goals
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) for Python and backend deps
- Node.js 20+
- npm
- FFmpeg (bundled for packaged builds via `ffmpeg-static`, still useful locally)

## Local setup

```bash
# Backend deps (creates .venv/ at repo root)
uv sync

# Frontend deps
cd frontend
npm install
```

## Running locally

One-terminal dev runner:

```bash
./scripts/dev.sh run
```

Or, in separate terminals:

```bash
# Backend
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Vite dev server
cd frontend
npm run dev

# Electron shell
cd frontend
npm run electron:dev
```

## Tests

Backend:

```bash
uv run pytest
```

Frontend:

```bash
cd frontend
npm run test
```

Please add tests for new backend behavior and for non-trivial frontend logic.
UI polish does not usually need tests, but state and data-handling changes do.

## Branches and commits

- Work on a feature branch, not `main`.
- Keep commits small and focused; a PR can contain several logical commits.
- Use imperative, descriptive commit messages (for example, `Add crash-recovery
  compression for retention sweeps`).
- Reference issues in the commit body or PR description when applicable.

## Pull requests

Before opening a PR:

- Run the relevant tests locally.
- Make sure the app still starts (`./scripts/dev.sh run`) for anything touching
  the runtime pipeline.
- Update `CHANGELOG.md` under the `## [Unreleased]` heading for user-facing
  changes.
- Update docs if your change affects setup, packaging, scope, or design.

In the PR description, include:

- What the change does and why.
- Any UX or data model impact.
- Notes about what you tested and what you did not.

A maintainer will review, request changes if needed, and merge when ready.

## Design, privacy, and scope

Praxis is deliberately narrow. Before proposing large changes, please skim:

- `SCOPE.md` — current direction, roadmap, non-goals.
- `docs/UI_REDESIGN_SPEC.md` — app UI direction.
- `docs/DESIGN.md` — landing-page direction.

Some guardrails the project cares about:

- **Local-first.** Videos, transcripts, analyses, and patterns live in the
  user's journal folder. Do not introduce features that silently upload data.
- **Configurable AI.** Users should be able to choose their LLM provider and
  run without any single vendor lock-in.
- **Desktop-shaped.** Praxis is not becoming a SaaS product. Avoid adding
  browser-only or cloud-only workflows.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating you agree to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
