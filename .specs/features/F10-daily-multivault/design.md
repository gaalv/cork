# F10 — Daily Notes & Multi-Vault Design

## Daily

### Components
```
src/features/daily/
  ui/                    — none; commands only
  services/
    dailyService.ts      — computePath(now, pattern), renderTemplate, openOrCreate
  templates/
    builtinDaily.md      — bundled fallback
```

### Flow
```mermaid
sequenceDiagram
  User->>Shell: ⌘D
  Shell->>dailyService: openOrCreate()
  dailyService->>FS: stat(daily/2025/03/2025-03-09.md)
  alt exists
    dailyService->>shellStore: navigate({note: id})
  else missing
    dailyService->>FS: read template
    dailyService->>FS: render with vars
    dailyService->>notes.create: (folder, content)
    dailyService->>shellStore: navigate
  end
```

### Path pattern grammar
Tokens: `YYYY YY MM DD HH mm`. Anything else literal. Validated by tests.

## Multi-Vault

### Components
```
src/features/vault-switcher/
  ui/
    VaultSwitcher.tsx     — dropdown in TopBar (replaces vault label)
    VaultListItem.tsx
  state/
    recentVaultsStore.ts  — persisted via tauri-plugin-store
  services/
    switchVault.ts        — orchestrates flush + close + open
```

### Switch sequence
```mermaid
sequenceDiagram
  User->>VaultSwitcher: pick vault
  VaultSwitcher->>editorStore: flushAll()
  editorStore-->>VaultSwitcher: done
  VaultSwitcher->>vault.close: rust stops watcher + closes db
  VaultSwitcher->>vault.open: new path
  vault.open->>indexBuild: BuildAll
  vault.open-->>VaultSwitcher: vault.opened event
  VaultSwitcher->>shellStore: navigate(home)
```

### IPC additions
```ts
namespace vault {
  close(): Promise<void>
  recent(): Promise<RecentVault[]>
  removeRecent(path: string): Promise<void>
}
```

### Per-vault config
File `<vault>/.noxe/config.json` carries `dailyPathPattern`, etc. Loaded on open. Defaults applied if missing.

### Risks
- Editor buffers lost on switch → `editorStore.flushAll()` must succeed before close.
- Watcher cleanup races → `vault.close` must `join` the watcher thread.
