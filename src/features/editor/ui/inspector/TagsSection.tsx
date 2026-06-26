import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag, X } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useIndexStore } from "@/features/index/state/indexStore";

export function TagsSection() {
  const frontmatter = useEditorStore((s) => s.frontmatter);
  const noteId = useEditorStore((s) => s.noteId);
  const allTags = useIndexStore((s) => s.tags);
  const addTagToNote = useIndexStore((s) => s.addTagToNote);
  const removeTagFromNote = useIndexStore((s) => s.removeTagFromNote);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => {
    if (!Array.isArray(frontmatter.tags)) return [];
    return (frontmatter.tags as string[])
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => (t as string).trim())
      .sort();
  }, [frontmatter]);

  const suggestions = useMemo(() => {
    const query = search.trim().replace(/^#/, "").toLowerCase();
    const existingSet = new Set(tags.map((t) => t.toLowerCase()));
    const available = allTags.map((t) => t.tag).filter((t) => !existingSet.has(t.toLowerCase()));
    if (!query) return available.slice(0, 5);
    return available.filter((t) => t.toLowerCase().includes(query)).slice(0, 5);
  }, [search, allTags, tags]);

  useEffect(() => { setSelectedIndex(0); }, [suggestions]);
  useEffect(() => { if (picking) inputRef.current?.focus(); }, [picking]);

  const handleAdd = useCallback((tag: string) => {
    const editor = useEditorStore.getState();
    const current = Array.isArray(editor.frontmatter.tags) ? (editor.frontmatter.tags as string[]) : [];
    if (current.some((t) => (t as string).toLowerCase() === tag.toLowerCase())) return;
    editor.updateFrontmatter({ ...editor.frontmatter, tags: [...current, tag] });
    if (noteId) addTagToNote(noteId, tag);
    setSearch("");
    setPicking(false);
  }, [noteId, addTagToNote]);

  const handleRemove = useCallback((tag: string) => {
    const editor = useEditorStore.getState();
    if (!Array.isArray(editor.frontmatter.tags)) return;
    const filtered = (editor.frontmatter.tags as string[]).filter(
      (t) => typeof t === "string" && t.trim().toLowerCase() !== tag.toLowerCase(),
    );
    const updated = { ...editor.frontmatter };
    if (filtered.length > 0) {
      updated.tags = filtered;
    } else {
      delete updated.tags;
    }
    editor.updateFrontmatter(updated);
    if (noteId) removeTagFromNote(noteId, tag);
  }, [noteId, removeTagFromNote]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <header className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cork-muted)]">
          <Tag size={14} />
          Tags
        </header>
        <button onClick={() => setPicking((v) => !v)} className="rounded p-0.5 text-[var(--color-cork-subtle)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]" title="Select tag">
          <Plus size={10} weight="bold" />
        </button>
      </div>
      {tags.length === 0 && !picking && <p className="text-[11px] text-[var(--color-cork-subtle)]">No tags on this note</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="group/tag inline-flex items-center gap-1 rounded-md bg-[var(--color-cork-tag-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-cork-tag)]">
              <Tag size={10} />
              {tag}
              <button onClick={() => handleRemove(tag)} className="ml-0.5 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-[var(--color-cork-tag)]/20 group-hover/tag:opacity-100" title="Remove tag">
                <X size={8} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      {picking && (
        <div className="mt-2">
          <div className="flex items-center gap-1">
            <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (suggestions.length > 0 && selectedIndex < suggestions.length) handleAdd(suggestions[selectedIndex]); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Escape") { setPicking(false); setSearch(""); }
            }} placeholder="Buscar tag…" className="min-w-0 flex-1 rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-0.5 text-[11px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-tag)]" />
            <button onClick={() => { setPicking(false); setSearch(""); }} className="rounded p-0.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"><X size={12} /></button>
          </div>
          {suggestions.length > 0 ? (
            <ul className="mt-1 max-h-[120px] overflow-y-auto rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-0.5">
              {suggestions.map((tag, i) => (
                <li key={tag}><button onClick={() => handleAdd(tag)} onMouseEnter={() => setSelectedIndex(i)} className={`flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] ${i === selectedIndex ? "bg-[var(--color-cork-tag-soft)] text-[var(--color-cork-tag)]" : "text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"}`}><Tag size={10} className="text-[var(--color-cork-tag)]" />{tag}</button></li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 px-1 text-[11px] text-[var(--color-cork-subtle)]">{search.trim() ? "No tags found" : "No tags available"}</p>
          )}
        </div>
      )}
    </section>
  );
}
