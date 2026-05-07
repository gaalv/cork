import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";

type TagsFieldProps = {
  noteId: string | null;
};

function readTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? normalize(entry) : null))
      .filter((entry): entry is string => Boolean(entry));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => normalize(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  return [];
}

function normalize(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#+/, "").trim();
  if (!trimmed) {
    return null;
  }
  if (/\s/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function TagsField({ noteId }: TagsFieldProps) {
  const buffer = useEditorStore((state) => (noteId ? state.buffers.get(noteId) ?? null : null));
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!noteId || !buffer) {
    return null;
  }

  const tags = readTags(buffer.frontmatter.tags);

  function commit(raw: string) {
    if (!noteId) {
      return;
    }
    const value = normalize(raw);
    if (!value) {
      setError("Tags can't contain spaces.");
      return;
    }
    if (tags.includes(value)) {
      setError("Tag already added.");
      return;
    }
    setError(null);
    updateFrontmatter(noteId, { tags: [...tags, value] });
    setDraft("");
  }

  function remove(tag: string) {
    if (!noteId) {
      return;
    }
    const next = tags.filter((entry) => entry !== tag);
    updateFrontmatter(noteId, { tags: next });
  }

  return (
    <section aria-label="Tags" className="space-y-1.5">
      <h3 className="text-xs font-medium text-[var(--color-noxe-muted)]">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-noxe-tag-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-noxe-tag)]"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 text-[var(--color-noxe-tag)] hover:bg-black/10"
              onClick={() => remove(tag)}
            >
              <X size={10} weight="bold" />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          commit(draft);
        }}
      >
        <input
          type="text"
          aria-label="New tag"
          placeholder="Add tag…"
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            if (error) {
              setError(null);
            }
          }}
          className="flex-1 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-2 py-1 text-xs text-[var(--color-noxe-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)]"
        />
        <button
          type="submit"
          aria-label="Add tag"
          className="rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-1 text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
        >
          <Plus size={12} weight="bold" />
        </button>
      </form>
      {error ? <p className="text-[11px] text-red-500">{error}</p> : null}
    </section>
  );
}
