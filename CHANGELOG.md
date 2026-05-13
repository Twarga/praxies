# Changelog

All notable changes to Praxis are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT license, contributing guide, security policy, and code of conduct.
- GitHub issue forms (bug, feature) and pull request template.
- `.gitattributes` for consistent line endings and language stats.
- Landing page: tech-stack strip, FAQ section, Open Graph image, and
  JSON-LD `SoftwareApplication` structured data.

### Changed

- Landing page copy: clarified supported LLM providers (OpenRouter, LiteLLM
  proxy, OpenAI-compatible endpoints) and tightened wording.
- `README.md`: added accurate badges, screenshot, installation vs development
  sections, license and contributing links.

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

[Unreleased]: https://github.com/Twarga/praxies/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Twarga/praxies/releases/tag/v0.1.0
