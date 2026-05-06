# F11 — Assets & Images Tasks

```
T01 → T02 → T03 → { T04[P], T05[P], T06[P] } → T07 → T08 → { T09[P], T10[P] } → T11 → T12
```

### T01: Tauri asset protocol + scope IPC
**What:** Enable `assetProtocol` in `tauri.conf.json`. Add Rust command `assets.set_scope(vault_root)` that updates the runtime scope using `tauri::scope::FsScope`. Reset on `vault.close`.
**Where:** `src-tauri/tauri.conf.json`, `src-tauri/src/assets/mod.rs`, IpcContract
**Depends on:** F02 done
**Requirement:** ASSET-01, ASSET-03
**Done when:** Test: requests outside scope return 403; in-scope files served.
**Commit:** `feat(assets): asset protocol with vault-scoped access`

### T02: assets table in index
**What:** Migration `003_assets.sql`. Extend F02 walker to also scan known binary extensions and populate the `assets` table during BuildAll + incremental.
**Where:** `src-tauri/src/index/migrations/003_assets.sql`, walker updates
**Depends on:** T01
**Requirement:** ASSET-05
**Done when:** Walking fixture vault populates assets correctly.
**Commit:** `feat(index): assets table + walker integration`

### T03: assetResolver service (TS)
**What:** Pure function `resolve(linkPath, currentNotePath, vaultRoot)` returning `Resolved | Blocked | Missing`. Includes `encodeURI`-based asset URL builder.
**Where:** `src/features/assets/services/assetResolver.ts` + tests
**Depends on:** T01
**Requirement:** ASSET-02, ASSET-03, ASSET-13
**Done when:** ≥ 8 unit tests covering relative, absolute, traversal, encoding, missing.
**Commit:** `feat(assets): asset resolver`

### T04: rewriteImages rehype plugin [P]
**What:** Walks rehype tree; for `<img>` and `<a>` whose href/src is local: call resolver; rewrite to asset URL or placeholder element. Lazy-load attribute on images.
**Where:** `src/features/assets/preview/rewriteImages.ts` + tests
**Depends on:** T03
**Requirement:** ASSET-01, ASSET-04, ASSET-14
**Done when:** Snapshot tests for image, missing image, out-of-vault, non-image link.
**Commit:** `feat(assets): rehype image/link rewriter`

### T05: obsidianEmbed remark plugin [P]
**What:** Detects `![[file.png]]` (extension non-md), queries assets via `assets.resolve_embed(name, currentFolder)` (new IPC), emits `<img>` node.
**Where:** `src/features/assets/preview/obsidianEmbed.ts`, IPC `assets.resolve_embed`
**Depends on:** T02, T03
**Requirement:** ASSET-05
**Done when:** Test: `![[logo.png]]` → image when present; placeholder when absent.
**Commit:** `feat(assets): obsidian embed support`

### T06: BrokenAssetPlaceholder + OpenFileConfirm UI [P]
**Where:** `src/features/assets/ui/{BrokenAssetPlaceholder,OpenFileConfirm}.tsx`
**Depends on:** T03
**Requirement:** ASSET-04, ASSET-07
**Done when:** RTL tests render both states.
**Commit:** `feat(assets): placeholder and confirm dialogs`

### T07: Click-to-open for files
**What:** In rewriteImages plugin, for `<a>` with safelist extension → onclick calls `tauri-plugin-shell.open(absolute)`. Non-safelist → renders `OpenFileConfirm` modal first.
**Where:** rewriteImages + `src/features/assets/services/openFile.ts`
**Depends on:** T04, T06
**Requirement:** ASSET-06, ASSET-07
**Done when:** E2E click on PDF link opens via shell stub.
**Commit:** `feat(assets): open file in default app with safelist`

### T08: assetIngest service + write_attachment IPC
**What:** Rust command `assets.write_attachment(bytes, suggested_name, vault_rel_dir)` writes atomically (tmp + rename), returns absolute path. TS service handles collision suffixes and link-text generation (image vs file).
**Where:** Rust + `src/features/assets/services/assetIngest.ts` + tests
**Depends on:** T01
**Requirement:** ASSET-08, ASSET-09
**Done when:** Unit tests cover collisions, image vs non-image link templates.
**Commit:** `feat(assets): attachment ingest service`

### T09: useEditorDropPaste hook [P]
**What:** Attaches `drop` and `paste` handlers to CM6 EditorView, calls assetIngest, dispatches insertion at cursor.
**Where:** `src/features/assets/hooks/useEditorDropPaste.ts` + tests with synthetic events
**Depends on:** T08
**Requirement:** ASSET-08, ASSET-09
**Done when:** Tests fire DataTransfer with files, assert insertion + service call.
**Commit:** `feat(assets): editor drop and paste`

### T10: Per-vault attachmentsFolder setting [P]
**What:** Read from per-vault config (F10-T11) `attachmentsFolder`. Empty string → same-folder mode. Default `attachments`. Honor in `assetIngest`.
**Where:** `appSettingsStore` extension, `assetIngest`
**Depends on:** F10-T11, T08
**Requirement:** ASSET-10, ASSET-11
**Done when:** Tests for both modes.
**Commit:** `feat(assets): configurable attachments folder`

### T11: Offline-mode remote image gating
**What:** Setting `offlineMode` in `appSettingsStore`. When true, rewriteImages replaces remote `<img>` with placeholder + click-to-load.
**Where:** rewriteImages update + Settings UI hook (F13)
**Depends on:** T04
**Requirement:** ASSET-12
**Done when:** Test toggles setting and verifies placeholder.
**Commit:** `feat(assets): offline-mode remote gating`

### T12: E2E drop-paste-render
**What:** Spec drops a file into editor → asserts attachment exists on disk + link inserted + image renders in preview.
**Where:** `tests/e2e/assets/drop-render.spec.ts`
**Depends on:** T04, T09
**Done when:** Green CI.
**Commit:** `test(assets): drop, paste, render e2e`
