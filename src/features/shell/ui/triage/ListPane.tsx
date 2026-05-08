import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { useShellStore } from "@/features/shell/state/shellStore";
import {
  triageScopeLabel,
  useTriageStore,
  type TriageSelection,
} from "@/features/shell/state/triageStore";
import { client } from "@/shared/ipc/client";
import { cn } from "@/shared/utils/cn";

import type { NoteEntry } from "@/shared/ipc/types";

export function ListPane() {
  const selection = useTriageStore((state) => state.selection);
  const view = useShellStore((state) => state.view);
  const navigate = useShellStore((state) => state.navigate);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
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
      .then((next) => {
        if (!cancelled) setNotes(next);
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
    return notes.filter((n) => n.title.toLowerCase().includes(debouncedSearch));
  }, [notes, debouncedSearch]);

  const activeId = view.kind === "note" ? view.id : null;

  return (
    <section
      data-testid="triage-list-pane"
      className="flex h-full min-w-0 flex-col border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)]"
      aria-label="Triage notes list"
    >
      <header className="flex flex-col gap-2 border-b border-[var(--color-noxe-border)] px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-[var(--color-noxe-ink)]">
            {triageScopeLabel(selection)}
          </h2>
          <span className="text-xs text-[var(--color-noxe-muted)]" data-testid="triage-list-count">
            {filtered.length} {filtered.length === 1 ? "note" : "notes"}
          </span>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2 py-1">
          <MagnifyingGlass size={14} className="text-[var(--color-noxe-muted)]" />
          <input
            data-testid="triage-list-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Filter…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-noxe-muted)]"
          />
        </label>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-xs text-[var(--color-noxe-muted)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-xs text-[var(--color-noxe-muted)]">No notes here yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-noxe-border)]">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  data-testid={`triage-list-row-${note.id}`}
                  onClick={() => navigate({ kind: "note", id: note.id })}
                  className={cn(
                    "block w-full px-3 py-2 text-left transition-colors",
                    activeId === note.id
                      ? "bg-[var(--color-noxe-accent-soft)]"
                      : "hover:bg-[var(--color-noxe-panel-2)]",
                  )}
                >
                  <p className="truncate text-sm font-medium text-[var(--color-noxe-ink)]">
                    {note.title || "Untitled"}
                  </p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[var(--color-noxe-muted)]">
                    <span className="truncate">{note.folder || "Inbox"}</span>
                    <span>{relativeTime(note.mtime)}</span>
                  </p>
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
        .filter((n) => (selection.path ? n.folder === selection.path || n.folder.startsWith(prefix) : !n.folder))
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

function relativeTime(mtime: number): string {
  const ms = Date.now() - mtime;
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}
