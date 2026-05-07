import { useMemo } from "react";

import { moveOpenNote } from "@/features/note-ops/services/moveOpenNote";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { Select } from "@/shared/ui/Select";

type NoteFolderFieldProps = {
  noteId: string | null;
};

export function NoteFolderField({ noteId }: NoteFolderFieldProps) {
  const notes = useVaultStore((state) => state.notes);
  const note = noteId ? notes.find((entry) => entry.id === noteId) ?? null : null;

  const options = useMemo(() => {
    const set = new Set<string>();
    for (const entry of notes) {
      if (entry.folder) {
        set.add(entry.folder);
      }
    }
    return [
      { value: "", label: "Inbox" },
      ...Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((folder) => ({ value: folder, label: folder })),
    ];
  }, [notes]);

  if (!note) {
    return null;
  }

  return (
    <section aria-label="Folder" className="space-y-1.5">
      <h3 className="text-xs font-medium text-[var(--color-noxe-muted)]">Folder</h3>
      <Select
        ariaLabel="Move note to folder"
        value={note.folder}
        options={options}
        onChange={(next) => {
          void moveOpenNote(note.id, next);
        }}
      />
    </section>
  );
}
