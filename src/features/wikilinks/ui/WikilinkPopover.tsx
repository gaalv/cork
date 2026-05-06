import { useState } from "react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { ReactNode } from "react";

type WikilinkPopoverProps = {
  target: string;
  currentFolder?: string;
  onClose?: () => void;
  children?: ReactNode;
};

export function WikilinkPopover({ target, currentFolder = "", onClose, children }: WikilinkPopoverProps) {
  const navigate = useShellStore((state) => state.navigate);
  const openPalette = useShellStore((state) => state.openPalette);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const [busy, setBusy] = useState<"here" | "root" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createIn(folder: string, mode: "here" | "root") {
    setBusy(mode);
    setError(null);
    try {
      const created = await client.notes.create({ folder, title: target });
      await loadNotes();
      const note = useVaultStore.getState().notes.find((candidate) => candidate.path === created.path);
      if (note) {
        navigate({ kind: "note", id: note.id });
      }
      onClose?.();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`Unresolved wikilink ${target}`}
      className="w-64 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-3 text-sm shadow-xl"
    >
      {children ?? <p className="font-medium text-[var(--color-noxe-ink)]">Create “{target}”?</p>}
      <div className="mt-3 grid gap-2">
        <button type="button" disabled={busy !== null} className={buttonClass} onClick={() => void createIn(currentFolder, "here")}>
          {busy === "here" ? "Creating…" : `Create “${target}.md” here`}
        </button>
        <button type="button" disabled={busy !== null} className={buttonClass} onClick={() => void createIn("", "root")}>
          {busy === "root" ? "Creating…" : `Create “${target}.md” at root`}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            openPalette();
            onClose?.();
          }}
        >
          Pick existing note…
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const buttonClass =
  "rounded-lg border border-[var(--color-noxe-border)] px-3 py-2 text-left text-[12px] hover:border-[var(--color-noxe-border-strong)] disabled:opacity-60";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unable to create note";
}
