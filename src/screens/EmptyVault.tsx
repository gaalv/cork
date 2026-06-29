/**
 * EmptyVault hero — shown when no vault is open.
 * Prompts the user to open or create a vault.
 */

import { FolderSimple, Notebook } from "@phosphor-icons/react";

import { useVaultStore } from "@/stores/vaultStore";

export function EmptyVault() {
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--color-cork-panel-2)]">
        <Notebook size={32} weight="duotone" className="text-[var(--color-cork-accent)]" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-[24px] text-[var(--color-cork-ink)]">
          Open a vault to begin
        </h1>
        <p className="mt-1.5 max-w-[320px] text-[14px] text-[var(--color-cork-muted)]">
          Open a folder of Markdown files to get started. Cork works with any folder — no import
          needed.
        </p>
      </div>
      <button
        onClick={() => void openVault()}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-[10px] bg-[var(--color-cork-primary)] px-5 py-2.5 text-[13px] font-medium text-[var(--color-cork-primary-foreground)] transition-transform hover:opacity-90 active:scale-[var(--press-scale)] disabled:opacity-50"
      >
        <FolderSimple size={16} />
        {isLoading ? "Opening..." : "Open Vault"}
      </button>
      <p className="text-[12px] text-[var(--color-cork-subtle)]">
        or press{" "}
        <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-kbd)] px-1 text-[10px]">
          ⌘ O
        </kbd>{" "}
        to pick a folder
      </p>
    </div>
  );
}
