# F08 — Note View Design

## Components

```
src/features/note-view/
  ui/
    NoteView.tsx          — composes editor + meta panel
    NoteMetaPanel.tsx     — tabs/sections wrapper
    Outline.tsx
    BacklinksList.tsx
    RecentsList.tsx       — distinct from Home's; min variant
    AISuggestionCard.tsx
    NoteMetaFooter.tsx
  hooks/
    useOutline.ts         — derives headings from buffer
    useBacklinks.ts       — calls links.incoming + subscribes to changes
    useScrollSpy.ts
  state/noteViewStore.ts  — scrollPositions: Map<noteId, number>, panelCollapsed
```

## Outline derivation

`useOutline(buffer)` runs in a Web Worker (or `requestIdleCallback`) to keep main thread free. Worker parses headings via lightweight regex `^(#{1,6})\s+(.+)$` on lines (good enough; full parser already used for index). Returns `{ depth, text, line }[]`.

Scroll spy uses `IntersectionObserver` against rendered headings in preview OR editor line ranges.

## Layout

```
┌──── Rail ────┬──── Editor + Preview ────┬── MetaPanel (320px) ──┐
│              │                          │ Outline               │
│              │                          │ Backlinks             │
│              │                          │ Recents               │
│              │                          │ AI (stub)             │
└──────────────┴──────────────────────────┴───────────────────────┘
```

Below 1024 px → MetaPanel becomes a collapsible drawer-like overlay (not a real F07 drawer).

## Library choices

| Concern         | Library                |
| --------------- | ---------------------- |
| Worker pattern  | `Worker` + `Comlink`   |
| Virtualization  | `@tanstack/react-virtual` for backlinks (only when > 30 items) |
