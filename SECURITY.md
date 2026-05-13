# Security Policy

Praxis is a local-first desktop application. Videos, transcripts, analyses,
and metadata live in the user's journal folder. It can, however, make outbound
network calls to the LLM provider the user configures (OpenRouter, an
OpenAI-compatible endpoint, a LiteLLM proxy, and similar).

Because of that, security reports are welcome and handled seriously.

## Supported versions

Only the most recently released version is supported with security fixes.
Praxis is pre-1.0 and ships from `main` as Linux AppImages.

| Version      | Supported |
| ------------ | --------- |
| latest `0.x` | Yes       |
| older `0.x`  | No        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.**

Instead, report privately through one of:

- GitHub's private advisory flow:
  https://github.com/Twarga/praxies/security/advisories/new
- A private message to the maintainer via the contact listed on the GitHub
  profile at https://github.com/Twarga

When you report, please include:

- A clear description of the issue.
- The impact you believe it has (data exposure, code execution, etc.).
- Steps to reproduce, ideally with a minimal example.
- The version or commit you tested against.
- Your preferred attribution if a fix is released (optional).

You can expect:

- An initial acknowledgement within a few days.
- A triage decision (accept, defer, decline) within two weeks.
- Coordinated disclosure once a fix is available; please do not publish
  details before a fix has been released or a reasonable time has passed.

## Scope

In scope:

- The Praxis backend (`backend/app/`) and its API surface.
- The Electron main and preload processes (`frontend/electron/`).
- The React renderer (`frontend/src/`) where it handles user data, keys, or
  network calls.
- Packaging and install scripts (`scripts/`, `frontend/electron-builder.yml`).
- The landing page (`landing/`) for injection or XSS issues.

Out of scope:

- Vulnerabilities in third-party LLM providers themselves.
- Weaknesses inherent to running user-supplied models locally.
- Social engineering, physical access, or local-device compromise.

## Hardening notes

Praxis stores user-configured API keys in the local config directory printed
by the installer. Anyone with access to that directory has access to those
keys. Do not share your journal folder or config folder.

Thank you for helping keep users safe.
