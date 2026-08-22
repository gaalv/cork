/**
 * Results panel for the vault-aware AI skills.
 *
 * These skills answer with references to other notes rather than prose, so the
 * result is actionable: a suggested link can be inserted, an overlapping note
 * can be opened. Showing them in a toast, the way the older skills do, would
 * throw that away.
 */

import { ArrowUpRight, Plus, X } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";

export type Suggestion = { title: string; detail: string };

export function AiSuggestions({
  kind,
  items,
  onDismiss,
}: {
  kind: "links" | "overlap";
  items: Suggestion[];
  onDismiss: () => void;
}) {
  const openNote = (title: string) => {
    const note = useVaultStore
      .getState()
      .notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (note) useShellStore.getState().openNote(note.id);
  };

  /**
   * Turns the quoted phrase into a link in place. Falls back to appending when
   * the phrase can't be found — the model quotes from a truncated body, so an
   * exact match is likely but not guaranteed.
   */
  const insertLink = (suggestion: Suggestion) => {
    const store = useEditorStore.getState();
    const body = store.body;
    const phrase = suggestion.detail;
    const link = `[[${suggestion.title}]]`;

    if (phrase && body.includes(phrase)) {
      store.updateBody(body.replace(phrase, `[[${suggestion.title}|${phrase}]]`));
    } else {
      store.updateBody(`${body.trimEnd()}\n\n${link}\n`);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] p-2">
      <div className="flex items-center justify-between px-0.5 pb-1.5">
        <span className="text-[11px] font-medium text-[var(--color-cork-muted)]">
          {kind === "links" ? "Suggested links" : "Possible duplicates"}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss suggestions"
          className="rounded p-0.5 text-[var(--color-cork-subtle)] hover:text-[var(--color-cork-ink)]"
        >
          <X size={11} weight="bold" />
        </button>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={`${item.title}-${item.detail}`}
            className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-2 py-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => openNote(item.title)}
                className="flex-1 text-left text-[12px] font-medium text-[var(--color-cork-ink)] hover:underline"
              >
                {item.title}
              </button>
              {kind === "links" ? (
                <button
                  onClick={() => insertLink(item)}
                  title="Insert link"
                  className="shrink-0 rounded p-0.5 text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
                >
                  <Plus size={12} weight="bold" />
                </button>
              ) : (
                <ArrowUpRight
                  size={12}
                  className="mt-0.5 shrink-0 text-[var(--color-cork-subtle)]"
                />
              )}
            </div>
            {item.detail && (
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-cork-muted)]">
                {kind === "links" ? `“${item.detail}”` : item.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
