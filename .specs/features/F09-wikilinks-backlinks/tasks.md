# F09 — Wikilinks & Backlinks Tasks

```
T01 → T02 → T03 → T04 → { T05[P], T06[P] } → T07 → T08 → T09 → T10
```

### T01: Schema migration (links.ambiguous)
**Where:** `src-tauri/src/index/migrations/002_links_ambiguous.sql`, runner update
**Depends on:** F03
**Requirement:** WIKI-02
**Commit:** `feat(index): links ambiguous column`

### T02: resolver.rs
**What:** Implement `resolve(target, db, source_folder)`. Tests cover filename/title/alias/collision/none/case.
**Where:** `src-tauri/src/index/resolver.rs`
**Requirement:** WIKI-01, 02, 13, 14
**Commit:** `feat(index): wikilink resolver`

### T03: Resolver pass in worker
**What:** Hook into `Upsert` and `Rename` jobs to update `target_id` for outgoing + affected incoming links.
**Where:** `src-tauri/src/index/worker.rs`
**Requirement:** WIKI-03, 09, 11
**Commit:** `feat(index): resolver pass in indexing worker`

### T04: Rename propagation service
**What:** Rust function `rename_propagation(old_path, new_path, rewrite: bool)` invoked from `notes.rename` after the FS rename. Reads matching source notes via index, rewrites bodies, saves via vault io. Idempotent.
**Where:** `src-tauri/src/vault/rename_propagation.rs`
**Depends on:** T03
**Requirement:** WIKI-08, 10
**Done when:** Test: vault with 5 notes linking to A; rename A → B; all bodies updated.
**Commit:** `feat(vault): wikilink rewrite on rename`

### T05: Preview wikilink component [P]
**What:** Custom react-markdown renderer for wikilinks. Reads outgoing-links cache, renders resolved vs unresolved class. Click handler.
**Where:** `src/features/editor/preview/WikilinkComponent.tsx`
**Depends on:** F05
**Requirement:** WIKI-04, 05
**Commit:** `feat(editor): preview wikilink component`

### T06: WikilinkPopover (unresolved) [P]
**What:** Popover offering Create here / Create at root / Pick existing.
**Where:** `src/features/wikilinks/ui/WikilinkPopover.tsx`
**Requirement:** WIKI-06, 07
**Commit:** `feat(wikilinks): unresolved popover`

### T07: WikilinkHoverCard
**What:** Tooltip preview for resolved links (hover delay 350 ms). Lazy fetch first 200 chars via `notes.read`.
**Where:** `src/features/wikilinks/ui/WikilinkHoverCard.tsx`
**Requirement:** WIKI-12
**Commit:** `feat(wikilinks): hover preview card`

### T08: Settings toggle (autoRewriteLinksOnRename)
**What:** `appSettingsStore` + a toggle row in HelpModal.
**Where:** `src/features/shell/state/appSettingsStore.ts`, `HelpModal.tsx`
**Requirement:** WIKI-10
**Commit:** `feat(shell): settings store + auto-rewrite toggle`

### T09: Backlinks panel real data
**What:** Already wired in F08 against `links.incoming`; verify it filters out unresolved (target_id IS NOT NULL).
**Where:** `src/features/note-view/hooks/useBacklinks.ts`
**Depends on:** T03
**Requirement:** WIKI-11
**Commit:** `fix(note-view): backlinks exclude unresolved`

### T10: E2E rename + propagation
**Where:** `tests/e2e/wikilinks/rename-propagation.spec.ts`
**Done when:** Renames a fixture note and verifies preview of source notes navigates to new path.
**Commit:** `test(wikilinks): rename propagation e2e`
