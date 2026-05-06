import { autocompletion, CompletionContext } from "@codemirror/autocomplete";

import { useIndexStore } from "@/features/index/state/indexStore";

import type { Completion, CompletionResult } from "@codemirror/autocomplete";

export const wikilinkAutocomplete = autocompletion({ override: [wikilinkCompletionSource] });

export function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\[\[[^\]]*/);
  if (!before || (before.from === before.to && !context.explicit)) {
    return null;
  }
  const query = before.text.slice(2).toLowerCase();
  const notes = useIndexStore.getState().recentNotes;
  const options: Completion[] = notes
    .filter((note) => note.title.toLowerCase().includes(query))
    .slice(0, 8)
    .map((note) => ({ label: note.title, detail: note.path, apply: `[[${note.title}]]` }));
  return { from: before.from, to: before.to, options, filter: false };
}
