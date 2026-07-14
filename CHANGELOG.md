# Changelog

All notable changes to Praxis are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-14

### Added

- A complete desktop workspace remake with six selectable visual themes.
- A redesigned first-run flow that lets people activate multiple coaching tracks
  together, including journaling, language practice, interviews, and presentations.
- Camera and microphone preview before recording, advanced device controls, and
  clearer exit and navigation behavior.
- Local Faster-Whisper runtime verification and a repaired transcription speed
  benchmark path.
- A direct "Run fresh analysis" action from every completed session.
- Single-language and bilingual subtitle export, translation with the selected
  AI provider, and burned-in MP4 output.
- Provider activation and diagnostics surfaces that use explicit connections
  rather than legacy connection reuse.
- A new professional repository identity: a continuous-loop logo, release
  banner, refreshed README, product metadata, and GitHub Pages landing site.
- Reproducible Linux AppImage packaging scripts, release metadata, and a
  one-command installer that downloads and verifies the latest release.

### Changed

- Reports now lead with one main lesson, evidence, and the next drill instead
  of dense scorecards and divider-heavy layouts.
- Coaching prompts use the selected tracks and actual recording context, so a
  product-testing session is not incorrectly treated as a generic personal
  journal entry.
- Recording, practice, progress, settings, and onboarding surfaces are calmer,
  more readable, and use top-centre desktop notifications.
- The landing site is rebuilt around the record → understand → practise loop.

### Fixed

- Provider configuration no longer depends on stale inherited connections.
- The local Whisper benchmark uses the correct operating-system import.

## [0.1.0] - 2026-05-07

### Added

- First-run onboarding for journal folder, goal, language, AI provider, and
  Whisper setup.
- Multi-provider LLM configuration with OpenRouter, OpenAI-compatible APIs,
  and LiteLLM proxy support.
- Coach-first analysis reports with scorecards, timestamped moments, lessons,
  practice assignments, and language rewrite drills.
- Session Detail provider/model override for re-analysis without opening
  Settings.
- Stats page with improvement dimensions: specificity, actionability, clarity,
  and language fluency.
- Practice tracking for assignment completion and previous-goal follow-up.
- Session gallery with month grouping, language filter, and thumbnails.
- LAN phone upload with QR code.
- Weekly rollups, streaks, and recurring pattern tracking.
- Subtitle generation, translation, and burned-in MP4 export.
- Real-time processing status via SSE.
- Crash recovery and retention compression.
- Linux AppImage packaging with bundled Python runtime and static
  FFmpeg/FFprobe resources.
- Production release script with tests, AppImage build, smoke launch, and
  SHA-256 checksum.
- AppImage installer (`scripts/install.sh`) that creates a local launcher and
  desktop entry.
- Optional Whisper cache pre-seeding during AppImage builds via
  `PRESEED_WHISPER=1` or `PRESEED_WHISPER_FROM=/path`.

### Known gaps

- Whisper model files are not pre-seeded inside the AppImage by default, but
  release builds can bundle them explicitly.
- Prompt calibration still needs 10 real English/French/Spanish recordings.
- Recurring behavior pattern calibration UI is not implemented yet.
- Full manual fresh-machine release QA is still pending.

[Unreleased]: https://github.com/Twarga/praxies/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Twarga/praxies/releases/tag/v0.2.0
[0.1.0]: https://github.com/Twarga/praxies/releases/tag/v0.1.0
