import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Check, Plus, X } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useTagTree } from "@/features/drawers/hooks/useTagTree";
import {
  useVaultSettingsStore,
  normalizeTagName,
} from "@/features/settings/state/vaultSettingsStore";

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

function flattenTree(nodes: ReturnType<typeof useTagTree>["tree"]): string[] {
  const result: string[] = [];
  function walk(list: typeof nodes) {
    for (const node of list) {
      result.push(node.tag);
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

export function TagsField({ noteId }: TagsFieldProps) {
  const buffer = useEditorStore((state) => (noteId ? (state.buffers.get(noteId) ?? null) : null));
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const { tree } = useTagTree();
  const addLibraryTag = useVaultSettingsStore((state) => state.addLibraryTag);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const tags = readTags(buffer?.frontmatter.tags);
  const allTags = useMemo(() => Array.from(new Set(flattenTree(tree))).sort(), [tree]);
  const tagSet = useMemo(() => new Set(tags), [tags]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, search]);
  const normalizedSearch = normalizeTagName(search);
  const canCreate = Boolean(normalizedSearch) && !allTags.includes(normalizedSearch);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!noteId || !buffer) {
    return null;
  }

  function toggle(tag: string) {
    if (!noteId) return;
    const next = tagSet.has(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    updateFrontmatter(noteId, { tags: next });
  }

  function remove(tag: string) {
    if (!noteId) return;
    updateFrontmatter(noteId, { tags: tags.filter((t) => t !== tag) });
  }

  async function createAndApply() {
    if (!normalizedSearch || !noteId) return;
    try {
      await addLibraryTag(normalizedSearch);
    } catch {
      // ignore — still apply
    }
    if (!tagSet.has(normalizedSearch)) {
      updateFrontmatter(noteId, { tags: [...tags, normalizedSearch] });
    }
    setSearch("");
  }

  return (
    <section aria-label="Tags" className="space-y-1">
      <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-noxe-subtle)]">Tags</h3>
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
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-2 py-1 text-xs text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <span>Add tag…</span>
          <CaretDown size={12} weight="bold" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-lg">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search or create…"
              aria-label="Search tags"
              className="w-full border-b border-[var(--color-noxe-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-noxe-ink)] outline-none placeholder:text-[var(--color-noxe-muted)]"
            />
            <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 && !canCreate ? (
                <li className="px-2 py-1 text-[11px] text-[var(--color-noxe-muted)]">
                  No tags found.
                </li>
              ) : null}
              {filtered.map((tag) => {
                const checked = tagSet.has(tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(tag)}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
                    >
                      <span className="truncate">#{tag}</span>
                      {checked ? (
                        <Check
                          size={12}
                          weight="bold"
                          className="text-[var(--color-noxe-accent)]"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {canCreate ? (
                <li>
                  <button
                    type="button"
                    onClick={() => void createAndApply()}
                    className="flex w-full items-center gap-2 border-t border-[var(--color-noxe-border)] px-2 py-1 text-left text-xs text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
                  >
                    <Plus size={12} weight="bold" />
                    Create &amp; add &quot;#{normalizedSearch}&quot;
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
