# F13 — Settings Panel + In-Note Search + App Menu Specification

**Owner phase:** M5
**Depends on:** F02, F04, F05, F09, F10, F11
**Status:** Complete

## Problem Statement

Several settings (auto-rewrite links, attachments folder, daily path, theme stub, offline mode, current vault path) are written to stores but never exposed to the user. Additionally, the editor lacks in-note find/replace (basic table-stakes) and the app has no native menu / window-state persistence. This feature closes those UX gaps.

## Goals

- [x] Native-feeling Settings panel reachable via ⌘, (and palette).
- [x] In-note Find / Find-and-Replace via ⌘F / ⌘⇧F using `@codemirror/search`.
- [x] Native OS menubar (macOS top bar; Windows/Linux app menu) with primary commands.
- [x] Persisted window state (size, position, fullscreen) via `tauri-plugin-window-state`.
- [x] About dialog (version, repo, license, vault path).
- [x] Keyboard shortcut customization (read-only listing in v1; rebinding deferred).

## Out of Scope

| Feature                         | Reason  |
| ------------------------------- | ------- |
| Custom themes / dark mode toggle | v1.x — captured as v2 in PROJECT.md but a stub setting OK |
| User-editable shortcut bindings | v2      |
| Plugin system                    | v2      |

---

## User Stories

### P1: Settings panel ⭐ MVP

1. WHEN user presses ⌘, OR triggers "Open Settings" from palette THEN system SHALL open Settings as a modal/panel with sections: General, Editor, Files & Vaults, Markdown, Daily Notes, Advanced.
2. WHEN user changes a setting THEN it SHALL persist via `tauri-plugin-store` and apply immediately (no restart).
3. WHEN setting is per-vault THEN UI SHALL show a "Per-vault" badge and write to `<vault>/.cork/config.json`.
4. WHEN setting is global THEN write to app store.

#### Settings inventory (v1)
| Section        | Key                                | Type    | Scope   |
| -------------- | ---------------------------------- | ------- | ------- |
| General        | `appearance.density`               | enum    | global  |
| General        | `appearance.theme`                 | enum (light only in v1) | global |
| Editor         | `editor.autoSaveDebounceMs`        | number  | global  |
| Editor         | `editor.previewDefault`            | bool    | global  |
| Files & Vaults | `vault.attachmentsFolder`          | string  | per-vault |
| Files & Vaults | `vault.recentLimit`                | number  | global  |
| Markdown       | `wikilinks.autoRewriteOnRename`    | bool    | per-vault |
| Markdown       | `markdown.callouts`                | bool    | global  |
| Markdown       | `markdown.footnotes`               | bool    | global  |
| Daily Notes    | `daily.pathPattern`                | string  | per-vault |
| Daily Notes    | `daily.templatePath`               | string  | per-vault |
| Advanced       | `index.rebuild`                    | action  | per-vault |
| Advanced       | `assets.offlineMode`               | bool    | global  |

### P1: In-note Find ⭐ MVP

1. WHEN user presses ⌘F in the editor THEN CodeMirror's search panel SHALL open at the bottom of the editor.
2. WHEN user types THEN matches highlight; Enter / Shift+Enter cycle.
3. WHEN user presses Esc THEN panel closes; cursor returns.

### P1: In-note Replace ⭐ MVP

1. WHEN user presses ⌘⇧F THEN search panel opens with replace input.
2. WHEN replace-all clicked THEN buffer updates; auto-save triggers.

### P1: Native app menu ⭐ MVP

1. WHEN app boots THEN system SHALL register an OS menu with:
   - **Cork / File** — New Note (⌘N), Open Vault… (⌘O), Recent Vaults (submenu), Close (⌘W on macOS only).
   - **Edit** — Undo/Redo, Cut/Copy/Paste, Find (⌘F), Replace (⌘⇧F), Select All.
   - **View** — Toggle Preview (⌘.), Command Palette (⌘K), Toggle Drawer (⌘\\).
   - **Notes** — Today's Daily (⌘D), Star (⌘S), Pin.
   - **Window** — Minimize, Zoom (mac).
   - **Help** — Shortcuts, About, GitHub repo.
2. WHEN menu item activates THEN it SHALL dispatch the same action as the in-app shortcut.
3. WHEN OS is macOS THEN menu lives in system menubar; Win/Linux SHALL show in-app menu under the title bar.

### P1: Window state persistence ⭐ MVP

1. WHEN app closes THEN window size/position/fullscreen state SHALL persist (`tauri-plugin-window-state`).
2. WHEN app re-opens THEN it SHALL restore prior state. If saved state is off-screen, snap to primary display.

### P1: About dialog

1. WHEN user picks Help → About THEN modal SHALL show name, version, repo URL, license, current vault path, app data path.
2. WHEN clicking "Copy diagnostics" THEN system SHALL copy a JSON blob (versions, OS, paths) to clipboard for issue reports.

### P2: Shortcut listing (read-only)

1. WHEN user opens "Shortcuts" in Settings THEN all shortcuts SHALL be listed grouped by category with a search input.

---

## Edge Cases

- WHEN per-vault setting changes while no vault is open: disable the input, show "Open a vault to edit".
- WHEN user clicks "Rebuild Index" with the index already rebuilding: disable button + show progress bar.
- WHEN saved window state would land on a disconnected monitor: reset to primary, centered.

---

## Requirement Traceability

| ID         | AC                              | Status  |
| ---------- | ------------------------------- | ------- |
| SETTINGS-01 | Open Settings panel            | Complete |
| SETTINGS-02 | Persist + apply immediately    | Complete |
| SETTINGS-03 | Per-vault vs global scoping    | Complete |
| SETTINGS-04 | All inventory rows wired       | Complete |
| SETTINGS-05 | Find ⌘F                        | Complete |
| SETTINGS-06 | Replace ⌘⇧F                    | Complete |
| SETTINGS-07 | Native menu (mac/win/linux)    | Complete |
| SETTINGS-08 | Menu actions wired             | Complete |
| SETTINGS-09 | Window state persistence       | Complete |
| SETTINGS-10 | Off-screen recovery            | Complete |
| SETTINGS-11 | About dialog                   | Complete |
| SETTINGS-12 | Diagnostics copy               | Complete |
| SETTINGS-13 | Shortcuts listing              | Complete |
| SETTINGS-14 | Disabled per-vault when no vault | Complete |

## Success Criteria

- [x] Settings change → effect visible without app restart for every inventory row.
- [x] ⌘F + ⌘⇧F work in dev and packaged builds.
- [x] Window restores correctly across two display setups (manual UAT still recommended for multi-monitor native behavior).
