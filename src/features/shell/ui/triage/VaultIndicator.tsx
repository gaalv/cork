/**
 * Vault indicator — shows current vault name in the status bar with
 * a dropdown to switch vaults or open a new one (Tolaria-style).
 */

import { useEffect, useRef, useState } from "react";
import { CaretUpDown, FolderSimple, Plus, Trash } from "@phosphor-icons/react";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";
import type { RecentVault } from "@/shared/ipc/types";

export function VaultIndicator() {
  const vaultPath = useVaultStore((s) => s.path);
  const openVault = useVaultStore((s) => s.openVault);
  const [open, setOpen] = useState(false);
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const vaultName = vaultPath ? (vaultPath.split("/").pop() ?? "Vault") : "No vault";

  useEffect(() => {
    if (!open) return;
    client.vault
      .recent()
      .then(setRecentVaults)
      .catch(() => setRecentVaults([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSwitch = (path: string) => {
    setOpen(false);
    void openVault(path);
  };

  const handleOpenNew = () => {
    setOpen(false);
    void openVault();
  };

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await client.vault.removeRecent(path);
    setRecentVaults((prev) => prev.filter((v) => v.path !== path));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
      >
        <FolderSimple size={13} className="text-[var(--color-cork-accent)]" />
        <span className="max-w-[140px] truncate text-[11px] font-medium">{vaultName}</span>
        <CaretUpDown size={10} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-[260px] rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-lg">
          <div className="px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-cork-subtle)]">
              Vaults
            </span>
          </div>
          {recentVaults.map((vault) => (
            <button
              key={vault.path}
              onClick={() => handleSwitch(vault.path)}
              disabled={vault.missing}
              className={`group flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
                vault.path === vaultPath
                  ? "bg-[var(--color-cork-accent-soft)] font-medium text-[var(--color-cork-accent)]"
                  : vault.missing
                    ? "cursor-not-allowed text-[var(--color-cork-subtle)] line-through"
                    : "text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
              }`}
            >
              <FolderSimple size={14} weight={vault.path === vaultPath ? "fill" : "regular"} />
              <span className="flex-1 truncate">{vault.name}</span>
              {vault.path !== vaultPath && (
                <button
                  onClick={(e) => void handleRemoveRecent(e, vault.path)}
                  className="hidden rounded p-0.5 text-[var(--color-cork-subtle)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-danger)] group-hover:block"
                  title="Remove from recent"
                >
                  <Trash size={12} />
                </button>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--color-cork-border)]" />
          <button
            onClick={handleOpenNew}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          >
            <Plus size={14} />
            Open another vault
          </button>
        </div>
      )}
    </div>
  );
}
