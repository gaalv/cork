import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";

import { useTagTree } from "@/features/drawers/hooks/useTagTree";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useVaultSettingsStore, normalizeTagName } from "@/features/settings/state/vaultSettingsStore";
import { client } from "@/shared/ipc/client";

import { TagNode } from "./TagNode";

import type { NoteEntry } from "@/shared/ipc/types";

type TagsDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function TagsDrawer({ onOpenNote }: TagsDrawerProps) {
  const { tree, isLoading, error } = useTagTree();
  const selectedTag = useDrawersStore((state) => state.selectedTag);
  const selectTag = useDrawersStore((state) => state.selectTag);
  const libraryTags = useVaultSettingsStore((state) => state.settings.tagLibrary);
  const addLibraryTag = useVaultSettingsStore((state) => state.addLibraryTag);
  const removeLibraryTag = useVaultSettingsStore((state) => state.removeLibraryTag);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTag) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    void client.notes.byTag(selectedTag).then((nextNotes) => {
      if (!cancelled) {
        setNotes(nextNotes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTag]);

  const librarySet = useMemo(() => new Set(libraryTags ?? []), [libraryTags]);

  async function submitNewTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const cleaned = normalizeTagName(draftTag);
    if (!cleaned) {
      setCreateError("Enter a tag name (letters, numbers, '-', '/').");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await addLibraryTag(cleaned);
      setDraftTag("");
    } catch (addError) {
      setCreateError(addError instanceof Error ? addError.message : "Failed to add tag");
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">Loading tags…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <section role="region" aria-label="Tags drawer" className="space-y-3 text-sm">
      <form
        onSubmit={(event) => void submitNewTag(event)}
        className="flex items-center gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2 py-1.5"
      >
        <span className="text-[var(--color-noxe-muted)]" aria-hidden="true">#</span>
        <input
          aria-label="New tag name"
          value={draftTag}
          onChange={(event) => {
            setDraftTag(event.target.value);
            setCreateError(null);
          }}
          placeholder="new-tag or area/topic"
          disabled={creating}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[var(--color-noxe-ink)] outline-none placeholder:text-[var(--color-noxe-muted)] focus:outline-none focus:ring-0"
        />
        <button
          type="submit"
          aria-label="Create tag"
          title="Create tag"
          disabled={creating || draftTag.trim().length === 0}
          className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-40"
        >
          <Plus size={14} weight="bold" />
        </button>
      </form>
      {createError ? <p className="text-[11px] text-red-600">{createError}</p> : null}

      {libraryTags && libraryTags.length > 0 && (
        <div>
          <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-noxe-muted)]">Library</h3>
          <ul className="flex flex-wrap gap-1">
            {libraryTags.map((tag) => (
              <li
                key={`lib-${tag}`}
                className="group inline-flex items-center gap-1 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-2 py-0.5 text-[11px] text-[var(--color-noxe-muted)]"
              >
                <button
                  type="button"
                  onClick={() => selectTag(tag)}
                  className="hover:text-[var(--color-noxe-ink)] focus-visible:outline-none"
                >
                  #{tag}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${tag} from library`}
                  title="Remove from library"
                  onClick={() => void removeLibraryTag(tag)}
                  className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-[var(--color-noxe-panel-2)] hover:text-red-500 group-hover:opacity-100"
                >
                  <X size={10} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tree.length === 0 ? (
        <p className="text-sm text-[var(--color-noxe-muted)]">
          No tags yet. Create tags above or add them from the right sidebar of any note.
        </p>
      ) : (
        <ul role="tree" aria-label="Tag tree" className="space-y-0.5">
          {tree.map((node) => (
            <TagNode key={node.tag} node={node} onSelectTag={selectTag} />
          ))}
        </ul>
      )}
      {selectedTag ? (
        <div className="space-y-1 border-t border-[var(--color-noxe-border)] pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-[var(--color-noxe-muted)]">#{selectedTag}</h3>
            {librarySet.has(selectedTag) ? (
              <span className="text-[10px] text-[var(--color-noxe-muted)]">in library</span>
            ) : null}
          </div>
          {notes.length === 0 ? <p className="text-xs text-[var(--color-noxe-muted)]">No notes for this tag.</p> : null}
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpenNote?.(note.id)}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-noxe-panel-2)]"
            >
              {note.title}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
