# Praxis Landing Page Design

Last updated: May 3, 2026

## Direction

Use a Hyperstudio-inspired dark studio style for the GitHub Pages landing page.

The page should feel like a focused recording lab, not a generic SaaS marketing site. It should look close enough to the Praxis desktop app that users understand they are seeing the same product world, but it can be more cinematic and expressive because it is a public landing page.

Reference style:

- Hyperstudio reference: https://styles.refero.design/style/8eb9c53e-d69c-497a-b640-610856cf3a60
- Internal app direction: `docs/UI_REDESIGN_SPEC.md`, especially the Graphite Studio principles.

## Product Positioning

Praxis is a private AI video journal for improving speaking, thinking, language fluency, and recurring communication patterns.

Primary landing-page promise:

> Record yourself. Get the transcript, the critique, the patterns, and the proof that you are improving.

Short tagline options:

- `Private video journaling for sharper speech.`
- `A desktop studio for speaking practice, transcription, and hard feedback.`
- `Record. Transcribe. Analyze. Improve.`

The tone should be direct, serious, and execution-focused. Avoid wellness-journal language, startup hype, and soft productivity cliches.

## Visual System

### Theme Name

`Signal Studio`

### Signature Gesture

A large hero composition that looks like a live operating console:

- webcam/video frame
- waveform strip
- transcript segment
- AI analysis terminal
- streak/progress signal

This should be built with HTML/CSS panels, not a static screenshot, so it remains sharp on GitHub Pages and easy to adjust.

### Palette

Use dark graphite surfaces with one warm signal accent and one success accent.

```css
:root {
  --bg: #08090a;
  --surface: #0f1012;
  --surface-raised: #151619;
  --surface-soft: #1c1d21;
  --border: #2a2c31;
  --border-strong: #3a3d44;
  --text: #f4f1e8;
  --muted: #a5a29a;
  --faint: #6f716e;
  --signal: #d6a85f;
  --signal-soft: rgba(214, 168, 95, 0.16);
  --success: #4ade80;
  --success-soft: rgba(74, 222, 128, 0.14);
  --danger: #ef4444;
}
```

Rules:

- Do not use purple as a primary accent.
- Avoid bright neon gradients.
- Use warm amber only as a signal, not as a full background.
- Keep red only for recording/live/destructive semantics.

### Typography

Use sharp, technical typography.

- Display: `Space Grotesk`, `Sora`, or `IBM Plex Sans`.
- Body: `Inter` or `IBM Plex Sans`.
- Mono: `JetBrains Mono` or `IBM Plex Mono`.

Typography rules:

- Hero headline should be large, tight, and confident.
- Labels should be uppercase, mono, small, and widely tracked.
- Body copy should be short and scannable.
- Avoid playful rounded fonts.

### Layout

Desktop layout:

- max width around `1180px`
- 12-column grid
- hero split: left copy, right operating-console mockup
- thin top nav with wordmark, section links, GitHub CTA
- sections use long horizontal panels and staggered content, not generic card grids everywhere

Mobile layout:

- single column
- console mockup stacks under hero copy
- keep buttons full width only where needed
- do not preserve desktop dense panels if readability suffers

### Borders And Surfaces

Use:

- 1px borders
- square or low-radius corners: `2px`, `4px`, max `8px`
- subtle inset highlights
- dark layered panels
- occasional hairline dividers

Avoid:

- oversized rounded cards
- glassmorphism blur
- glossy SaaS shadows
- thick cartoon borders

### Background

The background should not be flat black.

Use a restrained composition:

- graphite base
- faint radial amber glow behind the hero console
- subtle grid or scanline pattern
- low-opacity grain

The effect should be visible but quiet.

### Motion

Use small, purposeful motion:

- hero panel stagger on page load
- waveform bars idle pulse
- transcript cursor blink
- terminal line reveal
- button hover lift of 1-2px

Respect `prefers-reduced-motion`.

Avoid:

- bouncing animations
- excessive parallax
- heavy scroll libraries

## Page Structure

### 1. Navigation

Content:

- wordmark: `Praxis`
- links: `Workflow`, `Features`, `Roadmap`
- CTA: `GitHub`

Design:

- fixed or sticky top is optional
- dark translucent bar is acceptable if subtle
- use mono uppercase labels

### 2. Hero

Left side:

- eyebrow: `PRIVATE AI VIDEO JOURNAL`
- headline: `Train your speaking with evidence, not vibes.`
- paragraph: `Praxis records your sessions, transcribes them with Whisper, analyzes them with an LLM, and tracks the patterns that keep repeating.`
- CTAs:
  - primary: `View on GitHub`
  - secondary: `Read the roadmap`

Right side:

- operating-console mockup with:
  - video frame placeholder
  - live timecode
  - waveform
  - transcript segment
  - AI analysis terminal lines
  - streak mini-widget

### 3. Workflow

Four-step horizontal system:

1. `Record`
2. `Transcribe`
3. `Analyze`
4. `Track`

Each step should be a compact technical panel with one sentence.

### 4. Feature System

Feature groups:

- `Video journal`: webcam recording, review, gallery.
- `Whisper transcript`: local transcription, timestamped segments, subtitles.
- `AI critique`: grammar, clarity, reasoning, recurring patterns.
- `Progress memory`: streaks, trends, weekly rollups.
- `Local-first archive`: files saved in the journal folder.
- `Export tools`: subtitles and future phone upload.

Use asymmetric panels rather than equal generic cards.

### 5. Product Proof

Show a fake session analysis preview:

- score strip
- repeated pattern hit
- one grammar correction
- one action item
- tiny terminal log

This should make the product concrete without needing screenshots.

### 6. Roadmap

Show current status honestly:

- `Core recording pipeline`
- `Whisper transcription`
- `LLM analysis`
- `Subtitles/export`
- `Phone upload`
- `Packaging`

Use status labels:

- `built`
- `in progress`
- `next`

### 7. Final CTA

Copy:

> Praxis is for people who want their speaking practice to leave a trace.

CTA:

- `View source on GitHub`
- optional secondary: `Follow release progress`

## Copy Rules

Use direct language:

- `hard feedback`
- `timestamped transcript`
- `recurring patterns`
- `private archive`
- `local files`
- `speaking practice`

Avoid:

- `unlock your potential`
- `supercharge`
- `seamless experience`
- `AI-powered productivity`
- `beautiful dashboard`

## GitHub Pages Implementation

Recommended structure:

```text
docs/
  index.html
  styles.css
  script.js
```

Use plain HTML/CSS/JS unless there is a strong reason to add a build step. GitHub Pages should be simple and durable.

Implementation rules:

- Keep assets lightweight.
- Do not depend on backend routes.
- Do not require Vite for the landing page.
- Use semantic HTML.
- Include a skip link.
- Keep one `h1`.
- Use accessible contrast.
- Make all CTAs keyboard focusable.
- Add Open Graph and Twitter metadata.
- Include the repository URL.

## Acceptance Criteria

- The page feels like Praxis, not a generic template.
- The design clearly follows the Hyperstudio-style dark studio direction.
- It works as static GitHub Pages content.
- It looks good at desktop, tablet, and phone widths.
- It has no purple primary theme.
- It does not change the desktop app UI.
- It clearly explains record, transcript, analysis, patterns, and export.
- It is easy to update before release.
