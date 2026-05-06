# F13 — Settings + Search + App Menu Design

## Components

```
src/features/settings/
  ui/
    SettingsPanel.tsx          — modal/panel with sections
    SettingRow.tsx             — uniform row pattern (label, control, description, scope badge)
    AboutDialog.tsx
    DiagnosticsButton.tsx
    ShortcutsList.tsx
  state/
    appSettingsStore.ts        — already started in F09; expand
    vaultSettingsStore.ts      — per-vault overrides (loaded from <vault>/.noxe/config.json)
  services/
    settingsBridge.ts          — read/write helpers; resolves global vs per-vault
src/features/editor/cm/
  searchExtension.ts           — wraps @codemirror/search with custom panel
src/features/shell/menu/
  buildAppMenu.ts              — produces Tauri Menu definition
  menuActions.ts               — each item dispatches into shellStore / commandsRegistry
src-tauri/src/menu.rs          — Tauri menu registration + event forward
```

## Settings storage layout

```jsonc
// global (tauri-plugin-store)
{
  "appearance": { "density": "comfortable", "theme": "light" },
  "editor": { "autoSaveDebounceMs": 500, "previewDefault": true },
  "vault": { "recentLimit": 8 },
  "markdown": { "callouts": true, "footnotes": true },
  "assets": { "offlineMode": false }
}

// per-vault (<vault>/.noxe/config.json)
{
  "attachmentsFolder": "attachments",
  "wikilinks": { "autoRewriteOnRename": true },
  "daily": { "pathPattern": "Daily/YYYY/MM/YYYY-MM-DD.md", "templatePath": ".noxe/templates/daily.md" }
}
```

`settingsBridge.get(key)` first checks per-vault store then falls back to global default. `set(key, value, scope)` writes to the appropriate store and emits a `settings.changed` event.

## In-note search

```ts
import { search, openSearchPanel } from '@codemirror/search';
extensions.push(search({ top: false, caseSensitive: false }));
keymap.push({ key: 'Mod-f', run: openSearchPanel });
keymap.push({ key: 'Mod-Shift-f', run: openSearchPanelWithReplace });
```

Custom CSS theme matches Tailwind tokens.

## App menu

```rs
use tauri::menu::{Menu, MenuItem, Submenu};

fn build(app: &AppHandle) -> Menu<R> {
  let file = Submenu::with_items(app, "File", true, &[
    &MenuItem::with_id(app, "new_note", "New Note", true, Some("CmdOrControl+N"))?,
    &MenuItem::with_id(app, "open_vault", "Open Vault…", true, Some("CmdOrControl+O"))?,
    // recent vaults dynamic submenu
  ])?;
  // ... View, Edit, Notes, Window, Help
  Menu::with_items(app, &[&app_submenu, &file, &edit, &view, &notes, &window, &help])
}
```

Menu IDs are forwarded to JS via `app.on_menu_event` → emits `menu.action` event. JS subscribes once and dispatches into existing actions.

## Recent vaults submenu

Built dynamically from `recentVaultsStore`. Re-built when the store changes (debounced 500 ms; menu rebuild via `app.set_menu`).

## Window state plugin

```toml
# Cargo.toml
tauri-plugin-window-state = "2"
```

```rs
.plugin(tauri_plugin_window_state::Builder::default().build())
```

Recovery: on `app.created`, check window inner position vs available displays via `tauri::Monitor`; if outside any, center on primary.

## About + diagnostics

Diagnostics JSON includes:
```json
{
  "app": { "name": "Noxe", "version": "...", "tauri": "..." },
  "os": { "platform": "...", "version": "..." },
  "vault": { "path": "...", "noteCount": N },
  "indexBuild": { "lastDuration_ms": N }
}
```

## Risks

- Menu API changes between Tauri 2 minor versions — pin Tauri version, snapshot menu IDs in test.
- `@codemirror/search` adds bundle weight (~30 kB); already inside lazy editor chunk → fine.
- macOS menu must include the app's first menu as the "App menu" (Quit, About, Services). Handle platform branch in `buildAppMenu`.
