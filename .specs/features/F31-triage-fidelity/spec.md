# F31 — Triage layout fidelity (match the prototype)

**Status:** IN PROGRESS
**Scope:** Large (multi-component shell rework; keeps Focus mode intact)
**Depends on:** F28 (dual layout modes), F29 (home polish), F25 (todos), F19 (calendar — modal carve-out)

## Why

The triage mode shipped under F28 is structurally a 3-column layout
but visually and behaviourally diverges from the prototype the user
keeps coming back to. The user's complaints:

- The full app **rail** and **TopBar** are still rendered around the
  triage body — the prototype has neither.
- The third column doesn't always have a note open and there's no
  graceful placeholder.
- "Notebooks" should read **Folders** for naming consistency.
- The middle-column note cards are bare (title + folder + relative
  time); the prototype has rich cards (title + HH:mm time + 2-line
  excerpt + tag pills).
- The first column has no brand row, no big "New note" CTA, no
  footer with `~/path · N notes`, and no settings affordance.
- Graph / Calendar / Todos all replace the third column when activated
  in triage, breaking the 3-column promise.

## In scope

### Shell chrome (triage mode only)

- **R1** Hide `Rail` and `TopBar` entirely when `effectiveMode ===
"triage"`. The NavPane becomes the sole navigation surface.
- **R2** Place the **settings gear** at the bottom-right of NavPane
  footer (alongside the vault path + note count line), reusing
  `useSettingsUiStore.openSettings`.

### NavPane (column 1) — match prototype

- **R3** Brand row at the top: "Noxe" wordmark + neutral "vault" chip
  - sync indicator (re-using existing `SyncIndicator` if present, else
    a small clock icon stub). **No logo glyph** — the project doesn't
    have a logo yet; revisit when one exists.
- **R4** Primary "New note" CTA button (indigo filled) below the brand
  row; calls the existing `notes.create` flow scoped to the active
  triage selection (folder if folder is selected, else vault root).
- **R5** Sections rename: "Notebooks" → **"Folders"**; "Shortcuts"
  stays. "Atalhos" rows: Pinned, Recent, Inbox (root-folder notes).
  Inbox row shows a count badge when > 0.
- **R6** Footer: vault path on the left, total-note count on the
  right, gear icon button on the far right (settings).

### ListPane (column 2) — match prototype

- **R7** Header keeps the search input (already present) but the
  placeholder copy reads "Search this view…" and a `⌘K` kbd hints at
  the global palette (clickable → opens palette).
- **R8** Note rows are **enriched cards** with:
  - Title (semibold) + HH:mm time on the right
  - 2-line excerpt (first non-frontmatter line of the body)
  - Up to 3 tag pills (`#tag` style, `--color-noxe-tag*`)
  - Active row uses left accent border (4px) + soft accent bg
- **R9** Notes are enriched via the same helper used by Home (extract
  `enrichNotes` to a shared module so we don't refetch on every render).
- **R10** When the list has notes and no view is active in triage,
  auto-select the first row so the third column always has a note.

### NoteView placeholder (column 3 — empty case)

- **R11** When the active selection has zero notes (or before
  enrichment loads), render a centred placeholder: "Select a note to
  start reading" with a subtle hint about Cmd+N to create one.

### Graph / Calendar / Todos in triage

- **R12** In triage mode, navigating to `graph`, `calendar`, or
  `todos` opens an **overlay modal** floating over the 3-column body
  (rather than replacing the third column). Closing the modal returns
  the user to the previously open note. Focus mode keeps the existing
  full-screen routes — no behavioural change there.
- **R13** Modal entry points stay shortcut-only for now (Cmd+Shift+G /
  Cmd+Shift+C / Cmd+Shift+T). A small command-palette section labelled
  "Tools" lists them so they remain discoverable. We keep palette /
  shortcut for both layouts; only the _presentation_ differs in
  triage.

### Out of scope

- Resizable panel widths beyond what F28 already wired (NavPane stays
  fixed via clamps; user can still drag).
- Drag-and-drop note moves between folders inside ListPane.
- Real-time excerpt updates as the editor changes (we re-enrich on
  selection / vault-store change only).
- Light/dark theme delta (re-uses existing tokens).

## Decisions captured

- **D-1 Settings gear placement:** NavPane footer (right side of the
  vault-path/footer row). Top-right was an alternative, but the
  footer keeps the brand row clean and matches the "hidden plumbing"
  vibe of the prototype.
- **D-2 Graph/Calendar/Todos in triage:** **modal overlay**. Modals
  are reversible (Esc closes) and preserve the third-column note —
  the user explicitly said "always a note is selected".
- **D-3 Sidebar removal in triage:** Rail + TopBar both hidden. Search
  is reachable via Cmd+K (palette) and via the in-list filter; New
  Note via the NavPane CTA + Cmd+N; Settings via the gear in NavPane
  footer.
- **D-4 Naming:** standardize on "Folders" everywhere ("Notebooks"
  retired in user-facing copy; `folders.*` IPC namespace already
  matches).
- **D-5 Auto-select first note:** when entering triage with no note
  open, ListPane fires `navigate({ kind: "note", id: first.id })`
  once after the first list load; subsequent selection changes that
  yield an empty list show the placeholder.

## Acceptance

- Toggling layout to **triage** removes the side rail and topbar from
  the DOM; only the 3-column body + overlays remain.
- NavPane header shows brand + "vault" chip + sync indicator + "New
  note" CTA; sections read "Shortcuts / Folders / Tags"; footer
  shows path + count + gear.
- ListPane cards show title, HH:mm time, 2-line excerpt, tag pills.
- Selecting a folder/tag/shortcut auto-selects the first matching
  note in the third column; empty results show the placeholder.
- Cmd+Shift+G / Cmd+Shift+C / Cmd+Shift+T open Graph / Calendar /
  Todos as **modals** while in triage; the underlying note view stays
  visible behind the overlay.
- `pnpm typecheck && pnpm lint --max-warnings=0 && pnpm vitest run`
  all green; existing focus-mode E2E suite untouched.

## Notes / follow-ups

- Sync indicator for the brand row is best-effort — if the existing
  hook isn't trivially reusable in NavPane, ship a passive icon and
  add a `feat(triage): wire sync state into nav header` follow-up.
- Drag-to-reorder, multiselect in ListPane, and per-folder note
  ordering preferences are explicit non-goals for this PR (capture as
  deferred ideas in STATE.md if user surfaces them).
