# F17 — Inbox default folder, in-place note moves, tray quick-capture

## Problem

Three pain points block fast capture and triage:

1. **No default home for new notes.** Today every "New note" lands at vault root. Root quickly becomes a junk drawer.
2. **No way to move a note from inside the note view.** The user has to leave the note, open Bulk Ops, multi-select, etc., just to re-file one note.
3. **No quick capture.** When something noteworthy comes up in a call, the user has to focus the app, click around, then type. We want a single keystroke that captures, even when Cork is minimized.

## In scope (v1)

- A canonical **`Inbox/`** folder. New notes go there by default.
- A **selected-folder context** in the Folders drawer. When set, "New note" creates inside it instead of Inbox.
- A **Folder selector in `NoteMetaPanel`** so the user can move the open note from the note view (status field deferred — see "Out of scope").
- A **macOS menubar tray icon** with at minimum: Quick capture / Show Cork / Quit.
- A **global shortcut** that always triggers quick capture (default `CmdOrCtrl+Shift+I`).
- **Close-to-tray** behaviour: clicking the window close button hides the window instead of quitting; tray "Quit" actually quits.

## Out of scope (defer)

- Drag-and-drop notes between folders (user explicitly OK with the sidebar selector instead).
- Status field in `NoteMetaPanel` (mentioned for inspiration only — needs its own design for status taxonomy and storage).
- Configurable Inbox path or shortcut (settings UI). v1 hardcodes `"Inbox"` and `CmdOrCtrl+Shift+I`.
- Separate floating "quick capture" mini-window. v1 reuses the main window: shortcut shows it and creates a new Inbox note.
- Auto-quit-on-last-window-close on non-mac platforms. v1 ships tray on macOS only; on Windows/Linux the existing close-quits-app behaviour is preserved (these platforms don't ship in v1 anyway, but we don't break them).

## Functional requirements

- **FR1.** A function `defaultNewNoteFolder()` returns the active folder context if one is set in the Folders drawer, otherwise the literal string `"Inbox"`.
- **FR2.** Every entry point that creates a new note (TopBar New note, HomeHero, palette command, ⌘N menu, tray quick-capture, wikilink "create new") routes through `createAndOpenNote()` and uses `defaultNewNoteFolder()` unless an explicit folder was passed (e.g. wikilink with `[[some/path/Note]]`, daily notes).
- **FR3.** If the resolved target folder does not exist, the backend creates it (recursively) before writing the note. No user-visible error on missing Inbox.
- **FR4.** Folders drawer has a `selectedFolder: string | null` state. Selecting a folder in the drawer (single click on folder name) sets it; clicking again or clicking another folder updates it; pressing `Esc` while focus is in the drawer or selecting "Root" clears it. Selection is purely a visual highlight + a hint for FR1; it does not filter content.
- **FR5.** Folder context is reflected visually: the selected folder row in the drawer has a subtle accent (border/background using existing tokens).
- **FR6.** `NoteMetaPanel` shows a "Folder" section with: the current folder path (or "Root"), a dropdown of all folders that exist in the vault, and a "Move" affordance. Choosing a different folder calls `client.notes.move({ notePath, destFolder })`, then refreshes notes and re-navigates the open view to the same note id (path may have changed but id is stable).
- **FR7.** A macOS tray icon is created at startup. Left-click toggles main window visibility. Right-click (or click on Linux/Win) opens a context menu: **Quick capture** (`CmdOrCtrl+Shift+I` accelerator label), separator, **Show Cork**, **Quit Cork**.
- **FR8.** When the user clicks the OS window close button (`X`), the window is hidden instead of being destroyed. Reopening (tray, shortcut, or `Show Cork`) shows the existing window with state intact.
- **FR9.** A global shortcut `CmdOrCtrl+Shift+I` is registered on app start. Pressing it from anywhere on the system: shows + focuses the main window, then triggers a "create note in Inbox + open it + focus editor" flow.
- **FR10.** "Quit Cork" from the tray (and `Cmd+Q`) actually quit the process, including unregistering the global shortcut.
- **FR11.** Menu item `New Note` (existing `CmdOrControl+N`) keeps working and now routes through `defaultNewNoteFolder()`.
- **FR12.** No regression: existing palette command "Open: New note", existing keyboard shortcuts, and existing tests stay green.

## Acceptance criteria

- Fresh vault, click TopBar "New note" → file appears at `<vault>/Inbox/Untitled.md` (or numbered variant).
- Open Folders drawer, click on `work/` → click TopBar "New note" → file appears at `<vault>/work/Untitled.md`.
- With `work/` selected, press `Esc` while drawer is focused → next "New note" goes back to `Inbox/`.
- Open any note, in `NoteMetaPanel` change Folder dropdown from "Inbox" to "archive" → file moves on disk, the open note now reflects the new path, no error toast.
- Click window X → app icon stays on macOS dock, window is gone; tray icon visible.
- Click tray icon → window comes back with previous content.
- Press `Cmd+Shift+I` while in a different app → Cork comes to the front with a brand new empty note in `Inbox/` ready to type.
- Tray "Quit Cork" → process exits.
- All 204 existing tests + new tests pass.

## Non-goals / risks

- **Inbox name collision.** If a user already has an `Inbox/` folder used for other purposes, it just becomes the default — that's the same UX as Inkdrop, fine.
- **Global shortcut collision.** `CmdOrCtrl+Shift+I` is used by Chrome to open DevTools; harmless when Cork owns it system-wide. Risk: user has another app already using it. Acceptable for v1 since shortcut config is deferred.
- **Tray icon asset.** macOS template icons should be a 1-bit PNG to render correctly in dark/light menubar. We reuse `icons/32x32.png` for v1; may render colored. Tracked as polish.
- **Window-state plugin.** Already installed (`tauri-plugin-window-state`); hide-on-close should still let it persist size/position because we don't call `destroy`.
