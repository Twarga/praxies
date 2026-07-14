# Praxis Product Register

Last updated: 2026-07-12

## What Praxis is

Praxis is a private, local-first desktop application for deliberate speaking practice. It records video journal sessions, transcribes them locally with faster-whisper, generates a short evidence-backed coaching report through a configurable AI provider, assigns one exercise, and sets one measurable goal for the next session.

## Target user

The project owner during a 30-day daily-use trial. The user records in English, French, or Spanish, wants hard feedback on speaking clarity, structure, and language quality, and needs the coaching loop to produce one useful action per session.

## Local-data promise

All durable personal content stays on the user's machine in a journal folder they control:

- Video and audio
- Transcripts and subtitles
- Coaching reports and raw AI responses
- Current and historical goals
- Exercises and completion state
- Recurring patterns and progress calculations
- Future flashcards and learning paths (after this milestone)

Only the transcript text and coaching context are sent to the AI provider the user configured. Praxis never stores, syncs, or backs up journal content to any remote service.

## Daily loop

```
Open Praxis
  → see the current practice goal
  → record a journal
  → transcribe locally
  → read a short coaching report
  → complete or schedule one exercise
  → carry one measurable goal into the next journal
```

## Brand personality

Praxis should feel like a serious desktop tool, not a lifestyle app.

- **Tone**: direct, precise, execution-focused
- **Voice**: a coach who cites evidence, not a cheerleader who offers encouragement
- **Copy rules**: use concrete language (transcript, evidence, correction, drill, goal); avoid wellness, startup, or self-help vocabulary
- **Register**: desktop-product register at all times. No marketing language inside the application. No emoji, no exclamation marks, no "welcome back" messages

## Quality references

Praxis aspires to the craft and density of these desktop applications:

| Application | What Praxis learns from it |
|---|---|
| **Linear** | Information density, navigation clarity, keyboard-first operation, restrained visual hierarchy, status clarity |
| **Screen Studio** | Recording UX polish, lightweight operational status, stage-as-primary-surface, controls that withdraw during capture |
| **Obsidian** | Local-first seriousness, plain-files-as-source-of-truth, user control over storage, no account dependency |

## Anti-references

Praxis must not resemble these patterns:

- **Notion and modern SaaS dashboards** — no airy card grids, no colorful sidebar icons, no onboarding carousels, no "getting started" checklists dressed as product UI, no oversized emoji headers
- **Warm editorial journals** — no large serif headings, no cozy prose-forward layouts, no "dear diary" framing
- **Browser CRUD admins** — no generic table-and-form layouts, no unstyled native selects in production surfaces
- **Mobile card stacks stretched to desktop** — no full-width cards at 1200px, no stacked layout that should be a split pane

## Design principles

1. **One strong layout system**. Split views for lists and detail. Toolbars for page actions. Menus for secondary actions. Cards only for independent objects.
2. **Controls stay consistent**. Same button hierarchy, same select behavior, same focus ring, same status labels across every screen.
3. **Restrained surface palette**. Cool graphite surfaces (`#0D1117` through `#202C39`), one blue-cyan accent, red reserved for recording and destructive actions, amber for attention states.
4. **Dense but breathable**. 4px spacing grid, compact labels, no oversized headings, prose at 65-75 characters per line.
5. **Separation over decoration**. Thin separators and surface contrast instead of heavy boxes, shadows, or glass effects.
6. **Status is always visible**. Recording, processing, attention, and error states use consistent color-plus-label badges. Never color alone.
7. **Motion communicates state**. 80-120ms for immediate feedback, 140-180ms for controls, 180-240ms for panes. Ease-out quart. No decorative page-load sequences. No animation that delays navigation. Recording must never drop frames for animation.
8. **Desktop navigation is stable**. Sidebar, toolbar, and workspace positions never shift between pages. Keyboard shortcuts for primary destinations. Command palette available everywhere.

## Accessibility bar for this milestone

- Keyboard operation for every primary workflow (navigate, record, review, settings)
- `prefers-reduced-motion` respected throughout (crossfade or instant transitions)
- Body text contrast of at least 4.5:1 against the background
- Visible focus rings on all interactive elements
- Hover states never convey the only path to meaning

Full WCAG 2.1 AA audit and screen-reader testing are deferred past the dogfood trial.

## What Praxis sends off-device

Only the transcript text, coaching context (goal, patterns, recent trends), and prompt instructions are sent to the AI provider the user explicitly configured. Nothing else — no video, no audio, no journal metadata, no usage analytics — leaves the machine.

## Decision rule

New work should be judged by one question:

> Does it make the user more likely to record again and get a clearer lesson from the next report?

If not, it is probably not a priority yet.
