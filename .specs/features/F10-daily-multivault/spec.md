# F10 — Daily Notes & Multi-Vault Specification

**Owner phase:** M4 (Daily) + M5 (Multi-vault)
**Depends on:** F02, F03, F04
**Status:** Draft

## Problem Statement

Two often-requested features tied together because both touch vault-level concepts:

1. **Daily notes** — a single command/shortcut creates today's daily note from a template, opens it, and ensures duplicates are not created. Heavily used by devs for journaling.
2. **Multi-vault** — manage multiple vaults across the OS; switch between them quickly without restarting; each preserves its own index.

## Goals

### Daily

- [x] ⌘D shortcut creates/opens today's daily note.
- [x] Path pattern configurable (default: `Daily/YYYY/MM/YYYY-MM-DD.md`).
- [x] Template stored in `<vault>/.noxe/templates/daily.md`.
- [x] Template variables: `{{date}}`, `{{time}}`, `{{weekday}}`, `{{vault}}`.
- [x] If today's daily exists → just open it.

### Multi-vault

- [x] Persist a list of recent vaults (max 10) in app config.
- [x] Vault switcher in TopBar: dropdown of recent + "Open another vault…".
- [x] Switching vaults stops the current watcher + closes the index DB and starts the new ones.
- [x] Each vault has its own SQLite at `<app_data>/vaults/<vault_hash>/index.sqlite` (already true from F03).

## Out of Scope

| Feature                  | Reason     |
| ------------------------ | ---------- |
| Multiple vaults open simultaneously | v2 (per PROJECT.md) |
| Vault sync / encryption  | v2         |
| Weekly/monthly notes     | v2         |

---

## User Stories

### P1 (Daily): Create today's daily ⭐ MVP

1. WHEN user presses ⌘D OR runs "Open today's daily" from palette THEN system SHALL compute the daily path for today, ensure parent folders exist, and:
   - if file does not exist → create it from the template, substituting variables;
   - if it exists → open as-is.
2. WHEN no template file exists in the vault THEN system SHALL use a built-in default (`# {{date}}\n\n## Today\n\n- `).

### P1 (Daily): Path pattern + template ⭐ MVP

1. WHEN settings store has `dailyPathPattern` THEN system SHALL use it for the path.
2. WHEN template references unknown variable THEN system SHALL leave it literal.

### P2 (Daily): Quick-open palette command

1. WHEN user types "daily" in palette THEN command "Open today's daily note" SHALL appear at the top.

### P1 (Multi-vault): Switcher ⭐ MVP

1. WHEN user clicks vault name in TopBar THEN dropdown SHALL list up to 10 recent vaults + "Open another vault…".
2. WHEN user picks one THEN system SHALL: pause editor auto-save → flush → call `vault.open(path)` → reset stores → resume.
3. WHEN vault open fails THEN show toast and remain on the previous vault.

### P1 (Multi-vault): Recent vaults persistence ⭐ MVP

1. WHEN user opens a vault THEN it SHALL be moved/added to the front of the recent list.
2. WHEN list exceeds 8 THEN drop the least-recent.

### P2 (Multi-vault): Per-vault settings

1. WHEN switching vaults THEN per-vault prefs (e.g., daily template, view state) SHALL come from the new vault's `<vault>/.noxe/config.json`.

---

## Edge Cases

- Daily across midnight / DST: use OS local time at the moment of trigger.
- Deleted vault folder: detect on switch, mark as missing, prompt to remove from list.
- Two vaults with same folder name in different parents: list shows last 2 path segments to disambiguate.

## Requirement Traceability

| ID       | AC                          | Status  |
| -------- | --------------------------- | ------- |
| DAILY-01 | ⌘D creates/opens today      | Verified |
| DAILY-02 | Default template fallback   | Verified |
| DAILY-03 | Path pattern configurable   | Verified |
| DAILY-04 | Variables substitution      | Verified |
| DAILY-05 | Palette command             | Verified |
| MV-01    | Recent vaults list          | Verified |
| MV-02    | TopBar switcher             | Verified |
| MV-03    | Switch flow (flush, reset)  | Verified |
| MV-04    | Recent persistence          | Verified |
| MV-05    | Missing-vault detection     | Verified |
| MV-06    | Per-vault settings file     | Verified |

## Success Criteria

- [ ] Daily creation idempotent: pressing ⌘D twice opens the same file (no duplicates).
- [ ] Vault switch completes in < 1 s (1 k notes).
- [ ] No data loss on switch (chaos test: switch while typing).
