import { useVaultStore } from "@/stores/vaultStore";
import type { AppSettings } from "@/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

export function FilesSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <VaultPathRow />
      <SettingRow
        label="Offline mode"
        description="Disable external asset fetching for images and embeds"
      >
        <Toggle
          checked={settings.assets.offlineMode}
          onChange={(v) => update({ assets: { ...settings.assets, offlineMode: v } })}
        />
      </SettingRow>
    </div>
  );
}

function VaultPathRow() {
  const vaultPath = useVaultStore((s) => s.path);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[13px] font-medium">Vault path</div>
        <div className="text-[12px] text-[var(--color-cork-muted)]">Local folder used as vault</div>
      </div>
      <span
        className="max-w-[260px] truncate text-[13px] text-[var(--color-cork-muted)]"
        title={vaultPath ?? ""}
      >
        {vaultPath ?? "—"}
      </span>
    </div>
  );
}
