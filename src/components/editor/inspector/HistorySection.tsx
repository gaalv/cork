import { useCallback, useEffect, useState } from "react";
import { ClockCounterClockwise, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useEditorStore } from "@/stores/editorStore";
import { client } from "@/ipc/client";
import { runAiSkill } from "@/services/aiRunner";
import type { CommitEntry } from "@/ipc/types";
import { SectionHeader, formatRelative } from "./helpers";

export function HistorySection() {
  const path = useEditorStore((s) => s.path);
  const noteId = useEditorStore((s) => s.noteId);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [hasGit, setHasGit] = useState(true);
  const [confirmingSha, setConfirmingSha] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    void client.vcs
      .status()
      .then((s) => setHasGit(s.hasGit))
      .catch(() => setHasGit(false));
  }, []);

  useEffect(() => {
    if (!path) {
      setCommits([]);
      return;
    }
    void client.vcs
      .history(path, 30)
      .then(setCommits)
      .catch(() => setCommits([]));
  }, [path]);

  const handleRestore = useCallback(
    async (sha: string) => {
      if (!path || !noteId) return;
      setRestoring(true);
      try {
        await client.vcs.restore(path, sha);
        await useEditorStore.getState().forceReload();
        setConfirmingSha(null);
      } catch {
        /* restore failed — keep UI as-is */
      } finally {
        setRestoring(false);
      }
    },
    [path, noteId],
  );

  /**
   * Per-note git history is something Cork has and most notes apps do not, so
   * it is worth more than a list of commit subjects: the model turns it into
   * "what happened to this note lately".
   */
  const summarizeHistory = useCallback(async () => {
    if (commits.length === 0) return;
    setSummarizing(true);
    try {
      const store = useEditorStore.getState();
      const title = typeof store.frontmatter.title === "string" ? store.frontmatter.title : noteId;
      const history = commits.map((c) => `${c.isoDate.slice(0, 10)} — ${c.message}`).join("\n");
      const result = (await runAiSkill("summarize-changes", {
        title: title ?? "",
        history,
        body: store.body,
      })) as { output: string };
      setSummary(result.output.trim());
    } catch (err) {
      const error = err as { kind?: string; message?: string };
      if (error.kind === "provider_disabled") toast.error("Configure an AI provider in Settings");
      else toast.error(`Error: ${error.message ?? String(err)}`);
    } finally {
      setSummarizing(false);
    }
  }, [commits, noteId]);

  if (!hasGit) {
    return (
      <section>
        <SectionHeader icon={<ClockCounterClockwise size={14} />} title="History" />
        <p className="text-[11px] text-[var(--color-cork-subtle)]">
          Install git to enable history.
        </p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        icon={<ClockCounterClockwise size={14} />}
        title={`History (${commits.length})`}
      />
      {commits.length === 0 && (
        <p className="text-[11px] text-[var(--color-cork-subtle)]">No history yet.</p>
      )}

      {commits.length > 1 && (
        <button
          onClick={() => void summarizeHistory()}
          disabled={summarizing}
          className="mb-1.5 flex items-center gap-1.5 rounded-md border border-[var(--color-cork-border)] px-2 py-1 text-[11px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)] disabled:opacity-50"
        >
          {summarizing ? (
            <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Sparkle size={12} />
          )}
          What changed
        </button>
      )}

      {summary && (
        <p className="mb-2 rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--color-cork-muted)]">
          {summary}
        </p>
      )}
      {commits.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {commits.map((c) => (
            <div
              key={c.sha}
              className="group flex items-center gap-2 rounded px-2 py-1 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.message}</p>
                <p className="text-[10px] text-[var(--color-cork-subtle)]">
                  {formatRelative(new Date(c.isoDate).getTime())}{" "}
                  <span className="font-mono">{c.shortSha}</span>
                </p>
              </div>

              {confirmingSha === c.sha ? (
                <span className="flex shrink-0 items-center gap-1 text-[10px]">
                  <button
                    disabled={restoring}
                    onClick={() => void handleRestore(c.sha)}
                    className="font-semibold text-[var(--color-cork-accent)] hover:underline disabled:opacity-50"
                  >
                    {restoring ? "..." : "Yes"}
                  </button>
                  <span className="text-[var(--color-cork-subtle)]">/</span>
                  <button
                    onClick={() => setConfirmingSha(null)}
                    className="text-[var(--color-cork-muted)] hover:underline"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmingSha(c.sha)}
                  className="shrink-0 text-[10px] text-[var(--color-cork-muted)] opacity-0 hover:text-[var(--color-cork-accent)] group-hover:opacity-100"
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
