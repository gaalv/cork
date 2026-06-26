/**
 * NewFolderDialog — small modal to create a new folder.
 *
 * @see F08 — Folder Management spec
 */

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

import { validateFolderName } from "@/features/folder-ops/services/folderOps";

export function NewFolderDialog({
  parent,
  open,
  onClose,
  onCreate,
}: {
  parent: string;
  open: boolean;
  onClose: () => void;
  onCreate: (parent: string, name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    const err = validateFolderName(trimmed);
    if (err) {
      setError(err);
      return;
    }
    await onCreate(parent, trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-cork-ink)]/30"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-4 py-3">
          <h3 className="text-[14px] font-semibold">New folder</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-4 py-3">
          {parent && (
            <p className="mb-2 text-[12px] text-[var(--color-cork-muted)]">
              Inside <span className="font-medium">{parent}</span>
            </p>
          )}
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") onClose();
            }}
            placeholder="Folder name"
            className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)]"
          />
          {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end border-t border-[var(--color-cork-border)] px-4 py-3">
          <button
            onClick={() => void handleCreate()}
            disabled={!name.trim()}
            className="rounded-full bg-[var(--color-cork-ink)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
