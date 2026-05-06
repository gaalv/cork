import { keymap } from "@codemirror/view";
import { closeSearchPanel, openSearchPanel, search, searchKeymap } from "@codemirror/search";

import type { Extension } from "@codemirror/state";

export const searchExtension: Extension = [
  search({ top: true }),
  keymap.of([
    ...searchKeymap,
    { key: "Mod-f", run: openSearchPanel },
    { key: "Mod-Shift-f", run: openSearchPanel },
    { key: "Escape", run: closeSearchPanel },
  ]),
];
