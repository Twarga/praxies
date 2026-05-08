# Praxis / Twarga Journal - Audited Task Backlog

Last audited: 2026-05-01

This file tracks the current project state against the original `Twarga Journal` backlog. The earlier implementation-plan document was removed during repo cleanup, but the original task IDs are preserved here.
The app has since been renamed in code/UI to `Praxis`, but the original task IDs are kept so progress stays traceable.

Legend:

- `[x]` Done in code and wired into the app.
- `[ ]` Not done, or not verified enough to call done.
- `PARTIAL` Some code exists, but it does not satisfy the original task/gate fully.
- `MANUAL QA` Requires real desktop/camera/API/manual verification, not just tests.

## Current Snapshot

- Backend: FastAPI app with config, sessions, recording chunk persistence, ffmpeg finalize/repair, Whisper pipeline, OpenRouter analysis, processing progress, waveform extraction, subtitle generation, subtitle translation, and burned-in MP4 export.
- Frontend: React/Vite/Electron shell with Today, Record, Gallery, Settings, Session Detail, transcript/analysis/raw tabs, processing UI, waveform UI, subtitle track display, and subtitle export controls.
- Tests: backend unit/integration coverage exists for OpenRouter helpers, Whisper service smoke path, session lifecycle, processing pipeline, and subtitle service.
- Verification run during audit: `uv run pytest` passed with `17 passed`; `npm run build` passed.
- Major remaining product areas: recurring-pattern persistence/merge, real digest endpoint, strict streak rules, Trends page, weekly rollups, SSE/live updates, retention compression, phone upload server, packaging/AppImage, and full manual release QA.

## Extra Work Added Outside Original Backlog

- [x] X001 Generate subtitle files from transcript segments as `SRT` and `WebVTT`.
- [x] X002 Persist subtitle segment JSON per language.
- [x] X003 Show subtitle tracks in the session video player.
- [x] X004 Translate subtitle segments per segment so timings remain aligned.
- [x] X005 Support subtitle export targets `en`, `fr`, `es`, and `ar`.
- [x] X006 Export burned-in subtitle MP4 with `ffmpeg`.
- [x] X007 Add backend endpoints for subtitle files and subtitled video exports.
- [x] X008 Add frontend subtitle language selector and export button.
- [x] X009 Fix Arabic export validation by normalizing `AR`/`ar` to lowercase.
- [x] X010 Add real waveform extraction from recorded audio and render it in Session Detail.
- [x] X011 Add processing terminal/progress lines for transcription and analysis.

## Immediate Start Queue

- [x] T001 Create the repo structure: `backend/`, `frontend/`, `assets/`, `scripts/`.
- [x] T002 Add root `README.md` with prerequisites, dev startup flow, and project layout.
- [x] T003 Scaffold FastAPI backend with a minimal `main.py` and health/config stub.
- [ ] T004 Add `backend/requirements.txt` with the initial backend dependencies. PARTIAL: replaced by `pyproject.toml`/`uv.lock`; `backend/requirements.txt` is deleted.
- [x] T005 Scaffold Vite + React frontend with Tailwind and `src/` structure from the spec.
- [x] T006 Add Electron `main.js`, `preload.js`, and `backend-launcher.js`.
- [x] T007 Wire Electron to wait for backend health before loading the frontend.
- [x] T008 Add a shared dev launch script or documented two-terminal dev workflow.
- [x] T009 Add global CSS tokens for fonts, colors, borders, spacing, and focus styles.
- [x] T010 Render the app shell with a left rail placeholder and an empty Today page.

## Phase 0 - Bootstrap

Goal: boot the repo in development with Electron, React, and FastAPI all connected.

- [x] T001-T003 repo/backend scaffold.
- [ ] T004 requirements file. PARTIAL: dependency management moved to `pyproject.toml`.
- [x] T005-T010 frontend, Electron, dev script, global CSS, shell.

Phase gate:

- [x] GATE-0 `uvicorn` starts locally. Verified indirectly through tests/imports; dev script is present.
- [ ] GATE-0 Electron opens a window and loads the React shell. MANUAL QA not run in this audit.
- [x] GATE-0 Backend health/config check is enforced before frontend load.

## Phase 1 - Config, Storage, And Index Foundation

Goal: create the filesystem model and configuration behavior that every later phase depends on.

- [x] T011 Settings/constants module for config, cache, journal, logs, legacy paths.
- [x] T012 Typed models for config, meta, index, recurring patterns, weekly rollups.
- [x] T013 First-launch config bootstrap.
- [x] T014 Default personal context is stored in generated config. Note: current default is generalized for Praxis, not the old personal Twarga text.
- [x] T015 Lazy journal folder creation.
- [x] T016 JSON helpers for safe read/write/overwrite.
- [x] T017 Session folder discovery.
- [x] T018 Session slug generation and collision handling.
- [x] T019 Session ID generation using `YYYY-MM-DD_<lang>_<slug>`.
- [x] T020 `_index.json` rebuild from `meta.json`.
- [x] T021 Corrupt index recovery by renaming to `_index.json.bak`.
- [x] T022 `GET /api/config` with masked OpenRouter API key.
- [x] T023 `PATCH /api/config` with schema validation.
- [x] T024 `GET /api/index`.
- [x] T025 `GET /api/sessions` backed by `_index.json`.
- [x] T026 `GET /api/sessions/{id}` returns meta, transcript, analysis, waveform, subtitles, exports.
- [x] T027 `DELETE /api/sessions/{id}`.
- [x] T028 Frontend config context.
- [x] T029 Frontend index context.
- [x] T030 Left rail shell with wordmark/nav/record/stats.
- [x] T031 Today first-launch empty state using exact spec copy. Implemented a first-launch Today variant for an empty journal.
- [x] T032 Settings shell with sections and rows.
- [x] T033 Settings rows for journal folder, retention, video quality, default language, OpenRouter model, directness, Whisper model, ready sound.
- [x] T034 Personal context textarea with 1-second autosave.
- [x] T035 Disabled Telegram section exactly as dimmed phase-2 placeholder.
- [x] T036 About section values for version, config path, and logs path.

Phase gate:

- [x] GATE-1 First launch creates a valid config.
- [ ] GATE-1 Today shows the correct first-day prose. MANUAL/spec copy mismatch.
- [x] GATE-1 Settings reads and writes real config data.
- [ ] GATE-1 Deleting `_index.json` causes rebuild on restart. Code path exists; needs explicit test/manual restart verification.

## Phase 2 - Recording Flow And Session Persistence

Goal: record, review, and save webcam sessions reliably before transcription exists.

- [x] T037 `POST /api/sessions`.
- [x] T038 Temp chunk storage endpoint.
- [x] T039 Chunk ordering/manifest metadata.
- [x] T040 `POST /api/sessions/{id}/finalize`.
- [x] T041 Assemble chunks into final `video.webm`.
- [x] T042 Validate assembled video with `ffprobe`.
- [x] T043 Compute file size and duration.
- [x] T044 Save-mode logic for `full`, `transcribe_only`, `video_only`.
- [x] T045 Browser camera/mic permission flow.
- [x] T046 Record idle state.
- [x] T047 `useRecorder` start/pause/resume/stop/timer/upload.
- [x] T048 Live webcam preview.
- [x] T049 Active recording state with timer overlay and controls.
- [x] T050 Review state with playback, title input, and actions.
- [x] T051 Inline discard confirmation with auto-revert after 5 seconds.
- [x] T052 Before-unload protection while recording is active.
- [x] T053 Keyboard shortcuts for `Escape`, `Space`, `S`, `Enter`, and `D`.
- [x] T054 Camera-denied inline messaging.
- [x] T055 `_index.json` update after saved session finalize.

Phase gate:

- [ ] GATE-2 A 2-minute recording saves successfully from the app. MANUAL QA needed.
- [ ] GATE-2 Resulting `video.webm` plays in review and detail. MANUAL QA needed.
- [ ] GATE-2 Pause/resume produces usable final recording. MANUAL QA needed.
- [ ] GATE-2 Review actions support `video only`, `transcribe only`, and `save & process`. Code exists; MANUAL QA needed.

## Phase 3 - Gallery And Video-Only Session Detail

Goal: saved recordings are browseable and watchable before AI pipeline work begins.

- [x] T056 `GET /api/sessions/{id}/video`.
- [x] T057 `GET /api/sessions/{id}/thumbnail`; returns 204 when absent.
- [x] T058 `POST /api/sessions/{id}/mark-read`.
- [x] T059 Route state for `gallery`, `session/<id>`, `today`, `settings`, `trends`, `record`.
- [x] T060 Gallery top bar with language filter.
- [x] T061 Group sessions by month and render section headers.
- [x] T062 Session cards with thumbnail, duration pill, title, status footer.
- [x] T063 Empty states for no sessions/filter misses.
- [x] T064 Session Detail top section.
- [x] T065 Session Detail responsive two-column layout.
- [x] T066 Video playback with current timestamp/waveform display.
- [x] T067 Tabs for transcript, analysis, and raw.
- [x] T068 Mark sessions as read when analysis is viewed.
- [x] T069 Preserve scroll position per page route.

Phase gate:

- [ ] GATE-3 Gallery renders saved sessions correctly. MANUAL QA needed.
- [ ] GATE-3 Session Detail streams saved video correctly. MANUAL QA needed.
- [ ] GATE-3 Language filtering works in Gallery. Code exists; MANUAL QA needed.

## Phase 4 - Whisper Transcription Pipeline

Goal: convert saved recordings into transcript text and timestamped segments.

- [x] T070 Single-session async processing queue.
- [x] T071 Status transitions `saved` -> `queued` -> `transcribing` -> `ready` or errors.
- [x] T072 ffmpeg audio extraction to 16kHz mono WAV.
- [x] T073 Thumbnail extraction at 50% duration.
- [x] T074 `faster-whisper` service with CPU/int8 default.
- [x] T075 Whisper model config/dropdown values.
- [x] T076 Fixed session language passed into Whisper.
- [x] T077 Persist `transcript.txt`.
- [x] T078 Persist `transcript.json` timestamped segments.
- [x] T079 Skip pipeline for `video_only`.
- [x] T080 Retry endpoint.
- [x] T081 Session detail includes transcript payload.
- [x] T082 Transcript tab with timestamp click-to-seek.
- [x] T083 Highlight currently playing transcript segment.
- [x] T084 Rail/processing badge states. Current implementation uses polling, not SSE.

Phase gate:

- [ ] GATE-4 English sessions transcribe into readable English. Needs real Whisper/manual sample verification.
- [ ] GATE-4 French sessions transcribe into readable French. Needs real Whisper/manual sample verification.
- [ ] GATE-4 Thumbnails appear for processed sessions. Code exists; MANUAL QA needed.

## Phase 5 - LLM Analysis And External Fallback

Goal: generate valid analysis output, and give the user a recovery path when the API fails.

- [x] T085 `analysis.json` schema model and validator.
- [x] T086 Recurring-pattern prompt block generator.
- [x] T087 Full analysis system prompt.
- [x] T088 Transcript user message with timestamps.
- [x] T089 LiteLLM/OpenRouter client using JSON response format.
- [x] T090 Analysis retries for timeout/rate-limit/server/malformed/network failure.
- [x] T091 OpenRouter 401/402 mapped to attention-style errors.
- [x] T092 Save successful `analysis.json`.
- [x] T093 Save unusable model output to `analysis_raw.txt`.
- [x] T094 Worker runs `transcribing` -> `analyzing` -> `ready`.
- [x] T095 `GET /api/sessions/{id}/export-prompt`.
- [x] T096 `GET /api/sessions/{id}/export-transcript`.
- [x] T097 `POST /api/sessions/{id}/import-analysis`.
- [x] T098 `POST /api/config/test-openrouter`. Current implementation checks key status instead of a model ping.
- [x] T099 Analysis tab prose verdict and structured blocks.
- [x] T100 Raw tab pretty-printed analysis view.
- [x] T101 External LLM export UI.
- [x] T102 Inline import-analysis UI for needs-attention sessions.
- [x] T103 Today banner for skipped analysis, invalid API key, exhausted credits, or malformed response fallback.

Phase gate:

- [ ] GATE-5 Ready sessions produce valid `analysis.json`. Covered by fake-client test; needs real OpenRouter/manual verification.
- [ ] GATE-5 French analysis prose is in French. Needs real OpenRouter/manual verification.
- [ ] GATE-5 Bad OpenRouter credentials land in `needs_attention`. Code path exists; MANUAL QA/test needed.
- [ ] GATE-5 Importing valid external JSON completes the session. Code exists; MANUAL QA/test needed.

## Phase 6 - Recurring Patterns, Digest, And Streaks

Goal: turn isolated sessions into cumulative feedback over time.

- [x] T104 Recurring pattern file load/save per language.
- [x] T105 Merge `recurring_patterns_hit` into tracked patterns.
- [x] T106 Update counts, `last_seen`, `recent_sessions`.
- [x] T107 Every-10-analyses cleanup/decay pass without age-based deletion.
- [x] T108 Cap recurring patterns to 15 per language.
- [x] T109 Inject recurring patterns into analysis prompt at runtime.
- [x] T110 Streak calculation with strict 2-minute minimum.
- [x] T111 `video_only` sessions count toward streak only when duration qualifies.
- [x] T112 `_index.json` totals, total seconds, and counts by language.
- [x] T113 Today digest selection logic.
- [x] T114 `GET /api/patterns/{lang}`.
- [x] T115 `GET /api/digest/today`.
- [x] T116 Digest card UI with yesterday metadata/verdict/actions.
- [x] T117 StreakGrid component with exact five-intensity palette.
- [x] T118 StreakGrid hover summary.
- [x] T119 Replace left-rail stats placeholders with real streak and total counts.
- [x] T120 Show `patterns hit today` in analysis detail page.

Phase gate:

- [x] GATE-6 Sessions under 2 minutes do not increment streak.
- [x] GATE-6 Digest selection picks the correct session for Today.
- [x] GATE-6 Pattern hits show up in detail and persist across analyses.

## Phase 7 - Trends And Weekly Rollups

Goal: expose progress over time with real metrics and summaries.

- [x] T121 `GET /api/trends?range=`.
- [x] T122 Aggregate fluency scores by language over time.
- [x] T123 Aggregate recurring pattern hit counts.
- [x] T124 Pattern trend labels.
- [x] T125 Aggregate filler words.
- [x] T126 Session volume summary calculation.
- [x] T127 Weekly rollup due-check logic.
- [x] T128 Weekly rollup prompt and `_weekly/<year>-W<week>.json`.
- [x] T129 `GET /api/weekly/{week}`.
- [x] T130 Trends page shell and range toggle.
- [x] T131 Fluency line chart.
- [x] T132 Recurring patterns list with bars/counts/trends.
- [x] T133 Filler words sections by language.
- [x] T134 Session volume summary line in Trends.

Phase gate:

- [x] GATE-7 Trends render for `7d`, `30d`, `90d`, and `all`.
- [ ] GATE-7 Filler words and patterns degrade cleanly with sparse data.
- [ ] GATE-7 Weekly rollups generate when due.

## Phase 8 - SSE, Recovery, Retention, And Phone Upload

Goal: complete live-update and operational behavior for daily use.

- [x] T135 SSE broadcaster service.
- [x] T136 `GET /api/events`.
- [x] T137 Emit `session.status`, `session.ready`, `config.changed`, `index.changed`.
- [x] T138 Frontend EventSource reconnect management.
- [x] T139 Config/index contexts update from SSE.
- [x] T140 Ready sound on `session.ready`.
- [x] T141 Rail processing badge live from SSE and ready-session click.
- [x] T142 Scan for stuck `recording` sessions on backend startup.
- [x] T143 Recover playable unfinished sessions and mark for review.
- [x] T144 Mark corrupt unfinished sessions as failed and log reason.
- [x] T145 One-time Today recovery banner and deep link.
- [x] T146 Daily retention task.
- [x] T147 Compress expired sessions to audio-only and update retention fields.
- [x] T148 Keep transcript, analysis, thumbnail, and meta after retention compression.
- [x] T149 Phone upload enable/disable config behavior.
- [x] T150 Detect LAN IP for upload URL caption.
- [x] T151 `GET /upload` minimal HTML form.
- [x] T152 `POST /upload` creates upload sessions and queues them.
- [x] T153 Render QR code in Settings.
- [x] T154 Show real upload URL under QR code.

Phase gate:

- [ ] GATE-8 Live session status updates work without refresh. Polling exists, but no SSE.
- [ ] GATE-8 Mid-record crash/quit recoverable on relaunch.
- [ ] GATE-8 Retention converts old sessions to audio-only without losing transcript/analysis.
- [ ] GATE-8 Phone upload works from a real device on LAN.

## Phase 9 - Packaging, Release Prep, And Hardening

Goal: ship a usable Arch Linux desktop build and verify the v1 acceptance list.

- [x] T155 `scripts/install.sh`.
- [x] T156 Electron production build flow.
- [x] T157 `electron-builder` AppImage config.
- [x] T158 Bundle frontend build artifacts for production.
- [x] T159 Bundle backend source/runtime paths for production launch.
- [x] T160 Bundle Python runtime for AppImage. Verified unpacked production build and AppImage boot with bundled Python backend.
- [x] T161 Bundle static ffmpeg for AppImage. Verified bundled `ffmpeg` and `ffprobe` binaries in production output.
- [x] T162 Bundle/pre-seed Whisper model cache behavior. Release builds now support `PRESEED_WHISPER=1` or `PRESEED_WHISPER_FROM=/path` and bundle the seeded cache into `electron/resources/whisper`.
- [x] T163 Desktop entry and launcher behavior.
- [x] T164 README install/launch/Sway keybind docs.
- [ ] T165 Full acceptance checklist on real files.
- [ ] T166 Fix acceptance failures and rerun checklist.
- [ ] T167 Verify logs/recovery/failure states in production-like build. PARTIAL: production Electron log added and AppImage startup logging verified; recovery/failure-state QA still needs manual scenarios.
- [x] T168 Produce first v1 release artifacts. Generated `frontend/release/Praxis-0.1.0.AppImage`.

Phase gate:

- [ ] GATE-9 Dev install works on clean Arch with prerequisites.
- [ ] GATE-9 AppImage launches and boots backend.
- [ ] GATE-9 Full acceptance checklist passes.

## Phase 10 - Coaching Analytics And Report Redesign

Goal: make each analyzed journal session teach the user something specific about reflection, speaking, and language instead of producing a compact generic summary.

- [x] T169 Define v2 analysis schema for coach-style reports.
- [x] T170 Add a session scorecard for clarity, structure, reflection depth, emotional awareness, specificity, actionability, and language fluency.
- [x] T171 Add top-three lesson objects with what happened, why it matters, and next move.
- [x] T172 Add timestamped moment feedback with quote, coaching note, and click-to-seek support in the UI.
- [x] T173 Add behavioral pattern observations beyond simple filler-word tracking.
- [x] T174 Add a practice assignment with reflection question, speaking drill, behavioral action, and next-session goal.
- [x] T175 Add a language-coach block with strongest sentence, main language gap, and rewrite drills.
- [x] T176 Rewrite the analysis system prompt so it behaves like a readable teaching coach, not a summarizer.
- [x] T177 Render the new report first in Session Detail while keeping legacy analysis fields readable.
- [x] T178 Update Today digest to prefer the practice loop from the coaching report.
- [ ] T179 Calibrate the prompt on at least 10 real recordings across English, French, and Spanish. PARTIAL: English-only copied sessions audited in `docs/T179_PARTIAL_CALIBRATION.md`; prompt tightened for short/test recordings; re-analysis workflow added for existing transcripts. Needs fresh v2 analyses plus French and Spanish samples.
- [x] T179B Make analysis coach-first and easier to read: one main lesson, one practice loop, shorter prompt constraints, and Analysis-page provider/model override.
- [x] T180 Add regression fixtures for a strong report, weak report, malformed report, and multilingual report.

Phase gate:

- [ ] GATE-10 A fresh English analysis produces a readable coaching report with three useful lessons and timestamped moments.
- [ ] GATE-10 A fresh French analysis keeps prose in French while preserving useful language rewrites.
- [ ] GATE-10 A fresh Spanish analysis keeps prose in Spanish while preserving useful language rewrites.
- [ ] GATE-10 The report gives a concrete next practice assignment, not only a summary.

## Phase 11 - Improvement Trends And Learning Loop

Goal: make Trends show whether the user is improving, not just whether they recorded more sessions.

- [x] T181 Aggregate scorecard dimensions by language and over the selected trend range.
- [x] T182 Add an Improvement Dimensions panel to Trends.
- [x] T183 Include coach-report lessons, scorecard values, and next-session goals in weekly rollup inputs.
- [x] T184 Track completion of practice assignments from one session to the next.
- [x] T185 Compare the previous next-session goal against the next recording and mark followed, partially followed, or missed.
- [x] T186 Add trend copy such as "specificity is improving" or "actionability is still weak" based on scorecard movement.
- [x] T187 Add a calibration view for recurring behavior patterns: confirm, rename, merge, or dismiss.
- [x] T188 Add tests for scorecard aggregation, trend labels, and sparse-data behavior.

Phase gate:

- [ ] GATE-11 Trends make the user's weakest improvement dimension obvious within 10 seconds.
- [ ] GATE-11 Weekly rollups identify one repeated blocker and one next-week practice focus.
- [ ] GATE-11 Sparse data degrades gracefully without pretending there is a trend.

## Phase 12 - First-Run Onboarding And Production Polish

Goal: make a fresh install feel like a finished product instead of a developer-configured tool.

- [x] T189 First-run onboarding flow for journal folder, practice goal, language, AI provider, and transcription setup.
- [x] T190 Onboarding AI setup screen with provider/model choice, key save, and connection test.
- [x] T191 Onboarding local transcription setup with Whisper model choice, cache status, and setup guidance.
- [x] T192 Journal folder setup like an Obsidian vault: create/open folder, validate storage path, and rebuild existing journal index.
- [x] T193 First-run goal personalization that writes useful personal context for future analysis prompts.
- [x] T194 Production repo cleanup: ignore generated artifacts, remove stale files, verify no secrets, and add release notes.
- [x] T195 Professional install script for AppImage permissions, cache/config checks, and clear dependency messaging.
- [x] T196 Release build script that prepares resources, builds AppImage, verifies launch, and emits checksum.
- [x] T197 Landing page with screenshots, download call-to-action, privacy/local-first copy, and workflow explanation.
- [x] T198 Visual polish pass for transitions, loading states, empty states, processing UI, and report readability.
- [x] T199 First production icon and branding pass for AppImage, sidebar, and release assets.
- [ ] T200 Manual release QA on a fresh machine with onboarding, recording, transcription, analysis, restart, and failure states.

Phase gate:

- [ ] GATE-12 A fresh install opens onboarding before the normal app.
- [ ] GATE-12 A non-technical user can finish setup without editing files or reading terminal output.
- [ ] GATE-12 Release artifacts can be produced with one documented command.

## Cross-Cutting Testing And Quality

- [x] Q001 Backend unit tests for config/meta/index/recurring/weekly schemas.
- [x] Q002 File-service tests for safe reads/writes/rebuild/corrupt-index recovery.
- [x] Q003 Backend integration tests for session create/chunk/finalize/delete/retry. PARTIAL note: retry is covered via API code path less directly than lifecycle.
- [x] Q004 Prompt-builder tests for personal context, recurring block, schema, language instructions.
- [x] Q005 Streak calculation tests for short sessions/normal/multi-session/video-only.
- [x] Q006 Recurring-pattern merge and decay tests.
- [x] Q007 Weekly rollup due-check tests.
- [x] Q008 Frontend component tests for StreakGrid/DigestCard/SessionCard/language filters.
- [ ] Q009 Manual QA checklist for camera permissions, crash recovery, OpenRouter failure, phone upload, retention.

Additional current tests:

- [x] OpenRouter catalog/status helper tests.
- [x] Whisper service smoke-path test with fake model.
- [x] Processing pipeline test with fake Whisper/LLM.
- [x] Subtitle service tests.
- [x] Burned subtitle export lifecycle test with ffmpeg.

## Release Checklist

- [ ] R001 Record a 2-minute English session and verify video, transcript, analysis, digest visibility, and streak increment.
- [ ] R002 Record a 30-second session and verify it does not count toward streak.
- [ ] R003 Record a French session and verify feedback language is French.
- [ ] R004 Record a video-only session and verify it skips the pipeline but still counts for streak when duration qualifies.
- [ ] R005 Pause/resume during recording and verify final video is usable.
- [ ] R006 Cancel a recording with `Escape` and verify inline confirm flow.
- [ ] R007 Force OpenRouter failure and verify `needs_attention`, Today banner, export prompt, and import-analysis recovery.
- [ ] R008 Quit mid-recording and verify relaunch recovery.
- [ ] R009 Change journal folder and verify UI explains it applies only to future sessions.
- [ ] R010 Verify full-year streak grid renders with real data.
- [ ] R011 Verify keyboard shortcuts work on all specified routes.

## Highest Priority Next Work

1. Fix the remaining packaging blockers:
   bundled Python launch in both ESM/CJS Electron paths, bundled FFmpeg, Whisper model cache/download behavior, and a real AppImage boot test.
2. Calibrate Phase 10 on real recordings:
   run at least 10 English/French/Spanish sessions and adjust the prompt until reports are readable, specific, and useful.
3. Add learning-loop memory:
   carry the previous practice assignment into the next analysis and score whether the user followed it.
4. Add missing tests:
   scorecard aggregation, coaching-report schema fixtures, sparse trends behavior, import-analysis success/failure, and OpenRouter credential failure.
5. Keep the report product principle:
   Praxis should behave like a personal video coach, not a generic analytics dashboard.

## Verification Log

- 2026-05-01: `uv run pytest` -> `17 passed`.
- 2026-05-01: `npm run build` -> passed.
- 2026-05-01: Implemented `T034` personal context autosave.
- 2026-05-01: Implemented `T051` inline discard confirmation.
- 2026-05-01: Implemented `T053` complete Record keyboard shortcuts.
- 2026-05-01: Implemented `T061` Gallery month grouping.
- 2026-05-01: Implemented `T069` route scroll restore.
- 2026-05-01: Implemented `T103` Today fallback banner.
- 2026-05-01: Implemented `T104` recurring pattern load/save.
- 2026-05-01: Implemented `T105`/`T106` recurring pattern hit merge.
- 2026-05-01: Implemented `T107`/`T108` recurring pattern cleanup and cap; adjusted cleanup to avoid age-based deletion.
- 2026-05-01: Implemented `T109` recurring pattern injection into AI analysis and exported prompt generation.
- 2026-05-01: Implemented `T110`/`T111` strict 2-minute streak rule, including qualifying `video_only` sessions.
- 2026-05-01: Implemented `T113` Today digest selection logic with yesterday-first fallback rules.
- 2026-05-01: Implemented `T114` recurring patterns API endpoint.
- 2026-05-01: Implemented `T115` Today digest API endpoint.
- 2026-05-01: Implemented `T116` Today digest card UI backed by the digest API.
- 2026-05-01: Implemented `T117` StreakGrid component with five activity intensities.
- 2026-05-01: Implemented `T118` StreakGrid hover and keyboard-focus summary.
- 2026-05-01: Implemented `T119` real left-rail streak and total session stats.
- 2026-05-01: Implemented `T120` Patterns Hit Today section in Session Detail analysis.
- 2026-05-01: Implemented `T121` Trends API range endpoint.
- 2026-05-01: Implemented `T122` Trends fluency series grouped by language.
- 2026-05-01: Implemented `T123` Trends recurring pattern hit counts by language.
- 2026-05-01: Implemented `T124` recurring pattern trend labels.
- 2026-05-01: Implemented `T125` Trends filler-word aggregation by language.
- 2026-05-01: Implemented `T126` Trends session volume summary.
- 2026-05-01: Implemented `T127` weekly rollup due-check logic and tests.
- 2026-05-01: Implemented `T128` weekly rollup prompt generation and `_weekly/<year>-W<week>.json` persistence.
- 2026-05-01: Implemented `T129` weekly rollup API endpoint.
- 2026-05-02: Implemented `T130` Trends page shell, route, sidebar item, and range toggle.
- 2026-05-02: Implemented `T131` Trends fluency SVG line chart.
- 2026-05-02: Implemented `T132` Trends recurring patterns list with bars, counts, and trend labels.
- 2026-05-02: Implemented `T133` Trends filler-word sections by language.
- 2026-05-02: Implemented `T134` Trends session volume summary line.
- 2026-05-02: Implemented `T135` backend SSE broadcaster service.
- 2026-05-02: Implemented `T136` SSE `/api/events` endpoint.
- 2026-05-02: Implemented `T137` backend SSE event emissions for session, config, and index changes.
- 2026-05-02: Implemented `T138` frontend EventSource provider with reconnect backoff.
- 2026-05-02: Implemented `T139` config and index context refreshes from SSE events.
- 2026-05-02: Implemented `T140` ready sound playback from SSE `session.ready` events.
- 2026-05-02: Implemented `T141` live rail processing badge with ready-session click-through.
- 2026-05-02: Implemented `T142` startup scan for stuck recording sessions with failed recovery state.
- 2026-05-02: Implemented `T143` startup recovery of playable unfinished recordings as reviewable video-only sessions.
- 2026-05-02: Implemented `T144` corrupt unfinished recording failure state with logged recovery reason.
- 2026-05-02: Implemented `T145` one-time Today recovery banner with session deep link.
- 2026-05-02: Implemented `T146` daily retention scan task scaffold.
- 2026-05-02: Implemented `T147` retention compression from expired video to audio-only archive with metadata updates.
- 2026-05-02: Implemented `T148` retention artifact preservation coverage for transcript, analysis, thumbnail, and meta.
- 2026-05-02: Implemented `T150` LAN IP detection and upload URL exposure in config API.
- 2026-05-02: Implemented `T151` minimal phone upload HTML form gated by phone-upload settings.
- 2026-05-03: Implemented `T152` `POST /upload` endpoint with ffmpeg remux, thumbnail extraction, and processing queue.
- 2026-05-03: Implemented `T153` QR code rendered in Settings using `qrcode.react`.
- 2026-05-03: Implemented `T154` real upload URL displayed under QR code in Settings.
- 2026-05-03: Implemented `T155` `scripts/install.sh` for dev environment setup.
- 2026-05-03: Implemented `T156` Electron production build flow via `npm run electron:build`.
- 2026-05-03: Implemented `T157` `electron-builder` AppImage configuration in `frontend/electron-builder.yml`.
- 2026-05-03: Implemented `T158` frontend build artifacts bundled for production via Vite.
- 2026-05-03: Implemented `T159` backend source bundled as `extraResource` for production launch.
- 2026-05-03: Implemented `T163` desktop entry generated by electron-builder with AppImage target.
- 2026-05-03: Implemented `T164` README updated with install, build, and Sway keybind docs.
