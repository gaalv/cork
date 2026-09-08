/**
 * Ask a question and get an answer from your own notes.
 *
 * Retrieval is the SQLite FTS5 index, not embeddings: for a vault of this size
 * keyword search finds the right notes, costs nothing to maintain, and keeps
 * a second index from having to be held in sync with the file watcher. The
 * model only reads the excerpts and is required to cite them, so an answer can
 * always be traced back to a note.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkle, X } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { useShellStore } from "@/stores/shellStore";
import { keyTerms } from "@/services/aiVault";
import { runAiSkill } from "@/services/aiRunner";

import type { SearchResult } from "@/ipc/IpcContract";

/** Enough context to answer from, without blowing the skill's token budget. */
const MAX_NOTES = 8;
const MAX_CHARS_PER_NOTE = 1800;

export function AskVaultModal() {
  const open = useShellStore((s) => s.askVaultOpen);
  const setOpen = useShellStore((s) => s.setAskVaultOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const ask = useCallback(async () => {
    const value = question.trim();
    if (!value || loading) return;

    setLoading(true);
    setAnswer(null);
    setError(null);
    setSources([]);

    try {
      // Search the phrase itself first, then its distinctive terms — a natural
      // question rarely matches verbatim, but its nouns do.
      const queries = [value, ...keyTerms(value, 5)];
      const results = await Promise.all(
        queries.map((q) =>
          client.index
            .search(q, 8)
            .then((r) => r as SearchResult[])
            .catch(() => [] as SearchResult[]),
        ),
      );

      const seen = new Map<string, SearchResult>();
      for (const list of results) {
        for (const hit of list) if (!seen.has(hit.id)) seen.set(hit.id, hit);
      }
      const picked = [...seen.values()].slice(0, MAX_NOTES);

      if (picked.length === 0) {
        setError("Nothing in the vault matches that yet.");
        return;
      }

      const bodies = await Promise.all(
        picked.map(async (note) => {
          try {
            const file = await client.notes.read(note.path);
            const body = (file as { body: string }).body;
            return `### ${note.title}\n${body.slice(0, MAX_CHARS_PER_NOTE)}`;
          } catch {
            return `### ${note.title}\n${note.snippet}`;
          }
        }),
      );

      const result = (await runAiSkill("ask-vault", {
        question: value,
        excerpts: bodies.join("\n\n"),
      })) as { output: string };

      setAnswer(result.output.trim());
      setSources(picked);
    } catch (err) {
      const e = err as { kind?: string; message?: string };
      setError(
        e.kind === "provider_disabled"
          ? "Configure an AI provider in Settings to ask your vault."
          : (e.message ?? String(err)),
      );
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  if (!open) return null;

  const openSource = (note: SearchResult) => {
    useShellStore.getState().openNote(note.id);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-cork-border)] px-4 py-3">
          <Sparkle size={15} className="shrink-0 text-[var(--color-cork-muted)]" />
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            placeholder="Ask your vault…"
            className="flex-1 bg-transparent text-[14px] text-[var(--color-cork-ink)] outline-none placeholder:text-[var(--color-cork-subtle)]"
          />
          <button
            onClick={() => void ask()}
            disabled={loading || question.trim().length === 0}
            aria-label="Ask"
            className="rounded-md p-1 text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)] disabled:opacity-40"
          >
            {loading ? (
              <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowRight size={14} weight="bold" />
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--color-cork-subtle)] hover:text-[var(--color-cork-ink)]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!answer && !error && !loading && (
            <p className="text-[12px] leading-relaxed text-[var(--color-cork-subtle)]">
              Answers come only from your notes, and cite the ones they used. Nothing is sent
              anywhere — the model runs on your machine.
            </p>
          )}
          {loading && (
            <p className="text-[12px] text-[var(--color-cork-muted)]">Reading your notes…</p>
          )}
          {error && <p className="text-[12px] text-[var(--color-cork-danger)]">{error}</p>}
          {answer && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--color-cork-ink)]">
              {answer}
            </p>
          )}

          {sources.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-cork-border)] pt-3">
              <p className="mb-1.5 text-[11px] font-medium text-[var(--color-cork-muted)]">
                Read from
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => openSource(note)}
                    className="rounded-full border border-[var(--color-cork-border)] px-2 py-0.5 text-[11px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
                  >
                    {note.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
