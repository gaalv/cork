import { useState } from "react";

import { validateFolderName } from "@/features/folder-ops/services/folderOps";

type NewFolderDialogProps = {
  parent: string;
  open: boolean;
  onCreate: (parent: string, name: string) => Promise<void> | void;
  onClose: () => void;
};

export function NewFolderDialog({ parent, open, onCreate, onClose }: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) {
    return null;
  }

  async function submit() {
    const validation = validateFolderName(name);
    if (validation) {
      setError(validation);
      return;
    }
    setIsSaving(true);
    try {
      await onCreate(parent, name.trim());
      setName("");
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--color-noxe-ink)]/25">
      <form
        aria-label="New folder"
        className="w-[320px] rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-[14px] font-semibold">New folder</h2>
        <p className="mt-1 text-[12px] text-[var(--color-noxe-muted)]">Create inside {parent || "Vault"}</p>
        <input
          autoFocus
          aria-label="Folder name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          className="mt-3 w-full rounded-lg border border-[var(--color-noxe-border)] px-3 py-2 text-[13px] outline-none focus-visible:border-[var(--color-noxe-border-strong)]"
        />
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[12px] hover:bg-[var(--color-noxe-panel-2)]">
            Cancel
          </button>
          <button disabled={isSaving} className="rounded-full bg-[var(--color-noxe-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-noxe-primary-foreground)] disabled:opacity-60">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not create folder";
}
