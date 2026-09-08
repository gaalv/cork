import { useState, type FormEvent } from "react";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useVaultStore } from "@/stores/vaultStore";

type CloneSyncedVaultModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CloneSyncedVaultModal({ open, onClose }: CloneSyncedVaultModalProps) {
  const cloneSyncedVault = useVaultStore((state) => state.cloneSyncedVault);
  const isLoading = useVaultStore((state) => state.isLoading);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  if (!open) return null;

  const close = () => {
    if (isLoading) return;
    setUrl("");
    setToken("");
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();
    if (!trimmedUrl || !trimmedToken || isLoading) return;

    try {
      await cloneSyncedVault({ url: trimmedUrl, token: trimmedToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("cancelled")) return;
      toast.error("Could not clone synced vault", {
        description: message,
        duration: 12000,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-cork-ink)]/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-synced-vault-title"
      onClick={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <form
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
        onSubmit={(event) => void handleSubmit(event)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <DownloadSimple size={16} className="text-[var(--color-cork-accent)]" />
            <h2 id="clone-synced-vault-title" className="text-[14px] font-semibold">
              Clone synced vault
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={isLoading}
            onClick={close}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor="clone-vault-url"
              className="mb-1 block text-[12px] font-medium text-[var(--color-cork-muted)]"
            >
              GitHub repository URL
            </label>
            <input
              id="clone-vault-url"
              autoFocus
              value={url}
              disabled={isLoading}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://github.com/user/notes.git"
              className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)] disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="clone-vault-token"
              className="mb-1 block text-[12px] font-medium text-[var(--color-cork-muted)]"
            >
              Fine-grained personal access token
            </label>
            <input
              id="clone-vault-token"
              type="password"
              autoComplete="off"
              value={token}
              disabled={isLoading}
              onChange={(event) => setToken(event.currentTarget.value)}
              placeholder="GitHub token"
              className="w-full rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-3 py-2 text-[14px] outline-none placeholder:text-[var(--color-cork-subtle)] focus:border-[var(--color-cork-accent)] disabled:opacity-50"
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-cork-subtle)]">
              Use a token limited to this repository with Contents read and write. Cork stores it
              only in the cloned repository's local Git credentials.
            </p>
          </div>

          <p className="rounded-lg bg-[var(--color-cork-panel-2)] px-3 py-2 text-[12px] text-[var(--color-cork-muted)]">
            You will choose the parent folder next. Cork creates the repository folder inside it and
            opens the cloned vault automatically.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-cork-border)] px-5 py-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={close}
            className="rounded-full px-4 py-1.5 text-[12px] font-medium text-[var(--color-cork-muted)] hover:text-[var(--color-cork-ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!url.trim() || !token.trim() || isLoading}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-cork-ink)] px-4 py-1.5 text-[12px] font-medium text-[var(--color-cork-primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            <DownloadSimple size={12} />
            {isLoading ? "Cloning..." : "Clone vault"}
          </button>
        </div>
      </form>
    </div>
  );
}
