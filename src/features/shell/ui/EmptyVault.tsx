import { FolderOpen } from "@phosphor-icons/react";

import { useVaultStore } from "@/features/vault/state/vaultStore";

export function EmptyVault() {
  const isLoading = useVaultStore((state) => state.isLoading);
  const openVault = useVaultStore((state) => state.openVault);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[var(--color-noxe-bg)] p-8">
      <section className="w-full max-w-md rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-noxe-panel-2)] text-[var(--color-noxe-muted)]">
          <FolderOpen size={24} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Open a vault to begin</h1>
        <p className="mt-2 text-sm text-[var(--color-noxe-muted)]">Choose a folder of Markdown notes. Noxe keeps your vault as plain files on disk.</p>
        <button
          type="button"
          onClick={() => void openVault()}
          disabled={isLoading}
          className="mt-6 rounded-full bg-[var(--color-noxe-ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          {isLoading ? "Opening…" : "Open Vault"}
        </button>
      </section>
    </main>
  );
}
