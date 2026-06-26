import type { AppSettings } from "@/shared/ipc/types";
import { SettingRow, Toggle } from "./SettingRow";

export function AdvancedSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingRow label="Auto-check updates" description="Check for new versions on launch">
        <Toggle
          checked={settings.updates?.autoCheck ?? true}
          onChange={(v) => update({ updates: { autoCheck: v } })}
        />
      </SettingRow>
    </div>
  );
}
