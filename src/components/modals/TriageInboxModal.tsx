/**
 * Inbox triage — one proposal at a time, nothing applied without a decision.
 *
 * Deliberately not a batch "file everything" button: filing is a judgement the
 * user owns, and a wrong bulk move across a whole inbox is tedious to undo.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, FolderSimple, Sparkle, Tag, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useShellStore } from "@/stores/shellStore";
import { applyProposal, inboxNotes, proposeFor, type TriageProposal } from "@/services/inboxTriage";

import type { NoteEntry } from "@/ipc/types";

export function TriageInboxModal() {
  const open = useShellStore((s) => s.triageOpen);
  const setOpen = useShellStore((s) => s.setTriageOpen);

  const [queue, setQueue] = useState<NoteEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [proposal, setProposal] = useState<TriageProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQueue(inboxNotes());
    setIndex(0);
    setFiled(0);
    setProposal(null);
    setError(null);
  }, [open]);

  const current = queue[index];

  // Ask for a proposal whenever the queue advances.
  useEffect(() => {
    if (!open || !current) return;
    let cancelled = false;
    setLoading(true);
    setProposal(null);
    setError(null);

    void proposeFor(current)
      .then((result) => {
        if (cancelled) return;
        if (!result) setError("The model did not return a usable suggestion for this note.");
        else setProposal(result);
      })
      .catch((err: { kind?: string; message?: string }) => {
        if (cancelled) return;
        setError(
          err.kind === "provider_disabled"
            ? "Configure an AI provider in Settings to triage the Inbox."
            : (err.message ?? "Could not read this note."),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, current]);

  const advance = useCallback(() => setIndex((i) => i + 1), []);

  const accept = useCallback(async () => {
    if (!proposal) return;
    setLoading(true);
    try {
      await applyProposal(proposal);
      setFiled((n) => n + 1);
      advance();
    } catch (err) {
      toast.error(`Could not file the note: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [proposal, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const done = !current;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkle size={15} className="text-[var(--color-cork-muted)]" />
            <span className="text-[13px] font-medium">Triage the Inbox</span>
          </div>
          <div className="flex items-center gap-3">
            {!done && (
              <span className="text-[11px] text-[var(--color-cork-subtle)]">
                {index + 1} of {queue.length}
              </span>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-[var(--color-cork-subtle)] hover:text-[var(--color-cork-ink)]"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {done ? (
            <div className="py-6 text-center">
              <p className="text-[14px] font-medium text-[var(--color-cork-ink)]">
                {queue.length === 0 ? "Your Inbox is empty." : "Inbox triaged."}
              </p>
              {filed > 0 && (
                <p className="mt-1 text-[12px] text-[var(--color-cork-muted)]">
                  {filed} {filed === 1 ? "note" : "notes"} filed.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="truncate text-[14px] font-medium text-[var(--color-cork-ink)]">
                {current.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--color-cork-muted)]">
                {current.snippet || "No preview available."}
              </p>

              <div className="mt-4 min-h-[86px] rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2.5">
                {loading && (
                  <p className="text-[12px] text-[var(--color-cork-muted)]">Reading the note…</p>
                )}
                {error && <p className="text-[12px] text-[var(--color-cork-danger)]">{error}</p>}
                {proposal && !loading && (
                  <div className="flex flex-col gap-2">
                    <Row
                      icon={<FolderSimple size={13} />}
                      label="Folder"
                      value={
                        proposal.folder
                          ? proposal.folder + (proposal.folderIsNew ? "  (new)" : "")
                          : "Leave in the Inbox"
                      }
                    />
                    <Row
                      icon={<Tag size={13} />}
                      label="Tags"
                      value={proposal.tags.length > 0 ? proposal.tags.join(", ") : "None"}
                    />
                    {proposal.retitle && (
                      <Row icon={<Sparkle size={13} />} label="Title" value={proposal.title} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!done && (
          <div className="flex items-center justify-between border-t border-[var(--color-cork-border)] px-4 py-3">
            <button
              onClick={advance}
              className="rounded-md px-2 py-1 text-[12px] text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)]"
            >
              Skip
            </button>
            <button
              onClick={() => void accept()}
              disabled={!proposal || loading}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-cork-ink)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-cork-primary-foreground)] hover:opacity-90 disabled:opacity-40"
            >
              <Check size={12} weight="bold" />
              File it
              <ArrowRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="text-[var(--color-cork-subtle)]">{icon}</span>
      <span className="w-12 shrink-0 text-[var(--color-cork-subtle)]">{label}</span>
      <span className="truncate text-[var(--color-cork-ink)]">{value}</span>
    </div>
  );
}
