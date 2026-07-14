# Praxis Daily: Implementation Task Tracker

Source specification: [`PRAXIS_30_DAY_PLAN.md`](PRAXIS_30_DAY_PLAN.md)
Target: Linux x86_64
Current milestone: M7-M9 verification and dogfood
Overall status: in progress

## How to use this tracker

Statuses:

- `[ ]` not started
- `[~]` in progress (code exists, not verified or incomplete)
- `[x]` complete and verified
- `[!]` blocked
- `[-]` removed from scope

## Progress dashboard

| Milestone | Scope | Done | Total | Status |
|---|---|---:|---:|---|
| M0 | Contracts and migration safety | 9 | 9 | Verified by backend suite |
| M1 | Reliability and diagnostics | 11 | 11 | Backend and System Health UI verified |
| M2 | Provider foundation | 17 | 17 | Provider connection, live catalog, and test UI verified |
| M3 | External credential reuse | 0 | 0 | Removed from product scope; providers are configured directly in Praxis |
| M4 | Transcription manager | 16 | 16 | Full lifecycle, licensed benchmark, accuracy/speed results, and journal comparison verified |
| M5 | Onboarding | 11 | 11 | Resumable eight-step baseline flow with media check and failed-check repair links verified |
| M6 | Coaching report and Practice | 15 | 15 | Report v3, Practice loop, and separated orchestration/report/waveform modules verified |
| M7 | Desktop UI and motion | 18 | 18 | Full state matrix, WCAG palette, fake-device Record workflow, motion, primitives, and minimum-window routes verified |
| M8 | Linux packaging and release | 12 | 13 | Reproducible metadata/signing workflow and clean Ubuntu/Wayland/X11 launches verified; publication remains |
| M9 | Dogfood operation | 5 | 7 | Automatic metrics, local check-in, weekly summary UI, and export integrated |
| **Total** | | **114** | **117** | **97% implemented; removed external-import scope is excluded from totals** |

## M0: Contracts and migration safety

- [x] **M0-01** Create PRODUCT.md — `PRODUCT.md` written.
- [x] **M0-02** Reconcile design docs — Scope headers + reconciliation table added.
- [x] **M0-03** Freeze scope — `docs/TASKS.md` superseded, postponed items mapped.
- [x] **M0-04** Config schema v2 — `ConfigModelV2`, `ProviderConnectionModel`, `ConfigTranscriptionV2Model` in schemas.py.
- [x] **M0-05** Report schema v3 — `AnalysisModelV3` + 8 sub-models in schemas.py.
- [x] **M0-06** Goals/practice schemas — `GoalModel`, `PracticeAssignmentModel`, repositories in schemas.py.
- [x] **M0-07** Provider/transcription contracts — `ProviderAdapterInfo`, `TranscriptionEngineInfo`, etc. in schemas.py.
- [x] **M0-08** Migration framework — `storage/migrations.py` with backup, v1→v2, readback.
- [x] **M0-09** Migration tests — `test_migrations.py` (16 tests).

**Gate**: Schemas and migrations verified in the 360-test backend suite on Python 3.12.

## M1: Reliability and diagnostics

- [x] **M1-01** Recovery fixtures — `fixtures_recovery.py` (9 factories), `test_recovery_fixtures.py` (18 tests).
- [x] **M1-02** Duration verification — `test_recording_durations.py` (14 tests).
- [x] **M1-03** Harden finalization — `test_pipeline_hardening.py` (idempotency tests).
- [x] **M1-04** Harden transcription — `test_pipeline_hardening.py` (restart integrity).
- [x] **M1-05** Harden analysis — `test_pipeline_hardening.py` (6 error-→status mappings).
- [x] **M1-06** Disk space — `disk_space.py`, `test_disk_space.py` (9 tests).
- [x] **M1-07** Diagnostics service — `diagnostics.py` (5 checks), `test_diagnostics.py` (12 tests).
- [x] **M1-08** Diagnostics API — `api/diagnostics.py` (5 endpoints), wired in main.py.
- [x] **M1-09** Diagnostics pane — Seven runtime checks, retest, index repair, and redacted support export in Settings.
- [x] **M1-10** Log redaction — `redaction.py` (7 patterns, syntax fixed), `test_redaction.py` (12 tests).
- [x] **M1-11** Regression suite — `test_m1_regression.py`, `test_pipeline_hardening.py`.

**Gate**: Backend recovery and diagnostics tests pass. M1-09 awaits the Settings shell.

## M2: Provider foundation

- [x] **M2-01** Inventory constants — 87 sites in 14 files cataloged.
- [x] **M2-02** Remove closed literals — `LlmProvider` → `str`, `ReanalyzeLlmOverridePayload` fixed.
- [x] **M2-03** Remove frontend hosted-model arrays — Settings and onboarding use provider-fetched catalogs; Session Detail uses the active Settings selection.
- [x] **M2-04** Remove backend hosted-model defaults — predefined hosted-model arrays are absent; model choices come from provider catalogs. The isolated v1 request builder remains only for migrated legacy configuration.
- [x] **M2-05** Provider registry — `registry.py` (7 providers).
- [x] **M2-06** Model catalog — `catalog.py` (normalization, staleness).
- [x] **M2-07** Catalog cache — Read/write/stale detection in `catalog.py`.
- [x] **M2-08** Provider API routes — real create/list/delete connections, live catalog refresh with stale-cache fallback, selection validation, and adapter-driven compatibility tests.
- [x] **M2-09** OpenCode Zen adapter — authenticated live catalog and OpenAI-compatible generation through the official Zen base URL.
- [x] **M2-10** OpenCode Go adapter — separate authenticated live catalog and generation through the Go base URL.
- [x] **M2-11** OpenRouter adapter — real authentication, catalog, generation, usage lookup, and JSON compatibility request.
- [x] **M2-12** OpenAI-compatible adapter — configurable base URL with live `/models` and generation.
- [x] **M2-13** Ollama adapter — local OpenAI-compatible catalog and generation.
- [x] **M2-14** LM Studio adapter — local OpenAI-compatible catalog and generation.
- [x] **M2-15** Provider connection UI — Settings supports create, test, activate, and delete.
- [x] **M2-16** Live model picker — Models are fetched from the selected provider connection.
- [x] **M2-17** Compatibility test — Selected provider/model can be tested before activation.

## M3: External credential reuse

Removed from scope. Praxis no longer scans OpenCode, Hermes, OpenClaw, environment variables, or legacy application files. Users configure provider credentials directly in Praxis Settings or onboarding.

## M4: Transcription manager

- [x] **M4-01** Engine registry — `transcription/__init__.py` (TranscriptionEngine ABC, register/get/list).
- [x] **M4-02** Faster Whisper adapter — `faster_whisper_engine.py` wraps WhisperService behind engine interface.
- [x] **M4-03** Hardware inspection — `hardware.py` (CPU/RAM/GPU/disk).
- [x] **M4-04** Transcription catalog — 6 models in `faster_whisper_engine.py` `FASTER_WHISPER_MODELS`.
- [x] **M4-05** Hardware recommendations — `hardware.py` `recommend_model()`.
- [x] **M4-06** Download queue — `downloads.py` `ModelDownloadJob`.
- [x] **M4-07** Pause/resume — Settings and API pause/cancel safely and resume using durable Hugging Face partial-cache data.
- [x] **M4-08** Model verification — `downloads.py` `verify_model_files`.
- [x] **M4-09** Activation rollback — `downloads.py` `activate_model`, `rollback_activation`.
- [x] **M4-10** Model removal — `downloads.py` `check_removal_safe`, `remove_model`.
- [x] **M4-11** Cache relocation — `downloads.py` `relocate_cache`.
- [x] **M4-12** Licensed benchmark clip — Repository-owned eSpeak NG fixture, reference transcript, and explicit CC0 dedication are bundled without user data.
- [x] **M4-13** Benchmark service — Installed models report duration, processing time, real-time factor, transcript, and word error rate in Settings.
- [x] **M4-14** Journal transcript comparison — Settings compares any installed model against a recent journal, reports speed/similarity, and preserves the canonical transcript.
- [x] **M4-15** Transcription Settings UI — hardware recommendation, installed state, download lifecycle, activation and removal implemented.
- [x] **M4-16** Transcription lifecycle tests — included in the passing backend suite.

## M5: Onboarding

The agreed eight-step onboarding path is implemented: local-data welcome, appearance, journal activation, objective, transcription manager, direct AI setup, diagnostics, and baseline-record launch. Draft state resumes after restart, and failed checks link directly to their repair step.

## M6: Coaching report and Practice

- [x] **M6-01** Coach repositories — `coaching_repository.py` (goals/assignments/profile CRUD).
- [x] **M6-02** Previous-goal lookup — `coaching_context.py` `_build_previous_goal_block`.
- [x] **M6-03** Bounded coaching context — `coaching_context.py` `build_coaching_context`.
- [x] **M6-04** Report v3 prompt — `prompt_builder_v3.py`.
- [x] **M6-05** Report v3 validation — `parse_report_v3_response`, `validate_report_v3`.
- [x] **M6-06** V2 compat mapper — `report_compat.py` `map_v2_to_v3`.
- [x] **M6-07** Report overview UI — Report v3 renders verdict, strength, one priority, practice, and next goal.
- [x] **M6-08** Evidence timeline UI — Timestamp evidence moments seek the recording.
- [x] **M6-09** Detailed analysis disclosure — Existing detailed report remains available beneath the overview for legacy reports.
- [x] **M6-10** Split Session Detail — session orchestration remains in the page while coaching/report sections and waveform rendering live in dedicated Praxis component modules.
- [x] **M6-11** Persist goal and assignment — production processing stores the generated goal and exercise locally.
- [x] **M6-12** Practice API — `api/practice.py` (3 endpoints).
- [x] **M6-13** Practice tab — current goal, exercise completion, history, and new-journal action implemented.
- [x] **M6-14** Connect goal to Record — Record displays the active goal, success criteria, and current exercise before capture.
- [x] **M6-15** Multilingual regression — included in the passing backend suite.

## M7: Desktop UI and motion

- [x] **M7-01** Design tokens — `tokens.css`, `motion.css`.
- [x] **M7-02** Praxis-styled shadcn/Radix primitives — Button, Dialog, AlertDialog, Tabs, Select, Command, Popover, DropdownMenu, Tooltip, Switch, Progress, Collapsible, ScrollArea, Separator, and Sonner wrappers; report tabs migrated and primitive behavior tested.
- [x] **M7-03** Praxis components — Shared health, coaching, evidence, goal, processing, toolbar, feedback, and summary components are integrated into pages.
- [x] **M7-04** Desktop application shell uses shared semantic surfaces and a compact minimum-width layout.
- [x] **M7-05** Primary sidebar uses consistent selection, live processing state, and desktop shortcuts.
- [x] **M7-06** Settings uses a persistent preferences sidebar with accessible arrow-key tab navigation.
- [x] **M7-07** Today leads with the active goal, current exercise, primary recording action, processing status, latest lesson, and habit evidence.
- [x] **M7-08** Record signature surface — goal, live microphone meter, stable timer, focused controls, and continuous five-second local chunk persistence are present.
- [x] **M7-09** Session report editorial overview and evidence seeking integrated.
- [x] **M7-10** Progress leads with improving/stalled skills, repeated pattern, goal completion, consistency, and honest sparse-data states before charts.
- [x] **M7-11** Every route, onboarding, and Session Detail rendered at the 900x600 Electron minimum; Session Detail media width was corrected after visual QA.
- [x] **M7-12** Global desktop shortcuts, skip link, route focus, and document titles.
- [x] **M7-13** Global visible keyboard focus and accessible navigation landmarks.
- [x] **M7-14** Motion tokens and `prefers-reduced-motion` behavior.
- [x] **M7-15** Processing, recording, navigation, and reduced-motion behavior integrated; playback and microphone UI updates are bounded to avoid display-rate workspace renders.
- [x] **M7-16** Active report evidence follows video playback and remains keyboard-seekable.
- [x] **M7-17** Full state QA — 11 WCAG token checks, minimum-window route captures, real packaged processing/needs-attention captures, tested loading/load-error states, and a packaged destructive-confirmation capture. Screenshot review drove responsive and copy fixes.
- [x] **M7-18** Recording/waveform performance — bounded UI update rates, no renderer-side recording accumulation, 120-chunk/10-minute regression, and a real 30-second packaged fake-camera/microphone profile. Renderer settled near 139 MB working set after local preview assembly.

## M8: Linux packaging and release

- [x] Detect supported Linux x86_64 and reject unsupported platforms.
- [x] Enforce a non-destructive free-space preflight.
- [x] Install a supplied local or HTTPS AppImage without root.
- [x] Require and verify SHA-256; optionally verify minisign signatures.
- [x] Create CLI and desktop application launchers.
- [x] Provide no-FUSE AppImage extraction fallback.
- [x] Support `--check`, `--uninstall`, `--version`, and `--no-launch`; uninstall preserves user data.
- [x] Produce and smoke-test the real AppImage with frozen Python/backend runtime, FFmpeg, and FFprobe; no system Python required.
- [x] Add deterministic `latest-linux.json`, optional minisign signing, stable versioned GitHub URLs, and a tag-driven release workflow.
- [x] Verify a clean-home packaged launch opens first-run onboarding with `setup_completed=false`.
- [x] Record clean-runtime results for the supported distro baseline — the final AppImage renderer and bundled backend launched under Ubuntu 24.04 with a clean home and produced a real window capture.
- [x] Verify Wayland and X11 desktop sessions — host Wayland packaged launch and Ubuntu 24.04 Xvfb/X11 packaged launch both passed.
- [ ] Publish the release artifact and checksum/signature set.

## M9: Dogfood operation

- [x] **M9-01** Dogfood log — `dogfood.py` (JSONL entries, check-in, weekly summary).
- [x] **M9-02** Record processing metrics automatically after successful sessions.
- [x] **M9-03** Add the optional 20-second post-report check-in stored only in the journal.
- [x] **M9-04** Expose a local weekly summary with ratings, errors, and repeated friction notes.
- [x] **M9-05** Add weekly-summary UI and JSON export in Settings.
- [~] **M9-06** The day-0, daily, weekly, and day-30 operating checklist is documented in `docs/DOGFOOD_30_DAY_RUNBOOK.md`; the baseline entry must come from the owner's first genuine journal.
- [ ] **M9-07** Run and document the full 30-day dogfood period.

## Active work

| Task | Status |
|---|---|
| M6-10 Session Detail split | In progress |
| M7-02 shared UI primitives | In progress |
| M7-17/M7-18 rendered QA and profiling | In progress |
| M8 publication | Awaiting an intentional tagged public release |
| M9 30-day run | Starts with the first real daily journal |

## Blockers

| Blocker | Detail |
|---|---|
| Public release not yet published | The verified artifact and automated tagged-release workflow are ready; publishing changes the public GitHub repository and requires an intentional version tag. |
| Thirty elapsed days required | Product instrumentation is ready, but a genuine 30-day daily-use result cannot be manufactured in a build session. |

## Verification baseline

- Backend: `368 passed` on Python 3.12.
- Frontend: production build succeeds; `17 passed` across 11 files; production dependency audit reports zero vulnerabilities.
- Python compilation: passes.
- Patch formatting: `git diff --check` passes.
