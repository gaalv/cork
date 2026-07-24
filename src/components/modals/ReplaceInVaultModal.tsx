/**
 * Find & replace across every note body in the vault.
 *
 * Two-step flow: "Find" runs a dry-run count, then "Replace all" applies the
 * substitution. Frontmatter is never touched — only Markdown bodies.
 */

import { useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";
import type { ReplaceResult } from "@/ipc/IpcContract";

export function ReplaceInVaultModal() {
  const open = useShellStore((s) => s.replaceOpen);
  const close = useShellStore((s) => s.setReplaceOpen);
  const loadNotes = useVaultStore((s) => s.loadNotes);

  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [preview, setPreview] = useState<ReplaceResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFind("");
    setReplaceWith("");
    setPreview(null);
    setBusy(false);
  };

  const runPreview = async () => {
    if (!find) return;
    setBusy(true);
    try {
      const result = (await client.notes.replaceInVault(
        find,
        replaceWith,
        caseSensitive,
        false,
      )) as ReplaceResult;
      setPreview(result);
    } catch {
      toast.error("Search failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!find || !preview || preview.total === 0) return;
    setBusy(true);
    try {
      const result = (await client.notes.replaceInVault(
        find,
        replaceWith,
        caseSensitive,
        true,
      )) as ReplaceResult;
      await loadNotes();
      toast.success(
        `Replaced ${result.total} occurrence${result.total === 1 ? "" : "s"} in ${result.files.length} note${result.files.length === 1 ? "" : "s"}`,
      );
      close(false);
      reset();
    } catch {
      toast.error("Replace failed");
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={() => {
        close(false);
        reset();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={16} className="text-[var(--color-cork-accent)]" />
            <h2 className="text-[14px] font-semibold">Replace in vault</h2>
          </div>
          <button
            onClick={() => {
              close(false);
              reset();
            }}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <input
            autoFocus
            value={find}
            onChange={(e) => {
              setFind(e.target.value);
              setPreview(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runPreview();
            }}
            placeholder="Find…"
            className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
          />
          <input
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="Replace with…"
            className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
          />
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-cork-muted)]">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => {
                setCaseSensitive(e.target.checked);
                setPreview(null);
              }}
            />
            Case sensitive
          </label>
        </div>

        {preview && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-cork-border)] px-5 py-3">
            {preview.total === 0 ? (
              <p className="text-[12px] text-[var(--color-cork-subtle)]">No matches found.</p>
            ) : (
              <>
                <p className="mb-2 text-[12px] text-[var(--color-cork-muted)]">
                  {preview.total} match{preview.total === 1 ? "" : "es"} in {preview.files.length}{" "}
                  note{preview.files.length === 1 ? "" : "s"}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {preview.files.map((f) => (
                    <li
                      key={f.path}
                      className="flex items-center gap-2 rounded px-2 py-1 text-[12px] text-[var(--color-cork-ink)]"
                    >
                      <span className="truncate">{f.title}</span>
                      {f.folder && (
                        <span className="shrink-0 text-[10px] text-[var(--color-cork-subtle)]">
                          {f.folder}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 rounded bg-[var(--color-cork-panel-2)] px-1.5 text-[10px] text-[var(--color-cork-muted)]">
                        {f.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-cork-border)] px-5 py-3">
          <button
            onClick={() => void runPreview()}
            disabled={!find || busy}
            className="rounded-full border border-[var(--color-cork-border)] px-4 py-1.5 text-[12px] font-medium text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)] disabled:opacity-50"
          >
            Find
          </button>
          <button
            onClick={() => void apply()}
            disabled={!preview || preview.total === 0 || busy}
            className="rounded-full bg-[var(--color-cork-ink)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Replace all
          </button>
        </div>
      </div>
    </div>
  );
}
