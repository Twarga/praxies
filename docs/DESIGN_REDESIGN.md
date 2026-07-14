# Praxis GUI Redesign Plan

**Date:** 2026-07-13
**Status:** fresh plan — old CONTROL_ROOM_STUDIO / NATIVE_GLASS / UI_REDESIGN plans deleted.
**Source of truth for:** every visual, motion, layout, and interaction decision in the frontend remake.

---

## 0. Principles (locked)

These come from Emil Kowalski's design-engineering philosophy + Apple's fluid interface design. Every decision below answers to them.

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Earn the animation** | Never animate keyboard/high-frequency actions. Every animation answers "why?" — spatial consistency, feedback, state, or preventing jarring change. |
| 2 | **Responsive, not sluggish** | Enter = ease-out. Exit = ease-in. Custom cubic-bezier curves, never built-in CSS keywords. UI under 300ms. |
| 3 | **Scoped, not `all`** | Never `transition: all`. Animate only `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`. |
| 4 | **Physical, not mathematical** | Springs as default (damping 1.0). Popovers from trigger origin. Never `scale(0)` — start from `scale(0.95)` + opacity. Buttons scale `0.97` on `:active`. |
| 5 | **Interruptible, not rigid** | CSS transitions (not keyframes) for dynamic UI. Springs for gesture-driven motion. Keyframes only for decorative loops. |
| 6 | **GPU-only animation** | Animate `transform` + `opacity`. Never `width`/`height`/`margin`/`padding`. |
| 7 | **Accessible by default** | `prefers-reduced-motion` = cross-fades, no movement. Hover gated behind `@media (hover: hover)`. |
| 8 | **Glass only on chrome** | Title bar, sidebar, overlays get glass. Reading surfaces (transcript, report, settings) stay solid. |
| 9 | **Composition from work** | Identify the page's work pattern first, then layout follows: Monitor / Operate / Compare / Configure / Explore. |
| 10 | **Asymmetric timing** | Deliberate actions (press, hold, confirm) animate slower. System responses snap. |

---

## 1. Page Roles (composition first)

Each page is one primary work pattern. Layout follows.

| Page | Pattern | What it is |
|------|---------|------------|
| **Today** | Monitor | Status board + feed + one dominant next action |
| **Record** | Operate | Canvas + direct manipulation + minimal chrome |
| **Gallery → Sessions** | Explore | Search, filters, dense list, detail inspector |
| **SessionDetail** | Compare | Left media, right analysis. Evidence seekable in time. |
| **Practice** | Operate | Single task with timer. No navigation noise. |
| **Trends → Progress** | Monitor | Text-first findings, one chart at a time |
| **Settings** | Configure | Grouped forms, searchable, auto-save |
| **Onboarding** | Learn | One task per step, no admin-panel feel |

---

## 2. Design System Foundation (Phase 1)

### 2.1 Motion — fix the broken system

**Problems found:**
- 5 `.praxis-transition-*` classes all use `transition: all` → scoped to allowed properties only
- `prefers-reduced-motion` uses `0.01ms` hack → use `0s` with `!important`
- `praxis-pane-exit` uses `ease-out-quart` (wrong — exits should accelerate with ease-in)
- Two different fade-in animations (CSS `praxis-fade-in` at 160ms vs Tailwind `animate-fade-in` at 220ms)
- No overlay animations on Dialog, Tooltip, Popover, DropdownMenu, Select
- Progress bars animate `width` → use `transform: scaleX()`
- Zero spring animations

**Fix — tokens.css (motion):**

```css
:root {
  /* Existing durations stay */
  --praxis-duration-instant: 80ms;
  --praxis-duration-quick: 120ms;
  --praxis-duration-control: 160ms;
  --praxis-duration-pane: 200ms;
  --praxis-duration-dialog: 220ms;

  /* Replace weak built-in curves with strong custom ones */
  --praxis-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --praxis-ease-in: cubic-bezier(0.5, 0, 0.75, 0);
  --praxis-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --praxis-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  /* Spring (damping 1.0 = critically damped; response 0.35) */
  --praxis-spring-settle: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Fix — motion.css:**

```css
/* Replace transition: all with scoped properties */
:root {
  --praxis-transition-props: background-color, color, border-color, opacity, transform, box-shadow;
}
.praxis-transition-instant  { transition: var(--praxis-transition-props) var(--praxis-duration-instant) var(--praxis-ease-out); }
.praxis-transition-quick    { transition: var(--praxis-transition-props) var(--praxis-duration-quick)   var(--praxis-ease-out); }
.praxis-transition-control  { transition: var(--praxis-transition-props) var(--praxis-duration-control) var(--praxis-ease-out); }
.praxis-transition-pane     { transition: var(--praxis-transition-props) var(--praxis-duration-pane)    var(--praxis-ease-out); }
.praxis-transition-dialog   { transition: var(--praxis-transition-props) var(--praxis-duration-dialog)  var(--praxis-ease-out); }

/* Reduced motion — proper reset, not 0.01ms hack */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
}

/* Pane enter/exit — correct easings */
@keyframes praxis-pane-enter { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
@keyframes praxis-pane-exit  { to { opacity: 0; transform: translateX(-8px); } }
.praxis-pane-enter { animation: praxis-pane-enter var(--praxis-duration-pane) var(--praxis-ease-out) both; }
.praxis-pane-exit  { animation: praxis-pane-exit  var(--praxis-duration-pane) var(--praxis-ease-in)  both; }

/* Overlay animations — Dialog, Tooltip, Popover, DropdownMenu, Select */
@keyframes praxis-overlay-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes praxis-overlay-out { to   { opacity: 0; } }
@keyframes praxis-scale-in  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes praxis-scale-out  { to   { opacity: 0; transform: scale(0.95); } }
.praxis-overlay-in  { animation: praxis-overlay-in var(--praxis-duration-dialog) var(--praxis-ease-out) both; }
.praxis-overlay-out { animation: praxis-overlay-out var(--praxis-duration-quick) var(--praxis-ease-in) both; }
.praxis-scale-in    { animation: praxis-scale-in var(--praxis-duration-dialog) var(--praxis-ease-out) both; }
.praxis-scale-out   { animation: praxis-scale-out var(--praxis-duration-quick) var(--praxis-ease-in) both; }

/* Tooltip/popover — faster + origin-aware */
@keyframes praxis-pop-in  { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes praxis-pop-out { to   { opacity: 0; transform: scale(0.96); } }
.praxis-pop-in  { animation: praxis-pop-in  var(--praxis-duration-quick) var(--praxis-ease-out) both; transform-origin: var(--radix-popover-content-transform-origin, var(--radix-tooltip-content-transform-origin, center)); }
.praxis-pop-out { animation: praxis-pop-out var(--praxis-duration-instant) var(--praxis-ease-in) both; }
```

**Fix — tailwind.config.js:**

```js
// Unify fade-in to match CSS praxis-fade-in
animation: {
  "fade-in": "fade-in 160ms cubic-bezier(0.23, 1, 0.32, 1)",
},
keyframes: {
  "fade-in": {
    "0%": { opacity: "0", transform: "translateY(4px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
},
```

### 2.2 Primitives — state completeness

Every interactive primitive must handle: **default, hover, active/pressed, focus, disabled, loading**.

**Button — add `:active` feedback:**

```css
.praxis-btn:active { transform: scale(0.97); }
```

Applied to: Button.jsx, and every pressable element throughout the app.

**Progress bars — use transform, not width:**

```jsx
// Bad: transition-[width]
// Good:
<div className="h-2 rounded-full overflow-hidden bg-[var(--praxis-bg-canvas)]">
  <div className="h-full origin-left transition-transform duration-500"
       style={{ transform: `scaleX(${pct / 100})` }}>
    <div className="h-full w-full bg-[var(--praxis-accent)]" />
  </div>
</div>
```

### 2.3 Overlay animations — wire to Radix primitives

**Dialog.jsx:** Add `data-[state=open]` classes to overlay + content:
```jsx
// Overlay: praxis-overlay-in / praxis-overlay-out
// Content: praxis-scale-in / praxis-scale-out (keep transform-origin: center — modals are exempt)
```

**Tooltip.jsx / Popover.jsx / DropdownMenu.jsx:** Add `data-[state]` animations:
```jsx
// Content: praxis-pop-in / praxis-pop-out (transform-origin from Radix CSS var)
// Instant-open (subsequent tooltips): skip animation entirely
```

**Select.jsx:** Add `praxis-pop-in` / `praxis-pop-out` to the content portal.

### 2.4 Clean up duplicate `prefers-reduced-motion` rules

Remove the redundant block at the end of `globals.css` (lines 316-321). The centralized rule in `motion.css` now handles everything.

---

## 3. App Shell (Phase 2)

### 3.1 Titlebar

48px glass. Layout: Praxis mark → page context → space → status (label+color) → command palette → window controls.

Window controls: add Electron `-webkit-app-region: drag` on the titlebar, `no-drag` on interactive elements so the user can drag the window.

### 3.2 Sidebar

Collapsed 56px (icons only) / Expanded 220px (icons + labels). Persist choice.
Nav items: Today, Record, Practice, Sessions, Progress.
Bottom: processing badge + Settings.
Sidebar hidden entirely during Record.

Spring transition on expand/collapse: `--praxis-spring-settle`.

### 3.3 Page toolbar pattern

Optional 48px toolbar per page: title + filters + primary action. Never double-header.
Every non-Record page shares identical shell geometry.

### 3.4 Command palette

Glass overlay. Dense list. Keyboard shortcuts shown. Ctrl+K opens.
**Zero animation** on open/close — it's a keyboard action used hundreds of times a day.

---

## 4. Page Redesigns (Phases 3–7)

### 4.1 Record (highest payoff — Phase 3)

**Role:** Operate surface.

Idle state:
- Centered 16:9 camera stage on solid canvas
- Compact device selectors, input meter
- Goal strip: auto-fades after 8s, returns on hover/shortcut
- **Start recording** button — primary accent, prominent

Live state:
- Sidebar hidden. Titlebar reduced to: mark + elapsed timer (mono, prominent) + stop button (red)
- Transport dock at bottom: stop + level meter
- All nonessential chrome withdraws on start
- **Stop button** is the only red element visible

After stop:
- Same stage. Status chain: Saved → Transcribing → Analyzing → Ready
- "Open report" button when ready
- Right prompt panel (goal/question) — never covers camera

States: idle → device-missing → permission-denied → live → stopped → processing → ready. Each has its own layout-preserved state.

### 4.2 Session Report (Phase 4)

**Role:** Compare surface.

Layout: resizable split **58% media/transcript | 42% report** (persist widths).

Header: title, date, duration, language, local-file actions, Rename — dense toolbar, not hero.

Left pane:
- Video in recessed stage; glass transport only on hover/focus/play
- Transcript: opaque reading surface, timestamp gutter, selected passage accent-soft fill
- Full timeline strip: waveform + segment marks + evidence markers

Right pane — fixed order:
1. **Direct verdict** (2–3 sentences, largest text)
2. **What worked**
3. **Focus next** — one exercise + one measurable goal (only dominant CTA: "Practice this goal")
4. Evidence list (collapsed language nits below)

Scores: compact text + thin scales. **Delete any giant score circles.**

Processing state: same shell. Timeline of stages. No layout swap.
Error state: failed stage named, safe data listed, Retry + diagnostics.

### 4.3 Today (Phase 5)

**Role:** Monitor surface.

Layout: `max-w-6xl`, **2:1 grid** (main column + right sidebar).

Header: "Today", date, local status, **Record journal** (primary CTA).

Left (main):
- **Current goal** — largest object on the page. Goal text, success criteria, last evidence, Start practice / Record.
- **Recent loop** — 3 dense rows: title, date, duration, report state, one finding, tiny timeline.

Right (sidebar):
- Daily readiness: last session, queue, streak compact, next assignment as status list.
- Processing status (if active).

Empty state: local-data promise + **Record first session** CTA.
Processing: keep useful content + one status row. No full-page block.
No oversized prose hero or marketing copy.

### 4.4 Sessions (Phase 6)

**Role:** Explore surface.

Rename: Gallery → **Sessions** (UI labels only).

Layout: master-detail. Left ~300px list + right preview.

Left: search, language/status/sort filters (persisted). Date-grouped dense rows: title, time, duration, status badge, tiny waveform.

Right: still frame, one-sentence summary, goal outcome, **Open report**.

Narrow width (<1024px): list primary, preview becomes inspector toggle.

No card grid. No masonry layout.

### 4.5 Practice (Phase 7a)

**Role:** Operate surface.

Centered ~760px column + optional context rail.
One current drill only. Done / Hard / Repeat later.
Dense exercise card with 3-min drill timer.
Empty → "Record journal" CTA.

### 4.6 Progress (Phase 7b)

**Role:** Monitor surface.

Rename: Trends → **Progress** (UI labels only).

Text-first findings: "what the evidence says" as the first section.
One primary chart at a time + linked sessions underneath.
Period + language filters in toolbar.
Insufficient-data state: names what's missing, suggests recording more.

### 4.7 Settings (Phase 7c)

**Role:** Configure surface.

Fixed ~200px category nav (resizable) + opaque form pane.
Sections: General, Recording, Transcription, AI & Processing, Storage, Trial Feedback, System Health, Advanced.
Row pattern: label/description left, control right, separator between.
Search settings. Quiet auto-save status. No global Save button.
Health failures offer one repair action.

### 4.8 Onboarding (Phase 7d)

**Role:** Learn surface.

Focused setup window: progress rail + one task per step.
Sequence: privacy → appearance → folder → objective → whisper → direct provider setup → devices → baseline.
Inline errors with Retry. No admin card wall.

---

## 5. Hardening (Phase 8)

### 5.1 Sweep

- Remove all hardcoded hex colors — replace with CSS custom properties
- Remove leftover green accent references in tailwind.config.js
- Consolidate leftover `transition: all` usage in components
- Add `prefers-reduced-motion` coverage to any new animation
- Verify 1024px+ layouts; 768-1023 collapse rail + inspector patterns

### 5.2 Scrub all `transition: all` from components

Grep for `transition-all` / `transition: all` → replace with scoped property lists.

Components known to use it:
- Settings.jsx toggle switch (`after:transition-all` → `after:transition-transform`)
- Onboarding.jsx OptionButton (`transition-all` → `transition-colors transition-shadow`)
- SessionReviewWorkspace.jsx tab underline (missing transition entirely)

### 5.3 Verify `transformOrigin` on popovers

Check Tooltip.jsx, Popover.jsx, DropdownMenu.jsx — must use `var(--radix-popover-content-transform-origin)`/`var(--radix-tooltip-content-transform-origin)`. Modal (Dialog) stays centered.

### 5.4 A11y pass

- Focus order preserved across all pages
- Contrast: body text ≥ 4.5:1 on panel background
- Skip link still works
- Reduced motion keyboard path doesn't break

### 5.5 Run full test suite

`npm test` green. Manual QA with real media: first run, returning user, record 2+ minutes, process to report, practice flow, phone upload, provider offline.

---

## 6. Stop Rules

- **Do not** add new dependencies for aesthetics (no animation libraries unless proven necessary)
- **Do not** mix coaching-prompt work into UI remake PRs
- **Do not** create parallel "v2" component trees — edit existing files
- When stuck between pretty and dense, choose **dense + clear**
- Backend stays stable; UI consumes existing APIs/SSE

---

## 7. Execution Order

| Phase | What | Files |
|-------|------|-------|
| **1** | Fix motion system, primitives, overlay animations | `motion.css`, `globals.css`, `tailwind.config.js`, `components/ui/*` |
| **2** | App shell: titlebar spring, sidebar spring, toolbar pattern | `App.jsx`, `AppChrome.jsx`, `Sidebar.jsx`, `Toolbar.jsx` |
| **3** | Record mode redesign | `Record.jsx`, `useRecorder.js`, `lib/recording.js` |
| **4** | Session report density + timeline strip | `SessionDetail.jsx`, `SessionReviewWorkspace.jsx`, `SessionReportSections.jsx`, `CoachingVerdict.jsx`, `EvidenceMoment.jsx`, `SessionWaveform.jsx` |
| **5** | Today command desk | `Today.jsx`, `TodayWorkspace.jsx`, `CurrentGoal.jsx`, `StreakGrid.jsx` |
| **6** | Sessions master-detail | `Gallery.jsx`, `SessionBrowser.jsx` |
| **7a** | Practice | `Practice.jsx` |
| **7b** | Progress (Trends rename) | `Trends.jsx` |
| **7c** | Settings consistency | `Settings.jsx`, `ProviderConnectionsPanel.jsx`, `TranscriptionSettingsPanel.jsx`, `DiagnosticsPanel.jsx` |
| **7d** | Onboarding polish | `Onboarding.jsx` |
| **8** | Hardening: sweep, a11y, tests, QA | All files touched above |
