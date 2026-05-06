# F10 — Daily Notes & Multi-Vault Tasks

```
Daily:    T01 → T02 → T03 → T04
MV:       T05 → T06 → T07 → { T08[P], T09[P] } → T10 → T11 → T12
```

## Daily

### T01: dailyService computePath + renderTemplate
**Where:** `src/features/daily/services/dailyService.ts` + tests
**Requirement:** DAILY-03, 04
**Commit:** `feat(daily): path computation + template renderer`

### T02: builtinDaily template
**Where:** `src/features/daily/templates/builtinDaily.md`
**Requirement:** DAILY-02
**Commit:** `feat(daily): bundled default template`

### T03: openOrCreate + ⌘D shortcut
**What:** Wire the service + add ⌘D in `useShortcuts`. Idempotent: re-press opens the same file.
**Where:** service + shortcuts hook
**Depends on:** T01, T02
**Requirement:** DAILY-01
**Commit:** `feat(daily): open or create today's note`

### T04: Palette command
**What:** Register "Open today's daily note" in `commandsRegistry` (F04 T07).
**Where:** `src/features/shell/commands/registry.ts`
**Requirement:** DAILY-05
**Commit:** `feat(daily): palette command`

## Multi-Vault

### T05: vault.close + vault.recent IPC
**What:** Rust commands. `close` stops watcher, drops DB connection, clears VaultState. `recent` returns persisted list.
**Where:** `src-tauri/src/vault/mod.rs`, IpcContract
**Requirement:** MV-03, 04
**Commit:** `feat(vault): close + recent commands`

### T06: recentVaultsStore (TS)
**Where:** `src/features/vault-switcher/state/recentVaultsStore.ts`
**Requirement:** MV-01, 04
**Commit:** `feat(vault-switcher): recent vaults store`

### T07: switchVault service
**What:** Orchestrates flush → close → open → reset stores → navigate home.
**Where:** `src/features/vault-switcher/services/switchVault.ts` + test
**Depends on:** T05, T06, F05 editorStore.flushAll
**Requirement:** MV-03
**Commit:** `feat(vault-switcher): switch orchestration`

### T08: VaultSwitcher dropdown [P]
**Where:** `src/features/vault-switcher/ui/{VaultSwitcher,VaultListItem}.tsx`
**Depends on:** T06
**Requirement:** MV-02
**Commit:** `feat(vault-switcher): topbar dropdown`

### T09: editorStore.flushAll [P]
**What:** Force-flush every dirty buffer; returns a Promise.
**Where:** `src/features/editor/state/editorStore.ts` (extend)
**Requirement:** MV-03
**Commit:** `feat(editor): flush all buffers helper`

### T10: Missing-vault detection
**What:** On `recent()` load, stat each path; mark missing; on click prompt to remove.
**Where:** `recentVaultsStore`, `VaultSwitcher`
**Requirement:** MV-05
**Commit:** `feat(vault-switcher): missing path detection`

### T11: Per-vault config loading
**What:** On `vault.open` Rust reads `<vault>/.noxe/config.json` if present and exposes via a `vault.settings()` IPC. TS settings store uses these as overrides.
**Where:** `src-tauri/src/vault/settings.rs`, IPC, `appSettingsStore`
**Requirement:** MV-06
**Commit:** `feat(vault): per-vault settings file`

### T12: E2E vault switch chaos
**What:** Open vault A, type 100 chars, switch to vault B mid-typing. Switch back, file content matches expected (no loss).
**Where:** `tests/e2e/multivault/switch-chaos.spec.ts`
**Done when:** Green CI.
**Commit:** `test(multivault): switch chaos`
