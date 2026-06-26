# F25 — Per-vault Todos

**Status:** SHIPPED (commits `8e1fe23`, `ae5b314`, `0712ac6`, `29cabb9`,
2026-05-07)
**Scope:** Medium (inline spec — implemented directly under
`tlc-spec-driven` Medium mode at the time).

## Overview

Adds a lightweight todo list scoped to the active vault, persisted at
`<vault>/.cork/todos.json`, with full CRUD via a dedicated TodosView
plus deep command-palette and shortcut integration.

## Requirements

- **R1** Per-vault JSON store at `.cork/todos.json`. Schema:
  `{ id, title, done, createdAt, completedAt? }`. File is created on
  first write; missing file means empty list.
- **R2** New `TodosView` reachable via the side rail (icon added in
  `29cabb9`) and via the global shortcut `Cmd+Shift+T` (`0712ac6`).
- **R3** TodosView supports add / toggle / rename / delete and shows
  open todos before completed ones. Completed todos are visually
  de-emphasised and can be cleared in bulk.
- **R4** Command palette integration:
  - When the user types in Cmd+K, the open todos appear as searchable
    entries; selecting one toggles it complete and shows a toast.
  - When no result matches the query, a "Create todo" action appears
    alongside "Create note".
- **R5** A system-tray entry "Open todos" (`ae5b314`) opens the view in
  the focused window.
- **R6** The Home view shows up to N pending todos (later refined under
  F29) so todos are visible without leaving the dashboard.

## Out of scope

- Recurring todos / reminders.
- Cross-vault aggregation.
- Sync of completion state to external systems.

## Acceptance

- Switching vaults swaps the todo list to the new vault's
  `.cork/todos.json` instantly.
- Cmd+K shows open todos and lets the user complete one without
  leaving the keyboard.
- Cmd+Shift+T opens TodosView from anywhere in the app.
