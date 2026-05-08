# Praxis Scope

Last updated: 2026-05-08

## Product direction

Praxis should be a private desktop video coach, not a generic analytics dashboard.

Core loop:

1. Record a real session.
2. Transcribe it locally.
3. Analyze it with a configurable LLM provider.
4. Turn the result into readable lessons, not dense summaries.
5. Give the user a concrete next practice target.
6. Show whether that practice is actually improving over time.

## What the product already covers

- Desktop recording workflow with review/save
- Local Whisper transcription
- Multi-provider LLM analysis routing
- Session detail, subtitles, exports, gallery, and Stats
- Streaks, recurring patterns, weekly rollups, retention, and recovery
- First-launch onboarding and Linux AppImage packaging

## What v1 still needs to feel complete

These are the highest-value remaining product tasks.

### 1. Report quality calibration

- Calibrate prompts on real English, French, and Spanish recordings
- Make reports easier to scan and act on
- Reduce generic advice and malformed output risk
- Improve scorecard consistency across providers and models

### 2. Better coaching progression

- Track completion of practice assignments
- Compare previous goal against the next recording
- Detect whether specificity, structure, and actionability are improving
- Make recurring patterns feel coach-like instead of merely descriptive

### 3. Stats that explain improvement

- Replace vague trend language with direct signals
- Explain why a trend is good or bad
- Handle sparse data without producing noise
- Keep the page readable with clear sections and less visual clutter

### 4. Release hardening

- Fresh-machine QA
- Real-file acceptance testing
- Production-like failure and recovery checks
- Final release artifacts and install polish

## Near-term roadmap

### Phase A: Coaching quality

- Finish real-recording prompt calibration
- Improve multilingual report consistency
- Tighten fallback and retry behavior for malformed analysis
- Add stronger examples inside the prompt for readable output shape

### Phase B: Progress intelligence

- Practice completion tracking
- Previous-goal comparison
- Clearer Stats copy such as "specificity improving" and "actionability weak"
- Better pattern calibration workflows

### Phase C: Production polish

- Final onboarding pass modeled after a serious desktop app
- Better first-run model/setup guidance
- Smoother motion, transitions, and processing feedback
- Cleaner release/install experience

### Phase D: Public product surface

- Better landing page
- Cleaner release repo presentation
- Screenshots, packaging notes, install instructions, and versioned changelog discipline

## Future additions worth considering

- Optional session collections or themes
- Better language-learning drills from transcript mistakes
- Smarter weekly digests that compare multiple sessions
- Optional voice or speaking-style presets for different goals
- Optional cloud sync later, only if it does not weaken the local-first model

## Explicit non-goals for now

- Browser-first or SaaS version
- Social or sharing features
- Heavy collaboration workflows
- Large dashboard-style analytics surface
- Bundling every possible AI provider UI before report quality is stable

## Decision rule

New work should be judged by one question:

Does it make the user more likely to record again and get a clearer lesson from the next report?

If not, it is probably not a priority yet.
