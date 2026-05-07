import { useMemo } from "react";

import { moveOpenNote } from "@/features/note-ops/services/moveOpenNote";
import { useVaultStore } from "@/features/vault/state/vaultStore";

type NoteFolderFieldProps = {
  noteId: string | null;
};

export function NoteFolderField({ noteId }: NoteFolderFieldProps) {
  const notes = useVaultStore((state) => state.notes);
  const note = noteId ? notes.find((entry) => entry.id === noteId) ?? null : null;

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const entry of notes) {
      if (entry.folder) {
        set.add(entry.folder);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  if (!note) {
    return null;
  }

  const value = note.folder;

  return (
    <section aria-label="Folder" className="space-y-1.5">
      <h3 className="text-xs font-medium text-[var(--color-noxe-muted)]">Folder</h3>
      <select
        aria-label="Move note to folder"
        value={value}
        onChange={(event) => {
          void moveOpenNote(note.id, event.target.value);
        }}
        className="w-full rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] px-2 py-1.5 text-xs text-[var(--color-noxe-ink)]"
      >
        <option value="">Root</option>
        {folders.map((folder) => (
          <option key={folder} value={folder}>
            {folder}
          </option>
        ))}
      </select>
    </section>
  );
}
