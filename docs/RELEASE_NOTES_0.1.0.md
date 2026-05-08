# Praxis 0.1.0 Release Notes

Date: 2026-05-07

## Highlights

- First-run onboarding for journal folder, goal, language, AI provider, and Whisper setup.
- Multi-provider LLM configuration with OpenRouter, OpenCode Go, OpenAI-compatible APIs, and LiteLLM proxy support.
- Coach-first analysis reports with scorecards, timestamped moments, lessons, practice assignments, and language rewrite drills.
- Session Detail provider/model override for re-analysis without opening Settings.
- Stats copy for improvement dimensions such as specificity, actionability, clarity, and language fluency.
- Practice tracking for assignment completion and previous-goal follow-up.
- Linux AppImage packaging with bundled Python runtime and static FFmpeg/FFprobe resources.
- Production release script with tests, AppImage build, smoke launch, and SHA-256 checksum.
- AppImage installer that creates a local launcher and desktop entry.
- Optional Whisper cache pre-seeding during AppImage builds via `PRESEED_WHISPER=1` or `PRESEED_WHISPER_FROM=/path`.

## Artifacts

- `frontend/release/Praxis-0.1.0.AppImage`
- `frontend/release/Praxis-0.1.0.AppImage.sha256`

Build with:

```bash
./scripts/release-linux.sh
```

Install locally with:

```bash
./scripts/install.sh
```

## Known Gaps

- Whisper model files are not pre-seeded inside the AppImage by default, but release builds can bundle them explicitly.
- Prompt calibration still needs 10 real English/French/Spanish recordings.
- Recurring behavior pattern calibration UI is not implemented yet.
- Full manual fresh-machine release QA is still pending.
