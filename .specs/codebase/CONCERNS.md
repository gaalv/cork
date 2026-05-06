# Concerns

This document surfaces actionable warnings about the codebase. Updated as tech debt, fragile areas, or risks accumulate.

**Status as of 2026-05-06:** Greenfield. No production code yet — only the layout prototype and spec docs. Concerns listed here are *anticipated* risks the implementation must address.

## Anticipated risks

### R-001: Markdown parser parity (Rust ↔ JS)

**Area:** F03 indexer (Rust `pulldown-cmark`) vs F05 preview (JS `react-markdown` + `remark-gfm`).
**Risk:** Drift in how the two parse wikilinks, tags, or task lists could cause an indexed wikilink to not render, or vice versa.
**Mitigation:**
- Single source of truth for the wikilink and tag regex shapes lives in `.specs/features/F03-index/design.md` and `.specs/features/F05-editor/design.md` and is duplicated only at the lexical level.
- Contract test in `src-tauri/tests/parser_parity.rs` runs a fixture corpus through both parsers (Rust direct, JS via Vitest) and asserts identical outputs for: extracted wikilinks, extracted tags, extracted heading outline.
- Any change to the regexes requires updating BOTH and re-running parity test.

### R-002: File watcher echo loops

**Area:** F02 watcher.
**Risk:** Our own writes (autosave) trigger the watcher → reindex → potentially rerender → confuse the editor.
**Mitigation:**
- Track a fingerprint `(path, size, mtime)` per write and have the watcher skip events matching a recent write within 1 s.
- Debounce all watcher events at 200 ms.
- E2E test: type, save, watch — assert no reindex burst, no editor reset.

### R-003: SQLite locking under concurrent writes

**Area:** F03 indexer + autosave path.
**Risk:** If autosave triggers a reindex while user opens another note (which queries the index), SQLite write lock could stall reads.
**Mitigation:**
- Open SQLite in WAL mode at startup.
- Indexer writes happen on a single dedicated thread (Tokio task with `mpsc` channel) — no concurrent writers.
- Reads use a separate connection pool.

### R-004: Vault path with non-UTF-8 characters

**Area:** F02 vault FS layer.
**Risk:** Some Linux users have non-UTF-8 paths. Tauri/serde JSON requires UTF-8.
**Mitigation:**
- Reject non-UTF-8 vault paths at `vault.open` with a clear `IpcError::InvalidPath` and a UI message.
- Document in onboarding.

### R-005: Wikilink ambiguity (multiple notes with same title)

**Area:** F09 wikilinks.
**Risk:** `[[Roadmap]]` could match 3 notes. Which one wins?
**Mitigation (decided):**
- Resolution rule: exact title match → if 1 result return; if >1 prefer note in same folder, then most recently updated, else show disambiguation popover.
- Documented in `.specs/features/F09-wikilinks-backlinks/design.md`.

### R-006: Bundle size creep from Mermaid + KaTeX + Shiki

**Area:** F05 editor preview.
**Risk:** All three libraries are large. KaTeX alone is ~280 kB. Mermaid is ~700 kB. Could blow the < 500 kB JS budget.
**Mitigation:**
- Lazy-load each: import only when a code block / `$math$` / `mermaid` block is present in the rendered note.
- Use `@shikijs/core` with selective bundled languages instead of full Shiki.
- Bundle-size test in CI fails the build if main chunk > 500 kB gzipped.

### R-007: Tauri 2 Linux dependency on WebKitGTK 4.1

**Area:** Distribution.
**Risk:** Older Linux distros lack WebKitGTK 4.1; users hit cryptic load errors.
**Mitigation:**
- Document supported distros in README (Ubuntu 22.04+, Fedora 38+, Arch).
- AppImage build for older distros (post-MVP).

## Resolved / non-issues

_None yet._
