import { useCallback, useEffect, useState } from "react";

import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";
import type { AppSettings, VaultSettings } from "@/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

const RETENTION_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "Keep forever", value: 0 },
];

export function FilesSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  const [vaultSettings, setVaultSettings] = useState<VaultSettings | null>(null);

  useEffect(() => {
    void client.settings
      .vaultLoad()
      .then(setVaultSettings)
      .catch(() => {});
  }, []);

  const updateRetention = useCallback(
    (days: number) => {
      if (!vaultSettings) return;
      const updated = { ...vaultSettings, archiveRetentionDays: days };
      setVaultSettings(updated);
      void client.settings.vaultSave(updated);
    },
    [vaultSettings],
  );

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
      {vaultSettings && (
        <SettingRow
          label="Archive retention"
          description="How long archived notes are kept before auto-deletion"
        >
          <select
            value={vaultSettings.archiveRetentionDays ?? 30}
            onChange={(e) => updateRetention(Number(e.target.value))}
            className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-2 py-1 text-[13px] text-[var(--color-cork-ink)]"
          >
            {RETENTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
      )}
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
