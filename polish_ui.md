# Praxis — UI / UX Polish

Audit date: 2026-04-25.
Scope: polish on existing Phase 0–5 surface only. **No new features**, no Phase 6+ scope.
Companion to `need_fixing.md` (which covers correctness bugs). This file covers feel.

Order roughly by impact-per-minute. Top of the list is what makes the app feel alive; bottom is design-token cleanup.

---

## P0 — silent app, hidden work (highest impact)

### 1. Live status polling on `_index.json`

- **Symptom:** when a session is `queued`, `transcribing`, or `analyzing`, the only way to see it advance is to press F5. The frontend fetches `_index.json` once on mount and never again. Today's digest card and Gallery cards all go stale.
- **Why this is #1:** Whisper takes 1–3 minutes per recording. Without polling, the user sits on a "transcribing…" card and reasonably concludes the app is broken.
- **Fix (no SSE yet — that's Phase 8):**
  - In `frontend/src/hooks/useIndex.js`, add a `useEffect` that starts a 3-second `setInterval` whenever `index.sessions` contains any session with status in `{queued, transcribing, analyzing}`.
  - Stop the interval as soon as no session is in those states (or on unmount).
  - Re-fetch `/api/index` on each tick. Replace state via the existing `setIndex`.
- **Acceptance:** start a recording → save full → Today and Gallery cards update from `queued → transcribing → analyzing → ready` without a refresh.

### 2. Global toast / snackbar for transient feedback

- **Symptom:** every async action has a different ad-hoc surface.
  - Settings autosave: silent.
  - PersonalContextEditor: silent on success, inline red on error only.
  - OpenRouter test: appears as plain mono text below the connection row, no color, no icon.
  - PATCH config: the global "saving changes…" line at the top is small and easy to miss.
  - Recording finalize: no "saved" confirmation.
  - Mark-as-read: silent.
- **Fix:**
  - Add `frontend/src/components/Toast.jsx` (or inline in App.jsx for now). Single context provider exposing `pushToast({ kind, message })`.
  - 4 kinds: `success` (green), `info` (gray), `warning` (amber), `error` (red).
  - Auto-dismiss after 3s. Top-right placement. `aria-live="polite"` region.
  - Stack vertically if multiple, max 3 visible.
- **Migration order:**
  1. OpenRouter test — replace `setTestStatus("connected · …")` with toast.
  2. Personal context autosave success.
  3. Settings PATCH success.
  4. Session finalize success ("session saved · processing started").
  5. Mark-as-read confirmation.
- **Acceptance:** clicking "test" on OpenRouter shows a green toast that auto-dismisses; failure shows a red one with the actual error.

### 3. Personal context autosave indicator

- **Symptom:** `PersonalContextEditor` (`frontend/src/App.jsx:1097-1143`) saves silently 1 second after you stop typing. There is no "saved" pulse, no timestamp, no visual cue at all. User can't tell if their edits stuck.
- **Fix:**
  - Add three states: `idle` (no pending changes), `saving` (debounce timer running or save in flight), `saved` (just persisted).
  - Show a tiny mono indicator next to the textarea: `idle` → blank, `saving` → `saving…`, `saved` → `saved · just now` (fade after 2s back to blank).
  - On `saveError`, keep the existing red `.settings-error` line.
- **Acceptance:** type in the textarea → indicator says `saving…` → after 1s says `saved · just now` → fades.

---

## P1 — visible roughness

### 4. Settings → AI connection status needs a color dot

- **Symptom:** the "connection" row (`App.jsx:1299-1304`) shows the string `"configured"` or `"not set"`. Both render in the same mono text. No status differentiation at a glance.
- **Fix:**
  - Add a small colored dot before the value: green = configured AND last test succeeded, amber = configured but not yet tested (or last test failed), gray = not set.
  - Track last test result in component state (`testStatus` already exists at `App.jsx:1157`). Persist `testOk` boolean across renders.
- **Acceptance:** a fresh paste of an API key shows amber. Click "test" → green if it works, red if it doesn't.

### 5. OpenRouter test button needs spinner state

- **Symptom:** clicking "test" sets `testStatus` to `"testing openrouter…"` (`App.jsx:1174`) but the button itself doesn't disable or show a spinner. Users can re-click and trigger duplicate requests.
- **Fix:**
  - Add `isTesting` state. Disable the button while pending. Replace the button label with `testing…`.
  - Pair with #2 (toast) for the result, so the inline note can disappear entirely.
- **Acceptance:** click test → button shows `testing…`, disabled. On result, button re-enables and toast appears.

### 6. Discard countdown is invisible

- **Symptom:** in the recording review state, clicking "discard" enters a 5-second auto-cancel window (`App.jsx:1616-1628`). The user sees no countdown — the confirm button just disappears after 5s with no indication.
- **Fix:**
  - In `ReviewState`, while `showDiscardConfirm` is true, render a tiny `cancel in 4s` next to the confirm/cancel buttons. Decrement every second.
- **Acceptance:** click discard → see `confirm? · cancel in 5s · 4s · 3s · 2s · 1s` → if user does nothing, confirm bar closes silently.

### 7. Keyboard shortcuts are invisible

- **Symptom:** the recording flow supports `Space` (pause/resume), `S` (stop), `Enter` (save full), `D` (discard), `Esc` (back). None of these are documented in the UI. Power users will never find them.
- **Fix:**
  - Add a tiny shortcut hint strip:
    - In recording state: `[space] pause   [s] stop   [esc] back`
    - In review state: `[enter] save   [d] discard   [esc] back`
  - Mono, muted color, below the controls. Don't show on touch devices (use `(pointer: fine)` media query).
- **Acceptance:** during recording, see the hint strip below the controls. Press space — pauses. Press s — stops.

### 8. Today attention banner can't be dismissed

- **Symptom:** the new banner I added (`App.jsx:215-238`) shows a permanent message until the next session lands. There's no way to hide it after you've seen it once.
- **Fix:**
  - Add a small `×` close button on the banner.
  - When clicked, store the dismissed session id in `localStorage` (key: `praxis.today_dismissed_session_id`).
  - Don't show the banner if `latestSession.id === dismissedId`.
  - Reset when a newer session lands.
- **Acceptance:** banner shows on a `needs_attention` session → click `×` → banner hides → reload page → still hidden until a newer session comes in.

---

## P2 — gallery and detail polish

### 9. Gallery thumbnails flash black before loading

- **Symptom:** `GalleryThumbnail` (`App.jsx:308-328`) renders a black frame until the image loads. Looks broken on slow disks or first paint.
- **Fix:**
  - Replace the black `gallery-session-thumb-placeholder` with a CSS skeleton-pulse: subtle bronze-tinted gradient that animates left-to-right while loading.
  - Use the `loading` state of the `<img>` (not just `onError`).
- **Acceptance:** open Gallery on a session with no thumbnail → see pulsing placeholder, not a black square.

### 10. Gallery status dots are all the same color

- **Symptom:** `gallery-session-status-dot` uses a single color for every status. A `failed` session looks identical to a `ready` one.
- **Fix in CSS:** add modifier classes:
  - `.is-ready` → muted gray
  - `.is-needs-attention` → amber `#d8a682`
  - `.is-failed` → red `#a85050`
  - `.is-active` (transcribing/analyzing/queued) → blue with pulse animation
- **Frontend:** in `getGallerySessionStatus`, return both label and kind. Apply the matching class.
- **Acceptance:** scan the gallery → at a glance, you can see which sessions are ready vs. failed vs. still processing.

### 11. Active processing has no visible indicator on cards

- **Symptom:** a session in `transcribing` looks identical to one in `ready` from the gallery grid. Only the small status text at the bottom changes.
- **Fix:** add a 1-pixel left border on the card in the bronze-blue accent color while the session is in `{queued, transcribing, analyzing}`. Subtle pulse animation.
- **Acceptance:** start a recording → in gallery, the active card has a visible accent stripe until processing completes.

### 12. Session Detail "raw" tab is empty for healthy sessions

- **Symptom:** the tab shell (`transcript / analysis / raw`) renders all three tabs even when `analysis_raw_text` is null. Clicking "raw" on a healthy session shows nothing.
- **Fix:** hide the raw tab unless `latestSessionDetail.analysis_raw_text` exists. Or render it as disabled with a tooltip: `"only available for failed analyses"`.
- **Acceptance:** healthy session → only 2 tabs visible. Failed session → 3 tabs.

### 13. Session Detail back link doesn't track source

- **Symptom:** the back link always says "back to gallery" even if you arrived via the Today banner deep link. Mild lie.
- **Fix:**
  - Pass a `from` parameter when navigating to detail. `App.jsx:1839` and `App.jsx:1844-1845` both call `createSessionRoute(sessionId)` — extend to `createSessionRoute(sessionId, fromPage)`.
  - In `SessionDetailPage`, use `route.from` to label the back link: `← back to today` vs `← back to gallery`.
- **Acceptance:** click banner from Today → detail page → back link says `← back to today`.

### 14. Session Detail tabs need keyboard nav

- **Symptom:** three-tab shell (`App.jsx:T067`), no keyboard support. Mouse only.
- **Fix:** add ArrowLeft / ArrowRight key handlers when focus is on the tab list. Wrap around. Use `role="tablist"` / `role="tab"` / `aria-selected`.
- **Acceptance:** focus a tab → press right arrow → next tab activates.

---

## P3 — visual / token consistency

### 15. Error styles are duplicated

- **Symptom:** at least three nearly-identical error treatments exist:
  - `.settings-error` (`globals.css:829`)
  - `.record-review-error` (used inline in `App.jsx`)
  - `.analysis-inline-note` (used in `AnalysisPanel`)
- **Fix:** consolidate into a single `.app-error` class. Migrate each call site one at a time. Delete the duplicates.

### 16. Note / inline-note styles are duplicated

- **Symptom:** four near-identical muted-mono styles:
  - `.settings-note`
  - `.settings-inline-note`
  - `.digest-card-inline-note`
  - `.record-review-meta`
- **Fix:** keep `.settings-note` as the canonical (`globals.css:821`). Migrate the others.

### 17. Buttons have inconsistent padding / radius

- **Symptom:** `.settings-action`, `.gallery-filter-button`, `.record-secondary-button`, `.record-stop-button`, `.digest-card-open`, `.today-attention-banner-action` — six button styles with slightly different paddings, font sizes, and border radii. Looks designed-by-committee.
- **Fix:**
  - Define CSS custom properties for button tokens at `:root`:
    ```css
    --btn-padding: 6px 12px;
    --btn-radius: 3px;
    --btn-font-size: 12px;
    --btn-line-height: 1;
    ```
  - Migrate each button class to use them. Variants only differ by color/background, not size/shape.
- **Don't:** rip out all the class names. Just normalize the values inside.

### 18. Page titles are inconsistently styled

- **Check:** `.page-title` is used on Today (sometimes), Gallery, Settings. But Today actually uses `.date-line` + `.status-line` instead of a title. Recording page uses `.record-shell-meta` ("new session"). Pick one pattern.

---

## P4 — accessibility quick wins

### 19. `aria-live` regions are missing

- Currently 1 in the whole app (`record-preview-placeholder` at `App.jsx:1511`).
- **Fix:** when toast (#2) lands, mark the region `aria-live="polite"`. Mark the recording timer with `aria-live="off"` and `aria-label="Elapsed time, {mm}:{ss}"` updated via `aria-valuenow` or refreshed text — but only on second changes, not every render.

### 20. Recording rail button doesn't reflect live state

- **Check:** `LeftRail` (`App.jsx:124-188`) calls `getRailRecordSlotState(index)`. Verify that during recording the button label switches (e.g., `transcribing…`) and that `aria-disabled` matches the `disabled` prop. Touch this carefully — the rail logic in `frontend/src/lib/rail.js` was modified recently.

### 21. Focus traps on Settings save

- **Symptom:** in `InlineSelectRow` / `InlineTextRow` / the new `InlineSelectOrTextRow`, after clicking save, focus jumps to nowhere (or back to the start of the page). Should return focus to the row's "change" button or move forward to the next row.
- **Fix:** use a `useRef` on the trigger button. After `await onSave(...)` resolves, call `triggerRef.current?.focus()`.

---

## What NOT to polish right now

- **App.jsx split** — `HANDOFF.md` explicitly forbids this until Phase 6.
- **Click-timestamp-to-jump in transcript** — that's a feature, not polish.
- **Right-click delete in gallery** — feature.
- **Streak/total redesign on Today** — engagement design, not polish; needs intentional product thinking.
- **New tabs / new pages** — out of scope.
- **Animations beyond pulse/fade** — every gratuitous transition is friction.

---

## Recommended polish order (90-minute pass)

1. #1 (index polling) — 20 min. **Biggest feel-of-app upgrade.**
2. #2 (toast component) + migrate the two highest-impact callers (#3 personal context, #5 OpenRouter test) — 35 min.
3. #4 (connection dot color) — 5 min.
4. #6 (discard countdown) — 10 min.
5. #7 (keyboard shortcut hints) — 10 min.
6. #8 (banner dismiss) — 5 min.
7. #10 (gallery status dots colored) — 5 min.

Stop there. Re-record real sessions, feel where the next friction is, and polish that. **Don't polish what isn't biting you yet.**

The remaining items (#9, #11–#21) are real improvements but lower-leverage. Sweep them in the same pass that does Phase 6's larger UI work, when you'll be in those files anyway.

---

## Acceptance for the whole pass

After the 90-minute polish session, a fresh user should be able to:

1. Record a 2-minute session and see status advance from `queued → transcribing → analyzing → ready` **without refreshing**.
2. Edit personal context and see a `saved · just now` indicator within 2 seconds.
3. Click "test" on OpenRouter and see a clear green/red toast.
4. Glance at Gallery and tell which sessions are ready, processing, or broken — by color, not text.
5. See a `[space] pause` hint while recording.
6. Dismiss the Today attention banner once they've acted on it.

If any of those is still rough, the polish wasn't done.
