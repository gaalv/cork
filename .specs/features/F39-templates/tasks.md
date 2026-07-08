# F39 — Note Templates Tasks

Status legend: `[ ]` pending · `[x]` done · `[P]` parallelizable within its phase.
No automated tests are written for this feature (project decision — tests removed to save tokens). Verification is `pnpm typecheck && pnpm lint && cargo check` plus manual UAT per task.

## Phase 1 — Backend

### F39-T01 — Rust templates module + IPC contract (TMPL-01, TMPL-03, TMPL-04, TMPL-08)

- **What:** New `src-tauri/src/vault/templates.rs`: `list_templates`, `render` (tokens `title/date/time/datetime`, `{{cursor}}` strip + UTF-16 offset, unknown tokens pass through). `templates_folder` added to vault settings (Rust + TS) with `"Templates"` default resolved backend-side. Register `templates.list` / `templates.render` commands in `lib.rs`. Add both commands + types to `src/ipc/IpcContract.ts` and `src/ipc/types.ts` (same commit).
- **Where:** `src-tauri/src/vault/templates.rs`, `src-tauri/src/vault/mod.rs`, `src-tauri/src/vault/settings.rs`, `src-tauri/src/lib.rs`, `src/ipc/IpcContract.ts`, `src/ipc/types.ts`
- **Depends on:** —
- **Reuses:** `IpcError`, vault settings resolution, `chrono`
- **Done when:** `templates.list` returns seeded files' names/relPaths; `templates.render` expands all tokens and returns correct `cursorOffset`; missing folder → empty list.
- **Verify:** `cargo check` + `pnpm typecheck`; manual invoke via devtools console.
- **Commit:** `feat(templates): rust templates module with list/render IPC`

### F39-T02 — `notes.createFromTemplate` command (TMPL-02)

- **What:** Rust `create_note_from_template(folder, template_path, title?)`: render → merge frontmatter (add `created`, template keys preserved) → `unique_note_path` → `write_new_note`. Returns `{ path, cursorOffset }`. Contract + client updated in same commit.
- **Where:** `src-tauri/src/vault/io.rs` (or `templates.rs`), `src-tauri/src/lib.rs`, `src/ipc/IpcContract.ts`, `src/ipc/types.ts`
- **Depends on:** F39-T01
- **Reuses:** `unique_note_path`, `write_new_note`, `serialize_note`
- **Done when:** Creating from Meeting template yields a unique note with merged frontmatter + expanded body; deleted template path → `IpcError::NotFound` (no panic).
- **Commit:** `feat(templates): notes.createFromTemplate IPC command`

### F39-T03 [P] — Seed default templates in scaffold (TMPL-05)

- **What:** `SCAFFOLD_VERSION` 2→3; new `TEMPLATE_FILES` const (Meeting, Project, Bug Report, Decision — content per design.md) seeded create-if-missing in BOTH fresh and refresh paths; refresh must never overwrite an existing template.
- **Where:** `src-tauri/src/vault/scaffold.rs`
- **Depends on:** — (parallel with T01/T02)
- **Done when:** Fresh vault gets 4 templates; vault with edited `Templates/Meeting.md` keeps the edit after version-refresh.
- **Commit:** `feat(templates): seed default templates via vault scaffold`

## Phase 2 — Frontend flows

### F39-T04 — TemplatePicker modal + palette entries (TMPL-01, TMPL-08)

- **What:** `TemplatePicker.tsx` modal (filterable list from `templates.list`, `mode` prop, empty state with "Create template" CTA); shellStore wiring; palette entries "New note from template" + "Insert template" (insert disabled without an editable open note).
- **Where:** `src/components/modals/TemplatePicker.tsx`, `src/components/modals/CommandPalette.tsx`, `src/stores/shellStore.ts`
- **Depends on:** F39-T01
- **Reuses:** modal + cmdk patterns from `CommandPalette`/Generate-note modal
- **Done when:** ⌘K shows both entries; picker lists templates with filter; empty folder shows CTA.
- **Commit:** `feat(templates): template picker modal and palette entries`

### F39-T05 — Create-from-template service + cursor placement (TMPL-02, TMPL-04)

- **What:** `createNoteFromTemplate()` in `services/createNote.ts` (create → reload → open with `forceEdit`); `pendingCursorOffset` in `editorStore` consumed once by the editor on mount to set CM6 selection.
- **Where:** `src/services/createNote.ts`, `src/stores/editorStore.ts`, editor mount component under `src/components/editor/`
- **Depends on:** F39-T02, F39-T04
- **Done when:** Picking a template creates + opens the note in edit mode with caret at `{{cursor}}` position (or start when absent).
- **Commit:** `feat(templates): create note from template with cursor placement`

### F39-T06 — Insert template at cursor (TMPL-06)

- **What:** Insert flow: picker in `insert` mode → `templates.render` with open note's title → CM6 insert at selection via `cm/viewRef.ts` → caret at `insertPos + cursorOffset`. Frontmatter of the template is ignored. Toast when render fails.
- **Where:** `src/components/modals/TemplatePicker.tsx`, `src/cm/viewRef.ts` consumers, `src/services/` (new small `insertTemplate.ts` if needed)
- **Depends on:** F39-T04
- **Done when:** Insert works mid-note, tokens expanded, caret positioned; preview-mode/no-note is blocked with explanation.
- **Commit:** `feat(templates): insert template at cursor`

## Phase 3 — Settings + close-out

### F39-T07 — Settings → Templates section (TMPL-07)

- **What:** `TemplatesSection.tsx` for existing `"templates"` section id: per-vault `templatesFolder` row, template list (click = open), "New template" button (create in folder + open). Register in `SettingsPanel.tsx`.
- **Where:** `src/components/settings/TemplatesSection.tsx`, `src/components/settings/SettingsPanel.tsx`
- **Depends on:** F39-T01
- **Reuses:** `SettingRow`, vault-settings persistence used by FilesSection
- **Done when:** Section renders; folder change re-scopes picker immediately; New template opens an editable note.
- **Commit:** `feat(templates): settings templates section`

### F39-T08 — Docs close-out

- **What:** ROADMAP F39 → COMPLETE; STATE.md quick-task row + any lessons; verify AGENTS/CLAUDE mention nothing stale about templates.
- **Depends on:** all above
- **Commit:** `docs(specs): close out F39 templates`

## Traceability

| Req     | Tasks    |
| ------- | -------- |
| TMPL-01 | T01, T04 |
| TMPL-02 | T02, T05 |
| TMPL-03 | T01      |
| TMPL-04 | T01, T05 |
| TMPL-05 | T03      |
| TMPL-06 | T06      |
| TMPL-07 | T07      |
| TMPL-08 | T01, T04 |
