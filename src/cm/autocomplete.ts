/**
 * Wikilink autocomplete for CodeMirror.
 *
 * - `[[` triggers note title completion
 *
 * @see F05 — Editor spec
 */

import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { useVaultStore } from "@/stores/vaultStore";

export function wikilinkCompletion(context: CompletionContext): CompletionResult | null {
  // Match `[[` followed by partial text
  const match = context.matchBefore(/\[\[([^\]]*)/);
  if (!match) return null;

  const query = match.text.slice(2).toLowerCase();
  const notes = useVaultStore.getState().notes;

  const filtered = notes
    .filter((n) => n.title.toLowerCase().includes(query))
    .slice(0, 8)
    .map((n) => ({
      label: n.title,
      apply: `[[${n.title}]]`,
      detail: n.folder || "Inbox",
    }));

  if (filtered.length === 0) return null;

  return {
    from: match.from,
    options: filtered,
    filter: false,
  };
}
