import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, Tag } from "@phosphor-icons/react";

import { enrichNotes, type EnrichedNote } from "@/features/notes/services/enrichNotes";
import { useShellStore } from "@/features/shell/state/shellStore";
import {
  triageScopeLabel,
  useTriageStore,
  type TriageSelection,
} from "@/features/shell/state/triageStore";
import { useTriageOverlayStore } from "@/features/shell/state/triageOverlayStore";
import { client } from "@/shared/ipc/client";
import { cn } from "@/shared/utils/cn";

import type { NoteEntry } from "@/shared/ipc/types";

export function ListPane() {
  const selection = useTriageStore((state) => state.selection);
  const view = useShellStore((state) => state.view);
  const navigate = useShellStore((state) => state.navigate);
  const overlayKind = useTriageOverlayStore((state) => state.kind);
  const openPalette = useShellStore((state) => state.openPalette);
  const [notes, setNotes] = useState<EnrichedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 100);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadList(selection)
      .then(async (list) => {
        const enriched = await enrichNotes(list);
        if (!cancelled) setNotes(enriched);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(debouncedSearch) ||
        n.snippet.toLowerCase().includes(debouncedSearch),
    );
  }, [notes, debouncedSearch]);

  // Auto-select the first note when nothing is open or current note left the list,
  // unless an overlay is open (don't steal focus from a tool modal).
  useEffect(() => {
    if (loading || overlayKind || filtered.length === 0) return;
    const activeId = view.kind === "note" ? view.id : null;
    const stillVisible = activeId ? filtered.some((n) => n.id === activeId) : false;
    if (!activeId || !stillVisible) {
      navigate({ kind: "note", id: filtered[0].id });
    }
  }, [filtered, loading, navigate, overlayKind, view]);

  const activeId = view.kind === "note" ? view.id : null;

  return (
    <section
      data-testid="triage-list-pane"
      className="flex h-full min-w-0 flex-col bg-[var(--color-noxe-panel)]"
      aria-label="Triage notes list"
    >
      <header className="flex h-12 items-center gap-2 border-b border-[var(--color-noxe-border)] px-3">
        <label className="flex flex-1 items-center gap-2 rounded-md bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5">
          <MagnifyingGlass size={14} className="text-[var(--color-noxe-muted)]" />
          <input
            data-testid="triage-list-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Search this view…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-noxe-subtle)]"
          />
          <button
            type="button"
            onClick={() => openPalette()}
            className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-1 text-[10px] font-medium text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
            title="Open command palette"
          >
            ⌘K
          </button>
        </label>
      </header>

      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-xs text-[var(--color-noxe-muted)]">
        <span data-testid="triage-list-count">
          {triageScopeLabel(selection)} · {filtered.length}{" "}
          {filtered.length === 1 ? "note" : "notes"}
        </span>
        <span>Updated ▾</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-xs text-[var(--color-noxe-muted)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-xs text-[var(--color-noxe-muted)]">No notes here yet.</p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  data-testid={`triage-list-row-${note.id}`}
                  onClick={() => navigate({ kind: "note", id: note.id })}
                  className={cn(
                    "flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition",
                    activeId === note.id
                      ? "border-[var(--color-noxe-accent)] bg-[var(--color-noxe-accent-soft)]"
                      : "border-transparent hover:bg-[var(--color-noxe-panel-2)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-noxe-ink)]">
                      {note.title || "Untitled"}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-noxe-subtle)]">
                      {formatTime(note.mtime)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[13px] text-[var(--color-noxe-muted)]">
                    {note.snippet}
                  </p>
                  {note.tags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {note.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-0.5 rounded bg-[var(--color-noxe-tag-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-tag)]"
                        >
                          <Tag size={9} weight="fill" />
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

async function loadList(selection: TriageSelection): Promise<NoteEntry[]> {
  switch (selection.kind) {
    case "shortcut": {
      if (selection.id === "pinned") {
        try {
          return await client.notes.starred();
        } catch {
          return [];
        }
      }
      if (selection.id === "recent") return client.notes.recent(200);
      const all = await client.notes.allPaged(0, 500);
      return all.filter((n) => !n.folder).sort((a, b) => b.mtime - a.mtime);
    }
    case "folder": {
      const all = await client.notes.allPaged(0, 1000);
      const prefix = selection.path ? selection.path + "/" : "";
      return all
        .filter((n) =>
          selection.path ? n.folder === selection.path || n.folder.startsWith(prefix) : !n.folder,
        )
        .sort((a, b) => b.mtime - a.mtime);
    }
    case "tag":
      try {
        return await client.notes.byTag(selection.tag);
      } catch {
        return [];
      }
  }
}

function formatTime(mtime: number): string {
  const d = new Date(mtime);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toTimeString().slice(0, 5);
  }
  const ms = Date.now() - mtime;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}
