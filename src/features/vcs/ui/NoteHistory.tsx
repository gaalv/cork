import { useEffect, useState } from "react";
import { ArrowCounterClockwise, ClockCounterClockwise } from "@phosphor-icons/react";

import { SectionHeader } from "@/features/note-view/ui/SectionHeader";
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
    void Promise.all([vcsClient.history(notePath, 30), vcsClient.status()])
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
      <section aria-labelledby="note-history-heading" className="space-y-1.5">
        <SectionHeader
          id="note-history-heading"
          icon={<ClockCounterClockwise size={14} />}
          label="History"
        />
        <p className="px-1 text-xs text-[var(--color-noxe-muted)]">
          Install git to enable version history.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="note-history-heading" className="space-y-1.5">
      <SectionHeader
        id="note-history-heading"
        icon={<ClockCounterClockwise size={14} />}
        label="History"
      />

      {loading && <p className="px-1 text-xs text-[var(--color-noxe-muted)]">Loading…</p>}

      {!loading && entries.length === 0 && (
        <p className="px-1 text-xs text-[var(--color-noxe-muted)]">
          No versions yet. Save to start tracking.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <ul className="space-y-px">
          {entries.map((entry) => (
            <li
              key={entry.sha}
              className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--color-noxe-panel-2)]"
            >
              <span className="text-[10px] font-mono text-[var(--color-noxe-subtle)]">
                {entry.shortSha}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-noxe-ink)]"
                title={entry.message}
              >
                {entry.message}
              </span>
              <span className="shrink-0 text-[10px] text-[var(--color-noxe-muted)]">
                {formatRelativeTime(entry.isoDate)}
              </span>

              {confirmSha === entry.sha ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={() => void handleRestore(entry.sha)}
                    className="rounded bg-[var(--color-noxe-accent)] px-1.5 py-0.5 text-[10px] text-white disabled:opacity-60"
                  >
                    {restoring ? "…" : "Yes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSha(null)}
                    className="rounded border border-[var(--color-noxe-border)] px-1.5 py-0.5 text-[10px]"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSha(entry.sha)}
                  aria-label={`Restore version ${entry.shortSha}`}
                  title="Restore this version"
                  className="shrink-0 rounded p-1 text-[var(--color-noxe-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-noxe-bg)] hover:text-[var(--color-noxe-ink)]"
                >
                  <ArrowCounterClockwise size={12} weight="bold" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
