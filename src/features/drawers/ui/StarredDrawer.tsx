import { Star } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

type StarredDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function StarredDrawer({ onOpenNote }: StarredDrawerProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlistenChanged: (() => void) | undefined;
    let unlistenIndexed: (() => void) | undefined;
    let seq = 0;

    const load = async () => {
      const ticket = ++seq;
      try {
        if (ticket === 1) setIsLoading(true);
        const starred = await client.notes.starred();
        if (cancelled || ticket !== seq) return;
        setNotes(starred);
        setError(null);
      } catch (loadError) {
        if (cancelled || ticket !== seq) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load starred notes");
      } finally {
        if (!cancelled && ticket === seq) {
          setIsLoading(false);
        }
      }
    };

    void load();
    void client.events
      .on("vault:fileChanged", () => void load())
      .then((un) => {
        if (cancelled) un();
        else unlistenChanged = un;
      })
      .catch(() => undefined);
    void client.events
      .on("index:updated", () => void load())
      .then((un) => {
        if (cancelled) un();
        else unlistenIndexed = un;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlistenChanged?.();
      unlistenIndexed?.();
    };
  }, []);

  if (isLoading) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">Loading starred notes…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (notes.length === 0) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">Star a note to see it here.</p>;
  }

  return (
    <section role="region" aria-label="Starred drawer" className="space-y-1 text-sm">
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpenNote?.(note.id)}
          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--color-noxe-panel-2)]"
        >
          <Star size={14} weight="fill" className="mt-0.5 shrink-0 text-yellow-500" />
          <span className="min-w-0">
            <span className="block truncate text-[var(--color-noxe-ink)]">{note.title}</span>
            <span className="block truncate text-[11px] text-[var(--color-noxe-muted)]">{note.folder || "Root"}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
