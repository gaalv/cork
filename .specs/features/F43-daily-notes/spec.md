# F43 — Daily Notes

**Status:** IN PROGRESS · **Size:** Medium (spec only, design inline)

## Problem

Daily notes were removed with F10 but remain a core notes-app habit. Settings plumbing (`dailyPathPattern`, `dailyTemplatePath` in `VaultSettings`) already exists, dormant. AD-052 locked the flat format: `Daily/YYYY-MM-DD.md`, no nested date folders.

## Requirements

- **DAY-01** — New service `src/services/dailyNote.ts` exposing `openDailyNote()`: resolves today's path from `dailyPathPattern` (default `Daily/YYYY-MM-DD.md`; per AD-052 constrain any custom pattern to a single top-level folder + flat filename), creates the note if missing, then opens it via `useShellStore.openNote`.
- **DAY-02** — If the note doesn't exist and `dailyTemplatePath` points to an existing template, create it through the F39 template renderer (`notes.createFromTemplate`, honoring `{{cursor}}`); otherwise create a plain note with `# YYYY-MM-DD` body via the existing create-note IPC. Creation must reuse existing IPC — no new Rust commands.
- **DAY-03** — Palette entry "Open today's note" (hint "Daily") always visible; keyboard shortcut ⌘⇧T registered where existing shell shortcuts live (verify no collision — ⌘⇧I quick capture, ⌘⇧M, ⌘⇧L, ⌘⇧C are taken).
- **DAY-04** — Repeated invocation on the same day opens the existing note (idempotent, no duplicates, no overwrite).

## Constraints

- Files: `src/services/dailyNote.ts` (new), `src/components/modals/CommandPalette.tsx` (one entry), shortcut wiring file (find where ⌘N / shell shortcuts are registered), optionally `src-tauri/src/menu.rs` + `menuActions.ts` entry (only if trivial).
- Date from local time, zero-padded.

## Verify

`pnpm typecheck && pnpm lint`. Manual: ⌘⇧T creates+opens `Daily/2026-07-24.md`; second press just opens it.
