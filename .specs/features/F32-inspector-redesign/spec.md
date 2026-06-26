# F32 — Inspector (right panel) redesign + tag list bug + dark-mode chip fix

## Problem

Three concerns from the user (auto-piloted in single feature for cohesion):

1. **Bug:** Notes have tags (`personal`, `work`) but the NavPane's `Tags`
   section says "No tags yet". The IPC `tags.list` is correct but the
   subscription window can miss the first `index:updated` event when
   `useTagTree` mounts after the initial build. We additionally derive
   tags client-side from the editor's open buffer + recently-read notes
   as a resilient fallback.
2. **UX:** The right inspector is a flat stack of disparate widgets.
   We restructure into 4 ordered sections — **Outline / Properties /
   AI / History** — with denser, icon-labeled headers and a Tolaria-style
   restraint (smaller fonts, icons replace text buttons, tooltips on hover).
3. **Theme:** The ⌘K chip in the search bar uses hard-coded `bg-white`
   which is illegible on the dark theme.

## Requirements

R1. Inspector renders **exactly four** sections in this order: 1. **Outline** — clickable headings that scroll the active note to that
heading. Active heading highlighted by scroll-spy. Empty state shows
"No headings yet". 2. **Properties** — `Info` icon + "Properties" label. Two-column grid:
Created, Updated, Words, Size — labels muted, values inked.
Below: a **Folder** select (compact) and a **Tags** select
(compact, chip preview + dropdown). 3. **AI** — existing `InsightsCard` (unchanged behavior, restyled
header to match new section style). 4. **History** — simplified `NoteHistory`: each entry on one row
with a relative-time chip and a small `ArrowCounterClockwise`
icon-button (instead of "Restore" text) that opens a confirm popover.

R2. All section headers share a single style:
`<icon size 14> + <Label small uppercase tracking-wide muted>` with
a `gap-1.5`, no border between sections (just `space-y-5`).

R3. Outline items: - Clicking an item calls `document.getElementById(id)?.scrollIntoView({block:"start", behavior:"smooth"})` — works in preview & live mode. - Active item: `bg-[--color-cork-accent-soft]` + `text-[--color-cork-accent]`.

R4. Properties metadata derived from the open buffer: - **Created**: `frontmatter.created` if present else `noteEntry.mtime` (fallback "—"). - **Updated**: `buffer.loadedMtime ?? noteEntry.mtime` formatted relative ("2h ago"). - **Words**: `body.trim().split(/\s+/).filter(Boolean).length`. - **Size**: human-formatted bytes (`{n} B`, `{n} kB`, `{n} MB`).

R5. Folder/Tags selects are visually compact: - Folder: existing `<Select>` shrunk to `text-xs h-7`. - Tags: chip-row + small `+` button → opens existing `TagsField` popover (extracted/inlined).

R6. History row spec: - Single line: `· {message-truncated} {relative-time} <restore-icon>` - Restore button = `ArrowCounterClockwise` 14px with `title="Restore this version"` and `aria-label`. - Confirm popover unchanged.

R7. **Tag list resilience**: the NavPane Tags section must show all tags
that exist in any open buffer's frontmatter or any indexed note —
even if the IPC index is empty/lagging. Implementation: union of
`client.tags.list()` and a client-side scan of in-memory editor
buffers + library tags.

R8. Refresh hooks: `useTagTree` re-runs `client.tags.list()` whenever
the window regains focus AND on every editor save (subscribe to a
new `editorStore.lastSavedAt` timestamp via a small effect).

R9. Dark-mode fix: replace the `bg-white` chip in `ListPane`'s search
box with a token-based background that reads in both themes
(`bg-[var(--color-cork-panel)] text-[var(--color-cork-muted)]`).

R10. No regressions in vitest/cargo. Existing tests for NoteMetaPanel,
TagsField, NoteFolderField, Outline must keep passing (or be
updated to match new structure with same coverage).

## Decisions

D-1. Keep `NoteHistory` confirm popover behavior; only the trigger becomes an icon.
D-2. Outline scroll uses native `scrollIntoView`; no smooth-scroll lib.
D-3. Tags section in NavPane unions IPC + client-side derivation; on disagreement, IPC counts win for tags it knows about, client-side adds the missing tags with count=1 (best-effort).
D-4. Properties uses `useEditorStore` directly to react to live edits.
D-5. Section ordering is fixed; not user-configurable in this feature.
