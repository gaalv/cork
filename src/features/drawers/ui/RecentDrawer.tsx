import { useEffect, useMemo, useState } from "react";

import { bucketRecentNotes } from "@/features/drawers/hooks/useRecentBuckets";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

type RecentDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function RecentDrawer({ onOpenNote }: RecentDrawerProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const buckets = useMemo(() => bucketRecentNotes(notes), [notes]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const recent = await client.notes.recent(50);
        if (!cancelled) {
          setNotes(recent);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    void client.events.on("vault.fileChanged", () => void load()).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">Loading recent notes…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (notes.length === 0) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">No recent notes yet.</p>;
  }

  return (
    <section role="region" aria-label="Recent drawer" className="space-y-4 text-sm">
      {buckets.map((bucket) => (
        <div key={bucket.label}>
          <h3 className="mb-1 text-xs font-medium text-[var(--color-noxe-muted)]">{bucket.label}</h3>
          <div className="space-y-0.5">
            {bucket.notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => onOpenNote?.(note.id)}
                className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--color-noxe-panel-2)]"
              >
                <span className="block truncate text-[var(--color-noxe-ink)]">{note.title}</span>
                <span className="block truncate text-[11px] text-[var(--color-noxe-muted)]">{note.folder || "Root"}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load recent notes";
}
