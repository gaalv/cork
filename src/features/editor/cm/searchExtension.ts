import { closeSearchPanel, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { EditorView, keymap } from "@codemirror/view";

import type { Extension } from "@codemirror/state";

export function createSearchExtension(): Extension[] {
  return [
    search({ top: false }),
    EditorView.theme({
      ".cm-search": {
        backgroundColor: "var(--color-noxe-panel)",
        borderTop: "1px solid var(--color-noxe-border)",
        color: "var(--color-noxe-ink)",
        padding: "8px",
      },
      ".cm-search input": {
        backgroundColor: "var(--color-noxe-panel-2)",
        border: "1px solid var(--color-noxe-border)",
        borderRadius: "8px",
        color: "var(--color-noxe-ink)",
        padding: "4px 8px",
      },
      ".cm-search button": {
        border: "1px solid var(--color-noxe-border)",
        borderRadius: "8px",
        color: "var(--color-noxe-ink)",
        padding: "4px 8px",
      },
      ".cm-searchMatch": {
        backgroundColor: "rgba(250, 204, 21, 0.35)",
      },
      ".cm-searchMatch-selected": {
        backgroundColor: "rgba(251, 146, 60, 0.55)",
      },
    }),
    keymap.of([
      ...searchKeymap,
      { key: "Mod-f", run: openSearchPanel },
      { key: "Mod-Shift-f", run: openSearchPanel },
      { key: "Escape", run: closeSearchPanel },
    ]),
    EditorView.domEventHandlers({
      keydown(event, view) {
        if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          return openSearchPanel(view);
        }
        if (event.key === "Escape") {
          return closeSearchPanel(view);
        }
        return false;
      },
    }),
  ];
}

export const searchExtension: Extension = createSearchExtension();
