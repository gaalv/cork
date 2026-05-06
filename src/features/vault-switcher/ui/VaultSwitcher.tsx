import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { switchVault } from "@/features/vault-switcher/services/switchVault";
import { useRecentVaultsStore } from "@/features/vault-switcher/state/recentVaultsStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { VaultListItem } from "./VaultListItem";

export function VaultSwitcher() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activePath = useVaultStore((state) => state.path);
  const vaults = useRecentVaultsStore((state) => state.vaults);
  const isLoading = useRecentVaultsStore((state) => state.isLoading);
  const loadRecent = useRecentVaultsStore((state) => state.loadRecent);
  const vaultName = activePath ? activePath.split(/[\\/]/).filter(Boolean).at(-1) ?? "Vault" : "No vault open";

  useEffect(() => {
    if (open) {
      void loadRecent();
    }
  }, [loadRecent, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectVault = (path?: string) => {
    setOpen(false);
    void switchVault(path ? { path } : undefined);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[240px] items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold tracking-tight hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        <span className="truncate">Vault: {vaultName}</span>
        <CaretDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-2 shadow-xl"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-noxe-muted)] uppercase">
            Recent vaults
          </div>
          {isLoading ? <div className="px-3 py-2 text-[12px] text-[var(--color-noxe-muted)]">Loading…</div> : null}
          {!isLoading && vaults.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[var(--color-noxe-muted)]">No recent vaults yet.</div>
          ) : null}
          {vaults.map((vault) => (
            <VaultListItem key={vault.path} vault={vault} activePath={activePath} onSelect={(path) => selectVault(path)} />
          ))}
          <div className="my-2 border-t border-[var(--color-noxe-border)]" />
          <button
            type="button"
            onClick={() => selectVault()}
            className="w-full rounded-md px-3 py-2 text-left text-[12px] font-medium text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
          >
            Open another vault…
          </button>
        </div>
      )}
    </div>
  );
}
