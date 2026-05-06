# F13 — Settings + Search + App Menu Tasks

```
T01 → T02 → T03 → { T04[P], T05[P], T06[P], T07[P], T08[P] } → T09 → T10 → T11 → T12 → T13
```

### T01: Install deps
**What:** `pnpm add @codemirror/search` (frontend); `cargo add tauri-plugin-window-state@2` (rust).
**Where:** `package.json`, `src-tauri/Cargo.toml`
**Depends on:** F11 done
**Commit:** `chore(settings): install search + window-state plugins`

### T02: appSettingsStore + vaultSettingsStore + bridge
**What:** Implement both stores with persistence (global via tauri-plugin-store; per-vault via JSON file). `settingsBridge` resolves keys. Emits `settings.changed`.
**Where:** `src/features/settings/state/{appSettingsStore,vaultSettingsStore}.ts`, `services/settingsBridge.ts` + tests
**Depends on:** T01, F10-T11
**Requirement:** SETTINGS-02, 03
**Commit:** `feat(settings): stores + bridge`

### T03: SettingRow + sections scaffolding
**What:** Generic `SettingRow` accepting label/description/scope/control. Build placeholder sections.
**Where:** `src/features/settings/ui/{SettingRow,SettingsPanel}.tsx`
**Depends on:** T02
**Requirement:** SETTINGS-01, 14
**Commit:** `feat(settings): panel scaffolding`

### T04: Wire General + Editor settings rows [P]
**Where:** SettingsPanel sections
**Depends on:** T03
**Requirement:** SETTINGS-04
**Commit:** `feat(settings): general + editor rows`

### T05: Wire Files & Vaults rows [P]
**What:** attachmentsFolder (per-vault, disabled when no vault), recentLimit, "Reveal vault in OS" button.
**Depends on:** T03
**Requirement:** SETTINGS-04, 14
**Commit:** `feat(settings): files & vaults rows`

### T06: Wire Markdown rows [P]
**What:** callouts toggle, footnotes toggle (these flags will be consumed by F14).
**Depends on:** T03
**Requirement:** SETTINGS-04
**Commit:** `feat(settings): markdown rows`

### T07: Wire Daily Notes rows [P]
**What:** pathPattern + templatePath (with file picker).
**Depends on:** T03
**Requirement:** SETTINGS-04
**Commit:** `feat(settings): daily notes rows`

### T08: Wire Advanced rows [P]
**What:** Rebuild Index button (calls `index.rebuild`, shows progress), offlineMode toggle.
**Depends on:** T03
**Requirement:** SETTINGS-04
**Commit:** `feat(settings): advanced rows`

### T09: ⌘, shortcut + palette command
**What:** Add to `useShortcuts` and `commandsRegistry`.
**Where:** F04 hooks/registry
**Depends on:** T03
**Requirement:** SETTINGS-01
**Commit:** `feat(settings): keyboard + palette entry`

### T10: CodeMirror search extension
**What:** Configure @codemirror/search with theme; bind ⌘F/⌘⇧F. Esc closes panel and restores cursor.
**Where:** `src/features/editor/cm/searchExtension.ts`, plug into `extensions.ts`
**Depends on:** T01, F05-T03
**Requirement:** SETTINGS-05, 06
**Done when:** Tests fire ⌘F via RTL on Editor; panel opens.
**Commit:** `feat(editor): in-note find and replace`

### T11: Native app menu (Tauri)
**What:** Implement `buildAppMenu` + `menu.rs`. Forward `on_menu_event` → emit `menu.action` with id. JS subscribes and dispatches into existing actions/`commandsRegistry`. Recent Vaults dynamic submenu rebuilt on store changes.
**Where:** `src-tauri/src/menu.rs`, `src/features/shell/menu/{buildAppMenu,menuActions}.ts`
**Depends on:** T01, F10-T06
**Requirement:** SETTINGS-07, 08
**Done when:** macOS menubar shows full menu in dev; clicking each item triggers the right action.
**Commit:** `feat(shell): native app menu`

### T12: Window state plugin + off-screen recovery
**What:** Register plugin; on app `created` event, validate position vs monitors, snap if off-screen.
**Where:** `src-tauri/src/lib.rs`
**Depends on:** T01
**Requirement:** SETTINGS-09, 10
**Commit:** `feat(shell): window state persistence`

### T13: AboutDialog + Diagnostics + Shortcuts list
**What:** AboutDialog modal opened from menu/Help. DiagnosticsButton copies JSON. ShortcutsList in Settings.
**Where:** `src/features/settings/ui/{AboutDialog,DiagnosticsButton,ShortcutsList}.tsx`
**Depends on:** T03, T11
**Requirement:** SETTINGS-11, 12, 13
**Commit:** `feat(settings): about + diagnostics + shortcuts list`
