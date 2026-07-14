# Praxis Daily: 30-Day Dogfood Build Plan

Status: proposed implementation plan
Target: Linux x86_64
Primary user: the project owner during a 30-day daily-use trial
Data policy: recordings, transcripts, reports, goals, exercises, progress, and model files remain local

Implementation tracker: [`PRAXIS_30_DAY_TASKS.md`](PRAXIS_30_DAY_TASKS.md)

## 1. Purpose

This milestone turns the current Praxis prototype into a dependable Linux desktop application that can support one journal every day for 30 days.

The daily loop is:

```text
Open Praxis
  -> see the current practice goal
  -> record a journal
  -> transcribe locally
  -> generate a short coaching report
  -> complete or schedule one exercise
  -> carry one measurable goal into the next journal
```

This milestone does not build the SaaS service or mobile application. It creates the local product those later clients and services must preserve.

## 2. Definition of success

The build is ready for the trial when all of the following are true:

- A user installs Praxis on a clean supported Linux machine without installing Node, Python, uv, FFmpeg, or build tools.
- First-run setup finds or creates a journal folder, downloads a transcription model, connects an AI provider, fetches that provider's live models, validates the selected model, and starts a baseline recording.
- The interface contains no hardcoded selectable hosted-model IDs.
- A normal user never needs to type a model ID.
- Praxis supports OpenCode Zen and OpenCode Go as separate connections.
- Provider credentials are entered directly into Praxis and stored in its secure local credential store.
- API keys and tokens live in the Linux credential store, not in the general JSON configuration.
- Recordings survive ordinary crashes and interrupted processing.
- The report can be understood in less than two minutes.
- Every full report produces one measurable next goal.
- The next analysis evaluates the previous goal using transcript evidence.
- The user can download, verify, activate, benchmark, move, and remove local transcription models from Settings.
- The application uses one coherent desktop design system and no longer resembles a collection of web-dashboard cards.
- Every important operation exposes an actionable error state and a diagnostics entry.

## 3. Fixed product decisions

### 3.1 Local ownership

Praxis stores all journal content on the user's machine:

- video and audio;
- transcripts and subtitles;
- reports and raw model responses;
- current and historical goals;
- exercises and completion state;
- recurring patterns and progress calculations;
- flashcards and learning paths added after this milestone.

Future Praxis-managed AI may receive selected text for a request, but it will not become journal storage. Cloud storage and cloud sync remain outside this milestone.

### 3.2 Supported platform

The first supported release target is Linux x86_64. Windows, macOS, ARM64, SaaS, and mobile work must not delay the 30-day build.

### 3.3 Hosted-model discovery

Praxis ships provider connection logic. It does not ship a selectable list of hosted-model IDs.

The application obtains models in this order:

1. the connected provider's authenticated model endpoint;
2. the provider's official public catalog endpoint;
3. supplemental metadata from a maintained source such as Models.dev or LiteLLM;
4. the last successful local catalog cache when the network is unavailable.

The UI may display locally derived labels such as `Fast`, `Low cost`, or `Structured output verified`, but it must retain the provider's model identifier internally.

### 3.4 Authentication

Praxis supports an authentication method only when the provider exposes an official API key, OAuth flow, device flow, subscription token, or documented compatible endpoint. Praxis must not scrape browser sessions or bypass provider restrictions.

### 3.5 Transcription

Faster Whisper remains the production engine for the trial. The implementation introduces an engine boundary so whisper.cpp and other runtimes can be added later. Multiple incomplete transcription engines are not part of the release gate.

## 4. Current problems in the repository

The implementation must address these concrete problems:

- `backend/app/services/llm_client.py` hardcodes OpenCode Go model IDs and defaults to the first entry.
- `frontend/src/pages/Onboarding.jsx` hardcodes providers, OpenCode Go models, OpenRouter examples, and Whisper models.
- `frontend/src/pages/Settings.jsx` duplicates Whisper and OpenCode model lists.
- `frontend/src/pages/SessionDetail.jsx` contains another provider and model configuration path for reanalysis.
- `backend/app/models/schemas.py` restricts providers with a closed `Literal`, preventing registry-driven providers.
- `backend/app/services/config.py` persists provider API keys in the application config.
- `backend/app/main.py` contains setup, configuration, provider, session, upload, analysis, export, recovery, and diagnostics concerns in one module.
- `process_session()` sends personal context and recurring patterns to analysis, but not the previous goal and its success criteria.
- Settings uses custom controls and a long pane implementation instead of a consistent component system.
- Session Detail gives detailed analysis sections too much equal visual weight.
- The app lacks a complete runtime health and repair surface.

## 5. Target architecture

### 5.1 Backend boundaries

Create these modules while preserving current routes through staged migration:

```text
backend/app/
  api/
    config.py
    diagnostics.py
    providers.py
    transcription.py
    sessions.py
    practice.py
  domain/
    reports.py
    goals.py
    practice.py
    providers.py
    transcription.py
  providers/
    base.py
    registry.py
    catalog.py
    adapters/
      opencode_zen.py
      opencode_go.py
      openrouter.py
      openai_compatible.py
      ollama.py
      lm_studio.py
      litellm_proxy.py
  transcription/
    base.py
    registry.py
    catalog.py
    downloads.py
    benchmark.py
    faster_whisper_engine.py
  services/
    coaching_context.py
    report_service.py
    diagnostics.py
    processing_queue.py
  storage/
    local_repository.py
    migrations.py
    secrets.py
```

Do not perform a one-shot rewrite of `main.py`. Extract one route group at a time and keep tests passing after each move.

### 5.2 Frontend boundaries

```text
frontend/src/
  components/ui/                 # shadcn-owned primitives
  components/praxis/
    AppToolbar.jsx
    ProviderConnectionRow.jsx
    ProviderModelPicker.jsx
    CredentialImportPreview.jsx
    RuntimeHealthRow.jsx
    ModelDownloadRow.jsx
    CoachingVerdict.jsx
    PreviousGoalResult.jsx
    EvidenceMoment.jsx
    CurrentGoal.jsx
    PracticeAssignment.jsx
    ProcessingTimeline.jsx
  pages/
    settings/
      SettingsShell.jsx
      GeneralSettings.jsx
      RecordingSettings.jsx
      TranscriptionSettings.jsx
      ProviderSettings.jsx
      StorageSettings.jsx
      AppearanceSettings.jsx
      DiagnosticsSettings.jsx
      AdvancedSettings.jsx
    onboarding/
      OnboardingShell.jsx
      GoalStep.jsx
      JournalStep.jsx
      HardwareStep.jsx
      TranscriptionStep.jsx
      ProviderDetectionStep.jsx
      ProviderConnectionStep.jsx
      SystemCheckStep.jsx
      BaselineStep.jsx
    report/
      ReportOverview.jsx
      ReportEvidence.jsx
      ReportDetails.jsx
  api/
    providers.js
    transcription.js
    diagnostics.js
    practice.js
  styles/
    tokens.css
    motion.css
```

## 6. Data and schema changes

### 6.1 Configuration schema v2

Replace embedded keys and closed provider fields with connection references:

```json
{
  "schema_version": 2,
  "journal_folder": "/home/user/Praxis Journal",
  "active_provider_connection_id": "connection_uuid",
  "provider_connections": {
    "connection_uuid": {
      "provider_id": "opencode_go",
      "display_name": "My OpenCode Go",
      "auth_profile_id": "secret_uuid",
      "selected_model_id": "provider_returned_id",
      "base_url": "",
      "catalog_updated_at": "2026-07-12T20:00:00Z",
      "enabled": true
    }
  },
  "transcription": {
    "engine_id": "faster_whisper",
    "model_id": "engine_returned_id",
    "cache_folder": "/home/user/.cache/praxis/models",
    "device": "auto",
    "compute_type": "auto"
  }
}
```

`selected_model_id` stores the user's current choice. Praxis obtains it from the provider catalog; it does not generate or predefine it.

### 6.2 Secret schema

Store secrets in Linux Secret Service with attributes:

- service: `praxis`;
- secret ID;
- provider ID;
- account label;
- creation date;
- import source;
- auth type.

The JSON configuration stores only the secret ID and non-secret metadata.

### 6.3 Session schema v3

Extend `meta.json` practice data:

```json
{
  "practice": {
    "current_goal_id": "goal_uuid",
    "source_goal_id": "goal_uuid",
    "previous_goal_result": "partially_followed",
    "previous_goal_evidence": [
      {
        "timestamp_seconds": 192,
        "quote": "...",
        "explanation": "..."
      }
    ],
    "assignment_completed": false,
    "assignment_completed_at": null
  }
}
```

### 6.4 Local coach files

Add:

```text
<journal>/_coach/profile.json
<journal>/_coach/goals.json
<journal>/_practice/assignments.json
```

For the 30-day build, `goals.json` contains goal history and `assignments.json` contains one exercise per session. Reserve schema fields for quizzes, flashcards, and learning paths without exposing unfinished UI.

### 6.5 Migrations

Add idempotent migrations for:

- config v1 to v2;
- plaintext keys to keyring references;
- session practice fields to stable goal IDs;
- analysis schema v2 to presentation-compatible v3 fallback.

Every migration must create a backup before writing. A migration failure must leave the original file usable.

## 7. Provider system

### 7.1 Provider adapter contract

```python
class ProviderAdapter(Protocol):
    provider_id: str

    def auth_methods(self) -> list[AuthMethod]: ...
    async def authenticate(self, request: AuthRequest) -> AuthResult: ...
    async def refresh_auth(self, profile: AuthProfile) -> AuthResult: ...
    async def fetch_models(self, profile: AuthProfile) -> list[ProviderModel]: ...
    async def test_model(self, profile: AuthProfile, model_id: str) -> ModelTestResult: ...
    async def fetch_usage(self, profile: AuthProfile) -> UsageResult | None: ...
    async def generate(self, request: GenerationRequest) -> GenerationResult: ...
```

The registry returns capabilities so the UI renders fields from provider behavior rather than `if provider === ...` branches.

### 7.2 Provider model normalization

Normalize live results into:

```json
{
  "id": "exact-provider-id",
  "display_name": "provider supplied name",
  "provider_id": "opencode_go",
  "context_window": null,
  "input_modalities": ["text"],
  "output_modalities": ["text"],
  "supports_structured_output": "unknown",
  "availability": "available",
  "pricing": null,
  "source": "provider_authenticated_catalog",
  "fetched_at": "..."
}
```

Missing metadata stays unknown. Praxis must not invent prices or capabilities.

### 7.3 Catalog cache

Store catalogs under:

```text
~/.cache/praxis/providers/<connection-id>/models.json
```

Include ETag or last-modified data when providers support it. Refresh on connection, manual refresh, application startup when stale, and model-not-found errors. Preserve the last valid cache if refresh fails.

### 7.4 Compatibility test

After model selection, send one small Praxis-shaped JSON request. Validate:

- authentication;
- endpoint routing;
- model availability;
- response extraction;
- valid JSON;
- required fields;
- latency;
- provider error mapping.

Store the result by connection and model. Do not mark every catalog model compatible before testing it.

### 7.5 OpenCode Zen

- Treat Zen as a credit-based OpenCode gateway.
- Import an existing credential or accept a new official key.
- Fetch the live catalog from the official Zen model endpoint.
- Display balance only if an official endpoint exposes it.
- Preserve provider-returned availability and deprecation data.

### 7.6 OpenCode Go

- Treat Go as a subscription connection distinct from Zen.
- Import its existing OpenCode credential or accept the supported credential flow.
- Query the live Go catalog available to that account.
- Do not copy model names from documentation.
- Do not substitute Zen models when the Go endpoint omits them.
- Display usage windows only when an official endpoint exposes them.

### 7.7 Other providers and subscriptions

The registry must accommodate:

- API providers;
- official OAuth/device-code subscriptions;
- coding-plan subscriptions;
- multi-provider gateways;
- local servers;
- OpenAI-compatible custom endpoints.

Add adapters in batches after Zen and Go establish the contract. “All providers” means an extensible registry plus documented adapter work, not one permanent list claimed to be complete.

### 7.8 Provider API routes

Add:

```text
GET    /api/providers
POST   /api/providers/connect
DELETE /api/providers/connections/{connection_id}
GET    /api/providers/connections/{connection_id}/models
POST   /api/providers/connections/{connection_id}/refresh-models
POST   /api/providers/connections/{connection_id}/test
GET    /api/providers/connections/{connection_id}/usage
PATCH  /api/providers/connections/{connection_id}
```

Return stable error codes such as `AUTH_EXPIRED`, `CATALOG_UNAVAILABLE`, `MODEL_REMOVED`, `MODEL_TEST_FAILED`, and `KEYRING_UNAVAILABLE`.

## 8. Direct provider setup

Praxis does not scan other applications or environment variables for reusable credentials. The user chooses a provider, enters its credential directly, fetches the authenticated catalog, selects a model, tests it, and only then activates it. Disconnect deletes the Praxis-owned keyring item after confirmation.

## 9. Transcription manager

### 9.1 Engine contract

```python
class TranscriptionEngine(Protocol):
    engine_id: str

    def inspect_runtime(self) -> RuntimeStatus: ...
    async def fetch_catalog(self) -> list[TranscriptionModel]: ...
    async def download(self, model_id: str, destination: Path, progress): ...
    def verify(self, model_id: str, path: Path) -> VerificationResult: ...
    def benchmark(self, model_id: str, sample: Path) -> BenchmarkResult: ...
    def transcribe(self, request: TranscriptionRequest) -> TranscriptResult: ...
    def remove(self, model_id: str) -> None: ...
```

### 9.2 Faster Whisper catalog

The engine exposes models supported by the installed runtime and records source revision, languages, estimated disk size, and compatibility. Keep the catalog adapter separate from the UI. The UI never defines the model list.

### 9.3 Download lifecycle

States:

```text
not_installed -> queued -> downloading -> verifying -> testing -> ready
                                  |             |          |
                                  +-> paused    +-> failed +-> failed
```

Requirements:

- choose cache location;
- show total bytes, downloaded bytes, speed, and remaining estimate when available;
- use partial files;
- resume supported downloads;
- cancel without corrupting installed models;
- verify expected files and checksums when provided;
- run a bundled audio smoke test;
- activate only after verification;
- retain the previous active model on failure;
- remove only after checking that another usable model exists or obtaining explicit confirmation.

### 9.4 Hardware recommendation

Inspect CPU architecture, logical cores, RAM, GPU vendor, CUDA/Vulkan availability, and free disk space. Return a recommendation with explicit reasons. Do not hide incompatible models; label them and explain the missing requirement.

### 9.5 Benchmark and comparison

Ship a short licensed test clip. Record duration, processing time, real-time factor, detected language, runtime, device, and compute type. Permit comparison against one existing journal without overwriting its canonical transcript.

### 9.6 Transcription routes

```text
GET    /api/transcription/runtime
GET    /api/transcription/engines
GET    /api/transcription/models
POST   /api/transcription/models/{model_id}/download
GET    /api/transcription/downloads/{download_id}
POST   /api/transcription/downloads/{download_id}/pause
POST   /api/transcription/downloads/{download_id}/resume
DELETE /api/transcription/downloads/{download_id}
POST   /api/transcription/models/{model_id}/verify
POST   /api/transcription/models/{model_id}/benchmark
PATCH  /api/transcription/active
DELETE /api/transcription/models/{model_id}
```

Emit download and verification progress through the existing SSE channel.

## 10. Coaching report v3

### 10.1 Report objective

The report helps the user decide what to practice next. Detailed metrics support that decision but do not control the opening screen.

### 10.2 Visible report structure

1. Verdict: two or three short sentences.
2. Previous goal: goal text, result, and evidence when a previous goal exists.
3. One strength: behavior worth repeating and one transcript example.
4. Priority improvement: the most useful correction and why it matters.
5. Evidence: no more than three timestamped moments.
6. Practice: one short exercise with completion criteria.
7. Next goal: one measurable behavior for the next recording.

### 10.3 Detailed sections

Keep these collapsed by default:

- scorecard;
- language corrections;
- speaking mechanics;
- ideas and reasoning;
- recurring patterns;
- filler words;
- complete transcript;
- raw response;
- processing metadata.

### 10.4 Output schema

Add a presentation layer while retaining analytical detail:

```json
{
  "schema_version": 3,
  "report": {
    "verdict": "",
    "previous_goal": {
      "goal_id": null,
      "result": "not_applicable",
      "summary": "",
      "evidence": []
    },
    "strength": {
      "title": "",
      "explanation": "",
      "evidence": null
    },
    "priority_improvement": {
      "title": "",
      "explanation": "",
      "replacement_behavior": ""
    },
    "evidence_moments": [],
    "practice": {
      "title": "",
      "instructions": "",
      "success_criteria": []
    },
    "next_goal": {
      "goal_id": "",
      "text": "",
      "success_criteria": []
    }
  },
  "details": {
    "scorecard": {},
    "language": {},
    "reasoning": {},
    "patterns": []
  }
}
```

### 10.5 Coaching context

Before analysis, build a bounded context package containing:

- editable coach profile;
- session language and objective;
- current goal and success criteria;
- completion state for the previous exercise;
- confirmed recurring patterns relevant to the language;
- a compact recent-trend summary;
- the new timestamped transcript.

Do not send every historical transcript.

### 10.6 Prompt rules

- Use plain language in the session language.
- Select one priority improvement.
- Cite transcript evidence for claims.
- Evaluate the previous goal only against stated success criteria.
- Mark the result uncertain when evidence is insufficient.
- Avoid generic encouragement and transcript repetition.
- Avoid diagnosis of personality or mental health.
- Separate factual corrections from coaching opinions.
- Keep the verdict, strength, improvement, and practice concise.

### 10.7 Report migration and fallback

Session Detail must render schema v2 reports through a compatibility mapper. Reanalysis can create schema v3 without deleting the old raw response. Add fixture tests for English, French, and Spanish.

## 11. Practice tab for the trial

The first Practice tab contains:

- current goal;
- source session;
- reason for selection;
- success criteria;
- one exercise;
- completion action;
- previous assignments;
- start-next-journal action.

It does not yet generate a full quiz library, spaced-repetition schedule, or multi-step learning path. Store future-compatible IDs and types so those features can follow without another migration.

Routes:

```text
GET   /api/practice/current
GET   /api/practice/history
PATCH /api/practice/assignments/{assignment_id}
POST  /api/practice/goals/{goal_id}/activate
```

## 12. Desktop UI redesign

### 12.1 Product frame

Praxis uses a stable three-part frame:

```text
navigation sidebar | page toolbar
                   | workspace
```

Primary destinations:

- Today;
- Record;
- Practice;
- Sessions;
- Progress;
- Settings.

The sidebar stays quiet. It contains navigation, one `New journal` action, processing/attention state, and Settings. It does not contain a dashboard of statistics.

### 12.2 Desktop rules

- Use split views for lists and detail where useful.
- Use toolbars for page actions.
- Use menus for secondary actions.
- Keep window-level navigation stable.
- Use standard controls and predictable keyboard behavior.
- Replace card grids with sections, lists, tables, inspectors, and separators.
- Avoid large marketing headings inside the product.
- Avoid tiny uppercase labels as the default hierarchy device.
- Keep prose between 65 and 75 characters per line.
- Use one component vocabulary throughout the app.

### 12.3 Design tokens

Move raw color values out of page components into `styles/tokens.css`:

- application background;
- canvas;
- sidebar;
- panel and raised surface;
- subtle and strong separators;
- primary, secondary, and muted text;
- accent, success, warning, danger, and recording;
- focus ring;
- selected, hovered, disabled, and loading states.

Define a 4px spacing scale, a restrained radius scale, toolbar and sidebar dimensions, semantic z-index levels, and typography roles.

### 12.4 shadcn adoption

Adopt shadcn primitives incrementally. Start with Button, Dialog, AlertDialog, Tabs, Select, Command, Popover, DropdownMenu, Tooltip, Switch, Progress, Collapsible, ScrollArea, Separator, and Sonner.

Do not import a default shadcn visual identity. Restyle primitives with Praxis tokens and expose Praxis-specific components to pages.

### 12.5 Settings

Replace the current long implementation with a preferences shell:

```text
General
Recording
Transcription
AI Providers
Storage
Appearance
Diagnostics
Advanced
```

The left pane remains visible. The right pane uses grouped rows and inline status. Search filters settings by label and description. Saving happens immediately for reversible preferences; destructive or connection-changing actions require confirmation.

### 12.6 Today

Today answers five questions:

- What am I practicing?
- What should I do now?
- Did my last session finish processing?
- What did I learn last time?
- Have I maintained the habit?

The primary action is `Record today's journal`. Show one current goal, one practice item, the latest lesson, pending errors, and a compact streak. Remove decorative analytics.

### 12.7 Record

Record is the signature surface:

- large preview stage;
- current goal visible before recording;
- camera and microphone status;
- stable timer and audio level;
- unmistakable start and stop controls;
- save-safety status;
- focused recording mode that withdraws nonessential chrome;
- review state that keeps the same stage.

### 12.8 Session report

Use an editorial reading column inside a desktop workspace, not a stack of equal cards. Place video and timeline beside or above the report depending on window width. Clicking evidence seeks the video. Keep detailed analysis behind one clear disclosure area.

### 12.9 Progress

Lead with written findings:

- improving skill;
- stalled skill;
- repeated pattern;
- goal completion rate;
- recording consistency.

Charts provide evidence. They do not replace conclusions. Sparse-data states must explain when Praxis cannot infer a trend.

### 12.10 Responsive desktop behavior

Support the Electron minimum window size. At narrower widths, collapse secondary inspectors and labels before stacking the interface into mobile-style cards. Do not design a phone layout inside the desktop app.

## 13. Motion and interaction quality

### 13.1 Motion tokens

- instant feedback: 80-120ms;
- controls and menus: 140-180ms;
- panes and dialogs: 180-240ms;
- easing: ease-out quart or quint;
- no bounce or elastic easing.

### 13.2 High-value motion

- Sidebar selection moves between destinations.
- Workspace navigation uses a short directional fade.
- Recording preview expands into focused mode.
- The recording indicator pulses without affecting layout.
- The waveform updates without rerendering the entire page.
- Processing moves through real backend stages.
- Download progress follows bytes received.
- Report readiness transitions from processing state into the report shell.
- Evidence selection moves the video playhead and highlights the active moment.

### 13.3 Performance rules

- Prefer transform and opacity.
- Do not animate layout properties during recording.
- Avoid page-load choreography.
- Do not delay navigation to finish an animation.
- Honor `prefers-reduced-motion` with crossfades or instant transitions.
- Profile waveform and recording views before accepting motion work.

## 14. Onboarding redesign

### Step 1: Welcome

Explain the product and local-data policy in three short lines. One primary action starts setup.

### Step 2: Goal

Ask what the user wants to improve and accept a custom objective. Use the answer to seed an editable coach profile.

### Step 3: Journal

Recommend a folder, allow another location, detect an existing journal, show available space, and validate writability before continuing.

### Step 4: Hardware

Detect CPU, RAM, GPU, acceleration support, and disk space. Explain the resulting transcription recommendation.

### Step 5: Transcription

Show the recommended model plus alternatives from the engine catalog. Download, verify, test, and activate it within the wizard. Preserve progress if the application restarts.

### Step 6: AI connection

Add a provider credential directly. Fetch the live catalog, select a model, and run the Praxis compatibility test. Permit local AI and manual report import.

### Step 7: System check

Verify journal, backend, FFmpeg, media access, transcription runtime, selected local model, credential store, provider authentication, and selected hosted model.

### Step 8: Baseline

Prompt a two-minute first journal about the user's 30-day objective. This creates the baseline and first goal.

### Onboarding acceptance criteria

- Restart resumes the last incomplete step.
- Back navigation does not destroy completed downloads or connections.
- Every failed check offers Retry, Change setting, and View details when relevant.
- The user can finish in local transcription plus manual-analysis mode.
- The wizard contains no manually typed hosted-model field in normal mode.

## 15. Diagnostics and recovery

### 15.1 Health checks

Display status for:

- backend;
- journal folder and index;
- free disk;
- camera and microphone;
- FFmpeg and FFprobe;
- transcription runtime;
- active transcription model;
- Linux credential store;
- active provider;
- selected hosted model;
- last successful recording, transcription, and report.

### 15.2 Actions

- retest all;
- copy redacted diagnostics;
- open logs;
- open journal;
- rebuild index;
- verify model files;
- retry interrupted processing;
- repair a stuck session;
- reset onboarding without deleting journal data.

### 15.3 Startup recovery

Extend current recovery to distinguish recording, media finalization, transcription, analysis, and model download interruptions. Recovery must be idempotent and emit visible events.

## 16. Linux packaging and installer

### 16.1 Release artifact

Produce a Linux x86_64 AppImage containing:

- Electron runtime;
- built React assets;
- Python runtime and backend dependencies;
- FFmpeg and FFprobe;
- Faster Whisper runtime;
- keyring integration dependencies;
- diagnostics and update metadata.

Do not bundle large transcription models.

### 16.2 Installer

Improve `scripts/install.sh` to:

1. detect Linux and x86_64;
2. detect unsupported environments with a useful error;
3. check disk space;
4. download or install the supplied release artifact;
5. verify checksum and signature;
6. install for the current user without root;
7. create desktop and application-menu entries;
8. handle missing AppImage/FUSE support with an extraction fallback;
9. run a non-destructive health check;
10. launch onboarding;
11. support `--check`, `--uninstall`, `--version`, and `--no-launch`.

Do not turn the installer into a source compiler or system package manager.

### 16.3 Release verification

Test on clean virtual machines for the supported Linux baseline. Record distro, desktop session, kernel, graphics mode, result, and logs. A successful developer machine build does not satisfy this gate.

## 17. Testing strategy

### 17.1 Backend tests

Add tests for:

- provider adapter contract;
- Zen and Go catalog parsing;
- catalog caching and stale fallback;
- model removal handling;
- compatibility tests;
- credential detection, consent boundary, keyring migration, and redaction;
- transcription downloads, resume, verification, activation rollback, and removal;
- previous-goal context construction;
- report v3 validation and retry;
- schema migrations and backups;
- diagnostics and recovery.

Use fixtures and mocked provider endpoints. Do not require paid accounts in the default suite.

### 17.2 Frontend tests

Add tests for:

- provider detection and import preview;
- live catalog loading, failure, refresh, search, and selection;
- missing selected model;
- transcription download states;
- onboarding resume;
- report overview and previous-goal result;
- evidence-to-video seeking;
- Settings keyboard navigation;
- reduced-motion behavior where testable.

### 17.3 Manual recording matrix

Test 1, 5, 15, and 30-minute recordings plus:

- camera disconnect;
- microphone disconnect;
- application crash;
- restart during finalization;
- restart during transcription;
- restart during analysis;
- no network;
- expired credentials;
- provider timeout and rate limit;
- malformed AI output;
- removed hosted model;
- interrupted local-model download;
- full or nearly full disk;
- moved or unavailable journal folder.

## 18. Instrumentation for the 30-day trial

Keep trial notes local in:

```text
<journal>/_dogfood/entries.jsonl
```

After each session, permit a 20-second optional check-in:

- Was the report understandable?
- Was the main correction accurate?
- Will you attempt the exercise?
- What felt slow or broken?

Store application version, processing durations, selected engine/provider labels, error codes, and user notes. Do not store secrets. Add a weekly local summary that groups repeated friction.

## 19. Delivery sequence

### Phase 0: Contracts and safety, days 1-2

- Create `PRODUCT.md` from confirmed product decisions.
- Finalize config v2, report v3, provider, goal, practice, and transcription schemas.
- Add migration framework and backups.
- Add design tokens and a component migration rule.

Exit: schemas and acceptance criteria have tests before UI implementation spreads them.

### Phase 1: Reliability and diagnostics, days 3-5

- Exercise recording and recovery paths.
- Fix critical data-loss and stuck-session defects.
- Add diagnostics API and first Diagnostics pane.
- Add redacted support bundle.

Exit: a failed session remains recoverable or explains why it cannot recover.

### Phase 2: Provider foundation, days 6-10

- Remove hardcoded hosted-model arrays.
- Add secret storage and legacy migration.
- Add provider registry and adapter contract.
- Implement OpenCode Zen, OpenCode Go, OpenRouter, and generic compatible endpoints.
- Add live catalog cache and compatibility testing.
- Build provider connection and model picker UI.

Exit: Zen and Go users connect, fetch their actual model catalog, select a returned model, and generate a valid test report without typing an ID.

### Phase 3: Provider activation hardening, days 11-12

- Store credentials entered directly in Praxis.
- Fetch provider-authenticated catalogs.
- Require a successful model test before activation.
- Recover safely when an active connection no longer has a selected model.

Exit: a newly authenticated connection cannot replace a working provider until its selected model passes verification.

### Phase 4: Transcription manager, days 13-16

- Add engine boundary.
- Move Faster Whisper behind the engine adapter.
- Add dynamic model catalog, downloads, resume, verification, benchmark, activation rollback, and cache location.
- Build Transcription Settings.

Exit: a user installs and switches a model without using a terminal.

### Phase 5: Onboarding, days 17-19

- Build the new setup shell and persisted step state.
- Integrate hardware detection, model download, direct provider setup, live hosted catalog, and health check.
- Add the baseline recording handoff.

Exit: a clean installation reaches the first recording without documentation.

### Phase 6: Coaching loop, days 20-23

- Implement coach context with previous goal.
- Add report v3 prompt, validation, fixtures, compatibility mapper, and UI.
- Add local goal and assignment repositories.
- Add the minimal Practice tab.

Exit: session two evaluates session one's goal and creates one new measurable goal.

### Phase 7: Desktop redesign and motion, days 24-27

- Add shadcn primitives and Praxis wrappers.
- Rebuild shell, Settings, Today, Record, Session report, and essential Progress hierarchy.
- Add motion tokens, focused recording transition, processing timeline, and reduced-motion mode.
- Run keyboard, focus, contrast, and minimum-window checks.

Exit: the application uses one desktop component vocabulary and contains no major card-wall or long-form-settings surface.

### Phase 8: Packaging and release gate, days 28-30

- Produce reproducible AppImage.
- Finish installer, uninstall, health-check, and update metadata.
- Test clean Linux virtual machines.
- Fix release-blocking defects.
- Start the baseline journal and dogfood log.

Exit: all definition-of-success checks pass or the release is delayed.

## 20. File-level implementation map

### Replace or refactor

- `backend/app/main.py`: extract route groups and call domain services.
- `backend/app/models/schemas.py`: introduce versioned provider, transcription, goal, practice, and report models; remove the closed provider literal.
- `backend/app/services/llm_client.py`: replace provider branching and hardcoded models with the adapter registry.
- `backend/app/services/config.py`: migrate credentials to keyring references and config v2.
- `backend/app/services/prompt_builder.py`: accept bounded coach context and emit report v3 requirements.
- `backend/app/services/sessions.py`: persist stable goal references and report compatibility data.
- `backend/app/services/whisper_service.py`: move runtime behavior behind `TranscriptionEngine`.
- `frontend/src/pages/Settings.jsx`: replace with the pane-based Settings modules.
- `frontend/src/pages/Onboarding.jsx`: replace hardcoded provider/model steps with backend-driven setup steps.
- `frontend/src/pages/SessionDetail.jsx`: split media, report overview, evidence, and details.
- `frontend/src/App.jsx`: add Practice and stable route definitions; preserve desktop scroll behavior.
- `frontend/src/styles/globals.css`: consume semantic tokens and motion rules.
- `scripts/install.sh`: implement the supported Linux installer contract.
- `scripts/release-linux.sh`: add reproducibility metadata, checksums, signatures, and clean-machine verification hooks.

### Add

- backend provider, importer, transcription, diagnostics, goal, practice, migration, and secret-storage modules listed in Sections 5-9;
- frontend settings, onboarding, report, and Praxis component modules listed in Section 5;
- migration fixtures and provider catalog fixtures;
- licensed benchmark audio and attribution;
- packaging tests and clean-install checklist.

## 21. Explicitly postponed work

Do not add these before the trial starts:

- Praxis accounts and billing;
- managed AI gateway;
- cloud storage or sync;
- mobile application;
- Windows and macOS packages;
- full quiz generation;
- full flashcard scheduler;
- multi-step learning paths;
- multiple stable transcription engines;
- plugin marketplace;
- collaboration and sharing;
- broad theme customization.

## 22. Release checklist

### Data and reliability

- [ ] Recording recovery tested.
- [ ] Processing recovery tested.
- [ ] Config and session migrations create backups.
- [ ] Journal verification and index rebuild work.
- [ ] No journal content leaves the device except an explicitly requested AI text payload.

### AI providers

- [ ] No hardcoded selectable hosted-model IDs remain.
- [ ] Zen live catalog works.
- [ ] Go live catalog works.
- [ ] Catalog cache and refresh work.
- [ ] Removed-model state works.
- [ ] Compatibility test validates a Praxis report.
- [ ] Secrets live outside general configuration.

### Transcription

- [ ] Hardware inspection works.
- [ ] Catalog loads from the engine layer.
- [ ] Download, cancel, resume, verify, benchmark, activate, rollback, and remove work.
- [ ] Model-cache location can be changed safely.

### Coaching

- [ ] Report v3 renders in English, French, and Spanish.
- [ ] Previous goal reaches analysis.
- [ ] Previous-goal evidence seeks the video.
- [ ] One exercise and one next goal persist locally.
- [ ] Older reports still render.

### Desktop UI

- [ ] Settings uses pane navigation and search.
- [ ] Today exposes one clear action.
- [ ] Record enters focused mode.
- [ ] Report overview remains readable without opening details.
- [ ] Keyboard navigation and focus states work.
- [ ] Minimum window size remains usable.
- [ ] Reduced motion works.
- [ ] No major page uses a grid of identical cards as its primary structure.

### Linux release

- [ ] AppImage launches on clean supported systems.
- [ ] Installer verifies the artifact.
- [ ] Desktop entry and icon work.
- [ ] FUSE fallback works.
- [ ] Uninstall removes application files without deleting the journal.
- [ ] Diagnostics pass before the baseline recording.

## 23. End state

At the start of the 30-day trial, Praxis should open to a calm desktop workspace. The user sees the current goal, records without worrying about data loss, watches real processing status, reads a short evidence-backed report, receives one exercise, and returns the next day with that goal still active. Provider catalogs stay current because Praxis fetches them from connected sources. Transcription models install from Settings. All durable personal data stays in folders the user controls.
