# F23 — Generate note from topic

**Status:** SHIPPED (commits `a77c057`, `c7dfb0f`, `d95bec1`, 2026-05-07)
**Scope:** Medium (retroactive spec).

## Overview

Adds a command-palette entry that lets the user type a topic and get a
freshly drafted note in the active vault, using the F21 `generate-note`
skill. Generation runs in the background so the editor never blocks; a
sonner toast reports progress and surfaces the created note when ready.

## Requirements

- **R1** New palette command "Generate note from topic" opens a small
  modal with a topic input and an optional folder picker (defaults to
  the currently selected folder).
- **R2** On submit, the call is dispatched to the AI runner _in the
  background_ — the modal closes immediately and a toast shows
  "Generating…".
- **R3** When the skill resolves, the runner creates the note via the
  existing `notes.create` IPC, opens it via the navigation store, and
  primes the editor buffer with the generated body. Toast updates to
  success with a "Open" action.
- **R4** Failures (timeout, CLI error) surface as an error toast with
  the underlying message; no orphan notes are created.
- **R5** When `settings.ai.provider === 'disabled'`, the modal renders a
  short explanation with a link to Settings → AI instead of an input.
- **R6** Per-skill `timeout_secs` (added in F21 follow-up) lets the
  bundled `generate-note` skill use a longer budget than the 60s
  default for verbose drafts.

## Out of scope

- Multi-turn refinement of the draft (single-shot only).
- Templated topic-to-folder routing.

## Acceptance

- Cmd+K → "Generate" → entering a topic creates a note without freezing
  the UI; the toast acts as the only blocking affordance.
- Disabling AI in Settings hides the runner and shows the disabled
  explanation in the modal.
