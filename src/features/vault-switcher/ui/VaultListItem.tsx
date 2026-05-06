import type { RecentVault } from "@/shared/ipc/types";

type VaultListItemProps = {
  vault: RecentVault;
  activePath: string | null;
  onSelect: (path: string) => void;
};

export function VaultListItem({ vault, activePath, onSelect }: VaultListItemProps) {
  const active = vault.path === activePath;
  return (
    <button
      type="button"
      disabled={active}
      onClick={() => onSelect(vault.path)}
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[12px] hover:bg-[var(--color-noxe-panel-2)] disabled:cursor-default disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--color-noxe-ink)]">{vault.name}</span>
        <span className="block truncate text-[11px] text-[var(--color-noxe-muted)]">{vault.path}</span>
      </span>
      {active && <span className="shrink-0 text-[11px] text-[var(--color-noxe-muted)]">Active</span>}
    </button>
  );
}
