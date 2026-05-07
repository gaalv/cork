import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { greetingForHour } from "./homeGreeting";

export function HomeHero() {
  const openVault = useVaultStore((state) => state.openVault);
  const openPalette = useShellStore((state) => state.openPalette);
  const greeting = greetingForHour(new Date().getHours());

  return (
    <section className="rounded-3xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-6 shadow-sm">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Home</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--color-noxe-ink)]">{greeting} 👋</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-noxe-muted)]">
            Pick up from pinned notes, recent work, or browse the full vault.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-full bg-[var(--color-noxe-primary)] px-4 py-2 text-sm text-[var(--color-noxe-primary-foreground)]">
            New Note ⌘N
          </button>
          <button
            type="button"
            onClick={openPalette}
            className="rounded-full border border-[var(--color-noxe-border)] px-4 py-2 text-sm hover:border-[var(--color-noxe-border-strong)]"
          >
            Command ⌘K
          </button>
          <button
            type="button"
            onClick={() => void openVault()}
            className="rounded-full border border-[var(--color-noxe-border)] px-4 py-2 text-sm hover:border-[var(--color-noxe-border-strong)]"
          >
            Open Vault
          </button>
        </div>
      </div>
    </section>
  );
}

