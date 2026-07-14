# Praxis UI Remake — Master Plan

**Date:** 2026-07-13
**Scope:** Full visual, motion, layout, and interaction remake of the Electron + React frontend.
**Backend:** No changes unless a UI gap forces a tiny API field addition.
**Source of truth:** This document. No other design doc.

---

## Implementation Status — 2026-07-14

**UI remake implementation:** Complete through Phases 1–8. The motion system, desktop shell, Record workflow, schema-v2/v3 Session Report, Today, Sessions, Practice, Progress, Settings, responsive behavior, six-theme token sweep, and accessibility safeguards are implemented in the existing component tree. Onboarding is now a compact desktop setup workspace with a persistent left progress rail and a dedicated Appearance step offering five live theme previews. The unified Praxis Loop identity is implemented as one fixed-geometry SVG that automatically inherits each theme's foreground and accent tokens; the Control Room treatment is the stable browser and packaged-desktop icon.

**Automated verification:** 35 frontend test files / 78 tests pass and 368 backend tests pass. The hardening scans find no `transition: all`, layout-property transitions, JSX hardcoded hex/RGBA colors, or named Tailwind palette colors. The Vite production build succeeds. Vite still reports its non-blocking bundle-size advisory for the 539.16 kB main chunk.

**Current dogfood improvements:** Whisper speed testing is repaired; the Record stage now has an explicit pre-record camera preview, left-side Exit control, and compact Advanced camera/microphone controls. Success and error messages appear at top center. The setup wizard supports selecting multiple simultaneous coaching tracks such as Journal Better + Practice Language. Coaching supports parallel goal tracks, treats a Praxis/product update as a valid journal topic, exposes a direct “Run fresh analysis” action on a ready session, and exports either one translated subtitle track or two burned-in subtitle lines in MP4.

**Desktop runtime validation:** Completed in an isolated Praxis home on the Linux desktop. Verified first-run and returning-user views, 1440px and 900px layouts, the forced 56px rail below 1024px, a 121-second deterministic camera/microphone recording, local transcription, readable provider-offline recovery, retry through a configured OpenAI-compatible endpoint to a schema-v3 report, the generated current goal and practice drill, a real multipart phone upload, and packaged-app startup. Four camera devices and two microphone inputs were enumerated; deterministic Chromium media was used for the long recording so no personal camera or microphone content was captured.

---

## 0. What We're Building

Praxis is a private, local-first AI video journaling desktop app. You record yourself, it transcribes locally, an LLM generates a coaching report.

The current UI works but has:
- Pydantic validation crashes (fixed — see Phase 0)
- Double-serialization bugs (fixed — see Phase 0)
- Corrupted JSON file crashes (fixed — see Phase 0)
- A half-migrated design system (tokens exist but components drift)
- Missing overlay animations
- Inconsistent layouts across pages
- Web-feeling card grids where desktop patterns belong

**Goal:** Make Praxis feel like serious, native Linux desktop software — fast, keyboard-driven, dense, glass-on-chrome-only, with 6 switchable themes.

---

## 1. Design Principles (Locked)

These come from Emil Kowalski's design-engineering philosophy + Apple HIG. Every PR must satisfy them.

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Earn the animation** | Never animate keyboard/high-frequency actions. Answer "why?" — spatial consistency, feedback, state change, or preventing jarring change. |
| 2 | **Responsive easing** | Enter = ease-out (starts fast). Exit = ease-in (accelerates away). Custom cubic-bezier curves only. Never built-in CSS keywords. |
| 3 | **Scoped transitions** | Never `transition: all`. Only `background-color`, `color`, `border-color`, `opacity`, `transform`, `box-shadow`. |
| 4 | **Physical origins** | Popovers/tooltips scale from trigger origin. Never `scale(0)` — start from `scale(0.95)`. Modals stay centered. |
| 5 | **Interruptible motion** | CSS transitions (not keyframes) for dynamic UI. Springs for gesture-driven motion. Keyframes only for decorative loops. |
| 6 | **GPU-only animation** | Animate `transform` + `opacity`. Never `width`/`height`/`margin`/`padding`. Progress bars use `scaleX()` not `width`. |
| 7 | **Accessible by default** | `prefers-reduced-motion: reduce` = 0s transitions, no movement. Hover gated behind `@media (hover: hover)`. |
| 8 | **Glass only on chrome** | Titlebar, sidebar, overlays = glass. Reading surfaces (transcript, report, settings) = solid. |
| 9 | **Composition from work** | Every page gets a primary work pattern: Monitor / Operate / Explore / Compare / Configure / Learn. Layout follows. |
| 10 | **Asymmetric timing** | Deliberate actions (press, hold, confirm) animate slower. System responses snap. |
| 11 | **Buttons feel responsive** | All pressable elements: `transform: scale(0.97)` on `:active`. 100-160ms. |
| 12 | **Status = color + label** | Never color-only status. Every indicator has a text label. |
| 13 | **Dense over decorative** | When stuck between pretty and dense, choose dense + clear. |
| 14 | **One primary CTA** | Every surface has exactly one dominant action. |

---

## 2. Design System

### 2.1 Tokens (`tokens.css`)

Already established. 53 CSS custom properties. No changes needed except adding the `--praxis-ease-*` strong curves.

```css
/* Replace weak built-in curves */
--praxis-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--praxis-ease-in: cubic-bezier(0.5, 0, 0.75, 0);
--praxis-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--praxis-spring-settle: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Transition properties allowlist */
--praxis-transition-props: background-color, color, border-color, opacity, transform, box-shadow;
```

### 2.2 Motion (`motion.css`)

Full rewrite needed. Current issues:
- 5 `.praxis-transition-*` classes all use `transition: all`
- `prefers-reduced-motion` uses `0.01ms` hack
- `praxis-pane-exit` has wrong easing (ease-out should be ease-in)
- Two different fade-in animations exist
- No overlay animation keyframes
- No spring tokens

**Final motion.css must have:**
- Scoped `var(--praxis-transition-props)` on all 5 utility classes
- `prefers-reduced-motion` with `0s !important`
- `praxis-pane-exit` using `var(--praxis-ease-in)`
- Unified `praxis-fade-in` at 160ms
- Overlay keyframes: `praxis-overlay-in/out`, `praxis-scale-in/out`, `praxis-pop-in/out`
- Record pulse, progress shimmer, streak animations (existing, keep)

### 2.3 Materials

| Layer | Token | Use |
|-------|-------|-----|
| App base | `--praxis-bg-app` | Outer window — never blurred |
| Canvas | `--praxis-bg-canvas` | Main workspace |
| Panel | `--praxis-bg-panel` | Cards, reading surfaces |
| Raised | `--praxis-bg-panel-raised` | Toolbars, hover layers |
| Elevated | `--praxis-bg-elevated` | Menus, emphasis |
| Glass chrome | `--praxis-glass-chrome` | Titlebar, sidebar — `backdrop-filter: blur(18px)` |
| Glass overlay | `--praxis-glass-overlay` | Command palette, popovers — `backdrop-filter: blur(22px)` |

Rule: glass only on chrome + overlays. Reports, transcripts, settings forms stay opaque panel.

### 2.4 Typography

| Role | Face | Size/Weight |
|------|------|-------------|
| UI | Inter | body 14/1.5, section 14-16/600, page title 20/600 |
| Labels | Inter | 11-12/500, 0.04em tracking |
| Data | JetBrains Mono | Timers, timestamps, model names, shortcuts, IDs |

Heading scale: 20px page titles, 14-16px sections, 14px body. Mono for all numeric/time data. Tabular numbers everywhere.

### 2.5 Spacing

Strict 4px grid. Page padding 24px. Toolbar padding 12px. Dense rows 36-40px. Card padding 16-20px.

### 2.6 Radii

6px controls, 8px panels, 10px modals in Control Room theme. Overridden per theme.

### 2.7 Semantic colors

| Color | Use |
|-------|-----|
| Blue accent `#4EA1FF` | Selection, focus, primary action — never decoration |
| Red `#FF4D4D` | Recording + destructive only |
| Green `#2FBF86` | Confirmed success only |
| Yellow `#E0A84A` | Attention/warning |

---

## 3. Six Themes

All themes switch via `data-theme` attribute on `<html>`. Components use `var(--praxis-*)` tokens — no component changes needed for theming. Persisted to `localStorage`.

| # | Name | Palette | Font | Radii | Shadows |
|---|------|---------|------|-------|---------|
| **0** | Control Room (default) | Dark graphite, blue accent | Inter + JetBrains Mono | 6-8px | Subtle overlay shadow |
| **1** | Warm Editorial | Cream paper, ink brown | Georgia/Charter serif | 2px | Minimal ink shadow |
| **2** | Bauhaus | Off-white, red/blue/yellow | Inter bold, uppercase | 0px | Hard 4px offset |
| **3** | Zen Garden | Washi paper, indigo | Hiragino/Inter light | 1-2px | Almost none |
| **4** | Brutalist Terminal | Black, terminal green | JetBrains Mono everywhere | 0px | None |
| **5** | Glass Observatory | Deep space, aurora green | Inter | 8-12px | Soft glow shadows |

Theme files live at `frontend/src/styles/themes/{0-5}-*.css`. Imported in `main.jsx`. Selector: `[data-theme="N"]`.

---

## 4. Page Composition Map

Every page gets one primary work pattern. Layout follows the pattern.

| Page | Pattern | Description | Layout |
|------|---------|-------------|--------|
| **Today** | Monitor | Status board + feed + dominant next action | 2:1 grid (main + sidebar) |
| **Record** | Operate | Direct manipulation canvas + minimal chrome | Full-screen stage, no sidebar |
| **Report** | Compare | Left media, right analysis, seekable evidence | 58/42 resizable split |
| **Sessions** | Explore | Search, filters, dense list, detail inspector | 300px list + preview |
| **Practice** | Operate | Single task with timer, no navigation noise | Centered ~760px column |
| **Progress** | Monitor | Text-first findings, one chart at a time | Single column + period selector |
| **Settings** | Configure | Grouped forms, searchable, auto-save | 200px nav + form pane |
| **Onboarding** | Learn | One task per step, progress rail | 680px content + 220px rail |

---

## 5. App Shell Spec

### 5.1 Titlebar (48px)

```
[Praxis mark] [page context] ············ [Status: label+dot] [⌘K shortcut] [window controls]
```

- Glass chrome: `var(--praxis-glass-chrome)`, `backdrop-filter: blur(18px)`
- `-webkit-app-region: drag` on titlebar, `no-drag` on interactive elements
- Status: color dot + label. States: Local, Processing, Needs attention, Recording, Offline
- Command palette button: `⌘K` label with keyboard shortcut kbd
- Window controls: Electron native (min/max/close) — right side

### 5.2 Sidebar

- Width: 56px collapsed / 220px expanded
- Persist choice to `localStorage`
- Glass chrome background
- Transition: `var(--praxis-spring-settle)` on expand/collapse
- Nav items (top to bottom):
  - Today `⌘1`
  - Record `⌘2`
  - Practice `⌘3`
  - Sessions `⌘4`
  - Progress `⌘5`
  - Spacer
  - Processing badge (when active)
  - Settings `⌘,`
- Active state: `var(--praxis-selected)` background + accent text
- Hidden entirely on Record route

### 5.3 Page Toolbar

Optional 48px bar between titlebar and content. Present on: Today, Sessions, Progress.
Not on: Record (minimal chrome), Report (header in content), Practice, Settings, Onboarding.

Content: page title + optional filters/actions + toolbar-spacer + primary CTA button.

Never double-header — if a page has a toolbar, the content area doesn't repeat the title.

### 5.4 Command Palette

- Glass overlay: `var(--praxis-glass-overlay)`, `backdrop-filter: blur(22px)`
- `cmdk`-based (existing `Command.jsx`)
- **Zero animation** on open/close — it's a keyboard action used 100+/day
- Dense list: command name left, shortcut right
- Searches: pages, sessions, settings sections

### 5.5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Today |
| `Ctrl+2` | Record |
| `Ctrl+3` | Practice |
| `Ctrl+4` | Sessions |
| `Ctrl+5` | Progress |
| `Ctrl+,` | Settings |
| `Ctrl+K` | Command palette |
| `Escape` | Exit Record / close modal / close command palette |

---

## 6. Page-by-Page Specs

### 6.1 Today (Monitor)

**Header:** "Today" + date (mono) + local status + **"Record journal"** (primary CTA, accent button)

**Layout:** `max-w-6xl`, `grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]`, gap 24px

**Left column (main):**
1. **Current goal card** (largest object):
   - Goal text (20px, semibold)
   - Success criteria (14px, secondary)
   - Last evidence block (left accent border, muted text, italic)
   - Two buttons: "Start practice" (primary) + "Record journal" (secondary)
2. **Recent sessions** (panel with rows):
   - 3 dense rows: thumbnail (48×27), title, duration+date (mono), one finding, status badge
   - Click opens session detail
   - Empty state: "Record your first session" CTA

**Right column (sidebar):**
1. **Readiness card:**
   - Streak badge (large number + "day streak")
   - Last session date
   - This week count
   - Next assignment
2. **Processing card** (when active): live pipeline status
3. Empty state: "All sessions ready"

**States:** loaded, empty (never recorded), processing (content visible + status row)

**Stop rule:** No card grid. No oversized hero. No marketing copy.

---

### 6.2 Record (Operate)

**Enter Record:** sidebar hides (200ms), chrome reduces to minimal bar.

**Idle state:**
- Centered 16:9 camera viewport on solid canvas
- Camera preview fills viewport
- Goal strip: top of viewport, glass overlay, auto-fades after 8s, returns on hover/Ctrl+G
- Transport dock (bottom, centered):
  - Language selector (compact)
  - Audio level meter (thin bar, green fill)
  - **Start recording** button (large, red, pulse animation)
- Right prompt panel (optional, toggleable): shows current goal + practice question

**Live state:**
- Titlebar reduces to: mark + **elapsed timer** (mono, 20px, prominent) + stop button (red)
- Transport dock:
  - Stop button (red, prominent)
  - Elapsed timer (mono, tabular-nums)
  - Level meter (live)
- All nonessential chrome withdrawn (≤160ms ease-out)

**After stop:**
- Same stage, camera preview frozen on last frame
- Status chain replaces transport: Saved → Transcribing → Analyzing → Ready
- Progress bar (scaleX, not width) under status
- "Open report" button appears when ready
- "Discard" option (ghost button, requires confirm)

**Edge cases:**
- No camera permission: inline message + "Check permissions" button
- No microphone: same pattern
- Both missing: combined message
- Recording error: "Recording failed" + Retry
- Disk full: warning before recording starts

**Performance:** recording never drops frames for animation. All recording animations gated behind `requestAnimationFrame` and paused during encode.

---

### 6.3 Session Report (Compare)

**Enter from:** Sessions click, Today recent click, or auto-open after processing.

**Toolbar (in content, not page shell):**
- Left: session title (editable), date, duration (mono), language badge
- Right: file actions (Open in folder, Copy link), Rename, More dropdown

**Layout:** Resizable split — left 58% media/transcript, right 42% report. Persist widths to localStorage.

**Left pane:**
1. **Video stage** (16:9, recessed):
   - Glass transport overlay only on hover/focus/play — withdraws after 2s idle
   - Transport: play/pause, scrub, volume, fullscreen
2. **Timeline strip** (32px, signature object):
   - Waveform bars: height mapped to audio amplitude
   - Evidence markers: vertical lines at timestamps (yellow for filler, green for strength)
   - Click seeks video + transcript
3. **Transcript** (opaque reading surface, scrolls independently):
   - Timestamp gutter (mono, right-aligned, 40px)
   - Line text (13px, primary color on active)
   - Active line: accent-soft background
   - Click line: seek video to timestamp
   - Evidence lines: accent-left-border

**Right pane (fixed order):**
1. **Direct verdict** (2-3 sentences, 16px, primary text color)
2. **Scorecard** (compact thin bars, 4 metrics):
   - Clarity, Structure, Fluency, Confidence
   - Each: label left, thin bar right (scaleX, not width)
   - No giant circles. No radial charts.
3. **What worked** (bullet list, green accent bullets)
4. **Focus next** — one exercise + one measurable goal:
   - Goal text
   - Evidence linking to transcript timestamps
   - **"Practice this goal"** (only dominant CTA, accent button, full-width)
5. **Evidence moments** (collapsible):
   - Linked transcript segments with timestamps
   - Language nits section (collapsed by default)

**Processing state:** Same shell. Timeline of pipeline stages + log drawer. No layout swap.

**Error state:** Failed stage named, safe data listed. "Retry" + "Open diagnostics" buttons.

**Stop rule:** Verdict + Focus next visible without scrolling on 1080p at default split. Primary CTA singular and obvious. No raw AI dump in default view.

---

### 6.4 Sessions (Explore)

**Rename:** "Gallery" → "Sessions" in all UI labels. Route/filename `Gallery.jsx` can stay.

**Layout:** Master-detail. Left 300px list, right preview pane. Resizable divider (6px).

**Left — Session list:**
- Search bar (top): filters by title
- Filter chips: All | Ready | Processing | Failed — persist selection
- Date-grouped list:
  - Group header: "This week", "Last week", "July 2026", etc. (mono, uppercase, 10px)
  - Session row (dense, 40px):
    - Thumbnail (40×22, rounded 3px)
    - Title (13px, primary, truncated)
    - Duration + date + language (10px, mono, muted)
    - Status badge (right-aligned)
  - Active row: accent-soft background, left accent border
- Keyboard: ↑↓ to navigate, Enter to open, / to focus search

**Right — Preview pane:**
- Selected session still frame (16:9, fills top)
- One-sentence summary
- Goal outcome
- **"Open report"** button
- Empty state: "Select a session to preview" (centered, muted, italic)

**Narrow width (<1024px):** List full-width, preview becomes toggleable inspector overlay.

**No card grid. No masonry.**

---

### 6.5 Practice (Operate)

**Layout:** Centered max-w-[760px] column + optional 250px context rail on right.

**Content:**
1. **Current exercise card:**
   - Exercise title (18px, semibold)
   - Instructions (14px, secondary)
   - Goal context (linked from session report)
2. **Drill timer** (3 min default):
   - Large mono countdown (48px, center)
   - Start / Pause / Reset buttons
   - Progress bar (scaleX, thin)
3. **Completion actions:**
   - "Done" (success) — marks complete
   - "Too hard" (warning) — flags for coach
   - "Repeat later" (muted) — keeps in queue

**Right rail:**
- Goal summary
- Last evidence
- Related sessions (links)

**Empty state:** "No active practice. Record a session to get personalized drills." + "Record journal" CTA.

---

### 6.6 Progress (Monitor)

**Rename:** "Trends" → "Progress" in all UI labels. Route/filename can stay.

**Layout:** Single column, max-w-4xl.

**Toolbar:** Period selector (7d / 30d / 90d / All) + language filter.

**Content order:**
1. **Text-first findings** (largest section):
   - "What the evidence says" — 2-4 prose sentences summarizing trend
   - Generated from weekly rollups
2. **Primary chart** — one at a time:
   - Fluency over time (line chart)
   - Toggle to: filler words, speaking rate, structure scores
3. **Linked sessions** below chart:
   - Clickable rows for sessions in selected period
4. **Dimension grid** (collapsible):
   - 2×2 grid of Clarity / Structure / Fluency / Confidence trends
   - Each: small sparkline + delta
5. **Recurring patterns** (collapsible):
   - Pattern name, frequency, last occurrence

**Insufficient data:** "Not enough data yet. Record 3+ sessions to see trends." + session count progress.

**Stop rule:** No multi-chart dashboard. Text-first. One primary chart at a time.

---

### 6.7 Settings (Configure)

**Layout:** Fixed 200px category nav (resizable) + scrollable form pane.

**Nav categories:**
- General
- Recording
- Transcription
- AI & Processing
- Storage
- Trial Feedback
- System Health
- Advanced

Search field filters nav items. Keyboard: ↑↓ to navigate categories.

**Row pattern (consistent across all sections):**
- Label left, control right, thin separator between rows
- Description under label (muted, 12px)
- Auto-save on change — quiet status indicator (saved ✓ / saving ... / error ⚠)
- No global Save button

**General section contains:**
- Language selector
- Personal context textarea
- Ready sound toggle
- **Theme picker** (2-column grid of 6 theme cards)

**Every section follows the same Row pattern.**

---

### 6.8 Onboarding (Learn)

**Layout:** Focused desktop setup workspace. Persistent 256px progress rail on the left, compact progress header, one centered task surface, and a fixed action footer. At narrow widths the rail collapses so the task remains usable.

**Sequence:**
1. Privacy promise
2. Appearance — choose one of five app designs with live previews
3. Journal folder selection
4. Personal objective
5. Local transcription model
6. AI provider selection
7. Device/runtime check
8. Baseline recording

**Per-step pattern:**
- Header: "Step 3 of 8" + task title + compact progress line
- One task per step — never multi-field forms
- Inline errors with Retry button
- Sticky footer: Back + Continue/Skip
- Step transition: 180ms crossfade + 8px vertical movement

**Progress rail:** Step numbers with labels. Completed = checkmark. Current = accent. Future = muted.

**Stop rule:** No admin card wall. No multi-column forms. One task per screen.

---

## 7. Animation Rules (Emil + Apple)

### 7.1 Easing Table

| Context | Easing | Duration |
|---------|--------|----------|
| Button press feedback | `ease-out` | 100-160ms |
| Tooltips, small popovers | `ease-out` | 120-200ms |
| Dropdowns, selects | `ease-out` | 150-250ms |
| Modals, dialogs | `ease-out` (enter), `ease-in` (exit) | 200-220ms |
| Pane enter (settings nav, sidebar) | `ease-out` | 200ms |
| Pane exit | `ease-in` | 200ms |
| Overlay (command palette) | **None** — keyboard action | 0ms |
| Progress bar fill | `ease-out` | 500ms |
| Sidebar expand/collapse | `--praxis-spring-settle` | spring |
| Record button pulse | `ease-in-out` | 1.6s infinite |
| Shimmer/skeleton | `ease-in-out` | 1.6-2s infinite |

### 7.2 Performance

- Animate only `transform` + `opacity` on GPU
- Progress bars: `transform: scaleX()` not `width`
- Glass surfaces: hint `will-change: backdrop-filter` or `transform: translateZ(0)`
- Framer Motion `x`/`y` props → use full `transform` string for hardware acceleration
- Prefer CSS transitions over JS animation for predetermined motion
- WAAPI for programmatic CSS animation

### 7.3 Interruptibility

- Toasts, toggles, rapidly-triggered UI: CSS transitions (not keyframes)
- Gesture-driven motion: springs with velocity handoff
- Drag interactions: `setPointerCapture` + momentum projection
- Keyframes only for: decorative loops (pulse, shimmer, streak)

### 7.4 Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
}
```

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover { /* hover animation */ }
}
```

### 7.5 Component Rules

- **All pressable elements:** `:active { transform: scale(0.97) }`
- **Popovers/tooltips:** `transform-origin: var(--radix-popover-content-transform-origin)`
- **Modals:** `transform-origin: center` (modals are exempt from trigger-origin rule)
- **Never `scale(0)`:** start from `scale(0.95)` + `opacity: 0`
- **Never `transition: all`:** use the scoped property allowlist
- **Never `ease-in` on enter:** enter = ease-out, exit = ease-in

---

## 8. Component Inventory

### 8.1 UI Primitives (components/ui/) — All Need Updates

| Component | Changes Needed |
|-----------|---------------|
| `Button.jsx` | Add `:active scale(0.97)`. Ensure primary/secondary/ghost/danger/record variants. |
| `Dialog.jsx` | Add `data-[state=open]` overlay + content animations. Overlay: fade. Content: scale(0.96)→1 + fade. Modal stays centered. |
| `Tooltip.jsx` | Add `data-[state]` animations. `transform-origin` from Radix CSS var. Instant-open for subsequent tooltips (skip delay + skip animation). |
| `Popover.jsx` | Same as Tooltip — origin from Radix var. 120ms in, 80ms out. |
| `DropdownMenu.jsx` | Same pattern. Origin from trigger. |
| `Select.jsx` | Add `praxis-pop-in/out` to content portal. 150ms. |
| `Command.jsx` | **Zero animation.** No open/close transition. Keyboard action. |
| `Tabs.jsx` | Tab underline: transition on `border-bottom` change, not just text color. |
| `Switch.jsx` | Thumb: `transition-transform` only, not `transition-all`. |
| `Progress.jsx` | `transform: scaleX()` not `width`. |
| `ScrollArea.jsx` | Keep as-is. |
| `Collapsible.jsx` | Keep Radix default. |
| `AlertDialog.jsx` | Same animation pattern as Dialog. |
| `Separator.jsx` | Keep as-is. |
| `Toaster.jsx` | Sonner-based. Already handles enter/exit. Verify easing matches system. |

### 8.2 Praxis Feature Components (components/praxis/) — Some Need Updates

| Component | Changes Needed |
|-----------|---------------|
| `TodayWorkspace.jsx` | Restructure to 2:1 grid. Goal card first, recent list, readiness sidebar. |
| `CurrentGoal.jsx` | Prominent. One CTA. Evidence block. |
| `SessionBrowser.jsx` | Master-detail list + preview. Dense rows, date groups, filters. |
| `SessionReviewWorkspace.jsx` | 58/42 split. Timeline strip. Reorder report sections. |
| `SessionReportSections.jsx` | Delete giant score circles. Thin bars only. Verdict → What worked → Focus next → Evidence. |
| `SessionWaveform.jsx` | Timeline strip component. Clickable, marker support. |
| `EvidenceMoment.jsx` | Link to transcript timestamp. Accent border. |
| `CoachingVerdict.jsx` | 2-3 sentences. 16px. Top of report. |
| `ProcessingTimeline.jsx` | Same shell as report. Pipeline stages with log. |
| `ProviderConnectionsPanel.jsx` | Keep. Already getting Pydantic validation fixes. |
| `TranscriptionSettingsPanel.jsx` | Keep. |
| `DiagnosticsPanel.jsx` | Keep. |
| `DogfoodSummary.jsx` | Keep. |
| `StreakGrid.jsx` | Keep. Use on Today readiness + Progress. |
| `AppChrome.jsx` | Add `-webkit-app-region: drag`. Window controls. |
| `Sidebar.jsx` | Spring transition. Collapse persist. Remove streak tiles (move to Today). Processing badge at bottom. |
| `Toolbar.jsx` | Standardize: height 48px, title left, actions right. Use on Today/Sessions/Progress. |
| `LiveUpdateEffects.jsx` | Keep. SSE-based. |

### 8.3 New Components Needed

| Component | Purpose |
|-----------|---------|
| `ThemePicker.jsx` | 2×3 grid of theme cards. Used in Settings → General. |
| `ScoreBar.jsx` | Thin horizontal bar for scorecard metrics. Uses scaleX. |
| `TimelineStrip.jsx` | Waveform + markers. Signature object. Three sizes: full, medium, tiny. |
| `EvidenceMarker.jsx` | Vertical line on timeline. Clickable, color-coded. |
| `ReadinessCard.jsx` | Today sidebar. Streak + stats. |

---

## 9. File Map — Everything We Touch

### Phase 1: Foundation (motion system + primitives)

```
frontend/src/styles/motion.css          — full rewrite
frontend/src/styles/globals.css         — remove duplicate reduced-motion block
frontend/tailwind.config.js             — unify fade-in to 160ms, update easing
frontend/src/components/ui/Button.jsx   — add :active scale
frontend/src/components/ui/Dialog.jsx   — overlay + content animations
frontend/src/components/ui/Tooltip.jsx  — animation + origin
frontend/src/components/ui/Popover.jsx  — animation + origin
frontend/src/components/ui/DropdownMenu.jsx — animation + origin
frontend/src/components/ui/Select.jsx   — content portal animation
frontend/src/components/ui/Progress.jsx — scaleX not width
frontend/src/components/ui/Tabs.jsx     — tab underline transition
frontend/src/components/ui/Switch.jsx   — transition-transform only
```

### Phase 2: App shell

```
frontend/src/App.jsx                    — stable shell, chrome="minimal" for Record
frontend/src/components/AppChrome.jsx   — drag region, window controls, status
frontend/src/components/Sidebar.jsx     — spring transition, remove streak tiles, processing badge
frontend/src/components/praxis/Toolbar.jsx — standardize
frontend/src/lib/rail.js                — collapse persistence
frontend/src/lib/routes.js              — update labels (Gallery→Sessions, Trends→Progress)
```

### Phase 3: Record (highest payoff)

```
frontend/src/pages/Record.jsx           — full redesign
frontend/src/hooks/useRecorder.js       — verify chunked recording still works
frontend/src/lib/recording.js           — shortcuts, goal strip auto-fade
frontend/src/lib/recordShortcuts.js     — keyboard start/stop
```

### Phase 4: Session Report

```
frontend/src/pages/SessionDetail.jsx              — layout, toolbar
frontend/src/components/praxis/SessionReviewWorkspace.jsx — 58/42 split, timeline strip
frontend/src/components/praxis/SessionReportSections.jsx  — reorder, delete circles
frontend/src/components/praxis/CoachingVerdict.jsx        — keep, verify position
frontend/src/components/praxis/EvidenceMoment.jsx          — timestamp linking
frontend/src/components/praxis/SessionWaveform.jsx         — timeline strip data
frontend/src/components/praxis/ProcessingTimeline.jsx      — verify no layout swap
frontend/src/components/praxis/ScoreBar.jsx                — NEW
frontend/src/components/praxis/TimelineStrip.jsx           — NEW
```

### Phase 5: Today

```
frontend/src/pages/Today.jsx                           — 2:1 grid
frontend/src/components/praxis/TodayWorkspace.jsx      — restructure
frontend/src/components/praxis/CurrentGoal.jsx          — prominent, one CTA
frontend/src/components/praxis/StreakGrid.jsx           — today readiness
frontend/src/components/praxis/ReadinessCard.jsx        — NEW
frontend/src/lib/today.js                               — data loading
```

### Phase 6: Sessions

```
frontend/src/pages/Gallery.jsx                         — rename UI to Sessions
frontend/src/components/praxis/SessionBrowser.jsx      — master-detail, dense rows, filters
frontend/src/lib/gallery.js                            — filter persistence
```

### Phase 7: Secondary pages

```
frontend/src/pages/Practice.jsx                        — centered column, drill timer
frontend/src/pages/Trends.jsx                          — rename to Progress, text-first
frontend/src/pages/Settings.jsx                        — theme picker, row pattern consistency
frontend/src/components/praxis/ProviderConnectionsPanel.jsx
frontend/src/components/praxis/TranscriptionSettingsPanel.jsx
frontend/src/components/praxis/DiagnosticsPanel.jsx
frontend/src/pages/Onboarding.jsx                      — one task per step, progress rail
```

### Phase 8: Hardening

```
All files above                                     — sweep hardcoded colors, verify 1024px+
frontend/src/styles/themes/*.css                     — verify all 6 themes work
frontend/src/contexts/ThemeContext.jsx               — already done
frontend/src/hooks/useTheme.js                       — already done
```

---

## 10. Execution Phases

### Phase 0 — Done ✅

Bugs fixed:
- Catalog pricing validation (`catalog.py`)
- Double-serialization (`client.js`)
- 11 JSON read guards (sessions, config, patterns, coaching, rollups, catalog)
- Provider API request models (`providers.py`)
- 365 tests pass, 5 pre-existing failures (external HTTP)

Theme system built:
- 6 theme CSS files
- ThemeContext updated
- Theme picker in Settings

### Phase 1 — Motion System + Primitives

**Goal:** Every primitive handles all states. Motion system is correct.

**Work:**
1. Rewrite `motion.css` — scoped transitions, proper reduced-motion, ease curves, overlay keyframes
2. Remove duplicate reduced-motion from `globals.css`
3. Unify Tailwind fade-in with CSS fade-in (160ms, same curve)
4. Add `:active scale(0.97)` to Button
5. Add `data-[state]` animations to Dialog, Tooltip, Popover, DropdownMenu, Select
6. Fix Progress to use `scaleX`
7. Fix Tabs underline to transition
8. Fix Switch to `transition-transform` only

**Files:** 12 files in `styles/` + `components/ui/`

**Exit criteria:**
- [ ] No `transition: all` in motion.css
- [ ] `prefers-reduced-motion` uses `0s` not `0.01ms`
- [ ] `pane-exit` uses ease-in
- [ ] Only one fade-in animation (160ms, uniform)
- [ ] All overlays have enter/exit animations
- [ ] npm build passes

### Phase 2 — App Shell

**Goal:** First glance reads as desktop software.

**Work:**
1. Titlebar: drag region + window controls
2. Sidebar: spring expand/collapse, remove streak tiles, processing badge at bottom
3. Toolbar standardization
4. Stabilize app shell in App.jsx — Record gets `chrome="minimal"`

**Files:** 6 files

**Exit criteria:**
- [ ] Every non-Record page shares identical shell geometry
- [ ] Sidebar collapse persists across relaunch
- [ ] Status never color-only (always has label)
- [ ] Ctrl+1-5, Ctrl+K, Ctrl+, work
- [ ] Shell doesn't jump switching pages

### Phase 3 — Record

**Goal:** Capture feels like a studio.

**Work:**
1. Idle → Live → Processing → Ready flow
2. Minimal chrome during recording
3. Glass transport dock
4. Goal strip auto-fade
5. Status chain after stop

**Files:** 4 files

**Exit criteria:**
- [ ] Idle stage feels ready, not empty
- [ ] Live state makes timer + stop unmistakable
- [ ] Crash/chunk recovery still works
- [ ] Keyboard start/stop works
- [ ] No sidebar visible during capture

### Phase 4 — Session Report

**Goal:** One lesson, one next action, evidence seekable.

**Work:**
1. 58/42 resizable split
2. Timeline strip with waveform + markers
3. Transcript with timestamp gutter + active line
4. Report reorder: verdict → scorecard → what worked → focus next → evidence
5. Delete giant score circles — thin bars only
6. Glass video transport, hover-only
7. Processing state: same shell, no layout swap

**Files:** 10 files (2 new components)

**Exit criteria:**
- [ ] Verdict + focus next visible without scrolling on 1080p
- [ ] Evidence click seeks video + transcript
- [ ] Primary CTA is singular and obvious
- [ ] Processing/error don't invent a second visual language

### Phase 5 — Today

**Goal:** Next useful action obvious in ≤5 seconds.

**Work:**
1. 2:1 grid layout
2. Current goal as largest object
3. Recent sessions list (3 dense rows)
4. Readiness sidebar (streak + stats)
5. Empty state: "Record first session"
6. Processing: keep content + one status row

**Files:** 6 files (1 new component)

**Exit criteria:**
- [ ] First paint answers "what do I do next?"
- [ ] No multi-card dashboard
- [ ] Recent rows open correct session
- [ ] Recovery banners secondary

### Phase 6 — Sessions

**Goal:** Find and resume past work like a desktop archive.

**Work:**
1. Rename Gallery → Sessions (UI labels)
2. Master-detail: 300px list + preview
3. Search + filter chips (persisted)
4. Date-grouped dense rows
5. Preview pane with still + summary + "Open report"
6. Narrow width: inspector toggle

**Files:** 3 files

**Exit criteria:**
- [ ] List + detail default at ≥1024px
- [ ] Filters persist
- [ ] Keyboard: list focus, Enter to open
- [ ] No card grid

### Phase 7 — Practice, Progress, Settings, Onboarding

**Goal:** All secondary surfaces match shell language.

**Practice:** Centered column, drill timer, Done/Hard/Repeat. One file.
**Progress:** Text-first findings, one chart, linked sessions. One file.
**Settings:** Row pattern consistency, theme picker already done. One file.
**Onboarding:** Eight-step desktop setup flow with one task per step, a left progress rail, inline errors, and a five-design Appearance chooser. One file.

**Files:** 4 files

**Exit criteria:**
- [ ] All four use same type, radius, row height, button hierarchy
- [ ] Settings searchable
- [ ] Onboarding completes to usable Today

### Phase 8 — Hardening

**Goal:** Ship-quality polish.

**Work:**
1. Sweep hardcoded hex colors — replace with `var(--praxis-*)`
2. Grep for `transition-all`, `transition: all` — replace with scoped
3. Verify 1024px+ layouts; 768-1023 collapse rail + inspector
4. A11y: focus order, contrast, reduced motion, keyboard
5. Run full test suite
6. Manual QA: first run, returning user, record 2+ min, process to report, practice, phone upload, provider offline

**Files:** All files touched above

---

## 11. Stop Rules

- **Do not** add new dependencies for aesthetics. No animation libraries. No new npm packages.
- **Do not** mix coaching-prompt or backend work into UI PRs.
- **Do not** create parallel "v2" component trees. Edit existing files.
- **When stuck between pretty and dense, choose dense + clear.**
- **Backend stays stable.** UI consumes existing APIs/SSE.
- **Do not commit, push, or create branches unless explicitly asked.**
- **Verify files compile before claiming them complete.**

---

## 12. Quality Gates

Every PR must pass:

```text
[x] Uses CSS custom properties only — no hardcoded hex
[x] Shell geometry unchanged unless this phase owns shell
[x] Status = color + label
[x] No card-grid primary layout
[x] Keyboard path still works for affected routes
[x] Loading/empty/error preserve layout
[x] prefers-reduced-motion respected for new motion
[x] Button :active has scale(0.97)
[x] No transition: all anywhere
[x] No ease-in on enter animations
[x] npm build passes
```

---

## 13. Theme System (Already Done)

6 themes switchable from Settings → General. Default: **0 (Control Room Studio)**.

Files: `frontend/src/styles/themes/{0-5}-*.css`
Context: `frontend/src/contexts/ThemeContext.jsx`
Picker: In `frontend/src/pages/Settings.jsx` General tab
Import: `frontend/src/main.jsx` imports all 6 theme CSS files

---

## 14. Test Plan

### 14.1 Current State

**Stack:** Vitest 4 + @testing-library/react 16 + @testing-library/jest-dom 6 + jsdom
**Config:** `vite.config.js` → `test.environment: "jsdom"`, `test.globals: true`, `setupFiles: "./src/test/setup.js"`
**Files:** 35 test files, 76 tests

**Current status:** All 35 frontend test files pass (76 tests). Coverage now includes motion and token contracts, six-theme contrast, shell and responsive rail behavior, keyboard navigation, Record lifecycle and shortcuts, schema-v2/v3 reports, provider activation and offline recovery, phone-upload settings, onboarding rendering, Practice, Sessions, Settings, Today, and supporting primitives.

### 14.2 Test Repair (Phase 0 — completed)

The `React.act is not a function` error was repaired before the remake work proceeded.

Root cause: `@testing-library/react` v16 uses `React.act` from `react-dom/test-utils` but the installed React 19 + react-dom pairing may have the wrong build flavor (production vs development).

Fix options (try in order):
1. Add `import { act } from "react-dom/test-utils"; globalThis.IS_REACT_ACT_ENVIRONMENT = true;` to `src/test/setup.js`
2. Pin `@testing-library/react` to `^16.3.2` and `react-dom` to match React 19 exactly
3. Install `react-dom` with the test-utils export by ensuring it's the development build

After repair and per-phase expansion: all 35 frontend test files pass (76 tests). The backend suite also passes all 366 tests.

### 14.3 Per-Phase Tests

Each phase adds tests before/alongside implementation. Tests are the acceptance criteria — code isn't done until its tests pass.

#### Phase 1 — Motion System + Primitives

| Test file | What it verifies |
|-----------|-----------------|
| `src/styles/motion.test.js` (NEW) | `motion.css` has zero `transition: all` occurrences. `prefers-reduced-motion` uses `0s` not `0.01ms`. All 5 easing tokens exist in `:root`. Overlay keyframes `praxis-overlay-in`, `praxis-overlay-out`, `praxis-scale-in`, `praxis-scale-out`, `praxis-pop-in`, `praxis-pop-out` exist. Only one `fade-in` keyframe (160ms, same curve across Tailwind + CSS). |
| `src/components/ui/primitives.test.jsx` (FIX) | Button renders with `scale(0.97)` on `:active` via CSS class. Dialog overlay renders with `data-[state=open]` animation class. Tooltip, Popover, DropdownMenu each use `transform-origin: var(--radix-*-content-transform-origin)`. Select content portal has animation class. Progress bar uses `transform` not `width`. Switch uses `transition-transform` not `transition-all`. Tabs underline transitions. |

#### Phase 2 — App Shell

| Test file | What it verifies |
|-----------|-----------------|
| `src/App.test.jsx` (UPDATE) | All 6 `data-theme` values render without crash. Shell renders full chrome for non-Record pages. Shell renders `chrome="minimal"` for Record. Status badge always has text label + color dot. |
| `src/components/Sidebar.test.jsx` (NEW) | Collapsed state = 56px width. Expanded state = 220px width. Collapse persists in localStorage. Spring transition class present. Processing badge shows when sessions are queued. Streak tiles are absent (moved to Today). |
| `src/components/AppChrome.test.jsx` (NEW) | Titlebar has `-webkit-app-region: drag`. Interactive elements have `no-drag`. Status renders `Local | Processing | Recording | Offline` with label+dots. |

#### Phase 3 — Record

| Test file | What it verifies |
|-----------|-----------------|
| `src/pages/Record.test.jsx` (NEW) | Idle: camera viewport 16:9 renders. Goal strip present with text. Transport dock has start button (red, with pulse). Language selector present. |
| `src/pages/Record.test.jsx` (cont) | Live: elapsed timer renders (mono, tabular-nums). Stop button is red and prominent. Level meter renders. Titlebar minimizes (sidebar absent, chrome reduced). |
| `src/pages/Record.test.jsx` (cont) | After stop: status chain "Saved → Transcribing → Analyzing → Ready" appears. "Open report" button renders when ready. "Discard" button present with confirm dialog. |
| `src/pages/Record.test.jsx` (cont) | Edge cases: No camera permission → inline message + "Check permissions". No mic → same. Disk full → warning. Recording error → "Retry" button. |

#### Phase 4 — Session Report

| Test file | What it verifies |
|-----------|-----------------|
| `src/pages/SessionDetail.test.jsx` (UPDATE) | 58/42 split renders (left pane ~58%, right ~42%). Resizable divider present (6px). Verdict section is above "Focus next" section. Score uses thin bars (`ScoreBar` component) — no `<circle>` elements, no radial charts, no giant numbers. |
| `src/components/praxis/TimelineStrip.test.jsx` (NEW) | Waveform bars render with varying heights. Evidence markers render at correct position from timestamp. Clicking marker calls seek callback. Three sizes: full (32px), medium (28px), tiny (20px). |
| `src/components/praxis/ScoreBar.test.jsx` (NEW) | Renders a `div` with `transform: scaleX()` style — no `width` property. Label text renders left of bar. Value 0 → scaleX(0). Value 1 → scaleX(1). |
| `src/components/praxis/CoachingVerdict.test.jsx` (NEW) | Renders 2-3 sentences of text. Positioned at top of report (DOM order verified). |
| `src/components/praxis/EvidenceMoment.test.jsx` (UPDATE) | Click calls seek on video with correct timestamp. Renders with accent left border. |
| `src/components/praxis/ProcessingTimeline.test.jsx` (NEW) | Processing state uses same shell as report (no layout swap). Pipeline stages rendered. Log drawer toggleable. |

#### Phase 5 — Today

| Test file | What it verifies |
|-----------|-----------------|
| `src/pages/Today.test.jsx` (UPDATE) | 2:1 grid renders (left column ~2x wider than right). Goal card is the first major element in DOM order. "Record journal" CTA is present and prominent. |
| `src/components/praxis/CurrentGoal.test.jsx` (NEW) | Goal text renders at 20px semibold. Success criteria renders below goal. Evidence block has accent left border. Two buttons: "Start practice" (primary) + "Record journal" (secondary). Single dominant CTA enforced. |
| `src/components/praxis/ReadinessCard.test.jsx` (NEW) | Streak badge renders with number + label. Last session date renders. This week count renders. Next assignment renders. |
| `src/pages/Today.test.jsx` (cont) | Recent sessions list: 3 dense rows max. Each row: title, duration (mono), date, finding snippet, status badge. Click opens correct session. Empty state: "Record your first session" CTA. Processing state: content visible + one status row. |

#### Phase 6 — Sessions

| Test file | What it verifies |
|-----------|-----------------|
| `src/pages/Gallery.test.jsx` (UPDATE) | UI labels use "Sessions" not "Gallery". Master-detail layout: 300px list + preview pane. Search filters list by title. Filter chips: All, Ready, Processing. Date-grouped list with group headers. |
| `src/pages/Gallery.test.jsx` (cont) | Clicking a row selects it. Selected row has accent-soft background + left accent border. Preview pane: still frame, summary, "Open report" button. Keyboard: ↑↓ navigates, Enter opens, `/` focuses search. No card grid present. |
| `src/components/praxis/SessionBrowser.test.jsx` (UPDATE) | Filter state persists across remount. Narrow width (<1024px) shows list full-width, preview as toggle. |

#### Phase 7 — Practice, Progress, Settings, Onboarding

| Test file | What it verifies |
|-----------|-----------------|
| `src/pages/Practice.test.jsx` (NEW) | Centered column (max-w-[760px]). Exercise card renders title + instructions. Drill timer renders (mono, large). Start/Pause/Reset buttons work. Done/Hard/Repeat actions exist. Empty state: "Record a session" CTA. |
| `src/pages/Trends.test.jsx` (NEW) | UI labels use "Progress" not "Trends". Text-first findings section renders first. One primary chart at a time. Period selector (7d/30d/90d/All). Linked sessions below chart. Insufficient data state: "Record 3+ sessions" message. No multi-chart grid. |
| `src/pages/Settings.test.jsx` (NEW) | Theme picker renders 6 theme cards (2×3 grid). Clicking a theme card switches `data-theme` attribute on `<html>`. Theme persists in localStorage. Row pattern consistent across all sections (label left, control right, separator between). Auto-save status indicator visible. |
| `src/pages/Onboarding.test.jsx` (UPDATE) | 8 steps. Per-step: header "Step N of 8", one task, fixed footer, inline errors. Left progress rail: completed checkmarks, current accent, future muted. Appearance step renders exactly five selectable live theme previews and applies the chosen theme immediately. |

#### Phase 8 — Hardening

| Test file | What it verifies |
|-----------|-----------------|
| `src/styles/tokens.test.js` (NEW) | All 6 theme CSS files loaded. No hex color values outside of theme files (grep for `#[0-9a-fA-F]{3,6}` in `.jsx`/`.js` — should be zero). Every theme's `--praxis-*` variables resolve to computed values on the `<html>` element. |
| `src/a11y.test.jsx` (NEW) | Every page renders with skip-link present. Body text contrast ≥ 4.5:1 on panel bg (computed style check). Focus rings present on all interactive elements. `prefers-reduced-motion` honored (0s transitions when emulated). |
| `src/lib/reportLayout.test.js` (KEEP) | Focus next above evidence — already passes. |
| `src/lib/nav.test.js` (KEEP) | Labels, shortcuts, typing guard — already passes. |
| `src/lib/statusLabels.test.js` (KEEP) | Pipeline + shell status labels — already passes. |

### 14.4 Test File Summary

| Phase | New Files | Updated/Fixed | Total Tests (estimated) |
|-------|-----------|---------------|------------------------|
| **0 — Test Repair** | 0 | 1 (setup.js) | 26 (all pass) |
| **1 — Motion** | 1 (`motion.test.js`) | 1 (`primitives.test.jsx`) | ~20 |
| **2 — Shell** | 2 (`Sidebar.test.jsx`, `AppChrome.test.jsx`) | 1 (`App.test.jsx`) | ~15 |
| **3 — Record** | 1 (`Record.test.jsx`) | 0 | ~15 |
| **4 — Report** | 4 (`TimelineStrip`, `ScoreBar`, `CoachingVerdict`, `ProcessingTimeline`) | 2 (`SessionDetail`, `EvidenceMoment`) | ~25 |
| **5 — Today** | 2 (`CurrentGoal`, `ReadinessCard`) | 1 (`Today.test.jsx`) | ~20 |
| **6 — Sessions** | 0 | 2 (`Gallery`, `SessionBrowser`) | ~15 |
| **7 — Secondary** | 3 (`Practice`, `Trends`, `Settings`) | 1 (`Onboarding`) | ~25 |
| **8 — Hardening** | 2 (`tokens.test.js`, `a11y.test.jsx`) | 0 | ~10 |
| **Total** | **15 new** | **9 updated** | **~145 tests** |

### 14.5 What Is NOT Tested (by design)

- **Backend API integration** — 50 pytest files in `backend/tests/` already cover this. Frontend uses mocked `apiFetchJson` for unit tests.
- **MediaRecorder browser APIs** — Cannot mock `MediaRecorder` in jsdom. `useRecorder.test.jsx` stays as-is (tests chunking logic, not browser APIs).
- **Electron IPC** — `chooseDirectory`, `openDesktopPath` are mocked. Native IPC tests would require Electron test runner (out of scope).
- **Visual regression** — No screenshot comparison tooling. Add Playwright visual snapshots later.
- **Performance benchmarks** — No Lighthouse/Web Vitals in CI. Add later.
- **Real Whisper/LiteLLM integration** — Backend covers this.

### 14.6 Quality Gate — Per-Phase Exit Criteria

Before marking any phase complete:

```text
[ ] All tests in this phase pass (Vitest)
[ ] All tests from PREVIOUS phases still pass (no regressions)
[ ] npm build passes with zero errors
[ ] No hardcoded hex colors in JSX/JS outside theme files
[ ] No `transition: all` in any CSS
[ ] No `ease-in` on enter animations
[ ] Every interactive element has focus-visible ring
[ ] Status text always accompanies status color
[ ] New UI renders correctly in at least 2 themes (0 + 1 other)
```
