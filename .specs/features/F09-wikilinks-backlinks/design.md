# F09 — Wikilinks & Backlinks Design

## Resolution algorithm (Rust)

```rust
fn resolve(target: &str, db: &Conn, source_folder: &str) -> Option<(String, bool /*ambiguous*/)> {
    // 1) exact filename (case-insensitive) anywhere
    let by_filename = db.query("SELECT id, mtime FROM notes WHERE LOWER(SUBSTR(path, ...)) = LOWER(?)");
    // 2) exact title (case-insensitive)
    let by_title = db.query("SELECT id, mtime FROM notes WHERE LOWER(title) = LOWER(?)");
    // 3) alias (frontmatter table key='aliases', JSON-array value contains target)
    let by_alias = db.query("SELECT n.id, n.mtime FROM notes n JOIN frontmatter f ON n.id = f.note_id WHERE f.key='aliases' AND json_each.value = LOWER(?)");
    // Merge in order, preserving order; if total > 1 → ambiguous; pick most recent.
    let candidates = chain(by_filename, by_title, by_alias).unique();
    match candidates.len() {
      0 => None,
      1 => Some((candidates[0].id, false)),
      _ => Some((most_recent(candidates).id, true)),
    }
}
```

## Schema additions

```sql
ALTER TABLE links ADD COLUMN ambiguous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN alias TEXT;  -- already in F03 but document here
CREATE INDEX idx_links_ambiguous ON links(ambiguous);
```

## Resolver pass

After every `Upsert` job in F03 worker, run a second pass:
- For the upserted note's outgoing links → resolve and update target_id, ambiguous.
- Find all OTHER notes where `target_text` could now resolve to or away from this note (e.g., title changed, new alias added) → re-resolve those links.

To bound the work: only re-resolve links whose `target_text` (case-insensitive) equals the changed note's old or new title/filename/alias. Keep an index on `LOWER(target_text)`.

## Rename propagation

When `notes.rename(old, new)`:
1. Compute oldTitle, newTitle (filename stems).
2. SELECT `src_note_id, position, alias` FROM `links` WHERE `LOWER(target_text)=LOWER(oldTitle)`.
3. For each unique src note → load body via F02, replace `[[oldTitle(\|alias)?]]` with `[[newTitle($1)?]]` using a regex bounded to `\[\[oldTitle\b`.
4. Save via F02 (atomic; emits internal events).
5. F03 reindexes those notes; resolver pass updates `target_id` to the renamed note.

If user disabled the setting → skip step 3 only; resolver still updates target_id (since the note still exists with new title).

## UI components

```
src/features/wikilinks/
  ui/
    WikilinkPopover.tsx         — used in preview on unresolved click
    WikilinkHoverCard.tsx       — hover preview
  hooks/
    useWikilinkResolver.ts      — frontend mirror? No: server is source of truth. This hook only fetches `links.outgoing(noteId)` to know which are resolved.
```

Preview's react-markdown component for `<a class="wikilink">` consults the outgoing links cache for the current note (loaded once per note open) to know resolved/unresolved + target_id.

## Settings

`appSettingsStore` adds `autoRewriteLinksOnRename: boolean` (default true). UI in a future Settings panel; for v1 a toggle in the Help/Shortcuts modal is acceptable.

## Risks

- **Performance** of resolver pass on large vaults — mitigated by filtered re-resolve, indices on `LOWER(target_text)`.
- **Race** between rename propagation writes and watcher events — F02's fingerprint cache absorbs these.
