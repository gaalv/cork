type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-noxe-ink)]/25">
      <div
        role="alertdialog"
        aria-label={title}
        className="w-[340px] rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 shadow-xl"
      >
        <h2 className="text-[14px] font-semibold text-[var(--color-noxe-ink)]">{title}</h2>
        {message ? (
          <p className="mt-1 text-[12px] text-[var(--color-noxe-muted)]">{message}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1.5 text-[12px] hover:bg-[var(--color-noxe-panel-2)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700"
                : "rounded-full bg-[var(--color-noxe-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-noxe-primary-foreground)]"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
