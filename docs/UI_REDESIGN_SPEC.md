# Praxis UI Redesign Spec

Last updated: April 29, 2026

## Goal

Remake Praxis from a rough utility interface into a polished desktop app for private recording, review, and analysis.

This spec defines the new visual system and UX architecture to use before continuing later backlog work in `TASKS.md`.

## Product framing

Praxis is not a marketing site and not a generic web dashboard.

It should feel like:

- a focused desktop studio
- a private tool for repeated daily use
- calm, fast, and keyboard-friendly
- opinionated rather than customizable for its own sake

It should not feel like:

- a warm editorial journal
- a browser CRUD admin
- a mobile card stack stretched onto desktop

## Design direction

Theme name: `Graphite Studio`

Signature qualities:

- cool graphite surfaces
- restrained blue-cyan accent
- red reserved for live recording and destructive actions
- dense but breathable spacing
- thin separators instead of heavy boxed layouts
- strong status clarity

Primary references used for direction:

- Apple HIG desktop settings, sidebars, toolbars
- Microsoft Fluent guidance for search and field behavior
- Linear for desktop information density and navigation clarity
- Screen Studio and Descript for recording UX and lightweight operational status

## Core UX principles

1. Keep app-level preferences in Settings.
2. Keep task-level controls inside the task surface.
3. Make the record flow the visual centerpiece of the product.
4. Prefer one strong layout system across all pages.
5. Use status colors sparingly and consistently.
6. Make navigation and keyboard behavior feel native to desktop.
7. Reduce visual noise before adding more decoration.

## Information architecture

Primary app areas:

- `Today`
- `Gallery`
- `Record`
- `Settings`

Route behavior:

- `Today` is the default landing surface.
- `Record` is a focused mode, not a normal content page.
- `Gallery` owns session browsing and session detail.
- `Settings` is pane-based and searchable.

## App shell

The app shell should become a three-part desktop frame:

1. Left navigation rail
2. Top toolbar / titlebar content row
3. Main content canvas

### Left rail

Purpose:

- primary navigation
- app identity
- record entry point
- compact persistent stats

Rules:

- narrower and denser than the current rail
- stronger active state
- persistent `New Take` action
- bottom area reserved for streak, total sessions, theme toggle, and app health

### Top toolbar

Purpose:

- current page title
- page-level search when relevant
- contextual actions
- sync / processing / attention status

Rules:

- visible on `Today`, `Gallery`, and `Settings`
- reduced or replaced on `Record`
- no oversized hero framing in the toolbar itself

### Content canvas

Rules:

- use one consistent max width and gutter logic
- rely on layered panels, not disconnected cards
- prefer split views and inspectors over long vertical sheets

## Screen architecture

### Today

Role:

- command center
- latest-session overview
- current momentum and attention states

Layout:

- main column: latest session digest, next actions, processing/attention queue
- side column: streak, practice totals, language mix, quick links

Changes from current UI:

- reduce oversized prose-first hero treatment
- make latest session easier to scan
- surface actionable states before decorative copy

### Gallery

Role:

- archive and retrieval surface

Layout:

- top toolbar with search and language filter
- session list/grid in main area
- session detail as full-page content view under Gallery context

Behavior:

- search should filter sessions by title, language, and status
- filters should remain visible and lightweight

### Record

Role:

- core product moment

Layout:

- large live preview stage
- compact bottom or side control dock
- metadata / recording facts as secondary information
- review mode reuses the same stage rather than switching to a different visual language

Behavior:

- idle state should feel ready, not empty
- active recording state must make timer and stop action unmistakable
- destructive actions must be clearly separated from primary completion actions

### Settings

Role:

- stable app preferences window inside the app shell

Layout:

- left pane navigation
- optional search field at top
- content pane with grouped fields
- right-side summary or health panel when space allows

Pane structure:

- `General`
- `Recording`
- `AI`
- `Storage`
- `Advanced`

Rules:

- no single long scrolling sheet
- show helper text where a field is non-obvious
- show connectivity / runtime checks as status cards in `AI`

## Visual system

### Color palette

Dark theme base:

- `--bg-app`: `#0D1117`
- `--bg-canvas`: `#11161D`
- `--bg-panel`: `#151C25`
- `--bg-panel-2`: `#1A2430`
- `--bg-elevated`: `#202C39`
- `--line-subtle`: `rgba(148, 163, 184, 0.14)`
- `--line-strong`: `rgba(148, 163, 184, 0.28)`
- `--text-primary`: `#E8EEF5`
- `--text-secondary`: `#B5C0CC`
- `--text-muted`: `#7F8C99`
- `--accent`: `#49A6FF`
- `--accent-soft`: `rgba(73, 166, 255, 0.16)`
- `--success`: `#33C48D`
- `--warning`: `#F2B45A`
- `--danger`: `#FF6B57`

Light theme target:

- cool paper / slate, not cream
- keep the same semantic roles
- avoid bright white backgrounds

### Typography

Use current font assets unless a new font is added intentionally.

Roles:

- UI body: `Manrope`
- operational / numeric text: `JetBrains Mono`

Rules:

- remove the remaining editorial feel
- use tighter title scale than the current Today page
- make labels cleaner and more compact
- preserve tabular numerals everywhere timers and metrics appear

### Shape and spacing

Rules:

- reduce border radii slightly across the app
- prefer 14px to 18px panel radii
- reserve larger radii for modal surfaces only
- use a consistent 4pt spacing grid

### Elevation

Rules:

- use 3 surface levels max in normal screens
- rely on contrast and separators first, shadow second
- stronger depth only for modals, recorder stage, and overlays

### Motion

Rules:

- short transitions, mostly 120ms to 220ms
- animate hover, focus, pane changes, and recorder state changes
- no decorative motion loops
- respect `prefers-reduced-motion`

## Component rules

### Buttons

Button hierarchy:

- primary: solid accent
- secondary: tinted panel with strong border
- ghost: text-first, low emphasis
- danger: reserved for discard / delete

Rules:

- primary action placement must be consistent
- recording stop action must never visually blend with secondary controls

### Inputs and fields

Rules:

- always pair fields with labels
- use helper text for ambiguous settings
- validation and runtime errors appear inline near the control
- avoid placeholder-only labeling

### Search

Rules:

- add search to Settings and Gallery
- search should feel immediate and local
- include clear affordance when text exists

### Status badges

Statuses to support:

- idle
- queued
- transcribing
- analyzing
- ready
- needs attention
- failed
- recording
- paused

Rules:

- status appearance must be consistent in rail, cards, detail, and Today
- use color plus label, never color alone

## Accessibility and desktop behavior

Required:

- clear focus rings on all interactive elements
- keyboard traversal for nav, settings panes, and search
- AA contrast minimum
- preserve responsive behavior for narrower Electron windows
- avoid hover-only meaning

Desktop-specific behavior to preserve or improve:

- strong keyboard shortcuts
- visible sync / processing states
- stable navigation positions
- low-friction return from detail to gallery

## Implementation order

Apply the redesign in this order:

1. Add this spec and align remaining UI work to it.
2. Refactor global tokens in `frontend/src/styles/globals.css`.
3. Rebuild the app shell in `frontend/src/App.jsx`.
4. Rebuild `Settings` first because it currently has the weakest UX structure.
5. Rework `Today` into a dashboard surface.
6. Rebuild `Record` as the hero desktop workflow.
7. Revisit `Gallery` and session detail to match the new shell.
8. Do a full polish and consistency pass before advancing deeper into later backlog items.

## Immediate acceptance criteria

The redesign foundation is ready when:

- the global token system expresses the new theme clearly
- `Settings` no longer reads as a long utility sheet
- `Today` is scannable in under 5 seconds
- `Record` looks like the primary purpose of the app
- the app feels like one desktop product, not separate styled pages
