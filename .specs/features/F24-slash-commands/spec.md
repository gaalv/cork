# F24 — AI slash commands

**Status:** SHIPPED (commit `e6a4b3e`, 2026-05-07)
**Scope:** Medium (retroactive spec).

## Overview

Extends the CodeMirror slash menu with four AI-powered editor actions
backed by F21 skills, so the user can transform the current selection
(or paragraph) inline without leaving the editor.

## Requirements

- **R1** Four new slash entries:
  - `/ai-summarize` → `summarize` skill
  - `/ai-rephrase` → `slash-rephrase` skill
  - `/ai-expand` → `slash-expand` skill
  - `/ai-continue` → `slash-continue` skill (uses the last ~500 chars
    before the caret as the prefix variable)
- **R2** Apply behavior strips the literal `/ai-…` text, captures the
  current selection (or the active line when nothing is selected),
  pushes a "AI working…" toast, and runs the skill via the F21 runner.
- **R3** On success, replace the captured selection with the result for
  summarize/rephrase/expand, or insert at the caret for continue. A
  success toast announces completion; the editor buffer remains dirty
  so the user can undo the transformation.
- **R4** On failure or timeout the original text is preserved and an
  error toast is shown with the underlying CLI message.
- **R5** When AI is disabled in Settings, the slash items remain in the
  menu but only emit a "AI provider is disabled" toast on activation.

## Out of scope

- True streaming insertion (the buffered CLI output is replaced as a
  single edit — see Out of scope in plan.md for the rationale).
- Per-vault skill overrides (handled by F21 user-skills directory).

## Acceptance

- Typing `/ai-` inside the editor surfaces the four entries.
- Each command produces a single, undoable edit replacing the selection
  or extending from the caret.
- Disabling AI suppresses runs but does not crash the slash menu.
