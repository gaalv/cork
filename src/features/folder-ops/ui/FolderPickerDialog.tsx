type FolderPickerDialogProps = {
  folders: Array<{ id: string; name: string; count?: number }>;
  open: boolean;
  title?: string;
  onPick: (folder: string) => void;
  onClose: () => void;
};

export function FolderPickerDialog({ folders, open, title = "Move to folder", onPick, onClose }: FolderPickerDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--color-noxe-ink)]/25" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[420px] w-[360px] overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[var(--color-noxe-border)] px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
        </header>
        <div className="max-h-[320px] overflow-y-auto p-2">
          <FolderPickButton name="Vault" count={folders.reduce((sum, folder) => sum + (folder.count ?? 0), 0)} onPick={() => onPick("")} />
          {folders.map((folder) => (
            <FolderPickButton
              key={folder.id}
              name={folder.name}
              count={folder.count}
              onPick={() => onPick(folder.id)}
            />
          ))}
        </div>
        <footer className="border-t border-[var(--color-noxe-border)] px-4 py-3 text-right">
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-[12px] hover:bg-[var(--color-noxe-panel-2)]">
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

function FolderPickButton({ name, count, onPick }: { name: string; count?: number; onPick: () => void }) {
  return (
    <button onClick={onPick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[var(--color-noxe-panel-2)]">
      <span className="truncate font-medium">{name}</span>
      {count !== undefined && <span className="ml-auto text-[11px] text-[var(--color-noxe-muted)]">{count}</span>}
    </button>
  );
}
