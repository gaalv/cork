import { useEffect, useState } from "react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { vcsClient } from "@/features/vcs/services/vcsClient";
import { client } from "@/shared/ipc/client";

import type { CommitEntry } from "@/shared/ipc/types";

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

type NoteHistoryProps = {
  notePath: string | null;
  noteId: string | null;
};

export function NoteHistory({ notePath, noteId }: NoteHistoryProps) {
  const [entries, setEntries] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGit, setHasGit] = useState(true);
  const [confirmSha, setConfirmSha] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const openBuffer = useEditorStore((state) => state.openBuffer);

  useEffect(() => {
    let cancelled = false;
    if (!notePath) {
      setEntries([]);
      return;
    }
    setLoading(true);
    void Promise.all([
      vcsClient.history(notePath, 30),
      vcsClient.status(),
    ])
      .then(([history, status]) => {
        if (!cancelled) {
          setEntries(history);
          setHasGit(status.hasGit);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notePath]);

  async function handleRestore(sha: string) {
    if (!notePath || !noteId) return;
    setRestoring(true);
    try {
      await vcsClient.restore(notePath, sha);
      const file = await client.notes.read(notePath);
      openBuffer({ noteId, file });
      const updated = await vcsClient.history(notePath, 30);
      setEntries(updated);
    } catch (err) {
      console.error("noxe vcs: restore failed", err);
    } finally {
      setRestoring(false);
      setConfirmSha(null);
    }
  }

  if (!hasGit) {
    return (
      <section aria-labelledby="note-history-heading" className="space-y-2">
        <h2 id="note-history-heading" className="text-sm font-semibold">
          Version History
        </h2>
        <p className="text-sm text-[var(--color-noxe-muted)]">
          Install git to enable version history.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="note-history-heading" className="space-y-2">
      <h2 id="note-history-heading" className="text-sm font-semibold">
        Version History
      </h2>

      {loading && (
        <p className="text-sm text-[var(--color-noxe-muted)]">Loading…</p>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-sm text-[var(--color-noxe-muted)]">
          No history yet. Save the note to create the first version.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li
              key={entry.sha}
              className="rounded-md px-2 py-1.5 hover:bg-[var(--color-noxe-panel-2)]"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{entry.message}</p>
                  <p className="text-xs text-[var(--color-noxe-muted)]">
                    {formatRelativeTime(entry.isoDate)} · {entry.shortSha}
                  </p>
                </div>

                {confirmSha === entry.sha ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={() => void handleRestore(entry.sha)}
                      className="rounded bg-[var(--color-noxe-accent)] px-2 py-0.5 text-xs text-white disabled:opacity-60"
                    >
                      {restoring ? "…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSha(null)}
                      className="rounded border border-[var(--color-noxe-border)] px-2 py-0.5 text-xs"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSha(entry.sha)}
                    className="shrink-0 rounded border border-[var(--color-noxe-border)] px-2 py-0.5 text-xs hover:bg-[var(--color-noxe-panel-2)]"
                  >
                    Restore
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
