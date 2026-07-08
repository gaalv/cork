# F39 — Note Templates Design

## Decisions (locked in discuss, 2026-07-07)

1. **Templates live in the vault** as plain `.md` notes in a configurable folder (default `Templates/`), per-vault setting `templatesFolder`. Follows AD-004 (pure vault) and matches Obsidian's model.
2. **Defaults are seeded, editable, deletable** via the F30 scaffold — create-if-missing semantics, never overwritten on refresh (stricter than the SCAFFOLD_FILES refresh rule; see AD-056).
3. **Scope = new-note-from-template + insert-at-cursor**, both driven by the same picker modal and the same Rust renderer.

## Architecture

Single variable renderer in Rust (avoids a two-expander parity problem, echoing the AD-005 lesson). The frontend never expands tokens; it only positions the caret using an offset the backend returns.

```
┌──────────────── frontend ────────────────┐      ┌───────── src-tauri ─────────┐
│ CommandPalette ──▶ TemplatePicker modal  │      │ vault/templates.rs          │
│   mode: "create" │ "insert"              │      │   list_templates()          │
│                                          │ IPC  │   render_template()         │
│ services/createNote.ts                   │─────▶│   ├─ expand tokens          │
│   createNoteFromTemplate()               │      │   └─ strip {{cursor}},      │
│ cm/ insert via viewRef + cursorOffset    │      │      return offset          │
│ editorStore: pendingCursorOffset         │      │ vault/io.rs                 │
│ settings/TemplatesSection.tsx            │      │   create_note_from_template │
└──────────────────────────────────────────┘      └─────────────────────────────┘
```

## IPC contract (new commands — same commit as Rust handlers)

```ts
"templates.list": {
  input: {};                              // folder comes from vault settings
  output: { templates: { name: string; path: string; relPath: string }[] };
}
"templates.render": {
  input: { path: string; title?: string };
  output: { frontmatter: JsonRecord; body: string; cursorOffset: number | null };
  // body has all tokens expanded and {{cursor}} stripped;
  // cursorOffset is a char offset into body (first marker), null if absent
}
"notes.createFromTemplate": {
  input: { folder: string; templatePath: string; title?: string };
  output: { path: string; cursorOffset: number | null };
}
```

`notes.createFromTemplate` composes: `render_template` → merge frontmatter (`created` wins on conflict) → `unique_note_path` → atomic write via existing `write_new_note`. Untitled default follows `create_note`'s "Untitled" naming; if the template frontmatter has a `title`-shaping need later, that's out of scope.

## Backend: `src-tauri/src/vault/templates.rs`

- `list_templates(vault_root, folder)` — walk `<vault>/<templatesFolder>` recursively for `.md`; name = file stem, `relPath` = path relative to templates folder (disambiguates nested duplicates). Missing folder → empty vec.
- `render(content, ctx)` — regex-free single pass over `{{token}}`: `title`, `date` (`%Y-%m-%d` local via `chrono::Local`), `time` (`%H:%M`), `datetime` (RFC3339 local). Unknown tokens pass through. `{{cursor}}`: record byte→char offset of first occurrence in the **body**, strip all occurrences (frontmatter occurrences just stripped, no offset).
- Frontmatter values are expanded by rendering the raw file before YAML split (simplest: expand the whole file string except cursor-offset bookkeeping happens after frontmatter/body split so the offset is body-relative).
- Register commands in `lib.rs` alongside existing `vault_*` handlers; all return `Result<T, IpcError>`.

## Scaffold seeding (TMPL-05)

- Bump `SCAFFOLD_VERSION` 2 → 3.
- New const `TEMPLATE_FILES: &[(&str, &str)]` with the 4 defaults, kept **out of** `SCAFFOLD_FILES` so the version-refresh path can't overwrite them; both fresh and refresh paths seed templates with `if target.exists() { continue }`.
- Default templates (dev-audience, wikilink-flavored):
  - `Templates/Meeting.md` — attendees, agenda, notes, action items; `{{date}}` in heading, `{{cursor}}` under Notes
  - `Templates/Project.md` — goal, context, milestones, links
  - `Templates/Bug Report.md` — environment, steps, expected/actual, hypothesis
  - `Templates/Decision.md` — ADR-style: context, options, decision, consequences

## Frontend

- **`components/modals/TemplatePicker.tsx`** — cmdk-style filterable list fed by `templates.list`, `mode: "create" | "insert"` prop; empty state with "Create template" button (calls the same new-template service as Settings). Opened via `shellStore` (follow the pattern used by the Generate-note modal).
- **Palette entries** in `CommandPalette.tsx`: "New note from template" (always) and "Insert template" (disabled when no note open in edit mode).
- **`services/createNote.ts`** — add `createNoteFromTemplate(templatePath, folder)`: mirrors `createNote` (create → `loadNotes` → match path → `forceEdit` + `openNote`), then stores `cursorOffset` as `pendingCursorOffset` in `editorStore`; the editor consumes it once on mount (CM6 `dispatch({ selection })`) and clears it.
- **Insert flow** — with the active CM6 view from `cm/viewRef.ts`: `templates.render({ path, title: openNote.title })` → `dispatch` insert at selection → set selection to `insertPos + cursorOffset` when non-null.
- **`components/settings/TemplatesSection.tsx`** — registered for the existing `"templates"` section id in `SettingsPanel.tsx`: per-vault `templatesFolder` text row (default `Templates`), read-only list of current templates (click = open note), "New template" button (creates `Untitled.md` in the folder via existing `notes.create` with `folder = templatesFolder`, opens it).
- **Types** — `VaultSettings.templatesFolder?: string` (TS) + `templates_folder: Option<String>` (Rust `vault/settings.rs`), resolved with default `"Templates"` in the backend so all three commands share one resolution point.

## Mutation/optimism note

Template CRUD is just note CRUD (existing flows). The only new writes are `notes.createFromTemplate` (fire-and-await like `createNote` — no optimistic entry, list reloads after) — consistent with the current `createNote` service, so no new optimistic-mutation pattern is introduced.

## Risks / notes

- Two sources of "new note" naming (create vs createFromTemplate) — both funnel through `unique_note_path`, keeping collision behavior identical.
- `{{cursor}}` offset is chars, not bytes — CM6 positions are UTF-16 code units; Rust must count UTF-16 code units for correctness with emoji/CJK content. Compute offset with `s[..idx].encode_utf16().count()`.
- Watcher/index: created note is picked up by the existing watcher; `loadNotes()` after create covers the immediate UI need (same as `createNote`).
