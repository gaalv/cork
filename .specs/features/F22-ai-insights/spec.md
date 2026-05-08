# F22 — AI Insights sidebar

**Status:** SHIPPED (commit `cf589a7`, 2026-05-07)
**Scope:** Medium (retroactive spec — feature was implemented under the
F21 contextual-AI program before STATE bookkeeping caught up).

## Overview

Replaces the "Coming soon" placeholder in the right meta-panel of the
note view with three on-demand AI cards — Summary, Suggested tags, and
Related notes — each backed by an F21 skill, BLAKE3 cache, and the
existing AI runner. Removes the legacy F20 generic chat panel at the
same time.

## Requirements

- **R1** Three opt-in cards rendered in the note meta-panel, one per
  skill: `summarize`, `suggest-tags`, `related-notes`.
- **R2** Each card is collapsed by default with a "Generate" button that
  calls the AI runner; subsequent visits read from the F21 cache so
  there are zero token charges on repeat opens of the same content.
- **R3** Tag suggestions render as clickable pills that dispatch to the
  existing tags drawer / NoteMetaPanel tag input.
- **R4** Related-notes results resolve from the LLM's free-form output
  back to real vault notes (title + path) using the index store; broken
  references are dropped silently rather than rendered as text.
- **R5** All cards show a small "Cached" / "Just now" affordance and
  surface latency + token cost via the F21 telemetry table.
- **R6** Removes the F20 right-side chat drawer and its rail button. The
  low-level `ai_send_prompt` IPC stays as the subprocess primitive.

## Out of scope

- Streaming output (results arrive whole; we re-render once).
- Cross-vault context (every skill operates on the open note only).

## Acceptance

- Note view shows the three cards under "AI insights".
- Re-opening a note that already has a cached run does not spend tokens
  (verified via `ai_calls` telemetry).
- F20 chat UI no longer renders anywhere.
