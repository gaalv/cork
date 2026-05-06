# F04 — Shell Specification

**Owner phase:** M2
**Depends on:** F01 (migrated UI), F02 (vault store), F03 (index queries — Tags, Recents)
**Status:** Draft

## Problem Statement

The Layout C shell — left rail, top bar, drawer container, command palette modal, and the view router that switches between Home and Note — is currently a single migrated component carrying mock data. We need a real, composable shell with proper routing, drawer state, keyboard shortcuts, and a command palette wired to real actions.

## Goals

- [ ] One persistent rail with toggleable drawers (Search, Folders, Recent, Starred, Tags).
- [ ] Top bar showing breadcrumb, vault name, and global actions (New, ⌘K hint).
- [ ] Command palette with fuzzy search over: notes, commands, tags, recent.
- [ ] In-app router (no react-router needed for v1) with `home` and `note(id)` views.
- [ ] Keyboard shortcuts: ⌘K, ⌘N, ⌘O (open vault), Esc to close drawers/palette.
- [ ] Accessibility: focus management, aria-labels on rail buttons, palette as `role="dialog"`.

## Out of Scope

| Feature                  | Reason |
| ------------------------ | ------ |
| Drawer contents (filtering) | F07 |
| Note rendering           | F08    |
| Editor binding           | F05    |

---

## User Stories

### P1: View routing ⭐ MVP

1. WHEN the app boots THEN the system SHALL render the Home view.
2. WHEN the user clicks a note (from Home, drawer, or palette) THEN the system SHALL transition to the Note view passing `noteId`.
3. WHEN the user clicks the breadcrumb's "Home" link or presses `Esc` from a drawer-less Note view THEN the system SHALL return to Home.
4. WHEN the user presses Cmd/Ctrl+[ THEN the system SHALL navigate to the previous view; Cmd/Ctrl+] forward.
5. WHEN the user closes the app and reopens THEN the system SHALL restore the last view.

### P1: Rail + drawers ⭐ MVP

1. WHEN the user clicks a rail icon (search/folders/recent/starred/tags) THEN the system SHALL slide the corresponding drawer in 300 px from the rail.
2. WHEN a drawer is open and the user clicks the same icon OR presses `Esc` OR clicks outside THEN it SHALL close.
3. WHEN the user clicks a different rail icon while a drawer is open THEN the drawer content SHALL swap without re-animating.
4. WHEN drawer is open THEN it SHALL trap focus (Tab cycles within the drawer until closed).
5. WHEN drawer is open THEN the rail icon SHALL show an active state.

### P1: Command palette ⭐ MVP

1. WHEN the user presses Cmd/Ctrl+K THEN the system SHALL open a centered modal palette with focus on the input.
2. WHEN the input is empty THEN the palette SHALL show 5 default sections: Recents (5), Pinned (5), Commands (top 8), Tags (top 5), Vault Actions.
3. WHEN the user types THEN the system SHALL fuzzy-match across all entries (using `fuzzysort` or equivalent) and re-rank.
4. WHEN the user presses Enter on a result THEN the corresponding action SHALL run (open note, run command, switch tag filter, etc.).
5. WHEN `Esc` is pressed THEN the palette SHALL close and focus SHALL return to the previously focused element.
6. WHEN the palette is open THEN it SHALL be `role="dialog"`, with `aria-modal="true"`, and the input `aria-label="Command palette"`.

### P1: Top bar ⭐ MVP

1. WHEN on Home THEN the top bar SHALL show "Vault: <name>" + global "New Note" + ⌘K hint.
2. WHEN on a Note THEN the top bar SHALL show breadcrumb `<vault> / <folder> / <title>` + Star toggle + ⌘K hint.
3. WHEN the breadcrumb folder is clicked THEN the system SHALL open the Folders drawer scrolled to that folder.

### P1: Shortcuts ⭐ MVP

1. ⌘K → palette open.
2. ⌘N → create new note in current folder (or root).
3. ⌘O → open vault picker.
4. ⌘\\ → toggle the most recent drawer.
5. `?` (with no input focused) → show shortcut help modal.

### P2: Toast / notification surface

1. WHEN any IPC error event arrives THEN the system SHALL show a toast bottom-right with the error message.
2. WHEN multiple toasts queue THEN max 3 visible, others queued.

---

## Edge Cases

- WHEN no vault is configured THEN the shell SHALL render a centered empty state with an "Open Vault" button (no rail or drawers).
- WHEN palette has 0 results THEN it SHALL show "No matches" with a "Create note <query>" affordance (route handled later).
- WHEN focus is in the editor and the user presses ⌘K THEN palette SHALL still open and editor SHALL preserve cursor on close.

---

## Requirement Traceability

| ID       | AC                       | Phase | Status  |
| -------- | ------------------------ | ----- | ------- |
| SHELL-01 | Home as default view     | Tasks | Pending |
| SHELL-02 | Note routing             | Tasks | Pending |
| SHELL-03 | Back/forward             | Tasks | Pending |
| SHELL-04 | View persistence         | Tasks | Pending |
| SHELL-05 | Drawer open/close        | Tasks | Pending |
| SHELL-06 | Drawer swap              | Tasks | Pending |
| SHELL-07 | Drawer focus trap        | Tasks | Pending |
| SHELL-08 | Drawer rail active state | Tasks | Pending |
| SHELL-09 | Palette ⌘K open          | Tasks | Pending |
| SHELL-10 | Palette default sections | Tasks | Pending |
| SHELL-11 | Palette fuzzy            | Tasks | Pending |
| SHELL-12 | Palette enter action     | Tasks | Pending |
| SHELL-13 | Palette esc + focus restore | Tasks | Pending |
| SHELL-14 | Palette a11y             | Tasks | Pending |
| SHELL-15 | Top bar Home             | Tasks | Pending |
| SHELL-16 | Top bar Note breadcrumb  | Tasks | Pending |
| SHELL-17 | Breadcrumb folder click  | Tasks | Pending |
| SHELL-18 | ⌘N                       | Tasks | Pending |
| SHELL-19 | ⌘O                       | Tasks | Pending |
| SHELL-20 | ⌘\\                      | Tasks | Pending |
| SHELL-21 | ? help modal             | Tasks | Pending |
| SHELL-22 | Toast surface            | Tasks | Pending |
| SHELL-23 | Empty vault state        | Tasks | Pending |
| SHELL-24 | Palette no-match CTA     | Tasks | Pending |

## Success Criteria

- [ ] Lighthouse a11y score ≥ 95 on the shell.
- [ ] All shortcuts work in dev and packaged builds on macOS, Win, Linux.
- [ ] Palette opens in < 50 ms from keystroke.
