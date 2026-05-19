import { useVaultStore } from "@/features/vault/state/vaultStore";
import { NoxeWordmark } from "@/shared/ui/NoxeLogo";

export function EmptyVault() {
  const isLoading = useVaultStore((state) => state.isLoading);
  const openVault = useVaultStore((state) => state.openVault);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[var(--color-noxe-bg)] p-8">
      <section className="w-full max-w-md rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <NoxeWordmark height={32} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Open a vault to begin</h1>
        <p className="mt-2 text-sm text-[var(--color-noxe-muted)]">
          Choose a folder of Markdown notes. Noxe keeps your vault as plain files on disk.
        </p>
        <button
          type="button"
          onClick={() => void openVault()}
          disabled={isLoading}
          className="mt-6 rounded-full bg-[var(--color-noxe-primary)] px-4 py-2 text-sm font-medium text-[var(--color-noxe-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          {isLoading ? "Opening…" : "Open Vault"}
        </button>
      </section>
    </main>
  );
}
